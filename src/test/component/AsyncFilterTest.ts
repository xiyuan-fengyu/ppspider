import {AddToQueue, appInfo, Filter, FromQueue, Job, Launcher, logger, NoneWorkerFactory, OnStart} from "../..";

class AsyncFilter implements Filter {

    clear(): any | Promise<any> {
        return appInfo.db.remove("asyncFilter", {});
    }

    isExisted(job: Job): boolean | Promise<boolean> {
        return appInfo.db.findById("asyncFilter", job.key || job.url).then(res => res != null);
    }

    setExisted(job: Job): any | Promise<any> {
        return appInfo.db.save("asyncFilter", {_id: job.key || job.url});
    }

}

class TestTask {

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    @AddToQueue({name: "test", filterType: AsyncFilter})
    async onStart(useless: any, job: Job) {
        return ["job_1", "job_2", "job_2", "job_1"];
    }

    @FromQueue({
        name: "test",
        workerFactory: NoneWorkerFactory
    })
    async test(useless: any, job: Job) {
        if (job.tryNum == 1) {
            throw new Error("trigger for retry");
        }
        else {
            logger.debug(job.url);
        }
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
    ]
})
class App {}
