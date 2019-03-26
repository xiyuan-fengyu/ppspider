import {Autowired, Bean, DataUi, DataUiRequest} from "../../..";
import {AfterInit} from "../../../common/bean/Bean";
import {FlightPriceDao} from "../nedb/FlightPriceDao";

declare const G2: any;

@DataUi({
    label: "机票价格",
    style: `
#flightPriceChart {
    height: calc(100vh - 90px);
}    
    `,
    template:
    `
<div class="container-fluid" style="margin-top: 12px">
    <div class="row">
        <div class="col-sm-2">
            <p *ngIf="!depArrDates" class="form-control-static">
                loading ...
            </p>
            <form *ngIf="depArrDates">
                  <div class="form-group">
                        <label for="depArr">出发 -> 到达</label>
                        <select [(ngModel)]="depArrDate" (change)="checkForm(); depDate = null" id="depArr" name="depArr" class="form-control">
                            <option [ngValue]="null">--请选择--</option>
                            <option *ngFor="let item of depArrDates" [ngValue]="item">{{item[0]}}</option>
                        </select>
                  </div>
                  <div class="form-group">
                        <label for="depDate">出发日期</label>
                        <select [(ngModel)]="depDate" (change)="checkForm()" id="depDate" name="depDate" class="form-control">
                            <ng-container *ngIf="depArrDate">
                                <option [ngValue]="null">--请选择--</option>
                                <option *ngFor="let item of depArrDate[1]" [ngValue]="item">{{item}}</option>
                            </ng-container>
                        </select>
                  </div>
                  <div class="form-group">
                        <label>出发时间区间(HH:mm)</label>
                        <div class="row">
                            <div class="col-md-6">
                                <input [(ngModel)]="depTimeMin" (change)="checkForm()" pattern="(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]|60)" id="depTimeMin" name="depTimeMin" type="text" class="form-control">
                            </div>
                            <div class="col-md-6">
                                <input [(ngModel)]="depTimeMax" (change)="checkForm()" pattern="(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]|60)" id="depTimeMax" name="depTimeMax" type="text" class="form-control">
                            </div>
                        </div>
                  </div>
                  <button (click)="showFlightPrices()" [disabled]="isFormValid ? null : true" class="btn btn-primary">查询</button>
            </form>
        </div>
        <div class="col-sm-8">
            <div id="flightPriceChart"></div>
        </div>
    </div>
</div>
    `
})
export class FlightPriceUi {

    private flightPriceChart: any;

    private flightPriceChartData: any[];

    depArrDates: [string, string[]][];

    depArrDate: [string, string[]];

    depDate: string;

    depTimeMin: string = "19:00";

    depTimeMax: string = "21:00";

    isFormValid = false;

    ngOnInit() {
        this.getDepArrDates().then(res => {
            this.depArrDates = res;
        });
    }

    ngAfterViewInit() {
        this.flightPriceChart = new G2.Chart({
            container: 'flightPriceChart',
            forceFit: true,
            animate: false,
            height: $("#flightPriceChart").height()
        });
        this.flightPriceChart.source([], {
            time: {
                alias: '时间',
                type: 'time',
                mask: 'MM-DD HH:mm:ss',
                tickCount: 10,
                nice: false
            },
            price: {
                alias: '价格(元)',
                min: 0
            },
            flight: {
                type: 'cat'
            }
        });
        this.flightPriceChart.line().position('time*price').color('flight').size(2);
        this.flightPriceChart.render();
    }

    checkForm() {
        this.isFormValid = !!(this.depArrDate && this.depDate
            && this.depTimeMin && this.depTimeMin.match("(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])")
            && this.depTimeMax && this.depTimeMax.match("(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])"));
    }

    getDepArrDates() {
        return null;
    }

    getFlightPrices(depCityName: string, arrCityName: string, depTimeMin: string, depTimeMax: string) {
        return null;
    }

    showFlightPrices() {
        const [depCityName, arrCityName] = this.depArrDate[0].split(" -> ");
        const depTimeMin = this.depDate + " " + this.depTimeMin;
        const depTimeMax = this.depDate + " " + this.depTimeMax;
        this.getFlightPrices(depCityName, arrCityName, depTimeMin, depTimeMax).then(res => {
            this.flightPriceChartData = [];
            for (let item of res) {
                this.flightPriceChartData.push({
                    time: item.createTime,
                    price: item.data.cabin.bestPrice,
                    flight: item.data.flightNo
                });
            }
            this.flightPriceChart.changeData(this.flightPriceChartData);
        });
    }

}

@Bean()
export class FlightPriceHelper implements AfterInit {

    @Autowired(FlightPriceUi)
    private flightPriceUi: FlightPriceUi;

    @Autowired()
    flightPriceDao: FlightPriceDao;

    @DataUiRequest(FlightPriceUi.prototype.getDepArrDates)
    getDepArrDates() {
        return this.flightPriceDao.depArrDates();
    }

    @DataUiRequest(FlightPriceUi.prototype.getFlightPrices)
    getFlightPrices(depCityName: string, arrCityName: string, depTimeMin: string, depTimeMax: string) {
        return this.flightPriceDao.findList({
            "data.depCityName": depCityName,
            "data.arrCityName": arrCityName,
            "data.depTime": {
                "$gte": depTimeMin,
                "$lte": depTimeMax
            },
            "createTime": {
                "$gte": new Date().getTime() - 3600000 * 24 * 5
            }
        }, {
            "data.flightNo": 1,
            "data.cabin.bestPrice": 1,
            "data.depTime": 1,
            "createTime": 1
        });
    }

    afterInit() {

    }

}