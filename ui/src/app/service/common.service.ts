import {Injectable, OnDestroy} from '@angular/core';
import {SocketIOService} from "./socket-io.service";
import {Subscription} from "rxjs/internal/Subscription";
import {ObjectUtil} from "../util/ObjectUtil";

@Injectable()
export class CommonService implements OnDestroy{

  private subscription: Subscription = new Subscription();

  public info: any;

  constructor(
    private socketIOService: SocketIOService,
  ) {
    this.info = {};
    this.subscription.add(socketIOService.pushObserver("info").subscribe(data => {
      ObjectUtil.copy(data, this.info);
    }));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}
