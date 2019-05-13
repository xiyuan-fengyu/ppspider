import {OnStart} from "../spider/decorators/OnStart";
import {NoneWorkerFactory} from "../spider/worker/NoneWorkerFactory";
import {Job} from "../spider/job/Job";
import {FileUtil} from "../common/util/FileUtil";
import {appInfo} from "../spider/decorators/Launcher";
import {SerializableUtil} from "../common/serialize/Serializable_old";

export class UpgradeQueueCacheTask {

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    async onTime(useless: any, job: Job) {
        const oldQueueCacheStr = FileUtil.read(appInfo.workplace + "/queueCache_old.json");
        let oldObj = SerializableUtil.deserialize(JSON.parse(oldQueueCacheStr));
        FileUtil.write(appInfo.workplace + "/queueCache.txt", SerializableUtil.serialize(oldObj));
    }

}
