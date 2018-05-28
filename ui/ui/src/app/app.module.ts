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
  MatListModule,
  MatTabsModule
} from "@angular/material";
import {SystemInfoComponent} from "./page/system-info/system-info.component";
import {SocketIOService} from "./service/socket-io.service";
import {JobInfoComponent} from './page/job-info/job-info.component';
import {CommonModule, HashLocationStrategy, LocationStrategy} from "@angular/common";
import {IconsComponent} from './page/icons/icons.component';
import {FormsModule} from "@angular/forms";
import {LongToDateStrPipe} from "./pipe/long-to-date-str.pipe";
import { JsonStringifyPipe } from './pipe/json-stringify.pipe';
import {ToasterModule, ToasterService} from "angular2-toaster";
import {EditConfigDialog, QueueInfoComponent} from "./page/task-info/queue-info.component";

@NgModule({
  declarations: [
    EditConfigDialog,

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
    CommonModule,
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ToasterModule.forRoot(),
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatGridListModule,
    MatListModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,

  ],
  entryComponents: [
    EditConfigDialog,
  ],
  providers: [
    SocketIOService,
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
