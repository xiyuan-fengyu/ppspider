import {OnTimeConfig} from "../data/Types";
import {queueManager} from "../manager/QueueManager";
import {getTaskInstances} from "./Launcher";

/**
 * 添加一个周期性执行的任务配置
 * @param {OnTimeConfig} config
 * @returns {(target, key, descriptor) => any}
 * @constructor
 */
export function OnTime(config: OnTimeConfig) {
    return function (target, key, descriptor) {
        config["type"] = "OnTime";
        config["target"] = getTaskInstances(target.constructor);
        config["method"] = key;
        queueManager.addOnTimeConfig(config);
        return descriptor;
    }
}