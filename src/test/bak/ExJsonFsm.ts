
/*
状态机示意图 https://v3.processon.com/view/link/5cd908c5e4b0a59a64cfae7d
 */

import {getClassInfoById} from "./Serializable_exJsonFsm";

type StateNode = {
    index: number,
    state?: State,
    transitions: Map<TransitionPredict, number>,
    reachCount?: number,
    selfReachCount?: number,
    endable?: boolean
}

type TransitionPredict = string | boolean | ((condition: any, curStateNode?: StateNode) => boolean);

class State {

    public objCache: Map<number, any>;

    protected root: State;

    protected parent: State;

    protected leaf: State;

    private stateCache: Map<string, State>;

    protected states = new Map<number, StateNode>();

    protected allTransitionIsChar = true;

    protected currentState: number;

    public readonly index: number;

    constructor(index?: number, parent?: State) {
        this.index = index || 0;
        this.parent = parent;
        if (parent) {
            this.root = parent.root;
        }
        else {
            this.root = this;
            this.objCache = new Map<number, any>();
            this.stateCache = new Map<string, State>();
        }
        this.reset();
    }

    public reuseStateFromCache(constructor: any, index: number = 0, parent: State = null) {
        const cacheKey = constructor.name + "_" + index;
        let cache = this.stateCache.get(cacheKey);
        if (cache == null) {
            this.stateCache.set(cacheKey, cache = new constructor(index, parent));
        }
        else {
            cache.parent = parent;
            cache.reset();
        }
        return cache;
    }

    public reset() {

    }

    public setParent(parent: State) {
        this.parent = parent;
    }

    /**
     * @param from
     * @param predict
     * @param to
     */
    protected addTransition(from: number | State, predict, to: number | State) {
        if (typeof predict != "string") {
            this.allTransitionIsChar = false;
        }

        const fromIndex = from instanceof State ? from.index : from;
        let fromStateNode = this.states.get(fromIndex);
        if (fromStateNode == null) {
            this.states.set(fromIndex, fromStateNode = {
                index: fromIndex,
                state: from instanceof State ? from : null,
                transitions: new Map<TransitionPredict, number>()
            });
        }

        const toIndex = to instanceof State ? to.index : to;
        let toStateNode = this.states.get(toIndex);
        if (toStateNode == null) {
            this.states.set(toIndex, toStateNode = {
                index: toIndex,
                state: to instanceof State ? to : null,
                transitions: new Map<TransitionPredict, number>()
            });
        }

        fromStateNode.transitions.set(predict, toStateNode.index);
    }

    protected addTransitions(from: number | State, predict: string, to: number | State) {
        for (let c of predict) {
            this.addTransition(from, c, to);
        }
    }

    protected markAsEnd(...states: any[]) {
        if (states) {
            for (let state of states) {
                this.states.get(state).endable = true;
            }
        }
    }

    public isCurrentEnd() {
        return this.states.get(this.currentState).endable == true;
    }

    protected _transition(str: string, index: number) {
        if (this.leaf && this == this.root) {
            return this.leaf._transition(str, index);
        }

        const condition = str[index];
        const fromState = this.currentState;
        const fromStateNode = this.states.get(fromState);
        this.beforeTransition(fromStateNode, condition);

        let transitionTo: number = fromStateNode.transitions.get(condition);
        if (transitionTo == null && !this.allTransitionIsChar) {
            for (let entry of fromStateNode.transitions) {
                // noinspection JSUnfilteredForInLoop
                const predict = entry[0];
                const predictType = typeof predict;
                if (predictType[0] != "s") {
                    const to = entry[1];
                    if (predict != null) {
                        if ((predictType == "function" && (predict as any)(condition, fromStateNode))
                            || predict == true) {
                            transitionTo = to;
                            break;
                        }
                    }
                }
            }
        }

        if (transitionTo == null) {
            if (fromStateNode.endable && this.parent != null) {
                // 当前状态为可结束状态，继续交由父亲state处理
                this.root.leaf = null;
                return this.parent._transition(str, index);
            }
            else {
                throw new Error(`current state ${this.constructor.name}(${fromState}), bad token(${condition}) at ${index}:
${str}
${str.substring(0, index)}^`);
            }
        }

        this.currentState = transitionTo;
        const toStateNode = this.states.get(transitionTo);
        if (toStateNode.state) {
            this.root.leaf = toStateNode.state;
        }
        else if (this != this.root) {
            this.root.leaf = this;
        }
        this.afterTransition(fromStateNode, condition, toStateNode);
        return true;
    }

    public transition(str: string) {
        for (let i = 0, len = str.length; i < len; i++) {
            this._transition(str, i);
        }
    }

    protected beforeTransition(fromStateNode: StateNode, condition: any) {

    }

    protected afterTransition(fromStateNode: StateNode, condition: any, toStateNode: StateNode) {

    }

