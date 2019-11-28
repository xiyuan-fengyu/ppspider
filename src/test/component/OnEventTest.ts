import {AddToQueue, Events, FromQueue, Job, Launcher, OnEvent, OnStart} from "../..";

class TestTask {

    @OnStart({urls: ""})
    @AddToQueue({name: "sub"})
    async rootJob() {
        return ["job0", "job1", "job2"];
    }

    @FromQueue({name: "sub"})
    async subJob(job: Job) {
        console.log("execute: " + job.url);
    }

    @OnEvent(Events.QueueManager_JobExecuted)
    async onQueueInfoChanged(event: any) {
        if (event.job.queue == "sub"
            && event.queues.sub.running == 0
            && event.queues.sub.remain == 0) {
            console.log("all jobs finished");
        }
    }

}

@Launcher({
    workplace: "workplace_onEvent",
    tasks: [
        TestTask
    ],
    workerFactorys: [
    ],
    webUiPort: 9001
})
class App {}
