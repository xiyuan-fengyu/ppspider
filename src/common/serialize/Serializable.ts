/**
 * 用于保存 被@Serialize装饰的类 或 类成员被@Transient装饰的类 的类信息
 */
interface ClassInfo {

    /**
     * 类的id，默认使用类名，不能重复
     */
    id?: string;

    /**
     * 类的类型
     */
    type: any;

    /**
     * 记录装饰器调用的位置
     */
    pos: any;

}

/**
 * 序列化时需要忽略的字段
 */
const transientFields = new Map<any, any>();
const classInfos = new Map<any, ClassInfo>();

/**
 * 通过 classId 获取 classInfo
 * @param {string} id
 * @returns {ClassInfo}
 */
const getClassInfoById = (id: string) => {
    for (let entry of classInfos) {
        let classInfo = entry[1];
        if (classInfo.id == id) {
            return classInfo;
        }
    }
    return null;
};

/**
 * 序列化和反序列化工具类，目前在整个框架中只有两个地方用到：
 * 1. QueueManager 中保存和加载运行状态
 * 2. JobManager 中对 job 进行序列化保存和反序列化加载
 */
export class SerializableUtil {

    /**
     * 序列化
     * @param obj
     * @returns {any | string | {}}
     */
    static serialize(obj: any): string[] {
        if (!this.shouldSerialize(obj)) {
            return [
                "-1",
                JSON.stringify(obj)
            ];
        }

        const serializedCaches = new Map<any, string>();
        const magicNum = (Math.random() * 10000).toFixed(0);
        const serializedRes = [magicNum]; // 第一行为magicNum
        this._serialize(obj, serializedCaches, serializedRes);
        return serializedRes;
    }

    private static shouldSerialize(obj: any) {
        if (obj == null || obj == undefined) return false;

        const objType = typeof obj;
        return !(objType == "string" || objType == "number" || objType == "boolean");
    }

    private static _serialize(obj: any, serializedCaches: Map<any, string>, serializedRes: string[]) {
        if (!this.shouldSerialize(obj)) {
            return obj;
        }

        let serializedCache = serializedCaches.get(obj);
        if (serializedCache == undefined) {
            const objConstructor = obj.constructor;
            if (typeof obj == "function" || !objConstructor) {
                // 方法不需要进一步序列化
                return undefined;
            }

            // 保存当前处理的实例的ref id
            serializedCache = serializedRes[0] + "_" + serializedCaches.size;
            serializedCaches.set(obj, serializedCache);

            let res = null;
            if (obj instanceof Array) {
                res = [];
                (obj as Array<any>).forEach((value, index) => {
                    res.push(this._serialize(value, serializedCaches, serializedRes)); // 数组中每个元素需要进一步序列化
                });
            }
            else {
                let classInfo = classInfos.get(objConstructor);

                if (res == null) {
                    res = {};
                    const transients = transientFields[objConstructor];
                    for (let field of Object.keys(obj)) {
                        if (transients && transients[field]) {
                            // 忽略字段
                        }
                        else res[field] = this._serialize(obj[field], serializedCaches, serializedRes); // 进一步序列化类成员的值
                    }
                    if (classInfo && classInfo.id) res.serializeClassId = classInfo.id; // 设置 classId，在反序列化时获取类信息
                }
            }
            serializedRes.push(serializedCache + " " + JSON.stringify(res));
        }
        return "ref(" + serializedCache + ")";
    }

    /**
     * 反序列化
     * @param lines
     * @returns {any}
     */
    static deserialize(lines: string[]): any {
        if (lines[0] == "-1") {
            return JSON.parse(lines[1]);
        }

        const deserializedCaches = {};
        this._deserialize(lines, deserializedCaches, {});
        return deserializedCaches[lines[0] + "_0"];
    }

    private static _deserialize(lines: string[], deserializedCaches: any, refCaches: any): any {
        const magicNum = lines[0];
        const objIdRegex = new RegExp("^ref\\((" + magicNum + "_\\d+)\\)$");
        for (let i = 1, len = lines.length; i < len; i++) {
            const line = lines[i];
            const spaceI = line.indexOf(" ");
            const objId = line.substring(0, spaceI);
            if (!objId.startsWith(magicNum + "_")) {
                throw new Error("bad serialized line, wrong magic num: " + line);
            }

            let obj = JSON.parse(line.substring(spaceI + 1));
            if (obj instanceof Array) {
                for (let j = 0, objLen = obj.length; j < objLen; j++) {
                    this.checkRefCache(objIdRegex, obj, j, deserializedCaches, refCaches);
                }
            }
            else {
                const serializeClassId = obj.serializeClassId;
                const serializeClassInfo = serializeClassId ? getClassInfoById(serializeClassId) : null;
                if (serializeClassInfo) {
                    delete obj.serializeClassId;
                    const serializeClass = serializeClassInfo.type;
                    const newObj = new serializeClass();
                    Object.assign(newObj, obj);
                    obj = newObj;
                }
                for (let key of Object.keys(obj)) {
                    this.checkRefCache(objIdRegex, obj, key, deserializedCaches, refCaches);
                }
            }

            deserializedCaches[objId] = obj;
            let refs = refCaches[objId];
            if (refs) {
                for (let ref of refs) {
                    ref.obj[ref.keyOrIndex] = obj;
                }
                delete refCaches[objId];
            }
        }
    }

