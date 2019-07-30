import {AddToQueue, FromQueue, Job, Launcher, OnStart, Page, logger} from "../..";

class TestTask {

    @OnStart({urls: ""})
    @AddToQueue({name: "user_\\d+"})
    async onStart0(job: Job) {
        const subJobs = {} as any;
        for (let i = 0; i < 5; i++) {
            subJobs["user_" + i] = "regex " + i;
        }
        return subJobs;
    }

    @OnStart({urls: ""})
    @AddToQueue({name: "user_5"})
    async onStart1(job: Job) {
        return "normal 5";
    }

    @OnStart({urls: ""})
    @AddToQueue({name: "user_6"})
    async onStart2(job: Job) {
        return "normal 6";
    }

    @FromQueue({name: "user_\\d+"})
    async fromRegexQueue(job: Job) {
        logger.debug(job.queue + " " + job.url);
    }

    @FromQueue({name: "user_5"})
    async fromNormalQueue(job: Job) {
        logger.debug(job.queue + " " + job.url);
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: []
})
class App {}
