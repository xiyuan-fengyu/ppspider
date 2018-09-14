import "source-map-support/register";
import {StringUtil} from "./StringUtil";

export interface LoggerSetting {

    format?: "yyyy-MM-dd HH:mm:ss.SSS [level] position message" | string;

    level?: "debug" | "info" | "warn" | "error" | string;

}

/**
 * 日志打印工具类
 */
export class logger {

    private static _format = "yyyy-MM-dd HH:mm:ss.SSS [level] position message";

    private static _level = 0;

    static set format(value: string) {
        if (value) this._format = value;
    }

    static set level(value: "debug" | "info" | "warn" | "error" | string) {
        switch (value) {
            case "debug":
                this._level = 0;
                break;
            case "info":
                this._level = 1;
                break;
            case "warn":
                this._level = 2;
                break;
            case "error":
                this._level = 3;
                break;
            default:
                this._level = 0;
        }
    }

    static set setting(aSetting: LoggerSetting) {
        if (aSetting) {
            this.format = aSetting.format;
            this.level = aSetting.level;
        }
    }

    static get debugValid() {
        return this._level <= 0;
    }

    static get infoValid() {
        return this._level <= 1;
    }

    static get warnValid() {
        return this._level <= 2;
    }

    static get errorValid() {
        return this._level <= 3;
    }

    private static log(level: "debug" | "info" | "warn" | "error", ...msgs: any[]) {
        const date = new Date();
        const position = new Error().stack.split("\n")[3].trim().replace(/^at /, "");
        const msgsStr = (msgs || []).map(item => typeof item === "object" ? JSON.stringify(item, null, 4) : "" + item).join("\n");
        const formatRes = this._format
            .replace(/yyyy/, (substring, ...args) => {
                return "" + date.getFullYear();
            })
            .replace(/MM/, (substring, ...args) => {
                return StringUtil.preFill("" + (date.getMonth() + 1), 2, "0");
            })
            .replace(/dd/, (substring, ...args) => {
                return StringUtil.preFill("" + date.getDate(), 2, "0");
            })
            .replace(/HH/, (substring, ...args) => {
                return StringUtil.preFill("" + date.getHours(), 2, "0");
            })
            .replace(/mm/, (substring, ...args) => {
                return StringUtil.preFill("" + date.getMinutes(), 2, "0");
            })
            .replace(/ss/, (substring, ...args) => {
                return StringUtil.preFill("" + date.getSeconds(), 2, "0");
            })
            .replace(/SSS/, (substring, ...args) => {
                return StringUtil.preFill("" + date.getMilliseconds(), 3, "0");
            })
            .replace(/level/, (substring, ...args) => {
                return level;
            })
            .replace(/position/, (substring, ...args) => {
                return position;
            })
            .replace(/message/, (substring, ...args) => {
                return msgsStr;
            })
        ;
        console[level](formatRes);
    }

    static debug(...msgs: any[]) {
        if (this._level <= 0) this.log("debug", ...msgs);
    }

    static info(...msgs: any[]) {
        if (this._level <= 1) this.log("info", ...msgs);
    }

    static warn(...msgs: any[]) {
        if (this._level <= 2) this.log("warn", ...msgs);
    }

    static error(...msgs: any[]) {
        if (this._level <= 3) this.log("error", ...msgs);
    }

}
