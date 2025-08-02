import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PwaIndicatorComponent } from './pwa-indicator.component';

describe('PwaIndicatorComponent', () => {
  let component: PwaIndicatorComponent;
  let fixture: ComponentFixture<PwaIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PwaIndicatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PwaIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
