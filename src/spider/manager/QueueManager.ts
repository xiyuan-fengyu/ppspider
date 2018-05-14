import {
    AddToQueueInfo,
    AddToQueueInfos, FromQueueConfig,
    JobConfig,
    OnStartConfig, OnTimeConfig,
    Queues,
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

export class QueueManager {

    private readonly queues: Queues = {};

    private dispatchQueueIndex = 0;

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

        // 设置 curMaxParallel
        if (config.parallel) {
            const parallelType = config.parallel.constructor;
            if (parallelType == Number) {
                // 静态设置
                queueInfo.curMaxParallel = config.parallel as number;
            }
            else if (parallelType == Object) {
                // 根据cron动态更新
                for (let cron in Object.keys(config.parallel)) {
                    const para = config.parallel[cron];
                    if (typeof para == "number") {
                        CronUtil.setInterval(cron, () => {
                            queueInfo.curMaxParallel = para as number;
                        });
                    }
                }
            }
        }
        if (!queueInfo.curMaxParallel) {
            queueInfo.curMaxParallel = Defaults.maxParallel;
        }

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
                if (jobs.constructor == String || instanceofJob(jobs)) {
                    QueueManager.addJobToQueue(jobs, parent, queueName, queue, filter, jobInfo.other);
                }
                else if (jobs.constructor == Array) {
                    for (let job of jobs) {
                        QueueManager.addJobToQueue(job, parent, queueName, queue, filter, jobInfo.other);
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

    private static addJobToQueue(jobOrUrl: any, parent: Job, queueName: string, queue: Queue, filter: Filter, other?: any) {
        const job = instanceofJob(jobOrUrl) ? jobOrUrl as Job : new DefaultJob(jobOrUrl);

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

        if (!filter || !filter.isExisted(job)) {
            if (filter) filter.setExisted(job);
            queue.push(job);
            job.status(JobStatus.Waiting);
        }
        else {
            job.status(JobStatus.Filtered);
        }
    }

    dispatch(workerFactoryMap: WorkerFactoryMap) {
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
                            try {
                                job.status(JobStatus.Running);
                                job.tryNum(job.tryNum() + 1);
                                await method.call(target, worker, job);
                                job.status(JobStatus.Success);
                            }
                            catch (e) {
                                if (job.tryNum() >= Defaults.maxTry) {
                                    job.status(JobStatus.Fail);
                                }
                                else {
                                    job.status(JobStatus.Retry);
                                }
                                console.log(e.message);
                            }
                            return worker;
                        }).then(async worker => {
                            queue.curParallel--;
                            if (job.status() == JobStatus.Retry) {
                                QueueManager.addJobToQueue(job, null, job.queue(), this.queues[job.queue()].queue, null);
                            }
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
