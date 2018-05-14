import {OnTimeConfig} from "../data/Types";
import {queueManager} from "../manager/QueueManager";

export function OnTime(config: OnTimeConfig) {
    return function (target, key, descriptor) {
        config["type"] = "OnTime";
        config["target"] = target;
        config["method"] = key;
        queueManager.addOnTimeConfig(config);
        return descriptor;
    }
}