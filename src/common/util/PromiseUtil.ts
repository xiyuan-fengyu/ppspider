
export type WaitPromiseResult = {
    total: number;
    complete: number;
    remains: number[];
}

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
    static wait(predict: () => boolean, interval: number = 100, timeout: number = -1): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            const start = new Date().getTime();
            const check = () => {
                if (predict()) resolve(true);
                else if (timeout > -1 && new Date().getTime() - start >= timeout) {
                    resolve(false);
                }
                else setTimeout(check, interval);
            };
            check();
        });
    }

    /**
     * 等待多个 Promise 执行完成
     * @param {Promise<any>[]} promises
     * @param {number} timeout
     * @returns {Promise<WaitPromiseResult>}
     */
    static waitPromises(promises: Promise<any>[], timeout: number = 30000): Promise<WaitPromiseResult> {
        return new Promise<WaitPromiseResult>(resolve => {
            let res = {
                total: promises.length,
                complete: 0,
                remains: []
            };

            setTimeout(() => {
                resolve(res);
            }, timeout);

            const completeCheck = (index) => {
                res.complete++;
                const iIndex = res.remains.indexOf(index);
                if (iIndex > -1) res.remains.splice(iIndex, 1);
                if (res.complete == res.total) {
                    resolve(res);
                }
            };

            promises.forEach((item, index) => {
                res.remains.push(index);
                item.then(args => {
                    completeCheck(index);
                });
            });
        });
    }

}