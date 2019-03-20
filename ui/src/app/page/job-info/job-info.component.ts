import {Component, Inject, OnInit} from '@angular/core';
import {CommonService} from "../../service/common.service";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatTableDataSource} from "@angular/material";
import {ToasterService} from "angular2-toaster";
import {SocketIOService} from "../../service/socket-io.service";
import {ConfirmDialog} from "../../widget/confirm-dialog/confirm.dialog";

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
  total: number;
  pageIndex: number;
  pageSize: number;
  match?: any;
  requires?: {
    status?: 1 | null;
    queues?: 1 | null;
    jobs?: 1 | null;
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
    "createTime",
    "option"
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
      key: "$eq",
      label: "=",
      types: ["number", "date", "text"]
    },
    {
      key: "$in",
      label: "in",
      types: ["select"]
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

  curPageInfo: Pager = {
    total: 0,
    pageIndex: 0,
    pageSize: 10,
    match: {},
    requires: {}
  };

  constructor(
    private socketIOService: SocketIOService,
    private commonService: CommonService,
    public dialog: MatDialog,
    private toasterService: ToasterService
  ) {
    this.pagenation({
      total: 0,
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

  saveSearchState() {
    const cons = [];
    this.searchConditions.forEach(condition => {
      const con: any = {};
      if (condition.field) con.fieldKey = condition.field.key;
      if (condition.operator) con.operatorKey = condition.operator.key;
      if (condition.value) {
        if (condition.value instanceof Array) {
          con.value = condition.value.map(item => item.value == null ? item : item.value);
        }
        else {
          con.value = typeof condition.value == "object" ? condition.value["value"] : condition.value;
        }
      }
      cons.push(con);
    });
    localStorage.setItem("jobSearchState", JSON.stringify({
      conditions: cons,
      pageIndex: this.curPageInfo.pageIndex,
      pageSize: this.curPageInfo.pageSize
    }));
  }

  loadSearchState() {
    const searchState = JSON.parse(localStorage.getItem("jobSearchState") || "{}");
    if (searchState.conditions) {
      const cons = searchState.conditions as Array<any>;
      const conditions = [];
      cons.forEach(con => {
        const condition: any = {};
        if (con.fieldKey) condition.field = this.searchFields.find(item => item.key == con.fieldKey);
        if (con.operatorKey) condition.operator = this.operators.find(item => item.key == con.operatorKey);
        if (condition.field && condition.field.type == "select" && con.value != null) {
          condition.value = condition.field.options.filter(item => con.value.indexOf(item.value == null ? item : item.value) > -1);
        }
        else condition.value = con.value;
        conditions.push(condition);
      });
      this.searchConditions = conditions;
    }
    this.curPageInfo.pageIndex = searchState.pageIndex || 0;
    this.curPageInfo.pageSize = searchState.pageSize || 0;
    this.curPageInfo.requires = {jobs: 1};
    this.search();
  }

  conditionFieldChanged(condition) {
    condition.value = null;
    if (condition.field && condition.field.type == "select") condition.operator = this.operators.find(item => item.key == "$in");
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
        if (con.field.type == "select" && con.value instanceof Array) {
          value = con.value.map(item => item.value == null ? item : item.value);
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
          if (operator == "$eq") {
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
        if (res.data.status) {
          this.jobsStatus = res.data.status;
          this.searchFields.find(item => {
            if (item.key == "status") {
             item.options = this.jobsStatus;
              return true;
            }
          });
        }

        if (res.data.queues) {
          this.searchFields.find(item => {
            if (item.key == "queue") {
              item.options = res.data.queues;
              return true;
            }
          });
        }

        if (pager.requires && pager.requires.jobs) {
          this.jobs.data = res.data.jobs.map(item => {
            item.status = this.jobsStatus.find(s => s.value == item.status).key;
            return item;
          });
          this.curPageInfo.total = res.data.total;
          this.curPageInfo.pageIndex = res.data.pageIndex;
          this.curPageInfo.pageSize = res.data.pageSize;
        }
        else this.loadSearchState();
      }
      else this.toasterService.pop("warning", "Message", res.message);
    });
  }

  reExecuteJob(jobId: string) {
    this.socketIOService.request({
      key: "reExecuteJob",
      data: {
        _id: jobId
      }
    }, res => {
      this.toasterService.pop(res.success ? "success" : "warning", "Message", res.message);
    });
  }

  interrupteJob(jobId: string) {
    this.socketIOService.request({
      key: "interrupteJob",
      data: {
        _id: jobId
      }
    }, res => {
      this.toasterService.pop(res.success ? "success" : "warning", "Message", res.message);
    });
  }

}

@Component({
  selector: 'job-detail-dialog',
  templateUrl: './job.detail.dialog.html',
  styleUrls: ['./job-info.component.css']
})
export class JobDetailDialog implements OnInit {

  parentJobId: string;

  constructor(
    public dialogRef: MatDialogRef<JobDetailDialog>,
    private socketIOService: SocketIOService,
    @Inject(MAT_DIALOG_DATA) public data: {
      _id: string;
    }
  ) {}

  ngOnInit() {
    this.loadJobDetail(this.data._id);
  }

  loadJobDetail(jobId: string) {
    this.socketIOService.request({
      key: "jobDetail",
      data: {
        _id: jobId
      }
    }, res => {
      if (res.success) {
        this.parentJobId = res.data._parentId_justForParentFetch;
        delete res.data._parentId_justForParentFetch;

        $("#jsonViewers").append(`<pre id="jsonViewer_${jobId}"/>`);
        $(`#jsonViewer_${jobId}`).jsonViewer(res.data, { collapsed: false });
        $(`#jsonViewer_${jobId} a.json-string`).attr("target", "_blank");
      }
    });
  }

}
