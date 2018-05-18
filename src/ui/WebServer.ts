import * as SocketIO from "socket.io";
import express = require("express");
import {Server} from "http";

export class WebServer {

    readonly webRoot = __dirname + "/web";

    private httpServer: Server;

    private socketServer: any;

    private readonly socketClients: any[] = [];

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
        this.socketServer.on('connection', client => {
            if (!this.running) {
                client.disconnect();
                return;
            }

            this.socketClients.push(client);
            client.on("clientMsg", data => console.log(data));
            client.on("close", client => {
                this.socketClients.splice(this.socketClients.indexOf(client), 1);
            });
        });
        console.log("The api for webUI server start at port: " + apiPort);
    }

    private shutdownSocketServer() {
        this.socketServer.removeAllListeners();
        this.socketClients.forEach(client => {
           client.emit("SERVER_SHUTDOWN", "");
           client.client.destroy();
        });
        this.socketServer.httpServer.close(() => {
            this.socketServer.close();
        });
    }

    shutdown() {
        this.running = false;
        this.shutdownSocketServer();
        this.httpServer.close();
        console.log("The webUI stopped");
    }

}

const webServer = new WebServer(9000, 9090);
setTimeout(() => {
    webServer.shutdown();
}, 5000);