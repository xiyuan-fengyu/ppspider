import {Job, Launcher, OnStart, Page, PromiseUtil, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";

class TestTask {

    @OnStart({
        urls: "https://www.adidas.com.cn/member/login?locale=zh_CN",
        timeout: -1
    })
    async onStart(page: Page, job: Job) {
        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);
        await page.type("#loginMobile", "18912345678", {delay: 50});
        await page.type("#smsCode", "123456", {delay: 50});
        await PromiseUtil.sleep(1000);
        await page.hover("div.form-input-mobile-number div.yidun_slider");
        await PromiseUtil.sleep(500);
        await PuppeteerUtil.dragJigsaw(page,
            "div.form-input-mobile-number div.yidun_control",
            [2, 0, 40, 40], [0, -204, 382, -16], [255, 255, 255], dis => dis + 13);
        await PromiseUtil.sleep(1000000000);
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
    ]
})
class App {}
