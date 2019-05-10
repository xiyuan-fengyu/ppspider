import * as bodyParser from "body-parser";
import {Server as HttpServer} from "http";
import {Server as ScoketIOServer} from "socket.io";
import {logger} from "../../common/util/logger";
import {NextFunction, Request, Response} from "express-serve-static-core";
import {IdKeyData, RequestMappingConfig} from "../Types";

/**
 * 通过 express 提供web静态资源服务，静态资源是由 ui 项目发布到 lib/spider/ui/web 目录下
 * 所有动态请求和动态数据都是通过 websocket 传输的
 */
export class WebServer {

    private webRoot = __dirname + "/web";

    private http: HttpServer;

    private io: ScoketIOServer;

    constructor(private port: number, workplace: string,
                requestMappingConfigs: RequestMappingConfig[], onRequestCallback: (req: IdKeyData) => any) {
        if (this.http != null) return;

        const express = require("express");
        const app = express();
        app.use(bodyParser.json({limit: '10mb'}));
        app.use(bodyParser.urlencoded({limit: '10mb', extended: true}));
        app.use(express.static(this.webRoot));
        app.use(express.static(workplace));

        // 添加 RequestMapping
        {
            const requestMappingRouter = express.Router();
            requestMappingConfigs.forEach(config => {
                const tempHandler = async (req: Request, res: Response, next: NextFunction) => {
                    try {
                        const target = config.target;
                        const method = target[config.method];
                        await method.call(target, req, res, next);
                    }
                    catch (e) {
                        logger.warn(e);
                    }
                };
                if (config.httpMethod == "" || config.httpMethod == "GET") {
                    requestMappingRouter.get(config.url, tempHandler);
                }
                if (config.httpMethod == "" || config.httpMethod == "POST") {
                    requestMappingRouter.post(config.url, tempHandler);
                }
            });
            app.use("/", requestMappingRouter);
        }

        this.http = require("http").Server(app);
        this.io = require("socket.io").listen(this.http);

        this.io.on("connection", socket => {
            socket.on("request", async (req: IdKeyData) => {
                const res = await onRequestCallback(req);
                socket.emit("response_" + req.id, res);
            });
            socket.on("error", (error: Error) => {
                if (error) {
                    logger.warn("socket error", error);
                }
            });
        });

        this.http.listen(port, () => {
            logger.info("The web ui server started successfully, have a look at http://localhost:" + port);
        });
    }

    push(key: String, data: any) {
        this.io.clients().emit("push_" + key, data);
    }

    shutdown() {
        this.http.close();
        this.io.close();
        logger.info("The web ui server stopped");
    }

}
