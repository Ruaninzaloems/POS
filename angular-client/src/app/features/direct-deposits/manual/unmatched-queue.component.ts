import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface BankReconPosItem {
  posItem_ID: number;
  dateOfTransaction: string;
  bankReconID: number;
  amount: number;
  reference: string;
  note: string;
  dateCaptured: string;
  capturerID: number;
  dateModified: string | null;
  modifierID: number;
  directDepositTypeID: number | null;
  cashbookTransactionID: number;
  billingAllocated: boolean;
  dateAllocated: string | null;
}

interface SuggestedMatch {
  accountId: number;
  accountNo: string;
  name: string;
  oldAccountCode?: string;
  outstandingAmount?: number;
  matchType: string;
  matchDetail: string;
  confidence: number;
}

@Component({
  selector: 'app-unmatched-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './unmatched-queue.component.html',
  styleUrl: './unmatched-queue.component.css'
})
export class UnmatchedQueueComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  items = signal<BankReconPosItem[]>([]);
  totalCount = signal(0);
  hasSearched = signal(false);

  fromDate = signal('');
  toDate = signal('');
  searchQuery = signal('');
  statusFilter = signal('all');
  page = signal(1);
  pageSize = signal(20);

  selectedItem = signal<BankReconPosItem | null>(null);
  suggestedMatches = signal<SuggestedMatch[]>([]);
  matchLoading = signal(false);

  selectedItems = signal<Set<number>>(new Set());
  batchAllocating = signal(false);

  detailOpen = signal(false);
  allocateMode = signal(false);

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  filteredItems = computed(() => {
    let data = this.items();
    const q = this.searchQuery().toLowerCase();
    if (q) {
      data = data.filter(item =>
        (item.reference || '').toLowerCase().includes(q) ||
        (item.note || '').toLowerCase().includes(q) ||
        String(item.amount).includes(q) ||
        String(item.posItem_ID).includes(q)
      );
    }
    const sf = this.statusFilter();
    if (sf === 'allocated') {
      data = data.filter(i => i.billingAllocated);
    } else if (sf === 'unallocated') {
      data = data.filter(i => !i.billingAllocated);
    }
    return data;
  });

  stats = computed(() => {
    const all = this.items();
    const allocated = all.filter(i => i.billingAllocated);
    const unallocated = all.filter(i => !i.billingAllocated);
    return {
      total: all.length,
      totalAmount: all.reduce((s, i) => s + (i.amount || 0), 0),
      allocated: allocated.length,
      allocatedAmount: allocated.reduce((s, i) => s + (i.amount || 0), 0),
      unallocated: unallocated.length,
      unallocatedAmount: unallocated.reduce((s, i) => s + (i.amount || 0), 0),
    };
  });

  ngOnInit(): void {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.fromDate.set(this.formatDateForInput(thirtyDaysAgo));
    this.toDate.set(this.formatDateForInput(now));
  }

  ngOnDestroy(): void {}

  formatDateForInput(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.hasSearched.set(true);
    try {
      const params: Record<string, string> = {};
      if (this.fromDate()) params['fromDate'] = new Date(this.fromDate()).toISOString();
      if (this.toDate()) params['toDate'] = new Date(this.toDate()).toISOString();

      const result: any = await firstValueFrom(
        this.api.get('/api/platinum/bank-recon-pos-items', params)
      );

      let items: BankReconPosItem[] = [];
      if (Array.isArray(result)) {
        items = result;
      } else if (result?.items) {
        items = result.items;
      } else if (result?.value) {
        items = result.value;
      } else if (result?.data) {
        items = result.data;
      }

      this.items.set(items);
      this.totalCount.set(items.length);
      this.selectedItems.set(new Set());

      if (items.length === 0) {
        this.toast.info('No unmatched deposits found for the selected date range');
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to load unmatched queue');
      this.toast.error('Failed to load unmatched queue');
    } finally {
      this.loading.set(false);
    }
  }

  async checkItemProcessed(item: BankReconPosItem): Promise<void> {
    try {
      await firstValueFrom(
        this.api.post('/api/platinum/check-selected-item-processed', { posItemId: item.posItem_ID })
      );
    } catch (e: any) {
      console.error('Failed to check item processed:', e);
    }
  }

  selectItem(item: BankReconPosItem): void {
    this.selectedItem.set(item);
    this.detailOpen.set(true);
    this.loadSuggestedMatches(item);
  }

  async loadSuggestedMatches(item: BankReconPosItem): Promise<void> {
    this.matchLoading.set(true);
    this.suggestedMatches.set([]);
    try {
      const text = `${item.note || ''} ${item.reference || ''}`;
      const accountNumbers = this.extractAccountNumbers(text);

      const matches: SuggestedMatch[] = [];

      for (const accNo of accountNumbers.slice(0, 5)) {
        try {
          const results: any = await firstValueFrom(
            this.api.post('/api/platinum/search-accounts', { accountNo: accNo })
          );
          const items = Array.isArray(results) ? results : results?.value || [];
          for (const r of items.slice(0, 3)) {
            const accId = r.account_ID || r.accountID || r.id;
            if (accId && !matches.find(m => m.accountId === accId)) {
              matches.push({
                accountId: accId,
                accountNo: r.accountNumber || r.accountNo || String(accId),
                name: [r.initials, r.lastName].filter(Boolean).join(' ') || r.surname_Company || r.name || '',
                oldAccountCode: r.oldAccountCode,
                outstandingAmount: r.outStandingAmt || r.outStandingAmount || 0,
                matchType: 'account_number',
                matchDetail: `Matched account number ${accNo}`,
                confidence: 90,
              });
            }
          }
        } catch {}
      }

      this.suggestedMatches.set(matches);
    } catch (e: any) {
      console.error('Failed to load suggested matches:', e);
    } finally {
      this.matchLoading.set(false);
    }
  }

  extractAccountNumbers(text: string): string[] {
    const upper = text.toUpperCase();
    const numbers: string[] = [];
    const seen = new Set<string>();

    const patterns = [
      /ACC(?:OUNT)?\s*(?:NO\.?\s*-?\s*|#)?\s*(\d{4,})/gi,
      /USER\s+(\d{4,})/gi,
      /(\d{8,15})/g,
    ];

    for (const pattern of patterns) {
      let match;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(upper)) !== null) {
        const num = match[1];
        if (num && num.length >= 4 && num.length <= 15 && !seen.has(num)) {
          seen.add(num);
          numbers.push(num);
        }
      }
    }

    return numbers;
  }

  toggleItemSelection(itemId: number): void {
    const current = new Set(this.selectedItems());
    if (current.has(itemId)) {
      current.delete(itemId);
    } else {
      current.add(itemId);
    }
    this.selectedItems.set(current);
  }

  isItemSelected(itemId: number): boolean {
    return this.selectedItems().has(itemId);
  }

  selectAllItems(): void {
    const filtered = this.filteredItems();
    const allSelected = filtered.every(i => this.selectedItems().has(i.posItem_ID));
    if (allSelected) {
      this.selectedItems.set(new Set());
    } else {
      this.selectedItems.set(new Set(filtered.map(i => i.posItem_ID)));
    }
  }

  navigateToAllocate(item: BankReconPosItem): void {
    this.router.navigate(['/direct-deposits/manual/allocate', item.posItem_ID]);
  }

  navigateToHistory(): void {
    this.router.navigate(['/direct-deposits/manual/history']);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedItem.set(null);
    this.suggestedMatches.set([]);
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.totalPages()) {
      this.page.set(newPage);
    }
  }

  formatCurrency(val: number): string {
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  getConfidenceBadgeClass(confidence: number): string {
    if (confidence >= 80) return 'badge-success';
    if (confidence >= 50) return 'badge-warning';
    return 'badge-default';
  }

  trackByPosItemId(index: number, item: BankReconPosItem): number {
    return item.posItem_ID;
  }
}
