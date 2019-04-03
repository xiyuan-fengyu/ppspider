import {
    AddToQueue, appInfo, DataUi, DataUiRequest,
    DefaultJob, FileUtil, FromQueue,
    Job,
    Launcher,
    NedbHelperUi,
    NoneWorkerFactory,
    OnStart, PuppeteerUtil,
    PuppeteerWorkerFactory
} from "../..";
import {Page} from "puppeteer";

type GSM = {
    gsmId: string,
    libId: string,
    group: string,
    srx?: string,
    srrs?: string[]
}

const gsmLines = (() => {
    return `
GSM2939057
5539
LPS_hi
GSM2939058
5540
LPS_hi
GSM2939059
5541
LPS_hi
GSM2939112
5952
LPS_hi
GSM2939113
5953
LPS_hi
GSM2939114
5954
LPS_hi
GSM2939209
6153
LPS_hi
GSM2939210
6154
LPS_hi
GSM2939211
6155
LPS_hi
GSM2939252
6229
LPS_hi
GSM2939301
6284
LPS_hi
GSM2939374
6535
LPS_hi
GSM2939375
6536
LPS_hi
GSM2939395
6558
LPS_hi
GSM2939396
6559
LPS_hi
GSM2939397
6561
LPS_hi
GSM2939431
6753
LPS_hi
GSM2939432
6754
LPS_hi
GSM2939446
6769
LPS_hi
GSM2939560
6902
LPS_hi
GSM2939585
6928
LPS_hi
GSM2939586
6929
LPS_hi
GSM2939603
6948
LPS_hi
GSM2939648
7000
LPS_hi
GSM2939649
7001
LPS_hi
GSM2939650
7002
LPS_hi
GSM2939651
7003
LPS_hi
GSM2939682
7048
LPS_hi
GSM2939683
7049
LPS_hi
GSM2939700
7069
LPS_hi
GSM2939714
7119
LPS_hi
GSM2939715
7138
LPS_hi
GSM2939783
7576
LPS_hi
GSM2939784
7577
LPS_hi
GSM2939785
7578
LPS_hi
GSM2939811
7619
LPS_hi
GSM2939821
7636
LPS_hi
GSM2939822
7637
LPS_hi
GSM2939823
7638
LPS_hi
GSM2939060
5542
None
GSM2939061
5543
None
GSM2939062
5544
None
GSM2939103
5943
None
GSM2939104
5944
None
GSM2939105
5945
None
GSM2939214
6159
None
GSM2939215
6160
None
GSM2939216
6161
None
GSM2939253
6230
None
GSM2939254
6231
None
GSM2939255
6232
None
GSM2939256
6233
None
GSM2939257
6234
None
GSM2939296
6279
None
GSM2939297
6280
None
GSM2939298
6281
None
GSM2939299
6282
None
GSM2939300
6283
None
GSM2939327
6424
None
GSM2939328
6425
None
GSM2939329
6426
None
GSM2939330
6427
None
GSM2939331
6428
None
GSM2939332
6429
None
GSM2939376
6537
None
GSM2939377
6538
None
GSM2939378
6539
None
GSM2939379
6540
None
GSM2939427
6749
None
GSM2939428
6750
None
GSM2939429
6751
None
GSM2939430
6752
None
GSM2939445
6768
None
GSM2939517
6850
None
GSM2939518
6851
None
GSM2939519
6852
None
GSM2939520
6853
None
GSM2939521
6854
None
GSM2939539
6876
None
GSM2939540
6877
None
GSM2939558
6899
None
GSM2939559
6900
None
GSM2939587
6930
None
GSM2939588
6931
None
GSM2939589
6932
None
GSM2939590
6933
None
GSM2939604
6949
None
GSM2939605
6950
None
GSM2939606
6951
None
GSM2939678
7044
None
GSM2939679
7045
None
GSM2939680
7046
None
GSM2939681
7047
None
GSM2939701
7070
None
GSM2939702
7071
None
GSM2939703
7072
None
GSM2939711
7115
None
GSM2939712
7116
None
GSM2939713
7117
None
GSM2939780
7573
None
GSM2939781
7574
None
GSM2939782
7575
None
GSM2939812
7620
None
GSM2939813
7621
None
GSM2939096
5578
resveratrol
GSM2939097
5579
resveratrol
GSM2939134
5976
resveratrol
GSM2939135
5977
resveratrol
GSM2939136
5978
resveratrol
GSM2939325
6422
resveratrol
GSM2939326
6423
resveratrol
GSM2939581
6924
resveratrol
GSM2939582
6925
resveratrol
GSM2939583
6926
resveratrol
GSM2939584
6927
resveratrol
GSM2939174
6018
CCL2
GSM2939175
6019
CCL2
GSM2939176
6020
CCL2
GSM2939324
6420
CCL2
GSM2939400
6564
CCL2
GSM2939401
6565
CCL2
GSM2939402
6567
CCL2
GSM2939421
6743
CCL2
GSM2939422
6744
CCL2
GSM2939423
6745
CCL2
GSM2939424
6746
CCL2
GSM2939674
7039
CCL2
GSM2939675
7040
CCL2
GSM2939676
7041
CCL2
GSM2939677
7042
CCL2
GSM2939187
6033
ATP
GSM2939188
6034
ATP
GSM2939189
6035
ATP
GSM2939226
6171
ATP
GSM2939227
6172
ATP
GSM2939228
6173
ATP
GSM2939358
6456
ATP
GSM2939359
6457
ATP
GSM2939360
6458
ATP
GSM2939361
6459
ATP
GSM2939494
6826
ATP
GSM2939495
6827
ATP
GSM2939496
6828
ATP
GSM2939647
6999
ATP
GSM2939258
6235
LPS_lo
GSM2939259
6236
LPS_lo
GSM2939260
6237
LPS_lo
GSM2939261
6238
LPS_lo
GSM2939390
6553
LPS_lo
GSM2939391
6554
LPS_lo
GSM2939392
6555
LPS_lo
GSM2939410
6731
LPS_lo
GSM2939411
6732
LPS_lo
GSM2939412
6733
LPS_lo
GSM2939413
6734
LPS_lo
GSM2939619
6966
LPS_lo
GSM2939620
6967
LPS_lo
GSM2939621
6968
LPS_lo
GSM2939622
6969
LPS_lo
GSM2939724
7170
LPS_lo
GSM2939725
7171
LPS_lo
GSM2939726
7172
LPS_lo
GSM2939339
6436
LPS_lo+CCL2
GSM2939340
6437
LPS_lo+CCL2
GSM2939388
6550
LPS_lo+CCL2
GSM2939389
6551
LPS_lo+CCL2
GSM2939416
6737
LPS_lo+CCL2
GSM2939417
6738
LPS_lo+CCL2
GSM2939418
6739
LPS_lo+CCL2
GSM2939341
6438
LPS_lo+resveratrol
GSM2939342
6439
LPS_lo+resveratrol
GSM2939343
6440
LPS_lo+resveratrol
GSM2939344
6441
LPS_lo+resveratrol
GSM2939575
6918
LPS_lo+resveratrol
GSM2939576
6919
LPS_lo+resveratrol
GSM2939577
6920
LPS_lo+resveratrol
GSM2939578
6921
LPS_lo+resveratrol
GSM2939357
6454
LPS_hi+ATP
GSM2939403
6569
LPS_hi+ATP
GSM2939667
7029
LPS_hi+ATP
GSM2939668
7030
LPS_hi+ATP
GSM2939694
7062
LPS_hi+ATP
GSM2939695
7063
LPS_hi+ATP
    `
})();

