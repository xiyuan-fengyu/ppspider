import {Component, OnDestroy} from '@angular/core';
import {SocketIOService} from "./service/socket-io.service";
import {CommonService} from "./service/common.service";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  tabs = [
    {
      path: "queueInfo",
      label: "Queue"
    },
    {
      path: "jobInfo",
      label: "Job"
    },
    // {
    //   path: "icons",
    //   label: "Icons"
    // }
  ];

  constructor(
    private socketIOService: SocketIOService,
    private commonService: CommonService,
  ) {
    this.socketIOService.request({
      key: "dataUis",
      data: null
    }, res => {
      const dataUis = {};
      for (let dataUi of res) {
        this.tabs.push({
          path: "dataUi/" + dataUi.className,
          label: dataUi.label
        });
        dataUis[dataUi.className] = dataUi;
      }
      this.commonService.setDataUis(dataUis);
    });
  }

}
