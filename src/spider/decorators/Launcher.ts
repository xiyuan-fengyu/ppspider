import {FileUtil} from "../../common/util/FileUtil";
import {logger} from "../../common/util/logger";
import {JobManager} from "../manager/JobManager";
import {Defaults} from "../Default";
import {WebServer} from "../ui/WebServer";
import {
    AppConfig,
    AppInfo,
    DataUiConfig,
    DataUiRequestConfig,
    IdKeyData,
    JobConfig,
    JobOverrideConfig,
    JobOverrideConfigs, OnEventConfig,
    RequestMappingConfig
} from "../Types";
import {EventEmitter} from "events";
import {QueueManager} from "../manager/QueueManager";
import {ArrayUtil} from "../../common/util/ArrayUtil";
import {NoneWorkerFactory} from "../worker/NoneWorkerFactory";
import {getBean} from "../../common/bean/Bean";
import {Job} from "../job/Job";
import {MongodbDao} from "../../common/db/MongodbDao";
import {NedbDao} from "../../common/db/NedbDao";



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
export function addDataUiConfig(config: DataUiConfig) {
    const className = config["className"];
    if (dataUiConfigs.find(item => item["className"] == className)) {
        throw new Error("DataUi(" + className + ") is declared");
    }
    dataUiConfigs.push(config);
}

const dataUiRequestConfigs: DataUiRequestConfig[] = [];
export function addDataUiRequestConfig(config: DataUiRequestConfig) {
    const requestMethod = config.requestMethod;
    if (dataUiRequestConfigs.find(item => item.requestMethod == requestMethod)) {
        let uiTarget;
        findUiTarget:
        for (let dataUiConfig of dataUiConfigs) {
            const target = dataUiConfig["target"];
            for (let key of Object.getOwnPropertyNames(target.prototype)) {
                const pro = target.prototype[key];
                if (typeof pro === "function" && pro == requestMethod) {
                    uiTarget = target;
                    break findUiTarget;
                }
            }
        }
        throw new Error("DataUiRequest(" + uiTarget.name + ".prototype." + requestMethod.name + ") is handled");
    }
    dataUiRequestConfigs.push(config);
}

