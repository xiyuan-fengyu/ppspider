
const later: any = require('later');
later.date.localTime();

type CronSchedule = {
    cron: any;
    schedule: any;
}

export class CronUtil {

    private static readonly cronSchedules: {
        [cron: string]: CronSchedule
    } = {};

    private static readonly intervals = [];

    private static getCronSchedule(cronStr: string): CronSchedule {
        let cronSchedule = CronUtil.cronSchedules[cronStr];
        if (!cronSchedule) {
            const cron = later.parse.cron(cronStr, true);
            CronUtil.cronSchedules[cron] = cronSchedule = {
                cron: cron,
                schedule: later.schedule(cron)
            };
        }
        return cronSchedule;
    }

    static next(cron: string, num: number = 10, point: Date = new Date()): Date[] {
        return CronUtil.getCronSchedule(cron).schedule.next(num, point) || [];
    }

    static setInterval(cron: string, func: Function) {
        CronUtil.intervals.push(later.setInterval(func, CronUtil.getCronSchedule(cron).cron));
    }

    static clearIntervals() {
        while (CronUtil.intervals.length > 0) {
            CronUtil.intervals.pop().clear();
        }
    }

}