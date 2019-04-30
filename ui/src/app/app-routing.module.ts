import {NgModule} from '@angular/core';
import {RouteReuseStrategy, RouterModule, Routes} from '@angular/router';
import {QueueInfoComponent} from "./page/queue-info/queue-info.component";
import {JobInfoComponent} from "./page/job-info/job-info.component";
import {IconsComponent} from "./page/icons/icons.component";
import {DataUiComponent} from "./page/data-ui/data-ui.component";
import {CacheRouteReuseStrategy} from "./CacheRouteReuseStrategy";

const routes: Routes = [
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
    path: "dataUi/:className",
    component: DataUiComponent
  },
  {
    path: "**",
    redirectTo: "queueInfo",
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: [
    {
      provide: RouteReuseStrategy,
      useClass: CacheRouteReuseStrategy
    }
  ]
})
export class AppRoutingModule { }
