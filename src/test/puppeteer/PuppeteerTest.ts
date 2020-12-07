import {launch} from "puppeteer";
import * as path from "path";
import * as fs from "fs";

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true,
        // args: [ '--proxy-server=127.0.0.1:3000' ]
    });
    const page = await browser.newPage();
    // await page.setUserAgent("curl");
    await page.setViewport({width: 1920, height: 1080});
    await page.goto("https://www.baidu.com/");
    const dir = path.resolve("workplace/image/test/1.jpg", "..");
    fs.mkdirSync(dir, {recursive: true});
    await page.screenshot({
        path: "workplace/image/test/1.jpg",
        type: "jpeg",
        quality: 95,
        encoding: "binary"
    })
    console.log();
})();
