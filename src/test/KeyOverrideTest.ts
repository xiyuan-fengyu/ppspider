import {DefaultJob} from "../spider/job/DefaultJob";
import {Job} from "../spider/job/Job";

const keyOverride = (job: Job) => job.url() + " new";

const job = new DefaultJob("test");
job.key = (key?: string) => keyOverride(job);

console.log((job as Job).key());