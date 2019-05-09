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
