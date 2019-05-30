import * as url from "url";
import * as http from "http";
import {IncomingMessage} from "http";
import * as HttpProxyAgent from 'http-proxy-agent';
import * as https from "https";
import * as HttpsProxyAgent from 'https-proxy-agent';
import WritableStream = NodeJS.WritableStream;

// https://stackoverflow.com/questions/21491567/how-to-implement-a-writable-stream
const stream = require('stream');
const util = require('util');
function ResStream () {
    this.chunks = [];
    stream.Writable.call(this);
}
util.inherits(ResStream, stream.Writable);
ResStream.prototype._write = function (chunk, encoding, done) {
    this.chunks.push(chunk);
    done();
};
ResStream.prototype.getBody = function () {
    return Buffer.concat(this.chunks);
};

const goto = "https://www.google.com/";
const proxy =  'http://127.0.0.1:2007';

const options = url.parse(goto);
options["method"] = "GET";

let proxyReq;
const resHandler = (res: IncomingMessage) => {
    // const chunks = [];
    // res.on("data", chunk => chunks.push(chunk));
    // res.on("end", () => {
    //     const body = Buffer.concat(chunks);
    //     console.log("get response, body length: " + body.length);
    // });
    // res.on("error", e => {
    //     console.log(e.stack);
    // });
    const stream = new ResStream();
    res.pipe(stream as any);
    stream.on("finish", () => {
        const body = stream.getBody();
        console.log("get response, body length: " + body.length);
    });
    stream.on("error", (err: Error) => {
        console.log(err.stack);
    });
};

if (options.protocol == "http:") {
    options["agent"] = new HttpProxyAgent("http:");
    proxyReq = http.request(options, resHandler);
}
else if (options.protocol == "https:") {
    options["agent"] = new HttpsProxyAgent(proxy);
    proxyReq = https.request(options, resHandler);
}

if (proxyReq) {
    proxyReq.end();
}



// var url = require('url');
// var https = require('https');
// var HttpsProxyAgent = require('https-proxy-agent');
//
// // HTTP/HTTPS proxy to connect to
// var proxy = process.env.http_proxy || 'http://127.0.0.1:2007';
// console.log('using proxy server %j', proxy);
//
// // HTTPS endpoint for the proxy to connect to
// var endpoint = process.argv[2] || 'https://www.google.com/';
// console.log('attempting to GET %j', endpoint);
// var options = url.parse(endpoint);
//
// // create an instance of the `HttpsProxyAgent` class with the proxy server information
// var agent = new HttpsProxyAgent(proxy);
// options.agent = agent;
// options.method = "GET";
//
// // https://stackoverflow.com/questions/13121590/steps-to-send-a-https-request-to-a-rest-service-in-node-js
// https.request(options, res => {
//     console.log('"response" event!', res.headers);
//     res.pipe(process.stdout);
// }).end();
