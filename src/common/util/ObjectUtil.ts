
export class ObjectUtil {

  static transform(obj: any, trans: (value: any) => any) {
    if (obj == null) return null;

    if (obj.constructor == Array) {
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
