import {
    AddToQueue,
    appInfo,
    Events,
    FromQueue,
    Job,
    Launcher,
    OnEvent,
    OnStart,
    Page, PromiseUtil,
    PuppeteerWorkerFactory
} from "../..";

class TestTask {

    @OnStart({urls: "https://www.baidu.com"})
    async start(job: Job, page: Page) {
        await page.goto(job.url);
    }

    @OnEvent(Events.QueueManager_JobExecuted)
    async testEvent(info: {
        job: Job,
        worker: Page,
        queues: any
    }) {
        await info.worker.screenshot({
            path: appInfo.workplace + "/test.jpg",
            type: "jpeg",
            quality: 95,
            encoding: "binary"
        });
    }

}

@Launcher({
    workplace: "workplace_onEvent",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false
        })
    ],
    webUiPort: 9001
})
class App {}
