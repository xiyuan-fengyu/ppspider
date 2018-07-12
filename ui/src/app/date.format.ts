import {NativeDateAdapter} from "@angular/material";

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: {month: 'short', year: 'numeric', day: 'numeric'}
  },
  display: {
    dateInput: 'input',
    monthYearLabel: {year: 'numeric', month: 'short'},
    dateA11yLabel: {year: 'numeric', month: 'long', day: 'numeric'},
    monthYearA11yLabel: {year: 'numeric', month: 'long'},
  }
};

export class MyDateAdapter extends NativeDateAdapter {
  format(date: Date, displayFormat: Object): string {
    if (displayFormat == "input") {
      let day = date.getDate();
      let month = date.getMonth() + 1;
      let year = date.getFullYear();
      return year + '-' + MyDateAdapter._to2digit(month) + '-' + MyDateAdapter._to2digit(day);
    } else {
      return date.toDateString();
    }
  }

  private static _to2digit(n: number) {
    return ('00' + n).slice(-2);
  }
}
