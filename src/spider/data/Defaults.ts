/**
 * 定义系统中用到的默认值
 */
export class Defaults {

    static readonly maxParallel = 1;

    static readonly exeInterval = 0;

    static readonly exeIntervalJitter = exeInterval => parseInt("" + exeInterval * 0.25);

    static readonly maxTry = 3;

    static readonly responseTimeout = 30000;

    static readonly responseTimeoutMin = 1000;

    static readonly jobTimeout = 300000;

    static readonly queueManagerShutdownTimeout = 60000;

    static readonly webUiPort = 9000;

}