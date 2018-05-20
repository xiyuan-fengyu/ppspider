import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {rootRouter} from "./rootRouter";
import {MatTabsModule} from "@angular/material";
import {SystemInfoComponent} from "./page/system-info/system-info.component";
import {TaskInfoComponent} from "./page/task-info/task-info.component";
import {SocketIOService} from "./service/socket-io.service";
import { JobInfoComponent } from './page/job-info/job-info.component';
import {HashLocationStrategy, LocationStrategy} from "@angular/common";

@NgModule({
  declarations: [
    AppComponent,
    SystemInfoComponent,
    TaskInfoComponent,
    JobInfoComponent
  ],
  imports: [
    rootRouter,
    BrowserModule,
    BrowserAnimationsModule,
    MatTabsModule,
  ],
  providers: [
    SocketIOService,
    {
      provide: LocationStrategy,
      useClass: HashLocationStrategy
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
