export interface WorkerFactory<Worker extends Object> {

    workerType(): any;

    get(): Promise<Worker>;

    release(worker: Worker): Promise<void>;

    shutdown();

}