import {OnTimeConfig} from "../Types";
import {addJobConfig} from "./Launcher";

/**
 * 添加一个周期性执行的任务配置
 * @param {OnTimeConfig} config
 * @returns {(target, key, descriptor) => any}
 * @constructor
 */
export function OnTime(config: OnTimeConfig) {
    return function (target, key, descriptor) {
        config["type"] = "OnTime";
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