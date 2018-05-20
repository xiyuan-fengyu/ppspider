import {RouterModule} from "@angular/router";
import {TaskInfoComponent} from "./page/task-info/task-info.component";
import {SystemInfoComponent} from "./page/system-info/system-info.component";
import {JobInfoComponent} from "./page/job-info/job-info.component";
import {IconsComponent} from "./page/icons/icons.component";

export const rootRouter = RouterModule.forRoot([
  {
    path: "systemInfo",
    component: SystemInfoComponent
  },
  {
    path: "taskInfo",
    component: TaskInfoComponent
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
