import {FromQueueConfig} from "../data/Types";
import {queueManager} from "../manager/QueueManager";
import {getTaskInstances} from "./Launcher";

/**
 * 从一个任务队列中获取任务并执行
 * 实际上执行操作由 QueueManager.dispatch 触发，这里只是将任务相关的信息添加到 QueueManager
 * @param {FromQueueConfig} config
 * @returns {(target, key, descriptor) => any}
 * @constructor
 */
export function FromQueue(config: FromQueueConfig) {
    return function (target, key, descriptor) {
        config["type"] = "FromQueue";
        config["target"] = getTaskInstances(target.constructor);
        config["method"] = key;
        queueManager.addFromQueueConfig(config);
        return descriptor;
    }
}