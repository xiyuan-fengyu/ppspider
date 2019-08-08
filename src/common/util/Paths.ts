/**
 * 参考 http://www.gizma.com/easing/
 */
export class EasingFunctions {

    linear = (t, b, c, d) => {
        return c*t/d + b;
    };

    quadraticIn = (t, b, c, d) => {
        t /= d;
        return c*t*t + b;
    };

    quadraticOut = (t, b, c, d) => {
        t /= d;
        return -c * t*(t-2) + b;
    };

    quadraticInOut = (t, b, c, d) => {
        t /= d/2;
        if (t < 1) return c/2*t*t + b;
        t--;
        return -c/2 * (t*(t-2) - 1) + b;
    };

    cubicIn = (t, b, c, d) => {
        t /= d;
        return c*t*t*t + b;
    };

    cubicOut = (t, b, c, d) => {
        t /= d;
        t--;
        return c*(t*t*t + 1) + b;
    };

    cubicInOut = (t, b, c, d) => {
        t /= d/2;
        if (t < 1) return c/2*t*t*t + b;
        t -= 2;
        return c/2*(t*t*t + 2) + b;
    };

    quarticIn = (t, b, c, d) => {
        t /= d;
        return c*t*t*t*t + b;
    };

    quarticOut = (t, b, c, d) => {
        t /= d;
        t--;
        return -c * (t*t*t*t - 1) + b;
    };

    quarticInOut = (t, b, c, d) => {
        t /= d/2;
        if (t < 1) return c/2*t*t*t*t + b;
        t -= 2;
        return -c/2 * (t*t*t*t - 2) + b;
    };

    quinticIn = (t, b, c, d) => {
        t /= d;
        return c*t*t*t*t*t + b;
    };

    quinticOut = (t, b, c, d) => {
        t /= d;
        t--;
        return c*(t*t*t*t*t + 1) + b;
    };

    quinticInOut = (t, b, c, d) => {
        t /= d/2;
        if (t < 1) return c/2*t*t*t*t*t + b;
        t -= 2;
        return c/2*(t*t*t*t*t + 2) + b;
    };

    sinusoidalIn = (t, b, c, d) => {
        return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
    };

    sinusoidalOut = (t, b, c, d) => {
        return c * Math.sin(t/d * (Math.PI/2)) + b;
    };

    sinusoidalInOut = (t, b, c, d) => {
        return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
    };

    exponentialIn = (t, b, c, d) => {
        return c * Math.pow( 2, 10 * (t/d - 1) ) + b;
    };

    exponentialOut = (t, b, c, d) => {
        return c * ( -Math.pow( 2, -10 * t/d ) + 1 ) + b;
    };

    exponentialInOut = (t, b, c, d) => {
        t /= d/2;
        if (t < 1) return c/2 * Math.pow( 2, 10 * (t - 1) ) + b;
        t--;
        return c/2 * ( -Math.pow( 2, -10 * t) + 2 ) + b;
    };

    circularIn = (t, b, c, d) => {
        t /= d;
        return -c * (Math.sqrt(1 - t*t) - 1) + b;
    };

    circularOut = (t, b, c, d) => {
        t /= d;
        t--;
        return c * Math.sqrt(1 - t*t) + b;
    };

    circularInOut = (t, b, c, d) => {
        t /= d/2;
        if (t < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
        t -= 2;
        return c/2 * (Math.sqrt(1 - t*t) + 1) + b;
    };

}
const easingFunctions = new EasingFunctions();

export class Paths {

    static randomOffset(from: number, to: number, steps: number, stepOffset: number = 1, maxOffset: number = 4) {
        const endSteps = maxOffset / stepOffset;
        const path = [from];
        let cur = from;
        const stepOffsets = [-stepOffset, 0, stepOffset];
        for (let i = 1; i < steps; i++) {
            if (i + endSteps >= steps) {
                const newY = cur + (to - cur) / (steps - i);
                if (Math.abs(newY - cur) > maxOffset) {
                    cur = newY;
                }
            }
            else {
                cur += stepOffsets[Math.floor(Math.random() * stepOffsets.length)];
            }
            path.push(cur);
        }
        path.push(to);
        return path;
    }

    static easing(from: number, to: number, duration: number, steps: number, easing: keyof EasingFunctions) {
        const easingFunction = easingFunctions[easing];
        const path = [];
        for (let t = 0; t <= duration; t += duration / steps) {
            const s = easingFunction(t, from, to - from, duration);
            path.push(s);
        }
        return path;
    }

}

// const res = Paths.easing(0, 100, 1, 30, "quarticInOut");
// res.forEach((item, itemI) => console.log(itemI + "\t" + item));
