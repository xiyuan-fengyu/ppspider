import {Injectable, OnDestroy} from '@angular/core';
import {SocketIOService} from "./socket-io.service";
import {Subscription} from "rxjs/internal/Subscription";
import {ObjectUtil} from "../util/ObjectUtil";

type DataUi = {
  title: string;
  template: string;
  className: string;
  class: string;
}

type DataUis = {[className: string]: DataUi}

@Injectable()
export class CommonService implements OnDestroy{

  private subscription: Subscription = new Subscription();

  public running = false;

  public queues: any = {};

  private dataUisResolve;

  public readonly dataUis = new Promise<DataUis>(resolve => this.dataUisResolve = resolve);

  constructor(
    private socketIOService: SocketIOService,
  ) {
    this.subscription.add(socketIOService.connectObserver().subscribe(data => {
      this.socketIOService.request({
        key: "getQueueInfo",
        data: null
      }, res => {
        ObjectUtil.copy(res.data, this.queues);
        this.running = true;
      });
    }));

    this.subscription.add(socketIOService.pushObserver("queues").subscribe(data => {
      ObjectUtil.copy(data, this.queues);
      this.running = true;
    }));
  }

  setDataUis(dataUis: DataUis) {
    this.dataUisResolve(dataUis);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}
