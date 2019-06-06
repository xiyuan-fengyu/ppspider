import {RequestUtil} from "../..";

const goto = "https://www.google.com/";
// const goto = "https://static.hdslb.com/common/js/footer.js";
// const goto = "https://api.live.bilibili.com/room/v1/RoomRecommend/biliIndexRecList";

const options = {
    uri: goto,
    method: "GET",
    headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3765.0 Safari/537.36",
    },
    proxy: 'http://127.0.0.1:2007'
};

RequestUtil.simple(options).then(res => {
    console.log(res.body.toString("utf-8"));
}).catch(err => {
    console.log(err);
});


