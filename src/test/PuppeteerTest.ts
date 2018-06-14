import {launch} from "puppeteer";
import {PuppeteerUtil} from "../spider/util/PuppeteerUtil";

(async() => {

    const browser = await launch({
        headless: false,
        devtools: true
    });

    // const page = await browser.newPage();
    // await PuppeteerUtil.defaultViewPort(page);
    // await PuppeteerUtil.setImgLoad(page, false);
    // await page.goto("http://www.baidu.com");
    // await PuppeteerUtil.addJquery(page);
    // await PuppeteerUtil.setImgLoad(page, true);
    // const downloadImgRes = await PuppeteerUtil.downloadImg(page, ".index-logo-src", __dirname);
    // console.log(downloadImgRes);
    // const href = await PuppeteerUtil.links(page, {
    //     "index": ["#result_logo", ".*"],
    //     "baidu": "^https?://[^/]*\\.baidu\\.",
    //     "other": (a: Element) => {
    //         const href = (a as any).href as string;
    //         if (href.startsWith("http")) return href;
    //     }
    // });
    // console.log(href);

    const page = await browser.newPage();
    await PuppeteerUtil.defaultViewPort(page);
    await PuppeteerUtil.setImgLoad(page, false);
    await page.goto("https://www.bilibili.com/video/av24749339/?spm_id_from=333.334.chief_recommend.16");
    const count = await PuppeteerUtil.count(page, "#comment .bottom-page.paging-box-big a:contains('2')");
    console.log(count);

})();
