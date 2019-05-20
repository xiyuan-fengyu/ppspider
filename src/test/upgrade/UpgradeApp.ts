import {Launcher} from "../..";
import {QueueCache_v1ToV3Task} from "../../upgrade/QueueCache_v1ToV3Task";
import {QueueCache_v2ToV3Task} from "../../upgrade/QueueCache_v2ToV3Task";

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        QueueCache_v1ToV3Task,
        QueueCache_v2ToV3Task
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
