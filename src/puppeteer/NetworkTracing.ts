import {Page} from "puppeteer";

export type PageRequest = {
    id: string,
    url: string,
    method: string,
    time: number,
    response?: {
        status: number,
        contentType: string,
        contentLength: number,
        fromCache: boolean,
        fromServiceWorker: boolean,
        time: number
    },
    endTime: number
    success: boolean
}

export type PageRequests = {
    time: number,
    requests: PageRequest[]
}

export class NetworkTracing {

    private startTime: number;

    private requestMap: any = {};

    private page: Page;

    private onRequest: (...args: any[]) => void;

    private onResponse: (...args: any[]) => void;

    private onRequestFinished: (...args: any[]) => void;

    private onRequestFailed: (...args: any[]) => void;

    constructor(page: Page) {
        let requestIndex = 0;
        page.on("request", this.onRequest = event => {
            const _requestId = event["_requestId"];
            this.requestMap[_requestId] = {
                id: _requestId,
                sort: requestIndex++,
                url: event.url(),
                method: event.method,
                time: new Date().getTime()
            };
        });

        page.on("response", this.onResponse = async event => {
            const response = this.requestMap[event["_request"]["_requestId"]].response = {
                status: event["_status"],
                contentType: event["_headers"]["content-type"],
                contentLength: event["_headers"]["content-length"],
                fromCache: event["_fromDiskCache"],
                fromServiceWorker: event["_fromServiceWorker"],
                time: new Date().getTime()
            };
            if (response.contentLength == null) {
                event.buffer()
                    .then(buffer => response.contentLength = buffer.length)
                    .catch(err => {});
            }
            else {
                response.contentLength = parseInt(response.contentLength);
            }
        });

        const requestEnd = (event, success) => {
            const requestInfo = this.requestMap[event["_requestId"]];
            requestInfo.endTime = new Date().getTime();
            requestInfo.success = success;
        };
        page.on("requestfinished", this.onRequestFinished = event => {
            requestEnd(event, true);
        });
        page.on("requestfailed", this.onRequestFailed = event => {
            requestEnd(event, false);
        });

        this.page = page;
        this.startTime = new Date().getTime();
    }

    requests(): PageRequests  {
        this.page.removeListener("request", this.onRequest);
        this.page.removeListener("response", this.onResponse);
        this.page.removeListener("requestfinished", this.onRequestFinished);
        this.page.removeListener("requestfailed", this.onRequestFailed);

        const tracing = [];
        for (let key of Object.keys(this.requestMap)) {
            tracing.push(this.requestMap[key]);
        }
        tracing.sort((o1, o2) => o1.sort - o2.sort).map(item => delete item.sort);
        return {
            time: this.startTime,
            requests: tracing
        };
    }

    static requestsToTraceEvents(pageRequests: PageRequests) {
        const startTime = pageRequests.time;
        let lastTime = 0;
        const ts = time => {
            let res = (time - startTime) * 1000;
            if (res == lastTime) {
                res++;
            }
            lastTime = res;
            return res;
        };
        const traceEvents: any[] = [];
        traceEvents.push({"tid":0, "ts":0, "ph":"I","cat":"disabled-by-default-devtools.timeline","name":"TracingStartedInBrowser","args":{"data":{"frameTreeNodeId":0,"persistentIds":true,"frames":[{"url":"about:blank","name":"","processId":1}]}}});
        for (let request of pageRequests.requests) {
            traceEvents.push({"pid":1,"tid":1,"ts":ts(request.time),"ph":"I","cat":"devtools.timeline","name":"ResourceSendRequest","args":{"data":{"requestId":request.id,"url":request.url,"requestMethod":request.method}}});
            if (request.response) {
                traceEvents.push({"pid":1,"tid":1,"ts":ts(request.response.time),"ph":"I","cat":"devtools.timeline","name":"ResourceReceiveResponse","args":{"data":{"requestId":request.id,"statusCode":request.response.status,"mimeType":request.response.contentType,"encodedDataLength":request.response.contentLength,"fromCache":request.response.fromCache,"fromServiceWorker":request.response.fromServiceWorker,"timing":{"requestTime":ts(request.time) / 1000000,"sendStart":0,"receiveHeadersEnd":request.response.time - request.time}}}});
            }
            traceEvents.push({"pid":1,"tid":1,"ts":ts(request.endTime),"ph":"I","cat":"devtools.timeline","name":"ResourceFinish","args":{"data":{"requestId":request.id, "didFail": !request.success, "decodedBodyLength": 0}}})
        }
        traceEvents.sort((o1, o2) => o1.ts - o2.ts);
        traceEvents.push({"pid":1,"tid":1,"ts":traceEvents[traceEvents.length - 1].ts + 1,"ph":"I","cat":"devtools.timeline"});
        return {
            traceEvents: traceEvents
        };
    }

}
