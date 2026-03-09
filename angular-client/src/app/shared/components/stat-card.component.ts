import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.css'
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() icon = '';
  @Input() trend = '';
  @Input() trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
}
