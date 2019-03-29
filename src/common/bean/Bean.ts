
type  Constructor<T> = new (...args) => T;

type BeanId<T> = string | Constructor<T>;

type BeanDefinition = {
    id?: BeanId<any>; // bean id
    target: Constructor<any>; // 类
    field?: string; // 字段名
    method?: string; // 方法名
}

type AutowiredInfo = {
    id: BeanId<any>; // 注入
    target: Constructor<any>;
    fieldOrMethod: string; // 字段名 或 方法名
    paramIndex?: number; // 方法参数index
    paramName?: string; // 方法参数名
}

export interface AfterInit {

    afterInit();

}

function idStr(id: BeanId<any>) {
    return typeof id === "string" ? id : id.name;
}


const beanDefinitions = new Map<BeanId<any>, BeanDefinition>();
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

    const existedBeanDefinition = beanDefinitions.get(id);
    if (existedBeanDefinition) {
        if (existedBeanDefinition.id !== beanDefinition.id
            || existedBeanDefinition.target !== beanDefinition.target
            || existedBeanDefinition.field !== beanDefinition.field
            || existedBeanDefinition.method !== beanDefinition.method) {
            throw new Error("duplicate Bean(" + idStr(id) + ")");
        }
    }
    else {
        beanDefinitions.set(id, beanDefinition);
    }
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
                target: target.constructor,
                method: fieldOrMethod
            });
            return descriptor;
        }
        else if (fieldOrMethod) {
            // 字段
            addBeanDefinition({
                id: id,
                target: target.constructor,
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



const autowiredInfos = new Map<Constructor<any>, AutowiredInfo[]>();
function addAutowiredInfo(autowiredInfo: AutowiredInfo) {
    let id = autowiredInfo.id;
    if (id == null) {
        id = autowiredInfo.fieldOrMethod;
    }
    let targetDepends = autowiredInfos.get(autowiredInfo.target);
    if (!targetDepends) {
        targetDepends = [];
        autowiredInfos.set(autowiredInfo.target, targetDepends);
    }
    targetDepends.push(autowiredInfo);
}

export function Autowired(id?: BeanId<any>) {
    return function (target: any, fieldOrMethod: string, paramIndex?: number) {
        if (target.constructor.name === "function") {
            throw new Error("cannot decorate static field with Autowired");
        }
        else if (fieldOrMethod == null || (target.prototype != null && typeof target.prototype[fieldOrMethod] == "function")) {
            throw new Error("cannot decorate class or method with Autowired");
        }

        if (typeof paramIndex === "number") {
            const methodDesc = target[fieldOrMethod].toString();
            const params = methodDesc.substring(fieldOrMethod.length + 1, methodDesc.indexOf(") {")).split(", ");
            addAutowiredInfo({
                id: id,
                target: target.constructor,
                fieldOrMethod: fieldOrMethod,
                paramIndex: paramIndex,
                paramName: params[paramIndex]
            });
        }
        else {
            addAutowiredInfo({
                id: id,
                target: target.constructor,
                fieldOrMethod: fieldOrMethod
            });
        }
    };
}



const beans = new Map<BeanId<any>, any>();
export function getBean<T>(id: BeanId<T>, createBeanDefinitionIfNotExisted: boolean = false): T {
    let bean = beans.get(id);
    if (bean === undefined) {
        if (beanDefinitions.has(id)) {
            bean = initBean(id);
        }
        else if (createBeanDefinitionIfNotExisted && typeof id === "function") {
            addBeanDefinition({
                id: id,
                target: id
            });
            bean = initBean(id);
        }
        else {
            throw new Error("Bean(" + idStr(id) + ") is not defined");
        }
    }
    return bean;
}

function initBean<T>(id: BeanId<T>): T {
    let beanDefinition = beanDefinitions.get(id);

    if (beanDefinition.method || beanDefinition.field) {
        // 方法或字段
        // 获取所在类的实例
        let targetIns = null;
        for (let entry of beanDefinitions.entries()) {
            const tempId = entry[0];
            const tempDefinition = entry[1];
            if (id !== tempId
                && tempDefinition.target === beanDefinition.target
                && tempDefinition.method === undefined
                && tempDefinition.field === undefined) {
                targetIns = getBean(tempId);
                break;
            }
        }

        if (targetIns == null) {
            throw new Error(beanDefinition.target.name + " is not decorated with @Bean");
        }

        if (beanDefinition.field) {
            return targetIns[beanDefinition.field];
        }
        else {
            return targetIns[beanDefinition.method]();
        }
    }
    else {
        const ins = new beanDefinition.target();
        beans.set(id, ins);

        // 处理该类 @Autowired 装饰信息
        let autowiredArr = autowiredInfos.get(beanDefinition.target);
        if (autowiredArr) {
            let methodParamAutowiredMap: {[methodName: string]: AutowiredInfo[]} = {};
            for (let autowiredInfo of autowiredArr) {
                if (autowiredInfo.paramIndex == null) {
                    // 字段
                    const autowiredId = autowiredInfo.id != null ? autowiredInfo.id : autowiredInfo.fieldOrMethod;
                    Object.defineProperty(ins, autowiredInfo.fieldOrMethod, {
                        get: () => getBean(autowiredId)
                    });
                }
                else {
                    // 方法
                    let methodParamAutowired = methodParamAutowiredMap[autowiredInfo.fieldOrMethod];
                    if (!methodParamAutowired) {
                        methodParamAutowiredMap[autowiredInfo.fieldOrMethod] = methodParamAutowired = [];
                    }
                    while (methodParamAutowired.length <= autowiredInfo.paramIndex) {
                        methodParamAutowired.push(null);
                    }
                    methodParamAutowired[autowiredInfo.paramIndex] = autowiredInfo;
                }
            }
            for (let methodName of Object.keys(methodParamAutowiredMap)) {
                const methodParamAutowire = methodParamAutowiredMap[methodName];
                const oldM = ins[methodName];
                ins[methodName] = (...args) => {
                    if (args == null) {
                        args = [];
                    }
                    const newArgs = new Array(Math.max(args.length, methodParamAutowire.length));
                    for (let i = 0, len = newArgs.length; i < len; i++) {
                        const oldArg = args[i];
                        if (oldArg === undefined) {
                            const paramAutowire = methodParamAutowire[i];
                            if (paramAutowire) {
                                newArgs[i] = getBean(paramAutowire.id != null ? paramAutowire.id : paramAutowire.paramName);
                            }
                        }
                        else {
                            newArgs[i] = oldArg;
                        }
                    }
                    return oldM.call(ins, ...newArgs);
                };
            }
        }

        // 处理 Bean 注解
        for (let entry of beanDefinitions.entries()) {
            const tempDefinition = entry[1];
            if (tempDefinition.target === beanDefinition.target) {
                if (tempDefinition.field) {
                    const beanId = tempDefinition.id != null ? tempDefinition.id : tempDefinition.field;
                    registeBean(beanId, ins[tempDefinition.field]);
                    Object.defineProperty(ins, tempDefinition.field, {
                        get: () => getBean(beanId),
                        set: value => beans.set(beanId, value)
                    });
                }
                else if (tempDefinition.method) {
                    const oldM = ins[tempDefinition.method];
                    ins[tempDefinition.method] = (...args) => {
                        let _cachedValue = oldM["_cachedValue"];
                        if (_cachedValue === undefined) {
                            oldM["_cachedValue"] = _cachedValue = oldM.call(ins, ...args);
                            registeBean(tempDefinition.id != null ? tempDefinition.id : tempDefinition.method, _cachedValue);
                        }
                        return _cachedValue;
                    };
                }
            }
        }

        if (typeof ins["afterInit"] === "function") {
            ins["afterInit"]();
        }
        return ins;
    }
}

export function existBean(id: BeanId<any>) {
    return beans.has(id);
}

export function registeBean<T>(id: BeanId<T>, ins: T, beanDefinition?: BeanDefinition) {
    if (!beans.has(id)) {
        if (!beanDefinitions.has(id)) {
            addBeanDefinition(beanDefinition || {
                id: id,
                target: ins.constructor as Constructor<T>
            });
        }
        beans.set(id, ins);
    }
    else {
        throw new Error("Bean(" + idStr(id) + ") existed");
    }
}
