import {WorkerFactory} from "./WorkerFactory";

export class NoneWorkerFactory implements WorkerFactory<any> {

    workerType(): any {
        return null;
    }

    get(): Promise<any> {
        return new Promise<any>(resolve => {
            resolve(null);
        });
    }

    release(worker: any): Promise<void> {
        return;
    }

    shutdown() {
    }

}