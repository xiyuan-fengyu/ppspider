import {OnTimeConfig} from "../data/Types";
import {queueManager} from "../manager/QueueManager";
import {getTaskInstances} from "./Launcher";

export function OnTime(config: OnTimeConfig) {
    return function (target, key, descriptor) {
        config["type"] = "OnTime";
        config["target"] = getTaskInstances(target.constructor);
        config["method"] = key;
        queueManager.addOnTimeConfig(config);
        return descriptor;
    }
}