import {Job, JobStatus} from "../job/Job";
import {SerializableUtil} from "../../common/serialize/Serializable";
import {NedbDao, NedbModel, Pager, Sort} from "../../common/nedb/NedbDao";
import {appInfo} from "../decorators/Launcher";
import {ObjectUtil} from "../../common/util/ObjectUtil";
import {DateUtil} from "../../common/util/DateUtil";
import {logger} from "../../common/util/logger";

class JobWrapper extends NedbModel {

    parentId: string;

    queue: string;

    url: string;

    depth: number;

    tryNum: number;

    status: JobStatus;

    serialize: any;

    autoRelease: boolean;

    constructor(job: Job) {
        super(job.id());
        this.parentId = job.parentId();
        this.queue = job.queue();
        this.url = job.url();
        this.depth = job.depth();
        this.createTime = job.createTime();
        this.tryNum = job.tryNum();
        this.status = job.status();
        this.serialize = SerializableUtil.serialize(job);
        this.updateTime = new Date().getTime();
        if (job.status() == JobStatus.Filtered) {
            this.autoRelease = true;
        }
    }

}

class JobDao extends NedbDao<JobWrapper> {

}

/**
 * 使用 nedb 保存 job，用于查询回顾 job 信息
 */
export class JobManager {

    private jobDao: JobDao;

    init() {
        this.jobDao = new JobDao(appInfo.workplace + "/nedb");
        return this.jobDao.waitNedbReady().then(res => this.autoReleaseLoop());
    }

    /**
     * 周期性删除数据库中状态为 Filtered，创建时间在 10 分钟以前的job记录
     */
    private autoReleaseLoop() {
        const autoRelease = () => {
            this.jobDao.remove({autoRelease: true, createTime: {"$lte": new Date().getTime() - 1000 * 120}},
                true).then(res => {
                    setTimeout(autoRelease, 600000);
            });
        };
        autoRelease();
    }

    /**
     * 保存job，不存在则新增，已存在则更新
     * @param {Job} job
     */
    save(job: Job) {
        const jobWrapper = new JobWrapper(job);
        return this.jobDao.save(jobWrapper);
    }

    job(_id: any): Promise<any> {
        return this.jobDao.findById(_id);
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
                    this.jobDao.findList({}, {queue: 1}).then(docs => {
                        const queues: any = {};
                        docs.forEach(doc => queues[doc.queue] = 1);
                        resolve(Object.keys(queues));
                    });
                }
                else resolve();
            }),
            new Promise<Pager<JobWrapper>>(resolve => {
                if (pager.requires && pager.requires.jobs) {
                    const tempPager = new Pager<JobWrapper>();
                    tempPager.pageSize = pager.pageSize;
                    tempPager.pageIndex = pager.pageIndex;
                    tempPager.match = pager.match;
                    tempPager.projection = {
                        serialize: 0
                    };
                    tempPager.sort = {
                        createTime: -1
                    } as Sort;
                    this.jobDao.page(tempPager).then(pagerRes => {
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
        return new Promise<any>(resolve => {
            this.jobDao.remove(pager.match, true).then(res => {
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
            this.jobDao.findById(data._id).then(doc => {
                resolve({
                    success: true,
                    data: doc ? this.transformToJob(doc.serialize) : {
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
