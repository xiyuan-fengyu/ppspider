import {AbsQueue} from "./AbsQueue";
import {Job} from "../job/Job";
import {Serialize} from "../../common/serialize/Serialize";

/**
 * 默认队列，FIFO，先进先出
 */
@Serialize()
export class DefaultQueue extends AbsQueue {

    private queue: Job[] = [];

    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    pop(): Job {
        return this.queue.shift();
    }

    peek(): Job {
        return this.queue.length == 0 ? null : this.queue[0];
    }

    push(job: Job) {
        this.queue.push(job);
    }

    size(): number {
        return this.queue.length;
    }

}