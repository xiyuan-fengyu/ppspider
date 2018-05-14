import {Job} from "../job/Job";
import {Filter} from "../filter/Filter";
import {FilterClass} from "../data/Types";

export interface Queue {

    push(job: Job);

    peek(): Job;

    pop(): Job;

    size(): number;

    isEmpty(): boolean;

    getFilter(filterType: FilterClass): Filter;

    addFilter(filter: Filter);

}