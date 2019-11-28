
export class Events {

    // 强制中断正在运行的任务，参数：cancleReason
    static readonly QueueManager_InterruptJob = "QueueManager_InterruptJob";

    static readonly QueueManager_InterruptJobSuccess = jobId => "QueueManager_InterruptJobSuccess_" + jobId;

    static readonly QueueManager_JobExecuted = "QueueManager_JobExecuted";

}