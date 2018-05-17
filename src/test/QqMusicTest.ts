import {launch} from "puppeteer";
import {PuppeteerUtil} from "../spider/util/PuppeteerUtil";
import * as fs from "fs";

(async() => {

    const browser = await launch({
        headless: false
    });

    const page = await browser.newPage();
    await PuppeteerUtil.defaultViewPort(page);
    await PuppeteerUtil.setImgLoad(page, false);
    await page.goto("https://y.qq.com/n/yqq/song/003LxmX246aRC7.html");
    const downloadImgRes = await PuppeteerUtil.downloadImg(page,
        "body > div.main > div.mod_data > span.data__cover > img",
        __dirname);
    console.log(downloadImgRes);
})();
