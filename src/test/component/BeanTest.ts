import "source-map-support/register";
import {Autowired, Bean, getBean} from "../../common/bean/Bean";

@Bean()
class Test {

    @Bean()
    field: string = "123";

    @Bean()
    name: string = "Tom";

    @Autowired("field")
    fieldRef: string;

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

    @Autowired()
    test: Test;

    @Autowired()
    private tom: any;

    init() {
        console.log(this.test.field);
        console.log(this.test.name);
        console.log(this.test.fieldRef);

        console.log(this.tom);
        console.log(this.test.tom());
    }

}


let beanTest = getBean(BeanTest);
beanTest.init();
beanTest.test.testParamAutowired();
