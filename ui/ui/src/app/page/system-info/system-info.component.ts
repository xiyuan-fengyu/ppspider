import {AfterContentInit, Component, Inject, OnInit} from '@angular/core';
import {SocketIOService} from "../../service/socket-io.service";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material";
import {ToasterService} from "angular2-toaster";
import {CommonService} from "../../service/common.service";

@Component({
  selector: 'app-system-info',
  templateUrl: './system-info.component.html',
  styleUrls: ['./system-info.component.css']
})
export class SystemInfoComponent implements OnInit {

  info: any;

  constructor(
    private socketIOService: SocketIOService,
    private commonService: CommonService,
    private toasterService: ToasterService,
    public dialog: MatDialog,
  ) {
  }

  ngOnInit() {
    this.info = this.commonService.info;
  }

  resetQueueManagerPause(value: boolean) {
    this.socketIOService.request({
      key: "resetQueueManagerPause",
      data: value
    }, res => {
      this.toasterService.pop("success", "Message", value ? "Pause successfully" : "Resume successfully");
    });
  }

  showShutdownConfirm() {
    this.dialog.open(ShutdownConfirmDialog, {
      width: "500px",
      data: {}
    }).afterClosed().subscribe(res => {
      if (res != null) this.info.running = false;
    });
  }

}

@Component({
  selector: 'dialog-shutdownCconfirm',
  templateUrl: './dialog-shutdownCconfirm.html',
  styleUrls: ['./system-info.component.css']
})
export class ShutdownConfirmDialog implements OnInit {

  shutdownProgressValue = -1;

  private shutdownSuccess = false;

  constructor(
    public dialogRef: MatDialogRef<ShutdownConfirmDialog>,
    private socketIOService: SocketIOService,
    private toasterService: ToasterService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
  }

  shutdown(saveState: boolean) {
    this.showShutdownProgress();
    this.socketIOService.request({
      key: "stopSystem",
      data: {
        saveState: saveState
      }
    }, res => {
      this.shutdownSuccess = true;
      this.toasterService.pop("success", "Message", "Shutdown successfully");
    });
  }

  private showShutdownProgress() {
    const interval = 100;
    const waitDdelta = 60 * interval / 30000.0;
    let successDelta = 0;
    const update = () => {
      if (this.shutdownSuccess) {
        if (successDelta == 0) successDelta = (100 - this.shutdownProgressValue) * interval / 750.0;
        this.shutdownProgressValue += successDelta;
      }
      else if (this.shutdownProgressValue < 60) {
        this.shutdownProgressValue += waitDdelta;
      }
      if (this.shutdownProgressValue < 100) {
        setTimeout(update, interval);
      }
      else {
        this.dialogRef.close(true);
      }
    };
    update();
  }

}
