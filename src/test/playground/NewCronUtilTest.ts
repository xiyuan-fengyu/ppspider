import {AddToQueue, FromQueue, Job, Launcher, logger, DbHelperUi, NoneWorkerFactory, OnTime} from "../..";

class TestTask {

    @OnTime({
        urls: "",
        cron: "* * * * * *"
    })
    @AddToQueue({
        name: "test"
    })
    async onTime() {
        return "" + new Date().getTime();
    }

    @FromQueue({
        name: "test",
        parallel: {
            "0-59/10 * * * * *": 0,
            "5-59/10 * * * * *": 5
        }
    })
    async test(job: Job) {
        logger.debug(job.url);
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    dataUis: [
        DbHelperUi,
    ],
    workerFactorys: [
    ],
    webUiPort: 9000,
    logger: {
        level: "debug"
    }
})
class App {}
