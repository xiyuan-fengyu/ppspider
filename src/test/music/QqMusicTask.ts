import {AddToQueue} from "../../spider/decorators/AddToQueue";
import {Page} from "puppeteer";
import {PuppeteerWorkerFactory} from "../../spider/worker/PuppeteerWorkerFactory";
import {Job} from "../../spider/job/Job";
import {OnStart} from "../../spider/decorators/OnStart";
import {AddToQueueData} from "../../spider/data/Types";
import {FromQueue} from "../../spider/decorators/FromQueue";
import {JobOverride} from "../../spider/decorators/JobOverride";
import {PuppeteerUtil} from "../../spider/util/PuppeteerUtil";

const queue_qq = {
    name: "qq"
};

const queue_qq_song = {
    name: "qq_song"
};

export class QqMusicTask {

    @JobOverride("qq_song")
    qqSongJobOverride(job: Job) {
        const match = job.url().match("https://y.qq.com/n/yqq/song/(.*?)\\.html.*");
        if (match) job.key(match[1]);
    }

    @OnStart({
        urls: "https://y.qq.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    @FromQueue({
        name: "qq",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1
    })
    @AddToQueue([
        queue_qq,
        queue_qq_song
    ])
    async index(page: Page, job: Job): AddToQueueData {
        await page.goto(job.url());
        return await page.$$eval("a", as => {
            const hrefs = {
                qq: [],
                qq_song: []
            };
            as.forEach(a => {
                const href = (a as any).href;
                if (href.startsWith("https://y.qq.com")) {
                    if (href.substr(16, 12) == "/n/yqq/song/") hrefs.qq_song.push(href);
                    else hrefs.qq.push(href);
                }
            });
            return hrefs;
        });
    }

    @FromQueue({
        name: "qq_song",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1
    })
    @AddToQueue([
        queue_qq,
        queue_qq_song
    ])
    async roaming(page: Page, job: Job): AddToQueueData {
        console.log(job.key() + "    " + job.url());

        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);

        await page.goto(job.url());
        const info = await page.$$eval("a", as => {
            const info: any = {};

            const hrefs = {
                qq: [],
                qq_song: []
            };
            as.forEach(a => {
                const href = (a as any).href;
                if (href.startsWith("https://y.qq.com")) {
                    if (href.substr(16, 12) == "/n/yqq/song/") hrefs.qq_song.push(href);
                    else hrefs.qq.push(href);
                }
            });
            info.hrefs = hrefs;

            return info;
        });
        return info.hrefs;
    }

}

// 基本信息
// https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=003LxmX246aRC7&tpl=yqq_song_detail&format=jsonp&callback=getOneSongInfoCallback&g_tk=5381&jsonpCallback=getOneSongInfoCallback&loginUin=0&hostUin=0&format=jsonp&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0

// 公司信息
// https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?albummid=000wSDCN0KgvN1&g_tk=5381&jsonpCallback=getAlbumInfoCallback&loginUin=0&hostUin=0&format=jsonp&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0

// 歌词
// https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg?nobase64=1&musicid=213911001&callback=jsonp1&g_tk=5381&jsonpCallback=jsonp1&loginUin=0&hostUin=0&format=jsonp&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0

// 评论
// https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg?g_tk=5381&jsonpCallback=jsoncallback8277496011811691&loginUin=0&hostUin=0&format=jsonp&inCharset=utf8&outCharset=GB2312&notice=0&platform=yqq&needNewCode=0&cid=205360772&reqtype=1&biztype=1&topid=213911001&cmd=4&needmusiccrit=0&pagenum=0&pagesize=0&lasthotcommentid=&callback=jsoncallback8277496011811691&domain=qq.com
// https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg?g_tk=5381&jsonpCallback=jsoncallback20300182900073782&loginUin=0&hostUin=0&format=jsonp&inCharset=utf8&outCharset=GB2312&notice=0&platform=yqq&needNewCode=0&cid=205360772&reqtype=2&biztype=1&topid=213911001&cmd=8&needmusiccrit=0&pagenum=0&pagesize=25&lasthotcommentid=&callback=jsoncallback20300182900073782&domain=qq.com&ct=24&cv=101010