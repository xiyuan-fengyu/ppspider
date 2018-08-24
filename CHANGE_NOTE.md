# 2018-08-24 v0.1.17
1. ui 任务详情弹框中增加递归查询父任务的功能，所有连接的改为 target="_blank"  
2. 系统的实时信息推送方式由 周期推送 改为 事件驱动延迟缓存推送  
3. 更新 puppeteer 版本为 1.7.0  
4. 增加 NoneWorkerFactory ， 不需要显式手动实例化 ，用于处理不需要打开 page 的任务  
5. logger 时间戳 SSS 格式化 0 补位
6. 可以创建url为空字符串的任务

# 2018-07-31 v0.1.16
1. 修复无法设置 maxParallelConfig=0 的bug  
2. 更新 puppeteer 版本为 1.6.1-next.1533003082302， 临时修复 puppeteer 1.6.1 的 response 丢失的bug  

# 2018-07-30 v0.1.15
1. 调整jQuery的注入方式，因为有一些网站因为安全原因  
    无法通过 page.addScriptTag 注入  
2. 修复 PuppeteerWorkerFactory.exPage 计算js执行错误位置的bug  
7. 修复 CronUtil.next 的bug：  
    OnTime队列最后一个任务（记为A）执行之后，立即添加的OnTime任务中第一个任务的执行时间和A执行时间可能重复  

# 2018-07-27 v0.1.14
1. logger打印添加等级判断, 增加修改配置的方法， @Launcher 中增加日志配置    
2. DefaultJob datas 方法参数可选   
3. 在 PuppeteerWorkerFactory 中对 get 方法创建的 Page 实例的 $eval, $$eval,
    evaluate, evaluateOnNewDocument, evaluateHandle 几个方法进行切面增强,
    当注入的js执行出现异常时能够打印出具体的位置  
4. 对序列化的实现方式做更改  
5. 源代码添加中文注释(英文后续补上)  
6. 更新 Puppeteer 版本   

# 2018-07-24 v0.1.13
1. 增加 logger 工具类，引入 source-map-support，用于在输出错误信息和日志时，能正确输出原ts文件的位置  

# 2018-07-23 v0.1.12
1. 实现 @Transient 字段装饰器，用于在序列化时忽略该字段  


# 2018-07-19 v0.1.11
1. 系统关闭等待任务的最长时间改为 60秒 ，之后仍未完成的任务认为执行失败，
    并重新添加到队列  
2. 修复图片下载过程中url匹配不正确的问题


# 2018-07-16 v0.1.8  
1. 重写序列化和反序列化，解决对象循环依赖的问题  
