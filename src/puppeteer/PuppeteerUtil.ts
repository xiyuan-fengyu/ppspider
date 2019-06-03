import * as os from "os";
import {Page, Request, Response, SetCookie} from "puppeteer";
import * as fs from "fs";
import {DownloadUtil} from "../common/util/DownloadUtil";
import {logger} from "../common/util/logger";
import {FileUtil} from "../common/util/FileUtil";
import * as url from "url";
import {IncomingMessage} from "http";
import * as stream from "stream";
import * as zlib from "zlib";
import * as http from "http";
import * as https from "https";
import * as HttpProxyAgent from 'http-proxy-agent';
import * as HttpsProxyAgent from 'https-proxy-agent';
import * as util from "util";



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



export type ResponseListener = (response: Response) => any;

export enum DownloadImgError {
    Timeout = "Timeout",
    ImgNotFound = "ImgNotFound",
    DownloadFail = "DownloadFail",
    MkdirsFail = "MkdirsFail",
    WriteFileFail = "WriteFileFail",
}

export type FireInfo = {
    max: number;
    cur: number;
}

export type DownloadImgResult = {
    success: boolean;
    cost: number;
    src?: string;
    size?: number;
    savePath?: string;
    error?: DownloadImgError;
    status?: number;
};

export type ResponseCheckUrlResult = {
    url: string | RegExp,
    fireInfo: FireInfo;
    timeout: number;
    isTimeout: boolean;
    error?: Error;
}

type ResponseCheckUrlInfo = {
    url: string | RegExp,
    listener: ResponseListener;
    resolve: (checkResult: ResponseCheckUrlResult) => any;
    fireInfo: FireInfo;
    timeout: number;
}

export type Selector = string;
export type Href = string;
export type HrefRegex = string | RegExp;
export type ElementTransformer = (ele: Element) => Href | void;
export type LinkPredict = HrefRegex | ElementTransformer | [Selector, HrefRegex | ElementTransformer];
export type LinkPredictMap = {
    [groupName: string]: LinkPredict
}

const kRequestInterception_ImgLoad = "_requestListener_imgLoad";

const kResponseCheckUrls = "_responseCheckUrls";
const kResponseListener = "_responseListener";

const onePxBuffer = [82, 73, 70, 70, 74, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 88, 10, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 65, 76, 80, 72, 12, 0, 0, 0, 1, 7, 16, 17, 253, 15, 68, 68, 255, 3, 0, 0, 86, 80, 56, 32, 24, 0, 0, 0, 48, 1, 0, 157, 1, 42, 1, 0, 1, 0, 3, 0, 52, 37, 164, 0, 3, 112, 0, 254, 251, 253, 80, 0];

export class PuppeteerUtil {

    /**
     * 设置Page默认的分辨率，1920 * 1080
     * @param {Page} page
     * @returns {Promise<void>}
     */
    static async defaultViewPort(page: Page) {
        await page.setViewport({
            width: 1920,
            height: 1080
        });
    }

    /**
     * 向 Page 中注入 jQuery，一定要在 await page.goto(url) 之后调用
     * @param {Page} page
     * @param {string} url
     * @param {string} savePath
     * @returns {Promise<void>}
     */
    static async addJquery(
        page: Page,
        url: string = "https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js",
        savePath = os.tmpdir() + "/jquery.min.js") {
        const jQueryExisted = await page.evaluate(() => {
           return typeof jQuery !== "undefined";
        });

        if (!jQueryExisted) {
            await DownloadUtil.download(url, savePath).then(async res => {
                if (res > 0) {
                    // 某些网站（例如twitter）因为安全问题会导致js注入失败，所以弃用这种方式
                    // await page.addScriptTag({
                    //     path: savePath
                    // });
                    const jQueryStr = fs.readFileSync(savePath, "utf-8");
                    await page.evaluate(jQueryStr => {
                        eval(jQueryStr);
                    }, jQueryStr);
                }
            });
        }
    }

    /**
     * 解析jsonp字符串中的json数据
     * @param {string} jsonp
     * @returns {any}
     */
    // noinspection JSUnusedGlobalSymbols
    static jsonp(jsonp: string): any {
        let index;
        if (jsonp == null || (index = jsonp.indexOf('(')) == -1) return {};
        try {
            const callbackName = jsonp.substring(0, index);
            const evalStr = `function ${callbackName}(arg) { return arg; }\n${jsonp}`;
            return eval(evalStr);
        }
        catch (e) {
            logger.warn(e);
            return {};
        }
    }

