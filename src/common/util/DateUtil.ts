import {StringUtil} from "./StringUtil";

/**
 * 时间格式化
 */
export class DateUtil {

    // yyyy-MM-dd HH:mm:ss
    // yyyy-MM-dd HH:mm:ss.SSS
    static toStr(date: Date = new Date(), format: string = "yyyy-MM-dd HH:mm:ss"): string {
        return format
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
            ;
    }

}
