import {Job} from "../job/Job";
import {Filter} from "../filter/Filter";
import {Class_Filter} from "../Types";

/**
 * 队列接口
 */
export interface Queue {

    /**
     * 添加任务
     * @param {Job} job
     */
    push(job: Job);

    /**
     * 获取队列头部的任务，不会出队列
     * @returns {Job}
     */
    peek(): Job;

    /**
     * 将头部的任务出队列
     * @returns {Job}
     */
    pop(): Job;

    /**
     * 获取当前队列的任务数
     * @returns {number}
     */
    size(): number;

    /**
     * 队列是否为空
     * @returns {boolean}
     */
    isEmpty(): boolean;

    /**
     * 获取某种类型的 Filter 实例
     * @param {Class_Filter} filterType
     * @returns {Filter}
     */
    getFilter(filterType: Class_Filter): Filter;

    /**
     * 获取该队列的所有 Filter
     * @returns {Filter[]}
     */
    getFilters(): Filter[];

    /**
     * 添加一个 Filter 实例
     * @param {Filter} filter
     */
    addFilter(filter: Filter);

}