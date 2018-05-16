import {AddToQueue} from "../../spider/decorators/AddToQueue";
import {Page} from "puppeteer";
import {PuppeteerWorkerFactory} from "../../spider/worker/PuppeteerWorkerFactory";
import {Job} from "../../spider/job/Job";
import {OnStart} from "../../spider/decorators/OnStart";
import {AddToQueueData} from "../../spider/data/Types";
import {FromQueue} from "../../spider/decorators/FromQueue";
import {JobOverride} from "../../spider/decorators/JobOverride";

const queue_qq = {
    name: "qq"
};

const queue_qq_song = {
    name: "qq_song"
};

export class QqMusicTask {

    @JobOverride("qq_song")
    qqSongJobOverride(job: Job) {
        const match = job.url().match("https://y.qq.com/n/yqq/song/(.*?)\\.html.*");
        if (match) job.key(match[1]);
    }

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
        console.log(job.key() + "    " + job.url());

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