import * as https from "https";
import * as HttpsProxyAgent from 'https-proxy-agent';
import * as zlib from "zlib";
import * as url from "url";
import {IncomingMessage} from "http";
import * as stream from "stream";
import * as util from "util";


// pipe 顺序测试
// fs.createReadStream('httpsTest.js').pipe(zlib.createGzip()).pipe(zlib.createDeflate()).pipe(zlib.createInflate()).pipe(zlib.createGunzip()).pipe(process.stdout);


// https://stackoverflow.com/questions/21491567/how-to-implement-a-writable-stream
function BufferStream() {
    this.chunks = [];
    stream.Writable.call(this);
}
util.inherits(BufferStream, stream.Writable);
BufferStream.prototype._write = function (chunk, encoding, done) {
    this.chunks.push(chunk);
    done();
};
BufferStream.prototype.toBuffer = function (): Buffer {
    return Buffer.concat(this.chunks);
};


const goto = "https://www.google.com/";
// const goto = "https://static.hdslb.com/common/js/footer.js";
// const goto = "https://api.live.bilibili.com/room/v1/RoomRecommend/biliIndexRecList";

const options = url.parse(goto);
options["method"] = "GET";
options["headers"] = {
    "Referer": "https://www.bilibili.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3765.0 Safari/537.36"
};
options["agent"] = new HttpsProxyAgent('http://127.0.0.1:2007');

const req = https.request(options, (res: IncomingMessage) => {
    const lengths = new Map();
    let lastReceiveTime = 0;
    res.on("data", chunk => {
        lengths.set(chunk.length, (lengths.get(chunk.length) || 0) + 1);
        const tempReceiveTime = new Date().getTime();
        if (tempReceiveTime != lastReceiveTime) {
            lastReceiveTime = tempReceiveTime;
            setTimeout(() => {
                if (lastReceiveTime == tempReceiveTime) {
                    for (let entry of lengths.entries()) {
                        console.log(entry[0] + "\t" + entry[1]);
                    }
                }
            }, 4000);
        }
    });

    /*
583	1
1389	150
76	1
153	1
821	4
972	1
722	1
123	1
655	1
885	1

583	1
1389	144
1289	1
180	1
821	4
235	1
1233	1
39	1
672	1
288	1
 */

    // let pipes: stream = res;
    // const contentEncodings = (res.headers["content-encoding"] || "").split(/, ?/).filter(item => item != "").reverse();
    // for (let contentEncoding of contentEncodings) {
    //     switch (contentEncoding) {
    //         case "gzip":
    //         case "x-gzip":
    //             pipes = pipes.pipe(zlib.createGunzip());
    //             break;
    //         case "br":
    //             pipes = pipes.pipe(zlib.createBrotliDecompress());
    //             break;
    //         case "":
    //             pipes = pipes.pipe(zlib.createInflate());
    //             break;
    //     }
    // }
    //
    // const bufferStream = new BufferStream();
    // pipes.pipe(bufferStream);
    //
    // let receiveNum = 0;
    // let lastReceiveTime = 0;
    // const waitReceiveLoop = (lastReceiveNum) => {
    //     setTimeout(() => {
    //         if (receiveNum == lastReceiveNum) {
    //             // pipes.emit("close");
    //             console.log(res);
    //         }
    //         else {
    //             waitReceiveLoop(receiveNum);
    //         }
    //     }, 100);
    // };
    // pipes.on("data", () => {
    //     if (receiveNum == 0) {
    //         lastReceiveTime = new Date().getTime();
    //         waitReceiveLoop(receiveNum);
    //     }
    //     else {
    //         const now = new Date().getTime();
    //         // console.log("delta: " + (now - lastReceiveTime));
    //         lastReceiveTime = now;
    //     }
    //     receiveNum++;
    // }).once("close", () => {
    //     const statusCode = res.statusCode;
    //     const headers = res.headers;
    //     const body = bufferStream.toBuffer();
    //     console.log(body.toString("utf-8"));
    //     res.destroy();
    // });
});
req.on("end", () => {
    console.log("req end");
});
req.end();

