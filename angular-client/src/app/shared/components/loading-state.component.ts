import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SpinnerComponent } from './spinner.component';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [SpinnerComponent],
  templateUrl: './loading-state.component.html',
  styleUrl: './loading-state.component.css'
})
export class LoadingStateComponent {
  @Input() loading = false;
  @Input() error = '';
  @Input() loadingText = 'Loading...';
  @Output() retry = new EventEmitter<void>();
}
