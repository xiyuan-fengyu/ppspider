import {launch} from "puppeteer";
import {PuppeteerUtil} from "../spider/util/PuppeteerUtil";

(async() => {

    const browser = await launch({
        headless: false,
        devtools: true
    });

    const page = await browser.newPage();
    await PuppeteerUtil.defaultViewPort(page);
    await PuppeteerUtil.setImgLoad(page, false);
    await page.goto("http://www.baidu.com");
    await PuppeteerUtil.addJquery(page);
    // await PuppeteerUtil.setImgLoad(page, true);
    const downloadImgRes = await PuppeteerUtil.downloadImg(page, ".index-logo-src", __dirname);
    console.log(downloadImgRes);
})();
