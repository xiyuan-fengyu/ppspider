import {
    AddToQueueInfo,
    AddToQueueInfos,
    FromQueueConfig,
    JobConfig,
    JobOverrideConfig,
    JobOverrideConfigs,
    OnStartConfig,
    OnTimeConfig,
    Queues,
    UpdateQueueConfigData,
    WorkerFactoryMap
} from "../data/Types";
import {CronUtil} from "../../common/util/CronUtil";
import {Defaults} from "../data/Defaults";
import {instanceofJob, Job, JobStatus} from "../job/Job";
import {Queue} from "../queue/Queue";
import {BloonFilter} from "../filter/BloonFilter";
import {DefaultQueue} from "../queue/DefaultQueue";
import {Filter} from "../filter/Filter";
import {DefaultJob} from "../job/DefaultJob";
import {NoFilter} from "../filter/NoFilter";
import {SerializableUtil, Serialize} from "../../common/serialize/Serialize";
import * as fs from "fs";
import {appInfo} from "../decorators/Launcher";
import {PromiseUtil} from "../../common/util/PromiseUtil";
import {jobManager} from "./JobManager";

@Serialize()
export class QueueManager {

    private cachePath: string;

    private readonly queues: Queues = {};

    private jobOverrideConfigs: JobOverrideConfigs = {};

    private dispatchQueueIndex = 0;

    private successNum = 0;

    private runningNum = 0;

    private failNum = 0;

    private pause = false;

    resetPause(value: boolean) {
        this.pause = value;
    }

    async waitRunning() {
        this.pause = true;
        await PromiseUtil.wait(() => this.runningNum <= 0, 500, 30000);
    }

    deleteQueueCache(): any {
        try {
            fs.unlinkSync(this.cachePath);
        }
        catch (e) {
            return {
                success: false,
                message: e.message
            };
        }
        return {
            success: true,
            message: "Delete queue cache successfully"
        };
    }

    stopAndSaveToCache(): any {
        try {
            const data = JSON.stringify(SerializableUtil.serialize(this));
            fs.writeFileSync(this.cachePath, data);
        }
        catch (e) {
            return e;
        }
        return true;
    }

    loadFromCache(cachePath: string) {
        try {
            const cacheFile = this.cachePath = cachePath;
            if (fs.existsSync(cacheFile)) {
                const data = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
                const tempQueueManager = SerializableUtil.deserialize(data) as QueueManager;

                this.successNum = tempQueueManager.successNum;
                this.runningNum = tempQueueManager.runningNum;
                this.failNum = tempQueueManager.failNum;

                for (let queueName of Object.keys(tempQueueManager.queues)) {
                    const queueInfo = tempQueueManager.queues[queueName];
                    const thisQueueInfo = this.queues[queueName];
                    if (thisQueueInfo) {
                        thisQueueInfo.success = queueInfo.success;
                        thisQueueInfo.fail = queueInfo.fail;
                        thisQueueInfo.curMaxParallel = queueInfo.curMaxParallel;

                        thisQueueInfo.config.exeInterval = queueInfo.config.exeInterval;
                        this.updateConfig({
                            queue: queueName,
                            field: "parallel",
                            value: queueInfo.config.parallel
                        });

                        const taskType = queueInfo.config["type"];
                        if (taskType == "OnTime") {
                            this.updateConfig({
                                queue: queueName,
                                field: "cron",
                                value: queueInfo.config["cron"]
                            });
                        }
                        else if (taskType == "FromQueue") {
                            thisQueueInfo.queue = queueInfo.queue;
                        }
                    }
                }
            }
        }
        catch (e) {
            console.warn(e.stack);
        }
    }

    info(): any {
        const res: any = {
            cacheExist: fs.existsSync(this.cachePath),
            pause: this.pause,
            success: this.successNum,
            running: this.runningNum,
            fail: this.failNum,
            queues: []
        };
        for (let queueName in this.queues) {
            const queue = this.queues[queueName];
            if (!queue.config || !queue.queue) continue;
            const taskType = queue.config['type'];
            let queueInfo: any = {
                name: queueName,
                target: queue.config['target'].constructor.name,
                method: queue.config['method'],
                type: taskType,
                workerFactory: queue.config.workerFactory.name,
                parallel: queue.config.parallel || Defaults.maxParallel,
                exeInterval: queue.config.exeInterval || 0,
                description: queue.config.description,
                curMaxParallel: queue.curMaxParallel || 0,
                curParallel: queue.curParallel || 0,
                success: queue.success || 0,
                fail: queue.fail || 0,
                lastExeTime: queue.lastExeTime
            };
            if (taskType == "OnStart") {
                const urls = queue.config['urls'];
                queueInfo.urls = typeof urls == "string" ? [urls] : urls;
            }
            else if (taskType == "OnTime") {
                const urls = queue.config['urls'];
                queueInfo.urls = typeof urls == "string" ? [urls] : urls;
                queueInfo.cron = queue.config['cron'];
                if (queue.queue.size() > 0) {
                    queueInfo.nextExeTime = queue.queue.peek().datas().other.exeTime;
                }
            }
            else {
                queueInfo.from = queue.config['name'];
                if (queue.queue) {
                    queueInfo.queue = {
                        type: queue.queue.constructor.name,
                        filters: queue.queue.getFilters().map(item => item.constructor.name).join(", "),
                        size: queue.queue.size()
                    };
                }
            }
            res.queues.push(queueInfo);
        }
        return res;
    }

