/*
模拟一个 mid-proxy server，用于研究 proxy-server 的工作原理
在 proxySocket.connect 处已经可以随机分配下游proxy地址
但是这还不是想要的
最终目的，实现每个page配置单独的代理
参考：https://gist.github.com/tedmiston/5935757
 */

import * as fs from "fs";
import {FileUtil} from "../..";

const net = require('net');

net.createServer(socket => {
    const reqId = new Date().getTime() + "_" + (Math.random() * 10000).toFixed();
    console.log(reqId + " connected");

    const proxySocket = new net.Socket();
    FileUtil.mkdirs("proxy");
    const reqF = fs.createWriteStream('proxy/' + reqId + "_req.txt",{encoding:'binary'});
    const resF = fs.createWriteStream('proxy/' + reqId + "_res.txt",{encoding:'binary'});
    proxySocket.connect(2007, '127.0.0.1', () => {
        socket.pipe(proxySocket);
        socket.pipe(reqF);
    });
    proxySocket.pipe(socket);
    proxySocket.pipe(resF);

    socket.on("close", () => {
        console.log(reqId + " disconnected");
    });
    socket.on("error", err => {});
    proxySocket.on("close", () => {});
    proxySocket.on("error", () => {});
}).listen(3000, '127.0.0.1');
