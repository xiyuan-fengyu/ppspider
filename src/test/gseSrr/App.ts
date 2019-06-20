import {
    AddToQueue,
    appInfo,
    DataUi,
    DataUiRequest,
    DbHelperUi,
    FileUtil,
    FromQueue,
    Job,
    Launcher,
    OnStart, Page,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "../..";

type GSM = {
    id: string,
    group_list: string,
    srx?: string,
    srrs?: string[]
}

const gsmLines = (() => {
    return `
id	title	cell_type	group_list
GSM1947168	sample 6 - astrocyte - lps	astrocyte	lps
GSM1947178	sample 16 - astrocyte - lps	astrocyte	lps
GSM1947182	sample 20 - astrocyte - lps	astrocyte	lps
GSM1947190	sample 28 - astrocyte - lps	astrocyte	lps
GSM1947167	sample 5 - astrocyte - vehicle	astrocyte	vehicle
GSM1947173	sample 11 - astrocyte - vehicle	astrocyte	vehicle
GSM1947174	sample 12 - astrocyte - vehicle	astrocyte	vehicle
GSM1947177	sample 15 - astrocyte - vehicle	astrocyte	vehicle
GSM1947162	sample 1 - microglia - lps	microglia	lps
GSM1947169	sample 7 - microglia - lps	microglia	lps
GSM1947179	sample 17 - microglia - lps	microglia	lps
GSM1947181	sample 19 - microglia - lps	microglia	lps
GSM1947186	sample 24 - microglia - lps	microglia	lps
GSM1947165	sample 3 - microglia - vehicle	microglia	vehicle
GSM1947166	sample 4 - microglia - vehicle	microglia	vehicle
GSM1947172	sample 10 - microglia - vehicle	microglia	vehicle
GSM1947176	sample 14 - microglia - vehicle	microglia	vehicle
GSM1947185	sample 23 - microglia - vehicle	microglia	vehicle
    `
})();

const gsmMap: {[gsmId: string]: GSM} = {};
{
    const lines = gsmLines.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    const keys = lines[0].split("\t");
    for (let i = 1, len = lines.length; i < len; i++) {
        const gsm: any = {};
        const values = lines[i].split("\t");
        keys.forEach((key, index) => {
           gsm[key] = values[index];
        });
        gsmMap[gsm.id] = gsm;
    }
}

/*
https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSM2939057
https://trace.ncbi.nlm.nih.gov/Traces/sra/?run=SRR6501889

ascp -v -i ~/.aspera/connect/etc/asperaweb_id_dsa.openssh -k 1 -T -l200m anonftp@ftp-trace.ncbi.nlm.nih.gov:/sra/sra-instant/reads/ByRun/sra/SRR/SRR650/SRR6501889/SRR6501889.sra ./
 */

@DataUi({
    label: "导出gsm数据",
    template: `
    <div class="container" style="margin-top: 12px">
        <button (click)="doExportGsm()" class="btn btn-primary">导出gsm数据</button>
    </div>
    `
})
class GsmUi {

    exportGsm() {
        return null;
    }

    doExportGsm() {
        this.exportGsm().then(res => {
            alert("数据已经导出到目录：" + res);
        });
    }

}


export class GeoTask {

    gsmMap: {[gsmId: string]: GSM};

    @OnStart({
        urls: "",
        description: "创建任务"
    })
    @AddToQueue({
        name: "GSM"
    })
    async start() {
        if (this.gsmMap == null) {
            this.gsmMap = gsmMap;
            const res = [];
            for (let key of Object.keys(gsmMap)) {
                const gsm = gsmMap[key];
                const subJob  = new Job("https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=" + gsm.id);
                subJob.datas = {
                    id: gsm.id
                };
                res.push(subJob);
            }
            return res;
        }
    }

    @FromQueue({
        name: "GSM",
        description: "提取SRX编号"
    })
    @AddToQueue({
        name: "SRX"
    })
    async gsmPage(page: Page, job: Job) {
        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);
        const srx = await page.evaluate(() => {
            let res = null;
            $("tr").each((index, ele) => {
                const tds = $(ele).find("> td");
                if (tds.length == 2) {
                    const text0 = $(tds[0]).text().trim();
                    const text1 = $(tds[1]).text().trim();
                    if (text0 == "SRA" && text1.match("^SRX\\d+$")) {
                        res = text1;
                        return;
                    }
                }
            });
            return res;
        });

        const gsmId = job.datas.id;
        this.gsmMap[gsmId].srx = srx;
        const subJob  = new Job("https://www.ncbi.nlm.nih.gov/sra/" + srx);
        subJob.datas = job.datas;
        return subJob;
    }

    @FromQueue({
        name: "SRX",
        description: "提取srr编号"
    })
    async srxPage(page: Page, job: Job) {
        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);
        // noinspection UnnecessaryLocalVariableJS
        const srrs = await page.evaluate(() => {
            const $ = jQuery;
            let res = [];
            $("tbody tr > td > a").each((index, ele) => {
                const text = $(ele).text().trim();
                if (text.match("^SRR\\d+$")) {
                    res.push(text);
                }
            });
            return res;
        });
        const gsmId = job.datas.id;
        this.gsmMap[gsmId].srrs = srrs;
    }

    @DataUiRequest(GsmUi.prototype.exportGsm)
    exportGsm() {
        let gsmsStr = "";
        let srrsStr = "";
        for (let key of Object.keys(this.gsmMap)) {
            const gsm = this.gsmMap[key];
            const keys = Object.keys(gsm);
            if (!gsmsStr) {
                for (let key of keys) {
                    gsmsStr += key  + "\t";
                }
            }

            gsmsStr += "\n";
            for (let key of keys) {
                const value = gsm[key];
                gsmsStr +=  (value instanceof Array ? value.join(",") : value) + "\t";
            }
            if (gsm.srrs) {
                srrsStr += gsm.srrs.join("\n") + "\n";
            }
        }
        FileUtil.write(appInfo.workplace + "/export/gsms.txt", gsmsStr);
        FileUtil.write(appInfo.workplace + "/export/srrs.txt", srrsStr);
        return appInfo.workplace + "/export";
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        GeoTask
    ],
    dataUis: [
        DbHelperUi,
        GsmUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ],
    logger: {
        level: "debug"
    },
    webUiPort: 9000
})
export class App {}
