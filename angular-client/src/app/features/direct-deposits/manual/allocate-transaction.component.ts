import { Component, signal, computed, inject, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom, Subscription, timeout, catchError, of } from 'rxjs';

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
  lastName?: string;
  initials?: string;
  miscPaymentGroupId?: number;
  clearanceId?: number;
  vatAmount?: number;
}

type SearchScope = 'ALL' | 'ACCOUNT' | 'PREPAID' | 'CLEARANCE' | 'DIRECT' | 'GROUP' | 'INSTITUTION';
type ResultType = 'ACCOUNT' | 'CLEARANCE' | 'DIRECT' | 'GROUP' | 'INSTITUTION';

interface SearchResult {
  accountId: number;
  accountNo: string;
  name: string;
  oldAccountCode?: string;
  outstandingAmount?: number;
  type: ResultType;
  description?: string;
  rawData?: any;
}

interface ClearanceCostSchedule {
  scheduleNo: string;
  costScheduleID: number;
  status: string;
  totalDue: number;
  linkedAccounts: { accountNo: string; name: string; apiId: number; outstandingAmount: number }[];
  section118_1_Breakdown: { item: string; amount: number; accountNo: string }[];
  section118_3_Breakdown: { item: string; amount: number; accountNo: string }[];
  clearanceData?: {
    sgNumber?: string;
    locationAddress?: string;
    expiryDate?: string;
    accountName?: string;
    paid?: number;
    total?: number;
    remaining?: number;
  };
}

interface MiscPaymentGroup {
  id: number;
  name: string;
  [key: string]: any;
}

interface DetectedSearchType {
  field: string;
  label: string;
}

interface CsvParsedRow {
  accountNo: string;
  amount: number;
  raw: string;
}

interface CsvLookupRow {
  accountNo: string;
  amount: number;
  status: 'pending' | 'loading' | 'found' | 'not_found' | 'error';
  name?: string;
  accountId?: number;
  outstandingAmount?: number;
  errorMsg?: string;
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

  searchScope = signal<SearchScope>('ALL');
  searchQuery = signal('');
  searchResults = signal<SearchResult[]>([]);
  searching = signal(false);
  dropdownOpen = signal(false);
  detectedSearchType = signal<DetectedSearchType | null>(null);

  miscGroups = signal<MiscPaymentGroup[]>([]);
  miscGroupsLoaded = signal(false);

  selectedAccount = signal<SearchResult | null>(null);
  newLineAmount = signal('');
  lines = signal<AllocationLine[]>([]);

  selectedClearance = signal<ClearanceCostSchedule | null>(null);
  clearanceAllocations = signal<Record<string, number>>({});
  loadingClearanceDetails = signal(false);
  clearanceLoadError = signal<string | null>(null);
  loadingInstitution = signal(false);

  posting = signal(false);
  postingStatus = signal('');
  postComplete = signal(false);
  postErrors = signal<string[]>([]);
  completedLines = signal<any[]>([]);

  csvDialogOpen = signal(false);
  csvFile = signal<File | null>(null);
  csvFileName = signal('');
  csvParsedRows = signal<CsvParsedRow[]>([]);
  csvLookupResults = signal<CsvLookupRow[]>([]);
  csvProcessing = signal(false);
  csvStep = signal<'upload' | 'preview' | 'lookup' | 'done'>('upload');
  csvPage = signal(1);
  CSV_PAGE_SIZE = 20;
  private csvCancelRequested = false;

  @ViewChild('csvFileInput') csvFileInput!: ElementRef<HTMLInputElement>;

  csvFoundCount = computed(() => this.csvLookupResults().filter(r => r.status === 'found').length);
  csvNotFoundCount = computed(() => this.csvLookupResults().filter(r => r.status === 'not_found').length);
  csvErrorCount = computed(() => this.csvLookupResults().filter(r => r.status === 'error').length);
  csvDoneCount = computed(() => this.csvLookupResults().filter(r => r.status === 'found' || r.status === 'not_found' || r.status === 'error').length);
  csvTotalImportAmount = computed(() => this.csvParsedRows().reduce((s, r) => s + r.amount, 0));
  csvPreviewTotalPages = computed(() => Math.ceil(this.csvParsedRows().length / this.CSV_PAGE_SIZE) || 1);
  csvLookupTotalPages = computed(() => Math.ceil(this.csvLookupResults().length / this.CSV_PAGE_SIZE) || 1);
  csvLookupProgressPct = computed(() => {
    const total = this.csvLookupResults().length;
    return total > 0 ? Math.round((this.csvDoneCount() / total) * 100) : 0;
  });

  private searchTimer: any = null;
  private searchVersion = 0;
  private abortController: AbortController | null = null;
  private readonly SEARCH_TIMEOUT = 8000;

  private searchWithTimeout<T>(obs: import('rxjs').Observable<T>): Promise<T> {
    return firstValueFrom(obs.pipe(timeout(this.SEARCH_TIMEOUT), catchError(() => of([] as any))));
  }

  scopeOptions: { value: SearchScope; label: string; icon: string }[] = [
    { value: 'ALL', label: 'All', icon: 'search' },
    { value: 'ACCOUNT', label: 'Account', icon: 'user' },
    { value: 'PREPAID', label: 'Prepaid', icon: 'zap' },
    { value: 'INSTITUTION', label: 'Institution', icon: 'building' },
    { value: 'GROUP', label: 'Grouping', icon: 'credit-card' },
    { value: 'CLEARANCE', label: 'Clearance', icon: 'file-check' },
    { value: 'DIRECT', label: 'Income', icon: 'receipt' },
  ];

  totalAllocated = computed(() => this.lines().reduce((sum, l) => sum + l.amount, 0));
  remaining = computed(() => {
    const tx = this.transaction();
    if (!tx) return 0;
    return tx.amount - this.totalAllocated();
  });
  canSubmit = computed(() => {
    const tx = this.transaction();
    if (!tx) return false;
    if (this.posting()) return false;
    return this.lines().length > 0 && Math.abs(this.remaining()) < 0.01;
  });

  clearanceAllocTotal = computed(() => Object.values(this.clearanceAllocations()).reduce((a, b) => a + b, 0));
  clearanceRemaining = computed(() => {
    const sc = this.selectedClearance();
    if (!sc) return 0;
    return sc.totalDue - this.clearanceAllocTotal();
  });

