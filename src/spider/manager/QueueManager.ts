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
import {SerializableUtil, Serialize, Transient} from "../../common/serialize/Serialize";
import * as fs from "fs";
import {PromiseUtil} from "../../common/util/PromiseUtil";
import {jobManager} from "./JobManager";
import {EventEmitter} from "events";
import {logger} from "../../common/util/logger";

const shutdownWaitTimeout = 60000;

const SIGNAL_FORCE_STOP = "SIGNAL_FORCE_STOP";
const signals = new EventEmitter();

/**
 * 任务配置管理和任务派发的核心类，基本上是最重要的类了
 */
@Serialize()
export class QueueManager {

    @Transient()
    private cachePath: string; // 运行状态持久化文件路径

    private readonly queues: Queues = {}; // 所有队列的信息

    @Transient()
    private jobOverrideConfigs: JobOverrideConfigs = {}; // 所有复写 job信息 的回调配置

    private dispatchQueueIndex = 0; // 决定当前派发哪一个队列中的任务

    private successNum = 0; // 成功运行的任务总数

    private runningNum = 0; // 正在执行的任务总数

    private failNum = 0; // 运行失败的任务总数，一个任务运行失败一次即算作一次，但一个任务运行失败后最多还有2次重试的机会

    @Transient()
    private pause = false; // 是否暂停派发任务

    resetPause(value: boolean) {
        this.pause = value;
    }

    /**
     * 停止系统时，等待正在运行的任务结束，超时未运行完成的任务会被强制中断，如果还有重试次数，则会重新添加到任务队列
     * @returns {Promise<void>}
     */
    async waitRunning() {
        this.pause = true;
        await PromiseUtil.wait(() => this.runningNum <= 0, 500, shutdownWaitTimeout);
        if (this.runningNum > 0) {
            // 发出强行终止任务的信号
            signals.emit(SIGNAL_FORCE_STOP);
            await PromiseUtil.wait(() => this.runningNum <= 0, 500);
        }
        if (this.runningNum > 0) this.failNum += this.runningNum;
        this.runningNum = 0;
    }

    /**
     * 删除运行状态持久化文件
     * @returns {any}
     */
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

    /**
     * 通过序列化，将运行状态持久化到文件中
     * @returns {any}
     */
    saveToCache(): any {
        try {
            const data = JSON.stringify(SerializableUtil.serialize(this));
            fs.writeFileSync(this.cachePath, data);
        }
        catch (e) {
            logger.warn(e.stack);
        }
        return true;
    }

