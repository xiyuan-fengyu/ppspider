import {DownloadUtil} from "../../common/util/DownloadUtil";
import * as os from "os";
import {Page} from "puppeteer";

const requestInterception_imgLoad = "requestListener_imgLoad";

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

    static async setImgLoad(page: Page, enable: boolean) {
        await page.setRequestInterception(true);
        if (enable) {
            if (page[requestInterception_imgLoad]) {
                page.removeListener("request", page[requestInterception_imgLoad]);
            }
        }
        else {
            if (!page[requestInterception_imgLoad]) {
                page[requestInterception_imgLoad] = async request => {
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
            page.on("request", page[requestInterception_imgLoad]);
        }
    }

    // @todo 检测responce
    // static async

}