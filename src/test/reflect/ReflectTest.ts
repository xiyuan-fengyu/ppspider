import {Job} from "../..";
import {Page as PuppeteerPage} from "puppeteer";
import "reflect-metadata";

function methodDecorator(): MethodDecorator {
    return (target, key, descriptor) => {
        const providers = Reflect.getMetadata('design:paramtypes', target, key);
        console.log(providers[0]);
    };
}

interface Page extends PuppeteerPage {}
abstract class Page implements PuppeteerPage {}

class Test {

    @methodDecorator()
    async test1(page: PuppeteerPage, job: Job) {
        // const job1 = new Job(1);
        console.log(page.constructor.name);
        console.log(job.constructor.name);
    }

    @methodDecorator()
    async test2(page: Page, job: Job) {
        // const job1 = new Job(1);
        console.log(page.constructor.name);
        console.log(job.constructor.name);
    }

}
