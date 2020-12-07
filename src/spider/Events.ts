
export class Events {

    // 强制中断正在运行的任务，参数：cancleReason
    static readonly QueueManager_InterruptJob = "QueueManager_InterruptJob";

    static readonly QueueManager_InterruptJobSuccess = jobId => "QueueManager_InterruptJobSuccess_" + jobId;

    static readonly QueueManager_JobExecuted = "QueueManager_JobExecuted";

}

export class EventBus {

    private listeners: {[eventName: string]: any[]} = {};

    on(eventName: string, listener: any) {
        this.addListener(eventName, listener, false);
    }

    once(eventName: string, listener: any) {
        this.addListener(eventName, listener, true);
    }

    private addListener(eventName: string, listener: any, once: boolean) {
        if (typeof listener != "function") {
            return;
        }
        let eventListeners = this.listeners[eventName];
        if (!eventListeners) {
            this.listeners[eventName] = eventListeners = [];
        }
        const index = eventListeners.indexOf(listener);
        if (index == -1) {
            eventListeners.push(listener);
        }
        listener.$once = once;
    }

    removeListener(eventName: string, listener: any) {
        const eventListeners = this.listeners[eventName];
        if (eventListeners) {
            const index = eventListeners.indexOf(listener);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    removeAllListeners(eventName?: string) {
        if (eventName == null) {
            this.listeners = {};
        }
        else {
            delete this.listeners[eventName];
        }
    }

    emit(eventName: string, ...args: any[]) {
        const promises = [];
        const eventListeners = this.listeners[eventName];

        if (eventListeners) {
            const rm = [];
            for (let i = 0; i < eventListeners.length; i++) {
                const eventListener = eventListeners[i];
                promises.push(eventListener(...args));
                if (eventListener.$once) {
                    rm.push(i);
                }
            }
            if (rm.length) {
                for (let i = rm.length - 1; i > -1; i--) {
                    eventListeners.splice(i, 1);
                }
            }
        }
        return Promise.all(promises);
    }

}
