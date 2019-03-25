import { TestBed } from '@angular/core/testing';

import { DynamicService } from './dynamic.service';

describe('DynamicService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: DynamicService = TestBed.get(DynamicService);
    expect(service).toBeTruthy();
  });
});
