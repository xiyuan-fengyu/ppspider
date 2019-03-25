import {DateUtil} from "./DateUtil";

export class StringUtil {

    /**
     * 生成长度为 len 的随机字符串，默认只包含数字和大小写字母
     * @param {number} len
     * @param {string} chars
     * @returns {string}
     */
    static random(len: number, chars = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0987654321"): string {
        if (len < 1) len = 1;
        let str = "";
        for (let i = 0; i < len; i++) {
            const index = parseInt("" + Math.random() * chars.length);
            str += chars[index];
        }
        return str;
    }

    /**
     * 检测是否为 null 或者 空白字符串
     * @param {string} str
     * @returns {boolean}
     */
    static isBlank(str: string): boolean {
        return str == null || str.trim() == "";
    }

    private static lastIdTime: number;
    private static lastIdIndex: number = 0;

    /**
     * 生成id
     * @returns {string}
     */
    static id(): string {
        const now = new Date();
        if (now.getTime() === this.lastIdTime) {
            this.lastIdIndex++;
        }
        else {
            this.lastIdTime = now.getTime();
            this.lastIdIndex = 0;
        }

        return DateUtil.toStr(now, "YYYYMMDD_HHmmss_SSS_")
            + this.preFill("" + this.lastIdIndex, 4, '0');
    }

    static preFill(str: string, fillLength: number, fillStr: string): string {
        if (str.length >= fillLength) return str;
        for (let i = str.length, fillStrLen = fillStr.length; i < fillLength; i += fillStrLen) str = fillStr + str;
        return str;
    }

}