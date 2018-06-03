import {Job, JobStatus} from "./Job";
import {DateUtil} from "../../common/util/DateUtil";
import {JobExeTime} from "../data/Types";
import {Serialize} from "../../common/serialize/Serialize";

@Serialize()
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

    private _createTime: number;

    private _exeTimes: JobExeTime[] = [];

    id(): string {
        return this._id;
    }

    parentId(parentId?: string): string {
        if (parentId != null) {
            this._parentId = parentId;
        }
        return this._parentId;
    }

    queue(queue?: string): string {
        if (queue != null) {
            this._queue = queue;
        }
        return this._queue;
    }

    url(): string {
        return this._url;
    }

    key(key?: string): string {
        if (key != null) {
            this._key = key;
        }
        return this._key || this._url;
    }

    datas(): any {
        return this._datas;
    }

    priority(priority?: number): number {
        if (priority != null) {
            this._priority = priority;
        }
        return this._priority;
    }

    depth(depth?: number): number {
        if (depth != null) {
            this._depth = depth;
        }
        return this._depth;
    }

    status(status?: JobStatus): JobStatus {
        if (status != null) {
            this._status = status;
        }
        return this._status;
    }

    tryNum(tryNum?: number): number {
        if (tryNum != null) {
            this._tryNum = tryNum;
        }
        return this._tryNum;
    }

    createTime(): number {
        return this._createTime;
    }

    exeTimes(time: JobExeTime): JobExeTime[] {
        if (time) {
            if (time.start != null) {
                this._exeTimes.push(time);
            }
            else if (time.end != null && this._exeTimes.length > 0) {
                this._exeTimes[this._exeTimes.length - 1].end = time.end;
            }
        }
        return this._exeTimes;
    }

    constructor(url: string) {
        const date = new Date();
        this._id = DateUtil.toStr(date, "yyyyMMdd_HHmmss_SSS_") + (Math.random() * 10000).toFixed();
        this._createTime = date.getTime();
        this._url = url;
    }

}