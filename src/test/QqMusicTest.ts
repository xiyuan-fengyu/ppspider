import {launch} from "puppeteer";
import {PuppeteerUtil} from "../spider/util/PuppeteerUtil";
import * as fs from "fs";
import {FileUtil} from "../common/util/FileUtil";

(async() => {

    const browser = await launch({
        headless: false
    });

    const page = await browser.newPage();
    await PuppeteerUtil.defaultViewPort(page);
    await PuppeteerUtil.setImgLoad(page, false);
    PuppeteerUtil.onResponse(page,
        "https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg\\?songmid=.*", async response => {
            const text = await response.text();
            FileUtil.write(__dirname + "/003LxmX246aRC7/fcg_play_single_song.json", PuppeteerUtil.jsonInJsonp(text));
        });
    PuppeteerUtil.onResponse(page,
        "https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg\\?songmid=.*", async response => {
            const text = await response.text();
            FileUtil.write(__dirname + "/003LxmX246aRC7/fcg_play_single_song.json", PuppeteerUtil.jsonInJsonp(text));
        });
    await page.goto("https://y.qq.com/n/yqq/song/003LxmX246aRC7.html");
    // const downloadImgRes = await PuppeteerUtil.downloadImg(page, "body > div.main > div.mod_data > span.data__cover > img", __dirname);

})();
