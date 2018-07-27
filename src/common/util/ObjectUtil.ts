/**
 * 深度遍历 obj，并对其中的值做转换；目前框架中仅在 JobManager 中用于将 job 时间戳转换为 yyyy-MM-dd HH:mm:ss 格式，方便前端界面阅读
 */
export class ObjectUtil {

  static transform(obj: any, trans: (value: any) => any) {
    if (obj == null) return null;

    if (obj instanceof Array) {
      for (let i = 0, len = obj.length; i < len; i++) {
        obj[i] = this.transform(obj[i], trans);
      }
    }
    else if (typeof obj == "object") {
      for (let key of Object.keys(obj)) {
        obj[key] = this.transform(obj[key], trans);
      }
    }
    return trans(obj);
  }

}
