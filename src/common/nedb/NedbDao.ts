import * as Nedb from "nedb";
import {StringUtil} from "../util/StringUtil";
import model = require("nedb/lib/model");
import storage = require("nedb/lib/storage");
import * as fs from "fs";

// storage.writeFile 增加多行写入的功能
storage.writeFile = (...args) => {
    if (args[1] instanceof Array) {
        try {
            fs.writeFileSync(args[0], "", "utf-8");

            const data = args[1] as string[];
            for (let i = 0, len = data.length; i < len; i += 100) {
                const subLines = data.slice(i, Math.min(len, i + 100)).join("\n") + "\n";
                fs.appendFileSync(args[0], subLines, "utf-8");
            }
            args[2]();
        }
        catch (e) {
            args[2](e);
        }
    }
    else {
        fs.watchFile.call(fs, ...args);
    }
};

export type Sort = {[by: string]: -1 | 1};

export class Pager<T> {

    pageIndex: number = 0;

    pageSize: number = 10;

    match: any = {};

    projection: any;

    sort: Sort;

    total: number;

    list: T[];

}

export class NedbModel {

    _id: string | number;

    createTime: number = new Date().getTime();

    updateTime: number;

    constructor(_idOrValues?: any) {
        if (_idOrValues != null) {
            const t = typeof _idOrValues;
            if (t === "object") {
                Object.assign(this as any, _idOrValues);
            }
            else if (t === "string" || t === "number") {
                this._id = _idOrValues;
            }
        }
        if (this._id == null) {
            this._id = StringUtil.id();
        }
    }

}

export class NedbDao<T extends NedbModel> {

    private static _instances = {};

    protected nedbP: Promise<Nedb>;

    // 10分钟压缩一次
    private readonly compactRate = 600000;

    private lastCompactTime = new Date().getTime();

    constructor(dbDir: string) {
        NedbDao._instances[this.constructor.name] = this;
        const dbFile = dbDir + "/" + this.constructor.name + ".db";
        this.nedbP = new Promise<Nedb>((resolve, reject) => {
            const nedb = new Nedb({
                filename: dbFile,
                autoload: false
            });

            // 修复 Persistence.prototype.persistCachedDatabase 中直接用 + 拼接字符串导致内存溢出的问题
            nedb.persistence["persistCachedDatabase"] = cb => {
                const callback = cb || function () {}
                    , self = nedb.persistence as any;
                const toPersist = [];

                if (self.inMemoryOnly) { return callback(null); }

                self.db.getAllData().forEach(function (doc) {
                    toPersist.push(self.afterSerialization(model.serialize(doc)));
                });
                Object.keys(self.db.indexes).forEach(function (fieldName) {
                    if (fieldName != "_id") {   // The special _id index is managed by datastore.js, the others need to be persisted
                        toPersist.push(self.afterSerialization(model.serialize({ $$indexCreated: { fieldName: fieldName, unique: self.db.indexes[fieldName].unique, sparse: self.db.indexes[fieldName].sparse }})));
                    }
                });

                storage.crashSafeWriteFile(self.filename, toPersist, function (err) {
                    if (err) { return callback(err); }
                    self.db.emit('compaction.done');
                    return callback(null);
                });
            };

            nedb.loadDatabase(error => {
                if (error) {
                    reject(new Error("nedb load fial: " + dbFile));
                }
                else {
                    resolve(nedb);
                }
            });
        });
    }

    public static dbs(): string[] {
        return Object.keys(NedbDao._instances);
    }

    public static db(dbName: string): NedbDao<any> {
        return NedbDao._instances[dbName];
    }

    waitNedbReady() {
        return this.nedbP.then(nedb => true);
    }

    /**
     * 对 nedb 的数据进行压缩整理，这个源于nedb的数据存储方式
     * 数据更新都是 append 操作，删除是增加一个 delete记录，更新数据是增加一个 update记录，这些记录都会添加到持久化文件末尾
     * compat之后，会将最新的数据记录保存到持久化文件中，delete/update记录就不会存在了，从而达到压缩体积的目的
     * 系统启动时否认会压缩一次数据
     */
    private compact() {
        this.nedbP.then(nedb => {
            this.lastCompactTime = new Date().getTime();
            nedb.persistence.compactDatafile();
        });
    }

    /**
     * 检测是否需要compact
     * @param {number} actionNum
     */
    private afterAction() {
        if (new Date().getTime() - this.lastCompactTime >= this.compactRate) {
            this.compact();
        }
    }

    /**
     * 将查询语句中的regex string转换为Regex对象实例，因为nedb的$regex操作只接受 Regex对象实例
     * @param query
     * @returns {any}
     */
    private castRegexInMatch(query: any) {
        if (query == null) return query;
        if (query instanceof Array) {
            for (let i = 0, len = query.length; i < len; i++) {
                query[i] = this.castRegexInMatch(query[i]);
            }
        }
        else if (typeof query == "object") {
            for (let key of Object.keys(query)) {
                if (key == "$regex") {
                    query[key] = new RegExp(query[key]);
                }
                else query[key] = this.castRegexInMatch(query[key]);
            }
        }
        return query;
    }

