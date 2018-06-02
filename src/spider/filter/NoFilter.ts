import {Filter} from "./Filter";
import {Job} from "../job/Job";
import {Serialize} from "../../common/serialize/Serialize";

@Serialize()
export class NoFilter implements Filter {

    clear(): void {
    }

    isExisted(job: Job): boolean {
        return false;
    }

    setExisted(job: Job): void {
    }

}