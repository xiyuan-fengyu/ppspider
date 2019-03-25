/**
 * moment 时间格式化
 */
import moment = require("moment");

export class DateUtil {

    // console.log(moment(new Date()).format("YYYY-MM-DD HH:mm:ss"));

    // YYYY-MM-DD HH:mm:ss
    // YYYY-MM-DD HH:mm:ss.SSS
    static toStr(date: Date = new Date(), format: string = "YYYY-MM-DD HH:mm:ss"): string {
        return moment(new Date()).format(format);
    }

}
