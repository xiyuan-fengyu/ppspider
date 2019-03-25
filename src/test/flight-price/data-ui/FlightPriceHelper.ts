import {Autowired, Bean, DataUi, DataUiRequest, getBean} from "../../..";
import {AfterInit} from "../../../common/bean/Bean";
import {FlightNoDao} from "../nedb/FlightNoDao";
import {FlightPriceDao} from "../nedb/FlightPriceDao";

declare const G2: any;

@DataUi({
    label: "机票价格",
    style: ``,
    template: `
<div class="container-fluid" style="margin-top: 12px">
    <div class="row">
        <div class="col-sm-3">
            <form>
                  <div class="form-group">
                        <label for="selectedFlights">Flight</label>
                        <select [(ngModel)]="selectedFlights" id="selectedFlights" name="selectedFlights" multiple="multiple" class="form-control">
                            <option *ngFor="let item of flights" [ngValue]="item">{{item}}</option>
                        </select>
                  </div>
                  <div class="form-group">
                        <label for="date">Dep Date</label>
                        <input [(ngModel)]="date" id="date" name="date" type="date" class="form-control">
                  </div>
                  <button (click)="showFlightPrices()" [disabled]="selectedFlights && selectedFlights.length && date ? null : true" class="btn btn-primary">Submit</button>
            </form>
        </div>
        <div class="col-sm-9">
            <div id="flightPriceChart"></div>
        </div>
    </div>
</div>
    `
})
export class FlightPriceUi {

    selectedFlights: string[] = [];

    date: string;

    flights: string[] = [];

    private flightPriceChart: any;

    private flightPriceChartData: any;

    ngOnInit() {
        this.getFlightNos().then(res => {
            this.updateFlightNos(res);
        });
    }

    ngAfterViewInit() {
        this.flightPriceChart = new G2.Chart({
            container: 'flightPriceChart',
            forceFit: true,
            animate: false
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

    getFlightNos(): Promise<any> {
        return null;
    }

    getFlightPrices(flightNos: string[], date: string): Promise<any> {
        return null;
    }

    updateFlightNos(flightNos: any) {
        this.flights = Object.keys(flightNos);
        this.selectedFlights = [];
    }

    showFlightPrices() {
        if (this.selectedFlights && this.selectedFlights.length && this.date) {
            this.getFlightPrices(this.selectedFlights, this.date).then(res => {
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

}

@Bean()
export class FlightPriceHelper implements AfterInit {

    @Autowired()
    flightNoDao: FlightNoDao;

    @Autowired()
    flightPriceDao: FlightPriceDao;

    flightNos: any = {};

    @DataUiRequest(FlightPriceUi.prototype.getFlightNos)
    getFlightNos() {
        return this.flightNos;
    }

    addFlightNo(flightNo: string) {
        if (!this.flightNos[flightNo]) {
            this.flightNos[flightNo] = true;
            getBean(FlightPriceUi).updateFlightNos(this.flightNos);
        }
    }

    @DataUiRequest(FlightPriceUi.prototype.getFlightPrices)
    getFlightPrices(selectedFlights: string[], date: string) {
        return this.flightPriceDao.findList({
            "data.flightNo": {
                "$in": selectedFlights
            },
            "data.depTime": {
                "$regex": "^" + date + ".*"
            },
            "createTime": {
                "$gte": new Date().getTime() - 3600000 * 24 * 5
            }
        }, {
            "data.flightNo": 1,
            "data.cabin.bestPrice": 1,
            "createTime": 1
        });
    }

    afterInit() {
        this.flightNoDao.findList({}, {_id: 1}).then(res => {
            res.forEach(item => this.flightNos[item._id] = true);
            getBean(FlightPriceUi).updateFlightNos(this.flightNos);
        });
    }

}