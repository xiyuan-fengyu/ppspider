import {logger} from "../../common/util/logger";
import {AddToQueueConfig, AddToQueueInfo} from "../Types";
import {appInfo, getBean, Job} from "../..";

const addToQueueConfigs = new Map<Function, AddToQueueConfig | AddToQueueConfig[]>();

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
            logger.warn("cannot find a queue with name: " + queueName);
            return null;
        }
    }
    else {
        // 单个队列
        let queueNum: number;
        if (queueConfigs.constructor == Array) {
            if ((queueNum = (queueConfigs as AddToQueueConfig[]).length) != 1) {
                logger.warn(queueNum == 0 ? "no queue to add" :
                    queueNum + " queues provide and cannot decide which to add to");
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

export function transformResToAddToQueueInfos(method: Function, res: any) {
    const addToQueueDatas: AddToQueueInfo[] = [];
    const queueConfigs = addToQueueConfigs.get(method);
    if (queueConfigs) {
        if (res.constructor == Object) {
            // 多个队列
            for (let queueName of Object.keys(res)) {
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
    }
    return addToQueueDatas;
}

/**
 * 将被装饰的方法的返回值添加到队列中
 * @param {AddToQueueConfig | AddToQueueConfig[]} queueConfigs
 * @returns {(target, key, descriptor) => any}
 * @constructor
 */
export function AddToQueue(queueConfigs: AddToQueueConfig | AddToQueueConfig[]) {
    return function (target, key, descriptor) {
        const oriFun = descriptor.value;
        const newFun = descriptor.value = async (...args) => {
            const targetIns = getBean(target.constructor);
            const res = await oriFun.apply(targetIns, args);
            let job = (args || []).find(item => item && item instanceof Job);
            if (res != null) {
                const addToQueueDatas = transformResToAddToQueueInfos(newFun, res);
                addToQueueDatas.length && await appInfo.queueManager.addToQueue(job, addToQueueDatas);
            }
            return res;
        };
        addToQueueConfigs.set(newFun, queueConfigs);
        return descriptor;
    }
}
