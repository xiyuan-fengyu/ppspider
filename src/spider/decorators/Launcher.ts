import "source-map-support/register";
import {Looper, LooperTask} from "./LooperTask";
import {queueManager} from "../manager/QueueManager";
import {AppInfo, ClientRequest, JobConfig, RequestMappingConfig, WorkerFactoryMap} from "../data/Types";
import {WebServer} from "../ui/WebServer";
import {Defaults} from "../data/Defaults";
import {EventEmitter} from "events";
import {FileUtil} from "../../common/util/FileUtil";
import {jobManager} from "../manager/JobManager";
import {logger} from "../../common/util/logger";
import {NoneWorkerFactory} from "../worker/NoneWorkerFactory";

const taskInstances = new Map<any, any>();
export function getTaskInstances(taskClass) {
    let ins = taskInstances.get(taskClass);
    if (!ins) {
        ins = new taskClass();
        taskInstances.set(taskClass, ins);
    }
    return ins;
}

export const jobConfigs: JobConfig[] = [];
export const requestMappingConfigs: RequestMappingConfig[] = [];

export const appInfo: AppInfo = {} as any;
export const mainLooper = new Looper();
export const mainMessager = new EventEmitter(); // 用于 WebServer 和 ClientRequestHandler 通信

/**
 * 消息总线事件 key 命名规则
 * ModuleName_Action_args
 */
export enum MainMessagerEvent {
    WebServer_Request_request = "WebServer_Request_request",
    WebServer_Response_id_res = "WebServer_Response_id_res",
    WebServer_Push_key_data = "WebServer_Push_key_data",

    QueueManager_ForceStop = "QueueManager_ForceStop",
    QueueManager_QueueToggle_queueNameRegex_running = "QueueManager_QueueToggle_queueNameRegex_running",
}

/**
 * 整个系统的启动入口
 * @param {AppInfo} theAppInfo
 * @returns {(target) => void}
 * @constructor
 */
export function Launcher(theAppInfo: AppInfo) {
    Object.assign(appInfo, theAppInfo);

    FileUtil.mkdirs(appInfo.workplace); // 创建工作目录

    logger.setting = theAppInfo.logger; // 设置日志配置

    (async () => {
        const workerFactoryMap: WorkerFactoryMap = {};
        for (let workerFactory of appInfo.workerFactorys) {
            workerFactoryMap[(workerFactory as any).constructor.name] = workerFactory;
        }

        // 如果用户没有添加 NoneWorkerFactory, 则自动添加这个 factory
        const kNoneWorkerFactory = NoneWorkerFactory.name;
        if (!workerFactoryMap.hasOwnProperty(kNoneWorkerFactory)) {
            workerFactoryMap[kNoneWorkerFactory] = new NoneWorkerFactory();
        }

        // 等待 jobManager 初始化完成， 实际上是等待 nedb 数据库加载完成
        await jobManager.init();

        // 添加 任务信息
        jobConfigs.forEach(item => item["target"] = getTaskInstances(item["target"]));
        queueManager.addJobConfigs(jobConfigs);

        // 向消息总线中添加更改队列运行状态的消息事件监听
        queueManager.listenQueueToggle();

        // 加载之前保存的运行状态
        queueManager.loadFromCache(appInfo.workplace + "/queueCache.json");

        // 启动UI界面的web服务器
        requestMappingConfigs.forEach(item => item.target = getTaskInstances(item.target));
        const webServer = new WebServer(appInfo.webUiPort || Defaults.webUiPort);

        // 添加 UI 请求的处理回调
        {
            class ClientRequestHandler {

                /**
                 * ui客户端连接成功后主动获取队列信息
                 * @param {ClientRequest} request
                 * @returns {any}
                 */
                static getQueueInfo(request: ClientRequest) {
                    return {
                        success: true,
                        data: queueManager.info()
                    };
                }

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
                static async jobs(request: ClientRequest): Promise<any> {
                    return await jobManager.jobs(request.data);
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
                static async jobDetail(request: ClientRequest): Promise<any> {
                    return await jobManager.jobDetail(request.data);
                }

                /**
                 * 手动将jobs页面搜索到的job重新添加到队列中，Fail 和 Success 状态的任务可以自行此操作
                 * @param {ClientRequest} request
                 * @returns {Promise<any>}
                 */
                static async jobManulRetry(request: ClientRequest): Promise<any> {
                    return await queueManager.jobManulRetry(request.data);
                }

            }

            // UI 请求派发给 ClientRequestHandler 处理
            mainMessager.on(MainMessagerEvent.WebServer_Request_request, async (request: ClientRequest) => {
                const method = ClientRequestHandler[request.key];
                if (typeof method == "function") {
                    try {
                        const res = await method.call(ClientRequestHandler, request);
                        mainMessager.emit(MainMessagerEvent.WebServer_Response_id_res, request.id, res);
                    }
                    catch (e) {
                        console.warn(e.stack);
                        mainMessager.emit(MainMessagerEvent.WebServer_Response_id_res, request.id, {
                            success: false,
                            message: e.message
                        });
                    }
                }
                else {
                    mainMessager.emit(MainMessagerEvent.WebServer_Response_id_res, request.id, {
                        success: false,
                        message: "method not found"
                    });
                }
            });
        }

        // 主循环，目前只用于 任务派发
        class MainLooperTasks {

            @LooperTask(mainLooper, 60)
            queueDispatch() {
                queueManager.dispatch(workerFactoryMap); // 派发任务
            }

        }

        // 启动 mainLooper，并等待系统关闭
        await mainLooper.startAndAwaitShutdown();

        // 停止系统
        for (let workerFactory of appInfo.workerFactorys) {
            workerFactory.shutdown();
        }
        webServer.shutdown();
        process.exit(0);
    })();

    return function (target) {};
}
