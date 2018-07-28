
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

    static waitFor(condition: () => boolean, timeout: number = 30000): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            const start = new Date().getTime();
            const wait = () => {
              if (new Date().getTime() - start >= timeout) resolve(false);
              else if (condition()) resolve(true);
              else setTimeout(wait, 100);
            };
            wait();
        });
    }

}
