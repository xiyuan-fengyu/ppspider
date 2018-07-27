import {Filter} from "./Filter";
import {Job} from "../job/Job";
import {Serialize} from "../../common/serialize/Serialize";

/**
 * 不做存在性检测，全部添加到队列
 */
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