import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

/**
 * 文件系统相关的工具类
 */
export class FileUtil {

    /**
     * 创建多级目录，即 mkdir -p 的效果
     * @param {string} pathStr
     * @returns {boolean}
     */
    static mkdirs(pathStr: string): boolean {
        if (!pathStr) return false;

        try {
            if (!fs.existsSync(pathStr)){
                fs.mkdirSync(pathStr, {recursive: true});
            }
        }
        catch (e) {
            console.warn(e.stack);
            return false;
        }
        return true;
    }

    /**
     * 获取父文件夹的路径
     * @param {string} pathStr
     * @returns {string}
     */
    static parent(pathStr: string): string {
        pathStr = pathStr.replace("\\", "/");
        const dir = path.dirname(pathStr);
        if (dir != pathStr) {
            return dir;
        }
        else return "";
    }

    /**
     * 将内容写入文件，当文件的所在文件夹不存在时，自动创建父文件夹
     * @param {string} pathStr
     * @param content
     * @param {string} charset
     * @returns {boolean}
     */
    static write(pathStr: string, content: string | string[] | Buffer, charset?: string): boolean {
        try {
            if (this.mkdirs(this.parent(pathStr))) {
                const options = charset ? {
                    encoding: charset
                } : "utf-8";
                if (content instanceof Array) {
                    // 写入多行
                    const lines = content as string[];
                    fs.writeFileSync(pathStr, "", options);
                    for (let i = 0, len = lines.length; i < len; i += 100) {
                        const subLines = lines.slice(i, i + 100).join("\n") + "\n";
                        fs.appendFileSync(pathStr, subLines, options);
                    }
                }
                else {
                    fs.writeFileSync(pathStr, content, options);
                }
                return true;
            }
        }
        catch (e) {
            console.warn(e.stack);
        }
        return false;
    }

    /**
     * 从文件中读取内容
     * @param {string} pathStr
     * @param {string} charset
     * @returns {string}
     */
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

    static readLines(file: string, charset: string = "utf-8"): Promise<string[]> {
        return new Promise<string[]>(resolve => {
            const lines = [];
            const reader = readline.createInterface({
                input: fs.createReadStream(file).setEncoding(charset)
            });
            reader.on('line', function(line) {
                lines.push(line);
            });
            reader.on('close', function(line) {
                resolve(lines);
            });
        });
    }

}