    updateConfig(data: UpdateQueueConfigData): any {
        const queueInfo = this.queues[data.queue];
        if (!queueInfo) return {
            success: false,
            message: "queue not existed: " + data.queue
        };

        if (data.field == "parallel") {
            if (queueInfo.config.parallel != data.value) {
                queueInfo.config.parallel = data.value;
                this.resetQueueParallel(queueInfo);
            }
        }
        else if (data.field == "cron") {
            if (queueInfo.config['cron'] != data.value) {
                queueInfo.config['cron'] = data.value;
                while (!queueInfo.queue.isEmpty()) queueInfo.queue.pop();
                this.addOnTimeJob(data.queue);
            }
        }
        else if (data.field == "exeInterval") {
            queueInfo.config.exeInterval = data.value;
        }
        else if (data.field == "curMaxParallel") {
            queueInfo.curMaxParallel = data.value;
        }

        return {
            success: true,
            message: "update success: " + data.field
        };
    }

    private resetQueueParallel(queueInfo: any) {
        // 清除旧的 intervals
        if (queueInfo && queueInfo.parallelIntervals) {
            for (let interval of queueInfo.parallelIntervals) {
                interval.clear();
            }
            queueInfo.parallelIntervals = null;
        }

        // 设置 curMaxParallel
        if (queueInfo && queueInfo.config && queueInfo.config.parallel != null) {
            const parallelType = queueInfo.config.parallel.constructor;
            if (parallelType == Number) {
                // 静态设置
                queueInfo.curMaxParallel = queueInfo.config.parallel as number;
            }
            else if (parallelType == Object) {
                // 根据cron动态更新
                queueInfo.parallelIntervals = [];
                for (let cron of Object.keys(queueInfo.config.parallel)) {
                    const para = queueInfo.config.parallel[cron];
                    if (typeof para == "number") {
                        const interval = CronUtil.setInterval(cron, () => {
                            queueInfo.curMaxParallel = para as number;
                        });
                        if (interval) queueInfo.parallelIntervals.push(interval);
                    }
                }
            }
        }

        if (!queueInfo.curMaxParallel) {
            queueInfo.curMaxParallel = Defaults.maxParallel;
        }
        else if (queueInfo.config && typeof queueInfo.config.parallel == "number"
            && queueInfo.curMaxParallel > queueInfo.config.parallel) {
            queueInfo.curMaxParallel = queueInfo.config.parallel;
        }
    }

    addJobOverrideConfig(queueName: string, jobOverrideConfig: JobOverrideConfig) {
        this.jobOverrideConfigs[queueName] = jobOverrideConfig;
    }

    addQueueConfig(queueName: string, config: JobConfig): string {
        if (!queueName) {
            queueName = config["type"] + "_" + config["target"].constructor.name + "_" + config["method"];
        }

        let queueInfo = this.queues[queueName];
        if (!queueInfo) {
            this.queues[queueName] = queueInfo = {
                queue: null
            };
        }
        queueInfo.config = config;
        this.resetQueueParallel(queueInfo);

        return queueName;
    }

    addToQueue(
        parent: Job,
        datas: AddToQueueInfos,
    ) {
        if (datas) {
            if (datas.constructor == Object) {
                datas = [datas] as AddToQueueInfos;
            }

            for (let jobInfo of (datas as AddToQueueInfo[])) {
                const queueName = jobInfo.queueName;

                let queueInfo = this.queues[queueName];
                if (!queueInfo) {
                    this.queues[queueName] = queueInfo = {
                        queue: null
                    };
                }
                let queue: Queue = queueInfo.queue;
                if (!queue) {
                    queueInfo.queue = queue = new (jobInfo.queueType || DefaultQueue)();
                }

                // 默认使用布隆过滤器
                const theFilterType = jobInfo.filterType || BloonFilter;
                let filter = queue.getFilter(theFilterType);
                if (!filter) {
                    filter = new theFilterType();
                    queue.addFilter(filter);
                }

                const jobs = jobInfo.jobs;
                if (jobs) {
                    if (jobs.constructor == String || instanceofJob(jobs)) {
                        QueueManager.addJobToQueue(jobs, parent, queueName, queue, filter, jobInfo.other, this.jobOverrideConfigs[queueName]);
                    }
                    else if (jobs.constructor == Array) {
                        for (let job of jobs) {
                            QueueManager.addJobToQueue(job, parent, queueName, queue, filter, jobInfo.other, this.jobOverrideConfigs[queueName]);
                        }
                    }
                }
            }
        }
    }

    addOnStartConfig(config: OnStartConfig) {
        const queueName = this.addQueueConfig(null, config);
        this.addOnStartJob(queueName);
    }

