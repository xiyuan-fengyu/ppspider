import {AddToQueue} from "../../spider/decorators/AddToQueue";
import {Page} from "puppeteer";
import {PuppeteerWorkerFactory} from "../../spider/worker/PuppeteerWorkerFactory";
import {Job} from "../../spider/job/Job";
import {OnStart} from "../../spider/decorators/OnStart";
import {AddToQueueData} from "../../spider/data/Types";
import {FromQueue} from "../../spider/decorators/FromQueue";
import {JobOverride} from "../../spider/decorators/JobOverride";
import {PuppeteerUtil} from "../../spider/util/PuppeteerUtil";
import {FileUtil} from "../../common/util/FileUtil";
import {PromiseUtil} from "../../common/util/PromiseUtil";

const queue_qq = {
    name: "qq"
};

const queue_qq_song = {
    name: "qq_song"
};

export class QqMusicTask {

    dataPath = __dirname + "/qq";

    @JobOverride("qq_song")
    @JobOverride("OnStart_QqMusicTask_index")
    @JobOverride("OnStart_QqMusicTask_song")
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
        parallel: 1,
        exeInterval: 5000
    })
    @AddToQueue([
        queue_qq,
        queue_qq_song
    ])
    async index(page: Page, job: Job): AddToQueueData {
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url());
        const hrefs = await PuppeteerUtil.links(page, ["https://y.qq.com/n/yqq/song/.*", "https://y.qq.com/.*"]);
        return {
            "qq_song": hrefs[0],
            "qq": hrefs[1]
        };
    }


    // @OnStart({
    //     urls: "https://y.qq.com/n/yqq/song/000js1DS4QfOr9.html",
    //     workerFactory: PuppeteerWorkerFactory
    // })
    @FromQueue({
        name: "qq_song",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1
    })
    @AddToQueue([
        queue_qq,
        queue_qq_song
    ])
    async song(page: Page, job: Job): AddToQueueData {
        console.log(job.key() + "    " + job.url());

        const songId = job.key();

        await PuppeteerUtil.setImgLoad(page, false);

        const songRes = PuppeteerUtil.onceResponse(page,
            "https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg\\?.*", async response => {
                const text = await response.text();
                FileUtil.write(this.dataPath + "/" + songId + "/song.json", JSON.stringify(PuppeteerUtil.jsonp(text)));
            });

        const albumRes = PuppeteerUtil.onceResponse(page,
            "https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg\\?.*", async response => {
                const text = await response.text();
                FileUtil.write(this.dataPath + "/" + songId + "/album.json", JSON.stringify(PuppeteerUtil.jsonp(text)));
            });

        const lyricRes = PuppeteerUtil.onceResponse(page,
            "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg\\?.*", async response => {
                const text = await response.text();
                FileUtil.write(this.dataPath + "/" + songId + "/lyric.json", JSON.stringify(PuppeteerUtil.jsonp(text)));
            });

        const commentRes = PuppeteerUtil.onResponse(page,
            "https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg\\?.*", async response => {
                const text = await response.text();
                const json = PuppeteerUtil.jsonp(text);
                if (json.hasOwnProperty("commenttotal")) {
                    FileUtil.write(this.dataPath + "/" + songId + "/comment_total.json", JSON.stringify(json));
                }
                else {
                    FileUtil.write(this.dataPath + "/" + songId + "/comment_0.json", JSON.stringify(json));
                }
            }, 2);

        await page.goto(job.url());
        // 等待基本信息和第一页的评论抓取完成
        await PromiseUtil.waitPromises([songRes, albumRes, lyricRes, commentRes]);

        if (await PuppeteerUtil.count(page, ".mod_page_nav.js_pager_comment") > 0) {
            // 有多页评论，等待分页控件加载完毕
            await page.waitForSelector(".mod_page_nav.js_pager_comment .current", {
                timeout: 10000
            });

            // 抓取前 N 页的评论
            let nextCommentPageNum = 2;
            while (nextCommentPageNum <= 10) {
                const selector = `a.js_pageindex[data-index='${nextCommentPageNum}']`;
                const nexPageBtnCount = await PuppeteerUtil.count(page, selector);
                if (nexPageBtnCount) {
                    const nextCommentPageRes = PuppeteerUtil.onceResponse(page,
                        "https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg\\?.*", async response => {
                            const text = await response.text();
                            const pageNum = response.url().match(".*&pagenum=(\\d+).*")[1];
                            FileUtil.write(this.dataPath + "/" + songId + "/comment_" + pageNum + ".json", JSON.stringify(PuppeteerUtil.jsonp(text)));
                        });
                    page.tap(selector);
                    await nextCommentPageRes;
                }
                else break;
                nextCommentPageNum++;
            }
        }

        const hrefs = await PuppeteerUtil.links(page, ["https://y.qq.com/n/yqq/song/.*", "https://y.qq.com/.*"]);
        return {
            "qq_song": hrefs[0],
            "qq": hrefs[1]
        };
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