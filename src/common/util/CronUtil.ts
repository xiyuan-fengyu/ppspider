
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

    private static getCronSchedule(cronStr: string): CronSchedule {
        let cronSchedule;
        if (!CronUtil.cronSchedules.hasOwnProperty(cronStr)) {
            try {
                const cron = later.parse.cron(cronStr, true);
                CronUtil.cronSchedules[cronStr] = cronSchedule = {
                    cron: cron,
                    schedule: later.schedule(cron)
                };
            }
            catch (e) {
                console.warn(e.stack);
                CronUtil.cronSchedules[cronStr] = cronSchedule = null;
            }
        }
        else cronSchedule = CronUtil.cronSchedules[cronStr];
        return cronSchedule;
    }

    static next(cron: string, num: number = 10, point: Date = new Date()): Date[] {
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