
export class ArrayUtil {

    static removeIf<T>(arr: T[], predict: (item: T, index: number, arr: T[]) => boolean) {
        if (arr) {
            let j = -1;
            let len = arr.length;
            for (let i = 0; i < len; i++) {
                if (!predict(arr[i], i, arr)) {
                    arr[++j] = arr[i];
                }
            }
            arr.splice(j + 1, len - j - 1);
        }
    }

}


