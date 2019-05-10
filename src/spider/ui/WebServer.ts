import * as bodyParser from "body-parser";
import {Server as HttpServer} from "http";
import {Server as ScoketIOServer} from "socket.io";
import {logger} from "../../common/util/logger";
import {NextFunction, Request, Response} from "express-serve-static-core";
import {IdKeyData, RequestMappingConfig} from "../Types";

// ssl
const sslOption = {
  key: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAw3qEA/wJhXfwt/vUvGtyI6l91Sp+bjpBPyCcMibr6QyDAvNV
UaJsSC8rAMeBoJW6EA7o1+K/NblnxB+cE1c6r0FGt4SW6MMN4kzegnj440S+xKZ/
nnHAcMrvVpMatnzx4s53T8aHAAwe2Ctq5m24MwRfkvst4eo+Z0yOeBhWs/q2fRmX
aS/uB2m2I3rvaohMG/lVgn+YYxvEv9t7JjVHeIZa3PNSipNRMU4WjGLbL9ARe6W6
V+OQPmLwlfhPCJCid9KH5zEUYROY2qDiOvLp5oq3MOk05qyi+d3+VDqhdJblbQ83
8WSH/d+yPZrtp6PhSUb6n2PHvTrWvKoSEfvmbwIDAQABAoIBAQC6qJ6u/1hILoOZ
68r0MNVI4GvbxTv9HXt4QDdmXGwgmWXwx1LNJP+o3gF+OQO6x75n3xTQMSDMuEIx
sM1kWoMbHoXcb6t6j+cOFMDUbZebzOUs+qAaOBy+l8l7LfTwFNcU8HpVnwkCLpC1
cqAdcN/XN3Hb9CWX+Ammsh/I5dTE/hKaItnXQXSxVY01kLBqYMa4YC0xvtngabTx
Vf3fq2UUaGPZmniIaTJuK1Gca9rKa+EuTUe463CSSabkFqcHT/yLt9E9A5509+Ph
eRWinW3avm4eQKxS5Ix1vh0VztXK3+/ikoJVfZOnVCH8qwFFNshJmfPGyedaEugU
x14UVKrhAoGBAO0T9lc63V94MxupdCoqOf2D1lmqmcK4tuIKFa7idn5eFzYZ8TNr
qGFZKeCvo9QfemKAhwDvJGHLBWr3MqOZIeb4U1J+L+g7HAfhyZYlyJVkO1jqtpRF
RgWJPUIudahy617MfGnqCK5hteohkdNM76GCH5/Rqdicsu+oTL5by689AoGBANMU
lXcFc1DgKyONuETSRpykLzNWxtg0c21CjGIYJh19A/scEBpt3MVvES5aSz7vMEd5
xr+JS91p6iyIWTPcxkZ8rlSP4TOCYEDvTCIQRtD3OQ/X4guUyAbj9eShS2FlVI+y
zvfR6tvEJ8euSNRBC+6/HD0RpHkuqMiYseEr6McbAoGBAJG534Ym7MQuQlwSgREZ
+6NVUoCzWOhUWjX/NOzWzzdF5saek6Cj4FBWWmN+Exnkb3n0vwdX9+kUvjPN1xaw
niI3KiBe6Fu7WbOOmjbs6qrJfaFeRPRG0I++mCUCIdh1KzCOSTthXAy0ivlrwRM9
C18feQjn+5rmVybxMJsiGcWRAoGACe3+9gFoolZZUSvajkpCDh5fJhAf/I3DHFG0
Hu055cs6w7ZXP5cJerQ137NZtNU1tTcSVXJVAk54OK4VXC43mZtF7C50jqLEemmH
cFbJrgzjP06NkLPoEQLqT14TGLrWlof32oqifMImiOs2+90vfYS6BFlvHlBGmmEs
hQY2xh8CgYAbBhzZuKrcky01Geu6IVlWy0Hxjd4NCGaTZ+74gb/6Y4Au0kgkwVOH
Pfflc8H0iKzqMEVXFUbPEZ3YqBmObRO2WajiR6EquYZK73khSSGelhF/gU663bIj
SMe0wfet2nPVcE6b0e2oSjcFA8WnWcoSbir16NLZo/NFMk8LIoASjQ==
-----END RSA PRIVATE KEY-----`,
  cert: `-----BEGIN CERTIFICATE-----
MIIDqzCCApOgAwIBAgIJANmf6rwPX8z7MA0GCSqGSIb3DQEBCwUAMGsxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQxJDAiBgkqhkiG9w0BCQEWFXhpeXVhbl9mZW5neXVAMTYz
LmNvbTAgFw0xOTA1MTAwNzUzMzJaGA8yMTU2MDQwMTA3NTMzMlowazELMAkGA1UE
BhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0IFdp
ZGdpdHMgUHR5IEx0ZDEkMCIGCSqGSIb3DQEJARYVeGl5dWFuX2Zlbmd5dUAxNjMu
Y29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw3qEA/wJhXfwt/vU
vGtyI6l91Sp+bjpBPyCcMibr6QyDAvNVUaJsSC8rAMeBoJW6EA7o1+K/NblnxB+c
E1c6r0FGt4SW6MMN4kzegnj440S+xKZ/nnHAcMrvVpMatnzx4s53T8aHAAwe2Ctq
5m24MwRfkvst4eo+Z0yOeBhWs/q2fRmXaS/uB2m2I3rvaohMG/lVgn+YYxvEv9t7
JjVHeIZa3PNSipNRMU4WjGLbL9ARe6W6V+OQPmLwlfhPCJCid9KH5zEUYROY2qDi
OvLp5oq3MOk05qyi+d3+VDqhdJblbQ838WSH/d+yPZrtp6PhSUb6n2PHvTrWvKoS
EfvmbwIDAQABo1AwTjAdBgNVHQ4EFgQUfmDhYrr3YNt13JuuAvv1IBe0XPgwHwYD
VR0jBBgwFoAUfmDhYrr3YNt13JuuAvv1IBe0XPgwDAYDVR0TBAUwAwEB/zANBgkq
hkiG9w0BAQsFAAOCAQEAB7tPc56IKLV1LvwC3DPYItkAJUhdRIT++entd4eI09Sp
/1bzbq/wG9n44uyllcmsHQWk9O78qcPKPW7eV2bz8AWz9KNGxjHp+ZM863Bi6P0B
XwvvAxX61pPw6DE+PB4HgRyJkKj4SnXPzP/IVsArKooxrq+rKB/JAwezilYKr+jA
Sb3jZSp5bW9r6TZR/4iwsQkP6GqiOBCXH2Bbb3845lSeMeKEj5/hvyXWDIaTmDqZ
k8huTOiN8eiAFz/3HdFL4Ky8jAjRYIqWSaXvi3zNRgvk8o2GtYMYvcY1zo3Cwaez
AVi87rG+Sa7/yORm9kcdir5lmEy4Sqei9tAI7iiBBA==
-----END CERTIFICATE-----`,
    requestCert: false,
    rejectUnauthorized: false
};

/**
 * 通过 express 提供web静态资源服务，静态资源是由 ui 项目发布到 lib/spider/ui/web 目录下
 * 所有动态请求和动态数据都是通过 websocket 传输的
 */
export class WebServer {

    private webRoot = __dirname + "/web";

    private http: HttpServer;

    private io: ScoketIOServer;

    constructor(private port: number, private useSsl: boolean, workplace: string,
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

        this.http = useSsl ? require("https").Server(sslOption, app) : require("http").Server(app);
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
            logger.info("The web ui server started successfully, have a look at http"
                + (this.useSsl ? "s" : "") + "://localhost:" + port);
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
