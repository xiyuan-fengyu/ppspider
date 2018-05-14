import {launch} from "puppeteer";
import {JqueryUtil} from "../spider/jquery/JqueryUtil";

(async() => {

    const browser = await launch({
        headless: false
    });

    const page = await browser.newPage();
    await page.setViewport({
        width: 1920,
        height: 1080
    });
    await page.goto("http://www.baidu.com");
    await JqueryUtil.addToPage(page);

})();