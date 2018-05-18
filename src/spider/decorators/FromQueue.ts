import {FromQueueConfig} from "../data/Types";
import {queueManager} from "../manager/QueueManager";
import {getTaskInstances} from "./Launcher";

export function FromQueue(config: FromQueueConfig) {
    return function (target, key, descriptor) {
        config["type"] = "FromQueue";
        config["target"] = getTaskInstances(target.constructor);
        config["method"] = key;
        queueManager.addFromQueueConfig(config);
        return descriptor;
    }
}