    /**
     * 是指是否阻止图片加载
     * @param {Page} page
     * @param {boolean} enable
     * @returns {Promise<void>}
     */
    static async setImgLoad(page: Page, enable: boolean) {
        if (enable) {
            if (page[kRequestInterception_ImgLoad]) {
                page.removeListener("request", page[kRequestInterception_ImgLoad]);
            }
        }
        else {
            await page.setRequestInterception(true);
            if (!page[kRequestInterception_ImgLoad]) {
                page[kRequestInterception_ImgLoad] = (request: Request) => {
                    const interceptionHandled = request["_interceptionHandled"];
                    if (!interceptionHandled) {
                        const requestUrl = request.url();
                        const resourceType = request.resourceType();
                        if (resourceType === "image") {
                            let responseCheckUrls: ResponseCheckUrlInfo[] = page[kResponseCheckUrls] || [];
                            if (responseCheckUrls.find(item => {
                                let checkUrl = item.url.toString();
                                if (checkUrl.startsWith("//")) checkUrl = requestUrl.split("//")[0] + checkUrl;
                                return requestUrl.match(checkUrl) != null || checkUrl === requestUrl;
                            })) {
                                // 下载图片，不阻止
                                request.continue();
                            }
                            else {
                                // 拦截请求，直接返回 1px 的webp图片
                                request.respond({
                                    status: 200,
                                    contentType: "image/webp",
                                    body: Buffer.from(onePxBuffer)
                                });
                            }
                        }
                        else if (requestUrl.indexOf("://hm.baidu.com/h.js") > -1) {
                            // 禁用百度统计代码
                            // 当禁止图片加载的时候，百度统计可能导致资源一直加载，page.goto操作一直无法完成
                            request.respond({
                                status: 200,
                                contentType: "application/javascript",
                                body: Buffer.from([])
                            });
                        }
                        else request.continue(); // 其他请求，直接放行
                    }
                };
            }
            page.on("request", page[kRequestInterception_ImgLoad]);
        }
    }

    private static initResponseListener(page: Page) {
        let responseListener: ResponseListener = page[kResponseListener];
        if (!responseListener) {
            page[kResponseListener] = responseListener = async (response: Response) => {
                const responseUrl = response.url();
                let responseCheckUrls: ResponseCheckUrlInfo[] = page[kResponseCheckUrls] || [];
                const removes = [];
                for (let responseCheckUrl of responseCheckUrls) {
                    let checkUrl = responseCheckUrl.url.toString();
                    if (checkUrl.startsWith("//")) checkUrl = responseUrl.split("//")[0] + checkUrl;
                    if (responseUrl === checkUrl || responseUrl.match(checkUrl)) {
                        try {
                            await responseCheckUrl.listener(response);
                        }
                        catch (e) {
                            console.warn(e);
                        }

                        responseCheckUrl.fireInfo.cur++;
                        if (responseCheckUrl.fireInfo.max > 0 && responseCheckUrl.fireInfo.cur >= responseCheckUrl.fireInfo.max) {
                            removes.push(responseCheckUrl);
                            responseCheckUrl.resolve({
                                url: responseCheckUrl.url,
                                fireInfo: responseCheckUrl.fireInfo,
                                timeout: responseCheckUrl.timeout,
                                isTimeout: false
                            });
                        }
                    }
                }
                for (let remove of removes) {
                    responseCheckUrls.splice(responseCheckUrls.indexOf(remove), 1);
                }
            };
            page.on("response", responseListener);
        }
    }

    private static addResponseCheckUrlInfo(page: Page, responseCheckUrlInfo: ResponseCheckUrlInfo) {
        if (page == null || responseCheckUrlInfo == null) return;

        let responseCheckUrls: ResponseCheckUrlInfo[] = page[kResponseCheckUrls];
        if (!responseCheckUrls) {
            page[kResponseCheckUrls] = responseCheckUrls = [];
        }
        responseCheckUrls.push(responseCheckUrlInfo);
        this.initResponseListener(page);
    }

