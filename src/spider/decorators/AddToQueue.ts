import {AddToQueueConfig, AddToQueueInfo} from "../data/Types";
import {instanceofJob, Job} from "../job/Job";
import {queueManager} from "../manager/QueueManager";
import {getTaskInstances} from "./Launcher";
import {logger} from "../../common/util/logger";

function getAddToQueueConfig(queueConfigs: AddToQueueConfig | AddToQueueConfig[], queueName: string): AddToQueueConfig {
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
            console.warn("cannot find a queue with name: " + queueName);
            return null;
        }
    }
    else {
        // 单个队列
        let queueNum: number;
        if (queueConfigs.constructor == Array) {
            if ((queueNum = (queueConfigs as AddToQueueConfig[]).length) != 1) {
                logger.warn(queueNum == 0 ? "no queue to add" : queueNum + " queues provide and cannot decide which to add to");
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
 * @returns {(target, key, descriptor) => any}
 * @constructor
 */
export function AddToQueue(queueConfigs: AddToQueueConfig | AddToQueueConfig[]) {
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
                    for (let queueName in res) {
                        const queueConfig = getAddToQueueConfig(queueConfigs, queueName);
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
                    const queueConfig = getAddToQueueConfig(queueConfigs, null);
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
