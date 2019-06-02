import {Job, Launcher, OnStart, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";
import {Page} from "puppeteer";

class TestTask {

    @OnStart({
        urls: [
            "https://www.google.com",
            "https://www.baidu.com",
            "https://www.bilibili.com",
        ],
        workerFactory: PuppeteerWorkerFactory
    })
    async onStart(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.useProxy(page, "http://127.0.0.1:2007");
        await page.goto(job.url);
        console.log(await page.evaluate(() => document.title));
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class App {}
