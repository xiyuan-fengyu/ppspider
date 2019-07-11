import {launch} from "puppeteer";

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true,
        args: [ '--proxy-server=127.0.0.1:3000' ]
    });
    const page = await browser.newPage();
    // await page.setUserAgent("curl");
    await page.setViewport({width: 1920, height: 1080});
    await page.goto("https://www.google.com/");
    console.log();
})();
