import { Component } from '@angular/core';

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
    // },
  ];

}
