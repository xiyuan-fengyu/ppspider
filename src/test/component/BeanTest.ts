import {Autowired, Bean, getBean} from "../../common/bean/Bean";

@Bean()
class Test {

    @Bean()
    field: string = "123";

    @Bean()
    name: string = "Tom";

    @Autowired("field")
    private fieldRef: string;

    @Bean()
    tom(@Autowired() field?: string, @Autowired() name?: string) {
        return {
            id: field,
            name: name,
            time: new Date()
        };
    }

    testParamAutowired(@Autowired() field?: string, @Autowired() name?: string) {
        console.log(field + ", " + name);
    }

}

@Bean()
class BeanTest {

    @Autowired(Test)
    test: Test;

    @Autowired("tom")
    private tom: any;

    init() {
        console.log(this.test.field);
        console.log(this.tom);
        console.log(this.test.tom());
    }

}


let beanTest = getBean(BeanTest);
beanTest.init();
beanTest.test.testParamAutowired();
