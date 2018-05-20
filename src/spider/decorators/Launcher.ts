import {Looper, LooperTask} from "./LooperTask";
import {queueManager} from "../manager/QueueManager";
import {AppInfo, ClientRequest, WorkerFactoryMap} from "../data/Types";
import {WebServer} from "../ui/WebServer";
import {Defaults} from "../data/Defaults";
import {EventEmitter} from "events";

const taskInstances: any = {};
export function getTaskInstances(taskClass) {
    const ins = taskInstances[taskClass.name];
    if (ins) return ins;
    else return taskInstances[taskClass.name] = new taskClass();
}

export function Launcher(appInfo: AppInfo) {
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

                test(request: ClientRequest): any {
                    return "test success " + request.data.toString();
                }

            }
            const clientRequestHandler = new ClientRequestHandler();
            mainMessager.on("request", async (request: ClientRequest) => {
                const method = clientRequestHandler[request.key];
                let success = false;
                if (typeof method == "function") {
                    try {
                        const res = await method.call(clientRequestHandler, request);
                        mainMessager.emit("response_" + request.id, res);
                        success = true;
                    }
                    catch (e) {
                        console.warn(e.stack);
                    }
                }

                if (!success) {
                    mainMessager.emit("response_" + request.id, "");
                }
            });
        }

        class MainLooperTasks {
            @LooperTask(mainLooper, 60)
            queueDispatch() {
                queueManager.dispatch(workerFactoryMap);
            }

            @LooperTask(mainLooper, 1000)
            sendMsgToUiClients() {
                mainMessager.emit("push", "info", new Date().getTime())
            }
        }

        mainLooper.startAndAwaitShutdown().then(async () => {
            for (let workerFactory of appInfo.workerFactorys) {
                workerFactory.shutdown();
            }

            webServer.shutdown();

            // @TODO 存储信息

            process.exit(0);
        });
    };

}