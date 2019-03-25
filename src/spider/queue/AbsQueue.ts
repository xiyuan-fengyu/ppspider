import {Queue} from "./Queue";
import {Filter} from "../filter/Filter";
import {Job} from "../job/Job";
import {Class_Filter} from "../Types";

/**
 * Queue的抽象实现类，实现了 Filter 相关的逻辑
 */
export abstract class AbsQueue implements Queue {

    private readonly filters: {[filterType: string]: Filter} = {};

    addFilter(filter: Filter) {
       this.filters[filter.constructor.name] = filter;
    }

    getFilter(filterType: Class_Filter): Filter {
        return this.filters[filterType.name];
    }

    getFilters(): Filter[] {
        const filters = [];
        for (let key of Object.keys(this.filters)) {
            filters.push(this.filters[key]);
        }
        return filters;
    }

    abstract isEmpty(): boolean;

    abstract pop(): Job;

    abstract peek(): Job;

    abstract push(job: Job);

    abstract size(): number;

}