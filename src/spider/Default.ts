/**
 * 定义系统中用到的默认值
 */
export class Defaults {

    static readonly maxParallel = 1;

    static readonly exeInterval = 1000;

    static readonly exeIntervalJitterRate = 0.25;

    // 设置 job.datas._.maxTry 可以覆盖这个的最大尝试次数
    static readonly maxTry = 3;

    static readonly jobTimeout = 300000;

    static readonly shutdownTimeout = 60000;

    static readonly webUiPort = 9000;

}