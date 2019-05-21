import {DataUi, DataUiRequest} from "../decorators/DataUi";
import {Bean} from "../../common/bean/Bean";
import {DbDao, Pager} from "../../common/db/DbDao";

declare const CodeMirror: any;

@DataUi({
    label: "Db Helper",
    // language=CSS
    style: `
#searchResultViewer {
    overflow-y: auto;
    max-height: calc(100vh - 90px);
    margin-top: 18px;
}
    `,
    // language=Angular2HTML
    template: `
        <div class="container-fluid" style="margin-top: 12px">
            <div class="row">
                <div class="col-sm-3">
                    <form>
                        <div class="form-group">
                            <label for="db">Db</label>
                            <select [(ngModel)]="db" (change)="loadConnections()" id="db" name="db" class="form-control">
                                <option *ngFor="let db of dbs" [ngValue]="db">{{db}}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="db">Collection</label>
                            <select [(ngModel)]="collection" id="collection" name="collection" class="form-control">
                                <option *ngFor="let item of collections" [ngValue]="item">{{item}}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="searchExp">Search Exp</label>
                            <textarea id="searchExp" name="searchExp" class="form-control" rows="15">{{defaultSearchExp}}</textarea>
                        </div>
                        <button (click)="search()" [disabled]="db && collection && searchExp ? null : true" class="btn btn-primary">Submit</button>
                    </form>
                </div>
                <div class="col-sm-9">
                    <div id="searchResultViewer"></div>
                </div>
            </div>
        </div>
    `
})
export class DbHelperUi {

    dbs: string[] = [];

    collections: string[] = [];

    db: string;

    collection: string;

    private searchExpInput: any;

    readonly defaultSearchExp: string = `{
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
            this.loadConnections();
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

    dbCollections(db: string): Promise<string[]> {
        return null;
    }

    loadConnections() {
        if (this.db) {
            this.dbCollections(this.db).then(res => {
                this.collections = res.sort();
                this.collection = this.collections[0];
            });
        }
        else {
            this.collections = [];
            this.collection = null;
        }
    }

    search() {
        if (this.db && this.collection && this.searchExp) {
            this.dbSearch(this.db, this.collection, this.searchExp).then(res => {
                ($("#searchResultViewer") as any).jsonViewer(res, { collapsed: false });
                $("#searchResultViewer a.json-string").attr("target", "_blank");
            });
        }
    }

}

@Bean()
class DbHelper {

    @DataUiRequest(DbHelperUi.prototype.dbList)
    dbList() {
        return DbDao.dbs();
    }

    @DataUiRequest(DbHelperUi.prototype.dbCollections)
    dbCollections(db: string) {
        return DbDao.db(db).collections();
    }

    @DataUiRequest(DbHelperUi.prototype.dbSearch)
    dbSearch(db: string, collection: string, searchExp: Pager) {
        return DbDao.db(db).page(collection, searchExp);
    }

}
