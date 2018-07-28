import "source-map-support/register";
import {Looper, LooperTask} from "./LooperTask";
import {queueManager} from "../manager/QueueManager";
import {AppInfo, ClientRequest, WorkerFactoryMap} from "../data/Types";
import {WebServer} from "../ui/WebServer";
import {Defaults} from "../data/Defaults";
import {EventEmitter} from "events";
import {FileUtil} from "../../common/util/FileUtil";
import {jobManager} from "../manager/JobManager";
import {logger} from "../..";

const taskInstances: any = {};
export function getTaskInstances(taskClass) {
    const ins = taskInstances[taskClass.name];
    if (ins) return ins;
    else return taskInstances[taskClass.name] = new taskClass();
}

export const appInfo: AppInfo = {} as any;

/**
 * 整个系统的启动入口
 * @param {AppInfo} theAppInfo
 * @returns {(target) => void}
 * @constructor
 */
export function Launcher(theAppInfo: AppInfo) {
    for (let key of Object.keys(theAppInfo)) {
        Object.defineProperty(appInfo, key, {
            get: () => theAppInfo[key]
        });
    }
    FileUtil.mkdirs(appInfo.workplace); // 创建工作目录

    logger.setting = theAppInfo.logger; // 设置日志配置

    jobManager.init(); // 初始化 jobManager
    queueManager.loadFromCache(appInfo.workplace + "/queueCache.json"); // 尝试加载之前保存的运行状态

    return function (target) {
        const mainLooper = new Looper();
        const mainMessager = new EventEmitter(); // 用于 WebServer 和 ClientRequestHandler 通信
        const webServer = new WebServer(appInfo.webUiPort || Defaults.webUiPort, mainMessager); // 启动UI界面的web服务器

        const workerFactoryMap: WorkerFactoryMap = {};
        for (let workerFactory of appInfo.workerFactorys) {
            workerFactoryMap[(workerFactory as any).constructor.name] = workerFactory;
        }

        {
            class ClientRequestHandler {

                /**
                 * 删除保存运行状态的文件
                 * @param {ClientRequest} request
                 * @returns {any}
                 */
                static deleteQueueCache(request: ClientRequest): any {
                    return queueManager.deleteQueueCache();
                }

                /**
                 * 更新任务配置
                 * @param {ClientRequest} request
                 * @returns {any}
                 */
                static updateQueueConfig(request: ClientRequest): any {
                    return queueManager.updateConfig(request.data)
                }

                /**
                 * 暂停或开始 任务派发
                 * @param {ClientRequest} request
                 * @returns {any}
                 */
                static resetQueueManagerPause(request: ClientRequest): any {
                    queueManager.resetPause(request.data);
                    return true;
                }

                /**
                 * 停止整个系统
                 * @param {ClientRequest} request
                 * @returns {Promise<any>}
                 */
                static stopSystem(request: ClientRequest): Promise<any> {
                    return queueManager.waitRunning().then(res => {
                        if (request.data.saveState) {
                            queueManager.saveToCache();
                        }
                        setTimeout(() => {
                            mainLooper.shutdown();
                        }, 1000);
                        return true;
                    });
                }

                /**
                 * 查询 job 列表
                 * @param {ClientRequest} request
                 * @returns {Promise<any>}
                 */
                static jobs(request: ClientRequest): Promise<any> {
                    return jobManager.jobs(request.data);
                }

                /**
                 * 删除符合条件的jobs
                 * @param {ClientRequest} request
                 * @returns {Promise<any>}
                 */
                static deleteJobs(request: ClientRequest): Promise<any> {
                    return jobManager.deleteJobs(request.data);
                }

                /**
                 * 获取 job 详情
                 * @param {ClientRequest} request
                 * @returns {Promise<any>}
                 */
                static jobDetail(request: ClientRequest): Promise<any> {
                    return jobManager.jobDetail(request.data);
                }

            }
            // UI 请求派发给 ClientRequestHandler 处理
            mainMessager.on("request", async (request: ClientRequest) => {
                const method = ClientRequestHandler[request.key];
                if (typeof method == "function") {
                    try {
                        const res = await method.call(ClientRequestHandler, request);
                        mainMessager.emit("response_" + request.id, res);
                    }
                    catch (e) {
                        console.warn(e.stack);
                        mainMessager.emit("response_" + request.id, {
                            success: false,
                            message: e.message
                        });
                    }
                }
                else {
                    mainMessager.emit("response_" + request.id, {
                        success: false,
                        message: "method not found"
                    });
                }
            });
        }

        class MainLooperTasks {
            @LooperTask(mainLooper, 60)
            queueDispatch() {
                queueManager.dispatch(workerFactoryMap); // 派发任务
            }

            @LooperTask(mainLooper, 750)
            pushToClients() {
                // 推送当前系统的运行状态给UI界面
                mainMessager.emit("push", "info", {
                    running: true,
                    queue: queueManager.info()
                });
            }
        }

        // 启动mainLooper，并等待系统关闭
        mainLooper.startAndAwaitShutdown().then(async () => {
            for (let workerFactory of appInfo.workerFactorys) {
                workerFactory.shutdown();
            }
            webServer.shutdown();
            process.exit(0);
        });
    };

}