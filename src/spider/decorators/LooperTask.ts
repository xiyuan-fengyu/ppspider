import {LooperTaskInfo} from "../data/Types";

export class Looper {

    private static minInterval = 30;

    private tasks: LooperTaskInfo[] = [];

    private running: boolean = true;

    constructor(
        private readonly interval: number = Looper.minInterval
    ) {
        if (this.interval < Looper.minInterval) this.interval = Looper.minInterval;
    }

    addTask(task: LooperTaskInfo) {
        if (task.interval < this.interval) task.interval = this.interval;
        this.tasks.push(task);
    }

    private clearTasks() {
        this.tasks = [];
    }

    private loopTasks() {
        const now = new Date().getTime();
        for (let task of this.tasks) {
            if (now - (task.lastExe || 0) >= task.interval) {
                task.lastExe = now;
                task.method();
            }
        }
    }

    startAndAwaitShutdown() {
        return new Promise((resolve, reject) => {
            const checkShutdown = () => {
                if (!this.running) {
                    resolve();
                }
                else {
                    this.loopTasks();
                    setTimeout(checkShutdown, this.interval);
                }
            };
            checkShutdown();
        });
    }

    shutdown() {
        this.running = false;
        this.clearTasks();
    }

}

export function LooperTask(looper: Looper, interval: number = 100) {
    return function (target, key, descriptor) {
        looper.addTask({
            method: descriptor.value.bind(target),
            interval: interval
        });
        return descriptor;
    }
}