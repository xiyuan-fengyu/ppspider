
interface ClassInfo {

    id?: string;

    type: any;

    serializable?: boolean;

    transients?: {[field: string]: boolean};

}

const classInfos = new Map<any, ClassInfo>();

const getClassInfoById = (id: string) => {
    const it = classInfos.values();
    for (let classInfo of it) {
        if (classInfo.id == id) {
            return classInfo;
        }
    }
};

export class Serializable {

    constructor(from: any) {
    }

    serialize(): any {
        return null;
    }

}

export class SerializableUtil {

    static serialize(obj: any) {
        const serializedCaches = new Map<any, string>();
        return this._serialize(obj, serializedCaches, "$");
    }

    private static _serialize(obj: any, serializedCaches: Map<any, string>, path: string) {
        // console.log(path);
        if (obj == null || obj == undefined) return obj;

        const objType = typeof obj;
        if (objType == "string" || objType == "number" || objType == "boolean") {
            return obj;
        }

        const serializedCache = serializedCaches.get(obj);
        if (serializedCache !== undefined) {
            return "ref(" + serializedCache + ")";
        }

        serializedCaches.set(obj, path);

        let res;
        const objConstructor = obj.constructor;
        if (objType == "function" || !objConstructor) {
            res = obj;
        }
        else if (obj instanceof Array) {
            res = [];
            (obj as Array<any>).forEach((value, index) => {
                res.push(this._serialize(value, serializedCaches, path + "[" + index + "]"));
            });
        }
        else {
            let classInfo = classInfos.get(objConstructor);
            if (classInfo && classInfo.serializable) {
                if (obj instanceof Serializable) {
                    res = obj.serialize();
                    res.serializeClassId = classInfo.id;
                }
            }

            if (res == null) {
                res = {};
                for (let field of Object.keys(obj)) {
                    if (classInfo && classInfo.transients && classInfo.transients[field]) {
                        // ignore
                    }
                    else res[field] = this._serialize(obj[field], serializedCaches, path + "[" + JSON.stringify(field) + "]");
                }
                if (classInfo && classInfo.id) res.serializeClassId = classInfo.id;
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
            const serializeClassInfo = serializeClassId ? getClassInfoById(serializeClassId) : null;
            if (serializeClassInfo) {
                const serializeClass = serializeClassInfo.type;
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
        let existed = classInfos.get(target);
        if (!existed) {
            existed = {
                type: target
            } as ClassInfo;
            classInfos.set(target, existed);
        }
        existed.id = classId || target.name;
        existed.serializable = true;
    }
}

export function Transient() {
    return function (target: any, field: string) {
        const isStatic = target.constructor.name === "Function";
        if (isStatic) throw new Error("cannot decorate static field with Transient");

        const type = target.constructor;
        let existed = classInfos.get(type);
        if (!existed) {
            existed = {
                type: type
            } as ClassInfo;
            classInfos.set(type, existed);
        }

        if (!existed.transients) existed.transients = {};
        existed.transients[field] = true;
    };
}
