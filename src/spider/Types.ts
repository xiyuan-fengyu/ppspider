import {Queue} from "./queue/Queue";
import {Filter} from "./filter/Filter";
import {WorkerFactory} from "./worker/WorkerFactory";
import {Job} from "./job/Job";
import {JobManager} from "./manager/JobManager";
import {EventEmitter} from "events";
import {QueueManager} from "./manager/QueueManager";
import {LoggerSetting} from "../common/util/logger";
import {WebServer} from "./ui/WebServer";

export type Class_Queue = new () => Queue;

export type Class_Filter = new () => Filter;

export type Class_WorkerFactory = new () => WorkerFactory<any>;

export type ParallelConfig =  number | {
    [cron: string]: number
}

export type OnStartConfig = {
    urls: string | string[]; // 要抓取链接
    workerFactory: Class_WorkerFactory; // worker工厂类型
    running?: boolean; // 系统启动后该队列是否处于工作状态
    parallel?: ParallelConfig; // 任务并行数配置
    exeInterval?: number; // 两个任务的执行间隔时间
    exeIntervalJitter?: number; // 在 exeInterval 基础上增加一个随机的抖动，这个值为左右抖动最大半径，默认为 exeIntervalJitter * 0.25
    timeout?: number; // 任务超时时间，单位：毫秒，默认：300000ms(5分钟)，负数表示永不超时
    description?: string; // 任务描述
}

export type OnTimeConfig = {
    urls: string | string[];
    cron: string; // cron表达式，描述了周期性执行的时间
    workerFactory: Class_WorkerFactory;
    running?: boolean;
    parallel?: ParallelConfig;
    exeInterval?: number;
    exeIntervalJitter?: number;
    timeout?: number;
    description?: string;
}

export type FromQueueConfig = {
    name: string; // 从该队列获取任务执行
    workerFactory: Class_WorkerFactory;
    running?: boolean;
    parallel?: ParallelConfig;
    exeInterval?: number;
    exeIntervalJitter?: number;
    timeout?: number;
    description?: string;
}

export type JobConfig =  OnStartConfig | OnTimeConfig | FromQueueConfig;

export type RequestMappingConfig = {
    url: string;
    httpMethod: "" | "GET" | "POST";
    target: any;
    method: string;
}

export type DataUiConfig = {
    title?: string;
    template: string;
}

export type AppConfig = {
    workplace: string; // 系统的工作目录
    queueCache?: string; // 运行状态保存文件的路径，默认为 this.workplace + "/queueCache.json"
    tasks: any[]; // 注入task类的列表
    workerFactorys: WorkerFactory<any>[]; // 工厂类实例
    webUiPort?: 9000 | number; // UI管理界面的web服务器端口，默认9000
    logger?: LoggerSetting; // 日志配置
}

export interface AppInfo extends AppConfig {

    jobManager: JobManager;

    queueManager: QueueManager;

    webServer: WebServer;

    eventBus: EventEmitter;

}

export type IdKeyData = {
    id: string;
    key: string;
    data: any;
}

export type CanCastToJob = string | string[] | Job | Job[];

export type AddToQueueData = Promise<CanCastToJob | {
    [queueName: string]: CanCastToJob
}>

export type AddToQueueConfig = {
    name: string;
    queueType?: Class_Queue;
    filterType?: Class_Filter;
}

export type AddToQueueInfo = {
    queueName: string;
    jobs: CanCastToJob;
    queueType: Class_Queue;
    filterType: Class_Filter;
    _?: any; // 额外信息，用于
}

export type AddToQueueInfos = AddToQueueInfo | AddToQueueInfo[];

export type JobOverrideConfig = {
    target: any;
    method: (job: Job) => void;
}

export type JobOverrideConfigs = {
    [queueName: string]: JobOverrideConfig
}

export type UpdateQueueConfigData = {
    queue: string;
    field: string;
    value: any;
}
