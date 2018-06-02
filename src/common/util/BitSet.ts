import {Serializable, Serialize} from "../serialize/Serialize";

@Serialize()
export class BitSet extends Serializable {

    private bytes: Uint8Array;

    private readonly _size: number;

    constructor(arg: any) {
        super(arg);
        const argType = typeof arg;
        if (argType == "number") {
            this._size = arg;
            this.newBytes();
        }
        else if (argType == "object") {
            this._size = arg._size;
            this.newBytes();
            for (let index of Object.keys(arg.bytes)) {
                this.bytes[parseInt(index)] = arg.bytes[index];
            }
        }
    }

    serialize() {
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

    private newBytes() {
        this.bytes = new Uint8Array((this._size - 1) / 8 + 1);
    }

    clear() {
        this.newBytes();
    }

    get(index: number): number {
        if (index >= this._size) return 0;
        return (this.bytes[parseInt("" + index / 8, 10)] & (1 << (index % 8))) === 0 ? 0 : 1;
    }

    set(index: number, value: 0 | 1) {
        if (index >= this._size) return;
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