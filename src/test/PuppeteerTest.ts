import {launch} from "puppeteer";
import {PuppeteerUtil} from "../spider/util/PuppeteerUtil";

(async() => {

    const browser = await launch({
        headless: false
    });

    const page = await browser.newPage();
    await page.setViewport({
        width: 1920,
        height: 1080
    });
    await PuppeteerUtil.setImgLoad(page, false);
    await page.goto("http://www.baidu.com");
    await PuppeteerUtil.addJquery(page);
    await PuppeteerUtil.setImgLoad(page, true);
    const downloadImgRes = await PuppeteerUtil.downloadImg(page, "//www.baidu.com/img/bd_logo1.png",
        "D:/SoftwareForCode/MyEclipseProject/ppspider_v2/lib/test");
    console.log(downloadImgRes);
})();