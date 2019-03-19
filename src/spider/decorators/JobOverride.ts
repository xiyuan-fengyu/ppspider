import {addJobOverrideConfig} from "./Launcher";

/**
 * 在任务添加到队列之前，对任务做统一修改
 * 修改操作在被装饰的方法中进行，例如对 job 的key进行修改，防止一些重复的url
 * @param {string} queueName
 * @returns {(target, key, descriptor) => any}
 * @constructor
 */
export function JobOverride(queueName: string) {
    return function (target, key, descriptor) {
        addJobOverrideConfig(queueName, {
            target: target,
            method: descriptor.value
        });
        return descriptor;
    }
}