import {Assign, SerializableUtil, Serialize, Transient} from "../../common/serialize/Serialize";
import {Queue} from "../queue/Queue";
import {
    AddToQueueInfo,
    AddToQueueInfos,
    FromQueueConfig,
    JobConfig,
    JobOverrideConfig,
    JobOverrideConfigs,
    OnStartConfig,
    OnTimeConfig,
    UpdateQueueConfigData
} from "../Types";
import {instanceofJob, Job, JobStatus} from "../job/Job";
import {appInfo, getInstance} from "../decorators/Launcher";
import {WorkerFactory} from "../worker/WorkerFactory";
import {logger} from "../../common/util/logger";
import {Defaults} from "../Default";
import {Events} from "../Events";
import * as fs from "fs";
import {CronUtil} from "../../common/util/CronUtil";
import {DefaultQueue} from "../queue/DefaultQueue";
import {NoFilter} from "../filter/NoFilter";
import {Filter} from "../filter/Filter";
import {DefaultJob} from "../job/DefaultJob";
import {BloonFilter} from "../filter/BloonFilter";
import {PromiseUtil} from "../../common/util/PromiseUtil";

type QueueInfo = {

    queue: Queue;

    config?: JobConfig;

    curParallel?: number; // 当前并行数

    curMaxParallel?: number; // 当前最大并行数

    success?: number; // 成功的数量

    fail?: number; // 失败的数量

    lastExeTime?: number; // 上一次从该队列pop job的时间戳

}

@Serialize()
export class QueueManager {

    private readonly queueInfos: {[queueName: string]: QueueInfo} = {}; // 所有队列的信息

    private successNum = 0; // 成功运行的任务总数

    private runningNum = 0; // 正在执行的任务总数

    private failNum = 0; // 运行失败的任务总数，一个任务尝试次数耗尽也没有成功，则算作一次失败

    @Transient()
    private pause = false; // 是否暂停派发任务

    @Transient()
    private saving = false; // 是否正在保存queueCache

    @Transient()
    private jobOverrideConfigs: JobOverrideConfigs = {}; // 所有复写 job信息 的回调配置

    @Transient()
    private targetMethodIndexes: any = {};

    @Transient()
    private dispatchQueueIndex = 0; // 决定当前派发哪一个队列中的任务

    @Transient()
    private lastDelayPushTime = 0;

    @Transient()
    private queueParallelNextExeTimes: {
        [queueName: string]: {
            [parallelIndex: number]: number
        }
    } = {};

    constructor(config?: {
        jobOverrideConfigs: JobOverrideConfigs,
        jobConfigs: JobConfig[]
    }) {
        if (config) {
            this.setJobOverrideConfigs(config.jobOverrideConfigs);
            this.setJobConfigs(config.jobConfigs);
            this.loadFromCache();
        }
    }

    setPause(value: boolean) {
        this.pause = value;
        this.delayPushInfo();
    }

    setQueueRunning(queueNameRegex: string, running: boolean) {
        for (let queueName of Object.keys(this.queueInfos)) {
            if (queueName.match(queueNameRegex)) {
                const queueConfig = this.queueInfos[queueName];
                if (queueConfig) {
                    queueConfig.config.running = running;
                }
            }
        }
    }

    /**
     * 停止系统时，等待正在运行的任务结束，超时未运行完成的任务会被强制中断，如果还有重试次数，则会重新添加到任务队列
     * @returns {Promise<void>}
     */
    async waitRunning() {
        this.pause = true;
        this.delayPushInfo();
        await PromiseUtil.wait(() => this.runningNum <= 0, 500, Defaults.shutdownTimeout);
        if (this.runningNum > 0) {
            // 发出强行终止任务的信号
            appInfo.eventBus.emit(Events.QueueManager_InterruptJob);
            await PromiseUtil.wait(() => this.runningNum <= 0, 500);
        }
        if (this.runningNum > 0) this.failNum += this.runningNum;
        this.runningNum = 0;
        this.delayPushInfo();
    }

