import {AfterViewInit, Component, OnDestroy, ViewChild, ViewContainerRef} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {DynamicService} from "../../service/dynamic.service";

@Component({
  selector: 'app-data-ui',
  templateUrl: './data-ui.component.html',
  styleUrls: ['./data-ui.component.css']
})
export class DataUiComponent implements AfterViewInit, OnDestroy {

  @ViewChild('dynamic', {read: ViewContainerRef}) dynamic: ViewContainerRef;

  constructor(
    private route: ActivatedRoute,
    private dynamicService: DynamicService,
  ) {

  }

  ngAfterViewInit() {
    this.route.paramMap.subscribe(params => {
      const className = params.get("className");
      this.dynamicService.createDynamicComponent(this.dynamic, className);
    });
  }

  ngOnDestroy() {
    this.dynamicService.clearDynamicCache(this.dynamic);
  }

}
