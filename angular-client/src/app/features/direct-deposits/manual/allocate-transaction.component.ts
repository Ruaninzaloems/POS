import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
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

interface AllocationLine {
  accountNo: string;
  accountId: number;
  name: string;
  amount: number;
  allocationType: string;
  description?: string;
}

interface SearchResult {
  accountId: number;
  accountNo: string;
  name: string;
  outstandingAmount?: number;
  type: string;
  description?: string;
}

@Component({
  selector: 'app-allocate-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './allocate-transaction.component.html',
  styleUrl: './allocate-transaction.component.css'
})
export class AllocateTransactionComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  Math = Math;

  loading = signal(false);
  error = signal('');
  transaction = signal<BankReconPosItem | null>(null);
  posItemId = signal<number>(0);

  searchQuery = signal('');
  searchResults = signal<SearchResult[]>([]);
  searching = signal(false);
  dropdownOpen = signal(false);

  selectedAccount = signal<SearchResult | null>(null);
  newLineAmount = signal('');
  lines = signal<AllocationLine[]>([]);

  posting = signal(false);
  postingStatus = signal('');
  postComplete = signal(false);
  postErrors = signal<string[]>([]);
  completedLines = signal<any[]>([]);

  private searchTimer: any = null;

  totalAllocated = computed(() => this.lines().reduce((sum, l) => sum + l.amount, 0));
  remaining = computed(() => {
    const tx = this.transaction();
    if (!tx) return 0;
    return tx.amount - this.totalAllocated();
  });
  canSubmit = computed(() => {
    const tx = this.transaction();
    if (!tx) return false;
    return this.lines().length > 0 && Math.abs(this.remaining()) < 0.01;
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.posItemId.set(parseInt(idParam, 10));
      this.loadTransaction();
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  async loadTransaction(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result: any = await firstValueFrom(
        this.api.get(`/api/platinum/pos-item-details/${this.posItemId()}`)
      );
      const item = result?.posItem || result || {};
      this.transaction.set({
        posItem_ID: item.posItem_ID || this.posItemId(),
        dateOfTransaction: item.dateOfTransaction || '',
        bankReconID: item.bankReconID || 0,
        amount: item.amount || 0,
        reference: item.reference || '',
        note: item.note || item.description || '',
        dateCaptured: item.dateCaptured || '',
        capturerID: item.capturerID || 0,
        dateModified: item.dateModified || null,
        modifierID: item.modifierID || 0,
        directDepositTypeID: item.directDepositTypeID || null,
        cashbookTransactionID: item.cashbookTransactionID || 0,
        billingAllocated: item.billingAllocated || false,
        dateAllocated: item.dateAllocated || null,
      });
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to load transaction');
      this.toast.error('Failed to load transaction details');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (query.length < 2) {
      this.searchResults.set([]);
      this.dropdownOpen.set(false);
      return;
    }
    this.searchTimer = setTimeout(() => this.performSearch(query), 300);
  }

  async performSearch(query: string): Promise<void> {
    this.searching.set(true);
    try {
      const isNumeric = /^\d+$/.test(query);
      const body: Record<string, any> = {};
      if (isNumeric) {
        body['accountNo'] = query;
      } else {
        body['name'] = query;
      }

      const results: any = await firstValueFrom(
        this.api.post('/api/platinum/search-accounts', body)
      );
      const items = Array.isArray(results) ? results : results?.value || [];
      const mapped: SearchResult[] = items.slice(0, 15).map((item: any) => ({
        accountId: item.account_ID || item.accountID || item.id,
        accountNo: item.accountNumber || item.accountNo || String(item.account_ID || ''),
        name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.surname_Company || item.name || '',
        outstandingAmount: item.outStandingAmt || item.outStandingAmount || 0,
        type: 'ACCOUNT',
        description: item.typeOfUseDesc || item.statusDesc || '',
      }));
      this.searchResults.set(mapped);
      this.dropdownOpen.set(mapped.length > 0);
    } catch (e: any) {
      console.error('Search failed:', e);
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  selectSearchResult(result: SearchResult): void {
    this.selectedAccount.set(result);
    this.dropdownOpen.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
    const remaining = this.remaining();
    if (remaining > 0) {
      this.newLineAmount.set(remaining.toFixed(2));
    }
  }

  addLine(): void {
    const account = this.selectedAccount();
    if (!account) return;
    const amount = parseFloat(this.newLineAmount());
    if (isNaN(amount) || amount <= 0) {
      this.toast.error('Please enter a valid amount');
      return;
    }

    const line: AllocationLine = {
      accountNo: account.accountNo,
      accountId: account.accountId,
      name: account.name,
      amount: amount,
      allocationType: account.type || 'ACCOUNT',
      description: account.description,
    };

    this.lines.update(prev => [...prev, line]);
    this.selectedAccount.set(null);
    this.newLineAmount.set('');
  }

  removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  async submitAllocation(): Promise<void> {
    if (!this.canSubmit()) return;
    this.posting.set(true);
    this.postingStatus.set('Preparing allocation...');
    this.postErrors.set([]);
    this.completedLines.set([]);

    try {
      const tx = this.transaction()!;
      const user = this.auth.user();

      this.postingStatus.set('Creating virtual session...');
      let sessionId: number | null = null;
      try {
        const sessionResult: any = await firstValueFrom(
          this.api.post('/api/platinum/dd-virtual-session', {
            posItemId: tx.posItem_ID,
            userId: user?.user_ID || 0,
          })
        );
        sessionId = sessionResult?.sessionId || sessionResult?.id || null;
      } catch {}

      const allLines = this.lines();
      const completed: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        this.postingStatus.set(`Processing ${i + 1} of ${allLines.length}: ${line.accountNo}...`);
        try {
          const result: any = await firstValueFrom(
            this.api.post('/api/platinum/submit-dd-allocation', {
              posItemId: tx.posItem_ID,
              accountId: line.accountId,
              accountNo: line.accountNo,
              amount: line.amount,
              allocationType: line.allocationType,
              userId: user?.user_ID || 0,
            })
          );
          completed.push({
            ...line,
            receiptNo: result?.receiptNo || result?.receiptNumber || null,
            receiptId: result?.receiptId || null,
          });
        } catch (e: any) {
          errors.push(`${line.accountNo}: ${e?.error?.message || e?.message || 'Allocation failed'}`);
        }
      }

      if (sessionId) {
        try {
          await firstValueFrom(
            this.api.post('/api/platinum/dd-close-session', { sessionId })
          );
        } catch {}
      }

      this.completedLines.set(completed);
      this.postErrors.set(errors);
      this.postComplete.set(true);

      if (errors.length === 0) {
        this.toast.success(`Successfully allocated ${completed.length} line(s)`);
      } else {
        this.toast.error(`Completed with ${errors.length} error(s)`);
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Allocation failed');
    } finally {
      this.posting.set(false);
      this.postingStatus.set('');
    }
  }

  goBack(): void {
    this.router.navigate(['/direct-deposits/manual']);
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

  trackByIndex(index: number): number {
    return index;
  }
}
