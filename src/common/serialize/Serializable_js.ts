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
        const transients = transientFields[target.constructor];
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

interface Writer {

    write(str: string);

}

/**
 * 序列化和反序列化工具类，目前在整个框架中只有两个地方用到：
 * 1. QueueManager 中保存和加载运行状态
 * 2. JobManager 中对 job 进行序列化保存和反序列化加载
 */
export class SerializableUtil {

    /**
     * 序列化
     */
    static serialize(obj: any, writer: Writer): string[] {
        if (this.isSimpleType(obj)) {
            writer.write("const _0=" + JSON.stringify(obj));
            return;
        }

        const classes = new Map<any, string>();
        const addClassNewFunction = objConstructor => {
            let c = classes.get(objConstructor);
            if (c == null) {
                const classInfo = getClassInfoById(objConstructor);
                if (classInfo) {
                    const classId = classes.size;
                    c = "c" + classId;
                    classes.set(objConstructor, c);
                    writer.write(`
const class${classId} = (classes.get(${classInfo.id}) || {}).type;
const c${classId} = obj => {
    if (class${classId}) {
        const ins = new class${classId}();
        Object.assign(ins, obj);
        return ins;
    }
    return obj;
};

`);
                }
            }
            return c;
        };

        const refs = new Map<number, {
            objIndex: number,
            keyOrIndex: number | string
        }[]>();
        const addRef = (objIndex: number, keyOrIndex: number | string, refIndex: number) => {
            let arr = refs.get(refIndex);
            if (!arr) {
                refs.set(refIndex, arr = []);
            }
            arr.push({
                objIndex: objIndex,
                keyOrIndex: keyOrIndex
            });
        };

        const objs = new Map<any, number>();
        objs.set(obj, 0);
        const objsIt = objs.entries();
        let entry;
        while (entry = objsIt.next().value) {
            const obj = entry[0];
            const objIndex = entry[1];
            if (obj instanceof Array) {
                const insArr = [];
                for (let i = 0, len = obj.length; i < len; i++) {
                    const value = obj[i];
                    if (this.isSimpleType(value)) {
                        insArr[i] = value;
                    }
                    else {
                        insArr[i] = null;
                        const refObjIndex = objs.size;
                        objs.set(value, refObjIndex);
                        addRef(objIndex, i, refObjIndex);
                    }
                }
                const insObjJson = JSON.stringify(insArr);
                writer.write(`const _${objIndex}=` + insObjJson + "\n");
            }
            else {
                const objConstructor = obj.constructor;
                const newF = addClassNewFunction(objConstructor);
                const insObj = {};
                for (let field in obj) {
                    const value = obj[field];
                    if (this.isSimpleType(value)) {
                        insObj[field] = value;
                    }
                    else {
                        const refObjIndex = objs.size;
                        objs.set(value, refObjIndex);
                        addRef(objIndex, field, refObjIndex);
                    }
                }
                const insObjJson = JSON.stringify(insObj);
                writer.write(`const _${objIndex}=` + (newF ? newF + "(" + insObjJson + ")" : insObjJson) + "\n");
            }
            const refsObjs  = refs.get(objIndex);

        }

        const serializedCaches = new Map<any, string>();
        const magicNum = (Math.random() * 10000).toFixed(0);
        const serializedRes = [magicNum]; // 第一行为magicNum
        this._serialize(obj, serializedCaches, serializedRes);
        return serializedRes;
    }

    private static isSimpleType(obj: any) {
        if (obj == null || obj == undefined) return true;
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
                res = {};
                const transients = transientFields[objConstructor];
                for (let field of Object.keys(obj)) {
                    if (transients && transients[field]) {
                        // 忽略字段
                    }
                    else res[field] = this._serialize(obj[field], serializedCaches, serializedRes); // 进一步序列化类成员的值
                }
                let classInfo = classInfos.get(objConstructor);
                if (classInfo && classInfo.id) res.serializeClassId = classInfo.id; // 设置 classId，在反序列化时获取类信息
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
