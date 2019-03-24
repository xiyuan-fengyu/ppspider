import {Launcher, PuppeteerWorkerFactory} from "../..";
import {config} from "./config";
import {FlightPriceTask} from "./task/FlightPriceTask";

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
