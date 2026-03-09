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
  activeTab = signal<'receipt-search' | 'bank-statement' | 'eft-account' | 'cashbook-trace'>('receipt-search');

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

  eftAccountSearch = signal('');
  eftSearching = signal(false);
  eftResults = signal<any[] | null>(null);

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
    } catch {}
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
    this.cashbookResults.set(null);
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
    this.bankNoteResults.set([]);
    try {
      const results: any = await firstValueFrom(this.api.post('/api/platinum/view-receipt/search-by-eft-description', { description: this.bankNoteSearchText() }));
      const items = Array.isArray(results) ? results : (results?.items || []);
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
      this.toast.error('Please enter an account number for the EFT search.');
      return;
    }
    this.eftSearching.set(true);
    this.eftResults.set([]);
    try {
      const results: any = await firstValueFrom(this.api.post('/api/platinum/view-receipt/search-by-eft-description', { description: this.eftAccountSearch() }));
      const items = Array.isArray(results) ? results : (results?.items || []);
      this.eftResults.set(items);
      if (items.length === 0) {
        this.toast.info(`No EFT results found for "${this.eftAccountSearch()}".`);
      } else {
        this.toast.success(`Found ${items.length} EFT result${items.length !== 1 ? 's' : ''}.`);
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
    const description = item.description || item.note || '';
    if (description) {
      this.accountFilter.set(String(description));
      this.receiptFilter.set('');
      this.cashierFilter.set('0');
      this.activeTab.set('receipt-search');
      setTimeout(() => this.handleSearch(1), 100);
    } else {
      this.toast.info('No description available to search.');
    }
  }

  loadFromEft(item: any): void {
    const description = item.description || item.note || '';
    const accountNo = item.accountNumber || item.accountNo || item.accountId || '';
    if (accountNo) {
      this.accountFilter.set(String(accountNo));
      this.receiptFilter.set('');
    } else if (description) {
      this.accountFilter.set(String(description));
      this.receiptFilter.set('');
    } else {
      this.toast.info('No account or description available to search.');
      return;
    }
    this.cashierFilter.set('0');
    this.activeTab.set('receipt-search');
    setTimeout(() => this.handleSearch(1), 100);
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

  months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];
}
