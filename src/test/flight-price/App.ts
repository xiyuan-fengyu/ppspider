import {Launcher, NedbHelperUi, PuppeteerWorkerFactory} from "../..";
import {config} from "./config";
import {FlightPriceTask} from "./task/FlightPriceTask";
import {FlightPriceUi} from "./data-ui/FlightPriceHelper";

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        FlightPriceTask
    ],
    dataUis: [
        NedbHelperUi,
        FlightPriceUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ],
    logger: config.logger,
    webUiPort: 9000
})
export class App {}
