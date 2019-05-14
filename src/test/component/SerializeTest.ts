import {Serializable, Transient} from "../..";
import {BitSet} from "../../common/util/BitSet";
import {SerializableUtil} from "../../common/serialize/Serializable";

class A {
    paraA = "aaa";
    random = parseInt((Math.random() * 10000).toFixed());
    b: B;
}

class B {
    paraB = 123;
    random = parseInt((Math.random() * 10000).toFixed());
    a: A;
}

@Serializable()
class C {

    @Transient()
    private transientF = "test transient";

    private a: A;
    private b: B;
    bitSet: BitSet;
    paramNum = 12;
    paramBoolean = true;
    paramString = "test";
    paramObj = {
        aa: null,
        bb: null,
        bitSet: null
    };
    paramArray: any[] = [
        1,
        "2",
        false
    ];

    private testLambda = () => true;

    testFun() {
        return "test";
    }

    constructor() {
        this.a = new A();
        this.b = new B();
        this.a.b = this.b;
        this.b.a = this.a;
        this.bitSet = new BitSet(2 << 10);
        this.bitSet.set(8, 1);
        this.bitSet.set(16, 1);
        this.paramObj.aa = this.a;
        this.paramObj.bb = this.b;
        this.paramObj.bitSet = this.bitSet;
        this.paramArray.push(this.a);
        this.paramArray.push(this.b);
        this.paramArray.push(this.bitSet);
    }

}



// const c = new C();
// const serC = SerializableUtil.serializeToString(c);
// console.log(serC);
// const deserC = SerializableUtil.deserializeFromString(serC);
// console.log(deserC.testLambda());
// console.log(deserC.testFun());
//
// SerializableUtil.serializeToFile(c, "test.txt").then(() => {
//     SerializableUtil.deserializeFromFile("test.txt").then(res => {
//         console.log(SerializableUtil.serializeToString(res));
//         console.log(res.testLambda());
//         console.log(res.testFun());
//     });
// });
//
// const str = JSON.stringify("\"name\"");
// console.log(str);
// const obj2 = SerializableUtil.deserializeFromString(str);
// console.log(JSON.stringify(obj2));



SerializableUtil.deserializeFromFile("queueCache.txt").then(res => {
    console.log(res);
});

