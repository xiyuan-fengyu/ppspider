import "source-map-support/register";

function log(level: "debug" | "info" | "warn" | "error", msg: string, format: string) {
    const now = new Date();
    const position = new Error().stack.split("\n")[3].trim().replace(/^at /, "");
    const formatRes = format
        .replace(/yyyy/, (substring, ...args) => {
            return "" + now.getFullYear();
        })
        .replace(/MM/, (substring, ...args) => {
            const temp = now.getMonth() + 1;
            return temp < 10 ? "0" + temp : "" + temp;
        })
        .replace(/dd/, (substring, ...args) => {
            const temp = now.getDate();
            return temp < 10 ? "0" + temp : "" + temp;
        })
        .replace(/HH/, (substring, ...args) => {
            const temp = now.getHours();
            return temp < 10 ? "0" + temp : "" + temp;
        })
        .replace(/mm/, (substring, ...args) => {
            const temp = now.getMinutes();
            return temp < 10 ? "0" + temp : "" + temp;
        })
        .replace(/ss/, (substring, ...args) => {
            const temp = now.getSeconds();
            return temp < 10 ? "0" + temp : "" + temp;
        })
        .replace(/SSS/, (substring, ...args) => {
            return "" + now.getMilliseconds();
        })
        .replace(/level/, (substring, ...args) => {
            return level;
        })
        .replace(/position/, (substring, ...args) => {
            return position;
        })
        .replace(/message/, (substring, ...args) => {
            return msg;
        })
    ;
    console[level](formatRes);
}

export interface LoggerSetting {

    format?: "yyyy-MM-dd HH:mm:ss.SSS [level] position message" | string;

    level?: "debug" | "info" | "warn" | "error" | string;

}

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

    static debug(msg: string, format?: string) {
        if (this._level <= 0) log("debug", msg, format || this._format);
    }

    static info(msg: string, format?: string) {
        if (this._level <= 1) log("info", msg, format || this._format);
    }

    static warn(msg: string, format?: string) {
        if (this._level <= 2) log("warn", msg, format || this._format);
    }

    static error(msg: string, format?: string) {
        if (this._level <= 3) log("error", msg, format || this._format);
    }

}