    /**
     * 删除运行状态持久化文件
     * @returns {any}
     */
    deleteQueueCache(): any {
        try {
            fs.unlinkSync(appInfo.queueCache);
        }
        catch (e) {
            return {
                success: false,
                message: e.message
            };
        }

        this.delayPushInfo();
        return {
            success: true,
            message: "Delete queue cache successfully"
        };
    }

    reExecuteJob(data: any): Promise<any> {
        return new Promise<any>(resolve => {
            appInfo.jobManager.job(data._id).then(doc => {
                const job = SerializableUtil.deserialize(doc.serialize) as Job;

                // 重新设置最大尝试次数
                if (job.datas()._ == null) {
                    job.datas()._ = {};
                }
                job.datas()._.maxTry = job.tryNum() + Defaults.maxTry;

                // 重新添加到任务队列
                QueueManager.addJobToQueue(job, null, job.queue(), this.queueInfos[job.queue()].queue, null);
                resolve({
                    success: true,
                    message: "add to queue success"
                });
            }).catch(err => {
                logger.errorValid && logger.error(err);
                resolve({
                    success: false,
                    message: err.message
                });
            });
        });
    }

    /**
     * 获取当前的队列信息，用于UI界面展示
     * @returns {any}
     */
    info(): any {
        const res: any = {
            cacheExist: fs.existsSync(appInfo.queueCache),
            pause: this.pause,
            saving: this.saving,
            success: this.successNum,
            running: this.runningNum,
            fail: this.failNum,
            queues: [],
            shutdownWaitTimeout: Defaults.shutdownTimeout
        };

        for (let queueName in this.queueInfos) {
            const queueInfo = this.queueInfos[queueName];
            if (!queueInfo.config || !queueInfo.queue) {
                continue;
            }

            const taskType = queueInfo.config['type'];
            let queueDetail: any = {
                name: queueName,
                target: queueInfo.config['target'].constructor.name,
                method: queueInfo.config['method'],
                type: taskType,
                workerFactory: queueInfo.config.workerFactory.name,
                parallel: queueInfo.config.parallel == null ? Defaults.maxParallel : queueInfo.config.parallel,
                exeInterval: queueInfo.config.exeInterval,
                exeIntervalJitter: queueInfo.config.exeIntervalJitter,
                description: queueInfo.config.description,
                curMaxParallel: queueInfo.curMaxParallel || 0,
                curParallel: queueInfo.curParallel || 0,
                success: queueInfo.success || 0,
                fail: queueInfo.fail || 0,
                lastExeTime: queueInfo.lastExeTime
            };
            if (taskType == "OnStart") {
                const urls = queueInfo.config['urls'];
                queueDetail.urls = typeof urls == "string" ? [urls] : urls;
            }
            else if (taskType == "OnTime") {
                const urls = queueInfo.config['urls'];
                queueDetail.urls = typeof urls == "string" ? [urls] : urls;
                queueDetail.cron = queueInfo.config['cron'];
                if (queueInfo.queue.size() > 0) {
                    queueDetail.nextExeTime = queueInfo.queue.peek().datas()._.exeTime;
                }
            }
            else {
                queueDetail.from = queueInfo.config['name'];
                if (queueInfo.queue) {
                    queueDetail.queue = {
                        type: queueInfo.queue.constructor.name,
                        filters: queueInfo.queue.getFilters().map(item => item.constructor.name).join(", "),
                        size: queueInfo.queue.size()
                    };
                }
            }
            res.queues.push(queueDetail);
        }

        // 对 res.queues 进行排序，排序规则：按照 TaskClassName > JobType(OnStart > OnTime > FromQueue) > JobExecutionMethodPosition 的三个要素来排序
        const queueTypes = {OnStart: 0, OnTime: 1, FromQueue: 2};
        res.queues.sort((item1, item2) => {
            if (item1.target !== item2.target) {
                return item1.target > item2.target;
            }
            else if (item1.type != item2.type) {
                return queueTypes[item1.type] > queueTypes[item2.type];
            }
            else {
                const methods = this.targetMethodIndexes[item1.target];
                return (methods[item1.method] || 0) - (methods[item2.method] || 0);
            }
        });

        return res;
    }

