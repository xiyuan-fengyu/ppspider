import {Serialize, SerializableUtil} from "../common/serialize/Serialize";
import {queueManager} from "../spider/manager/QueueManager";

// @Serialize()
// class B {
//
//     name = "Jin";
//
// }
//
// @Serialize()
// class A {
//
//     likes = [1, 2, 3, new B()];
//
//     constructor(
//         private name: string,
//         private age: number) {
//
//     }
//
// }
//
// const a = new A("Tom", 15);
// console.log(a);
// const aSer = SerializableUtil.serialize(a);
// console.log(aSer);
// const aDeser = SerializableUtil.deserialize(aSer);
// console.log(aDeser);

class A {

}

class B extends A {

}

const bCons = B;
console.log(bCons.prototype);

console.log(__dirname);