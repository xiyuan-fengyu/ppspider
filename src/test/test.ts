import {
    AddToQueue,
    DateUtil,
    FromQueue,
    Job,
    Launcher,
    logger,
    NoneWorkerFactory,
    OnStart,
    OnTime,
    PromiseUtil
} from "..";
import {DataUi} from "../spider/decorators/DataUi";

@DataUi({
    title: "DataUi测试",
    template: `
        <p>test data ui</p>
    `
})
class TestDataUi {

    ngOnInit() {
        console.log("test data ui: " + $("title").text());
    }

}

@DataUi({
    template: `
        <p>test data ui2</p>
    `
})
class TestDataUi2 {

    ngOnInit() {
        console.log("" + $("title").text());
    }

}

class TestTask {

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    @AddToQueue({
        name: "test"
    })
    async onStart(useless: any, job: Job) {
        const arr = [];
        for (let i = 0; i < 100; i++) {
            arr.push("job_" + i);
        }
        return arr;
    }

    @OnTime({
        urls: "",
        cron: "0/1 * * * *",
        workerFactory: NoneWorkerFactory
    })
    async onTime(useless: any, job: Job) {
        logger.debug(DateUtil.toStr(new Date()));
    }

    @FromQueue({
        name: "test",
        workerFactory: NoneWorkerFactory,
        parallel: {
            "0/10 * * * * *": 0,
            "5/10 * * * * *": 5
        },
        exeInterval: 1000
    })
    async test(useless: any, job: Job) {
        await PromiseUtil.sleep(5000);
        logger.debug(job.url());
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [

    ],
    webUiPort: 9000
})
class App {}
