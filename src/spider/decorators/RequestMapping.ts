import {getTaskInstances, requestMappingConfigs} from "./Launcher";
import {RequestMappingConfig} from "../data/Types";

export function RequestMapping(url: string, method: "" | "GET" | "POST" = "") {
    return function (target, key, descriptor) {
        const requestMappingConfig: RequestMappingConfig = {
            url: url,
            httpMethod: method,
            target: getTaskInstances(target.constructor),
            method: key
        };
        requestMappingConfigs.push(requestMappingConfig);
        return descriptor;
    }
}