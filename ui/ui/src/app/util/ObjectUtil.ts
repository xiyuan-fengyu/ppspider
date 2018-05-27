
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

      for (let toKey in Object.keys(to)) {
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
        toValueI[i] = fromValueI;
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

}
