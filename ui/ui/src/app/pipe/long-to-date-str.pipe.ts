import { Pipe, PipeTransform } from '@angular/core';
import {DateUtil} from "../util/DateUtil";

@Pipe({
  name: 'longToDateStr'
})
export class LongToDateStrPipe implements PipeTransform {

  transform(value: number, format?: string): string {
    return DateUtil.toStr(new Date(value), format);
  }

}
