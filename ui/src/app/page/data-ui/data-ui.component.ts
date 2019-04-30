import {Component, OnDestroy, OnInit, ViewChild, ViewContainerRef} from '@angular/core';
import {ActivatedRoute, ActivatedRouteSnapshot} from "@angular/router";
import {DynamicService} from "../../service/dynamic.service";
import {ShouldKeepThisOnNav} from "../../CacheRouteReuseStrategy";

@Component({
  selector: 'app-data-ui',
  templateUrl: './data-ui.component.html',
  styleUrls: ['./data-ui.component.css']
})
export class DataUiComponent implements OnInit, OnDestroy, ShouldKeepThisOnNav {

  @ViewChild('dynamic', {read: ViewContainerRef}) dynamic: ViewContainerRef;

  constructor(
    private route: ActivatedRoute,
    private dynamicService: DynamicService,
  ) {

  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const className = params.get("className");
      this.dynamicService.createDynamicComponent(this.dynamic, className);
    });
  }

  ngOnDestroy() {
    this.dynamicService.clearDynamicCache(this.dynamic);
  }

  shouldKeepThisOnNav(route: ActivatedRouteSnapshot) {
  }

}
