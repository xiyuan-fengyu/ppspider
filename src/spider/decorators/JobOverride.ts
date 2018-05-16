import {queueManager} from "../manager/QueueManager";

export function JobOverride(queueName: string) {
    return function (target, key, descriptor) {
        queueManager.addJobOverrideConfig(queueName, {
            target: target,
            method: descriptor.value
        });
        return descriptor;
    }
}