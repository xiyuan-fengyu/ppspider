import { Pipe, PipeTransform } from '@angular/core';
import {DateUtil} from "../util/DateUtil";

@Pipe({
  name: 'longToDateStr'
})
export class LongToDateStrPipe implements PipeTransform {

  transform(value: number, format?: string): string {
    if (value == null) return "";
    return DateUtil.toStr(new Date(value), format);
  }

}
