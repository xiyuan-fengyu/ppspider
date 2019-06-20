import {AddToQueue, Job, Launcher, OnStart, Page, PuppeteerWorkerFactory} from "../..";

class TestTask {

    @OnStart({
        urls: "https://www.baidu.com/"
    })
    @AddToQueue({
        name: "test"
    })
    async index(job: Job, page: Page) {
        console.log(job.url);
        await page.goto(job.url);
        console.log(await page.evaluate(() => document.title));
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: true,
            devtools: false
        })
    ]
})
class App {}
