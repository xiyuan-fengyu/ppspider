import {Launcher, NedbHelper, PuppeteerWorkerFactory} from "../..";
import {config} from "./config";
import {FlightPriceTask} from "./task/FlightPriceTask";
import {FlightPriceHelper} from "./data-ui/FlightPriceHelper";

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        FlightPriceTask
    ],
    imports: [
        NedbHelper,
        FlightPriceHelper
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ],
    logger: config.logger,
    webUiPort: 9000
})
export class App {}
