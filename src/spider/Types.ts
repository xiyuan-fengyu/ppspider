import {Queue} from "./queue/Queue";
import {Filter} from "./filter/Filter";
import {WorkerFactory} from "./worker/WorkerFactory";
import {Job} from "./job/Job";
import {JobManager} from "./manager/JobManager";
import {EventEmitter} from "events";
import {QueueManager} from "./manager/QueueManager";
import {LoggerSetting} from "../common/util/logger";
import {WebServer} from "./ui/WebServer";
import {DbDao} from "../common/db/DbDao";

export type Class_Queue = new () => Queue;

export type Class_Filter = new () => Filter;

export type Class_WorkerFactory = new () => WorkerFactory<any>;

export type ParallelConfig =  number | {
    [cron: string]: number
}

export type OnStartConfig = {
    urls: string | string[]; // 要抓取链接
    running?: boolean; // 系统启动后该队列是否处于工作状态
    parallel?: ParallelConfig; // 任务并行数配置；可以是一个定值，也可以通过cron表达式在特定时间动态更改数值
    exeInterval?: number; // 两个任务的执行间隔时间
    exeIntervalJitter?: number; // 在 exeInterval 基础上增加一个随机的抖动，这个值为左右抖动最大半径，默认为 exeIntervalJitter * 0.25
    timeout?: number; // 任务超时时间，单位：毫秒，默认：300000ms(5分钟)，负数表示永不超时
    description?: string; // 任务描述
    filterType?: Class_Filter; // 添加任务过滤器，默认是 BloonFilter，系统重启时，不会重复执行；如果希望重复执行，可以用 NoFilter
    maxTry?: number; // 最大尝试次数，默认：3次，负数表示一直尝试
    defaultDatas?: any; // 该类任务统一预设的job.datas内容
}

export type OnTimeConfig = {
    urls: string | string[];
    cron: string; // cron表达式，描述了周期性执行的时刻
    running?: boolean;
    parallel?: ParallelConfig;
    exeInterval?: number;
    exeIntervalJitter?: number;
    timeout?: number;
    description?: string;
    maxTry?: number;
    defaultDatas?: any; // 该类任务统一预设的job.datas内容
}

export type FromQueueConfig = {
    name: string; // 从该队列获取任务执行
    running?: boolean;
    parallel?: ParallelConfig;
    exeInterval?: number;
    exeIntervalJitter?: number;
    timeout?: number;
    description?: string;
    maxTry?: number;
    defaultDatas?: any; // 该类任务统一预设的job.datas内容
}

export type JobConfig =  OnStartConfig | OnTimeConfig | FromQueueConfig;

export type RequestMappingConfig = {
    url: string;
    httpMethod: "" | "GET" | "POST";
    target: any;
    method: string;
}

// 参考 https://angular.io/api/core/ViewEncapsulation
export enum ViewEncapsulation {
    Emulated = 0,
    Native = 1,
    None = 2,
    ShadowDom = 3
}

export type DataUiConfig = {
    label?: string;
    template: string;
    style?: string;
    encapsulation?: ViewEncapsulation
}

export type DataUiRequestConfig = {
    requestMethod: (...args) => any; // 可以是 @DataUi 标记类中的方法
    handleTarget: any; // 处理请求的target类
    handleMethod: string; // 处理请求的method名字
}

export type OnEventConfig = {
    event: string,
    target: any,
    method: string
}

export type AppConfig = {
    workplace: string; // 系统的工作目录
    queueCache?: string; // 运行状态保存文件的路径，默认为 this.workplace + "/queueCache.txt"
    dbUrl?: string; // 数据库配置，支持 nedb 或 mongodb；少量数据用 nedb，url格式为：nedb://本地nedb存储文件夹；若应用要长期执行，生成数据量大，建议使用 mongodb，url格式为：mongodb://username:password@host:port/dbName；默认："nedb://" + appInfo.workplace + "/nedb"
    tasks: any[]; // 任务类
    dataUis?: any[]; // 需要引入的DataUi
    workerFactorys: WorkerFactory<any>[]; // 工厂类实例
    webUiPort?: 9000 | number; // UI管理界面的web服务器端口，默认9000
    logger?: LoggerSetting; // 日志配置
}

export interface AppInfo extends AppConfig {

    jobManager: JobManager;

    queueManager: QueueManager;

    webServer: WebServer;

    eventBus: EventEmitter;

    db: DbDao;

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
    _?: any; // 额外信息，会保存到 job.datas._ 字段上
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
