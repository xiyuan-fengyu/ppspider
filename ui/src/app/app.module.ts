import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {CommonModule, HashLocationStrategy, LocationStrategy} from "@angular/common";
import {EditConfigDialog, QueueInfoComponent, ShutdownConfirmDialog} from "./page/queue-info/queue-info.component";
import {ConfirmDialog} from "./widget/confirm-dialog/confirm.dialog";
import {JobDetailDialog, JobInfoComponent} from "./page/job-info/job-info.component";
import {LongToDateStrPipe} from "./pipe/long-to-date-str.pipe";
import {IconsComponent} from "./page/icons/icons.component";
import {JsonStringifyPipe} from "./pipe/json-stringify.pipe";
import {ToasterModule, ToasterService} from "angular2-toaster";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {FormsModule} from "@angular/forms";
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DIALOG_DEFAULT_OPTIONS,
  MatButtonModule,
  MatCardModule,
  MatDatepickerModule,
  MatDialogModule,
  MatFormFieldModule,
  MatGridListModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatNativeDateModule,
  MatPaginatorModule,
  MatProgressBarModule,
  MatSelectModule,
  MatTableModule,
  MatTabsModule,
  MatTooltipModule
} from "@angular/material";
import {SocketIOService} from "./service/socket-io.service";
import {CommonService} from "./service/common.service";
import {MY_DATE_FORMATS, MyDateAdapter} from "./date.format";
import {DataUiComponent} from './page/data-ui/data-ui.component';

import { COMPILER_OPTIONS, CompilerFactory, Compiler } from '@angular/core';
import { JitCompilerFactory } from '@angular/platform-browser-dynamic';
import {DynamicService} from "./service/dynamic.service";

export function createCompiler(fn: CompilerFactory): Compiler {
  return fn.createCompiler();
}

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
    DataUiComponent,
  ],
  imports: [
    ToasterModule.forRoot(),
    AppRoutingModule,
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
    DynamicService,

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

    // 动态编译，支持发布后 ui/src/app/page/data-ui 的正常运行
    // 必须设置 angular.json aot=false buildOptimizer=false，正式发布才能正常运行
    {
      provide: COMPILER_OPTIONS,
      useValue: {},
      multi: true
    },
    {
      provide: CompilerFactory,
      useClass: JitCompilerFactory,
      deps: [COMPILER_OPTIONS]
    },
    {
      provide: Compiler,
      useFactory: createCompiler,
      deps: [CompilerFactory]
    },

    ToasterService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
