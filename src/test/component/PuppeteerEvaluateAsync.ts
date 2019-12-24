import {Job, Launcher, OnStart, Page, PuppeteerUtil, PuppeteerWorkerFactory} from "../..";

class TestTask {

    @OnStart({urls: "https://music.163.com/"})
    async test(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await page.goto(job.url);

        const mainBodyLen = await page.evaluate(async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return document.body.innerHTML.length;
        });
        console.log(mainBodyLen);

        const frame = page.frames()[1];
        const iframeBodyLen = await frame.evaluate(async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return document.body.innerHTML.length;
        });
        console.log(iframeBodyLen);
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
    webUiPort: 9000
})
class App {}
