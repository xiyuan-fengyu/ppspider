import {Job, Launcher, NetworkTracing, OnStart, Page, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";

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
        const networkTracing = new NetworkTracing(page);
        await page.goto(job.url);
        const title = await page.evaluate(() => document.title);
        const requestNum = networkTracing.requests().requests.length;
        console.log(title + "    requestNum=" + requestNum);
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
