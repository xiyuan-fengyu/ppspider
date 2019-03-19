import {RequestMappingConfig} from "../Types";
import {addRequestMappingConfig} from "./Launcher";

export function RequestMapping(url: string, method: "" | "GET" | "POST" = "") {
    return function (target, key, descriptor) {
        const requestMappingConfig: RequestMappingConfig = {
            url: url,
            httpMethod: method,
            target: target.constructor,
            method: key
        };
        addRequestMappingConfig(requestMappingConfig);
        return descriptor;
    }
}