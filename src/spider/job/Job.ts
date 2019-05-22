import {Serializable, StringUtil} from "../..";

export enum JobStatus {
    // 在队列中等待
    Waiting,
    // 被过滤器过滤掉了
    Filtered,
    // 执行中
    Running,
    // 任务成功
    Success,
    // 运行失败，等待重试
    RetryWaiting,
    // 超过最大重试次数，任务失败
    Fail,
    // 任务已关闭，队列在派发任务的时候会忽略这个任务
    // Waiting,RetryWaiting状态的任务可以被关闭进入Closed状态
    // OnTime 任务在到达执行时间的时候，如果队列处于不运行状态，则也会进入 Closed 状态
    Closed,
}

export function instanceofJob(obj: any) {
    return obj instanceof Job;
}

@Serializable()
export class Job {

    // 任务id
    _id: string = StringUtil.id();

    // 父任务id
    parentId: string;

    // 来自哪一个队列；现在所有任务都由队列来管理
    queue: string;

    // 要抓取的网页
    readonly url: string;

    // 任务唯一性标识；用于filter监测
    key: string;

    // 任务携带的额外数据
    datas: any = {};

    // 优先级；用于优先级排序，越小越靠前
    priority: number = 0;

    // 任务深度
    depth: number = 0;

    // 任务状态
    status: JobStatus = JobStatus.Waiting;

    // 重试次数
    tryNum: number = 0;

    // 创建时间
    createTime: number = new Date().getTime();

    // 日志；可以通过 logger.format 方法来构建标准格式的日志
    logs: string[] = [];

    constructor(urlOrParams: string | Object) {
        if (typeof urlOrParams === "string") {
            this.url = urlOrParams;
        }
        else {
            Object.assign(this, urlOrParams);
        }
    }

}
