import {Launcher, OnStart, Page, PuppeteerWorkerFactory, RequestMapping} from "../..";
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
        timeout: -1
    })
    async onStart(page: Page) {
        await page.goto("http://localhost:9000/longTimeToLoad");
        await page.evaluate(() => new Promise(resolve => {
            setTimeout(resolve, 1000000);
        }));
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
