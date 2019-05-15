import {WorkerFactory} from "./WorkerFactory";
import {Serializable} from "../../common/serialize/Serializable";

@Serializable()
export class NoneWorkerFactory implements WorkerFactory<any> {

    get(): Promise<any> {
        return new Promise<any>(resolve => {
            resolve({});
        });
    }

    release(worker: any): Promise<void> {
        return;
    }

    shutdown() {
    }

}