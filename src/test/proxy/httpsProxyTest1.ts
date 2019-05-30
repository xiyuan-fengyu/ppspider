import * as url from "url";
import * as http from "http";
import {IncomingMessage} from "http";
import * as HttpProxyAgent from 'http-proxy-agent';
import * as https from "https";
import * as HttpsProxyAgent from 'https-proxy-agent';

const goto = "https://www.google.com/";
const proxy =  'http://127.0.0.1:3000';

const options = url.parse(goto);
options["method"] = "GET";

let proxyReq;
const resHandler = (res: IncomingMessage) => {
    res.pipe(process.stdout);
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
