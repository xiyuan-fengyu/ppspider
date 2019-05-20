import {OnStart} from "../spider/decorators/OnStart";
import {NoneWorkerFactory} from "../spider/worker/NoneWorkerFactory";
import {Job} from "../spider/job/Job";
import {FileUtil} from "../common/util/FileUtil";
import {appInfo} from "../spider/decorators/Launcher";
import {SerializableUtil, SerializableUtil_v2} from "../common/serialize/Serializable";
import {logger} from "..";

export class QueueCache_v2ToV3Task {

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    async onTime(useless: any, job: Job) {
        const oldQueueCacheLines = await FileUtil.readLines(appInfo.workplace + "/queueCache_v2.txt");
        let oldObj = SerializableUtil_v2.deserialize(oldQueueCacheLines);
        await SerializableUtil.serializeToFile(oldObj, appInfo.workplace + "/queueCache_v2ToV3.txt");
        logger.info("queueCache has been updated successfully and saved to " + appInfo.workplace + "/queueCache_v2ToV3.txt");
    }

}
