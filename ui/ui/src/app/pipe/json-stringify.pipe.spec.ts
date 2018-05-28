import { JsonStringifyPipe } from './json-stringify.pipe';

describe('JsonStringifyPipe', () => {
  it('create an instance', () => {
    const pipe = new JsonStringifyPipe();
    expect(pipe).toBeTruthy();
  });
});
