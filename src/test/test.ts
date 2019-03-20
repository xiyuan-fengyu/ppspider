import {
    AddToQueue, DataUiRequest,
    DateUtil,
    FromQueue,
    Job,
    Launcher,
    logger,
    NoneWorkerFactory,
    OnStart,
    OnTime,
    PromiseUtil
} from "..";
import {DataUi} from "..";
import {getInstance} from "../spider/decorators/Launcher";

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

    private data = [];

    private chart: any;

    ngAfterViewInit() {
        this.chart = new G2.Chart({
            container: 'chart',
            forceFit: true
        });
        this.chart.source(this.data, {
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
        this.chart.line().position('time*temperature').color('type', ['#ff6627', '#2196ff']).shape('smooth').size(2);
        this.chart.render();
    }

    onData(recode1, recode2) {
        if (this.data.length >= 200) {
            this.data.shift();
            this.data.shift();
        }
        this.data.push(recode1);
        this.data.push(recode2);
        this.chart.changeData(this.data);
    }

}

class TestTask {

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
        for (let i = 0; i < 100; i++) {
            arr.push("job_" + i);
        }
        return arr;
    }

    @OnTime({
        urls: "",
        cron: "0/1 * * * *",
        workerFactory: NoneWorkerFactory
    })
    async onTime(useless: any, job: Job) {
        logger.debug(DateUtil.toStr(new Date()));
        getInstance(TestDataUi).onData(DateUtil.toStr());
        getInstance(TestDataUi2).onData({
            time: new Date().getTime(),
            temperature: ~~(Math.random() * 5) + 22,
            type: '记录1'
        }, {
            time: new Date().getTime(),
            temperature: ~~(Math.random() * 7) + 17,
            type: '记录2'
        });
    }

    @FromQueue({
        name: "test",
        workerFactory: NoneWorkerFactory,
        parallel: {
            "0/10 * * * * *": 0,
            "5/10 * * * * *": 5
        },
        exeInterval: 1000
    })
    async test(useless: any, job: Job) {
        await PromiseUtil.sleep(5000);
        logger.debug(job.url());
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [

    ],
    webUiPort: 9000
})
class App {}
