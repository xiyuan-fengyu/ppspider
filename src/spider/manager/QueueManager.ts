import {Assign, Serializable, SerializableUtil, Transient} from "../../common/serialize/Serializable";
import {Queue} from "../queue/Queue";
import {
    AddToQueueInfo,
    AddToQueueInfos,
    Class_Filter,
    FromQueueConfig,
    JobConfig,
    JobOverrideConfig,
    JobOverrideConfigs,
    OnStartConfig,
    OnTimeConfig,
    UpdateQueueConfigData
} from "../Types";
import {instanceofJob, Job, JobStatus} from "../job/Job";
import {appInfo} from "../decorators/Launcher";
import {WorkerFactory} from "../worker/WorkerFactory";
import {logger} from "../../common/util/logger";
import {Defaults} from "../Default";
import {Events} from "../Events";
import * as fs from "fs";
import {CronUtil} from "../../common/util/CronUtil";
import {DefaultQueue} from "../queue/DefaultQueue";
import {NoFilter} from "../filter/NoFilter";
import {Filter} from "../filter/Filter";
import {BloonFilter} from "../filter/BloonFilter";
import {PromiseUtil} from "../../common/util/PromiseUtil";
import {ObjectUtil} from "../../common/util/ObjectUtil";

type QueueInfo = {

    name: string;

    queue: Queue;

    config?: JobConfig;

    curParallel?: number; // 当前并行数（当前运行任务数量）

    curMaxParallel?: number; // 当前最大并行数

    success?: number; // 成功任务的数量

    fail?: number; // 失败任务的数量（任务经过最大次数尝试后，任然失败，则认为该任务失败）

    tryFail?: number; // 任务尝试失败的次数

    lastExeTime?: number; // 上一次从该队列pop job的时间戳

}

