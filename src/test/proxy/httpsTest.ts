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
    "referer": "https://www.bilibili.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3765.0 Safari/537.36",
    "accept-encoding": "identity, gzip, deflate",
};
options["agent"] = new HttpsProxyAgent('http://127.0.0.1:2007');

const req = https.request(options, (proxyRes: IncomingMessage) => {
    let pipes: stream = proxyRes;
    const contentEncodings = (proxyRes.headers["content-encoding"] || "").split(/, ?/).filter(item => item != "").reverse();
    for (let contentEncoding of contentEncodings) {
        switch (contentEncoding) {
            case "gzip":
            case "x-gzip":
                pipes = pipes.pipe(zlib.createGunzip());
                break;
            // case "br":
            //     pipes = pipes.pipe(zlib.createBrotliDecompress());
            //     break;
            case "deflate":
                pipes = pipes.pipe(zlib.createInflate());
                break;
        }
    }

    const bodyStream = new BufferStream();
    const onBodyEnd = () => {
        const statusCode = proxyRes.statusCode;
        const headers = proxyRes.headers;
        const body = bodyStream.toBuffer();

        console.log(body.toString("utf-8"));

        proxyRes.destroy();
    };

    let contentLength = +proxyRes.headers["content-length"];
    isNaN(contentLength) && (contentLength = -1);
    if (contentLength == 0) {
        onBodyEnd();
    }
    else {
        if (contentLength > 0) {
            let receiveLen = 0;
            proxyRes.on("data", chunk => {
                receiveLen += chunk.length;
                if (receiveLen >= contentLength) {
                    setTimeout(() => {
                        proxyRes.emit("close");
                    }, 0);
                }
            });
        }
        else {
            // transfer-encoding:chunked
        }

        pipes.pipe(bodyStream);
        pipes.once("close", onBodyEnd);
    }

});

req.end();

