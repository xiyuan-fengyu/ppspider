import {FromQueueConfig} from "../data/Types";
import {queueManager} from "../manager/QueueManager";

export function FromQueue(config: FromQueueConfig) {
    return function (target, key, descriptor) {
        config["type"] = "FromQueue";
        config["target"] = target;
        config["method"] = key;
        queueManager.addFromQueueConfig(config);
        return descriptor;
    }
}