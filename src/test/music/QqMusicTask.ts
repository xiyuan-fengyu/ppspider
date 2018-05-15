import {AddToQueue} from "../../spider/decorators/AddToQueue";
import {Page} from "puppeteer";
import {PuppeteerWorkerFactory} from "../../spider/worker/PuppeteerWorkerFactory";
import {Job} from "../../spider/job/Job";
import {OnStart} from "../../spider/decorators/OnStart";
import {AddToQueueData} from "../../spider/data/Types";
import {FromQueue} from "../../spider/decorators/FromQueue";

const queue_qq = {
    name: "qq"
};

const queue_qq_song = {
    name: "qq_song",
    keyOverride: job => (job.url().match("https://y.qq.com/n/yqq/song/(.*?)\\.html.*") || ["", ""])[1]
};

export class QqMusicTask {

    @OnStart({
        urls: "https://y.qq.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    @FromQueue({
        name: "qq",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1
    })
    @AddToQueue([
        queue_qq,
        queue_qq_song
    ])
    async index(page: Page, job: Job): AddToQueueData {
        await page.goto(job.url());
        return await page.$$eval("a", as => {
            const hrefs = {
                qq: [],
                qq_song: []
            };
            as.forEach(a => {
                const href = (a as any).href;
                if (href.startsWith("https://y.qq.com")) {
                    if (href.substr(16, 12) == "/n/yqq/song/") hrefs.qq_song.push(href);
                    else hrefs.qq.push(href);
                }
            });
            return hrefs;
        });
    }

    @FromQueue({
        name: "qq_song",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1
    })
    @AddToQueue([
        queue_qq,
        queue_qq_song
    ])
    async roaming(page: Page, job: Job): AddToQueueData {
        if (job.url().startsWith("https://y.qq.com/n/yqq/song/")) {
            console.log(job.key() + "    " + job.url());
        }

        await page.goto(job.url());
        const info = await page.$$eval("a", as => {
            const info: any = {};

            const hrefs = {
                qq: [],
                qq_song: []
            };
            as.forEach(a => {
                const href = (a as any).href;
                if (href.startsWith("https://y.qq.com")) {
                    if (href.substr(16, 12) == "/n/yqq/song/") hrefs.qq_song.push(href);
                    else hrefs.qq.push(href);
                }
            });
            info.hrefs = hrefs;

            return info;
        });
        return info.hrefs;
    }

}