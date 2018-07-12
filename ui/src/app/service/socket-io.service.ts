import {Injectable, OnDestroy} from '@angular/core';
import {environment} from "../../environments/environment";
import {Observable} from "rxjs/internal/Observable";
import * as io from 'socket.io-client';

@Injectable()
export class SocketIOService implements OnDestroy{

  private client: any = io(environment.server);

  private observers: {[pushLey: string]: Observable<any>} = {};

  private reconnectNum = 0;

  private reconnectMax = 60;

  constructor() {
    this.client.on("connect", data => {
      this.reconnectNum = 0;
    });
    this.client.on("reconnect_error", data => {
      this.reconnectNum++;
      if (this.reconnectNum >= this.reconnectMax) {
        this.client.close();
      }
    });
  }

  pushObserver(key: string): Observable<any> {
    let observer = this.observers[key];
    if (observer == null) {
      this.observers[key] = observer = new Observable(subscriber => {
        this.client.on('push_' + key, data => {
          subscriber.next(data);
        });
      });
    }
    return observer;
  }

  request(request: {
    key: string;
    data: any;
  }, callback: (response: any) => any) {
    const requestWrapper = {
      id: new Date().getTime() + "_" + (Math.random() * 1000).toFixed(0),
      key: request.key,
      data: request.data
    };
    this.client.emit("request", requestWrapper);
    this.client.once("response_" + requestWrapper.id, res => callback(res));
  }

  ngOnDestroy(): void {
    this.client.disconnect();
  }

}
