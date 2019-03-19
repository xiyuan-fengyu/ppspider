import "source-map-support/register";
import {FileUtil} from "../../common/util/FileUtil";
import {logger} from "../../common/util/logger";
import {NoneWorkerFactory} from "../worker/NoneWorkerFactory";
import {JobManager} from "../manager/JobManager";
import {Defaults} from "../Default";
import {WebServer} from "../ui/WebServer";
import {
    AppConfig,
    AppInfo, DataUiConfig,
    IdKeyData,
    JobConfig,
    JobOverrideConfig,
    JobOverrideConfigs,
    RequestMappingConfig
} from "../Types";
import {EventEmitter} from "events";
import {QueueManager} from "../manager/QueueManager";

const instances = new Map<any, any>();
export function getInstance(instanceClass) {
    let ins = instances.get(instanceClass);
    if (!ins) {
        ins = new instanceClass();
        instances.set(instanceClass, ins);
    }
    return ins;
}

const jobConfigs: JobConfig[] = [];
export function addJobConfig(config: JobConfig) {
    jobConfigs.push(config);
}

const requestMappingConfigs: RequestMappingConfig[] = [];
export function addRequestMappingConfig(config: RequestMappingConfig) {
    requestMappingConfigs.push(config);
}

const jobOverrideConfigs: JobOverrideConfigs = {};
export function addJobOverrideConfig(queueName: string, config: JobOverrideConfig) {
    jobOverrideConfigs[queueName] = config;
}

const dataUiConfigs: DataUiConfig[] = [];
export function addDataUiConfig(dataUiConfig: DataUiConfig) {
    dataUiConfigs.push(dataUiConfig);
}

export const appInfo: AppInfo = {} as any;

export function Launcher(appConfig: AppConfig) {
    Object.assign(appInfo, appConfig);

    // 创建工作目录
    FileUtil.mkdirs(appConfig.workplace);

    // 设置日志配置
    logger.setting = appConfig.logger;

    // 初始化消息总线
    appInfo.eventBus = new EventEmitter();

    // 设置 QueueManager 状态缓存目录
    appInfo.queueCache = appInfo.queueCache || appInfo.workplace + "/queueCache.json";

    (async () => {
        let shutdownResolve;

        for (let workerFactory of appInfo.workerFactorys) {
            instances[workerFactory.constructor as any] = workerFactory;
        }

        // 如果用户没有添加 NoneWorkerFactory, 则自动添加这个 factory
        if (!instances.get(NoneWorkerFactory)) {
            instances[NoneWorkerFactory as any] = new NoneWorkerFactory();
        }

        // 等待 jobManager 初始化完成， 实际上是等待 nedb 数据库加载完成
        logger.info("init JobManager ...");
        appInfo.jobManager = new JobManager();
        await appInfo.jobManager.init();
        logger.info("init JobManager successfully");

        // 启动 QueueManager
        logger.info("init QueueManager ...");
        jobConfigs.forEach(item => item["target"] = getInstance(item["target"]));
        appInfo.queueManager = new QueueManager({
            jobOverrideConfigs: jobOverrideConfigs,
            jobConfigs: jobConfigs
        });
        logger.info("init QueueManager successfully");

        // 开始派发任务的循环
        appInfo.queueManager.startDispatchLoop();

        // 添加 UI 请求的处理回调
        class WebRequestHandler {

            /**
             * ui客户端连接成功后主动获取队列信息
             * @param {ClientRequest} request
             * @returns {any}
             */
            static getQueueInfo(request: IdKeyData) {
                return {
                    success: true,
                    data: appInfo.queueManager.info()
                };
            }

            /**
             * 保存运行状态
             * @param {ClientRequest} request
             * @returns {any}
             */
            static saveQueueCache(request: IdKeyData): any {
                return appInfo.queueManager.saveQueueCache();
            }

            /**
             * 删除保存运行状态的文件
             * @param {ClientRequest} request
             * @returns {any}
             */
            static deleteQueueCache(request: IdKeyData): any {
                return appInfo.queueManager.deleteQueueCache();
            }

            /**
             * 更新任务配置
             * @param {ClientRequest} request
             * @returns {any}
             */
            static reExecuteOnStartJob(request: IdKeyData): any {
                return appInfo.queueManager.reExecuteOnStartJob(request.data);
            }

            /**
             * 更新任务配置
             * @param {ClientRequest} request
             * @returns {any}
             */
            static updateQueueConfig(request: IdKeyData): any {
                return appInfo.queueManager.updateConfig(request.data);
            }

            /**
             * 暂停或开始 任务派发
             * @param {ClientRequest} request
             * @returns {any}
             */
            static resetQueueManagerPause(request: IdKeyData): any {
                appInfo.queueManager.setPause(request.data);
                return true;
            }

            /**
             * 停止整个系统
             * @param {ClientRequest} request
             * @returns {Promise<any>}
             */
            static stopSystem(request: IdKeyData): Promise<any> {
                return new Promise(async resolve => {
                    await appInfo.queueManager.waitRunning();
                    if (request.data.saveQueueCache) {
                        await appInfo.queueManager.saveQueueCache();
                    }
                    setTimeout(() => shutdownResolve(), 1000);
                    resolve();
                });
            }

            /**
             * 查询 job 列表
             * @param {ClientRequest} request
             * @returns {Promise<any>}
             */
            static jobs(request: IdKeyData): Promise<any> {
                return appInfo.jobManager.jobs(request.data);
            }

            /**
             * 删除符合条件的jobs
             * @param {ClientRequest} request
             * @returns {Promise<any>}
             */
            static deleteJobs(request: IdKeyData): Promise<any> {
                return appInfo.jobManager.deleteJobs(request.data);
            }

            /**
             * 获取 job 详情
             * @param {ClientRequest} request
             * @returns {Promise<any>}
             */
            static jobDetail(request: IdKeyData): Promise<any> {
                return appInfo.jobManager.jobDetail(request.data);
            }

            /**
             * 手动将jobs页面搜索到的job重新添加到队列中，Fail 和 Success 状态的任务可以自行此操作
             * @param {ClientRequest} request
             * @returns {Promise<any>}
             */
            static reExecuteJob(request: IdKeyData): Promise<any> {
                return appInfo.queueManager.reExecuteJob(request.data);
            }

            static dataUis(req: IdKeyData) {
                return dataUiConfigs;
            }

            static dispatch(req: IdKeyData): Promise<any> {
                return new Promise(async resolve => {
                    const method = WebRequestHandler[req.key];
                    if (typeof method == "function") {
                        try {
                            const res = await method.call(WebRequestHandler, req);
                            resolve(res);
                        }
                        catch (e) {
                            logger.warn(e);
                            resolve({
                                success: false,
                                message: e.message
                            });
                        }
                    }
                    else {
                        resolve({
                            success: false,
                            message: "method not found"
                        });
                    }
                });
            }

        }

        // 启动UI界面的web服务器
        requestMappingConfigs.forEach(item => item.target = getInstance(item.target));
        appInfo.webServer = new WebServer(appInfo.webUiPort || Defaults.webUiPort,
            requestMappingConfigs, WebRequestHandler.dispatch);

        // 等待系统停止
        await new Promise(resolve => shutdownResolve = resolve);

        // 停止系统
        for (let workerFactory of appInfo.workerFactorys) {
            workerFactory.shutdown();
        }
        appInfo.webServer.shutdown();
        process.exit(0);
    })();

    return function (target) {};
}
