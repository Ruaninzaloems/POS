import { Component, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { ExportService, ExportOptions } from '../../services/export.service';
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

  summaryFinYear = signal('');
  summaryData = signal<any[]>([]);
  summaryLoading = signal(false);
  summaryError = signal<string | null>(null);
  summaryAvailableYears = signal<string[]>([]);

  bvpFinYear = signal('');
  bvpAvailableYears = signal<string[]>([]);
  ratesFinYear = signal('');
  ratesAvailableYears = signal<string[]>([]);
  summarySource = signal<'monthly' | 'aging' | ''>('');

  detailFinYear = signal('');
  detailMonth = signal('');
  detailTransactions = signal<any[]>([]);
  detailLoading = signal(false);
  detailError = signal<string | null>(null);
  detailSelectedTxn = signal<any>(null);
  detailTxnData = signal<any>(null);
  detailTxnLoading = signal(false);
  detailMonths: string[] = ['July','August','September','October','November','December','January','February','March','April','May','June'];
  exportFromMonth = signal('July');
  exportToMonth = signal('June');
  exportingCsv = signal(false);

  consumptionSelectedMeter = signal<any>(null);
  consumptionHistory = signal<any[]>([]);
  consumptionAllHistory = signal<any[]>([]);
  consumptionHistoryLoading = signal(false);
  consumptionChartData = signal<any[]>([]);
  consumptionInsights = signal<any>(null);
  consumptionFinYears = signal<string[]>([]);
  consumptionSelectedYears = signal<string[]>([]);
  consumptionViewMode = signal<'chart' | 'table'>('chart');

  svcBalanceData = signal<any[]>([]);
  svcBalanceLoading = signal(false);
  svcBalanceError = signal('');
  svcSelectedService = signal<any>(null);
  svcBalanceFinYear = signal((() => {
    const now = new Date();
    const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${y}/${y + 1}`;
  })());

  consIntelligenceMonths = signal(6);
  consIntelligenceShow = signal(true);
  consBillingEstShow = signal(true);
  consBillingVatRate = signal(15);

  meterSelectedConv = signal<any>(null);
  meterConvHistory = signal<any[]>([]);
  meterConvLoading = signal(false);
  meterConvInsights = signal<any>(null);
  meterIntelMonths = signal(6);
  meterIntelShow = signal(true);
  meterEstShow = signal(true);
  meterEstVatRate = signal(15);
  meterSelectedPrepaid = signal<any>(null);
  meterPrepaidSales = signal<any[]>([]);
  meterPrepaidLoading = signal(false);
  meterPrepaidStats = signal<any>(null);

  indigentInsights = signal<any>(null);

  s129FinYear = signal('');
  s129Month = signal('');
  s129Loading = signal(false);
  s129Filtered = signal<any[]>([]);
  s129Insights = signal<any>(null);
  s129AvailableYears = signal<string[]>([]);

  stmtType = signal<'standard' | 'detailed'>('standard');
  stmtFinYear = signal('');
  stmtMonth = signal('');
  stmtGenerating = signal(false);
  stmtGenerated = signal<any>(null);
  stmtSending = signal(false);
  stmtSendMode = signal<'email' | 'sms' | null>(null);
  stmtEmail = signal('');
  stmtPhone = signal('');
  stmtAvailableYears = signal<string[]>([]);
  stmtMonths: string[] = ['', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];

  commMethod = signal<'email' | 'sms'>('email');
  commRecipient = signal('');
  commSubject = signal('');
  commMessage = signal('');
  commSending = signal(false);
  commTemplates = signal<any[]>([]);
  commTemplatesLoading = signal(false);
  commSelectedTemplate = signal('');
  commShowCompose = signal(false);

  linkedAccounts = signal<any[]>([]);
  linkedAccountsLoading = signal(false);
  linkedTotalOutstanding = signal(0);
  linkedExpandedAcct = signal<string | null>(null);
  linkedServicesMap = signal<Record<string, any[]>>({});
  linkedServicesLoading = signal<string | null>(null);

  propDebtAccounts = signal<any[]>([]);
  propDebtLoading = signal(false);
  propDebtTotals = signal<any>(null);
  propDebtExpandedAcct = signal<string | null>(null);

  receiptViewMode = signal<'list' | 'timeline'>('list');
  receiptFilter = signal<string>('all');
  receiptSortDir = signal<'desc' | 'asc'>('desc');
  receiptSelectedTxn = signal<any>(null);
  receiptDetailData = signal<any>(null);
  receiptDetailLoading = signal(false);
  receiptPrinting = signal<number | null>(null);

  relatedAccounts = signal<any[]>([]);
  relatedAccountsLoading = signal(false);
  relatedAccountsSearched = signal(false);

  occupiersList = signal<any[]>([]);
  occupierAddName = signal('');
  occupierAddId = signal('');
  occupierAddLoading = signal(false);
  occupierRemoveLoading = signal<number | null>(null);
  showAddOccupierModal = signal(false);
  showProofModal = signal(false);
  proofData = signal<any>(null);
  proofLoading = signal(false);
  selectedOccupierIdx = signal<number | null>(null);
  expandedClearanceRow = signal<number | null>(null);
  clearanceLinkedAccounts = signal<any[]>([]);

  generatingPropertyLetter = signal<string | null>(null);

  nbeLoading = signal(false);
  nbeCalculated = signal(false);
  nbeError = signal<string | null>(null);
  nbeLineItems = signal<any[]>([]);
  nbeBillingMonth = signal('');
  nbeWarnings = signal<string[]>([]);

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
        { value: 'property-debt', label: 'Property Debt', icon: '🏘️' },
        { value: 'txn-detailed', label: 'Transaction Detail', icon: '📋' },
        { value: 'txn-summary', label: 'Transaction Summary', icon: '📄' },
        { value: 'transactions', label: 'Receipts', icon: '🧾' },
        { value: 'deposits', label: 'Deposits', icon: '💵' },
        { value: 'payment-plans', label: 'Payment Plans', icon: '📅' },
        { value: 'extensions', label: 'Extensions', icon: '📆' },
        { value: 'billed-vs-paid', label: 'Billed vs Paid', icon: '📊' },
        { value: 'next-bill', label: 'Next Bill Estimate', icon: '🧮' },
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
        { value: 'occupiers', label: 'Occupiers', icon: '🏘️' },
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

  private exportService: ExportService;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private auth: AuthService,
  ) {
    this.exportService = new ExportService();
  }

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
    if (isNaN(n)) return '-';
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getObjectEntries(obj: any): { key: string; value: any }[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj)
      .filter(([k]) => !k.startsWith('_'))
      .map(([key, value]) => ({ key, value }));
  }

  camelToLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  }

  formatAutoValue(val: any): string {
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'number') return this.formatCurrency(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  }

  getBillingCycleDisplay(): string {
    const p = this.getAccountProp();
    const b = this.getAccountBasic();
    const cycle = p['billingCycle'] || p['billingCycleDesc'] || b['billingCycle'] || b['billingCycleDesc'];
    if (cycle) return cycle;
    const cycleDesc = p['cycleDescription'] || b['cycleDescription'];
    if (cycleDesc) return `1 ${cycleDesc}`;
    const cycleId = p['billingCycleID'] || b['billingCycleID'];
    if (cycleId) return `${cycleId} Consumer Account Cycle`;
    return '-';
  }

  getRegistrationStatusDisplay(): string {
    const p = this.getAccountProp();
    const regStatus = p['registrationStatus'] || p['regStatus'];
    if (regStatus === true || regStatus === 'true' || regStatus === 1 || regStatus === '1') return 'Registered';
    if (typeof regStatus === 'string' && regStatus.length > 0) return regStatus;
    if (p['rollNumber']) return 'Registered';
    return '-';
  }

  formatDepositDisplay(v: any): string {
    if (v === null || v === undefined || v === '') return '-';
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n)) return '-';
    return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  getObjectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj).sort();
  }

  isNumericValue(v: any): boolean {
    if (v === null || v === undefined || v === '') return false;
    return !isNaN(Number(v)) && typeof v !== 'boolean';
  }

  isCurrencyField(key: string): boolean {
    const lower = key.toLowerCase();
    return lower.includes('value') || lower.includes('amount') || lower.includes('rate') || lower.includes('rebate') || lower.includes('balance') || lower.includes('charge') || lower.includes('cost') || lower.includes('price') || lower.includes('tariff');
  }

  isDateField(key: string): boolean {
    const lower = key.toLowerCase();
    return lower.includes('date') || lower.endsWith('_dt') || lower.endsWith('on');
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
            if (full.unitID != null) (item as any).unitID = full.unitID;
            if (full.unitPartitionID != null) (item as any).unitPartitionID = full.unitPartitionID;
            if (full.propertyID) (item as any).propertyID = full.propertyID;
            if (full.contactDetails) (item as any).contactDetails = full.contactDetails;
            delete (item as any)._fromAutocomplete;
          }
        }

        if (!item.sgNumber && id) {
          try {
            const unitResult = await this.withTimeout(
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/consumption-units/${id}`)), 6000
            );
            if (this.quickSearchToken !== token) return;
            const units = this.normalizeArray(unitResult);
            if (units.length > 0) {
              const sg = units[0].sgNumber || units[0].sg_number || units[0].sgNo || units[0].lpiCode;
              if (sg) {
                item.sgNumber = sg;
                console.log('[enrich] SG from cons_unit for', id, ':', sg);
              }
              if (!item.unitID && units[0].unit_ID) (item as any).unitID = units[0].unit_ID;
            }
          } catch {}
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
          const total = bal.reduce((sum: number, s: any) => sum + (s.totalOutStanding ?? s.totalOutstandingAmount ?? s.totalOutstanding ?? s.outstandingBalance ?? s.closingBalance ?? s.closeBalance ?? 0), 0);
          item.outStandingAmount = total;
        } else if (bal) {
          const amount = bal.totalOutStanding ?? bal.totalBalance ?? bal.totalOutstanding ?? bal.balance ?? bal.outstandingAmount ?? bal.outStandingAmount ?? bal.closingBalance ?? bal.closeBalance;
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
            total = bal.reduce((sum: number, svc: any) => sum + (svc.totalOutStanding ?? svc.totalOutstanding ?? svc.totalOutstandingAmount ?? svc.outstandingBalance ?? svc.closingBalance ?? svc.closeBalance ?? 0), 0);
          } else {
            total = bal.totalBalance ?? bal.totalOutstanding ?? bal.totalOutStanding ?? bal.outStandingAmount ?? bal.outstandingBalance ?? bal.closingBalance ?? bal.closeBalance ?? bal.balance;
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

  private _loadTabGeneration = 0;

  async loadTabData(tab: string, accountId: number): Promise<void> {
    const generation = ++this._loadTabGeneration;
    console.log(`[loadTabData] tab=${tab} accountId=${accountId} gen=${generation}`);
    this.tabLoading.set(true);
    this.tabError.set(null);

    try {
      let data: any = null;
      switch (tab) {
        case 'account':
          const [basic, accountInfo, acctPropDetails, acctContactInfo, acctConsUnit, acctRates, acctDepositAmt, acctMgmt, acctSectTitle] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/basic-account-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-info-result/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/property-details-by-account/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/get-contact-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/consumption-units/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-rates-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/deposit-amount`, { accountId: String(accountId) })),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-account-management/account-information`, { accountId: String(accountId) })),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/sectional-title-scheme`, { accountId: String(accountId) })),
          ]);
          const basicVal = basic.status === 'fulfilled' ? (Array.isArray(basic.value) ? basic.value[0] : basic.value) : null;
          const airVal = accountInfo.status === 'fulfilled' ? (Array.isArray(accountInfo.value) ? accountInfo.value[0] : accountInfo.value) : null;
          const acctPropVal = acctPropDetails.status === 'fulfilled' ? (Array.isArray(acctPropDetails.value) ? acctPropDetails.value[0] : acctPropDetails.value) : null;
          const acctContactVal = acctContactInfo.status === 'fulfilled' ? (Array.isArray(acctContactInfo.value) ? acctContactInfo.value[0] : acctContactInfo.value) : null;
          const acctConsUnitVal = acctConsUnit.status === 'fulfilled' ? (Array.isArray(acctConsUnit.value) ? acctConsUnit.value[0] : acctConsUnit.value) : null;
          const acctRatesVal = acctRates.status === 'fulfilled' ? (Array.isArray(acctRates.value) ? acctRates.value[0] : acctRates.value) : null;
          const acctMgmtVal = acctMgmt.status === 'fulfilled' ? (Array.isArray(acctMgmt.value) ? acctMgmt.value[0] : acctMgmt.value) : null;
          const acctSectTitleVal = acctSectTitle.status === 'fulfilled' ? (Array.isArray(acctSectTitle.value) ? acctSectTitle.value[0] : acctSectTitle.value) : null;
          if (basicVal) console.log('[account] basic keys:', Object.keys(basicVal));
          if (airVal) console.log('[account] accountInfo keys:', Object.keys(airVal));
          if (acctPropVal) console.log('[account] property keys:', Object.keys(acctPropVal));
          if (acctContactVal) console.log('[account] contact keys:', Object.keys(acctContactVal));
          if (acctConsUnitVal) console.log('[account] consUnit keys:', Object.keys(acctConsUnitVal));
          if (acctRatesVal) console.log('[account] rates keys:', Object.keys(acctRatesVal));
          if (acctMgmtVal) console.log('[account] acctMgmt keys:', Object.keys(acctMgmtVal));
          if (acctSectTitleVal) console.log('[account] sectionalTitle keys:', Object.keys(acctSectTitleVal));
          const mergedBasic = { ...basicVal, ...airVal };
          if (acctDepositAmt.status === 'fulfilled' && acctDepositAmt.value != null) {
            const depVal = acctDepositAmt.value;
            const depAmount = typeof depVal === 'number' ? depVal : Number(depVal?.totalDeposit ?? depVal?.amount ?? depVal?.depositAmount ?? depVal) || 0;
            mergedBasic['paidDepositAmount'] = depAmount;
          }
          if (acctContactVal) {
            const phone = acctContactVal.contactNo || acctContactVal.contactNumber || acctContactVal.cellPhoneNo || acctContactVal.cellPhone || acctContactVal.tel_Mobile || acctContactVal.tel_Work || acctContactVal.tel_Home || '';
            if (phone) mergedBasic['contactNo'] = phone;
            const em = acctContactVal.emailId || acctContactVal.email || acctContactVal.emailAddress || '';
            if (em) mergedBasic['emailId'] = em;
            if (!mergedBasic['tel_Home'] && acctContactVal.tel_Home) mergedBasic['tel_Home'] = acctContactVal.tel_Home;
            if (!mergedBasic['tel_Work'] && acctContactVal.tel_Work) mergedBasic['tel_Work'] = acctContactVal.tel_Work;
            if (!mergedBasic['tel_Mobile'] && acctContactVal.tel_Mobile) mergedBasic['tel_Mobile'] = acctContactVal.tel_Mobile;
            if (!mergedBasic['fax'] && acctContactVal.fax) mergedBasic['fax'] = acctContactVal.fax;
          }
          let acctPropFinal = acctPropVal && !acctPropVal._error ? { ...acctPropVal } : {};
          if (!acctPropVal || acctPropVal._error) {
            if (basicVal) {
              if (basicVal.sgNumber) acctPropFinal['sgNumber'] = basicVal.sgNumber;
              if (basicVal.propertyID) acctPropFinal['propertyId'] = basicVal.propertyID;
              if (basicVal.unitPartitionID) acctPropFinal['unitPartitionID'] = basicVal.unitPartitionID;
              if (basicVal.longitude) acctPropFinal['longitude'] = basicVal.longitude;
              if (basicVal.latitude) acctPropFinal['latitude'] = basicVal.latitude;
              if (basicVal.fullAddress) acctPropFinal['locationAddress'] = basicVal.fullAddress;
              if (basicVal.creditStatusDesc) acctPropFinal['propertyStatus'] = basicVal.creditStatusDesc;
              if (!acctPropFinal['propertyStatus'] && basicVal.accountStatus) acctPropFinal['propertyStatus'] = basicVal.accountStatus;
              if (basicVal.solvencyDesc) acctPropFinal['solvencyDesc'] = basicVal.solvencyDesc;
            }
            if (airVal) {
              if (airVal.propertyStreet) acctPropFinal['propertyStreet'] = airVal.propertyStreet;
              if (airVal.zoneDesc) acctPropFinal['zoneDesc'] = airVal.zoneDesc;
              if (airVal.isMasterProperty) acctPropFinal['isMasterProperty'] = airVal.isMasterProperty;
              if (airVal.typeOfUseDesc) acctPropFinal['typeOfUseDesc'] = airVal.typeOfUseDesc;
              if (airVal.owner) acctPropFinal['owner'] = airVal.owner;
              if (airVal.streetName) acctPropFinal['streetName'] = airVal.streetName;
              if (airVal.streenNumber) acctPropFinal['streetNumber'] = airVal.streenNumber;
              if (airVal.town) acctPropFinal['town'] = airVal.town;
              if (airVal.suburb) acctPropFinal['suburb'] = airVal.suburb;
              if (airVal.postalCode) acctPropFinal['postalCode'] = airVal.postalCode;
              if (airVal.sgNumber && !acctPropFinal['sgNumber']) acctPropFinal['sgNumber'] = airVal.sgNumber;
              if (!acctPropFinal['locationAddress'] && airVal.streetName) {
                acctPropFinal['locationAddress'] = [airVal.streenNumber, airVal.streetName, airVal.suburb, airVal.town].filter(Boolean).join(', ');
              }
            }
            acctPropFinal['_fallback'] = true;
          }
          if (acctConsUnitVal && !acctConsUnitVal._error) {
            console.log('[account] consUnit data:', JSON.stringify(acctConsUnitVal));
            const cuKeys = ['propertyStatus', 'statusDesc', 'marketValue', 'propertyMarketValue', 'valuationCategory', 'valuationCat',
              'partitionDescription', 'partitionDesc', 'partitionMarketValue', 'partMarketValue',
              'billingCycle', 'billingCycleDesc', 'billingCycleID', 'cycleDescription',
              'allotmentArea', 'allotment', 'town', 'farmName', 'farm',
              'magisterialDistrict', 'magDistrict', 'ward',
              'registrationStatus', 'regStatus',
              'oldPropertyCode', 'oldPropCode', 'oldAccountCode',
              'sectionalTitleScheme', 'sectionalTitle',
              'propertyCategory', 'category', 'propertyType', 'typeOfUse', 'typeofUse',
              'accountableOwnerName', 'ownerName', 'name', 'owner',
              'rollNumber'];
            for (const k of cuKeys) {
              if (acctConsUnitVal[k] != null && acctConsUnitVal[k] !== '' && !acctPropFinal[k]) acctPropFinal[k] = acctConsUnitVal[k];
            }
          }
          if (acctRatesVal && !acctRatesVal._error) {
            console.log('[account] rates data:', JSON.stringify(acctRatesVal));
            const rtKeys = ['marketValue', 'propertyMarketValue', 'valuationCategory', 'valuationCat',
              'propertyStatus', 'statusDesc', 'partitionMarketValue', 'partMarketValue',
              'partitionDescription', 'partitionDesc', 'propertyCategory', 'category',
              'billingCycle', 'billingCycleDesc', 'accountableOwnerName', 'ownerName'];
            for (const k of rtKeys) {
              if (acctRatesVal[k] != null && acctRatesVal[k] !== '' && !acctPropFinal[k]) acctPropFinal[k] = acctRatesVal[k];
            }
          }
          if (acctMgmtVal && !acctMgmtVal._error) {
            console.log('[account] acctMgmt data:', JSON.stringify(acctMgmtVal).substring(0, 800));
            if (acctMgmtVal.cycleDescription && !acctPropFinal['cycleDescription']) {
              acctPropFinal['cycleDescription'] = acctMgmtVal.cycleDescription;
            }
            if (acctMgmtVal.billingCycleID && !acctPropFinal['billingCycleID']) {
              acctPropFinal['billingCycleID'] = acctMgmtVal.billingCycleID;
            }
          }
          if (acctSectTitleVal && !acctSectTitleVal._error) {
            console.log('[account] sectionalTitle data:', JSON.stringify(acctSectTitleVal).substring(0, 500));
            const stName = acctSectTitleVal.schemeName || acctSectTitleVal.description || acctSectTitleVal.sectionalTitleSchemeName || acctSectTitleVal.name;
            if (stName && !acctPropFinal['sectionalTitleScheme']) {
              acctPropFinal['sectionalTitleScheme'] = stName;
            }
          }
          if (airVal && !acctPropFinal['town'] && airVal.town) {
            acctPropFinal['town'] = airVal.town;
          }

          const unitPartId = acctPropFinal['unitPartitionID'] || acctPropFinal['unitPartition_ID'] ||
            basicVal?.unitPartitionID || basicVal?.unitPartition_ID ||
            airVal?.unitPartitionID || airVal?.unitPartition_ID ||
            acctConsUnitVal?.unitPartitionID || acctConsUnitVal?.unitPartition_ID;
          if (unitPartId) {
            console.log('[account] fetching partition-details & valuation for unitPartitionID:', unitPartId);
            const [partDetails, valuation, partOwner] = await Promise.allSettled([
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/partition-details`, { unitPartitionID: unitPartId })),
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/valuation-by-unit`, { unitPartitionID: unitPartId })),
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/unit-partition-owner`, { unitPartitionID: unitPartId })),
            ]);
            const partVal = partDetails.status === 'fulfilled' ? (Array.isArray(partDetails.value) ? partDetails.value[0] : partDetails.value) : null;
            const valuationVal = valuation.status === 'fulfilled' ? (Array.isArray(valuation.value) ? valuation.value[0] : valuation.value) : null;
            const partOwnerVal = partOwner.status === 'fulfilled' ? (Array.isArray(partOwner.value) ? partOwner.value[0] : partOwner.value) : null;
            if (partVal) console.log('[account] partition-details keys:', Object.keys(partVal), 'sample:', JSON.stringify(partVal).substring(0, 500));
            if (valuationVal) console.log('[account] valuation keys:', Object.keys(valuationVal), 'sample:', JSON.stringify(valuationVal).substring(0, 500));
            if (partOwnerVal) console.log('[account] partition-owner keys:', Object.keys(partOwnerVal), 'sample:', JSON.stringify(partOwnerVal).substring(0, 500));
            if (partVal && !partVal._error) {
              const partKeys = ['partitionDescription', 'partitionDesc', 'description', 'partitionMarketValue', 'partMarketValue',
                'marketValue', 'valuationCategory', 'valuationCat', 'valuationCategoryDesc',
                'propertyCategory', 'category', 'categoryDesc', 'propertyType', 'typeOfUse', 'typeofUse', 'typeOfUseDesc',
                'allotmentArea', 'allotment', 'farmName', 'farm', 'magisterialDistrict', 'magDistrict',
                'registrationStatus', 'regStatus', 'billingCycle', 'billingCycleDesc',
                'oldPropertyCode', 'oldPropCode', 'sectionalTitleScheme', 'sectionalTitle',
                'accountableOwnerName', 'ownerName', 'name', 'owner'];
              for (const k of partKeys) {
                if (partVal[k] != null && partVal[k] !== '' && !acctPropFinal[k]) acctPropFinal[k] = partVal[k];
              }
              if (!acctPropFinal['partitionDescription'] && partVal['description']) acctPropFinal['partitionDescription'] = partVal['description'];
              if (!acctPropFinal['partitionMarketValue'] && partVal['marketValue']) acctPropFinal['partitionMarketValue'] = partVal['marketValue'];
            }
            if (valuationVal && !valuationVal._error) {
              if (!acctPropFinal['marketValue'] && !acctPropFinal['propertyMarketValue']) {
                const mv = valuationVal['marketValue'] || valuationVal['propertyMarketValue'] || valuationVal['totalMarketValue'];
                if (mv != null && mv !== '') acctPropFinal['marketValue'] = mv;
              }
              if (!acctPropFinal['partitionMarketValue'] && !acctPropFinal['partMarketValue']) {
                const pmv = valuationVal['partitionMarketValue'] || valuationVal['partMarketValue'] || valuationVal['marketValue'];
                if (pmv != null && pmv !== '') acctPropFinal['partitionMarketValue'] = pmv;
              }
              if (!acctPropFinal['valuationCategory'] && !acctPropFinal['valuationCat']) {
                const vc = valuationVal['valuationCategory'] || valuationVal['valuationCat'] || valuationVal['valuationCategoryDesc'] || valuationVal['category'];
                if (vc != null && vc !== '') acctPropFinal['valuationCategory'] = vc;
              }
            }
            if (partOwnerVal && !partOwnerVal._error) {
              if (!acctPropFinal['accountableOwnerName'] && !acctPropFinal['ownerName']) {
                const ownerName = partOwnerVal['ownerName'] || partOwnerVal['name'] || partOwnerVal['accountableOwnerName'] ||
                  partOwnerVal['surname_Company'] || partOwnerVal['fullName'];
                if (ownerName) acctPropFinal['accountableOwnerName'] = ownerName;
              }
            }
          }

          data = {
            basic: mergedBasic,
            accountInfo: airVal,
            property: acctPropFinal,
          };
          this.loadLinkedAccounts(accountId);
          break;

        case 'balance':
          try {
            const balResult = await this.fetchAccountBalance(accountId);
            data = { balance: Array.isArray(balResult) ? balResult : balResult ? [balResult] : [] };
          } catch {
            data = { balance: [] };
          }
          break;

        case 'property-debt':
          data = { propertyDebt: true };
          this.loadPropertyDebt(accountId);
          break;

        case 'services':
          const [allSvc, svcSearch, addBilling, svcNotif] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/all-services/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/services-search-results/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/additional-billing-search-results/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-notifications/${accountId}`)),
          ]);
          data = {
            services: allSvc.status === 'fulfilled' ? this.normalizeArray(allSvc.value) : [],
            searchServices: svcSearch.status === 'fulfilled' ? this.normalizeArray(svcSearch.value) : [],
            additionalBilling: addBilling.status === 'fulfilled' ? this.normalizeArray(addBilling.value) : [],
            additionalInfo: svcNotif.status === 'fulfilled' ? this.normalizeArray(svcNotif.value) : [],
          };
          break;

        case 'property':
          const [prop, consUnit, rates, meters, transfers, propAcctInfo] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/property-details-by-account/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/consumption-units/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-rates-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/metered-services-on-account/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/transfer-ownership/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-info-result/${accountId}`)),
          ]);
          let propVal = prop.status === 'fulfilled' ? (Array.isArray(prop.value) ? prop.value[0] : prop.value) : null;
          if (propVal && propVal._error) propVal = null;
          if (!propVal) {
            const propAir = propAcctInfo.status === 'fulfilled' ? (Array.isArray(propAcctInfo.value) ? propAcctInfo.value[0] : propAcctInfo.value) : null;
            const propAcct = this.selectedAccount();
            if (propAir || propAcct) {
              const ownerName = propAir?.['owner'] || propAir?.['name'] || propAcct?.['name'] || propAcct?.['surname_Company'] || '';
              propVal = {
                propertyStreet: propAir?.['propertyStreet'] || propAcct?.['locationAddress'] || propAcct?.['address'] || '',
                owner: ownerName,
                name: ownerName,
                zoneDesc: propAir?.['zoneDesc'] || '',
                sgNumber: propAir?.['sgNumber'] || propAcct?.['sgNumber'] || '',
                typeOfUseDesc: propAir?.['typeOfUseDesc'] || '',
                isMasterProperty: propAir?.['isMasterProperty'] || '',
                accountDesc: propAir?.['accountDesc'] || propAcct?.['accountDesc'] || propAcct?.['accountType'] || '',
                institutionDesc: propAir?.['institutionDesc'] || '',
                groupCodeDesc: propAir?.['groupCodeDesc'] || '',
                deliverAddress: propAir?.['deliverAddress'] || propAcct?.['deliveryAddress'] || '',
                town: propAir?.['town'] || '',
                suburb: propAir?.['suburb'] || '',
                streetName: propAir?.['streetName'] || '',
                streenNumber: propAir?.['streenNumber'] || '',
                postalCode: propAir?.['postalCode'] || '',
                propertyId: propAcct?.['propertyID'] || '',
                _fallback: true,
              };
            }
          }
          const propConsUnitVal = consUnit.status === 'fulfilled' ? (Array.isArray(consUnit.value) ? consUnit.value[0] : consUnit.value) : null;
          const propRatesVal = rates.status === 'fulfilled' ? (Array.isArray(rates.value) ? rates.value[0] : rates.value) : null;
          if (propVal) {
            if (propConsUnitVal && !propConsUnitVal._error) {
              const enrichKeys = ['marketValue', 'propertyMarketValue', 'partitionMarketValue', 'partMarketValue',
                'valuationCategory', 'valuationCat', 'partitionDescription', 'partitionDesc',
                'propertyCategory', 'category', 'billingCycle', 'allotmentArea', 'farmName',
                'magisterialDistrict', 'registrationStatus', 'oldPropertyCode', 'sectionalTitleScheme',
                'accountableOwnerName', 'ownerName'];
              for (const k of enrichKeys) {
                if (propConsUnitVal[k] != null && propConsUnitVal[k] !== '' && !propVal[k]) propVal[k] = propConsUnitVal[k];
              }
            }
            if (propRatesVal && !propRatesVal._error) {
              const enrichKeys = ['marketValue', 'propertyMarketValue', 'partitionMarketValue', 'partMarketValue',
                'valuationCategory', 'valuationCat', 'partitionDescription', 'partitionDesc',
                'propertyCategory', 'category', 'billingCycle', 'accountableOwnerName', 'ownerName'];
              for (const k of enrichKeys) {
                if (propRatesVal[k] != null && propRatesVal[k] !== '' && !propVal[k]) propVal[k] = propRatesVal[k];
              }
            }
          }
          const propUnitPartId = propVal?.unitPartitionID || propVal?.unitPartition_ID ||
            propConsUnitVal?.unitPartitionID || propConsUnitVal?.unitPartition_ID;
          if (propUnitPartId && propVal) {
            console.log('[property] fetching partition & valuation for unitPartitionID:', propUnitPartId);
            const [propPartDetails, propValuation, propPartOwner] = await Promise.allSettled([
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/partition-details`, { unitPartitionID: propUnitPartId })),
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/valuation-by-unit`, { unitPartitionID: propUnitPartId })),
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/unit-partition-owner`, { unitPartitionID: propUnitPartId })),
            ]);
            const ppVal = propPartDetails.status === 'fulfilled' ? (Array.isArray(propPartDetails.value) ? propPartDetails.value[0] : propPartDetails.value) : null;
            const pvVal = propValuation.status === 'fulfilled' ? (Array.isArray(propValuation.value) ? propValuation.value[0] : propValuation.value) : null;
            const poVal = propPartOwner.status === 'fulfilled' ? (Array.isArray(propPartOwner.value) ? propPartOwner.value[0] : propPartOwner.value) : null;
            if (ppVal) console.log('[property] partition-details keys:', Object.keys(ppVal));
            if (pvVal) console.log('[property] valuation keys:', Object.keys(pvVal));
            if (poVal) console.log('[property] partition-owner keys:', Object.keys(poVal));
            if (ppVal && !ppVal._error) {
              const pKeys = ['partitionDescription', 'partitionDesc', 'description', 'partitionMarketValue', 'partMarketValue',
                'marketValue', 'valuationCategory', 'valuationCat', 'valuationCategoryDesc',
                'propertyCategory', 'category', 'categoryDesc', 'allotmentArea', 'farmName',
                'magisterialDistrict', 'registrationStatus', 'billingCycle', 'oldPropertyCode', 'sectionalTitleScheme',
                'accountableOwnerName', 'ownerName', 'name', 'owner'];
              for (const k of pKeys) {
                if (ppVal[k] != null && ppVal[k] !== '' && !propVal[k]) propVal[k] = ppVal[k];
              }
              if (!propVal['partitionDescription'] && ppVal['description']) propVal['partitionDescription'] = ppVal['description'];
              if (!propVal['partitionMarketValue'] && ppVal['marketValue']) propVal['partitionMarketValue'] = ppVal['marketValue'];
            }
            if (pvVal && !pvVal._error) {
              if (!propVal['marketValue'] && !propVal['propertyMarketValue']) {
                const mv = pvVal['marketValue'] || pvVal['propertyMarketValue'] || pvVal['totalMarketValue'];
                if (mv != null && mv !== '') propVal['marketValue'] = mv;
              }
              if (!propVal['partitionMarketValue'] && !propVal['partMarketValue']) {
                const pmv = pvVal['partitionMarketValue'] || pvVal['partMarketValue'] || pvVal['marketValue'];
                if (pmv != null && pmv !== '') propVal['partitionMarketValue'] = pmv;
              }
              if (!propVal['valuationCategory'] && !propVal['valuationCat']) {
                const vc = pvVal['valuationCategory'] || pvVal['valuationCat'] || pvVal['valuationCategoryDesc'] || pvVal['category'];
                if (vc != null && vc !== '') propVal['valuationCategory'] = vc;
              }
            }
            if (poVal && !poVal._error) {
              if (!propVal['accountableOwnerName'] && !propVal['ownerName']) {
                const on = poVal['ownerName'] || poVal['name'] || poVal['accountableOwnerName'] || poVal['surname_Company'] || poVal['fullName'];
                if (on) propVal['accountableOwnerName'] = on;
              }
            }
          }
          let propValuations: any[] = [];
          const propPropertyId = propVal?.propertyId || propVal?.property_ID || propConsUnitVal?.unit_ID;
          if (propPropertyId) {
            try {
              const valResult = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/supplementary-valuations`, { propertyId: propPropertyId }));
              propValuations = this.normalizeArray(valResult);
            } catch (e) {
              console.log('[property] supplementary valuations fetch failed:', e);
            }
          }
          data = {
            property: propVal,
            consUnit: propConsUnitVal,
            rates: rates.status === 'fulfilled' ? rates.value : null,
            meters: meters.status === 'fulfilled' ? this.normalizeArray(meters.value) : [],
            transfers: transfers.status === 'fulfilled' ? this.normalizeArray(transfers.value) : [],
            valuations: propValuations,
          };
          break;

        case 'contact':
          const [contactDetails, contactHistory, deliveryHistory, contactBasic, contactAir] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/contact-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/contact-details-history/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/delivery-address-history/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/basic-account-details/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-info-result/${accountId}`)),
          ]);
          const contactObj = contactDetails.status === 'fulfilled' ? (Array.isArray(contactDetails.value) ? contactDetails.value[0] : contactDetails.value) : {};
          const cBasic = contactBasic.status === 'fulfilled' ? (Array.isArray(contactBasic.value) ? contactBasic.value[0] : contactBasic.value) : null;
          const cAir = contactAir.status === 'fulfilled' ? (Array.isArray(contactAir.value) ? contactAir.value[0] : contactAir.value) : null;
          const mergedContact: Record<string, any> = { ...contactObj };
          if (cAir) {
            if (!mergedContact['town'] && cAir['town']) mergedContact['town'] = cAir['town'];
            if (!mergedContact['suburb'] && cAir['suburb']) mergedContact['suburb'] = cAir['suburb'];
            if (!mergedContact['postalCode'] && cAir['postalCode']) mergedContact['postalCode'] = cAir['postalCode'];
            if (!mergedContact['careOf'] && cAir['careOf']) mergedContact['careOf'] = cAir['careOf'];
            if (!mergedContact['streetName'] && cAir['streetName']) mergedContact['addressLine1'] = [cAir['streenNumber'], cAir['streetName']].filter(Boolean).join(' ');
            if (cAir['deliverAddress'] && !mergedContact['deliveryAddressType']) mergedContact['deliveryAddressType'] = cAir['deliverAddress'];
          }
          if (cBasic) {
            if (!mergedContact['postalCode'] && cBasic['postalCode']) mergedContact['postalCode'] = cBasic['postalCode'];
            if (!mergedContact['emailId'] && cBasic['emailId']) mergedContact['emailId'] = cBasic['emailId'];
            if (!mergedContact['email'] && !mergedContact['emailId'] && cBasic['emailId']) mergedContact['email'] = cBasic['emailId'];
            if (!mergedContact['tel_Mobile'] && cBasic['contactNo']) mergedContact['tel_Mobile'] = cBasic['contactNo'];
            const delAddr = cBasic['deliveryAddress'] || '';
            if (delAddr) {
              const lines = delAddr.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
              if (lines.length > 0 && !mergedContact['addressLine1']) mergedContact['addressLine1'] = lines[0];
              if (lines.length > 1 && !mergedContact['addressLine2']) mergedContact['addressLine2'] = lines[1];
              if (lines.length > 2 && !mergedContact['addressLine3']) mergedContact['addressLine3'] = lines[2];
              if (lines.length > 1 && !mergedContact['town']) mergedContact['town'] = lines[lines.length > 3 ? lines.length - 2 : 1];
            }
          }
          data = {
            contact: mergedContact,
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
          try {
            const [nameInfoResult, relatedAcctsResult] = await Promise.allSettled([
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/name-info/${accountId}`)),
              firstValueFrom(this.api.get<any>(`/api/platinum/accounts-by-name-id`, { accountId: String(accountId) })),
            ]);
            let nameVal: any = null;
            if (nameInfoResult.status === 'fulfilled') {
              const nr = nameInfoResult.value;
              nameVal = Array.isArray(nr) ? nr[0] : nr;
              if (nameVal && nameVal._error) nameVal = null;
            }
            if (!nameVal) {
              console.log('[name] name-info failed, building from basic-account-details + account-info');
              const [nameBasic, nameAcctInfo] = await Promise.allSettled([
                firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/basic-account-details/${accountId}`)),
                firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-info-result/${accountId}`)),
              ]);
              const nb = nameBasic.status === 'fulfilled' ? (Array.isArray(nameBasic.value) ? nameBasic.value[0] : nameBasic.value) : null;
              const na = nameAcctInfo.status === 'fulfilled' ? (Array.isArray(nameAcctInfo.value) ? nameAcctInfo.value[0] : nameAcctInfo.value) : null;
              const acct = this.selectedAccount();
              const fallback: Record<string, any> = {};
              fallback['firstNames'] = nb?.['fullNAME'] || na?.['name'] || acct?.['name'] || acct?.['surname_Company'] || '';
              fallback['initials'] = nb?.['initials'] || '';
              fallback['idNo_RegistrationNo'] = acct?.['idRegistrationNumber'] || '';
              fallback['_fallback'] = true;
              nameVal = fallback;
            }
            let relatedAccts: any[] = [];
            if (relatedAcctsResult.status === 'fulfilled') {
              const r = relatedAcctsResult.value;
              if (r && Array.isArray(r.accounts)) {
                relatedAccts = r.accounts;
              }
            }
            data = { name: nameVal, relatedAccounts: relatedAccts };
          } catch (nameErr: any) {
            console.log('[name] Error loading name tab:', nameErr?.message);
            data = { name: null, relatedAccounts: [] };
          }
          break;

        case 'deposits':
          const [depositsResult, depositAmtResult, refundsResult, reversalsResult, bankGuaranteeResult] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/deposits/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/deposit-amount/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/refunds/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-reversals/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/deposit-bank-guarantee/${accountId}`)),
          ]);
          data = {
            deposits: depositsResult.status === 'fulfilled' ? this.normalizeArray(depositsResult.value) : [],
            depositAmount: depositAmtResult.status === 'fulfilled' ? depositAmtResult.value : null,
            refunds: refundsResult.status === 'fulfilled' ? this.normalizeArray(refundsResult.value) : [],
            reversals: reversalsResult.status === 'fulfilled' ? this.normalizeArray(reversalsResult.value) : [],
            bankGuarantees: bankGuaranteeResult.status === 'fulfilled' ? this.normalizeArray(bankGuaranteeResult.value) : [],
          };
          break;

        case 'transactions':
          try {
            const receiptResult = await firstValueFrom(
              this.api.get<any>(`/api/platinum/billing-enquiry/payment-amount-by-account-ids/${accountId}`)
            );
            const receiptArr = this.normalizeArray(receiptResult);
            if (receiptArr.length > 0) {
              console.log('[transactions] API response keys:', Object.keys(receiptArr[0]));
              console.log('[transactions] Sample row:', JSON.stringify(receiptArr[0]).substring(0, 500));
            }
            data = { transactions: receiptArr };
          } catch (e: any) {
            console.error('[transactions] API failed:', e?.message);
            data = { transactions: [], _error: e?.message || 'Failed to load receipts' };
          }
          break;

        case 'payment-plans':
          const [plans, capital, repayment, ppExtensions, ppPaymentAmounts] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-plans-by-account-id/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-plan-remaining-capital/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/repayment-plan-status/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-extension-search-results/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/payment-amount-by-account-ids/${accountId}`)),
          ]);
          data = {
            plans: plans.status === 'fulfilled' ? this.normalizeArray(plans.value) : [],
            remainingCapital: capital.status === 'fulfilled' ? capital.value : null,
            repaymentStatus: repayment.status === 'fulfilled' ? this.normalizeArray(repayment.value) : [],
            extensions: ppExtensions.status === 'fulfilled' ? this.normalizeArray(ppExtensions.value) : [],
            paymentAmounts: ppPaymentAmounts.status === 'fulfilled' ? this.normalizeArray(ppPaymentAmounts.value) : [],
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
          try {
            const stmtResult = await firstValueFrom(
              this.api.get<any>(`/api/platinum/billing-enquiry/generated-statements/${accountId}`)
            );
            const stmtArr = this.normalizeArray(stmtResult);
            if (stmtArr.length > 0) {
              console.log('[statements] API response keys:', Object.keys(stmtArr[0]));
              console.log('[statements] Sample row:', JSON.stringify(stmtArr[0]).substring(0, 500));
            } else {
              console.log('[statements] No statement history returned');
            }
            data = { statements: stmtArr };
            this.stmtGenerated.set(null);
            this.stmtSendMode.set(null);
            this.initStmtYears(stmtArr);
          } catch (e: any) {
            console.error('[statements] API failed:', e?.message);
            data = { statements: [], _error: e?.message || 'Failed to load statements' };
            this.stmtGenerated.set(null);
            this.stmtSendMode.set(null);
          }
          break;

        case 'clearance':
          this.expandedClearanceRow.set(null);
          try {
            const [clearResult, linkedResult] = await Promise.allSettled([
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/clearance-inquiries/${accountId}`)),
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/linked-accounts-on-property/${accountId}`)),
            ]);
            const clearArr = clearResult.status === 'fulfilled' ? this.normalizeArray(clearResult.value) : [];
            const linkedArr = linkedResult.status === 'fulfilled' ? this.normalizeArray(linkedResult.value) : [];
            this.clearanceLinkedAccounts.set(linkedArr);
            data = { clearances: clearArr };
            if (clearResult.status === 'rejected') {
              data._error = clearResult.reason?.message || 'Failed to load clearance data';
            }
          } catch (e: any) {
            console.error('[clearance] API failed:', e?.message);
            data = { clearances: [], _error: e?.message || 'Failed to load clearance data' };
            this.clearanceLinkedAccounts.set([]);
          }
          break;

        case 'debtor-notes':
          try {
            const notesResult = await firstValueFrom(
              this.api.get<any>(`/api/platinum/billing-enquiry/debtor-note-lists/${accountId}`)
            );
            data = { notes: this.normalizeArray(notesResult) };
          } catch (e: any) {
            console.error('[debtor-notes] API failed:', e?.message);
            data = { notes: [], _error: e?.message || 'Failed to load debtor notes' };
          }
          break;

        case 'section129':
          try {
            const s129Result = await firstValueFrom(
              this.api.get<any>(`/api/platinum/billing-enquiry/section129-account-enquiry/${accountId}`)
            );
            const s129Arr = this.normalizeArray(s129Result);
            data = { section129: s129Arr };
            this.s129FinYear.set('');
            this.s129Month.set('');
            this.s129Filtered.set(s129Arr);
            this.initS129Years(s129Arr);
            this.computeS129Insights(s129Arr);
          } catch (e: any) {
            console.error('[section129] API failed:', e?.message);
            data = { section129: [], _error: e?.message || 'Failed to load Section 129 data' };
            this.s129FinYear.set('');
            this.s129Month.set('');
            this.s129Filtered.set([]);
          }
          break;

        case 'linked-accounts':
          const [linkedSettled] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/linked-accounts-on-property/${accountId}`))
          ]);
          const linkedArr = linkedSettled.status === 'fulfilled' ? this.normalizeArray(linkedSettled.value) : [];
          linkedArr.sort((a: any, b: any) => {
            const numA = a.accountNumber || a.accountNo || '';
            const numB = b.accountNumber || b.accountNo || '';
            return String(numA).localeCompare(String(numB), undefined, { numeric: true });
          });
          data = { linkedAccounts: linkedArr };
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
          this.initRatesYears();
          if (!this.ratesFinYear()) {
            this.ratesFinYear.set(this.userFinYear() || this.getCurrentFinYear());
          }
          const ratesFy = this.ratesFinYear();
          const fyP: Record<string, string> = ratesFy ? { financialYear: ratesFy } : {};
          const ratesFyParam: Record<string, string> = ratesFy ? { finYear: ratesFy } : {};
          const [ratesDetail, ratesHistory, ratesBalance, ratesServiceBal, ratesPropDetails] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-rates-details/${accountId}`, ratesFyParam)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/rates-run-history/${accountId}`, ratesFyParam)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/total-balance-debt-inquiry/${accountId}`, fyP)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/service-type-balance/${accountId}`, fyP)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/property-details-by-account/${accountId}`)),
          ]);
          const ratesDetailVal = ratesDetail.status === 'fulfilled' ? (Array.isArray(ratesDetail.value) ? ratesDetail.value[0] : ratesDetail.value) : null;
          const ratesHistoryVal = ratesHistory.status === 'fulfilled' ? this.normalizeArray(ratesHistory.value) : [];
          const balanceItems = ratesBalance.status === 'fulfilled' ? this.normalizeArray(ratesBalance.value) : [];
          const svcBalItems = ratesServiceBal.status === 'fulfilled' ? this.normalizeArray(ratesServiceBal.value) : [];
          const propDetailsVal = ratesPropDetails.status === 'fulfilled' ? (Array.isArray(ratesPropDetails.value) ? ratesPropDetails.value[0] : ratesPropDetails.value) : null;
          const ratesServiceItems = svcBalItems.filter((s: any) => {
            const desc = (s.serviceDescription || s.description || '').toLowerCase();
            return desc.includes('rate') || desc.includes('property') || desc.includes('valuation');
          });
          const ratesBalanceItems = balanceItems.filter((b: any) => {
            const desc = (b.serviceDescription || b.description || '').toLowerCase();
            return desc.includes('rate') || desc.includes('property') || desc.includes('valuation');
          });
          if (ratesDetailVal) console.log('[rates] account-rates-details keys:', Object.keys(ratesDetailVal));
          if (balanceItems.length) console.log('[rates] balance items count:', balanceItems.length, 'rates-filtered:', ratesBalanceItems.length);
          if (svcBalItems.length) console.log('[rates] service-type-balance count:', svcBalItems.length, 'rates-filtered:', ratesServiceItems.length);
          if (propDetailsVal) console.log('[rates] property-details keys:', Object.keys(propDetailsVal));

          const propId = propDetailsVal?.property_ID || propDetailsVal?.propertyID || propDetailsVal?.propertyId || accountId;
          let valuationsArr: any[] = [];
          let valuationDataVal: any = null;
          let valuationImportVal: any = null;
          if (propId) {
            const [suppVal, valById, valImport] = await Promise.allSettled([
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/supplementary-valuations`, { propertyId: String(propId) })),
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/valuation-by-id`, { propertyId: String(propId) })),
              firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/valuation-import-by-id`, { propertyId: String(propId) })),
            ]);
            valuationsArr = suppVal.status === 'fulfilled' ? this.normalizeArray(suppVal.value) : [];
            valuationDataVal = valById.status === 'fulfilled' && valById.value && !valById.value._error ? (Array.isArray(valById.value) ? valById.value[0] : valById.value) : null;
            valuationImportVal = valImport.status === 'fulfilled' && valImport.value && !valImport.value._error ? (Array.isArray(valImport.value) ? valImport.value[0] : valImport.value) : null;
            console.log('[rates] valuations count:', valuationsArr.length, 'valById:', valuationDataVal ? Object.keys(valuationDataVal).length + ' keys' : 'null', 'valImport:', valuationImportVal ? Object.keys(valuationImportVal).length + ' keys' : 'null');
          }

          data = {
            ratesDetails: ratesDetailVal && !ratesDetailVal._error ? ratesDetailVal : null,
            ratesHistory: ratesHistoryVal,
            ratesBalanceItems: ratesBalanceItems,
            ratesServiceItems: ratesServiceItems,
            allBalanceItems: balanceItems,
            allServiceItems: svcBalItems,
            propertyDetails: propDetailsVal && !propDetailsVal._error ? propDetailsVal : null,
            valuations: valuationsArr,
            valuationData: valuationDataVal,
            valuationImport: valuationImportVal,
          };
          break;

        case 'indigent':
          try {
            const indigentResult = await firstValueFrom(
              this.api.get<any>(`/api/platinum/billing-enquiry/attp-application-history/${accountId}`)
            );
            const indHistory = this.normalizeArray(indigentResult);
            data = { indigentHistory: indHistory };
            this.indigentInsights.set(this.computeIndigentInsights(indHistory));
          } catch (e: any) {
            console.error('[indigent] API failed:', e?.message);
            data = { indigentHistory: [], _error: e?.message || 'Failed to load indigent subsidy data' };
            this.indigentInsights.set(null);
          }
          break;

        case 'services-meters':
          const [meteredSvc, meterReadings, prepaidMeters] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/metered-services-on-account/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-service-meter-per-property/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/prepaid-meter-services-for-account`, { accountId: String(accountId) })),
          ]);
          const allMeters = meteredSvc.status === 'fulfilled' ? this.normalizeArray(meteredSvc.value) : [];
          const prepaidList = prepaidMeters.status === 'fulfilled' ? this.normalizeArray(prepaidMeters.value) : [];
          const convMeters = allMeters.filter((m: any) => !this.isPrepaidMeter(m));
          const ppMeters = allMeters.filter((m: any) => this.isPrepaidMeter(m));
          const finalPrepaid = ppMeters.length > 0 ? ppMeters : prepaidList;
          data = {
            meters: allMeters,
            conventionalMeters: convMeters,
            prepaidMeters: finalPrepaid,
            meterProperties: meterReadings.status === 'fulfilled' ? this.normalizeArray(meterReadings.value) : [],
          };
          this.meterSelectedConv.set(null);
          this.meterConvHistory.set([]);
          this.meterConvInsights.set(null);
          this.meterSelectedPrepaid.set(null);
          this.meterPrepaidSales.set([]);
          this.meterPrepaidStats.set(null);
          if (convMeters.length > 0) {
            this.selectConvMeter(convMeters[0]);
          }
          if (finalPrepaid.length > 0) {
            this.selectPrepaidMeter(finalPrepaid[0]);
          }
          break;

        case 'consumption':
          const [consumptionMeters, unitLinkedMeters] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/metered-services-on-account/${accountId}`)),
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/unit-linked-meters`, { accountId: String(accountId) })),
          ]);
          const meterList = consumptionMeters.status === 'fulfilled' ? this.normalizeArray(consumptionMeters.value) : [];
          const linkedMeters = unitLinkedMeters.status === 'fulfilled' ? this.normalizeArray(unitLinkedMeters.value) : [];
          const combinedMeters = meterList.length > 0 ? meterList : linkedMeters;
          data = { meters: combinedMeters };
          this.consumptionSelectedMeter.set(null);
          this.consumptionHistory.set([]);
          this.consumptionChartData.set([]);
          this.consumptionInsights.set(null);
          if (combinedMeters.length > 0) {
            this.selectConsumptionMeter(combinedMeters[0]);
          }
          break;

        case 'txn-detailed':
          this.initSummaryYears();
          if (!this.detailFinYear()) {
            this.detailFinYear.set(this.userFinYear() || this.getCurrentFinYear());
          }
          const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
          const finMonths = this.detailMonths;
          const matchMonth = finMonths.find(m => m === currentMonth);
          if (matchMonth) {
            this.detailMonth.set(matchMonth);
            this.exportFromMonth.set('July');
            this.exportToMonth.set(matchMonth);
          }
          this.loadDetailedTransactions();
          data = { _detailTab: true };
          break;

        case 'txn-summary':
          this.initSummaryYears();
          if (!this.summaryFinYear()) {
            this.summaryFinYear.set(this.userFinYear() || this.getCurrentFinYear());
          }
          await this.loadTransactionSummary(accountId, this.summaryFinYear());
          data = { _summaryManaged: true };
          break;

        case 'billed-vs-paid':
          this.initBvpYears();
          if (!this.bvpFinYear()) {
            this.bvpFinYear.set(this.userFinYear() || this.getCurrentFinYear());
          }
          const bvpYear = this.bvpFinYear();
          const [billedVsPaid, billedBalance2] = await Promise.allSettled([
            firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/billed-vs-paid-amounts`, { accountId: String(accountId), financialYear: bvpYear })),
            this.fetchAccountBalance(accountId),
          ]);
          const bvpArr = billedVsPaid.status === 'fulfilled' ? this.normalizeArray(billedVsPaid.value) : [];
          const balArr = billedBalance2.status === 'fulfilled' ? this.normalizeArray(billedBalance2.value) : [];
          if (bvpArr.length > 0) {
            console.log('[billed-vs-paid] sample keys:', Object.keys(bvpArr[0]), 'sample:', JSON.stringify(bvpArr[0]).substring(0, 500));
          } else {
            console.log('[billed-vs-paid] billedVsPaid empty. status:', billedVsPaid.status, billedVsPaid.status === 'rejected' ? (billedVsPaid as any).reason?.message : '');
          }
          if (balArr.length > 0) {
            console.log('[billed-vs-paid] balance sample keys:', Object.keys(balArr[0]));
          } else {
            console.log('[billed-vs-paid] balance empty. status:', billedBalance2.status, billedBalance2.status === 'rejected' ? (billedBalance2 as any).reason?.message : '');
          }
          data = {
            billedVsPaid: bvpArr,
            balance: balArr,
          };
          break;

        case 'occupiers':
          try {
            const occResult = await firstValueFrom(
              this.api.get<any>(`/api/platinum/billing-enquiry/add-occupiers/${accountId}`)
            );
            const occArr = this.normalizeArray(occResult);
            data = { occupiers: occArr };
            this.occupiersList.set(occArr);
            this.selectedOccupierIdx.set(null);
          } catch (e: any) {
            data = { occupiers: [], _error: e?.message || 'Failed to load occupiers' };
            this.occupiersList.set([]);
          }
          break;

        case 'extensions':
          try {
            const extResult = await firstValueFrom(
              this.api.get<any>(`/api/platinum/billing-enquiry/payment-extension-search-results/${accountId}`)
            );
            data = { extensions: this.normalizeArray(extResult) };
          } catch (e: any) {
            data = { extensions: [], _error: e?.message || 'Failed to load payment extensions' };
          }
          break;

        case 'next-bill':
          data = { _nextBillTab: true };
          break;

        default:
          data = { message: 'Tab not implemented' };
      }

      if (generation === this._loadTabGeneration) {
        this.tabData.set(data);
        if (tab === 'name') {
          this.relatedAccounts.set(data?.relatedAccounts || []);
          this.relatedAccountsSearched.set(!!data?.relatedAccounts);
        }
      }
    } catch (e: any) {
      if (generation === this._loadTabGeneration) {
        this.tabError.set(e?.error?.message || e?.message || 'Failed to load tab data');
      }
    } finally {
      if (generation === this._loadTabGeneration) {
        this.tabLoading.set(false);
      }
    }
  }

  async fetchAccountBalance(accountId: number): Promise<any> {
    const fy = this.userFinYear();
    const fyParams: Record<string, string> = {};
    if (fy) fyParams['financialYear'] = fy;

    try {
      const res = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/total-balance-debt-inquiry/${accountId}`, fyParams)
      );
      if (res && !res._error) {
        console.log('[balance] TotalBalanceDebtInquiry OK for', accountId);
        return Array.isArray(res) ? res : res ? [res] : [];
      }
    } catch {
      console.log('[balance] TotalBalanceDebtInquiry failed for', accountId);
    }

    try {
      const res = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/close-balance-detail/${accountId}`, fyParams)
      );
      if (res && !res._error) {
        console.log('[balance] getCloseBalanceDetail OK for', accountId);
        return Array.isArray(res) ? res : res ? [res] : [];
      }
    } catch {
      console.log('[balance] getCloseBalanceDetail failed for', accountId);
    }

    try {
      const res = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/account-balance/${accountId}`)
      );
      if (res && !res._error) {
        console.log('[balance] TotalBalanceDebt OK for', accountId);
        return Array.isArray(res) ? res : res ? [res] : [];
      }
    } catch {
      console.log('[balance] TotalBalanceDebt failed for', accountId);
    }

    try {
      const res = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/service-type-balance/${accountId}`, fyParams)
      );
      if (res && !res._error) {
        console.log('[balance] ServiceTypeBalanceDetails OK for', accountId);
        return Array.isArray(res) ? res : res ? [res] : [];
      }
    } catch {
      console.log('[balance] ServiceTypeBalanceDetails failed for', accountId);
    }

    return [];
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

  getFilteredReceipts(): any[] {
    const txns = this.tabData()?.transactions || [];
    const filter = this.receiptFilter();
    const dir = this.receiptSortDir();
    let filtered = txns;
    if (filter !== 'all') {
      filtered = txns.filter((t: any) => {
        const pt = (t.paymentType || '').toLowerCase();
        if (filter === 'eft') return pt === 'eft';
        if (filter === 'cash') return pt === 'cash';
        if (filter === 'card') return pt.includes('card') || pt.includes('credit') || pt.includes('debit');
        if (filter === 'cancelled') return !!(t.isCancelled || t.cancelReson || t.cancelReason);
        return true;
      });
    }
    const sorted = [...filtered].sort((a: any, b: any) => {
      const da = new Date(a.receiptDate || a.transactionDate || a.date || 0).getTime();
      const db = new Date(b.receiptDate || b.transactionDate || b.date || 0).getTime();
      return dir === 'desc' ? db - da : da - db;
    });
    return sorted;
  }

  getReceiptPaymentTypes(): { type: string; count: number; total: number }[] {
    const txns = this.tabData()?.transactions || [];
    const map: Record<string, { count: number; total: number }> = {};
    for (const t of txns) {
      const pt = t.paymentType || 'Unknown';
      if (!map[pt]) map[pt] = { count: 0, total: 0 };
      map[pt].count++;
      map[pt].total += Number(t.receiptAmount || t.amount || t.tenderAmount || 0);
    }
    return Object.entries(map).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.total - a.total);
  }

  getReceiptStats(): { total: number; count: number; avgAmount: number; latestDate: string; oldestDate: string; eftCount: number; cashCount: number; cardCount: number; cancelledCount: number } {
    const txns = this.tabData()?.transactions || [];
    let total = 0, eftCount = 0, cashCount = 0, cardCount = 0, cancelledCount = 0;
    let latestDate = '', oldestDate = '';
    for (const t of txns) {
      total += Number(t.receiptAmount || t.amount || t.tenderAmount || 0);
      const pt = (t.paymentType || '').toLowerCase();
      if (pt === 'eft') eftCount++;
      else if (pt === 'cash') cashCount++;
      else if (pt.includes('card') || pt.includes('credit') || pt.includes('debit')) cardCount++;
      if (t.isCancelled || t.cancelReson || t.cancelReason) cancelledCount++;
      const d = t.receiptDate || t.transactionDate || t.date || '';
      if (d && (!latestDate || d > latestDate)) latestDate = d;
      if (d && (!oldestDate || d < oldestDate)) oldestDate = d;
    }
    return { total, count: txns.length, avgAmount: txns.length ? total / txns.length : 0, latestDate, oldestDate, eftCount, cashCount, cardCount, cancelledCount };
  }

  getReceiptTimelineGroups(): { label: string; month: string; receipts: any[] }[] {
    const txns = this.getFilteredReceipts();
    const groups: Record<string, any[]> = {};
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    for (const t of txns) {
      const d = new Date(t.receiptDate || t.transactionDate || t.date || 0);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (!groups[key]) groups[key] = [];
      (groups[key] as any).__label = label;
      groups[key].push(t);
    }
    const entries = Object.entries(groups).sort((a, b) => this.receiptSortDir() === 'desc' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]));
    return entries.map(([month, receipts]) => ({ label: (receipts as any).__label, month, receipts }));
  }

  sumReceiptAmounts = (sum: number, t: any) => sum + Number(t.receiptAmount || t.amount || t.tenderAmount || 0);

  getReceiptKey(txn: any): number {
    if (!txn) return 0;
    return Number(txn.receiptID || txn.receipt_ID || txn.receiptId || 0);
  }

  getReceiptNo(txn: any): string {
    return txn.receiptNo || txn.receiptNumber || txn.receipt_No || '';
  }

  getReceiptPaymentIcon(type: string): string {
    const t = (type || '').toLowerCase();
    if (t === 'eft') return '🏦';
    if (t === 'cash') return '💵';
    if (t.includes('card') || t.includes('credit') || t.includes('debit')) return '💳';
    return '📄';
  }

  getReceiptStatusClass(txn: any): string {
    if (txn.isCancelled || txn.cancelReson || txn.cancelReason) return 'rcpt-cancelled';
    const t = (txn.paymentType || '').toLowerCase();
    if (t === 'eft') return 'rcpt-eft';
    if (t === 'cash') return 'rcpt-cash';
    if (t.includes('card') || t.includes('credit') || t.includes('debit')) return 'rcpt-card';
    return '';
  }

  isEftReceipt(txn: any): boolean {
    return (txn.paymentType || '').toLowerCase() === 'eft';
  }

  getEftBankDescription(txn: any): string {
    const no = this.getReceiptNo(txn);
    const bank = txn.cashBook || '';
    const noUpper = no.toUpperCase();
    if (!noUpper.startsWith('EFT')) {
      if (bank) return `EFT via ${bank}`;
      return 'EFT Payment';
    }
    const parts = no.substring(3).split('/');
    const dateStr = parts[0] || '';
    const ref = parts[1] || '';
    let desc = `EFT`;
    if (bank) desc += ` via ${bank}`;
    if (dateStr.length === 8) {
      const d = dateStr.substring(0, 2);
      const m = dateStr.substring(2, 4);
      const y = dateStr.substring(4, 8);
      desc += ` | Processed: ${d}/${m}/${y}`;
    }
    if (ref) desc += ` | Ref: ${ref}`;
    return desc;
  }

  async selectReceiptForDetail(txn: any): Promise<void> {
    const key = this.getReceiptKey(txn);
    if (this.getReceiptKey(this.receiptSelectedTxn()) === key && key > 0) {
      this.receiptSelectedTxn.set(null);
      this.receiptDetailData.set(null);
      return;
    }
    this.receiptSelectedTxn.set(txn);
    this.receiptDetailData.set(null);
    this.receiptDetailLoading.set(true);
    try {
      const receiptId = key;
      if (receiptId) {
        const detail = await firstValueFrom(
          this.api.get<any>(`/api/platinum/billing-enquiry/receipt-transaction-detail`, { receiptId: String(receiptId) })
        );
        const arr = this.normalizeArray(detail);
        if (arr.length > 0) {
          console.log('[receipt-detail] keys:', Object.keys(arr[0]));
        }
        this.receiptDetailData.set({ lines: arr });
      }
    } catch (e) {
      console.error('[receipt-detail] Failed:', e);
      this.receiptDetailData.set({ error: true });
    } finally {
      this.receiptDetailLoading.set(false);
    }
  }

  async printReceipt(txn: any, event?: Event): Promise<void> {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    const receiptId = this.getReceiptKey(txn);
    if (!receiptId) {
      this.toast.show('No receipt ID available for printing', 'error');
      return;
    }
    this.receiptPrinting.set(receiptId);
    try {
      const response = await fetch('/api/platinum/billing-payment/print-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [Number(receiptId)], receiptNos: [txn.receiptNo || ''], isReprint: true }),
      });
      if (!response.ok) throw new Error(`Print failed: ${response.status}`);
      const blob = await response.blob();
      if (blob.size < 200) {
        this.toast.show('Receipt PDF is empty or unavailable', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) {
        w.addEventListener('load', () => { setTimeout(() => { w.print(); }, 500); });
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      this.toast.show('Receipt opened for printing', 'success');
    } catch (e: any) {
      console.error('[print-receipt] Error:', e);
      this.toast.show('Failed to print receipt: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      this.receiptPrinting.set(null);
    }
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

  getNameData(): any {
    return this.tabData()?.name || {};
  }

  getNameFullName(): string {
    const n = this.getNameData();
    const full = [n['firstNames'] || n['initials'], n['surname_Company'] || n['companyName'] || n['name']].filter(Boolean).join(' ').trim();
    return full || '-';
  }

  getNameDob(): string {
    const n = this.getNameData();
    if (!n['dateOfBirth']) return '-';
    return this.formatDate(n['dateOfBirth']);
  }

  getNameKinFullName(): string {
    const n = this.getNameData();
    const full = [n['kinFirstName'], n['kinLastName']].filter(Boolean).join(' ').trim();
    return full || '-';
  }

  async searchRelatedAccounts(): Promise<void> {
    const accountId = this.getAccountId(this.selectedAccount());
    if (!accountId) return;
    this.relatedAccountsLoading.set(true);
    this.relatedAccountsSearched.set(true);
    try {
      const result = await firstValueFrom(
        this.api.get<any>(`/api/platinum/accounts-by-name-id`, { accountId: String(accountId) })
      );
      if (result && Array.isArray(result.accounts)) {
        this.relatedAccounts.set(result.accounts);
      } else {
        this.relatedAccounts.set([]);
      }
    } catch {
      this.relatedAccounts.set([]);
    } finally {
      this.relatedAccountsLoading.set(false);
    }
  }

  selectAccountFromRelated(account: any): void {
    const mapped: SearchResult = {
      account_ID: account.account_ID || account.accountID || account.id || 0,
      accountID: account.accountID || account.account_ID || account.id || 0,
      accountNumber: account.accountNumber || account.accountNo || '',
      oldAccountCode: account.oldAccountCode || '',
      name: account.name || account.surname_Company || account.companyName || '',
      surname_Company: account.surname_Company || account.name || '',
      initials: account.initials || '',
      idRegistrationNumber: account.idRegistrationNumber || '',
      deliveryAddress: account.deliveryAddress || '',
      locationAddress: account.locationAddress || '',
      address: account.address || '',
      statusDesc: account.statusDesc || account.accountStatus || '',
      accountStatus: account.accountStatus || account.statusDesc || '',
      accountDesc: account.accountDesc || account.accountType || '',
      accountType: account.accountType || account.accountDesc || '',
      outStandingAmt: account.outStandingAmt || 0,
      outStandingAmount: account.outStandingAmount || 0,
      addName: account.addName || '',
      contactDetails: account.contactDetails || '',
      unitID: account.unitID || 0,
      unitPartitionID: account.unitPartitionID || 0,
      sgNumber: account.sgNumber || '',
      propertyID: account.propertyID || '',
    };
    this.selectAccount(mapped);
  }

  getCurrentFinYear(): string {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    if (month >= 6) {
      return `${year}/${year + 1}`;
    }
    return `${year - 1}/${year}`;
  }

  initSummaryYears(): void {
    if (this.summaryAvailableYears().length > 0) return;
    const currentFy = this.userFinYear() || this.getCurrentFinYear();
    const [startYear] = currentFy.split('/').map(Number);
    const years: string[] = [];
    for (let i = 0; i < 5; i++) {
      const y = startYear - i;
      years.push(`${y}/${y + 1}`);
    }
    this.summaryAvailableYears.set(years);
  }

  initRatesYears(): void {
    if (this.ratesAvailableYears().length > 0) return;
    const currentFy = this.userFinYear() || this.getCurrentFinYear();
    const [startYear] = currentFy.split('/').map(Number);
    const years: string[] = [];
    for (let i = 0; i < 5; i++) {
      const y = startYear - i;
      years.push(`${y}/${y + 1}`);
    }
    this.ratesAvailableYears.set(years);
  }

  async onRatesYearChange(year: string): Promise<void> {
    this.ratesFinYear.set(year);
    const account = this.selectedAccount();
    if (!account) return;
    const accountId = this.getAccountId(account);
    if (!accountId) return;
    this.tabLoading.set(true);
    await this.loadTabData('rates', accountId);
    this.tabLoading.set(false);
  }

  initBvpYears(): void {
    if (this.bvpAvailableYears().length > 0) return;
    const currentFy = this.userFinYear() || this.getCurrentFinYear();
    const [startYear] = currentFy.split('/').map(Number);
    const years: string[] = [];
    for (let i = 0; i < 5; i++) {
      const y = startYear - i;
      years.push(`${y}/${y + 1}`);
    }
    this.bvpAvailableYears.set(years);
  }

  async onBvpYearChange(year: string): Promise<void> {
    this.bvpFinYear.set(year);
    const acct = this.selectedAccount();
    const accountId = acct ? this.getAccountId(acct) : null;
    if (!accountId) return;
    this.tabLoading.set(true);
    this.tabError.set(null);
    try {
      const [billedVsPaid, billedBalance2] = await Promise.allSettled([
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/billed-vs-paid-amounts`, { accountId: String(accountId), financialYear: year })),
        this.fetchAccountBalance(accountId),
      ]);
      const bvpArr = billedVsPaid.status === 'fulfilled' ? this.normalizeArray(billedVsPaid.value) : [];
      const balArr = billedBalance2.status === 'fulfilled' ? this.normalizeArray(billedBalance2.value) : [];
      this.tabData.set({ billedVsPaid: bvpArr, balance: balArr });
    } catch (e: any) {
      this.tabError.set(e.message || 'Failed to load billed vs paid data');
    } finally {
      this.tabLoading.set(false);
    }
  }

  async loadTransactionSummary(accountId: number, finYear: string): Promise<void> {
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.summaryData.set([]);
    this.summarySource.set('');
    this._summaryFieldsLogged = false;

    const params: Record<string, string> = { financialYear: finYear };
    let loaded = false;

    try {
      const result = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/transaction-summary-list/${accountId}`, params)
      );
      const arr = this.normalizeArray(result);
      if (arr.length > 0 && !arr[0]._error) {
        console.log('[txn-summary] TransactionSummaryList keys:', Object.keys(arr[0]), 'count:', arr.length);
        console.log('[txn-summary] FULL first row:', JSON.stringify(arr[0]));
        if (arr.length > 1) console.log('[txn-summary] FULL second row:', JSON.stringify(arr[1]));

        const hasMonthlyData = this.checkRowHasMonthData(arr[0]);
        if (hasMonthlyData) {
          this.summaryData.set(arr);
          this.summarySource.set('monthly');
          loaded = true;
        } else {
          console.log('[txn-summary] TransactionSummaryList returned data but no recognizable month fields, trying billing-period approach');
        }
      }
    } catch {
      console.log('[txn-summary] TransactionSummaryList failed for', accountId);
    }

    if (!loaded) {
      try {
        const monthlyData = await this.buildSummaryFromBillingPeriods(accountId, finYear);
        if (monthlyData.length > 0) {
          this.summaryData.set(monthlyData);
          this.summarySource.set('monthly');
          loaded = true;
          console.log('[txn-summary] Built from billing-period-transactions:', monthlyData.length, 'rows');
        }
      } catch (e: any) {
        console.log('[txn-summary] billing-period approach failed:', e?.message);
      }
    }

    if (!loaded) {
      try {
        const result = await firstValueFrom(
          this.api.get<any>(`/api/platinum/billing-enquiry/service-type-balance/${accountId}`, params)
        );
        const arr = this.normalizeArray(result);
        if (arr.length > 0 && !arr[0]._error) {
          console.log('[txn-summary-aging] ServiceTypeBalance keys:', Object.keys(arr[0]), 'count:', arr.length);
          this.summaryData.set(arr);
          this.summarySource.set('aging');
          loaded = true;
        }
      } catch {
        console.log('[txn-summary] ServiceTypeBalance also failed');
      }
    }

    if (!loaded) {
      this.summaryError.set('Failed to load transaction summary');
    }
    this.summaryLoading.set(false);
  }

  private checkRowHasMonthData(row: any): boolean {
    const monthKeys = ['july','august','september','october','november','december','january','february','march','april','may','june',
      'July','August','September','October','November','December','January','February','March','April','May','June',
      'month1','month2','month3','month4','month5','month6','month7','month8','month9','month10','month11','month12',
      'period1','period2','period3','period4','period5','period6','period7','period8','period9','period10','period11','period12'];
    const keys = Object.keys(row);
    return keys.some(k => monthKeys.includes(k));
  }

  private async buildSummaryFromBillingPeriods(accountId: number, finYear: string): Promise<any[]> {
    const months = this.detailMonths;
    const monthFieldMap: Record<string, string> = {
      'July': 'july', 'August': 'august', 'September': 'september', 'October': 'october',
      'November': 'november', 'December': 'december', 'January': 'january', 'February': 'february',
      'March': 'march', 'April': 'april', 'May': 'may', 'June': 'june'
    };

    const results = await Promise.allSettled(
      months.map(m => firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/get-billing-period-transactions`, {
          accountId: String(accountId), finYear, billingMonth: m, balanceType: '3'
        })
      ))
    );

    const serviceMap = new Map<string, any>();
    const totals: Record<string, number> = {};
    months.forEach(m => totals[monthFieldMap[m]] = 0);

    for (let mi = 0; mi < months.length; mi++) {
      const res = results[mi];
      if (res.status !== 'fulfilled') continue;
      const txns = this.normalizeArray(res.value);

      for (const t of txns) {
        const desc = t.transactionDescription || t.description || '';
        if (!desc) continue;
        const descLower = desc.toLowerCase();
        if (descLower.includes('open') && descLower.includes('balance')) continue;
        if (descLower.includes('clos') && descLower.includes('balance')) continue;

        const amount = Number(t.amount ?? t.debitAmount ?? t.total ?? t.totalAmount ?? 0) || 0;
        const field = monthFieldMap[months[mi]];

        let serviceDesc = desc;
        if (desc.toLowerCase().startsWith('levy - ')) serviceDesc = desc.substring(7);
        else if (desc.toLowerCase().startsWith('levy -')) serviceDesc = desc.substring(6);
        if (descLower.includes('payment')) serviceDesc = 'Payment';

        if (!serviceMap.has(serviceDesc)) {
          const entry: any = { description: serviceDesc, financialYear: finYear };
          months.forEach(m => entry[monthFieldMap[m]] = 0);
          serviceMap.set(serviceDesc, entry);
        }

        serviceMap.get(serviceDesc)[field] += amount;
        totals[field] += amount;
      }
    }

    const pivotedRows = Array.from(serviceMap.values());
    if (pivotedRows.length === 0) return [];

    const openingRow: any = { description: 'Opening Balance', financialYear: finYear, _isSpecialRow: true };
    months.forEach(m => openingRow[monthFieldMap[m]] = 0);
    let running = 0;
    for (const m of months) {
      openingRow[monthFieldMap[m]] = running;
      running += totals[monthFieldMap[m]];
    }

    const totalRow: any = { description: 'Total', financialYear: finYear, _isSpecialRow: true, _isTotalRow: true };
    months.forEach(m => totalRow[monthFieldMap[m]] = totals[monthFieldMap[m]]);

    const closingRow: any = { description: 'Closing Balance', financialYear: finYear, _isSpecialRow: true };
    let closingBal = 0;
    for (const m of months) {
      closingBal += totals[monthFieldMap[m]];
      closingRow[monthFieldMap[m]] = closingBal;
    }

    return [openingRow, ...pivotedRows, totalRow, closingRow];
  }

  private pivotServiceTypeBalance(rows: any[], finYear: string): any[] {
    const monthNames = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
    const monthFieldMap: Record<string, string> = {
      'July': 'july', 'August': 'august', 'September': 'september', 'October': 'october',
      'November': 'november', 'December': 'december', 'January': 'january', 'February': 'february',
      'March': 'march', 'April': 'april', 'May': 'may', 'June': 'june'
    };

    const serviceMap = new Map<string, any>();
    const totals: Record<string, number> = {};
    monthNames.forEach(m => totals[monthFieldMap[m]] = 0);

    for (const row of rows) {
      const desc = row.serviceDescription || row.serviceDesc || row.description || row.serviceTypeDesc || 'Unknown';
      const monthNum = Number(row.month || row.periodID || 0);
      const monthName = monthNum >= 1 && monthNum <= 12 ? monthNames[monthNum - 1] : null;
      const amount = Number(row.totalAmount || row.amount || row.currentCharge || 0) || 0;

      if (!serviceMap.has(desc)) {
        const entry: any = { description: desc, financialYear: row.financialYear || finYear };
        monthNames.forEach(m => entry[monthFieldMap[m]] = 0);
        serviceMap.set(desc, entry);
      }

      if (monthName) {
        const entry = serviceMap.get(desc);
        entry[monthFieldMap[monthName]] += amount;
        totals[monthFieldMap[monthName]] += amount;
      }
    }

    const pivotedRows = Array.from(serviceMap.values());

    const openingRow: any = { description: 'Opening Balance', financialYear: finYear, _isSpecialRow: true };
    monthNames.forEach(m => openingRow[monthFieldMap[m]] = 0);

    let runningBalance = 0;
    for (const m of monthNames) {
      openingRow[monthFieldMap[m]] = runningBalance;
      runningBalance += totals[monthFieldMap[m]];
    }

    const totalRow: any = { description: 'Total', financialYear: finYear, _isSpecialRow: true, _isTotalRow: true };
    monthNames.forEach(m => totalRow[monthFieldMap[m]] = totals[monthFieldMap[m]]);

    const closingRow: any = { description: 'Closing Balance', financialYear: finYear, _isSpecialRow: true };
    let closingBalance = 0;
    for (const m of monthNames) {
      closingBalance += totals[monthFieldMap[m]];
      closingRow[monthFieldMap[m]] = closingBalance;
    }

    return [openingRow, ...pivotedRows, totalRow, closingRow];
  }

  async onSummaryYearChange(year: string): Promise<void> {
    this.summaryFinYear.set(year);
    const acct = this.selectedAccount();
    const accountId = acct ? this.getAccountId(acct) : null;
    if (accountId) {
      await this.loadTransactionSummary(accountId, year);
    }
  }

  private _summaryFieldsLogged = false;

  getSummaryMonthValue(row: any, month: string): number {
    const fieldMap: Record<string, string[]> = {
      'Jul': ['july', 'July', 'jul', 'Jul', 'month1', 'period1', 'p1', 'month_07', 'month07', 'm1', 'col1', 'amount1', 'julAmount', 'julyAmount', 'julyAmt', 'JULY', 'JUL', 'period_1', 'billingPeriod1'],
      'Aug': ['august', 'August', 'aug', 'Aug', 'month2', 'period2', 'p2', 'month_08', 'month08', 'm2', 'col2', 'amount2', 'augAmount', 'augustAmount', 'augAmt', 'AUGUST', 'AUG', 'period_2', 'billingPeriod2'],
      'Sep': ['september', 'September', 'sep', 'Sep', 'month3', 'period3', 'p3', 'month_09', 'month09', 'm3', 'col3', 'amount3', 'sepAmount', 'septemberAmount', 'sepAmt', 'SEPTEMBER', 'SEP', 'period_3', 'billingPeriod3'],
      'Oct': ['october', 'October', 'oct', 'Oct', 'month4', 'period4', 'p4', 'month_10', 'month10', 'm4', 'col4', 'amount4', 'octAmount', 'octoberAmount', 'octAmt', 'OCTOBER', 'OCT', 'period_4', 'billingPeriod4'],
      'Nov': ['november', 'November', 'nov', 'Nov', 'month5', 'period5', 'p5', 'month_11', 'month11', 'm5', 'col5', 'amount5', 'novAmount', 'novemberAmount', 'novAmt', 'NOVEMBER', 'NOV', 'period_5', 'billingPeriod5'],
      'Dec': ['december', 'December', 'dec', 'Dec', 'month6', 'period6', 'p6', 'month_12', 'month12', 'm6', 'col6', 'amount6', 'decAmount', 'decemberAmount', 'decAmt', 'DECEMBER', 'DEC', 'period_6', 'billingPeriod6'],
      'Jan': ['january', 'January', 'jan', 'Jan', 'month7', 'period7', 'p7', 'month_01', 'month01', 'm7', 'col7', 'amount7', 'janAmount', 'januaryAmount', 'janAmt', 'JANUARY', 'JAN', 'period_7', 'billingPeriod7'],
      'Feb': ['february', 'February', 'feb', 'Feb', 'month8', 'period8', 'p8', 'month_02', 'month02', 'm8', 'col8', 'amount8', 'febAmount', 'februaryAmount', 'febAmt', 'FEBRUARY', 'FEB', 'period_8', 'billingPeriod8'],
      'Mar': ['march', 'March', 'mar', 'Mar', 'month9', 'period9', 'p9', 'month_03', 'month03', 'm9', 'col9', 'amount9', 'marAmount', 'marchAmount', 'marAmt', 'MARCH', 'MAR', 'period_9', 'billingPeriod9'],
      'Apr': ['april', 'April', 'apr', 'Apr', 'month10', 'period10', 'p10', 'month_04', 'month04', 'm10', 'col10', 'amount10', 'aprAmount', 'aprilAmount', 'aprAmt', 'APRIL', 'APR', 'period_10', 'billingPeriod10'],
      'May': ['may', 'May', 'month11', 'period11', 'p11', 'month_05', 'month05', 'm11', 'col11', 'amount11', 'mayAmount', 'mayAmt', 'MAY', 'period_11', 'billingPeriod11'],
      'Jun': ['june', 'June', 'jun', 'Jun', 'month12', 'period12', 'p12', 'month_06', 'month06', 'm12', 'col12', 'amount12', 'junAmount', 'juneAmount', 'junAmt', 'JUNE', 'JUN', 'period_12', 'billingPeriod12'],
    };
    const candidates = fieldMap[month] || [];
    for (const key of candidates) {
      if (row[key] !== undefined && row[key] !== null) return Number(row[key]) || 0;
    }
    for (const k of Object.keys(row)) {
      const kl = k.toLowerCase();
      if (kl === month.toLowerCase()) return Number(row[k]) || 0;
      const fullMonthMap: Record<string, string> = { 'jul': 'july', 'aug': 'august', 'sep': 'september', 'oct': 'october', 'nov': 'november', 'dec': 'december', 'jan': 'january', 'feb': 'february', 'mar': 'march', 'apr': 'april', 'may': 'may', 'jun': 'june' };
      const fullMonth = fullMonthMap[month.toLowerCase()];
      if (fullMonth && kl.includes(fullMonth)) return Number(row[k]) || 0;
    }
    if (!this._summaryFieldsLogged && month === 'Jul') {
      console.log('[getSummaryMonthValue] Row keys:', Object.keys(row));
      console.log('[getSummaryMonthValue] Row values:', JSON.stringify(row).substring(0, 1000));
      this._summaryFieldsLogged = true;
    }
    return 0;
  }

  getSummaryDescription(row: any): string {
    return row.description || row.serviceTypeDesc || row.serviceDescription || row.serviceDesc || row.chargeType || row.descr || '-';
  }

  getSummaryFinYear(row: any): string {
    return row.financialYear || row.finYear || row.financial_Year || this.summaryFinYear() || '';
  }

  getSummaryRowTotal(row: any): number {
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.reduce((sum, m) => sum + this.getSummaryMonthValue(row, m), 0);
  }

  downloadSummaryCsv(): void {
    const data = this.summaryData();
    if (!data.length) return;
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const fullMonths = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
    const headers = ['Description', 'Financial Year', ...fullMonths];
    const rows = data.map(row => {
      const vals = months.map(m => this.getSummaryMonthValue(row, m).toFixed(2));
      return [
        this.getSummaryDescription(row),
        this.getSummaryFinYear(row),
        ...vals,
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const acctNo = this.getAccountNum(this.selectedAccount());
    const now = new Date();
    const fileDate = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    a.download = `GEORGE_MUNICIPALITY_Transaction_Summary_${acctNo}_${fileDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  getDebtVal(item: any, field: string): number {
    const fieldMap: Record<string, string[]> = {
      'totalOutStanding': ['totalOutStanding', 'totalOutstandingAmount', 'totalOutstanding', 'totalBalance', 'total'],
      'newCharge': ['newCharge', 'newCharges', 'new_charge'],
      'current': ['current', 'currentAmount', 'currentAccount', 'current_account'],
      'days30': ['days30', '30days', 'thirtyDays', 'thirty_days'],
      'days60': ['days60', '60days', 'sixtyDays', 'sixty_days'],
      'days90': ['days90', '90days', 'ninetyDays', 'ninety_days'],
      'days120': ['days120', '120days', 'hundredTwentyDays', 'hundred_twenty_days'],
      'days150': ['days150', '150days', 'hundredFiftyDays', 'hundred_fifty_days'],
      'days180': ['days180', '180days', 'overHundredEighty', 'hundredEightyPlusDays', 'over_180_days'],
    };
    const candidates = fieldMap[field] || [field];
    for (const key of candidates) {
      if (item[key] !== undefined && item[key] !== null) return Number(item[key]) || 0;
    }
    return 0;
  }

  getDebtColumnTotal(field: string): number {
    return this.getBalanceItems().reduce((sum: number, item: any) => sum + this.getDebtVal(item, field), 0);
  }

  formatDebtAmt(val: number): string {
    if (val === 0) return '0.00';
    const abs = Math.abs(val);
    const parts = abs.toFixed(2).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const formatted = intPart + '.' + parts[1];
    return val < 0 ? `(${formatted})` : formatted;
  }

  async loadDetailedTransactions() {
    const account = this.selectedAccount();
    if (!account) return;
    const accountId = this.getAccountId(account);
    const finYear = this.detailFinYear() || this.userFinYear();
    const month = this.detailMonth();
    if (!finYear) return;

    this.detailLoading.set(true);
    this.detailError.set(null);
    this.detailTransactions.set([]);

    try {
      if (month) {
        const result = await firstValueFrom(
          this.api.get<any>(`/api/platinum/billing-enquiry/get-billing-period-transactions`, {
            accountId: String(accountId), finYear, billingMonth: month, balanceType: '3'
          })
        );
        const arr = this.normalizeArray(result);
        if (arr.length > 0) {
          console.log('[detail-txn] sample keys:', Object.keys(arr[0]));
          console.log('[detail-txn] sample row:', JSON.stringify(arr[0]).substring(0, 800));
        }
        this.detailTransactions.set(arr);
      } else {
        const months = this.detailMonths;
        const results = await Promise.allSettled(
          months.map(m => firstValueFrom(
            this.api.get<any>(`/api/platinum/billing-enquiry/get-billing-period-transactions`, {
              accountId: String(accountId), finYear, billingMonth: m, balanceType: '3'
            })
          ))
        );
        const allTxns = results.flatMap(r => r.status === 'fulfilled' ? this.normalizeArray(r.value) : []);
        if (allTxns.length > 0) {
          console.log('[detail-txn] all months sample keys:', Object.keys(allTxns[0]));
          console.log('[detail-txn] all months sample row:', JSON.stringify(allTxns[0]).substring(0, 800));
        }
        this.detailTransactions.set(allTxns);
      }
    } catch (e: any) {
      this.detailError.set(e?.message || 'Failed to load transactions');
    } finally {
      this.detailLoading.set(false);
    }
  }

  onDetailFinYearChange(year: string) {
    this.detailFinYear.set(year);
    this.loadDetailedTransactions();
  }

  onDetailMonthChange(month: string) {
    this.detailMonth.set(month);
    this.loadDetailedTransactions();
  }

  async onTxnRowClick(txn: any) {
    this.detailSelectedTxn.set(txn);
    this.detailTxnData.set(null);
    this.detailTxnLoading.set(true);

    const account = this.selectedAccount();
    const accountId = this.getAccountId(account);
    const drilldown = (txn.drilldown || '').toLowerCase();
    const pId = txn.primaryId != null ? String(txn.primaryId) : null;
    const pIdNum = pId ? parseInt(pId) : 0;
    const bMonth = txn.billingMonth ?? txn.billingmonth;
    const bMonthNum = bMonth != null ? parseInt(bMonth) : undefined;

    try {
      let detail: any = null;
      const params: Record<string, string> = {};
      if (pId) params['primaryId'] = pId;
      if (bMonthNum !== undefined) params['billingMonth'] = String(bMonthNum);

      if (drilldown === 'openbalance' && pId) {
        detail = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/open-balance-detail`, params));
      } else if (drilldown === 'closebalance' && pId) {
        detail = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/close-balance-detail`, params));
      } else if (drilldown === 'receipt' && pIdNum) {
        detail = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/receipt-transaction-detail`, params));
      } else if (drilldown === 'levy' && pIdNum) {
        detail = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/levy-transaction-detail`, params));
      } else if (drilldown === 'rebate' && pId) {
        detail = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/rebate-transaction-detail`, params));
      } else if (drilldown === 'interest') {
        detail = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/interest-cons-payment-detail`, {
          accountId: String(accountId), finYear: this.detailFinYear() || this.userFinYear()
        }));
      } else if (drilldown === 'journal' && pId) {
        detail = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/journal-transaction-details`, {
          primaryId: pId, accountId: String(accountId)
        }));
      }

      if (typeof detail === 'string') {
        this.detailTxnData.set(detail);
      } else {
        this.detailTxnData.set(this.normalizeArray(detail));
      }
    } catch (e: any) {
      console.error('[txn-detail] error:', e?.message);
      this.detailTxnData.set([]);
    } finally {
      this.detailTxnLoading.set(false);
    }
  }

  closeTxnDetail() {
    this.detailSelectedTxn.set(null);
    this.detailTxnData.set(null);
  }

  getTxnDetailKeys(): string[] {
    const data = this.detailTxnData();
    if (!Array.isArray(data) || data.length === 0) return [];
    return Object.keys(data[0]).filter(k => !k.startsWith('_') && k !== 'id').slice(0, 14);
  }

  formatDetailKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  }

  formatDetailVal(val: any): string {
    if (val == null) return '-';
    if (typeof val === 'number') return this.formatDebtAmt(val);
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return this.formatDate(val);
    return String(val);
  }

  isDetailValNumeric(val: any): boolean {
    return typeof val === 'number';
  }

  isDetailValNegative(val: any): boolean {
    return typeof val === 'number' && val < 0;
  }

  getTxnRowClass(txn: any): string {
    const desc = (txn.transactionDescription || txn.description || '').toLowerCase();
    if (desc.includes('open balance') || desc.includes('opening balance')) return 'txn-row-opening';
    if (desc.includes('clos') && desc.includes('balance')) return 'txn-row-closing';
    if (desc.includes('payment') || txn.drilldown === 'receipt') return 'txn-row-payment';
    return '';
  }

  getExportMonthRange(): string[] {
    const from = this.exportFromMonth();
    const to = this.exportToMonth();
    const fromIdx = this.detailMonths.indexOf(from);
    const toIdx = this.detailMonths.indexOf(to);
    if (fromIdx < 0 || toIdx < 0) return this.detailMonths;
    if (fromIdx <= toIdx) return this.detailMonths.slice(fromIdx, toIdx + 1);
    return [...this.detailMonths.slice(fromIdx), ...this.detailMonths.slice(0, toIdx + 1)];
  }

  async exportDetailedTransactionsExcel() {
    const account = this.selectedAccount();
    if (!account) return;
    const accountId = this.getAccountId(account);
    const finYear = this.detailFinYear() || this.userFinYear();
    if (!finYear) return;

    const months = this.getExportMonthRange();
    if (!months.length) return;

    this.exportingCsv.set(true);

    try {
      const monthResults = await Promise.allSettled(
        months.map(m => firstValueFrom(
          this.api.get<any>(`/api/platinum/billing-enquiry/get-billing-period-transactions`, {
            accountId: String(accountId), finYear, billingMonth: m, balanceType: '3'
          })
        ))
      );

      const basic = this.getAccountBasic();
      const prop = this.getAccountProp();
      const acctNo = account['accountNumber'] || account['accountNo'] || String(accountId);
      const acctName = account['name'] || account['surname_Company'] || basic?.fullNAME || basic?.fullName || '';
      const acctStatus = basic?.accountStatus || account['accountStatus'] || '';
      const propertyId = basic?.propertyID || prop?.propertyID || prop?.property_ID || '';
      const address = basic?.deliveryAddress || prop?.physicalAddress || prop?.address || '';
      const creditStatus = basic?.creditStatusDesc || '';
      const fromMonth = this.exportFromMonth();
      const toMonth = this.exportToMonth();
      const exportDate = new Date();
      const exportDateStr = `${String(exportDate.getDate()).padStart(2,'0')}/${String(exportDate.getMonth()+1).padStart(2,'0')}/${exportDate.getFullYear()}`;
      const exportTimeStr = `${String(exportDate.getHours()).padStart(2,'0')}:${String(exportDate.getMinutes()).padStart(2,'0')}`;

      const csvLines: string[] = [];

      csvLines.push('"GEORGE MUNICIPALITY - DETAILED TRANSACTION REPORT"');
      csvLines.push('""');
      csvLines.push(`"Account Number:","${this.csvEsc(acctNo)}","","Account Holder:","${this.csvEsc(acctName)}"`);
      csvLines.push(`"Account Status:","${this.csvEsc(acctStatus)}","","Credit Status:","${this.csvEsc(creditStatus)}"`);
      csvLines.push(`"Property ID:","${this.csvEsc(propertyId)}","","Address:","${this.csvEsc(address)}"`);
      csvLines.push(`"Financial Year:","${this.csvEsc(finYear)}","","Period:","${this.csvEsc(fromMonth)} to ${this.csvEsc(toMonth)}"`);
      csvLines.push(`"Export Date:","${exportDateStr}","","Time:","${exportTimeStr}"`);
      csvLines.push('""');

      const dataHeaders = ['Transaction Date', 'Transaction Description', 'Receipt ID / Doc Transaction ID', 'Document Number', 'Tariff', 'Amount', 'Interest', 'VAT', 'Total'];

      let grandTotalAmount = 0;
      let grandTotalInterest = 0;
      let grandTotalVat = 0;
      let grandTotal = 0;

      for (let mi = 0; mi < months.length; mi++) {
        const res = monthResults[mi];
        const txns = res.status === 'fulfilled' ? this.normalizeArray(res.value) : [];

        csvLines.push(`"${months[mi].toUpperCase()}",,,,,,,,`);
        csvLines.push(dataHeaders.map(h => `"${h}"`).join(','));

        if (txns.length === 0) {
          csvLines.push('"No transactions","","","","","","","",""');
        } else {
          let monthAmount = 0, monthInterest = 0, monthVat = 0, monthTotal = 0;
          for (const t of txns) {
            const amt = t.amount ?? t.debitAmount ?? 0;
            const int = t.interestAmount ?? t.interest ?? 0;
            const vat = t.vatAmount ?? t.vat ?? 0;
            const tot = t.total ?? t.totalAmount ?? 0;
            monthAmount += Number(amt) || 0;
            monthInterest += Number(int) || 0;
            monthVat += Number(vat) || 0;
            monthTotal += Number(tot) || 0;
            csvLines.push([
              this.formatDate(t.transactionDate || t.date),
              t.transactionDescription || t.description || '',
              t.receiptId || t.receiptNo || t.receipt_ID || t.documentTransactionId || '',
              t.documentNumber || t.docNumber || '',
              t.tariff || '',
              amt, int, vat, tot,
            ].map((v: any) => `"${this.csvEsc(String(v))}"`).join(','));
          }
          csvLines.push(`"","","","","Month Total:","${monthAmount.toFixed(2)}","${monthInterest.toFixed(2)}","${monthVat.toFixed(2)}","${monthTotal.toFixed(2)}"`);
          grandTotalAmount += monthAmount;
          grandTotalInterest += monthInterest;
          grandTotalVat += monthVat;
          grandTotal += monthTotal;
        }
        csvLines.push('""');
      }

      if (months.length > 1) {
        csvLines.push(`"","","","","GRAND TOTAL:","${grandTotalAmount.toFixed(2)}","${grandTotalInterest.toFixed(2)}","${grandTotalVat.toFixed(2)}","${grandTotal.toFixed(2)}"`);
        csvLines.push('""');
      }

      csvLines.push(`"--- End of Report ---"`);

      const csv = csvLines.join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = acctName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_').substring(0, 30);
      const fd = new Date();
      const fdStr = `${fd.getFullYear()}${String(fd.getMonth()+1).padStart(2,'0')}${String(fd.getDate()).padStart(2,'0')}`;
      a.download = `GEORGE_MUNICIPALITY_Transaction_Detail_${acctNo}_${fdStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast.show(`Exported ${months.length} month(s) of transactions`, 'success');
    } catch (e: any) {
      this.toast.show('Failed to export transactions', 'error');
    } finally {
      this.exportingCsv.set(false);
    }
  }

  csvEsc(val: string): string {
    return String(val || '').replace(/"/g, '""');
  }

  Math = Math;

  getBvpRowBilled(row: any): number {
    return Number(row.billedAmount || row.billed || row.debit || 0) || 0;
  }

  getBvpRowPaid(row: any): number {
    return Number(row.paidAmount || row.paid || row.credit || 0) || 0;
  }

  getBvpTotalBilled(): number {
    const rows = this.tabData()?.billedVsPaid || [];
    if (rows.length) return rows.reduce((s: number, r: any) => s + this.getBvpRowBilled(r), 0);
    const bal = this.tabData()?.balance || [];
    return bal.reduce((s: number, r: any) => s + Number(r.totalOutStanding || r.totalOutstanding || 0), 0);
  }

  getBvpTotalPaid(): number {
    const rows = this.tabData()?.billedVsPaid || [];
    if (rows.length) return rows.reduce((s: number, r: any) => s + this.getBvpRowPaid(r), 0);
    return 0;
  }

  getBvpVariance(): number {
    return this.getBvpTotalBilled() - this.getBvpTotalPaid();
  }

  getBvpCollectionRate(): number {
    const billed = this.getBvpTotalBilled();
    if (billed === 0) return 0;
    const rate = (this.getBvpTotalPaid() / billed) * 100;
    return Math.round(rate * 10) / 10;
  }

  getBvpBarWidth(row: any, type: 'billed' | 'paid'): number {
    const billed = this.getBvpRowBilled(row);
    const paid = this.getBvpRowPaid(row);
    const max = Math.max(billed, paid, 1);
    return type === 'billed' ? (billed / max) * 100 : (paid / max) * 100;
  }

  getBvpAgingTotal(field: string): number {
    const bal = this.tabData()?.balance || [];
    if (field === 'total') return bal.reduce((s: number, r: any) => s + Number(r.totalOutStanding || r.totalOutstanding || 0), 0);
    if (field === 'days150') return bal.reduce((s: number, r: any) => s + Number(r.days150 || 0) + Number(r.untill360 || 0), 0);
    return bal.reduce((s: number, r: any) => s + Number(r[field] || 0), 0);
  }

  getBvpInsights(): { icon: string; text: string; type: 'warning' | 'good' | 'info' }[] {
    const insights: { icon: string; text: string; type: 'warning' | 'good' | 'info' }[] = [];
    const rate = this.getBvpCollectionRate();
    const variance = this.getBvpVariance();
    const billed = this.getBvpTotalBilled();
    const bal = this.tabData()?.balance || [];

    if (rate >= 100) {
      insights.push({ icon: '🏆', text: 'Excellent! Payments fully cover or exceed billed amounts.', type: 'good' });
    } else if (rate >= 80) {
      insights.push({ icon: '👍', text: `Good collection rate at ${rate}%. Shortfall of R ${this.formatCurrency(variance)}.`, type: 'good' });
    } else if (rate >= 50) {
      insights.push({ icon: '⚠️', text: `Collection rate is ${rate}% — R ${this.formatCurrency(variance)} remains unpaid.`, type: 'warning' });
    } else if (billed > 0) {
      insights.push({ icon: '🚨', text: `Critical: Only ${rate}% collected. Outstanding variance of R ${this.formatCurrency(variance)}.`, type: 'warning' });
    }

    const overdue30 = bal.reduce((s: number, r: any) => s + Number(r.days30 || 0) + Number(r.days60 || 0) + Number(r.days90 || 0) + Number(r.days120 || 0) + Number(r.days150 || 0) + Number(r.untill360 || 0), 0);
    if (overdue30 > 0) {
      insights.push({ icon: '📅', text: `R ${this.formatCurrency(overdue30)} in arrears (30+ days overdue) across all services.`, type: 'warning' });
    }

    const totalOutstanding = this.getBvpAgingTotal('total');
    if (totalOutstanding === 0 && billed > 0) {
      insights.push({ icon: '✅', text: 'No outstanding balance — account is fully paid up.', type: 'good' });
    }

    const services = this.tabData()?.billedVsPaid || [];
    const worstService = services.reduce((worst: any, r: any) => {
      const v = this.getBvpRowBilled(r) - this.getBvpRowPaid(r);
      return v > (worst?.variance || 0) ? { name: r.serviceType || r.serviceTypeDesc || r.description, variance: v } : worst;
    }, null);
    if (worstService && worstService.variance > 0 && services.length > 1) {
      insights.push({ icon: '📌', text: `Largest shortfall: ${worstService.name} with R ${this.formatCurrency(worstService.variance)} unpaid.`, type: 'info' });
    }

    return insights;
  }

  async selectConsumptionMeter(meter: any) {
    this.consumptionSelectedMeter.set(meter);
    this.consumptionHistoryLoading.set(true);
    this.consumptionHistory.set([]);
    this.consumptionAllHistory.set([]);
    this.consumptionChartData.set([]);
    this.consumptionInsights.set(null);
    this.consumptionFinYears.set([]);
    this.consumptionSelectedYears.set([]);
    const account = this.selectedAccount();
    const accountId = this.getAccountId(account);
    const rawMeterNo = meter.meterNo || meter.meterNumber || meter.physicalMeterNo || meter.physicalMeterNumber || '';
    const meterNo = String(rawMeterNo).replace(/^0+/, '');
    try {
      const [historyRes, barRes] = await Promise.allSettled([
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/meter-reading-history`, { accountId: String(accountId), meterNo })),
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/meter-reading-history-barchart`, { accountId: String(accountId), meterNo })),
      ]);
      const history = historyRes.status === 'fulfilled' ? this.normalizeArray(historyRes.value) : [];
      const barChart = barRes.status === 'fulfilled' ? this.normalizeArray(barRes.value) : [];
      const merged = history.length > 0 ? history : barChart;
      const cleaned = merged.map((item: any) => {
        const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
        if (bm.includes('open period') || bm.includes('current')) {
          const rs = (item.readingStatus || '').toLowerCase();
          if (rs === 'billed' || rs === 'imported' || rs === 'import') {
            const rd = item.reading2Date || item.reading1Date || '';
            if (rd) {
              const parts = rd.split('/');
              if (parts.length === 3) {
                const mi = parseInt(parts[1]) - 1;
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                if (mi >= 0 && mi < 12) {
                  return { ...item, billingmonth: months[mi], billingMonth: months[mi] };
                }
              }
            }
            return item;
          }
          return null;
        }
        return item;
      }).filter((item: any) => item !== null);
      this.consumptionAllHistory.set(cleaned);
      const years = this.extractConsumptionFinYears(cleaned);
      this.consumptionFinYears.set(years);
      this.consumptionSelectedYears.set([...years]);
      this.applyConsumptionYearFilter();
    } catch {
      this.consumptionHistory.set([]);
      this.consumptionAllHistory.set([]);
    }
    this.consumptionHistoryLoading.set(false);
  }

  extractConsumptionFinYears(readings: any[]): string[] {
    const yearSet = new Set<string>();
    readings.forEach((r: any) => {
      if (r.finYear || r.financialYear) {
        yearSet.add(r.finYear || r.financialYear);
        return;
      }
      const dateStr = r.reading2Date || r.reading1Date || r.readingDate || r.billingDate || r.date || r.transactionDate || '';
      if (!dateStr) return;
      let d: Date;
      const parts = dateStr.split('/');
      if (parts.length === 3 && parts[0].length <= 2) {
        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        d = new Date(dateStr);
      }
      if (isNaN(d.getTime())) return;
      const month = d.getMonth();
      const year = d.getFullYear();
      const fyStart = month >= 6 ? year : year - 1;
      yearSet.add(`${fyStart}/${fyStart + 1}`);
    });
    return Array.from(yearSet).sort().reverse();
  }

  toggleConsumptionYear(fy: string) {
    const current = [...this.consumptionSelectedYears()];
    const idx = current.indexOf(fy);
    if (idx >= 0) {
      if (current.length > 1) {
        current.splice(idx, 1);
      }
    } else {
      current.push(fy);
    }
    this.consumptionSelectedYears.set(current);
    this.applyConsumptionYearFilter();
  }

  selectAllConsumptionYears() {
    this.consumptionSelectedYears.set([...this.consumptionFinYears()]);
    this.applyConsumptionYearFilter();
  }

  applyConsumptionYearFilter() {
    const all = this.consumptionAllHistory();
    const selectedYears = this.consumptionSelectedYears();
    if (selectedYears.length === 0 || selectedYears.length === this.consumptionFinYears().length) {
      this.consumptionHistory.set(all);
      this.consumptionChartData.set(all);
      this.consumptionInsights.set(this.computeConsumptionInsights(all));
      return;
    }
    const filtered = all.filter((r: any) => {
      if (r.finYear || r.financialYear) {
        return selectedYears.includes(r.finYear || r.financialYear);
      }
      const dateStr = r.reading2Date || r.reading1Date || r.readingDate || r.billingDate || r.date || r.transactionDate || '';
      if (!dateStr) return false;
      let d: Date;
      const parts = dateStr.split('/');
      if (parts.length === 3 && parts[0].length <= 2) {
        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        d = new Date(dateStr);
      }
      if (isNaN(d.getTime())) return false;
      const month = d.getMonth();
      const year = d.getFullYear();
      const fyStart = month >= 6 ? year : year - 1;
      const fy = `${fyStart}/${fyStart + 1}`;
      return selectedYears.includes(fy);
    });
    this.consumptionHistory.set(filtered);
    this.consumptionChartData.set(filtered);
    this.consumptionInsights.set(this.computeConsumptionInsights(filtered));
  }

  computeConsumptionInsights(readings: any[]): any {
    if (!readings || readings.length === 0) return null;
    const consumptions = readings
      .map((r: any) => Number(r.consumption || r.units || r.totalConsumption || 0))
      .filter((v: number) => !isNaN(v));
    if (consumptions.length === 0) return null;
    const total = consumptions.reduce((s: number, v: number) => s + v, 0);
    const avg = total / consumptions.length;
    const min = Math.min(...consumptions);
    const max = Math.max(...consumptions);
    const stdDev = Math.sqrt(consumptions.reduce((s: number, v: number) => s + Math.pow(v - avg, 2), 0) / consumptions.length);
    const anomalies: any[] = [];
    const threshold = avg + (stdDev * 1.5);
    const lowThreshold = Math.max(avg - (stdDev * 1.5), 0);
    readings.forEach((r: any, i: number) => {
      const val = Number(r.consumption || r.units || r.totalConsumption || 0);
      if (val > threshold && val > 0) {
        anomalies.push({ index: i, type: 'spike', value: val, pctAbove: Math.round(((val - avg) / avg) * 100), date: r.readingDate || r.billingDate || r.date });
      } else if (val < lowThreshold && avg > 0 && val >= 0) {
        anomalies.push({ index: i, type: 'drop', value: val, pctBelow: Math.round(((avg - val) / avg) * 100), date: r.readingDate || r.billingDate || r.date });
      }
      if (val === 0 && avg > 5) {
        if (!anomalies.find((a: any) => a.index === i)) {
          anomalies.push({ index: i, type: 'zero', value: 0, date: r.readingDate || r.billingDate || r.date });
        }
      }
    });
    const recent = consumptions.slice(0, Math.min(3, consumptions.length));
    const older = consumptions.slice(Math.min(3, consumptions.length), Math.min(6, consumptions.length));
    let trend = 'stable';
    if (recent.length > 0 && older.length > 0) {
      const recentAvg = recent.reduce((s: number, v: number) => s + v, 0) / recent.length;
      const olderAvg = older.reduce((s: number, v: number) => s + v, 0) / older.length;
      if (olderAvg > 0) {
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        if (change > 15) trend = 'increasing';
        else if (change < -15) trend = 'decreasing';
      }
    }
    return { total, avg: Math.round(avg * 100) / 100, min, max, stdDev: Math.round(stdDev * 100) / 100, anomalies, trend, count: consumptions.length };
  }

  getConsumptionVal(r: any): number {
    return Number(r.consumption || r.units || r.totalConsumption || 0);
  }

  getAvgDailyConsumption(r: any): string {
    if (r.averageDailyConsumption) return String(r.averageDailyConsumption);
    if (r.avgDaily) return String(r.avgDaily);
    if (r.dailyAverage) return String(r.dailyAverage);
    const days = Number(r.readingdays || r.readingDays || r.days || r.numberOfDays || 0);
    const cons = this.getConsumptionVal(r);
    if (days > 0 && cons > 0) return (cons / days).toFixed(1);
    return '-';
  }

  getChartMaxVal(): number {
    const data = this.consumptionChartData();
    if (!data || data.length === 0) return 100;
    const max = Math.max(...data.map((r: any) => this.getConsumptionVal(r)));
    return max > 0 ? max : 100;
  }

  getChartBarHeight(r: any): number {
    const max = this.getChartMaxVal();
    const val = this.getConsumptionVal(r);
    return max > 0 ? (val / max) * 100 : 0;
  }

  isAnomalyReading(r: any, idx: number): string {
    const insights = this.consumptionInsights();
    if (!insights?.anomalies) return '';
    const match = insights.anomalies.find((a: any) => a.index === idx);
    return match ? match.type : '';
  }

  getConsumptionChartLabel(r: any): string {
    const bm = r.billingmonth || r.billingMonth || '';
    if (bm) return bm.substring(0, 3);
    const date = r.reading2Date || r.reading1Date || r.readingDate || r.billingDate || r.date || '';
    if (!date) return '-';
    return this.formatDate(date);
  }

  getConsumptionHistorySorted(): any[] {
    const data = this.consumptionHistory();
    if (!data.length) return [];
    const seen = new Set<string>();
    const deduped = data.filter(r => {
      const bm = (r.billingmonth || r.billingMonth || '').toLowerCase().trim();
      const fy = (r.financialYear || r.finYear || '').trim();
      const key = `${bm}|${fy}`;
      if (key === '|') return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const monthOrder = ['july','august','september','october','november','december','january','february','march','april','may','june'];
    const isAwaitingBilling = (r: any) => {
      const bm = (r.billingmonth || r.billingMonth || '').toLowerCase().trim();
      const rs = (r.readingStatus || '').toLowerCase();
      const flag = (r.flag || '').toLowerCase();
      if (bm === 'current open period' || bm.includes('open period')) return true;
      if (rs.includes('awaiting') || rs.includes('unbilled') || rs.includes('pending')) return true;
      if (flag.includes('awaiting') || flag.includes('unbilled')) return true;
      return false;
    };
    const getSortKey = (r: any): number => {
      const fy = (r.financialYear || r.finYear || '').trim();
      const fyYear = fy ? parseInt(fy.split('/')[0]) || 0 : 0;
      const bm = (r.billingmonth || r.billingMonth || '').toLowerCase().trim();
      const mi = monthOrder.indexOf(bm);
      return fyYear * 100 + (mi >= 0 ? mi : 50);
    };
    return [...deduped].sort((a, b) => {
      const aAwait = isAwaitingBilling(a) ? 0 : 1;
      const bAwait = isAwaitingBilling(b) ? 0 : 1;
      if (aAwait !== bAwait) return aAwait - bAwait;
      return getSortKey(b) - getSortKey(a);
    });
  }

  getConsRowClass(r: any): string {
    const flag = (r.flag || r.levyStatus || '').toLowerCase();
    if (flag.includes('reversed') || flag.includes('cancel')) return 'cons-row-reversed';
    if (flag.includes('estimate') || flag.includes('levy')) return 'cons-row-estimate';
    return '';
  }

  getOpenMonthsCount(): { open: number; expected: number } {
    const data = this.consumptionHistory();
    const open = data.filter(r => {
      const bm = (r.billingmonth || r.billingMonth || '').toLowerCase().trim();
      const rs = (r.readingStatus || '').toLowerCase();
      const flag = (r.flag || '').toLowerCase();
      return bm.includes('open period') || rs.includes('awaiting') || rs.includes('unbilled') || rs.includes('pending') || flag.includes('awaiting');
    }).length;
    const years = this.consumptionSelectedYears();
    const expected = years.length * 12;
    return { open, expected: expected || 12 };
  }

  initS129Years(records: any[]) {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let i = 0; i < 5; i++) {
      years.push(`${currentYear - i}/${currentYear - i + 1}`);
    }
    const fromRecords = records
      .map((r: any) => r.financialYear || r.billingPeriod || '')
      .filter((y: string) => y && y.includes('/'));
    const allYears = [...new Set([...years, ...fromRecords])].sort().reverse();
    this.s129AvailableYears.set(allYears);
    if (!this.s129FinYear() && allYears.length > 0) {
      this.s129FinYear.set(allYears[0]);
    }
  }

  computeS129Insights(records: any[]) {
    if (!records || records.length === 0) {
      this.s129Insights.set(null);
      return;
    }
    const totalNotices = records.length;
    const totalAmount = records.reduce((sum: number, r: any) => sum + (Number(r.qualifyingAmount || r.amount || r.noticeAmount || 0) || 0), 0);
    const delivered = records.filter((r: any) => (r.proofOfDeliveryStatus || '').toLowerCase().includes('deliver') || (r.proofOfDeliveryStatus || '').toLowerCase().includes('success'));
    const pending = records.filter((r: any) => !(r.proofOfDeliveryStatus || '') || (r.proofOfDeliveryStatus || '').toLowerCase().includes('pend'));
    const authorized = records.filter((r: any) => r.authorisedBy || r.authorizedBy || r.dateAuthorised || r.dateAuthorized);
    const attorneys = [...new Set(records.map((r: any) => r.attorney || '').filter((a: string) => a))];
    this.s129Insights.set({
      totalNotices,
      totalAmount,
      deliveredCount: delivered.length,
      pendingCount: pending.length,
      authorizedCount: authorized.length,
      attorneyCount: attorneys.length,
      attorneys,
    });
  }

  filterS129() {
    const all = this.tabData()?.section129 || [];
    const fy = this.s129FinYear();
    const month = this.s129Month();
    let filtered = all;
    if (fy) {
      filtered = filtered.filter((r: any) => {
        const recFy = r.financialYear || r.billingPeriod || '';
        return !recFy || recFy === fy;
      });
    }
    if (month) {
      filtered = filtered.filter((r: any) => {
        const recMonth = (r.month || r.billingMonth || '').toLowerCase();
        const issueDate = r.issueDate || r.noticeDate || r.date || r.createdDate || '';
        if (recMonth && recMonth === month.toLowerCase()) return true;
        if (issueDate) {
          const d = new Date(issueDate);
          const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
          if (!isNaN(d.getTime()) && monthNames[d.getMonth()] === month.toLowerCase()) return true;
        }
        return !recMonth && !issueDate;
      });
    }
    this.s129Filtered.set(filtered);
    this.computeS129Insights(filtered);
  }

  initStmtYears(statements: any[]) {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let i = 0; i < 5; i++) {
      years.push(`${currentYear - i}/${currentYear - i + 1}`);
    }
    const fromStmts = statements
      .map((s: any) => s.financialYear || s.billingPeriod || '')
      .filter((y: string) => y && y.includes('/'));
    const allYears = [...new Set([...years, ...fromStmts])].sort().reverse();
    this.stmtAvailableYears.set(allYears);
    if (!this.stmtFinYear() && allYears.length > 0) {
      this.stmtFinYear.set(allYears[0]);
    }
  }

  async generateStatement() {
    const account = this.selectedAccount();
    if (!account) return;
    const accountId = this.getAccountId(account);
    if (!accountId) return;
    this.stmtGenerating.set(true);
    this.stmtGenerated.set(null);
    try {
      const result = await firstValueFrom(
        this.api.post<any>('/api/platinum/billing-enquiry/generate-statement', {
          accountId,
          statementType: this.stmtType(),
          financialYear: this.stmtFinYear(),
          month: this.stmtMonth() || undefined,
        })
      );
      this.stmtGenerated.set(result);
      this.toast.show('Statement generated successfully', 'success');
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to generate statement', 'error');
    } finally {
      this.stmtGenerating.set(false);
    }
  }

  downloadStatement(fileUrl?: string) {
    if (!fileUrl) {
      this.toast.show('No download link available', 'error');
      return;
    }
    window.open(`/api/platinum/statement-download?fileUrl=${encodeURIComponent(fileUrl)}`, '_blank');
    this.toast.show('Statement download started', 'success');
  }

  async sendStatement(method: 'email' | 'sms') {
    const account = this.selectedAccount();
    if (!account) return;
    const accountId = this.getAccountId(account);
    if (!accountId) return;
    if (method === 'email' && !this.stmtEmail()) {
      this.toast.show('Please enter an email address', 'error');
      return;
    }
    if (method === 'sms' && !this.stmtPhone()) {
      this.toast.show('Please enter a phone number', 'error');
      return;
    }
    this.stmtSending.set(true);
    try {
      await firstValueFrom(
        this.api.post<any>('/api/platinum/billing-enquiry/send-statement', {
          accountId,
          method,
          email: this.stmtEmail(),
          phone: this.stmtPhone(),
          statementType: this.stmtType(),
          financialYear: this.stmtFinYear(),
          month: this.stmtMonth() || undefined,
        })
      );
      this.toast.show(`Statement sent via ${method.toUpperCase()} successfully`, 'success');
      this.stmtSendMode.set(null);
    } catch (e: any) {
      this.toast.show(e?.error?.message || `Failed to send via ${method}`, 'error');
    } finally {
      this.stmtSending.set(false);
    }
  }

  async viewStatementRow(stmt: any): Promise<void> {
    const fy = stmt.financialYear || stmt.billingPeriod || stmt.period || this.stmtFinYear();
    const month = stmt.month || stmt.billingMonth || '';
    const stType = (stmt.statementType || stmt.type || '').toLowerCase().includes('detail') ? 'detailed' : 'standard';

    if (stmt.fileUrl || stmt.downloadUrl || stmt.url) {
      this.downloadStatement(stmt.fileUrl || stmt.downloadUrl || stmt.url);
      return;
    }

    this.stmtType.set(stType as 'standard' | 'detailed');
    this.stmtFinYear.set(fy);
    this.stmtMonth.set(month);
    await this.generateStatement();
  }

  async sendStatementRow(stmt: any): Promise<void> {
    const fy = stmt.financialYear || stmt.billingPeriod || stmt.period || this.stmtFinYear();
    const month = stmt.month || stmt.billingMonth || '';
    const stType = (stmt.statementType || stmt.type || '').toLowerCase().includes('detail') ? 'detailed' : 'standard';

    this.stmtType.set(stType as 'standard' | 'detailed');
    this.stmtFinYear.set(fy);
    this.stmtMonth.set(month);

    const basic = this.getAccountBasic();
    const contact = this.tabData()?.contact;
    const email = contact?.email || contact?.emailId || basic?.emailId || basic?.email || '';

    if (email) {
      this.stmtEmail.set(email);
      this.stmtSendMode.set('email');
      await this.sendStatement('email');
    } else {
      const phone = contact?.tel_Mobile || contact?.cellPhone || contact?.contactNo || basic?.contactNo || '';
      if (phone) {
        this.stmtPhone.set(phone);
        this.stmtSendMode.set('sms');
        await this.sendStatement('sms');
      } else {
        this.stmtSendMode.set('email');
        this.toast.show('No email or phone on file — please enter manually and use the generator above', 'error');
      }
    }
  }

  async loadCommTemplates(): Promise<void> {
    if (this.commTemplates().length > 0) return;
    this.commTemplatesLoading.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/billing-enquiry/communication-templates')
      );
      const items = Array.isArray(data) ? data : (data?.items || data?.value || data?.results || data?.data || []);
      this.commTemplates.set(items);
    } catch {
      this.commTemplates.set([]);
    } finally {
      this.commTemplatesLoading.set(false);
    }
  }

  openCompose(): void {
    this.commShowCompose.set(true);
    this.loadCommTemplates();
    const basic = this.getAccountBasic();
    const contact = this.tabData()?.contact;
    if (this.commMethod() === 'email') {
      const email = contact?.email || contact?.emailId || contact?.emailAddress || basic?.emailId || basic?.email || '';
      this.commRecipient.set(email);
    } else {
      const phone = contact?.tel_Mobile || contact?.cellPhone || contact?.contactNo || basic?.contactNo || basic?.tel_Mobile || '';
      this.commRecipient.set(phone);
    }
  }

  onCommMethodChange(): void {
    const basic = this.getAccountBasic();
    const contact = this.tabData()?.contact;
    if (this.commMethod() === 'email') {
      const email = contact?.email || contact?.emailId || contact?.emailAddress || basic?.emailId || basic?.email || '';
      this.commRecipient.set(email);
    } else {
      const phone = contact?.tel_Mobile || contact?.cellPhone || contact?.contactNo || basic?.contactNo || basic?.tel_Mobile || '';
      this.commRecipient.set(phone);
    }
  }

  onCommTemplateChange(): void {
    const tplId = this.commSelectedTemplate();
    if (!tplId) return;
    const tpl = this.commTemplates().find((t: any) => (t.id || t.templateId) === tplId);
    if (tpl) {
      this.commSubject.set(tpl.subject || tpl.name || '');
      this.commMessage.set(tpl.body || tpl.message || tpl.content || '');
    }
  }

  async sendNotification(): Promise<void> {
    const account = this.selectedAccount();
    if (!account) return;
    const accountId = this.getAccountId(account);
    if (!accountId) return;
    if (!this.commRecipient()) {
      this.toast.show(`Please enter ${this.commMethod() === 'email' ? 'an email address' : 'a phone number'}`, 'error');
      return;
    }
    if (!this.commMessage()) {
      this.toast.show('Please enter a message or select a template', 'error');
      return;
    }
    this.commSending.set(true);
    try {
      await firstValueFrom(
        this.api.post<any>('/api/platinum/billing-enquiry/send-notification', {
          accountId,
          method: this.commMethod(),
          recipient: this.commRecipient(),
          subject: this.commSubject(),
          message: this.commMessage(),
          templateId: this.commSelectedTemplate() || undefined,
        })
      );
      this.toast.show(`${this.commMethod() === 'email' ? 'Email' : 'SMS'} sent successfully to ${this.commRecipient()}`, 'success');
      this.commMessage.set('');
      this.commSubject.set('');
      this.commSelectedTemplate.set('');
      this.commShowCompose.set(false);
    } catch (e: any) {
      this.toast.show(e?.error?.message || `Failed to send ${this.commMethod()}`, 'error');
    } finally {
      this.commSending.set(false);
    }
  }

  computeIndigentInsights(records: any[]): any {
    if (!records || records.length === 0) return null;
    const latest = records[0];
    const currentStatus = latest.attpStatus || latest.status || '';
    const currentType = latest.indigentType || latest.attpType || latest.type || '';
    const appDate = latest.applicationDate || latest.date || '';
    const totalWriteOff = records.reduce((sum: number, r: any) => sum + (Number(r.totalWriteOffAmount || r.totalWriteOff || 0) || 0), 0);
    const doNotCut = records.some((r: any) => r.doNotCutDate && r.doNotCutDate !== '' && r.doNotCutDate !== null);
    const doNotCutRec = records.find((r: any) => r.doNotCutDate && r.doNotCutDate !== '' && r.doNotCutDate !== null);
    return {
      currentStatus,
      currentType,
      applicationDate: this.formatDate(appDate),
      totalWriteOff,
      totalRecords: records.length,
      doNotCut,
      doNotCutDate: doNotCutRec ? this.formatDate(doNotCutRec.doNotCutDate) : null,
    };
  }

  isPrepaidMeter(m: any): boolean {
    const desc = (m.serviceDesc || m.serviceDescription || m.serviceType || m.tariffType || '').toLowerCase();
    return desc.includes('prepaid') || desc.includes('pre-paid') || desc.includes('pre paid');
  }

  async selectConvMeter(meter: any) {
    this.meterSelectedConv.set(meter);
    this.meterConvLoading.set(true);
    this.meterConvHistory.set([]);
    this.meterConvInsights.set(null);
    const account = this.selectedAccount();
    const accountId = this.getAccountId(account);
    const rawMeterNo = meter.meterNo || meter.meterNumber || meter.physicalMeterNo || meter.physicalMeterNumber || '';
    const meterNo = String(rawMeterNo).replace(/^0+/, '');
    try {
      const [historyRes, barRes] = await Promise.allSettled([
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/meter-reading-history`, { accountId: String(accountId), meterNo })),
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/meter-reading-history-barchart`, { accountId: String(accountId), meterNo })),
      ]);
      const history = historyRes.status === 'fulfilled' ? this.normalizeArray(historyRes.value) : [];
      const barChart = barRes.status === 'fulfilled' ? this.normalizeArray(barRes.value) : [];
      const merged = history.length > 0 ? history : barChart;
      const cleaned = merged.map((item: any) => {
        const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
        if (bm.includes('open period') || bm.includes('current')) {
          const rs = (item.readingStatus || '').toLowerCase();
          if (rs === 'billed' || rs === 'imported' || rs === 'import') {
            const rd = item.reading2Date || item.reading1Date || '';
            if (rd) {
              const parts = rd.split('/');
              if (parts.length === 3) {
                const mi = parseInt(parts[1]) - 1;
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                if (mi >= 0 && mi < 12) {
                  return { ...item, billingmonth: months[mi], billingMonth: months[mi] };
                }
              }
            }
            return item;
          }
          return null;
        }
        return item;
      }).filter((item: any) => item !== null);
      this.meterConvHistory.set(cleaned);
      this.meterConvInsights.set(this.computeConsumptionInsights(cleaned));
    } catch {
      this.meterConvHistory.set([]);
    }
    this.meterConvLoading.set(false);
  }

  async selectPrepaidMeter(meter: any) {
    this.meterSelectedPrepaid.set(meter);
    this.meterPrepaidLoading.set(true);
    this.meterPrepaidSales.set([]);
    this.meterPrepaidStats.set(null);
    const account = this.selectedAccount();
    const accountId = this.getAccountId(account);
    const meterNo = meter.physicalMeterNo || meter.meterNo || meter.meterNumber || meter.meter_ID || '';
    try {
      const res = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/prepaid-recharge-details-for-meter`, { accountId: String(accountId), meterNo }));
      const sales = this.normalizeArray(res);
      this.meterPrepaidSales.set(sales);
      this.meterPrepaidStats.set(this.computePrepaidStats(sales));
    } catch {
      this.meterPrepaidSales.set([]);
    }
    this.meterPrepaidLoading.set(false);
  }

  computePrepaidStats(sales: any[]): any {
    if (!sales || sales.length === 0) return null;
    const amounts = sales.map((s: any) => Number(s.total || s.amount || s.receiptAmount || 0)).filter((v: number) => !isNaN(v) && v > 0);
    const units = sales.map((s: any) => Number(s.prepaidUnit || s.units || s.prepaidUnits || 0)).filter((v: number) => !isNaN(v) && v > 0);
    const dates = sales.map((s: any) => s.receiptDate || s.date || s.transactionDate || '').filter((d: string) => d);
    const totalSpend = amounts.reduce((s: number, v: number) => s + v, 0);
    const totalUnits = units.reduce((s: number, v: number) => s + v, 0);
    const avgSpend = amounts.length > 0 ? totalSpend / amounts.length : 0;
    const avgUnits = units.length > 0 ? totalUnits / units.length : 0;
    const lastPurchase = dates.length > 0 ? dates[0] : null;
    const lastAmount = amounts.length > 0 ? amounts[0] : 0;
    const cancelled = sales.filter((s: any) => (s.canceledStatus || s.cancelledStatus || s.status || '').toLowerCase() === 'yes' || (s.canceledStatus || s.cancelledStatus || s.status || '').toLowerCase() === 'cancelled').length;
    return { totalSales: sales.length, totalSpend, totalUnits, avgSpend: Math.round(avgSpend * 100) / 100, avgUnits: Math.round(avgUnits * 100) / 100, lastPurchase, lastAmount, cancelled };
  }

  getConvMeterChartHeight(r: any): number {
    const history = this.meterConvHistory();
    if (!history || history.length === 0) return 0;
    const max = Math.max(...history.map((h: any) => this.getConsumptionVal(h)));
    const val = this.getConsumptionVal(r);
    return max > 0 ? (val / max) * 100 : 0;
  }

  isConvAnomaly(r: any, idx: number): string {
    const insights = this.meterConvInsights();
    if (!insights?.anomalies) return '';
    const match = insights.anomalies.find((a: any) => a.index === idx);
    return match ? match.type : '';
  }

  getFilteredServices(category: string): any[] {
    const all = this.getServicesList();
    return all.filter((svc: any) => this.getSvcCategory(svc) === category);
  }

  getSvcCategory(svc: any): string {
    const type = (svc.serviceType || svc.serviceTypeDesc || svc.serviceDesc || svc.serviceDescription || svc.tariffType || '').toLowerCase();
    const tariff = (svc.tariff || svc.tariffDesc || '').toLowerCase();
    const combined = type + ' ' + tariff;
    if (combined.includes('pre-paid') || combined.includes('pre paid') || combined.includes('prepaid')) return 'prepaid';
    if (combined.includes('property rate') || combined.includes('rates') && !combined.includes('water') && !combined.includes('elec') && !combined.includes('sewer') && !combined.includes('refuse')) return 'rates';
    if (combined.includes('metered') || combined.includes('effluent')) return 'metered';
    if (combined.includes('basic') || combined.includes('disposal') || combined.includes('refuse') || combined.includes('sanitation')) return 'basic';
    if (combined.includes('rate')) return 'rates';
    return 'other';
  }

  getSvcActiveCount(): number {
    return this.getServicesList().filter((svc: any) => this.isSvcActive(svc)).length;
  }

  getSvcCategories(): { key: string; label: string; icon: string }[] {
    return [
      { key: 'metered', label: 'Metered Services', icon: '🔧' },
      { key: 'prepaid', label: 'Pre-Paid Meters', icon: '⚡' },
      { key: 'basic', label: 'Basic Services', icon: '🏠' },
      { key: 'rates', label: 'Property Rates', icon: '🏛️' },
      { key: 'other', label: 'Other Services', icon: '📦' },
    ];
  }

  getSvcTypeIcon(svc: any): string {
    const type = (svc.serviceType || svc.serviceTypeDesc || svc.serviceDesc || svc.serviceDescription || svc.tariffType || '').toLowerCase();
    if (type.includes('water')) return '💧';
    if (type.includes('elec')) return '⚡';
    if (type.includes('sewer') || type.includes('sanit') || type.includes('effluent')) return '🚿';
    if (type.includes('refuse') || type.includes('disposal')) return '🗑️';
    if (type.includes('rate')) return '🏛️';
    return '📋';
  }

  getSvcType(svc: any): string {
    return svc.serviceType || svc.serviceTypeDesc || svc.serviceDesc || svc.serviceDescription || '-';
  }

  isSvcActive(svc: any): boolean {
    return (svc.serviceStatus || svc.statusDesc || svc.status || '').toLowerCase() === 'active';
  }

  getSvcMeterDisplay(svc: any): string {
    const meter = svc.physicalMeterMeterCode || svc.physicalMeterNo || svc.meterNo || svc.meterNumber || '';
    const code = svc.meterCode || '';
    if (meter && code) return `${meter} - ${code}`;
    if (meter) return meter;
    return 'No Meter';
  }

  formatTariffRate(svc: any): string {
    const parts: string[] = [];
    const startDate = svc.tariffStartDate || svc.startDate || svc.serviceCommencementDate;
    const endDate = svc.tariffEndDate || svc.endDate;
    if (startDate || endDate) {
      parts.push(`<div class="svc-rate-line"><strong>Start Date · End Date:</strong></div>`);
      parts.push(`<div class="svc-rate-line">${this.formatDate(startDate)} · ${this.formatDate(endDate)}</div>`);
    }
    const tariffRates = svc.tariffRates || svc.tariffRate || svc.rates;
    if (typeof tariffRates === 'string' && tariffRates.length > 0) {
      parts.push(`<div class="svc-rate-line svc-rate-detail">${tariffRates.replace(/\n/g, '<br>')}</div>`);
    } else if (Array.isArray(tariffRates)) {
      tariffRates.forEach((r: any) => {
        const label = r.description || r.label || r.name || '';
        const val = r.rate ?? r.value ?? r.amount ?? '';
        if (label || val !== '') parts.push(`<div class="svc-rate-line">${label}: ${val}</div>`);
      });
    }
    const interval = svc.interval || svc.tariffInterval;
    const cost = svc.cost || svc.tariffCost || svc.monthlyCost;
    const remainder = svc.remainder || svc.tariffRemainder;
    if (interval !== undefined || cost !== undefined || remainder !== undefined) {
      parts.push(`<div class="svc-rate-line"><strong>Interval · Cost:</strong></div>`);
      const vals: string[] = [];
      if (interval !== undefined) vals.push(`Interval: ${interval}`);
      if (cost !== undefined) vals.push(`Cost: ${this.formatDebtAmt(Number(cost) || 0)}`);
      if (remainder !== undefined) vals.push(`Remainder: ${this.formatDebtAmt(Number(remainder) || 0)}`);
      parts.push(`<div class="svc-rate-line">${vals.join('<br>')}</div>`);
    }
    if (parts.length === 0) return '<div class="svc-rate-line">-</div>';
    return parts.join('');
  }

  async viewServiceBalance(svc: any) {
    this.svcSelectedService.set(svc);
    this.svcBalanceLoading.set(true);
    this.svcBalanceData.set([]);
    this.svcBalanceError.set('');
    const account = this.selectedAccount();
    const accountId = this.getAccountId(account);
    try {
      const data = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/service-type-balance`, { accountId: String(accountId), financialYear: this.svcBalanceFinYear() }));
      this.svcBalanceData.set(this.normalizeArray(data));
    } catch (err: any) {
      this.svcBalanceData.set([]);
      this.svcBalanceError.set(err?.message || 'Failed to load service balance data');
    }
    this.svcBalanceLoading.set(false);
  }

  async changeSvcBalanceFinYear(fy: string) {
    this.svcBalanceFinYear.set(fy);
    await this.viewServiceBalance(this.svcSelectedService());
  }

  getSvcBalanceFinYearOptions(): string[] {
    const now = new Date();
    const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return Array.from({ length: 5 }, (_, i) => {
      const y = startYear - i;
      return `${y}/${y + 1}`;
    });
  }

  getSvcBalanceFiltered(): any[] {
    const svc = this.svcSelectedService();
    if (!svc) return [];
    const svcDesc = svc.serviceDesc || svc.serviceDescription || svc.tariffType || '';
    const svcTypeId = svc.tariffTypeID || svc.serviceTypeID || svc.serviceType_ID;
    const filtered = this.svcBalanceData().filter((b: any) =>
      (svcTypeId && b.serviceTypeID === svcTypeId) ||
      (b.serviceDescription && svcDesc && b.serviceDescription.toLowerCase() === svcDesc.toLowerCase())
    );
    const monthOrder = ['July','August','September','October','November','December','January','February','March','April','May','June'];
    return [...filtered].sort((a, b) => {
      const ai = monthOrder.indexOf(a.month);
      const bi = monthOrder.indexOf(b.month);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  getSvcBalanceTotals(): any {
    const rows = this.getSvcBalanceFiltered();
    return rows.reduce((acc: any, r: any) => ({
      openingBalance: (acc.openingBalance || 0) + (r.openingBalance || 0),
      amount: (acc.amount || 0) + (r.amount || 0),
      vat: (acc.vat || 0) + (r.vat || 0),
      interestAmount: (acc.interestAmount || 0) + (r.interestAmount ?? r.interest ?? 0),
      totalAmount: (acc.totalAmount || 0) + (r.totalAmount ?? r.total ?? 0),
      currentInterestAmount: (acc.currentInterestAmount || 0) + (r.currentInterestAmount || 0),
      currentCharge: (acc.currentCharge || 0) + (r.currentCharge || 0),
      closingBalance: (acc.closingBalance || 0) + (r.closingBalance ?? r.closingBal ?? 0),
    }), {});
  }

  getSvcBalanceChartData(): { month: string; amount: number }[] {
    return this.getSvcBalanceFiltered()
      .filter(r => (r.totalAmount || r.amount || 0) > 0)
      .map(r => ({ month: r.month || '-', amount: r.totalAmount || r.amount || 0 }));
  }

  getSvcBalanceChartMax(): number {
    const data = this.getSvcBalanceChartData();
    if (!data.length) return 1;
    return Math.max(...data.map(d => d.amount), 1);
  }

  getSvcBalanceBarHeight(amount: number): number {
    const max = this.getSvcBalanceChartMax();
    return max > 0 ? (amount / max) * 100 : 0;
  }

  getConsChartBarColor(r: any): string {
    const flag = (r.flag || r.levyStatus || '').toLowerCase();
    if (flag.includes('reversed') || flag.includes('cancel')) return 'cons-bar-reversed';
    if (flag.includes('estimate') || flag.includes('levy')) return 'cons-bar-estimate';
    return 'cons-bar-actual';
  }

  getConsChartSorted(): any[] {
    const data = this.consumptionHistory();
    if (!data.length) return [];
    const monthOrder = ['july','august','september','october','november','december','january','february','march','april','may','june'];
    const getSortKey = (r: any): number => {
      const fy = (r.financialYear || r.finYear || '').trim();
      const fyYear = fy ? parseInt(fy.split('/')[0]) || 0 : 0;
      const bm = (r.billingmonth || r.billingMonth || '').toLowerCase().trim();
      const mi = monthOrder.indexOf(bm);
      return fyYear * 100 + (mi >= 0 ? mi : 50);
    };
    return [...data]
      .filter(r => {
        const bm = (r.billingmonth || r.billingMonth || '').toLowerCase().trim();
        return !bm.includes('open period') && bm !== 'current open period';
      })
      .sort((a, b) => getSortKey(a) - getSortKey(b))
      .slice(-12);
  }

  getConsChartMax(): number {
    const data = this.getConsChartSorted();
    if (!data.length) return 100;
    return Math.max(...data.map(r => this.getConsumptionVal(r)), 1);
  }

  getConsChartBarPct(r: any): number {
    const max = this.getConsChartMax();
    const val = this.getConsumptionVal(r);
    return max > 0 ? (val / max) * 100 : 0;
  }

  getConsChartMonthLabel(r: any): { mon: string; yr: string } {
    const bm = r.billingmonth || r.billingMonth || '';
    const fy = r.financialYear || r.finYear || '';
    if (bm && fy) {
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const idx = monthNames.findIndex(m => m.toLowerCase() === bm.toLowerCase());
      if (idx >= 0) {
        const years = fy.split('/');
        const year = idx >= 6 ? years[0] : years[1];
        return { mon: bm.substring(0, 3), yr: year?.slice(-2) || '' };
      }
    }
    if (bm.toLowerCase().includes('open period') || bm.toLowerCase().includes('current')) {
      return { mon: 'Open', yr: '' };
    }
    return { mon: bm.substring(0, 3) || '?', yr: '' };
  }

  computeMeterIntelligence(allReadings: any[], monthsOverride?: number): any {
    if (!allReadings || allReadings.length < 3) return null;
    const SPIKE_HIGH = 1.5;
    const SPIKE_LOW = 0.4;
    const STD_DAYS = 30;
    const months = monthsOverride ?? this.consIntelligenceMonths();

    const processed = allReadings.map((r: any) => {
      const cons = Number(r.consumption || r.units || r.totalConsumption || 0) || 0;
      const rdRaw = r.readingdays || r.readingDays || r.days;
      const rdNum = typeof rdRaw === 'number' ? rdRaw : (rdRaw ? parseInt(rdRaw) : NaN);
      const readingDays = (!isNaN(rdNum) && rdNum > 0) ? rdNum : 0;
      const dailyConsumption = readingDays > 0 ? cons / readingDays : 0;
      return {
        consumption: cons, readingDays, dailyConsumption,
        billingMonth: r.billingmonth || r.billingMonth || '',
        financialYear: r.financialYear || r.finYear || '',
        flag: r.flag || '', readingStatus: r.readingStatus || '',
        reading1Date: r.reading1Date || '', reading2Date: r.reading2Date || '',
        isSpike: false, spikeType: 'none' as string, spikePercent: 0,
      };
    });

    const billed = processed.filter(r => {
      const bm = r.billingMonth.toLowerCase().trim();
      const rs = r.readingStatus.toLowerCase();
      const flag = r.flag.toLowerCase();
      if (flag.includes('reversed') || flag.includes('cancel')) return false;
      if (bm.includes('open period') || bm === 'current open period') return false;
      if (rs.includes('awaiting') || rs.includes('unbilled') || rs.includes('pending')) return false;
      if (flag.includes('awaiting') || flag.includes('unbilled')) return false;
      if (flag.includes('estimate') || flag.includes('levy')) return false;
      if (r.readingDays <= 0) return false;
      return r.consumption > 0;
    });

    const selectedBilled = billed.slice(0, months);
    if (selectedBilled.length < 2) return { processed, noData: true };

    const totalConsumption = selectedBilled.reduce((s, r) => s + r.consumption, 0);
    const totalDays = selectedBilled.reduce((s, r) => s + r.readingDays, 0);
    const weightedAvgDaily = totalDays > 0 ? totalConsumption / totalDays : 0;
    const avgMonthlyConsumption = weightedAvgDaily * STD_DAYS;

    const dailyValues = selectedBilled.map(r => r.dailyConsumption);
    const minDaily = Math.min(...dailyValues);
    const maxDaily = Math.max(...dailyValues);

    const allWithSpikes = processed.map(r => {
      if (r.consumption <= 0 || weightedAvgDaily <= 0 || r.readingDays <= 0) return { ...r };
      const ratio = r.dailyConsumption / weightedAvgDaily;
      const isHigh = ratio >= SPIKE_HIGH;
      const isLow = ratio <= SPIKE_LOW && r.dailyConsumption > 0;
      const pctDev = ((r.dailyConsumption - weightedAvgDaily) / weightedAvgDaily) * 100;
      return { ...r, isSpike: isHigh || isLow, spikeType: isHigh ? 'high' : isLow ? 'low' : 'none', spikePercent: pctDev };
    });

    const spikeCount = allWithSpikes.filter(r => r.isSpike).length;
    const spikes = allWithSpikes.filter(r => r.isSpike);

    const trendChart = allWithSpikes.filter(r => r.consumption > 0).slice(-(months + 4));
    const trendMax = Math.max(...trendChart.map(r => r.dailyConsumption), weightedAvgDaily * 1.5);

    return {
      avgDailyConsumption: weightedAvgDaily, avgMonthlyConsumption,
      minDaily, maxDaily, periodMonths: selectedBilled.length,
      totalConsumption, totalDays, spikeCount, spikes,
      allWithSpikes, trendChart, trendMax, noData: false,
    };
  }

  parseTariffTiers(svc: any): { label: string; from: number; to: number; rate: number }[] {
    const costInterVal = svc?.costInterVal || svc?.costInterval || '';
    if (!costInterVal) return [];
    const tiers: { label: string; from: number; to: number; rate: number }[] = [];
    const normalize = (s: string) => s.replace(/[R$,]/g, '').replace(/\s*per\s*(unit|kl|kwh|kilolitre|kilowatt)\s*/gi, '').trim();
    const lines = String(costInterVal).split(/[\n;|]+/).map(normalize).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/([\d,.]+)\s*[-–—]\s*([\d,.]+)\s*[=:@]\s*([\d,.]+)/);
      if (match) {
        const from = parseFloat(match[1].replace(/,/g, ''));
        const to = parseFloat(match[2].replace(/,/g, ''));
        const rate = parseFloat(match[3].replace(/,/g, ''));
        if (!isNaN(from) && !isNaN(to) && !isNaN(rate) && rate > 0) {
          tiers.push({ label: `${from} – ${to}`, from, to, rate });
        }
        continue;
      }
      const above = line.match(/(?:above|over|>)\s*([\d,.]+)\s*[=:@]\s*([\d,.]+)/i);
      if (above) {
        const from = parseFloat(above[1].replace(/,/g, ''));
        const rate = parseFloat(above[2].replace(/,/g, ''));
        if (!isNaN(from) && !isNaN(rate) && rate > 0) {
          tiers.push({ label: `Above ${from}`, from, to: Infinity, rate });
        }
        continue;
      }
      const upTo = line.match(/(?:up\s*to|first|<=?)\s*([\d,.]+)\s*[=:@]\s*([\d,.]+)/i);
      if (upTo) {
        const to = parseFloat(upTo[1].replace(/,/g, ''));
        const rate = parseFloat(upTo[2].replace(/,/g, ''));
        if (!isNaN(to) && !isNaN(rate) && rate > 0) {
          tiers.push({ label: `0 – ${to}`, from: 0, to, rate });
        }
        continue;
      }
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const val = parseFloat(parts[0].replace(/,/g, ''));
        const rate = parseFloat(parts[parts.length - 1].replace(/,/g, ''));
        if (!isNaN(val) && !isNaN(rate) && rate > 0) {
          const lastTo = tiers.length > 0 ? tiers[tiers.length - 1].to : 0;
          tiers.push({ label: parts[0], from: lastTo === Infinity ? 0 : lastTo, to: val > 0 ? val : Infinity, rate });
        }
      }
    }
    tiers.sort((a, b) => a.from - b.from);
    return tiers;
  }

  computeBillingEstimate(allReadings: any[], meterOverride?: any, vatOverride?: number): any {
    if (!allReadings || !allReadings.length) return null;
    const meter = meterOverride ?? this.consumptionSelectedMeter();
    if (!meter) return null;

    const services = this.getServicesList();
    let matchedSvc = meter;
    if (services.length > 0) {
      const meterDesc = (meter.serviceDesc || meter.serviceDescription || '').toLowerCase();
      const meterTariff = (meter.tariff || '').toLowerCase();
      const found = services.find((s: any) => {
        const sType = (s.serviceType || s.serviceTypeDesc || s.serviceDesc || '').toLowerCase();
        const sTariff = (s.tariff || '').toLowerCase();
        if (meterDesc && sType && meterDesc.includes(sType.split(' ')[0])) return true;
        if (meterTariff && sTariff && meterTariff === sTariff) return true;
        return false;
      });
      if (found) matchedSvc = { ...meter, costInterVal: found.costInterVal, endDate: found.endDate, startDate: found.startDate };
    }

    const tiers = this.parseTariffTiers(matchedSvc);
    if (!tiers.length) return null;

    const factor = Number(matchedSvc.tarifffactor || matchedSvc.factorQuantity || 1) || 1;
    const vatRate = vatOverride ?? this.consBillingVatRate();
    const STD_DAYS = 30;

    const unbilled = allReadings.filter(item => {
      const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
      const rs = (item.readingStatus || '').toLowerCase();
      const flag = (item.flag || '').toLowerCase();
      if (flag.includes('reversed') || flag.includes('cancel')) return false;
      if (flag.includes('estimate') || flag.includes('levy') || rs.includes('estimate')) return false;
      if (bm === 'current open period' || bm.includes('open period')) return true;
      if (rs.includes('awaiting') || rs.includes('unbilled') || rs.includes('pending')) return true;
      return false;
    });

    const calcTiered = (consumption: number, readingDays?: number) => {
      if (consumption <= 0 || !tiers.length) return { breakdown: [], subtotal: 0, isProRated: false };
      const days = readingDays && readingDays > 0 ? readingDays : STD_DAYS;
      const dayRatio = days / STD_DAYS;
      const isProRated = days !== STD_DAYS;
      const breakdown: { label: string; units: number; rate: number; amount: number; proFrom?: number; proTo?: number }[] = [];
      let remaining = consumption;
      for (const tier of tiers) {
        if (remaining <= 0) break;
        const proFrom = tier.from * dayRatio;
        const proTo = tier.to === Infinity ? Infinity : tier.to * dayRatio;
        const tierCap = proTo === Infinity ? remaining : Math.max(0, proTo - proFrom);
        const units = Math.min(remaining, tierCap);
        if (units > 0) {
          breakdown.push({ label: tier.label, units, rate: tier.rate, amount: units * tier.rate * factor, proFrom: Math.round(proFrom * 100) / 100, proTo: proTo === Infinity ? undefined : Math.round(proTo * 100) / 100 });
          remaining -= units;
        }
      }
      const subtotal = breakdown.reduce((s, b) => s + b.amount, 0);
      return { breakdown, subtotal, isProRated };
    };

    let estimates: any[] = [];
    if (unbilled.length > 0) {
      estimates = unbilled.map(r => {
        const cons = Number(r.consumption || r.units || r.totalConsumption || 0) || 0;
        if (cons <= 0) return null;
        const rdRaw = r.readingdays || r.readingDays;
        const rdNum = typeof rdRaw === 'number' ? rdRaw : (rdRaw ? parseInt(rdRaw) : NaN);
        const readingDays = (!isNaN(rdNum) && rdNum > 0) ? rdNum : undefined;
        const { breakdown, subtotal, isProRated } = calcTiered(cons, readingDays);
        const vatAmount = subtotal * (vatRate / 100);
        const dailyCons = readingDays ? cons / readingDays : undefined;
        return {
          consumption: cons, billingMonth: r.billingmonth || r.billingMonth || 'Current',
          readingDate: r.reading2Date || r.reading1Date || '',
          newReading: r.reading2 ?? '-', oldReading: r.reading1 ?? '-',
          readingDays: readingDays ?? '-', dailyConsumption: dailyCons,
          isProRated, breakdown, subtotal, vatAmount, total: subtotal + vatAmount, factor,
        };
      }).filter(Boolean);
    }

    const billedHist = allReadings.filter(item => {
      const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
      const flag = (item.flag || '').toLowerCase();
      if (bm === 'current open period' || bm.includes('open period')) return false;
      if (flag.includes('reversed') || flag.includes('cancel')) return false;
      const c = Number(item.consumption || item.units || 0) || 0;
      return c > 0;
    });
    const historicalAvg = billedHist.length >= 2 ? (() => {
      const recent = billedHist.slice(0, 6);
      const total = recent.reduce((s: number, r: any) => s + (Number(r.consumption || r.units || 0) || 0), 0);
      return { avg: total / recent.length, months: recent.length };
    })() : null;

    let projection: any = null;
    if (estimates.length === 0 && historicalAvg) {
      const { breakdown, subtotal } = calcTiered(historicalAvg.avg);
      const vatAmount = subtotal * (vatRate / 100);
      projection = { avg: historicalAvg.avg, months: historicalAvg.months, subtotal, vatAmount, total: subtotal + vatAmount };
    }

    const previousEstimates = allReadings.filter(item => {
      const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
      const flag = (item.flag || '').toLowerCase();
      if (bm === 'current open period' || bm.includes('open period')) return false;
      if (flag.includes('reversed') || flag.includes('cancel')) return false;
      if (!flag.includes('estimate') && !flag.includes('levy')) return false;
      return (Number(item.consumption || item.units || 0) || 0) > 0;
    });

    return {
      hasTiers: tiers.length > 0, estimates, historicalAvg, projection, previousEstimates,
      tiers, factor, vatRate, STD_DAYS,
    };
  }

  getPpInitialDownPayment(): string {
    const plans = this.tabData()?.plans || [];
    if (plans.length === 0) return '0.00';
    return this.formatCurrency(Number(plans[0]?.initialDownPayment ?? plans[0]?.downPayment ?? plans[0]?.depositAmount ?? 0) || 0);
  }

  getRemainingCapitalEntries(): { label: string; value: string }[] {
    const rc = this.tabData()?.remainingCapital;
    if (!rc) return [];
    if (typeof rc !== 'object') return [{ label: 'Remaining Capital', value: 'R ' + this.formatCurrency(Number(rc) || 0) }];
    return Object.entries(rc)
      .filter(([k, v]) => !k.startsWith('_') && v != null && v !== 0)
      .map(([key, val]) => ({
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        value: typeof val === 'number' ? 'R ' + this.formatCurrency(val) : String(val),
      }));
  }

  getRepaymentStatusItems(): { label: string; value: string; isActive: boolean }[] {
    const items = this.tabData()?.repaymentStatus || [];
    const labels = ['Interest Waiver', 'Rebate'];
    return items.map((item: any, i: number) => {
      const value = typeof item === 'string' ? item : item?.status || item?.description || JSON.stringify(item);
      const isActive = value && value !== 'N/A' && value !== 'None' && value !== '';
      return { label: labels[i] || `Status ${i + 1}`, value, isActive };
    });
  }

  getDepositTotalAmount(): number {
    const da = this.tabData()?.depositAmount;
    if (typeof da === 'number') return da;
    return Number(da?.totalDeposit ?? da?.amount ?? 0) || 0;
  }

  getDepositPaidAmt(dep: any): number {
    return Number(dep.paidAmount ?? dep.paid ?? dep.amountPaid ?? dep.paidAmt ?? 0) || 0;
  }

  getDepositColumnTotal(field: string): number {
    const deposits = this.tabData()?.deposits || [];
    return deposits.reduce((sum: number, dep: any) => {
      if (field === 'depositAmount') {
        return sum + (Number(dep.depositAmount ?? dep.deposit ?? dep.amount ?? 0) || 0);
      }
      if (field === 'paidAmount') {
        return sum + this.getDepositPaidAmt(dep);
      }
      return sum;
    }, 0);
  }

  isSummaryTotalRow(row: any): boolean {
    const desc = this.getSummaryDescription(row).toLowerCase();
    return desc === 'total' || desc === 'closing balance' || desc === 'receipts' || desc === 'opening balance';
  }

  private static readonly SA_PROVINCE_MAP: Record<string, string> = {
    'C': 'Western Cape', 'T': 'Gauteng', 'N': 'KwaZulu-Natal',
    'F': 'Free State', 'K': 'Eastern Cape', 'L': 'Limpopo',
    'J': 'Mpumalanga', 'Q': 'North West', 'B': 'Northern Cape',
  };

  parseSgNumber(sg: string): { erf: string; portion: string; town: string; province: string; regDiv: string; raw: string } | null {
    if (!sg) return null;
    let clean = sg.replace(/\s/g, '');

    const compactMatch = clean.match(/^([A-Za-z])(\d{3})(\d{4})(\d{8})(\d{5})$/);
    if (compactMatch) {
      clean = `${compactMatch[1]}${compactMatch[2]}/${compactMatch[3]}/${compactMatch[4]}/${compactMatch[5]}`;
    }

    const match4 = clean.match(/^([A-Za-z])(\d{3})\/(\d{4})\/(\d+)\/(\d+)$/);
    if (match4) {
      const provinceCode = match4[1].toUpperCase();
      const regDiv = match4[2];
      const erfNum = parseInt(match4[4], 10);
      const portionNum = parseInt(match4[5], 10);
      if (erfNum === 0) return null;
      return {
        erf: String(erfNum),
        portion: portionNum === 0 ? 'Remainder' : String(portionNum),
        town: this.getRegDivTown(regDiv, provinceCode),
        province: EnquiriesGeneralComponent.SA_PROVINCE_MAP[provinceCode] || provinceCode,
        regDiv,
        raw: sg,
      };
    }

    const match3 = clean.match(/^([A-Za-z])(\d{3})\/(\d+)\/(\d+)$/);
    if (match3) {
      const provinceCode = match3[1].toUpperCase();
      const regDiv = match3[2];
      const erfNum = parseInt(match3[3], 10);
      const portionNum = parseInt(match3[4], 10);
      if (erfNum === 0) return null;
      return {
        erf: String(erfNum),
        portion: portionNum === 0 ? 'Remainder' : String(portionNum),
        town: this.getRegDivTown(regDiv, provinceCode),
        province: EnquiriesGeneralComponent.SA_PROVINCE_MAP[provinceCode] || provinceCode,
        regDiv,
        raw: sg,
      };
    }

    return null;
  }

  private getRegDivTown(regDiv: string, provinceCode: string): string {
    const knownDivisions: Record<string, string> = {
      'C027': 'George', 'C028': 'Oudtshoorn', 'C024': 'Mossel Bay',
      'C030': 'Knysna', 'C032': 'Plettenberg Bay', 'C001': 'Cape Town',
      'C006': 'Stellenbosch', 'C009': 'Paarl', 'C002': 'Wynberg',
      'C021': 'Worcester', 'C003': 'Simon\'s Town', 'C026': 'Riversdale',
      'C029': 'Uniondale', 'C031': 'Humansdorp', 'C025': 'Heidelberg',
      'T001': 'Johannesburg', 'T002': 'Pretoria', 'N001': 'Durban',
      'F001': 'Bloemfontein', 'K001': 'East London', 'K002': 'Port Elizabeth',
    };
    const key = provinceCode + regDiv;
    return knownDivisions[key] || '';
  }

  formatSgBreakdown(sg: string): string {
    const parsed = this.parseSgNumber(sg);
    if (!parsed) return sg || '';
    let result = `Erf ${parsed.erf}`;
    if (parsed.portion !== 'Remainder') {
      result += ` Ptn ${parsed.portion}`;
    } else {
      result += ' (RE)';
    }
    if (parsed.town) {
      result += `, ${parsed.town}`;
    }
    return result;
  }

  formatSgErf(sg: string, fallbackErf?: string): string {
    if (!sg) return fallbackErf || '-';
    const parts = sg.split('/');
    return parts.length >= 3 ? parts[2].replace(/^0+/, '') || parts[2] : (fallbackErf || '-');
  }

  formatSgPortion(sg: string): string {
    if (!sg) return '-';
    const parts = sg.split('/');
    return parts.length >= 4 ? parts[3].replace(/^0+/, '') || '0' : '-';
  }

  formatSgAllotment(sg: string): string {
    if (!sg) return '-';
    const parts = sg.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '-';
  }

  formatIntValue(v: any): string {
    if (v === null || v === undefined || v === '') return '-';
    return typeof v === 'number' ? v.toLocaleString('en-ZA') : String(v);
  }

  getNtPropertyCategoryDisplay(id: any, desc?: string): string {
    if (id === null || id === undefined) return '-';
    const catMap: Record<number, string> = {
      1: 'Unknown', 2: 'RES', 3: 'Residential Accommodation', 4: 'State Business',
      5: 'POWC', 6: 'NMON', 7: 'Creches', 8: 'Guesthouses & B&Bs', 9: 'Flats',
      10: 'State Residential', 32: 'Residential Vacant', 33: 'PSPV', 34: 'POWP',
      35: 'POWG', 36: 'POWV', 37: 'PROT', 38: 'MUNG', 40: 'MUNRO', 41: 'MUN'
    };
    return catMap[Number(id)] || desc || `Category ${id}`;
  }

  private linkedRequestToken = 0;

  async loadLinkedAccounts(accountId: number) {
    const token = ++this.linkedRequestToken;
    this.linkedAccountsLoading.set(true);
    this.linkedAccounts.set([]);
    this.linkedTotalOutstanding.set(0);
    this.linkedExpandedAcct.set(null);
    this.linkedServicesMap.set({});
    try {
      const result = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/linked-accounts-on-property/${accountId}`)
      );
      if (this.linkedRequestToken !== token) return;
      const arr = this.normalizeArray(result);
      const currentAcctNum = this.selectedAccount()?.['accountNumber'] || '';
      const linked = arr.filter((a: any) => {
        const num = a.accountNumber || a.account || '';
        return num !== currentAcctNum;
      });
      linked.sort((a: any, b: any) => {
        const numA = a.accountNumber || a.accountNo || '';
        const numB = b.accountNumber || b.accountNo || '';
        return String(numA).localeCompare(String(numB), undefined, { numeric: true });
      });
      if (linked.length > 0) {
        console.log('[linked-accounts] keys:', Object.keys(linked[0]));
      }
      this.linkedAccounts.set(linked);
      const total = linked.reduce((sum: number, a: any) => {
        return sum + (Number(a.outStandingAmount) || Number(a.outStandingAmt) || Number(a.totalOutstanding) || Number(a.balance) || 0);
      }, 0);
      this.linkedTotalOutstanding.set(total);
    } catch (e) {
      if (this.linkedRequestToken !== token) return;
      console.error('[linked-accounts] Failed to load:', e);
      this.linkedAccounts.set([]);
    } finally {
      if (this.linkedRequestToken === token) {
        this.linkedAccountsLoading.set(false);
      }
    }
  }

  private propDebtRequestToken = 0;

  async loadPropertyDebt(accountId: number) {
    const token = ++this.propDebtRequestToken;
    this.propDebtLoading.set(true);
    this.propDebtAccounts.set([]);
    this.propDebtTotals.set(null);
    this.propDebtExpandedAcct.set(null);
    try {
      const linkedResult = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/linked-accounts-on-property/${accountId}`)
      );
      if (this.propDebtRequestToken !== token) return;
      let allAccounts = this.normalizeArray(linkedResult);
      const currentAcctNum = this.selectedAccount()?.['accountNumber'] || '';
      const currentAcctId = this.getAccountId(this.selectedAccount());
      const hasCurrent = allAccounts.some((a: any) =>
        (a.accountNumber || a.account || '') === currentAcctNum ||
        String(a.account_ID || a.accountID || '') === String(currentAcctId)
      );
      if (!hasCurrent) {
        allAccounts = [{ accountNumber: currentAcctNum, account_ID: currentAcctId, name: this.getAccountName(this.selectedAccount()), accountStatus: this.selectedAccount()?.['accountStatus'] || this.selectedAccount()?.['statusDesc'], accountType: this.selectedAccount()?.['accountDesc'] || this.selectedAccount()?.['accountType'] }, ...allAccounts];
      }

      const balancePromises = allAccounts.map(async (acct: any) => {
        const acctId = acct.account_ID || acct.accountID || acct.accountNumber;
        if (!acctId) return { ...acct, balanceItems: [], balanceError: true };
        try {
          const bal = await this.fetchAccountBalance(Number(acctId));
          const items = Array.isArray(bal) ? bal : bal ? [bal] : [];
          let acctOutstanding = 0, acctCurrent = 0, acctD30 = 0, acctD60 = 0, acctD90 = 0, acctD120Plus = 0;
          for (const item of items) {
            acctOutstanding += Number(item.totalOutStanding || item.totalOutstandingAmount || item.totalOutstanding || 0) || 0;
            acctCurrent += Number(item.current || item.currentAmount || 0) || 0;
            acctD30 += Number(item.days30 || 0) || 0;
            acctD60 += Number(item.days60 || 0) || 0;
            acctD90 += Number(item.days90 || 0) || 0;
            acctD120Plus += (Number(item.days120 || 0) || 0) + (Number(item.days150 || 0) || 0) + (Number(item.days180 || item.untill360 || 0) || 0);
          }
          return {
            ...acct,
            balanceItems: items,
            balanceError: false,
            totalOutstanding: acctOutstanding,
            agingCurrent: acctCurrent,
            agingD30: acctD30,
            agingD60: acctD60,
            agingD90: acctD90,
            agingD120Plus: acctD120Plus,
          };
        } catch {
          return { ...acct, balanceItems: [], balanceError: true, totalOutstanding: 0, agingCurrent: 0, agingD30: 0, agingD60: 0, agingD90: 0, agingD120Plus: 0 };
        }
      });

      const results = await Promise.all(balancePromises);
      if (this.propDebtRequestToken !== token) return;

      results.sort((a: any, b: any) => {
        const numA = a.accountNumber || a.accountNo || '';
        const numB = b.accountNumber || b.accountNo || '';
        return String(numA).localeCompare(String(numB), undefined, { numeric: true });
      });
      this.propDebtAccounts.set(results);

      const totals = results.reduce((acc: any, a: any) => ({
        outstanding: acc.outstanding + (a.totalOutstanding || 0),
        current: acc.current + (a.agingCurrent || 0),
        d30: acc.d30 + (a.agingD30 || 0),
        d60: acc.d60 + (a.agingD60 || 0),
        d90: acc.d90 + (a.agingD90 || 0),
        d120Plus: acc.d120Plus + (a.agingD120Plus || 0),
        accountCount: acc.accountCount + 1,
        withDebt: acc.withDebt + ((a.totalOutstanding || 0) > 0 ? 1 : 0),
      }), { outstanding: 0, current: 0, d30: 0, d60: 0, d90: 0, d120Plus: 0, accountCount: 0, withDebt: 0 });
      this.propDebtTotals.set(totals);
    } catch (e) {
      if (this.propDebtRequestToken !== token) return;
      console.error('[property-debt] Failed:', e);
      this.propDebtAccounts.set([]);
      this.propDebtTotals.set(null);
    } finally {
      if (this.propDebtRequestToken === token) {
        this.propDebtLoading.set(false);
      }
    }
  }

  togglePropDebtExpand(acctKey: string) {
    this.propDebtExpandedAcct.set(this.propDebtExpandedAcct() === acctKey ? null : acctKey);
  }

  async toggleLinkedExpand(acctKey: string, accountId: number | string) {
    if (this.linkedExpandedAcct() === acctKey) {
      this.linkedExpandedAcct.set(null);
      return;
    }
    this.linkedExpandedAcct.set(acctKey);
    const map = this.linkedServicesMap();
    if (map[acctKey]) return;
    this.linkedServicesLoading.set(acctKey);
    try {
      const result = await firstValueFrom(
        this.api.get<any>(`/api/platinum/billing-enquiry/all-services/${accountId}`)
      );
      const services = this.normalizeArray(result);
      if (services.length > 0) {
        console.log('[linked-services] keys:', Object.keys(services[0]));
      }
      this.linkedServicesMap.set({ ...this.linkedServicesMap(), [acctKey]: services });
    } catch (e) {
      console.error('[linked-services] Failed:', e);
      this.linkedServicesMap.set({ ...this.linkedServicesMap(), [acctKey]: [] });
    } finally {
      this.linkedServicesLoading.set(null);
    }
  }

  getLinkedAcctId(acct: any): string {
    return String(acct.account_ID || acct.accountID || acct.accountNumber || acct.account || '');
  }

  private getExportOpts(tabName: string, title: string): ExportOptions {
    const acct = this.selectedAccount();
    const basic = this.getAccountBasic();
    return {
      title,
      tabName,
      accountNo: this.getAccountNum(acct),
      accountName: this.getAccountName(acct),
      accountStatus: basic?.accountStatus || acct?.accountStatus || acct?.statusDesc || '',
      address: basic?.deliveryAddress || acct?.deliveryAddress || acct?.locationAddress || '',
      financialYear: this.userFinYear(),
    };
  }

  exportBalanceCsv(): void {
    const items = this.getBalanceItems();
    if (!items.length) { this.toast.show('No balance data to export', 'error'); return; }
    const headers = ['Service', 'New Charge', 'Current', '30 Days', '60 Days', '90 Days', '120 Days', '150 Days', '180+ Days', 'Total Outstanding'];
    const rows = items.map((i: any) => [
      i.serviceType || i.serviceTypeDesc || i.description || i.serviceDescription || '',
      this.getDebtVal(i, 'newCharge'), this.getDebtVal(i, 'current'),
      this.getDebtVal(i, 'days30'), this.getDebtVal(i, 'days60'), this.getDebtVal(i, 'days90'),
      this.getDebtVal(i, 'days120'), this.getDebtVal(i, 'days150'), this.getDebtVal(i, 'days180'),
      this.getDebtVal(i, 'totalOutStanding'),
    ]);
    this.exportService.exportCsv(this.getExportOpts('Balance_Debt', 'BALANCE / DEBT AGING REPORT'), headers, rows);
    this.toast.show('Balance report exported', 'success');
  }

  exportBalancePdf(): void {
    const items = this.getBalanceItems();
    if (!items.length) { this.toast.show('No balance data to export', 'error'); return; }
    const headers = ['Service', 'New Charge', 'Current', '30 Days', '60 Days', '90 Days', '120 Days', '150 Days', '180+ Days', 'Total'];
    const aligns: ('left' | 'right')[] = ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'];
    const rows = items.map((i: any) => [
      i.serviceType || i.serviceTypeDesc || i.description || i.serviceDescription || '',
      this.formatCurrency(this.getDebtVal(i, 'newCharge')), this.formatCurrency(this.getDebtVal(i, 'current')),
      this.formatCurrency(this.getDebtVal(i, 'days30')), this.formatCurrency(this.getDebtVal(i, 'days60')),
      this.formatCurrency(this.getDebtVal(i, 'days90')), this.formatCurrency(this.getDebtVal(i, 'days120')),
      this.formatCurrency(this.getDebtVal(i, 'days150')), this.formatCurrency(this.getDebtVal(i, 'days180')),
      this.formatCurrency(this.getDebtVal(i, 'totalOutStanding')),
    ]);
    this.exportService.exportPdf(this.getExportOpts('Balance_Debt', 'BALANCE / DEBT AGING REPORT'), headers, rows, aligns);
  }

  exportPropertyDebtCsv(): void {
    const accounts = this.propDebtAccounts();
    if (!accounts.length) { this.toast.show('No property debt data to export', 'error'); return; }
    const headers = ['Account Number', 'Account Name', 'Status', 'Total Outstanding', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days'];
    const rows = accounts.map((a: any) => [
      a.accountNumber || a.accountNo || '', a.name || a.accountName || '',
      a.accountStatus || a.status || '', a.totalOutstanding || 0,
      a.agingCurrent || 0, a.agingD30 || 0, a.agingD60 || 0, a.agingD90 || 0, a.agingD120Plus || 0,
    ]);
    this.exportService.exportCsv(this.getExportOpts('Property_Debt', 'PROPERTY DEBT REPORT'), headers, rows);
    this.toast.show('Property debt report exported', 'success');
  }

  exportPropertyDebtPdf(): void {
    const accounts = this.propDebtAccounts();
    if (!accounts.length) { this.toast.show('No property debt data to export', 'error'); return; }
    const headers = ['Account Number', 'Name', 'Status', 'Total Outstanding', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'];
    const rows = accounts.map((a: any) => [
      a.accountNumber || a.accountNo || '', a.name || a.accountName || '',
      a.accountStatus || a.status || '',
      this.formatCurrency(a.totalOutstanding || 0), this.formatCurrency(a.agingCurrent || 0),
      this.formatCurrency(a.agingD30 || 0), this.formatCurrency(a.agingD60 || 0),
      this.formatCurrency(a.agingD90 || 0), this.formatCurrency(a.agingD120Plus || 0),
    ]);
    this.exportService.exportPdf(this.getExportOpts('Property_Debt', 'PROPERTY DEBT REPORT'), headers, rows, aligns);
  }

  exportReceiptsCsv(): void {
    const txns = this.getFilteredReceipts();
    if (!txns.length) { this.toast.show('No receipts to export', 'error'); return; }
    const headers = ['Receipt No', 'Date', 'Payment Type', 'Amount', 'Cashier', 'Office', 'Status'];
    const rows = txns.map((t: any) => [
      this.getReceiptNo(t), this.formatDate(t.receiptDate || t.transactionDate || t.date),
      t.paymentType || '', Number(t.receiptAmount || t.amount || t.tenderAmount || 0),
      t.cashierName || t.cashier || '', t.officeName || t.office || '',
      (t.isCancelled || t.cancelReson || t.cancelReason) ? 'Cancelled' : 'Active',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Receipts', 'RECEIPT HISTORY REPORT'), headers, rows);
    this.toast.show('Receipts exported', 'success');
  }

  exportReceiptsPdf(): void {
    const txns = this.getFilteredReceipts();
    if (!txns.length) { this.toast.show('No receipts to export', 'error'); return; }
    const headers = ['Receipt No', 'Date', 'Type', 'Amount', 'Cashier', 'Office', 'Status'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'left', 'right', 'left', 'left', 'left'];
    const rows = txns.map((t: any) => [
      this.getReceiptNo(t), this.formatDate(t.receiptDate || t.transactionDate || t.date),
      t.paymentType || '', this.formatCurrency(Number(t.receiptAmount || t.amount || t.tenderAmount || 0)),
      t.cashierName || t.cashier || '', t.officeName || t.office || '',
      (t.isCancelled || t.cancelReson || t.cancelReason) ? 'Cancelled' : 'Active',
    ]);
    this.exportService.exportPdf(this.getExportOpts('Receipts', 'RECEIPT HISTORY REPORT'), headers, rows, aligns);
  }

  exportDepositsCsv(): void {
    const data = this.tabData();
    const deposits = data?.deposits || [];
    if (!deposits.length) { this.toast.show('No deposit data to export', 'error'); return; }
    const headers = ['Date', 'Description', 'Amount Paid', 'Interest Accrued', 'Type', 'Status'];
    const rows = deposits.map((d: any) => [
      this.formatDate(d.depositDate || d.date || d.datePaid),
      d.description || d.depositType || d.type || '',
      Number(d.amountPaid || d.amount || d.depositAmount || 0),
      Number(d.interestAccrued || d.interest || 0),
      d.depositType || d.type || '', d.status || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Deposits', 'DEPOSITS REPORT'), headers, rows);
    this.toast.show('Deposits exported', 'success');
  }

  exportDepositsPdf(): void {
    const data = this.tabData();
    const deposits = data?.deposits || [];
    if (!deposits.length) { this.toast.show('No deposit data to export', 'error'); return; }
    const headers = ['Date', 'Description', 'Amount Paid', 'Interest', 'Type', 'Status'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'right', 'right', 'left', 'left'];
    const rows = deposits.map((d: any) => [
      this.formatDate(d.depositDate || d.date || d.datePaid),
      d.description || d.depositType || d.type || '',
      this.formatCurrency(Number(d.amountPaid || d.amount || d.depositAmount || 0)),
      this.formatCurrency(Number(d.interestAccrued || d.interest || 0)),
      d.depositType || d.type || '', d.status || '',
    ]);
    this.exportService.exportPdf(this.getExportOpts('Deposits', 'DEPOSITS REPORT'), headers, rows, aligns);
  }

  exportPaymentPlansCsv(): void {
    const data = this.tabData();
    const plans = data?.plans || data?.paymentPlans || [];
    if (!plans.length) { this.toast.show('No payment plan data to export', 'error'); return; }
    const headers = ['Plan Type', 'Start Date', 'End Date', 'Installment Amount', 'Total Amount', 'Remaining', 'Status'];
    const rows = plans.map((p: any) => [
      p.planType || p.type || p.arrangementType || p.capitalCostType || '',
      this.formatDate(p.startDate || p.dateFrom), this.formatDate(p.endDate || p.dateTo),
      Number(p.installmentAmount || p.installment || p.instalment || 0), Number(p.totalAmount || p.total || p.originalAmount || 0),
      Number(p.remainingCapital || p.remaining || p.balance || 0), p.status || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Payment_Plans', 'PAYMENT PLANS REPORT'), headers, rows);
    this.toast.show('Payment plans exported', 'success');
  }

  exportPaymentPlansPdf(): void {
    const data = this.tabData();
    const plans = data?.plans || data?.paymentPlans || [];
    if (!plans.length) { this.toast.show('No payment plan data to export', 'error'); return; }
    const headers = ['Plan Type', 'Start Date', 'End Date', 'Installment', 'Total', 'Remaining', 'Status'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'left', 'right', 'right', 'right', 'left'];
    const rows = plans.map((p: any) => [
      p.planType || p.type || p.arrangementType || p.capitalCostType || '',
      this.formatDate(p.startDate || p.dateFrom), this.formatDate(p.endDate || p.dateTo),
      this.formatCurrency(Number(p.installmentAmount || p.installment || p.instalment || 0)),
      this.formatCurrency(Number(p.totalAmount || p.total || p.originalAmount || 0)),
      this.formatCurrency(Number(p.remainingCapital || p.remaining || p.balance || 0)),
      p.status || '',
    ]);
    this.exportService.exportPdf(this.getExportOpts('Payment_Plans', 'PAYMENT PLANS REPORT'), headers, rows, aligns);
  }

  getBvpRowLabel(r: any): string {
    return r.processingMonth || r.month || r.billingMonth || r.period || r.serviceDescription || r.serviceType || r.serviceTypeDesc || r.description || '';
  }

  exportBilledVsPaidCsv(): void {
    const rows_data = this.tabData()?.billedVsPaid || [];
    if (!rows_data.length) { this.toast.show('No billed vs paid data to export', 'error'); return; }
    const headers = ['Period', 'Financial Year', 'Billed Amount', 'Paid Amount', 'Variance', 'Collection Rate %'];
    const rows = rows_data.map((r: any) => {
      const billed = this.getBvpRowBilled(r);
      const paid = this.getBvpRowPaid(r);
      const variance = billed - paid;
      const rate = billed > 0 ? Math.round((paid / billed) * 1000) / 10 : 0;
      return [this.getBvpRowLabel(r), r.financialYear || this.bvpFinYear() || '', billed, paid, variance, rate];
    });
    this.exportService.exportCsv(this.getExportOpts('Billed_vs_Paid', 'BILLED VS PAID REPORT'), headers, rows);
    this.toast.show('Billed vs Paid report exported', 'success');
  }

  exportBilledVsPaidPdf(): void {
    const rows_data = this.tabData()?.billedVsPaid || [];
    if (!rows_data.length) { this.toast.show('No billed vs paid data to export', 'error'); return; }
    const headers = ['Period', 'Financial Year', 'Billed Amount', 'Paid Amount', 'Variance', 'Collection Rate %'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'right', 'right', 'right', 'right'];
    const rows = rows_data.map((r: any) => {
      const billed = this.getBvpRowBilled(r);
      const paid = this.getBvpRowPaid(r);
      const variance = billed - paid;
      const rate = billed > 0 ? Math.round((paid / billed) * 1000) / 10 : 0;
      return [this.getBvpRowLabel(r), r.financialYear || this.bvpFinYear() || '',
        this.formatCurrency(billed), this.formatCurrency(paid),
        this.formatCurrency(variance), `${rate}%`];
    });
    this.exportService.exportPdf(this.getExportOpts('Billed_vs_Paid', 'BILLED VS PAID REPORT'), headers, rows, aligns);
  }

  exportServicesCsv(): void {
    const services = this.getServicesList();
    if (!services.length) { this.toast.show('No services data to export', 'error'); return; }
    const headers = ['Service Description', 'Status', 'Tariff Code', 'Tariff Rate', 'Meter Number', 'Frequency', 'Connection Size'];
    const rows = services.map((s: any) => [
      s.serviceDescription || s.description || s.serviceTypeDescription || '',
      s.status || s.serviceStatus || '', s.tariffCode || s.tariff || '',
      s.tariffRate || s.rate || '', s.meterNo || s.physicalMeterNo || '',
      s.frequency || '', s.connectionSize || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Services', 'SERVICES REPORT'), headers, rows);
    this.toast.show('Services exported', 'success');
  }

  exportServicesPdf(): void {
    const services = this.getServicesList();
    if (!services.length) { this.toast.show('No services data to export', 'error'); return; }
    const headers = ['Service Description', 'Status', 'Tariff Code', 'Rate', 'Meter No', 'Frequency'];
    const rows = services.map((s: any) => [
      s.serviceDescription || s.description || s.serviceTypeDescription || '',
      s.status || s.serviceStatus || '', s.tariffCode || s.tariff || '',
      s.tariffRate || s.rate || '', s.meterNo || s.physicalMeterNo || '', s.frequency || '',
    ]);
    this.exportService.exportPdf(this.getExportOpts('Services', 'SERVICES REPORT'), headers, rows);
  }

  exportConsumptionCsv(): void {
    const history = this.consumptionHistory();
    const meter = this.consumptionSelectedMeter();
    if (!history.length) { this.toast.show('No consumption data to export', 'error'); return; }
    const meterNo = meter?.physicalMeterNo || meter?.meterNo || '';
    const opts = this.getExportOpts('Consumption', 'CONSUMPTION HISTORY REPORT');
    opts.extraHeaders = [{ label: 'Meter Number', value: meterNo }];
    const headers = ['Billing Month', 'Old Date', 'Old Reading', 'New Date', 'New Reading', 'Days', 'Consumption', 'Flag', 'Reading Status'];
    const rows = history.map((r: any) => [
      r.billingmonth || r.billingMonth || '',
      this.formatDate(r.reading1Date || r.readingDate),
      r.reading1 || r.previousReading || '',
      this.formatDate(r.reading2Date || r.date),
      r.reading2 || r.currentReading || '',
      r.readingdays || r.readingDays || r.days || '',
      this.getConsumptionVal(r),
      r.flag || '',
      r.readingStatus || r.status || '',
    ]);
    this.exportService.exportCsv(opts, headers, rows);
    this.toast.show('Consumption history exported', 'success');
  }

  exportConsumptionPdf(): void {
    const history = this.consumptionHistory();
    const meter = this.consumptionSelectedMeter();
    if (!history.length) { this.toast.show('No consumption data to export', 'error'); return; }
    const meterNo = meter?.physicalMeterNo || meter?.meterNo || '';
    const opts = this.getExportOpts('Consumption', 'CONSUMPTION HISTORY REPORT');
    opts.extraHeaders = [{ label: 'Meter Number', value: meterNo }];
    const headers = ['Month', 'Old Date', 'Old Rdg', 'New Date', 'New Rdg', 'Days', 'Consumption', 'Flag', 'Status'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'right', 'left', 'right', 'right', 'right', 'left', 'left'];
    const rows = history.map((r: any) => [
      r.billingmonth || r.billingMonth || '',
      this.formatDate(r.reading1Date || r.readingDate),
      r.reading1 || r.previousReading || '',
      this.formatDate(r.reading2Date || r.date),
      r.reading2 || r.currentReading || '',
      r.readingdays || r.readingDays || r.days || '',
      String(this.getConsumptionVal(r)),
      r.flag || '',
      r.readingStatus || r.status || '',
    ]);
    this.exportService.exportPdf(opts, headers, rows, aligns);
  }

  exportMetersCsv(): void {
    const data = this.tabData();
    const meters = data?.meters || data?.meterServices || [];
    if (!meters.length) { this.toast.show('No meter data to export', 'error'); return; }
    const headers = ['Meter Number', 'Type', 'Status', 'Make', 'Model', 'Digits', 'Multiplier', 'Service'];
    const rows = meters.map((m: any) => [
      m.physicalMeterNo || m.meterNo || m.meterNumber || '',
      m.meterType || m.type || '', m.status || m.meterStatus || '',
      m.make || '', m.model || '', m.digits || m.noOfDigits || '',
      m.multiplier || '', m.serviceDescription || m.service || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Meters', 'METER DETAILS REPORT'), headers, rows);
    this.toast.show('Meters exported', 'success');
  }

  exportContactCsv(): void {
    const data = this.tabData();
    const contact = data?.contact || {};
    const contactHistory = data?.contactHistory || [];
    const addressHistory = data?.addressHistory || [];
    const headers = ['Field', 'Value'];
    const rows: (string | number)[][] = [
      ['Home Phone', contact.homePhone || contact.homePhoneNo || '-'],
      ['Work Phone', contact.workPhone || contact.workPhoneNo || '-'],
      ['Mobile', contact.mobilePhone || contact.cellPhone || contact.cellPhoneNo || '-'],
      ['Email', contact.emailAddress || contact.email || '-'],
      ['Fax', contact.fax || contact.faxNo || '-'],
    ];
    if (contactHistory.length > 0) {
      rows.push(['', ''], ['--- Contact Change History ---', '']);
      rows.push(['Date Changed', 'Field', 'Old Value', 'New Value'] as any);
      contactHistory.forEach((h: any) => rows.push([
        this.formatDate(h.dateChanged || h.date), h.fieldChanged || h.field || '',
        h.oldValue || '', h.newValue || '',
      ]));
    }
    this.exportService.exportCsv(this.getExportOpts('Contact', 'CONTACT DETAILS REPORT'), headers, rows);
    this.toast.show('Contact details exported', 'success');
  }

  exportLinkedAccountsCsv(): void {
    const data = this.tabData();
    const linked = data?.linkedAccounts || [];
    if (!linked.length) { this.toast.show('No linked accounts to export', 'error'); return; }
    const headers = ['Account Number', 'Name', 'Status', 'Type', 'Outstanding Balance'];
    const rows = linked.map((a: any) => [
      a.accountNumber || a.accountNo || '', a.name || a.accountName || a.surname_Company || '',
      a.accountStatus || a.status || '', a.accountType || a.type || '',
      Number(a.totalOutstanding || a.outstandingAmount || a.outStandingAmt || 0),
    ]);
    this.exportService.exportCsv(this.getExportOpts('Linked_Accounts', 'LINKED ACCOUNTS REPORT'), headers, rows);
    this.toast.show('Linked accounts exported', 'success');
  }

  exportLinkedAccountsPdf(): void {
    const data = this.tabData();
    const linked = data?.linkedAccounts || [];
    if (!linked.length) { this.toast.show('No linked accounts to export', 'error'); return; }
    const headers = ['Account Number', 'Name', 'Status', 'Type', 'Outstanding'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'right'];
    const rows = linked.map((a: any) => [
      a.accountNumber || a.accountNo || '', a.name || a.accountName || a.surname_Company || '',
      a.accountStatus || a.status || '', a.accountType || a.type || '',
      this.formatCurrency(Number(a.totalOutstanding || a.outstandingAmount || a.outStandingAmt || 0)),
    ]);
    this.exportService.exportPdf(this.getExportOpts('Linked_Accounts', 'LINKED ACCOUNTS REPORT'), headers, rows, aligns);
  }

  exportHandoverCsv(): void {
    const data = this.tabData();
    const handover = this.normalizeArray(data?.info || data?.handover || data?.enquiry || []);
    if (!handover.length) { this.toast.show('No handover data to export', 'error'); return; }
    const headers = ['Status', 'Attorney', 'Instruction Date', 'Amount', 'Legal Fees', 'Reference', 'Payment Status'];
    const rows = handover.map((h: any) => [
      h.handoverStatus || h.status || '', h.attorney || h.attorneyName || '',
      this.formatDate(h.instructionDate || h.handoverDate || h.date),
      Number(h.handoverAmount || h.amount || 0), Number(h.legalFees || h.fees || 0),
      h.reference || h.caseNumber || '', h.paymentStatus || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Handover', 'HANDOVER REPORT'), headers, rows);
    this.toast.show('Handover data exported', 'success');
  }

  exportHandoverPdf(): void {
    const data = this.tabData();
    const handover = this.normalizeArray(data?.info || data?.handover || data?.enquiry || []);
    if (!handover.length) { this.toast.show('No handover data to export', 'error'); return; }
    const headers = ['Status', 'Attorney', 'Instruction Date', 'Amount', 'Legal Fees', 'Reference'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'left', 'right', 'right', 'left'];
    const rows = handover.map((h: any) => [
      h.handoverStatus || h.status || '', h.attorney || h.attorneyName || '',
      this.formatDate(h.instructionDate || h.handoverDate || h.date),
      this.formatCurrency(Number(h.handoverAmount || h.amount || 0)),
      this.formatCurrency(Number(h.legalFees || h.fees || 0)),
      h.reference || h.caseNumber || '',
    ]);
    this.exportService.exportPdf(this.getExportOpts('Handover', 'HANDOVER REPORT'), headers, rows, aligns);
  }

  exportRatesCsv(): void {
    const data = this.tabData();
    const rates = data?.rates || data?.ratesDetails || [];
    if (!rates.length) { this.toast.show('No rates data to export', 'error'); return; }
    const headers = ['Description', 'Rate Code', 'Tariff', 'Annual Rate', 'Monthly Rate', 'Market Value', 'Rebate'];
    const rows = rates.map((r: any) => [
      r.description || r.rateDescription || '', r.rateCode || r.code || '',
      r.tariff || r.tariffCode || '', r.annualRate || r.annual || '',
      r.monthlyRate || r.monthly || '', r.marketValue || '', r.rebate || r.rebateAmount || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Rates', 'RATES & VALUATION REPORT'), headers, rows);
    this.toast.show('Rates exported', 'success');
  }

  exportDebitOrdersCsv(): void {
    const data = this.tabData();
    const orders = data?.debitOrders || [];
    if (!orders.length) { this.toast.show('No debit order data to export', 'error'); return; }
    const headers = ['Bank Name', 'Account Number', 'Deduction Amount', 'Start Date', 'End Date', 'Status'];
    const rows = orders.map((o: any) => [
      o.bankName || o.bank || '', o.bankAccountNumber || o.accountNo || '',
      Number(o.deductionAmount || o.amount || 0),
      this.formatDate(o.startDate || o.dateFrom), this.formatDate(o.endDate || o.dateTo),
      o.status || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Debit_Orders', 'DEBIT ORDERS REPORT'), headers, rows);
    this.toast.show('Debit orders exported', 'success');
  }

  exportClearanceCsv(): void {
    const data = this.tabData();
    const clearance = data?.clearances || data?.clearance || [];
    if (!clearance.length) { this.toast.show('No clearance data to export', 'error'); return; }
    const headers = ['Application No', 'Date', 'Status', 'Expiry Date', 'Type', 'Applicant'];
    const rows = clearance.map((c: any) => [
      c.applicationNo || c.clearanceNo || c.certificateNo || '',
      this.formatDate(c.applicationDate || c.date), c.status || c.clearanceStatus || '',
      this.formatDate(c.expiryDate || c.expiry), c.type || c.clearanceType || '',
      c.applicant || c.applicantName || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Clearance', 'CLEARANCE CERTIFICATES REPORT'), headers, rows);
    this.toast.show('Clearance data exported', 'success');
  }

  exportDebtorNotesCsv(): void {
    const data = this.tabData();
    const notes = data?.notes || data?.debtorNotes || [];
    if (!notes.length) { this.toast.show('No debtor notes to export', 'error'); return; }
    const headers = ['Date', 'User', 'Category', 'Note'];
    const rows = notes.map((n: any) => [
      this.formatDate(n.noteDate || n.date || n.createdDate),
      n.userName || n.user || n.capturer || '', n.category || n.noteType || '',
      n.noteContent || n.note || n.notes || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Debtor_Notes', 'DEBTOR NOTES REPORT'), headers, rows);
    this.toast.show('Debtor notes exported', 'success');
  }

  exportSection129Csv(): void {
    const data = this.tabData();
    const records = data?.section129 || [];
    if (!records.length) { this.toast.show('No Section 129 data to export', 'error'); return; }
    const headers = ['Notice Type', 'Issue Date', 'Delivery Method', 'Status', 'Amount', 'Attorney', 'Financial Year'];
    const rows = records.map((r: any) => [
      r.noticeType || r.type || '', this.formatDate(r.issueDate || r.noticeDate || r.date || r.createdDate),
      r.deliveryMethod || r.deliveryType || '', r.proofOfDeliveryStatus || r.status || '',
      Number(r.qualifyingAmount || r.amount || r.noticeAmount || 0),
      r.attorney || '', r.financialYear || r.billingPeriod || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Section_129', 'SECTION 129 NOTICES REPORT'), headers, rows);
    this.toast.show('Section 129 data exported', 'success');
  }

  exportSection129Pdf(): void {
    const data = this.tabData();
    const records = data?.section129 || [];
    if (!records.length) { this.toast.show('No Section 129 data to export', 'error'); return; }
    const headers = ['Notice Type', 'Issue Date', 'Delivery', 'Status', 'Amount', 'Attorney', 'FY'];
    const aligns: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'right', 'left', 'left'];
    const rows = records.map((r: any) => [
      r.noticeType || r.type || '', this.formatDate(r.issueDate || r.noticeDate || r.date || r.createdDate),
      r.deliveryMethod || r.deliveryType || '', r.proofOfDeliveryStatus || r.status || '',
      this.formatCurrency(Number(r.qualifyingAmount || r.amount || r.noticeAmount || 0)),
      r.attorney || '', r.financialYear || r.billingPeriod || '',
    ]);
    this.exportService.exportPdf(this.getExportOpts('Section_129', 'SECTION 129 NOTICES REPORT'), headers, rows, aligns);
  }

  exportNotificationsCsv(): void {
    const data = this.tabData();
    const notifications = data?.notifications || data?.accountNotifications || data?.propertyNotifications || [];
    if (!notifications.length) { this.toast.show('No notifications to export', 'error'); return; }
    const headers = ['Date', 'Type', 'Method', 'Recipient', 'Subject', 'Status'];
    const rows = notifications.map((n: any) => [
      this.formatDate(n.sentDate || n.date || n.createdDate),
      n.notificationType || n.type || '', n.deliveryMethod || n.method || '',
      n.recipient || n.emailAddress || n.phoneNumber || '',
      n.subject || n.title || '', n.status || n.deliveryStatus || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Notifications', 'NOTIFICATIONS REPORT'), headers, rows);
    this.toast.show('Notifications exported', 'success');
  }

  exportIncentivesCsv(): void {
    const data = this.tabData();
    const incentives = data?.incentives || [];
    if (!incentives.length) { this.toast.show('No incentive data to export', 'error'); return; }
    const headers = ['Scheme', 'Qualification Date', 'Benefit Amount', 'Status', 'Description'];
    const rows = incentives.map((i: any) => [
      i.schemeName || i.incentiveScheme || i.scheme || '',
      this.formatDate(i.qualificationDate || i.date),
      Number(i.benefitAmount || i.amount || 0), i.status || '',
      i.description || i.notes || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Incentives', 'INCENTIVES REPORT'), headers, rows);
    this.toast.show('Incentives exported', 'success');
  }

  exportIndigentCsv(): void {
    const data = this.tabData();
    const indigent = data?.indigent || data?.attpHistory || [];
    if (!indigent.length) { this.toast.show('No indigent data to export', 'error'); return; }
    const headers = ['Application Date', 'Subsidy Type', 'Expiry Date', 'Status', 'Description'];
    const rows = indigent.map((i: any) => [
      this.formatDate(i.applicationDate || i.date || i.startDate),
      i.subsidyType || i.type || i.applicationStatus || '',
      this.formatDate(i.expiryDate || i.endDate),
      i.status || i.applicationStatus || '', i.description || i.notes || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Indigent_Subsidy', 'INDIGENT SUBSIDY REPORT'), headers, rows);
    this.toast.show('Indigent data exported', 'success');
  }

  private normalizeStr(s: string): string {
    return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  isSameClearanceAccount(clearanceAccountName: string): boolean {
    if (!clearanceAccountName) return true;
    const currentName = this.normalizeStr(this.selectedAccount()?.name || '');
    const clrName = this.normalizeStr(clearanceAccountName);
    if (!currentName || !clrName) return true;
    return currentName === clrName;
  }

  getClearancePreviousAccountNo(clearanceAccountName: string): string {
    const linked = this.clearanceLinkedAccounts();
    const clrName = this.normalizeStr(clearanceAccountName);
    if (!clrName || clrName === '-') return '';
    const currentNum = String(this.getAccountNum(this.selectedAccount()) || '').replace(/^0+/, '');
    const prevAcct = linked.find((la: any) => {
      const laName = this.normalizeStr(la.name || la.accountName || la.fullNAME || '');
      if (!laName) return false;
      const matchName = laName.includes(clrName) || clrName.includes(laName);
      const laNum = String(la.accountNumber || la.account_ID || '').replace(/^0+/, '');
      return matchName && laNum !== currentNum;
    });
    const prevNum = prevAcct?.accountNumber || prevAcct?.account_ID;
    return prevNum ? String(prevNum).padStart(12, '0') : '';
  }

  toggleClearanceRow(idx: number): void {
    this.expandedClearanceRow.set(this.expandedClearanceRow() === idx ? null : idx);
  }

  getClearanceTypeLabel(typeId: any): string {
    if (typeId === 1) return 'Transfer';
    if (typeId === 2) return 'Section 118';
    return typeId ?? '-';
  }

  downloadClearanceDoc(scheduleId: any, type: 'cost-schedule' | 'clearance-certificate'): void {
    if (!scheduleId) return;
    window.open(`/api/platinum/clearance-document-download?costScheduleId=${scheduleId}&type=${type}`, '_blank');
  }

  async addOccupier(): Promise<void> {
    const name = this.occupierAddName().trim();
    if (!name) return;
    const accountId = this.getAccountId(this.selectedAccount());
    if (!accountId) return;
    this.occupierAddLoading.set(true);
    try {
      await firstValueFrom(this.api.post('/api/platinum/billing-enquiry/add-occupier', {
        accountId, name, idNumber: this.occupierAddId().trim(),
      }));
      this.occupierAddName.set('');
      this.occupierAddId.set('');
      this.showAddOccupierModal.set(false);
      this.toast.show('Occupier added successfully', 'success');
      this.loadTabData('occupiers', accountId);
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to add occupier', 'error');
    } finally {
      this.occupierAddLoading.set(false);
    }
  }

  async removeOccupier(occupier: any): Promise<void> {
    const id = occupier.occupierId || occupier.id || occupier.occupier_ID;
    if (!id) { this.toast.show('Cannot identify occupier to remove', 'error'); return; }
    if (!confirm(`Remove occupier "${occupier.name || occupier.occupierName || 'this person'}"?`)) return;
    this.occupierRemoveLoading.set(id);
    try {
      await firstValueFrom(this.api.delete('/api/platinum/billing-enquiry/add-occupier', { occupierId: String(id) }));
      const accountId = this.getAccountId(this.selectedAccount());
      this.toast.show('Occupier removed', 'success');
      this.loadTabData('occupiers', accountId);
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to remove occupier', 'error');
    } finally {
      this.occupierRemoveLoading.set(null);
    }
  }

  async generateProofOfResidence(): Promise<void> {
    const accountId = this.getAccountId(this.selectedAccount());
    if (!accountId) return;
    this.proofLoading.set(true);
    try {
      const [propSettled, nameSettled] = await Promise.allSettled([
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/property-details-by-account/${accountId}`)),
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/name-info/${accountId}`)),
      ]);
      const propResp = propSettled.status === 'fulfilled' ? (Array.isArray(propSettled.value) ? propSettled.value[0] : propSettled.value) : null;
      const nameResp = nameSettled.status === 'fulfilled' ? (Array.isArray(nameSettled.value) ? nameSettled.value[0] : nameSettled.value) : null;
      this.proofData.set({ property: propResp, nameInfo: nameResp });
      this.showProofModal.set(true);
    } catch (err) {
      this.toast.show('Failed to load property details for proof of residence', 'error');
    } finally {
      this.proofLoading.set(false);
    }
  }

  private escHtml(str: any): string {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  printProofOfResidence(): void {
    const data = this.proofData();
    if (!data) return;
    const acct = this.selectedAccount();
    const accountNumber = this.escHtml(this.getAccountNum(acct));
    const ownerName = this.escHtml(data.nameInfo?.name || data.nameInfo?.surname_Company || acct?.name || '');
    const idNumber = this.escHtml(data.nameInfo?.idRegistrationNumber || data.nameInfo?.idNumber || acct?.idRegistrationNumber || '');
    const address = this.escHtml(data.property?.propertyStreet || data.property?.streetName || acct?.locationAddress || '');
    const suburb = this.escHtml(data.property?.suburb || data.property?.subSuburb || '');
    const town = this.escHtml(data.property?.town || '');
    const erf = this.escHtml(data.property?.erfNumber || '');
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Proof of Residence</title><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
      .proof-container { max-width: 700px; margin: 0 auto; border: 1px solid #333; padding: 30px; }
      .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; text-align: center; }
      .header h2 { margin: 0; font-size: 18px; }
      .header p { margin: 4px 0; font-size: 12px; }
      .date-line { text-align: right; margin: 10px 0 25px; font-weight: bold; }
      .title { font-size: 18px; font-weight: bold; margin: 20px 0; text-decoration: underline; }
      .detail { margin: 8px 0 8px 40px; font-size: 14px; }
      .detail-label { font-weight: bold; display: inline; }
      .address-block { margin: 15px 0 15px 40px; line-height: 1.8; font-size: 14px; }
      .body-text { font-size: 14px; margin: 15px 0; line-height: 1.6; }
      .footer { margin-top: 80px; font-weight: bold; font-size: 14px; }
      @media print { body { margin: 0; } .proof-container { border: none; } }
    </style></head><body>
      <div class="proof-container">
        <div class="header">
          <h2>GEORGE MUNICIPALITY</h2>
          <p>PO Box 19, George, 6530</p>
          <p>Tel: 044 801 9111 | www.george.gov.za</p>
        </div>
        <div class="date-line">Date: ${dateStr}</div>
        <div class="title">PROOF OF RESIDENCE</div>
        <div class="body-text">This letter serves to confirm that the following person resides at the address as indicated below:</div>
        <div class="detail"><span class="detail-label">Full Name:</span> ${ownerName}</div>
        <div class="detail"><span class="detail-label">ID Number:</span> ${idNumber}</div>
        <div class="detail"><span class="detail-label">Account Number:</span> ${accountNumber}</div>
        <div class="address-block">
          <strong>Physical Address:</strong><br>
          ${address}<br>
          ${suburb ? suburb + '<br>' : ''}${town ? town : ''}${erf ? '<br>Erf: ' + erf : ''}
        </div>
        <div class="body-text">This confirmation is based on the municipal records at the time of issuing this letter and does not constitute any form of guarantee.</div>
        <div class="footer">
          <p>_________________________</p>
          <p>Authorised Official</p>
          <p>George Municipality</p>
        </div>
      </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  }

  async generatePropertyLetter(type: 'section49' | 'section78' | 'valuation'): Promise<void> {
    const accountId = this.getAccountId(this.selectedAccount());
    if (!accountId) return;
    this.generatingPropertyLetter.set(type);
    try {
      const [propRes, consUnitRes, valRes] = await Promise.allSettled([
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/property-details-by-account/${accountId}`)),
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/consumption-units/${accountId}`)),
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/supplementary-valuations`, { propertyId: String(accountId) })),
      ]);
      const prop = propRes.status === 'fulfilled' ? (Array.isArray(propRes.value) ? propRes.value[0] : propRes.value) : null;
      const consUnit = consUnitRes.status === 'fulfilled' ? (Array.isArray(consUnitRes.value) ? consUnitRes.value[0] : consUnitRes.value) : null;
      const vals = valRes.status === 'fulfilled' ? this.normalizeArray(valRes.value) : [];
      const acct = this.selectedAccount();
      const ownerName = this.escHtml(prop?.name || prop?.owner || consUnit?.ownerName || acct?.name || '');
      const address = this.escHtml(prop?.propertyStreet || prop?.streetName || acct?.locationAddress || '');
      const sgNumber = this.escHtml(prop?.sgNumber || consUnit?.sgNumber || acct?.sgNumber || '');
      const erfNumber = this.escHtml(prop?.erfNumber || '');
      const suburb = this.escHtml(prop?.suburb || prop?.subSuburb || '');
      const town = this.escHtml(prop?.town || '');
      const marketValue = prop?.marketValue || consUnit?.marketValue || 0;
      const standSize = this.escHtml(prop?.standSize || consUnit?.standSize || '');
      const zoning = this.escHtml(prop?.typeOfUse || prop?.typeofUse || prop?.townPlanningZoneType || '');
      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

      let title = '';
      let bodyContent = '';
      if (type === 'section49') {
        title = 'SECTION 49 LETTER — RATES CLEARANCE';
        bodyContent = `
          <div class="body-text">This serves to confirm that the following property has been assessed for rates clearance as required under Section 49 of the Local Government: Municipal Property Rates Act, No. 6 of 2004.</div>
          <div class="detail"><span class="detail-label">Owner:</span> ${ownerName}</div>
          <div class="detail"><span class="detail-label">Property Address:</span> ${address}${suburb ? ', ' + suburb : ''}${town ? ', ' + town : ''}</div>
          <div class="detail"><span class="detail-label">SG Number:</span> ${sgNumber}</div>
          <div class="detail"><span class="detail-label">Erf Number:</span> ${erfNumber}</div>
          <div class="detail"><span class="detail-label">Market Value:</span> R ${this.formatCurrency(marketValue)}</div>
          <div class="detail"><span class="detail-label">Account Number:</span> ${this.escHtml(this.getAccountNum(acct))}</div>
          <div class="body-text">All rates and taxes as at the date of this certificate have been checked. Please contact the municipality for the current outstanding balance.</div>`;
      } else if (type === 'section78') {
        title = 'SECTION 78 LETTER — PROPERTY INFORMATION';
        bodyContent = `
          <div class="body-text">In terms of Section 78 of the Local Government: Municipal Property Rates Act, No. 6 of 2004, the following property information is provided:</div>
          <div class="detail"><span class="detail-label">Owner:</span> ${ownerName}</div>
          <div class="detail"><span class="detail-label">Property Address:</span> ${address}${suburb ? ', ' + suburb : ''}${town ? ', ' + town : ''}</div>
          <div class="detail"><span class="detail-label">SG Number:</span> ${sgNumber}</div>
          <div class="detail"><span class="detail-label">Erf Number:</span> ${erfNumber}</div>
          <div class="detail"><span class="detail-label">Stand Size:</span> ${standSize ? standSize + ' m²' : '-'}</div>
          <div class="detail"><span class="detail-label">Zoning / Land Use:</span> ${zoning || '-'}</div>
          <div class="detail"><span class="detail-label">Market Value:</span> R ${this.formatCurrency(marketValue)}</div>
          <div class="detail"><span class="detail-label">Account Number:</span> ${this.escHtml(this.getAccountNum(acct))}</div>
          <div class="body-text">This information is extracted from the municipal valuation roll and property register as at the date of this letter.</div>`;
      } else {
        title = 'VALUATION CERTIFICATE';
        bodyContent = `
          <div class="body-text">This certificate confirms the property valuation details as recorded in the Municipal Valuation Roll:</div>
          <div class="detail"><span class="detail-label">Owner:</span> ${ownerName}</div>
          <div class="detail"><span class="detail-label">Property Address:</span> ${address}${suburb ? ', ' + suburb : ''}${town ? ', ' + town : ''}</div>
          <div class="detail"><span class="detail-label">SG Number:</span> ${sgNumber}</div>
          <div class="detail"><span class="detail-label">Erf Number:</span> ${erfNumber}</div>
          <div class="detail"><span class="detail-label">Market Value:</span> R ${this.formatCurrency(marketValue)}</div>
          <div class="detail"><span class="detail-label">Stand Size:</span> ${standSize ? standSize + ' m²' : '-'}</div>
          <div class="detail"><span class="detail-label">Zoning:</span> ${zoning || '-'}</div>`;
        if (vals.length > 0) {
          bodyContent += `<table class="val-table"><thead><tr><th>Fin Year</th><th>Market Value</th><th>Category</th><th>Status</th></tr></thead><tbody>`;
          for (const v of vals) {
            bodyContent += `<tr><td>${this.escHtml(v.financialYear || '-')}</td><td>R ${this.formatCurrency(v.standMarketValue || v.marketValue || 0)}</td><td>${this.escHtml(v.valuationCategory || v.category || '-')}</td><td>${this.escHtml(v.valuationStatus || v.status || '-')}</td></tr>`;
          }
          bodyContent += `</tbody></table>`;
        }
        bodyContent += `<div class="body-text">This valuation is as per the current General Valuation Roll and/or Supplementary Valuation Roll.</div>`;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) { this.toast.show('Could not open print window', 'error'); return; }
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .letter-container { max-width: 700px; margin: 0 auto; border: 1px solid #333; padding: 30px; }
        .header { border-bottom: 2px solid #0f2b46; padding-bottom: 15px; margin-bottom: 20px; text-align: center; }
        .header h2 { margin: 0; font-size: 18px; color: #0f2b46; }
        .header p { margin: 4px 0; font-size: 12px; color: #555; }
        .date-line { text-align: right; margin: 10px 0 20px; font-weight: bold; font-size: 13px; }
        .title { font-size: 16px; font-weight: bold; margin: 20px 0; text-decoration: underline; color: #0f2b46; }
        .detail { margin: 8px 0 8px 20px; font-size: 13px; }
        .detail-label { font-weight: bold; display: inline; }
        .body-text { font-size: 13px; margin: 15px 0; line-height: 1.6; }
        .val-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
        .val-table th { background: #0f2b46; color: white; padding: 6px 10px; text-align: left; }
        .val-table td { border: 1px solid #ddd; padding: 5px 10px; }
        .footer { margin-top: 60px; font-size: 13px; }
        @media print { body { margin: 0; } .letter-container { border: none; } }
      </style></head><body>
        <div class="letter-container">
          <div class="header"><h2>GEORGE MUNICIPALITY</h2><p>PO Box 19, George, 6530</p><p>Tel: 044 801 9111 | www.george.gov.za</p></div>
          <div class="date-line">Date: ${dateStr}</div>
          <div class="title">${title}</div>
          ${bodyContent}
          <div class="footer"><p>_________________________</p><p>Authorised Official</p><p>George Municipality</p></div>
        </div>
      </body></html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 300);
    } catch (e: any) {
      this.toast.show(`Failed to generate ${type} letter: ${e?.message || 'Unknown error'}`, 'error');
    } finally {
      this.generatingPropertyLetter.set(null);
    }
  }

  async calculateNextBillEstimate(): Promise<void> {
    const accountId = this.getAccountId(this.selectedAccount());
    if (!accountId) return;
    this.nbeLoading.set(true);
    this.nbeError.set(null);
    this.nbeWarnings.set([]);
    this.nbeLineItems.set([]);
    this.nbeCalculated.set(false);
    const warns: string[] = [];

    try {
      const now = new Date();
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      this.nbeBillingMonth.set(`${monthNames[now.getMonth()]} ${now.getFullYear()}`);

      const finYearMonths = ['July','August','September','October','November','December','January','February','March','April','May','June'];
      const [svcRes, meteredRes, ratesRes, addBillingRes] = await Promise.allSettled([
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/services-search-results/${accountId}`)),
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/metered-services-on-account/${accountId}`)),
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/account-rates-details/${accountId}`)),
        firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/additional-billing-search-results/${accountId}`)),
      ]);
      const services = svcRes.status === 'fulfilled' ? this.normalizeArray(svcRes.value) : [];
      const meters = meteredRes.status === 'fulfilled' ? this.normalizeArray(meteredRes.value) : [];
      const ratesDetail = ratesRes.status === 'fulfilled' ? (Array.isArray(ratesRes.value) ? ratesRes.value[0] : ratesRes.value) : null;
      const addBilling = addBillingRes.status === 'fulfilled' ? this.normalizeArray(addBillingRes.value) : [];

      const activeServices = services.filter((s: any) => {
        const status = (s.serviceStatus || s.statusDesc || s.status || '').toLowerCase();
        return !status.includes('inactive') && !status.includes('terminated') && !status.includes('closed');
      });

      if (!activeServices.length && !meters.length) {
        this.nbeError.set('No active services found on this account.');
        this.nbeLoading.set(false);
        return;
      }

      const items: any[] = [];
      const processedKeys = new Set<string>();

      for (const svc of activeServices) {
        const desc = svc.serviceDescription || svc.serviceDesc || svc.tariffType || svc.description || 'Service';
        const key = desc.toLowerCase();
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const isPrepaid = key.includes('prepaid') || key.includes('pre-paid') || key.includes('token');
        if (isPrepaid) continue;

        const amount = parseFloat(svc.amount || svc.currentAmount || svc.tariffAmount || svc.monthlyCharge || 0);
        const isMetered = key.includes('metered') || key.includes('consumption');

        if (isMetered) {
          const matchedMeter = meters.find((m: any) => {
            const mDesc = (m.serviceDesc || m.serviceDescription || '').toLowerCase();
            return mDesc === key || mDesc.includes(key.split(' ')[0]);
          });
          if (matchedMeter) {
            try {
              const meterNo = matchedMeter.meterNumber || matchedMeter.meterNo || '';
              if (meterNo) {
                const readings: any = await firstValueFrom(this.api.get<any>(`/api/platinum/billing-enquiry/meter-reading-history/${accountId}`, { meterNo }));
                const readingsArr = this.normalizeArray(readings);
                if (readingsArr.length >= 2) {
                  const sorted = readingsArr.sort((a: any, b: any) => new Date(b.readingDate || b.date || 0).getTime() - new Date(a.readingDate || a.date || 0).getTime());
                  const latest = sorted[0];
                  const prev = sorted[1];
                  const consumption = Math.abs(parseFloat(latest.consumption || latest.units || 0) || parseFloat(prev.consumption || prev.units || 0) || 0);
                  const rate = amount > 0 ? amount : parseFloat(svc.tariffRate || svc.rate || '1');
                  const estimated = consumption * (rate > 0 ? rate : 1);
                  items.push({ service: desc, type: 'metered', amount: estimated, consumption, rate, meter: meterNo });
                } else {
                  warns.push(`${desc}: insufficient meter readings for estimate`);
                  if (amount > 0) items.push({ service: desc, type: 'estimated', amount });
                }
              } else if (amount > 0) {
                items.push({ service: desc, type: 'estimated', amount });
              }
            } catch {
              warns.push(`${desc}: could not fetch meter readings`);
              if (amount > 0) items.push({ service: desc, type: 'estimated', amount });
            }
          } else if (amount > 0) {
            items.push({ service: desc, type: 'fixed', amount });
          }
        } else {
          if (amount > 0) items.push({ service: desc, type: 'fixed', amount });
          else warns.push(`${desc}: no amount available`);
        }
      }

      for (const ab of addBilling) {
        const desc = ab.description || ab.serviceDescription || ab.additionalBillingDescription || 'Additional Billing';
        const amt = parseFloat(ab.amount || ab.billingAmount || 0);
        if (amt > 0 && !processedKeys.has(desc.toLowerCase())) {
          processedKeys.add(desc.toLowerCase());
          items.push({ service: desc, type: 'additional', amount: amt });
        }
      }

      if (ratesDetail && !ratesDetail._error) {
        const rateAmt = parseFloat(ratesDetail.monthlyRate || ratesDetail.monthlyAmount || ratesDetail.rateAmount || 0);
        if (rateAmt > 0 && !processedKeys.has('property rates')) {
          processedKeys.add('property rates');
          items.push({ service: 'Property Rates', type: 'rates', amount: rateAmt });
        }
      }

      if (items.length === 0) {
        this.nbeError.set('Could not estimate any services. Insufficient data available.');
        this.nbeLoading.set(false);
        return;
      }

      this.nbeLineItems.set(items);
      this.nbeWarnings.set(warns);
      this.nbeCalculated.set(true);
    } catch (e: any) {
      this.nbeError.set(e?.message || 'Failed to calculate estimate');
    } finally {
      this.nbeLoading.set(false);
    }
  }

  get nbeSubtotal(): number {
    return this.nbeLineItems().reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
  }

  get nbeVat(): number {
    return this.nbeSubtotal * 0.15;
  }

  get nbeTotal(): number {
    return this.nbeSubtotal + this.nbeVat;
  }

  exportOccupiersCsv(): void {
    const occupiers = this.occupiersList();
    if (!occupiers.length) { this.toast.show('No occupiers to export', 'error'); return; }
    const headers = ['Name', 'ID Number'];
    const rows = occupiers.map((o: any) => [
      o.name || o.occupierName || o.surname || '',
      o.idNumber || o.idRegistrationNumber || o.idNo || '',
    ]);
    this.exportService.exportCsv(this.getExportOpts('Occupiers', 'OCCUPIERS REPORT'), headers, rows);
    this.toast.show('Occupiers exported', 'success');
  }

  exportExtensionsCsv(): void {
    const extensions = this.tabData()?.extensions || [];
    if (!extensions.length) { this.toast.show('No extension data to export', 'error'); return; }
    const headers = ['Extension Status', 'Description', 'Commencement Date', 'Termination Date', 'Captured By', 'Capture Date'];
    const rows = extensions.map((e: any) => [
      e.extensionStatus || e.status || e.statusDesc || '',
      e.extensionDescription || e.description || e.extensionType || e.type || '',
      this.formatDate(e.commencementDate || e.startDate),
      this.formatDate(e.terminationDate || e.endDate),
      e.capturedBy || e.capturerName || e.capturer || '',
      this.formatDate(e.captureDate || e.dateCaptured),
    ]);
    this.exportService.exportCsv(this.getExportOpts('Payment_Extensions', 'PAYMENT EXTENSIONS REPORT'), headers, rows);
    this.toast.show('Extensions exported', 'success');
  }
}
