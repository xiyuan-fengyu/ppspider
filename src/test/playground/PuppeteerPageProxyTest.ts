import {launch, Request} from "puppeteer";
import * as url from "url";
import * as http from "http";
import {IncomingMessage} from "http";
import * as https from "https";
import * as HttpProxyAgent from 'http-proxy-agent';
import * as HttpsProxyAgent from 'https-proxy-agent';

// https://stackoverflow.com/questions/21491567/how-to-implement-a-writable-stream
const stream = require('stream');
const util = require('util');
function ResStream () {
    this.chunks = [];
    stream.Writable.call(this);
}
util.inherits(ResStream, stream.Writable);
ResStream.prototype._write = function (chunk, encoding, done) {
    this.chunks.push(chunk);
    done();
};
ResStream.prototype.getBody = function () {
    return Buffer.concat(this.chunks);
};

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true,
        args: [ '--proxy-server=127.0.0.1:3000' ]
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});
    // await page.setRequestInterception(true);
    // page.on("request", (req: Request) => {
    //     if (req.url().startsWith("http")) {
    //         const reqInfo = {
    //             id: req["_requestId"],
    //             url: req.url(),
    //             method: req.method(),
    //             headers: req.headers(),
    //             postData: req.postData(),
    //             proxy: "http://127.0.0.1:2007"
    //         };
    //
    //         const options = url.parse(reqInfo.url);
    //         options["method"] = reqInfo.method;
    //         options["headers"] = reqInfo.headers;
    //
    //         const resHandler = (proxyRes: IncomingMessage) => {
    //             const stream = new ResStream();
    //             proxyRes.pipe(stream as any);
    //             stream.on("finish", () => {
    //                 const body = stream.getBody();
    //                 req.respond({
    //                     status: proxyRes.statusCode,
    //                     headers: proxyRes.headers as any,
    //                     body: body
    //                 });
    //             });
    //             stream.on("error", (err: Error) => {
    //                 req.abort("failed");
    //             });
    //         };
    //
    //         const proxy = reqInfo.proxy;
    //         let proxyReq;
    //         if (options.protocol == "http:") {
    //             options["agent"] = new HttpProxyAgent(proxy);
    //             proxyReq = http.request(options, resHandler);
    //         }
    //         else {
    //             options["agent"] = new HttpsProxyAgent(proxy);
    //             proxyReq = https.request(options, resHandler);
    //         }
    //
    //         if (reqInfo.postData) {
    //             proxyReq.write(reqInfo.postData);
    //         }
    //         proxyReq.end();
    //     }
    //     else {
    //         req.continue();
    //     }
    // });
    page.on("response", resp => {
        if (resp.fromCache()) {
            console.log(
                "Received: " +
                resp.fromCache() +
                " " +
                resp.status() +
                " " +
                resp.url()
            );
        }
    });
    await page.goto("https://www.bilibili.com/");
    // await page.goto("https://www.google.com/");
    console.log();
})();