    private static checkRefCache(objIdRegex: RegExp, obj: any, keyOrIndex: any, deserializedCaches: any, refCaches: any) {
        let m;
        const value = obj[keyOrIndex];
        if (typeof value == "string" && (m = objIdRegex.exec(value))) {
            let refId = m[1];
            let refObj = deserializedCaches[refId];
            if (refObj) {
                obj[keyOrIndex] = refObj;
            }
            else {
                let refs = refCaches[refId];
                if (refs == null) {
                    refs = [];
                    refCaches[refId] = refs;
                }
                refs.push({
                    obj: obj,
                    keyOrIndex: keyOrIndex
                });
            }
        }
    }

}


/**
 * @deprecated
 */
export class SerializableUtil_old {

    /**
     * 反序列化
     * @param obj
     * @returns {any}
     */
    static deserialize(obj: any): any {
        return this._deserialize(obj, {}, obj, "$");
    }

    private static _deserialize(obj: any, deserializedCaches: any, root: any, path: string): any {
        if (obj == null) return obj;

        const objType = typeof obj;
        if (objType == "number" || objType == "boolean") {
            return obj; // number | boolean 不需要反序列化，直接返回
        }
        else if (objType == "string") {
            const str = obj as string;
            if (str.startsWith("ref($") && str.endsWith(")")) {
                const refPath = str.substring(4, str.length - 1);
                let deserializedCache = deserializedCaches[refPath];
                if (deserializedCache === undefined) {
                    const $ = root;
                    try {
                        deserializedCache = deserializedCaches[refPath] = eval(refPath); // 根据绝对路径计算引用表达式的值
                    }
                    catch (e) {
                        return str; // 根据路径获取值失败，当做普通 string 返回
                    }
                }
                return deserializedCache;
            }
            else return obj; // 普通的 string 值，直接返回结果
        }

        let res = null;
        if (obj instanceof Array) {
            res = deserializedCaches[path] = [];
            (obj as Array<any>).forEach((value, index) => {
                res.push(this._deserialize(value, deserializedCaches, root, path + "[" + index + "]")); // 进一步反序列化数组中每一个元素
            });
        }
        else {
            const serializeClassId = (obj as any).serializeClassId;
            const serializeClassInfo = serializeClassId ? getClassInfoById(serializeClassId) : null;
            if (serializeClassInfo) {
                const serializeClass = serializeClassInfo.type;
                res = deserializedCaches[path] = new serializeClass();
                for (let field of Object.keys(obj)) {
                    if (field != "serializeClassId") res[field] =
                        this._deserialize(obj[field], deserializedCaches, root, path + "[" + JSON.stringify(field) + "]");
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

const stackPosReg = new RegExp("^at .* \\((.*)\\)$");

/**
 * 获取 @Serialize 的装饰位置，以便在后续报错时能指出正确的位置
 * @returns {string}
 */
function getDecoratorPos() {
    const stack = new Error("test").stack.split("\n");
    const pos = stack[3].trim();
    const stackPosM = stackPosReg.exec(pos);
    return stackPosM ? stackPosM[1] : null;
}

export interface SerializableConfig {
    classId?: string;
}

/**
 * 在js加载的过程中，有这个装饰器的类的类信息会保存到 classInfos 中，用于序列化和反序列化
 * @param {SerializableConfig} config
 * @returns {(target) => void}
 * @constructor
 */
export function Serializable(config?: SerializableConfig) {
    const decoratorPos = getDecoratorPos();
    return function (target) {
        if (!config) config = {};

        const id = config.classId || target.name;
        let existed = classInfos.get(id);
        if (!existed) {
            existed = {
                id: config.classId || target.name,
                type: target,
                pos: decoratorPos,
                transients: transientFields[target],
            } as ClassInfo;
            classInfos.set(target, existed);
        }
        else {
            throw new Error("duplicate classId(" + existed.id + ") at: \n" + existed.pos + "\n" + existed.pos);
        }
    }
}

/**
 * 类在序列化时要忽略的字段
 * 不能作用于类静态字段
 * @returns {(target: any, field: string) => void}
 * @constructor
 */
export function Transient() {
    return function (target: any, field: string) {
        const isStatic = target.constructor.name === "Function";
        if (isStatic) throw new Error("cannot decorate static field with Transient"); // @Transient 不能作用于类静态成员

        const type = target.constructor;
        let transients = transientFields[type];
        if (!transients) {
            transientFields[type] = transients = {};
        }
        transients[field] = true;
    };
}

export function Assign(target, source) {
    if (source && target && typeof source == "object" && typeof target == "object") {
        const transients = transientFields[source.constructor];
        if (transients) {
            for (let field of Object.keys(source)) {
                if (!transients[field]) {
                    target[field] = source[field];
                }
            }
        }
        else {
            Object.assign(target, source);
        }
    }
}