    protected endStateCheck() {
        if (!this.isCurrentEnd()) {
            throw new Error(`not an end state: ${this.constructor.name}(${this.currentState})`);
        }
    }

    get() {

    }

}

class RefState extends State {

    private str = "";

    public reset() {
        if (this.states.size == 0) {
            this.addTransition(0, "_", 1);
            this.addTransition(1, "0", 2);
            this.addTransitions(1, "123456789", 3);
            this.addTransitions(3, "0123456789", 3);

            this.markAsEnd(2, 3);
        }
        this.currentState = 0;
        this.str = "";
    }

    protected afterTransition(fromStateNode: StateNode, condition: any, toStateNode: StateNode) {
        if (fromStateNode.index == 1 || toStateNode.index == 3) {
            this.str += condition;
        }
    }

    get() {
        this.endStateCheck();
        return this.root.objCache.get(parseInt(this.str));
    }

}

class StringState extends State {

    private str = "";

    private uHexStr = "";

    public reset() {
        if (this.states.size == 0) {
            this.addTransition(0, "\"", 1);
            this.addTransition(1, c => c != "\"" && c != "\\", 1);
            this.addTransition(1, "\\", 2);
            this.addTransition(1, "\"", 5);
            this.addTransitions(2, "\"\\/bfnrt", 1);
            this.addTransition(2, "u", 3);
            this.addTransitions(3, "0123456789abcdef", 4);
            this.addTransition(4, (c, stateNode) => stateNode.selfReachCount <= 1 && "0123456789abcdef".indexOf(c) > -1, 4);
            this.addTransition(4, (c, stateNode) => stateNode.selfReachCount == 2 && "0123456789abcdef".indexOf(c) > -1, 1);

            this.markAsEnd(5);
        }
        this.currentState = 0;
        this.str = "";
    }

    protected afterTransition(fromStateNode: StateNode, condition: any, toStateNode: StateNode) {
        if (fromStateNode.index == 3) {
            this.uHexStr += condition;
            toStateNode.selfReachCount = 0;
        }
        else if (fromStateNode.index == 4) {
            this.uHexStr += condition;
            toStateNode.selfReachCount++;
        }

        if (toStateNode.index == 1) {
            if (fromStateNode.index == 1) {
                this.str += condition;
            }
            else if (fromStateNode.index == 2) {
                switch (condition) {
                    case '"':
                        this.str += '"';
                        break;
                    case "\\":
                        this.str += "\\";
                        break;
                    case "/":
                        this.str += "/";
                        break;
                    case "b":
                        this.str += "\b";
                        break;
                    case "f":
                        this.str += "\f";
                        break;
                    case "n":
                        this.str += "\n";
                        break;
                    case "r":
                        this.str += "\r";
                        break;
                    case "t":
                        this.str += "\t";
                        break;
                }
            }
            else if (fromStateNode.index == 4) {
                this.str += String.fromCharCode(parseInt(this.uHexStr, 16));
                this.uHexStr = "";
            }
        }
    }

    get() {
        this.endStateCheck();
        return this.str;
    }

}

class NumberState extends State {

    private numberStr = "";

    public reset() {
        if (this.states.size == 0) {
            this.addTransition(0, "0", 1);
            this.addTransition(0, "-", 2);
            this.addTransitions(0, "123456789", 3);
            this.addTransition(1, ".", 4);
            this.addTransition(2, "0", 1);
            this.addTransitions(2, "123456789", 3);
            this.addTransitions(3, "0123456789", 3);
            this.addTransition(3, ".", 4);
            this.addTransitions(4, "0123456789", 5);
            this.addTransitions(5, "0123456789", 5);
            this.addTransitions(5, "eE", 6);
            this.addTransitions(6, "-+0123456789", 7);
            this.addTransitions(7, "0123456789", 7);
        }

        this.markAsEnd(1, 3, 5, 7);
        this.currentState = 0;
        this.numberStr = "";
    }

    protected afterTransition(fromState: StateNode, condition: any, toState: StateNode) {
        this.numberStr += condition;
    }

    get() {
        this.endStateCheck();
        return parseFloat(this.numberStr);
    }

}

class ArrayState extends State {

    private arr: any[];

    public reset() {
        super.reset();

        this.addTransition(0, "[", 1);
        this.addTransition(1, "]", 2);
        this.addTransition(1, true, new ValueState(3, this));
        this.addTransition(3, ",", 1);
        this.addTransition(3, "]", 2);

        this.markAsEnd(2);
        this.currentState = 0;
        this.arr = [];
    }

    protected afterTransition(fromState: StateNode, condition: any, toState: StateNode) {
        if (fromState.index == 0) {
            this.root.objCache.set(this.root.objCache.size, this.arr);
        }
        else if (toState.index == 3) {
            const valueState = toState.state as ValueState;
            valueState.reset();
            valueState.transition(condition);
        }
        else if (fromState.index == 3) {
            const valueState = fromState.state as ValueState;
            this.arr.push(valueState.get());
        }
    }

