import {OnStartConfig} from "../data/Types";
import {queueManager} from "../manager/QueueManager";

export function OnStart(config: OnStartConfig) {
    return function (target, key, descriptor) {
        config["type"] = "OnStart";
        config["target"] = target;
        config["method"] = key;
        queueManager.addOnStartConfig(config);
        return descriptor;
    }
}
