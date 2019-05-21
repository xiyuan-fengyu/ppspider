import {Job, JobStatus} from "../job/Job";
import {ObjectUtil} from "../../common/util/ObjectUtil";
import {DateUtil} from "../../common/util/DateUtil";
import {logger} from "../../common/util/logger";
import {appInfo, NedbDao, Pager, Sort} from "../..";

/**
 * 使用 nedb 保存 job，用于查询回顾 job 信息
 */
export class JobManager {

    constructor() {
        if (appInfo.db instanceof NedbDao) {
            // 每10分钟压缩一次数据
            appInfo.db.collection("job").then(nedb => nedb.persistence.setAutocompactionInterval(600000));
        }
        this.autoReleaseLoop();
    }

    private autoReleaseLoop() {
        const autoRelease = () => {
            appInfo.db.remove("job", {autoRelease: true, createTime: {"$lte": new Date().getTime() - 1000 * 120}},
                true).then(res => {
                setTimeout(autoRelease, 120000);
            });
        };
        autoRelease();
    }

    /**
     * 保存job，不存在则新增，已存在则更新
     * @param {Job} job
     * @param justUpdate
     */
    save(job: Job, skipInsert: boolean = false) {
        return appInfo.db.save("job", job, skipInsert);
    }

    job(_id: any): Promise<Job> {
        return appInfo.db.findById("job", _id).then(doc => {
            return new Job(doc);
        });
    }

    /**
     * 分页查询job
     * @param pager
     * @returns {Promise<any>}
     */
    jobs(pager: any): Promise<any> {
        return Promise.all([
            new Promise<any>(resolve => {
                if (pager.requires && pager.requires.queues) {
                    appInfo.db.findList("job", {}, {queue: 1}).then(docs => {
                        const queues: any = {};
                        docs.forEach(doc => queues[doc.queue] = 1);
                        resolve(Object.keys(queues));
                    });
                }
                else resolve();
            }),
            new Promise<Pager>(resolve => {
                if (pager.requires && pager.requires.jobs) {
                    const tempPager = new Pager();
                    tempPager.pageSize = pager.pageSize;
                    tempPager.pageIndex = pager.pageIndex;
                    tempPager.match = pager.match;
                    tempPager.sort = {
                        createTime: -1
                    } as Sort;
                    appInfo.db.page("job", tempPager).then(pagerRes => {
                        resolve(pagerRes);
                    });
                }
                else resolve();
            })
        ] as Promise<any>[]).then(results => {
            let status = null;
            if (pager.requires && pager.requires.status) {
                status = this.jobStatus();
            }

            const pagerRes = results[1] || {} as any;
            return {
                success: true,
                data: {
                    total: pagerRes.total,
                    pageIndex: pagerRes.pageIndex,
                    pageSize: pagerRes.pageSize,
                    jobs: pagerRes.list,
                    queues: results[0],
                    status: status
                }
            }
        }).catch(err => {
            logger.errorValid && logger.error(err);
            return {
              success: false,
                message: err.message
            };
        });
    }

    deleteJobs(pager: any): Promise<any> {
        pager.collection = "job";
        return new Promise<any>(resolve => {
            appInfo.db.remove(pager.match, true).then(res => {
                resolve({
                    success: true,
                    message: "delete " + res + " jobs"
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

    jobDetail(data: any): Promise<any> {
        return new Promise<any> (resolve => {
            appInfo.db.findById("job", data._id).then(doc => {
                resolve({
                    success: true,
                    data: doc ? this.transformToJob(doc) : {
                        error: "job not found"
                    }
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
     * 将时间戳转换为字符串，便于UI界面阅读
     * @param job
     * @returns {any}
     */
    private transformToJob(job: Job) {
        const jobForUi: any = {};
        Object.assign(jobForUi, job);
        jobForUi.status = (JobStatus[job.status] as any);
        // 仅前端获取父任务id 时会使用到，且前端获取这个字段的值后，会删除这个字段
        jobForUi["_parentId_justForParentFetch"] = job.parentId;
        return ObjectUtil.transform(jobForUi, value => {
            if (value.constructor == Number && ("" + value).length == 13) {
                return DateUtil.toStr(new Date(value));
            }
            else return value;
        });
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
