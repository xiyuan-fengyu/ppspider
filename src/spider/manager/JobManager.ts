import Nedb = require("nedb");
import {appInfo} from "../decorators/Launcher";
import {Job, JobStatus} from "../job/Job";
import {SerializableUtil} from "../../common/serialize/Serialize";
import {ObjectUtil} from "../../common/util/ObjectUtil";
import {DateUtil} from "../../common/util/DateUtil";

/**
 * 使用 nedb 保存 job，用于查询回顾 job 信息
 */
export class JobManager {

    private jobsDb: Nedb;

    private compacting: boolean;

    private searching: boolean;

    private saveQueue: {[id: string]: Job} = {};

    private actionCount = 0;

    private compactRateForSave = 10000;

    init() {
        this.jobsDb = new Nedb({
            filename: appInfo.workplace + "/db/jobs.db",
            autoload: true,
            onload: error => {
                if (error) {
                    throw new Error("jobs db load fial");
                }
                else {
                    this.compact();
                    this.autoReleaseLoop();
                }
            }
        });
    }

    /**
     * 周期性删除需要自动清理的job信息，目前只有状态为 JobStatus.Filtered 的job 有这个标记
     * 状态为 JobStatus.Filtered 的job 在nedb中最少会保留 10分钟，之后再一次清理行为执行后，就无法查询到了
     */
    private autoReleaseLoop() {
        const autoRelease = () => {
            let next = 60000;
            if (this.compacting || this.searching) {
                next = 1000;
            }
            else {
                this.jobsDb.remove({autoRelease: true, createTime: {"$lte": new Date().getTime() - 1000 * 120}}, { multi: true }, ((err, n) => {
                    if (!err) this.afterAction(n);
                }));
            }
            setTimeout(autoRelease, next);
        };
        autoRelease();
    }

    /**
     * 对 nedb 的数据进行压缩整理，这个源于nedb的数据存储方式
     * 数据更新都是 append 操作，删除是增加一个 delete记录，更新数据是增加一个 update记录，这些记录都会添加到持久化文件末尾
     * compat之后，会将最新的数据记录保存到持久化文件中，delete/update记录就不会存在了，从而达到压缩体积的目的
     * 系统启动时否认会压缩一次数据
     */
    private compact() {
        this.compacting = true;
        this.jobsDb.persistence.compactDatafile();
        this.compacting = false;

        const temp = this.saveQueue;
        this.saveQueue = {};
        for (let id of Object.keys(temp)) {
            this.save(temp[id]);
            delete temp[id];
        }
    }

    /**
     * 记录更新操作的次数，达到一定次数，执行compact操作
     * @param {number} actionNum
     */
    private afterAction(actionNum: number = 1) {
        this.actionCount += actionNum;
        if (this.actionCount >= this.compactRateForSave) {
            this.compact();
            this.actionCount = 0;
        }
    }

    /**
     * 保存job，不存在则新增，已存在则更新
     * @param {Job} job
     */
    save(job: Job) {
        if (this.jobsDb && !this.compacting) {
            const doc = {
                _id: job.id(),
                parentId: job.parentId(),
                queue: job.queue(),
                url: job.url(),
                depth: job.depth(),
                createTime: job.createTime(),
                tryNum: job.tryNum(),
                status: job.status(),
                serialize: SerializableUtil.serialize(job)
            };
            if (job.status() == JobStatus.Filtered) doc["autoRelease"] = true;

            this.jobsDb.insert(doc, err => {
                if (err) {
                    this.jobsDb.update({_id: doc._id}, doc, {}, err1 => {
                        this.afterAction();
                    });
                }
                else this.afterAction();
            });
        }
        else {
            this.saveQueue[job.id()] = job;
        }
    }

