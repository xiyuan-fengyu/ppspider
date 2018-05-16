import * as fs from "fs";
import * as path from "path";

export class FileUtil {

    static mkdirs(pathStr: string): boolean {
        if (!pathStr) return false;

        try {
            pathStr = pathStr.replace("\\", "/");
            const split = pathStr.split("/");
            let curPath = "";
            for (let item of split) {
                curPath += item + "/";

                if (!fs.existsSync(curPath)){
                    fs.mkdirSync(curPath);
                }
            }
        }
        catch (e) {
            console.warn(e.stack);
            return false;
        }
        return true;
    }

    static parent(pathStr: string): string {
        pathStr = pathStr.replace("\\", "/");
        const dir = path.dirname(pathStr);
        if (dir != pathStr) {
            return dir;
        }
        else return "";
    }

    static write(pathStr: string, content: any, charset: string = "utf-8"): boolean {
        try {
            if (this.mkdirs(this.parent(pathStr))) {
                fs.writeFileSync(pathStr, content, {
                    encoding: charset
                });
                return true;
            }
        }
        catch (e) {
            console.warn(e.stack);
        }
        return false;
    }

    static read(pathStr: string, charset: string = "utf-8"): string {
        try {
            if (fs.existsSync(pathStr)) {
                return fs.readFileSync(pathStr, {
                    encoding: charset
                });
            }
        }
        catch (e) {
            console.warn(e.stack);
        }
        return null;
    }

}
