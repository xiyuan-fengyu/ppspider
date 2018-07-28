import {Serialize} from "../serialize/Serialize";

/**
 * 仿 Java 中的BitSet实现，目前只用于 BloonFilter
 * BitSet 中每一位有 0 | 1 两个状态
 */
@Serialize({
    /**
     * 启用自定义序列化，如果采用默认的序列化，序列化后的体积大，因为 bytes 这个字段是一个大多数项为0的大数组（多数情况下是这样）
     * 采用自定义序列化后，通过map形式保存，大多数情况下会减小体积，加快序列化速度
     */
    customSerialize: true
})
export class BitSet {

    private bytes: Uint8Array;

    private readonly _size: number;

    constructor(arg: any) {
        const argType = typeof arg;
        if (argType == "number") {
            this._size = arg;
            this.newBytes();
        }
        else if (argType == "object") {
            // 自定义反序列
            this._size = arg._size;
            this.newBytes();
            for (let index of Object.keys(arg.bytes)) {
                this.bytes[parseInt(index)] = arg.bytes[index];
            }
        }
    }

    /**
     * 自定义序列化
     * @returns {any}
     */
    serialize(): any {
        const ser = {
            _size: this._size,
            bytes: {}
        };
        for (let i = 0, len = this.bytes.length; i < len; i++) {
            const v = this.bytes[i];
            if (v != 0) ser.bytes[i] = this.bytes[i];
        }
        return ser;
    }

    get size(): number {
        return this._size;
    }

    /**
     * Uint8Array 中每一项是一个是一个 8bit 的无符号整数，能存储 8个位置的状态
     * 所以 bytes 可以按照如下方式通过 _size 计算出来
     */
    private newBytes() {
        this.bytes = new Uint8Array(parseInt("" + (this._size - 1) / 8) + 1);
    }

    clear() {
        this.newBytes();
    }

    /**
     * 获取某一位的状态
     * @param {number} index
     * @returns {number}
     */
    get(index: number): number {
        if (index >= this._size) throw new Error(`index(${index}) is out of size(${this._size})`);
        return (this.bytes[parseInt("" + index / 8, 10)] & (1 << (index % 8))) === 0 ? 0 : 1;
    }

    /**
     * 设置某一位的状态
     * @param {number} index
     * @param {0 | 1} value
     */
    set(index: number, value: 0 | 1) {
        if (index >= this._size) throw new Error(`index(${index}) is out of size(${this._size})`);
        const byteIndex = parseInt("" + index / 8, 10);
        const indexByte = this.bytes[byteIndex];
        const changeBit = 1 << (index % 8);
        if (value) {
            this.bytes[byteIndex] = indexByte | changeBit;
        }
        else {
            this.bytes[byteIndex] = indexByte & (~changeBit);
        }
    }

    toString(): string {
        let str = "";
        const maxByteIndex = parseInt("" + this._size / 8, 10);
        for (let i = 0, j = 0; i < maxByteIndex; ++i) {
            const indexByte = this.bytes[i];
            for (let endJ = j + 8; j < endJ && j < this._size; ++j) {
                str += (indexByte & (1 << (j % 8))) === 0 ? '0' : '1';
            }
            str += " ";
        }
        return str;
    }

}