    /**
     * 分页查询job
     * @param pager
     * @returns {Promise<any>}
     */
    jobs(pager: any): Promise<any> {
        this.searching = true;
        return new Promise<any>(async resolve => {
            const query = this.castRegexInMatch(pager.match || {});

            const ifErrorResponse = (err: Error | any) => {
                if (err && err.constructor == Error) {
                    resolve({
                        success: false,
                        message: err.message
                    });
                }
            };

            let queues = null;
            if (pager.requires && pager.requires.queues) {
                queues = await new Promise<any>(resolve1 => {
                    this.jobsDb.find({}, {queue: 1}, ((err, documents) => {
                        if (err) resolve1(err);
                        else {
                            const queues: any = {};
                            documents.forEach(doc => queues[doc.queue] = 1);
                            resolve1(Object.keys(queues));
                        }
                    }));
                });
            }
            ifErrorResponse(queues);

            let status = null;
            if (pager.requires && pager.requires.status) {
                status = this.jobStatus();
            }


            let count = 0;
            let pageSize = 10;
            let pageIndex = 0;
            let jobs = null;
            if (pager.requires && pager.requires.jobs) {
                count = await new Promise<any>(resolve1 => {
                    this.jobsDb.count(query, (err, n) => {
                        resolve1(err || n);
                    });
                });
                ifErrorResponse(count);

                pageSize = pager.pageSize || 10;
                pageIndex = Math.min(pager.pageIndex || 0, parseInt("" + (count - 1) / 10));
                jobs = await new Promise<any>(resolve1 => {
                    this.jobsDb.find(query, {serialize: 0})
                        .sort({ createTime: -1 })
                        .skip(pageIndex * pageSize)
                        .limit(pageSize)
                        .exec( (err, docs) => {
                            resolve1(err || docs);
                        });
                });
                ifErrorResponse(jobs);
            }

            resolve({
                success: true,
                data: {
                    total: count,
                    pageIndex: pageIndex,
                    pageSize: pageSize,
                    jobs: jobs,
                    queues: queues,
                    status: status
                }
            });
        }).then(res => {
            this.searching = false;
            return res;
        });
    }

    deleteJobs(pager: any): Promise<any> {
        return new Promise<any>(async resolve => {
            const query = this.castRegexInMatch(pager.match || {});
            this.jobsDb.remove(query, { multi: true }, ((err, n) => {
                if (err) {
                     resolve({
                         success: false,
                         message: err.message
                     });
                }
                else {
                    resolve({
                        success: true,
                        message: "delete " + n + " jobs"
                    });
                    this.afterAction(n);
                }
            }));
        });
    }

    jobDetail(data: any): Promise<any> {
        return new Promise<any>(async resolve => {
            this.jobsDb.findOne({_id: data._id}, ((err, doc: any) => {
                if (err) {
                    resolve({
                        success: false,
                        message: err.message
                    });
                }
                else resolve({
                    success: true,
                    data: doc ? this.transformToJob(doc.serialize) : {
                        error: "job not found"
                    }
                });
            }));
        });
    }

    /**
     * 将时间戳转换为字符串，便于UI界面阅读
     * @param obj
     * @returns {any}
     */
    private transformToJob(obj: any) {
        const job = SerializableUtil.deserialize(obj) as Job;
        job.status(JobStatus[job.status()] as any);
        // 仅前端获取父任务id 时会使用到，且前端获取这个字段的值后，会删除这个字段
        job["_parentId_justForParentFetch"] = job.parentId();
        return ObjectUtil.transform(job, value => {
            if (value.constructor == Number && ("" + value).length == 13) {
                return DateUtil.toStr(new Date(value), "yyyy-MM-dd HH:mm:ss");
            }
            else return value;
        });
    }

    /**
     * 将查询语句中的regex string转换为Regex对象实例，因为nedb的$regex操作只接受 Regex对象实例
     * @param query
     * @returns {any}
     */
    private castRegexInMatch(query: any) {
        if (query == null) return query;
        if (query instanceof Array) {
            for (let i = 0, len = query.length; i < len; i++) {
                query[i] = this.castRegexInMatch(query[i]);
            }
        }
        else if (typeof query == "object") {
            for (let key of Object.keys(query)) {
                if (key == "$regex") {
                    query[key] = new RegExp(query[key]);
                }
                else query[key] = this.castRegexInMatch(query[key]);
            }
        }
        return query;
    }

    /**
     * 将 job 的status由 数字转换为字符串，便于UI界面阅读
     * @returns {any[]}
     */
    private jobStatus(): any[] {
        return Object.keys(JobStatus).map(key => {
            const v = JobStatus[key];
            return v.constructor == Number ? {
                key: key,
                value: v
            } : null
        }).filter(item => item != null)
    }

}

export const jobManager = new JobManager();