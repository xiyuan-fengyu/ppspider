import {OnStart} from "../spider/decorators/OnStart";
import {NoneWorkerFactory} from "../spider/worker/NoneWorkerFactory";
import {Job} from "../spider/job/Job";
import {FileUtil} from "../common/util/FileUtil";
import {appInfo} from "../spider/decorators/Launcher";
import {SerializableUtil, SerializableUtil_v1} from "../common/serialize/Serializable";
import {logger} from "..";

export class QueueCache_v1ToV3Task {

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    async onTime(useless: any, job: Job) {
        const oldQueueCacheStr = FileUtil.read(appInfo.workplace + "/queueCache_v1.json");
        let oldObj = SerializableUtil_v1.deserialize(JSON.parse(oldQueueCacheStr));
        await SerializableUtil.serializeToFile(oldObj, appInfo.workplace + "/queueCache_v1ToV3.txt");
        logger.info("queueCache has been updated successfully and saved to " + appInfo.workplace + "/queueCache_v1ToV3.txt");
    }

}
