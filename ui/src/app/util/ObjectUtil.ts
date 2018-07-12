
export class ObjectUtil {

  static copy(from: any, to: any) {
    if (from == null || to == null) return;

    if (from.constructor == Array) {
      this.copyArr(from, to);
    }
    else {
      for (let fromKey in from) {
        const fromValue = from[fromKey];
        if (!to.hasOwnProperty(fromKey)) to[fromKey] = fromValue;
        else  {
          const toValue = to[fromKey];
          if (fromValue == null || toValue == null || toValue.constructor != fromValue.constructor) to[fromKey] = fromValue;
          else {
            if (fromValue.constructor == Object) {
              this.copy(fromValue, toValue);
            }
            else if (fromValue.constructor == Array) {
              this.copyArr(fromValue, toValue);
            }
            else if (fromValue != toValue) {
              to[fromKey] = fromValue;
            }
          }
        }
      }

      for (let toKey of Object.keys(to)) {
        if (!from.hasOwnProperty(toKey)) {
          delete to[toKey];
        }
      }
    }
  }

  private static copyArr(from: any[], to: any[]) {
    for (let i = 0, len = from.length; i < len; i++) {
      let fromValueI = from[i];
      let toValueI = to[i];
      if (fromValueI == null || toValueI == null || fromValueI.constructor != toValueI.constructor) {
        to[i] = fromValueI;
      }
      else if (fromValueI.constructor == Object) {
        this.copy(fromValueI, toValueI);
      }
      else if (fromValueI.constructor == Array) {
        this.copyArr(fromValueI, toValueI);
      }
      else if (fromValueI != toValueI) {
        to[i] = fromValueI;
      }
    }
    to.splice(from.length)
  }

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
