import {launch} from "puppeteer";
import * as request from "request";
import * as HttpsProxyAgent from 'https-proxy-agent';

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});
    await page.setRequestInterception(true);
    page.on("request", req => {
        if (req.url().startsWith("http")) {
            request({
                url: req.url(),
                method: req.method(),
                headers: req.headers(),
                body: req.postData(),
                encoding: null,
                agent: new HttpsProxyAgent("http://127.0.0.1:2007")
            }, (error, response) => {
                if (error) {
                    req.abort(error.message);
                }
                else {
                    req.respond({
                        status: response.statusCode,
                        headers:  response.headers as any,
                        body: response.body
                    });
                }
            });
        }
        else {
            req.continue();
        }
    });
    // await page.goto("https://www.bilibili.com/");
    await page.goto("https://www.google.com/");
    console.log();
})();