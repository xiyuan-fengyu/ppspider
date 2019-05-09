import {CronUtil} from "../../common/util/CronUtil";

console.log(CronUtil.next("* * * * * *", 1));
console.log(new Date());

CronUtil.setInterval("* * * * * *", () => {
    console.log("test 1");
});
CronUtil.setInterval("* * * * * *", () => {
    console.log("test 2");
});

setTimeout(() => {
    CronUtil.removeInterval("* * * * * *");
}, 5000);