    /**
     * 从运行状态持久化文件中恢复运行状态
     * 实际上是通过反序列化创建了一个临时的QueueManager实例，然后将需要的信息复制给当前的实例
     * @param {string} cachePath
     */
    loadFromCache() {
        try {
            if (fs.existsSync(appInfo.queueCache)) {
                const data = JSON.parse(fs.readFileSync(appInfo.queueCache, "utf-8"));
                const tempQueueManager = SerializableUtil.deserialize(data) as QueueManager;

                this.successNum = tempQueueManager.successNum;
                this.runningNum = tempQueueManager.runningNum;
                this.failNum = tempQueueManager.failNum;

                const loadedTasks = new Map<any, any>();

                for (let queueName of Object.keys(tempQueueManager.queueInfos)) {
                    const queueInfo = tempQueueManager.queueInfos[queueName];
                    const thisQueueInfo = this.queueInfos[queueName];
                    if (thisQueueInfo) {
                        thisQueueInfo.success = queueInfo.success;
                        thisQueueInfo.fail = queueInfo.fail;
                        thisQueueInfo.curMaxParallel = queueInfo.curMaxParallel;

                        thisQueueInfo.config.exeInterval = queueInfo.config.exeInterval;
                        thisQueueInfo.config.exeIntervalJitter = queueInfo.config.exeIntervalJitter;

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

                        const taskIns = thisQueueInfo.config["target"];
                        if (!loadedTasks.get(taskIns)) {
                            loadedTasks.set(taskIns, true);
                            Assign(taskIns, queueInfo.config["target"]);
                        }
                    }
                }
            }
        }
        catch (e) {
            logger.warn(e.stack);
        }
        this.delayPushInfo();
    }

    /**
     * 通过序列化，将运行状态持久化到文件中
     * @returns {any}
     */
    async saveQueueCache() {
        this.saving = true;
        this.delayPushInfo();
        return PromiseUtil.wait(() => this.runningNum <= 0, 500, -1).then(() => {
            try {
                const data = JSON.stringify(SerializableUtil.serialize(this));
                fs.writeFileSync(appInfo.queueCache, data);
            }
            catch (e) {
                logger.warn(e);
                return {
                    success: false,
                    message: e.message
                };
            }
            return {
                success: true,
                message: "save queue cache successfully"
            };
        }).then(res => {
            this.saving = false;
            this.delayPushInfo();
            return res;
        });
    }

    reExecuteOnStartJob(queueName: string) {
        this.addOnStartJob(queueName);
        return {
            success: true,
            message: "add job to queue successfully"
        }
    }

