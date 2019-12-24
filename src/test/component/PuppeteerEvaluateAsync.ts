import {
    AddToQueue,
    FromQueue,
    Job,
    Launcher,
    logger,
    OnStart,
    Page,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "../..";

class TestTask {

    @OnStart({urls: "https://music.163.com/", defaultDatas: {msg: "just test"}})
    @AddToQueue({name: "test"})
    async start(page: Page, job: Job) {
        logger.debug(job.datas.msg);
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

        return new Job({
            url: "sub",
            datas: {
                id: 1,
                msg: "just"
            }
        });
    }

    @FromQueue({name: "test", defaultDatas: {msg: "just test", proxy: "http://127.0.0.1"}})
    async test(job: Job) {
        logger.debug(job.datas);
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
