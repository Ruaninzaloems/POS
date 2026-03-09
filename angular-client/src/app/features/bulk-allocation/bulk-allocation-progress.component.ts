import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-bulk-allocation-progress',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-allocation-progress.component.html',
  styleUrl: './bulk-allocation-progress.component.css'
})
export class BulkAllocationProgressComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  loadingFilters = signal(true);
  hasSearched = signal(false);
  error = signal('');

  financialYears = signal<any[]>([]);
  monthList = signal<any[]>([]);
  processList = signal<any[]>([]);

  selectedYear = signal('');
  selectedProcess = signal('');
  selectedMonth = signal('');
  statusFilter = signal<string | null>(null);

  sortField = signal('');
  sortDirection = signal('desc');
  page = signal(1);
  pageSize = signal(20);

  allocationData = signal<any[]>([]);
  totalCount = signal(0);

  detailOpen = signal(false);
  detailLoading = signal(false);
  detailData = signal<any>(null);
  detailAccounts = signal<any[] | null>(null);
  selectedJob = signal<any>(null);
  retryingJobId = signal<number | null>(null);

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  statusCounts = computed(() => {
    const data = this.allocationData();
    const counts: Record<string, number> = {};
    data.forEach(j => {
      const cat = this.getStatusCategory(this.getJobStatus(j));
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  });

  filteredByStatus = computed(() => {
    const filter = this.statusFilter();
    if (!filter) return this.allocationData();
    return this.allocationData().filter(j => this.getStatusCategory(this.getJobStatus(j)) === filter);
  });

  statusCards = computed(() => {
    const counts = this.statusCounts();
    return [
      { key: 'all', label: 'Total Jobs', count: this.allocationData().length, color: 'blue' },
      { key: 'rebuilds', label: 'Performing Rebuilds', count: counts['rebuilds'] || 0, color: 'orange' },
      { key: 'recon', label: 'Completing Recon', count: counts['recon'] || 0, color: 'purple' },
      { key: 'in_progress', label: 'In Progress', count: counts['in_progress'] || 0, color: 'blue' },
      { key: 'completed', label: 'Completed', count: counts['completed'] || 0, color: 'green' },
      { key: 'pending', label: 'Pending', count: counts['pending'] || 0, color: 'yellow' },
      { key: 'failed', label: 'Failed', count: counts['failed'] || 0, color: 'red' },
      { key: 'cancelled', label: 'Cancelled', count: counts['cancelled'] || 0, color: 'gray' },
    ].filter(c => c.key === 'all' || c.count > 0);
  });

  ngOnInit(): void {
    this.loadFilterOptions();
  }

  async loadFilterOptions(): Promise<void> {
    this.loadingFilters.set(true);
    try {
      const [years, months, processes]: any[] = await Promise.all([
        firstValueFrom(this.api.get('/api/platinum/bulk-progress/get-financial-years')),
        firstValueFrom(this.api.get('/api/platinum/bulk-progress/get-month-list')),
        firstValueFrom(this.api.get('/api/platinum/bulk-progress/get-process-list')),
      ]);
      this.financialYears.set(Array.isArray(years) ? years : []);
      this.monthList.set(Array.isArray(months) ? months : []);
      this.processList.set(Array.isArray(processes) ? processes : []);
      if (Array.isArray(years) && years.length > 0) {
        const defaultYear = typeof years[0] === 'object' ? (years[0].value || years[0].id || years[0].name || String(years[0])) : String(years[0]);
        this.selectedYear.set(defaultYear);
      }
    } catch (e: any) {
      this.toast.error('Failed to load filter options');
    } finally {
      this.loadingFilters.set(false);
    }
  }

  async searchAllocations(p?: number): Promise<void> {
    const currentPage = p ?? this.page();
    this.loading.set(true);
    this.hasSearched.set(true);
    try {
      const body: any = {
        financialYear: this.selectedYear() && this.selectedYear() !== '__all__' ? this.selectedYear() : null,
        process: this.selectedProcess() && this.selectedProcess() !== '__all__' ? this.selectedProcess() : null,
        billingMonth: this.selectedMonth() && this.selectedMonth() !== '__all__' ? parseInt(this.selectedMonth(), 10) : null,
        orderby: this.sortField() || null,
        page: currentPage,
        pageSize: this.pageSize(),
        shortDirection: this.sortDirection() || null,
      };
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/bulk-progress/get-bulk-allocation-list', body)
      );
      let items: any[] = [];
      let count = 0;
      if (Array.isArray(result)) { items = result; count = result.length; }
      else if (result?.data && Array.isArray(result.data)) { items = result.data; count = result.totalCount ?? result.total ?? result.data.length; }
      else if (result?.value && Array.isArray(result.value)) { items = result.value; count = result.totalCount ?? result.value.length; }
      else if (result?.items && Array.isArray(result.items)) { items = result.items; count = result.totalCount ?? result.total ?? result.items.length; }
      this.allocationData.set(items);
      this.totalCount.set(count);
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Search failed');
      this.allocationData.set([]);
      this.totalCount.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  async viewJobDetail(job: any): Promise<void> {
    const jobId = job.directDepositJob_ID ?? job.jobId ?? job.id ?? job.bulkAllocationId;
    this.selectedJob.set(job);
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.detailData.set(null);
    this.detailAccounts.set(null);

    if (!jobId) {
      this.detailData.set(job);
      this.detailLoading.set(false);
      return;
    }

    try {
      const [dataResult, accountsResult]: any[] = await Promise.allSettled([
        firstValueFrom(this.api.get(`/api/platinum/bulk-progress/direct-deposit/${jobId}`)),
        firstValueFrom(this.api.get(`/api/platinum/bulk-progress/job-account-details/${jobId}`)),
      ]);

      const data = dataResult.status === 'fulfilled' ? dataResult.value : null;
      this.detailData.set(data || job);

      let accounts: any[] | null = null;
      if (accountsResult.status === 'fulfilled') {
        const raw = accountsResult.value;
        const items = Array.isArray(raw) ? raw : raw?.items || raw?.data || null;
        if (items && items.length > 0) accounts = items;
      }
      this.detailAccounts.set(accounts);
    } catch (e: any) {
      this.detailData.set(job);
      console.error('Failed to load job detail:', e);
    } finally {
      this.detailLoading.set(false);
    }
  }

  async handleRetryJob(job: any, event?: MouseEvent): Promise<void> {
    if (event) event.stopPropagation();
    const jobId = job.directDepositJob_ID ?? job.jobId ?? job.id;
    const userId = job.capturerID ?? job.cashierID ?? 0;
    if (!jobId) {
      this.toast.error('Cannot determine Job ID for retry');
      return;
    }
    this.retryingJobId.set(jobId);
    try {
      await firstValueFrom(
        this.api.post(`/api/platinum/direct-deposit-errors/retry/${jobId}/${userId}`, {})
      );
      this.toast.success(`Job #${jobId} has been resubmitted for processing.`);
      this.searchAllocations(this.page());
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Could not retry this job');
    } finally {
      this.retryingJobId.set(null);
    }
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedJob.set(null);
    this.detailData.set(null);
    this.detailAccounts.set(null);
  }

  getJobStatus(j: any): string {
    return (j.job_Status || j.status || j.jobStatus || '').toLowerCase();
  }

  getStatusCategory(s: string): string {
    if (s.includes('rebuild')) return 'rebuilds';
    if (s.includes('recon') || s.includes('reconcil')) return 'recon';
    if (s.includes('fail') || s.includes('error')) return 'failed';
    if (s.includes('complete') || s === 'success' || s === 'done') return 'completed';
    if (s.includes('progress') || s.includes('processing') || s.includes('running') || s.includes('busy')) return 'in_progress';
    if (s.includes('pending') || s.includes('queued') || s.includes('waiting')) return 'pending';
    if (s.includes('cancel')) return 'cancelled';
    return 'other';
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    if (!status) return 'badge-default';
    const s = status.toLowerCase();
    if (s.includes('fail') || s.includes('error')) return 'badge-danger';
    if (s.includes('complete') || s === 'success' || s === 'done') return 'badge-success';
    if (s.includes('progress') || s.includes('processing') || s.includes('running') || s.includes('busy')) return 'badge-info';
    if (s.includes('pending') || s.includes('queued') || s.includes('waiting')) return 'badge-warning';
    if (s.includes('cancel')) return 'badge-default';
    return 'badge-default';
  }

  isErrorStatus(job: any): boolean {
    const s = this.getJobStatus(job);
    return s.includes('fail') || s.includes('error');
  }

  isStuckStatus(job: any): boolean {
    const s = this.getJobStatus(job);
    return s.includes('processing') || s.includes('rebuild') || s.includes('reconcil');
  }

  isJobStale(job: any): boolean {
    if (!this.isStuckStatus(job)) return false;
    if (!job.dateCaptured) return false;
    const captured = new Date(job.dateCaptured);
    if (isNaN(captured.getTime())) return false;
    return (Date.now() - captured.getTime()) / (1000 * 60) > 30;
  }

  canRetryJob(job: any): boolean {
    return this.isErrorStatus(job) || this.isJobStale(job);
  }

  handleSort(field: string): void {
    if (this.sortField() === field) {
      this.sortDirection.update(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  toggleStatusFilter(cat: string): void {
    if (cat === 'all') {
      this.statusFilter.set(null);
    } else {
      this.statusFilter.update(prev => prev === cat ? null : cat);
    }
  }

  resetFilters(): void {
    const years = this.financialYears();
    this.selectedYear.set(years.length > 0 ? (typeof years[0] === 'object' ? (years[0].value || years[0].id || String(years[0])) : String(years[0])) : '');
    this.selectedProcess.set('');
    this.selectedMonth.set('');
    this.sortField.set('');
    this.sortDirection.set('desc');
    this.page.set(1);
    this.statusFilter.set(null);
    this.allocationData.set([]);
    this.totalCount.set(0);
    this.hasSearched.set(false);
  }

  changePage(newPage: number): void {
    this.page.set(newPage);
    this.searchAllocations(newPage);
  }

  getOptionLabel(item: any): string {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    return item?.label || item?.name || item?.description || item?.text || item?.value || String(item);
  }

  getOptionValue(item: any): string {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    return item?.value ?? item?.id ?? item?.name ?? String(item);
  }

  formatDate(val: string | null | undefined): string {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return val; }
  }

  formatNumber(val: number | null | undefined): string {
    if (val == null) return '—';
    return val.toLocaleString('en-ZA');
  }

  formatCurrency(val: number | null | undefined): string {
    if (val == null) return '—';
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  getCardColorClass(color: string): string {
    const map: Record<string, string> = {
      blue: 'status-card-blue',
      green: 'status-card-green',
      red: 'status-card-red',
      orange: 'status-card-orange',
      purple: 'status-card-purple',
      yellow: 'status-card-yellow',
      gray: 'status-card-gray',
    };
    return map[color] || 'status-card-blue';
  }

  trackByIndex(index: number): number {
    return index;
  }
}
