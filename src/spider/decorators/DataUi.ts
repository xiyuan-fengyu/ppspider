import {DataUiConfig} from "../Types";
import {addDataUiConfig} from "./Launcher";

export function DataUi(config: DataUiConfig) {
    return function (target) {
        if (!config.title) {
            config.title = target.name;
        }
        config["class"] = target.toString();
        config["className"] = target.name;
        addDataUiConfig(config);
    };
}