  searchPlaceholder = computed(() => {
    const scope = this.searchScope();
    switch (scope) {
      case 'ALL': return 'Search account number, name/surname, old account code, ID...';
      case 'ACCOUNT': return 'Account number, name/surname, old account code, ID...';
      case 'PREPAID': return 'Search account for prepaid recharge...';
      case 'INSTITUTION': return 'Search institution name...';
      case 'GROUP': return 'Search payment grouping...';
      case 'CLEARANCE': return 'Search clearance certificate...';
      case 'DIRECT': return 'Search income / misc payment group...';
      default: return 'Search...';
    }
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.posItemId.set(parseInt(idParam, 10));
      this.loadTransaction();
    }
    this.loadMiscPaymentGroups();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.abortController) this.abortController.abort();
  }

  async loadMiscPaymentGroups(): Promise<void> {
    try {
      const result: any = await firstValueFrom(
        this.api.get('/api/platinum/billing-payment-miscellaneous/get-groups')
      );
      const groups = Array.isArray(result) ? result : [];
      this.miscGroups.set(groups.map((g: any) => {
        const groupId = g.miscPaymentGroup_ID || g.id || 0;
        return {
          ...g,
          id: groupId,
          miscPaymentGroup_ID: groupId,
          name: g.description || g.name || '',
        };
      }));
      this.miscGroupsLoaded.set(true);
    } catch (e: any) {
      console.error('[AllocateTransaction] Failed to fetch misc payment groups:', e);
      this.miscGroupsLoaded.set(true);
    }
  }

  async loadTransaction(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      try {
        const activeJob: any = await firstValueFrom(
          this.api.get('/api/dd-allocation/active-job', { posItemId: String(this.posItemId()) })
        );
        if (activeJob && activeJob.jobId && (activeJob.status === 'PROCESSING' || activeJob.status === 'COMPLETED')) {
          if (activeJob.status === 'COMPLETED' && (activeJob.errors || []).length === 0) {
            this.toast.show('This deposit has already been allocated.', 'info');
            this.goBack();
            return;
          } else if (activeJob.status === 'PROCESSING') {
            this.toast.show('This deposit is being allocated by another user. Please wait.', 'info');
            this.goBack();
            return;
          }
        }
      } catch {}
      const result: any = await firstValueFrom(
        this.api.get('/api/platinum/direct-deposit-allocation/get-pos-item-details', { posItemId: String(this.posItemId()) })
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

  setSearchScope(scope: SearchScope): void {
    this.searchScope.set(scope);
    if (this.searchQuery().length >= 2) {
      this.cancelSearch();
      this.searchTimer = setTimeout(() => this.performSearch(this.searchQuery()), 150);
    }
  }

  detectSearchType(query: string): DetectedSearchType {
    const trimmed = query.trim();
    if (/^0\d{9}$/.test(trimmed)) return { field: 'mobileNumber', label: 'Mobile Number' };
    if (/^\d{13}$/.test(trimmed)) return { field: 'idNo', label: 'ID Number' };
    if (/^[A-Z]\d{3}\/\d{4}\/\d+\/\d+$/i.test(trimmed)) return { field: 'sgNumber', label: 'SG Number' };
    if (/^\d{1,15}$/.test(trimmed)) return { field: 'accountNo', label: 'Account Number' };
    if (/@/.test(trimmed) || /\.(com|co\.za|org|net|gov|ac\.za)$/i.test(trimmed) || /^(gmail|yahoo|outlook|hotmail|webmail|mail)/i.test(trimmed)) {
      return { field: 'emailAddress', label: 'Email Address' };
    }
    return { field: 'name', label: 'Name / Surname' };
  }

  private getAutocompleteType(field: string): string {
    const map: Record<string, string> = {
      accountNo: 'accountNumber',
      name: 'nameCompany',
      idNo: 'idRegistrationNumber',
      emailAddress: 'email',
      oldAccountCode: 'oldAccountCode',
      sgNumber: 'erfNumber',
      mobileNumber: 'mobileNumber',
    };
    return map[field] || 'accountNumber';
  }

  private normalizeArray(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data?.value && Array.isArray(data.value)) return data.value;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    if (this.searchTimer) clearTimeout(this.searchTimer);

    if (query.length >= 2) {
      const detected = this.detectSearchType(query);
      this.detectedSearchType.set(detected);
    } else {
      this.detectedSearchType.set(null);
    }

    if (query.length < 2) {
      this.cancelSearch();
      this.searchResults.set([]);
      this.dropdownOpen.set(false);
      return;
    }
    this.searchTimer = setTimeout(() => this.performSearch(query), 150);
  }

  private cancelSearch(): void {
    this.searchVersion++;
    if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
    if (this.abortController) { this.abortController.abort(); this.abortController = null; }
    this.searching.set(false);
  }

  async performSearch(query: string): Promise<void> {
    if (query.length < 2) {
      this.searchResults.set([]);
      return;
    }

    this.cancelSearch();
    const abortCtrl = new AbortController();
    this.abortController = abortCtrl;
    const searchVersion = ++this.searchVersion;
    this.searching.set(true);
    this.searchResults.set([]);
    this.dropdownOpen.set(false);

    const isAborted = () => abortCtrl.signal.aborted || searchVersion !== this.searchVersion;
    const scope = this.searchScope();
    const isNumeric = /^\d+$/.test(query);
    const detected = this.detectSearchType(query);
    const seen = new Set<number>();
    const results: SearchResult[] = [];

    const pushResults = () => {
      if (isAborted()) return;
      const combined = [...results].slice(0, 15);
      this.searchResults.set(combined);
      if (combined.length > 0) this.dropdownOpen.set(true);
    };

    const allocType = scope === 'PREPAID' ? 'PREPAID' : 'ACCOUNT';

    const addAccountHit = (item: any, source?: string) => {
      const accId = item.account_ID || item.accountID || item.id;
      if (accId && !seen.has(accId)) {
        seen.add(accId);
        results.push({
          accountId: accId,
          accountNo: item.accountNumber || item.accountNo || String(accId).padStart(12, '0'),
          name: item.surname_Company || [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || item.accountDesc || item.typeOfUseDesc || '',
          oldAccountCode: item.oldAccountCode || '',
          outstandingAmount: item.outStandingAmt || item.outStandingAmount || item.outstandingAmount || 0,
          type: 'ACCOUNT',
          description: source || undefined,
          rawData: { ...item, _allocationType: allocType },
        });
      }
    };

    const addAutocompleteHit = (s: any) => {
      if (!s.accountId || s.accountId <= 0 || seen.has(s.accountId)) return;
      seen.add(s.accountId);
      const display = s.displayItem || '';
      const parts = display.split(' - ');
      const acctNum = parts[0]?.trim() || String(s.accountId).padStart(12, '0');
      const rest = parts.slice(1).join(' - ').trim();
      const nameParts = rest.split(',');
      const name = nameParts[0]?.trim() || '';
      const address = nameParts.slice(1).join(',').trim() || '';
      results.push({
        accountId: s.accountId,
        accountNo: acctNum,
        name: name,
        oldAccountCode: '',
        outstandingAmount: 0,
        type: 'ACCOUNT',
        description: address || undefined,
        rawData: { account_ID: s.accountId, accountNumber: acctNum, name, locationAddress: address, _allocationType: allocType, _fromAutocomplete: true },
      });
    };

    try {
      if (scope === 'ALL' || scope === 'ACCOUNT' || scope === 'PREPAID') {
        const acType = this.getAutocompleteType(detected.field);
        const primaryTasks: Promise<void>[] = [];

        primaryTasks.push(
          this.searchWithTimeout(
            this.api.get('/api/platinum/billing-enquiry/autocomplete', { search: query.trim(), type: acType })
          ).then((data: any) => {
            if (isAborted()) return;
            const arr = this.normalizeArray(data);
            for (const s of arr.slice(0, 15)) addAutocompleteHit(s);
            pushResults();
          }).catch(() => {})
        );

        const searchBody: Record<string, any> = {};
        if (detected.field === 'accountNo' && isNumeric) {
          searchBody['accountNo'] = query;
        } else if (detected.field === 'name') {
          searchBody['name'] = query;
        } else if (detected.field === 'mobileNumber') {
          searchBody['mobileNumber'] = query;
        } else if (detected.field === 'idNo') {
          searchBody['idNo'] = query;
        } else if (detected.field === 'emailAddress') {
          searchBody['emailAddress'] = query;
        } else if (detected.field === 'sgNumber') {
          searchBody['sgNumber'] = query;
        } else {
          searchBody[isNumeric ? 'accountNo' : 'name'] = query;
        }

        primaryTasks.push(
          this.searchWithTimeout(
            this.api.post('/api/platinum/billing-payment/search-accounts', searchBody)
          ).then((r: any) => {
            if (isAborted()) return;
            const items = this.normalizeArray(r);
            for (const item of items.slice(0, 10)) addAccountHit(item);
            pushResults();
          }).catch(() => {})
        );

        if (isNumeric && query.length >= 4) {
          primaryTasks.push(
            this.searchWithTimeout(
              this.api.post('/api/platinum/billing-payment/search-accounts', { oldAccountCode: query })
            ).then((r: any) => {
              if (isAborted()) return;
              const arr = this.normalizeArray(r);
              for (const item of arr.slice(0, 5)) addAccountHit(item, 'Found via old account code');
              pushResults();
            }).catch(() => {})
          );
        }

        await Promise.allSettled(primaryTasks);
        if (isAborted()) return;
        pushResults();

        if (results.length > 0) {
          this.enrichAutocompleteResults(results, searchVersion);
        }
      }

      if (scope === 'ALL' || scope === 'DIRECT') {
        if (this.miscGroupsLoaded() && this.miscGroups().length > 0) {
          const q = query.toLowerCase();
          const matchedGroups = this.miscGroups().filter(g =>
            g.name && g.name.toLowerCase().includes(q)
          ).slice(0, 5);
          for (const g of matchedGroups) {
            results.push({
              accountId: 0,
              accountNo: `MISC-${g.id}`,
              name: g.name,
              type: 'DIRECT',
              description: g.name,
              rawData: g,
            });
          }
          pushResults();
        }
      }

      const extraTasks: Promise<void>[] = [];

      if (scope === 'ALL' || scope === 'CLEARANCE') {
        if (isNumeric || scope === 'CLEARANCE') {
          extraTasks.push((async () => {
            try {
              if (isAborted()) return;
              if (isNumeric) {
                const clearanceIds: any = await this.searchWithTimeout(
                  this.api.get('/api/platinum/billing-payment-clearance/get-clearanceids', { clearanceId: query })
                ).catch(() => []);
                if (isAborted()) return;
                if (Array.isArray(clearanceIds) && clearanceIds.length > 0) {
                  for (const formattedId of clearanceIds) {
                    results.push({
                      accountId: 0,
                      accountNo: formattedId,
                      name: `Clearance ${formattedId}`,
                      type: 'CLEARANCE',
                      rawData: { clearanceFormattedId: formattedId },
                    });
                  }
                  pushResults();
                  return;
                }
              }
              const clearanceResults: any = await this.searchWithTimeout(
                this.api.get('/api/platinum/direct-deposit-allocation/get-clearance-autocomplete', { searchTerm: query })
              ).catch(() => []);
              if (isAborted()) return;
              const arr = Array.isArray(clearanceResults) ? clearanceResults : [];
              for (const item of arr) {
                results.push({
                  accountId: item.account_ID || item.accountId || item.id || 0,
                  accountNo: item.accountNumber || item.certificateNo || item.displayItem || String(item.id || ''),
                  name: item.name || item.displayItem || item.description || 'Clearance',
                  type: 'CLEARANCE',
                  rawData: item,
                });
              }
              pushResults();
            } catch {}
          })());
        }
      }

      if (scope === 'GROUP' || (scope === 'ALL' && !isNumeric)) {
        extraTasks.push((async () => {
          try {
            if (isAborted()) return;
            const groupResults: any = await this.searchWithTimeout(
              this.api.get('/api/platinum/direct-deposit-allocation/get-group-payment-details', { searchTerm: query })
            );
            if (isAborted()) return;
            const groupArr = this.normalizeArray(groupResults);
            for (const g of groupArr.slice(0, 5)) {
              const gId = g.groupId || g.id || g.group_ID || 0;
              if (!seen.has(gId + 100000)) {
                seen.add(gId + 100000);
                results.push({
                  accountId: g.accountId || g.account_ID || 0,
                  accountNo: g.accountNumber || g.accountNo || `GRP-${gId}`,
                  name: g.name || g.description || g.groupName || 'Payment Group',
                  type: 'GROUP',
                  description: `Payment Grouping: ${g.name || g.description || g.groupName || ''}`,
                  rawData: g,
                });
              }
            }
            pushResults();
          } catch {}
        })());
      }

      if (scope === 'INSTITUTION' || (scope === 'ALL' && !isNumeric)) {
        extraTasks.push((async () => {
          try {
            if (isAborted()) return;
            const institutionResults: any = await this.searchWithTimeout(
              this.api.get('/api/platinum/const-institutions/search', { name: query })
            );
            if (isAborted()) return;
            const arr = this.normalizeArray(institutionResults);
            for (const inst of arr.slice(0, 10)) {
              const instId = inst.institutionID || inst.institution_ID || inst.id || 0;
              if (instId && !seen.has(instId + 200000)) {
                seen.add(instId + 200000);
                results.push({
                  accountId: instId,
                  accountNo: `INST-${instId}`,
                  name: inst.institutionDesc || inst.description || inst.name || 'Institution',
                  type: 'INSTITUTION',
                  description: `Institution: ${inst.institutionDesc || inst.description || inst.name || ''}`,
                  rawData: inst,
                });
              }
            }
            pushResults();
          } catch {}
        })());
      }

      if (extraTasks.length > 0) {
        await Promise.allSettled(extraTasks);
        if (!isAborted()) pushResults();
      }
    } catch (err) {
      console.error('DD search error:', err);
      if (!isAborted()) this.searchResults.set([]);
    } finally {
      if (searchVersion === this.searchVersion) {
        this.searching.set(false);
        this.abortController = null;
      }
    }
  }

  private async enrichAutocompleteResults(results: SearchResult[], token: number): Promise<void> {
    const autocompleteItems = results.filter(r => r.rawData?._fromAutocomplete);
    if (autocompleteItems.length === 0) return;

    for (const item of autocompleteItems.slice(0, 5)) {
      if (token !== this.searchVersion) return;
      try {
        const detail = await this.searchWithTimeout(
          this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: item.accountNo })
        );
        if (token !== this.searchVersion) return;
        const arr = this.normalizeArray(detail);
        if (arr.length > 0) {
          const full = arr[0];
          const name = [full.initials, full.lastName].filter(Boolean).join(' ') || full.surname_Company || full.name || '';
          if (name) item.name = name;
          if (full.outStandingAmt != null) item.outstandingAmount = full.outStandingAmt;
          else if (full.outStandingAmount != null) item.outstandingAmount = full.outStandingAmount;
          if (full.oldAccountCode) item.oldAccountCode = full.oldAccountCode;
          item.rawData = { ...item.rawData, ...full, _allocationType: item.rawData?._allocationType || 'ACCOUNT' };
        }
      } catch {}
    }

    if (token === this.searchVersion) {
      this.searchResults.set([...results].slice(0, 15));
    }
  }

  selectSearchResult(result: SearchResult): void {
    this.cancelSearch();
    this.dropdownOpen.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);

    if (result.type === 'CLEARANCE') {
      this.selectedAccount.set(null);
      this.newLineAmount.set('');
      this.clearanceAllocations.set({});
      this.clearanceLoadError.set(null);
      this.loadClearanceDetails(result);
    } else if (result.type === 'INSTITUTION') {
      this.handleSelectInstitution(result);
    } else {
      this.selectedClearance.set(null);
      this.selectedAccount.set(result);
      const remaining = this.remaining();
      if (remaining > 0) {
        this.newLineAmount.set(remaining.toFixed(2));
      }
    }
  }

  async loadClearanceDetails(result: SearchResult): Promise<void> {
    const tx = this.transaction();
    if (!tx) return;
    this.loadingClearanceDetails.set(true);
    this.clearanceLoadError.set(null);
    this.selectedClearance.set(null);

    const rawItem = result.rawData || {};
    const formattedClearanceId = rawItem.clearanceFormattedId || result.accountNo || '';

    try {
      let clearanceData: any = null;

      if (formattedClearanceId) {
        try {
          clearanceData = await firstValueFrom(
            this.api.post('/api/platinum/billing-payment-clearance/get-clearance-data', { clearanceId: formattedClearanceId })
          );
        } catch (e: any) {
          console.warn('[Clearance] get-clearance-data failed, trying legacy endpoints:', e.message);
        }
      }

      if (clearanceData && clearanceData.items && Array.isArray(clearanceData.items) && clearanceData.items.length > 0) {
        const item = clearanceData.items[0];
        const clearanceStagingId = item.clearanceStaging_ID || 0;
        const scheduleNo = formattedClearanceId || String(clearanceStagingId);

        const linkedAccounts = [{
          accountNo: item.accountID || '',
          name: item.name || '',
          apiId: parseInt(String(item.accountID).replace(/^0+/, ''), 10) || 0,
          outstandingAmount: item.remaining || item.total || 0,
        }];

        const section118_1: { item: string; amount: number; accountNo: string }[] = [];
        const section118_3: { item: string; amount: number; accountNo: string }[] = [];

        if (item.total1181 && item.total1181 > 0) {
          section118_1.push({ item: 'Section 118(1) — Municipal Debt', amount: item.total1181, accountNo: item.accountID || '' });
        }
        if (item.total1183 && item.total1183 > 0) {
          section118_3.push({ item: 'Section 118(3) — Rates Clearance', amount: item.total1183, accountNo: item.accountID || '' });
        }

        const totalDue = item.remaining ?? item.total ?? ((item.total1181 || 0) + (item.total1183 || 0));

        const costSchedule: ClearanceCostSchedule = {
          scheduleNo,
          costScheduleID: clearanceStagingId,
          status: item.status || '-',
          totalDue,
          linkedAccounts,
          section118_1_Breakdown: section118_1,
          section118_3_Breakdown: section118_3,
          clearanceData: {
            sgNumber: item.sgNumber || '',
            locationAddress: item.locationAddress || '',
            expiryDate: item.clearanceExpiryDateStr || item.clearanceExpiryDate || '',
            accountName: item.name || '',
            paid: item.paid || 0,
            total: item.total || 0,
            remaining: item.remaining || 0,
          },
        };

        this.selectedClearance.set(costSchedule);
        return;
      }

      const costScheduleID = rawItem.costScheduleID || rawItem.costSchedule_ID || rawItem.id || rawItem.clearanceId || rawItem.clearanceFormattedId || rawItem.clearanceStaging_ID || result.accountId || 0;
      const accountID = rawItem.account_ID || rawItem.accountId || rawItem.accountID || result.accountId || 0;

      const [clearanceInfo, loadResult] = await Promise.allSettled([
        firstValueFrom(this.api.post('/api/platinum/direct-deposit-allocation/get-clearance-details-info', {
          costScheduleID: String(costScheduleID),
          accountID: String(accountID),
          transactionAmount: tx.amount,
          posItemID: tx.posItem_ID,
        })),
        firstValueFrom(this.api.post('/api/platinum/direct-deposit-allocation/load-details-clearance', {
          costScheduleID: String(costScheduleID),
          posItemID: tx.posItem_ID,
          transactionAmount: tx.amount,
        })),
      ]);

      const detailsData = clearanceInfo.status === 'fulfilled' ? clearanceInfo.value : null;
      const loadData = loadResult.status === 'fulfilled' ? loadResult.value : null;

      if (!detailsData && !loadData) {
        const infoErr = clearanceInfo.status === 'rejected' ? (clearanceInfo.reason?.message || 'Unknown error') : '';
        const loadErr = loadResult.status === 'rejected' ? (loadResult.reason?.message || 'Unknown error') : '';
        throw new Error(`Failed to load clearance details. Details: ${infoErr}. Load: ${loadErr}`);
      }

      const legacyScheduleNo = rawItem.displayItem || rawItem.certificateNo || rawItem.accountNumber || result.accountNo || String(costScheduleID);
      const numericCostScheduleID = Number(costScheduleID) || 0;

      if (!numericCostScheduleID) {
        throw new Error(`Invalid costScheduleID (${costScheduleID}) from API response.`);
      }

      const primaryData: any = detailsData || loadData;
      const rawAccounts = primaryData.accounts || primaryData.linkedAccounts || [];
      if (!Array.isArray(rawAccounts) || rawAccounts.length === 0) {
        throw new Error(`No linked accounts returned for cost schedule ${legacyScheduleNo}.`);
      }

      const legacyLinkedAccounts = rawAccounts.map((acc: any) => ({
        accountNo: acc.accountNumber || acc.accountNo || String(acc.account_ID || acc.accountId || ''),
        name: [acc.initials, acc.lastName].filter(Boolean).join(' ') || acc.name || acc.ownerName || '',
        apiId: acc.account_ID || acc.accountId || acc.accountID || 0,
        outstandingAmount: acc.outStandingAmt || acc.outstandingAmount || acc.totalDue || 0,
      }));

      const rawItems = primaryData.items || primaryData.costScheduleItems || primaryData.section118Items || [];
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new Error(`No cost schedule items returned for ${legacyScheduleNo}.`);
      }

      const legacySection118_1: { item: string; amount: number; accountNo: string }[] = [];
      const legacySection118_3: { item: string; amount: number; accountNo: string }[] = [];
      let legacyTotalDue = 0;

      for (const sItem of rawItems) {
        const sectionType = sItem.sectionType || sItem.section || sItem.type || '';
        const entry = {
          item: sItem.description || sItem.name || sItem.item || '',
          amount: sItem.amount || sItem.totalAmount || sItem.balance || 0,
          accountNo: sItem.accountNumber || sItem.accountNo || '',
        };
        legacyTotalDue += entry.amount;
        if (String(sectionType).includes('3') || String(sectionType) === '118(3)') {
          legacySection118_3.push(entry);
        } else {
          legacySection118_1.push(entry);
        }
      }

      const legacyCostSchedule: ClearanceCostSchedule = {
        scheduleNo: legacyScheduleNo,
        costScheduleID: numericCostScheduleID,
        status: 'Active',
        totalDue: legacyTotalDue,
        linkedAccounts: legacyLinkedAccounts,
        section118_1_Breakdown: legacySection118_1,
        section118_3_Breakdown: legacySection118_3,
      };

      this.selectedClearance.set(legacyCostSchedule);
    } catch (err: any) {
      console.error('[Clearance] Failed to load details:', err);
      this.clearanceLoadError.set(err.message || 'Failed to load clearance details from Platinum API');
    } finally {
      this.loadingClearanceDetails.set(false);
    }
  }

  clearanceAutoFill(): void {
    const sc = this.selectedClearance();
    const tx = this.transaction();
    if (!sc || !tx) return;

    const newAlloc: Record<string, number> = {};
    let budgetLeft = Math.min(tx.amount - this.totalAllocated(), sc.totalDue);

    sc.section118_1_Breakdown.forEach((item, idx) => {
      const key = `118_1_${item.accountNo}_${idx}`;
      const fillAmt = Math.min(item.amount, budgetLeft);
      if (fillAmt > 0) { newAlloc[key] = parseFloat(fillAmt.toFixed(2)); budgetLeft -= fillAmt; }
    });
    sc.section118_3_Breakdown.forEach((item, idx) => {
      const key = `118_3_${item.accountNo}_${idx}`;
      const fillAmt = Math.min(item.amount, budgetLeft);
      if (fillAmt > 0) { newAlloc[key] = parseFloat(fillAmt.toFixed(2)); budgetLeft -= fillAmt; }
    });

    this.clearanceAllocations.set(newAlloc);
  }

  updateClearanceAllocation(key: string, value: string): void {
    const num = parseFloat(value) || 0;
    this.clearanceAllocations.update(prev => ({ ...prev, [key]: num }));
  }

  addClearanceLines(): void {
    const sc = this.selectedClearance();
    if (!sc) return;

    const allocs = this.clearanceAllocations();
    const newLines: AllocationLine[] = [];
    let totalToAdd = 0;

    const clearanceAccountId = sc.linkedAccounts?.[0]?.apiId || 0;
    const numCostScheduleId = sc.costScheduleID || 0;

    const buildLine = (item: { item: string; amount: number; accountNo: string }, idx: number, sectionLabel: string, sectionPrefix: string) => {
      const key = `${sectionPrefix}_${item.accountNo}_${idx}`;
      const amount = allocs[key] || 0;
      if (amount > 0) {
        const matchedAccount = item.accountNo ? sc.linkedAccounts.find(a => a.accountNo === item.accountNo) : null;
        const itemAccountId = matchedAccount?.apiId || clearanceAccountId;
        const lineAccountNo = item.accountNo || matchedAccount?.accountNo || sc.linkedAccounts[0]?.accountNo || '';

        newLines.push({
          accountNo: lineAccountNo,
          accountId: itemAccountId,
          name: `Clearance ${sc.scheduleNo} - ${sectionLabel}: ${item.item}`,
          amount: amount,
          allocationType: 'CLEARANCE',
          clearanceId: numCostScheduleId,
        });
        totalToAdd += amount;
      }
    };

    sc.section118_1_Breakdown.forEach((item, idx) => buildLine(item, idx, '118(1)', '118_1'));
    sc.section118_3_Breakdown.forEach((item, idx) => buildLine(item, idx, '118(3)', '118_3'));

    if (totalToAdd === 0) {
      this.toast.error('Please enter at least one allocation amount');
      return;
    }

    const tx = this.transaction();
    if (tx && (this.totalAllocated() + totalToAdd) > tx.amount + 0.01) {
      this.toast.error('Total allocation would exceed transaction amount');
      return;
    }

    this.lines.update(prev => [...prev, ...newLines]);
    this.selectedClearance.set(null);
    this.clearanceAllocations.set({});
    this.toast.success(`Added ${newLines.length} clearance allocation line(s)`);
  }

  async handleSelectInstitution(result: SearchResult): Promise<void> {
    const instId = result.rawData?.institution_ID || result.rawData?.institutionID || result.accountId;
    const tx = this.transaction();
    if (!instId || !tx) return;

    this.loadingInstitution.set(true);
    try {
      const accounts: any = await firstValueFrom(
        this.api.get('/api/platinum/receipting-account-group-payment/search-accounts-by-group', { institutionId: String(instId) })
      );
      const arr = Array.isArray(accounts) ? accounts : (accounts?.value || []);

      if (arr.length === 0) {
        this.toast.error(`No accounts found linked to institution "${result.name}"`);
        return;
      }

      const validAccounts = arr.filter((acc: any) => {
        const accId = acc.account_ID || acc.accountID || acc.id || 0;
        return accId > 0;
      });

      if (validAccounts.length === 0) {
        this.toast.error(`No accounts with valid IDs found for institution "${result.name}"`);
        return;
      }

      let budgetRemaining = tx.amount - this.totalAllocated();
      if (budgetRemaining <= 0) {
        this.toast.error('Transaction is already fully allocated');
        return;
      }

      const newLines: AllocationLine[] = [];
      for (const acc of validAccounts) {
        if (budgetRemaining <= 0) break;

        const accId = acc.account_ID || acc.accountID || acc.id;
        const accNo = acc.accountNumber || acc.accountNo || String(accId);
        const accName = acc.name || acc.accountDesc || [acc.initials, acc.lastName].filter(Boolean).join(' ') || 'Unknown';
        const outstanding = acc.outStandingAmt || acc.outstandingAmount || 0;

        let lineAmount: number;
        if (outstanding > 0) {
          lineAmount = Math.min(outstanding, budgetRemaining);
        } else {
          lineAmount = Math.round((budgetRemaining / (validAccounts.length - newLines.length)) * 100) / 100;
        }
        lineAmount = Math.min(lineAmount, budgetRemaining);

        if (lineAmount <= 0) continue;

        const nameParts = accName.split(/\s+/).filter(Boolean);
        newLines.push({
          accountNo: accNo,
          accountId: accId,
          name: accName,
          amount: lineAmount,
          allocationType: 'ACCOUNT',
          description: `${result.name} — ${accName}`,
          lastName: nameParts[0] || 'N/A',
          initials: nameParts.length >= 2 ? nameParts.slice(1).map((p: string) => p.charAt(0).toUpperCase()).join('') : (nameParts[0] || 'N').charAt(0).toUpperCase(),
        });

        budgetRemaining -= lineAmount;
      }

      if (newLines.length === 0) {
        this.toast.error('Could not allocate any amount to the linked accounts');
        return;
      }

      this.lines.update(prev => [...prev, ...newLines]);
      const skipped = validAccounts.length - newLines.length;
      const msg = skipped > 0
        ? `Added ${newLines.length} account(s) from "${result.name}" (${skipped} skipped — budget exhausted)`
        : `Added ${newLines.length} account(s) from "${result.name}"`;
      this.toast.success(msg);
    } catch (err: any) {
      console.error('[AllocateTransaction] Failed to fetch institution accounts:', err);
      this.toast.error(err?.error?.message || err?.message || 'Failed to load accounts for this institution');
    } finally {
      this.loadingInstitution.set(false);
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

    const nameParts = (account.name || '').split(/\s+/).filter(Boolean);
    let lastName = nameParts[0] || 'N/A';
    let initials = nameParts.length >= 2
      ? nameParts.slice(1).map(p => p.charAt(0).toUpperCase()).join('')
      : lastName.charAt(0).toUpperCase();

    const allocType = account.rawData?._allocationType || account.type || 'ACCOUNT';

    const line: AllocationLine = {
      accountNo: account.accountNo,
      accountId: account.accountId,
      name: account.name,
      amount: amount,
      allocationType: allocType,
      description: account.description,
      lastName,
      initials,
      miscPaymentGroupId: account.rawData?.id || account.rawData?.miscPaymentGroup_ID || undefined,
    };

    this.lines.update(prev => [...prev, line]);
    this.selectedAccount.set(null);
    this.newLineAmount.set('');
  }

  removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  getResultTypeClass(type: string): string {
    switch (type) {
      case 'ACCOUNT': return 'badge-info';
      case 'PREPAID': return 'badge-info';
      case 'CLEARANCE': return 'badge-warning';
      case 'DIRECT': return 'badge-success';
      case 'GROUP': return 'badge-purple';
      case 'INSTITUTION': return 'badge-indigo';
      default: return 'badge-info';
    }
  }

  async submitAllocation(): Promise<void> {
    if (!this.canSubmit()) return;
    this.posting.set(true);
    this.postingStatus.set('Preparing allocation...');
    this.postErrors.set([]);
    this.completedLines.set([]);

    let virtualCashierId: number | null = null;

    try {
      const tx = this.transaction()!;

      if (tx.billingAllocated) {
        this.toast.error('This deposit has already been allocated. It cannot be allocated again.');
        this.posting.set(false);
        this.postingStatus.set('');
        return;
      }

      this.postingStatus.set('Verifying deposit is still available...');
      try {
        const freshItem: any = await firstValueFrom(
          this.api.get('/api/platinum/direct-deposit-allocation/get-pos-item-details', { posItemId: String(tx.posItem_ID) })
        );
        const item = freshItem?.posItem || freshItem || {};
        if (item.billingAllocated || item.dateAllocated) {
          this.toast.error('This deposit was just allocated by another user. Please go back and select a different deposit.');
          this.posting.set(false);
          this.postingStatus.set('');
          return;
        }
      } catch (e: any) {
        console.warn('[AllocateTransaction] Pre-submit freshness check failed (proceeding):', e?.message);
      }

      const user = this.auth.user();

      this.postingStatus.set('Creating virtual session...');
      try {
        const sessionResult: any = await firstValueFrom(
          this.api.post('/api/platinum/direct-deposit-allocation/create-virtual-session', {
            posItemId: tx.posItem_ID,
            userId: user?.user_ID || 0,
          })
        );
        virtualCashierId = sessionResult?.virtualCashierId || sessionResult?.sessionId || sessionResult?.id || null;
      } catch (e: any) {
        console.warn('[AllocateTransaction] Virtual session creation failed (non-blocking):', e?.message);
      }

      const allLines = this.lines();
      const batchLines = allLines.map(line => ({
        accountId: line.accountId,
        accountNo: line.accountNo,
        amount: line.amount,
        allocationType: line.allocationType || 'ACCOUNT',
        description: line.description || '',
        miscPaymentGroupId: line.miscPaymentGroupId || null,
        clearanceId: line.clearanceId || null,
        vatAmount: line.vatAmount || 0,
        lastName: line.lastName || '',
        initials: line.initials || '',
      }));

      this.postingStatus.set('Fetching financial year...');
      let finYear: string;
      try {
        const fyResult: any = await firstValueFrom(this.api.get('/api/platinum/active-fin-year'));
        finYear = typeof fyResult === 'string' ? fyResult : (fyResult?.finYear || fyResult?.financialYear || fyResult?.value || String(fyResult));
      } catch (e: any) {
        this.toast.error('Could not fetch active financial year from API');
        this.posting.set(false);
        this.postingStatus.set('');
        return;
      }

      this.postingStatus.set(`Submitting ${allLines.length} allocation line(s)...`);

      const now = new Date();
      const saDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const txDate = tx.dateOfTransaction || saDate;

      const result: any = await firstValueFrom(
        this.api.post('/api/dd-allocation/submit-batch', {
          posItemId: tx.posItem_ID,
          reconId: tx.bankReconID,
          financialYear: finYear,
          transactionDate: txDate,
          transactionNote: tx.note || tx.reference || '',
          lines: batchLines,
        })
      );

      const jobId = result?.jobId;
      if (jobId) {
        this.postingStatus.set('Processing allocation batch...');
        const pollResult = await this.pollJobStatus(jobId);

        if (pollResult.status === 'COMPLETED' || pollResult.status === 'PARTIAL_FAILURE' || pollResult.status === 'PARTIAL') {
          this.completedLines.set(pollResult.results || allLines.map(l => ({ ...l })));
          this.postErrors.set(pollResult.errors || []);
          this.postComplete.set(true);

          if ((pollResult.errors || []).length === 0) {
            this.toast.success(`Successfully allocated ${pollResult.completedLines || allLines.length} line(s)`);
          } else {
            this.toast.error(`Completed with ${(pollResult.errors || []).length} error(s)`);
          }
        } else {
          this.postErrors.set(pollResult.errors || ['Batch processing failed']);
          this.postComplete.set(true);
          this.toast.error('Batch allocation failed');
        }
      } else {
        this.completedLines.set(allLines.map(l => ({ ...l })));
        this.postComplete.set(true);
        this.toast.success(`Allocation submitted successfully`);
      }
    } catch (e: any) {
      const status = e?.status || e?.error?.status;
      if (status === 409) {
        this.toast.error('This deposit is already being allocated by another user. Please wait and try again.');
      } else {
        this.toast.error(e?.error?.message || e?.message || 'Allocation failed');
      }
    } finally {
      if (virtualCashierId) {
        try {
          await firstValueFrom(
            this.api.post('/api/platinum/direct-deposit-allocation/close-virtual-session', { sessionId: virtualCashierId })
          );
        } catch (e: any) {
          console.warn('[AllocateTransaction] Virtual session close failed (non-blocking):', e?.message);
        }
      }
      this.posting.set(false);
      this.postingStatus.set('');
    }
  }

  private async pollJobStatus(jobId: string): Promise<any> {
    const MAX_DURATION_MS = 5 * 60 * 1000;
    const BASE_INTERVAL = 1500;
    const MAX_INTERVAL = 8000;
    const MAX_CONSECUTIVE_ERRORS = 5;
    const started = Date.now();
    let consecutiveErrors = 0;
    let pollCount = 0;

    while (Date.now() - started < MAX_DURATION_MS) {
      const interval = Math.min(BASE_INTERVAL + pollCount * 300, MAX_INTERVAL);
      await new Promise(resolve => setTimeout(resolve, interval));
      pollCount++;

      try {
        const status: any = await firstValueFrom(
          this.api.get(`/api/dd-allocation/job/${jobId}`)
        );
        consecutiveErrors = 0;
        const elapsed = Math.round((Date.now() - started) / 1000);
        const retryInfo = (status.currentLine || '').includes('retry') ? ` (${status.currentLine})` : '';
        this.postingStatus.set(
          `Processing: ${status.completedLines || 0} of ${status.totalLines || '?'} lines... (${elapsed}s)${retryInfo}`
        );
        if (status.status === 'COMPLETED' || status.status === 'PARTIAL_FAILURE' || status.status === 'PARTIAL' || status.status === 'FAILED') {
          return status;
        }
      } catch {
        consecutiveErrors++;
        this.postingStatus.set(`Connection interrupted — reconnecting (attempt ${consecutiveErrors})...`);
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          return { status: 'FAILED', errors: [`Lost connection to server after ${MAX_CONSECUTIVE_ERRORS} attempts. The allocation may still be processing — check the allocation history.`] };
        }
      }
    }
    return { status: 'FAILED', errors: ['Processing exceeded 5 minutes. The allocation may still complete — check allocation history.'] };
  }

  openCsvDialog(): void {
    this.csvDialogOpen.set(true);
    this.csvStep.set('upload');
    this.csvFile.set(null);
    this.csvFileName.set('');
    this.csvParsedRows.set([]);
    this.csvLookupResults.set([]);
    this.csvPage.set(1);
  }

  closeCsvDialog(): void {
    if (this.csvProcessing()) return;
    this.csvDialogOpen.set(false);
    this.csvFile.set(null);
    this.csvFileName.set('');
    this.csvParsedRows.set([]);
    this.csvLookupResults.set([]);
    this.csvStep.set('upload');
    this.csvPage.set(1);
  }

  triggerCsvFileInput(): void {
    this.csvFileInput?.nativeElement?.click();
  }

  onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.csvFile.set(file);
    this.csvFileName.set(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const rawLines = text.split(/\r?\n/).filter(l => l.trim());

      const sampleLines = rawLines.slice(0, Math.min(5, rawLines.length));
      const countChar = (lines: string[], ch: string) => lines.reduce((sum, l) => sum + (l.split(ch).length - 1), 0);
      const semiCount = countChar(sampleLines, ';');
      const tabCount = countChar(sampleLines, '\t');
      const delimiter = semiCount >= sampleLines.length ? ';' : tabCount >= sampleLines.length ? '\t' : ',';

      const rows = rawLines.map(line => line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
      this.parseRowsFromColumns(rows);
    };
    reader.readAsText(file);

    input.value = '';
  }

  private parseRowsFromColumns(rows: string[][]): void {
    if (rows.length === 0) {
      this.toast.error('The CSV file appears to be empty.');
      return;
    }

    const firstCols = rows[0].map(c => String(c).trim());
    const hasHeader = firstCols.length >= 2
      && firstCols.some(c => /^(account|acc|accno|account.?n)/i.test(c))
      && firstCols.some(c => /^(amount|amt|value|total)/i.test(c));
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const parsed: CsvParsedRow[] = [];
    for (const cols of dataRows) {
      if (cols.length < 2) continue;
      const c0 = String(cols[0]).trim().replace(/^["']|["']$/g, '');
      const c1 = String(cols[1]).trim().replace(/^["']|["']$/g, '');
      if (!c0) continue;

      let accountNo = '';
      let amount = 0;

      const numericSecond = parseFloat(c1.replace(/\s/g, ''));

      if (!isNaN(numericSecond) && numericSecond > 0 && c0.length > 0) {
        accountNo = c0.replace(/\s/g, '');
        amount = numericSecond;
      } else {
        const numericFirst = parseFloat(c0.replace(/\s/g, ''));
        if (!isNaN(numericFirst) && numericFirst > 0 && cols.length >= 2) {
          if (c1 && /[a-zA-Z]/.test(c1)) {
            accountNo = c0.replace(/\s/g, '');
            const amtCol = cols.find((c, i) => i >= 2 && !isNaN(parseFloat(String(c).trim().replace(/\s/g, ''))));
            amount = amtCol ? parseFloat(String(amtCol).trim().replace(/\s/g, '')) : 0;
          } else {
            accountNo = c0.replace(/\s/g, '');
            amount = numericSecond;
          }
        }
      }

      if (accountNo && amount > 0) {
        parsed.push({ accountNo, amount, raw: cols.map(c => String(c)).join(', ') });
      }
    }

    if (parsed.length === 0) {
      this.toast.error('No valid data found. Ensure your file has at least 2 columns: Account Number and Amount.');
      return;
    }

    this.csvParsedRows.set(parsed);
    this.csvStep.set('preview');
  }

  csvChangeFile(): void {
    this.csvStep.set('upload');
    this.csvParsedRows.set([]);
    this.csvFile.set(null);
    this.csvFileName.set('');
  }

  async csvLookupAccounts(): Promise<void> {
    const rows = this.csvParsedRows();
    if (rows.length === 0) return;
    this.csvStep.set('lookup');
    this.csvPage.set(1);
    this.csvProcessing.set(true);
    this.csvCancelRequested = false;

    const results: CsvLookupRow[] = rows.map(row => ({
      accountNo: row.accountNo,
      amount: row.amount,
      status: 'pending' as const,
    }));
    this.csvLookupResults.set([...results]);

    const BATCH_SIZE = 10;
    for (let batchStart = 0; batchStart < results.length; batchStart += BATCH_SIZE) {
      if (this.csvCancelRequested) break;

      const batchEnd = Math.min(batchStart + BATCH_SIZE, results.length);
      const batchIndices: number[] = [];
      for (let i = batchStart; i < batchEnd; i++) {
        results[i] = { ...results[i], status: 'loading' };
        batchIndices.push(i);
      }
      this.csvLookupResults.set([...results]);

      const batchPromises = batchIndices.map(async (i) => {
        if (this.csvCancelRequested) return;
        try {
          const apiResult: any = await firstValueFrom(
            this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: results[i].accountNo })
          );
          const items = Array.isArray(apiResult) ? apiResult : apiResult?.value || [];

          if (items.length > 0) {
            const item = items[0];
            const accId = item.account_ID || item.accountID || item.id;
            const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
            const outstanding = item.outStandingAmt || item.outstandingAmount || 0;
            results[i] = { ...results[i], status: 'found', name, accountId: accId, outstandingAmount: outstanding };
          } else {
            results[i] = { ...results[i], status: 'not_found', errorMsg: 'Account not found' };
          }
        } catch (err: any) {
          results[i] = { ...results[i], status: 'error', errorMsg: err?.message || 'Lookup failed' };
        }
      });

      await Promise.all(batchPromises);
      this.csvLookupResults.set([...results]);
    }

    if (this.csvCancelRequested) {
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'loading' || results[i].status === 'pending') {
          results[i] = { ...results[i], status: 'error', errorMsg: 'Cancelled' };
        }
      }
      this.csvLookupResults.set([...results]);
    }

    this.csvProcessing.set(false);
    this.csvStep.set('done');
  }

  csvCancelLookup(): void {
    this.csvCancelRequested = true;
  }

  csvAddToLines(): void {
    const tx = this.transaction();
    if (!tx) return;
    const found = this.csvLookupResults().filter(r => r.status === 'found' && r.accountId);
    let currentTotal = this.totalAllocated();

    const newLines: AllocationLine[] = [];
    const skipped: string[] = [];

    for (const row of found) {
      const lineAmount = row.amount;
      if (lineAmount <= 0 || !isFinite(lineAmount)) {
        skipped.push(`${row.accountNo} (R ${lineAmount.toFixed(2)}) - Invalid amount`);
        continue;
      }
      if (currentTotal + lineAmount > tx.amount + 0.01) {
        skipped.push(`${row.accountNo} (R ${lineAmount.toFixed(2)}) - Would exceed transaction amount`);
        continue;
      }
      const nameParts = (row.name || '').split(/\s+/).filter(Boolean);
      let lastName = nameParts[0] || 'N/A';
      let initials = nameParts.length >= 2
        ? nameParts.slice(1).map(p => p.charAt(0).toUpperCase()).join('')
        : lastName.charAt(0).toUpperCase();

      newLines.push({
        accountNo: row.accountNo,
        accountId: row.accountId!,
        name: row.name || row.accountNo,
        amount: lineAmount,
        allocationType: 'ACCOUNT',
        description: `CSV Import: ${row.name || row.accountNo}`,
        lastName,
        initials,
      });
      currentTotal += lineAmount;
    }

    if (newLines.length > 0) {
      this.lines.update(prev => [...prev, ...newLines]);
    }

    if (skipped.length > 0) {
      this.toast.error(`${newLines.length} added, ${skipped.length} skipped: ${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? `... and ${skipped.length - 3} more` : ''}`);
    } else if (newLines.length > 0) {
      this.toast.success(`CSV Import Complete: ${newLines.length} allocation line(s) added.`);
    }

    this.closeCsvDialog();
  }

  downloadCsvTemplate(): void {
    const headers = 'AccountNumber,Amount';
    const sampleRows = ['100234,500.00', '100567,1200.50', '200891,750.00'];
    const csvContent = [headers, ...sampleRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'allocation_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getCsvPreviewPage(): CsvParsedRow[] {
    const pg = Math.min(this.csvPage(), this.csvPreviewTotalPages());
    const start = (pg - 1) * this.CSV_PAGE_SIZE;
    return this.csvParsedRows().slice(start, start + this.CSV_PAGE_SIZE);
  }

  getCsvLookupPage(): CsvLookupRow[] {
    const pg = Math.min(this.csvPage(), this.csvLookupTotalPages());
    const start = (pg - 1) * this.CSV_PAGE_SIZE;
    return this.csvLookupResults().slice(start, start + this.CSV_PAGE_SIZE);
  }

  getCsvPageStart(): number {
    const step = this.csvStep();
    const totalPages = step === 'preview' ? this.csvPreviewTotalPages() : this.csvLookupTotalPages();
    const pg = Math.min(this.csvPage(), totalPages);
    return (pg - 1) * this.CSV_PAGE_SIZE;
  }

  csvPrevPage(): void {
    this.csvPage.update(p => Math.max(1, p - 1));
  }

  csvNextPage(): void {
    const step = this.csvStep();
    const totalPages = step === 'preview' ? this.csvPreviewTotalPages() : this.csvLookupTotalPages();
    this.csvPage.update(p => Math.min(totalPages, p + 1));
  }

  goBack(): void {
    const tx = this.transaction();
    if (this.postComplete() && this.postErrors().length === 0 && tx) {
      this.router.navigate(['/direct-deposits/manual'], { queryParams: { allocated: tx.posItem_ID } });
    } else {
      this.router.navigate(['/direct-deposits/manual']);
    }
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

  trackByIndex(index: number): number {
    return index;
  }
}
