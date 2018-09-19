import * as bodyParser from "body-parser";
import {Server as HttpServer} from "http";
import {Server as ScoketIOServer, Socket} from "socket.io";
import {ClientRequest} from "../data/Types";
import {logger} from "../../common/util/logger";
import {mainMessager, MainMessagerEvent, requestMappingConfigs} from "../decorators/Launcher";
import {NextFunction, Request, Response} from "express-serve-static-core";

/**
 * 通过 express 提供web静态资源服务，静态资源是由 ui 项目发布到 lib/spider/ui/web 目录下
 * 所有动态请求和动态数据都是通过 websocket 传输的
 */
export class WebServer {

    private webRoot = __dirname + "/web";

    private http: HttpServer;

    private io: ScoketIOServer;

    constructor(private port: number) {
        if (this.http != null) return;

        const express = require("express");
        const app = express();
        app.use(bodyParser.json({limit: '10mb'}));
        app.use(bodyParser.urlencoded({limit: '10mb', extended: true}));
        app.use(express.static(this.webRoot));

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
                        logger.warn(e.stack);
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
        this.io = require("socket.io")(this.http);

        const socketRequestMap = new Map<string, Socket>();
        this.io.on("connection", socket => {
            socket.on("request", (request: ClientRequest) => {
                socketRequestMap.set(request.id, socket);
                mainMessager.emit(MainMessagerEvent.WebServer_Request_request, request);
            });
            socket.on("error", (error: Error) => {
                if (error) logger.warn("socket error: " + (error.message || "") + "\n" + (error.stack || ""));
            });
        });

        mainMessager.on(MainMessagerEvent.WebServer_Response_id_res, (id, res) => {
            const socket = socketRequestMap.get(id);
            if (socket) {
                socketRequestMap.delete(id);
                socket.emit("response_" + id, res);
            }
        });

        mainMessager.on(MainMessagerEvent.WebServer_Push_key_data, (key: string, data: any) => {
            this.io.clients().emit("push_" + key, data);
        });

        this.http.listen(port, () => {
            logger.info("The web ui server start at port: " + port);
        });
    }

    shutdown() {
        this.http.close();
        this.io.close();
        logger.info("The web ui server stopped");
    }

}
