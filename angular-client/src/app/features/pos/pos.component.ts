import { Component, signal, computed, OnInit, OnDestroy, inject, ElementRef, ViewChild, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { PosBasketService } from '../../services/pos-basket.service';
import { EnquiriesGeneralComponent } from '../enquiries/enquiries-general.component';
import { firstValueFrom } from 'rxjs';
import {
  BasketItem,
  BasketItemType,
  MiscTenderType,
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
  imports: [CommonModule, FormsModule, EnquiriesGeneralComponent],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})
export class PosComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);
  basket = inject(PosBasketService);

  @Output() dayEndRequested = new EventEmitter<void>();

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
  tenderOrderExpanded = signal(true);
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
  sessionCashOfficeName = signal('');
  showReceipt = signal(false);
  printingReceipt = signal(false);
  receiptDeliveryMethod = signal<ReceiptDeliveryMethod>('print');
  receiptEmail = signal('');
  receiptPhone = signal('');
  sendingReceipt = signal(false);

  paymentProgressTotal = signal(0);
  paymentProgressCurrent = signal(0);
  paymentProgressLabel = signal('');

  showClearConfirm = signal(false);

  showCancelDialog = signal(false);
  cancelReceiptNo = signal('');
  cancelReason = signal('');
  cancellingReceipt = signal(false);

  showEnquiryOverlay = signal(false);
  showDropBoxDialog = signal(false);
  dropBoxAmount = signal(0);
  dropBoxReference = signal('');
  submittingDropBox = signal(false);
  dropBoxStep = signal<'input' | 'confirm' | 'submitting' | 'success' | 'error'>('input');
  dropBoxError = signal('');
  dropBoxReceiptNo = signal<string | null>(null);
  dropBoxHistory = signal<any[]>([]);
  dropBoxHistoryLoading = signal(false);
  showDropBoxHistory = signal(false);
  dropBoxDenominations = [
    { label: 'R200', value: 200 },
    { label: 'R100', value: 100 },
    { label: 'R50', value: 50 },
    { label: 'R20', value: 20 },
    { label: 'R10', value: 10 },
  ];

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
  miscTenderType = signal<MiscTenderType>('cash');
  miscCardNumber = signal('');
  miscCardExpiry = signal('');
  systemVatRate = signal<number>(15);

  selectedScoaItem = computed(() => {
    const id = this.miscSelectedScoaId();
    if (!id) return null;
    return this.miscScoaItems().find(s => s.scoaItemId === id) || null;
  });

  miscIsVatable = computed(() => {
    const item = this.selectedScoaItem();
    return item ? item.isVatable : false;
  });

  miscEffectiveVatPct = computed(() => {
    const item = this.selectedScoaItem();
    if (!item || !item.isVatable) return 0;
    return item.vatPercentage > 0 ? item.vatPercentage : this.systemVatRate();
  });

  miscLiveVatAmount = computed(() => {
    const amt = this.miscAmount();
    const pct = this.miscEffectiveVatPct();
    if (amt <= 0 || pct <= 0) return 0;
    return Math.round(amt * pct / (100 + pct) * 100) / 100;
  });

  miscLiveExclAmount = computed(() => {
    return Math.round((this.miscAmount() - this.miscLiveVatAmount()) * 100) / 100;
  });

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

  private readonly MAX_CHANGE = 200;

  changeAmount = computed(() => {
    const tender = this.activeTender();
    if (tender === 'card') return 0;
    const totalDue = this.basket.totalToPay();
    if (tender === 'cash+card') {
      const cashPortion = this.cashRoundedAmount();
      const cardPortion = this.cardAmount();
      const cashDue = Math.max(0, totalDue - cardPortion);
      const raw = Math.max(0, cashPortion - cashDue);
      return Math.round(raw * 100) / 100;
    }
    const raw = Math.max(0, this.cashRoundedAmount() - totalDue);
    return Math.round(raw * 100) / 100;
  });

  changeExceedsLimit = computed(() => this.changeAmount() > this.MAX_CHANGE);

  cardOverpay = computed(() => {
    const tender = this.activeTender();
    if (tender === 'card') {
      const diff = this.cardAmount() - this.basket.totalToPay();
      return diff > 0.005 ? Math.round(diff * 100) / 100 : 0;
    }
    if (tender === 'cash+card') {
      const diff = this.cardAmount() - this.basket.totalToPay();
      return diff > 0.005 ? Math.round(diff * 100) / 100 : 0;
    }
    return 0;
  });

  shortfall = computed(() => {
    const totalDue = this.basket.totalToPay();
    const tender = this.activeTender();
    if (tender === 'card') {
      const diff = totalDue - this.cardAmount();
      return diff > 0.005 ? diff : 0;
    }
    if (tender === 'cash+card') {
      const combined = this.cashRoundedAmount() + this.cardAmount();
      const diff = totalDue - combined;
      return diff > 0.005 ? diff : 0;
    }
    const diff = totalDue - this.effectiveTotalTendered();
    return diff > 0.005 ? diff : 0;
  });

  tenderValidationErrors = computed((): string[] => {
    const errors: string[] = [];
    const tender = this.activeTender();
    const totalDue = this.basket.totalToPay();

    if (totalDue <= 0) return errors;

    if (tender === 'cash') {
      if (this.cashAmount() <= 0) errors.push('Enter cash amount');
      if (this.changeAmount() > this.MAX_CHANGE)
        errors.push(`Change cannot exceed R${this.MAX_CHANGE.toFixed(2)}`);
    }

    if (tender === 'card') {
      if (this.cardAmount() <= 0) errors.push('Enter card amount');
      if (this.cardOverpay() > 0)
        errors.push('Card amount cannot exceed amount due — no change on card');
      if (this.cardAmount() > 0 && Math.abs(this.cardAmount() - totalDue) > 0.005 && this.cardAmount() < totalDue)
        errors.push(`Card underpayment: R${(totalDue - this.cardAmount()).toFixed(2)} short`);
    }

    if (tender === 'cash+card') {
      if (this.cashAmount() <= 0 && this.cardAmount() <= 0) errors.push('Enter both cash and card amounts');
      if (this.cardOverpay() > 0)
        errors.push('Card portion cannot exceed total due');
      if (this.shortfall() > 0)
        errors.push(`Combined tender is R${this.shortfall().toFixed(2)} short`);
      if (this.changeAmount() > this.MAX_CHANGE)
        errors.push(`Cash change cannot exceed R${this.MAX_CHANGE.toFixed(2)}`);
    }

    return errors;
  });

  canCompletePayment = computed(() => {
    if (this.processingPayment()) return false;
    if (this.basket.orderedItems().length === 0) return false;
    if (this.basket.totalToPay() <= 0) return false;
    if (this.tenderValidationErrors().length > 0) return false;
    if (this.shortfall() > 0) return false;
    if (this.changeExceedsLimit()) return false;
    if (this.cardOverpay() > 0) return false;
    return true;
  });

  isSplitTender = computed(() => {
    if (this.activeTender() === 'cash+card') return true;
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

  canTenderCheque = computed(() => false);

  canTenderEft = computed(() => false);

  canTenderCashCard = computed(() => this.canTenderCash() && this.canTenderCard());

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
  private searchDebounceTimer: any = null;

  ngOnInit(): void {
    this.resetAllState();
    this.loadCashierInfo();
    this.loadBanks();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.resetAllState();
  }

  private resetAllState(): void {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = null;

    this.basket.clearAll();

    this.searchMode.set('unified');
    this.activeMode.set('account');
    this.unifiedSearchQuery.set('');
    this.unifiedSearchLoading.set(false);
    this.unifiedSearchResults.set([]);
    this.unifiedSearchActive.set(false);
    this.tabSearchQuery.set('');
    this.tabSearchLoading.set(false);
    this.tabSearchResults.set([]);
    this.tabSearchActive.set(false);
    this.accountDetailLoading.set(false);

    this.showPaymentPanel.set(false);
    this.tenderOrderExpanded.set(true);
    this.activeTender.set('cash');
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
    this.processingPayment.set(false);

    this.receiptResults.set([]);
    this.showReceipt.set(false);
    this.printingReceipt.set(false);
    this.receiptDeliveryMethod.set('print');
    this.receiptEmail.set('');
    this.receiptPhone.set('');
    this.sendingReceipt.set(false);

    this.paymentProgressTotal.set(0);
    this.paymentProgressCurrent.set(0);
    this.paymentProgressLabel.set('');

    this.showCancelDialog.set(false);
    this.cancelReceiptNo.set('');
    this.cancelReason.set('');
    this.cancellingReceipt.set(false);

    this.showEnquiryOverlay.set(false);
    this.showDropBoxDialog.set(false);
    this.dropBoxAmount.set(0);
    this.dropBoxReference.set('');
    this.submittingDropBox.set(false);
    this.dropBoxStep.set('input');
    this.dropBoxError.set('');
    this.dropBoxReceiptNo.set(null);
    this.dropBoxHistory.set([]);
    this.dropBoxHistoryLoading.set(false);
    this.showDropBoxHistory.set(false);

    this.clearanceSearchId.set('');
    this.clearanceSearching.set(false);
    this.clearanceError.set('');

    this.prepaidMeterNo.set('');
    this.prepaidAmount.set(0);
    this.prepaidSearching.set(false);
    this.prepaidBreakdown.set(null);
    this.prepaidError.set('');
    this.prepaidProcessing.set(false);
    this.prepaidServiceTypes.set([]);
    this.prepaidSelectedService.set('');

    this.miscSelectedGroupId.set(0);
    this.miscScoaItems.set([]);
    this.miscScoaLoading.set(false);
    this.miscSelectedScoaId.set(0);
    this.miscAmount.set(0);
    this.miscDescription.set('');
    this.miscLastName.set('');
    this.miscInitials.set('');
    this.miscTenderType.set('cash');
    this.miscCardNumber.set('');
    this.miscCardExpiry.set('');

    this.accountGroupSearching.set(false);
    this.accountGroupResults.set([]);
    this.expandedGroupId.set(null);
    this.groupAccountsLoading.set(false);

    this.csvImportOpen.set(false);
    this.csvStep.set('upload');
    this.csvFileName.set('');
    this.csvParsedRows.set([]);
    this.csvValidatedRows.set([]);
    this.csvValidating.set(false);
    this.csvValidationProgress.set(0);
    this.csvCancelled.set(false);
    this.csvPage.set(1);

    this.banks.set([]);
    this.banksLoading.set(false);
    this.miscGroups.set([]);
    this.miscGroupsLoading.set(false);
    this.systemVatRate.set(15);
    this.paymentOptions.set([]);
    this.paymentTypes.set([]);
    this.cashierInfo.set(null);
    this.sessionActive.set(false);
    this.sessionLoading.set(true);
    this.sessionStatus.set('none');
    this.reconcileMessage.set('');
    this.sessionReturnReason.set('');
    this.receiptRange.set(null);

    this.cashierCheckDone = false;
  }

  onUnifiedSearchInput(value: string): void {
    this.unifiedSearchQuery.set(value);
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    const trimmed = value.trim();
    if (!trimmed) {
      this.unifiedSearchResults.set([]);
      this.unifiedSearchActive.set(false);
      this.expandedGroupId.set(null);
      return;
    }
    if (trimmed.length < 3 || !this.sessionActive()) {
      return;
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.unifiedSearch();
    }, 400);
  }

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
      if (cashierInfoObj.cashOfficeDesc) {
        this.sessionCashOfficeName.set(cashierInfoObj.cashOfficeDesc);
      }

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

      const cachedMiscGroups = this.miscGroups().length > 0
        ? Promise.resolve(this.miscGroups())
        : firstValueFrom(this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-groups'));

      const [accountData, groupData, miscData] = await Promise.allSettled([
        firstValueFrom(this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: query, _t: Date.now() })),
        firstValueFrom(this.api.post('/api/platinum/billing-payment/search-account-groups', { searchTerm: query })),
        cachedMiscGroups,
      ]);

      if (accountData.status === 'fulfilled') {
        let accts = Array.isArray(accountData.value) ? accountData.value : (accountData.value as any)?.accounts || (accountData.value as any)?.results || (accountData.value as any)?.data || [];
        if (/^\d+$/.test(query)) {
          const queryStripped = query.replace(/^0+/, '') || '0';
          const exactMatches = accts.filter((a: any) => {
            const acctNo = String(a.accountNo || a.accountNumber || a.accountID || '');
            const acctStripped = acctNo.replace(/^0+/, '') || '0';
            return acctStripped === queryStripped;
          });
          if (exactMatches.length > 0) {
            accts = exactMatches;
          }
        }
        for (const a of accts) {
          const meterNo = a.physicalMeterNo || a.prepaidMeterNo || a.meterNo || a.meter_No || '';
          const acctId = a.account_ID || a.accountID || a.accountId || 0;
          if (!acctId) continue;
          const isDuplicate = results.some(r => r.resultType === 'account' && r.id === acctId);
          if (isDuplicate) continue;
          const addr = (a.deliveryAddress || a.streetName || a.address || a.physicalAddress || a.locationAddress || '').replace(/\r\n/g, ', ').replace(/,\s*$/, '');
          const acctNo = a.accountNo || a.accountNumber || a.accountID || '';
          const acctStatus = a.statusDesc || a.status || a.accountStatus || '';
          const meterServiceType = a.meterServiceType || a.serviceType || a.prepaidType || '';
          const isWaterMeter = /water/i.test(meterServiceType) || /^0[12]/i.test(meterNo);
          const prepaidTypeLabel = meterNo ? (isWaterMeter ? 'Water' : 'Electricity') : '';
          results.push({
            resultType: 'account',
            id: acctId,
            label: a.name || a.accountName || a.consumerName || a.surname_Company || a.fullNAME || '',
            description: `${acctNo} — ${addr || 'No address on file'}`,
            balance: Number(a.outstandingAmount || a.outStandingAmt || a.outStandingAmount || a.balance || a.totalDue || 0),
            status: acctStatus || 'Active',
            rawData: { ...a, hasPrepaidMeter: !!meterNo, prepaidMeterNo: meterNo, prepaidType: prepaidTypeLabel, address: addr, accountStatus: acctStatus },
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
        const rawMisc = miscData.value;
        const groups = Array.isArray(rawMisc) ? rawMisc : (rawMisc?.data || rawMisc?.groups || []);
        const queryLower = query.toLowerCase();
        for (const g of groups) {
          const name = g.groupName || g.group_name || g.name || g.description || '';
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
      this.clearUnifiedSearch();
    } else if (result.resultType === 'group') {
      await this.loadGroupAccounts(result);
    } else if (result.resultType === 'misc') {
      await this.addMiscToBasket(result.rawData);
      this.clearUnifiedSearch();
    } else if (result.resultType === 'prepaid') {
      this.addPrepaidPlaceholder(result.rawData.meterNumber);
      this.clearUnifiedSearch();
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

    const searchBalance = Number(acctData.outStandingAmt ?? acctData.outstandingAmount ?? acctData.balance ?? acctData.totalDue ?? 0);
    console.log(`[addAccountToBasket] Account ${accountNo} search balance: ${searchBalance}`);

    this.accountDetailLoading.set(true);
    let detailData: any = null;
    try {
      detailData = await firstValueFrom(
        this.api.get<any>('/api/platinum/receipt-prepaid/cons-account-details', { accountId: String(accountId || accountNo), _t: String(Date.now()) })
      );
    } catch {
      this.toast.show('Could not load full account details, using search data.', 'info');
    }
    this.accountDetailLoading.set(false);

    const merged = { ...acctData, ...(detailData && !detailData._error ? detailData : {}) };
    const detailBalance = detailData && !detailData._error ? Number(detailData.outStandingAmt ?? detailData.outstandingAmount ?? 0) : null;
    const accountBalance = searchBalance || detailBalance || 0;
    console.log(`[addAccountToBasket] Account ${accountNo} detail balance: ${detailBalance}, using balance: ${accountBalance}`);

    const balance = accountBalance;
    const name = merged.name || merged.accountName || merged.consumerName || merged.surname_Company || '';
    const address = (merged.deliveryAddress || merged.streetName || merged.address || merged.physicalAddress || merged.locationAddress || '').replace(/\r\n/g, ', ').replace(/,\s*$/, '');
    const meterNo = merged.physicalMeterNo || merged.prepaidMeterNo || merged.meterNo || merged.meter_No || '';
    const meterSvcType = merged.meterServiceType || merged.serviceType || merged.prepaidType || '';
    const isWater = /water/i.test(meterSvcType) || /^0[12]/i.test(meterNo);
    const prepaidType = meterNo ? (isWater ? 'Water' : 'Electricity') : '';

    console.log(`[addAccountToBasket] Merged data keys:`, Object.keys(merged).join(', '));
    console.log(`[addAccountToBasket] Merged data (truncated):`, JSON.stringify(merged).substring(0, 2000));
    const idNumber = merged.idNumber || merged.identityNo || merged.identity_no || merged.id_number || merged.idNo || '';
    const registrationNumber = merged.registrationNo || merged.registration_no || merged.companyRegistrationNo || merged.compRegNo || '';
    const sgNumber = merged.sgNumber || merged.sg_number || merged.sgNo || merged.surveyorGeneralNo || merged.sg_Number || '';
    const erfNumber = merged.erfNo || merged.erf_no || merged.erfNumber || merged.standNo || merged.stand_no || merged.standNumber || '';
    const ward = merged.ward || merged.wardDesc || merged.ward_desc || '';
    const suburb = merged.suburb || merged.suburbDesc || merged.suburb_desc || merged.suburbName || '';
    const locationAddress = merged.locationAddress || merged.location_address || merged.propertyAddress || merged.propertyDesc || '';
    console.log(`[addAccountToBasket] Extracted — id:${idNumber}, reg:${registrationNumber}, sg:${sgNumber}, erf:${erfNumber}, ward:${ward}, suburb:${suburb}, loc:${locationAddress}`);

    const item: BasketItem = {
      id: crypto.randomUUID(),
      type: 'account',
      label: name,
      description: `${accountNo} — ${address || locationAddress || 'No address on file'}`,
      amountDue: balance,
      amountToPay: 0,
      accountData: {
        accountId,
        accountNumber: accountNo,
        name,
        address,
        accountStatus: merged.statusDesc || merged.status || merged.accountStatus || 'Active',
        billId: merged.billId || merged.bill_ID || 0,
        cutOffID: merged.cutOffID || merged.cutoff_ID || 0,
        cutOffAmount: merged.cutOffAmount || 0,
        debtAmount: merged.debtAmount || 0,
        debtArrangementId: merged.debtArrangementId || merged.debtArrangement_ID || 0,
        sundryDebtorsId: merged.sundryDebtorsId || merged.sundryDebtors_ID || 0,
        billingCycleId: merged.billingCycleId || merged.billingCycle_ID || 0,
        hasPrepaidMeter: !!meterNo,
        prepaidMeterNo: meterNo,
        prepaidType,
        accountBalance,
        idNumber,
        registrationNumber,
        sgNumber,
        erfNumber,
        locationAddress: locationAddress || address,
        ward,
        suburb,
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
          accountStatus: acct.statusDesc || acct.status || acct.accountStatus || 'Active',
          billId: acct.billId || acct.bill_ID || 0,
          cutOffID: acct.cutOffID || acct.cutoff_ID || 0,
          cutOffAmount: acct.cutOffAmount || 0,
          debtAmount: acct.debtAmount || 0,
          debtArrangementId: acct.debtArrangementId || 0,
          sundryDebtorsId: acct.sundryDebtorsId || 0,
          billingCycleId: acct.billingCycleId || 0,
          hasPrepaidMeter: !!meterNo,
          prepaidMeterNo: meterNo,
          prepaidType: '',
          accountBalance: balance,
          originalData: acct,
        },
      });
      addedCount++;
    }
    this.toast.success(`Added ${addedCount} account(s) to basket.`);
    this.clearUnifiedSearch();
  }

  async addGroupAccountAndClear(acctData: any): Promise<void> {
    await this.addAccountToBasket(acctData);
    this.clearUnifiedSearch();
  }

  async addMiscToBasket(groupData: any): Promise<void> {
    const groupId = groupData.groupId || groupData.group_ID || groupData.miscellaneousPaymentGroup || groupData.id || 0;
    const groupName = groupData.groupName || groupData.group_name || groupData.name || groupData.description || '';

    if (this.miscGroups().length === 0) {
      await this.loadMiscGroups();
    }
    this.searchMode.set('tabs');
    this.activeMode.set('misc');
    this.miscSelectedGroupId.set(groupId);
    this.clearUnifiedSearch();
    await this.onMiscGroupChange(groupId);
    this.toast.success(`Switched to Misc tab — "${groupName}" selected. Enter amount and add to basket.`);
    return;

    let scoaItems: ScoaItem[] = [];
    try {
      const data: any = await firstValueFrom(
        this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-scoa-items', { mISCPayGroupId: String(groupId) })
      );
      const arr = Array.isArray(data) ? data : (data?.data || data?.items || []);
      const sysVat = this.systemVatRate();
      scoaItems = arr.map((s: any) => {
        const rawName = s.scoaItemName || s.description || s.name || '';
        const codeMatch = rawName.match(/\s+([A-Z]{2}\d{30,})\s*$/);
        const scoaCode = codeMatch ? codeMatch[1] : '';
        const descPart = codeMatch ? rawName.replace(codeMatch[0], '').trim() : rawName;
        const displayName = scoaCode ? `${scoaCode} — ${descPart}` : descPart || rawName;
        const itemVatable = s.isVatable || false;
        const rawPct = Number(s.vatPercentage) || 0;
        const effectivePct = itemVatable && rawPct <= 0 ? sysVat : rawPct;
        return {
          scoaItemId: s.scoaItemId || s.scoa_item_ID || s.scoaItem || s.id || 0,
          scoaItemName: displayName,
          description: s.description || rawName,
          amount: s.amount || 0,
          isVatable: itemVatable,
          vatPercentage: effectivePct,
        };
      });
    } catch {
      this.toast.error('Failed to load SCOA items for this group.');
      return;
    }

    const scoaItem = scoaItems[0];
    if (!scoaItem) {
      this.toast.error('No SCOA items found for this group.');
      return;
    }

    const amount = scoaItem.amount || 0;
    const vatPct = scoaItem.vatPercentage || 0;
    const vatAmount = scoaItem.isVatable && vatPct > 0 ? Math.round(amount * vatPct / (100 + vatPct) * 100) / 100 : 0;

    const item: BasketItem = {
      id: crypto.randomUUID(),
      type: 'misc',
      label: `${groupName} — ${scoaItem.scoaItemName}`,
      description: 'Miscellaneous payment',
      amountDue: amount,
      amountToPay: amount,
      miscData: {
        groupId,
        groupName,
        scoaItemId: scoaItem.scoaItemId,
        scoaItemName: scoaItem.scoaItemName,
        lastName: '',
        initials: '',
        description: scoaItem.scoaItemName,
        isVatable: scoaItem.isVatable,
        vatPercentage: vatPct,
        vatAmount,
        tenderType: 'cash',
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
      const [accountData, groupData] = await Promise.allSettled([
        firstValueFrom(this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: query })),
        firstValueFrom(this.api.post('/api/platinum/billing-payment/search-account-groups', { searchTerm: query })),
      ]);

      const combined: any[] = [];
      const seenIds = new Set<number>();

      if (accountData.status === 'fulfilled') {
        let accts = Array.isArray(accountData.value) ? accountData.value : (accountData.value as any)?.accounts || (accountData.value as any)?.results || (accountData.value as any)?.data || [];
        if (/^\d+$/.test(query)) {
          const queryStripped = query.replace(/^0+/, '') || '0';
          const exactMatches = accts.filter((a: any) => {
            const acctNo = String(a.accountNo || a.accountNumber || a.accountID || '');
            return (acctNo.replace(/^0+/, '') || '0') === queryStripped;
          });
          if (exactMatches.length > 0) accts = exactMatches;
        }
        for (const a of accts) {
          const id = a.account_ID || a.accountID || a.accountId || 0;
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);
          combined.push(a);
        }
      }

      if (groupData.status === 'fulfilled') {
        const groups = Array.isArray(groupData.value) ? groupData.value : (groupData.value as any)?.groups || (groupData.value as any)?.data || (groupData.value as any)?.institutions || [];
        for (const g of groups) {
          const groupAccounts = g.accounts || [];
          for (const a of groupAccounts) {
            const id = a.account_ID || a.accountID || a.accountId || 0;
            if (!id || seenIds.has(id)) continue;
            seenIds.add(id);
            combined.push(a);
          }
        }
      }

      this.tabSearchResults.set(combined);
      if (combined.length === 0) {
        this.toast.show('No accounts found for your search.', 'info');
      }
    } catch {
      this.tabSearchResults.set([]);
      this.toast.error('Search failed. Please try again.');
    } finally {
      this.tabSearchLoading.set(false);
    }
  }

  onTabSearchInput(value: string): void {
    this.tabSearchQuery.set(value);
    if (!value.trim()) {
      this.tabSearchResults.set([]);
      this.tabSearchActive.set(false);
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
    const zeroItems = this.basket.orderedItems().filter(i => i.amountToPay <= 0);
    if (zeroItems.length > 0) {
      this.toast.error('Every item needs a positive amount before you can proceed.');
      return;
    }
    this.resetTenderFields();
    const total = this.basket.totalToPay();
    const items = this.basket.orderedItems();

    const miscItems = items.filter(i => i.type === 'misc' && i.miscData);
    const nonMiscItems = items.filter(i => i.type !== 'misc');
    const miscCardItems = miscItems.filter(i => i.miscData!.tenderType === 'card');
    const miscCashItems = miscItems.filter(i => i.miscData!.tenderType === 'cash');
    const miscCardTotal = miscCardItems.reduce((s, i) => s + i.amountToPay, 0);
    const miscCashTotal = miscCashItems.reduce((s, i) => s + i.amountToPay, 0);
    const nonMiscTotal = nonMiscItems.reduce((s, i) => s + i.amountToPay, 0);

    const firstCardMisc = miscCardItems.find(i => i.miscData?.cardNumber);

    const prefillCard = () => {
      if (firstCardMisc?.miscData?.cardNumber) {
        const digits = firstCardMisc.miscData.cardNumber.replace(/\D/g, '').slice(0, 16);
        this.cardNumber.set(digits.replace(/(\d{4})(?=\d)/g, '$1 '));
        this.cardExpiry.set(firstCardMisc.miscData.cardExpiry || '');
      }
    };

    const fallbackTender = () => {
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
    };

    if (nonMiscItems.length === 0 && miscItems.length > 0) {
      if (miscCardItems.length > 0 && miscCashItems.length === 0 && this.canTenderCard()) {
        this.activeTender.set('card');
        this.cardAmount.set(total);
        prefillCard();
      } else if (miscCashItems.length > 0 && miscCardItems.length === 0 && this.canTenderCash()) {
        this.activeTender.set('cash');
        this.cashAmount.set(total);
      } else if (miscCashItems.length > 0 && miscCardItems.length > 0 && this.canTenderCashCard()) {
        this.activeTender.set('cash+card');
        this.cashAmount.set(miscCashTotal);
        this.cardAmount.set(miscCardTotal);
        prefillCard();
      } else {
        fallbackTender();
        if (this.activeTender() === 'card' || this.activeTender() === 'cash+card') prefillCard();
      }
    } else if (nonMiscItems.length > 0 && miscCardItems.length > 0) {
      if (this.canTenderCashCard()) {
        this.activeTender.set('cash+card');
        this.cashAmount.set(nonMiscTotal + miscCashTotal);
        this.cardAmount.set(miscCardTotal);
        prefillCard();
      } else if (this.canTenderCard()) {
        this.activeTender.set('card');
        this.cardAmount.set(total);
        prefillCard();
      } else {
        fallbackTender();
      }
    } else {
      fallbackTender();
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
      (type === 'eft' && this.canTenderEft()) ||
      (type === 'cash+card' && this.canTenderCashCard());
    if (!allowed) return;
    const total = this.basket.totalToPay();
    if (type === 'cash+card') {
      if (this.cashAmount() <= 0 && this.cardAmount() <= 0) {
        this.cashAmount.set(0);
        this.cardAmount.set(total);
      }
    } else if (type === 'cash') {
      this.cardAmount.set(0);
      this.cardNumber.set('');
      this.cardExpiry.set('');
      this.cashAmount.set(total);
    } else if (type === 'card') {
      this.cashAmount.set(0);
      this.cardAmount.set(total);
    }
    this.activeTender.set(type);
  }

  onCashCardCashChange(val: number): void {
    this.cashAmount.set(val);
    const remaining = Math.max(0, this.basket.totalToPay() - (val > 0 ? this.basket.roundToNearest10c(val) : 0));
    this.cardAmount.set(Math.round(remaining * 100) / 100);
  }

  onCashCardCardChange(val: number): void {
    const capped = Math.max(0, Math.min(val, this.basket.totalToPay()));
    this.cardAmount.set(capped);
    const remaining = Math.max(0, this.basket.totalToPay() - capped);
    const rounded = this.basket.roundToNearest10c(remaining);
    this.cashAmount.set(rounded);
  }

  addDenominationCashCard(value: number): void {
    const newCash = Math.round((this.cashAmount() + value) * 100) / 100;
    this.onCashCardCashChange(newCash);
  }

  onCardOnlyAmountChange(val: number): void {
    const max = this.basket.totalToPay();
    this.cardAmount.set(Math.max(0, Math.min(val, max)));
  }

  addDenomination(value: number): void {
    this.cashAmount.update(v => Math.round((v + value) * 100) / 100);
  }

  setCashExact(): void {
    const remaining = this.basket.totalToPay() - this.cardAmount() - this.chequeAmount() - this.eftAmount();
    const rounded = this.basket.roundToNearest10c(Math.max(0, remaining));
    this.cashAmount.set(rounded);
  }

  requestClearAll(): void {
    if (this.basket.itemCount() === 0) return;
    this.showClearConfirm.set(true);
  }

  confirmClearAll(): void {
    this.showClearConfirm.set(false);
    this.basket.clearAll();
    this.resetTenderFields();
    this.toast.info('Basket cleared.');
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
    if (tenderType) {
      if (tt === 'cash') {
        const cashType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('cash'));
        return cashType?.posPaymentType_ID || cashType?.paymentTypeId || 1;
      }
      if (tt === 'card') {
        const cardType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('card'));
        return cardType?.posPaymentType_ID || cardType?.paymentTypeId || 3;
      }
      if (tt === 'cheque') {
        const chequeType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('cheque'));
        return chequeType?.posPaymentType_ID || chequeType?.paymentTypeId || 2;
      }
      if (tt === 'eft') {
        const eftType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('eft'));
        return eftType?.posPaymentType_ID || eftType?.paymentTypeId || 5;
      }
    }
    if (tt === 'cash+card') {
      const cashType = types.find((t: any) => (t.posPaymentTypeDesc || t.name || '').toLowerCase().includes('cash'));
      return cashType?.posPaymentType_ID || cashType?.paymentTypeId || 1;
    }
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

  private lastPaymentTimestamp = 0;
  private readonly MIN_PAYMENT_INTERVAL_MS = 3000;

  private generateIdempotencyToken(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  private updateProgress(current: number, total: number, label: string): void {
    this.paymentProgressCurrent.set(current);
    this.paymentProgressTotal.set(total);
    this.paymentProgressLabel.set(label);
  }

  private countExpectedReceipts(): number {
    const ordered = this.basket.orderedItems();
    const isCashCard = this.activeTender() === 'cash+card' && this.cashAmount() > 0 && this.cardAmount() > 0;
    const accountItems = ordered.filter(i => i.type === 'account' && i.amountToPay > 0);
    const clearanceItems = ordered.filter(i => i.type === 'clearance' && i.amountToPay > 0 && i.clearanceData);
    const prepaidItems = ordered.filter(i => i.type === 'prepaid' && i.amountToPay > 0 && i.prepaidData);
    const miscItems = ordered.filter(i => i.type === 'misc' && i.amountToPay > 0 && i.miscData);
    let count = 0;
    if (accountItems.length > 0) count += isCashCard ? 2 : 1;
    const nonAcctCount = clearanceItems.length + prepaidItems.length + miscItems.length;
    if (isCashCard) {
      const cashBudget = this.cashRoundedAmount();
      let remaining = cashBudget;
      const allNonAcct = [...clearanceItems, ...prepaidItems, ...miscItems];
      for (const item of allNonAcct) {
        const cashPortion = Math.min(item.amountToPay, Math.max(0, remaining));
        const cardPortion = item.amountToPay - cashPortion;
        if (cashPortion > 0.001) count++;
        if (cardPortion > 0.001) count++;
        remaining = Math.max(0, remaining - cashPortion);
      }
    } else {
      count += nonAcctCount;
    }
    return Math.max(count, 1);
  }

  async processPayment(): Promise<void> {
    if (this.processingPayment()) return;

    const now = Date.now();
    if (now - this.lastPaymentTimestamp < this.MIN_PAYMENT_INTERVAL_MS) {
      this.toast.error('Please wait before submitting another payment.');
      return;
    }

    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Cannot process payments.');
      return;
    }
    if (this.basket.orderedItems().length === 0) {
      this.toast.error('Basket is empty. Add items before processing.');
      return;
    }
    const zeroItems = this.basket.orderedItems().filter(i => i.amountToPay <= 0);
    if (zeroItems.length > 0) {
      this.toast.error('All items must have a positive amount. Please enter an amount for each item.');
      return;
    }
    if (!this.user()?.user_ID) {
      this.toast.error('User session not found. Please log in again.');
      return;
    }
    const validationErrors = this.tenderValidationErrors();
    if (validationErrors.length > 0) {
      this.toast.error(validationErrors[0]);
      return;
    }
    if (this.shortfall() > 0) {
      this.toast.error(`Tendered amount is R${this.shortfall().toFixed(2)} short of amount due.`);
      return;
    }
    if (this.cardOverpay() > 0) {
      this.toast.error('Card amount cannot exceed amount due. No change can be given on card payments.');
      return;
    }
    if (this.changeExceedsLimit()) {
      this.toast.error(`Cash change cannot exceed R${this.MAX_CHANGE.toFixed(2)}. Reduce the cash tendered amount.`);
      return;
    }
    if (this.cardAmount() > 0 && !this.cardNumber().replace(/\s/g, '')) {
      const ordered = this.basket.orderedItems();
      const nonMiscNeedingCard = ordered.filter(i => i.type !== 'misc');
      const miscWithoutCard = ordered.filter(i => i.type === 'misc' && i.miscData?.tenderType === 'card' && !i.miscData?.cardNumber);
      const needsPanelCardNumber = nonMiscNeedingCard.length > 0 || miscWithoutCard.length > 0
        || ordered.filter(i => i.type === 'misc' && i.miscData?.tenderType === 'card').length === 0;
      if (needsPanelCardNumber) {
        this.toast.error('Please enter the card number for card payments.');
        return;
      }
    }
    if (this.chequeAmount() > 0 && !this.chequeNumber()) {
      this.toast.error('Please enter the cheque number.');
      return;
    }
    const tender = this.activeTender();
    if (tender === 'card' && Math.abs(this.cardAmount() - this.basket.totalToPay()) > 0.005) {
      this.toast.error('Card amount must exactly match the amount due. No change on card.');
      return;
    }
    if (tender === 'cash+card') {
      const combined = this.cashRoundedAmount() + this.cardAmount();
      if (combined < this.basket.totalToPay() - 0.005) {
        this.toast.error(`Cash + Card combined is R${(this.basket.totalToPay() - combined).toFixed(2)} short.`);
        return;
      }
    }

    if (this.cashAmount() > 0) {
      const { roundedCash, adjustment } = this.basket.applyCashRounding(this.cashAmount());
      if (Math.abs(adjustment) > 0.001) {
        this.cashAmount.set(roundedCash);
        this.basket.adjustFirstItemForRounding(this.basket.totalToPay() + adjustment);
      }
    }

    const expectedTotal = this.countExpectedReceipts();
    this.updateProgress(0, expectedTotal, 'Preparing payment...');
    this.processingPayment.set(true);
    this.lastPaymentTimestamp = Date.now();
    const paymentToken = this.generateIdempotencyToken();
    const userId = this.user()?.user_ID;
    const ci = this.cashierInfo();
    const finYear = ci?.finYear || '';
    const dateNow = new Date();
    const receiptDate = `${dateNow.getFullYear()}-${String(dateNow.getMonth() + 1).padStart(2, '0')}-${String(dateNow.getDate()).padStart(2, '0')}T00:00:00`;
    const cardNum = this.cardNumber().replace(/\s/g, '');
    const allResults: ReceiptResult[] = [];
    let receiptCounter = 0;

    const isCashCard = this.activeTender() === 'cash+card' && this.cashAmount() > 0 && this.cardAmount() > 0;
    const cashPaymentTypeId = this.getPaymentTypeId('cash');
    const cardPaymentTypeId = this.getPaymentTypeId('card');
    const cashTenderAmt = this.cashRoundedAmount();
    const cardTenderAmt = this.cardAmount();
    const effectiveChangeAmount = this.changeAmount();

    const ordered = this.basket.orderedItems();
    const affectedAccountIds = new Set<number>();
    ordered.forEach(i => {
      if (i.type === 'account' && i.accountData?.accountId) affectedAccountIds.add(i.accountData.accountId);
    });

    try {
      const accountItems = ordered.filter(i => i.type === 'account' && i.amountToPay > 0);
      const clearanceItems = ordered.filter(i => i.type === 'clearance' && i.amountToPay > 0 && i.clearanceData);
      const prepaidItems = ordered.filter(i => i.type === 'prepaid' && i.amountToPay > 0 && i.prepaidData);
      const miscItems = ordered.filter(i => i.type === 'misc' && i.amountToPay > 0 && i.miscData);

      if (accountItems.length > 0) {
        try {
          const stagingPayload = accountItems.map(item => {
            const ad = item.accountData!;
            const orig = ad.originalData || {};
            return {
              account_ID: ad.accountId,
              accountNumber: ad.accountNumber,
              name: ad.name,
              outStandingAmt: ad.accountBalance ?? item.amountDue,
              paymentAmount: item.amountToPay,
              deliveryAddress: ad.address || orig.deliveryAddress || '',
              statusDesc: orig.statusDesc || '-',
              accountDesc: orig.accountDesc || '',
              erfNumber: orig.erfNumber || '',
              billId: orig.billId ?? orig.bill_ID ?? null,
            };
          });
          await firstValueFrom(
            this.api.post(`/api/platinum/billing-payment/save-multiple-account-payment?userId=${userId}`, stagingPayload)
          );
        } catch (stageErr: any) {
          console.warn('[processPayment] Staging save failed (non-blocking):', stageErr?.message);
        }

        if (isCashCard) {
          const allocation = this.basket.allocateSplitTender(cashTenderAmt, cardTenderAmt);
          const cashAcctItems = allocation.cashItems.filter(i => i.type === 'account');
          const cardAcctItems = allocation.cardItems.filter(i => i.type === 'account');

          if (cashAcctItems.length > 0) {
            receiptCounter++;
            this.updateProgress(receiptCounter, expectedTotal, `Posting cash receipt for account(s)... (${receiptCounter} of ${expectedTotal})`);
            const cashResult = await this.submitAccountPayment(cashAcctItems, userId!, finYear, receiptDate, cashPaymentTypeId, '', allocation.cashTotal, `${paymentToken}-acct-cash`);
            const cashRIds = this.extractReceiptIds(cashResult);
            if (cashRIds.length > 1 && cashRIds.length === cashAcctItems.length) {
              const cashRNoMap = await this.resolveMultipleReceiptNos(cashResult, cashRIds);
              for (let i = 0; i < cashAcctItems.length; i++) {
                const rNo = cashRNoMap.get(cashRIds[i]) || `REC-${cashRIds[i]}`;
                allResults.push({ receiptNumber: rNo, tenderType: 'cash', amount: cashAcctItems[i].amountToPay, items: [cashAcctItems[i]], rawResponse: cashResult });
              }
            } else {
              const cashReceiptNo = await this.resolveReceiptNo(cashResult);
              allResults.push({ receiptNumber: cashReceiptNo, tenderType: 'cash', amount: allocation.cashTotal, items: cashAcctItems, rawResponse: cashResult });
            }
          }
          if (cardAcctItems.length > 0) {
            receiptCounter++;
            this.updateProgress(receiptCounter, expectedTotal, `Posting card receipt for account(s)... (${receiptCounter} of ${expectedTotal})`);
            const cardResult = await this.submitAccountPayment(cardAcctItems, userId!, finYear, receiptDate, cardPaymentTypeId, cardNum, allocation.cardTotal, `${paymentToken}-acct-card`);
            const cardRIds = this.extractReceiptIds(cardResult);
            if (cardRIds.length > 1 && cardRIds.length === cardAcctItems.length) {
              const cardRNoMap = await this.resolveMultipleReceiptNos(cardResult, cardRIds);
              for (let i = 0; i < cardAcctItems.length; i++) {
                const rNo = cardRNoMap.get(cardRIds[i]) || `REC-${cardRIds[i]}`;
                allResults.push({ receiptNumber: rNo, tenderType: 'card', amount: cardAcctItems[i].amountToPay, items: [cardAcctItems[i]], rawResponse: cardResult });
              }
            } else {
              const cardReceiptNo = await this.resolveReceiptNo(cardResult);
              allResults.push({ receiptNumber: cardReceiptNo, tenderType: 'card', amount: allocation.cardTotal, items: cardAcctItems, rawResponse: cardResult });
            }
          }
        } else {
          receiptCounter++;
          this.updateProgress(receiptCounter, expectedTotal, `Posting receipt for account(s)... (${receiptCounter} of ${expectedTotal})`);
          const paymentTypeId = this.getPaymentTypeId();
          const result = await this.submitAccountPayment(accountItems, userId!, finYear, receiptDate, paymentTypeId, cardNum, this.basket.totalToPay(), paymentToken);
          const receiptIds = this.extractReceiptIds(result);
          if (receiptIds.length > 1 && receiptIds.length === accountItems.length) {
            const receiptNoMap = await this.resolveMultipleReceiptNos(result, receiptIds);
            for (let i = 0; i < accountItems.length; i++) {
              const rid = receiptIds[i];
              const rNo = receiptNoMap.get(rid) || `REC-${rid}`;
              allResults.push({ receiptNumber: rNo, tenderType: this.activeTender(), amount: accountItems[i].amountToPay, items: [accountItems[i]], rawResponse: result });
            }
          } else if (receiptIds.length > 1) {
            const receiptNoMap = await this.resolveMultipleReceiptNos(result, receiptIds);
            const perAcctAmt = accountItems.reduce((s, i) => s + i.amountToPay, 0) / receiptIds.length;
            for (const rid of receiptIds) {
              const rNo = receiptNoMap.get(rid) || `REC-${rid}`;
              allResults.push({ receiptNumber: rNo, tenderType: this.activeTender(), amount: perAcctAmt, items: accountItems, rawResponse: result });
            }
          } else {
            const acctReceiptNo = await this.resolveReceiptNo(result);
            allResults.push({ receiptNumber: acctReceiptNo, tenderType: this.activeTender(), amount: accountItems.reduce((s, i) => s + i.amountToPay, 0), items: accountItems, rawResponse: result });
          }
        }
      }

      let changeAppliedOnce = false;
      const applyChangeOnce = (): number => {
        if (changeAppliedOnce) return 0;
        changeAppliedOnce = true;
        return effectiveChangeAmount;
      };

      const allNonAcctItems = [...clearanceItems, ...prepaidItems, ...miscItems];
      const lastNonAcctIndex = allNonAcctItems.length - 1;
      let nonAcctIdx = -1;

      for (let ci2 = 0; ci2 < clearanceItems.length; ci2++) {
        nonAcctIdx++;
        const clearItem = clearanceItems[ci2];
        const itemLabel = clearItem.clearanceData?.ownerName || `Clearance #${ci2 + 1}`;
        const isLastNonAcct = nonAcctIdx === lastNonAcctIndex;

        if (isCashCard) {
          const cashUsed = allResults.filter(r => r.tenderType === 'cash').reduce((s, r) => s + r.amount, 0);
          const cashPortion = Math.min(clearItem.amountToPay, Math.max(0, cashTenderAmt - cashUsed));
          const cardPortion = Math.round((clearItem.amountToPay - cashPortion) * 100) / 100;

          if (cashPortion > 0) {
            receiptCounter++;
            this.updateProgress(receiptCounter, expectedTotal, `Posting cash clearance for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
            const cashItem = { ...clearItem, amountToPay: cashPortion };
            const chg = (isLastNonAcct && cardPortion <= 0) ? applyChangeOnce() : 0;
            const result = await this.submitClearancePaymentItem(cashItem, userId!, ci, finYear, '', cashPaymentTypeId, chg, `${paymentToken}-clr${ci2}-cash`);
            const receiptNo = await this.resolveReceiptNo(result);
            allResults.push({ receiptNumber: receiptNo, tenderType: 'cash', amount: cashPortion, items: [clearItem], rawResponse: result });
          }
          if (cardPortion > 0) {
            receiptCounter++;
            this.updateProgress(receiptCounter, expectedTotal, `Posting card clearance for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
            const cardItem = { ...clearItem, amountToPay: cardPortion };
            const result = await this.submitClearancePaymentItem(cardItem, userId!, ci, finYear, cardNum, cardPaymentTypeId, 0, `${paymentToken}-clr${ci2}-card`);
            const receiptNo = await this.resolveReceiptNo(result);
            allResults.push({ receiptNumber: receiptNo, tenderType: 'card', amount: cardPortion, items: [clearItem], rawResponse: result });
          }
        } else {
          receiptCounter++;
          this.updateProgress(receiptCounter, expectedTotal, `Posting clearance for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
          const itemChange = isLastNonAcct ? applyChangeOnce() : 0;
          const paymentTypeId = this.getPaymentTypeId();
          const result = await this.submitClearancePaymentItem(clearItem, userId!, ci, finYear, cardNum, paymentTypeId, itemChange, `${paymentToken}-clr${ci2}`);
          const receiptNo = await this.resolveReceiptNo(result);
          allResults.push({ receiptNumber: receiptNo, tenderType: this.activeTender(), amount: clearItem.amountToPay, items: [clearItem], rawResponse: result });
        }
      }

      for (let pi = 0; pi < prepaidItems.length; pi++) {
        nonAcctIdx++;
        const prepItem = prepaidItems[pi];
        const itemLabel = prepItem.prepaidData?.meterNumber || `Prepaid #${pi + 1}`;
        const isLastNonAcct = nonAcctIdx === lastNonAcctIndex;

        if (isCashCard) {
          const cashUsed = allResults.filter(r => r.tenderType === 'cash').reduce((s, r) => s + r.amount, 0);
          const cashPortion = Math.min(prepItem.amountToPay, Math.max(0, cashTenderAmt - cashUsed));
          const cardPortion = Math.round((prepItem.amountToPay - cashPortion) * 100) / 100;

          if (cashPortion > 0) {
            receiptCounter++;
            this.updateProgress(receiptCounter, expectedTotal, `Posting cash prepaid for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
            const cashItem = { ...prepItem, amountToPay: cashPortion };
            const chg = (isLastNonAcct && cardPortion <= 0) ? applyChangeOnce() : 0;
            const result = await this.submitPrepaidPaymentItem(cashItem, cashPaymentTypeId, chg, `${paymentToken}-prep${pi}-cash`);
            const receiptNo = await this.resolveReceiptNo(result);
            allResults.push({ receiptNumber: receiptNo, tenderType: 'cash', amount: cashPortion, items: [prepItem], rawResponse: result });
          }
          if (cardPortion > 0) {
            receiptCounter++;
            this.updateProgress(receiptCounter, expectedTotal, `Posting card prepaid for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
            const cardItem = { ...prepItem, amountToPay: cardPortion };
            const result = await this.submitPrepaidPaymentItem(cardItem, cardPaymentTypeId, 0, `${paymentToken}-prep${pi}-card`);
            const receiptNo = await this.resolveReceiptNo(result);
            allResults.push({ receiptNumber: receiptNo, tenderType: 'card', amount: cardPortion, items: [prepItem], rawResponse: result });
          }
        } else {
          receiptCounter++;
          this.updateProgress(receiptCounter, expectedTotal, `Posting prepaid for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
          const itemChange = isLastNonAcct ? applyChangeOnce() : 0;
          const paymentTypeId = this.getPaymentTypeId();
          const result = await this.submitPrepaidPaymentItem(prepItem, paymentTypeId, itemChange, `${paymentToken}-prep${pi}`);
          const receiptNo = await this.resolveReceiptNo(result);
          allResults.push({ receiptNumber: receiptNo, tenderType: this.activeTender(), amount: prepItem.amountToPay, items: [prepItem], rawResponse: result });
        }
      }

      for (let mi = 0; mi < miscItems.length; mi++) {
        nonAcctIdx++;
        const miscItem = miscItems[mi];
        const itemLabel = miscItem.miscData?.scoaItemName || `Misc #${mi + 1}`;
        const isLastNonAcct = nonAcctIdx === lastNonAcctIndex;

        if (isCashCard) {
          const cashUsed = allResults.filter(r => r.tenderType === 'cash').reduce((s, r) => s + r.amount, 0);
          const cashPortion = Math.min(miscItem.amountToPay, Math.max(0, cashTenderAmt - cashUsed));
          const cardPortion = Math.round((miscItem.amountToPay - cashPortion) * 100) / 100;

          if (cashPortion > 0) {
            receiptCounter++;
            this.updateProgress(receiptCounter, expectedTotal, `Posting cash misc for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
            const cashMisc = { ...miscItem, amountToPay: cashPortion };
            const chg = (isLastNonAcct && cardPortion <= 0) ? applyChangeOnce() : 0;
            const result = await this.submitMiscPaymentItem(cashMisc, userId!, ci, finYear, '', cashPaymentTypeId, chg, `${paymentToken}-misc${mi}-cash`);
            const receiptNo = await this.resolveReceiptNo(result);
            allResults.push({ receiptNumber: receiptNo, tenderType: 'cash', amount: cashPortion, items: [miscItem], rawResponse: result });
          }
          if (cardPortion > 0) {
            receiptCounter++;
            this.updateProgress(receiptCounter, expectedTotal, `Posting card misc for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
            const cardMisc = { ...miscItem, amountToPay: cardPortion };
            const result = await this.submitMiscPaymentItem(cardMisc, userId!, ci, finYear, cardNum, cardPaymentTypeId, 0, `${paymentToken}-misc${mi}-card`);
            const receiptNo = await this.resolveReceiptNo(result);
            allResults.push({ receiptNumber: receiptNo, tenderType: 'card', amount: cardPortion, items: [miscItem], rawResponse: result });
          }
        } else {
          receiptCounter++;
          this.updateProgress(receiptCounter, expectedTotal, `Posting misc for ${itemLabel}... (${receiptCounter} of ${expectedTotal})`);
          const itemChange = isLastNonAcct ? applyChangeOnce() : 0;
          const paymentTypeId = this.getPaymentTypeId();
          const result = await this.submitMiscPaymentItem(miscItem, userId!, ci, finYear, cardNum, paymentTypeId, itemChange, `${paymentToken}-misc${mi}`);
          const receiptNo = await this.resolveReceiptNo(result);
          allResults.push({ receiptNumber: receiptNo, tenderType: this.activeTender(), amount: miscItem.amountToPay, items: [miscItem], rawResponse: result });
        }
      }

      const validResults = allResults.filter(r => r.receiptNumber && r.receiptNumber !== 'N/A');
      const failedResults = allResults.filter(r => !r.receiptNumber || r.receiptNumber === 'N/A');

      if (validResults.length === 0) {
        this.updateProgress(expectedTotal, expectedTotal, 'Payment failed — no receipts created.');
        this.toast.error('Payment failed — the system did not create any receipts. No money was processed.');
      } else {
        this.updateProgress(expectedTotal, expectedTotal, 'All receipts posted successfully!');
        this.receiptResults.set(validResults);
        this.showReceipt.set(true);
        this.showPaymentPanel.set(false);

        if (failedResults.length > 0) {
          this.toast.error(`${failedResults.length} item(s) failed — no receipt was created. ${validResults.length} receipt(s) succeeded.`);
        } else {
          this.toast.success(`${validResults.length} receipt(s) processed successfully!`);
        }

        this.basket.clearAll();
        this.resetTenderFields();

        this.autoPrintReceipts();
        this.triggerAccountRebuilds(affectedAccountIds);
      }
    } catch (e: any) {
      const validCaught = allResults.filter(r => r.receiptNumber && r.receiptNumber !== 'N/A');
      if (validCaught.length > 0) {
        this.receiptResults.set(validCaught);
        this.showReceipt.set(true);
        this.showPaymentPanel.set(false);
        this.toast.error(`Partial success: ${validCaught.length} receipt(s) posted. Error on remaining: ${e?.error?.message || e?.message}`);

        this.basket.clearAll();
        this.resetTenderFields();
        this.triggerAccountRebuilds(affectedAccountIds);
      } else {
        this.toast.error(e?.error?.message || e?.message || 'Payment processing failed — no receipts were created.');
      }
    } finally {
      this.processingPayment.set(false);
      this.paymentProgressTotal.set(0);
      this.paymentProgressCurrent.set(0);
      this.paymentProgressLabel.set('');
    }
  }

  private formatCardExpiry(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
    return raw;
  }

  private async submitAccountPayment(items: BasketItem[], userId: number, finYear: string, receiptDate: string, paymentTypeId: number, cardNum: string, totalAmount: number, idempotencyToken?: string): Promise<any> {
    const ci = this.cashierInfo();
    const sessionCashierId = ci?.id || ci?.cashier_ID || userId;
    const sessionOfficeId = ci?.cashOffice_ID || 0;
    const isCardPayment = paymentTypeId === 3;

    if (items.length === 1) {
      const item = items[0];
      const ad = item.accountData!;
      const orig = ad.originalData || {};
      const currentBalance = ad.accountBalance ?? item.amountDue;
      console.log(`[submitAccountPayment] Account ${ad.accountNumber} outStandingAmt being sent: ${currentBalance}`);
      const submitAccountBase: any = {
        ...orig,
        account_ID: ad.accountId,
        accountNumber: ad.accountNumber,
        name: ad.name,
        outStandingAmt: currentBalance,
        billId: null,
        cutOffID: ad.cutOffID ?? 0,
        cutOffAmount: ad.cutOffAmount ?? 0,
        debtAmount: ad.debtAmount ?? 0,
        debtArrangementId: ad.debtArrangementId ?? 0,
        billingCycleId: ad.billingCycleId ?? 1,
        oldAccountCode: orig.oldAccountCode || '',
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
          outStandingAmount: currentBalance,
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
          apiTransactionID: 0,
          isReconciled: 0,
          isCancelled: 0,
        },
      };
      const logSafePayload = {...payload, requestModel: {...payload.requestModel, cardNumber: payload.requestModel.cardNumber ? '****' + payload.requestModel.cardNumber.slice(-4) : '', expiryDate: payload.requestModel.expiryDate ? '**/**' : ''}};
      console.log(`[submitAccountPayment] Single consumer payload for account ${ad.accountNumber}:`, JSON.stringify(logSafePayload).substring(0, 1000));
      const result: any = await firstValueFrom(
        this.api.postWithIdempotency(`/api/platinum/billing-payment/submit-consumer-payment/${userId}`, payload, idempotencyToken)
      );
      console.log(`[submitAccountPayment] Single consumer response:`, JSON.stringify(result).substring(0, 1000));
      if (result && result.isSuccess === false) {
        const detail = result.message || result.detail || result.error || result.statusText || '';
        throw new Error(detail || `API rejected payment for ${ad.accountNumber}`);
      }
      if (!this.hasReceiptData(result)) {
        throw new Error(`Payment for account ${ad.accountNumber} failed — no receipt was created by the system.`);
      }
      return result;
    } else {
      const submitAccounts = items.map(item => {
        const ad = item.accountData!;
        const orig = ad.originalData || {};
        const bal = ad.accountBalance ?? item.amountDue;
        console.log(`[submitAccountPayment-multi] Account ${ad.accountNumber} outStandingAmt: ${bal}`);
        return {
          capturerID: userId,
          accountID: ad.accountId,
          account_ID: ad.accountId,
          oldAccountCode: orig.oldAccountCode || '',
          name: ad.name || '',
          sgNumber: orig.erfNumber || orig.sgNo || '',
          address: ad.address || orig.deliveryAddress || '',
          outstandingAmount: bal,
          outStandingAmt: bal,
          accountStatus: orig.statusDesc || '-',
          accountType: orig.accountDesc || '',
          paymentAmount: item.amountToPay,
          accountNumber: ad.accountNumber || '',
          receiptID: 0,
          billId: orig.billId ?? orig.bill_ID ?? 0,
          clearanceId: orig.clearance_ID ?? 0,
        };
      });
      const totalPaymentAmount = items.reduce((s, i) => s + i.amountToPay, 0);
      const totalOutstanding = items.reduce((s, i) => s + (i.accountData?.accountBalance ?? i.amountDue), 0);
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
          apiTransactionID: 0,
          isReconciled: 0,
          isCancelled: 0,
        },
      };
      const logSafeMulti = {...payload, requestModel: {...payload.requestModel, cardNumber: payload.requestModel.cardNumber ? '****' + payload.requestModel.cardNumber.slice(-4) : '', expiryDate: payload.requestModel.expiryDate ? '**/**' : ''}};
      console.log(`[submitAccountPayment] Multi payment for ${submitAccounts.length} accounts:`, JSON.stringify(logSafeMulti).substring(0, 1000));
      const result: any = await firstValueFrom(
        this.api.postWithIdempotency(`/api/platinum/billing-payment/submit-multiple-payment/${userId}`, payload, idempotencyToken)
      );
      console.log(`[submitAccountPayment] Multi payment response:`, JSON.stringify(result).substring(0, 1000));
      if (result && result.isSuccess === false) {
        const detail = result.message || result.detail || result.error || result.statusText || '';
        throw new Error(detail || `API rejected multi-account payment`);
      }
      if (!this.hasReceiptData(result)) {
        throw new Error('Multi-account payment failed — no receipts were created by the system.');
      }
      return result;
    }
  }

  private async submitClearancePaymentItem(item: BasketItem, userId: number, ci: any, finYear: string, cardNum: string, paymentTypeId: number, changeAmt: number, idempotencyToken?: string): Promise<any> {
    const cd = item.clearanceData!;
    const sessionCashierId = ci?.id || ci?.cashier_ID || userId;
    const sessionOfficeId = ci?.cashOffice_ID || 0;
    const isCardPayment = paymentTypeId === 3;
    const now = new Date();
    const receiptDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    const paidItems = (cd.accounts || []).map((a: any) => ({
      account_ID: a.accountId || a.account_ID || null,
      debT_TYPE: a.debtType || a.debT_TYPE || null,
      amount: a.paymentAmount || a.amount || 0,
    }));
    const tenderAmt = isCardPayment ? item.amountToPay : (this.cashAmount() > 0 ? this.cashRoundedAmount() : item.amountToPay);
    const payload = {
      userId,
      paymentTypeId,
      cashierId: sessionCashierId,
      cashOfficeId: sessionOfficeId,
      receiptDate,
      tenderAmount: tenderAmt,
      changeAmount: isCardPayment ? 0 : Math.max(0, changeAmt),
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
    };
    const logSafe = {...payload, cardNo: payload.cardNo ? '****' + (payload.cardNo as string).slice(-4) : '', cardExpiryDate: payload.cardExpiryDate ? '**/**' : ''};
    console.log(`[submitClearancePayment] Payload:`, JSON.stringify(logSafe).substring(0, 1000));
    const result: any = await firstValueFrom(
      this.api.postWithIdempotency('/api/platinum/billing-payment-clearance/submit-payment', payload, idempotencyToken)
    );
    console.log(`[submitClearancePayment] Response:`, JSON.stringify(result).substring(0, 500));
    if (result && result.isSuccess === false) {
      throw new Error(result.message || result.detail || 'Clearance payment rejected by API');
    }
    if (!this.hasReceiptData(result)) {
      throw new Error('Clearance payment failed — no receipt was created by the system.');
    }
    return result;
  }

  private async submitPrepaidPaymentItem(item: BasketItem, paymentTypeId: number, changeAmt: number, idempotencyToken?: string): Promise<any> {
    const pd = item.prepaidData!;
    const ci = this.cashierInfo();
    const userId = this.user()?.user_ID;
    const sessionCashierId = ci?.id || ci?.cashier_ID || userId;
    const sessionOfficeId = ci?.cashOffice_ID || 0;
    const isCardPayment = paymentTypeId === 3;
    const now = new Date();
    const receiptDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    const tenderAmt = isCardPayment ? item.amountToPay : (this.cashAmount() > 0 ? this.cashRoundedAmount() : item.amountToPay);
    const payload = {
      userId,
      cashierId: sessionCashierId,
      cashOfficeId: sessionOfficeId,
      accountId: pd.accountId || 0,
      accountNumber: pd.accountNumber || '',
      meterNumber: pd.meterNumber,
      amount: item.amountToPay,
      tenderAmount: tenderAmt,
      changeAmount: isCardPayment ? 0 : Math.max(0, changeAmt),
      paymentTypeId,
      receiptDate,
      finYear: ci?.finYear || '',
      prepaidType: pd.serviceType || 'Electricity',
      cardNo: isCardPayment ? this.cardNumber().replace(/\s/g, '') : null,
      cardExpiryDate: isCardPayment ? this.formatCardExpiry(this.cardExpiry()) : null,
    };
    const logSafe = {...payload, cardNo: payload.cardNo ? '****' + (payload.cardNo as string).slice(-4) : '', cardExpiryDate: payload.cardExpiryDate ? '**/**' : ''};
    console.log(`[submitPrepaidPayment] Payload:`, JSON.stringify(logSafe).substring(0, 1000));
    const result: any = await firstValueFrom(
      this.api.postWithIdempotency('/api/platinum/receipt-prepaid/submit-prepaid-payment', payload, idempotencyToken)
    );
    console.log(`[submitPrepaidPayment] Response:`, JSON.stringify(result).substring(0, 500));
    if (result && result.isSuccess === false) {
      throw new Error(result.message || result.detail || 'Prepaid payment rejected by API');
    }
    if (!this.hasReceiptData(result)) {
      throw new Error('Prepaid payment failed — no receipt was created by the system.');
    }
    return result;
  }

  private async submitMiscPaymentItem(item: BasketItem, userId: number, ci: any, finYear: string, cardNum: string, paymentTypeId: number, changeAmt: number, idempotencyToken?: string): Promise<any> {
    const md = item.miscData!;
    const miscTender = md.tenderType || (paymentTypeId === 3 ? 'card' : 'cash');
    const isCardPayment = miscTender === 'card';
    const effectivePaymentTypeId = isCardPayment ? this.getPaymentTypeId('card') : this.getPaymentTypeId('cash');
    const sessionCashierId = ci?.id || ci?.cashier_ID || userId;
    const sessionOfficeId = ci?.cashOffice_ID || 0;
    const effectiveVatPct = md.isVatable ? (md.vatPercentage > 0 ? md.vatPercentage : this.systemVatRate()) : 0;
    const vatAmount = md.isVatable && effectiveVatPct > 0 ? Math.round(item.amountToPay * effectiveVatPct / (100 + effectiveVatPct) * 100) / 100 : 0;
    const tenderAmt = isCardPayment ? item.amountToPay : (this.cashAmount() > 0 ? this.cashRoundedAmount() : item.amountToPay);
    const now = new Date();
    const receiptDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const effectiveCardNo = isCardPayment ? (md.cardNumber || cardNum || '') : '';
    const effectiveExpiry = isCardPayment ? (md.cardExpiry || this.formatCardExpiry(this.cardExpiry()) || '') : '';

    const payload = {
      lastName: md.lastName || '',
      initials: md.initials || '',
      miscellaneousPaymentGroup: md.groupId,
      scoaItem: md.scoaItemId,
      description: md.description || md.scoaItemName,
      receiptDate: `${receiptDate}T00:00:00`,
      totalAmount: item.amountToPay,
      vatAmount,
      amount: item.amountToPay - vatAmount,
      tenderAmount: tenderAmt,
      changeAmount: isCardPayment ? 0 : Math.max(0, changeAmt),
      paymentType: effectivePaymentTypeId,
      vatPercentage: effectiveVatPct,
      isVatable: md.isVatable || false,
      cardNo: isCardPayment ? effectiveCardNo : null,
      expiryDate: isCardPayment ? effectiveExpiry : null,
      chequeNo: null,
      bankBranch: null,
      bankBranchCode: null,
      bankBranchCodeId: null,
      accHolderName: [md.lastName, md.initials].filter(Boolean).join(' ') || null,
      finYear,
      accountId: null,
      sundryId: null,
    };
    console.log(`[submitMiscPayment] miscTender=${miscTender}, effectivePaymentTypeId=${effectivePaymentTypeId}, cardNo=${effectiveCardNo ? '****' : 'none'}`);
    const logSafe = {...payload, cardNo: payload.cardNo ? '****' + payload.cardNo.slice(-4) : ''};
    console.log(`[submitMiscPayment] Payload via submit-miscellaneous-payment/${userId}:`, JSON.stringify(logSafe).substring(0, 1500));
    const result: any = await firstValueFrom(
      this.api.postWithIdempotency(`/api/platinum/billing-payment-miscellaneous/submit-miscellaneous-payment/${userId}`, payload, idempotencyToken)
    );
    console.log(`[submitMiscPayment] Response:`, JSON.stringify(result).substring(0, 500));
    if (result && result.isSuccess === false) {
      throw new Error(result.message || result.detail || 'Miscellaneous payment rejected by API');
    }
    if (!this.hasReceiptData(result)) {
      throw new Error('Miscellaneous payment failed — no receipt was created by the system.');
    }
    return result;
  }

  private hasReceiptData(result: any): boolean {
    if (!result) return false;
    const hasReceiptNo = !!(result.receiptNo || result.receiptNumber || result.receipt_no || result.ReceiptNo
      || result.objData?.receiptNo || result.result?.receiptNo || result.data?.receiptNo);
    const hasIds = Array.isArray(result.ids) && result.ids.length > 0 && result.ids.some((id: any) => id > 0);
    return hasReceiptNo || hasIds;
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
        firstValueFrom(this.api.post<any>('/api/platinum/billing-payment-clearance/get-clearance-data', { clearanceId: paddedId }))
          .catch((e: any) => ({ _fetchError: true, msg: e?.error?.message || e?.message || 'Failed to load clearance data' })),
        firstValueFrom(this.api.post<any>('/api/platinum/billing-payment-clearance/get-accounts-for-clearance', { clearanceId: paddedId, userId: this.user()?.user_ID }))
          .catch((e: any) => ({ _fetchError: true, msg: e?.error?.message || e?.message || 'Failed to load clearance accounts' })),
      ]);

      if ((dataResult as any)?._fetchError && (accountsResult as any)?._fetchError) {
        this.clearanceError.set((dataResult as any).msg || 'Clearance search failed — Platinum API error.');
        return;
      }

      const dataItems = (dataResult as any)?._fetchError ? [] : (dataResult?.items || (Array.isArray(dataResult) ? dataResult : []));
      const accounts = (accountsResult as any)?._fetchError ? [] : (accountsResult?.items || (Array.isArray(accountsResult) ? accountsResult : []));

      if (dataItems.length === 0 && accounts.length === 0) {
        this.clearanceError.set('No clearance certificate found for this ID.');
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
      this.clearanceError.set(e?.error?.message || e?.message || 'Clearance search failed.');
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
      const arr = Array.isArray(data) ? data : (data?.data || data?.serviceTypes || []);
      this.prepaidServiceTypes.set(Array.isArray(arr) ? arr : []);
    } catch {
      this.toast.error('Failed to load prepaid service types.');
    }
  }

  async loadMiscGroups(): Promise<void> {
    this.miscGroupsLoading.set(true);
    try {
      const [data, vatData]: any[] = await Promise.all([
        firstValueFrom(this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-groups')),
        firstValueFrom(this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-vat-rate')).catch(() => null),
      ]);
      if (vatData != null) {
        const rate = typeof vatData === 'number' ? vatData : (vatData?.vatRate ?? vatData?.vatPercentage ?? vatData?.rate ?? vatData?.value ?? vatData?.vat ?? null);
        if (rate != null && !isNaN(Number(rate)) && Number(rate) > 0) {
          this.systemVatRate.set(Number(rate));
          console.log('[loadMiscGroups] System VAT rate from API:', Number(rate));
        }
      }
      const arr = Array.isArray(data) ? data : (data?.data || data?.groups || []);
      this.miscGroups.set(arr.map((g: any) => ({
        groupId: g.groupId || g.group_ID || g.miscellaneousPaymentGroup || g.id || 0,
        groupName: g.groupName || g.group_name || g.name || g.description || '',
        description: g.description || g.name || g.groupName || '',
      })));
    } catch {
      this.toast.error('Failed to load miscellaneous payment groups.');
    } finally {
      this.miscGroupsLoading.set(false);
    }
  }

  getSelectedScoaName(): string {
    const items = this.miscScoaItems();
    if (!items || items.length === 0) {
      return this.miscSelectedGroupId() ? 'Loading...' : 'Select a group first';
    }
    const selectedId = this.miscSelectedScoaId();
    const found = items.find(s => s.scoaItemId === selectedId);
    return found ? found.scoaItemName : items[0].scoaItemName;
  }

  async onMiscGroupChange(groupId: number): Promise<void> {
    console.log(`[onMiscGroupChange] groupId=${groupId}, type=${typeof groupId}`);
    this.miscSelectedGroupId.set(groupId);
    this.miscScoaItems.set([]);
    this.miscSelectedScoaId.set(0);
    if (!groupId) return;
    this.miscScoaLoading.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.get<any>('/api/platinum/billing-payment-miscellaneous/get-scoa-items', { mISCPayGroupId: String(groupId) })
      );
      console.log(`[onMiscGroupChange] Raw SCOA response for group ${groupId}:`, JSON.stringify(data).substring(0, 500));
      const arr = Array.isArray(data) ? data : (data?.data || data?.items || []);
      const sysVat = this.systemVatRate();
      const mapped = arr.map((s: any) => {
        const rawName = s.scoaItemName || s.description || s.name || '';
        const codeMatch = rawName.match(/\s+([A-Z]{2}\d{30,})\s*$/);
        const scoaCode = codeMatch ? codeMatch[1] : '';
        const descPart = codeMatch ? rawName.replace(codeMatch[0], '').trim() : rawName;
        const displayName = scoaCode ? `${scoaCode} — ${descPart}` : descPart || rawName;
        const itemVatable = s.isVatable !== false;
        const rawPct = Number(s.vatPercentage) || 0;
        const effectivePct = itemVatable && rawPct <= 0 ? sysVat : rawPct;
        return {
          scoaItemId: s.scoaItemId || s.scoa_item_ID || s.scoaItem || s.id || 0,
          scoaItemName: displayName,
          description: s.description || rawName,
          amount: s.amount || 0,
          isVatable: itemVatable,
          vatPercentage: effectivePct,
        };
      });
      console.log(`[onMiscGroupChange] Mapped ${mapped.length} SCOA items (systemVatRate=${sysVat}%)`);
      mapped.forEach((m: ScoaItem) => console.log(`  SCOA: ${m.scoaItemId} - ${m.scoaItemName} vatable=${m.isVatable} vat=${m.vatPercentage}%`));
      this.miscScoaItems.set(mapped);
      if (mapped.length > 0) {
        this.miscSelectedScoaId.set(mapped[0].scoaItemId);
        console.log(`[onMiscGroupChange] Auto-selected SCOA item: ${mapped[0].scoaItemId} - ${mapped[0].scoaItemName}`);
      }
    } catch (err) {
      console.error(`[onMiscGroupChange] Error loading SCOA items for group ${groupId}:`, err);
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
    if (this.miscTenderType() === 'card' && !this.miscCardNumber().replace(/\s/g, '')) {
      this.toast.error('Enter a card number for card payments.');
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
        tenderType: this.miscTenderType(),
        cardNumber: this.miscTenderType() === 'card' ? this.miscCardNumber().replace(/\s/g, '') : undefined,
        cardExpiry: this.miscTenderType() === 'card' ? this.miscCardExpiry() : undefined,
      },
    };
    this.basket.addItem(item);
    this.toast.success(`Added misc (${this.miscTenderType()}): ${group.groupName}`);
    this.miscAmount.set(0);
    this.miscDescription.set('');
    this.miscLastName.set('');
    this.miscInitials.set('');
    this.miscCardNumber.set('');
    this.miscCardExpiry.set('');
    this.miscTenderType.set('cash');
    this.activeMode.set('account');
  }

  formatMiscCardNumber(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    this.miscCardNumber.set(digits.replace(/(\d{4})(?=\d)/g, '$1 '));
  }

  formatMiscCardExpiry(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    this.miscCardExpiry.set(digits.length >= 3 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits);
  }

  private getReceiptSerialNo(data: any): number {
    if (!data) return 0;
    const extract = (obj: any): number => {
      if (!obj || typeof obj !== 'object') return 0;
      return Number(obj.receiptSerialNo || obj.receipt_serial_no || obj.ReceiptSerialNo
        || obj.receiptId || obj.receipt_ID || obj.receiptID
        || obj.id || obj.ID
        || obj.prepaidReceiptId || obj.prepaid_receipt_id || obj.tokenReceiptId
        || 0);
    };
    if (Array.isArray(data.ids) && data.ids.length > 0 && Number(data.ids[0]) > 0) {
      return Number(data.ids[0]);
    }
    let val = extract(data);
    if (val > 0) return val;
    if (data.objData) { val = extract(data.objData); if (val > 0) return val; }
    if (data.result) { val = extract(data.result); if (val > 0) return val; }
    if (data.data) { val = extract(data.data); if (val > 0) return val; }
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      val = extract(data.items[0]);
      if (val > 0) return val;
    }
    console.warn('[POS] getReceiptSerialNo: could not extract ID from:', JSON.stringify(data).substring(0, 500));
    return 0;
  }

  async printReceipt(): Promise<void> {
    const results = this.receiptResults();
    if (!results.length) return;
    this.printingReceipt.set(true);
    let printed = 0;
    const errors: string[] = [];
    try {
      console.log(`[printReceipt] ${results.length} result(s) to print`);

      for (const r of results) {
        const sid = this.getReceiptSerialNo(r.rawResponse);
        const type = r.items[0]?.type || 'unknown';
        console.log(`[printReceipt] ${type} receipt serialNo=${sid}, receiptNumber=${r.receiptNumber}`, JSON.stringify(r.rawResponse).substring(0, 300));
      }

      const miscResults = results.filter(r => r.items[0]?.type === 'misc');
      const nonMiscResults = results.filter(r => r.items[0]?.type !== 'misc');

      for (const mr of miscResults) {
        const miscIds = this.extractReceiptIds(mr.rawResponse);
        let miscId = miscIds.length > 0 ? miscIds[0] : this.getReceiptSerialNo(mr.rawResponse);
        if (!miscId || miscId <= 0) {
          errors.push(`Misc receipt: no receipt ID found for "${mr.items[0]?.label || 'misc'}"`);
          continue;
        }
        try {
          console.log(`[printReceipt] Printing misc receipt via print-miscellaneous-receipt?id=${miscId}`);
          const blob = await firstValueFrom(
            this.api.postBlob(`/api/platinum/billing-payment/print-miscellaneous-receipt?id=${miscId}`, {})
          );
          if (blob && blob.size > 0) {
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            printed++;
          } else {
            errors.push(`Misc receipt PDF for ID ${miscId}: empty response`);
          }
        } catch (miscPrintErr: any) {
          console.error(`[printReceipt] Misc print error for ID ${miscId}:`, miscPrintErr);
          errors.push(`Misc receipt print: ${miscPrintErr?.error?.message || miscPrintErr?.message || 'failed'}`);
        }
      }

      if (nonMiscResults.length > 0) {
        const allReceiptIds: number[] = [];
        for (const r of nonMiscResults) {
          const rawIds = this.extractReceiptIds(r.rawResponse);
          if (rawIds.length > 0) {
            allReceiptIds.push(...rawIds);
          } else {
            const serialNo = this.getReceiptSerialNo(r.rawResponse);
            if (serialNo > 0) allReceiptIds.push(serialNo);
          }
        }

        const realReceiptNos = nonMiscResults
          .map(r => r.receiptNumber)
          .filter(n => n && n !== 'N/A' && !n.startsWith('REC-'));

        const uniqueIds = Array.from(new Set(allReceiptIds));
        console.log(`[printReceipt] Non-misc receipt IDs: [${uniqueIds.join(',')}], receiptNos: [${realReceiptNos.join(',')}]`);

        if (uniqueIds.length > 0 || realReceiptNos.length > 0) {
          try {
            const blob = await firstValueFrom(
              this.api.postBlob('/api/platinum/billing-payment/print-receipt', {
                ids: uniqueIds.length > 0 ? uniqueIds : [0],
                receiptNos: realReceiptNos,
                isReprint: false,
              })
            );
            if (blob && blob.size > 0) {
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
              printed++;
            } else {
              errors.push('Receipt PDF: empty response returned');
            }
          } catch (printErr: any) {
            console.error(`[printReceipt] Print error:`, printErr);
            errors.push(`Receipt print: ${printErr?.error?.message || printErr?.message || 'failed'}`);
          }
        } else {
          const failedTypes = nonMiscResults.map(r => r.items[0]?.type || 'unknown').join(', ');
          errors.push(`No receipt IDs extracted for ${failedTypes} payment(s) — receipt may not be printable yet`);
        }
      }

      if (printed > 0) {
        this.toast.success('Receipt(s) sent to printer.');
      } else if (errors.length > 0) {
        console.error('[printReceipt] Errors:', errors);
        this.toast.error(errors[0]);
      } else {
        this.toast.error('No printable receipts found.');
      }
    } catch (e: any) {
      console.error('[printReceipt] Unexpected error:', e);
      this.toast.error('Failed to print receipt(s).');
    } finally {
      this.printingReceipt.set(false);
    }
  }

  async printConsolidatedReceipt(): Promise<void> {
    const results = this.receiptResults();
    if (results.length < 2) return;
    this.printingReceipt.set(true);
    try {
      const cashierName = this.cashierInfo()?.cashierName || this.user()?.userName || '';
      const cashOffice = this.sessionCashOfficeName() || this.cashierInfo()?.cashOfficeDesc || this.cashierInfo()?.cashOfficeName || '';
      const payload = {
        receipts: results.map(r => ({
          receiptNumber: r.receiptNumber,
          tenderType: r.tenderType,
          amount: r.amount,
          items: r.items.map(i => ({
            id: i.id,
            type: i.type,
            label: i.label,
            accountData: i.accountData ? {
              accountNumber: i.accountData.accountNumber || '',
              name: i.accountData.name || '',
              address: i.accountData.address || '',
              sgNumber: (i.accountData as any).sgNumber || '',
              originalData: (i.accountData as any).originalData,
            } : undefined,
            miscData: i.miscData || undefined,
            clearanceData: i.clearanceData || undefined,
            prepaidData: i.prepaidData || undefined,
          })),
        })),
        cashierName,
        cashOffice,
        municipality: 'George Municipality',
      };
      const resp = await firstValueFrom(this.api.post<{ base64: string; mimeType: string }>('/api/pos/consolidated-receipt', payload));
      if (resp?.base64) {
        const byteChars = atob(resp.base64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: resp.mimeType || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        this.toast.success('Consolidated receipt generated.');
      } else {
        this.toast.error('No PDF data returned.');
      }
    } catch (e: any) {
      console.error('[printConsolidatedReceipt] Error:', e);
      this.toast.error(e?.error?.message || 'Failed to generate consolidated receipt.');
    } finally {
      this.printingReceipt.set(false);
    }
  }

  getReceiptGrandTotal(): number {
    return this.receiptResults().reduce((s, r) => s + r.amount, 0);
  }

  getReceiptTimestamp(): string {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  }

  getReceiptTotalItems(): number {
    const results = this.receiptResults();
    const ids = new Set<string>();
    for (const r of results) {
      for (const item of r.items) {
        ids.add(item.id);
      }
    }
    return ids.size;
  }

  hasSplitPayments(): boolean {
    const results = this.receiptResults();
    const types = new Set(results.map(r => r.tenderType));
    return types.has('cash') && types.has('card');
  }

  getSplitCashTotal(): number {
    return this.receiptResults().filter(r => r.tenderType === 'cash').reduce((s, r) => s + r.amount, 0);
  }

  getSplitCardTotal(): number {
    return this.receiptResults().filter(r => r.tenderType === 'card').reduce((s, r) => s + r.amount, 0);
  }

  getReceiptTypeLabel(r: ReceiptResult): string {
    const type = r.items[0]?.type;
    if (type === 'account') return 'Consumer Payment';
    if (type === 'clearance') return 'Clearance';
    if (type === 'prepaid') return 'Prepaid Recharge';
    if (type === 'misc') return 'Miscellaneous';
    return 'Payment';
  }

  getMiscPayerName(miscData: any): string {
    if (!miscData) return '-';
    const parts = [miscData.initials, miscData.lastName].filter((p: string) => !!p);
    return parts.join(' ') || '-';
  }

  getReceiptItemDesc(r: ReceiptResult): string {
    if (!r.items || r.items.length === 0) return '';
    const item = r.items[0];
    if (item.type === 'account') {
      return r.items.length > 1 ? `${r.items.length} account(s)` : (item.accountData?.accountNumber || item.label);
    }
    if (item.type === 'clearance') return item.clearanceData?.ownerName || 'Clearance';
    if (item.type === 'prepaid') return `Meter ${item.prepaidData?.meterNumber || ''}`;
    if (item.type === 'misc') return item.miscData?.scoaItemName || 'Miscellaneous';
    return item.label || '';
  }

  private async autoPrintReceipts(): Promise<void> {
    const results = this.receiptResults();
    if (!results.length) return;
    console.log(`[autoPrint] Triggering auto-print for ${results.length} receipt(s)...`);
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      await this.printReceipt();
    } catch (e: any) {
      console.error('[autoPrint] Auto-print failed:', e);
      this.toast.error('Auto-print failed — use the Print button to retry.');
    }
  }

  private triggerAccountRebuilds(accountIds: Set<number>): void {
    if (accountIds.size === 0) return;
    console.log(`[accountRebuild] Triggering rebuild for ${accountIds.size} account(s):`, [...accountIds]);
    const rebuildOne = async (accountId: number, attempt = 1): Promise<void> => {
      try {
        await firstValueFrom(
          this.api.get<any>(`/api/platinum/billing-enquiry/rebuild-full-account`, { accountId: String(accountId) })
        );
        console.log(`[accountRebuild] OK account ${accountId}`);
      } catch (e: any) {
        if (attempt < 3) {
          console.warn(`[accountRebuild] Retry ${attempt}/2 for account ${accountId}`);
          await new Promise(r => setTimeout(r, 2000 * attempt));
          return rebuildOne(accountId, attempt + 1);
        }
        console.warn(`[accountRebuild] Failed after 3 attempts for account ${accountId}:`, e?.message);
      }
    };
    Promise.allSettled([...accountIds].map(id => rebuildOne(id))).then(results => {
      const ok = results.filter(r => r.status === 'fulfilled').length;
      console.log(`[accountRebuild] Complete: ${ok}/${accountIds.size} succeeded`);
    });
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

    this.basket.clearAll();

    this.searchMode.set('unified');
    this.activeMode.set('account');
    this.unifiedSearchQuery.set('');
    this.unifiedSearchResults.set([]);
    this.tabSearchQuery.set('');
    this.tabSearchResults.set([]);
    this.tabSearchActive.set(false);
    this.accountDetailLoading.set(false);

    this.miscSelectedGroupId.set(0);
    this.miscSelectedScoaId.set(0);
    this.miscScoaItems.set([]);
    this.miscAmount.set(0);
    this.miscDescription.set('');
    this.miscLastName.set('');
    this.miscInitials.set('');
    this.miscTenderType.set('cash');
    this.miscCardNumber.set('');
    this.miscCardExpiry.set('');
    this.prepaidAmount.set(0);

    this.cashAmount.set(0);
    this.cardAmount.set(0);
    this.cardNumber.set('');
    this.cardExpiry.set('');
    this.cardReference.set('');
    this.chequeAmount.set(0);
    this.chequeNumber.set('');
    this.chequeName.set('');
    this.chequeBankId.set(0);
    this.eftAmount.set(0);
    this.eftReference.set('');
    this.activeTender.set('cash');
    this.tenderOrderExpanded.set(true);
    this.showPaymentPanel.set(false);
    this.processingPayment.set(false);
    this.paymentProgressCurrent.set(0);
    this.paymentProgressTotal.set(0);
    this.paymentProgressLabel.set('');

    this.csvStep.set('upload');
    this.csvFileName.set('');
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
    this.dropBoxStep.set('input');
    this.dropBoxError.set('');
    this.dropBoxReceiptNo.set(null);
    this.showDropBoxHistory.set(false);
    this.dropBoxHistory.set([]);
    this.showDropBoxDialog.set(true);
  }

  closeDropBoxDialog(): void {
    if (this.dropBoxStep() === 'submitting') return;
    this.showDropBoxDialog.set(false);
  }

  addDropBoxDenom(value: number): void {
    this.dropBoxAmount.update(v => Math.round((v + value) * 100) / 100);
  }

  clearDropBoxAmount(): void {
    this.dropBoxAmount.set(0);
  }

  reviewDropBox(): void {
    if (this.dropBoxAmount() <= 0) {
      this.toast.error('Please enter a valid drop amount greater than zero.');
      return;
    }
    this.dropBoxStep.set('confirm');
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

    const finYear = this.user()?.finYear || this.cashierInfo()?.finYear;
    if (!finYear) {
      this.toast.error('Financial year missing from your session. Please log in again.');
      this.dropBoxStep.set('input');
      return;
    }

    this.dropBoxStep.set('submitting');
    this.submittingDropBox.set(true);
    try {
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/drop-box/submit', {
          amount: this.dropBoxAmount(),
          description: this.dropBoxReference()?.trim() || 'Cash Drop to Drop Box',
          userId: Number(this.user()?.user_ID || 0),
          finYear,
          paymentType: 1,
        })
      );

      if (result?.success === false || result?.error) {
        this.dropBoxError.set(result?.message || result?.error || 'Failed to submit drop box payment.');
        this.dropBoxStep.set('error');
        return;
      }

      this.dropBoxReceiptNo.set(result?.receiptNo || null);
      this.dropBoxStep.set('success');
      this.toast.success(`R ${this.dropBoxAmount().toFixed(2)} has been dropped to the drop box.`);
    } catch (e: any) {
      this.dropBoxError.set(e?.error?.message || e?.message || 'Failed to submit drop box payment.');
      this.dropBoxStep.set('error');
    } finally {
      this.submittingDropBox.set(false);
    }
  }

  async toggleDropBoxHistory(): Promise<void> {
    this.showDropBoxHistory.update(v => !v);
    if (this.showDropBoxHistory() && this.dropBoxHistory().length === 0) {
      await this.loadDropBoxHistory();
    }
  }

  async loadDropBoxHistory(): Promise<void> {
    const cashierId = this.cashierInfo()?.id || this.cashierInfo()?.cashier_ID;
    if (!cashierId) return;
    this.dropBoxHistoryLoading.set(true);
    try {
      const result: any = await firstValueFrom(
        this.api.get('/api/platinum/drop-box/list', { cashierId: String(cashierId) })
      );
      this.dropBoxHistory.set(result?.items || []);
    } catch {
      this.dropBoxHistory.set([]);
    } finally {
      this.dropBoxHistoryLoading.set(false);
    }
  }

  navigateToCashierSetup(): void {
    this.router.navigate(['/cashier-setup']);
  }

  navigateToDayEnd(): void {
    this.dayEndRequested.emit();
  }

  navigateToEnquiries(): void {
    this.showEnquiryOverlay.set(true);
  }

  closeEnquiryOverlay(): void {
    this.showEnquiryOverlay.set(false);
  }

  formatCurrency(amount: number): string {
    if (isNaN(amount)) return '0.00';
    return amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private extractReceiptIds(result: any): number[] {
    if (result?.ids && Array.isArray(result.ids) && result.ids.length > 0) {
      return result.ids.map(Number);
    } else if (Array.isArray(result)) {
      return result
        .map((r: any) => r.receiptID || r.receiptId || r.id)
        .filter((id: any) => id != null)
        .map(Number);
    } else if (result && typeof result === 'object') {
      const rid = result.receiptID || result.receiptId || result.receipt_ID || result.id;
      if (rid != null && Number(rid) > 0) return [Number(rid)];
      if (result.objData) {
        const orid = result.objData.receiptID || result.objData.receiptId || result.objData.id;
        if (orid != null && Number(orid) > 0) return [Number(orid)];
      }
      if (result.result) {
        const rrid = result.result.receiptID || result.result.receiptId || result.result.id;
        if (rrid != null && Number(rrid) > 0) return [Number(rrid)];
      }
      if (result.data) {
        const drid = result.data.receiptID || result.data.receiptId || result.data.id;
        if (drid != null && Number(drid) > 0) return [Number(drid)];
      }
    }
    return [];
  }

  private async resolveReceiptNo(result: any): Promise<string> {
    if (!result) return 'N/A';

    const directNo = result?.receiptNo || result?.receiptNumber || result?.receipt_no || result?.ReceiptNo
      || result?.objData?.receiptNo || result?.result?.receiptNo || result?.data?.receiptNo;
    if (directNo && String(directNo) !== '0') {
      console.log(`[resolveReceiptNo] Found direct receiptNo: ${directNo}`);
      return String(directNo);
    }

    const receiptIds = this.extractReceiptIds(result);
    console.log(`[resolveReceiptNo] Extracted receipt IDs: [${receiptIds.join(',')}] from response:`, JSON.stringify(result).substring(0, 500));

    if (receiptIds.length > 0) {
      try {
        const cashierId = this.cashierInfo()?.id || this.cashierInfo()?.cashier_ID || this.user()?.user_ID;
        if (cashierId) {
          const unreconciledList: any = await firstValueFrom(
            this.api.get('/api/platinum/billing-payment-day-end/cashier-receipt-unreconciled-list', { id: String(cashierId) })
          );
          const list = Array.isArray(unreconciledList) ? unreconciledList : (unreconciledList?.data || unreconciledList?.items || []);
          for (const rid of receiptIds) {
            const match = list.find((r: any) => r.id === rid || r.receiptId === rid || r.receiptID === rid);
            if (match?.receiptNo) {
              console.log(`[resolveReceiptNo] Found receiptNo "${match.receiptNo}" from unreconciled list for ID ${rid}`);
              return String(match.receiptNo);
            }
          }
        }
      } catch (e: any) {
        console.warn(`[resolveReceiptNo] Unreconciled list lookup failed:`, e?.message);
      }

      for (const rid of receiptIds) {
        try {
          console.log(`[resolveReceiptNo] Looking up receiptNo for ID ${rid} via pos-multi-receipt-print`);
          const detailData: any = await firstValueFrom(
            this.api.get('/api/platinum/pos-multi-receipt-print', { receiptId: String(rid) })
          );
          const items = Array.isArray(detailData) ? detailData : (detailData?.value || detailData?.items || []);
          if (items.length > 0 && items[0].receiptNo) {
            console.log(`[resolveReceiptNo] Resolved receiptNo "${items[0].receiptNo}" via pos-multi-receipt-print for ID ${rid}`);
            return String(items[0].receiptNo);
          }
        } catch (e: any) {
          console.warn(`[resolveReceiptNo] pos-multi-receipt-print lookup failed for ID ${rid}:`, e?.message);
        }
      }

      return `REC-${receiptIds[0]}`;
    }

    console.warn('[resolveReceiptNo] Could not extract receipt number from API response:', JSON.stringify(result).substring(0, 500));
    return 'N/A';
  }

  private async resolveMultipleReceiptNos(result: any, receiptIds: number[]): Promise<Map<number, string>> {
    const receiptNoMap = new Map<number, string>();
    if (!receiptIds.length) return receiptNoMap;

    try {
      const cashierId = this.cashierInfo()?.id || this.cashierInfo()?.cashier_ID || this.user()?.user_ID;
      if (cashierId) {
        const unreconciledList: any = await firstValueFrom(
          this.api.get('/api/platinum/billing-payment-day-end/cashier-receipt-unreconciled-list', { id: String(cashierId) })
        );
        const list = Array.isArray(unreconciledList) ? unreconciledList : (unreconciledList?.data || unreconciledList?.items || []);
        for (const rid of receiptIds) {
          const match = list.find((r: any) => r.id === rid || r.receiptId === rid || r.receiptID === rid);
          if (match?.receiptNo) {
            receiptNoMap.set(rid, String(match.receiptNo));
          }
        }
      }
    } catch (e: any) {
      console.warn(`[resolveMultipleReceiptNos] Unreconciled list lookup failed:`, e?.message);
    }

    for (const rid of receiptIds) {
      if (receiptNoMap.has(rid)) continue;
      try {
        const detailData: any = await firstValueFrom(
          this.api.get('/api/platinum/pos-multi-receipt-print', { receiptId: String(rid) })
        );
        const items = Array.isArray(detailData) ? detailData : (detailData?.value || detailData?.items || []);
        if (items.length > 0 && items[0].receiptNo) {
          receiptNoMap.set(rid, String(items[0].receiptNo));
        }
      } catch (e: any) {
        console.warn(`[resolveMultipleReceiptNos] pos-multi-receipt-print lookup failed for ID ${rid}:`, e?.message);
      }
    }

    console.log(`[resolveMultipleReceiptNos] Resolved ${receiptNoMap.size}/${receiptIds.length} receipt numbers`);
    return receiptNoMap;
  }

  getReceiptNo(data: any): string {
    if (!data) return 'N/A';
    const directNo = data?.receiptNo || data?.receiptNumber || data?.receipt_no || data?.ReceiptNo
      || data?.objData?.receiptNo || data?.result?.receiptNo || data?.data?.receiptNo;
    if (directNo && String(directNo) !== '0') return String(directNo);

    const ids = this.extractReceiptIds(data);
    if (ids.length > 0) return `REC-${ids[0]}`;

    return 'N/A';
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

  getMiscIconInfo(name: string): { icon: string; color: string; bg: string; label: string } {
    const n = (name || '').toLowerCase();
    const icons: Array<{ keys: string[]; icon: string; color: string; bg: string; label: string }> = [
      { keys: ['building', 'plan', 'architect', 'construction', 'erection'],
        icon: 'M3 21V9l9-6 9 6v12M9 21v-6h6v6',
        color: '#7c3aed', bg: '#f3f0ff', label: 'Building' },
      { keys: ['fire', 'ext of', 'extinguish', 'emergency', 'rescue', 'disaster'],
        icon: 'M12 2c1 3 3 5 3 8a6 6 0 0 1-6 6 6 6 0 0 1-6-6c0-3 2-5 3-8 1 2 3 3 3 5a2 2 0 0 0 4 0c0-2-1-3-1-5z',
        color: '#dc2626', bg: '#fef2f2', label: 'Fire' },
      { keys: ['inspection', 'inspect', 'compliance', 'audit', 'check'],
        icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
        color: '#0891b2', bg: '#ecfeff', label: 'Inspection' },
      { keys: ['occupation', 'certificate', 'permit', 'licence', 'license', 'approval'],
        icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4',
        color: '#059669', bg: '#ecfdf5', label: 'Certificate' },
      { keys: ['water', 'irrigation', 'meter', 'sewerage', 'sewer', 'drain', 'plumb'],
        icon: 'M12 2v6l-2 2v4a4 4 0 1 0 8 0v-4l-2-2V2',
        color: '#2563eb', bg: '#eff6ff', label: 'Water' },
      { keys: ['electric', 'power', 'energy', 'solar', 'prepaid', 'voltage'],
        icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
        color: '#d97706', bg: '#fffbeb', label: 'Electric' },
      { keys: ['refuse', 'waste', 'garbage', 'trash', 'recycl', 'clean', 'sanit'],
        icon: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
        color: '#16a34a', bg: '#f0fdf4', label: 'Waste' },
      { keys: ['road', 'street', 'traffic', 'transport', 'parking', 'vehicle', 'motor'],
        icon: 'M5 17h14M5 17a2 2 0 0 1-2-2V7h18v8a2 2 0 0 1-2 2M5 17l-1 4h2l1-4M19 17l1 4h-2l-1-4M7 11h4M13 11h4',
        color: '#64748b', bg: '#f8fafc', label: 'Transport' },
      { keys: ['park', 'garden', 'nature', 'sport', 'recreation', 'swim', 'pool', 'hall', 'community', 'facility', 'venue'],
        icon: 'M17 14c2 0 3 1 3 3s-1 3-3 3H7c-2 0-3-1-3-3s1-3 3-3M12 2v8M7.8 7.8L12 10l4.2-2.2',
        color: '#22c55e', bg: '#f0fdf4', label: 'Facilities' },
      { keys: ['health', 'clinic', 'medical', 'hospital', 'ambulance', 'pharmacy'],
        icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
        color: '#ef4444', bg: '#fef2f2', label: 'Health' },
      { keys: ['library', 'book', 'education', 'school', 'learn', 'training'],
        icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
        color: '#8b5cf6', bg: '#f5f3ff', label: 'Library' },
      { keys: ['rental', 'rent', 'lease', 'hire', 'tenant'],
        icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
        color: '#6366f1', bg: '#eef2ff', label: 'Rental' },
      { keys: ['rate', 'property', 'valuation', 'assess', 'levy', 'tariff'],
        icon: 'M2 20h20M5 20V10l7-6 7 6v10M9 20v-4h6v4',
        color: '#0f2b46', bg: '#e8edf2', label: 'Rates' },
      { keys: ['fine', 'penalty', 'infringement', 'contravention', 'summon'],
        icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
        color: '#ea580c', bg: '#fff7ed', label: 'Penalty' },
      { keys: ['advert', 'sign', 'banner', 'billboard', 'media'],
        icon: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
        color: '#0ea5e9', bg: '#f0f9ff', label: 'Advertising' },
      { keys: ['cemetery', 'burial', 'grave', 'funeral', 'memorial'],
        icon: 'M12 2v6M9 5h6M12 22V8M7 22h10M5 12h14',
        color: '#475569', bg: '#f1f5f9', label: 'Cemetery' },
      { keys: ['animal', 'dog', 'cat', 'pet', 'kennel', 'pound', 'vet'],
        icon: 'M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .137 1.217 1.5 2.5 3 2.5s2.529-.275 3-1M14 5.172C14 3.782 15.577 2.679 17.5 3c2.823.47 4.113 6.006 4 7-.137 1.217-1.5 2.5-3 2.5s-2.529-.275-3-1M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z',
        color: '#a855f7', bg: '#faf5ff', label: 'Animals' },
      { keys: ['housing', 'human settlement', 'subsidis', 'subsidi', 'low cost'],
        icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
        color: '#0d9488', bg: '#f0fdfa', label: 'Housing' },
      { keys: ['deposit', 'refund', 'guarantee', 'surety'],
        icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
        color: '#059669', bg: '#ecfdf5', label: 'Deposit' },
      { keys: ['tourism', 'museum', 'heritage', 'cultural', 'visitor'],
        icon: 'M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z',
        color: '#c2410c', bg: '#fff7ed', label: 'Tourism' },
      { keys: ['sundry', 'sundries', 'general', 'miscellaneous', 'other', 'various'],
        icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
        color: '#64748b', bg: '#f8fafc', label: 'Sundry' },
    ];

    for (const entry of icons) {
      if (entry.keys.some(k => n.includes(k))) {
        return entry;
      }
    }
    return {
      icon: 'M9 5H2v7M22 19h-7v-7M2 12a10 10 0 0 1 17.5-6.5M22 12A10 10 0 0 1 4.5 18.5',
      color: '#7c3aed', bg: '#f5f3ff', label: 'Payment'
    };
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
          accountStatus: merged.statusDesc || merged.status || merged.accountStatus || 'Active',
          billId: merged.billId || merged.bill_ID || 0,
          cutOffID: merged.cutOffID || merged.cutoff_ID || 0,
          cutOffAmount: merged.cutOffAmount || 0,
          debtAmount: merged.debtAmount || 0,
          debtArrangementId: merged.debtArrangementId || merged.debtArrangement_ID || 0,
          sundryDebtorsId: merged.sundryDebtorsId || merged.sundryDebtors_ID || 0,
          billingCycleId: merged.billingCycleId || merged.billingCycle_ID || 0,
          hasPrepaidMeter: !!meterNo,
          prepaidMeterNo: meterNo,
          prepaidType: '',
          accountBalance: row.outstandingAmount,
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
