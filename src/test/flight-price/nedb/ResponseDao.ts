import {NedbDao, NedbModel} from "../../..";

export class ResponseModel extends NedbModel {

    jobId: string;

    data: any;

    constructor(jobId: string, data: any) {
        super();
        this.jobId = jobId;
        this.data = data;
    }

}

export class ResponseDao extends NedbDao<ResponseModel> {

}
