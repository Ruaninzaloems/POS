import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `<span class="spinner" [style.width]="size" [style.height]="size" data-testid="spinner"></span>`,
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; }`]
})
export class SpinnerComponent {
  @Input() size = '1.5rem';
}
