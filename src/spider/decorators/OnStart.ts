import {OnStartConfig} from "../data/Types";
import {queueManager} from "../manager/QueueManager";
import {getTaskInstances} from "./Launcher";

export function OnStart(config: OnStartConfig) {
    return function (target, key, descriptor) {
        config["type"] = "OnStart";
        config["target"] = getTaskInstances(target.constructor);
        config["method"] = key;
        queueManager.addOnStartConfig(config);
        return descriptor;
    }
}
