import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DialogComponent } from './dialog.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [DialogComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() variant: 'primary' | 'danger' = 'primary';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
