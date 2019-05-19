import * as fs from "fs";
import {PathLike} from "fs";
import * as readline from "readline";

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

/**
 * 被@Serialize装饰的类信息
 */
const classInfos = new Map<any, ClassInfo>();

/**
 * 通过 classId 获取 classInfo
 * @param {string} id
 * @returns {ClassInfo}
 */
export const getClassInfoById = (id: string) => {
    for (let entry of classInfos) {
        let classInfo = entry[1];
        if (classInfo.id == id) {
            return classInfo;
        }
    }
    return null;
};

export const getClassInfoByConstructor = (constructor: any) => {
    return classInfos.get(constructor);
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
 * 序列化和反序列化工具类，目前在整个框架中只有一个地方用到：
 * 1. QueueManager 中保存和加载运行状态
 */
export class SerializableUtil {

    static serializeToFile(obj: any, file: PathLike, encoding: string = "utf-8"): Promise<void> {
        return new Promise((resolve, reject) => {
            let writeStream = fs.createWriteStream(file, encoding);
            let serFinish = false;
            let writeNum = 0;

            const checkWriteFinish = () => {
                if (writeNum == 0) {
                    writeStream.close();
                    resolve();
                }
            };

            let buffer = "";
            const bufferMaxLen = 1024;

            const tryFlush = (force: boolean = false) => {
                if (buffer.length >= bufferMaxLen || (force && buffer.length > 0)) {
                    writeNum++;
                    writeStream.write(buffer, error => {
                        if (error) {
                            reject(error);
                        }
                        else {
                            writeNum--;
                            if (serFinish) {
                                checkWriteFinish();
                            }
                        }
                    });
                    buffer = "";
                }
            };

            const writer = {
                write: str => {
                    buffer += str;
                    tryFlush();
                }
            };
            this._serialize(obj, writer);
            serFinish = true;
            tryFlush(true);
            checkWriteFinish();
        });
    }

    static serializeToString(obj: any): string {
        let res = "";
        const writer = {
            write: str => {
                res += str;
            }
        };
        this._serialize(obj, writer);
        return res;
    }

    private static _serialize(obj: any, writer: Writer): string[] {
        if (this.isSimpleType(obj)) {
            writer.write("g.$=" + JSON.stringify(obj) + ";");
            return;
        }

        // 54进制
        const objIdChars = "$ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
        const objId = num => {
            let res = "";
            let base = 54;
            while (num > 0) {
                res = objIdChars[num % base] + res;
                num = +(num / base).toFixed(0);
            }
            return res || "$";
        };

        const classes = new Map<any, string>();
        const addClassNewFunction = objConstructor => {
            let c = classes.get(objConstructor);
            if (c == null) {
                const classInfo = classInfos.get(objConstructor);
                if (classInfo) {
                    const classId = classes.size;
                    c = "g.c" + classId;
                    classes.set(objConstructor, c);
                    writer.write(`g.class${classId} = (getClass(${JSON.stringify(classInfo.id)}) || {}).type;${c} = obj => { if (g.class${classId}) { const ins = new g.class${classId}(); Object.assign(ins, obj); return ins; } return obj;};\n`);
                }
            }
            return c;
        };

        const refs = new Map<string, {
            objIndex: string,
            keyOrIndex: number | string
        }[]>();
        const addRef = (objIndex: string, keyOrIndex: number | string, refIndex: string) => {
            let arr = refs.get(refIndex);
            if (!arr) {
                refs.set(refIndex, arr = []);
            }
            arr.push({
                objIndex: objIndex,
                keyOrIndex: keyOrIndex
            });
        };

        const objs = new Map<any, {
            index: number,
            symbol: string
        }>();
        objs.set(obj, {index: 0, symbol: "$"});
        const objsIt = objs.entries();
        let entry;
        while (entry = objsIt.next().value) {
            const obj = entry[0];
            const objIndex = entry[1].index;
            const objSymbol = entry[1].symbol;
            const existedObjRefs = [];
            const objType = typeof obj;
            if (obj instanceof Array) {
                const insArr = new Array(obj.length);
                let isAllRef = true;
                for (let i = 0, len = obj.length; i < len; i++) {
                    const value = obj[i];
                    if (this.isSimpleType(value)) {
                        insArr[i] = value;
                        isAllRef = false;
                    }
                    else {
                        let refObjInfo = objs.get(value);
                        if (refObjInfo == null) {
                            refObjInfo = {
                                index: objs.size,
                                symbol:objId(objs.size)
                            };
                            objs.set(value, refObjInfo);
                        }
                        if (refObjInfo.index <= objIndex) {
                            existedObjRefs.push([i, refObjInfo.symbol]);
                        }
                        else {
                            addRef(objSymbol, i, refObjInfo.symbol);
                        }
                    }
                }
                if (isAllRef) {
                    writer.write(`g.${objSymbol}=new Array(${obj.length});`);
                }
                else {
                    const insObjJson = JSON.stringify(insArr);
                    writer.write(`g.${objSymbol}=` + insObjJson + ";");
                }
            }
            else if (objType == "object") {
                const objConstructor = obj.constructor;
                const newF = addClassNewFunction(objConstructor);
                const transients = transientFields[objConstructor];
                const insObj = {};
                for (let field in obj) {
                    if (transients && transients[field]) {
                        // 忽略字段
                        continue;
                    }
                    const value = obj[field];
                    if (this.isSimpleType(value)) {
                        insObj[field] = value;
                    }
                    else {
                        let refObjInfo = objs.get(value);
                        if (refObjInfo == null) {
                            refObjInfo = {
                                index: objs.size,
                                symbol:objId(objs.size)
                            };
                            objs.set(value, refObjInfo);
                        }
                        if (refObjInfo.index <= objIndex) {
                            existedObjRefs.push([field, refObjInfo.symbol]);
                        }
                        else {
                            addRef(objSymbol, field, refObjInfo.symbol);
                        }
                    }
                }
                const insObjJson = JSON.stringify(insObj);
                writer.write(`g.${objSymbol}=` + (newF ? newF + "(" + insObjJson + ")" : insObjJson) + ";");
            }
            else if (objType == "function") {
                const classInfo = classInfos.get(obj);
                if (classInfo) {
                    writer.write(`g.${objSymbol}=getClass(${JSON.stringify(classInfo.id)});`);
                }
                else {
                    writer.write(`g.${objSymbol}=(${obj.toString().replace(/\n/g, ";")});`);
                }
            }
            for (let refInfo of existedObjRefs) {
                writer.write(`g.${objSymbol}[${typeof refInfo[0] == "number" ? refInfo[0] : JSON.stringify(refInfo[0])}]=g.${refInfo[1]};`);
            }
            const refsOfThis = refs.get(objSymbol);
            if (refsOfThis) {
                for (let refItem of refsOfThis) {
                    writer.write(`g.${refItem.objIndex}[${typeof refItem.keyOrIndex == "number" ? refItem.keyOrIndex : JSON.stringify(refItem.keyOrIndex)}]=g.${objSymbol};`);
                }
                refs.delete(objSymbol);
            }
            writer.write("\n");
        }
    }

    private static isSimpleType(obj: any) {
        if (obj == null || obj == undefined) return true;
        const objType = typeof obj;
        return objType == "string" || objType == "number" || objType == "boolean";
    }

    static deserializeFromString(str: string) {
        const getClass = id => getClassInfoById(id);
        const g: any = {};
        eval(str);
        return g.$;
    }

    static deserializeFromFile(file: PathLike, encoding: string = "utf-8"): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const getClass = id => getClassInfoById(id);
            const g: any = {};

            const lineBuffer = [];
            let waitReadFinishResolve;
            const waitReadFinishPromise = new Promise(resolve => waitReadFinishResolve = resolve);

            const evalLines =() => {
                let subLinesStr = lineBuffer.join("\n");
                try {
                    eval(subLinesStr);
                }
                catch (e) {
                    const stacks = e.stack.split("\n");
                    stacks.splice(1, 0, subLinesStr);
                    e.stack = stacks.join("\n");
                    waitReadFinishResolve(e);
                }
                lineBuffer.splice(0, lineBuffer.length);
            };

            const reader = readline.createInterface({
                input: fs.createReadStream(file).setEncoding(encoding)
            });
            reader.on('line', function(line) {
                lineBuffer.push(line);
                lineBuffer.length >= 1000 && evalLines();
            });
            reader.on('close', function(line) {
                lineBuffer.length > 0 && evalLines();
                waitReadFinishResolve();
            });

            waitReadFinishPromise.then(err => {
                if (err) {
                    reader.close();
                    return reject(err);
                }

                resolve(g.$);
            });
        });
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
