import {Browser, launch, LaunchOptions, Page} from "puppeteer";
import {WorkerFactory} from "./WorkerFactory";

export class PuppeteerWorkerFactory implements WorkerFactory<Page> {

    private browser: Browser;

    constructor(launchOptions?: LaunchOptions) {
        launch(launchOptions).then(browser => this.browser = browser);
    }

    get(): Promise<Page> {
        return this.browser.newPage();
    }

    release(worker: Page): Promise<void> {
        return worker.close();
    }

    shutdown() {
        if (!this.browser) return;
        return this.browser.close();
    }

    isBusy(): boolean {
        return this.browser == null;
    }

}