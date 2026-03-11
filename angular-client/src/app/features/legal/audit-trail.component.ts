import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AUDIT_ACTION_TYPES } from '../../services/debt-config';
import { isCourtReady } from '../../services/validation.service';
import { formatTimestamp } from '../../services/format.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-trail.component.html',
  styleUrl: './audit-trail.component.css'
})
export class AuditTrailComponent {
  actionType = signal('__all__');
  accountNo = signal('');
  dateFrom = signal('');
  dateTo = signal('');
  userFilter = signal('');

  results = signal<any[]>([]);
  loading = signal(false);
  searched = signal(false);
  expandedRow = signal<number | null>(null);

  gridPage = signal(1);
  gridPageSize = 10;

  actionTypes = AUDIT_ACTION_TYPES;

  paginatedResults = computed(() => {
    const all = this.results();
    const start = (this.gridPage() - 1) * this.gridPageSize;
    return all.slice(start, start + this.gridPageSize);
  });

  totalGridPages = computed(() => Math.ceil(this.results().length / this.gridPageSize));

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {}

  async handleSubmit(): Promise<void> {
    this.loading.set(true);
    this.searched.set(true);
    this.gridPage.set(1);
    this.expandedRow.set(null);
    try {
      const params: Record<string, string> = {};
      if (this.actionType() !== '__all__') params['actionType'] = this.actionType();
      if (this.accountNo().trim()) params['accountNo'] = this.accountNo().trim();
      if (this.dateFrom()) params['dateFrom'] = this.dateFrom();
      if (this.dateTo()) params['dateTo'] = this.dateTo();
      if (this.userFilter().trim()) params['userId'] = this.userFilter().trim();

      const data = await firstValueFrom(this.api.get<any>('/api/legal/compliance-log', params));
      this.results.set(Array.isArray(data) ? data : []);
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to fetch compliance logs.', 'error');
      this.results.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  handleClear(): void {
    this.actionType.set('__all__');
    this.accountNo.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.userFilter.set('');
    this.results.set([]);
    this.searched.set(false);
    this.gridPage.set(1);
    this.expandedRow.set(null);
  }

  handleCancel(): void {
    this.router.navigate(['/']);
  }

  toggleRow(globalIdx: number): void {
    this.expandedRow.set(this.expandedRow() === globalIdx ? null : globalIdx);
  }

  getGlobalIndex(idx: number): number {
    return (this.gridPage() - 1) * this.gridPageSize + idx;
  }

  isExpanded(globalIdx: number): boolean {
    return this.expandedRow() === globalIdx;
  }

  isCourtReady(row: any): boolean {
    return isCourtReady(row);
  }

  formatTs(ts: string | null | undefined): string {
    return formatTimestamp(ts);
  }

  formatJson(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  }

  truncateId(id: string | null | undefined): string {
    if (!id) return '—';
    return id.length > 8 ? id.substring(0, 8) + '...' : id;
  }

  prevPage(): void {
    this.gridPage.update(p => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.gridPage.update(p => Math.min(this.totalGridPages(), p + 1));
  }
}
