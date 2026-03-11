import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency, formatDate, getFinancialYearList, getFinancialYear } from '../../../services/format.service';
import { PAGE_SIZE } from '../../../services/debt-config';
import { Attorney } from '../../../models/debt.models';

@Component({
  selector: 'app-handover-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './handover-report.component.html',
  styleUrls: ['./handover-report.component.css']
})
export class HandoverReportComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(false);
  loadingRef = signal(true);
  hasSearched = signal(false);

  finYear = signal(getFinancialYear());
  finMonth = signal('__all__');
  billingCycle = signal('__all__');
  selectedAttorneyId = signal('__all__');
  accountNo = signal('');

  finYears = getFinancialYearList(5);
  billingMonths = [
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  ];

  attorneys = signal<Attorney[]>([]);
  billingCycles = signal<{ id: string; name: string }[]>([]);
  results = signal<any[]>([]);
  currentPage = signal(1);

  formatCurrency = formatCurrency;
  formatDate = formatDate;

  resultColumns = computed(() =>
    this.results().length > 0 ? Object.keys(this.results()[0]) : []
  );

  paginatedResults = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.results().slice(start, start + PAGE_SIZE);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.results().length / PAGE_SIZE))
  );

  ngOnInit(): void {
    this.loadRefData();
  }

  async loadRefData(): Promise<void> {
    this.loadingRef.set(true);
    try {
      const [attResult, bcResult] = await Promise.allSettled([
        firstValueFrom(this.api.get<Attorney[]>('/api/platinum/billing-debt/attorney-list')),
        firstValueFrom(this.api.get<any[]>('/api/platinum/billing-debt/billing-cycles')),
      ]);
      if (attResult.status === 'fulfilled') this.attorneys.set(Array.isArray(attResult.value) ? attResult.value : []);
      if (bcResult.status === 'fulfilled') this.billingCycles.set(Array.isArray(bcResult.value) ? bcResult.value : []);
      const failCount = [attResult, bcResult].filter(r => r.status === 'rejected').length;
      if (failCount > 0) this.toast.error(`${failCount} reference data source(s) unavailable.`);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load reference data.');
    } finally {
      this.loadingRef.set(false);
    }
  }

  async handleSubmit(): Promise<void> {
    this.loading.set(true);
    this.hasSearched.set(true);
    this.currentPage.set(1);
    try {
      const params: any = { finYear: this.finYear() };
      if (this.finMonth() !== '__all__') params.finMonth = this.finMonth();
      if (this.billingCycle() !== '__all__') params.billingCycle = this.billingCycle();
      if (this.selectedAttorneyId() !== '__all__') params.attorneyId = parseInt(this.selectedAttorneyId(), 10);
      if (this.accountNo().trim()) params.accountNo = this.accountNo().trim();
      const data = await firstValueFrom(this.api.get<any>('/api/platinum/billing-debt/handover-report', params));
      const arr = Array.isArray(data) ? data : (data?.value && Array.isArray(data.value) ? data.value : data?.items && Array.isArray(data.items) ? data.items : []);
      this.results.set(arr);
      if (arr.length === 0) this.toast.info('No handover records found for the selected criteria.');
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to fetch handover report.');
      this.results.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  handleClear(): void {
    this.finYear.set(getFinancialYear());
    this.finMonth.set('__all__');
    this.billingCycle.set('__all__');
    this.selectedAttorneyId.set('__all__');
    this.accountNo.set('');
    this.results.set([]);
    this.hasSearched.set(false);
    this.currentPage.set(1);
  }

  formatColumnHeader(col: string): string {
    return col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  isStatusColumn(col: string): boolean {
    return col.toLowerCase().includes('status');
  }

  isAmountColumn(col: string): boolean {
    return col.toLowerCase().includes('amount') || col.toLowerCase().includes('balance');
  }

  formatCellValue(row: any, col: string): string {
    const val = row[col];
    if (this.isAmountColumn(col) && typeof val === 'number') return `R ${val.toFixed(2)}`;
    return val ?? '—';
  }

  getStatusClass(status: string): string {
    if (!status) return 'badge-outline';
    const s = status.toLowerCase();
    if (s.includes('active')) return 'badge-success';
    if (s.includes('terminated') || s.includes('closed')) return 'badge-danger';
    if (s.includes('pending')) return 'badge-warning';
    return 'badge-outline';
  }

  prevPage(): void { this.currentPage.update(p => Math.max(1, p - 1)); }
  nextPage(): void { this.currentPage.update(p => Math.min(this.totalPages(), p + 1)); }

  goBack(): void { this.router.navigate(['/']); }
}
