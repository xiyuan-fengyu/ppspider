import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'jsonStringify'
})
export class JsonStringifyPipe implements PipeTransform {

  transform(value: any, space?: any): any {
    if (value == null || (value.constructor != Object && value.constructor != Array)) return value;
    const newArgs = [value];
    return JSON.stringify(value, null, space);
  }

}
