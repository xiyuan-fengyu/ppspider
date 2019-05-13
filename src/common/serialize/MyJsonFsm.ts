
/*
状态机示意图 https://v3.processon.com/view/link/5cd908c5e4b0a59a64cfae7d
 */

import {getClassInfoById, SerializableUtil} from "./Serializable";

type StateNode = {
    index: number,
    state?: State,
    transitions: Map<number, TransitionPredict>,
    reachCount: number,
    selfReachCount: number,
    endable: boolean
}

type TransitionPredict = string | boolean | ((condition: any, curStateNode?: StateNode) => boolean);

class State {

    protected objCache: Map<number, any>;

    protected states = new Map<number, StateNode>();

    protected parent: State;

    protected currentState: number;

    public readonly index: number;

    constructor(index?: number, parent?: State) {
        this.index = index || 0;
        this.parent = parent;
        this.objCache = parent == null ? new Map<number, any>() : parent.objCache;
        this.reset();
    }

    public reset() {
        this.states.clear();
    }

    /**
     * @param from
     * @param predict
     * @param to
     */
    protected addTransition(from: number | State, predict, to: number | State) {
        const fromIndex = from instanceof State ? from.index : from;
        let fromStateNode = this.states.get(fromIndex);
        if (fromStateNode == null) {
            this.states.set(fromIndex, fromStateNode = {
                index: fromIndex,
                state: from instanceof State ? from : null,
                transitions: new Map<number, TransitionPredict>(),
                reachCount: 0,
                selfReachCount: 0,
                endable: false
            });
        }

        const toIndex = to instanceof State ? to.index : to;
        let toStateNode = this.states.get(toIndex);
        if (toStateNode == null) {
            this.states.set(toIndex, toStateNode = {
                index: toIndex,
                state: to instanceof State ? to : null,
                transitions: new Map<number, TransitionPredict>(),
                reachCount: 0,
                selfReachCount: 0,
                endable: false
            });
        }

        fromStateNode.transitions.set(toStateNode.index, predict);
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

    protected _transition(condition: any) {
        const fromState = this.currentState;
        const fromStateNode = this.states.get(fromState);
        this.beforeTransition(fromStateNode, condition);

        if (fromStateNode.state != null) {
            if (fromStateNode.state._transition(condition)) {
                return true;
            }
        }

        let transitionTo: number = null;
        for (let entry of fromStateNode.transitions) {
            // noinspection JSUnfilteredForInLoop
            const to = entry[0];
            const predict = entry[1];
            if (predict != null) {
                const predictType = typeof predict;
                if ((predictType == "string" && predict == condition)
                    || (predictType == "function" && (predict as any)(condition, fromStateNode))
                    || predict == true) {
                    transitionTo = to;
                    break;
                }
            }
        }

        if (transitionTo == null) {
            if (fromStateNode.endable && this.parent != null) {
                // 当前状态为可结束状态，继续交由父亲state处理
                return false;
            }
            else {
                throw new Error(`current state(${fromState}), bad condition(${condition})`);
            }
        }

        this.currentState = transitionTo;
        const toStateNode = this.states.get(transitionTo);
        toStateNode.reachCount++;
        if (fromStateNode == toStateNode) {
            toStateNode.selfReachCount++;
        }
        else {
            toStateNode.selfReachCount = 0;
        }
        this.afterTransition(fromStateNode, condition, toStateNode);
        return true;
    }

    public transition(condition: any) {
        for (let c of condition) {
            this._transition(c);
        }
    }

    protected beforeTransition(fromStateNode: StateNode, condition: any) {

    }

    protected afterTransition(fromStateNode: StateNode, condition: any, toStateNode: StateNode) {

    }

    get() {

    }

}

class RefState extends State {

    private str = "";

    public reset() {
        super.reset();

        this.addTransition(0, "_", 1);
        this.addTransition(1, "0", 2);
        this.addTransition(1, c => c >= "1" && c <= "9", 3);
        this.addTransition(3, c => c >= "0" && c <= "9", 3);

        this.markAsEnd(2, 3);
        this.currentState = 0;
        this.str = "";
    }

    protected afterTransition(fromStateNode: StateNode, condition: any, toStateNode: StateNode) {
        if (fromStateNode.index == 1 || toStateNode.index == 3) {
            this.str += condition;
        }
    }

    get() {
        if (this.isCurrentEnd()) {
            return this.objCache.get(parseInt(this.str));
        }
        else {
            throw new Error(`not an end state(${this.currentState})`);
        }
    }

}

class StringState extends State {

    private str = "";

    private uHexStr = "";

    public reset() {
        super.reset();

        this.addTransition(0, "\"", 1);
        this.addTransition(1, c => c != "\"" && c != "\\", 1);
        this.addTransition(1, "\\", 2);
        this.addTransition(1, "\"", 5);
        this.addTransition(2, c => "\\/bfnrt".indexOf(c.toLowerCase()) > -1, 1);
        this.addTransition(2, "u", 3);
        this.addTransition(3, c => "0123456789abcdef".indexOf(c.toLowerCase()) > -1, 4);
        this.addTransition(4, (c, stateNode) => stateNode.selfReachCount <= 1 && "0123456789abcdef".indexOf(c.toLowerCase()) > -1, 4);
        this.addTransition(4, (c, stateNode) => stateNode.selfReachCount == 2 && "0123456789abcdef".indexOf(c.toLowerCase()) > -1, 1);

        this.markAsEnd(5);
        this.currentState = 0;
        this.str = "";
    }

