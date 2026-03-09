import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span class="badge" [class]="'badge badge-' + variant" [attr.data-testid]="'badge-' + variant"><ng-content /></span>`,
  styles: [`:host { display: inline-flex; }`]
})
export class BadgeComponent {
  @Input() variant: 'success' | 'danger' | 'warning' | 'info' | 'default' = 'default';
}
