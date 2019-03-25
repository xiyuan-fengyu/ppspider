import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DataUiComponent } from './data-ui.component';

describe('DataUiComponent', () => {
  let component: DataUiComponent;
  let fixture: ComponentFixture<DataUiComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DataUiComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DataUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
