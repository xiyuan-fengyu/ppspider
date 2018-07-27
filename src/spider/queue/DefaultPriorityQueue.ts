import {AbsQueue} from "./AbsQueue";
import {Job} from "../job/Job";
import {PriorityQueue} from "../../common/util/PriorityQueue";
import {Serialize} from "../../common/serialize/Serialize";

/**
 * 优先级队列，priority越小越排在前面
 * 设置 job.priority 的时机：
 * 1. 创建job的时候
 * 2. JobOverride 回调函数中通过算法统一设置
 */
@Serialize()
export class DefaultPriorityQueue extends AbsQueue{

    private readonly queue = new PriorityQueue<Job>((j1, j2) => j1.priority() - j2.priority());

    isEmpty(): boolean {
        return this.queue.isEmpty();
    }

    pop(): Job {
        return this.queue.poll();
    }

    peek(): Job {
        return this.queue.peek();
    }

    push(job: Job) {
        this.queue.offer(job);
    }

    size(): number {
        return this.queue.size();
    }

}