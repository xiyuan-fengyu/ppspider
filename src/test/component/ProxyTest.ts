import {Job, Launcher, OnStart, Page, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";

class TestTask {

    @OnStart({
        urls: [
            "https://www.google.com",
            "https://www.baidu.com",
            "https://www.bilibili.com",
        ],
        parallel: 3,
        exeInterval: 1000,
        timeout: 60000
    })
    async onStart(page: Page, job: Job) {
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);
        await PuppeteerUtil.setImgLoad(page, false);
        // await PuppeteerUtil.useProxy(page, "http://127.0.0.1:2007");
        await PuppeteerUtil.useProxy(page, "socks://148.72.22.255:24060");
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
