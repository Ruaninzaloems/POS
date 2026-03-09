import { Component, Input, Output, EventEmitter, TemplateRef, ContentChild } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css'
})
export class DataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No data available';
  @Input() sortColumn = '';
  @Input() sortDirection: 'asc' | 'desc' = 'asc';
  @Output() sortChange = new EventEmitter<{ column: string; direction: 'asc' | 'desc' }>();
  @Output() rowClick = new EventEmitter<any>();

  @ContentChild('rowTemplate') rowTemplate!: TemplateRef<any>;

  onSort(column: TableColumn): void {
    if (!column.sortable) return;
    const direction = this.sortColumn === column.key && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortColumn = column.key;
    this.sortDirection = direction;
    this.sortChange.emit({ column: column.key, direction });
  }

  getSortIcon(column: TableColumn): string {
    if (!column.sortable) return '';
    if (this.sortColumn !== column.key) return '↕';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }
}
