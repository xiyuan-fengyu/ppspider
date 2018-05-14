import {OnStart} from "../spider/decorators/OnStart";
import {PuppeteerWorkerFactory} from "../spider/worker/PuppeteerWorkerFactory";
import {AddToQueue} from "../spider/decorators/AddToQueue";
import {Page} from "puppeteer";
import {Job} from "../spider/job/Job";
import {AddToQueueData} from "../spider/data/Types";
import {FromQueue} from "../spider/decorators/FromQueue";
import {Launcher} from "../spider/decorators/Launcher";

class TestTask {

    // @OnStart({
    //     urls: "http://www.baidu.com",
    //     workerFactory: PuppeteerWorkerFactory
    // })
    // async index(page: Page, job: Job) {
    //     await page.goto(job.url());
    //     const title = await page.title();
    //     console.log(title);
    // }



    // @OnTime({
    //     urls: "http://www.baidu.com",
    //     cron: "*/5 * * * * *",
    //     workerFactory: PuppeteerWorkerFactory
    // })
    // async index(page: Page, job: Job) {
    //     console.log(job.datas());
    // }



    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory
    })
    @AddToQueue({
        name: "test"
    })
    async index(page: Page, job: Job): AddToQueueData {
        await page.goto(job.url());
        return await page.$$eval("a", as => {
            const hrefs = [];
            as.forEach(a => {
                const href = (a as any).href;
                if (href.startsWith("http")) hrefs.push(href);
            });
            return hrefs;
        });
    }

    @FromQueue({
        name: "test",
        workerFactory: PuppeteerWorkerFactory
    })
    async printUrl(page: Page, job: Job) {
        console.log(job.url());
    }

}

@Launcher({
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