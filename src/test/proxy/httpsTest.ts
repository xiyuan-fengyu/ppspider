import * as https from "https";
import * as HttpsProxyAgent from 'https-proxy-agent';
import * as zlib from "zlib";
import * as url from "url";
import {IncomingMessage} from "http";
import * as stream from "stream";
import * as util from "util";
import {SetCookie} from "puppeteer";


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

const req = https.request(options, (proxyRes: IncomingMessage) => {
    const parser = req["parser"];
    if (parser) {
        for (let field in parser) {
            const value = parser[field];
            if (typeof value == "function" && value.name == "parserOnBody") {
                parser[field] = (chunk, start, len) => {
                    value.call(parser, chunk, start, len);
                };
            }
            else if (typeof value == "function" && value.name == "parserOnMessageComplete") {
                parser[field] = () => {
                    console.log("finish");
                    value.call(parser);
                };
            }
        }
    }

    let pipes: stream = proxyRes;
    const contentEncodings = (proxyRes.headers["content-encoding"] || "").split(/, ?/).filter(item => item != "").reverse();
    for (let contentEncoding of contentEncodings) {
        switch (contentEncoding) {
            case "gzip":
            case "x-gzip":
                pipes = pipes.pipe(zlib.createGunzip());
                break;
            case "br":
                pipes = pipes.pipe(zlib.createBrotliDecompress());
                break;
            case "deflate":
                pipes = pipes.pipe(zlib.createInflate());
                break;
        }
    }

    let contentLength = +proxyRes.headers["content-lenght"];
    isNaN(contentLength) && (contentLength = -1);
    if (contentLength > -1) {
        let receiveLen = 0;
        proxyRes.on("data", chunk => {
            receiveLen += chunk.length;
            if (receiveLen >= contentLength) {
                proxyRes.emit("close");
            }
        });
    }

    // let lastReceiveTime = 0;
    // pipes.on("data", () => {
    //     lastReceiveTime = new Date().getTime();
    //     setTimeout(() => {
    //         if (new Date().getTime() - lastReceiveTime >= 495) {
    //             pipes.emit("close");
    //         }
    //     }, 500);
    // });

    let lastChunk: Buffer;
    pipes.on("data", chunk => {
        lastChunk = chunk;
    });

    setInterval(() => {
        const endChunk = lastChunk.subarray(lastChunk.length - 10);
        const lastStr = endChunk.toString("utf-8");
        req["length"];
        proxyRes["length"];
        console.log(lastChunk.length);
    }, 1000);

    const bufferStream = new BufferStream();
    pipes.pipe(bufferStream);
    pipes.once("close", () => {
        const statusCode = proxyRes.statusCode;
        const headers = proxyRes.headers;
        const body = bufferStream.toBuffer();
        console.log(body.length);
        proxyRes.destroy();
    });
});

req.end();

