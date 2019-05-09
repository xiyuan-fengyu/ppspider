const later: any = require('later');
later.date.localTime();

type CronSchedule = {
    cron: any;
    schedule: any;
}

/**
 * cron表达式工具类，用途：
 * 1. 用于计算 OnTime 任务的 cron表达式，算出周期性执行任务的时间
 * 2. 用于计算 ParallelConfig 中的 cron表达式，添加周期性任务，用于改变任务并行数
 */
export class CronUtil {

    private static readonly cronSchedules: {
        [cron: string]: CronSchedule
    } = {};

    private static getCronSchedule(cronStr: string): CronSchedule {
        let cronSchedule = CronUtil.cronSchedules[cronStr];
        if (!cronSchedule) {
            const cron = later.parse.cron(cronStr, true);
            this.cronSchedules[cronStr] = cronSchedule = {
                cron: cron,
                schedule: later.schedule(cron)
            };
        }
        return cronSchedule;
    }

    static next(cron: string, num: number = 10, point: Date = null): Date | Date[] {
        if (!point) {
            point = new Date();
            point.setTime(point.getTime() + 500); // 防止OnTime队列最后一个任务（记为A）执行之后，新添加的OnTime任务中第一个任务的执行时间和A执行时间重复
        }
        const cronExp = CronUtil.getCronSchedule(cron);
        if (!cronExp) return [];
        return cronExp.schedule.next(num, point) || [];
    }

    static setInterval(cron: string, func: Function) {
        const cronExp = CronUtil.getCronSchedule(cron);
        if (!cronExp) return null;
        return later.setInterval(func, cronExp.cron);
    }

}