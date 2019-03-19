
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

export function instanceofJob(obj: any): obj is Job {
    const cast = obj as Job;
    return cast
        && typeof cast.id == "function"
        && typeof cast.parentId == "function"
        && typeof cast.queue == "function"
        && typeof cast.url == "function"
        && typeof cast.key == "function"
        && typeof cast.datas == "function"
        && typeof cast.priority == "function"
        && typeof cast.depth == "function"
        && typeof cast.status == "function"
        && typeof cast.tryNum == "function"
        && typeof cast.createTime == "function"
        && typeof cast.logs == "function";
}

export interface Job {

    // 任务id
    id(): string;

    // 父任务id
    parentId(parentId?: string): string;

    // 来自哪一个队列；现在所有任务都由队列来管理
    queue(queue?: string): string;

    // 要抓取的网页
    url(): string;

    // 任务唯一性标识；用于filter监测
    key(key?: string): string;

    // 任务携带的额外数据
    datas(newDatas?: any): any;

    // 优先级；用于优先级排序，越小越靠前
    priority(priority?: number): number;

    // 任务深度
    depth(depth?: number): number;

    // 任务状态
    status(status?: JobStatus): JobStatus;

    // 重试次数
    tryNum(tryNum?: number): number;

    // 创建时间
    createTime(): number;

    // 有参数：插入日志；返回所有日志；可以通过 logger.format 方法来构建标准格式的日志
    logs(log?: string): string[];

}
