import * as Nedb from "nedb";
import {StringUtil} from "../util/StringUtil";
import * as fs from "fs";
import {logger} from "../util/logger";
import Persistence = require("nedb/lib/persistence");
import Index = require("nedb/lib/indexes");
import model = require("nedb/lib/model");
import storage = require("nedb/lib/storage");
import * as path from "path";
import * as readline from "readline";

Persistence.prototype.loadDatabase = function (cb) {
    const callback = cb || function () {};
    const self = this;

    self.db.resetIndexes();

    // In-memory only datastore
    if (self.inMemoryOnly) { return callback(null); }

    Persistence.ensureDirectoryExists(path.dirname(self.filename), function (err) {
        if (err) {
            return callback(err);
        }

        storage.ensureDatafileIntegrity(self.filename, function (err) {
            if (err) {
                return callback(err);
            }

            const dataById = new Map<any, any>();
            const tdata = [];
            const indexes = {};
            const lineBuffer = [];
            let waitReadFinishResolve;
            const waitReadFinishPromise = new Promise(resolve => waitReadFinishResolve = resolve);

            const parseDocs =() => {
                for (let line of lineBuffer) {
                    try {
                        const doc = model.deserialize(self.beforeDeserialization(line));
                        if (doc._id) {
                            if (doc.$$deleted === true) {
                                dataById.delete(doc._id);
                            } else {
                                dataById.set(doc._id, doc);
                            }
                        } else if (doc.$$indexCreated && doc.$$indexCreated.fieldName != undefined) {
                            indexes[doc.$$indexCreated.fieldName] = doc.$$indexCreated;
                        } else if (typeof doc.$$indexRemoved === "string") {
                            delete indexes[doc.$$indexRemoved];
                        }
                    }
                    catch (e) {
                        waitReadFinishResolve(e);
                    }
                }
                lineBuffer.splice(0, lineBuffer.length);
            };

            const reader = readline.createInterface({
                input: fs.createReadStream(self.filename).setEncoding('utf8')
            });
            reader.on('line', function(line) {
                lineBuffer.push(line);
                lineBuffer.length >= 10000 && parseDocs();
            });
            reader.on('close', function(line) {
                lineBuffer.length > 0 && parseDocs();
                waitReadFinishResolve();
            });

            waitReadFinishPromise.then(err => {
               if (err) {
                   reader.close();
                   return callback(err);
               }

                for (let item of dataById.values()) {
                    tdata.push(item);
                }
                dataById.clear();
                const treatedData = { data: tdata, indexes: indexes};
                // Recreate all indexes in the datafile
                Object.keys(treatedData.indexes).forEach(function (key) {
                    self.db.indexes[key] = new Index(treatedData.indexes[key]);
                });

                // Fill cached database (i.e. all indexes) with data
                try {
                    self.db.resetIndexes(treatedData.data);
                } catch (e) {
                    self.db.resetIndexes();   // Rollback any index which didn't fail
                    return cb(e);
                }

                self.db.executor.processBuffer();

                cb();
            });
        });
    });
};

const treeVisitor = (node, callback)  => {
    let shouldContinue;
    node.left && (shouldContinue = treeVisitor(node.left, callback));
    if (shouldContinue === false) {
        return shouldContinue;
    }

    shouldContinue = callback(node);
    if (shouldContinue === false) {
        return shouldContinue;
    }

    node.right && (shouldContinue = treeVisitor(node.right, callback));
    return shouldContinue;
};

Persistence.prototype.persistCachedDatabase = function (cb) {
    const callback = cb || function () {};
    const self = this;

    if (self.inMemoryOnly) { return callback(null); }

    const tempFilename = self.filename + '~';
    const writeToTempFile = () => {
        const lineBuffer = [];
        let writeErr;
        let waitFinishResolve;
        let waitFinishPromise;

        const writer = fs.createWriteStream(tempFilename, "utf-8");
        const writeLines = async () => {
            if (lineBuffer.length) {
                waitFinishPromise && await waitFinishPromise;
                waitFinishPromise = new Promise(resolve => waitFinishResolve = resolve);
                writer.write(lineBuffer.join("\n") + "\n", err => {
                    if (err) {
                        writeErr = err;
                    }
                    waitFinishResolve();
                });
                lineBuffer.splice(0, lineBuffer.length);
            }
        };

        treeVisitor(self.db.indexes._id.tree.tree, node => {
            if (writeErr) {
                return false;
            }

            for (let i = 0, len = node.data.length; i < len; i += 1) {
                const doc = node.data[i];
                lineBuffer.push(self.afterSerialization(model.serialize(doc)));
                lineBuffer.length >= 100 && writeLines();
            }
        });

        for (let fieldName of Object.keys(self.db.indexes)) {
            if (fieldName != "_id") {   // The special _id index is managed by datastore.js, the others need to be persisted
                lineBuffer.push(self.afterSerialization(model.serialize({ $$indexCreated: { fieldName: fieldName, unique: self.db.indexes[fieldName].unique, sparse: self.db.indexes[fieldName].sparse }})));
                lineBuffer.length >= 100 && writeLines();
            }
        }

        lineBuffer.length > 0 && writeLines();

        if (writeErr) {
            return callback(writeErr);
        }

        const rename = () => {
            storage.flushToStorage(tempFilename, err => {
                if (err) {
                    return callback(err);
                }

                fs.rename(tempFilename, self.filename, err1 => {
                    if (err1) {
                        return callback(err1);
                    }

                    storage.flushToStorage({ filename: path.dirname(self.filename), isDir: true }, err2  => {
                        if (!err2) {
                            self.db.emit('compaction.done');
                        }
                        callback(err2);
                    })
                });
            });
        };
        if (waitFinishPromise) {
            waitFinishPromise.then(() => {
                if (writeErr) {
                    return callback(writeErr);
                }
                rename();
            });
        }
        else {
            rename();
        }
    };

    storage.flushToStorage({ filename: path.dirname(self.filename), isDir: true }, err => {
        if (err) {
            return callback(err);
        }

        if (fs.existsSync(self.filename)) {
            storage.flushToStorage(self.filename, function (err) {
                if (err) {
                    callback(err);
                }
                else writeToTempFile();
            });
        }
        else {
            writeToTempFile();
        }
    });
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

    private readonly compactInterval: number;

    protected nedbP: Promise<Nedb>;

    constructor(dbDir: string, compactInterval: number = 600000) {
        NedbDao._instances[this.constructor.name] = this;

        if (compactInterval >= 0 && compactInterval < 60000) {
            logger.warn(`auto compact interval(${compactInterval}ms) is less than 1 minute.`);
        }
        this.compactInterval = compactInterval;

        const dbFile = dbDir + "/" + this.constructor.name + ".db";
        this.nedbP = new Promise<Nedb>((resolve, reject) => {
            const nedb = new Nedb({
                filename: dbFile,
                autoload: false
            });

            nedb.loadDatabase(error => {
                if (error) {
                    reject(new Error("nedb loading failed: " + dbFile));
                }
                else {
                    nedb.addListener("compaction.done", () => {
                       setTimeout(() => nedb.persistence.compactDatafile(), this.compactInterval);
                    });
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
                                });
                            }
                            else {
                                reject(err);
                            }
                        }
                        else {
                            resolve(true);
                        }
                    });
                })
            }
            else {
                this.nedbP.then(nedb => {
                    nedb.update({_id: item._id}, item, {}, err1 => {
                        NedbDao.ifErrorRejectElseResolve(err1, reject, resolve, true);
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