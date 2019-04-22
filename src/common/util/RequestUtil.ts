import * as request from "request";
import {CoreOptions, Response} from "request";

export class RequestUtil {

    static execute(url: string, options?: CoreOptions): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            request(url, options, (error, res) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(res);
                }
            });
        });
    }

    static get(url: string, options?: CoreOptions): Promise<Response> {
        (options = options == null ? {} : options).method = "get";
        return this.execute(url, options);
    }

    static post(url: string, options?: CoreOptions): Promise<Response> {
        (options = options == null ? {} : options).method = "post";
        return this.execute(url, options);
    }

}
