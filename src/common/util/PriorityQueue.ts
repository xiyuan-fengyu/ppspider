/**
 * 优先级队列 | 堆
 */
export class PriorityQueue<T> {

    private datas: T[] = [];

    private comparator: (t1: T, t2: T) => number;

    constructor(comparator: (t1: T, t2: T) => number) {
        this.comparator = comparator;
    }

    peek() {
        return this.datas.length == 0 ? null : this.datas[0];
    }

    offer(t: T): boolean {
        if (!t) return false;

        this.datas.push(t);
        const len = this.datas.length;
        if (len > 1) {
            this.siftUp(len - 1, t);
        }
        return true;
    }

    poll(): T {
        const size = this.datas.length;
        return size == 0 ? null : this.removeAt(0);
    }

    contains(t: T): boolean {
        return this.datas.indexOf(t) != -1;
    }

    remove(t: T): boolean {
        const index = this.datas.indexOf(t);
        if (index == -1) return false;
        this.removeAt(index);
        return true;
    }

    removeAt(index: number): T {
        const size = this.datas.length;
        if (index >= size) return null;
        else if (index + 1 == size) {
            return this.datas.pop();
        }

        const removeT = this.datas[index];
        const movedT = this.datas[index] = this.datas.pop();
        this.siftDown(index, movedT);
        if (movedT == this.datas[index]) {
            this.siftUp(index, this.datas[index]);
        }
        return removeT;
    }

    size(): number {
        return this.datas.length;
    }

    isEmpty(): boolean {
        return this.datas.length == 0;
    }

    private siftUp(index: number, t: T) {
        while (index > 0) {
            const parent = (index - 1) >>> 1;
            const parentT = this.datas[parent];
            if (this.comparator(t, parentT) >= 0) break;
            this.datas[index] = parentT;
            index = parent;
        }
        this.datas[index] = t;
    }

    private siftDown(index: number, t: T) {
        const size = this.datas.length;
        const half = size >>> 1;
        while (index < half) {
            let child = (index << 1) + 1;
            let childT = this.datas[child];
            let right = child + 1;
            if (right < size && this.comparator(childT, this.datas[right]) > 0) {
                childT = this.datas[child = right];
            }
            if (this.comparator(t, childT) <= 0) break;
            this.datas[index] = childT;
            index = child;
        }
        this.datas[index] = t;
    }

}