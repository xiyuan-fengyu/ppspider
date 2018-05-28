import {RouterModule} from "@angular/router";
import {SystemInfoComponent} from "./page/system-info/system-info.component";
import {JobInfoComponent} from "./page/job-info/job-info.component";
import {IconsComponent} from "./page/icons/icons.component";
import {QueueInfoComponent} from "./page/task-info/queue-info.component";

export const rootRouter = RouterModule.forRoot([
  {
    path: "systemInfo",
    component: SystemInfoComponent
  },
  {
    path: "queueInfo",
    component: QueueInfoComponent
  },
  {
    path: "jobInfo",
    component: JobInfoComponent
  },
  {
    path: "icons",
    component: IconsComponent
  },
  {
    path: "",
    component: SystemInfoComponent
  }
]);
