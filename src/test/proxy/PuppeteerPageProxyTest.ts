import {launch, Request} from "puppeteer";
import * as url from "url";
import * as http from "http";
import {IncomingMessage} from "http";
import * as https from "https";
import * as HttpProxyAgent from 'http-proxy-agent';
import * as HttpsProxyAgent from 'https-proxy-agent';
import * as stream from "stream";
import * as util from "util";
import * as zlib from "zlib";

// https://stackoverflow.com/questions/21491567/how-to-implement-a-writable-stream
function BufferStream() {
    // this.receiveLen = 0;
    this.chunks = [];
    stream.Writable.call(this);
}
util.inherits(BufferStream, stream.Writable);
BufferStream.prototype._write = function (chunk, encoding, done) {
    this.chunks.push(chunk);
    // if (this.receiveLen == 0) {
    //     this._waitReceiveLoop();
    // }
    // this.receiveLen += chunk.length;
    done();
};
// BufferStream.prototype._waitReceiveLoop = function () {
//     const waitReceiveLoop = (lastReceiveLen) => {
//         setTimeout(() => {
//             if (this.receiveLen == lastReceiveLen) {
//                 this.emit("close");
//             }
//             else {
//                 waitReceiveLoop(this.receiveLen);
//             }
//         }, 1000);
//     };
//     waitReceiveLoop(this.receiveLen);
// };
BufferStream.prototype.toBuffer = function (): Buffer {
    return Buffer.concat(this.chunks);
};

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true,
        // args: [ '--proxy-server=127.0.0.1:2007' ]
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});
    await page.setRequestInterception(true);
    page.on("request", (req: Request) => {
        if (req.url().startsWith("http")) {
            // req.continue({
            //     url: "http://localhost:3000/proxy?url=" + encodeURIComponent(req.url()) + "&proxy=" + encodeURIComponent("http://127.0.0.1:2007") + "&headers=" + encodeURIComponent(JSON.stringify(req.headers())),
            //     postData: req.postData()
            // });

            const options = url.parse(req.url());
            options["method"] = req.method();
            options["headers"] = req.headers();

            const resHandler = (proxyRes: IncomingMessage) => {
                let pipes: stream = proxyRes;
                const contentEncodings = (proxyRes.headers["content-encoding"] || "").split(/, ?/).filter(item => item != "").reverse();
                for (let contentEncoding of contentEncodings) {
                    switch (contentEncoding) {
                        case "gzip":
                        case "x-gzip":
                            pipes = pipes.pipe(zlib.createGunzip());
                            break;
                        case "br":
                            pipes = pipes.pipe(zlib.createBrotliDecompress());
                            break;
                        case "":
                            pipes = pipes.pipe(zlib.createInflate());
                            break;
                    }
                }

                // const contentLen = parseInt(proxyRes.headers["content-length"]);
                // let receiveLen = 0;
                // if (!isNaN(contentLen)) {
                //     if (proxyRes == pipes) {
                //         proxyRes.on("data", chunk => {
                //             receiveLen += chunk.length;
                //             if (receiveLen >= contentLen) {
                //                 pipes.emit("close");
                //             }
                //         });
                //     }
                //     else {
                //         proxyRes.on("data", chunk => {
                //             receiveLen += chunk.length;
                //         });
                //         pipes.on("data", chunk => {
                //             if (receiveLen >= contentLen) {
                //                 pipes.emit("close");
                //             }
                //         });
                //     }
                // }

                const bufferStream = new BufferStream();
                pipes.pipe(bufferStream);
                pipes.once("close", () => {
                    const statusCode = proxyRes.statusCode;
                    const headers = proxyRes.headers;
                    delete headers["set-cookie"];
                    const body = bufferStream.toBuffer();
                    req.respond({
                        status: statusCode,
                        headers: headers as any,
                        body: body
                    }).catch(err => {});
                    proxyRes.destroy();
                });
            };

            const proxy = "http://127.0.0.1:2007";
            let proxyReq;
            if (options.protocol == "http:") {
                options["agent"] = new HttpProxyAgent(proxy);
                proxyReq = http.request(options, resHandler);
            }
            else {
                options["agent"] = new HttpsProxyAgent(proxy);
                proxyReq = https.request(options, resHandler);
            }

            const postData = req.postData();
            if (postData) {
                proxyReq.write(postData);
            }
            proxyReq.end();
        }
        else {
            req.continue().catch(err => {});
        }
    });
    // page.on("response", resp => {
    //     if (resp.fromCache()) {
    //         console.log(
    //             "Received: " +
    //             resp.fromCache() +
    //             " " +
    //             resp.status() +
    //             " " +
    //             resp.url()
    //         );
    //     }
    // });
    await page.goto("https://www.bilibili.com/");
    // await page.goto("https://www.google.com/");
    console.log();
})();
