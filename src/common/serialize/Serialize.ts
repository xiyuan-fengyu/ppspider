
export class Serializable {

    constructor(from: any) {
    }

    serialize(): any {
        return null;
    }

}

export class SerializableUtil {

    static readonly serializables: any = {};

    private static isSerialize(constructor: any): boolean {
        return constructor.serializeClassId != null && constructor == this.serializables[constructor.serializeClassId];
    }

    static serialize(obj: any) {
        if (obj == null) return obj;

        const objCons = obj.constructor;
        if (objCons == Array) {
            const arr = [];
            for (let item of obj) {
                arr.push(this.serialize(item));
            }
            return arr;
        }
        else if (obj instanceof Object) {
            let ser: any;
            let flag = this.isSerialize(objCons);
            if (flag) {
                if (obj instanceof Serializable) {
                    ser = obj.serialize();
                    ser.serializeClassId = objCons.serializeClassId;
                }
            }
            if (ser == null) {
                ser = {};
                for (let field of Object.keys(obj)) {
                    ser[field] = this.serialize(obj[field]);
                }
                if (flag) ser.serializeClassId = objCons.serializeClassId;
            }
            return ser;
        }
        else return obj;
    }

    private static isExtendsFromSerializable(clazz) {
        while (clazz && clazz != Object) {
            const __proto__ = clazz.__proto__;
            if (__proto__ == Serializable) {
                return true;
            }
            else clazz = clazz.__proto__;
        }
        return false;
    }
    
    static deserialize(obj: any): any {
        if (obj == null) return obj;

        if (obj.constructor == Array) {
            const arr = [];
            for (let item of obj) {
                arr.push(this.deserialize(item));
            }
            return arr;
        }
        else if (obj instanceof Object) {
            const serializeClassId = obj.serializeClassId;
            const serializeClass = serializeClassId ? this.serializables[serializeClassId] : null;
            if (serializeClass) {
                if (this.isExtendsFromSerializable(serializeClass)) {
                    return new serializeClass(obj);
                }
                else {
                    const deser: any = new serializeClass();
                    for (let field of Object.keys(obj)) {
                        if (field != "serializeClassId") deser[field] = this.deserialize(obj[field]);
                    }
                    return deser;
                }
            }
            else {
                const deser: any = {};
                for (let field of Object.keys(obj)) {
                    deser[field] = this.deserialize(obj[field]);
                }
                return deser;
            }
        }
        else return obj;
    }

}

export function Serialize(classId?: string) {
    return function (target) {
        const targetClassId = classId || target.name;
        if (SerializableUtil.serializables.hasOwnProperty(targetClassId)) {
            throw new Error("serializable class id existed: " + targetClassId);
        }
        else {
            target.serializeClassId = targetClassId;
            SerializableUtil.serializables[targetClassId] = target;
        }
    }
}