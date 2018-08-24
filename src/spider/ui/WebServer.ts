import {Server as HttpServer} from "http";
import {Server as ScoketIOServer} from "socket.io";
import {EventEmitter} from "events";
import {ClientRequest} from "../data/Types";
import {logger} from "../../common/util/logger";
import {mainMessager} from "../decorators/Launcher";

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
        app.use(express.static(this.webRoot));

        this.http = require("http").Server(app);
        this.io = require("socket.io")(this.http);

        this.io.on("connection", socket => {
            socket.on("request", (request: ClientRequest) => {
                const responseId = "response_" + request.id;
                mainMessager.once(responseId, res => {
                    socket.emit(responseId, res);
                });
                mainMessager.emit("request", request);
            });
            socket.on("error", (error: Error) => {
                if (error) logger.warn("socket error: " + (error.message || "") + "\n" + (error.stack || ""));
            });
        });

        this.http.listen(port, () => {
            logger.info("The web ui server start at port: " + port);
        });

        mainMessager.on("push", (key: string, data: any) => {
           this.io.clients().emit("push_" + key, data);
        });
    }

    shutdown() {
        this.http.close();
        this.io.close();
        logger.info("The web ui server stopped");
    }

}
