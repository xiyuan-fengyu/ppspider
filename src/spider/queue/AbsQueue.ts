import {Queue} from "./Queue";
import {Filter} from "../filter/Filter";
import {Job} from "../job/Job";
import {FilterClass} from "../data/Types";

export abstract class AbsQueue implements Queue {

    private readonly filters: {[filterType: string]: Filter} = {};

    addFilter(filter: Filter) {
       this.filters[filter.constructor.name] = filter;
    }

    getFilter(filterType: FilterClass): Filter {
        return this.filters[filterType.name]
    }

    abstract isEmpty(): boolean;

    abstract pop(): Job;

    abstract peek(): Job;

    abstract push(job: Job);

    abstract size(): number;

}