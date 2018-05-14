import {PuppeteerWorkerFactory} from "../../spider/worker/PuppeteerWorkerFactory";
import {Launcher} from "../../spider/decorators/Launcher";
import {QqMusicTask} from "./QqMusicTask";

@Launcher({
    tasks: [
        QqMusicTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false
        })
    ]
})
class App {}