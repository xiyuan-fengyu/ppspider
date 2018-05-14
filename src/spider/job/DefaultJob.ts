import {Job, JobStatus} from "./Job";
import {DateUtil} from "../../common/util/DateUtil";

export class DefaultJob implements Job {

    private _id: string;

    private _parentId: string;

    private _url: string;

    private _queue: string;

    private _key: string;

    private _datas: any = {};

    private _priority: number = 0;

    private _depth: number = 0;

    private _status: JobStatus = JobStatus.Create;

    private _tryNum: number = 0;

    id(): string {
        return this._id;
    }

    parentId(parentId?: string): string {
        if (parentId) {
            this._parentId = parentId;
        }
        return this._parentId;
    }

    queue(queue?: string): string {
        if (queue) {
            this._queue = queue;
        }
        return this._queue;
    }

    url(): string {
        return this._url;
    }

    key(key?: string): string {
        if (key) {
            this._key = key;
        }
        return this._key || this._url;
    }

    datas(): any {
        return this._datas;
    }

    priority(priority?: number): number {
        if (priority !== undefined) {
            this._priority = priority;
        }
        return this._priority;
    }

    depth(depth?: number): number {
        if (depth !== undefined) {
            this._depth = depth;
        }
        return this._depth;
    }

    status(status?: JobStatus): JobStatus {
        if (status !== undefined) {
            this._status = status;
        }
        return this._status;
    }

    tryNum(tryNum?: number): number {
        if (tryNum !== undefined) {
            this._tryNum = tryNum;
        }
        return this._tryNum;
    }

    constructor(url: string) {
        this._id = DateUtil.toStr(new Date(), "yyyyMMdd_HHmmss_SSS_") + (Math.random() * 10000).toFixed();
        this._url = url;
    }

}