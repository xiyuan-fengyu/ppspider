
export type WaitPromiseResult = {
    total: number;
    complete: number;
    remains: number[];
}

export class PromiseUtil {

    static sleep(timeout: number): Promise<void> {
        if (timeout < 0) timeout = 0;
        return new Promise<void>(resolve => {
            setTimeout(() => resolve(), timeout);
        });
    }
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