import {Serializable} from "../serialize/Serializable";

/**
 * 仿 Java 中的BitSet实现，目前只用于 BloonFilter
 * BitSet 中每一位有 0 | 1 两个状态
 */
@Serializable()
export class BitSet {

    private bytes: {[index: number]: number} = {};

    private _size: number;

    constructor(arg: any) {
        const argType = typeof arg;
        if (argType == "number") {
            this._size = arg;
        }
    }

    get size(): number {
        return this._size;
    }

    clear() {
        this.bytes = {};
    }

    /**
     * 获取某一位的状态
     * @param {number} index
     * @returns {number}
     */
    get(index: number): number {
        if (index >= this._size) throw new Error(`index(${index}) is out of size(${this._size})`);
        return ((this.bytes[parseInt("" + index / 8, 10)] || 0) & (1 << (index % 8))) === 0 ? 0 : 1;
    }

    /**
     * 设置某一位的状态
     * @param {number} index
     * @param {0 | 1} value
     */
    set(index: number, value: 0 | 1) {
        if (index >= this._size) throw new Error(`index(${index}) is out of size(${this._size})`);
        const byteIndex = parseInt("" + index / 8);
        const indexByte = this.bytes[byteIndex] || 0;
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
        const maxByteIndex = parseInt("" + this._size / 8);
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