const gsmMap: {[gsmId: string]: GSM} = {};
{
    const lines = gsmLines.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    for (let i = 0, len = lines.length; i < len;) {
        const gsm = {
            gsmId: lines[i],
            libId: lines[i + 1],
            group: lines[i + 2]
        } as GSM;
        gsmMap[gsm.gsmId] = gsm;
        i += 3;
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
        workerFactory: NoneWorkerFactory,
        description: "创建任务"
    })
    @AddToQueue({
        name: "GSM"
    })
    async start(none: any, job: Job) {
        if (this.gsmMap == null) {
            this.gsmMap = gsmMap;
            const res = [];
            for (let key of Object.keys(gsmMap)) {
                const gsm = gsmMap[key];
                const subJob  = new DefaultJob("https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=" + gsm.gsmId);
                subJob.datas({
                    gsmId: gsm.gsmId
                });
                res.push(subJob);
            }
            return res;
        }
    }

    @FromQueue({
        name: "GSM",
        workerFactory: PuppeteerWorkerFactory,
        description: "提取SRX编号"
    })
    @AddToQueue({
        name: "SRX"
    })
    async gsmPage(page: Page, job: Job) {
        await page.goto(job.url());
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

        const gsmId = job.datas().gsmId;
        this.gsmMap[gsmId].srx = srx;
        const subJob  = new DefaultJob("https://www.ncbi.nlm.nih.gov/sra/" + srx);
        subJob.datas(job.datas());
        return subJob;
    }

    @FromQueue({
        name: "SRX",
        workerFactory: PuppeteerWorkerFactory,
        description: "提取srr编号"
    })
    async srxPage(page: Page, job: Job) {
        await page.goto(job.url());
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
        const gsmId = job.datas().gsmId;
        this.gsmMap[gsmId].srrs = srrs;
    }

    @DataUiRequest(GsmUi.prototype.exportGsm)
    exportGsm() {
        let gsmsStr = "";
        let srrsStr = "";
        for (let key of Object.keys(this.gsmMap)) {
            const gsm = this.gsmMap[key];
            gsmsStr += gsm.gsmId + "\t" + gsm.libId + "\t" + gsm.group + "\t" + gsm.srx + "\t" + (gsm.srrs || []).join(",") + "\n";
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
    workplace: __dirname + "/workplace",
    tasks: [
        GeoTask
    ],
    dataUis: [
        NedbHelperUi,
        GsmUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true,
            args: [
                // "--proxy-server=127.0.0.1:2007"
            ]
        })
    ],
    logger: {
        level: "debug"
    },
    webUiPort: 9000
})
export class App {}
