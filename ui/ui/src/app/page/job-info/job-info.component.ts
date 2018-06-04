import {Component, Inject, OnInit} from '@angular/core';
import {CommonService} from "../../service/common.service";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatTableDataSource} from "@angular/material";
import {ToasterService} from "angular2-toaster";
import {SocketIOService} from "../../service/socket-io.service";
import {ConfirmDialog, ConfirmDialogData} from "../../widget/confirm-dialog/confirm.dialog";
import {ObjectUtil} from "../../util/ObjectUtil";
import {DateUtil} from "../../util/DateUtil";

declare const $: any;

type Job = {
  _id: string;
  parentId: string;
  queue: string;
  url: string;
  depth: number;
  createTime: number;
  status: string;
}

type SearchCondition = {
  field?: any;
  operator?: any;
  value?: any;
}


type Pager = {
  pageIndex: number,
  pageSize: number,
  match?: any;
  requires?: {
    status?: 1
    queues?: 1
  }
}

@Component({
  selector: 'app-job-info',
  templateUrl: './job-info.component.html',
  styleUrls: ['./job-info.component.css']
})
export class JobInfoComponent implements OnInit {

  displayedColumns = [
    "_id",
    "parentId",
    "queue",
    "url",
    "depth",
    "tryNum",
    "status",
    "createTime"
  ];

  searchFields: any[] = [
    { key: "_id", type: "text" },
    { key: "parentId", type: "text" },
    { key: "queue", type: "select", options: [] },
    { key: "url", type: "text" },
    { key: "depth", type: "number" },
    { key: "tryNum", type: "number" },
    { key: "status", type: "select", options: [] },
    { key: "createTime", type: "date" },
  ];

  operators: any[] = [
    {
      key: "$gt",
      label: ">",
      types: ["number", "date"]
    },
    {
      key: "$gte",
      label: ">=",
      types: ["number", "date"]
    },
    {
      key: "eq",
      label: "=",
      types: ["number", "date", "text"]
    },
    {
      key: "$lte",
      label: "<=",
      types: ["number", "date"]
    },
    {
      key: "$lt",
      label: "<",
      types: ["number", "date"]
    },
    {
      key: "$regex",
      label: "regex match",
      types: ["text"]
    },
  ];

  searchConditions: SearchCondition[] = [{}];

  jobs = new MatTableDataSource<any[]>();

  jobsStatus: any[];

  curPageInfo = {
    total: 0,
    pageIndex: 0,
    pageSize: 10,
    match: {}
  };

  constructor(
    private socketIOService: SocketIOService,
    private commonService: CommonService,
    public dialog: MatDialog,
    private toasterService: ToasterService
  ) {
    this.pagenation({
      pageSize: 10,
      pageIndex: 0,
      requires: {
        status: 1,
        queues: 1
      }
    });
  }

  ngOnInit() {
  }

  saveConditionState() {
    const cons = [];
    this.searchConditions.forEach(condition => {
      const con: any = {};
      if (condition.field) con.fieldKey = condition.field.key;
      if (condition.operator) con.operatorKey = condition.operator.key;
      if (condition.value) con.value = typeof condition.value == "object" ? condition.value["value"] : condition.value;
      cons.push(con);
    });
    localStorage.setItem("jobSearchConditions", JSON.stringify(cons));
  }

  loadConditionState() {
    const cons = JSON.parse(localStorage.getItem("jobSearchConditions")) as Array;
    const conditions = [];
    cons.forEach(con => {
      const condition: any = {};
      if (con.fieldKey) condition.field = this.searchFields.find(item => item.key == con.fieldKey);
      if (con.operatorKey) condition.operator = this.operators.find(item => item.key == con.operatorKey);
      if (condition.field && condition.field.type == "select" && con.value != null) {
        condition.value = condition.field.options.find(item => item == con.value || item.value == con.value);
      }
      else condition.value = con.value;
      conditions.push(condition);
    });
    this.searchConditions = conditions;
    if (conditions.length > 0) this.search();
  }

