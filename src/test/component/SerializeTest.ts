import {Serialize, Transient} from "../..";
import {BitSet} from "../../common/util/BitSet";
import {SerializableUtil} from "../../common/serialize/Serialize";

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

// {
//     // 重复定义 classId 测试，解开注释报错
//     @Serialize()
//     class C {
//
//     }
// }

@Serialize()
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

const c = new C();
const serC = SerializableUtil.serialize(c);
const serCJsonStr = JSON.stringify(serC, null, 4);
console.log(serCJsonStr);
const serCJson = JSON.parse(serCJsonStr);
const deserC = SerializableUtil.deserialize(serCJson);
console.log(deserC.testLambda());
console.log(deserC.testFun());
