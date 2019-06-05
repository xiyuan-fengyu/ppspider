import {Job} from "../job/Job";

/**
 * 过滤器，在往队列中添加任务时，检测任务是否存在
 * 一个队列可以有多种过滤器，每种过滤器只有一个实例
 */
export interface Filter {

    setExisted(job: Job): any | Promise<any>;

    isExisted(job: Job): boolean | Promise<boolean>;

    clear(): any | Promise<any>;

}