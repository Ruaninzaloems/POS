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
  pollingJobs = signal<Set<number>>(new Set());

  detailOpen = signal(false);
  selectedTx = signal<AllocationRecord | null>(null);
  detailsLoading = signal(false);
  jobAccountDetails = signal<any[] | null>(null);

  private posItemNoteCache: Record<number, string> = {};

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

      const needsNote = items.filter(item =>
        (!item.paymentReference || item.paymentReference === '0') &&
        item.posItemID > 0 &&
        !this.posItemNoteCache[item.posItemID]
      );
      const uniquePosItemIds = [...new Set(needsNote.map(i => i.posItemID))];

      if (uniquePosItemIds.length > 0) {
        try {
          const notes: Record<string, string> = await firstValueFrom(
            this.api.post('/api/platinum/bank-statement-notes', { posItemIds: uniquePosItemIds })
          );
          if (notes) {
            Object.entries(notes).forEach(([id, note]) => {
              if (note && note !== '0') {
                this.posItemNoteCache[Number(id)] = note;
              }
            });
          }
        } catch (err) {
          console.error('[AllocationHistory] Failed to fetch POS item notes:', err);
        }
      }

      const enriched = items.map(item => {
        if ((!item.paymentReference || item.paymentReference === '0') && this.posItemNoteCache[item.posItemID]) {
          return { ...item, paymentReference: this.posItemNoteCache[item.posItemID] };
        }
        return item;
      });

      this.allocationData.set(enriched);
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

      this.pollingJobs.update(prev => { const n = new Set(prev); n.add(tx.directDepositJob_ID); return n; });

      let pollAttempts = 0;
      const maxPolls = 20;
      while (pollAttempts < maxPolls) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const details: any = await firstValueFrom(
            this.api.get(`/api/platinum/direct-deposit-errors/job-details/${tx.directDepositJob_ID}`)
          );
          const newStatus = details?.job_Status || details?.status;
          if (newStatus && newStatus !== 'Resubmitted' && newStatus !== 'Processing') {
            this.allocationData.update(prev => prev.map(item =>
              item.directDepositJob_ID === tx.directDepositJob_ID
                ? { ...item, job_Status: newStatus, allocatedAmount: details.allocatedAmount ?? item.allocatedAmount, records: details.records ?? item.records }
                : item
            ));
            this.pollingJobs.update(prev => { const n = new Set(prev); n.delete(tx.directDepositJob_ID); return n; });
            this.toast.success(`Job #${tx.directDepositJob_ID} status: ${newStatus}`);
            return;
          }
        } catch (pollErr: any) {
          console.warn(`[RetryPoll] Error polling job ${tx.directDepositJob_ID}:`, pollErr?.message);
        }
        pollAttempts++;
      }
      this.pollingJobs.update(prev => { const n = new Set(prev); n.delete(tx.directDepositJob_ID); return n; });
      this.toast.info(`Job #${tx.directDepositJob_ID} is still processing. Use Refresh to check status.`);
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Failed to retry allocation job.');
    } finally {
      this.retrying.set(null);
    }
  }

  isPolling(jobId: number): boolean {
    return this.pollingJobs().has(jobId);
  }

  async openDetails(tx: AllocationRecord): Promise<void> {
    this.selectedTx.set(tx);
    this.detailOpen.set(true);
    this.jobAccountDetails.set(null);
    this.detailsLoading.set(true);
    try {
      const [jobAccountResult, errorAccountResult, importErrorsResult, statusResult] = await Promise.allSettled([
        firstValueFrom(this.api.get(`/api/platinum/bulk-progress/job-account-details/${tx.directDepositJob_ID}`)),
        firstValueFrom(this.api.get(`/api/platinum/direct-deposit-errors/account-details/${tx.directDepositJob_ID}`)),
        firstValueFrom(this.api.get(`/api/platinum/direct-deposit-allocation/generic-import-errors/${tx.directDepositJob_ID}`)),
        firstValueFrom(this.api.get(`/api/platinum/direct-deposit-allocation/generic-import-status/${tx.directDepositJob_ID}`)),
      ]);

      const errorMap = new Map<string, string>();
      if (importErrorsResult.status === 'fulfilled') {
        const errData: any = importErrorsResult.value;
        const errList = errData?.errors || (Array.isArray(errData) ? errData : []);
        errList.forEach((e: any) => {
          const accNo = e.accountNumber || e.accountNo || e.account_No || '';
          const msg = e.message || e.errorMessage || e.error || e.failedStep || '';
          if (accNo && msg) errorMap.set(accNo, msg);
        });
      }

      const receiptMap = new Map<string, string>();
      if (errorAccountResult.status === 'fulfilled') {
        const errAccts: any = errorAccountResult.value;
        const errItems = Array.isArray(errAccts) ? errAccts : errAccts?.items || [];
        errItems.forEach((r: any) => {
          const accNo = r.accountNumber || r.accountNo || '';
          const rcpt = String(r.receiptNumber ?? '').trim();
          if (accNo && rcpt) receiptMap.set(accNo, rcpt);
        });
      }
      if (statusResult.status === 'fulfilled') {
        const statusData: any = statusResult.value;
        const statusRows = Array.isArray(statusData?.rows) ? statusData.rows : Array.isArray(statusData) ? statusData : [];
        statusRows.forEach((r: any) => {
          const accNo = r.accountNumber || r.accountNo || '';
          const rcpt = String(r.receiptNumber ?? '').trim();
          if (accNo && rcpt && !receiptMap.has(accNo)) receiptMap.set(accNo, rcpt);
        });
      }

      let details: any[] | null = null;

      if (jobAccountResult.status === 'fulfilled') {
        const data: any = jobAccountResult.value;
        const items = Array.isArray(data) ? data : data?.items || data?.data || null;
        if (items && items.length > 0) details = items;
      }

      if (!details && errorAccountResult.status === 'fulfilled') {
        const data: any = errorAccountResult.value;
        const items = Array.isArray(data) ? data : data?.items || data?.data || null;
        if (items && items.length > 0) details = items;
      }

      if (details) {
        details = details.map((acc: any) => {
          const accNo = acc.accountNo || acc.accountNumber || acc.account_No || '';
          const isFailed = acc.status === 'Error' || acc.isAllocated === false;
          const merged: any = { ...acc };
          if (!merged.receiptNumber && !merged.receiptNo) {
            const rcpt = receiptMap.get(accNo);
            if (rcpt) merged.receiptNumber = rcpt;
          }
          if (!merged.receiptNumber && !merged.receiptNo) {
            merged.receiptNumber = merged.receipt_No || merged.receipt_Number || '';
          }
          if (!merged.receiptNumber && !merged.receiptNo && merged.receiptId) {
            merged.receiptIdOnly = merged.receiptId;
          }
          const errMsg = errorMap.get(accNo);
          if (errMsg && !merged.errorMessage) {
            merged.errorMessage = errMsg;
          }
          if (isFailed && !merged.errorMessage && !errMsg) {
            merged.errorMessage = 'Allocation failed — error details not available from API. Use the Retry button or check the account manually.';
          }
          return merged;
        });

        const needsNameLookup = details.filter((a: any) => {
          const name = a.name || a.accountName || a.surname || a.companyName || '';
          return !name;
        });
        if (needsNameLookup.length > 0) {
          const nameMap = new Map<string, string>();
          const uniqueAccNos = Array.from(new Set(
            needsNameLookup.map((a: any) =>
              (a.accountNo || a.accountNumber || a.account_No || '').replace(/^0+/, '')
            ).filter(Boolean)
          ));
          const batchSize = 10;
          for (let i = 0; i < uniqueAccNos.length; i += batchSize) {
            const batch = uniqueAccNos.slice(i, i + batchSize);
            const lookups = batch.map(async (accNo) => {
              try {
                const results: any = await firstValueFrom(
                  this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: accNo })
                );
                const items = Array.isArray(results) ? results : results?.value || [];
                if (items.length > 0) {
                  const r = items[0];
                  const name = r.name || r.ownerName || r.companyName || r.fullName ||
                    [r.initials, r.lastName].filter(Boolean).join(' ') || '';
                  if (name) nameMap.set(accNo, name);
                }
              } catch (e: any) {
                console.warn(`[AllocationHistory] Name lookup failed for ${accNo}:`, e?.message);
              }
            });
            await Promise.all(lookups);
          }
          if (nameMap.size > 0) {
            details = details!.map((acc: any) => {
              const existingName = acc.name || acc.accountName || acc.surname || acc.companyName || '';
              if (existingName) return acc;
              const accNo = (acc.accountNo || acc.accountNumber || acc.account_No || '').replace(/^0+/, '');
              const lookedUpName = nameMap.get(accNo);
              return lookedUpName ? { ...acc, accountName: lookedUpName } : acc;
            });
          }
        }
      }

      this.jobAccountDetails.set(details);

      if (details) {
        this.resolveReceiptNumbers(details);
      }
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

  async resolveReceiptNumbers(details: any[]): Promise<void> {
    const needsResolution = details.filter((a: any) =>
      !a.receiptNumber && !a.receiptNo && (a.receiptIdOnly || a.receiptId || a.receipt_ID)
    );
    if (needsResolution.length === 0) return;

    for (const acc of needsResolution) {
      acc.resolvingReceiptNo = true;
    }
    this.jobAccountDetails.set([...details]);

    for (const acc of needsResolution) {
      const id = acc.receiptIdOnly || acc.receiptId || acc.receipt_ID;
      try {
        const data: any = await firstValueFrom(
          this.api.get('/api/platinum/pos-multi-receipt-print', { receiptId: String(id) })
        );
        const items = Array.isArray(data) ? data : [];
        if (items.length > 0 && items[0].receiptNo) {
          acc.resolvedReceiptNo = items[0].receiptNo;
        }
      } catch (e: any) {
        console.warn(`[AllocationHistory] Receipt number lookup failed for ID ${id}:`, e?.message);
      }
      acc.resolvingReceiptNo = false;
    }
    this.jobAccountDetails.set([...details]);
  }

  async printReceipt(acc: any): Promise<void> {
    const receiptId = acc.receiptId || acc.receipt_ID || acc.serialNo || acc.id;
    const receiptNo = acc.receiptNumber || acc.receiptNo || acc.resolvedReceiptNo || acc.receipt_No || '';
    if (!receiptId && !receiptNo) {
      this.toast.error('No receipt identifier available.');
      return;
    }
    try {
      this.toast.info('Fetching receipt for printing...');
      const endpoint = '/api/platinum/billing-payment/print-receipt';
      const res: any = await firstValueFrom(this.api.post(endpoint, {
        ids: receiptId ? [Number(receiptId)] : [],
        receiptNos: receiptNo ? [receiptNo] : [],
        isReprint: true
      }));
      if (res?.base64 || res?.fileContents) {
        const b64 = res.base64 || res.fileContents;
        const byteChars = atob(b64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
        this.toast.success(`Receipt ${receiptNo || receiptId} sent to printer.`);
      } else {
        this.toast.info('Print request submitted.');
      }
    } catch (e: any) {
      this.toast.error('Failed to print receipt: ' + (e?.message || 'Unknown error'));
    }
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
        const fd = t.fileDate ? this.formatDate(t.fileDate) : '';
        const cd = t.dateCaptured ? this.formatDate(t.dateCaptured) : '';
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
      const d = new Date(val);
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    } catch { return val; }
  }

  formatDateTime(val: string | null): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      const date = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      const time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return date + ' ' + time;
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
