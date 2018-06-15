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
    await PuppeteerUtil.setImgLoad(page, true);
    const lgImg = await PuppeteerUtil.specifyIdByJquery(page, "#lg img:eq(0)");
    const downloadImgRes = await PuppeteerUtil.downloadImg(page, "#" + lgImg[0], __dirname);
    console.log(downloadImgRes);
    const downloadImgRes1 = await PuppeteerUtil.downloadImg(page, "//www.baidu.com/img/dong_ffc8c3961fc553a629bf3fc8dd7bdb1d.gif", __dirname);
    console.log(downloadImgRes1);
    const href = await PuppeteerUtil.links(page, {
        "index": ["#result_logo", ".*"],
        "baidu": "^https?://[^/]*\\.baidu\\.",
        "other": (a: Element) => {
            const href = (a as any).href as string;
            if (href.startsWith("http")) return href;
        }
    });
    console.log(href);

    // const page = await browser.newPage();
    // await PuppeteerUtil.defaultViewPort(page);
    // await PuppeteerUtil.setImgLoad(page, false);
    // await page.goto("https://www.bilibili.com/video/av24749339/?spm_id_from=333.334.chief_recommend.16");
    // const replyResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/v2/reply.*", async response => {
    //     console.log("response");
    // });
    // await PuppeteerUtil.scrollToBottom(page, 10000, 100, 1000);
    // await replyResWait;
    // await page.waitForSelector("#comment .comment .comment-list .list-item.reply-wrap", {timeout: 5000});
    // const count = await PuppeteerUtil.count(page, "#comment .bottom-page.paging-box-big a:contains('2')");
    // console.log(count);

})();
