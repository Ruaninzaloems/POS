import { Component, signal, computed, OnInit, OnDestroy, inject, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { PosBasketService } from '../../services/pos-basket.service';
import { firstValueFrom } from 'rxjs';
import {
  BasketItem,
  BasketItemType,
  SearchMode,
  TenderType,
  ReceiptDeliveryMethod,
  ReceiptResult,
  UnifiedSearchResult,
  TYPE_LABELS,
  PROCESSING_ORDER,
} from '../../models/pos-basket.models';

interface BankItem {
  bankID: number;
  bankName: string;
  branchCode: string;
}

interface MiscGroup {
  groupId: number;
  groupName: string;
  description: string;
}

interface ScoaItem {
  scoaItemId: number;
  scoaItemName: string;
  description: string;
  amount: number;
  isVatable: boolean;
  vatPercentage: number;
}

interface CsvImportRow {
  accountNo: string;
  amount: number;
  receiptDate: string;
  raw: string;
}

interface CsvValidatedRow {
  accountNo: string;
  amount: number;
  receiptDate: string;
  status: 'pending' | 'validating' | 'found' | 'not_found' | 'error' | 'duplicate';
  accountId: number;
  name: string;
  outstandingAmount: number;
  address: string;
  errorMsg: string;
  rawApiData: any;
}

type PaymentMode = 'account' | 'clearance' | 'prepaid' | 'misc';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})
export class PosComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);
  basket = inject(PosBasketService);

  user = this.auth.user;
  searchMode = signal<SearchMode>('unified');
  activeMode = signal<PaymentMode>('account');

  unifiedSearchQuery = signal('');
  unifiedSearchLoading = signal(false);
  unifiedSearchResults = signal<UnifiedSearchResult[]>([]);
  unifiedSearchActive = signal(false);

  tabSearchQuery = signal('');
  tabSearchLoading = signal(false);
  tabSearchResults = signal<any[]>([]);
  tabSearchActive = signal(false);
  accountDetailLoading = signal(false);

  showPaymentPanel = signal(false);
  activeTender = signal<TenderType>('cash');
  cashAmount = signal(0);
  cardAmount = signal(0);
  cardNumber = signal('');
  cardExpiry = signal('');
  cardReference = signal('');
  chequeAmount = signal(0);
  chequeNumber = signal('');
  chequeBankId = signal(0);
  chequeName = signal('');
  eftAmount = signal(0);
  eftReference = signal('');
  processingPayment = signal(false);

  banks = signal<BankItem[]>([]);
  banksLoading = signal(false);

  receiptResults = signal<ReceiptResult[]>([]);
  showReceipt = signal(false);
  printingReceipt = signal(false);
  receiptDeliveryMethod = signal<ReceiptDeliveryMethod>('print');
  receiptEmail = signal('');
  receiptPhone = signal('');
  sendingReceipt = signal(false);

  showCancelDialog = signal(false);
  cancelReceiptNo = signal('');
  cancelReason = signal('');
  cancellingReceipt = signal(false);

  showDropBoxDialog = signal(false);
  dropBoxAmount = signal(0);
  dropBoxReference = signal('');
  submittingDropBox = signal(false);

  clearanceSearchId = signal('');
  clearanceSearching = signal(false);
  clearanceError = signal('');

  prepaidMeterNo = signal('');
  prepaidAmount = signal(0);
  prepaidSearching = signal(false);
  prepaidBreakdown = signal<any>(null);
  prepaidError = signal('');
  prepaidProcessing = signal(false);
  prepaidServiceTypes = signal<any[]>([]);
  prepaidSelectedService = signal('');

  miscGroups = signal<MiscGroup[]>([]);
  miscGroupsLoading = signal(false);
  miscSelectedGroupId = signal(0);
  miscScoaItems = signal<ScoaItem[]>([]);
  miscScoaLoading = signal(false);
  miscSelectedScoaId = signal(0);
  miscAmount = signal(0);
  miscDescription = signal('');
  miscLastName = signal('');
  miscInitials = signal('');

  paymentOptions = signal<any[]>([]);
  paymentTypes = signal<any[]>([]);
  cashierInfo = signal<any>(null);

  sessionActive = signal(false);
  sessionLoading = signal(true);
  sessionStatus = signal<'none' | 'active' | 'pending_approval' | 'returned' | 'closed' | 'needs_reconcile'>('none');
  reconcileMessage = signal('');
  sessionReturnReason = signal('');
  receiptRange = signal<any>(null);

  accountGroupSearching = signal(false);
  accountGroupResults = signal<any[]>([]);
  expandedGroupId = signal<string | null>(null);
  groupAccountsLoading = signal(false);

  totalTendered = computed(() => {
    return this.cashAmount() + this.cardAmount() + this.chequeAmount() + this.eftAmount();
  });

  cashRoundedAmount = computed(() => {
    const cash = this.cashAmount();
    if (cash <= 0) return 0;
    return this.basket.roundToNearest10c(cash);
  });

  cashRoundingDiff = computed(() => {
    const cash = this.cashAmount();
    if (cash <= 0) return 0;
    return Math.round((this.cashRoundedAmount() - cash) * 100) / 100;
  });

  effectiveTotalTendered = computed(() => {
    const cash = this.cashAmount() > 0 ? this.cashRoundedAmount() : 0;
    return cash + this.cardAmount() + this.chequeAmount() + this.eftAmount();
  });

  changeAmount = computed(() => Math.max(0, this.effectiveTotalTendered() - this.basket.totalToPay()));

  shortfall = computed(() => {
    const diff = this.basket.totalToPay() - this.effectiveTotalTendered();
    return diff > 0.005 ? diff : 0;
  });

  isSplitTender = computed(() => {
    const methods = [this.cashAmount() > 0, this.cardAmount() > 0, this.chequeAmount() > 0, this.eftAmount() > 0];
    return methods.filter(Boolean).length > 1;
  });

  canDoAccountPayments = computed(() => {
    const opts = this.paymentOptions();
    if (!opts || opts.length === 0) return true;
    return opts.some((o: any) => {
      const desc = (o.posPaymentOptionDesc || o.description || o.name || '').toLowerCase();
      return (o.isTicked || o.enabled) && (desc.includes('account') || desc.includes('consumer'));
    });
  });

  canDoClearance = computed(() => {
    const opts = this.paymentOptions();
    if (!opts || opts.length === 0) return true;
    return opts.some((o: any) => {
      const desc = (o.posPaymentOptionDesc || o.description || o.name || '').toLowerCase();
      return (o.isTicked || o.enabled) && desc.includes('clearance');
    });
  });

  canDoPrepaid = computed(() => {
    const opts = this.paymentOptions();
    if (!opts || opts.length === 0) return true;
    return opts.some((o: any) => {
      const desc = (o.posPaymentOptionDesc || o.description || o.name || '').toLowerCase();
      return (o.isTicked || o.enabled) && (desc.includes('prepaid') || desc.includes('electricity') || desc.includes('token'));
    });
  });

  canDoMisc = computed(() => {
    const opts = this.paymentOptions();
    if (!opts || opts.length === 0) return true;
    return opts.some((o: any) => {
      const desc = (o.posPaymentOptionDesc || o.description || o.name || '').toLowerCase();
      return (o.isTicked || o.enabled) && (desc.includes('misc') || desc.includes('sundry'));
    });
  });

  canTenderCash = computed(() => {
    const types = this.paymentTypes();
    if (!types || types.length === 0) return true;
    return types.some((t: any) => {
      const desc = (t.posPaymentTypeDesc || t.description || t.name || '').toLowerCase();
      return (t.isTicked || t.enabled) && desc.includes('cash');
    });
  });

  canTenderCard = computed(() => {
    const types = this.paymentTypes();
    if (!types || types.length === 0) return true;
    return types.some((t: any) => {
      const desc = (t.posPaymentTypeDesc || t.description || t.name || '').toLowerCase();
      return (t.isTicked || t.enabled) && (desc.includes('card') || desc.includes('credit'));
    });
  });

  canTenderCheque = computed(() => {
    const types = this.paymentTypes();
    if (!types || types.length === 0) return true;
    return types.some((t: any) => {
      const desc = (t.posPaymentTypeDesc || t.description || t.name || '').toLowerCase();
      return (t.isTicked || t.enabled) && desc.includes('cheque');
    });
  });

  canTenderEft = computed(() => {
    const types = this.paymentTypes();
    if (!types || types.length === 0) return true;
    return types.some((t: any) => {
      const desc = (t.posPaymentTypeDesc || t.description || t.name || '').toLowerCase();
      return (t.isTicked || t.enabled) && desc.includes('eft');
    });
  });

  csvImportOpen = signal(false);
  csvStep = signal<'upload' | 'preview' | 'validate' | 'done'>('upload');
  csvFileName = signal('');
  csvParsedRows = signal<CsvImportRow[]>([]);
  csvValidatedRows = signal<CsvValidatedRow[]>([]);
  csvValidating = signal(false);
  csvValidationProgress = signal(0);
  csvCancelled = signal(false);
  csvPage = signal(1);
  csvPageSize = 20;

  @ViewChild('csvFileInput') csvFileInput!: ElementRef<HTMLInputElement>;

  csvFoundCount = computed(() => this.csvValidatedRows().filter(r => r.status === 'found').length);
  csvNotFoundCount = computed(() => this.csvValidatedRows().filter(r => r.status === 'not_found').length);
  csvErrorCount = computed(() => this.csvValidatedRows().filter(r => r.status === 'error').length);
  csvDuplicateCount = computed(() => this.csvValidatedRows().filter(r => r.status === 'duplicate').length);
  csvTotalImportAmount = computed(() => this.csvParsedRows().reduce((sum, r) => sum + r.amount, 0));
  csvValidTotalAmount = computed(() => this.csvValidatedRows().filter(r => r.status === 'found').reduce((sum, r) => sum + r.amount, 0));

  denominations = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10];

  typeLabels = TYPE_LABELS;
  processingOrder = PROCESSING_ORDER;

  private cashierCheckDone = false;

  ngOnInit(): void {
    this.loadCashierInfo();
    this.loadBanks();
  }

  ngOnDestroy(): void {}

  toggleSearchMode(): void {
    this.searchMode.update(m => m === 'tabs' ? 'unified' : 'tabs');
    this.clearUnifiedSearch();
    this.clearTabSearch();
  }

  async loadCashierInfo(): Promise<void> {
    this.sessionLoading.set(true);
    try {
      const userId = this.user()?.user_ID;
      if (!userId) {
        this.sessionActive.set(false);
        this.sessionStatus.set('none');
        this.sessionLoading.set(false);
        return;
      }

      const finYear = this.user()?.finYear || '';

      const data: any = await firstValueFrom(
        this.api.get<any>('/api/platinum/auth/active-cashier-by-userid', {
          userid: String(userId),
          finYear
        })
      ).catch(() => null);

      if (!data || data._error) {
        this.cashierInfo.set({ finYear });
        this.sessionActive.set(false);
        this.sessionStatus.set('none');
        this.sessionLoading.set(false);
        return;
      }

      const isActive = data.isActive === true;
      const hasPendingDayEnd = data.hasPendingDayEnd === true;
      const hasDayEndReturned = data.hasDayEndReturned === true;
      const cashierRegistered = data.cashierRegistered === true;

      const cashierDetails = data.details || {};
      const officeData = cashierDetails.const_CashOffice || {};
      const cashierInfoObj: any = {
        ...cashierDetails,
        cashOffice_ID: data.officeId || officeData.cashOffice_ID || cashierDetails.officeId,
        cashOfficeDesc: data.officeName || officeData.cashOfficeDesc || '',
        cashFloat: data.cashFloat ?? cashierDetails.cashFloat ?? 0,
        finYear,
      };

      this.cashierInfo.set(cashierInfoObj);

      if (hasDayEndReturned) {
        this.sessionActive.set(true);
        this.sessionStatus.set('returned');
        this.sessionReturnReason.set(data.dayEndReturnReason || '');
        this.cashierCheckDone = true;
        this.loadPaymentConfig();
        this.sessionLoading.set(false);
        return;
      }

      if (hasPendingDayEnd) {
        this.sessionActive.set(false);
        this.sessionStatus.set('pending_approval');
        this.sessionReturnReason.set('');
        this.sessionLoading.set(false);
        return;
      }

      if (isActive && data.officeId) {
        const cashierId = data.cashierId || cashierDetails.id;
        if (cashierId) {
          try {
            const reconCheck: any = await firstValueFrom(
              this.api.get<any>('/api/platinum/receipt-prepaid/validate-cashier-day-end-recon', {
                cashierId: String(cashierId),
                finYear
              })
            );

            if (typeof reconCheck === 'string') {
              if (reconCheck.toLowerCase().includes('reconcile')) {
                this.sessionActive.set(false);
                this.sessionStatus.set('needs_reconcile');
                this.reconcileMessage.set(reconCheck);
                this.sessionLoading.set(false);
                return;
              }
            } else if (reconCheck && !reconCheck._error) {
              const reconMsg = reconCheck.message || reconCheck.msg || reconCheck.validationMessage || '';
              const needsRecon = reconCheck.needsReconcile === true
                || reconCheck.requiresReconcile === true
                || reconCheck.isValid === false
                || (typeof reconMsg === 'string' && reconMsg.toLowerCase().includes('reconcile'));

              if (needsRecon) {
                this.sessionActive.set(false);
                this.sessionStatus.set('needs_reconcile');
                this.reconcileMessage.set(reconMsg || 'You need to submit your day-end reconciliation before you can process transactions.');
                this.sessionLoading.set(false);
                return;
              }
            }
          } catch {
            console.warn('[pos] validate-day-end-recon API error — treating as no reconciliation needed (new session or API unavailable)');
          }
        }

        this.sessionActive.set(true);
        this.sessionStatus.set('active');
        this.cashierCheckDone = true;
        this.loadPaymentConfig();
        if (data.hasReceiptRange) {
          this.receiptRange.set(data.receiptRange || null);
        }
      } else if (cashierRegistered && !isActive) {
        this.sessionActive.set(false);
        this.sessionStatus.set('none');
      } else {
        this.sessionActive.set(false);
        this.sessionStatus.set('none');
      }
    } catch (e: any) {
      this.cashierInfo.set(null);
      this.sessionActive.set(false);
      this.sessionStatus.set('none');
    } finally {
      this.sessionLoading.set(false);
    }
  }

  async loadPaymentConfig(): Promise<void> {
    const ci = this.cashierInfo();
    const userId = this.user()?.user_ID;
    if (!userId || !ci?.cashOffice_ID) return;

    try {
      const [options, types] = await Promise.all([
        firstValueFrom(this.api.get<any>('/api/platinum/receipt-prepaid/cashier-payment-options', {
          userId: String(userId), cashofficeId: String(ci.cashOffice_ID), cashierId: String(ci.id || ci.cashier_ID || userId)
        })),
        firstValueFrom(this.api.get<any>('/api/platinum/receipt-prepaid/cashier-payment-types', {
          userId: String(userId), cashofficeId: String(ci.cashOffice_ID), cashierId: String(ci.id || ci.cashier_ID || userId)
        })),
      ]);
      this.paymentOptions.set(options?.data || []);
      this.paymentTypes.set(types?.data || []);
    } catch (e: any) {
      this.toast.error('Failed to load payment configuration from Platinum.');
    }
  }

  async loadBanks(): Promise<void> {
    this.banksLoading.set(true);
    try {
      const data: any = await firstValueFrom(this.api.get<any>('/api/platinum/billing-payment-clearance/get-banks'));
      const arr = Array.isArray(data) ? data : [];
      this.banks.set(arr.map((b: any) => ({
        bankID: b.bankID || b.bank_ID || b.id || 0,
        bankName: b.bankName || b.bank_name || b.name || '',
        branchCode: b.branchCode || b.branch_code || '',
      })));
    } catch (e: any) {
      this.toast.error('Failed to load bank list.');
    } finally {
      this.banksLoading.set(false);
    }
  }

  setMode(mode: PaymentMode): void {
    if (!this.sessionActive()) return;
    const allowed =
      (mode === 'account' && this.canDoAccountPayments()) ||
      (mode === 'clearance' && this.canDoClearance()) ||
      (mode === 'prepaid' && this.canDoPrepaid()) ||
      (mode === 'misc' && this.canDoMisc());
    if (!allowed) return;
    this.activeMode.set(mode);
    if (mode === 'misc' && this.miscGroups().length === 0) {
      this.loadMiscGroups();
    }
    if (mode === 'prepaid' && this.prepaidServiceTypes().length === 0) {
      this.loadPrepaidServiceTypes();
    }
  }

  async unifiedSearch(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Please complete cashier setup first.');
      return;
    }
    const query = this.unifiedSearchQuery().trim();
    if (!query || query.length < 2) return;

    this.unifiedSearchLoading.set(true);
    this.unifiedSearchActive.set(true);
    this.unifiedSearchResults.set([]);

    try {
      const results: UnifiedSearchResult[] = [];

      const [accountData, groupData, miscData] = await Promise.allSettled([
        firstValueFrom(this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: query })),
        firstValueFrom(this.api.post('/api/platinum/billing-payment/search-account-groups', { searchTerm: query })),
        firstValueFrom(this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-groups')),
      ]);

      if (accountData.status === 'fulfilled') {
        const accts = Array.isArray(accountData.value) ? accountData.value : (accountData.value as any)?.accounts || (accountData.value as any)?.results || (accountData.value as any)?.data || [];
        for (const a of accts) {
          const meterNo = a.meterNo || a.prepaidMeterNo || a.meter_No || a.physicalMeterNo || '';
          const acctId = a.account_ID || a.accountID || a.accountId || 0;
          if (!acctId) continue;
          const isDuplicate = results.some(r => r.resultType === 'account' && r.id === acctId);
          if (isDuplicate) continue;
          results.push({
            resultType: 'account',
            id: acctId,
            label: a.name || a.accountName || a.consumerName || a.surname_Company || a.fullNAME || '',
            description: `${a.accountNo || a.accountNumber || a.accountID || ''} — ${a.address || a.physicalAddress || a.locationAddress || ''}`,
            balance: Number(a.outstandingAmount || a.outStandingAmt || a.outStandingAmount || a.balance || a.totalDue || 0),
            status: a.status || a.accountStatus || 'Active',
            rawData: { ...a, hasPrepaidMeter: !!meterNo, prepaidMeterNo: meterNo },
          });
        }
      }

      if (groupData.status === 'fulfilled') {
        const groups = Array.isArray(groupData.value) ? groupData.value : (groupData.value as any)?.groups || (groupData.value as any)?.data || (groupData.value as any)?.institutions || [];
        for (const g of groups) {
          results.push({
            resultType: 'group',
            id: g.groupId || g.group_ID || g.institutionId || g.id || 0,
            label: g.groupName || g.institutionName || g.name || g.description || '',
            description: `Account Group — ${g.accountCount || g.accounts?.length || '?'} accounts`,
            balance: 0,
            status: 'Group',
            rawData: g,
            groupAccounts: g.accounts || [],
          });
        }
      }

      if (miscData.status === 'fulfilled') {
        const groups = Array.isArray(miscData.value) ? miscData.value : [];
        const queryLower = query.toLowerCase();
        for (const g of groups) {
          const name = g.groupName || g.group_name || g.description || '';
          if (name.toLowerCase().includes(queryLower)) {
            results.push({
              resultType: 'misc',
              id: g.groupId || g.group_ID || g.miscellaneousPaymentGroup || g.id || 0,
              label: name,
              description: 'Miscellaneous Payment Group',
              balance: 0,
              status: 'Misc',
              rawData: g,
            });
          }
        }
      }

      const isMeterSearch = /^\d{6,}$/.test(query);
      if (isMeterSearch) {
        results.push({
          resultType: 'prepaid',
          id: query,
          label: `Prepaid Meter: ${query}`,
          description: 'Prepaid electricity/water recharge',
          balance: 0,
          status: 'Prepaid',
          rawData: { meterNumber: query },
        });
      }

      this.unifiedSearchResults.set(results);
      if (results.length === 0) {
        this.toast.show('No results found for your search.', 'info');
      }
    } catch (e: any) {
      this.toast.error('Search failed. Please try again.');
    } finally {
      this.unifiedSearchLoading.set(false);
    }
  }

  onUnifiedSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.unifiedSearch();
    if (event.key === 'Escape') this.clearUnifiedSearch();
  }

  clearUnifiedSearch(): void {
    this.unifiedSearchQuery.set('');
    this.unifiedSearchResults.set([]);
    this.unifiedSearchActive.set(false);
    this.expandedGroupId.set(null);
  }

  async addUnifiedResult(result: UnifiedSearchResult): Promise<void> {
    if (result.resultType === 'account') {
      await this.addAccountToBasket(result.rawData);
    } else if (result.resultType === 'group') {
      await this.loadGroupAccounts(result);
    } else if (result.resultType === 'misc') {
      await this.addMiscToBasket(result.rawData);
    } else if (result.resultType === 'prepaid') {
      this.addPrepaidPlaceholder(result.rawData.meterNumber);
    }
  }

  async addAccountToBasket(acctData: any): Promise<void> {
    const accountId = acctData.account_ID || acctData.accountID || acctData.accountId || 0;
    const accountNo = acctData.accountNo || acctData.accountNumber || acctData.account_no || '';

    const existing = this.basket.items().find(i =>
      i.type === 'account' && i.accountData &&
      (i.accountData.accountId === accountId || i.accountData.accountNumber === accountNo)
    );
    if (existing) {
      this.toast.error('This account is already in the basket.');
      return;
    }

    this.accountDetailLoading.set(true);
    let detailData: any = null;
    try {
      detailData = await firstValueFrom(
        this.api.get<any>('/api/platinum/receipt-prepaid/cons-account-details', { accountId: String(accountId || accountNo) })
      );
    } catch {
      this.toast.show('Could not load full account details, using search data.', 'info');
    }
    this.accountDetailLoading.set(false);

    const merged = { ...acctData, ...(detailData && !detailData._error ? detailData : {}) };
    const balance = Number(merged.outstandingAmount || merged.outStandingAmt || merged.balance || merged.totalDue || 0);
    const name = merged.name || merged.accountName || merged.consumerName || merged.surname_Company || '';
    const address = merged.address || merged.physicalAddress || merged.deliveryAddress || '';
    const meterNo = merged.meterNo || merged.prepaidMeterNo || merged.meter_No || '';

    const item: BasketItem = {
      id: crypto.randomUUID(),
      type: 'account',
      label: name,
      description: `${accountNo} — ${address}`,
      amountDue: balance,
      amountToPay: 0,
      accountData: {
        accountId,
        accountNumber: accountNo,
        name,
        address,
        billId: merged.billId || merged.bill_ID || 0,
        cutOffID: merged.cutOffID || merged.cutoff_ID || 0,
        cutOffAmount: merged.cutOffAmount || 0,
        debtAmount: merged.debtAmount || 0,
        debtArrangementId: merged.debtArrangementId || merged.debtArrangement_ID || 0,
        sundryDebtorsId: merged.sundryDebtorsId || merged.sundryDebtors_ID || 0,
        billingCycleId: merged.billingCycleId || merged.billingCycle_ID || 0,
        hasPrepaidMeter: !!meterNo,
        prepaidMeterNo: meterNo,
        originalData: merged,
      },
    };

    this.basket.addItem(item);
    this.toast.success(`Added ${name} (${accountNo})`);
  }

  async loadGroupAccounts(result: UnifiedSearchResult): Promise<void> {
    const groupId = result.id;
    if (this.expandedGroupId() === String(groupId)) {
      this.expandedGroupId.set(null);
      return;
    }

    this.expandedGroupId.set(String(groupId));
    this.groupAccountsLoading.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment/get-group-accounts', {
          groupId,
          institutionName: result.label,
        })
      );
      const accounts = Array.isArray(data) ? data : data?.accounts || data?.data || data?.results || [];
      const updatedResults = this.unifiedSearchResults().map(r => {
        if (String(r.id) === String(groupId)) {
          return { ...r, groupAccounts: accounts };
        }
        return r;
      });
      this.unifiedSearchResults.set(updatedResults);
    } catch {
      this.toast.error('Failed to load group accounts.');
    } finally {
      this.groupAccountsLoading.set(false);
    }
  }

  addAllGroupAccounts(groupAccounts: any[]): void {
    let addedCount = 0;
    for (const acct of groupAccounts) {
      const accountId = acct.account_ID || acct.accountID || acct.accountId || 0;
      const accountNo = acct.accountNo || acct.accountNumber || '';
      const existing = this.basket.items().find(i =>
        i.type === 'account' && i.accountData &&
        (i.accountData.accountId === accountId || i.accountData.accountNumber === accountNo)
      );
      if (existing) continue;

      const name = acct.name || acct.accountName || acct.consumerName || '';
      const address = acct.address || acct.physicalAddress || '';
      const balance = Number(acct.outstandingAmount || acct.outStandingAmt || acct.balance || 0);
      const meterNo = acct.meterNo || acct.prepaidMeterNo || '';

      this.basket.addItem({
        id: crypto.randomUUID(),
        type: 'account',
        label: name,
        description: `${accountNo} — ${address}`,
        amountDue: balance,
        amountToPay: 0,
        accountData: {
          accountId,
          accountNumber: accountNo,
          name,
          address,
          billId: acct.billId || acct.bill_ID || 0,
          cutOffID: acct.cutOffID || acct.cutoff_ID || 0,
          cutOffAmount: acct.cutOffAmount || 0,
          debtAmount: acct.debtAmount || 0,
          debtArrangementId: acct.debtArrangementId || 0,
          sundryDebtorsId: acct.sundryDebtorsId || 0,
          billingCycleId: acct.billingCycleId || 0,
          hasPrepaidMeter: !!meterNo,
          prepaidMeterNo: meterNo,
          originalData: acct,
        },
      });
      addedCount++;
    }
    this.toast.success(`Added ${addedCount} account(s) to basket.`);
  }

  async addMiscToBasket(groupData: any): Promise<void> {
    const groupId = groupData.groupId || groupData.group_ID || groupData.miscellaneousPaymentGroup || groupData.id || 0;
    const groupName = groupData.groupName || groupData.group_name || groupData.description || '';

    let scoaItems: ScoaItem[] = [];
    try {
      const data: any = await firstValueFrom(
        this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-scoa-items', { groupId: String(groupId) })
      );
      const arr = Array.isArray(data) ? data : [];
      scoaItems = arr.map((s: any) => ({
        scoaItemId: s.scoaItemId || s.scoa_item_ID || s.scoaItem || s.id || 0,
        scoaItemName: s.scoaItemName || s.description || s.name || '',
        description: s.description || s.scoaItemName || '',
        amount: s.amount || 0,
        isVatable: s.isVatable || false,
        vatPercentage: s.vatPercentage || 0,
      }));
    } catch {
      this.toast.error('Failed to load SCOA items for this group.');
      return;
    }

    const scoaItem = scoaItems[0];
    if (!scoaItem) {
      this.toast.error('No SCOA items found for this group.');
      return;
    }

    const item: BasketItem = {
      id: crypto.randomUUID(),
      type: 'misc',
      label: `${groupName} — ${scoaItem.scoaItemName}`,
      description: 'Miscellaneous payment',
      amountDue: scoaItem.amount || 0,
      amountToPay: scoaItem.amount || 0,
      miscData: {
        groupId,
        groupName,
        scoaItemId: scoaItem.scoaItemId,
        scoaItemName: scoaItem.scoaItemName,
        lastName: '',
        initials: '',
        description: scoaItem.scoaItemName,
        isVatable: scoaItem.isVatable,
        vatPercentage: scoaItem.vatPercentage,
        vatAmount: 0,
      },
    };

    this.basket.addItem(item);
    this.toast.success(`Added misc: ${groupName}`);
  }

  addPrepaidPlaceholder(meterNumber: string): void {
    const existing = this.basket.items().find(i =>
      i.type === 'prepaid' && i.prepaidData?.meterNumber === meterNumber
    );
    if (existing) {
      this.toast.error('This meter is already in the basket.');
      return;
    }

    const item: BasketItem = {
      id: crypto.randomUUID(),
      type: 'prepaid',
      label: `Prepaid: ${meterNumber}`,
      description: 'Enter amount and get breakdown',
      amountDue: 0,
      amountToPay: 0,
      prepaidData: {
        meterNumber,
        serviceType: '',
        breakdown: null,
        tokenResult: null,
      },
    };

    this.basket.addItem(item);
    this.toast.success(`Added prepaid meter: ${meterNumber}`);
  }

  addPrepaidFromAccount(item: BasketItem): void {
    if (!item.accountData?.hasPrepaidMeter || !item.accountData?.prepaidMeterNo) return;
    this.addPrepaidPlaceholder(item.accountData.prepaidMeterNo);
  }

  async tabSearch(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Please complete cashier setup first.');
      return;
    }
    const query = this.tabSearchQuery().trim();
    if (!query || query.length < 2) return;
    this.tabSearchLoading.set(true);
    this.tabSearchActive.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: query })
      );
      const results = Array.isArray(data) ? data : data?.accounts || data?.results || data?.data || [];
      this.tabSearchResults.set(results);
    } catch {
      this.tabSearchResults.set([]);
      this.toast.error('Search failed. Please try again.');
    } finally {
      this.tabSearchLoading.set(false);
    }
  }

  onTabSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.tabSearch();
    if (event.key === 'Escape') this.clearTabSearch();
  }

  clearTabSearch(): void {
    this.tabSearchQuery.set('');
    this.tabSearchResults.set([]);
    this.tabSearchActive.set(false);
  }

  async selectTabAccount(result: any): Promise<void> {
    await this.addAccountToBasket(result);
    this.clearTabSearch();
  }

  updateMiscItemField(id: string, field: string, value: any): void {
    this.basket.items.update(items =>
      items.map(item => {
        if (item.id !== id || !item.miscData) return item;
        return { ...item, miscData: { ...item.miscData, [field]: value } };
      })
    );
  }

  updatePrepaidItemField(id: string, field: string, value: any): void {
    this.basket.items.update(items =>
      items.map(item => {
        if (item.id !== id || !item.prepaidData) return item;
        return { ...item, prepaidData: { ...item.prepaidData, [field]: value } };
      })
    );
  }

  openPaymentPanel(): void {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Please complete cashier setup first.');
      return;
    }
    if (!this.basket.hasItems() || this.basket.totalToPay() <= 0) {
      this.toast.error('Add items and enter amounts first.');
      return;
    }
    this.resetTenderFields();
    const total = this.basket.totalToPay();
    if (this.canTenderCash()) {
      this.cashAmount.set(total);
      this.activeTender.set('cash');
    } else if (this.canTenderCard()) {
      this.cardAmount.set(total);
      this.activeTender.set('card');
    } else if (this.canTenderCheque()) {
      this.chequeAmount.set(total);
      this.activeTender.set('cheque');
    } else if (this.canTenderEft()) {
      this.eftAmount.set(total);
      this.activeTender.set('eft');
    }
    this.showPaymentPanel.set(true);
  }

  closePaymentPanel(): void {
    this.showPaymentPanel.set(false);
  }

  setTenderType(type: TenderType): void {
    const allowed =
      (type === 'cash' && this.canTenderCash()) ||
      (type === 'card' && this.canTenderCard()) ||
      (type === 'cheque' && this.canTenderCheque()) ||
      (type === 'eft' && this.canTenderEft());
    if (!allowed) return;
    this.activeTender.set(type);
  }

  addDenomination(value: number): void {
    this.cashAmount.update(v => Math.round((v + value) * 100) / 100);
  }

  setCashExact(): void {
    const remaining = this.basket.totalToPay() - this.cardAmount() - this.chequeAmount() - this.eftAmount();
    const rounded = this.basket.roundToNearest10c(Math.max(0, remaining));
    this.cashAmount.set(rounded);
  }

  resetTenderFields(): void {
    this.cashAmount.set(0);
    this.cardAmount.set(0);
    this.cardNumber.set('');
    this.cardExpiry.set('');
    this.cardReference.set('');
    this.chequeAmount.set(0);
    this.chequeNumber.set('');
    this.chequeBankId.set(0);
    this.chequeName.set('');
    this.eftAmount.set(0);
    this.eftReference.set('');
  }

  formatCardNumber(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.cardNumber.set(formatted);
  }

  formatExpiry(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      this.cardExpiry.set(digits.slice(0, 2) + '/' + digits.slice(2));
    } else {
      this.cardExpiry.set(digits);
    }
  }

  getPaymentTypeId(tenderType?: TenderType): number {
    const types = this.paymentTypes();
    const tt = tenderType || this.activeTender();
    if (tt === 'card' || this.cardAmount() > 0) {
      const cardType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('card'));
      return cardType?.posPaymentType_ID || cardType?.paymentTypeId || 3;
    }
    if (tt === 'cheque' || this.chequeAmount() > 0) {
      const chequeType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('cheque'));
      return chequeType?.posPaymentType_ID || chequeType?.paymentTypeId || 2;
    }
    if (tt === 'eft' || this.eftAmount() > 0) {
      const eftType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('eft'));
      return eftType?.posPaymentType_ID || eftType?.paymentTypeId || 5;
    }
    const cashType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('cash'));
    return cashType?.posPaymentType_ID || cashType?.paymentTypeId || 1;
  }

  getPaymentOptionId(): number {
    const options = this.paymentOptions();
    if (options.length > 0) {
      return options[0]?.posPaymentOption_ID || options[0]?.paymentOptionId || options[0]?.id || 1;
    }
    return 1;
  }

  async processPayment(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Cannot process payments.');
      return;
    }
    if (this.shortfall() > 0) {
      this.toast.error('Total tendered is less than the amount due.');
      return;
    }
    if (this.cardAmount() > 0 && !this.cardNumber().replace(/\s/g, '')) {
      this.toast.error('Please enter the card number for card payments.');
      return;
    }
    if (this.chequeAmount() > 0 && !this.chequeNumber()) {
      this.toast.error('Please enter the cheque number.');
      return;
    }

    if (this.cashAmount() > 0) {
      const { roundedCash, adjustment } = this.basket.applyCashRounding(this.cashAmount());
      if (Math.abs(adjustment) > 0.001) {
        this.cashAmount.set(roundedCash);
        this.basket.adjustFirstItemForRounding(this.basket.totalToPay() + adjustment);
      }
    }

    this.processingPayment.set(true);
    const userId = this.user()?.user_ID;
    const ci = this.cashierInfo();
    const finYear = ci?.finYear || '';
    const now = new Date();
    const receiptDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    const cardNum = this.cardNumber().replace(/\s/g, '');
    const allResults: ReceiptResult[] = [];

    try {
      const ordered = this.basket.orderedItems();
      const accountItems = ordered.filter(i => i.type === 'account');
      const clearanceItems = ordered.filter(i => i.type === 'clearance');
      const prepaidItems = ordered.filter(i => i.type === 'prepaid');
      const miscItems = ordered.filter(i => i.type === 'misc');

      const isSplit = this.isSplitTender();
      const cashPaymentTypeId = this.getPaymentTypeId('cash');
      const cardPaymentTypeId = this.getPaymentTypeId('card');

      if (accountItems.length > 0) {
        const accountItemsWithPay = accountItems.filter(i => i.amountToPay > 0);
        if (accountItemsWithPay.length > 0) {
          try {
            const stagingPayload = accountItemsWithPay.map(item => {
              const ad = item.accountData!;
              const orig = ad.originalData || {};
              return {
                account_ID: ad.accountId,
                accountNumber: ad.accountNumber,
                name: ad.name,
                outStandingAmt: item.amountDue,
                paymentAmount: item.amountToPay,
                deliveryAddress: ad.address || orig.deliveryAddress || '',
                statusDesc: orig.statusDesc || '-',
                accountDesc: orig.accountDesc || '',
                erfNumber: orig.erfNumber || '',
                billId: orig.billId ?? null,
              };
            });
            await firstValueFrom(
              this.api.post(`/api/platinum/billing-payment/save-multiple-account-payment?userId=${userId}`, stagingPayload)
            );
          } catch {
          }

          if (isSplit && this.cashAmount() > 0 && this.cardAmount() > 0) {
            const allocation = this.basket.allocateSplitTender(this.cashRoundedAmount(), this.cardAmount());
            const cashAcctItems = allocation.cashItems.filter(i => i.type === 'account');
            const cardAcctItems = allocation.cardItems.filter(i => i.type === 'account');

            if (cashAcctItems.length > 0) {
              const cashResult = await this.submitAccountPayment(cashAcctItems, userId!, finYear, receiptDate, cashPaymentTypeId, '', allocation.cashTotal);
              allResults.push({ receiptNumber: this.getReceiptNo(cashResult), tenderType: 'cash', amount: allocation.cashTotal, items: cashAcctItems, rawResponse: cashResult });
            }
            if (cardAcctItems.length > 0) {
              const cardResult = await this.submitAccountPayment(cardAcctItems, userId!, finYear, receiptDate, cardPaymentTypeId, cardNum, allocation.cardTotal);
              allResults.push({ receiptNumber: this.getReceiptNo(cardResult), tenderType: 'card', amount: allocation.cardTotal, items: cardAcctItems, rawResponse: cardResult });
            }
          } else {
            const paymentTypeId = this.getPaymentTypeId();
            const result = await this.submitAccountPayment(accountItemsWithPay, userId!, finYear, receiptDate, paymentTypeId, cardNum, this.basket.totalToPay());
            allResults.push({ receiptNumber: this.getReceiptNo(result), tenderType: this.activeTender(), amount: accountItemsWithPay.reduce((s, i) => s + i.amountToPay, 0), items: accountItemsWithPay, rawResponse: result });
          }
        }
      }

      for (const clearItem of clearanceItems) {
        if (clearItem.amountToPay <= 0 || !clearItem.clearanceData) continue;
        const result = await this.submitClearancePaymentItem(clearItem, userId!, ci, finYear, cardNum);
        allResults.push({ receiptNumber: this.getReceiptNo(result), tenderType: this.activeTender(), amount: clearItem.amountToPay, items: [clearItem], rawResponse: result });
      }

      for (const prepItem of prepaidItems) {
        if (prepItem.amountToPay <= 0 || !prepItem.prepaidData) continue;
        const result = await this.submitPrepaidPaymentItem(prepItem);
        allResults.push({ receiptNumber: this.getReceiptNo(result), tenderType: this.activeTender(), amount: prepItem.amountToPay, items: [prepItem], rawResponse: result });
      }

      for (const miscItem of miscItems) {
        if (miscItem.amountToPay <= 0 || !miscItem.miscData) continue;
        const result = await this.submitMiscPaymentItem(miscItem, userId!, ci, finYear, cardNum);
        allResults.push({ receiptNumber: this.getReceiptNo(result), tenderType: this.activeTender(), amount: miscItem.amountToPay, items: [miscItem], rawResponse: result });
      }

      this.receiptResults.set(allResults);
      this.showReceipt.set(true);
      this.showPaymentPanel.set(false);
      this.toast.success(`${allResults.length} receipt(s) processed successfully!`);
      this.basket.clearAll();
      this.resetTenderFields();
    } catch (e: any) {
      this.toast.error(e?.error?.message || e?.message || 'Payment processing failed.');
    } finally {
      this.processingPayment.set(false);
    }
  }

  private formatCardExpiry(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
    return raw;
  }

  private async submitAccountPayment(items: BasketItem[], userId: number, finYear: string, receiptDate: string, paymentTypeId: number, cardNum: string, totalAmount: number): Promise<any> {
    const ci = this.cashierInfo();
    const sessionCashierId = ci?.id || ci?.cashier_ID || userId;
    const sessionOfficeId = ci?.cashOffice_ID || 0;
    const isCardPayment = paymentTypeId === 3;

    if (items.length === 1) {
      const item = items[0];
      const ad = item.accountData!;
      const orig = ad.originalData || {};
      const submitAccountBase: any = {
        ...orig,
        account_ID: ad.accountId,
        accountNumber: ad.accountNumber,
        name: ad.name,
        outStandingAmt: item.amountToPay,
        billId: null,
        cutOffID: ad.cutOffID ?? 0,
        cutOffAmount: ad.cutOffAmount ?? 0,
        debtAmount: ad.debtAmount ?? 0,
        debtArrangementId: ad.debtArrangementId ?? 0,
        billingCycleId: ad.billingCycleId ?? 0,
      };
      if (isCardPayment) {
        delete submitAccountBase.sundryDebtorsId;
      } else {
        submitAccountBase.sundryDebtorsId = ad.sundryDebtorsId ?? '';
      }
      const payload = {
        account: submitAccountBase,
        requestModel: {
          finYear,
          receiptDate,
          totalAmount: item.amountToPay,
          tenderAmount: isCardPayment ? 0 : totalAmount,
          changeAmount: isCardPayment ? 0 : Math.max(0, totalAmount - item.amountToPay),
          paymentType: paymentTypeId,
          paymentOption: this.getPaymentOptionId(),
          outStandingAmount: item.amountDue,
          cutOffID: ad.cutOffID ?? 0,
          cutOffAmount: ad.cutOffAmount ?? 0,
          debtAmount: ad.debtAmount ?? 0,
          debtArrangementId: ad.debtArrangementId ?? 0,
          sundryDebtorsId: String(ad.sundryDebtorsId ?? ''),
          cardNumber: isCardPayment ? cardNum : '',
          expiryDate: isCardPayment ? this.formatCardExpiry(this.cardExpiry()) : '',
          processingMonth: 0,
          chequeNumber: '',
          chequeDate: receiptDate,
          accountHolderName: ad.name || '',
          bankName: '',
          bankBranchCode: '',
          cashierId: sessionCashierId,
          cashOfficeId: sessionOfficeId,
        },
      };
      return await firstValueFrom(
        this.api.post(`/api/platinum/billing-payment/submit-consumer-payment/${userId}`, payload)
      );
    } else {
      const submitAccounts = items.map(item => {
        const ad = item.accountData!;
        const orig = ad.originalData || {};
        return {
          capturerID: userId,
          accountID: ad.accountId,
          account_ID: ad.accountId,
          oldAccountCode: orig.oldAccountCode || '',
          name: ad.name || '',
          sgNumber: orig.erfNumber || orig.sgNo || '',
          address: ad.address || orig.deliveryAddress || '',
          outstandingAmount: item.amountDue,
          outStandingAmt: item.amountDue,
          accountStatus: orig.statusDesc || '-',
          accountType: orig.accountDesc || '',
          paymentAmount: item.amountToPay,
          accountNumber: ad.accountNumber || '',
          receiptID: 0,
          billId: orig.billId ?? 0,
          clearanceId: orig.clearance_ID ?? 0,
        };
      });
      const totalPaymentAmount = items.reduce((s, i) => s + i.amountToPay, 0);
      const totalOutstanding = items.reduce((s, i) => s + i.amountDue, 0);
      const payload = {
        accounts: submitAccounts,
        requestModel: {
          finYear,
          receiptDate,
          totalAmount: totalPaymentAmount,
          tenderAmount: isCardPayment ? 0 : totalAmount,
          changeAmount: isCardPayment ? 0 : this.changeAmount(),
          paymentType: paymentTypeId,
          paymentOption: this.getPaymentOptionId(),
          outStandingAmount: totalOutstanding,
          cardNumber: isCardPayment ? cardNum : '',
          expiryDate: isCardPayment ? this.formatCardExpiry(this.cardExpiry()) : '',
          processingMonth: 0,
          chequeNumber: '',
          chequeDate: receiptDate,
          accountHolderName: submitAccounts[0]?.name || '',
          bankName: '',
          bankBranchCode: '',
          cutOffID: 0,
          debtArrangementId: 0,
          cutOffAmount: 0,
          debtAmount: 0,
          sundryDebtorsId: '',
          cashierId: sessionCashierId,
          cashOfficeId: sessionOfficeId,
        },
      };
      return await firstValueFrom(
        this.api.post(`/api/platinum/billing-payment/submit-multiple-payment/${userId}`, payload)
      );
    }
  }

  private async submitClearancePaymentItem(item: BasketItem, userId: number, ci: any, finYear: string, cardNum: string): Promise<any> {
    const cd = item.clearanceData!;
    const sessionCashierId = ci?.id || ci?.cashier_ID || userId;
    const sessionOfficeId = ci?.cashOffice_ID || 0;
    const paymentTypeId = this.getPaymentTypeId();
    const isCardPayment = paymentTypeId === 3;
    const now = new Date();
    const receiptDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    const paidItems = (cd.accounts || []).map((a: any) => ({
      account_ID: a.accountId || a.account_ID || null,
      debT_TYPE: a.debtType || a.debT_TYPE || null,
      amount: a.paymentAmount || a.amount || 0,
    }));
    return await firstValueFrom(
      this.api.post('/api/platinum/billing-payment-clearance/submit-payment', {
        userId,
        paymentTypeId,
        cashierId: sessionCashierId,
        cashOfficeId: sessionOfficeId,
        receiptDate,
        tenderAmount: item.amountToPay,
        changeAmount: 0,
        paidAmount: item.amountToPay,
        outstandingAmount: item.amountDue || item.amountToPay,
        clearance_ID: String(cd.clearanceId),
        finYear,
        accountHolderName: cd.ownerName || 'Walk-in',
        chequeNo: this.chequeNumber() || null,
        bankId: null,
        branchId: null,
        cardNo: isCardPayment ? cardNum : null,
        cardExpiryDate: isCardPayment ? this.formatCardExpiry(this.cardExpiry()) : null,
        paySection1181Only: false,
        section1181Amount: 0,
        paidItems,
      })
    );
  }

  private async submitPrepaidPaymentItem(item: BasketItem): Promise<any> {
    const pd = item.prepaidData!;
    const ci = this.cashierInfo();
    const userId = this.user()?.user_ID;
    const sessionCashierId = ci?.id || ci?.cashier_ID || userId;
    const sessionOfficeId = ci?.cashOffice_ID || 0;
    const paymentTypeId = this.getPaymentTypeId();
    const isCardPayment = paymentTypeId === 3;
    const now = new Date();
    const receiptDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    return await firstValueFrom(
      this.api.post('/api/platinum/receipt-prepaid/submit-prepaid-payment', {
        userId,
        cashierId: sessionCashierId,
        cashOfficeId: sessionOfficeId,
        accountId: pd.accountId || 0,
        accountNumber: pd.accountNumber || '',
        meterNumber: pd.meterNumber,
        amount: item.amountToPay,
        tenderAmount: item.amountToPay,
        changeAmount: 0,
        paymentTypeId,
        receiptDate,
        finYear: ci?.finYear || '',
        prepaidType: pd.serviceType || 'Electricity',
        cardNo: isCardPayment ? this.cardNumber().replace(/\s/g, '') : null,
        cardExpiryDate: isCardPayment ? this.formatCardExpiry(this.cardExpiry()) : null,
      })
    );
  }

  private async submitMiscPaymentItem(item: BasketItem, userId: number, ci: any, finYear: string, cardNum: string): Promise<any> {
    const md = item.miscData!;
    const vatAmount = md.isVatable ? Math.round(item.amountToPay * md.vatPercentage / (100 + md.vatPercentage) * 100) / 100 : 0;
    return await firstValueFrom(
      this.api.post('/api/platinum/billing-payment-miscellaneous/submit', {
        userId,
        cashierId: ci?.id || ci?.cashier_ID || userId,
        cashOfficeId: ci?.cashOffice_ID,
        finYear,
        miscellaneousPaymentGroup: md.groupId,
        scoaItem: md.scoaItemId,
        description: md.description || md.scoaItemName,
        lastName: md.lastName,
        initials: md.initials,
        totalAmount: item.amountToPay,
        amount: item.amountToPay - vatAmount,
        vatAmount,
        vatPercentage: md.vatPercentage,
        isVatable: md.isVatable,
        tenderAmount: item.amountToPay,
        changeAmount: 0,
        paymentType: this.getPaymentTypeId(),
        receiptDate: new Date().toISOString(),
        cardNo: cardNum,
        expiryDate: this.cardExpiry(),
        chequeNo: this.chequeNumber(),
        bankBranch: this.banks().find(b => b.bankID === this.chequeBankId())?.bankName || '',
        bankBranchCode: this.banks().find(b => b.bankID === this.chequeBankId())?.branchCode || '',
        accHolderName: this.chequeName(),
      })
    );
  }

  async searchClearance(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session.');
      return;
    }
    const id = this.clearanceSearchId().trim();
    if (!id) return;
    this.clearanceSearching.set(true);
    this.clearanceError.set('');
    try {
      const paddedId = id.padStart(12, '0');
      const [dataResult, accountsResult] = await Promise.all([
        firstValueFrom(this.api.post<any>('/api/platinum/billing-payment-clearance/get-clearance-data', { clearanceId: paddedId })),
        firstValueFrom(this.api.post<any>('/api/platinum/billing-payment-clearance/get-accounts-for-clearance', { clearanceId: paddedId, userId: this.user()?.user_ID })),
      ]);
      const dataItems = dataResult?.items || (Array.isArray(dataResult) ? dataResult : []);
      const accounts = accountsResult?.items || (Array.isArray(accountsResult) ? accountsResult : []);
      if (dataItems.length === 0 && accounts.length === 0) {
        this.clearanceError.set('No clearance certificate found.');
        return;
      }
      const info = dataItems[0] || {};
      const clearanceAccounts = accounts.map((a: any) => ({
        accountId: a.accountID || a.account_ID || 0,
        accountNumber: a.accountNumber || a.account_no || '',
        name: a.name || '',
        amount: Number(a.amount || a.outstandingAmount || 0),
        paymentAmount: Number(a.paymentAmount || a.amount || 0),
        serviceType: a.serviceType || a.description || '',
        debtType: a.debT_TYPE || a.debtType || null,
      }));
      const totalDue = clearanceAccounts.reduce((s: number, a: any) => s + a.paymentAmount, 0);

      const clearItem: BasketItem = {
        id: crypto.randomUUID(),
        type: 'clearance',
        label: `Clearance: ${paddedId}`,
        description: `${info.name || info.ownerName || ''} — ${info.propertyDesc || info.address || ''}`,
        amountDue: totalDue,
        amountToPay: totalDue,
        clearanceData: {
          clearanceId: paddedId,
          status: info.status || info.statusDesc || 'Pending',
          ownerName: info.name || info.ownerName || '',
          propertyDesc: info.propertyDesc || info.address || '',
          accounts: clearanceAccounts,
        },
      };
      this.basket.addItem(clearItem);
      this.toast.success(`Clearance ${paddedId} added to basket.`);
      this.clearanceSearchId.set('');
    } catch (e: any) {
      this.clearanceError.set(e?.error?.message || 'Clearance search failed.');
    } finally {
      this.clearanceSearching.set(false);
    }
  }

  async searchPrepaid(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session.');
      return;
    }
    const meter = this.prepaidMeterNo().trim();
    if (!meter) return;
    this.prepaidSearching.set(true);
    this.prepaidError.set('');
    this.prepaidBreakdown.set(null);
    try {
      if (!this.prepaidAmount() || this.prepaidAmount() <= 0) {
        this.prepaidError.set('Please enter a valid amount.');
        this.prepaidSearching.set(false);
        return;
      }
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/receipt-prepaid/utilipay-breakdown-request', {
          meterNumber: meter,
          amount: this.prepaidAmount(),
          serviceType: this.prepaidSelectedService() || 'Electricity',
        })
      );
      if (result && !result._error) {
        this.prepaidBreakdown.set(result);

        const prepItem: BasketItem = {
          id: crypto.randomUUID(),
          type: 'prepaid',
          label: `Prepaid: ${meter}`,
          description: `${result.units || result.kwhUnits || '?'} units`,
          amountDue: Number(result.totalAmount || result.amount || this.prepaidAmount()),
          amountToPay: Number(result.totalAmount || result.amount || this.prepaidAmount()),
          prepaidData: {
            meterNumber: meter,
            serviceType: this.prepaidSelectedService() || 'Electricity',
            breakdown: result,
            tokenResult: null,
          },
        };
        this.basket.addItem(prepItem);
        this.toast.success(`Prepaid ${meter} added to basket.`);
        this.prepaidMeterNo.set('');
        this.prepaidAmount.set(0);
      } else {
        this.prepaidError.set(result?.message || 'Could not get prepaid breakdown.');
      }
    } catch (e: any) {
      this.prepaidError.set(e?.error?.message || 'Prepaid search failed.');
    } finally {
      this.prepaidSearching.set(false);
    }
  }

  async loadPrepaidServiceTypes(): Promise<void> {
    try {
      const data: any = await firstValueFrom(
        this.api.get<any>('/api/platinum/receipt-prepaid/service-type-wise-prepaid-list')
      );
      this.prepaidServiceTypes.set(Array.isArray(data) ? data : []);
    } catch {
      this.toast.error('Failed to load prepaid service types.');
    }
  }

  async loadMiscGroups(): Promise<void> {
    this.miscGroupsLoading.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-groups')
      );
      const arr = Array.isArray(data) ? data : [];
      this.miscGroups.set(arr.map((g: any) => ({
        groupId: g.groupId || g.group_ID || g.miscellaneousPaymentGroup || g.id || 0,
        groupName: g.groupName || g.group_name || g.description || '',
        description: g.description || g.groupName || '',
      })));
    } catch {
      this.toast.error('Failed to load miscellaneous payment groups.');
    } finally {
      this.miscGroupsLoading.set(false);
    }
  }

  async onMiscGroupChange(groupId: number): Promise<void> {
    this.miscSelectedGroupId.set(groupId);
    this.miscScoaItems.set([]);
    this.miscSelectedScoaId.set(0);
    if (!groupId) return;
    this.miscScoaLoading.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-scoa-items', { groupId: String(groupId) })
      );
      const arr = Array.isArray(data) ? data : [];
      const mapped = arr.map((s: any) => ({
        scoaItemId: s.scoaItemId || s.scoa_item_ID || s.scoaItem || s.id || 0,
        scoaItemName: s.scoaItemName || s.description || s.name || '',
        description: s.description || s.scoaItemName || '',
        amount: s.amount || 0,
        isVatable: s.isVatable || false,
        vatPercentage: s.vatPercentage || 0,
      }));
      this.miscScoaItems.set(mapped);
      if (mapped.length > 0) {
        this.miscSelectedScoaId.set(mapped[0].scoaItemId);
      }
    } catch {
      this.toast.error('Failed to load SCOA items.');
    } finally {
      this.miscScoaLoading.set(false);
    }
  }

  addMiscFromTab(): void {
    if (!this.miscSelectedGroupId() || !this.miscSelectedScoaId() || this.miscAmount() <= 0) {
      this.toast.error('Select a group, item, and enter an amount.');
      return;
    }
    const group = this.miscGroups().find(g => g.groupId === this.miscSelectedGroupId());
    const scoaItem = this.miscScoaItems().find(s => s.scoaItemId === this.miscSelectedScoaId());
    if (!group || !scoaItem) return;

    const vatPct = scoaItem.vatPercentage || 0;
    const amount = this.miscAmount();
    const vatAmount = scoaItem.isVatable ? Math.round(amount * vatPct / (100 + vatPct) * 100) / 100 : 0;

    const item: BasketItem = {
      id: crypto.randomUUID(),
      type: 'misc',
      label: `${group.groupName} — ${scoaItem.scoaItemName}`,
      description: this.miscDescription() || scoaItem.scoaItemName,
      amountDue: amount,
      amountToPay: amount,
      miscData: {
        groupId: group.groupId,
        groupName: group.groupName,
        scoaItemId: scoaItem.scoaItemId,
        scoaItemName: scoaItem.scoaItemName,
        lastName: this.miscLastName(),
        initials: this.miscInitials(),
        description: this.miscDescription() || scoaItem.scoaItemName,
        isVatable: scoaItem.isVatable,
        vatPercentage: vatPct,
        vatAmount,
      },
    };
    this.basket.addItem(item);
    this.toast.success(`Added misc: ${group.groupName}`);
    this.miscAmount.set(0);
    this.miscDescription.set('');
    this.miscLastName.set('');
    this.miscInitials.set('');
  }

  async printReceipt(): Promise<void> {
    const results = this.receiptResults();
    if (!results.length) return;
    this.printingReceipt.set(true);
    try {
      const receiptIds = results.map(r => {
        const raw = r.rawResponse;
        return raw?.receiptSerialNo || raw?.receipt_serial_no || raw?.receiptId || raw?.receipt_ID || 0;
      }).filter((id: number) => id > 0);

      const receiptNos = results.map(r => r.receiptNumber).filter(n => n && n !== 'N/A');

      if (receiptIds.length === 0 && receiptNos.length === 0) {
        this.toast.error('No valid receipt IDs to print.');
        this.printingReceipt.set(false);
        return;
      }

      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment/print-receipt', {
          ids: receiptIds.length > 0 ? receiptIds : [0],
          receiptNos,
          isReprint: false,
        })
      );

      if (result instanceof Blob) {
        const url = URL.createObjectURL(result);
        window.open(url, '_blank');
      } else if (result?.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
      this.toast.success('Receipt(s) sent to printer.');
    } catch {
      this.toast.error('Failed to print receipt(s).');
    } finally {
      this.printingReceipt.set(false);
    }
  }

  async sendReceiptVia(method: ReceiptDeliveryMethod): Promise<void> {
    this.receiptDeliveryMethod.set(method);
    if (method === 'print') {
      await this.printReceipt();
      return;
    }
    if ((method === 'email' && !this.receiptEmail()) ||
        ((method === 'whatsapp' || method === 'sms') && !this.receiptPhone())) {
      this.toast.error(method === 'email' ? 'Enter an email address.' : 'Enter a phone number.');
      return;
    }

    this.sendingReceipt.set(true);
    try {
      const results = this.receiptResults();
      for (const r of results) {
        await firstValueFrom(
          this.api.post('/api/platinum/billing-payment/send-receipt', {
            receiptNo: r.receiptNumber,
            method,
            email: this.receiptEmail(),
            phone: this.receiptPhone(),
            userId: this.user()?.user_ID,
          })
        );
      }
      this.toast.success(`Receipt(s) sent via ${method}.`);
    } catch {
      this.toast.error(`Failed to send receipt via ${method}.`);
    } finally {
      this.sendingReceipt.set(false);
    }
  }

  closeReceipt(): void {
    this.showReceipt.set(false);
    this.receiptResults.set([]);
    this.receiptEmail.set('');
    this.receiptPhone.set('');
  }

  openCancelDialog(): void {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session.');
      return;
    }
    this.cancelReceiptNo.set('');
    this.cancelReason.set('');
    this.showCancelDialog.set(true);
  }

  closeCancelDialog(): void {
    this.showCancelDialog.set(false);
  }

  async submitCancelRequest(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session.');
      return;
    }
    if (!this.cancelReceiptNo()) {
      this.toast.error('Enter a receipt number to cancel.');
      return;
    }
    if (!this.cancelReason().trim()) {
      this.toast.error('Please provide a reason for cancellation.');
      return;
    }
    this.cancellingReceipt.set(true);
    try {
      await firstValueFrom(
        this.api.post('/api/platinum/auth-day-end/request-cancel-receipt', {
          receiptNo: this.cancelReceiptNo(),
          reason: this.cancelReason(),
          userId: this.user()?.user_ID,
        })
      );
      this.toast.success('Cancellation request submitted for supervisor approval.');
      this.showCancelDialog.set(false);
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Cancellation request failed.');
    } finally {
      this.cancellingReceipt.set(false);
    }
  }

  openDropBoxDialog(): void {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session.');
      return;
    }
    this.dropBoxAmount.set(0);
    this.dropBoxReference.set('');
    this.showDropBoxDialog.set(true);
  }

  closeDropBoxDialog(): void {
    this.showDropBoxDialog.set(false);
  }

  async submitDropBox(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session.');
      return;
    }
    if (this.dropBoxAmount() <= 0) {
      this.toast.error('Enter an amount for the drop box.');
      return;
    }
    this.submittingDropBox.set(true);
    try {
      await firstValueFrom(
        this.api.post('/api/platinum/drop-box/submit', {
          amount: this.dropBoxAmount(),
          description: this.dropBoxReference() || 'Cash Drop',
          userId: this.user()?.user_ID,
          finYear: this.cashierInfo()?.finYear || this.user()?.finYear || '',
          paymentType: 1,
        })
      );
      this.toast.success('Cash drop recorded successfully.');
      this.showDropBoxDialog.set(false);
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Drop box submission failed.');
    } finally {
      this.submittingDropBox.set(false);
    }
  }

  navigateToCashierSetup(): void {
    this.router.navigate(['/cashier-setup']);
  }

  navigateToDayEnd(): void {
    this.router.navigate(['/cashier-day-end']);
  }

  navigateToEnquiries(): void {
    this.router.navigate(['/enquiries']);
  }

  formatCurrency(amount: number): string {
    if (isNaN(amount)) return '0.00';
    return amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getReceiptNo(data: any): string {
    return data?.receiptNumber || data?.receipt_no || data?.receiptNo || data?.ReceiptNo || 'N/A';
  }

  getAccountNo(r: any): string {
    return r?.accountNo || r?.accountNumber || r?.account_no || '';
  }

  getAccountName(r: any): string {
    return r?.name || r?.accountName || r?.consumerName || r?.surname_Company || '';
  }

  getAccountBalance(r: any): number {
    return Number(r?.outstandingAmount || r?.outStandingAmt || r?.balance || r?.totalDue || 0);
  }

  getAccountAddress(r: any): string {
    return r?.address || r?.physicalAddress || r?.deliveryAddress || '';
  }

  getAccountStatus(r: any): string {
    return r?.status || r?.accountStatus || r?.statusDesc || 'Active';
  }

  getAccountId(r: any): number {
    return r?.account_ID || r?.accountID || r?.accountId || 0;
  }

  getTypeColor(type: BasketItemType): string {
    const colors: Record<BasketItemType, string> = {
      account: '#2563eb',
      clearance: '#16a34a',
      prepaid: '#d97706',
      misc: '#7c3aed',
    };
    return colors[type];
  }

  getTypeOrder(type: BasketItemType): number {
    return PROCESSING_ORDER[type];
  }

  getTypeSubtotal(type: string): number {
    const items = this.basket.itemsByType()[type as BasketItemType] || [];
    return items.reduce((sum: number, item: BasketItem) => sum + item.amountToPay, 0);
  }

  absVal(n: number): number {
    return Math.abs(n);
  }

  openCsvImport(): void {
    this.csvImportOpen.set(true);
    this.csvStep.set('upload');
    this.csvFileName.set('');
    this.csvParsedRows.set([]);
    this.csvValidatedRows.set([]);
    this.csvValidating.set(false);
    this.csvValidationProgress.set(0);
    this.csvCancelled.set(false);
    this.csvPage.set(1);
  }

  closeCsvImport(): void {
    this.csvCancelled.set(true);
    this.csvImportOpen.set(false);
    this.csvValidating.set(false);
  }

  triggerCsvFileInput(): void {
    this.csvFileInput?.nativeElement?.click();
  }

  onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
      this.toast.error('Please select a CSV or text file (.csv, .txt)');
      return;
    }

    this.csvFileName.set(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        this.toast.error('Could not read file');
        return;
      }
      this.parseCsvContent(text);
    };
    reader.onerror = () => {
      this.toast.error('Failed to read file');
    };
    reader.readAsText(file);

    input.value = '';
  }

  private parseCsvContent(text: string): void {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) {
      this.toast.error('File is empty');
      return;
    }

    let delimiter = ',';
    if (lines[0].includes(';') && !lines[0].includes(',')) delimiter = ';';
    else if (lines[0].includes('\t') && !lines[0].includes(',')) delimiter = '\t';

    const allRows = lines.map(line => line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));

    const firstCols = allRows[0].map(c => c.toLowerCase());
    const hasHeader = firstCols.some(c => /^(account|acc|accno|account.?n)/.test(c))
      && firstCols.some(c => /^(amount|amt|value|total|pay)/.test(c));

    const dataRows = hasHeader ? allRows.slice(1) : allRows;

    let accColIdx = 0;
    let amtColIdx = 1;
    let dateColIdx = -1;

    if (hasHeader) {
      accColIdx = firstCols.findIndex(c => /^(account|acc|accno|account.?n)/.test(c));
      amtColIdx = firstCols.findIndex(c => /^(amount|amt|value|total|pay)/.test(c));
      dateColIdx = firstCols.findIndex(c => /^(date|receipt.?date|trans.?date)/.test(c));
      if (accColIdx < 0) accColIdx = 0;
      if (amtColIdx < 0) amtColIdx = 1;
    }

    const parsed: CsvImportRow[] = [];
    for (const cols of dataRows) {
      if (cols.length < 2) continue;
      const rawAccNo = (cols[accColIdx] || '').replace(/\s/g, '');
      const rawAmt = (cols[amtColIdx] || '').replace(/\s/g, '').replace(/^R/i, '');
      const rawDate = dateColIdx >= 0 ? (cols[dateColIdx] || '') : '';

      if (!rawAccNo) continue;
      const amount = parseFloat(rawAmt);
      if (isNaN(amount) || amount <= 0) continue;

      parsed.push({
        accountNo: rawAccNo,
        amount,
        receiptDate: rawDate,
        raw: cols.join(', '),
      });
    }

    if (parsed.length === 0) {
      this.toast.error('No valid rows found. Ensure your file has Account Number and Amount columns.');
      return;
    }

    this.csvParsedRows.set(parsed);
    this.csvStep.set('preview');
    this.csvPage.set(1);
    this.toast.success(`Parsed ${parsed.length} row(s) from ${this.csvFileName()}`);
  }

  async csvValidateAccounts(): Promise<void> {
    const parsed = this.csvParsedRows();
    if (parsed.length === 0) return;

    this.csvCancelled.set(false);
    this.csvValidating.set(true);
    this.csvValidationProgress.set(0);
    this.csvStep.set('validate');

    const validated: CsvValidatedRow[] = parsed.map(r => ({
      accountNo: r.accountNo,
      amount: r.amount,
      receiptDate: r.receiptDate,
      status: 'pending' as const,
      accountId: 0,
      name: '',
      outstandingAmount: 0,
      address: '',
      errorMsg: '',
      rawApiData: null,
    }));
    this.csvValidatedRows.set([...validated]);

    const existingAccNos = new Set(
      this.basket.items()
        .filter(i => i.type === 'account' && i.accountData)
        .map(i => i.accountData!.accountNumber)
    );

    const seenInFile = new Set<string>();
    for (let k = 0; k < validated.length; k++) {
      const key = validated[k].accountNo;
      if (existingAccNos.has(key)) {
        validated[k].status = 'duplicate';
        validated[k].errorMsg = 'Already in basket';
      } else if (seenInFile.has(key)) {
        validated[k].status = 'duplicate';
        validated[k].errorMsg = 'Duplicate in file';
      }
      seenInFile.add(key);
    }
    this.csvValidatedRows.set([...validated]);

    const batchSize = 5;
    let completed = 0;

    for (let i = 0; i < validated.length; i += batchSize) {
      if (this.csvCancelled()) break;

      const batch = validated.slice(i, Math.min(i + batchSize, validated.length));
      const lookups = batch.map(async (row, batchIdx) => {
        const idx = i + batchIdx;
        if (this.csvCancelled()) return;

        if (validated[idx].status === 'duplicate') return;

        validated[idx].status = 'validating';
        this.csvValidatedRows.set([...validated]);

        try {
          const searchResults: any = await firstValueFrom(
            this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: row.accountNo })
          );
          const items = Array.isArray(searchResults) ? searchResults : searchResults?.value || [];

          if (items.length === 0) {
            validated[idx].status = 'not_found';
            validated[idx].errorMsg = 'Account not found in Platinum';
            return;
          }

          const acct = items[0];
          const accountId = acct.account_ID || acct.accountID || acct.accountId || 0;
          const accountNo = acct.accountNumber || acct.accountNo || row.accountNo;

          let detailData: any = null;
          try {
            detailData = await firstValueFrom(
              this.api.get('/api/platinum/receipt-prepaid/cons-account-details', { accountId: String(accountId || accountNo) })
            );
          } catch {
          }

          const merged = { ...acct, ...(detailData && !detailData._error ? detailData : {}) };

          validated[idx].status = 'found';
          validated[idx].accountId = accountId;
          validated[idx].name = merged.name || merged.accountName || merged.consumerName || merged.surname_Company ||
            [merged.initials, merged.lastName].filter(Boolean).join(' ') || '';
          validated[idx].outstandingAmount = Number(merged.outstandingAmount || merged.outStandingAmt || merged.balance || merged.totalDue || 0);
          validated[idx].address = merged.address || merged.physicalAddress || merged.deliveryAddress || '';
          validated[idx].rawApiData = merged;
        } catch (e: any) {
          validated[idx].status = 'error';
          validated[idx].errorMsg = e?.error?.message || e?.message || 'API validation failed';
        }
      });

      await Promise.all(lookups);
      completed += batch.length;
      this.csvValidationProgress.set(Math.round((completed / validated.length) * 100));
      this.csvValidatedRows.set([...validated]);
    }

    this.csvValidating.set(false);
    if (!this.csvCancelled()) {
      this.csvStep.set('done');
      const found = validated.filter(r => r.status === 'found').length;
      this.toast.success(`Validation complete: ${found} of ${validated.length} account(s) found`);
    }
  }

  csvCancelValidation(): void {
    this.csvCancelled.set(true);
  }

  csvAddToBasket(): void {
    const validRows = this.csvValidatedRows().filter(r => r.status === 'found');
    if (validRows.length === 0) {
      this.toast.error('No valid accounts to add');
      return;
    }

    let addedCount = 0;
    const existingAccNos = new Set(
      this.basket.items()
        .filter(i => i.type === 'account' && i.accountData)
        .map(i => i.accountData!.accountNumber)
    );

    for (const row of validRows) {
      const accNo = row.rawApiData?.accountNumber || row.rawApiData?.accountNo || row.accountNo;
      if (existingAccNos.has(accNo)) continue;

      const merged = row.rawApiData || {};
      const meterNo = merged.meterNo || merged.prepaidMeterNo || merged.meter_No || '';

      const item: BasketItem = {
        id: crypto.randomUUID(),
        type: 'account',
        label: row.name,
        description: `${accNo} — ${row.address}`,
        amountDue: row.outstandingAmount,
        amountToPay: row.amount,
        accountData: {
          accountId: row.accountId,
          accountNumber: accNo,
          name: row.name,
          address: row.address,
          billId: merged.billId || merged.bill_ID || 0,
          cutOffID: merged.cutOffID || merged.cutoff_ID || 0,
          cutOffAmount: merged.cutOffAmount || 0,
          debtAmount: merged.debtAmount || 0,
          debtArrangementId: merged.debtArrangementId || merged.debtArrangement_ID || 0,
          sundryDebtorsId: merged.sundryDebtorsId || merged.sundryDebtors_ID || 0,
          billingCycleId: merged.billingCycleId || merged.billingCycle_ID || 0,
          hasPrepaidMeter: !!meterNo,
          prepaidMeterNo: meterNo,
          originalData: merged,
        },
      };

      this.basket.addItem(item);
      existingAccNos.add(accNo);
      addedCount++;
    }

    this.toast.success(`Added ${addedCount} account(s) to basket with pre-filled amounts`);
    this.closeCsvImport();
  }

  csvDownloadTemplate(): void {
    const template = 'AccountNumber,Amount,ReceiptDate\n001234567,150.00,\n009876543,250.50,\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pos_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  csvChangeFile(): void {
    this.csvStep.set('upload');
    this.csvParsedRows.set([]);
    this.csvValidatedRows.set([]);
    this.csvPage.set(1);
  }

  getCsvPreviewPage(): CsvImportRow[] {
    const start = (this.csvPage() - 1) * this.csvPageSize;
    return this.csvParsedRows().slice(start, start + this.csvPageSize);
  }

  getCsvValidatedPage(): CsvValidatedRow[] {
    const start = (this.csvPage() - 1) * this.csvPageSize;
    return this.csvValidatedRows().slice(start, start + this.csvPageSize);
  }

  csvTotalPages(): number {
    const rows = this.csvStep() === 'preview' ? this.csvParsedRows() : this.csvValidatedRows();
    return Math.max(1, Math.ceil(rows.length / this.csvPageSize));
  }

  csvPrevPage(): void {
    if (this.csvPage() > 1) this.csvPage.update(p => p - 1);
  }

  csvNextPage(): void {
    if (this.csvPage() < this.csvTotalPages()) this.csvPage.update(p => p + 1);
  }

  formatDate(val: string | null): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch { return val; }
  }
}
