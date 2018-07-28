import {OnStart} from "../spider/decorators/OnStart";
import {PuppeteerWorkerFactory} from "../spider/worker/PuppeteerWorkerFactory";
import {AddToQueue} from "../spider/decorators/AddToQueue";
import {Page} from "puppeteer";
import {Job} from "../spider/job/Job";
import {AddToQueueData} from "../spider/data/Types";
import {FromQueue} from "../spider/decorators/FromQueue";
import {Launcher} from "../spider/decorators/Launcher";
import {PuppeteerUtil} from "../spider/util/PuppeteerUtil";
import {OnTime} from "../spider/decorators/OnTime";
import {logger} from "../common/util/logger";

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



    // @OnStart({
    //     urls: "http://www.baidu.com",
    //     workerFactory: PuppeteerWorkerFactory,
    //     parallel: {
    //         "0/20 * * * * ?": 1,
    //         "10/20 * * * * ?": 2
    //     }
    // })
    // // @OnTime({
    // //     urls: "http://www.baidu.com",
    // //     cron: "*/30 * * * * ?",
    // //     workerFactory: PuppeteerWorkerFactory
    // // })
    // @AddToQueue({
    //     name: "test"
    // })
    // async index(page: Page, job: Job): AddToQueueData {
    //     await page.goto(job.url());
    //     return PuppeteerUtil.links(page, {
    //         "test": "http.*"
    //     });
    // }
    //
    // @FromQueue({
    //     name: "test",
    //     workerFactory: PuppeteerWorkerFactory,
    //     parallel: 1,
    //     exeInterval: 100000
    // })
    // async printUrl(page: Page, job: Job) {
    //     logger.debug(job.url());
    // }


    // @OnStart({
    //     urls: "http://www.baidu.com",
    //     workerFactory: PuppeteerWorkerFactory,
    //     parallel: 1
    // })
    // async index(page: Page, job: Job) {
    //     await new Promise<any>(resolve => {
    //         setTimeout(() => resolve(true), 30000);
    //     });
    //     console.log(job.url());
    // }


    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1,
        exeInterval: 10000
    })
    async index(page: Page, job: Job) {
        // await page.goto(job.url());
        await page.evaluate(() => {
            const $ = 123;
        });

        // await page.evaluate(() => {
        //     console.log($);
        // });

        await page.evaluate(() => new Promise(resolve => {
            const test = () => {
                console.log($);
            };
            test();
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
    ],
    logger: {
        level: "debug"
    }
})
class App {}
