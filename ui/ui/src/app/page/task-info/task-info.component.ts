import {Component, OnDestroy, OnInit} from '@angular/core';
import {SocketIOService} from "../../service/socket-io.service";
import {Subscription} from "rxjs/internal/Subscription";

@Component({
  selector: 'app-task-info',
  templateUrl: './task-info.component.html',
  styleUrls: ['./task-info.component.css']
})
export class TaskInfoComponent implements OnInit, OnDestroy {

  private subscription: Subscription = new Subscription();

  private info: any = {};

  constructor(
    private socketIOService: SocketIOService
  ) {
    this.subscription.add(socketIOService.pushObserver("info").subscribe(data => {
      this.info = data;
    }));
    // this.socketIOService.request({
    //   key: "test",
    //   data: "123"
    // }, res => {
    //   console.log(res);
    // });
  }

  ngOnInit() {
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}
