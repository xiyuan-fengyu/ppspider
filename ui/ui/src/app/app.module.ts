import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {rootRouter} from "./rootRouter";
import {
  MatCardModule, MatFormFieldControl,
  MatFormFieldModule,
  MatGridListModule,
  MatIconModule, MatInputModule,
  MatListModule,
  MatTabsModule
} from "@angular/material";
import {SystemInfoComponent} from "./page/system-info/system-info.component";
import {TaskInfoComponent} from "./page/task-info/task-info.component";
import {SocketIOService} from "./service/socket-io.service";
import { JobInfoComponent } from './page/job-info/job-info.component';
import {CommonModule, HashLocationStrategy, LocationStrategy} from "@angular/common";
import { IconsComponent } from './page/icons/icons.component';
import {FormsModule} from "@angular/forms";

@NgModule({
  declarations: [
    AppComponent,
    SystemInfoComponent,
    TaskInfoComponent,
    JobInfoComponent,
    IconsComponent
  ],
  imports: [
    rootRouter,
    CommonModule,
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    MatIconModule,
    MatTabsModule,
    MatGridListModule,
    MatListModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  providers: [
    SocketIOService,
    {
      provide: LocationStrategy,
      useClass: HashLocationStrategy
    },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
