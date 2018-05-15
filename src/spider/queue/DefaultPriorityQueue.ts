import {AbsQueue} from "./AbsQueue";
import {Job} from "../job/Job";
import {PriorityQueue} from "../../common/util/PriorityQueue";

export class DefaultPriorityQueue extends AbsQueue{

    private readonly queue = new PriorityQueue<Job>((j1, j2) => j1.priority() - j2.priority());

    protected computePriority(job: Job) {

    }

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
        this.computePriority(job);
        this.queue.offer(job);
    }

    size(): number {
        return this.queue.size();
    }



}