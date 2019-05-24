import {CronJob} from "cron";
import {Moment} from "moment";

/**
 * cron表达式工具类，用途：
 * 1. 用于计算 OnTime 任务的 cron表达式，算出周期性执行任务的时间
 * 2. 用于计算 ParallelConfig 中的 cron表达式，添加周期性任务，用于周期性改变任务并行数
 */
export class CronUtil {

    private static readonly crons: {
        [cron: string]: CronJob
    } = {};

    private static getCronJob(cronStr: string): CronJob {
        let cronJob = this.crons[cronStr];
        if (!cronJob) {
            CronUtil.crons[cronStr] = cronJob = new CronJob(cronStr, null, null, true);
        }
        return cronJob;
    }

    static next(cron: string, num: number = 10): Date[] {
        const cronJob = this.getCronJob(cron);
        const nexts = cronJob.nextDates(num);
        return (nexts as Moment[]).map(item => item.toDate());
    }

    static prev(cron: string, now: number = new Date().getTime()): Date {
        const cronTime = this.getCronJob(cron)["cronTime"];
        let lastDiff = 0;
        let diff = 3600000;
        let lastDate: Date;
        let isTimeout = false;
        let timeout = 5000;
        setTimeout(() => isTimeout = true, timeout);
        while (true) {
            if (isTimeout) {
                throw new Error(`Find previous date timeout(${timeout}ms) with cron exp(${cron})`);
            }
            let tempLastDate = cronTime["_getNextDateFrom"](now - diff);
            if (tempLastDate) {
                tempLastDate = tempLastDate.toDate();
                if (tempLastDate.getTime() >= now) {
                    lastDiff = diff;
                    diff *= 2;
                }
                else {
                    lastDate = tempLastDate;
                    if (diff - lastDiff < 1000) {
                        break;
                    }
                    diff = +((diff + lastDiff) / 2).toFixed(0);
                }
            }
            else {
                lastDiff = diff;
                diff *= 2;
            }
        }
        return lastDate;
    }

    static setInterval(cron: string, func: Function): {
        cron: string,
        callback: Function,
        clear: Function
    } {
        const cronJob = this.getCronJob(cron);
        cronJob.addCallback(func);
        return {
            cron: cron,
            callback: func,
            clear: () => {
                this.removeInterval(cron, func);
            }
        };
    }

    static removeInterval(cron: string, func?: Function) {
        const cronJob = this.getCronJob(cron);
        const _callbacks = cronJob["_callbacks"] as Function[];

        if (func) {
            const index = _callbacks.indexOf(func);
            if (index > -1) {
                _callbacks.splice(index, 1);
            }
        }
        else {
            _callbacks.splice(0, _callbacks.length);
        }

        if (_callbacks.length == 0) {
            cronJob.stop();
            delete this.crons[cron];
        }
    }

}
