import {OnStart} from "../spider/decorators/OnStart";
import {NoneWorkerFactory} from "../spider/worker/NoneWorkerFactory";
import {Job} from "../spider/job/Job";
import {FileUtil} from "../common/util/FileUtil";
import {appInfo} from "../spider/decorators/Launcher";
import {SerializableUtil, SerializableUtil_old} from "../common/serialize/Serializable";
import {logger} from "..";

export class UpgradeQueueCacheTask {

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    async onTime(useless: any, job: Job) {
        const oldQueueCacheStr = FileUtil.read(appInfo.workplace + "/queueCache_old.json");
        let oldObj = SerializableUtil_old.deserialize(JSON.parse(oldQueueCacheStr));
        await SerializableUtil.serializeToFile(oldObj, appInfo.workplace + "/queueCache.txt");
        logger.info("queueCache has been updated successfully and saved to " + appInfo.workplace + "/queueCache.txt");
    }

}
