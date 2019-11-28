import {OnEventConfig} from "../Types";
import {addOnEventConfig} from "./Launcher";

export function OnEvent(event: string) {
    return function (target, key, descriptor) {
        const config: OnEventConfig = {
            event: event,
            target: target.constructor,
            method: key
        };
        addOnEventConfig(config);
        return descriptor;
    }
}
