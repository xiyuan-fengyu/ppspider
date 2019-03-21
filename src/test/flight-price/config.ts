export const config = {
    dev: {
        puppeteer: {
            headless: false,
            devtools: true,
            args: [
                // "--proxy-server=127.0.0.1:2007"
            ]
        },
        logger: {
            level: "debug"
        }
    },
    prod: {
        puppeteer: {
            args: [
                "--no-sandbox"
            ]
        },
        logger: {
            level: "info"
        }
    }
}[(process.argv.find(item => item.startsWith("-env=")) || "-env=dev").substring(5)];
