export interface WorkerFactory<Worker> {

    get(): Promise<Worker>;

    release(worker: Worker): Promise<void>;

    isBusy(): boolean;

    shutdown();

}