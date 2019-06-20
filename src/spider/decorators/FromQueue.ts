import {addJobConfig} from "./Launcher";
import {FromQueueConfig} from "../Types";

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
        config["target"] = target.constructor;
        config["method"] = key;
        const methodBody = target[key].toString();
        config["paramnames"] = methodBody.substring(methodBody.indexOf("(") + 1, methodBody.indexOf(")"))
            .split(",").map(item => item.trim()).filter(item => item);
        config["paramtypes"] = Reflect.getMetadata('design:paramtypes', target, key);
        addJobConfig(config);
        return descriptor;
    }
}