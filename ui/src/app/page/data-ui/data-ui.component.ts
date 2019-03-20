import {
  AfterViewInit,
  Compiler,
  Component,
  Injector,
  NgModule,
  NgModuleRef,
  OnDestroy,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {CommonService} from "../../service/common.service";
import {SocketIOService} from "../../service/socket-io.service";
import {Subscription} from "rxjs";
import {CommonModule} from "@angular/common";
import {BrowserModule} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-data-ui',
  templateUrl: './data-ui.component.html',
  styleUrls: ['./data-ui.component.css']
})
export class DataUiComponent implements AfterViewInit, OnDestroy {

  @ViewChild('dynamic', {read: ViewContainerRef}) dynamic: ViewContainerRef;

  private subscription: Subscription = new Subscription();

  private classInstances: any = {};

  constructor(
    private compiler: Compiler,
    private injector: Injector,
    private module: NgModuleRef<any>,
    private route: ActivatedRoute,
    private commonService: CommonService,
    private socketIOService: SocketIOService,
  ) {

  }

  ngAfterViewInit() {
    this.route.paramMap.subscribe(params => {
      const className = params.get("className");
      this.commonService.dataUis.then(dataUis => {
        const dataUi = dataUis[className];
        const dataUiClass = eval(`(${dataUi.class})`);
        const dynamicComponent = Component({template: dataUi.template})(dataUiClass);
        const dynamicModule = NgModule({
          declarations: [dynamicComponent],
          imports: [CommonModule, BrowserModule, BrowserAnimationsModule, FormsModule]
        })(class {});
        this.compiler.compileModuleAndAllComponentsAsync(dynamicModule)
          .then(factories => {
            const factory = factories.componentFactories[0];
            const cmpRef = factory.create(this.injector, [], null, this.module);

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
            this.setPushListener(dataUi.className, cmpRef.instance);

            this.dynamic.clear();
            this.dynamic.insert(cmpRef.hostView);
          });
      });
    });
  }

  private setPushListener(className: string, instance: any) {
    if (!this.classInstances[className]) {
      this.subscription.add(this.socketIOService.pushObserver(className).subscribe(data => {
        const instance = this.classInstances[className];
        instance[data.method](...data.args);
      }));
    }
    this.classInstances[className] = instance;
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

}
