import {Looper, LooperTask} from "./LooperTask";
import {queueManager} from "../manager/QueueManager";
import {AppInfo, ClientRequest, WorkerFactoryMap} from "../data/Types";
import {WebServer} from "../ui/WebServer";
import {Defaults} from "../data/Defaults";
import {EventEmitter} from "events";
import {FileUtil} from "../../common/util/FileUtil";
import {jobManager} from "../manager/JobManager";

const taskInstances: any = {};
export function getTaskInstances(taskClass) {
    const ins = taskInstances[taskClass.name];
    if (ins) return ins;
    else return taskInstances[taskClass.name] = new taskClass();
}

export let appInfo: AppInfo = null;

export function Launcher(theAppInfo: AppInfo) {
    appInfo = theAppInfo;
    FileUtil.mkdirs(appInfo.workplace);

    jobManager.init();
    queueManager.loadFromCache(appInfo.workplace + "/queueCache.json");

    return function (target) {
        const mainLooper = new Looper();
        const mainMessager = new EventEmitter();
        const webServer = new WebServer(appInfo.webUiPort || Defaults.webUiPort, mainMessager);

        const workerFactoryMap: WorkerFactoryMap = {};
        for (let workerFactory of appInfo.workerFactorys) {
            workerFactoryMap[(workerFactory as any).constructor.name] = workerFactory;
        }

        {
            class ClientRequestHandler {

                static deleteQueueCache(request: ClientRequest): any {
                    return queueManager.deleteQueueCache();
                }

                static updateQueueConfig(request: ClientRequest): any {
                    return queueManager.updateConfig(request.data)
                }

                static resetQueueManagerPause(request: ClientRequest): any {
                    queueManager.resetPause(request.data);
                    return true;
                }

                static async stopSystem(request: ClientRequest): any {
                    await queueManager.waitRunning();
                    if (request.data.saveState) {
                        queueManager.stopAndSaveToCache();
                    }
                    setTimeout(() => {
                        mainLooper.shutdown();
                    }, 1000);
                    return true;
                }

                static async jobs(request: ClientRequest): any {
                    return await jobManager.jobs(request.data);
                }

                static async deleteJobs(request: ClientRequest): any {
                    return await jobManager.deleteJobs(request.data);
                }

                static async jobDetail(request: ClientRequest): any {
                    return await jobManager.jobDetail(request.data);
                }

            }
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
                queueManager.dispatch(workerFactoryMap);
            }

            @LooperTask(mainLooper, 750)
            pushToClients() {
                mainMessager.emit("push", "info", {
                    running: true,
                    queue: queueManager.info()
                });
            }
        }

        mainLooper.startAndAwaitShutdown().then(async () => {
            for (let workerFactory of appInfo.workerFactorys) {
                workerFactory.shutdown();
            }
            webServer.shutdown();
            process.exit(0);
        });
    };

}