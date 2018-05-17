import {DownloadUtil} from "../../common/util/DownloadUtil";
import * as os from "os";
import {Page, Request, Response, Viewport} from "puppeteer";
import {FileUtil} from "../../common/util/FileUtil";
import * as fs from "fs";

export type ResponseListener = (response: Response) => any;

export enum DownloadImgError {
    ImgNotFound = "ImgNotFound",
    DownloadFail = "DownloadFail",
    MkdirsFail = "MkdirsFail",
    WriteFileFail = "WriteFileFail",
}

export type DownloadImgResult = {
    success: boolean;
    cost: number;
    savePath?: string;
    error?: DownloadImgError;
    status?: number;
};

const kRequestInterceptionNum = "_requestInterceptionNum";
const kRequestInterception_ImgLoad = "_requestListener_imgLoad";

const kResponseCheckUrls = "_responseCheckUrls";
const kResponseListener = "_responseListener";

const onePxBuffer = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 12, 73, 68, 65, 84, 24, 87, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53, 129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];

export class PuppeteerUtil {

    static async defaultViewPort(page: Page) {
        await page.setViewport({
            width: 1920,
            height: 1080
        });
    }

    static async addJquery(
        page: Page,
        url: string = "https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js",
        savePath = os.tmpdir() + "/jquery.min.js") {
        await DownloadUtil.download(url, savePath).then(async res => {
            if (res > 0) {
                await page.addScriptTag({
                    path: savePath
                });
            }
        });
    }

    static jsonInJsonp(jsonp: string): string {
        if (!jsonp) return "";
        const lIndex = jsonp.indexOf("({");
        const rIndex = jsonp.lastIndexOf("})");
        return lIndex > -1 && rIndex > -1 ? jsonp.substring(lIndex + 1, rIndex + 1) : "";
    }

    private static async requestInterceptionNumDelta(page: Page, delta: number) {
        let requestInterceptionNum = (page[kRequestInterceptionNum] || 0) + delta;
        if (requestInterceptionNum < 0) requestInterceptionNum = 0;
        page[kRequestInterceptionNum] = requestInterceptionNum;
        await page.setRequestInterception(requestInterceptionNum > 0);
    }

    static async setImgLoad(page: Page, enable: boolean) {
        await this.requestInterceptionNumDelta(page, enable ? -1 : 1);
        if (enable) {
            if (page[kRequestInterception_ImgLoad]) {
                page.removeListener("request", page[kRequestInterception_ImgLoad]);
            }
        }
        else {
            if (!page[kRequestInterception_ImgLoad]) {
                page[kRequestInterception_ImgLoad] = async (request: Request) => {
                    const interceptionHandled = request["_interceptionHandled"];
                    if (!interceptionHandled) {
                        if (request.resourceType() == "image") {
                            let responseCheckUrls = page[kResponseCheckUrls] || [];
                            if (responseCheckUrls.find(item => request.url().match(item.url) || item.url === request.url())) {
                                // 下载图片
                                request.continue();
                            }
                            else {
                                await request.respond({
                                    status: 200,
                                    contentType: "image/png",
                                    body: Buffer.from(onePxBuffer)
                                });
                            }
                        }
                        else request.continue();
                    }
                };
            }
            page.on("request", page[kRequestInterception_ImgLoad]);
        }
    }

    private static initResponseListener(page: Page): ResponseListener {
        let responseListener: ResponseListener = page[kResponseListener];
        if (!responseListener) {
            page[kResponseListener] = responseListener = (response: Response) => {
                let responseCheckUrls = page[kResponseCheckUrls] || [];
                const removes = [];
                for (let responseCheckUrl of responseCheckUrls) {
                    if (response.url().match(responseCheckUrl.url) || response.url() === responseCheckUrl.url) {
                        if (responseCheckUrl.once) {
                            removes.push(responseCheckUrl);
                        }
                        responseCheckUrl.listener(response);
                    }
                }
                for (let remove of removes) {
                    responseCheckUrls.splice(responseCheckUrls.indexOf(remove), 1);
                }
            };
            page.on("response", responseListener);
        }
        return responseListener;
    }

    static onResponse(page: Page, url: string | RegExp, listener: ResponseListener, once: boolean = false) {
        if (page == null || url == null || listener == null) return;

        let responseCheckUrls = page[kResponseCheckUrls];
        if (!responseCheckUrls) {
            page[kResponseCheckUrls] = responseCheckUrls = [];
        }
        responseCheckUrls.push({
            url: url,
            listener: listener,
            once: once
        });
        this.initResponseListener(page);
    }

    static onceResponce(page: Page, url: string | RegExp): Promise<Response> {
        return new Promise<Response>(resolve => {
            try {
                this.onResponse(page, url, resolve, true);
            }
            catch (e) {
                this.removeResponseListener(page, url);
                resolve(e);
            }
        });
    }

    static removeResponseListener(page: Page, url: string | RegExp) {
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

    static downloadImg(page: Page, imgSelector: string, saveDir: string): Promise<DownloadImgResult> {
        const time = new Date().getTime();
        return new Promise<DownloadImgResult>(async resolve => {
            const imgId = "img_" + time + parseInt("" + Math.random() * 10000);
            const imgSrc = await page.evaluate((selector, imgId) => {
                const img = document.querySelector(selector);
                if (img) {
                    window[imgId] = img;
                    return img.src;
                }
                return false;
            }, imgSelector, imgId);

            if (imgSrc) {
                const newImgSrc = imgSrc + (imgSrc.indexOf("?") == -1 ? "?" : "&");
                const waitRespnse = this.onceResponce(page, newImgSrc);
                await page.evaluate((imgId, newSrc) => {
                    window[imgId].src = newSrc;
                }, imgId, newImgSrc);
                await waitRespnse.then(async (response: Response) => {
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

}