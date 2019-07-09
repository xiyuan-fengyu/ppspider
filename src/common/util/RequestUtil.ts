import * as request from "request";
import {CoreOptions, UriOptions, UrlOptions} from "request";
import * as HttpProxyAgent from 'http-proxy-agent';
import * as HttpsProxyAgent from 'https-proxy-agent';
import {IncomingHttpHeaders, IncomingMessage} from "http";
import {PassThrough} from "stream";
import * as zlib from "zlib";

export class RequestUtil {

    /**
     * 将代理和返回body的解压缩过程进行封装，返回只包含 status, headers, body 的简单结果
     * @param options
     */
    static simple(options: (UriOptions | UrlOptions) & CoreOptions) {
        // body 采用 Buffer 格式返回
        options.encoding = null;

        if (options.proxy) {
            let proxy;
            const typeofProxy = typeof options.proxy;
            if (typeofProxy == "string") {
                proxy = options.proxy;
            }
            else if (typeofProxy == "object" && options.proxy.href) {
                proxy = options.proxy.href;
            }

            if (proxy) {
                if (!options.headers) {
                    options.headers = {};
                }
                options.headers["accept-encoding"] = "identity, gzip, deflate";

                const reqUrl = options["url"] || options["uri"];
                if (reqUrl.startsWith("https")) {
                    options.agent = new HttpsProxyAgent(options.proxy);
                }
                else {
                    options.agent = new HttpProxyAgent(options.proxy);
                }
                delete options.proxy;
            }
        }

        return new Promise<{
            status: number,
            headers: IncomingHttpHeaders,
            body: Buffer
        }>((resolve, reject) => {
            const req = request(options, (error, res: IncomingMessage) => {
                if (error) {
                    reject(error);
                    return;
                }

                const simpleRes = {
                    status: res.statusCode,
                    headers: res.headers,
                    body: res["body"] as Buffer || Buffer.from([])
                };

                if (simpleRes.body.length) {
                    let bodyPipe = new PassThrough();
                    const contentEncodings = (res.headers["content-encoding"] || "").split(/, ?/).filter(item => item != "").reverse();
                    for (let contentEncoding of contentEncodings) {
                        switch (contentEncoding) {
                            case "gzip":
                                bodyPipe = bodyPipe.pipe(zlib.createGunzip());
                                break;
                            case "deflate":
                                bodyPipe = bodyPipe.pipe(zlib.createInflate());
                                break;
                        }
                    }

                    let chunks: Buffer[] = [];
                    bodyPipe.on("data", chunk => chunks.push(chunk));
                    bodyPipe.on("error", err => reject(err));
                    bodyPipe.on("close", () => {
                        simpleRes.body = Buffer.concat(chunks);
                        resolve(simpleRes);
                    });

                    bodyPipe.write(res["body"] as Buffer, err => bodyPipe.destroy(err));
                }
                else {
                    resolve(simpleRes);
                }
            });
        });
    }

    /**
     * 从多行字符串中解析 headers
     * 例如下面两行
     * Pragma: no-cache
     * User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36
     * 解析结果
     * {
     *     "Pragma": "no-cache",
     *     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36"
     * }
     * @param lines
     */
    static linesToHeaders(lines: string): {[headerName: string]: string} {
        const headers = {};
        lines.split(/\r?\n/g).forEach(line => {
            line = line.trim();
            if (line) {
               const divideI = line.indexOf(": ");
               if (divideI > -1) {
                   headers[line.substring(0, divideI)] = line.substring(divideI + 2);
               }
            }
        });
        return headers;
    }

}