    /**
     * 监听返回结果
     * @param {Page} page
     * @param {string | RegExp} url
     * @param {ResponseListener} listener
     * @param {number} fireMax
     * @param {number} timeout
     * @returns {Promise<ResponseCheckUrlResult>}
     */
    static onResponse(page: Page, url: string | RegExp, listener: ResponseListener, fireMax: number = -1, timeout: number = 30000): Promise<ResponseCheckUrlResult> {
        fireMax = parseInt("" + fireMax);
        return new Promise<ResponseCheckUrlResult>(resolve => {
            const fireInfo: FireInfo = {
                max: fireMax,
                cur: 0
            };
            const responseCheckUrl: ResponseCheckUrlInfo = {
                url: url,
                listener: listener,
                resolve: resolve,
                fireInfo: fireInfo,
                timeout: timeout
            };
            const responseCheckUrlRes: ResponseCheckUrlResult = {
                url: url,
                fireInfo: fireInfo,
                timeout: timeout,
                isTimeout: false
            };

            try {
                this.addResponseCheckUrlInfo(page, responseCheckUrl);

                if (fireMax > 0) {
                    setTimeout(() => {
                        responseCheckUrlRes.isTimeout = true;
                        resolve(responseCheckUrlRes);
                    }, timeout < 1000 ? 1000 : timeout);
                }
                else {
                    resolve(responseCheckUrlRes);
                }
            }
            catch (e) {
                this.removeResponseListener(page, url);
                responseCheckUrlRes.error = e;
                resolve(responseCheckUrlRes);
            }
        });
    }

    /**
     * 监听返回结果，监听成功一次后结束
     * @param {Page} page
     * @param {string | RegExp} url
     * @param {ResponseListener} listener
     * @param {number} timeout
     * @returns {Promise<ResponseCheckUrlResult>}
     */
    static onceResponse(page: Page, url: string | RegExp, listener: ResponseListener, timeout?: number): Promise<ResponseCheckUrlResult> {
        return this.onResponse(page, url, listener, 1, timeout);
    }

    private static removeResponseListener(page: Page, url: string | RegExp) {
        if (page == null || url == null) return;

        let responseCheckUrls = page[kResponseCheckUrls];
        if (responseCheckUrls) {
           while (true) {
               const index = responseCheckUrls.findIndex(item => item.url === url);
               if (index > -1) {
                    responseCheckUrls.splice(index, 1);
               }
               else break;
           }
        }
    }

    /**
     * 下载图片
     * @param {Page} page
     * @param {string} selectorOrSrc 图片的地址或者 img节点的css selector
     * @param {string} saveDir 图片保存目录
     * @param {number} timeout 超时时间
     * @returns {Promise<DownloadImgResult>}
     */
    static downloadImg(page: Page, selectorOrSrc: string, saveDir: string, timeout: number = 30000): Promise<DownloadImgResult> {
        const time = new Date().getTime();
        return new Promise<DownloadImgResult>(async resolve => {
            const imgId = "img_" + time + parseInt("" + Math.random() * 10000);
            const imgSrc: string = await page.evaluate((selectorOrSrc, imgId) => {
                try {
                    const isSrc = selectorOrSrc.startsWith("http") || selectorOrSrc.startsWith("//");
                    if (isSrc) {
                        const img = document.createElement("img");
                        img.id = imgId;
                        img.style.display = "none";
                        document.body.appendChild(img);
                        window[imgId] = img;
                        return selectorOrSrc;
                    }
                    else {
                        const img = document.querySelector(selectorOrSrc) as any;
                        if (img) {
                            window[imgId] = img;
                            return img.src;
                        }
                    }
                }
                catch (e) {
                    console.warn(e.stack);
                }
                return null;
            }, selectorOrSrc, imgId);

            if (imgSrc) {
                const newImgSrc = imgSrc + (imgSrc.indexOf("?") == -1 ? "?" : "&") + new Date().getTime() + "_" + (Math.random() * 10000).toFixed(0);
                const waitRespnse = PuppeteerUtil.onceResponse(page, newImgSrc, async (response: Response) => {
                    if (response.ok()) {
                        let saveName = null;
                        let suffix = "png";

                        const contentType = (await response.headers())["content-type"];
                        if (contentType && contentType.match("^image/.*")) {
                            suffix = contentType.substring(6);
                        }

                        let match;
                        if (match = imgSrc.match(".*/([^.?&/]+).*$")) {
                            saveName = match[1] + "." + suffix;
                        }

                        if (!saveName) saveName = new Date().getTime() + "_" + parseInt("" + Math.random() * 1000) + "." + suffix;
                        if (FileUtil.mkdirs(saveDir)) {
                            const savePath = (saveDir + (saveDir.endsWith("/") ? "" : "/") + saveName).replace(/\\/g, '/');
                            const buffer = await response.buffer();
                            fs.writeFile(savePath, buffer, err => {
                                if (err) {
                                    resolve({
                                        success: false,
                                        cost: new Date().getTime() - time,
                                        error: DownloadImgError.WriteFileFail
                                    });
                                }
                                else {
                                    resolve({
                                        success: true,
                                        cost: new Date().getTime() - time,
                                        src: imgSrc,
                                        size: buffer.length,
                                        savePath: savePath
                                    });
                                }
                            });
                        }
                        else {
                            resolve({
                                success: false,
                                cost: new Date().getTime() - time,
                                error: DownloadImgError.MkdirsFail
                            });
                        }
                    }
                    else {
                        resolve({
                            success: false,
                            cost: new Date().getTime() - time,
                            error: DownloadImgError.DownloadFail,
                            status: response.status()
                        });
                    }
                }, timeout);
                await page.evaluate((imgId, newSrc) => {
                    window[imgId].src = newSrc;
                }, imgId, newImgSrc);
                await waitRespnse.then(res => {
                    if (res.isTimeout) {
                        resolve({
                            success: false,
                            cost: new Date().getTime() - time,
                            error: DownloadImgError.Timeout
                        });
                    }
                });
            }
            else {
                resolve({
                    success: false,
                    cost: new Date().getTime() - time,
                    error: DownloadImgError.ImgNotFound
                });
            }
        });
    }

