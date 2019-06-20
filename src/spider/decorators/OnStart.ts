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
        const methodBody = target[key].toString();
        config["paramnames"] = methodBody.substring(methodBody.indexOf("(") + 1, methodBody.indexOf(")"))
            .split(",").map(item => item.trim()).filter(item => item);
        config["paramtypes"] = Reflect.getMetadata('design:paramtypes', target, key);
        addJobConfig(config);
        return descriptor;
    }
}
