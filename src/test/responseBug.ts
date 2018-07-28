import {launch} from "puppeteer";

const test0 = async () => {
    const browser = await launch({
        headless: false,
        devtools: true
    });

    const page = await browser.newPage();
    page.on("response", async response => {
        const url = response.url();
        if (url.match(".*/graphql/.*")) {
            console.log(url);
            const body = await response.text();
            if (body) {
                try {
                    const json = JSON.parse(body);
                    if (json.data && json.data.user && json.data.user.legacy) {
                        console.log(JSON.stringify(json.data.user.legacy, null, 4));
                    }
                }
                catch (e) {
                }
            }
        }
    });

    await page.goto("https://mobile.twitter.com/Jackie_9692");
};

const test1 = async () => {
    const browser = await launch({
        headless: false,
        devtools: true
    });

    const page = await browser.newPage();
    page.on("response", async response => {
        const url = response.url();
        if (url.match(".*/graphql/.*")) {
            console.log(url);
            const body = await response.text();
            if (body) {
                try {
                    const json = JSON.parse(body);
                    if (json.data && json.data.user && json.data.user.legacy) {
                        console.log(JSON.stringify(json.data.user.legacy, null, 4));
                    }
                }
                catch (e) {
                }
            }
        }
    });

    await page.setRequestInterception(true);
    page.on("request", async request => {
        request.continue();
    });
    await page.goto("https://mobile.twitter.com/Jackie_9692");
};

const test2 = async () => {
    const browser = await launch({
        headless: false,
        devtools: true
    });

    const page = await browser.newPage();
    const pageClient = page["_client"];
    pageClient.on("Network.responseReceived", event => {
        if (event.response.url.match(".*/graphql/.*")) {
            console.log(event.response.url);
            pageClient.send('Network.getResponseBody', {
                requestId: event.requestId
            }).then(response => {
                const body = response.body;
                if (body) {
                    try {
                        const json = JSON.parse(body);
                        if (json.data && json.data.user && json.data.user.legacy) {
                            console.log(JSON.stringify(json.data.user.legacy, null, 4));
                        }
                    }
                    catch (e) {
                    }
                }
            });
        }
    });

    await page.setRequestInterception(true);
    page.on("request", async request => {
       request.continue();
    });
    await page.goto("https://mobile.twitter.com/Jackie_9692");
};

// test0(); // log: 3 lines of https://api.twitter.com/graphql/ey5le5rFYEThjq0u1i43tA and json result
// test1(); // log: just 2 lines of https://api.twitter.com/graphql/ey5le5rFYEThjq0u1i43tA, cannot get json result
// test2(); // log: 3 lines of https://api.twitter.com/graphql/ey5le5rFYEThjq0u1i43tA and json result

/*
compare these 3 test, I think there must be some bugs in
page.setRequestInterception
page.on("request", requestListener),
page.on("response", responseListener)
which lead to the test1 misses a response with json data.
 */