    /**
     * 获取符合要求的url
     * @param {Page} page
     * @param {LinkPredictMap} predicts
     * @param {boolean} onlyAddToFirstMatch 是否只添加到第一个匹配的列表中
     * @returns {Promise<any>}
     */
    static async links(page: Page, predicts: LinkPredictMap, onlyAddToFirstMatch: boolean = true) {
        if (predicts == null || Object.keys(predicts).length == 0) return {};

        const predictStrMap: any = {};
        for (let groupName of Object.keys(predicts)) {
            const predict = predicts[groupName];
            if (predict.constructor == Array) {
                let predictExp = predict[1];
                if (predictExp instanceof RegExp) {
                    predictExp = predictExp.toString();
                    predictExp = predictExp.substring(1, predictExp.lastIndexOf('/'));
                }
                predictStrMap[groupName] = [
                    predict[0],
                    (typeof predict[1] === "function" ? "function" : "string") + " " + (predictExp || "")
                ];
            }
            else {
                let predictExp = predict;
                if (predictExp instanceof RegExp) {
                    predictExp = predictExp.toString();
                    predictExp = predictExp.substring(1, predictExp.lastIndexOf('/'));
                }
                predictStrMap[groupName] = (typeof predict === "function" ? "function" : "string") + " " + (predictExp || "");
            }
        }
        return await page.evaluate((predictStrMap, onlyAddToFirstMatch) => {
            const hrefs = {};
            const existed = {};
            const all = document.querySelectorAll("a") || [];
            for (let groupName of Object.keys(predictStrMap)) {
                const predict = predictStrMap[groupName];
                let selector = null;
                let predictStr = null;
                let predictRegOrFun = null;
                if (predict.constructor == Array) {
                    selector = predict[0];
                    predictStr = predict[1];
                }
                else predictStr = predict;

                const spaceI = predictStr.indexOf(' ');
                const predictType = predictStr.substring(0, spaceI);
                const predictRegPrFunStr = predictStr.substring(spaceI + 1);
                if (predictType == "function") {
                    eval("predictRegOrFun = " + predictRegPrFunStr);
                }
                else predictRegOrFun = predictRegPrFunStr;

                const aArr = selector ? (document.querySelectorAll(selector) || []) : all;
                const matchHrefs = {};
                for (let a of aArr) {
                    let href = (a as any).href;
                    if (!onlyAddToFirstMatch || !existed[href]) {
                        let match = false;
                        if (typeof predictRegOrFun == 'function') {
                            if (href = predictRegOrFun(a)) {
                                match = true;
                            }
                        }
                        else {
                            if (href.match(predictRegOrFun)) match = true;
                        }
                        if (match) {
                            matchHrefs[href] = true;
                            if (onlyAddToFirstMatch) {
                                existed[href] = true;
                            }
                        }
                    }
                }
                hrefs[groupName] = Object.keys(matchHrefs);
            }
            return hrefs;
        }, predictStrMap, onlyAddToFirstMatch);
    }

