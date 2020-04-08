import {Job, Launcher, logger, OnStart, Page, PromiseUtil, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";
import {Response} from "puppeteer";

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
        const res: Response = await PuppeteerUtil.triggerAndWaitResponse(page,
            () => PuppeteerUtil.dragJigsaw(page,
                "div.geetest_slider_button",
                "canvas.geetest_canvas_slice",
                "canvas.geetest_canvas_bg",
                dis => dis + 1
            ),
            url => url.startsWith("https://api.geetest.com/ajax.php?"), 1000);
        if (res) {
            const resJson = PuppeteerUtil.jsonp(await res.text());
            if (resJson.success) {
                logger.debug("验证码通过");
            }
            else {
                logger.debug("验证码失败");
            }
        }
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
