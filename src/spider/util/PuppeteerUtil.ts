import {DownloadUtil} from "../../common/util/DownloadUtil";
import * as os from "os";
import {Page, Request, Response} from "puppeteer";
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

export class PuppeteerUtil {

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
                                    body: Buffer.from([])
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

    static downloadImg(page: Page, imgSrc: string, saveDir: string): Promise<DownloadImgResult> {
        const time = new Date().getTime();
        const newImgSrc = imgSrc + (imgSrc.indexOf("?") == -1 ? "?" : "&") + time;
        return new Promise<DownloadImgResult>(async resolve => {
            const waitRespnse = this.onceResponce(page, newImgSrc);
            const imgFound = await page.evaluate((src, newSrc) => {
                const img = document.querySelector("img[src='" + src + "']");
                if (img) {
                    img["src"] = newSrc;
                    return true;
                }
                else return false;
            }, imgSrc, newImgSrc);

            if (imgFound) {
                waitRespnse.then(async (response: Response) => {
                    if (response.ok()) {
                        let saveName = null;
                        if (imgSrc.match(".*/[^.]+\\.[^.]+$")) {
                            saveName = imgSrc.substring(imgSrc.lastIndexOf('/') + 1);
                        }
                        else {
                            const contentType = (await response.headers())["content-type"];
                            if (contentType && contentType.match("^image/.*")) {
                                saveName = imgSrc.substring(imgSrc.lastIndexOf('/') + 1) + "." + contentType.substring(6);
                            }
                        }

                        if (!saveName) saveName = new Date().getTime() + "_" + parseInt("" + Math.random() * 1000) + ".png";
                        if (FileUtil.mkdirs(saveDir)) {
                            const savePath = saveDir + (saveDir.endsWith("/") ? "" : "/") + saveName;
                            fs.writeFile(savePath, response.buffer(), err => {
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
                this.removeResponseListener(page, newImgSrc);
                resolve({
                    success: false,
                    cost: new Date().getTime() - time,
                    error: DownloadImgError.ImgNotFound
                });
            }
        });
    }

}