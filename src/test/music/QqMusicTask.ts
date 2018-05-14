import {AddToQueue} from "../../spider/decorators/AddToQueue";
import {Page} from "puppeteer";
import {PuppeteerWorkerFactory} from "../../spider/worker/PuppeteerWorkerFactory";
import {Job} from "../../spider/job/Job";
import {OnStart} from "../../spider/decorators/OnStart";
import {AddToQueueData} from "../../spider/data/Types";
import {FromQueue} from "../../spider/decorators/FromQueue";

export class QqMusicTask {

    @OnStart({
        urls: "https://y.qq.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    @AddToQueue({
        name: "qq"
    })
    async index(page: Page, job: Job): AddToQueueData {
        await page.goto(job.url());
        return await page.$$eval("a", as => {
            const hrefs = [];
            as.forEach(a => {
                const href = (a as any).href;
                if (href.startsWith("https://y.qq.com")) hrefs.push(href);
            });
            return hrefs;
        });
    }

    @FromQueue({
        name: "qq",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 2
    })
    @AddToQueue({
        name: "qq"
    })
    async roaming(page: Page, job: Job): AddToQueueData {
        if (job.url().startsWith("https://y.qq.com/n/yqq/song/")) {
            console.log(job.url());
        }
        await page.goto(job.url());
        return await page.$$eval("a", as => {
            const hrefs = [];
            as.forEach(a => {
                const href = (a as any).href;
                if (href.startsWith("https://y.qq.com")) hrefs.push(href);
            });
            return hrefs;
        });
    }

}