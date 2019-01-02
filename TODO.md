# 2019-01-02
1. 修复 filtered 状态的任务记录在10分钟后没有自动清空的bug

# 2018-12-10
1. 修复 Task 实例重复生成的bug(OK 2018-12-10)  

# 2018-11-19
1. 修复 logger 打印 Error 始终为 {} 的问题(OK 2018-11-19)  
2. 更新puppeteer版本(OK 2018-11-19)  

# 2018-09-21
1. QueueManager 推送队列状态信息时，所有队列按照 TaskClassName > JobType(OnStart > OnTime > FromQueue) > JobExecutionMethodPosition 的方式来排序 (OK)    
2. UI界面搜索添加条件时，如果是选择类型的，则采用checkbox可勾选多项的方式(OK 2018-11-19)  

# 2018-09-14
1. 任务报错时打印任务的具体信息 (OK)  
2. 任务失败次数只统计重复尝试后未成功的任务数 (OK)  
3. logger 打印日志的几个方法的参数列表改为不定项参数列表，不再接受 format 参数， format 只能统一设定，不定参数列表作为消息列表，消息之间自动换行；
    logger 在打印日志时，如果参数是 object 类型，自动采用 JSON.stringify(obj, null, 4) 将 obj 转换为字符串打印 (OK)  
4. OnStart, OnTime, FromQueue 三种任务的参数配置增加可选属性 exeIntervalJitter，类型为 number，单位为毫秒，让任务执行间隔在 (exeInterval - exeIntervalJitter, exeInterval + exeIntervalJitter) 范围内随机抖动，
    不设置时默认 exeIntervalJitter = exeInterval * 0.25  (OK)  
5. 一个任务队列默认最大并行数改为 1 (OK)  
6. 用 ppspider_example/src/spread 中的 NedbDao 实现重写 JobManager (OK)    
7. 为三种任务的 config 增加属性 running，用于控制这个队列是否暂停工作，默认为 true；
    通过 mainMessager.emit(MainMessagerEvent.QueueManager_QueueToggle_queueName_running, queueNameRegex: string, running: boolean) 来更改多个队列的工作情况 (OK)  
8. 增加装饰器 @RequestMapping， 用于声明 HTTP rest 接口，提供远程动态添加任务的能力，返回抓取结果需要自行实现（例如异步url回调）(OK)    

# 2018-09-12
1. 把代码中对 index.ts 中导出类的引用地址改为原路径，这样在编辑器中用户更容定位到源代码位置 (OK)

# 2018-08-27
1. 把 CHNAGE_NOTE 迁移到 README 中 (OK)
2. 修正 DateUtil 和 logger 中日期格式化 month 解析错误的bug (OK)

# 2018-08-23
1. ui 任务详情弹框中增加递归查询父任务的功能，所有连接的改为 target="_blank" (OK)
2. 系统的实时信息推送方式由 周期推送 改为 事件驱动延迟缓存推送 (OK)

# 2018-08-10
1. 更新 puppeteer 版本 (OK)
2. 增加 NoneWorkerFactory ， 不需要显式手动实例化 ，用于处理不需要打开 page 的任务 (OK)
3. logger 时间戳 SSS 格式化 0 补位 (OK)
4. url支持空字符串 (OK)

# 2018-07-27
1. 源代码添加英文注释

# 2018-07-23
1. 编写更多的实用例子，还有保存数据的例子，保存到 file/mysql/mongodb,以及文件上传到其他服务器  

# 2018-07-20
1. 在文档中添加 puppeteer 下载chrome 失败时的处理方式 (OK)    

