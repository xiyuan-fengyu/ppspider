
# 2018-09-13
1. 通过 AddToQueue 向队列中添加任务时，如果队列不存在，仅打印 waring 级别的日志，而不是抛出异常，这样可以在使用 PuppeteerUtil.links时，
    可以先将不需要的url匹配到不存在的队列名中  
    另外为 AddToQueue 注解添加新的参数用于屏蔽上面的warning信息  

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

