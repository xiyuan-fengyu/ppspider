
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
        const serializedCaches = [];
        return this._serialize(obj, serializedCaches, "$");
    }

    private static _serialize(obj: any, serializedCaches: any[], path: string) {
        // console.log(path);
        if (obj == null || obj == undefined) return obj;

        const objType = typeof obj;
        if (objType == "string" || objType == "number" || objType == "boolean") {
            return obj;
        }

        for (let serializedCache of serializedCaches) {
            if (serializedCache.instance == obj) {
                return "ref(" + serializedCache.path + ")";
            }
        }

        serializedCaches.push({
            instance: obj,
            path: path
        });

        let res;
        const objConstructor = obj.constructor;
        if (objType == "function" || !objConstructor) {
            res = obj;
        }
        else if (objConstructor == Array) {
            res = [];
            (obj as Array<any>).forEach((value, index) => {
                res.push(this._serialize(value, serializedCaches, path + "[" + index + "]"));
            });
        }
        else {
            let flag = this.isSerialize(objConstructor);
            if (flag) {
                if (obj instanceof Serializable) {
                    res = obj.serialize();
                    res.serializeClassId = objConstructor.serializeClassId;
                }
            }

            if (res == null) {
                res = {};
                for (let field of Object.keys(obj)) {
                    res[field] = this._serialize(obj[field], serializedCaches, path + "[" + JSON.stringify(field) + "]");
                }
                if (flag) res.serializeClassId = objConstructor.serializeClassId;
            }
        }
        return res || {};
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
        return this._deserialize(obj, {}, obj, "$");
    }

    private static _deserialize(obj: any, deserializedCaches: any, root: any, path: string): any {
        if (obj == null) return obj;

        const objType = typeof obj;
        if (objType == "number" || objType == "boolean") {
            return obj;
        }
        else if (objType == "string") {
            const str = obj as string;
            if (str.startsWith("ref($") && str.endsWith(")")) {
                const refPath = str.substring(4, str.length - 1);
                let deserializedCache = deserializedCaches[refPath];
                if (deserializedCache === undefined) {
                    const $ = root;
                    deserializedCache = deserializedCaches[refPath] = eval(refPath);
                }
                return deserializedCache;
            }
            else return obj;
        }

        let res = null;
        if (obj.constructor == Array) {
            res = deserializedCaches[path] = [];
            (obj as Array<any>).forEach((value, index) => {
                res.push(this._deserialize(value, deserializedCaches, root, path + "[" + index + "]"));
            });
        }
        else {
            const serializeClassId = obj.serializeClassId;
            const serializeClass = serializeClassId ? this.serializables[serializeClassId] : null;
            if (serializeClass) {
                if (this.isExtendsFromSerializable(serializeClass)) {
                    res = deserializedCaches[path] = new serializeClass(obj);
                }
                else {
                    res = deserializedCaches[path] = new serializeClass();
                    for (let field of Object.keys(obj)) {
                        if (field != "serializeClassId") res[field] =
                            this._deserialize(obj[field], deserializedCaches, root, path + "[" + JSON.stringify(field) + "]");
                    }
                }
            }
            else {
                res = deserializedCaches[path] = {};
                for (let field of Object.keys(obj)) {
                    res[field] = this._deserialize(obj[field], deserializedCaches, root, path + "[" + JSON.stringify(field) + "]");
                }
            }
        }
        return res;
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