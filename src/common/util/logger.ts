import "source-map-support/register";
import moment = require("moment");

export type LoggerSetting = {

    datetimeFormat?: "YYYY-MM-DD HH:mm:ss.SSS" | string;

    logFormat?: "datetime [level] position message" | string;

    level?: "debug" | "info" | "warn" | "error" | string;

}

/**
 * 日志打印工具类
 */
export class logger {

    private static _datetimeFormat = "YYYY-MM-DD HH:mm:ss.SSS";

    private static _logFormat = "datetime [level] position message";

    private static _level = 0;

    static set datetimeFormat(value: string) {
        this._datetimeFormat = value;
    }

    static set logFormat(value: string) {
        this._logFormat = value;
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
            this.datetimeFormat = aSetting.datetimeFormat;
            this.logFormat = aSetting.logFormat;
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

    public static format(level: "debug" | "info" | "warn" | "error", format: string, ...msgs: any[]): string {
        const nowStr = moment(new Date()).format(this._datetimeFormat);
        const position = new Error().stack.split("\n")[3].trim().replace(/^at /, "");
        const msgsStr = (msgs || []).map(item => {
            if (item.constructor == Error) {
                return "\n" + item.stack;
            }
            else {
                return typeof item === "object" ? JSON.stringify(item, null, 4) : "" + item;
            }
        }).join("\n");
        return format
            .replace(/datetime/, nowStr)
            .replace(/level/, level)
            .replace(/position/, position)
            .replace(/message/, msgsStr);
    }

    public static formatWithoutPos(level: "debug" | "info" | "warn" | "error", ...msgs: any[]): string {
        return this.format(level, "datetime [level] message", ...msgs);
    }

    private static log(level: "debug" | "info" | "warn" | "error", ...msgs: any[]) {
        const logStr = this.format(level, this._logFormat, ...msgs);
        console[level](logStr);
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
