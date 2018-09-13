import {AddToQueueConfig, AddToQueueInfo} from "../data/Types";
import {instanceofJob, Job} from "../job/Job";
import {queueManager} from "../manager/QueueManager";
import {getTaskInstances} from "./Launcher";
import {logger} from "../../common/util/logger";

export enum AddToQueueStrategyIfError {
    // 打印 warn 日志
    warn,
    // 抛出异常
    error,
    // 忽略
    ignore
}

function handleAddToQueueIfError(msg: string, addToQueueStrategyIfError: AddToQueueStrategyIfError) {
    if (addToQueueStrategyIfError == AddToQueueStrategyIfError.warn) {
        logger.warn(msg);
    }
    else if (addToQueueStrategyIfError == AddToQueueStrategyIfError.error) {
        throw new Error(msg);
    }
}

function getAddToQueueConfig(queueConfigs: AddToQueueConfig | AddToQueueConfig[], queueName: string, addToQueueStrategyIfError: AddToQueueStrategyIfError): AddToQueueConfig {
    let config: AddToQueueConfig = null;
    if (queueName) {
        // 多个队列中根据queueName找到对应的队列
        if (queueConfigs.constructor == Array) {
            for (let queueConfig of (queueConfigs as AddToQueueConfig[])) {
                if (queueConfig.name == queueName) {
                    config = queueConfig;
                    break;
                }
            }
        }
        else {
            const queueConfig = queueConfigs as AddToQueueConfig;
            if (queueConfig.name == queueName) {
                config = queueConfig;
            }
        }

        if (config == null) {
            handleAddToQueueIfError("cannot find a queue with name: " + queueName, addToQueueStrategyIfError);
            return null;
        }
    }
    else {
        // 单个队列
        let queueNum: number;
        if (queueConfigs.constructor == Array) {
            if ((queueNum = (queueConfigs as AddToQueueConfig[]).length) != 1) {
                handleAddToQueueIfError(queueNum == 0 ? "no queue to add" :
                    queueNum + " queues provide and cannot decide which to add to", addToQueueStrategyIfError);
                return null;
            }
            else {
                config = (queueConfigs as AddToQueueConfig[])[0];
            }
        }
        else config = queueConfigs as AddToQueueConfig;
    }
    return config;
}

/**
 * 将被装饰的方法的返回值添加到队列中
 * @param {AddToQueueConfig | AddToQueueConfig[]} queueConfigs
 * @param addToQueueStrategyIfError 添加到队列过程中，寻找匹配的队列时遇到异常的处理策略，默认打印 warn 日志
 * @returns {(target, key, descriptor) => any}
 * @constructor
 */
export function AddToQueue(queueConfigs: AddToQueueConfig | AddToQueueConfig[], addToQueueStrategyIfError: AddToQueueStrategyIfError = AddToQueueStrategyIfError.warn) {
    return function (target, key, descriptor) {
        const targetIns = getTaskInstances(target.constructor);
        const oriFun = descriptor.value;
        descriptor.value = async (...args) => {
            const res = await oriFun.apply(targetIns, args);
            if (res != null) {
                // 在参数中找到当前job
                let curJob: Job = null;
                for (let arg of args) {
                    if (instanceofJob(arg)) {
                        curJob = arg as Job;
                        break;
                    }
                }

                const addToQueueDatas: AddToQueueInfo[] = [];
                if (res.constructor == Object) {
                    // 多个队列
                    for (let queueName of Object.keys(res)) {
                        const queueConfig = getAddToQueueConfig(queueConfigs, queueName, addToQueueStrategyIfError);
                        if (queueConfig) {
                            addToQueueDatas.push({
                                queueName: queueConfig.name,
                                jobs: res[queueName],
                                queueType: queueConfig.queueType,
                                filterType: queueConfig.filterType
                            });
                        }
                    }
                }
                else {
                    // 单个队列
                    const queueConfig = getAddToQueueConfig(queueConfigs, null, addToQueueStrategyIfError);
                    if (queueConfig) {
                        addToQueueDatas.push({
                            queueName: queueConfig.name,
                            jobs: res,
                            queueType: queueConfig.queueType,
                            filterType: queueConfig.filterType
                        });
                    }
                }
                queueManager.addToQueue(curJob, addToQueueDatas);
            }
            return res;
        };
        return descriptor;
    }
}
