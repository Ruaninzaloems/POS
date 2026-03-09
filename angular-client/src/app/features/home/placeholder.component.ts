import { Component, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  template: `
    <div class="empty-state" style="min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <h2 style="font-size:1.25rem;font-weight:600;color:var(--pos-text)" data-testid="text-placeholder-title">{{ pageTitle }}</h2>
      <p style="margin-top:0.5rem;color:var(--pos-text-muted);font-size:0.875rem" data-testid="text-placeholder-desc">{{ pageDescription }}</p>
    </div>
  `
})
export class PlaceholderComponent {
  pageTitle = 'Coming Soon';
  pageDescription = 'This feature is under development';

  constructor(private route: ActivatedRoute) {
    const data = this.route.snapshot.data;
    if (data['title']) this.pageTitle = data['title'];
    if (data['description']) this.pageDescription = data['description'];
  }
}
