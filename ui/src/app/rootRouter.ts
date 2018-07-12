import {RouterModule} from "@angular/router";
import {JobInfoComponent} from "./page/job-info/job-info.component";
import {IconsComponent} from "./page/icons/icons.component";
import {QueueInfoComponent} from "./page/queue-info/queue-info.component";

export const rootRouter = RouterModule.forRoot([
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
    pathMatch: "full",
    redirectTo: "queueInfo",
  }
]);
