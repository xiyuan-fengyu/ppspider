import {RouteReuseStrategy} from '@angular/router/';
import {ActivatedRouteSnapshot, DetachedRouteHandle} from '@angular/router';

export interface ShouldKeepThisOnNav {

  shouldKeepThisOnNav(route: ActivatedRouteSnapshot);

}

export class CacheRouteReuseStrategy implements RouteReuseStrategy {

  storedRouteHandles = new Map<string, DetachedRouteHandle>();

  shouldReuseRoute(before: ActivatedRouteSnapshot, curr:  ActivatedRouteSnapshot): boolean {
    if (before.routeConfig == curr.routeConfig) {
      if (before.routeConfig == null) {
        return true;
      }
      return this.getUrl(before) == this.getUrl(curr);
    }
    return false;
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const url = this.getUrl(route);
    if (this.storedRouteHandles.has(url)) {
      const _attachIt = route["_attachIt"] = (route["_attachIt"] || 0) + 1;
      if (_attachIt == 2) {
        const detachedTree = this.storedRouteHandles.get(url) as DetachedRouteHandle;
        setTimeout(() => {
          window.scrollTo(detachedTree["_scrollX"], detachedTree["_scrollY"]);
        }, 0);
        return detachedTree;
      }
    }
    return null;
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return this.storedRouteHandles.has(this.getUrl(route));
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return route.routeConfig.component != null &&
      route.routeConfig.component.prototype.hasOwnProperty("shouldKeepThisOnNav");
  }

  store(route: ActivatedRouteSnapshot, detachedTree: DetachedRouteHandle): void {
    const url = this.getUrl(route);
    if (detachedTree != null) {
      const componentRef = detachedTree["componentRef"];
      let shouldKeepThisOnNav = route.routeConfig.component.prototype["shouldKeepThisOnNav"];
      let component;
      if (componentRef
        && typeof shouldKeepThisOnNav == "function"
        && (component = componentRef.instance)
        && shouldKeepThisOnNav.call(component, route) != false) {
        detachedTree["_scrollX"] = window.scrollX;
        detachedTree["_scrollY"] = window.scrollY;
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 0);
        this.storedRouteHandles.set(url, detachedTree);
      }
      else if (component) {
        componentRef.destroy();
        if (component.constructor.prototype.hasOwnProperty("ngOnDestroy")) {
          component["ngOnDestroy"]();
        }
      }
    }
    else {
      this.storedRouteHandles.delete(url);
    }
  }

  private getUrl(route: ActivatedRouteSnapshot) {
    return route["_routerState"].url;
  }

}
