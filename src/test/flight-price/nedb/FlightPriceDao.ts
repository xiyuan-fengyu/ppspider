import {NedbDao, NedbModel} from "../../..";

export class FlightPriceModel extends NedbModel {

    jobId: string;

    data: any;

    constructor(jobId: string, data: any) {
        super();
        this.jobId = jobId;
        this.data = data;
    }
}

export class FlightPriceDao extends NedbDao<FlightPriceModel> {

}