    private static ifErrorRejectElseResolve(err: Error | any, reject: any, resolve?: any, res?: any) {
        if (err && err.constructor == Error) {
            reject(err);
        }
        else if (resolve) {
            resolve(res);
        }
    };

    save(item: T, justUpdate: boolean = false): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            item.updateTime = new Date().getTime();
            if (!justUpdate) {
                this.nedbP.then(nedb => {
                    nedb.insert(item, (err: any) => {
                        if (err) {
                            if (err.errorType == "uniqueViolated") {
                                nedb.update({_id: item._id}, item, {}, err1 => {
                                    NedbDao.ifErrorRejectElseResolve(err1, reject, resolve, true);
                                    this.afterAction();
                                });
                            }
                            else {
                                reject(err);
                            }
                        }
                        else {
                            resolve(true);
                            this.afterAction();
                        }
                    });
                })
            }
            else {
                this.nedbP.then(nedb => {
                    nedb.update({_id: item._id}, item, {}, err1 => {
                        NedbDao.ifErrorRejectElseResolve(err1, reject, resolve, true);
                        this.afterAction();
                    });
                });
            }
        });
    }

    private find(query: any, projection: any, justOne: boolean, sort?: Sort, skip?: number, limit?: number): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            query = this.castRegexInMatch(query || {});
            if (!projection) {
                projection = {};
            }
            if (justOne) {
                this.nedbP.then(nedb => {
                    nedb.findOne(query, projection, (error, doc) => {
                        NedbDao.ifErrorRejectElseResolve(error, reject, resolve, doc);
                    });
                });
            }
            else {
                this.nedbP.then(nedb => {
                    const cursor = nedb.find(query, projection);
                    if (sort) {
                        let sortKeyNum = 0;
                        for (let key of Object.keys(sort)) {
                            if (typeof sort[key] != "number") {
                                delete sort[key];
                            }
                            else {
                                sortKeyNum++;
                            }
                        }
                        if (sortKeyNum > 0) {
                            cursor.sort(sort);
                        }
                    }
                    if (typeof skip == "number") {
                        cursor.skip(skip);
                    }
                    if (typeof limit == "number") {
                        cursor.limit(limit);
                    }
                    cursor.exec((error, docs) => {
                        NedbDao.ifErrorRejectElseResolve(error, reject, resolve, docs);
                    });
                });
            }
        });
    }

    findById(_id: string, projection?: any): Promise<T> {
        return this.find({_id: _id}, projection, true);
    }

    findOne(query: any, projection?: any): Promise<T> {
        return this.find(query, projection, true);
    }

    findList(query: any, projection?: any, sort?: Sort, skip?: number, limit?: number): Promise<T[]>  {
        return this.find(query, projection, false, sort, skip, limit);
    }

    count(query: any): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            query = this.castRegexInMatch(query || {});
            this.nedbP.then(nedb => {
                nedb.count(query, (error, num) => {
                    NedbDao.ifErrorRejectElseResolve(error, reject, resolve, num);
                });
            });
        });
    }

    remove(query: any, multi: boolean = true): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            query = this.castRegexInMatch(query || {});
            this.nedbP.then(nedb => {
                nedb.remove(query,  {
                    multi: multi
                },(error, num) => {
                    NedbDao.ifErrorRejectElseResolve(error, reject, resolve, num);
                });
            });
        });
    }

    update(query: any, updateQuery: any, options?: Nedb.UpdateOptions): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            query = this.castRegexInMatch(query || {});
            this.nedbP.then(nedb => {
                nedb.update(query, updateQuery, options || {},(error, num) => {
                    NedbDao.ifErrorRejectElseResolve(error, reject, resolve, num);
                });
            });
        });
    }

    page(pager: Pager<T>): Promise<Pager<T>> {
        return new Promise<any>( (resolve, reject) => {
            const query = this.castRegexInMatch(pager.match || {});
            this.nedbP.then(async nedb => {
                const total = await new Promise<any>(resolve1 => {
                    nedb.count(query, (err, n) => {
                        resolve1(err || n);
                    });
                });
                NedbDao.ifErrorRejectElseResolve(total, resolve);

                const pageSize = pager.pageSize || 10;
                const pageIndex = Math.min(pager.pageIndex || 0, parseInt("" + (total - 1) / 10));
                let list = null;
                try {
                    list = await this.findList(query, pager.projection || {}, pager.sort, pageIndex * pageSize, pageSize);
                }
                catch (e) {
                    list = e;
                }
                NedbDao.ifErrorRejectElseResolve(list, reject);

                pager.pageIndex = pageIndex;
                pager.total = total;
                pager.list = list;
                resolve(pager);
            });
        });
    }

}