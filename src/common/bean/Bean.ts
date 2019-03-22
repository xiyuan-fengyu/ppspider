
type BeanDefinition = {
    id?: string | (new () => any); // bean id
    target: new () => any; // 类
    field?: string; // 字段名
    method?: string; // 方法名
}

type AutowiredInfo = {
    id: string | (new () => any); // 注入
    target: new () => any;
    field: string; // 字段名
}



const beanDefinitions = new Map<(new () => any) | string, BeanDefinition>();
function addBeanDefinition(beanDefinition: BeanDefinition) {
    let id = beanDefinition.id;
    if (id == null) {
        if (beanDefinition.method != null) {
            id = beanDefinition.method;
        }
        else if (beanDefinition.field != null) {
            id = beanDefinition.field;
        }
        else {
            id = beanDefinition.target;
        }
    }

    if (beanDefinitions.has(id)) {
        throw new Error("duplicate Bean(" + (typeof id === "string" ? id : id.name) + ")");
    }
    beanDefinitions.set(id, beanDefinition);
}

export function Bean(id?: string) {
    return function (target: any, fieldOrMethod?: string, descriptor?: any) {
        if (target.constructor.name === "function") {
            throw new Error("cannot decorate static field/method with Bean");
        }

        if (descriptor) {
            // 方法
            addBeanDefinition({
                id: id,
                target: target,
                method: fieldOrMethod
            });
            return descriptor;
        }
        else if (fieldOrMethod) {
            // 字段
            addBeanDefinition({
                id: id,
                target: target,
                field: fieldOrMethod
            });
        }
        else {
            // 类
            addBeanDefinition({
                id: id,
                target: target
            });
        }
    };
}



const autowiredInfos = new Map<new () => any, AutowiredInfo[]>();
function addAutowiredInfo(autowiredInfo: AutowiredInfo) {
    let id = autowiredInfo.id;
    if (id == null) {
        id = autowiredInfo.field;
    }
    let targetDepends = autowiredInfos.get(autowiredInfo.target);
    if (!targetDepends) {
        targetDepends = [];
        autowiredInfos.set(autowiredInfo.target, targetDepends);
    }
    targetDepends.push(autowiredInfo);
}

export function Autowired(id?: string | (new () => any)) {
    return function (target: any, field: string) {
        if (target.constructor.name === "function") {
            throw new Error("cannot decorate static field with Autowired");
        }
        else if (field == null || typeof target.prototype[field] == "function") {
            throw new Error("cannot decorate class or method with Autowired");
        }

        addAutowiredInfo({
            id: id,
            target: target,
            field: field
        });
    };
}






@Bean()
class Test {

    @Bean()
    field: string = "123";

    @Bean()
    method() {

    }

    @Autowired()
    private testA: string;

}
