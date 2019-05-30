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


// const goto = "https://www.google.com/";
const goto = "https://static.hdslb.com/common/js/footer.js";
// const goto = "https://api.live.bilibili.com/room/v1/RoomRecommend/biliIndexRecList";

const options = url.parse(goto);
options["method"] = "GET";
options["headers"] = {
    "Referer": "https://www.bilibili.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3765.0 Safari/537.36"
};
options["agent"] = new HttpsProxyAgent('http://127.0.0.1:3000');

https.request(options, (res: IncomingMessage) => {
    let pipes: stream = res;
    const contentEncodings = (res.headers["content-encoding"] || "").split(/, ?/).filter(item => item != "").reverse();
    for (let contentEncoding of contentEncodings) {
        switch (contentEncoding) {
            case "gzip":
            case "x-gzip":
                pipes = pipes.pipe(zlib.createGunzip());
                break;
            case "br":
                pipes = pipes.pipe(zlib.createBrotliDecompress());
                break;
            case "":
                pipes = pipes.pipe(zlib.createInflate());
                break;
        }
    }

    const bufferStream = new BufferStream();
    pipes.pipe(bufferStream);
    let receiveNum = 0;
    let lastReceiveTime = 0;
    const waitReceiveLoop = (lastReceiveNum) => {
        setTimeout(() => {
            if (receiveNum == lastReceiveNum) {
                pipes.emit("close");
            }
            else {
                waitReceiveLoop(receiveNum);
            }
        }, 100);
    };
    pipes.on("data", () => {
        if (receiveNum == 0) {
            lastReceiveTime = new Date().getTime();
            waitReceiveLoop(receiveNum);
        }
        else {
            const now = new Date().getTime();
            console.log("delta: " + (now - lastReceiveTime));
            lastReceiveTime = now;
        }
        receiveNum++;
    }).once("close", () => {
        const statusCode = res.statusCode;
        const headers = res.headers;
        const body = bufferStream.toBuffer();
        console.log(body.toString("utf-8"));
        res.destroy();
    });
}).end();
