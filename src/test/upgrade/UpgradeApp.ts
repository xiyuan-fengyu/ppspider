import {Launcher} from "../..";
import {UpgradeQueueCacheTask} from "../../upgrade/UpgradeQueueCacheTask";

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        UpgradeQueueCacheTask
    ],
    dataUis: [
    ],
    workerFactorys: [
    ],
    webUiPort: 9000,
    logger: {
        level: "debug"
    }
})
class App {}
