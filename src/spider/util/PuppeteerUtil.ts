import {DownloadUtil} from "../../common/util/DownloadUtil";
import * as os from "os";
import {Page} from "puppeteer";

const kRequestInterceptionNum = "_requestInterceptionNum";
const kRequestInterception_ImgLoad = "_requestListener_imgLoad";

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
                page[kRequestInterception_ImgLoad] = async request => {
                    const interceptionHandled = request["_interceptionHandled"];
                    if (!interceptionHandled) {
                        if (request.resourceType() == "image") {
                            await request.respond({
                                status: 200,
                                contentType: "image/png",
                                body: Buffer.from([])
                            });
                        }
                        else request.continue();
                    }
                };
            }
            page.on("request", page[kRequestInterception_ImgLoad]);
        }
    }

    // @todo 检测responce
    // static async

}