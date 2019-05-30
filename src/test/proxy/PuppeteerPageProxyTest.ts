import {launch, Request, SetCookie} from "puppeteer";
import * as url from "url";
import * as http from "http";
import {IncomingMessage} from "http";
import * as https from "https";
import * as HttpProxyAgent from 'http-proxy-agent';
import * as HttpsProxyAgent from 'https-proxy-agent';
import * as stream from "stream";
import * as util from "util";
import * as zlib from "zlib";
import {logger} from "../..";

// https://stackoverflow.com/questions/21491567/how-to-implement-a-writable-stream
function BufferStream() {
    this.chunks = [];
    stream.Writable.call(this);
}
util.inherits(BufferStream, stream.Writable);
BufferStream.prototype._write = function (chunk, encoding, done) {
    this.chunks.push(chunk);
    done();
};
BufferStream.prototype.toBuffer = function (): Buffer {
    return Buffer.concat(this.chunks);
};

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});
    await page.setRequestInterception(true);
    page.on("request", async (req: Request) => {
        if (req["_interceptionHandled"]) {
            logger.warn(`request(${req.url()}) handled`);
            return;
        }
        else if (req.url().startsWith("http")) {
            if (!req.isNavigationRequest()) {
                const responseCache = await page.evaluate(url => {
                    const cache = localStorage.getItem(url);
                    if (cache) {
                        if (parseInt(cache.substring(0, cache.indexOf("\n"))) <= new Date().getTime()) {
                            // 已过期
                            localStorage.removeItem(url);
                        }
                        else {
                            return cache;
                        }
                    }
                }, req.url());
                if (responseCache) {
                    let [expires, statusCodeStr, bodyBase64] = responseCache.split("\n");
                    const statusCode = +statusCodeStr;
                    const body = Buffer.from(bodyBase64, "base64");
                    return req.respond({
                        status: statusCode,
                        headers: {
                            cache: "from-local-storage"
                        },
                        body: body
                    });
                }
            }

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
                        case "deflate":
                            pipes = pipes.pipe(zlib.createInflate());
                            break;
                    }
                }

                let lastReceiveTime = 0;
                pipes.on("data", () => {
                    lastReceiveTime = new Date().getTime();
                    setTimeout(() => {
                        if (new Date().getTime() - lastReceiveTime >= 495) {
                            pipes.emit("close");
                        }
                    }, 500);
                });

                const bufferStream = new BufferStream();
                pipes.pipe(bufferStream);
                pipes.once("close", () => {
                    const statusCode = proxyRes.statusCode;
                    const headers = proxyRes.headers;
                    for (let name in headers) {
                        const value = headers[name];

                        if (name == "set-cookie") {
                            if (value.length == 0) {
                                headers[name] = ("" + value[0]) as any;
                            }
                            else {
                                const setCookies: SetCookie[] = [];
                                for (let item of value) {
                                    const setCookie: SetCookie = {
                                        name: null,
                                        value: null
                                    };
                                    item.split("; ").forEach((keyVal, keyValI) => {
                                        const eqI = keyVal.indexOf("=");
                                        let key;
                                        let value;
                                        if (eqI > -1) {
                                            key = keyVal.substring(0, eqI);
                                            value = keyVal.substring(eqI + 1);
                                        }
                                        else {
                                            key = keyVal;
                                            value = "";
                                        }
                                        const lowerKey = key.toLowerCase();

                                        if (keyValI == 0) {
                                            setCookie.name = key;
                                            setCookie.value = value;
                                        }
                                        else if (lowerKey == "expires") {
                                            const expires = new Date(value).getTime();
                                            if (!isNaN(expires)) {
                                                setCookie.expires = +(expires / 1000).toFixed(0);
                                            }
                                        }
                                        else if (lowerKey == "max-age") {
                                            const expires = +value;
                                            if (!isNaN(expires)) {
                                                setCookie.expires = expires;
                                            }
                                        }
                                        else if (lowerKey == "path" || key == "domain") {
                                            setCookie[lowerKey] = value;
                                        }
                                        else if (lowerKey == "samesite") {
                                            setCookie.httpOnly = true;
                                        }
                                        else if (lowerKey == "httponly") {
                                            setCookie.httpOnly = true;
                                        }
                                        else if (lowerKey == "secure") {
                                            setCookie.secure = true;
                                        }
                                    });
                                    setCookies.push(setCookie);
                                }
                                page.setCookie(...setCookies).catch(err => {});
                                delete headers[name];
                            }
                        }
                        else if (typeof value != "string") {
                            if (value instanceof Array) {
                                headers[name] = JSON.stringify(value);
                            }
                            else {
                                headers[name] = "" + value;
                            }
                        }
                    }
                    const body = bufferStream.toBuffer();

                    req.respond({
                        status: statusCode,
                        headers: headers as any,
                        body: body
                    }).catch(err => {});

                    //  如果有 Expires ，则保存缓存
                    const expires = new Date(headers.expires).getTime();
                    if (expires > new Date().getTime()) {
                        const bodyBase64 = body.toString("base64");
                        const responseCache = `${expires}\n${statusCode}\n${bodyBase64}`;
                        page.evaluate((url, responseCache) => {
                            localStorage.setItem(url, responseCache);
                        }, req.url(), responseCache).catch(err => {});
                    }

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
    await page.goto("https://www.bilibili.com/");
    // await page.goto("https://www.google.com/");
    console.log();
})();
