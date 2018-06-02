import {WorkerFactory} from "../worker/WorkerFactory";
import {Filter} from "../filter/Filter";
import {Queue} from "../queue/Queue";
import {Job} from "../job/Job";

export type JobExeTime = {
    start?: number;
    end?: number;
}

export type QueueClass = new () => Queue;

export type FilterClass = new () => Filter;

export type LooperTaskInfo = {
    method: () => void;
    interval: number;
    lastExe?: number;
}

export type ParallelConfig =  number | {
    [cron: string]: number
}

export type WorkerFactoryClass = new () => WorkerFactory<any>;

export type OnStartConfig = {
    urls: string | string[];
    workerFactory: WorkerFactoryClass;
    parallel?: ParallelConfig;
    exeInterval?: number;
    description?: string;
}

export type OnTimeConfig = {
    urls: string | string[];
    cron: string;
    workerFactory: WorkerFactoryClass;
    parallel?: ParallelConfig;
    exeInterval?: number;
    description?: string;
}

export type FromQueueConfig = {
    name: string;
    workerFactory: WorkerFactoryClass;
    parallel?: ParallelConfig;
    exeInterval?: number;
    description?: string;
}

export type JobConfig =  OnStartConfig | OnTimeConfig | FromQueueConfig;

export type JobOverrideConfig = {
    target: any;
    method: (job: Job) => void;
}

export type JobOverrideConfigs = {
    [queueName: string]: JobOverrideConfig
}

export type CanCastToJob = string | string[] | Job | Job[];

export type AddToQueueData = Promise<CanCastToJob | {
    [queueName: string]: CanCastToJob
}>

export type AddToQueueConfig = {
    name: string;
    queueType?: QueueClass;
    filterType?: FilterClass;
}

export type AddToQueueInfo = {
    queueName: string;
    jobs: CanCastToJob;
    queueType: QueueClass;
    filterType: FilterClass;
    other?: any;
};

export type AddToQueueInfos = AddToQueueInfo | AddToQueueInfo[];

export type Queues = {
    [queueName: string]: {
        queue: Queue;
        config?: JobConfig;
        curParallel?: number; // 当前并行数
        curMaxParallel?: number; // 当前最大并行数
        success?: number; // 成功的数量
        fail?: number; // 失败的数量
        lastExeTime?: number; // 上一次从该队列pop job的时间戳
    }
}

export type WorkerFactoryMap = {
    [typeName: string]: WorkerFactory<any>
}

export type AppInfo = {
    workplace: string,
    tasks: any[],
    workerFactorys: WorkerFactory<any>[],
    webUiPort?: number | 9000;
}

export type LinkPredictType = string | RegExp | ((href: string) => boolean);

export type ClientRequest = {
    id: string;
    key: string;
    data: any;
}

export type UpdateQueueConfigData = {
    queue: string;
    field: string;
    value: any;
}