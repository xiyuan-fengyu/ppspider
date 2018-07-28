import * as fs from "fs";
import * as request from "request";

export enum DownloadResult {
    existed = 1,
    success = 2,
    downloadFail = -1,
    saveFail = -2
}

/**
 * 通过 url 下载文件的工具类，目前框架中仅用于 PuppeteerUtil.addJquery 中下载保存 jquery
 */
export class DownloadUtil {

    static download(url: string, savePath: string, checkExisted: boolean = true): Promise<DownloadResult> {
        return new Promise<DownloadResult>((resolve) => {
            if (checkExisted && fs.existsSync(savePath)) {
                resolve(DownloadResult.existed);
            }
            else {
                request.get(url, null,
                    (error, response, body) => {
                        if (error) resolve(DownloadResult.downloadFail);
                        else {
                            fs.writeFile(savePath, body, err => {
                                if (err) resolve(DownloadResult.saveFail);
                                else resolve(DownloadResult.success);
                            });
                        }
                    }
                );
            }
        });
    }

}

// example for jQuery download
// const savePath = os.tmpdir() + "/jquery.min.js";
// console.log(savePath);
// DowmloadUtil.download("https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js", savePath).then(res => {
//     console.log(res);
// });
