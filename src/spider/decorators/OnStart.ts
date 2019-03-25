import {OnStartConfig} from "../Types";
import {addJobConfig} from "./Launcher";

/**
 * 添加一个系统启动后立即执行的任务配置
 * @param {OnStartConfig} config
 * @returns {(target, key, descriptor) => any}
 * @constructor
 */
export function OnStart(config: OnStartConfig) {
    return function (target, key, descriptor) {
        config["type"] = "OnStart";
        config["target"] = target.constructor;
        config["method"] = key;
        addJobConfig(config);
        return descriptor;
    }
}
