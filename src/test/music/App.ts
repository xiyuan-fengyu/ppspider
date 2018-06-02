import {PuppeteerWorkerFactory} from "../../spider/worker/PuppeteerWorkerFactory";
import {Launcher} from "../../spider/decorators/Launcher";
import {QqMusicTask} from "./QqMusicTask";

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        QqMusicTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class App {

}