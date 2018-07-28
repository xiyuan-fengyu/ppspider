import { TestBed, inject } from '@angular/core/testing';

import { SocketIOService } from './socket-io.service';

describe('SocketIOService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketIOService]
    });
  });

  it('should be created', inject([SocketIOService], (service: SocketIOService) => {
    expect(service).toBeTruthy();
  }));
});