const onEventConfigs: OnEventConfig[] = [];
export function addOnEventConfig(config: OnEventConfig) {
    onEventConfigs.push(config);
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
    appInfo.eventBus.setMaxListeners(1024);
    for (let onEventConfig of onEventConfigs) {
        appInfo.eventBus.on(onEventConfig.event, (...args: any) => {
            const target = getBean(onEventConfig.target);
            target[onEventConfig.method].call(target, ...args);
        });
    }

    // 设置 QueueManager 状态缓存目录
    appInfo.queueCache = appInfo.queueCache || appInfo.workplace + "/queueCache.txt";

    (async () => {
        let shutdownResolve;


        let noneWorkerFactory;
        if (!(noneWorkerFactory = appInfo.workerFactorys.find(item => item.constructor == NoneWorkerFactory))) {
            noneWorkerFactory = new NoneWorkerFactory();
            appInfo.workerFactorys.push(noneWorkerFactory);
        }


        // DataUi 实例方法增强
        // 1.后台系统对实例方法的调用会转换为前台页面实例对该方法的调用，用于数据主动推送
        // 2. @DataUiRequest 注入，使得前台实例对该方法的调用变为对后台数据的主动请求
        dataUiConfigs.forEach(item => {
            item["imported"] = (appInfo.dataUis || []).indexOf(item["target"]) > -1;
        });
        const dataUiRequests: {
            [targetMethod: string]: {
                handlerTarget: new () => any;
                handlerMethod: string;
            }
        } = {};
        const dataUiMethodTargets = new Map<(...args) => any, new () => any>();
        for (let dataUiConfig of dataUiConfigs) {
            const target = dataUiConfig["target"];
            getBean(target, true);
            if (dataUiConfig["imported"]) {
                for (let key of Object.getOwnPropertyNames(target.prototype)) {
                    const pro = target.prototype[key];
                    if (typeof pro === "function") {
                        dataUiMethodTargets.set(pro, target);
                    }
                }
            }
        }
        for (let dataUiRequestConfig of dataUiRequestConfigs) {
            const requestMethodTarget = dataUiMethodTargets.get(dataUiRequestConfig.requestMethod);
            if (requestMethodTarget) {
                const dataUiConfig = dataUiConfigs.find(item => item["target"] === requestMethodTarget);
                if (dataUiConfig && dataUiConfig["imported"]) {
                    dataUiRequests[requestMethodTarget.name + "." + dataUiRequestConfig.requestMethod.name] = {
                        handlerTarget: dataUiRequestConfig.handleTarget,
                        handlerMethod: dataUiRequestConfig.handleMethod
                    };

                    let requestMethods = dataUiConfig["requestMethods"];
                    if (!requestMethods) {
                        dataUiConfig["requestMethods"] = requestMethods = {};
                    }
                    requestMethods[dataUiRequestConfig.requestMethod.name] = true;
                }
            }
        }
        // 将 DataUi 标记类中除了 DataUiRequest 标注的方法增强为数据主动推送方法
        for (let dataUiConfig of dataUiConfigs) {
            if (dataUiConfig["imported"]) {
                const target = dataUiConfig["target"];
                const targetIns = getBean(target);
                for (let key of Object.getOwnPropertyNames(target.prototype)) {
                    const methodName = key;
                    const pro = target.prototype[methodName];
                    if (typeof pro === "function" && dataUiRequests[target.name + "." + methodName] == null) {
                        targetIns[methodName] = (...args) => {
                            appInfo.webServer.push(target.name, {
                                method: methodName,
                                args: args
                            });
                        };
                    }
                }
            }
        }


        // 移除 target 没有在 appInfo.tasks 中声明的 jobConfig
        ArrayUtil.removeIf(jobConfigs, item => appInfo.tasks.indexOf(item["target"]) == -1);
        // 检查回调函数的参数列表是否正常：最多只有一个Job类型的参数，最多只有一个worker参数
        for (let jobConfig of jobConfigs) {
            const target = jobConfig["target"];
            const method = jobConfig["method"];
            const paramnames = jobConfig["paramnames"];
            const paramtypes = jobConfig["paramtypes"];
            if (paramtypes == null) {
                logger.error(new Error(`emitDecoratorMetadata is required, enable it in tsconfig.json:
                {
                    "compilerOptions": {
                        "emitDecoratorMetadata": true
                    }
                }
                then, recompile the ts file`));
                process.exit(-1);
            }

            let hasError = false;
            if (paramtypes.length > 2) {
                hasError = true;
            }
            else {
                let jobParameterN = 0;
                let workerParameterN = 0;
                for (let i = 0, len = paramtypes.length; i < len; i++) {
                    let paramtype = paramtypes[i];
                    if (paramtype == Job || Job.isPrototypeOf(paramtype)) {
                        jobConfig["jobParamIndex"] = i;
                        jobParameterN++;
                    }
                    else {
                        const workerFactory = appInfo.workerFactorys.find(item => item.workerType() == paramtype);
                        if (workerFactory) {
                            jobConfig["workerFactory"] = workerFactory;
                            jobConfig["workerParamIndex"] = i;
                            workerParameterN++;
                        }
                        else if (paramtype == Object) {
                            logger.error(new Error("parameters of " + target.name + "." + method + " is invalid, type of parameter " + paramnames[i] + " should be a class, not an interface."));
                            process.exit(-1);
                        }
                        else {
                            logger.error(new Error("parameters of " + target.name + "." + method + " is invalid, WorkerFactory of parameter " + paramnames[i] + " is not found."));
                            process.exit(-1);
                        }
                    }
                }
                if (jobParameterN > 1 || workerParameterN > 1) {
                    hasError = true;
                }

                if (!jobConfig["workerFactory"]) {
                    jobConfig["workerFactory"] = noneWorkerFactory;
                }
            }

            if (hasError) {
                logger.error(new Error("parameters of " + target.name + "." + method + " is invalid, at most one (job: Job) parameter and at most one (worker: WorkerType) are required"));
                process.exit(-1);
            }
        }
        // 初始化 target
        jobConfigs.forEach(item => item["target"] = getBean(item["target"], true));


        // 初始化数据库
        if (!appConfig.dbUrl) {
            appConfig.dbUrl = "nedb://" + appConfig.workplace + "/nedb";
        }

        logger.info("init db(" + appConfig.dbUrl + ") ...");
        if (appConfig.dbUrl.startsWith("nedb://")) {
            appInfo.db = new NedbDao(appConfig.dbUrl);
        }
        else if (appConfig.dbUrl.startsWith("mongodb://")) {
            appInfo.db = new MongodbDao(appConfig.dbUrl);
        }
        else {
            throw new Error("not supported db: " + appConfig.dbUrl);
        }
        await appInfo.db.waitReady();
        logger.info("init db(" + appConfig.dbUrl + ") successfully");


        // 初始化 jobManager
        appInfo.jobManager = new JobManager();


        // 启动 QueueManager
        logger.info("init QueueManager ...");
        appInfo.queueManager = new QueueManager({
            jobOverrideConfigs: jobOverrideConfigs,
            jobConfigs: jobConfigs
        });
        await appInfo.queueManager.loadFromCache();
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
             * 重新执行OnStart任务
             * @param {ClientRequest} request
             * @returns {any}
             */
            static reExecuteOnStartJob(request: IdKeyData): any {
                return appInfo.queueManager.reExecuteOnStartJob(request.data);
            }

            /**
             * 设置队列运行状态
             * @param {ClientRequest} request
             * @returns {any}
             */
            static setQueueRunning(request: IdKeyData): any {
                return appInfo.queueManager.setQueueRunning(request.data.queue, request.data.running);
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

            /**
             * 手动终断一个任务的执行
             * @param {ClientRequest} request
             * @returns {Promise<any>}
             */
            static interrupteJob(request: IdKeyData): Promise<any> {
                return appInfo.queueManager.interrupteJob(request.data);
            }

            static dataUis(req: IdKeyData) {
                return dataUiConfigs.filter(item => item["imported"]);
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
                        // 检查是否是 DataUiRequest
                        const dataUiRequest = dataUiRequests[req.key];
                        if (dataUiRequest) {
                            const res = await getBean(dataUiRequest.handlerTarget, true)[dataUiRequest.handlerMethod](...req.data);
                            resolve(res);
                        }
                        else {
                            resolve({
                                success: false,
                                message: "method not found"
                            });
                        }
                    }
                });
            }

        }

        // 启动UI界面的web服务器
        requestMappingConfigs.forEach(item => item.target = getBean(item.target, true));
        appInfo.webServer = new WebServer(appInfo.webUiPort || Defaults.webUiPort, appInfo.workplace,
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
