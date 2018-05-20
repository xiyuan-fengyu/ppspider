import * as SocketIO from "socket.io";
import {Server} from "http";
import express = require("express");
import * as readline from "readline";
import Socket = NodeJS.Socket;

export class WebServer {

    readonly webRoot = __dirname + "/web";

    private httpServer: Server;

    private socketServer: SocketIO.Server;

    private running = true;

    constructor(
        public readonly uiPort: number,
        public readonly apiPort: number
    ) {
        const httpServerApp = express();
        httpServerApp.use(express.static(this.webRoot));
        this.httpServer = httpServerApp.listen(uiPort);
        console.log("The webUI start at port: " + uiPort);

        this.socketServer = SocketIO.listen(apiPort);
        this.socketServer.on('connection', (client: any) => {
            // console.log(`client connected: ${client.id}(${client.conn.remoteAddress})`);

            client.on("clientMsg", data => console.log(data));
            client.on("disconnect", () => {
                // console.log(`client disconnected: ${client.id}(${client.conn.remoteAddress})`);
            });
        });
        console.log("The api for webUI server start at port: " + apiPort);
    }

    private shutdownSocketServer() {
        this.socketServer.close();
    }

    private shutdownHttpServer() {
        this.httpServer.close();
    }

    shutdown() {
        this.running = false;
        this.shutdownHttpServer();
        this.shutdownSocketServer();
        console.log("The webUI stopped");
    }

}

const webServer = new WebServer(9000, 9090);
