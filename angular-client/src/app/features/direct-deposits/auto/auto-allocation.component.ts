import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface UnprocessedBatch {
  num: number;
  items: any[];
  rejectedItems: any[];
  cashBookAuthoriseDate: string;
  cashBookAuthoriseDateStr: string | null;
  numberOfRecords: number;
  totalValue: number;
  billingAllocated: number;
  billingAllocatedAmount: number;
  billingUnAllocated: number;
  billingUnAllocatedAmount: number;
  rejected: number;
  rejectedAmount: number;
  maxBankReconID: number | null;
}

interface ProcessedBatch {
  num: number;
  cashBookAuthoriseDate: string;
  cashBookAuthoriseDateStr: string | null;
  numberOfRecords: number;
  totalValue: number;
  posItemIds: string | null;
  numberOfRecordsProcessed: number;
  totalProcessedAmount: number;
  numberOfRecordsRejected: number;
  totalRejectedAmount: number;
}

@Component({
  selector: 'app-auto-allocation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auto-allocation.component.html',
  styleUrl: './auto-allocation.component.css'
})
export class AutoAllocationComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  processing = signal(false);
  printing = signal(false);
  error = signal<string | null>(null);
  hasSearched = signal(false);

  fromDate = signal('');
  toDate = signal('');

  unprocessedBatches = signal<UnprocessedBatch[]>([]);
  processedBatches = signal<ProcessedBatch[]>([]);
  expandedBatchNum = signal<number | null>(null);
  expandedProcessedNum = signal<number | null>(null);
  activeView = signal<'unprocessed' | 'processed'>('unprocessed');
  processingBatchNum = signal<number | null>(null);

  totalRecords = computed(() => this.unprocessedBatches().reduce((s, b) => s + b.numberOfRecords, 0));
  totalValue = computed(() => this.unprocessedBatches().reduce((s, b) => s + b.totalValue, 0));
  totalAllocated = computed(() => this.unprocessedBatches().reduce((s, b) => s + b.billingAllocated, 0));
  totalAllocatedAmount = computed(() => this.unprocessedBatches().reduce((s, b) => s + b.billingAllocatedAmount, 0));
  totalUnallocated = computed(() => this.unprocessedBatches().reduce((s, b) => s + b.billingUnAllocated, 0));
  totalUnallocatedAmount = computed(() => this.unprocessedBatches().reduce((s, b) => s + b.billingUnAllocatedAmount, 0));
  totalRejected = computed(() => this.unprocessedBatches().reduce((s, b) => s + b.rejected, 0));
  totalRejectedAmount = computed(() => this.unprocessedBatches().reduce((s, b) => s + b.rejectedAmount, 0));

  ngOnInit(): void {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.fromDate.set(this.formatDateForInput(thirtyDaysAgo));
    this.toDate.set(this.formatDateForInput(now));
  }

  formatDateForInput(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  async fetchUnprocessed(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.hasSearched.set(true);
    this.expandedBatchNum.set(null);
    try {
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/direct-deposit-bulk/get-unprocessed', {
          fromDate: new Date(this.fromDate()).toISOString(),
          toDate: new Date(this.toDate()).toISOString(),
        })
      );
      const batches = Array.isArray(result) ? result :
        result?.items || result?.unProcessedBatches || result?.batches || result?.value || result?.results || [];
      this.unprocessedBatches.set(batches);
      if (batches.length === 0) {
        this.toast.info('No unprocessed deposits found. Try adjusting the date range.');
      }
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Failed to fetch unprocessed deposits';
      this.error.set(msg);
      this.toast.error(msg);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchProcessed(): Promise<void> {
    if (this.unprocessedBatches().length === 0) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/direct-deposit-bulk/get-processed', {
          unProcessedBatches: this.unprocessedBatches(),
          processedBatches: this.processedBatches(),
        })
      );
      const batches = Array.isArray(result) ? result :
        result?.items || result?.processedBatches || result?.value || result?.results || [];
      this.processedBatches.set(batches);
      this.activeView.set('processed');
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Error fetching processed data');
    } finally {
      this.loading.set(false);
    }
  }

  async reconcileBatch(batch: UnprocessedBatch): Promise<void> {
    const userId = this.auth.user()?.user_ID;
    if (!userId) {
      this.toast.error('Valid user ID not available. Please log in again.');
      return;
    }
    this.processing.set(true);
    this.processingBatchNum.set(batch.num);
    this.error.set(null);
    const beforeUnallocated = batch.billingUnAllocated;
    try {
      let currentProcessed = this.processedBatches();
      if (currentProcessed.length === 0) {
        const processedData: any = await firstValueFrom(
          this.api.post('/api/platinum/direct-deposit-bulk/get-processed', {
            unProcessedBatches: this.unprocessedBatches(),
            processedBatches: [],
          })
        );
        const fetched = Array.isArray(processedData) ? processedData :
          processedData?.items || processedData?.processedBatches || processedData?.value || [];
        currentProcessed = fetched;
        this.processedBatches.set(fetched);
      }

      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/direct-deposit-bulk/reconcile', {
          userId: userId,
          selectedItem: batch,
          unProcessedBatches: this.unprocessedBatches(),
          processedBatches: currentProcessed,
        })
      );

      if (result?._error || result?.isSuccess === false) {
        this.toast.error(result?.detail || result?.message || 'API returned an error');
        return;
      }

      const updatedUnprocessed = result?.unProcessedBatches || result?.items || [];
      const updatedProcessed = result?.processedBatches || [];
      if (updatedUnprocessed.length > 0) this.unprocessedBatches.set(updatedUnprocessed);
      if (updatedProcessed.length > 0) this.processedBatches.set(updatedProcessed);

      const refreshData: any = await firstValueFrom(
        this.api.post('/api/platinum/direct-deposit-bulk/get-unprocessed', {
          fromDate: new Date(this.fromDate()).toISOString(),
          toDate: new Date(this.toDate()).toISOString(),
        })
      );
      const refreshed = Array.isArray(refreshData) ? refreshData :
        refreshData?.items || refreshData?.unProcessedBatches || refreshData?.batches || refreshData?.value || [];
      this.unprocessedBatches.set(refreshed);

      const matchingBatch = refreshed.find((b: any) => b.num === batch.num);
      const afterUnallocated = matchingBatch?.billingUnAllocated ?? null;

      if (afterUnallocated === null) {
        this.toast.success(`Batch ${batch.num} fully processed — all items allocated.`);
      } else if (afterUnallocated >= beforeUnallocated) {
        this.toast.error(`Batch ${batch.num}: Reconciliation did not reduce unallocated items (${afterUnallocated} remain). Check items manually.`);
      } else {
        const allocated = beforeUnallocated - afterUnallocated;
        this.toast.success(`Batch ${batch.num}: ${allocated} of ${beforeUnallocated} item(s) allocated. ${afterUnallocated} remain.`);
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Reconciliation failed');
    } finally {
      this.processing.set(false);
      this.processingBatchNum.set(null);
    }
  }

  async printBatch(batch: ProcessedBatch): Promise<void> {
    this.printing.set(true);
    try {
      const user = this.auth.user();
      const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.userName : 'Cashier';
      await firstValueFrom(
        this.api.post('/api/platinum/direct-deposit-bulk/print-processed', {
          userName: userName,
          selectedItem: batch,
          processedBatches: this.processedBatches().map(b => ({ ...b, items: [], rejectedItems: [] })),
        })
      );
      this.toast.success('Print report generated');
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Print failed');
    } finally {
      this.printing.set(false);
    }
  }

  toggleBatch(num: number): void {
    this.expandedBatchNum.update(prev => prev === num ? null : num);
  }

  toggleProcessedBatch(num: number): void {
    this.expandedProcessedNum.update(prev => prev === num ? null : num);
  }

  setActiveView(view: 'unprocessed' | 'processed'): void {
    this.activeView.set(view);
    if (view === 'processed') this.fetchProcessed();
  }

  getAllocPct(batch: UnprocessedBatch): number {
    return batch.numberOfRecords > 0 ? Math.round((batch.billingAllocated / batch.numberOfRecords) * 100) : 0;
  }

  formatCurrency(val: number): string {
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatDate(val: string | null | undefined): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    } catch { return val; }
  }

  formatDateTime(val: string | null | undefined): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return val || '-'; }
  }

  trackByNum(index: number, batch: UnprocessedBatch | ProcessedBatch): number {
    return batch.num;
  }
}
