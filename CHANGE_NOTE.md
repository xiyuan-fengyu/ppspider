# 2018-07-26 v0.1.14
1. logger打印添加等级判断, 增加修改配置的方法， @Launcher 中增加配置入口
2. DefaultJob datas 函数参数可选
3. 在 PuppeteerWorkerFactory 中对 get 方法创建的 Page 实例的 $eval, $$eval,
    evaluate, evaluateOnNewDocument, evaluateHandle 几个方法进行切面增强,
    当嵌入的js执行出现异常时能够打印出具体的位置

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
