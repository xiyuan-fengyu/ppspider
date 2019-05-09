import {AddToQueue, FromQueue, Job, Launcher, logger, NedbHelperUi, NoneWorkerFactory, OnTime} from "../..";

class TestTask {

    @OnTime({
        urls: "",
        cron: "* * * * * *",
        workerFactory: NoneWorkerFactory
    })
    @AddToQueue({
        name: "test"
    })
    async onTime(useless: any, job: Job) {
        return "" + new Date().getTime();
    }

    @FromQueue({
        name: "test",
        workerFactory: NoneWorkerFactory,
        parallel: {
            "0-59/10 * * * * *": 0,
            "5-59/10 * * * * *": 5
        }
    })
    async test(useless: any, job: Job) {
        logger.debug(job.url());
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    dataUis: [
        NedbHelperUi,
    ],
    workerFactorys: [
    ],
    webUiPort: 9000,
    logger: {
        level: "debug"
    }
})
class App {}
