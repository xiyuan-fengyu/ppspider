import {Launcher, PuppeteerWorkerFactory} from "../..";
import {config} from "./config";
import {FlightPriceTask} from "./task/FlightPriceTask";
import {NedbHelper} from "./data-ui/NedbHelper";
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
