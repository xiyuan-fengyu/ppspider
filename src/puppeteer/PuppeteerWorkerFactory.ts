import {Browser, launch, LaunchOptions} from "puppeteer";
import {WorkerFactory} from "../spider/worker/WorkerFactory";
import {logger} from "../common/util/logger";
import {Page} from "./Page";

export class PuppeteerWorkerFactory implements WorkerFactory<Page> {

    private browser: Promise<Browser>;

    constructor(launchOptions?: LaunchOptions) {
        logger.info("init " + PuppeteerWorkerFactory.name + " ...");
        this.browser = launch(launchOptions).then(browser => {
            logger.info("init " + PuppeteerWorkerFactory.name + " successfully");
            return browser;
        });
    }

    workerType(): any {
        return Page;
    }

    get(): Promise<Page> {
        return new Promise<Page>(resolve => {
            this.browser.then(async browser => {
                const page = await browser.newPage();
                await this.exPage(page);
                resolve(page);
            });
        });
    }

    /**
     * 对 page 实例进行增强改进
     * 1. 对 $eval, $$eval, evaluate, evaluateOnNewDocument, evaluateHandle进行增强，当注入的js执行报错时，能打印出错误的具体位置
     * 2. 修改多个 request 监听的管理逻辑
     * 3. evaluate等方法支持 async await
     * @param {Page} page
     * @returns {Page}
     */
    private async exPage(page: Page) {
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

        // 默认分辨率 1920 * 1080
        await page.setViewport({width: 1920, height: 1080});

        await page.evaluateOnNewDocument(() => {
            // evaluate等方法支持 async await 关键字
            !window["__awaiter"] && (window["__awaiter"] = function (thisArg, _arguments, P, generator) {
                return new (P || (P = Promise))(function (resolve, reject) {
                    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
                    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
                    function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
                    step((generator = generator.apply(thisArg, _arguments || [])).next());
                });
            });

            // 绕开某些网站对 webdriver 的校验
            Object.defineProperties(navigator, {
                webdriver: {get: () => false}
            });
        });

        // 解决多个 request handler 时，无法决定是否要 continue 的问题
        PuppeteerWorkerFactory.overrideMultiRequestListenersLogic(page);
    }

    static overrideMultiRequestListenersLogic(page: Page) {
        const _requestHandlers = page["_requestHandlers"] = [] as [Function, Function][];
        const theOnlyRequestListener = async request => {
            const ps = [];
            for (let i = 0; i < _requestHandlers.length; ) {
                let requestHandler = _requestHandlers[i];
                const handler = requestHandler[1] || requestHandler[0];
                ps.push(handler(request));
                // 如果是 requestHandler[1] 不为空，这说明是 once 类型的handler，在调用前，会将这一项移除，这个时候 i 不应该递增
                requestHandler[1] == null && (i++);
            }
            await Promise.all(ps);
            if (request["_allowInterception"] && !request["_interceptionHandled"]) {
                await request.continue();
            }
        };
        const pageOn = page.on;
        const addTheOnlyRequestListener = () => {
            pageOn.call(page, "request", theOnlyRequestListener);
        };
        addTheOnlyRequestListener();

        ["addListener", "on", "once", "prependListener", "prependOnceListener"].forEach(funName => {
            const oldFun = page[funName];
            (page as any)[funName] = (eventName, handler) => {
                if (eventName == "request") {
                    const onceWrapper = funName == "once" || funName == "prependOnceListener" ? (...args) => {
                        const index = _requestHandlers.findIndex(item => item[0] == handler);
                        _requestHandlers.splice(index, 1);
                        return handler(...args);
                    } : null;
                    if (funName.startsWith("prepend")) {
                        _requestHandlers.splice(0, 0, [handler, onceWrapper]);
                    }
                    else {
                        _requestHandlers.push([handler, onceWrapper]);
                    }
                }
                else {
                    oldFun.call(page, eventName, handler);
                }
                return page;
            };
        });

        ["removeListener", "off"].forEach(funName => {
            const oldFun = page[funName];
            (page as any)[funName] = (eventName, handler) => {
                if (eventName == "request") {
                    const handlerI = _requestHandlers.findIndex(item => item[0] == handler);
                    if (handlerI > -1) {
                        _requestHandlers.splice(handlerI, 1);
                    }
                }
                else {
                    oldFun.call(page, eventName, handler);
                }
                return page;
            };
        });

        ["removeAllListeners"].forEach(funName => {
            const oldFun = page[funName];
            (page as any)[funName] = (eventName) => {
                if (eventName == "request") {
                    _requestHandlers.splice(0, _requestHandlers.length);
                }
                else if (eventName == null) {
                    _requestHandlers.splice(0, _requestHandlers.length);
                    oldFun.call(page);
                    addTheOnlyRequestListener();
                }
                else {
                    oldFun.call(page, eventName);
                }
                return page;
            };
        });

        ["listeners", "rawListeners"].forEach(funName => {
            const oldFun = page[funName];
            (page as any)[funName] = (eventName) => {
                if (eventName == "request") {
                    const res = [];
                    const isRaw = funName == "rawListeners";
                    _requestHandlers.forEach(item => {
                        res.push(item[0]);
                        isRaw && res.push(item[1]);
                    });
                    return res;
                }
                else {
                    return oldFun.call(page, eventName);
                }
            };
        });

        ["listenerCount"].forEach(funName => {
            const oldFun = page[funName];
            (page as any)[funName] = (eventName) => {
                if (eventName == "request") {
                    return _requestHandlers.length;
                }
                else {
                    return oldFun.call(page, eventName);
                }
            };
        });
    }

    release(worker: Page): Promise<void> {
        return worker.close();
    }

    shutdown() {
        if (!this.browser) return;
        return this.browser.then(browser => browser.close());
    }

}