    get() {
        this.endStateCheck();
        return this.arr;
    }

}

class ObjectState extends State {

    private obj = {};

    private key: string;

    public reset() {
        super.reset();

        this.addTransition(0, "{", 1);
        this.addTransition(1, "}", 2);

        this.addTransition(1, (c, state) => c == "_" && state.reachCount == 1, 3);
        this.addTransition(3, ":", this.root.reuseStateFromCache(StringState, 4, this));
        this.addTransition(4, "}", 2);
        this.addTransition(4, ",", 1);

        this.addTransition(1, "\"", this.root.reuseStateFromCache(StringState, 5, this));
        this.addTransition(5, ":", new ValueState(6, this));
        this.addTransition(6, ",", 1);
        this.addTransition(6, "}", 2);

        this.markAsEnd(2);
        this.currentState = 0;
        this.obj = {};
    }

    protected afterTransition(fromState: StateNode, condition: any, toState: StateNode) {
        if (toState.index == 1) {
            toState.reachCount = (toState.reachCount || 0) + 1;
        }
        else if (toState.index == 4 || toState.index == 5) {
            (toState.state as StringState).setParent(this);
        }
        else if (toState.index == 6) {
            (toState.state as ValueState).reset();
        }

        if (fromState.index == 1 && toState.state instanceof StringState) {
            (toState.state as StringState).transition(condition);
        }
        else if (fromState.index == 5) {
            const keyState = fromState.state as StringState;
            this.key = keyState.get();
            keyState.reset();
        }
        else if (fromState.index == 6) {
            const valueState = fromState.state as ValueState;
            this.obj[this.key] = valueState.get();
            this.key = null;
        }
        else if (fromState.index == 4) {
            const classId = (fromState.state as StringState).get();
            const serializeClassInfo = getClassInfoById(classId);
            if (serializeClassInfo) {
                const serializeClass = serializeClassInfo.type;
                this.obj = new serializeClass();
                this.root.objCache.set(this.root.objCache.size - 1, this.obj);
            }
        }
        else if (fromState.index == 0) {
            this.root.objCache.set(this.root.objCache.size, this.obj);
        }
    }

    get() {
        this.endStateCheck();
        return this.obj;
    }

}

export class ValueState extends State {

    public reset() {
        this.states.clear();
        this.states.set(0, {
            index: 0,
            transitions: new Map<TransitionPredict, number>()
        });
        this.currentState = 0;
    }

    protected beforeTransition(fromStateNode: StateNode, condition: any) {
        if (fromStateNode.index == 0) {
            switch (condition) {
                case "t":
                    this.addTransition(0, "t", 1);
                    this.addTransition(1, "r", 2);
                    this.addTransition(2, "u", 3);
                    this.addTransition(3, "e", 4);
                    this.markAsEnd(4);
                    return;
                case "f":
                    this.addTransition(0, "f", 5);
                    this.addTransition(5, "a", 6);
                    this.addTransition(6, "l", 7);
                    this.addTransition(7, "s", 8);
                    this.addTransition(8, "e", 9);
                    this.markAsEnd(9);
                    return;
                case "n":
                    this.addTransition(0, "n", 10);
                    this.addTransition(10, "u", 11);
                    this.addTransition(11, "l", 12);
                    this.addTransition(12, "l", 13);
                    this.markAsEnd(13);
                    return;
                case "_":
                    this.addTransition(0, "_", this.root.reuseStateFromCache(RefState, 14, this));
                    this.markAsEnd(14);
                    return;
                case "\"":
                    this.addTransition(0, "\"", this.root.reuseStateFromCache(StringState, 15, this));
                    this.markAsEnd(15);
                    return;
                case "{":
                    this.addTransition(0, "{", new ObjectState(17, this));
                    this.markAsEnd(17);
                    return;
                case "[":
                    this.addTransition(0, "[", new ArrayState(18, this));
                    this.markAsEnd(18);
                    return;
            }

            const predict = c => c == "-" || (c >= "0" && c <= "9");
            if (predict(condition)) {
                this.addTransition(0, predict, this.root.reuseStateFromCache(NumberState, 16, this));
                this.markAsEnd(16);
            }
        }
    }

    protected afterTransition(fromState: StateNode, condition: any, toState: StateNode) {
        if (fromState.index == 0 && toState.state) {
            (toState.state as State).transition(condition);
        }
    }

    get() {
        this.endStateCheck();
        if (this.currentState == 4) {
            return true;
        }
        else if (this.currentState == 9) {
            return false;
        }
        else if (this.currentState == 13) {
            return null;
        }
        else {
            return this.states.get(this.currentState).state.get();
        }
    }

}
