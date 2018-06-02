import {AfterContentInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {SocketIOService} from "../../service/socket-io.service";
import {Subscription} from "rxjs/internal/Subscription";
import {ObjectUtil} from "../../util/ObjectUtil";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material";
import {PromiseUtil} from "../../util/PromiseUtil";
import {ToasterService} from "angular2-toaster";
import {CommonService} from "../../service/common.service";

declare const CodeMirror: any;

@Component({
  selector: 'app-queue-info',
  templateUrl: './queue-info.component.html',
  styleUrls: ['./queue-info.component.css']
})
export class QueueInfoComponent implements OnInit {

  info: any;

  constructor(
    private socketIOService: SocketIOService,
    private commonService: CommonService,
    public dialog: MatDialog,
    private toasterService: ToasterService
  ) {
  }

  ngOnInit() {
    this.info = this.commonService.info;
  }

  stringify(obj) {
    if (obj == null) return "";
    else if (typeof obj == "object") return JSON.stringify(obj);
    else return obj;
  }

  openEditConfig(queue: any, field: string, oldValue: number) {
    const dialogRef = this.dialog.open(EditConfigDialog, {
      width: "400px",
      data: {
        field: field,
        value: oldValue
      }
    });
    dialogRef.afterClosed().subscribe(res => {
      if (res && res.value != null) {
        this.socketIOService.request({
          key: "updateQueueConfig",
          data: {
            queue: queue.name,
            field: field,
            value: res.value
          }
        }, res => {
          this.toasterService.pop(res.success ? "success" : "warning", "Message", res.message);
        });
      }
    });
  }

}

@Component({
  selector: 'dialog-edit-maxParallelConfig',
  templateUrl: './dialog-edit-maxParallelConfig.html',
  styleUrls: ['./queue-info.component.css']
})
export class EditConfigDialog implements OnInit, AfterContentInit {

  result: any = {};

  valueInput: any;

  constructor(
    public dialogRef: MatDialogRef<EditConfigDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
    if (this.data.value.constructor == Object) {
      try {
        this.data.valueFormat = JSON.stringify(this.data.value, null, 4);
      }
      catch (e) {
      }
    }
  }

  ngAfterContentInit(): void {
    PromiseUtil.waitFor(() => document.getElementById("valueInput") != null).then(res => {
      if (res) {
        this.valueInput = CodeMirror.fromTextArea(document.getElementById("valueInput"), {
          matchBrackets: true,
          autoCloseBrackets: true,
          mode: "application/ld+json",
          lineWrapping: true,
          lineNumbers: true,
          lineHeight: "20px"
        });
        this.valueInput.on('change', (cm, change) => {
          const value = cm.getValue();
          if (value.match('^\\d+$')) {
            this.result.value = parseInt(value);
          }
          else {
            try {
              this.result.value = JSON.parse(value);
            }
            catch (e) {
              this.result.value = value;
            }
          }
        });
      }
    });
  }

}