    /**
     * 从运行状态持久化文件中恢复运行状态
     * 实际上是通过反序列化创建了一个临时的QueueManager实例，然后将需要的信息复制给当前的实例
     * @param {string} cachePath
     */
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
            logger.warn(e.stack);
        }
    }

    /**
     * 获取当前的队列信息，用于UI界面展示
     * @returns {any}
     */
    info(): any {
        const res: any = {
            cacheExist: fs.existsSync(this.cachePath),
            pause: this.pause,
            success: this.successNum,
            running: this.runningNum,
            fail: this.failNum,
            queues: [],
            shutdownWaitTimeout: shutdownWaitTimeout
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
                parallel: queue.config.parallel === null || queue.config.parallel === undefined ? Defaults.maxParallel : queue.config.parallel,
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

    /**
     * 更新队列配置
     * @param {UpdateQueueConfigData} data
     * @returns {any}
     */
    updateConfig(data: UpdateQueueConfigData): any {
        const queueInfo = this.queues[data.queue];
        if (!queueInfo) return {
            success: false,
            message: "queue not existed: " + data.queue
        };

        if (data.field == "execute") {
            if (queueInfo.config['type'] == 'OnStart') {
                this.addOnStartJob(data.queue);
            }
        }
        else if (data.field == "parallel") {
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

    /**
     * 更新任务并行数的配置
     * @param queueInfo
     */
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

        if (queueInfo.curMaxParallel === null || queueInfo.curMaxParallel === undefined) {
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

    /**
     * 将任务添加到队列中
     * @param {Job} parent
     * @param {AddToQueueInfos} datas
     */
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
                if (!queueInfo || !queueInfo.config) {
                    // 仅当没有与AddToQueue队列配置对应的FromQueue时，会导致这种情况，这时候直接忽略这些job
                    continue;
                }

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

        // 设置一些默认参数
        job.parentId(job.parentId() || "");
        job.datas(job.datas() || {});
        job.depth(job.depth() || 0);
        job.tryNum(job.tryNum() || 0);
        job.status(job.status() || JobStatus.Create);

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

        // 通过filter做job存在性检测
        if (!filter || !filter.isExisted(job)) {
            if (filter) filter.setExisted(job);
            queue.push(job);
            if (job.status() != JobStatus.RetryWaiting)job.status(JobStatus.Waiting);
        }
        else {
            job.status(JobStatus.Filtered);
        }

        // 保存job的当前状态信息
        jobManager.save(job);
    }

    /**
     * 派发任务
     * @param {WorkerFactoryMap} workerFactoryMap
     */
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
            if (queue && queue.queue && queue.config) {
                if (queue.queue.isEmpty()
                    && queue.config["type"] == "OnTime") {
                    this.addOnTimeJob(queueName); // 当前队列是 OnTime 任务类型的队列，且队列中的任务全部运行玩了，添加10个新的任务到队列中
                }

                const workerFactory = workerFactoryMap[(queue.config.workerFactory as any).name];
                while (
                    !workerFactory.isBusy()
                    && !queue.queue.isEmpty()
                    && (queue.curParallel || 0) < (queue.curMaxParallel || 0)
                    && now - (queue.lastExeTime || 0) > (queue.config.exeInterval || 0)
                    ) {
                    /*
                    满足以下几个条件，任务才能派发成功
                    1. workerFactory 空闲
                    2. 队列有任务
                    3. 队列正在执行任务数未达到该队列当前最大并行数
                    4. 离该队列上一个任务的执行时间已经超过了 exeInterval
                     */
                    let job: Job = null;

                    if (queue.config["type"] == "OnTime") {
                        /*
                        如果是 OnTime 类型的任务，需要先判断队列头部的任务是否到了执行时间
                        如果到了执行时间才 pop 出队列
                         */
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

                            // 执行前更改一些信息
                            this.runningNum++;
                            job.exeTimes({
                                start: new Date().getTime()
                            });
                            job.status(JobStatus.Running);
                            job.tryNum(job.tryNum() + 1);
                            jobManager.save(job);

                            const successOrError = await new Promise<any>(async resolve => {
                                try {
                                    const listener = () => {
                                        resolve(new Error(SIGNAL_FORCE_STOP));
                                    };
                                    signals.once(SIGNAL_FORCE_STOP, listener);
                                    await method.call(target, worker, job);
                                    signals.removeListener(SIGNAL_FORCE_STOP, listener);
                                    resolve(true);
                                }
                                catch (e) {
                                    resolve(e);
                                }
                            });

                            // 执行后更新信息
                            if (successOrError === true) {
                                job.status(JobStatus.Success);
                                this.successNum++;
                            }
                            else {
                                if (job.tryNum() >= Defaults.maxTry) {
                                    // 重试次数达到最大，任务失败
                                    job.status(JobStatus.Fail);
                                }
                                else {
                                    // 还有重试机会，置为重试等待状态
                                    job.status(JobStatus.RetryWaiting);
                                }
                                this.failNum++;
                                logger.error(successOrError.stack);
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

                            if (job.status() == JobStatus.RetryWaiting) {
                                // 重新添加到任务队列
                                QueueManager.addJobToQueue(job, null, job.queue(), this.queues[job.queue()].queue, null);
                            }

                            jobManager.save(job);

                            // 释放worker
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
