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

type SortField = 'posItem_ID' | 'dateOfTransaction' | 'amount' | 'reference' | 'note' | 'billingAllocated';
type SortDir = 'asc' | 'desc';

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

  searchQuery = signal('');
  statusFilter = signal('all');
  page = signal(1);
  pageSize = signal(25);
  sortField = signal<SortField>('dateOfTransaction');
  sortDir = signal<SortDir>('desc');

  selectedItem = signal<BankReconPosItem | null>(null);
  suggestedMatches = signal<SuggestedMatch[]>([]);
  matchLoading = signal(false);
  autoAllocating = signal(false);
  autoAllocatingId = signal<number | null>(null);

  selectedItems = signal<Set<number>>(new Set());
  batchAllocating = signal(false);

  detailOpen = signal(false);

  pageSizeOptions = [10, 25, 50, 100];

  filteredItems = computed(() => {
    let data = this.items();
    const q = this.searchQuery().toLowerCase().trim();
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

  sortedItems = computed(() => {
    const data = [...this.filteredItems()];
    const field = this.sortField();
    const dir = this.sortDir();
    data.sort((a, b) => {
      let valA: any = (a as any)[field];
      let valB: any = (b as any)[field];
      if (field === 'amount') {
        valA = valA || 0;
        valB = valB || 0;
        return dir === 'asc' ? valA - valB : valB - valA;
      }
      if (field === 'billingAllocated') {
        return dir === 'asc' ? (valA ? 1 : 0) - (valB ? 1 : 0) : (valB ? 1 : 0) - (valA ? 1 : 0);
      }
      if (field === 'dateOfTransaction') {
        const dA = new Date(valA || '').getTime() || 0;
        const dB = new Date(valB || '').getTime() || 0;
        return dir === 'asc' ? dA - dB : dB - dA;
      }
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      const cmp = valA.localeCompare(valB);
      return dir === 'asc' ? cmp : -cmp;
    });
    return data;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.sortedItems().length / this.pageSize())));

  paginatedItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sortedItems().slice(start, start + this.pageSize());
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    const pages: (number | string)[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
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
    this.loadData();
  }

  ngOnDestroy(): void {}

  loadingMore = signal(false);
  loadProgress = signal('');

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.loadProgress.set('');
    try {
      const pageSize = 200;
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list', {
          page: 1,
          pageSize,
          orderby: 'dateOfTransaction',
          shortDirection: 'desc',
        })
      );

      const firstPageItems = this.extractItems(result);
      const serverTotal = result?.totalCount ?? firstPageItems.length;

      this.items.set(firstPageItems);
      this.totalCount.set(serverTotal);
      this.selectedItems.set(new Set());
      this.page.set(1);
      this.loading.set(false);

      if (firstPageItems.length < serverTotal && firstPageItems.length >= pageSize) {
        this.loadRemainingPages(firstPageItems, pageSize, serverTotal);
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to load deposits');
      this.toast.error('Failed to load deposits');
      this.loading.set(false);
    }
  }

  private async loadRemainingPages(initialItems: BankReconPosItem[], pageSize: number, serverTotal: number): Promise<void> {
    this.loadingMore.set(true);
    const allItems = [...initialItems];
    let currentPage = 2;
    const maxPages = 10;

    try {
      while (currentPage <= maxPages && allItems.length < serverTotal) {
        this.loadProgress.set(`Loading page ${currentPage}...`);
        const result: any = await firstValueFrom(
          this.api.post('/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list', {
            page: currentPage,
            pageSize,
            orderby: 'dateOfTransaction',
            shortDirection: 'desc',
          })
        );

        const pageItems = this.extractItems(result);
        if (pageItems.length === 0) break;
        allItems.push(...pageItems);
        this.items.set([...allItems]);
        this.totalCount.set(allItems.length);
        currentPage++;
      }
    } catch (e: any) {
      console.error('[deposits] Background page load failed at page', currentPage, e);
      this.toast.show(`Loaded ${allItems.length} of ~${serverTotal} deposits (some pages failed)`, 'info');
    }
    this.loadingMore.set(false);
    this.loadProgress.set('');
  }

  private extractItems(result: any): BankReconPosItem[] {
    return Array.isArray(result?.items)
      ? result.items
      : Array.isArray(result)
        ? result
        : Array.isArray(result?.value)
          ? result.value
          : Array.isArray(result?.data)
            ? result.data
            : [];
  }

  sort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set(field === 'dateOfTransaction' || field === 'amount' ? 'desc' : 'asc');
    }
    this.page.set(1);
  }

  getSortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.page.set(1);
  }

  onStatusFilterChange(val: string): void {
    this.statusFilter.set(val);
    this.page.set(1);
  }

  onPageSizeChange(val: number): void {
    this.pageSize.set(val);
    this.page.set(1);
  }

  changePage(newPage: number | string): void {
    if (typeof newPage === 'string') return;
    if (newPage >= 1 && newPage <= this.totalPages()) {
      this.page.set(newPage);
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
            this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: accNo })
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

  async autoAllocateItem(item: BankReconPosItem): Promise<void> {
    this.autoAllocatingId.set(item.posItem_ID);
    this.autoAllocating.set(true);
    try {
      const text = `${item.note || ''} ${item.reference || ''}`;
      const accountNumbers = this.extractAccountNumbers(text);

      if (accountNumbers.length === 0) {
        this.toast.error('No account number found in description. Use manual allocation.');
        return;
      }

      let bestMatch: any = null;
      for (const accNo of accountNumbers.slice(0, 3)) {
        try {
          const results: any = await firstValueFrom(
            this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: accNo })
          );
          const items = Array.isArray(results) ? results : results?.value || [];
          if (items.length > 0) {
            bestMatch = items[0];
            break;
          }
        } catch {}
      }

      if (!bestMatch) {
        this.toast.error('No matching account found. Use manual allocation.');
        return;
      }

      const accId = bestMatch.account_ID || bestMatch.accountID || bestMatch.id;
      const accNo = bestMatch.accountNumber || bestMatch.accountNo || String(accId);
      this.toast.success(`Found account ${accNo}. Redirecting to allocation...`);
      this.router.navigate(['/direct-deposits/manual/allocate', item.posItem_ID]);
    } catch (e: any) {
      this.toast.error(e?.message || 'Auto-allocate failed');
    } finally {
      this.autoAllocating.set(false);
      this.autoAllocatingId.set(null);
    }
  }

  extractAccountNumbers(text: string): string[] {
    const upper = text.toUpperCase();
    const numbers: string[] = [];
    const seen = new Set<string>();

    const patterns = [
      /ACC(?:OUNT)?\s*(?:NO\.?\s*-?\s*|#)?\s*(\d{4,})/gi,
      /USER\s+(\d{4,})/gi,
      /ERF\s+(\d{4,})/gi,
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

  toggleItemSelection(itemId: number, event: Event): void {
    event.stopPropagation();
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
    const paginated = this.paginatedItems();
    const allSelected = paginated.every(i => this.selectedItems().has(i.posItem_ID));
    if (allSelected) {
      const current = new Set(this.selectedItems());
      paginated.forEach(i => current.delete(i.posItem_ID));
      this.selectedItems.set(current);
    } else {
      const current = new Set(this.selectedItems());
      paginated.forEach(i => current.add(i.posItem_ID));
      this.selectedItems.set(current);
    }
  }

  isAllOnPageSelected(): boolean {
    const paginated = this.paginatedItems();
    return paginated.length > 0 && paginated.every(i => this.selectedItems().has(i.posItem_ID));
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

  formatCurrency(val: number): string {
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatDate(val: string | null): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    } catch { return val; }
  }

  formatDateTime(val: string | null): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return val || '-'; }
  }

  getConfidenceBadgeClass(confidence: number): string {
    if (confidence >= 80) return 'badge-success';
    if (confidence >= 50) return 'badge-warning';
    return 'badge-default';
  }

  hasAccountClue(item: BankReconPosItem): boolean {
    const text = `${item.note || ''} ${item.reference || ''}`;
    return this.extractAccountNumbers(text).length > 0;
  }

  get Math() { return Math; }

  trackByPosItemId(_index: number, item: BankReconPosItem): number {
    return item.posItem_ID;
  }
}
