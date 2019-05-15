import {Serializable, SerializableUtil, Transient} from "../..";
import {BitSet} from "../../common/util/BitSet";

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

// (async () => {
//     const c = new C();
//     await SerializableUtil.serializeToFile(c, "c.js");
//     const cFromFile = await SerializableUtil.deserializeFromFile("c.js");
//     console.log(cFromFile);
//     console.log(cFromFile.testLambda());
//     console.log(cFromFile.testFun());
// })();

