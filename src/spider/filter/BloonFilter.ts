import {Filter} from "./Filter";
import {Job} from "../job/Job";
import {BitSet} from "../../common/util/BitSet";
import {Serialize} from "../../common/serialize/Serialize";

@Serialize()
export class BloonFilter implements Filter {

    private static readonly size = 2 << 24;

    private static readonly seeds = [7, 11, 13, 31, 37, 61];

    private bitSet = new BitSet(BloonFilter.size);

    private emptyExisted = false;

    clear(): void {
        this.bitSet.clear();
    }

    isExisted(job: Job): boolean {
        const key = job.key();
        if (!key) return this.emptyExisted;
        for (let seed of BloonFilter.seeds) {
            if (!this.bitSet.get(BloonFilter.hash(key, BloonFilter.size, seed))) return false;
        }
        return true;
    }

    setExisted(job: Job): void {
        const key = job.key();
        if (key) {
            for (let seed of BloonFilter.seeds) {
                this.bitSet.set(BloonFilter.hash(key, BloonFilter.size, seed), 1);
            }
        }
        else this.emptyExisted = true;
    }

    private static hash(str: string, cap: number, seed: number): number {
        if (!str || !str.length) return 0;

        let result = 0;
        for (let i = 0, len = str.length; i < len; i++) {
            result = (seed * result + str.charCodeAt(i)) % cap;
        }
        return (cap - 1) & result;
    }

}
