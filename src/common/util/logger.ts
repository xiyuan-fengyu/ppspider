import "source-map-support/register";
import * as moment from "moment";
import * as ansiColors from 'ansi-colors';

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

    private static _logFormat = "datetime level position message";

    private static _level = 0;

    static set datetimeFormat(value: string) {
        if (value) this._datetimeFormat = value;
    }

    static set logFormat(value: string) {
        if (value) this._logFormat = value;
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

    /*
    use the folloeing code to check colors supported by the console
    for i in {0..256}; do echo -e "${i} \x1b[38;05;${i}m COLOR \x1b[0m"; done
     */
    private static ansiColorWrapper = {
        debug: str => ansiColors.grey(str),
        info: str => ansiColors.cyan(str),
        warn: str => ansiColors.yellow(str),
        error: str => ansiColors.red(str),
    };

    public static format(level: "debug" | "info" | "warn" | "error" | string, useAnsiColor: boolean, format: string, ...msgs: any[]): string {
        if (format.indexOf("datetime") > -1) {
            const nowStr = moment(new Date()).format(this._datetimeFormat);
            format = format.replace(/datetime/, nowStr);
        }

        if (format.indexOf("level") > -1) {
            let levelStr = level;
            if (useAnsiColor) {
                levelStr = this.ansiColorWrapper[level](levelStr);
            }
            format = format.replace(/level/, levelStr);
        }

        if (format.indexOf("position") > -1) {
            const position = new Error().stack.split("\n")[4].trim().replace(/^at /, "");
            format = format.replace(/position/, position);
        }

        let msgsStr = (msgs || []).map(item => {
            if (item instanceof Error) {
                return item.stack;
            }
            else {
                return typeof item === "object" ? JSON.stringify(item, null, 4) : "" + item;
            }
        }).join("\n");
        if (useAnsiColor) {
            msgsStr = this.ansiColorWrapper[level](msgsStr);
        }
        format = format.replace(/message/, msgsStr);

        return format;
    }

    public static formatWithoutPos(level: "debug" | "info" | "warn" | "error", ...msgs: any[]): string {
        return this.format(level, false, "datetime [level] message", ...msgs);
    }

    private static log(level: "debug" | "info" | "warn" | "error", ...msgs: any[]) {
        const logStr = this.format(level, true, this._logFormat, ...msgs);
        console.log(logStr);
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
