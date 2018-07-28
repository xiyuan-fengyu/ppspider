import {WorkerFactory} from "../worker/WorkerFactory";
import {Filter} from "../filter/Filter";
import {Queue} from "../queue/Queue";
import {Job} from "../job/Job";
import {LoggerSetting} from "../..";

export type JobExeTime = {
    start?: number; // job 开始执行的时间
    end?: number; // job 执行结束的时间
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
    urls: string | string[]; // 要抓取链接
    workerFactory: WorkerFactoryClass; // worker工厂类型
    parallel?: ParallelConfig; // 任务并行数配置
    exeInterval?: number; // 两个任务的执行间隔时间
    description?: string; // 任务描述
}

export type OnTimeConfig = {
    urls: string | string[];
    cron: string; // cron表达式，描述了周期性执行的时间
    workerFactory: WorkerFactoryClass;
    parallel?: ParallelConfig;
    exeInterval?: number;
    description?: string;
}

export type FromQueueConfig = {
    name: string; // 从该队列获取任务执行
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
}

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
    workplace: string; // 系统的工作目录
    tasks: any[]; // 注入task类的列表
    workerFactorys: WorkerFactory<any>[]; // 工厂类实例
    webUiPort?: 9000 | number; // UI管理界面的web服务器端口，默认9000
    logger?: LoggerSetting; // 日志配置
}

export type Selector = string;
export type Href = string;
export type HrefRegex = string | RegExp;
export type ElementTransformer = (ele: Element) => Href | void;
export type LinkPredict = HrefRegex | ElementTransformer | [Selector, HrefRegex | ElementTransformer];
export type LinkPredictMap = {
    [groupName: string]: LinkPredict
}


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