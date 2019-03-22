import {Component} from '@angular/core';
import {SocketIOService} from "./service/socket-io.service";
import {DataUis, DynamicService} from "./service/dynamic.service";

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
    private dynamicService: DynamicService
  ) {
    this.dynamicService.dataUis.then((dataUris: DataUis) => {
      for (let className of Object.keys(dataUris)) {
        const dataUi = dataUris[className];
        this.tabs.push({
          path: "dataUi/" + dataUi.className,
          label: dataUi.label
        });
      }
    });
  }

}
