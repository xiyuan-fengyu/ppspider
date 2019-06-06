import {launch} from "puppeteer";

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});
    await page.setRequestInterception(true);

    page.on("request", (req) => {
        console.log(req);
    });
    page.removeAllListeners("");

    await page.goto("https://www.baidu.com/");
    console.log();
})();
