/**
 * 用于保存 被@Serialize装饰的类 或 类成员被@Transient装饰的类 的类信息
 */
import {logger} from "../util/logger";

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

    /**
     * 是否自定义序列化和反序列化
     */
    customSerialize?: boolean;

    /**
     * 序列化时需要忽略的字段
     */
    transients?: {[field: string]: boolean};

}

const classInfos = new Map<any, ClassInfo>();

/**
 * 通过 classId 获取 classInfo
 * @param {string} id
 * @returns {ClassInfo}
 */
const getClassInfoById = (id: string) => {
    const it = classInfos.values();
    for (let classInfo of it) {
        if (classInfo.id == id) {
            return classInfo;
        }
    }
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
    static serialize(obj: any) {
        const serializedCaches = new Map<any, string>();
        return this._serialize(obj, serializedCaches, "$");
    }

    private static _serialize(obj: any, serializedCaches: Map<any, string>, path: string) {
        // console.log(path);
        if (obj == null || obj == undefined) return obj; // null 和 undefined 不参与序列化

        const objType = typeof obj;
        if (objType == "string" || objType == "number" || objType == "boolean") {
            return obj; // string | number | boolean 不需要进一步序列化，直接返回原值
        }

        const serializedCache = serializedCaches.get(obj);
        if (serializedCache !== undefined) {
            return "ref(" + serializedCache + ")"; // 序列化过程，如果当前处理的实例在之前已经有过序列化，则返回之前实例在序列化后对象中的路径，解决循环引用的问题
        }

        // 保存当前处理的实例的路径
        serializedCaches.set(obj, path);

        let res;
        const objConstructor = obj.constructor;
        if (objType == "function" || !objConstructor) {
            res = obj; // 方法不需要进一步序列化
        }
        else if (obj instanceof Array) {
            res = [];
            (obj as Array<any>).forEach((value, index) => {
                res.push(this._serialize(value, serializedCaches, path + "[" + index + "]")); // 数组中每个元素需要进一步序列化
            });
        }
        else {
            let classInfo = classInfos.get(objConstructor);
            if (classInfo && classInfo.customSerialize) {
                res = obj.serialize(); // 调用用户自定义序列化方法
                res.serializeClassId = classInfo.id; // 设置 classId，在反序列化时获取类信息
            }

            if (res == null) {
                res = {};
                for (let field of Object.keys(obj)) {
                    if (classInfo && classInfo.transients && classInfo.transients[field]) {
                        // 忽略字段
                    }
                    else res[field] = this._serialize(obj[field], serializedCaches, path + "[" + JSON.stringify(field) + "]"); // 进一步序列化类成员的值
                }
                if (classInfo && classInfo.id) res.serializeClassId = classInfo.id; // 设置 classId，在反序列化时获取类信息
            }
        }
        return res || {};
    }

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
                        logger.warn(e.stack);
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
            const serializeClassId = obj.serializeClassId;
            const serializeClassInfo = serializeClassId ? getClassInfoById(serializeClassId) : null;
            if (serializeClassInfo) {
                const serializeClass = serializeClassInfo.type;
                if (serializeClassInfo.customSerialize) {
                    res = deserializedCaches[path] = new serializeClass(obj); // 该类采用用户自定义序列化和反序列化
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

export interface SerializeConfig {
    classId?: string;
    customSerialize?: false | boolean;
}

/**
 * 在js加载的过程中，有这个装饰器的类的类信息会保存到 classInfos 中，用于序列化和反序列化
 * @param {SerializeConfig} config
 * @returns {(target) => void}
 * @constructor
 */
export function Serialize(config?: SerializeConfig) {
    const decoratorPos = getDecoratorPos();
    return function (target) {
        if (!config) config = {};

        let existed = classInfos.get(target);
        if (!existed) {
            existed = {
                type: target
            } as ClassInfo;
            classInfos.set(target, existed);
        }
        existed.id = config.classId || target.name;
        existed.pos = decoratorPos;
        existed.customSerialize = !!config.customSerialize;

        // 当启用自定义序列化时，检查是否定义了 serialize 方法
        if (existed.customSerialize && typeof target.prototype.serialize != "function") {
            throw new Error("custom serialize function is not found: " + decoratorPos);
        }

        // 检测 id 是否重复
        for (let classInfo of classInfos.values()) {
            if (classInfo != existed && classInfo.id == existed.id) {
                throw new Error("duplicate classId(" + existed.id + ") at: \n" + existed.pos + "\n" + classInfo.pos);
            }
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
