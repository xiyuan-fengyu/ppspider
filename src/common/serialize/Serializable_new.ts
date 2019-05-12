import * as fs from "fs";
import {BitSet} from "../util/BitSet";
import {PathLike} from "fs";
import {Readable} from "stream";

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



class Deserializer {

    private resResolve: (res: any) => void;

    private resReject: (err: Error) => void;

    private res: any;

    private error: Error;

    onRead(str: string) {

    }

    onEnd() {
        if (this.resResolve) {
            this.resResolve(this.res);
        }
    }

    onError(err: Error) {
        this.error = err;
        if (this.resReject) {
            this.resReject(err);
        }
    }

    get(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this.res != null) {
                resolve(this.res);
            }
            else if (this.error) {
                reject(this.error);
            }
            else {
                this.resResolve = resolve;
                this.resReject = reject;
            }
        });
    }

}

interface Writer {

    write(str: string);

}

/**
 * 序列化和反序列化工具类，目前在整个框架中只有两个地方用到：
 * 1. QueueManager 中保存和加载运行状态
 */
export class SerializableUtil {

    private static replacementChars = (() => {
        const res = {};
        for (let i = 0; i <= 0x1f; i++) {
            let hex = Number(i).toString(16);
            hex = "0000".slice(0, -hex.length) + hex;
            res[String.fromCharCode(i)] = "\\u" + hex;
        }
        res['"'] = "\\\"";
        res['\\'] = "\\\\";
        res['\t'] = "\\t";
        res['\b'] = "\\b";
        res['\n'] = "\\n";
        res['\r'] = "\\r";
        res['\f'] = "\\f";
        return res;
    })();

    private static isNormal(obj: any) {
        if (obj == null || obj == undefined) return true;

        const objType = typeof obj;
        return objType == "string" || objType == "number" || objType == "boolean";
    }

    static serializeToFile(obj: any, file: PathLike): void {
        this._serialize(obj, fs.createWriteStream(file, "utf-8") as Writer, new Map<any, number>());
    }

    static serializeToString(obj: any): string {
        let res = "";
        const writer = {
            write: str => {
                res += str;
            }
        };
        this._serialize(obj, writer as Writer, new Map<any, number>());
        return res;
    }

    private static _serialize(obj: any, writer: Writer, objCache: Map<any, number>, context?: {
        first: boolean,
        key?: string
    }) {
        if (typeof obj == "function") {
            return;
        }

        if (context) {
            if (!context.first) {
                writer.write(",");
            }
            if (context.key != null) {
                this.writeString("" + context.key, writer);
                writer.write(":");
            }
            context.first = false;
        }

        if (this.isNormal(obj)) {
            if (typeof obj == "string") {
                this.writeString(obj, writer);
            }
            else {
                writer.write("" + obj);
            }
        }
        else {
            const objRef = objCache.get(obj);
            if (objRef != null) {
                writer.write("_" + objRef);
            }
            else {
                objCache.set(obj, objCache.size);
                if (obj instanceof Array) {
                    writer.write("[");
                    const newContext = {
                        first: true
                    };
                    for (let item of obj) {
                        this._serialize(item, writer, objCache, newContext);
                    }
                    writer.write("]");
                }
                else {
                    writer.write("{");
                    const newContext = {
                        first: true,
                        key: null
                    };

                    let classInfo = classInfos.get(obj.constructor);
                    if (classInfo) {
                        writer.write("_:");
                        this.writeString(classInfo.id, writer);
                        newContext.first = false;
                    }

                    const transients = transientFields[obj.constructor];
                    for (let key in obj) {
                        if (transients && transients[key]) {
                            // 忽略字段
                        }
                        else {
                            const value = obj[key];
                            newContext.key = key;
                            this._serialize(value, writer, objCache, newContext);
                        }
                    }

                    writer.write("}");
                }
            }
        }
    }


    private static writeString(str: string, writer: Writer) {
        writer.write("\"");
        let last = 0;
        let length = str.length;
        const c128 = String.fromCharCode(128);
        for (let i = 0; i < length; i++) {
            const c = str.charAt(i);
            let replacement;
            if (c < c128) {
                replacement = this.replacementChars[c];
                if (replacement == null) {
                    continue;
                }
            } else if (c == '\u2028') {
                replacement = "\\u2028";
            } else if (c == '\u2029') {
                replacement = "\\u2029";
            } else {
                continue;
            }
            if (last < i) {
                writer.write(str.substring(last, i));
            }
            writer.write(replacement);
            last = i + 1;
        }
        if (last < length) {
            writer.write(str.substring(last));
        }
        writer.write("\"");
    }

}






class A {
    paraA = "aaa";
    random = parseInt((Math.random() * 10000).toFixed());
    b: B;
}

class B {
    paraB = 123;
    random = parseInt((Math.random() * 10000).toFixed());
    a: A;
}

@Serializable()
class C {

    @Transient()
    private transientF = "test transient";

    private a: A;
    private b: B;
    bitSet: BitSet;
    paramNum = 12;
    paramBoolean = true;
    paramString = "test";
    paramObj = {
        aa: null,
        bb: null,
        bitSet: null
    };
    paramArray: any[] = [
        1,
        "2",
        false
    ];

    private testLambda = () => true;

    testFun() {
        return "test";
    }

    constructor() {
        this.a = new A();
        this.b = new B();
        this.a.b = this.b;
        this.b.a = this.a;
        this.bitSet = new BitSet(2 << 10);
        this.bitSet.set(8, 1);
        this.bitSet.set(16, 1);
        this.paramObj.aa = this.a;
        this.paramObj.bb = this.b;
        this.paramObj.bitSet = this.bitSet;
        this.paramArray.push(this.a);
        this.paramArray.push(this.b);
        this.paramArray.push(this.bitSet);
    }

}

SerializableUtil.serializeToFile(new C(), "test.txt");
