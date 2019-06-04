import {Browser, launch, LaunchOptions, Page, Request} from "puppeteer";
import {WorkerFactory} from "../spider/worker/WorkerFactory";
import {Serializable} from "../common/serialize/Serializable";
import {logger} from "../common/util/logger";

@Serializable()
export class PuppeteerWorkerFactory implements WorkerFactory<Page> {

    private browser: Promise<Browser>;

    constructor(launchOptions?: LaunchOptions) {
        logger.info("init " + PuppeteerWorkerFactory.name + " ...");
        this.browser = launch(launchOptions).then(browser => {
            logger.info("init " + PuppeteerWorkerFactory.name + " successfully");
            return browser;
        });
    }

    get(): Promise<Page> {
        return new Promise<Page>(resolve => {
            this.browser.then(browser => {
                browser.newPage().then(page => resolve(this.exPage(page)));
            });
        });
    }

    /**
     * 对 page 实例进行增强改进
     * 1. 对 $eval, $$eval, evaluate, evaluateOnNewDocument, evaluateHandle进行增强，当注入的js执行报错时，能打印出错误的具体位置
     * @param {Page} page
     * @returns {Page}
     */
    private exPage(page: Page): Page {
        const prettyError = (oriError: Error, pageFunction: any) => {
            const oriStackArr = oriError.stack.split("\n");
            const errPosReg = new RegExp("__puppeteer_evaluation_script__:(\\d+):(\\d+)");
            for (let i = 1, len = oriStackArr.length; i < len; i++) {
                const errPosM = errPosReg.exec(oriStackArr[i]);
                if (errPosM) {
                    const rownum = parseInt(errPosM[1]) - 1;
                    const colnum = parseInt(errPosM[2]) - 1;
                    const oriFunLines = pageFunction.toString().split("\n");
                    let oriFunLinesWithErrorPos = "";
                    for (let j = 0, oriFunLinesLen = oriFunLines.length,
                             len = Math.max(oriFunLinesLen, rownum); j <= len; j++) {
                        if (j < oriFunLinesLen) {
                            oriFunLinesWithErrorPos += oriFunLines[j] + "\n";
                        }
                        if (j == rownum) {
                            for (let k = 0; k < colnum; k++) {
                                oriFunLinesWithErrorPos += "^";
                            }
                            oriFunLinesWithErrorPos += "^\n";
                        }
                    }
                    return new Error(oriError.message + "\n" + oriFunLinesWithErrorPos);
                }
            }
            // 解析失败，返回原错误
            return oriError;
        };

        ["$eval", "$$eval"].forEach(async funName => {
            const oldFun = page[funName];
            page[funName] = async (selector, pageFunction, ...args) => {
                try {
                    return await oldFun.call(page, selector, pageFunction, ...args);
                }
                catch (e) {
                    throw prettyError(e, pageFunction);
                }
            };
        });

        ["evaluate", "evaluateOnNewDocument", "evaluateHandle"].forEach(async funName => {
            const oldFun = page[funName];
            page[funName] = async (pageFunction, ...args) => {
                try {
                    return await oldFun.call(page, pageFunction, ...args);
                }
                catch (e) {
                    throw prettyError(e, pageFunction);
                }
            };
        });

        // 解决多个 request handler 时，修正 continue 逻辑， 使得可以多次 continue，当多个 handler 都 continue 时，才调用真正的continue
        const firstHandlerForRequest = (req: Request) => {
            const oldContinue = req.continue;
            let continueNum = 0;
            req.continue = (override?: any) => {
                if (override) {
                    return oldContinue.call(req, override);
                }
                else {
                    continueNum++;
                    if (continueNum == page.listeners("request").length) {
                        return oldContinue.call(req);
                    }
                    else {
                        return new Promise(resolve => resolve());
                    }
                }
            };
            return req.continue();
        };
        page.on("request", firstHandlerForRequest);

        return page;
    }

    release(worker: Page): Promise<void> {
        return worker.close();
    }

    shutdown() {
        if (!this.browser) return;
        return this.browser.then(browser => browser.close());
    }

}