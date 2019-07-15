import {Job, Launcher, OnStart, Page, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";

class TestTask {

    @OnStart({
        urls: [
            "https://www.google.com",
            "https://www.baidu.com",
            "https://www.bilibili.com",
        ]
    })
    async onStart(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await PuppeteerUtil.useProxy(page, "http://127.0.0.1:2007");
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
            headless: false,
            devtools: true
        })
    ],
    webUiPort: 9001
})
class App {}
