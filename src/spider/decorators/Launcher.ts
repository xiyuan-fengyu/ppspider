import {Looper, LooperTask} from "./LooperTask";
import {WorkerFactory} from "../worker/WorkerFactory";
import {queueManager} from "../manager/QueueManager";
import {WorkerFactoryMap} from "../data/Types";

const mainLooper = new Looper();

export function Launcher(appInfo: {
    tasks: any[],
    workerFactorys: WorkerFactory<any>[]
}) {
    const workerFactoryMap: WorkerFactoryMap = {};
    for (let workerFactory of appInfo.workerFactorys) {
        workerFactoryMap[(workerFactory as any).constructor.name] = workerFactory;
    }

    return function (target) {
        const app = new target();

        class MainLooperTasks {
            @LooperTask(mainLooper, 60)
            queueDispatch() {
                queueManager.dispatch(workerFactoryMap);
            }
        }

        mainLooper.startAndAwaitShutdown().then(async () => {
            for (let workerFactory of appInfo.workerFactorys) {
                workerFactory.shutdown();
            }
        });
    };

}