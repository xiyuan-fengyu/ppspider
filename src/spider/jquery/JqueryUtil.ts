import {DownloadResult, DownloadUtil} from "../../common/util/DownloadUtil";
import * as os from "os";
import {Page} from "puppeteer";

export class JqueryUtil {

    private static jquerySavePath = os.tmpdir() + "/jquery.min.js";

    static download(url: string = "https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js"): Promise<DownloadResult> {
        return DownloadUtil.download(url, JqueryUtil.jquerySavePath);
    }

    static async addToPage(page: Page) {
        await this.download().then(async res => {
           if (res > 0) {
               await page.addScriptTag({
                   path: JqueryUtil.jquerySavePath
               });
           }
        });
    }

}