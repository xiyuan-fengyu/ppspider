import {DataUi, DataUiRequest} from "../decorators/DataUi";
import {Bean} from "../../common/bean/Bean";
import {NedbDao, Pager} from "../../common/nedb/NedbDao";

declare const CodeMirror: any;

@DataUi({
    label: "Nedb Helper",
    style: `
#searchResultViewer {
    overflow-y: auto;
    max-height: calc(100vh - 90px);
    margin-top: 18px;
}
    `,
    template: `
<div class="container-fluid" style="margin-top: 12px">
    <div class="row">
        <div class="col-sm-3">
            <form>
                  <div class="form-group">
                        <label for="db">Nedb</label>
                        <select [(ngModel)]="db" id="db" name="db" class="form-control">
                            <option *ngFor="let db of dbs" [ngValue]="db">{{db}}</option>
                        </select>
                  </div>
                  <div class="form-group">
                        <label for="searchExp">Search Exp</label>
                        <textarea id="searchExp" name="searchExp" class="form-control" rows="15">{{defaultSearchExp}}</textarea>
                  </div>
                  <button (click)="search()" [disabled]="db && searchExp ? null : true" class="btn btn-primary">Submit</button>
            </form>
        </div>
        <div class="col-sm-9">
            <div id="searchResultViewer"></div>
        </div>
    </div>
</div>
    `
})
export class NedbHelperUi {

    dbs: string[] = [];

    db: string;

    private searchExpInput: any;

    readonly defaultSearchExp =
`{
  "pageIndex": 0,
  "pageSize": 10,
  "match": {
      
  },
  "projection": {
    
  },
  "sort": {
    "_id": 1
  }
}
`;

    searchExp: any = JSON.parse(this.defaultSearchExp);

    ngOnInit() {
        this.dbList().then(res => {
            res.forEach(item => this.dbs.push(item));
            this.db = this.dbs[0];
        });
    }

    ngAfterViewInit() {
        this.searchExpInput = CodeMirror.fromTextArea(document.getElementById("searchExp"), {
            matchBrackets: true,
            autoCloseBrackets: true,
            mode: "application/ld+json",
            lineWrapping: true,
            lineNumbers: true,
            lineHeight: "20px"
        });
        this.searchExpInput.on('change', (cm, change) => {
            const value = cm.getValue();
            try {
                this.searchExp = JSON.parse(value);
            }
            catch (e) {
                this.searchExp = null;
            }
        });
    }

    dbList(): Promise<string[]> {
        // just a method stub
        return null;
    }

    dbSearch(...args): Promise<any> {
        // just a method stub
        return null;
    }

    search() {
        if (this.db && this.searchExp) {
            this.dbSearch(this.db, this.searchExp).then(res => {
                ($("#searchResultViewer") as any).jsonViewer(res, { collapsed: false });
                $("#searchResultViewer a.json-string").attr("target", "_blank");
            });
        }
    }

}

@Bean()
export class NedbHelper {

    @DataUiRequest(NedbHelperUi.prototype.dbList)
    dbList() {
        return NedbDao.dbs();
    }

    @DataUiRequest(NedbHelperUi.prototype.dbSearch)
    dbSearch(db: string, searchExp: Pager<any>) {
        return (NedbDao.db(db)).page(searchExp);
    }

}
