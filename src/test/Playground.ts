import {Serialize, SerializableUtil} from "../common/serialize/Serialize";
import {queueManager} from "../spider/manager/QueueManager";
import {appInfo} from "../spider/decorators/Launcher";
import Nedb = require("nedb");
import {JobStatus} from "../spider/job/Job";
import {StringUtil} from "../common/util/StringUtil";

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



// const db = new Nedb({
//     filename: __dirname + "/workplace/db/test.db",
//     autoload: true,
//     onload: err => {
//         db.persistence.compactDatafile();
//     }
// });
//
// db.insert({
//     _id: "test",
//     "name": "2"
// }, (err, doc) => {
//     if (err) {
//         db.update({_id: "test"}, {
//             _id: "test",
//             "name": "3"
//         });
//     }
// });
//
// db.find({age: null}, (err, docs) => {
//    console.log(err, docs);
// });


// const temp = Object.keys(JobStatus).map(key => {
//     const v = JobStatus[key];
//     return v.constructor == Number ? {
//         key: key,
//         value: v
//     } : null
// }).filter(item => item != null);
// console.log(temp);



// console.log(StringUtil.random(5));
// console.log(StringUtil.isBlank("\t"));
// console.log(StringUtil.id());
// console.log(StringUtil.id());
// console.log(StringUtil.id());
// console.log(StringUtil.id());

