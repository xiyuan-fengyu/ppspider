import {PromiseUtil} from "../util/PromiseUtil";
import {StringUtil} from "../util/StringUtil";
import {DbDao, Pager, Sort} from "./DbDao";
import {Collection, Db, MongoClient} from "mongodb";
import {URL} from "url";

export class MongodbDao extends DbDao {

    protected readonly dbName: string;

    constructor(url: string) {
        super(url);

        const urlObj = new URL(url);
        const pathSplit = urlObj.pathname.split("/").filter(item => !!item);
        if (pathSplit.length != 1) {
            throw new Error("bad mongodb url which should end with the db name");
        }
        this.dbName = pathSplit[0];

        MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
            if (err) {
                throw err;
            }
            else {
                this.dbResolve(client.db(this.dbName));
            }
        });
    }

    collections(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            this.dbPromise.then((db: Db) => {
                db.collections().then(res => {
                    const collectionNames = res.map(item => item.collectionName);
                    resolve(collectionNames);
                }).catch(err => reject(err));
            })
        });
    }

    collection(collectionName: string): Promise<Collection<any>> {
        return this.dbPromise.then((db: Db) => db.collection(collectionName));
    }

    save(collectionName: string, item: any, skipInsert: boolean = false): Promise<"insert" | "replace"> {
        return new Promise((resolve, reject) => {
            if (item._id == null) {
                item._id = StringUtil.id();
            }
            this.dbPromise.then((db: Db) => {
                const collection = db.collection(collectionName);
                if (skipInsert) {
                    collection.replaceOne({_id: item._id}, item, err => {
                        PromiseUtil.rejectOrResolve(reject, err, resolve, "replace");
                    });
                }
                else {
                    collection.insertOne(item, err => {
                        if (err) {
                            // 文档已存在，替换
                            collection.replaceOne({_id: item._id}, item, err => {
                                PromiseUtil.rejectOrResolve(reject, err, resolve, "replace");
                            });
                        }
                        else {
                            resolve("insert");
                        }
                    });
                }
            })
        });
    }

    private find(collectionName: string, query: any, projection: any, justOne: boolean, sort?: Sort, skip?: number, limit?: number): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (!projection) {
                projection = {};
            }

            this.dbPromise.then((db: Db) => {
                const collection = db.collection(collectionName);
                if (justOne) {
                    collection.findOne(query, {
                        projection: projection
                    }, (error, doc) => {
                        PromiseUtil.rejectOrResolve(reject, error, resolve, doc);
                    });
                }
                else {
                    const aggOpt: any[] = [];
                    aggOpt.push({ $match: query || {}});
                    sort && aggOpt.push({ $sort: sort});
                    projection && Object.keys(projection).length > 0 && aggOpt.push({ $project: projection});
                    skip && aggOpt.push({ $skip: skip});
                    limit && aggOpt.push({ $limit: limit});

                    collection.aggregate(aggOpt, { allowDiskUse: true }).toArray((err, docs) => {
                        PromiseUtil.rejectOrResolve(reject, err, resolve, docs);
                    });
                }
            });
        });
    }

    findById(collectionName: string, _id: string, projection?: any): Promise<any> {
        return this.find(collectionName, {_id: _id}, projection, true);
    }

    findOne(collectionName: string, query: any, projection?: any): Promise<any> {
        return this.find(collectionName, query, projection, true);
    }

    findList(collectionName: string, query: any, projection?: any, sort?: Sort, skip?: number, limit?: number): Promise<any[]>  {
        return this.find(collectionName, query, projection, false, sort, skip, limit);
    }

    count(collectionName: string, query: any): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.dbPromise.then((db: Db) => {
                const collection = db.collection(collectionName);
                collection.countDocuments(query, (error, num) => {
                    PromiseUtil.rejectOrResolve(reject, error, resolve, num);
                });
            });
        });
    }

    remove(collectionName: string, query: any, multi: boolean = true): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.dbPromise.then((db: Db) => {
                const collection = db.collection(collectionName);
                collection[multi ? "deleteMany" : "deleteOne"](query, (error, result) => {
                    PromiseUtil.rejectOrResolve(reject, error, resolve, result && result.result ? result.result.n : 0);
                });
            });
        });
    }

    update(collectionName: string, query: any, updateQuery: any, multi: boolean = true): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.dbPromise.then((db: Db) => {
                const collection = db.collection(collectionName);
                collection[multi ? "updateMany" : "updateOne"](query, updateQuery, (error, result) => {
                    PromiseUtil.rejectOrResolve(reject, error, resolve, result);
                });
            });
        });
    }

    page(collectionName, pager: Pager): Promise<Pager> {
        return new Promise<any>( (resolve, reject) => {
            const query = pager.match || {};
            this.dbPromise.then(async (db: Db) => {
                let total;
                try {
                    total = await this.count(collectionName, query);
                }
                catch (e) {
                    return reject(e);
                }

                const pageSize = pager.pageSize || 10;
                const pageIndex = Math.min(pager.pageIndex || 0, parseInt("" + Math.max(total - 1, 0) / pageSize));
                let list;
                try {
                    list = await this.findList(collectionName, query, pager.projection || {}, pager.sort, pageIndex * pageSize, pageSize);
                }
                catch (e) {
                    return reject(e);
                }

                pager.pageIndex = pageIndex;
                pager.total = total;
                pager.list = list;
                resolve(pager);
            });
        });
    }

}