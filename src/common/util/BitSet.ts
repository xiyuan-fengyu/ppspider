import {Serializable} from "../serialize/Serializable";

/**
 * 仿 Java 中的BitSet实现，目前只用于 BloonFilter
 * BitSet 中每一位有 0 | 1 两个状态
 * 由于键太多会导致 for in 遍历卡主，所以采取分组
 */
@Serializable()
export class BitSet {

    private bytes: {
        [index: number]: number
    } = {};

    // 每一个整数可以保存 32 位
    private static perIntBit = 32;

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
        const numIndex = parseInt("" + index / BitSet.perIntBit);
        return ((this.bytes[numIndex] || 0) & (1 << (index % BitSet.perIntBit))) === 0 ? 0 : 1;
    }

    /**
     * 设置某一位的状态
     * @param {number} index
     * @param {0 | 1} value
     */
    set(index: number, value: 0 | 1) {
        if (index >= this._size) throw new Error(`index(${index}) is out of size(${this._size})`);
        const numIndex = parseInt("" + index / BitSet.perIntBit);
        const indexByte = this.bytes[numIndex] || 0;
        const changeBit = 1 << (index % BitSet.perIntBit);
        if (value) {
            this.bytes[numIndex] = indexByte | changeBit;
        }
        else {
            this.bytes[numIndex] = indexByte & (~changeBit);
        }
    }

}