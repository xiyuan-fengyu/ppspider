import {Job, Launcher, OnStart, PuppeteerWorkerFactory, RequestMapping} from "../..";
import {Page} from "puppeteer";
import {Request, Response} from "express";

class TestTask {

    @RequestMapping("/longTimeToLoad")
    async res(req: Request, res: Response) {
        setTimeout(() => {
            res.send("<h1>Hello</h1>");
        }, 25000);
    }

    @OnStart({
        urls: "",
        workerFactory: PuppeteerWorkerFactory,
        timeout: -1
    })
    async onStart(page: Page, job: Job) {
        await page.goto("http://localhost:9000/longTimeToLoad");
        await page.evaluate(() => new Promise(resolve => {
            setTimeout(resolve, 1000000);
        }));
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
