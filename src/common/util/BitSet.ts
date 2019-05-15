import {Serializable} from "../serialize/Serializable";

/**
 * 仿 Java 中的BitSet实现，目前只用于 BloonFilter
 * BitSet 中每一位有 0 | 1 两个状态
 * 由于键太多会导致 for in 遍历卡主，所以采取分组
 */
@Serializable()
export class BitSet {

    private byteGroups: {
        [groupIndex: number]: {
            [index: number]: number
        }
    } = {};

    // 每组1024个键，可以保存 1024 * 32 位
    private static groupSize = 1024 * 32;

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
        this.byteGroups = {};
    }

    private getGroup(index: number) {
        const groupIndex = parseInt("" + index / BitSet.groupSize);
        let group = this.byteGroups[groupIndex];
        if (!group) {
            this.byteGroups[groupIndex] = group = {};
        }
        return group;
    }

    /**
     * 获取某一位的状态
     * @param {number} index
     * @returns {number}
     */
    get(index: number): number {
        if (index >= this._size) throw new Error(`index(${index}) is out of size(${this._size})`);
        const group = this.getGroup(index);
        const indexInGroup = parseInt("" + (index % BitSet.groupSize) / BitSet.perIntBit);
        return ((group[indexInGroup] || 0) & (1 << (indexInGroup % BitSet.perIntBit))) === 0 ? 0 : 1;
    }

    /**
     * 设置某一位的状态
     * @param {number} index
     * @param {0 | 1} value
     */
    set(index: number, value: 0 | 1) {
        if (index >= this._size) throw new Error(`index(${index}) is out of size(${this._size})`);
        const group = this.getGroup(index);
        const indexInGroup = parseInt("" + (index % BitSet.groupSize) / BitSet.perIntBit);
        const indexByte = group[indexInGroup] || 0;
        const changeBit = 1 << (indexInGroup % BitSet.perIntBit);
        if (value) {
            group[indexInGroup] = indexByte | changeBit;
        }
        else {
            group[indexInGroup] = indexByte & (~changeBit);
        }
    }

}