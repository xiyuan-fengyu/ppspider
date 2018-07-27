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
                const temp = date.getMonth() + 1;
                return temp < 10 ? "0" + temp : "" + temp;
            })
            .replace(/dd/, (substring, ...args) => {
                const temp = date.getDate();
                return temp < 10 ? "0" + temp : "" + temp;
            })
            .replace(/HH/, (substring, ...args) => {
                const temp = date.getHours();
                return temp < 10 ? "0" + temp : "" + temp;
            })
            .replace(/mm/, (substring, ...args) => {
                const temp = date.getMinutes();
                return temp < 10 ? "0" + temp : "" + temp;
            })
            .replace(/ss/, (substring, ...args) => {
                const temp = date.getSeconds();
                return temp < 10 ? "0" + temp : "" + temp;
            })
            .replace(/SSS/, (substring, ...args) => {
                return "" + date.getMilliseconds();
            })
            ;
    }

}
