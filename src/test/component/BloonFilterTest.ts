import {BloonFilter} from "../../spider/filter/BloonFilter";
import {DefaultJob} from "../../spider/job/DefaultJob";

let urls = [ 'https://www.baidu.com/',
    'https://www.baidu.com/',
    'https://passport.baidu.com/v2/?login&tpl=mn&u=http%3A%2F%2Fwww.baidu.com%2F&sms=5',
    'http://news.baidu.com/',
    'http://www.hao123.com/',
    'http://map.baidu.com/',
    'http://v.baidu.com/',
    'http://tieba.baidu.com/',
    'http://xueshu.baidu.com/',
    'https://passport.baidu.com/v2/?login&tpl=mn&u=http%3A%2F%2Fwww.baidu.com%2F&sms=5',
    'http://www.baidu.com/gaoji/preferences.html',
    'http://www.baidu.com/more/',
    'http://news.baidu.com/ns?cl=2&rn=20&tn=news&word=',
    'http://tieba.baidu.com/f?kw=&fr=wwwt',
    'http://zhidao.baidu.com/q?ct=17&pn=0&tn=ikaslist&rn=10&word=&fr=wwwt',
    'http://music.baidu.com/search?fr=ps&ie=utf-8&key=',
    'http://image.baidu.com/search/index?tn=baiduimage&ps=1&ct=201326592&lm=-1&cl=2&nc=1&ie=utf-8&word=',
    'http://v.baidu.com/v?ct=301989888&rn=20&pn=0&db=0&s=25&ie=utf-8&word=',
    'http://map.baidu.com/m?word=&fr=ps01000',
    'http://wenku.baidu.com/search?word=&lm=0&od=0&ie=utf-8',
    'https://www.baidu.com/more/',
    'https://www.baidu.com/cache/sethelp/help.html',
    'http://home.baidu.com/',
    'http://ir.baidu.com/',
    'http://e.baidu.com/?refer=888',
    'http://www.baidu.com/duty/',
    'http://jianyi.baidu.com/',
    'http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=11000002000001' ];

// const urlMap: any = {};
// for (let url of urls) {
//     urlMap[url] = true;
// }
// urls = Object.keys(urlMap);

const bloonFilter = new BloonFilter();
for (let url of urls) {
    const job = new DefaultJob(url);
    if (bloonFilter.isExisted(job)) {
        console.log("existed: " + url);
    }
    else {
        bloonFilter.setExisted(job);
        console.log("add: " + url);
    }
}
