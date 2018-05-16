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

})();