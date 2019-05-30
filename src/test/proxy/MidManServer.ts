import * as url from "url";
import * as http from "http";
import {IncomingMessage} from "http";
import * as https from "https";
import * as HttpProxyAgent from 'http-proxy-agent';
import * as HttpsProxyAgent from 'https-proxy-agent';
import * as stream from "stream";
import * as zlib from "zlib";
import {Request, Response} from "express";

const express = require("express");
const app = express();

app.use("/proxy", (req: Request, res: Response, next) => {
    const options = url.parse(req.query.url);
    options["method"] = req.method;
    options["headers"] = JSON.parse(req.query.headers);

    console.log(options["method"] + ": " + req.query.url);

    const resHandler = (proxyRes: IncomingMessage) => {
        res.statusCode = proxyRes.statusCode;
        const proxyResHeaders = proxyRes.rawHeaders || [];
        for (let i = 0, len = proxyResHeaders.length; i < len; i += 2) {
            res.header(proxyResHeaders[i], proxyResHeaders[i + 1]);
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
                case "":
                    pipes = pipes.pipe(zlib.createInflate());
                    break;
            }
        }
        proxyRes.pipe(res);
    };

    const proxy = req.query.proxy;
    let proxyReq;
    if (options.protocol == "http:") {
        options["agent"] = new HttpProxyAgent(proxy);
        proxyReq = http.request(options, resHandler);
    }
    else {
        options["agent"] = new HttpsProxyAgent(proxy);
        proxyReq = https.request(options, resHandler);
    }
    req.pipe(proxyReq);
    req.pipe(process.stdout);
});

require("http").Server(app).listen(3000, () => {
    console.log("mid-man-server started");
});
