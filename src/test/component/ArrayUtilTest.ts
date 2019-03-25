import {ArrayUtil} from "../../common/util/ArrayUtil";

const arr = [1, 2, 3, 4, 5];
ArrayUtil.removeIf(arr, item => item % 2 == 0);
console.log(arr);
