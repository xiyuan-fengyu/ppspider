import Nedb = require("nedb");
import {appInfo} from "../decorators/Launcher";
import {Job, JobStatus} from "../job/Job";
import {SerializableUtil} from "../../common/serialize/Serialize";
import {ObjectUtil} from "../../common/util/ObjectUtil";
import {DateUtil} from "../../common/util/DateUtil";

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

    private afterAction(actionNum: number = 1) {
        this.actionCount += actionNum;
        if (this.actionCount >= this.compactRateForSave) {
            this.compact();
            this.actionCount = 0;
        }
    }

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

    async jobs(pager: any): any {
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

            const count = await new Promise<number>(resolve1 => {
                this.jobsDb.count(query, (err, n) => {
                    resolve1(err || n);
                });
            });
            ifErrorResponse(count);

            const pageSize = pager.pageSize || 10;
            const pageIndex = Math.min(pager.pageIndex || 0, parseInt((count - 1) / 10));
            const jobs = await new Promise<any[]>(resolve1 => {
                this.jobsDb.find(query, {serialize: 0})
                    .sort({ createTime: -1 })
                    .skip(pageIndex * pageSize)
                    .limit(pageSize)
                    .exec( (err, docs) => {
                        resolve1(err || docs);
                    });
            });
            ifErrorResponse(jobs);

            let queues = null;
            if (pager.requires && pager.requires.queues) {
                queues = await new Promise<number>(resolve1 => {
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

    async deleteJobs(pager: any): any {
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

    async jobDetail(data: any): any {
        return new Promise<any>(async resolve => {
            this.jobsDb.findOne({_id: data._id}, ((err, doc) => {
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

    private transformToJob(obj: any) {
        const job = SerializableUtil.deserialize(obj) as Job;
        job.status(JobStatus[job.status()]);
        return ObjectUtil.transform(job, value => {
            if (value.constructor == Number && ("" + value).length == 13) {
                return DateUtil.toStr(new Date(value), "yyyy-MM-dd HH:mm:ss");
            }
            else return value;
        });
    }

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