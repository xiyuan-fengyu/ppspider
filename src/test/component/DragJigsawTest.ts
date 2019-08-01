import {Job, Launcher, OnStart, Page, PromiseUtil, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";

class TestTask {

    @OnStart({
        urls: "https://passport.bilibili.com/login",
        timeout: -1
    })
    async onStart(page: Page, job: Job) {
        await page.goto(job.url);
        await page.type("#login-username", "12345", {delay: 50});
        await page.type("#login-passwd", "qwert", {delay: 50});
        await PuppeteerUtil.triggerAndWaitResponse(page, () => page.tap("a.btn.btn-login"),
                url => url == "https://static.geetest.com/static/ant/sprite.1.2.3.png");
        await PromiseUtil.sleep(1000);
        await PuppeteerUtil.dragJigsaw(page, "div.geetest_holder.geetest_mobile.geetest_ant.geetest_embed",
            [25, 188, 46, 206], [12, 12, 260, 160]);
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
