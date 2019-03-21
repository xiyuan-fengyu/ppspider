import {
  Compiler,
  Component,
  ComponentFactory,
  ComponentRef,
  Injectable,
  Injector,
  NgModule,
  NgModuleRef,
  ViewContainerRef
} from '@angular/core';
import {SocketIOService} from "./socket-io.service";
import {Subscription} from "rxjs";
import {CommonModule} from "@angular/common";
import {BrowserModule} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {FormsModule} from "@angular/forms";

export type DataUi = {
  label: string;
  template: string;
  className: string;
  class: string;
  requestMethods: {
    [method: string]: string
  };
  debug: boolean;
}

export type DataUis = {[className: string]: DataUi}

type DataUiFactory = {
  factory: ComponentFactory<any>;
  dataUi: DataUi;
}

type ComponentAndSubscribe = {
  component: ComponentRef<any>;
  subscribe: Subscription;
}

@Injectable({
  providedIn: 'root'
})
export class DynamicService {

  private subscription: Subscription = new Subscription();

  private dataUisResolve;

  public readonly dataUis = new Promise<DataUis>(resolve => this.dataUisResolve = resolve);

  private dynamicFactories: {
    [className: string]: DataUiFactory
  } = {};

  constructor(
    private compiler: Compiler,
    private injector: Injector,
    private module: NgModuleRef<any>,
    private socketIOService: SocketIOService,
  ) {
    this.socketIOService.request({
      key: "dataUis",
      data: null
    }, res => {
      const dataUis = {};
      for (let dataUi of res) {
        dataUis[dataUi.className] = dataUi;
      }
      this.dataUisResolve(dataUis);
    });
  }

  setDataUis(dataUis: DataUis) {
    this.dataUisResolve(dataUis);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private dynamicFactory(className: string): Promise<DataUiFactory> {
    return new Promise<DataUiFactory>(resolve => {
      let dataUiFactory = this.dynamicFactories[className];
      if (dataUiFactory) {
        resolve(dataUiFactory);
      }
      else {
        this.dataUis.then(dataUis => {
          const dataUi = dataUis[className];
          const dataUiClass = eval(`(${dataUi.class})\n//# sourceURL=data-ui:///${dataUi.className}.js`);
          const dynamicComponent = Component({template: dataUi.template})(dataUiClass);
          const dynamicModule = NgModule({
            declarations: [dynamicComponent],
            imports: [CommonModule, BrowserModule, BrowserAnimationsModule, FormsModule]
          })(class {});
          this.compiler.compileModuleAndAllComponentsAsync(dynamicModule).then(factories => {
            this.dynamicFactories[className] = dataUiFactory = {
              factory: factories.componentFactories[0],
              dataUi: dataUi
            };
            resolve(dataUiFactory);
          });
        });
      }
    });
  }

  createDynamicComponent(dynamic: ViewContainerRef, className: string) {
    this.dynamicFactory(className).then(dataUiFactory => {
      const dataUi = dataUiFactory.dataUi;
      const cmpRef = dataUiFactory.factory.create(this.injector, [], null, this.module);

      // requestMethods 方法增强，用于向后台请求数据
      const requestMethods = dataUi.requestMethods;
      if (requestMethods) {
        for (let key of Object.keys(requestMethods)) {
          const requestKey = dataUi.className + "." + key;
          const oldMethod = cmpRef.instance[key];
          if (typeof oldMethod === "function") {
            cmpRef.instance[key] = (...args) => new Promise<any>(resolve => {
              this.socketIOService.request({
                key: requestKey,
                data: args
              }, res => resolve(res));
            });
          }
        }
      }

      // 设置数据推送监听
      const subscribe = this.socketIOService.pushObserver(className).subscribe(data => {
        cmpRef.instance[data.method](...data.args);
      });

      this.clearDynamicCache(dynamic);
      dynamic["_cache"] = {
        component: cmpRef,
        subscribe: subscribe
      };
      dynamic.insert(cmpRef.hostView);
    });
  }

  // noinspection JSMethodCanBeStatic
  clearDynamicCache(dynamic: ViewContainerRef) {
    let cache = dynamic["_cache"] as ComponentAndSubscribe;
    if (cache) {
      cache.component.destroy();
      cache.subscribe.unsubscribe();
    }
    dynamic.clear();
  }

}
