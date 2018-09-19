import {OnStart} from "../spider/decorators/OnStart";
import {PuppeteerWorkerFactory} from "../spider/worker/PuppeteerWorkerFactory";
import {AddToQueue} from "../spider/decorators/AddToQueue";
import {Page} from "puppeteer";
import {Job} from "../spider/job/Job";
import {AddToQueueData} from "../spider/data/Types";
import {FromQueue} from "../spider/decorators/FromQueue";
import {Launcher} from "../spider/decorators/Launcher";
import {PuppeteerUtil} from "../spider/util/PuppeteerUtil";
import {logger} from "../common/util/logger";
import {NoneWorkerFactory} from "../spider/worker/NoneWorkerFactory";
import {mainMessager, MainMessagerEvent, NoFilter, PromiseUtil} from "..";
import {RequestMapping} from "../spider/decorators/RequestMapping";
import {Request, Response} from "express";

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
        workerFactory: PuppeteerWorkerFactory,
        parallel: {
            "0/20 * * * * ?": 1,
            "10/20 * * * * ?": 2
        }
    })
    // @OnTime({
    //     urls: "http://www.baidu.com",
    //     cron: "*/30 * * * * ?",
    //     workerFactory: PuppeteerWorkerFactory
    // })
    @AddToQueue({
        name: "test"
    })
    async index(page: Page, job: Job): AddToQueueData {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url());
        return PuppeteerUtil.links(page, {
            "test": "http.*"
        });
    }

    @RequestMapping("/addJob/test")
    @AddToQueue({
        name: "test",
        filterType: NoFilter
    })
    async addJobTest(req: Request, res: Response, next: any): AddToQueueData {
        res.send({
            success: true
        });
        return req.query.url;
    }

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    async delayToStartPrintUrl(useless: any, job: Job) {
        await PromiseUtil.sleep(5000);
        logger.debug("toggle test queue to running");
        mainMessager.emit(MainMessagerEvent.QueueManager_QueueToggle_queueNameRegex_running, "test", true);
    }

    @FromQueue({
        name: "test",
        workerFactory: NoneWorkerFactory,
        running: false,
        parallel: 1,
        exeInterval: 1000
    })
    async printUrl(useless: any, job: Job) {
        logger.debug(job.url());
    }


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


    // @OnStart({
    //     urls: "http://www.baidu.com",
    //     workerFactory: PuppeteerWorkerFactory,
    //     parallel: 1,
    //     exeInterval: 10000
    // })
    // async index(page: Page, job: Job) {
    //     // await page.goto(job.url());
    //     // await PuppeteerUtil.addJquery(page);
    //     await page.evaluate(() => new Promise(resolve => {
    //         const test = () => {
    //             console.log($);
    //         };
    //         test();
    //         resolve(true);
    //     }));
    // }

    // @OnStart({
    //     urls: "http://www.baidu.com",
    //     workerFactory: PuppeteerWorkerFactory,
    //     parallel: 1,
    //     exeInterval: 10000
    // })
    // async index(page: Page, job: Job) {
    //     await PuppeteerUtil.setImgLoad(page, false);
    //     await page.goto("http://www.baidu.com");
    //     const lgImg = await PuppeteerUtil.specifyIdByJquery(page, "#lg img:eq(0)");
    //     const downloadImgRes = await PuppeteerUtil.downloadImg(page, "#" + lgImg[0], __dirname);
    //     console.log(downloadImgRes);
    // }

    // @OnStart({
    //     urls: "",
    //     workerFactory: NoneWorkerFactory,
    //     parallel: 1,
    //     exeInterval: 10000
    // })
    // async noneWorkerTest(worker: any, job: Job) {
    //     console.log("noneWorkerTest", worker, job);
    // }

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