    protected afterTransition(fromStateNode: StateNode, condition: any, toStateNode: StateNode) {
        if (fromStateNode.index != 0 && toStateNode.index != 5) {
            if (fromStateNode.index == 1) {
                this.str += condition;
            }
            else if (fromStateNode.index == 2) {
                switch (condition) {
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
            else if (fromStateNode.index == 3 || fromStateNode.index == 4) {
                this.uHexStr += condition;
            }

            if (fromStateNode.index == 4 && toStateNode.index == 1) {
                this.str += String.fromCharCode(parseInt(this.uHexStr, 16));
                this.uHexStr = "";
            }
        }
    }

    get() {
        if (this.isCurrentEnd()) {
            return this.str;
        }
        else {
            throw new Error(`not an end state(${this.currentState})`);
        }
    }

}

class NumberState extends State {

    private numberStr = "";

    public reset() {
        super.reset();

        this.addTransition(0, "0", 1);
        this.addTransition(0, "-", 2);
        this.addTransition(0, c => c >= "1" && c <= "9", 3);
        this.addTransition(1, ".", 4);
        this.addTransition(2, "0", 1);
        this.addTransition(2, c => c >= "1" && c <= "9", 3);
        this.addTransition(3, c => c >= "0" && c <= "9", 3);
        this.addTransition(3, ".", 4);
        this.addTransition(4, c => c >= "0" && c <= "9", 5);
        this.addTransition(5, c => c >= "0" && c <= "9", 5);
        this.addTransition(5, c => c == "e" || c == "E", 6);
        this.addTransition(6, c => c == "-" || c == "+" || (c >= "0" && c <= "9"), 7);
        this.addTransition(7, c => c >= "0" && c <= "9", 7);

        this.markAsEnd(1, 3, 5, 7);
        this.currentState = 0;
        this.numberStr = "";
    }

    protected afterTransition(fromState: StateNode, condition: any, toState: StateNode) {
        this.numberStr += condition;
    }

    get() {
        if (this.isCurrentEnd()) {
            return parseFloat(this.numberStr);
        }
        else {
            throw new Error(`not an end state(${this.currentState})`);
        }
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
            this.objCache.set(this.objCache.size, this.arr);
        }
        else if (fromState.index == 1 && toState.index == 3) {
            (toState.state as ValueState).transition(condition);
        }
        else if (fromState.index == 3) {
            const valueState = fromState.state as ValueState;
            this.arr.push(valueState.get());
            valueState.reset();
        }
    }

    get() {
        if (this.isCurrentEnd()) {
            return this.arr;
        }
        else {
            throw new Error(`not an end state(${this.currentState})`);
        }
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
        this.addTransition(3, ":", new StringState(4, this));
        this.addTransition(4, "}", 2);
        this.addTransition(4, ",", 1);

        this.addTransition(1, "\"", new StringState(5, this));
        this.addTransition(5, ":", new ValueState(6, this));
        this.addTransition(6, ",", 1);
        this.addTransition(6, "}", 2);

        this.markAsEnd(2);
        this.currentState = 0;
        this.obj = {};
    }

    protected afterTransition(fromState: StateNode, condition: any, toState: StateNode) {
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
            const value = valueState.get();
            valueState.reset();
            this.obj[this.key] = value;
            this.key = null;
        }
        else if (fromState.index == 4) {
            const classId = (fromState.state as StringState).get();
            const serializeClassInfo = getClassInfoById(classId);
            if (serializeClassInfo) {
                const serializeClass = serializeClassInfo.type;
                this.obj = new serializeClass();
                this.objCache.set(this.objCache.size - 1, this.obj);
            }
        }
        else if (fromState.index == 0) {
            this.objCache.set(this.objCache.size, this.obj);
        }
    }

    get() {
        if (this.isCurrentEnd()) {
            return this.obj;
        }
        else {
            throw new Error(`not an end state(${this.currentState})`);
        }
    }

}

export class ValueState extends State {

    public reset() {
        super.reset();

        this.addTransition(0, "t", 1);
        this.addTransition(1, "r", 2);
        this.addTransition(2, "u", 3);
        this.addTransition(3, "e", 4);

        this.addTransition(0, "f", 5);
        this.addTransition(5, "a", 6);
        this.addTransition(6, "l", 7);
        this.addTransition(7, "s", 8);
        this.addTransition(8, "e", 9);

        this.addTransition(0, "n", 10);
        this.addTransition(10, "u", 11);
        this.addTransition(11, "l", 12);
        this.addTransition(12, "l", 13);

        this.markAsEnd(4, 9, 13);
        this.currentState = 0;
    }

    protected beforeTransition(fromStateNode: StateNode, condition: any) {
        if (fromStateNode.index == 0) {
            switch (condition) {
                case "_":
                    this.addTransition(0, "_", new RefState(14, this));
                    this.markAsEnd(14);
                    return;
                case "\"":
                    this.addTransition(0, "\"", new StringState(15, this));
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
                this.addTransition(0, predict, new NumberState(16, this));
                this.markAsEnd(16);
            }
        }
    }

    protected afterTransition(fromState: StateNode, condition: any, toState: StateNode) {
        if (fromState.index == 0 &&  toState.index >= 14) {
            (toState.state as State).transition(condition);
        }
    }

    get() {
        if (this.isCurrentEnd()) {
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
        else {
            throw new Error(`not an end state(${this.currentState})`);
        }
    }

}
