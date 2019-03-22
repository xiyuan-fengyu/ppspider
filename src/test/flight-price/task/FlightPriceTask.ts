import {
    AddToQueue,
    appInfo,
    DefaultJob,
    FromQueue,
    Job,
    NoneWorkerFactory,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory,
    Transient
} from "../../..";
import * as moment from "moment";
import 'moment/locale/zh-cn';
import {Page} from "puppeteer";
import {cookies} from "../cookie";
import {ResponseDao, ResponseModel} from "../nedb/ResponseDao";
import {FlightPriceDao, FlightPriceModel} from "../nedb/FlightPriceDao";
import {App} from "../App";

export class FlightPriceTask {

    @Transient()
    private careFlights = {
        "星期五": {
            "重庆->上海": ["19:00:00", "21:30:00"]
        },
        "星期日": {
            "上海->重庆": ["17:00:00", "20:30:00"]
        },
        "星期一": {
            "上海->重庆": ["08:00:00", "13:00:00"]
        }
    };

    // responseDao = new ResponseDao(appInfo.workplace + "/nedb");
    //
    // flightPriceDao = new FlightPriceDao(appInfo.workplace + "/nedb");

    @OnStart({
        urls: "https://www.fliggy.com/?spm=181.1108777.a1z68.1.NZCsUl&ttid=seo.000000574",
        workerFactory: PuppeteerWorkerFactory,
        description: "系统启动后设置Cookie"
    })
    async setCookie(page: Page, job: Job) {
        await page.setCookie(...cookies);
        await page.goto(job.url());
        appInfo.queueManager.setQueueRunning(".*", true);
    }

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory,
        running: false, // setCookie 完成后再运行
        description: "生成最近93天内抓取星期(5,7,1)的机票价格的任务",
    })
    @AddToQueue({
        name: "flight_price_search"
    })
    async recentJobs(useless: any, job: Job) {
        const res = [];
        // 从第二天开始计算
        const start = new Date().getTime();
        for (let i = 1; i < 93; i++) {
            const time = new Date(start + 3600000 * 24 * i);
            const week = moment(time).local().format("dddd");
            const careFlight = this.careFlights[week];
            if (careFlight) {
                const depDate = moment(time).format("YYYY-MM-DD");
                for (let depArr of Object.keys(careFlight)) {
                    const [depCityName, arrCityName] = depArr.trim().split("->");
                    // https://sjipiao.fliggy.com/flight_search_result.htm?_input_charset=utf-8&spm=181.7091613.a1z67.1001&searchBy=1280&tripType=0&depCityName=%E9%87%8D%E5%BA%86&depCity=&depDate=2019-03-29&arrCityName=%E4%B8%8A%E6%B5%B7&arrCity=&arrDate=&ttid=seo.000000574
                    const subJob = new DefaultJob(`https://sjipiao.fliggy.com/flight_search_result.htm?_input_charset=utf-8&spm=181.7091613.a1z67.1001&searchBy=1280&tripType=0&depCityName=${encodeURIComponent(depCityName)}&depCity=&depDate=${depDate}&arrCityName=${encodeURI(arrCityName)}&arrCity=&arrDate=&ttid=seo.000000574`);
                    subJob.datas({
                        depDate: depDate,
                        depCityName: depCityName,
                        arrCityName: arrCityName
                    });
                    res.push(subJob);
                }
            }
        }
        return res;
    }

    @FromQueue({
        name: "flight_price_search",
        workerFactory: PuppeteerWorkerFactory,
        description: "抓取机票价格",
        exeInterval: 99999999
    })
    async search(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        let searchRes;
        const waitSearchRes = PuppeteerUtil.onceResponse(page, "^https://sjipiao.fliggy.com/searchow/search.htm.*", async response => {
            searchRes = PuppeteerUtil.jsonp(await response.text());
        });
        page.goto(job.url()).catch(e => {});
        await waitSearchRes;

        // 存储接口数据
        // await App.responseDao.save(new ResponseModel(job.id(), searchRes));

        // 存储航班数据
        for (let flight of searchRes.data.flight) {
            // await App.flightPriceDao.save(new FlightPriceModel(job.id(), flight));
        }
    }

}


