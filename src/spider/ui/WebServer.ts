import {Server as HttpServer} from "http";
import {Server as ScoketIOServer} from "socket.io";
import {EventEmitter} from "events";
import {ClientRequest} from "../data/Types";

export class WebServer {

    private webRoot = __dirname + "/web";

    private http: HttpServer;

    private io: ScoketIOServer;

    constructor(private port: number, messager: EventEmitter) {
        if (this.http != null) return;

        const express = require("express");
        const app = express();
        app.use(express.static(this.webRoot));

        this.http = require("http").Server(app);
        this.io = require("socket.io")(this.http);

        this.io.on("connection", socket => {
            socket.on("request", (request: ClientRequest) => {
                const responseId = "response_" + request.id;
                messager.once(responseId, res => {
                    socket.emit(responseId, res);
                });
                messager.emit("request", request);
            });
            socket.on("error", (error: Error) => {
                if (error) console.warn("socket error: " + (error.message || "") + "\n" + (error.stack || ""));
            });
        });

        this.http.listen(port, () => {
            console.log("The web ui server start at port: " + port);
        });

        messager.on("push", (key: string, data: any) => {
           this.io.clients().emit("push_" + key, data);
        });
    }

    shutdown() {
        this.http.close();
        this.io.close();
        console.log("The webUI stopped");
    }

}
