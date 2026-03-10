import { Component, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface SearchCriteria {
  [key: string]: string | undefined;
  accountNo?: string;
  oldAccountCode?: string;
  name?: string;
  idNo?: string;
  passportNumber?: string;
  locationAddress?: string;
  mobileNumber?: string;
  physicalMeterNumber?: string;
  emailAddress?: string;
  sgNumber?: string;
  erfNumber?: string;
}

interface SearchResult {
  account_ID: number;
  accountID: number;
  accountNumber: string;
  oldAccountCode: string;
  name: string;
  surname_Company: string;
  initials: string;
  idRegistrationNumber: string;
  deliveryAddress: string;
  locationAddress: string;
  address: string;
  statusDesc: string;
  accountStatus: string;
  accountDesc: string;
  accountType: string;
  outStandingAmt: number;
  outStandingAmount: number;
  addName: string;
  contactDetails: string;
  unitID: number;
  unitPartitionID: number;
  sgNumber: string;
  propertyID: string;
  [key: string]: any;
}

interface SearchField {
  key: string;
  label: string;
  placeholder: string;
  icon: string;
}

interface TabItem {
  value: string;
  label: string;
  icon: string;
}

interface TabGroup {
  heading: string;
  tabs: TabItem[];
}

interface RiskFlag {
  id: string;
  label: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
  icon: string;
}

@Component({
  selector: 'app-enquiries-general',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enquiries-general.component.html',
  styleUrl: './enquiries-general.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnquiriesGeneralComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  quickQuery = signal('');
  criteria = signal<SearchCriteria>({});
  results = signal<SearchResult[]>([]);
  dropdownResults = signal<SearchResult[]>([]);
  searching = signal(false);
  dropdownSearching = signal(false);
  searchError = signal<string | null>(null);
  hasSearched = signal(false);
  selectedAccount = signal<SearchResult | null>(null);
  showAdvanced = signal(false);
  activeTab = signal('account');
  showDropdown = signal(false);
  highlightIdx = signal(-1);
  headerBalance = signal<number | null>(null);
  riskFlags = signal<RiskFlag[]>([]);
  riskFlagsLoading = signal(false);
  expandedRowId = signal<number | null>(null);
  expandedRowData = signal<any>(null);
  expandedRowLoading = signal(false);

  tabData = signal<any>(null);
  tabLoading = signal(false);
  tabError = signal<string | null>(null);

  advancedSuggestions = signal<{ displayItem: string; accountId: number }[]>([]);
  activeFieldKey = signal<string | null>(null);
  advancedFieldLoading = signal(false);

  private debounceTimer: any;
  private advancedDebounceTimers: Record<string, any> = {};
  private searchToken = 0;
  private quickSearchToken = 0;
  private advancedSearchToken = 0;
  private balanceCache = new Map<number, number>();

  searchFields: SearchField[] = [
    { key: 'accountNo', label: 'Account Number', placeholder: 'e.g. 000000003698', icon: '🔢' },
    { key: 'oldAccountCode', label: 'Old Account Code', placeholder: 'Legacy code', icon: '📄' },
    { key: 'name', label: 'Name / Company', placeholder: 'Search by name', icon: '👤' },
    { key: 'idNo', label: 'ID / Registration No.', placeholder: '13 digit ID number', icon: '💳' },
    { key: 'emailAddress', label: 'Email Address', placeholder: 'user@example.com', icon: '✉️' },
    { key: 'physicalMeterNumber', label: 'Meter Number', placeholder: 'Physical meter number', icon: '⚡' },
    { key: 'locationAddress', label: 'Location / Erf Address', placeholder: 'Street, location or erf', icon: '📍' },
    { key: 'mobileNumber', label: 'Mobile Number', placeholder: '0821234567', icon: '📱' },
    { key: 'sgNumber', label: 'SG Number', placeholder: 'e.g. C027/0002/00013110/00000', icon: '🏠' },
    { key: 'erfNumber', label: 'ERF Number', placeholder: 'e.g. 13110', icon: '🏛️' },
  ];

  tabGroups: TabGroup[] = [
    {
      heading: 'ACCOUNT & PARTY',
      tabs: [
        { value: 'account', label: 'Account', icon: '👤' },
        { value: 'name', label: 'Name', icon: '👥' },
        { value: 'property', label: 'Property', icon: '🏠' },
        { value: 'linked-accounts', label: 'Linked Accts', icon: '🏢' },
        { value: 'contact', label: 'Contact', icon: '📞' },
        { value: 'handover', label: 'Handover', icon: '➡️' },
      ],
    },
    {
      heading: 'SERVICES & CONSUMPTION',
      tabs: [
        { value: 'services', label: 'Services', icon: '📊' },
        { value: 'services-meters', label: 'Meters', icon: '⏱️' },
        { value: 'consumption', label: 'Consumption', icon: '💧' },
      ],
    },
    {
      heading: 'FINANCIAL',
      tabs: [
        { value: 'balance', label: 'Balance / Debt', icon: '💳' },
        { value: 'txn-detailed', label: 'Transaction Detail', icon: '📋' },
        { value: 'txn-summary', label: 'Transaction Summary', icon: '📄' },
        { value: 'transactions', label: 'Receipts', icon: '🧾' },
        { value: 'deposits', label: 'Deposits', icon: '💵' },
        { value: 'payment-plans', label: 'Payment Plans', icon: '📅' },
        { value: 'billed-vs-paid', label: 'Billed vs Paid', icon: '📊' },
      ],
    },
    {
      heading: 'BILLING & TARIFFS',
      tabs: [
        { value: 'rates', label: 'Rates', icon: '⚖️' },
        { value: 'debit-orders', label: 'Debit Orders', icon: '🏦' },
        { value: 'statements', label: 'Statements', icon: '📄' },
      ],
    },
    {
      heading: 'COMPLIANCE & LEGAL',
      tabs: [
        { value: 'clearance', label: 'Clearance', icon: '🛡️' },
        { value: 'debtor-notes', label: 'Debtor Notes', icon: '📝' },
        { value: 'section129', label: 'Section 129', icon: '⚠️' },
      ],
    },
    {
      heading: 'NOTIFICATIONS & SUBSIDIES',
      tabs: [
        { value: 'notifications', label: 'Notifications', icon: '🔔' },
        { value: 'incentives', label: 'Incentives', icon: '🎁' },
        { value: 'indigent', label: 'Indigent Subsidy', icon: '🛡️' },
      ],
    },
  ];

  mobileTabMenuOpen = signal(false);

  private userFinYear = computed(() => this.auth.user()?.finYear || '');

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    Object.values(this.advancedDebounceTimers).forEach(t => clearTimeout(t));
  }

  get detectedSearchType(): { field: string; label: string } {
    const q = this.quickQuery().trim();
    if (/^0\d{9}$/.test(q)) return { field: 'mobileNumber', label: 'Mobile Number' };
    if (/^\d{13}$/.test(q)) return { field: 'idNo', label: 'ID Number' };
    if (/^[A-Z]\d{3}\/\d{4}\/\d+\/\d+$/i.test(q)) return { field: 'sgNumber', label: 'SG Number' };
    if (/^\d{1,15}$/.test(q)) return { field: 'accountNo', label: 'Account / ERF / Meter' };
    if (/@/.test(q)) return { field: 'emailAddress', label: 'Email Address' };
    return { field: 'name', label: 'Name / Address' };
  }

  get currentTabLabel(): string {
    for (const group of this.tabGroups) {
      const tab = group.tabs.find(t => t.value === this.activeTab());
      if (tab) return tab.label;
    }
    return 'Account';
  }

  get currentTabGroup(): string {
    for (const group of this.tabGroups) {
      if (group.tabs.some(t => t.value === this.activeTab())) return group.heading;
    }
    return '';
  }

  get currentTabIcon(): string {
    for (const group of this.tabGroups) {
      const tab = group.tabs.find(t => t.value === this.activeTab());
      if (tab) return tab.icon;
    }
    return '👤';
  }

  getAccountId(account: SearchResult | null): number {
    return account?.account_ID || account?.accountID || 0;
  }

  getAccountName(account: SearchResult | null): string {
    return account?.name || account?.surname_Company || 'Unknown';
  }

  getAccountNum(account: SearchResult | null): string {
    return account?.accountNumber || String(account?.accountID || account?.account_ID || '');
  }

  isAccountActive(account: SearchResult | null): boolean {
    return (account?.accountStatus || account?.statusDesc || '').toLowerCase() === 'active';
  }

  formatCurrency(v: any): string {
    if (v === null || v === undefined || v === '') return '-';
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(v: any): string {
    if (!v) return '-';
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    } catch {
      return String(v);
    }
  }

  safeStr(v: any): string {
    if (v === null || v === undefined || v === '' || v === 'null') return '-';
    return String(v).trim() || '-';
  }

  onQuickQueryChange(val: string): void {
    this.quickQuery.set(val);
    this.highlightIdx.set(-1);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (val.trim().length >= 2) {
      this.showDropdown.set(true);
      this.dropdownSearching.set(true);
      this.debounceTimer = setTimeout(() => this.doQuickSearch(val), 300);
    } else {
      this.showDropdown.set(false);
      this.dropdownResults.set([]);
      this.dropdownSearching.set(false);
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms)),
    ]);
  }

  async doQuickSearch(query: string): Promise<void> {
    if (query.trim().length < 2) {
      this.dropdownResults.set([]);
      this.dropdownSearching.set(false);
      return;
    }
    const token = ++this.quickSearchToken;
    this.dropdownSearching.set(true);
    const { field } = this.detectedSearchType;
    const num = query.trim();
    const seen = new Set<number>();
    const merged: SearchResult[] = [];

    try {
      const body: Record<string, any> = {};
      if (field === 'accountNo') body['accountID'] = num;
      else if (field === 'name') body['companyName'] = num;
      else if (field === 'idNo') body['idRegistrationNumber'] = num;
      else if (field === 'emailAddress') body['emailAddress'] = num;
      else if (field === 'mobileNumber') body['mobileNumber'] = num;
      else if (field === 'sgNumber') body['sgNumber'] = num;
      else body[field] = num;

      const acType = this.getAutocompleteType(field);
      const requests: Promise<any>[] = [
        this.withTimeout(firstValueFrom(this.api.post<any>('/api/platinum/billing-enquiry/enquiry-results', body)), 15000),
        this.withTimeout(firstValueFrom(this.api.get<any>('/api/platinum/billing-enquiry/autocomplete', { search: num, type: acType })), 10000),
      ];

      if (/^\d{4,}$/.test(num) && field === 'accountNo') {
        requests.push(
          this.withTimeout(firstValueFrom(this.api.post<any>('/api/platinum/billing-enquiry/enquiry-results', { oldAccount: num })), 10000),
          this.withTimeout(firstValueFrom(this.api.get<any>('/api/platinum/billing-enquiry/autocomplete', { search: num, type: 'erfNumber' })), 8000),
        );
      }

      const results = await Promise.allSettled(requests);
      if (this.quickSearchToken !== token) return;

      const processResults = (data: any) => {
        const arr = this.normalizeArray(data);
        for (const item of arr) {
          const id = item.account_ID || item.accountID;
          if (id && !seen.has(id)) { seen.add(id); merged.push(item); }
        }
      };

      if (results[0].status === 'fulfilled') processResults(results[0].value);

      const processAutocomplete = (result: PromiseSettledResult<any>) => {
        if (result.status !== 'fulfilled') return;
        const suggestions = this.normalizeArray(result.value);
        for (const s of suggestions) {
          if (s.accountId && s.accountId > 0 && !seen.has(s.accountId)) {
            seen.add(s.accountId);
            const display = s.displayItem || '';
            const parts = display.split(' - ');
            const acctNum = parts[0]?.trim() || '';
            const rest = parts.slice(1).join(' - ').trim();
            const nameParts = rest.split(',');
            const name = nameParts[0]?.trim() || '';
            const address = nameParts.slice(1).join(',').trim() || '';
            merged.push({
              account_ID: s.accountId,
              accountID: s.accountId,
              accountNumber: acctNum || String(s.accountId).padStart(12, '0'),
              name: name,
              surname_Company: name,
              locationAddress: address,
              _fromAutocomplete: true,
            } as unknown as SearchResult);
          }
        }
      };

      processAutocomplete(results[1]);

      if (results.length > 2 && results[2].status === 'fulfilled') processResults(results[2].value);
      if (results.length > 3) processAutocomplete(results[3]);

      this.dropdownResults.set([...merged]);
      if (merged.length > 0) this.showDropdown.set(true);

      this.enrichAutocompleteResults(merged, token);
    } catch (e: any) {
      if (this.quickSearchToken === token) this.dropdownResults.set([]);
    } finally {
      if (this.quickSearchToken === token) this.dropdownSearching.set(false);
    }
  }

  private async enrichAutocompleteResults(results: SearchResult[], token: number): Promise<void> {
    const autocompleteItems = results.filter((r: any) => r._fromAutocomplete);
    const allItems = results.slice(0, 10);

    const enrichPromises = autocompleteItems.slice(0, 5).map(async (item) => {
      try {
        const id = item.account_ID || item.accountID;
        const detailResult = await Promise.allSettled([
          this.withTimeout(firstValueFrom(this.api.post<any>('/api/platinum/billing-enquiry/enquiry-results', { accountID: String(id) })), 8000),
        ]);

        if (this.quickSearchToken !== token) return;

        if (detailResult[0].status === 'fulfilled') {
          const arr = this.normalizeArray(detailResult[0].value);
          if (arr.length > 0) {
            const full = arr[0];
            if (full.name || full.surname_Company) item.name = full.name || full.surname_Company;
            if (full.surname_Company) item.surname_Company = full.surname_Company;
            if (full.locationAddress) item.locationAddress = full.locationAddress;
            if (full.address) item.address = full.address;
            if (full.deliveryAddress) item.deliveryAddress = full.deliveryAddress;
            if (full.accountStatus) item.accountStatus = full.accountStatus;
            if (full.statusDesc) item.statusDesc = full.statusDesc;
            if (full.accountNumber) item.accountNumber = full.accountNumber;
            if (full.idRegistrationNumber) item.idRegistrationNumber = full.idRegistrationNumber;
            if (full.accountType) item.accountType = full.accountType;
            if (full.accountDesc) item.accountDesc = full.accountDesc;
            if (full.outStandingAmount != null) item.outStandingAmount = full.outStandingAmount;
            if (full.outStandingAmt != null) item.outStandingAmt = full.outStandingAmt;
            if (full.oldAccountCode) item.oldAccountCode = full.oldAccountCode;
            if (full.sgNumber) item.sgNumber = full.sgNumber;
            delete (item as any)._fromAutocomplete;
          }
        }
      } catch {}
    });

    const balancePromises = allItems.map(async (item) => {
      try {
        const id = item.account_ID || item.accountID;
        if (!id) return;
        const bal = await this.withTimeout(this.fetchAccountBalance(id), 12000);
        if (this.quickSearchToken !== token) return;
        if (Array.isArray(bal)) {
          const total = bal.reduce((sum: number, s: any) => sum + (s.totalOutStanding ?? s.totalOutstandingAmount ?? s.outstandingBalance ?? 0), 0);
          item.outStandingAmount = total;
        } else if (bal) {
          const amount = bal.totalOutStanding ?? bal.totalBalance ?? bal.balance ?? bal.outstandingAmount ?? bal.outStandingAmount;
          if (amount != null) item.outStandingAmount = Number(amount);
        }
      } catch {}
    });

    await Promise.allSettled([...enrichPromises, ...balancePromises]);
    if (this.quickSearchToken === token) {
      this.dropdownResults.set([...this.dropdownResults()]);
    }
  }

  getAutocompleteType(field: string): string {
    const map: Record<string, string> = {
      accountNo: 'accountNumber',
      name: 'nameCompany',
      idNo: 'idRegistrationNumber',
      emailAddress: 'email',
      physicalMeterNumber: 'physicalMeterNumber',
      oldAccountCode: 'oldAccountCode',
      locationAddress: 'locationAddress',
      erfNumber: 'erfNumber',
      sgNumber: 'erfNumber',
      mobileNumber: 'mobileNumber',
    };
    return map[field] || 'accountNumber';
  }

  normalizeArray(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data?.value && Array.isArray(data.value)) return data.value;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (data?.items && Array.isArray(data.items)) return data.items;
    if (data && typeof data === 'object' && !data._error) return [data];
    return [];
  }

  async handleFullSearch(): Promise<void> {
    const q = this.quickQuery().trim();
    const c = this.criteria();
    const hasQuick = q.length >= 2;
    const hasAdvanced = Object.values(c).some(v => v && String(v).trim());
    if (!hasQuick && !hasAdvanced) return;

    this.searching.set(true);
    this.searchError.set(null);
    this.hasSearched.set(true);
    this.showDropdown.set(false);
    const token = ++this.searchToken;

    try {
      const body: Record<string, any> = {};
      if (hasQuick) {
        const { field } = this.detectedSearchType;
        if (field === 'accountNo') body['accountID'] = q;
        else if (field === 'name') body['companyName'] = q;
        else if (field === 'idNo') body['idRegistrationNumber'] = q;
        else if (field === 'emailAddress') body['emailAddress'] = q;
        else if (field === 'mobileNumber') body['mobileNumber'] = q;
        else if (field === 'sgNumber') body['sgNumber'] = q;
        else body[field] = q;
      }
      if (c.accountNo) body['accountID'] = c.accountNo;
      if (c.oldAccountCode) body['oldAccount'] = c.oldAccountCode;
      if (c.name) body['companyName'] = c.name;
      if (c.idNo) body['idRegistrationNumber'] = c.idNo;
      if (c.locationAddress) body['locationAddress'] = c.locationAddress;
      if (c.mobileNumber) body['mobileNumber'] = c.mobileNumber;
      if (c.physicalMeterNumber) body['physicalMeterNumber'] = c.physicalMeterNumber;
      if (c.emailAddress) body['emailAddress'] = c.emailAddress;
      if (c.sgNumber) body['sgNumber'] = c.sgNumber;
      if (c.erfNumber) body['erfNumber'] = c.erfNumber;

      const data = await this.withTimeout(
        firstValueFrom(this.api.post<any>('/api/platinum/billing-enquiry/enquiry-results', body)),
        20000
      );
      if (this.searchToken !== token) return;
      const arr = this.normalizeArray(data);
      this.results.set(arr);
      this.enrichBalances(arr, token);
    } catch (e: any) {
      if (this.searchToken === token) {
        const msg = e?.message === 'Request timeout' ? 'Search timed out. Please try again.' : (e?.error?.message || e?.message || 'Search failed');
        this.searchError.set(msg);
        this.results.set([]);
      }
    } finally {
      if (this.searchToken === token) this.searching.set(false);
    }
  }

  async enrichBalances(accounts: SearchResult[], token: number): Promise<void> {
    const toFetch = accounts.filter(a => {
      const id = a.account_ID || a.accountID;
      return id && !this.balanceCache.has(id);
    }).slice(0, 10);

    for (const acct of toFetch) {
      if (this.searchToken !== token) return;
      const id = acct.account_ID || acct.accountID;
      if (!id) continue;
      try {
        const bal = await this.fetchAccountBalance(id);
        if (bal) {
          let total: number | undefined;
          if (Array.isArray(bal)) {
            total = bal.reduce((sum: number, svc: any) => sum + (svc.totalOutStanding ?? svc.totalOutstanding ?? svc.outstandingBalance ?? 0), 0);
          } else {
            total = bal.totalBalance ?? bal.totalOutstanding ?? bal.outStandingAmount ?? bal.outstandingBalance ?? bal.balance;
          }
          if (total !== undefined && total !== null) {
            this.balanceCache.set(id, total);
          }
        }
      } catch {}
    }

    if (this.searchToken === token) {
      this.results.update(prev => prev.map(acct => {
        const id = acct.account_ID || acct.accountID;
        const cached = id ? this.balanceCache.get(id) : undefined;
        return cached !== undefined ? { ...acct, outStandingAmount: cached } : acct;
      }));
    }
  }

  selectAccount(account: SearchResult): void {
    this.selectedAccount.set(account);
    this.activeTab.set('account');
    this.showDropdown.set(false);
    this.mobileTabMenuOpen.set(false);
    const id = this.getAccountId(account);
    if (id) {
      this.loadHeaderBalance(id);
      this.loadRiskFlags(id);
      this.loadTabData('account', id);
    }
  }

  backToResults(): void {
    this.selectedAccount.set(null);
    this.headerBalance.set(null);
    this.riskFlags.set([]);
    this.tabData.set(null);
  }

  clearSearch(): void {
    this.quickQuery.set('');
    this.criteria.set({});
    this.results.set([]);
    this.dropdownResults.set([]);
    this.hasSearched.set(false);
    this.searchError.set(null);
    this.selectedAccount.set(null);
    this.showDropdown.set(false);
    this.highlightIdx.set(-1);
    this.showAdvanced.set(false);
    this.searching.set(false);
    this.dropdownSearching.set(false);
    this.advancedSuggestions.set([]);
    this.activeFieldKey.set(null);
    this.advancedFieldLoading.set(false);
    ++this.searchToken;
    ++this.quickSearchToken;
    ++this.advancedSearchToken;
  }

  onQuickKeyDown(event: KeyboardEvent): void {
    const dr = this.dropdownResults();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightIdx.update(prev => Math.min(prev + 1, Math.min(dr.length - 1, 19)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightIdx.update(prev => Math.max(prev - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.highlightIdx();
      if (idx >= 0 && idx < dr.length) {
        this.selectAccount(dr[idx]);
      } else {
        this.handleFullSearch();
      }
    } else if (event.key === 'Escape') {
      this.showDropdown.set(false);
      this.highlightIdx.set(-1);
    }
  }

  updateCriteria(key: string, value: string): void {
    this.criteria.update(prev => ({ ...prev, [key]: value }));
    if (this.advancedDebounceTimers[key]) clearTimeout(this.advancedDebounceTimers[key]);
    if (value.trim().length >= 2) {
      this.activeFieldKey.set(key);
      this.advancedFieldLoading.set(true);
      this.advancedDebounceTimers[key] = setTimeout(() => this.doAdvancedAutocomplete(key, value), 350);
    } else {
      if (this.activeFieldKey() === key) {
        this.activeFieldKey.set(null);
        this.advancedSuggestions.set([]);
        this.advancedFieldLoading.set(false);
      }
    }
  }

  async doAdvancedAutocomplete(fieldKey: string, value: string): Promise<void> {
    const token = ++this.advancedSearchToken;
    const acType = this.getAutocompleteType(fieldKey);
    try {
      const data = await firstValueFrom(
        this.api.get<any>('/api/platinum/billing-enquiry/autocomplete', { search: value.trim(), type: acType })
      );
      if (this.advancedSearchToken !== token) return;
      const arr = this.normalizeArray(data);
      const suggestions = arr
        .filter((s: any) => s.displayItem && s.accountId)
        .slice(0, 15)
        .map((s: any) => ({ displayItem: s.displayItem, accountId: s.accountId }));
      this.advancedSuggestions.set(suggestions);
      this.activeFieldKey.set(fieldKey);
    } catch {
      if (this.advancedSearchToken === token) {
        this.advancedSuggestions.set([]);
      }
    } finally {
      if (this.advancedSearchToken === token) {
        this.advancedFieldLoading.set(false);
      }
    }
  }

  selectAdvancedSuggestion(fieldKey: string, suggestion: { displayItem: string; accountId: number }): void {
    const display = suggestion.displayItem || '';
    const parts = display.split(' - ');
    const val = parts[0]?.trim() || String(suggestion.accountId);
    this.criteria.update(prev => ({ ...prev, [fieldKey]: val }));
    this.activeFieldKey.set(null);
    this.advancedSuggestions.set([]);
  }

  closeAdvancedSuggestions(): void {
    this.activeFieldKey.set(null);
    this.advancedSuggestions.set([]);
  }

  toggleAdvanced(): void {
    this.showAdvanced.update(v => !v);
  }

  setActiveTab(tab: string): void {
    this.activeTab.set(tab);
    this.mobileTabMenuOpen.set(false);
    const account = this.selectedAccount();
    if (account) {
      const id = this.getAccountId(account);
      if (id) this.loadTabData(tab, id);
    }
  }

  toggleMobileTabMenu(): void {
    this.mobileTabMenuOpen.update(v => !v);
  }

  closeMobileTabMenu(): void {
    this.mobileTabMenuOpen.set(false);
  }

  closeDropdown(): void {
    this.showDropdown.set(false);
  }

  toggleExpandRow(id: number): void {
    if (this.expandedRowId() === id) {
      this.expandedRowId.set(null);
      this.expandedRowData.set(null);
    } else {
      this.expandedRowId.set(id);
      this.expandedRowData.set(null);
      this.loadExpandedRowData(id);
    }
  }

  async loadExpandedRowData(accountId: number): Promise<void> {
    this.expandedRowLoading.set(true);
    try {
      const [balanceRes, contactRes, servicesRes] = await Promise.allSettled([
        this.withTimeout(this.fetchAccountBalance(accountId), 15000),
        this.withTimeout(firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/contact-details/${accountId}`)), 12000),
        this.withTimeout(firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/all-services/${accountId}`)), 12000),
      ]);

      if (this.expandedRowId() !== accountId) return;

      const allFailed = balanceRes.status === 'rejected' && contactRes.status === 'rejected' && servicesRes.status === 'rejected';
      if (allFailed) {
        this.expandedRowData.set({ error: true });
        return;
      }

      const balance = balanceRes.status === 'fulfilled'
        ? (Array.isArray(balanceRes.value) ? balanceRes.value : balanceRes.value ? [balanceRes.value] : [])
        : [];
      const contact = contactRes.status === 'fulfilled' ? contactRes.value : null;
      const services = servicesRes.status === 'fulfilled' ? this.normalizeArray(servicesRes.value) : [];
      const balanceFailed = balanceRes.status === 'rejected';

      let totalOutstanding = 0;
      let totalCurrent = 0;
      let totalArrears = 0;
      for (const b of balance) {
        totalOutstanding += b.totalOutStanding ?? b.totalOutstandingAmount ?? 0;
        totalCurrent += b.current ?? 0;
        totalArrears += (b.days30 ?? 0) + (b.days60 ?? 0) + (b.days90 ?? 0) + (b.days120 ?? 0) + (b.days150 ?? 0);
      }

      this.expandedRowData.set({
        balance,
        contact,
        services: services.slice(0, 6),
        totalOutstanding,
        totalCurrent,
        totalArrears,
        activeServices: services.filter((s: any) => (s.serviceStatus || s.statusDesc || s.status || '').toLowerCase() === 'active').length,
        totalServices: services.length,
        balanceFailed,
        contactFailed: contactRes.status === 'rejected',
        servicesFailed: servicesRes.status === 'rejected',
      });
    } catch {
      if (this.expandedRowId() === accountId) {
        this.expandedRowData.set({ error: true });
      }
    } finally {
      if (this.expandedRowId() === accountId) {
        this.expandedRowLoading.set(false);
      }
    }
  }

  getOutstanding(account: SearchResult): number {
    return account.outStandingAmount ?? account.outStandingAmt ?? 0;
  }

  async loadHeaderBalance(accountId: number): Promise<void> {
    this.headerBalance.set(null);
    try {
      const bal = await this.fetchAccountBalance(accountId);
      if (Array.isArray(bal)) {
        const total = bal.reduce((sum: number, s: any) => sum + (s.totalOutStanding ?? s.outstandingBalance ?? 0), 0);
        this.headerBalance.set(total);
      } else {
        const total = bal?.totalBalance ?? bal?.totalDue ?? bal?.balance ?? bal?.outstandingBalance ?? null;
        if (total !== null && total !== undefined) this.headerBalance.set(Number(total));
      }
    } catch {}
  }

  async loadRiskFlags(accountId: number): Promise<void> {
    this.riskFlagsLoading.set(true);
    this.riskFlags.set([]);
    const detected: RiskFlag[] = [];

    const checks = [
      firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/handover-info/${accountId}`)).then((ho: any) => {
        if (!ho) return;
        const arr = Array.isArray(ho) ? ho : [ho];
        const active = arr.find((h: any) => {
          const st = (h.handoverStatus || h.status || h.handoverStatusDesc || '').toLowerCase();
          return st.includes('active') || st.includes('handed') || st.includes('legal') || st.includes('pending');
        });
        if (active) {
          detected.push({
            id: 'handover',
            label: 'Handed Over / Legal',
            detail: `${active.handoverStatus || active.status || 'Handed Over'}${active.attorneyName ? ` — Attorney: ${active.attorneyName}` : ''}`,
            severity: 'critical',
            icon: '⚖️',
          });
        }
      }).catch(() => {}),

      this.fetchAccountBalance(accountId).then((bal: any) => {
        const items = Array.isArray(bal) ? bal : bal ? [bal] : [];
        if (!items.length) return;
        let totalArrears = 0;
        let totalOutstanding = 0;
        for (const item of items) {
          totalOutstanding += item.totalOutStanding || item.totalOutstandingAmount || item.totalBalance || item.outstandingBalance || 0;
          totalArrears += (item.days30 || 0) + (item.days60 || 0) + (item.days90 || 0) + (item.days120 || 0) + (item.days150 || 0) + (item.untill360 || 0);
        }
        if (totalArrears > 10000) {
          detected.push({
            id: 'high-arrears',
            label: 'High Arrears',
            detail: `Arrears (30+ days): R ${this.formatCurrency(totalArrears)} of R ${this.formatCurrency(totalOutstanding)} total`,
            severity: totalArrears > 50000 ? 'critical' : 'warning',
            icon: '⚠️',
          });
        } else if (totalArrears > 0) {
          detected.push({
            id: 'arrears',
            label: 'Arrears',
            detail: `Overdue (30+ days): R ${this.formatCurrency(totalArrears)}`,
            severity: 'warning',
            icon: '💰',
          });
        }
      }).catch(() => {}),

      firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/attp-application-history/${accountId}`)).then((data: any) => {
        const records = Array.isArray(data) ? data : data ? [data] : [];
        const activeIndigent = records.find((r: any) => {
          const st = (r.attpStatus || r.status || '').toLowerCase();
          return st.includes('active') || st.includes('approved') || st.includes('registered');
        });
        if (activeIndigent) {
          detected.push({
            id: 'indigent',
            label: 'Indigent',
            detail: `Subsidy active — ${activeIndigent.indigentType || activeIndigent.attpType || '-'}`,
            severity: 'info',
            icon: '🛡️',
          });
        }
      }).catch(() => {}),

      firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/name-info/${accountId}`)).then((name: any) => {
        if (!name) return;
        const n = Array.isArray(name) ? name[0] : name;
        if (n.deceased || n.isDeceased || n.dateOfDeath || n.deathDate) {
          detected.push({
            id: 'deceased',
            label: 'Owner Deceased',
            detail: n.dateOfDeath || n.deathDate ? `Date of death: ${this.formatDate(n.dateOfDeath || n.deathDate)}` : 'Owner marked as deceased',
            severity: 'critical',
            icon: '💀',
          });
        }
      }).catch(() => {}),
    ];

    await Promise.allSettled(checks);
    detected.sort((a, b) => {
      const ord: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (ord[a.severity] || 2) - (ord[b.severity] || 2);
    });
    this.riskFlags.set(detected);
    this.riskFlagsLoading.set(false);
  }

  async loadTabData(tab: string, accountId: number): Promise<void> {
    this.tabLoading.set(true);
    this.tabError.set(null);
    this.tabData.set(null);

    try {
      let data: any = null;
      switch (tab) {
        case 'account':
          const [basic, accountInfo, propDetails] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/basic-account-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-info-result/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/property-details/${accountId}`)),
          ]);
          data = {
            basic: basic.status === 'fulfilled' ? basic.value : null,
            accountInfo: accountInfo.status === 'fulfilled' ? accountInfo.value : null,
            property: propDetails.status === 'fulfilled' ? (Array.isArray(propDetails.value) ? propDetails.value[0] : propDetails.value) : null,
          };
          break;

        case 'balance':
          try {
            const balResult = await this.fetchAccountBalance(accountId);
            data = { balance: Array.isArray(balResult) ? balResult : balResult ? [balResult] : [] };
          } catch {
            data = { balance: [] };
          }
          break;

        case 'services':
          const [allSvc, svcSearch] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/all-services/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/services-search-results/${accountId}`)),
          ]);
          data = {
            services: allSvc.status === 'fulfilled' ? this.normalizeArray(allSvc.value) : [],
            searchServices: svcSearch.status === 'fulfilled' ? this.normalizeArray(svcSearch.value) : [],
          };
          break;

        case 'property':
          const [prop, consUnit, rates, meters, transfers] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/property-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/consumption-units/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-rates-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/metered-services-on-account/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/transfer-ownership/${accountId}`)),
          ]);
          const propVal = prop.status === 'fulfilled' ? (Array.isArray(prop.value) ? prop.value[0] : prop.value) : null;
          data = {
            property: propVal,
            consUnit: consUnit.status === 'fulfilled' ? (Array.isArray(consUnit.value) ? consUnit.value[0] : consUnit.value) : null,
            rates: rates.status === 'fulfilled' ? rates.value : null,
            meters: meters.status === 'fulfilled' ? this.normalizeArray(meters.value) : [],
            transfers: transfers.status === 'fulfilled' ? this.normalizeArray(transfers.value) : [],
          };
          break;

        case 'contact':
          const [contactDetails, contactHistory, deliveryHistory] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/contact-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/contact-details-history/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/delivery-address-history/${accountId}`)),
          ]);
          data = {
            contact: contactDetails.status === 'fulfilled' ? contactDetails.value : null,
            history: contactHistory.status === 'fulfilled' ? this.normalizeArray(contactHistory.value) : [],
            deliveryHistory: deliveryHistory.status === 'fulfilled' ? this.normalizeArray(deliveryHistory.value) : [],
          };
          break;

        case 'handover':
          const [handoverInfo, handoverEnquiry] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/handover-info/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/handover-account-enquiry/${accountId}`)),
          ]);
          data = {
            info: handoverInfo.status === 'fulfilled' ? handoverInfo.value : null,
            enquiry: handoverEnquiry.status === 'fulfilled' ? handoverEnquiry.value : null,
          };
          break;

        case 'name':
          const nameResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/name-info/${accountId}`)
          );
          data = { name: nameResult };
          break;

        case 'deposits':
          const [depositsResult, depositAmtResult] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/deposits/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/deposit-amount/${accountId}`)),
          ]);
          data = {
            deposits: depositsResult.status === 'fulfilled' ? this.normalizeArray(depositsResult.value) : [],
            depositAmount: depositAmtResult.status === 'fulfilled' ? depositAmtResult.value : null,
          };
          break;

        case 'transactions':
          const receiptResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/payment-amount-by-account-ids/${accountId}`)
          );
          data = { transactions: this.normalizeArray(receiptResult) };
          break;

        case 'payment-plans':
          const [plans, capital, repayment] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-plans-by-account-id/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-plan-remaining-capital/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/repayment-plan-status/${accountId}`)),
          ]);
          data = {
            plans: plans.status === 'fulfilled' ? this.normalizeArray(plans.value) : [],
            remainingCapital: capital.status === 'fulfilled' ? capital.value : null,
            repaymentStatus: repayment.status === 'fulfilled' ? this.normalizeArray(repayment.value) : [],
          };
          break;

        case 'incentives':
          const [incentiveResult, journalResult] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-incentive/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-incentive-journals/${accountId}`)),
          ]);
          data = {
            incentives: incentiveResult.status === 'fulfilled' ? this.normalizeArray(incentiveResult.value) : [],
            journals: journalResult.status === 'fulfilled' ? this.normalizeArray(journalResult.value) : [],
          };
          break;

        case 'notifications':
          const [acctNotif, propNotif] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-notifications/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/property-notification/${accountId}`)),
          ]);
          data = {
            accountNotifications: acctNotif.status === 'fulfilled' ? this.normalizeArray(acctNotif.value) : [],
            propertyNotifications: propNotif.status === 'fulfilled' ? this.normalizeArray(propNotif.value) : [],
          };
          break;

        case 'statements':
          const stmtResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/generated-statements/${accountId}`)
          );
          data = { statements: this.normalizeArray(stmtResult) };
          break;

        case 'clearance':
          const clearResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/clearance-inquiries/${accountId}`)
          );
          data = { clearances: this.normalizeArray(clearResult) };
          break;

        case 'debtor-notes':
          const notesResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/debtor-note-lists/${accountId}`)
          );
          data = { notes: this.normalizeArray(notesResult) };
          break;

        case 'section129':
          const s129Result = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/section129-account-enquiry/${accountId}`)
          );
          data = { section129: this.normalizeArray(s129Result) };
          break;

        case 'linked-accounts':
          const linkedResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/linked-accounts-on-property/${accountId}`)
          );
          data = { linkedAccounts: this.normalizeArray(linkedResult) };
          break;

        case 'debit-orders':
          const [doResult, doDeduction] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/debit-order-deduction-by-account/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/debit-order-deduction/${accountId}`)),
          ]);
          data = {
            debitOrders: doResult.status === 'fulfilled' ? this.normalizeArray(doResult.value) : [],
            deductions: doDeduction.status === 'fulfilled' ? this.normalizeArray(doDeduction.value) : [],
          };
          break;

        case 'rates':
          const [ratesDetail, ratesHistory] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-rates-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/rates-run-history/${accountId}`)),
          ]);
          data = {
            ratesDetails: ratesDetail.status === 'fulfilled' ? ratesDetail.value : null,
            ratesHistory: ratesHistory.status === 'fulfilled' ? this.normalizeArray(ratesHistory.value) : [],
          };
          break;

        case 'indigent':
          const indigentResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/attp-application-history/${accountId}`)
          );
          data = { indigentHistory: this.normalizeArray(indigentResult) };
          break;

        case 'services-meters':
          const [meteredSvc, meterReadings] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/metered-services-on-account/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-service-meter-per-property/${accountId}`)),
          ]);
          data = {
            meters: meteredSvc.status === 'fulfilled' ? this.normalizeArray(meteredSvc.value) : [],
            meterProperties: meterReadings.status === 'fulfilled' ? this.normalizeArray(meterReadings.value) : [],
          };
          break;

        case 'consumption':
          const [consumptionMeters] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/metered-services-on-account/${accountId}`)),
          ]);
          data = {
            meters: consumptionMeters.status === 'fulfilled' ? this.normalizeArray(consumptionMeters.value) : [],
          };
          break;

        case 'txn-detailed':
          const finYearForDetail = this.userFinYear();
          const txnDetailResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/transaction-history/${accountId}`, finYearForDetail ? { finYear: finYearForDetail } : undefined)
          );
          data = { transactions: this.normalizeArray(txnDetailResult) };
          break;

        case 'txn-summary':
          const finYearForSummary = this.userFinYear();
          const txnSummaryResult = await firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/service-type-balance/${accountId}`, finYearForSummary ? { financialYear: finYearForSummary } : undefined)
          );
          data = { summary: this.normalizeArray(txnSummaryResult) };
          break;

        case 'billed-vs-paid':
          const [billedVsPaid, billedBalance2] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/billed-vs-paid-amounts/${accountId}`)),
            this.fetchAccountBalance(accountId),
          ]);
          data = {
            billedVsPaid: billedVsPaid.status === 'fulfilled' ? this.normalizeArray(billedVsPaid.value) : [],
            balance: billedBalance2.status === 'fulfilled' ? (Array.isArray(billedBalance2.value) ? billedBalance2.value : billedBalance2.value ? [billedBalance2.value] : []) : [],
          };
          break;

        default:
          data = { message: 'Tab not implemented' };
      }

      this.tabData.set(data);
    } catch (e: any) {
      this.tabError.set(e?.error?.message || e?.message || 'Failed to load tab data');
    } finally {
      this.tabLoading.set(false);
    }
  }

  async fetchAccountBalance(accountId: number): Promise<any> {
    try {
      return await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/account-balance/${accountId}`)
      );
    } catch {
      const finYear = this.userFinYear();
      const params: Record<string, string> = { accountId: String(accountId) };
      if (finYear) params['financialYear'] = finYear;
      const svc = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/service-type-balance/${accountId}`, params)
      );
      return Array.isArray(svc) ? svc : svc ? [svc] : [];
    }
  }

  hasCriticalFlags(): boolean {
    return this.riskFlags().some(f => f.severity === 'critical');
  }

  getBalanceItems(): any[] {
    const data = this.tabData();
    return data?.balance || [];
  }

  getServicesList(): any[] {
    const data = this.tabData();
    const searchSvc = data?.searchServices || [];
    const allSvc = data?.services || [];
    return searchSvc.length > 0 ? searchSvc : allSvc;
  }

  getAccountBasic(): any {
    return this.tabData()?.basic || {};
  }

  getAccountProp(): any {
    return this.tabData()?.property || {};
  }

  getAccountAir(): any {
    return this.tabData()?.accountInfo || {};
  }
}