    /**
     * 获取 满足 css selector 的节点个数
     * @param {Page} page
     * @param {string} selector
     * @returns {Promise<number>}
     */
    static count(page: Page, selector: string): Promise<number> {
        return page.evaluate(selector => {
            const doms = document.querySelectorAll(selector);
            if (doms) return doms.length;
            else return 0;
        }, selector);
    }

    /**
     * 通过 jQuery 找到符合 css selector 的所有节点，并给其中没有id属性的节点设置特殊的id，并返回所有节点的id
     * @param {Page} page
     * @param {string} selector
     * @returns {Promise<string[]>}
     */
    static async specifyIdByJquery(page: Page, selector: string): Promise<string[]> {
        await this.addJquery(page);
        return await page.evaluate(selector => {
           const $items = jQuery(selector);
           if ($items.length) {
               const ids = [];
               for (let i = 0; i < $items.length; i++) {
                   const $item = $($items[i]);
                   const id = $item.attr("id");
                   if (id) {
                       ids.push(id);
                   }
                   else {
                       const specialId = "special_" + new Date().getTime() + "_" + (Math.random() * 99999).toFixed(0) + "_" + i;
                       $item.attr("id", specialId);
                       ids.push(specialId);
                   }
               }
               return ids;
           }
           else return null;
        }, selector);
    }

    /**
     * 滚动到最底部，特殊的滚动需求可以参考这个自行编写
     * @param {Page} page
     * @param {number} scrollTimeout
     * @param {number} scrollInterval
     * @param {number} scrollYDelta
     * @returns {Promise<boolean>}
     */
    static scrollToBottom(page: Page, scrollTimeout: number = 30000, scrollInterval: number = 250, scrollYDelta: number = 500) {
        return new Promise<boolean>( resolve => {
            if (scrollTimeout > 0) {
                setTimeout(() => {
                    resolve(false);
                }, scrollTimeout);
            }

            let lastScrollY;
            let scrollYEqualNum = 0;
            const scrollAndCheck = () => {
                page.evaluate((scrollYDelta) => {
                    window.scrollBy(0, scrollYDelta);
                    return window.scrollY;
                }, scrollYDelta).then(scrollY => {
                    if (lastScrollY == scrollY) {
                        scrollYEqualNum++;
                        if (scrollYEqualNum >= 4) {
                            resolve(true);
                        }
                        else setTimeout(scrollAndCheck, 250);
                    }
                    else {
                        scrollYEqualNum = 0;
                        lastScrollY = scrollY;
                        setTimeout(scrollAndCheck, scrollInterval);
                    }
                });
            };
            scrollAndCheck();
        });
    }

    /**
     * 解析cookies
     * @param cookiesStr 通过 chrome -> 按下F12打开开发者面板 -> Application面板 -> Storage:Cookies:<SomeUrl> -> 右侧cookie详情面板 -> 鼠标选中所有，Ctrl+c 复制所有
     */
    static parseCookies(cookiesStr: string) {
        const cookieLines = cookiesStr.split("\n");
        const cookies: SetCookie[] = [];
        const expiresToSeconds = expires => {
            try {
                const time = new Date(expires).getTime();
                if (!isNaN(time)) {
                    return time / 1000;
                }
            }
            catch (e) {
            }
            return undefined;
        };
        cookieLines.forEach(cookieLine => {
            if (cookieLine && cookieLine.trim()) {
                const [name, value, domain, path, expires, size, http, secure, sameSite] = cookieLine.split("\t");
                cookies.push({
                    name: name,
                    value: value,
                    domain: domain,
                    path: path,
                    expires: expiresToSeconds(expires),
                    httpOnly: http === "✓",
                    secure: secure === "✓",
                    sameSite: sameSite
                } as SetCookie);
            }
        });
        return cookies;
    }