  conditionFieldChanged(condition) {
    condition.value = null;
    if (condition.field && condition.field.type == "select") condition.operator = this.operators.find(item => item.key == "eq");
    else condition.operator = this.operators.find(item => item.types.indexOf(condition.field.type) > -1);
  }

  search() {
    this.collectConditions();
    this.pagenation(this.curPageInfo);
  }

  delete() {
    this.dialog.open(ConfirmDialog, {
      width: "400px",
      data: {
        message: "Delete all job datas matching the conditions ?"
      }
    }).afterClosed().subscribe(res => {
      if (res) {
        this.collectConditions();
        this.socketIOService.request({
          key: "deleteJobs",
          data: this.curPageInfo
        }, res => {
          if (res.success) this.search();
          this.toasterService.pop(res.success ? "success" : "warning", "Message", res.message);
        });
      }
    });
  }

  jobDetail(_id: string) {
    this.dialog.open(JobDetailDialog, {
      width: "700px",
      data: {
        _id: _id
      }
    });
  }

  private collectConditions() {
    const cons = [];
    this.searchConditions.forEach(con => {
      if (con.field && con.operator) {
        const field = con.field.key;
        const operator = con.operator.key;
        let value = null;
        if (field == "status") {
          if (con.value) value = con.value.value;
        }
        else if (field == "createTime" && con.value){
          value = new Date(con.value).getTime();
        }
        else if (con.field.type == "number") {
          value = parseFloat(con.value);
          if (isNaN(value)) value = null;
        }
        else {
          value = con.value || "";
        }

        if (value != null) {
          if (operator == "eq") {
            let temp: any = {};
            temp[field] = value;
            cons.push(temp)
          }
          else {
            let temp: any = {};
            let ope: any = {};
            ope[operator] = value;
            temp[field] = ope;
            cons.push(temp)
          }
        }
      }
    });
    // console.log(cons);
    if (cons.length > 0) {
      this.curPageInfo.match = {
        "$and": cons
      };
    }
    else this.curPageInfo.match = {};
  }

  private pagenation(pager: Pager) {
    // console.log(pager);
    this.socketIOService.request({
      key: "jobs",
      data: pager
    }, res => {
      if (res.success) {
        // console.log(res);
        let loadConditionStateRequire = false;
        if (res.data.status) {
          this.jobsStatus = res.data.status;
          this.searchFields.find(item => {
            if (item.key == "status") {
             item.options = this.jobsStatus;
              return true;
            }
          });
          loadConditionStateRequire = true;
        }

        if (res.data.queues) {
          this.searchFields.find(item => {
            if (item.key == "queue") {
              item.options = res.data.queues;
              return true;
            }
          });
          loadConditionStateRequire = true;
        }

        if (loadConditionStateRequire) this.loadConditionState();
        else {
          this.jobs.data = res.data.jobs.map(item => {
            item.status = this.jobsStatus.find(s => s.value == item.status).key;
            return item;
          });
          this.curPageInfo.total = res.data.total;
          this.curPageInfo.pageIndex = res.data.pageIndex;
          this.curPageInfo.pageSize = res.data.pageSize;
        }
      }
      else this.toasterService.pop("warning", "Message", res.message);
    });
  }

}

@Component({
  selector: 'job-detail-dialog',
  templateUrl: './job.detail.dialog.html',
  styleUrls: ['./job-info.component.css']
})
export class JobDetailDialog implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<JobDetailDialog>,
    private socketIOService: SocketIOService,
    @Inject(MAT_DIALOG_DATA) public data: {
      _id: string;
    }
  ) {}

  ngOnInit() {
    this.socketIOService.request({
      key: "jobDetail",
      data: {
        _id: this.data._id
      }
    }, res => {
      if (res.success) {
        $("#jsonViewer").jsonViewer(res.data, { collapsed: false });
      }
    });
  }

}
