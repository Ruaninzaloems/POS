import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface ViewReceiptCashier {
  id: string;
  cashierId: number;
  name: string;
}

interface ViewReceiptItem {
  receiptId?: number;
  receiptNo?: string;
  accountNumber?: string;
  amount?: number;
  tenderAmount?: number;
  changeAmount?: number;
  receiptDate?: string;
  cashierName?: string;
  paymentType?: string;
  paymentOption?: string;
  cashBook?: string;
  cashOffice?: string;
  isCancelled?: number;
  cancellationReason?: string;
  isStaged?: any;
  [key: string]: any;
}

type SortField = 'receiptNo' | 'accountNumber' | 'amount' | 'receiptDate' | 'cashierName' | 'paymentType' | 'paymentOption';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-view-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-receipts.component.html',
  styleUrl: './view-receipts.component.css'
})
export class ViewReceiptsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  loading = signal(false);
  error = signal('');
  activeTab = signal<'receipt-search' | 'bank-statement' | 'eft-account' | 'cashbook-trace' | 'eft-description'>('receipt-search');

  cashiers = signal<ViewReceiptCashier[]>([]);
  loadingCashiers = signal(false);
  cashierFilter = signal('0');
  fromDate = signal('');
  toDate = signal('');
  accountFilter = signal('');
  receiptFilter = signal('');

  receipts = signal<ViewReceiptItem[]>([]);
  totalCount = signal(0);
  currentPage = signal(1);
  pageSize = 50;
  isLoading = signal(false);
  printingReceiptId = signal<string | number | null>(null);
  selectedReceipt = signal<ViewReceiptItem | null>(null);
  dataSource = signal<'none' | 'platinum'>('none');

  accountSuggestions = signal<string[]>([]);
  receiptSuggestions = signal<string[]>([]);
  showAccountDropdown = signal(false);
  showReceiptDropdown = signal(false);
  private accountDebounceTimer: any = null;
  private receiptDebounceTimer: any = null;

  eftDescriptionSearch = signal('');
  eftDescriptionSearching = signal(false);
  eftDescriptionResults = signal<any[] | null>(null);
  eftDescriptionSortField = signal<string | null>(null);
  eftDescriptionSortDir = signal<SortDir>('desc');

  quickSearch = signal('');
  filterPaymentMethod = signal('__all__');
  filterPaymentType = signal('__all__');
  filterPaymentOption = signal('__all__');
  filterStatus = signal<'all' | 'active' | 'cancelled'>('all');
  sortField = signal<SortField | null>(null);
  sortDir = signal<SortDir>('desc');
  showFilters = signal(false);

  bankNoteSearchText = signal('');
  bankNoteSearching = signal(false);
  bankNoteResults = signal<any[] | null>(null);
  bankNoteExpandedRow = signal<number | null>(null);
  bankNoteSortField = signal<string | null>(null);
  bankNoteSortDir = signal<SortDir>('desc');
  bankNoteFilter = signal<'all' | 'allocated' | 'unallocated'>('all');

  eftAccountSearch = signal('');
  eftSearching = signal(false);
  eftResults = signal<any[] | null>(null);
  eftExpandedRow = signal<number | null>(null);
  eftSortField = signal<string | null>(null);
  eftSortDir = signal<SortDir>('desc');

  printingBankItem = signal<number | null>(null);

  bankNoteSummary = computed(() => {
    const results = this.bankNoteResults();
    if (!results || results.length === 0) return null;
    const total = results.length;
    const totalBankAmount = results.reduce((s: number, r: any) => s + (Number(r.bankAmount) || 0), 0);
    const totalPaidAmount = results.reduce((s: number, r: any) => s + (Number(r.paidAmount) || 0), 0);
    const allocated = results.filter((r: any) => {
      const status = (r.allocationStatus || '').toLowerCase();
      return status.includes('account') || status.includes('miscellaneous');
    }).length;
    const unallocated = total - allocated;
    return { total, allocated, unallocated, totalBankAmount, totalPaidAmount };
  });

  filteredBankNoteResults = computed(() => {
    let results = this.bankNoteResults();
    if (!results) return [];
    const filter = this.bankNoteFilter();
    if (filter === 'allocated') {
      results = results.filter((r: any) => {
        const status = (r.allocationStatus || '').toLowerCase();
        return status.includes('account') || status.includes('miscellaneous');
      });
    } else if (filter === 'unallocated') {
      results = results.filter((r: any) => {
        const status = (r.allocationStatus || '').toLowerCase();
        return !status.includes('account') && !status.includes('miscellaneous');
      });
    }
    const sf = this.bankNoteSortField();
    if (sf) {
      const dir = this.bankNoteSortDir();
      results = [...results].sort((a: any, b: any) => {
        let va = a[sf] ?? '';
        let vb = b[sf] ?? '';
        if (sf === 'bankAmount' || sf === 'paidAmount') { va = Number(va) || 0; vb = Number(vb) || 0; return dir === 'asc' ? va - vb : vb - va; }
        if (sf.includes('Date') || sf.includes('date')) { return dir === 'asc' ? new Date(va).getTime() - new Date(vb).getTime() : new Date(vb).getTime() - new Date(va).getTime(); }
        return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }
    return results;
  });

  eftSummary = computed(() => {
    const results = this.eftResults();
    if (!results || results.length === 0) return null;
    const total = results.length;
    const totalAmount = results.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    const dates = results.map((r: any) => new Date(r.bankStatementDate || r.billingAllocationDate || 0)).filter((d: Date) => !isNaN(d.getTime()));
    const earliest = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const latest = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    return { total, totalAmount, earliest, latest };
  });

  filteredEftResults = computed(() => {
    let results = this.eftResults();
    if (!results) return [];
    const sf = this.eftSortField();
    if (sf) {
      const dir = this.eftSortDir();
      results = [...results].sort((a: any, b: any) => {
        let va = a[sf] ?? '';
        let vb = b[sf] ?? '';
        if (sf === 'amount') { va = Number(va) || 0; vb = Number(vb) || 0; return dir === 'asc' ? va - vb : vb - va; }
        if (sf.includes('Date') || sf.includes('date')) { return dir === 'asc' ? new Date(va).getTime() - new Date(vb).getTime() : new Date(vb).getTime() - new Date(va).getTime(); }
        return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }
    return results;
  });

  cashbookSearchText = signal('');
  cashbookFinYear = signal('');
  cashbookMonth = signal(String(new Date().getMonth() + 1));
  cashbookSearching = signal(false);
  cashbookResults = signal<any[] | null>(null);

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  filteredReceipts = computed(() => {
    let result = this.receipts();
    if (this.filterStatus() === 'cancelled') {
      result = result.filter(r => this.getField(r, 'isCancelled'));
    } else if (this.filterStatus() === 'active') {
      result = result.filter(r => !this.getField(r, 'isCancelled'));
    }
    if (this.filterPaymentMethod() !== '__all__') {
      result = result.filter(r => this.inferPaymentMethod(r) === this.filterPaymentMethod());
    }
    if (this.filterPaymentOption() !== '__all__') {
      result = result.filter(r => (r.paymentOption || (r as any).payment_option || (r as any).billType || '') === this.filterPaymentOption());
    }
    if (this.quickSearch().trim()) {
      const q = this.quickSearch().trim().toLowerCase();
      result = result.filter(r => {
        const searchable = [
          r.accountNumber, r.receiptNo, r.paymentType, r.cashierName, String(r.amount)
        ].join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }
    const sf = this.sortField();
    if (sf) {
      const dir = this.sortDir();
      result = [...result].sort((a, b) => {
        let va: any = a[sf] ?? '';
        let vb: any = b[sf] ?? '';
        if (sf === 'amount') { va = Number(va) || 0; vb = Number(vb) || 0; return dir === 'asc' ? va - vb : vb - va; }
        if (sf === 'receiptDate') { return dir === 'asc' ? new Date(va).getTime() - new Date(vb).getTime() : new Date(vb).getTime() - new Date(va).getTime(); }
        return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }
    return result;
  });

  filteredTotal = computed(() => this.filteredReceipts().reduce((sum, r) => sum + (Number(r.amount) || 0), 0));

  uniquePaymentMethods = computed(() => {
    const set = new Set<string>();
    this.receipts().forEach(r => { const v = this.inferPaymentMethod(r); if (v) set.add(v); });
    return Array.from(set).sort();
  });

  uniquePaymentOptions = computed(() => {
    const set = new Set<string>();
    this.receipts().forEach(r => {
      const v = r.paymentOption || (r as any).payment_option || (r as any).billType || '';
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  });

  ngOnInit(): void {
    const now = new Date();
    this.fromDate.set(this.formatDateForInput(new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1)));
    this.toDate.set(this.formatDateForInput(now));
    this.loadCashiers();
    this.loadFinYear();
  }

  private formatDateForInput(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  async loadCashiers(): Promise<void> {
    this.loadingCashiers.set(true);
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/view-receipt/get-cashiers'));
      const items = Array.isArray(data) ? data : (data?.items || data?.value || []);
      this.cashiers.set(items.map((c: any) => ({
        id: String(c.id || c.cashierId || c.user_Id || ''),
        cashierId: c.cashierId || c.user_Id || c.id || 0,
        name: c.name || c.cashierName || c.userName || `Cashier ${c.id}`,
      })));
    } catch {
      this.cashiers.set([]);
    } finally {
      this.loadingCashiers.set(false);
    }
  }

  async loadFinYear(): Promise<void> {
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/active-fin-year'));
      if (data && typeof data === 'string') {
        this.cashbookFinYear.set(data);
      } else if (data?.finYear) {
        this.cashbookFinYear.set(data.finYear);
      }
    } catch {
    }
  }

  async handleSearch(page: number = 1): Promise<void> {
    if (!this.cashierFilter() && !this.accountFilter() && !this.receiptFilter()) {
      this.toast.error('Please select a cashier, or enter an account number or receipt number.');
      return;
    }
    const hasSpecificFilter = !!this.accountFilter() || !!this.receiptFilter();
    if ((!this.cashierFilter() || this.cashierFilter() === '0') && !hasSpecificFilter) {
      const from = this.fromDate() ? new Date(this.fromDate()) : new Date();
      const to = this.toDate() ? new Date(this.toDate()) : new Date();
      const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        this.toast.error('When searching all cashiers without an account or receipt number, please use a date range of 7 days or less.');
        return;
      }
    }
    this.isLoading.set(true);
    this.quickSearch.set('');
    this.filterPaymentMethod.set('__all__');
    this.filterPaymentOption.set('__all__');
    this.filterStatus.set('all');
    this.sortField.set(null);
    try {
      const hasSpecificLookup = !!this.receiptFilter() || !!this.accountFilter();
      const searchFromDate = hasSpecificLookup
        ? new Date(new Date().getFullYear() - 2, 0, 1).toISOString().split('T')[0]
        : this.fromDate();
      const searchToDate = this.toDate() || this.formatDateForInput(new Date());

      const query: any = {
        fromDate: searchFromDate + 'T00:00:00',
        toDate: searchToDate + 'T23:59:59',
        page, pageSize: this.pageSize,
        orderby: 'receiptDate', shortDirection: 'desc',
        cashierId: this.cashierFilter() || '0',
      };
      if (this.accountFilter()) query.accountNumber = this.accountFilter();
      if (this.receiptFilter()) query.receiptNo = this.receiptFilter();

      const result: any = await firstValueFrom(this.api.post('/api/platinum/view-receipt/get-receipt-list', query));
      const items = result?.items || result?.value || (Array.isArray(result) ? result : []);
      this.receipts.set(items);
      this.totalCount.set(result?.totalCount || items.length);
      this.currentPage.set(page);
      this.dataSource.set(items.length > 0 ? 'platinum' : 'none');

      if (items.length === 0) {
        this.toast.info('No receipts found matching your criteria.');
      }
    } catch (e: any) {
      this.toast.error('Failed to load receipt data: ' + (e?.message || 'Please try again.'));
    } finally {
      this.isLoading.set(false);
    }
  }

  handleClear(): void {
    this.cashierFilter.set('0');
    const now = new Date();
    this.fromDate.set(this.formatDateForInput(new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1)));
    this.toDate.set(this.formatDateForInput(now));
    this.accountFilter.set('');
    this.receiptFilter.set('');
    this.receipts.set([]);
    this.totalCount.set(0);
    this.currentPage.set(1);
    this.quickSearch.set('');
    this.filterPaymentMethod.set('__all__');
    this.filterPaymentOption.set('__all__');
    this.filterStatus.set('all');
    this.sortField.set(null);
    this.bankNoteResults.set(null);
    this.eftResults.set(null);
    this.eftDescriptionResults.set(null);
    this.cashbookResults.set(null);
    this.accountSuggestions.set([]);
    this.receiptSuggestions.set([]);
    this.showAccountDropdown.set(false);
    this.showReceiptDropdown.set(false);
    this.dataSource.set('none');
  }

  async handlePrintReceipt(receipt: ViewReceiptItem): Promise<void> {
    const serialNo = receipt.receiptId || (receipt as any).serialNo || (receipt as any).id;
    if (!serialNo) {
      this.toast.error('No receipt identifier found.');
      return;
    }
    this.printingReceiptId.set(serialNo);
    try {
      const receiptNo = receipt.receiptNo || '';
      const isMisc = (receipt as any).isMiscPayment === true || (receipt as any).isMiscPayment === 1;
      const endpoint = isMisc ? '/api/platinum/billing-payment/print-miscellaneous-receipt' : '/api/platinum/billing-payment/print-receipt';
      const res: any = await firstValueFrom(this.api.post(endpoint, {
        ids: [Number(serialNo)], receiptNos: receiptNo ? [receiptNo] : [], isReprint: true
      }));
      if (res?.base64 || res?.fileContents) {
        const b64 = res.base64 || res.fileContents;
        const byteChars = atob(b64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
        this.toast.success(`Receipt ${receiptNo || serialNo} sent to printer.`);
      } else {
        this.toast.info('Print request submitted.');
      }
    } catch (e: any) {
      this.toast.error('Failed to print receipt: ' + (e?.message || 'Unknown error'));
    } finally {
      this.printingReceiptId.set(null);
    }
  }

  async handleBankNoteSearch(): Promise<void> {
    if (!this.bankNoteSearchText() || this.bankNoteSearchText().length < 3) {
      this.toast.error('Please enter at least 3 characters for bank statement note search.');
      return;
    }
    this.bankNoteSearching.set(true);
    this.bankNoteResults.set(null);
    this.bankNoteExpandedRow.set(null);
    this.bankNoteFilter.set('all');
    this.bankNoteSortField.set(null);
    try {
      const results: any = await firstValueFrom(this.api.get('/api/platinum/billing-enquiry/search-by-bank-statement-note', { searchText: this.bankNoteSearchText() }));
      const items = Array.isArray(results) ? results : (results?.items || results?.value || results?.data || []);
      if (items.length > 0) {
        console.log('[BankStatementNote] First result keys:', Object.keys(items[0]));
        console.log('[BankStatementNote] First result:', JSON.stringify(items[0]));
      }
      this.bankNoteResults.set(items);
      if (items.length === 0) {
        this.toast.info(`No bank statement notes found matching "${this.bankNoteSearchText()}".`);
      } else {
        this.toast.success(`Found ${items.length} bank statement result${items.length !== 1 ? 's' : ''}.`);
      }
    } catch (e: any) {
      this.toast.error('Bank statement note search failed: ' + (e?.message || ''));
    } finally {
      this.bankNoteSearching.set(false);
    }
  }

  async handleEftSearch(): Promise<void> {
    if (!this.eftAccountSearch()) {
      this.toast.error('Please enter an account ID for the EFT search.');
      return;
    }
    this.eftSearching.set(true);
    this.eftResults.set(null);
    this.eftExpandedRow.set(null);
    this.eftSortField.set(null);
    try {
      const results: any = await firstValueFrom(this.api.get('/api/platinum/billing-enquiry/get-eft-bank-statement-notes', { accountId: this.eftAccountSearch() }));
      const items = Array.isArray(results) ? results : (results?.items || results?.value || results?.data || []);
      if (items.length > 0) {
        console.log('[EftByAccount] First result keys:', Object.keys(items[0]));
        console.log('[EftByAccount] First result:', JSON.stringify(items[0]));
      }
      this.eftResults.set(items);
      if (items.length === 0) {
        this.toast.info(`No EFT receipts found for account "${this.eftAccountSearch()}".`);
      } else {
        this.toast.success(`Found ${items.length} EFT receipt${items.length !== 1 ? 's' : ''}.`);
      }
    } catch (e: any) {
      this.toast.error('EFT search failed: ' + (e?.message || ''));
    } finally {
      this.eftSearching.set(false);
    }
  }

  async handleCashbookSearch(): Promise<void> {
    if (!this.cashbookSearchText() || this.cashbookSearchText().length < 3) {
      this.toast.error('Please enter at least 3 characters for the bank reference search.');
      return;
    }
    if (!this.cashbookMonth() || this.cashbookMonth() === '__all__') {
      this.toast.error('Please select a specific month for cashbook trace.');
      return;
    }
    this.cashbookSearching.set(true);
    this.cashbookResults.set([]);
    this.receipts.set([]);
    this.totalCount.set(0);
    this.dataSource.set('none');
    try {
      const monthNum = parseInt(this.cashbookMonth(), 10);
      const params: Record<string, string> = { searchText: this.cashbookSearchText() };
      if (this.cashbookFinYear()) params['finYear'] = this.cashbookFinYear();
      if (monthNum) params['month'] = String(monthNum);
      const results: any = await firstValueFrom(this.api.get('/api/platinum/cashbook-transaction-trace/search', params));
      const items = Array.isArray(results) ? results : (results?.items || []);
      this.cashbookResults.set(items);
      if (items.length === 0) {
        this.toast.info(`No cashbook transactions found matching "${this.cashbookSearchText()}".`);
      } else {
        this.toast.success(`Found ${items.length} cashbook transaction${items.length !== 1 ? 's' : ''}.`);
      }
    } catch (e: any) {
      this.toast.error('Cashbook search failed: ' + (e?.message || ''));
    } finally {
      this.cashbookSearching.set(false);
    }
  }

  loadFromCashbookResult(item: any): void {
    const receiptNo = item.receiptNo || item.receipt_No || item.receiptNumber || '';
    const accountNumber = item.accountNumber || item.account_Number || item.accountNo || '';
    if (receiptNo) {
      this.receiptFilter.set(String(receiptNo));
      this.accountFilter.set('');
      this.cashierFilter.set('0');
    } else if (accountNumber) {
      this.accountFilter.set(String(accountNumber));
      this.receiptFilter.set('');
      this.cashierFilter.set('0');
    } else {
      this.toast.error('This cashbook entry has no receipt or account number to look up.');
      return;
    }
    this.activeTab.set('receipt-search');
    setTimeout(() => this.handleSearch(1), 100);
  }

  loadFromBankNote(item: any): void {
    const receiptNo = item.receiptNo || '';
    const accountId = item.accountId || '';
    if (receiptNo) {
      this.receiptFilter.set(String(receiptNo));
      this.accountFilter.set('');
    } else if (accountId) {
      this.accountFilter.set(String(accountId));
      this.receiptFilter.set('');
    } else {
      const description = item.bankStatementNote || item.description || item.note || '';
      if (description) {
        this.accountFilter.set(String(description));
        this.receiptFilter.set('');
      } else {
        this.toast.info('No receipt or account reference available.');
        return;
      }
    }
    this.cashierFilter.set('0');
    this.activeTab.set('receipt-search');
    setTimeout(() => this.handleSearch(1), 100);
  }

  loadFromEft(item: any): void {
    const receiptNo = item.receiptNo || '';
    if (receiptNo) {
      this.receiptFilter.set(String(receiptNo));
      this.accountFilter.set(this.eftAccountSearch());
    } else {
      this.toast.info('No receipt number available.');
      return;
    }
    this.cashierFilter.set('0');
    this.activeTab.set('receipt-search');
    setTimeout(() => this.handleSearch(1), 100);
  }

  toggleBankNoteExpand(index: number): void {
    this.bankNoteExpandedRow.set(this.bankNoteExpandedRow() === index ? null : index);
  }

  toggleEftExpand(index: number): void {
    this.eftExpandedRow.set(this.eftExpandedRow() === index ? null : index);
  }

  handleBankNoteSort(field: string): void {
    if (this.bankNoteSortField() === field) {
      if (this.bankNoteSortDir() === 'desc') this.bankNoteSortDir.set('asc');
      else { this.bankNoteSortField.set(null); this.bankNoteSortDir.set('desc'); }
    } else {
      this.bankNoteSortField.set(field);
      this.bankNoteSortDir.set('desc');
    }
  }

  handleEftSort(field: string): void {
    if (this.eftSortField() === field) {
      if (this.eftSortDir() === 'desc') this.eftSortDir.set('asc');
      else { this.eftSortField.set(null); this.eftSortDir.set('desc'); }
    } else {
      this.eftSortField.set(field);
      this.eftSortDir.set('desc');
    }
  }

  getAllocationStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('account allocation') || s === 'account allocation') return 'badge-success';
    if (s.includes('miscellaneous')) return 'badge-info';
    if (s.includes('not allocated in billing')) return 'badge-warning';
    if (s.includes('not allocated')) return 'badge-danger';
    return 'badge-neutral';
  }

  formatDateOnly(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    } catch { return dateStr; }
  }

  getAllocatedByUser(item: any): string {
    return item.cashierName || item.CashierName || item.cashier || item.Cashier
      || item.userName || item.UserName || item.user_name
      || item.capturedByUserName || item.CapturedByUserName
      || item.allocatedBy || item.AllocatedBy
      || item.createdBy || item.CreatedBy || '';
  }

  getDaysBetween(date1: string, date2: string): string {
    if (!date1 || !date2) return '-';
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '-';
      const days = Math.abs(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
      return `${days} day${days !== 1 ? 's' : ''}`;
    } catch { return '-'; }
  }

  private escHtml(str: string): string {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  printBankAllocation(item: any, type: 'bank' | 'eft'): void {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      this.toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }
    const isBank = type === 'bank';
    const bankNote = this.escHtml(item.bankStatementNote || item.description || item.note || '-');
    const bankAmount = this.escHtml(this.formatCurrency(Number(item.bankAmount || item.amount) || 0));
    const bankDate = this.escHtml(this.formatDateOnly(item.bankStatementDate || item.dateOfTransaction || ''));
    const receiptNo = this.escHtml(item.receiptNo || '-');
    const accountId = this.escHtml(item.accountId || this.eftAccountSearch() || '-');
    const paidAmount = this.escHtml(this.formatCurrency(Number(item.paidAmount || item.amount) || 0));
    const allocDate = this.escHtml(this.formatDateOnly(item.billingAllocationDate || item.dateCaptured || ''));
    const status = this.escHtml(item.allocationStatus || (isBank ? 'Unknown' : 'EFT Allocated'));
    const cashbookDoc = this.escHtml(item.cashbookDocumentNumber || '-');
    const cashbookName = this.escHtml(item.cashbookDescription || item.CashbookDescription || item.cashbookName || '-');
    const miscGroup = this.escHtml(item.miscPaymentGroupDescription || '-');
    const allocatedByUser = this.escHtml(this.getAllocatedByUser(item));

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Bank Statement Allocation - ${receiptNo}</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; padding: 2rem; color: #1a1a2e; }
        .print-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f2b46; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .print-title { font-size: 1.25rem; font-weight: 700; color: #0f2b46; }
        .print-subtitle { font-size: 0.875rem; color: #666; margin-top: 0.25rem; }
        .print-date { font-size: 0.8125rem; color: #666; text-align: right; }
        .section { margin-bottom: 1.5rem; }
        .section-title { font-size: 0.9375rem; font-weight: 700; color: #0f2b46; margin-bottom: 0.75rem; padding-bottom: 0.375rem; border-bottom: 1px solid #e5e7eb; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 2rem; }
        .detail-item { display: flex; flex-direction: column; }
        .detail-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
        .detail-value { font-size: 0.9375rem; font-weight: 500; padding: 0.25rem 0; }
        .detail-value.mono { font-family: ui-monospace, monospace; }
        .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.8125rem; font-weight: 600; }
        .status-allocated { background: #dcfce7; color: #166534; }
        .status-misc { background: #dbeafe; color: #1e40af; }
        .status-unallocated { background: #fef3c7; color: #92400e; }
        .status-not { background: #fee2e2; color: #991b1b; }
        .flow-arrow { text-align: center; padding: 0.75rem; font-size: 1.5rem; color: #c9a84c; }
        @media print { body { padding: 1rem; } }
      </style>
    </head><body>
      <div class="print-header">
        <div>
          <div class="print-title">George Municipality - Bank Statement Allocation</div>
          <div class="print-subtitle">EFT Payment Tracing Report</div>
        </div>
        <div class="print-date">Printed: ${this.formatDateOnly(new Date().toISOString())}</div>
      </div>
      <div class="section">
        <div class="section-title">Bank Statement Details</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Description</span><span class="detail-value mono">${bankNote}</span></div>
          <div class="detail-item"><span class="detail-label">Bank Amount</span><span class="detail-value mono">${bankAmount}</span></div>
          <div class="detail-item"><span class="detail-label">Bank Transaction Date</span><span class="detail-value">${bankDate}</span></div>
          <div class="detail-item"><span class="detail-label">Bank Recon ID</span><span class="detail-value mono">${item.bankReconID || item.bankReconId || '-'}</span></div>
        </div>
      </div>
      <div class="flow-arrow">&#8595;</div>
      <div class="section">
        <div class="section-title">Billing Allocation Details</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Receipt Number</span><span class="detail-value mono">${receiptNo}</span></div>
          <div class="detail-item"><span class="detail-label">Account ID</span><span class="detail-value mono">${accountId}</span></div>
          <div class="detail-item"><span class="detail-label">Paid Amount</span><span class="detail-value mono">${paidAmount}</span></div>
          <div class="detail-item"><span class="detail-label">Allocation Date</span><span class="detail-value">${allocDate}</span></div>
          <div class="detail-item"><span class="detail-label">Allocation Status</span><span class="detail-value"><span class="status-badge ${status.toLowerCase().includes('account') ? 'status-allocated' : status.toLowerCase().includes('misc') ? 'status-misc' : status.toLowerCase().includes('not allocated in') ? 'status-unallocated' : 'status-not'}">${status}</span></span></div>
          ${allocatedByUser ? `<div class="detail-item"><span class="detail-label">Allocated By</span><span class="detail-value">${allocatedByUser}</span></div>` : ''}
          ${miscGroup !== '-' ? `<div class="detail-item"><span class="detail-label">Misc Payment Group</span><span class="detail-value">${miscGroup}</span></div>` : ''}
        </div>
      </div>
      ${cashbookDoc !== '-' ? `<div class="section">
        <div class="section-title">Cashbook Reference</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Document Number</span><span class="detail-value mono">${cashbookDoc}</span></div>
          <div class="detail-item"><span class="detail-label">Cashbook Name</span><span class="detail-value">${cashbookName}</span></div>
          <div class="detail-item"><span class="detail-label">Transaction ID</span><span class="detail-value mono">${item.cashbookTransactionID || item.cashbookTransactionId || '-'}</span></div>
        </div>
      </div>` : ''}
      <script>setTimeout(() => { window.print(); }, 300);</script>
    </body></html>`);
    printWindow.document.close();
  }

  private csvEscape(val: any): string {
    let s = String(val ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s}"`;
  }

  exportBankResults(): void {
    const results = this.filteredBankNoteResults();
    if (!results || results.length === 0) return;
    const headers = ['Bank Statement Note','Bank Amount','Bank Date','Receipt No','Account ID','Paid Amount','Allocation Date','Allocation Status','Allocated By','Cashbook Doc','Cashbook Name'];
    const rows = results.map((r: any) => [
      r.bankStatementNote || r.description || '',
      Number(r.bankAmount) || 0,
      this.formatDateOnly(r.bankStatementDate || ''),
      r.receiptNo || '',
      r.accountId || '',
      Number(r.paidAmount) || 0,
      this.formatDateOnly(r.billingAllocationDate || ''),
      r.allocationStatus || '',
      this.getAllocatedByUser(r),
      r.cashbookDocumentNumber || '',
      r.cashbookDescription || r.CashbookDescription || r.cashbookName || ''
    ]);
    const csv = [headers.map(h => this.csvEscape(h)).join(','), ...rows.map(r => r.map(v => this.csvEscape(v)).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank_statement_search_${this.bankNoteSearchText()}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportEftResults(): void {
    const results = this.filteredEftResults();
    if (!results || results.length === 0) return;
    const headers = ['Receipt No','Bank Statement Note','Amount','Bank Date','Billing Allocation Date','Capturer'];
    const rows = results.map((r: any) => [
      r.receiptNo || '',
      r.bankStatementNote || '',
      Number(r.amount) || 0,
      this.formatDateOnly(r.bankStatementDate || ''),
      this.formatDateOnly(r.billingAllocationDate || ''),
      this.getAllocatedByUser(r)
    ]);
    const csv = [headers.map(h => this.csvEscape(h)).join(','), ...rows.map(r => r.map(v => this.csvEscape(v)).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eft_receipts_account_${this.eftAccountSearch()}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  handleSort(field: SortField): void {
    if (this.sortField() === field) {
      if (this.sortDir() === 'desc') this.sortDir.set('asc');
      else { this.sortField.set(null); this.sortDir.set('desc'); }
    } else {
      this.sortField.set(field);
      this.sortDir.set('desc');
    }
  }

  formatReceiptDate(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return dateStr; }
  }

  formatCurrency(amount: number): string {
    return `R ${(amount || 0).toFixed(2)}`;
  }

  inferPaymentMethod(receipt: ViewReceiptItem): string {
    const r = receipt as any;
    const cardNo = r.cardNo || r.card_no || r.cardNumber || '';
    const chequeNo = r.chequeNo || r.cheque_no || r.chequeNumber || '';
    const nameOnCheque = r.nameOnCheque || r.name_on_cheque || '';
    const payType = (receipt.paymentType || r.payment_type || r.payMode || '').toLowerCase();

    if (cardNo && cardNo.trim()) return 'Credit Card';
    if ((chequeNo && chequeNo.trim()) || (nameOnCheque && nameOnCheque.trim())) return 'Cheque';
    if (payType.includes('eft')) return 'EFT';
    if (payType.includes('postal')) return 'Postal Order';
    if (payType.includes('credit') || payType.includes('card')) return 'Credit Card';
    if (payType.includes('cheque')) return 'Cheque';
    if (payType.includes('cash') && !payType.includes('cashier')) return 'Cash';
    return 'Cash';
  }

  getField(receipt: ViewReceiptItem, field: string): any {
    const r = receipt as any;
    switch (field) {
      case 'accountNumber': return receipt.accountNumber || r.accountNo || r.accountID || r.account_number || '';
      case 'receiptNo': return receipt.receiptNo || r.receipt_no || '';
      case 'paymentType': return receipt.paymentType || r.payment_type || r.payMode || '';
      case 'paymentMethod': return this.inferPaymentMethod(receipt);
      case 'paymentOption': return receipt.paymentOption || r.payment_option || r.billType || '';
      case 'receiptDate': return receipt.receiptDate || r.receipt_date || '';
      case 'amount': return receipt.amount ?? r.receiptAmount ?? 0;
      case 'tenderAmount': return receipt.tenderAmount ?? r.tender_amount ?? 0;
      case 'changeAmount': return receipt.changeAmount ?? r.change_amount ?? 0;
      case 'cashierName': return receipt.cashierName || r.cashier_name || r.cashier || '';
      case 'cashBook': return receipt.cashBook || r.cash_book || r.cashOfficeName || '';
      case 'cashOffice': return receipt.cashOffice || r.cash_office || r.cashOfficeName || r.cashierOffice || '';
      case 'staged': {
        const s = receipt.isStaged ?? r.is_staged ?? r.staged ?? false;
        return typeof s === 'string' ? s : (s ? 'Yes' : 'No');
      }
      case 'isCancelled': {
        const cancelField = r.cancel || '';
        return receipt.isCancelled === 1 || r.is_cancelled === 1 || r.isCancelled === true || cancelField.toLowerCase().includes('cancel');
      }
      case 'serialNo': return r.serialNo || receipt.receiptId || r.id || '';
      default: return '';
    }
  }

  filteredEftDescriptionResults = computed(() => {
    let results = this.eftDescriptionResults();
    if (!results) return [];
    const sf = this.eftDescriptionSortField();
    if (sf) {
      const dir = this.eftDescriptionSortDir();
      results = [...results].sort((a: any, b: any) => {
        let va = a[sf] ?? '';
        let vb = b[sf] ?? '';
        if (sf === 'amount') { va = Number(va) || 0; vb = Number(vb) || 0; return dir === 'asc' ? va - vb : vb - va; }
        if (sf.includes('Date') || sf.includes('date')) { return dir === 'asc' ? new Date(va).getTime() - new Date(vb).getTime() : new Date(vb).getTime() - new Date(va).getTime(); }
        return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }
    return results;
  });

  handleAccountFilterChange(value: string): void {
    this.accountFilter.set(value);
    if (this.accountDebounceTimer) clearTimeout(this.accountDebounceTimer);
    if (value.length >= 3) {
      this.accountDebounceTimer = setTimeout(async () => {
        try {
          const data: any = await firstValueFrom(this.api.get('/api/platinum/view-receipt/search-account-numbers', { query: value }));
          const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.value) ? data.value : Array.isArray(data?.data) ? data.data : [];
          this.accountSuggestions.set(items);
          this.showAccountDropdown.set(items.length > 0);
        } catch {
          this.accountSuggestions.set([]);
          this.showAccountDropdown.set(false);
        }
      }, 300);
    } else {
      this.accountSuggestions.set([]);
      this.showAccountDropdown.set(false);
    }
  }

  selectAccountSuggestion(value: string): void {
    this.accountFilter.set(value);
    this.showAccountDropdown.set(false);
    this.accountSuggestions.set([]);
  }

  handleReceiptFilterChange(value: string): void {
    this.receiptFilter.set(value);
    if (this.receiptDebounceTimer) clearTimeout(this.receiptDebounceTimer);
    if (value.length >= 3) {
      this.receiptDebounceTimer = setTimeout(async () => {
        try {
          const data: any = await firstValueFrom(this.api.get('/api/platinum/view-receipt/search-receipt-numbers', { query: value }));
          const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.value) ? data.value : Array.isArray(data?.data) ? data.data : [];
          this.receiptSuggestions.set(items);
          this.showReceiptDropdown.set(items.length > 0);
        } catch {
          this.receiptSuggestions.set([]);
          this.showReceiptDropdown.set(false);
        }
      }, 300);
    } else {
      this.receiptSuggestions.set([]);
      this.showReceiptDropdown.set(false);
    }
  }

  selectReceiptSuggestion(value: string): void {
    this.receiptFilter.set(value);
    this.showReceiptDropdown.set(false);
    this.receiptSuggestions.set([]);
  }

  hideAccountDropdown(): void {
    setTimeout(() => this.showAccountDropdown.set(false), 200);
  }

  hideReceiptDropdown(): void {
    setTimeout(() => this.showReceiptDropdown.set(false), 200);
  }

  async handleEftDescriptionSearch(): Promise<void> {
    if (!this.eftDescriptionSearch() || this.eftDescriptionSearch().length < 3) {
      this.toast.error('Please enter at least 3 characters for the EFT description search.');
      return;
    }
    this.eftDescriptionSearching.set(true);
    this.eftDescriptionResults.set(null);
    this.eftDescriptionSortField.set(null);
    try {
      const results: any = await firstValueFrom(this.api.post('/api/platinum/view-receipt/search-by-eft-description', {
        description: this.eftDescriptionSearch()
      }));
      const items = results?.results || results?.items || (Array.isArray(results) ? results : []);
      this.eftDescriptionResults.set(items);
      if (items.length === 0) {
        this.toast.info(`No EFT transactions found matching "${this.eftDescriptionSearch()}".`);
      } else {
        this.toast.success(`Found ${items.length} matching EFT transaction${items.length !== 1 ? 's' : ''}.`);
      }
    } catch (e: any) {
      this.toast.error('EFT description search failed: ' + (e?.message || ''));
    } finally {
      this.eftDescriptionSearching.set(false);
    }
  }

  handleEftDescriptionSort(field: string): void {
    if (this.eftDescriptionSortField() === field) {
      if (this.eftDescriptionSortDir() === 'desc') this.eftDescriptionSortDir.set('asc');
      else { this.eftDescriptionSortField.set(null); this.eftDescriptionSortDir.set('desc'); }
    } else {
      this.eftDescriptionSortField.set(field);
      this.eftDescriptionSortDir.set('desc');
    }
  }

  months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];
}
