import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface AllocationRecord {
  directDepositJob_ID: number;
  paymentTypeID: number;
  fileName: string;
  fileDate: string;
  filePath: string | null;
  cashierID: number;
  capturerID: number;
  dateCaptured: string;
  paymentReference: string;
  groupID: number | null;
  job_Status: string;
  financialYear: string;
  billPeriodId: number;
  allocatedAmount: number;
  process: string;
  records: number;
  posItemID: number;
}

@Component({
  selector: 'app-allocation-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './allocation-history.component.html',
  styleUrl: './allocation-history.component.css'
})
export class AllocationHistoryComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(true);
  error = signal('');
  allocationData = signal<AllocationRecord[]>([]);
  totalCount = signal(0);

  filterQuery = signal('');
  methodFilter = signal('ALL');
  financialYear = signal('');
  billingMonth = signal('All');
  processFilter = signal('All');
  statusFilter = signal<string[]>([]);

  financialYears = signal<string[]>([]);
  monthList = signal<{ id: number; name: string }[]>([]);
  processList = signal<string[]>([]);

  page = signal(1);
  pageSize = 20;
  retrying = signal<number | null>(null);

  detailOpen = signal(false);
  selectedTx = signal<AllocationRecord | null>(null);
  detailsLoading = signal(false);
  jobAccountDetails = signal<any[] | null>(null);

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  filteredHistory = computed(() => {
    let data = this.allocationData();
    const q = this.filterQuery().toLowerCase();
    if (q) {
      data = data.filter(item =>
        (item.fileName || '').toLowerCase().includes(q) ||
        (item.paymentReference || '').toLowerCase().includes(q) ||
        (item.process || '').toLowerCase().includes(q) ||
        String(item.posItemID).includes(q) ||
        String(item.allocatedAmount).includes(q)
      );
    }
    const mf = this.methodFilter();
    if (mf === 'MANUAL') {
      data = data.filter(i => i.fileName === 'Manual Allocation' || i.fileName === 'Not applicable');
    } else if (mf === 'BULK') {
      data = data.filter(i => i.fileName !== 'Manual Allocation' && i.fileName !== 'Not applicable');
    }
    const sf = this.statusFilter();
    if (sf.length > 0) {
      data = data.filter(i => sf.includes(i.job_Status));
    }
    return data;
  });

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadData();
  }

  async loadFilterOptions(): Promise<void> {
    try {
      const [years, months, processes]: any[] = await Promise.all([
        firstValueFrom(this.api.get('/api/platinum/bulk-progress/get-financial-years')),
        firstValueFrom(this.api.get('/api/platinum/bulk-progress/get-month-list')),
        firstValueFrom(this.api.get('/api/platinum/bulk-progress/get-process-list')),
      ]);
      if (Array.isArray(years) && years.length > 0) {
        this.financialYears.set(years);
        if (!this.financialYear()) this.financialYear.set(years[0]);
      }
      if (Array.isArray(months)) this.monthList.set(months);
      if (Array.isArray(processes)) this.processList.set(processes);
    } catch (e: any) {
      console.error('Failed to load filter options:', e);
    }
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const monthId = this.billingMonth() !== 'All' ? parseInt(this.billingMonth()) : null;
      const body: any = {
        financialYear: this.financialYear(),
        process: this.processFilter() !== 'All' ? this.processFilter() : null,
        billingMonth: monthId,
        orderby: 'fileDate',
        page: this.page(),
        pageSize: this.pageSize,
        shortDirection: 'desc',
      };
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/bulk-progress/get-bulk-allocation-list', body)
      );
      const items: AllocationRecord[] = Array.isArray(result?.items || result?.data) ? (result?.items || result?.data) : [];
      this.allocationData.set(items);
      this.totalCount.set(result?.totalCount || items.length);
    } catch (e: any) {
      this.toast.error('Failed to load allocation history');
      console.error('Failed to load allocation history:', e);
    } finally {
      this.loading.set(false);
    }
  }

  async handleRetry(tx: AllocationRecord): Promise<void> {
    const userId = this.auth.user()?.user_ID;
    if (!userId) {
      this.toast.error('User session not found. Please log in again.');
      return;
    }
    this.retrying.set(tx.directDepositJob_ID);
    try {
      await firstValueFrom(
        this.api.post(`/api/platinum/direct-deposit-errors/retry/${tx.directDepositJob_ID}/${userId}`, {})
      );
      this.toast.success(`Job #${tx.directDepositJob_ID} has been resubmitted for processing.`);
      this.allocationData.update(prev => prev.map(item =>
        item.directDepositJob_ID === tx.directDepositJob_ID
          ? { ...item, job_Status: 'Resubmitted' }
          : item
      ));
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Failed to retry allocation job.');
    } finally {
      this.retrying.set(null);
    }
  }

  async openDetails(tx: AllocationRecord): Promise<void> {
    this.selectedTx.set(tx);
    this.detailOpen.set(true);
    this.jobAccountDetails.set(null);
    this.detailsLoading.set(true);
    try {
      const [jobResult, errorResult]: any[] = await Promise.allSettled([
        firstValueFrom(this.api.get(`/api/platinum/bulk-progress/job-account-details/${tx.directDepositJob_ID}`)),
        firstValueFrom(this.api.get(`/api/platinum/bulk-progress/job-account-details/${tx.directDepositJob_ID}`)),
      ]);

      let details: any[] | null = null;
      if (jobResult.status === 'fulfilled') {
        const data = jobResult.value;
        const items = Array.isArray(data) ? data : data?.items || data?.data || null;
        if (items && items.length > 0) details = items;
      }
      if (!details && errorResult.status === 'fulfilled') {
        const data = errorResult.value;
        const items = Array.isArray(data) ? data : data?.items || data?.data || null;
        if (items && items.length > 0) details = items;
      }
      this.jobAccountDetails.set(details);
    } catch (e: any) {
      console.error('Failed to load job details:', e);
    } finally {
      this.detailsLoading.set(false);
    }
  }

  closeDetails(): void {
    this.detailOpen.set(false);
    this.selectedTx.set(null);
    this.jobAccountDetails.set(null);
  }

  isErrorStatus(status: string): boolean {
    const lower = status.toLowerCase();
    return lower.includes('error') || lower.includes('fail');
  }

  isStuckStatus(status: string): boolean {
    const lower = status.toLowerCase();
    return lower.includes('processing') || lower.includes('rebuild') || lower.includes('reconcil');
  }

  canRetryJob(tx: AllocationRecord): boolean {
    if (this.isErrorStatus(tx.job_Status)) return true;
    if (this.isStuckStatus(tx.job_Status) && tx.dateCaptured) {
      const captured = new Date(tx.dateCaptured);
      if (!isNaN(captured.getTime())) {
        const ageMinutes = (Date.now() - captured.getTime()) / (1000 * 60);
        return ageMinutes > 30;
      }
    }
    return false;
  }

  isManual(item: AllocationRecord): boolean {
    return item.fileName === 'Manual Allocation' || item.fileName === 'Not applicable';
  }

  getStatusBadgeClass(status: string): string {
    const lower = status.toLowerCase();
    if (lower.includes('error') || lower.includes('fail')) return 'badge-danger';
    if (lower.includes('complete') || lower === 'completed' || lower === 'success' || lower === 'done') return 'badge-success';
    if (lower.includes('processing') || lower.includes('rebuild') || lower.includes('reconcil')) return 'badge-info';
    return 'badge-default';
  }

  getProcessBadgeClass(process: string): string {
    switch (process) {
      case 'Consumer Services': return 'badge-info';
      case 'Direct Deposits': return 'badge-info';
      case 'Clearances': return 'badge-warning';
      case 'Miscellaneous Payment': return 'badge-warning';
      case 'Third Party Payments': return 'badge-default';
      default: return 'badge-default';
    }
  }

  clearFilters(): void {
    this.filterQuery.set('');
    this.methodFilter.set('ALL');
    this.processFilter.set('All');
    this.statusFilter.set([]);
  }

  changePage(newPage: number): void {
    this.page.set(newPage);
    this.loadData();
  }

  handleDownload(): void {
    const content = 'FileDate,CapturedDate,Description,Reference,Process,Method,Amount,Status,Records\n' +
      this.filteredHistory().map(t => {
        const fd = t.fileDate ? new Date(t.fileDate).toLocaleDateString('en-GB') : '';
        const cd = t.dateCaptured ? new Date(t.dateCaptured).toLocaleDateString('en-GB') : '';
        const method = this.isManual(t) ? 'Manual' : 'Bulk';
        return `${fd},${cd},"${t.fileName}","${t.paymentReference}",${t.process},${method},${t.allocatedAmount},${t.job_Status},${t.records}`;
      }).join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'allocation_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.router.navigate(['/direct-deposits/manual']);
  }

  formatDate(val: string | null): string {
    if (!val) return '-';
    try {
      return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return val; }
  }

  formatDateTime(val: string | null): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    } catch { return val || '-'; }
  }

  formatCurrency(val: number | null | undefined): string {
    if (val == null) return '-';
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  trackByJobId(index: number, item: AllocationRecord): number {
    return item.directDepositJob_ID;
  }
}
