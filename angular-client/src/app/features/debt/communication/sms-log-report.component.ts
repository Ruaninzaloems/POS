import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-sms-log-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sms-log-report.component.html',
  styleUrl: './sms-log-report.component.css'
})
export class SmsLogReportComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  logs = signal<any[]>([]);
  searched = signal(false);

  accountNo = signal('');
  dateFrom = signal('');
  dateTo = signal('');
  statusFilter = signal('__all__');

  gridPage = signal(1);
  gridPageSize = 15;

  filteredLogs = computed(() => {
    const all = this.logs();
    const status = this.statusFilter();
    if (status === '__all__') return all;
    return all.filter(l => (l.status || l.deliveryStatus || '') === status);
  });

  paginatedLogs = computed(() => {
    const filtered = this.filteredLogs();
    const start = (this.gridPage() - 1) * this.gridPageSize;
    return filtered.slice(start, start + this.gridPageSize);
  });

  totalGridPages = computed(() => Math.ceil(this.filteredLogs().length / this.gridPageSize));

  ngOnInit(): void {}

  async handleSearch(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.searched.set(true);
    this.gridPage.set(1);
    try {
      const params: Record<string, string> = {};
      if (this.accountNo().trim()) params['accountNo'] = this.accountNo().trim();
      if (this.dateFrom()) params['dateFrom'] = this.dateFrom();
      if (this.dateTo()) params['dateTo'] = this.dateTo();
      const data = await firstValueFrom(this.api.get<any>('/api/platinum/billing-debt/sms-log-report', params));
      this.logs.set(Array.isArray(data) ? data : data?.logs || data?.data || []);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to load SMS log data');
      this.logs.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  handleClear(): void {
    this.accountNo.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.statusFilter.set('__all__');
    this.logs.set([]);
    this.searched.set(false);
    this.error.set('');
    this.gridPage.set(1);
  }

  onStatusChange(): void {
    this.gridPage.set(1);
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    } catch { return String(d); }
  }

  getStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'delivered' || s === 'sent') return 'status-success';
    if (s === 'failed' || s === 'error') return 'status-error';
    if (s === 'pending' || s === 'queued') return 'status-pending';
    return 'status-default';
  }

  prevPage(): void {
    this.gridPage.update(p => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.gridPage.update(p => Math.min(this.totalGridPages(), p + 1));
  }

  goHome(): void { this.router.navigate(['/']); }
}
