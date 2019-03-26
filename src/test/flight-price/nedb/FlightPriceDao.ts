import {NedbDao, NedbModel} from "../../..";

function flightTypeLevel(type: string, flightTypeMap: any) {
    for (let level of Object.keys(flightTypeMap)) {
        const types = flightTypeMap[level] as string[];
        if (types.indexOf(type) > -1) {
            return level;
        }
    }
    return "";
}

export class FlightPriceModel extends NedbModel {

    jobId: string;

    data: any;

    constructor(jobId: string, flight: any, resData: any) {
        super();
        this.jobId = jobId;
        this.data = flight;

        flight.arrCityCode = resData.arrCityCode;
        flight.arrCityName = resData.arrCityName;
        flight.depCityCode = resData.depCityCode;
        flight.depCityName = resData.depCityName;

        flight.airlineName = resData.aircodeNameMap[flight.airlineCode];
        flight.arrAirportName = resData.airportMap[flight.arrAirport];
        flight.depAirportName = resData.airportMap[flight.depAirport];
        flight.flightTypeLevel = flightTypeLevel(flight.flightType, resData.flightTypeMap);
    }
}

export class FlightPriceDao extends NedbDao<FlightPriceModel> {

    depArrDates() {
        return new Promise<[string, string[]][]>(resolve => {
            this.nedbP.then(db => {
                db.find({}, {
                    "data.depTime": 1,
                    "data.depCityName": 1,
                    "data.arrCityName": 1,
                }).exec((err, docs) => {
                    const depArrDateMap = {};
                    for (let doc of (docs as any[])) {
                        let depArr = doc.data.depCityName + " -> " + doc.data.arrCityName;
                        let dates = depArrDateMap[depArr];
                        if (!dates) {
                            depArrDateMap[depArr] = dates = {};
                        }
                        const date = ("" + doc.data.depTime).split(" ")[0];
                        dates[date] = true;
                    }

                    const depArrDateArray = [];
                    for (let depArr of Object.keys(depArrDateMap)) {
                        const dates = depArrDateMap[depArr];
                        let dateArray = Object.keys(dates);
                        dateArray.sort();
                        depArrDateArray.push([depArr, dateArray]);
                    }
                    resolve(depArrDateArray);
                });
            });
        });
    }

}
