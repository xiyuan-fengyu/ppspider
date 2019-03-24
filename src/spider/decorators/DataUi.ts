import {DataUiConfig} from "../Types";
import {addDataUiConfig, addDataUiRequestConfig} from "./Launcher";

/**
 * 声明一个 DataUi，用于前台展示数据，声明方式实际是参考 Angular 的声明方式，前台也是利用 Angular 动态编译运行的
 * @param config
 * @constructor
 */
export function DataUi(config: DataUiConfig) {
    return function (target) {
        if (!config.label) {
            config.label = target.name;
        }
        config["target"] = target;
        config["class"] = target.toString();
        config["className"] = target.name;
        addDataUiConfig(config);
    };
}

/**
 * 用于增强 @DataUi 修饰的类中的方法，记为A，当前台调用A方法，
 * 将会发起请求，调用后台，将 @DataUiRequest 修饰的方法的返回结果作为请求的返回结果
 * @param method @DataUi 修饰的类中的方法
 * @constructor
 */
export function DataUiRequest(method: (...args) => any) {
    return function (target, key, descriptor) {
        if (method.name === "constructor") {
            throw new Error("DataUiRequest cannot bind to a constructor");
        }
        addDataUiRequestConfig({
            requestMethod: method,
            handleTarget: target.constructor,
            handleMethod: key
        });
        return descriptor;
    }
}