    private addOnStartJob(queueName: string) {
        const config = this.queues[queueName].config as OnStartConfig;
        this.addToQueue(null, {
            queueName: queueName,
            jobs: config.urls,
            queueType: DefaultQueue,
            filterType: NoFilter
        });
    }

    addOnTimeConfig(config: OnTimeConfig) {
        const queueName = this.addQueueConfig(null, config);
        this.addOnTimeJob(queueName);
    }

    private addOnTimeJob(queueName: string) {
        const config = this.queues[queueName].config as OnTimeConfig;
        const nearTimes = CronUtil.next(config.cron, 10);
        for (let nearTime of nearTimes) {
            this.addToQueue(null, {
                queueName: queueName,
                jobs: config.urls,
                queueType: DefaultQueue,
                filterType: NoFilter,
                other: {
                    exeTime: nearTime.getTime()
                }
            });
        }
    }

    addFromQueueConfig(config: FromQueueConfig) {
        this.addQueueConfig(config.name, config);
    }

    private static addJobToQueue(jobOrUrl: any, parent: Job, queueName: string, queue: Queue, filter: Filter, other?: any, jobOverrideConfig?: JobOverrideConfig) {
        const job = instanceofJob(jobOrUrl) ? jobOrUrl as Job : new DefaultJob(jobOrUrl);

        // 重写 job 的一些信息
        if (jobOverrideConfig) jobOverrideConfig.method.call(jobOverrideConfig.target, job);

        // 添加额外信息
        if (other) {
            let datasOther = job.datas().other;
            if (!datasOther) {
                job.datas().other = datasOther = {};
            }
            for (let key of Object.keys(other)) {
                datasOther[key] = other[key];
            }
        }

        // 检查和修复 job 的信息
        if (!job.queue()) job.queue(queueName);
        if (parent) {
            if (!job.parentId()) job.parentId(parent.id());
            if (job.depth() == 0) job.depth(parent.depth() + 1);
        }
        else {
            job.parentId("");
            job.depth(0);
        }

        if (!filter || !filter.isExisted(job)) {
            if (filter) filter.setExisted(job);
            queue.push(job);
            job.status(JobStatus.Waiting);
        }
        else {
            job.status(JobStatus.Filtered);
        }
        jobManager.save(job);
    }

    dispatch(workerFactoryMap: WorkerFactoryMap) {
        if (this.pause) return;

        const queueNames = Object.keys(this.queues);
        if (queueNames.length == 0) return;

        const now = new Date().getTime();
        if (this.dispatchQueueIndex >= queueNames.length) {
            this.dispatchQueueIndex = 0;
        }

        while (this.dispatchQueueIndex < queueNames.length) {
            const queueName = queueNames[this.dispatchQueueIndex];
            const queue = this.queues[queueName];
            if (queue && queue.queue) {
                if (queue.queue.isEmpty()
                    && queue.config["type"] == "OnTime") {
                    this.addOnTimeJob(queueName);
                }

                const workerFactory = workerFactoryMap[(queue.config.workerFactory as any).name];
                while (
                    !workerFactory.isBusy()
                    && !queue.queue.isEmpty()
                    && (queue.curParallel || 0) < (queue.curMaxParallel || 0)
                    && now - (queue.lastExeTime || 0) > (queue.config.exeInterval || 0)
                    ) {
                    let job: Job = null;

                    if (queue.config["type"] == "OnTime") {
                        job = queue.queue.peek();
                        if (job) {
                            if (job.datas().other.exeTime > now) job = null;
                            else queue.queue.pop();
                        }
                    }
                    else job = queue.queue.pop();

                    if (job) {
                        queue.curParallel = (queue.curParallel || 0) + 1;
                        queue.lastExeTime = now;
                        workerFactory.get().then(async worker => {
                            const target = queue.config["target"];
                            const method = target[queue.config["method"]];
                            this.runningNum++;
                            job.exeTimes({
                                start: new Date().getTime()
                            });
                            try {
                                job.status(JobStatus.Running);
                                job.tryNum(job.tryNum() + 1);
                                jobManager.save(job);
                                await method.call(target, worker, job);
                                job.status(JobStatus.Success);
                                this.successNum++;
                            }
                            catch (e) {
                                if (job.tryNum() >= Defaults.maxTry) {
                                    job.status(JobStatus.Fail);
                                }
                                else {
                                    job.status(JobStatus.Retry);
                                }
                                this.failNum++;
                                console.log(e.stack);
                            }
                            job.exeTimes({
                                end: new Date().getTime()
                            });
                            this.runningNum--;
                            return worker;
                        }).then(async worker => {
                            queue.curParallel--;
                            if (job.status() == JobStatus.Success) queue.success = (queue.success || 0) + 1;
                            else queue.fail = (queue.fail || 0) + 1;

                            if (job.status() == JobStatus.Retry) {
                                QueueManager.addJobToQueue(job, null, job.queue(), this.queues[job.queue()].queue, null);
                            }

                            jobManager.save(job);

                            await workerFactory.release(worker);
                        });
                    }
                    else break;
                }
            }
            this.dispatchQueueIndex++;
        }
    }

}

export const queueManager = new QueueManager();
