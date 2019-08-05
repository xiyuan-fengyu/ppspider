import * as os from "os";
import {Frame, Page, Request, Response, SetCookie} from "puppeteer";
import * as fs from "fs";
import {DownloadUtil} from "../common/util/DownloadUtil";
import {logger} from "../common/util/logger";
import {FileUtil} from "../common/util/FileUtil";
import * as http from "http";
import {RequestUtil} from "../common/util/RequestUtil";
import {PromiseUtil} from "..";


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
        page: Page | Frame,
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
                page[kRequestInterception_ImgLoad] = async (request: Request) => {
                    if (!request["_interceptionHandled"] && request["_allowInterception"]) {
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
                            }
                            else {
                                // 拦截请求，直接返回 1px 的webp图片
                                await request.respond({
                                    status: 200,
                                    contentType: "image/webp",
                                    body: Buffer.from(onePxBuffer)
                                });
                            }
                        }
                        else if (requestUrl.indexOf("://hm.baidu.com/h.js") > -1) {
                            // 禁用百度统计代码
                            // 当禁止图片加载的时候，百度统计可能导致资源一直加载，page.goto操作一直无法完成
                            await request.respond({
                                status: 200,
                                contentType: "application/javascript",
                                body: Buffer.from([])
                            });
                        }
                        else {
                            // 其他请求，直接放行
                        }
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
    static downloadImg(page: Page | Frame, selectorOrSrc: string, saveDir: string, timeout: number = 30000): Promise<DownloadImgResult> {
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
                let topFrame = this.getIFramePage(page);
                const waitRespnse = PuppeteerUtil.onceResponse(topFrame, newImgSrc, async (response: Response) => {
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
    static async links(page: Page | Frame, predicts: LinkPredictMap, onlyAddToFirstMatch: boolean = true) {
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
    static count(page: Page | Frame, selector: string): Promise<number> {
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
    static async specifyIdByJquery(page: Page | Frame, selector: string): Promise<string[]> {
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
    static scrollToBottom(page: Page | Frame, scrollTimeout: number = 30000, scrollInterval: number = 250, scrollYDelta: number = 500) {
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

                if (req["_interceptionHandled"] || !req["_allowInterception"]) {
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
                            await req.respond({
                                status: statusCode,
                                headers: {
                                    cache: "from-local-storage"
                                },
                                body: body
                            });
                            return;
                        }
                    }

                    const options = {
                        url: req.url(),
                        method: req.method(),
                        headers: req.headers(),
                        body: req.postData(),
                        proxy: proxy
                    };

                    try {
                        if (options.headers && (options.headers.cookie == null || options.headers.Cookie == null)) {
                            // 设置cookie
                            const cookies = await page.cookies(options.url);
                            if (cookies.length) {
                                // console.log(options.url + "\n"
                                //     + cookies.map(item => item.name + "=" + item.value + "; domain=" + item.domain).join("\n") + "\n");
                                options.headers.cookie = cookies.map(item =>
                                    item.name + "=" + item.value).join("; ");
                            }
                        }
                        const proxyRes = await RequestUtil.simple(options);
                        const headers = proxyRes.headers;
                        // 处理返回结果的 header；主要是处理 set-cookie
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
                                                if (!setCookie.expires) {
                                                    const expires = +value;
                                                    if (!isNaN(expires)) {
                                                        setCookie.expires = expires;
                                                    }
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
                                        headers["set-cookie-" + setCookies.length] = item;
                                        setCookies.push(setCookie);
                                    }
                                    await page.setCookie(...setCookies).catch(err => {});
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

                        if (!req.isNavigationRequest()) {
                            // nav请求始终不缓存
                            //  如果有 Expires ，则保存缓存
                            const expires = new Date(headers.expires || headers.Expires as string).getTime();
                            if (enableCache && expires > new Date().getTime()) {
                                const bodyBase64 = proxyRes.body.toString("base64");
                                const responseCache = `${expires}\n${proxyRes.status}\n${bodyBase64}`;
                                await page.evaluate((url, responseCache) => {
                                    localStorage.setItem(url, responseCache);
                                }, req.url(), responseCache).catch(err => {});
                            }
                        }

                        await req.respond(proxyRes as any).catch(err => {});
                    }
                    catch(err) {
                        await req.abort("failed").catch(err => {});
                    }
                }
            };
            page.on("request", _proxyHandler);
        }
    }

    static triggerAndWaitRequest(page: Page, trigger: () => any, predict: (url: string) => any, timeout: number = 1000, printReqUrlLog: boolean = false) {
        return new Promise<Request>(async resolve => {
            const handler = (req: Request) => {
                printReqUrlLog && logger.debug(req.url());
                if (predict(req.url())) {
                    page.off("request", handler);
                    resolve(req);
                }
            };
            page.on("request", handler);
            await trigger();
            setTimeout(() => {
                resolve(null);
            }, timeout);
        });
    }

    static triggerAndWaitResponse(page: Page, trigger: () => any, predict: (url: string) => any, timeout: number = 1000, printResUrlLog: boolean = false) {
        return new Promise<Response>(async resolve => {
            const handler = (res: Response) => {
                printResUrlLog && logger.debug(res.url());
                if (predict(res.url())) {
                    page.off("response", handler);
                    resolve(res);
                }
            };
            page.on("response", handler);
            await trigger();
            setTimeout(() => {
                resolve(null);
            }, timeout);
        });
    }

    private static getIFramePage(pageOrFrame: Page | Frame): Page {
        // 如果 page 是一个 iframe，需要该iframe相对top frame的位置
        let curFrame = pageOrFrame as any;
        let parentFrame: Page | Frame;
        while (curFrame.parentFrame && (parentFrame = curFrame.parentFrame())) {
            curFrame = parentFrame;
        }
        return curFrame as Page;
    }

    private static async getIFramePageAndPos(pageOrFrame: Page | Frame): Promise<[Page, number, number]> {
        // 如果 page 是一个 iframe，需要该iframe相对top frame的位置
        let frameLeft = 0;
        let frameTop = 0;
        let curFrame = pageOrFrame as any;
        let parentFrame: Page | Frame;
        while (curFrame.parentFrame && (parentFrame = curFrame.parentFrame())) {
            const curFrameName = (curFrame as Frame).name();
            const [curFrameDomLeft, curFrameDomTop] = await parentFrame.evaluate(frameName => {
                const rect = document.querySelector(`iframe[name='${frameName}']`).getBoundingClientRect();
                return [rect.left, rect.top];
            }, curFrameName);
            frameLeft += curFrameDomLeft;
            frameTop += curFrameDomTop;
            curFrame = parentFrame;
        }
        return [curFrame as Page, frameLeft, frameTop];
    }

    /**
     * 模拟 ease-in-out 缓动
     * 参考 https://www.cnblogs.com/cloudgamer/archive/2009/01/06/Tween.html
     * 使用 sin 来模拟时间和位置的关系
     * s = [sin(PI * (t - T / 2) / T) + 1] * S / 2 + S0
     * @param T 整个运动持续时间(单位：秒)
     * @param fromS 整个运动的起始位置(单位：像素px)
     * @param toS 整个运动的结束位置(单位：像素px)
     * @param tStep 步进时长(单位：秒)
     */
    private static easeInOutBySin(T: number, fromS: number, toS: number, tStep: number = 0.05) {
        const path = [];
        for (let t = 0; t <= T; t += tStep) {
            const s = (Math.sin(Math.PI * (t - T / 2) / T) + 1) * (toS - fromS) / 2 + fromS;
            path.push(s);
        }
        return path;
    }

    private static randomYs(fromY: number, toY: number, steps: number, stepOffset: number = 1, maxOffset: number = 4) {
        const endSteps = maxOffset / stepOffset;
        const path = [fromY];
        let curY = fromY;
        const stepOffsets = [-stepOffset, 0, stepOffset];
        for (let i = 1; i < steps - 1; i++) {
            if (i + endSteps >= steps) {
                const newY = curY + (toY - curY) / (steps - i);
                if (Math.abs(newY - curY) > maxOffset) {
                    curY = newY;
                }
            }
            else {
                curY += stepOffsets[Math.floor(Math.random() * stepOffsets.length)];
            }
            path.push(curY);
        }
        path.push(toY);
        return path;
    }

    static async drag(page: Page, from: number[], to: number[], duration: number = 0.6, steps: number = 30) {
        const xs = this.easeInOutBySin(duration, from[0], to[0], duration / steps);
        const ys = this.randomYs(from[1], to[1], steps);
        const newDragPath = [];
        for (let i = 0; i < xs.length; i++) {
            newDragPath.push([xs[i], ys[i] == null ? to[1] : ys[i]]);
        }

        // 拖动鼠标
        await page.mouse.move(newDragPath[0][0], newDragPath[0][1]);
        await page.mouse.down();
        for (let i = 1; i < newDragPath.length; i++) {
            await Promise.all([
                page.mouse.move(newDragPath[i][0], newDragPath[i][1], {steps: 1}),
                PromiseUtil.sleep(duration / steps * 1000)
            ]);
        }
        await page.mouse.up();
    }

    /**
     * 适用滑块验证码类型 https://login.taobao.com/member/login.jhtml
     * @param page
     * @param barSelector
     * @param wrapperSelector
     */
    static async dragBar(page: Page | Frame, barSelector: string, wrapperSelector: string) {
        const dragFromTo = await page.evaluate((barSelector: string, wrapperSelector: string) => {
            const bar = document.querySelector(barSelector);
            const wrapper = document.querySelector(wrapperSelector);
            const barRect = bar.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();
            const mDownPosL = Math.floor(barRect.width * (Math.random() * 0.5 + 0.25));
            const mDownPosT = Math.floor(barRect.height * (Math.random() * 0.5 + 0.25));
            const from = [
                barRect.left + mDownPosL,
                barRect.top + mDownPosT
            ];
            const to = [
                wrapperRect.left + wrapperRect.width + Math.floor( barRect.width * Math.random()),
                wrapperRect.top + Math.floor(wrapperRect.height * (Math.random() * 0.5 + 0.25))
            ];
            return [from, to];
        }, barSelector, wrapperSelector);

        const [topPage, frameLeft, frameTop] = await this.getIFramePageAndPos(page);
        if (frameLeft || frameTop) {
            dragFromTo[0][0] += frameLeft;
            dragFromTo[0][1] += frameTop;
            dragFromTo[1][0] += frameLeft;
            dragFromTo[1][1] += frameTop;
        }

        await this.drag(topPage, dragFromTo[0], dragFromTo[1], 0.45);
    }

    /**
     * 适用于拖动滑块拼图的类型 https://passport.bilibili.com/login
     * 算法研究参考 src/test/component/DragJigsaw.html
     * @param page
     * @param wrapperSelector 拼图验证码控件dom元素的selector
     * @param dragRect 可拖动的滑块控件的区域 [left, top, right, bottom] （相对于wrapperSelector）
     * @param clipRect 拼图区域，用于截图计算拖动偏移 [left, top, right, bottom] （相对于wrapperSelector）
     */
    static async dragJigsaw(
        page: Page | Frame,
        wrapperSelector: string,
        dragRect: [number, number, number, number],
        clipRect: [number, number, number, number]) {
        // 原位置，向右拖动5px，向右拖动10px，截取三张图片，通过三张截图计算出 拼图 和 缺图 位置
        const [topPage, frameLeft, frameTop] = await this.getIFramePageAndPos(page);
        const [wrapperLeft, wrapperTop] = await page.evaluate(wrapperSelector => {
            const rect = document.querySelector(wrapperSelector).getBoundingClientRect();
            return [rect.left, rect.top];
        }, wrapperSelector);

        dragRect[0] += frameLeft + wrapperLeft;
        dragRect[2] += frameLeft + wrapperLeft;
        dragRect[1] += frameTop + wrapperTop;
        dragRect[3] += frameTop + wrapperTop;

        clipRect[0] += frameLeft + wrapperLeft;
        clipRect[2] += frameLeft + wrapperLeft;
        clipRect[1] += frameTop + wrapperTop;
        clipRect[3] += frameTop + wrapperTop;

        const startPos = [
            Math.floor(dragRect[0] + Math.random() * (dragRect[2] - dragRect[0])),
            Math.floor(dragRect[1] + Math.random() * (dragRect[3] - dragRect[1]))
        ];

        await topPage.mouse.move(startPos[0], startPos[1]);
        const img0 = await topPage.screenshot({
            path: "img0.base64",
            encoding: "base64",
            type: "jpeg",
            quality: 100,
            clip: {
                x: clipRect[0],
                y: clipRect[1],
                width: clipRect[2] - clipRect[0],
                height: clipRect[3] - clipRect[1]
            }
        });

        await topPage.mouse.down();
        await topPage.mouse.move(startPos[0] + 5, startPos[1] - 2, {steps: 1});
        const img1 = await topPage.screenshot({
            path: "img1.base64",
            encoding: "base64",
            type: "jpeg",
            quality: 100,
            clip: {
                x: clipRect[0],
                y: clipRect[1],
                width: clipRect[2] - clipRect[0],
                height: clipRect[3] - clipRect[1]
            }
        });

        // 识别拖动距离
        const dragDistance = await page.evaluate(async (imgBase64_0, imgBase64_1) => {
            function createImgCanvas(imgSrc): Promise<[HTMLCanvasElement, CanvasRenderingContext2D]> {
                return new Promise(resolve => {
                    const img = document.createElement("img");
                    img.onload = () => {
                        const canvas = document.createElement("canvas");
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const context = canvas.getContext("2d");
                        context.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve([canvas, context]);
                    };
                    img.src = imgSrc;
                });
            }

            const [canvas0, context0] = await createImgCanvas("data:image/jpeg;base64, " + imgBase64_0);
            const [canvas1, context1] = await createImgCanvas("data:image/jpeg;base64, " + imgBase64_1);
            const context2 = null;

            // start
            const colorGray = colorArr => {
                const grayArr = [];
                for (let i = 0; i < colorArr.length; i += 4) {
                    // 灰度计算 参考 https://blog.csdn.net/xdrt81y/article/details/8289963
                    const gray = (colorArr[i] * 19595 + colorArr[i + 1] * 38469 + colorArr[i + 2] * 7472) >> 16;
                    grayArr.push(gray);
                }
                return grayArr;
            };

            const colorDiff = (arr0, arr1) => {
                const gray0 = colorGray(arr0);
                const gray1 = colorGray(arr1);
                let diff = 0;
                let diffCount = 0;
                for (let i = 0; i < gray0.length; i++) {
                    const delta = Math.abs(gray0[i] - gray1[i]);
                    diff += delta;
                    if (delta) {
                        diffCount++;
                    }
                }
                return diff / (diffCount || 1);
            };

            // 颜色混合
            // 参考 https://stackoverflow.com/questions/12011081/alpha-blending-2-rgba-colors-in-c
            const mixColor = (backRgba, frontRgba) => {
                const alpha = frontRgba[3] + 1;
                const invAlpha = 256 - frontRgba[3];
                return [
                    (alpha * frontRgba[0] + invAlpha * backRgba[0]) >> 8,
                    (alpha * frontRgba[1] + invAlpha * backRgba[1]) >> 8,
                    (alpha * frontRgba[2] + invAlpha * backRgba[2]) >> 8,
                    255
                ];
            };

            let maskL = null;
            let maskR = null;
            let maskT = null;
            let maskB = null;

            for (let x = 0; x < 80; x++) {
                const diff = colorDiff(
                    context0.getImageData(x, 0, 1, canvas0.height).data,
                    context1.getImageData(x, 0, 1, canvas0.height).data);
                if (diff > 20) {
                    if (maskL == null) {
                        maskL = x;
                    }
                    maskR = x;
                }
            }

            for (let y = 0; y < canvas0.height; y++) {
                const diff = colorDiff(
                    context0.getImageData(0, y, canvas0.width, 1).data,
                    context1.getImageData(0, y, canvas0.width, 1).data);
                if (diff > 20) {
                    if (maskT == null) {
                        maskT = y;
                    }
                    maskB = y;
                }
            }

            if (context2) {
                context2.fillStyle = `rgba(0,0,0,0.45)`;
                context2.fillRect(maskL, 0, 1, canvas0.height);
                context2.fillRect(maskR, 0, 1, canvas0.height);
                context2.fillRect(0, maskT, canvas0.width, 1);
                context2.fillRect(0, maskB, canvas0.width, 1);
            }

            // 只检验正中央的部分
            const centerCheckSize = 16;
            if (maskR - maskL >= centerCheckSize) {
                const delta = (maskR - maskL - centerCheckSize) / 2;
                maskL += delta;
                maskR -= delta;
            }
            if (maskB - maskT >= centerCheckSize) {
                const delta = (maskB - maskT - centerCheckSize) / 2;
                maskT += delta;
                maskB -= delta;
            }

            if (context2) {
                context2.fillStyle = `rgba(0,0,0,0.4)`;
                context2.fillRect(maskL, maskT, maskR - maskL, maskB - maskT);
            }

            const possibleDesRects = [];
            const maskColors = context0.getImageData(maskL, maskT, maskR - maskL, maskB - maskT).data;
            for (let alpha = 0.3; alpha <= 0.7; alpha += 0.05) {
                const grayMask = [0, 0, 0, 255 * alpha];
                const mixColors = [];
                for (let i = 0; i < maskColors.length; i += 4) {
                    const mixedColor = mixColor(maskColors.subarray(i, i + 4), grayMask);
                    mixedColor.forEach(item => mixColors.push(item));
                }
                for (let xDelta = 50; xDelta < canvas0.width - 50; xDelta++) {
                    const checkColors = context0.getImageData(maskL + xDelta, maskT, maskR - maskL, maskB - maskT).data;
                    const diff = colorDiff(mixColors, checkColors);
                    if (diff < 20) {
                        possibleDesRects.push({
                            diff: diff,
                            alpha: alpha,
                            delta: xDelta,
                            mask: {
                                left: maskL,
                                top: maskT,
                                right: maskR,
                                bottom: maskB
                            }
                        });
                    }
                }
            }
            if (possibleDesRects.length) {
                possibleDesRects.sort((o1, o2) => o1.diff - o2.diff);

                const bestDesRect = possibleDesRects[0];

                if (context2) {
                    context2.fillStyle = `rgba(255,120,0,0.4)`;
                    context2.fillRect(bestDesRect.delta + bestDesRect.mask.left, bestDesRect.mask.top,
                        bestDesRect.mask.right - bestDesRect.mask.left, bestDesRect.mask.bottom - bestDesRect.mask.top);
                    possibleDesRects.forEach(item => console.log(item));
                    console.log("拖动距离：" + bestDesRect.delta);
                }

                return bestDesRect.delta;
            }
            // end
        }, img0, img1);

        // 拖动到正确的位置
        const dur = Math.max(dragDistance / 300, 0.3);
        console.log(dragDistance, dur);
        await this.drag(topPage,
            [startPos[0] + 6, startPos[1] - 2],
            [startPos[0] + dragDistance + Math.random() * 2, startPos[1] + Math.random() * 2], dur);
    }

}