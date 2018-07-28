import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import {QueueInfoComponent} from "./queue-info.component";

describe('TaskInfoComponent', () => {
  let component: QueueInfoComponent;
  let fixture: ComponentFixture<QueueInfoComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ QueueInfoComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(QueueInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
