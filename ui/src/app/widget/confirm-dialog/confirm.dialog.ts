import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material";
import {Component, Inject, OnInit} from "@angular/core";

export type ConfirmDialogData = {
  title: string;
  message: string;
  confirm: string;
  cancle: string;
}

@Component({
  selector: 'confirm-dialog',
  templateUrl: './confirm.dialog.html',
  styleUrls: ['./confirm.dialog.css']
})
export class ConfirmDialog implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialog>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  ngOnInit() {
  }

}
