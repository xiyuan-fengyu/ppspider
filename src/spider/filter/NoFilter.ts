import {Filter} from "./Filter";
import {Job} from "../job/Job";

export class NoFilter implements Filter {

    clear(): void {
    }

    isExisted(job: Job): boolean {
        return false;
    }

    setExisted(job: Job): void {
    }

}