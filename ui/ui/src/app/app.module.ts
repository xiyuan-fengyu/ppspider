import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {rootRouter} from "./rootRouter";
import {
  MAT_DIALOG_DEFAULT_OPTIONS, MatButtonModule,
  MatCardModule,
  MatDialogModule,
  MatFormFieldModule,
  MatGridListModule,
  MatIconModule,
  MatInputModule,
  MatListModule, MatProgressBarModule,
  MatTabsModule, MatTooltipModule
} from "@angular/material";
import {ShutdownConfirmDialog, SystemInfoComponent} from "./page/system-info/system-info.component";
import {SocketIOService} from "./service/socket-io.service";
import {JobInfoComponent} from './page/job-info/job-info.component';
import {CommonModule, HashLocationStrategy, LocationStrategy} from "@angular/common";
import {IconsComponent} from './page/icons/icons.component';
import {FormsModule} from "@angular/forms";
import {LongToDateStrPipe} from "./pipe/long-to-date-str.pipe";
import { JsonStringifyPipe } from './pipe/json-stringify.pipe';
import {ToasterModule, ToasterService} from "angular2-toaster";
import {EditConfigDialog, QueueInfoComponent} from "./page/queue-info/queue-info.component";
import {CommonService} from "./service/common.service";

@NgModule({
  declarations: [
    EditConfigDialog,
    ShutdownConfirmDialog,

    LongToDateStrPipe,
    AppComponent,
    SystemInfoComponent,
    QueueInfoComponent,
    JobInfoComponent,
    IconsComponent,
    JsonStringifyPipe,
  ],
  imports: [
    rootRouter,
    ToasterModule.forRoot(),
    CommonModule,
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatGridListModule,
    MatListModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  entryComponents: [
    EditConfigDialog,
    ShutdownConfirmDialog,
  ],
  providers: [
    SocketIOService,
    CommonService,
    {
      provide: LocationStrategy,
      useClass: HashLocationStrategy
    },
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {hasBackdrop: true}
    },
    ToasterService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
