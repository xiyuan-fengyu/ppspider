import {launch} from "puppeteer";

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});

    await page.goto("https://music.163.com/");
    let frame = page.frames()[1];
    while (frame) {
        frame = frame.parentFrame();
    }
    console.log();
})();
