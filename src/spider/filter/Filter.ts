import {Job} from "../job/Job";

export interface Filter {

    setExisted(job: Job): void;

    isExisted(job: Job): boolean;

    clear(): void;

}