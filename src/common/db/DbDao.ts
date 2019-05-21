
export type Sort = {[by: string]: -1 | 1};

export class Pager {

    pageIndex: number = 0;

    pageSize: number = 10;

    match: any = {};

    projection: any;

    sort: Sort;

    total: number;

    list: any[];

}

export class DbDao {

    private static _instances: {[uri: string]: DbDao} = {};

    protected url: string;

    protected dbResolve: (db) => void;

    protected readonly dbPromise: Promise<any>;

    constructor(url: string) {
        if (DbDao._instances[url]) {
            throw new Error(`db(${url}) existed`);
        }

        this.url = url;
        DbDao._instances[this.url] = this;
        this.dbPromise = new Promise<any>(resolve => {
            this.dbResolve = resolve;
        });
    }

    public static dbs(): string[] {
        return Object.keys(DbDao._instances);
    }

    public static db(dbName: string): DbDao {
        return DbDao._instances[dbName];
    }

    waitReady() {
        return this.dbPromise;
    }

    collections(): Promise<string[]> {
        throw new Error("collections is not implemented");
    }

    collection(collectionName: string): Promise<any> {
        throw new Error("collection is not implemented");
    }

    save(collectionName, item: any, skipInsert: boolean = false): Promise<"insert" | "replace"> {
        throw new Error("save is not implemented");
    }

    findById(collectionName, _id: string, projection?: any): Promise<any> {
        throw new Error("findById is not implemented");
    }

    findOne(collectionName, query: any, projection?: any): Promise<any> {
        throw new Error("findOne is not implemented");
    }

    findList(collectionName, query: any, projection?: any, sort?: Sort, skip?: number, limit?: number): Promise<any[]>  {
        throw new Error("findList is not implemented");
    }

    count(collectionName, query: any): Promise<number> {
        throw new Error("count is not implemented");
    }

    remove(collectionName, query: any, multi: boolean = true): Promise<number> {
        throw new Error("remove is not implemented");
    }

    update(collectionName, query: any, updateQuery: any, multi: boolean = true): Promise<number> {
        throw new Error("update is not implemented");
    }

    page(collectionName, pager: Pager): Promise<Pager> {
        throw new Error("page is not implemented");
    }

}
