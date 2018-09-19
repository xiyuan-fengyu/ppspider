/**
 * 定义系统中用到的默认值
 */
export class Defaults {

    static maxParallel = 1;

    static exeInterval = 0;

    static exeIntervalJitter = exeInterval => parseInt("" + exeInterval * 0.25);

    static maxTry = 3;

    static responseTimeout = 30000;

    static responseTimeoutMin = 1000;

    static queueManagerShutdownTimeout = 60000;

    static webUiPort = 9000;

}