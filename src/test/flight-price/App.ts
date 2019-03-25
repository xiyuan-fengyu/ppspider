import {Launcher, PuppeteerWorkerFactory} from "../..";
import {config} from "./config";
import {FlightPriceTask} from "./task/FlightPriceTask";
import {NedbHelper} from "./data-ui/NedbHelper";

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        FlightPriceTask
    ],
    imports: [
        NedbHelper
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ],
    logger: config.logger,
    webUiPort: 9000
})
export class App {}
