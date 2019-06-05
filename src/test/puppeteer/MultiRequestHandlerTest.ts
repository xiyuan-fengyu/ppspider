import {launch, Request} from "puppeteer";

(async () => {
    const browser = await launch({
        headless: false,
        devtools: true
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});
    await page.setRequestInterception(true);

    page.on("request", (req: Request) => {
        const oldContinue = req.continue;
        let continueNum = 0;
        // override request.continue
        req.continue = (override?: any) => {
            if (override) {
                return oldContinue.call(req, override);
            }
            else {
                continueNum++;
                if (continueNum == page.listeners("request").length) {
                    return oldContinue.call(req);
                }
            }
        };
        return req.continue();
    });

    page.on("request", async (req: Request) => {
        await req.continue();
    });
    page.on("request", async (req: Request) => {
        await req.respond({
            status: 200,
            body: "test"
        });
    });
    await page.goto("https://www.baidu.com/");
    console.log();
})();
