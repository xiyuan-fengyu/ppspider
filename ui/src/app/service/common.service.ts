import {Compiler, Injectable, Injector, NgModuleRef, OnDestroy} from '@angular/core';
import {SocketIOService} from "./socket-io.service";
import {Subscription} from "rxjs/internal/Subscription";
import {ObjectUtil} from "../util/ObjectUtil";

@Injectable()
export class CommonService implements OnDestroy{

  private subscription: Subscription = new Subscription();

  public running = false;

  public queues: any = {};

  constructor(
    private compiler: Compiler,
    private injector: Injector,
    private module: NgModuleRef<any>,
    private socketIOService: SocketIOService,
  ) {
    this.socketIOService.request({
      key: "getQueueInfo",
      data: null
    }, res => {
      ObjectUtil.copy(res.data, this.queues);
      this.running = true;
    });

    this.subscription.add(socketIOService.pushObserver("queues").subscribe(data => {
      ObjectUtil.copy(data, this.queues);
      this.running = true;
    }));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}