@Serializable()
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
        this.delayPushInfo();
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
            setTimeout(() => {
                appInfo.eventBus.emit(Events.QueueManager_InterruptJob, null, "system shutdown");
            }, 0);
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
            appInfo.jobManager.job(data._id).then(job => {
                // 重新设置最大尝试次数
                const queueInfo = this.queueInfos[job.queue];
                !job.datas._ && (job.datas._ = {});
                if (job.datas._.maxTry < 0 || (!job.datas._.maxTry && queueInfo.config.maxTry < 0)) {
                    // 无限尝试
                }
                else {
                    // 有限次尝试，增加最大尝试次数
                    let moreTry = queueInfo.config.maxTry ;
                    if (!moreTry || moreTry < 0) {
                        moreTry = Defaults.maxTry;
                    }
                    job.datas._.maxTry = job.tryNum + moreTry;
                }

                // 重新添加到任务队列
                this.addJobToQueue(job, null, job.queue, this.queueInfos[job.queue].queue, null);
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
        }).then(async res => {
            res.data = await appInfo.jobManager.job(data._id);
            return res;
        });
    }

    interrupteJob(data: any): Promise<any> {
        return new Promise<any>(resolve => {
            let interrupted = false;
            PromiseUtil.wait(async () => {
                if (interrupted) {
                    return true;
                }
                else {
                    const job = await appInfo.jobManager.job(data._id);
                    if (job.status != JobStatus.Running) {
                        return true;
                    }
                }
            }, 500, 30000).then(() => {
                appInfo.jobManager.job(data._id).then(job => {
                    resolve({
                        success: interrupted,
                        message: interrupted ? "interrupt job(" + data._id + ") successfully"
                            : "job(" + data._id + ") isn't running",
                        data: job
                    });
                });
                appInfo.eventBus.removeAllListeners(Events.QueueManager_InterruptJobSuccess(data._id));
            });
            // 发出强行终止任务的信号
            appInfo.eventBus.emit(Events.QueueManager_InterruptJob, data._id, "interrupt by user");
            appInfo.eventBus.once(Events.QueueManager_InterruptJobSuccess(data._id), () => {
                interrupted = true;
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
                workerFactory: queueInfo.config["workerFactory"].constructor.name,
                running: queueInfo.config.running,
                parallel: queueInfo.config.parallel == null ? Defaults.maxParallel : queueInfo.config.parallel,
                exeInterval: queueInfo.config.exeInterval,
                exeIntervalJitter: queueInfo.config.exeIntervalJitter,
                description: queueInfo.config.description,
                curMaxParallel: queueInfo.curMaxParallel || 0,
                curParallel: queueInfo.curParallel || 0,
                success: queueInfo.success || 0,
                fail: queueInfo.fail || 0,
                tryFail: queueInfo.tryFail || 0,
                lastExeTime: queueInfo.lastExeTime,
                timeout: queueInfo.config.timeout,
                maxTry: queueInfo.config.maxTry,
                defaultDatas: queueInfo.config.defaultDatas || {},
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
                    queueDetail.nextExeTime = queueInfo.queue.peek().datas._.exeTime;
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
                return item1.target < item2.target ? -1 : 1;
            }
            else if (item1.type != item2.type) {
                return queueTypes[item1.type] - queueTypes[item2.type];
            }
            else {
                const methods = this.targetMethodIndexes[item1.target];
                const delta = (methods[item1.method] || 0) - (methods[item2.method] || 0);
                if (delta != 0) {
                    return delta;
                }
                return item1.name < item2.name ? -1 : 1;
            }
        });

        return res;
    }

    private simpleQueueInfos() {
        const queues: any = {};
        for (let queueName in this.queueInfos) {
            const queueInfo = this.queueInfos[queueName];
            if (!queueInfo.config || !queueInfo.queue) {
                continue;
            }
            const taskType = queueInfo.config['type'];
            queues[queueName] = {
                type: taskType,
                running: queueInfo.curParallel,
                success: queueInfo.success || 0,
                fail: queueInfo.fail || 0,
                tryFail: queueInfo.tryFail || 0,
                remain: queueInfo.queue.size()
            };
        }
        return queues;
    }

    /**
     * 从运行状态持久化文件中恢复运行状态
     * 实际上是通过反序列化创建了一个临时的QueueManager实例，然后将需要的信息复制给当前的实例
     * @param {string} cachePath
     */
    async loadFromCache() {
        try {
            if (fs.existsSync(appInfo.queueCache)) {
                const tempQueueManager = (await SerializableUtil.deserializeFromFile(appInfo.queueCache, "utf-8")) as QueueManager;

                this.successNum = tempQueueManager.successNum;
                this.runningNum = tempQueueManager.runningNum;
                this.failNum = tempQueueManager.failNum;

                const loadedTasks = new Map<any, any>();

                for (let queueName of Object.keys(tempQueueManager.queueInfos)) {
                    const queueInfo = tempQueueManager.queueInfos[queueName];
                    let thisQueueInfo = this.queueInfos[queueName];
                    if (!thisQueueInfo) {
                        thisQueueInfo = this.cloneRegexpNamedFromQueueInfo(queueName);
                    }
                    if (thisQueueInfo) {
                        thisQueueInfo.success = queueInfo.success;
                        thisQueueInfo.fail = queueInfo.fail;
                        thisQueueInfo.tryFail = queueInfo.tryFail;
                        thisQueueInfo.curMaxParallel = queueInfo.curMaxParallel;
                        thisQueueInfo.lastExeTime = queueInfo.lastExeTime;

                        thisQueueInfo.config.exeInterval = queueInfo.config.exeInterval;
                        thisQueueInfo.config.exeIntervalJitter = queueInfo.config.exeIntervalJitter;
                        thisQueueInfo.config.timeout = queueInfo.config.timeout;
                        thisQueueInfo.config.maxTry = queueInfo.config.maxTry;
                        thisQueueInfo.config.defaultDatas = queueInfo.config.defaultDatas;

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
                        else {
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

        // 初始化 OnStart 类型任务
        for (let queueName in this.queueInfos) {
            const queueInfo = this.queueInfos[queueName];
            if (queueInfo.config["type"] == "OnStart") {
                this.addOnStartJob(queueInfo.name, (queueInfo.config as OnStartConfig).filterType || BloonFilter);
            }
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
        return PromiseUtil.wait(() => this.runningNum <= 0, 500, -1).then(async () => {
            try {
                await SerializableUtil.serializeToFile(this, appInfo.queueCache);
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
        this.addOnStartJob(queueName, NoFilter);
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
                    job.status = JobStatus.Closed;
                    job.logs.push(logger.formatWithoutPos("info", "job closed because of cron change"));
                }
            }
        }
        else if (data.field == "exeInterval") {
            const rate = queueInfo.config.exeIntervalJitter / (queueInfo.config.exeInterval || 1);
            queueInfo.config.exeInterval = data.value;
            if (queueInfo.config.exeIntervalJitter > queueInfo.config.exeInterval) {
                queueInfo.config.exeIntervalJitter = queueInfo.config.exeInterval * rate;
            }
            this.fixParallelNextExeTime(queueInfo);
        }
        else if (data.field == "exeIntervalJitter") {
            queueInfo.config.exeIntervalJitter = data.value;
            this.fixParallelNextExeTime(queueInfo);
        }
        else if (data.field == "curMaxParallel") {
            queueInfo.curMaxParallel = data.value;
        }
        else if (data.field == "urls") {
          (queueInfo.config as OnStartConfig).urls = data.value;
        }
        else if (data.field == "timeout") {
          queueInfo.config.timeout = data.value;
        }
        else if (data.field == "maxTry") {
          queueInfo.config.maxTry = data.value;
        }
        else if (data.field == "defaultDatas") {
          queueInfo.config.defaultDatas = data.value;
        }

        this.delayPushInfo();
        return {
            success: true,
            message: "update success: " + data.field
        };
    }

    private fixParallelNextExeTime(queueInfo: QueueInfo) {
        const maxNexExeTime = new Date().getTime() + queueInfo.config.exeInterval + queueInfo.config.exeIntervalJitter;
        let nextExeTime = this.queueParallelNextExeTimes[queueInfo.name];
        for (let key of Object.keys(nextExeTime)) {
            const time = nextExeTime[key];
            if (time > maxNexExeTime) {
                nextExeTime[key] = maxNexExeTime;
            }
        }

        if (queueInfo.config["type"] == "OnTime" && queueInfo.queue.size() > 0) {
            queueInfo.queue.peek().datas._.exeTime = this.computeNextExeTimeForOnTimeJob(queueInfo);
        }
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
                for (let cron in queueInfo.config.parallel) {
                    const para = queueInfo.config.parallel[cron];
                    if (typeof para == "number") {
                        const interval = CronUtil.setInterval(cron, () => {
                            queueInfo.curMaxParallel = para as number;
                        });
                        queueInfo.parallelIntervals.push(interval);
                    }
                }

                // 根据 queueInfo.config.parallel 中的cron表达式，计算出各 cron 表达式上一次可执行的时间
                // 将 queueInfo.curMaxParallel 设置为上一次可执行时间最接近当前时间的 cron 对应的 parallel
                let nearestDate = null;
                let nearestCronParallel = null;
                const now = new Date().getTime();
                for (let cron in queueInfo.config.parallel) {
                    const para = queueInfo.config.parallel[cron];
                    if (typeof para == "number") {
                        try {
                            const prevDate = CronUtil.prev(cron, now);
                            if (nearestDate == null || nearestDate < prevDate) {
                                nearestDate = prevDate;
                                nearestCronParallel = para;
                            }
                        }
                        catch (e) {
                            logger.warn(e);
                        }
                    }
                }
                if (nearestCronParallel != null) {
                    queueInfo.curMaxParallel = nearestCronParallel;
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
                appInfo.webServer && appInfo.webServer.push("queues", this.info());
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

        if (config.timeout == null) {
          config.timeout = Defaults.jobTimeout;
        }

        if (config.maxTry == null) {
          config.maxTry = Defaults.maxTry;
        }

        let queueInfo = this.queueInfos[queueName];
        if (!queueInfo) {
            this.queueInfos[queueName] = queueInfo = {
                name: queueName,
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
        this.addQueueConfig(null, config);
    }

    private addOnStartJob(queueName: string, filterType: Class_Filter) {
        const config = this.queueInfos[queueName].config as OnStartConfig;
        this.addToQueue(null, {
            queueName: queueName,
            jobs: config.urls,
            queueType: DefaultQueue,
            filterType: filterType
        });
    }

    private addOnTimeConfig(config: OnTimeConfig) {
        const queueName = this.addQueueConfig(null, config);
        this.addOnTimeJob(queueName);
    }

    private addOnTimeJob(queueName: string) {
        const queueInfo = this.queueInfos[queueName];
        const nextExeTime = this.computeNextExeTimeForOnTimeJob(queueInfo);
        if (nextExeTime) {
            this.addToQueue(null, {
                queueName: queueName,
                jobs: (queueInfo.config as OnTimeConfig).urls,
                queueType: DefaultQueue,
                filterType: NoFilter,
                _: {
                    exeTime: nextExeTime
                }
            });
        }
    }

    private computeNextExeTimeForOnTimeJob(queueInfo: QueueInfo) {
        let nextExeTime = null;
        const parallelExeInfo = this.queueParallelNextExeTimes[queueInfo.name];
        if (parallelExeInfo) {
            for (let i = 0; i < queueInfo.curMaxParallel; i++) {
                const temp = parallelExeInfo[i];
                if (temp != -1) {
                    if (nextExeTime == null) {
                        const interval = (queueInfo.config.exeInterval || 0)
                            + (Math.random() * 2 - 1) * queueInfo.config.exeIntervalJitter;
                        nextExeTime = new Date().getTime() + interval;
                    }
                    if (nextExeTime == null || nextExeTime > temp) {
                        nextExeTime = temp;
                    }
                }
            }

            if (!nextExeTime) {
                // 全部线程繁忙，返回空，不添加新任务
                return null;
            }
        }

        const nearTime = +CronUtil.next((queueInfo.config as OnTimeConfig).cron, 1)[0].getTime().toFixed(0);
        return nextExeTime == null ? nearTime : Math.max(nearTime, nextExeTime);
    }

    private addFromQueueConfig(config: FromQueueConfig) {
        this.addQueueConfig(config.name, config);
    }

    private cloneRegexpNamedFromQueueInfo(queueName: string) {
        // 尝试通过正则表达式查找 FromQueue 类型的队列，并clone一个专有的队列配置
        for (let key in this.queueInfos) {
            const tempQueueInfo = this.queueInfos[key];
            if (tempQueueInfo.config && tempQueueInfo.config["type"] == "FromQueue" && queueName.match(tempQueueInfo.config["name"])) {
                this.addQueueConfig(queueName, Object.assign({}, tempQueueInfo.config));
                return this.queueInfos[queueName];
            }
        }
    }

    /**
     * 将任务添加到队列中
     * @param {Job} parent
     * @param {AddToQueueInfos} datas
     */
    async addToQueue(parent: Job, datas: AddToQueueInfos) {
        if (datas) {
            if (!(datas instanceof Array)) {
                datas = [datas] as AddToQueueInfos;
            }

            for (let jobInfo of (datas as AddToQueueInfo[])) {
                const queueName = jobInfo.queueName;

                let queueInfo = this.queueInfos[queueName];
                if (!queueInfo) {
                    queueInfo = this.cloneRegexpNamedFromQueueInfo(queueName);
                }
                if (!queueInfo || !queueInfo.config) {
                    // 仅当没有与AddToQueue队列配置对应的FromQueue时，会导致这种情况，这时候直接忽略这些job
                    continue;
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
                        await this.addJobToQueue(jobs, parent, queueName, queue, filter, jobInfo._, this.jobOverrideConfigs[queueName]);
                    }
                    else if (jobs instanceof Array) {
                        for (let job of jobs) {
                            await this.addJobToQueue(job, parent, queueName, queue, filter, jobInfo._, this.jobOverrideConfigs[queueName]);
                        }
                    }
                }
            }
        }
    }

    private async addJobToQueue(jobOrUrl: any, parent: Job, queueName: string, queue: Queue, filter: Filter, _?: any, jobOverrideConfig?: JobOverrideConfig) {
        let job = instanceofJob(jobOrUrl) ? jobOrUrl as Job : new Job(jobOrUrl);

        // 设置一些默认参数
        job.parentId || (job.parentId = "");
        job.datas || (job.datas = {});
        job.depth || (job.depth = 0);
        job.tryNum || (job.tryNum = 0);
        job.status || (job.status = JobStatus.Waiting);

        // 如果 config 中有 defaultDatas 配置，需要进行defaultDatas和job.datas的融合
        const queueInfo = this.queueInfos[queueName];
        if (queueInfo.config.defaultDatas && Object.keys(queueInfo.config.defaultDatas).length > 0) {
            const mergeDatas = ObjectUtil.deepClone(queueInfo.config.defaultDatas);
            ObjectUtil.deepAssign(job.datas, mergeDatas);
            job.datas = mergeDatas;
        }

        // 添加额外信息
        if (_) {
            let _sysData = job.datas._;
            if (!_sysData) {
                job.datas._ = _sysData = {};
            }
            Object.assign(_sysData, _);
        }

        // 检查和修复 job 的信息
        if (!job.queue) job.queue = queueName;
        if (parent) {
            if (!job.parentId) job.parentId = parent._id;
            if (job.depth == 0) job.depth = parent.depth + 1;
        }

        // 重写 job 的一些信息
        if (jobOverrideConfig) {
            await jobOverrideConfig.method.call(jobOverrideConfig.target, job, parent);
        }

        // 通过filter做job存在性检测；增加异步检测的支持
        if (filter && (await filter.isExisted(job)) == true) {
            job.status = JobStatus.Filtered;
            job.logs.push(logger.formatWithoutPos("warn", "filtered"));
        }
        else {
            filter && await filter.setExisted(job);
            queue.push(job);
            if (job.status != JobStatus.RetryWaiting) job.status = JobStatus.Waiting;
            job.logs.push(logger.formatWithoutPos("info", "add to queue"));
        }
        await appInfo.jobManager.save(job);

        this.delayPushInfo();
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
                            if (job.datas._.exeTime > now) job = null;
                            else {
                                queueInfo.queue.pop();
                                if (!queueInfo.config.running) {
                                    // 队列未工作，任务进入Closed状态
                                    job.status = JobStatus.Closed;
                                    job.logs.push(logger.formatWithoutPos("warn","the OnTime queue is not running"));
                                    appInfo.jobManager.save(job, true);
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
                        }).then(() => {
                            appInfo.eventBus.emit(Events.QueueManager_JobExecuted, {
                                job: job,
                                queues: this.simpleQueueInfos()
                            });
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

        const target = queueInfo.config["target"];
        const method = target[queueInfo.config["method"]];
        const workerFactory = queueInfo.config["workerFactory"] as WorkerFactory<any>;
        return workerFactory.get().then(async worker => {
            this.runningNum++;
            this.delayPushInfo();

            job.logs.push(logger.formatWithoutPos("info","start execution"));
            job.status = JobStatus.Running;
            job.tryNum++;
            await appInfo.jobManager.save(job, true);

            let interrupted = false;
            try {
                let listenInterrupt = null;
                await new Promise(async (resolve, reject) => {
                    // 如果任务设置有超时时间，则设置超时回调
                   if (queueInfo.config.timeout == null || queueInfo.config.timeout >= 0) {
                       const timeout = queueInfo.config.timeout || Defaults.jobTimeout;
                       setTimeout(() => {
                           reject(new Error("job timeout in " + timeout + "ms"));
                       }, timeout);
                   }

                    listenInterrupt = (jobId, reason) => {
                        if (jobId == null || jobId == job._id) {
                            // 强制停止任务
                            interrupted = true;
                            reject(new Error(Events.QueueManager_InterruptJob + ": " + reason));
                            if (jobId) {
                                // 这里必须要setTimeout才能通知成功，很奇怪
                                setTimeout(() => {
                                    appInfo.eventBus.emit(Events.QueueManager_InterruptJobSuccess(jobId));
                                }, 0);
                            }
                        }
                    };

                    appInfo.eventBus.on(Events.QueueManager_InterruptJob, listenInterrupt);
                    try {
                        const paramArr = [];

                        const workerParamIndex = queueInfo.config["workerParamIndex"];
                        (workerParamIndex == 0 || workerParamIndex == 1) && (paramArr[workerParamIndex] = worker);

                        const jobParamIndex = queueInfo.config["jobParamIndex"];
                        if (jobParamIndex == 0 || jobParamIndex == 1) {
                            paramArr[jobParamIndex] = job
                        }
                        else {
                            paramArr.push(job);
                        }

                        const res = await method.call(target, ...paramArr);
                        resolve(res);
                    }
                    catch (e) {
                        reject(e);
                    }
                }).finally(() => {
                    listenInterrupt && appInfo.eventBus.removeListener(Events.QueueManager_InterruptJob, listenInterrupt);
                });

                job.status = JobStatus.Success;
                job.logs.push(logger.formatWithoutPos("info","executed successfully"));
                this.successNum++;
            }
            catch (e) {
                let maxTry = (job.datas._ || {}).maxTry;
                if (!maxTry) {
                    if (queueInfo.config.maxTry) {
                        maxTry = queueInfo.config.maxTry;
                    }
                    else {
                        maxTry = Defaults.maxTry;
                    }
                }
                if (interrupted || (maxTry >= 0 && job.tryNum >= maxTry)) {
                    // 重试次数达到最大，任务失败
                    job.status = JobStatus.Fail;
                    this.failNum++;
                    queueInfo.fail = (queueInfo.fail || 0) + 1;
                }
                else {
                    // 还有重试机会，置为重试等待状态
                    job.status = JobStatus.RetryWaiting;
                }
                job.logs.push(logger.formatWithoutPos("error", e));
                logger.error(job, e);
            }

            this.runningNum--;
            queueInfo.curParallel--;

            if (job.status == JobStatus.Success) {
                queueInfo.success = (queueInfo.success || 0) + 1;
            }
            else {
                // 队列中每尝试失败一次，该队列尝试失败的次数就加1
                queueInfo.tryFail = (queueInfo.tryFail || 0) + 1;
            }

            if (job.status == JobStatus.RetryWaiting) {
                await this.addJobToQueue(job, null, job.queue, queueInfo.queue, null);
            }
            else {
                await appInfo.jobManager.save(job, true);
            }

            this.delayPushInfo();

            // 释放worker
            await workerFactory.release(worker);
        });
    }

}
