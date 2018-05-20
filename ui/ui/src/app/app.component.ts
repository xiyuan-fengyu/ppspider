import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  tabs = [
    {
      path: "systemInfo",
      label: "System"
    },
    {
      path: "taskInfo",
      label: "Task"
    },
    {
      path: "jobInfo",
      label: "Job"
    },
    {
      path: "icons",
      label: "Icons"
    },
  ];

}