    /**
     * 页面使用单独的proxy
     * @param page
     * @param proxy 代理服务器地址，例如：http://127.0.0.1:2007
     * @param enableCache 代理请求的过程中是否启用缓存
     */
    static async useProxy(page: Page, proxy: string, enableCache: boolean = true) {
        page["_proxy"] = proxy;
        page["_enableCacheInProxy"] = enableCache;
        await page.setRequestInterception(true);
        if (!page["_proxyHandler"]) {
            const _proxyHandler = async (req: Request) => {
                const proxy = page["_proxy"];
                const enableCache = page["_enableCacheInProxy"];

                if (req["_interceptionHandled"]) {
                    logger.warn(`request(${req.url()}) handled`);
                    return;
                }
                else if (proxy && req.url().startsWith("http")) {
                    if (!req.isNavigationRequest()) {
                        // nav请求始终不缓存
                        const responseCache = enableCache ? await page.evaluate(url => {
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
                        }, req.url()).catch(err => {}) : null;
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
                    options["headers"] = req.headers() || {};
                    // 解决一些请求（例如 https://www.google.com/）响应头既不包含 content-length，又不包含 transfer-encoding:chunked 的情况
                    // 支持 br 的node版本较高，所以这里不启用br
                    options["headers"]["accept-encoding"] = "identity, gzip, deflate";

                    const resHandler = (proxyRes: IncomingMessage) => {
                        let pipes: stream = proxyRes;
                        const contentEncodings = (proxyRes.headers["content-encoding"] || "").split(/, ?/).filter(item => item != "").reverse();
                        for (let contentEncoding of contentEncodings) {
                            switch (contentEncoding) {
                                case "gzip":
                                    pipes = pipes.pipe(zlib.createGunzip());
                                    break;
                                // case "br":
                                //     pipes = pipes.pipe(zlib.createBrotliDecompress());
                                //     break;
                                case "deflate":
                                    pipes = pipes.pipe(zlib.createInflate());
                                    break;
                            }
                        }

                        const bodyStream = new BufferStream();
                        const onBodyEnd = () => {
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
                            const body = bodyStream.toBuffer();

                            req.respond({
                                status: statusCode,
                                headers: headers as any,
                                body: body
                            }).catch(err => {});

                            //  如果有 Expires ，则保存缓存
                            const expires = new Date(headers.expires).getTime();
                            if (enableCache && expires > new Date().getTime()) {
                                const bodyBase64 = body.toString("base64");
                                const responseCache = `${expires}\n${statusCode}\n${bodyBase64}`;
                                page.evaluate((url, responseCache) => {
                                    localStorage.setItem(url, responseCache);
                                }, req.url(), responseCache).catch(err => {});
                            }

                            proxyRes.destroy();
                        };

                        let contentLength = +proxyRes.headers["content-length"];
                        isNaN(contentLength) && (contentLength = -1);
                        if (contentLength == 0) {
                            onBodyEnd();
                        }
                        else {
                            if (contentLength > 0) {
                                let receiveLen = 0;
                                proxyRes.on("data", chunk => {
                                    receiveLen += chunk.length;
                                    if (receiveLen >= contentLength) {
                                        setTimeout(() => {
                                            proxyRes.emit("close");
                                        }, 0);
                                    }
                                });
                            }
                            else {
                                // transfer-encoding:chunked
                                // const transferEncoding = proxyRes.headers["transfer-encoding"];
                                // transferEncoding == null;
                            }

                            pipes.pipe(bodyStream);
                            pipes.once("close", onBodyEnd);
                        }
                    };

                    let proxyReq;
                    if (options.protocol == "http:") {
                        options["agent"] = new HttpProxyAgent(proxy);
                        proxyReq = http.request(options, resHandler);
                    }
                    else {
                        options["agent"] = new HttpsProxyAgent(proxy);
                        proxyReq = https.request(options, resHandler);
                    }
                    proxyReq.on("error", err => {
                        req.abort("failed").catch(err => {});
                    });

                    const postData = req.postData();
                    if (postData) {
                        proxyReq.write(postData);
                    }
                    proxyReq.end();
                }
                else {
                    req.continue().catch(err => {});
                }
            };
            page.on("request", _proxyHandler);
        }
    }

}