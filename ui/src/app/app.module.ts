import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {rootRouter} from "./rootRouter";
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MAT_DIALOG_DEFAULT_OPTIONS,
  MatButtonModule,
  MatCardModule, MatDatepickerModule,
  MatDialogModule,
  MatFormFieldModule,
  MatGridListModule,
  MatIconModule,
  MatInputModule,
  MatListModule, MatNativeDateModule,
  MatPaginatorModule,
  MatProgressBarModule,
  MatSelectModule, MatSuffix,
  MatTableModule,
  MatTabsModule,
  MatTooltipModule
} from "@angular/material";
import {SocketIOService} from "./service/socket-io.service";
import {JobDetailDialog, JobInfoComponent} from './page/job-info/job-info.component';
import {CommonModule, HashLocationStrategy, LocationStrategy} from "@angular/common";
import {IconsComponent} from './page/icons/icons.component';
import {FormsModule} from "@angular/forms";
import {LongToDateStrPipe} from "./pipe/long-to-date-str.pipe";
import {JsonStringifyPipe} from './pipe/json-stringify.pipe';
import {ToasterModule, ToasterService} from "angular2-toaster";
import {EditConfigDialog, QueueInfoComponent, ShutdownConfirmDialog} from "./page/queue-info/queue-info.component";
import {CommonService} from "./service/common.service";
import {MY_DATE_FORMATS, MyDateAdapter} from "./date.format";
import {ConfirmDialog} from "./widget/confirm-dialog/confirm.dialog";

@NgModule({
  declarations: [
    EditConfigDialog,
    ShutdownConfirmDialog,
    ConfirmDialog,
    JobDetailDialog,

    LongToDateStrPipe,
    AppComponent,
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
    MatSelectModule,
    MatNativeDateModule,
    MatDatepickerModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatTableModule,
    MatPaginatorModule,
  ],
  entryComponents: [
    EditConfigDialog,
    ShutdownConfirmDialog,
    ConfirmDialog,
    JobDetailDialog,
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

    {provide: DateAdapter, useClass: MyDateAdapter},
    {provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS},

    ToasterService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
