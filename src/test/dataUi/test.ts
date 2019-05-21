import {
    AddToQueue, appInfo,
    DataUi,
    DataUiRequest,
    DateUtil,
    FromQueue,
    getBean,
    Job,
    Launcher,
    logger, DbHelperUi,
    NoneWorkerFactory,
    OnStart,
    OnTime,
    PromiseUtil, RequestMapping
} from "../..";
import {Request, Response} from "express";
import * as fs from "fs";

@DataUi({
    label: "DataUi测试",
    template: `
<div class="container" style="margin-top: 12px">
    <p>{{requestResMessage}}</p>
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>#</th>
          <th>datetime</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let data of datas;let i = index">
          <th scope="row">{{i + 1}}</th>
          <td>{{data}}</td>
        </tr>
      </tbody>
    </table>
</div>
    `
})
class TestDataUi {

    requestResMessage: string;

    datas: string[] = [];

    ngOnInit() {
        this.request(123, "Tom").then(res => {
            this.requestResMessage = res.message;
        });
    }

    request(...args): Promise<any> {
        // just a stub
        return null;
    }

    onData(data: any) {
        this.datas.splice(0, 0, data);
        if (this.datas.length > 10) {
            this.datas.splice(10, this.datas.length);
        }
    }

}

declare const G2: any;

@DataUi({
    label: "动态折线图",
    template: `
<div class="container">
    <div id="chart"></div>
</div>
    `
})
class TestDataUi2 {

    private chart: any;

    ngAfterViewInit() {
        this.chart = new G2.Chart({
            container: 'chart',
            forceFit: true,
            animate: false
        });
        this.chart.source([], {
            time: {
                alias: '时间',
                type: 'time',
                mask: 'HH:mm:ss',
                tickCount: 10,
                nice: false
            },
            temperature: {
                alias: '平均温度(°C)',
                min: 10,
                max: 35
            },
            type: {
                type: 'cat'
            }
        });
        this.chart.line().position('time*temperature').color('type', ['#ff6627', '#2196ff']).size(2);
        this.chart.render();
    }

    onData(data) {
        this.chart.changeData(data);
    }

}

class TestTask {

    private temperatureDatas = [];

    @DataUiRequest(TestDataUi.prototype.request)
    onRequest(id: number, name: string) {
        return {
            success: true,
            message: "Hello, " + name + " ! Your id is " + id + " ."
        };
    }

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    @AddToQueue({
        name: "test"
    })
    async onStart(useless: any, job: Job) {
        const arr = [];
        for (let i = 0; i < 10; i++) {
            arr.push("job_" + i);
        }
        return arr;
    }

    @OnTime({
        urls: "",
        cron: "* * * * * *",
        workerFactory: NoneWorkerFactory
    })
    async onTime(useless: any, job: Job) {
        logger.debug(DateUtil.toStr(new Date()));
        getBean(TestDataUi).onData(DateUtil.toStr());

        while (this.temperatureDatas.length >= 200) {
            this.temperatureDatas.shift();
            this.temperatureDatas.shift();
        }
        this.temperatureDatas.push({
            time: new Date().getTime(),
            temperature: ~~(Math.random() * 5) + 22,
            type: '记录1'
        });
        this.temperatureDatas.push({
            time: new Date().getTime(),
            temperature: ~~(Math.random() * 7) + 17,
            type: '记录2'
        });
        getBean(TestDataUi2).onData(this.temperatureDatas);
    }

    @FromQueue({
        name: "test",
        workerFactory: NoneWorkerFactory,
        parallel: {
            "0-59/10 * * * * *": 0,
            "5-59/10 * * * * *": 5
        }
    })
    async test(useless: any, job: Job) {
        await PromiseUtil.sleep(10000);
        logger.debug(job.url);
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    dataUis: [
        DbHelperUi,
        TestDataUi,
        TestDataUi2
    ],
    workerFactorys: [
    ],
    webUiPort: 9000,
    logger: {
        level: "debug"
    }
})
class App {}
