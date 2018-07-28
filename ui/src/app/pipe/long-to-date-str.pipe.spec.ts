import { LongToDateStrPipe } from './long-to-date-str.pipe';

describe('LongToDateStrPipe', () => {
  it('create an instance', () => {
    const pipe = new LongToDateStrPipe();
    expect(pipe).toBeTruthy();
  });
});
