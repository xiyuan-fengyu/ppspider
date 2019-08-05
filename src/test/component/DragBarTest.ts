import {Job, Launcher, OnStart, Page, PromiseUtil, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";

class TestTask {

    @OnStart({
        urls: "https://login.taobao.com/member/login.jhtml",
        timeout: -1
    })
    async onStart(page: Page, job: Job) {
        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);
        await page.tap("#J_Quick2Static");
        await page.type("#TPL_username_1", "12345", {delay: 50});
        await page.type("#TPL_password_1", "qwert", {delay: 50});
        await PuppeteerUtil.dragBar(page, "#nc_1_n1z", "#nc_1_wrapper");
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
            headless: false
        })
    ]
})
class App {}