    /**
     * 更新队列配置
     * @param {UpdateQueueConfigData} data
     * @returns {any}
     */
    updateConfig(data: UpdateQueueConfigData): any {
        const queueInfo = this.queueInfos[data.queue];
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
                while (!queueInfo.queue.isEmpty()) {
                    const job = queueInfo.queue.pop();
                    job.status(JobStatus.Closed);
                    job.logs(logger.formatWithoutPos("info", "job closed because of cron change"));
                }
            }
        }
        else if (data.field == "exeInterval") {
            queueInfo.config.exeInterval = data.value;
        }
        else if (data.field == "exeIntervalJitter") {
            queueInfo.config.exeIntervalJitter = data.value;
        }
        else if (data.field == "curMaxParallel") {
            queueInfo.curMaxParallel = data.value;
        }

        this.delayPushInfo();
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
                        if (interval) {
                            queueInfo.parallelIntervals.push(interval);
                        }
                    }
                }
            }
        }

        if (queueInfo.curMaxParallel == null) {
            queueInfo.curMaxParallel = Defaults.maxParallel;
        }
        else if (queueInfo.config && typeof queueInfo.config.parallel == "number"
            && queueInfo.curMaxParallel > queueInfo.config.parallel) {
            queueInfo.curMaxParallel = queueInfo.config.parallel;
        }
    }

    // 延迟 50ms 推送信息变更
    private delayPushInfo() {
        if (this.lastDelayPushTime === 0) {
            this.lastDelayPushTime = new Date().getTime();
            setTimeout(() => {
                this.lastDelayPushTime = 0;
                appInfo.webServer.push("queues", this.info());
            }, 50);
        }
    }

    private setJobConfigs(configs: JobConfig[]) {
        configs.forEach(config => {
            const type = config["type"];
            if (type == "OnStart") {
                this.addOnStartConfig(config as OnStartConfig);
            }
            else if (type == "OnTime") {
                this.addOnTimeConfig(config as OnTimeConfig);
            }
            else if (type == "FromQueue") {
                this.addFromQueueConfig(config as FromQueueConfig);
            }
        });
    }

    private addQueueConfig(queueName: string, config: JobConfig): string {
        if (!queueName) {
            queueName = config["type"] + "_" + config["target"].constructor.name + "_" + config["method"];
        }

        if (config.running == null) {
            config.running = true;
        }

        if (config.parallel == null) {
            config.parallel = Defaults.maxParallel;
        }

        if (config.exeInterval == null) {
            config.exeInterval = Defaults.exeInterval;
        }

        if (config.exeIntervalJitter == null) {
            config.exeIntervalJitter = config.exeInterval * Defaults.exeIntervalJitterRate;
        }

        let queueInfo = this.queueInfos[queueName];
        if (!queueInfo) {
            this.queueInfos[queueName] = queueInfo = {
                queue: null
            };
        }
        queueInfo.config = config;
        this.resetQueueParallel(queueInfo);
        this.refreshTargetMethodIndexes(queueName);
        return queueName;
    }

    private setJobOverrideConfigs(jobOverrideConfigs: JobOverrideConfigs) {
        Object.assign(this.jobOverrideConfigs, jobOverrideConfigs);
    }

    /**
     * 记录所有 TaskClass 中 method 的排序，用于后续 info 方法中对 queues 排序
     * @type {{}}
     */
    private refreshTargetMethodIndexes(queueName: string) {
        const queue = this.queueInfos[queueName];
        const target = queue.config['target'];
        const targetName = target.constructor.name;
        let methods;
        if ((methods = this.targetMethodIndexes[targetName]) == null) {
            this.targetMethodIndexes[targetName] = methods = {};
        }
        const methodName = queue.config['method'];
        if (methods[methodName] == null) {
            methods[methodName] = Object.keys(methods).length;
        }
    }

    private addOnStartConfig(config: OnStartConfig) {
        const queueName = this.addQueueConfig(null, config);
        this.addOnStartJob(queueName);
    }

    private addOnStartJob(queueName: string) {
        const config = this.queueInfos[queueName].config as OnStartConfig;
        this.addToQueue(null, {
            queueName: queueName,
            jobs: config.urls,
            queueType: DefaultQueue,
            filterType: NoFilter
        });
    }

    private addOnTimeConfig(config: OnTimeConfig) {
        const queueName = this.addQueueConfig(null, config);
        this.addOnTimeJob(queueName);
    }

    private addOnTimeJob(queueName: string) {
        const config = this.queueInfos[queueName].config as OnTimeConfig;
        const nearTime = CronUtil.next(config.cron, 1) as Date;
        this.addToQueue(null, {
            queueName: queueName,
            jobs: config.urls,
            queueType: DefaultQueue,
            filterType: NoFilter,
            _: {
                exeTime: nearTime.getTime()
            }
        });
    }

    private addFromQueueConfig(config: FromQueueConfig) {
        this.addQueueConfig(config.name, config);
    }

    /**
     * 将任务添加到队列中
     * @param {Job} parent
     * @param {AddToQueueInfos} datas
     */
    addToQueue(parent: Job, datas: AddToQueueInfos) {
        if (datas) {
            if (!(datas instanceof Array)) {
                datas = [datas] as AddToQueueInfos;
            }

            for (let jobInfo of (datas as AddToQueueInfo[])) {
                const queueName = jobInfo.queueName;

                let queueInfo = this.queueInfos[queueName];
                if (!queueInfo || !queueInfo.config) {
                    // 仅当没有与AddToQueue队列配置对应的FromQueue时，会导致这种情况，这时候直接忽略这些job
                    continue;
                }

                if (!queueInfo) {
                    this.queueInfos[queueName] = queueInfo = {
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
                if (jobs != null) {
                    if (jobs.constructor == String || instanceofJob(jobs)) {
                        QueueManager.addJobToQueue(jobs, parent, queueName, queue, filter, jobInfo._, this.jobOverrideConfigs[queueName]);
                    }
                    else if (jobs.constructor == Array) {
                        for (let job of jobs) {
                            QueueManager.addJobToQueue(job, parent, queueName, queue, filter, jobInfo._, this.jobOverrideConfigs[queueName]);
                        }
                    }
                }
            }
            this.delayPushInfo();
        }
    }

    private static addJobToQueue(jobOrUrl: any, parent: Job, queueName: string, queue: Queue, filter: Filter, _?: any, jobOverrideConfig?: JobOverrideConfig) {
        const job = instanceofJob(jobOrUrl) ? jobOrUrl as Job : new DefaultJob(jobOrUrl);

        // 设置一些默认参数
        job.parentId(job.parentId() || "");
        job.datas(job.datas() || {});
        job.depth(job.depth() || 0);
        job.tryNum(job.tryNum() || 0);
        job.status(job.status() || JobStatus.Waiting);

        // 重写 job 的一些信息
        if (jobOverrideConfig) {
            jobOverrideConfig.method.call(jobOverrideConfig.target, job);
        }

        // 添加额外信息
        if (_) {
            let _sysData = job.datas()._;
            if (!_sysData) {
                job.datas()._ = _sysData = {};
            }
            Object.assign(_sysData, _);
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
            job.logs(logger.formatWithoutPos("info", "add to queue"));
        }
        else {
            job.status(JobStatus.Filtered);
            job.logs(logger.formatWithoutPos("warn", "filtered"));
        }

        // 保存job的当前状态信息
        appInfo.jobManager.save(job);
    }

    startDispatchLoop() {
        const dispatchLoop = () => {
            this.dispatch();
            setTimeout(() => dispatchLoop(), 60);
        };
        dispatchLoop();
    }

    private getFreeParallelIndex(queueName: string, queueInfo: QueueInfo, now: number) {
        let parallelExeInfo = this.queueParallelNextExeTimes[queueName];
        if (!parallelExeInfo) {
            this.queueParallelNextExeTimes[queueName] = parallelExeInfo = {};
        }

        for (let i = 0; i < queueInfo.curMaxParallel; i++) {
            const nextExeTime = parallelExeInfo[i];
            if (nextExeTime != -1 && (nextExeTime == null || nextExeTime <= now)) {
                return i;
            }
        }
        return -1;
    }

    private dispatch() {
        if (this.pause || this.saving) return;

        const queueNames = Object.keys(this.queueInfos);
        if (queueNames.length == 0) return;

        const now = new Date().getTime();
        if (this.dispatchQueueIndex >= queueNames.length) {
            this.dispatchQueueIndex = 0;
        }

        while (this.dispatchQueueIndex < queueNames.length) {
            const queueName = queueNames[this.dispatchQueueIndex];
            const queueInfo = this.queueInfos[queueName];
            if (queueInfo && queueInfo.queue && queueInfo.config) {
                if (queueInfo.queue.isEmpty() && queueInfo.config["type"] == "OnTime") {
                    // 当前队列是 OnTime 任务类型的队列，且队列中的任务全部运行完了，添加下一个时间运行的任务
                    this.addOnTimeJob(queueName);
                }

                /*
                满足以下几个条件，任务才能派发成功
                1. 队列有任务
                2. 任务队列中有空闲线程
                 */
                let parallelIndex;
                while (!queueInfo.queue.isEmpty()
                    && (parallelIndex = this.getFreeParallelIndex(queueName, queueInfo, now)) != -1
                    ) {
                    const curParallelIndex = parallelIndex;

                    let job: Job = null;

                    if (queueInfo.config["type"] == "OnTime") {
                        /*
                        如果是 OnTime 类型的任务，需要先判断队列头部的任务是否到了执行时间
                        如果到了执行时间才 pop 出队列
                         */
                        job = queueInfo.queue.peek();
                        if (job) {
                            if (job.datas()._.exeTime > now) job = null;
                            else {
                                queueInfo.queue.pop();
                                if (!queueInfo.config.running) {
                                    // 队列未工作，任务进入Closed状态
                                    job.status(JobStatus.Closed);
                                    job.logs(logger.formatWithoutPos("warn","the OnTime queue is not running"));
                                    appInfo.jobManager.save(job);
                                    job = null;
                                }
                            }
                        }
                    }
                    else if (queueInfo.config.running) {
                        job = queueInfo.queue.pop();
                    }

                    if (job) {
                        this.queueParallelNextExeTimes[queueName][curParallelIndex] = -1;
                        this.executeJob(queueInfo, job).then(() => {
                            // 计算下一次运行时间
                            const interval = (queueInfo.config.exeInterval || 0)
                                + (Math.random() * 2 - 1) * queueInfo.config.exeIntervalJitter;
                            this.queueParallelNextExeTimes[queueName][curParallelIndex] = new Date().getTime() + interval;
                        });
                    }
                    else break;
                }
            }
            this.dispatchQueueIndex++;
        }
    }

    /**
     * 执行一个任务
     */
    private executeJob(queueInfo: QueueInfo, job: Job) {
        queueInfo.curParallel = (queueInfo.curParallel || 0) + 1;
        queueInfo.lastExeTime = new Date().getTime();

        const workerFactory = getInstance<WorkerFactory<any>>(queueInfo.config.workerFactory);
        return workerFactory.get().then(async worker => {
            const target = queueInfo.config["target"];
            const method = target[queueInfo.config["method"]];

            this.runningNum++;
            this.delayPushInfo();

            job.logs(logger.formatWithoutPos("info","start execution"));
            job.status(JobStatus.Running);
            job.tryNum((job.tryNum() || 0) + 1);
            appInfo.jobManager.save(job);

            try {
                await new Promise(async (resolve, reject) => {
                    // 如果任务设置有超时时间，则设置超时回调
                   if (queueInfo.config.timeout == null || queueInfo.config.timeout >= 0) {
                       const timeout = queueInfo.config.timeout || Defaults.jobTimeout;
                       setTimeout(() => {
                           reject(new Error("job timeout in " + timeout + "ms"));
                       }, timeout);
                   }

                    const listenInterrupt = reason => {
                        // ppspider系统关闭，强制停止任务
                        reject(new Error(Events.QueueManager_InterruptJob + ": " + reason));
                    };

                    appInfo.eventBus.once(Events.QueueManager_InterruptJob, listenInterrupt);
                    await method.call(target, worker, job);
                    appInfo.eventBus.removeListener(Events.QueueManager_InterruptJob, listenInterrupt);

                    resolve();
                });

                job.status(JobStatus.Success);
                job.logs(logger.formatWithoutPos("info","executed successfully"));
                this.successNum++;
            }
            catch (e) {
                if (job.tryNum() >= (((job.datas() || {})._ || {}).maxTry || Defaults.maxTry)) {
                    // 重试次数达到最大，任务失败
                    job.status(JobStatus.Fail);
                    this.failNum++;
                }
                else {
                    // 还有重试机会，置为重试等待状态
                    job.status(JobStatus.RetryWaiting);
                }
                job.logs(logger.formatWithoutPos("error", e));
                logger.error(job, e);
            }

            this.runningNum--;
            queueInfo.curParallel--;
            return worker;
        }).then(async worker => {
            if (job.status() == JobStatus.Success) {
                queueInfo.success = (queueInfo.success || 0) + 1;
            }
            else {
                // 队列中每尝试失败一次，该队列运行失败的次数就加1
                queueInfo.fail = (queueInfo.fail || 0) + 1;
            }

            if (job.status() == JobStatus.RetryWaiting) {
                // 重新添加到任务队列 @TODO
                // QueueManager.addJobToQueue(job, null, job.queue(), this.queues[job.queue()].queue, null);
            }

            appInfo.jobManager.save(job);
            this.delayPushInfo();

            // 释放worker
            await workerFactory.release(worker);
        });
    }

}
