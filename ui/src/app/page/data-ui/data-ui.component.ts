import {
  AfterViewInit,
  Compiler,
  Component,
  Injector,
  NgModule,
  NgModuleRef,
  OnInit,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {CommonService} from "../../service/common.service";

@Component({
  selector: 'app-data-ui',
  templateUrl: './data-ui.component.html',
  styleUrls: ['./data-ui.component.css']
})
export class DataUiComponent implements AfterViewInit {

  @ViewChild('dynamic', {read: ViewContainerRef}) dynamic: ViewContainerRef;

  constructor(
    private compiler: Compiler,
    private injector: Injector,
    private module: NgModuleRef<any>,
    private route: ActivatedRoute,
    private commonService: CommonService
  ) {

  }

  ngAfterViewInit() {
    this.route.paramMap.subscribe(params => {
      const className = params.get("className");
      this.commonService.dataUis.then(dataUis => {
        const dataUi = dataUis[className];
        const dataUiClass = eval(`(${dataUi.class})`);
        const dynamicComponent = Component({template: dataUi.template})(dataUiClass);
        const dynamicModule = NgModule({declarations: [dynamicComponent]})(class {});
        this.compiler.compileModuleAndAllComponentsAsync(dynamicModule)
          .then(factories => {
            const f = factories.componentFactories[0];
            const cmpRef = f.create(this.injector, [], null, this.module);
            // @TODO 设置数据通知和请求方法
            // cmpRef.instance.name = 'dynamic';
            this.dynamic.clear();
            this.dynamic.insert(cmpRef.hostView);
          });
      });
    });
  }

}
