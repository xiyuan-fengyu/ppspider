import {appInfo, Launcher, PuppeteerWorkerFactory} from "../..";
import {config} from "./config";
import {FlightPriceTask} from "./task/FlightPriceTask";
import {ResponseDao} from "./nedb/ResponseDao";
import {FlightPriceDao} from "./nedb/FlightPriceDao";

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        FlightPriceTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ],
    logger: config.logger,
    webUiPort: 9000
})
export class App {}
