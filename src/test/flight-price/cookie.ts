import {PuppeteerUtil} from "../..";
import * as fs from "fs";

// cookie 获取方式参考 PuppeteerUtil.parseCookies 方法说明
// 将cookie内容存于 lib/test/flight-price/cookie.txt
export const cookies = PuppeteerUtil.parseCookies(fs.readFileSync("./cookie.txt", "utf-8"));
