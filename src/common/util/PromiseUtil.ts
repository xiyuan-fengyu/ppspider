export class PromiseUtil {

    /**
     * 等待一定时间
     * @param {number} timeout
     * @returns {Promise<void>}
     */
    static sleep(timeout: number): Promise<void> {
        if (timeout < 0) timeout = 0;
        return new Promise<void>(resolve => {
            setTimeout(() => resolve(), timeout);
        });
    }

    /**
     * 等待特定条件
     * @param {() => boolean} predict
     * @param {number} interval
     * @param {number} timeout
     * @returns {Promise<boolean>}
     */
    static wait(predict: () => boolean | Promise<boolean>, interval: number = 100, timeout: number = -1): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const start = new Date().getTime();
            const check = async () => {
                try {
                    if (await predict()) resolve(true);
                    else if (timeout > -1 && new Date().getTime() - start >= timeout) {
                        reject(new Error("timeout: " + timeout));
                    }
                    else setTimeout(check, interval);
                }
                catch (e) {
                    reject(e);
                }
            };
            check();
        });
    }

    static rejectOrResolve(reject: any, err: Error | any, resolve?: any, res?: any) {
        if (err instanceof Error) {
            reject(err);
        }
        else if (resolve) {
            resolve(res);
        }
    }

    static createPromiseResolve() {
        const res = [];
        res[0] = new Promise((resolve, reject) => {
            res[1] = resolve;
            res[2] = reject;
        });
        return res;
    }

}