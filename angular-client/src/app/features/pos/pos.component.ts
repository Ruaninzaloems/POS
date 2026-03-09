import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface TransactionItem {
  id: string;
  accountId: number;
  accountNumber: string;
  name: string;
  address: string;
  amountDue: number;
  amountToPay: number;
  billId: number;
  cutOffID: number;
  cutOffAmount: number;
  debtAmount: number;
  debtArrangementId: number;
  sundryDebtorsId: number;
  billingCycleId: number;
  originalData: any;
}

interface SearchResult {
  account_ID: number;
  accountID: number;
  accountNo: string;
  accountNumber: string;
  name: string;
  consumerName: string;
  outstandingAmount: number;
  outStandingAmt: number;
  balance: number;
  totalDue: number;
  status: string;
  accountStatus: string;
  address: string;
  physicalAddress: string;
  meterNo: string;
  accountType: string;
  billId: number;
  cutOffID: number;
  cutOffAmount: number;
  debtAmount: number;
  debtArrangementId: number;
  sundryDebtorsId: number;
  billingCycleId: number;
  [key: string]: any;
}

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

interface ClearanceData {
  clearanceId: string;
  status: string;
  ownerName: string;
  propertyDesc: string;
  accounts: ClearanceAccount[];
  totalDue: number;
}

interface ClearanceAccount {
  accountId: number;
  accountNumber: string;
  name: string;
  amount: number;
  paymentAmount: number;
  serviceType: string;
}

type PaymentMode = 'account' | 'clearance' | 'prepaid' | 'misc';
type TenderType = 'cash' | 'card' | 'cheque' | 'eft';

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

  user = this.auth.user;
  activeMode = signal<PaymentMode>('account');

  searchQuery = signal('');
  searchLoading = signal(false);
  searchResults = signal<SearchResult[]>([]);
  searchActive = signal(false);
  accountDetailLoading = signal(false);

  transactionItems = signal<TransactionItem[]>([]);

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

  receiptData = signal<any>(null);
  showReceipt = signal(false);
  printingReceipt = signal(false);

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
  clearanceData = signal<ClearanceData | null>(null);
  clearanceError = signal('');

  prepaidMeterNo = signal('');
  prepaidAmount = signal(0);
  prepaidSearching = signal(false);
  prepaidBreakdown = signal<any>(null);
  prepaidError = signal('');
  prepaidProcessing = signal(false);
  prepaidToken = signal<any>(null);
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
  miscProcessing = signal(false);

  paymentOptions = signal<any[]>([]);
  paymentTypes = signal<any[]>([]);
  cashierInfo = signal<any>(null);

  sessionActive = signal(false);
  sessionLoading = signal(true);
  sessionStatus = signal<'none' | 'active' | 'pending_approval' | 'returned' | 'closed'>('none');
  sessionReturnReason = signal('');
  receiptRange = signal<any>(null);

  totalDue = computed(() => this.transactionItems().reduce((sum, item) => sum + item.amountDue, 0));
  totalToPay = computed(() => this.transactionItems().reduce((sum, item) => sum + item.amountToPay, 0));
  hasItems = computed(() => this.transactionItems().length > 0);

  totalTendered = computed(() => {
    return this.cashAmount() + this.cardAmount() + this.chequeAmount() + this.eftAmount();
  });

  changeAmount = computed(() => Math.max(0, this.totalTendered() - this.totalToPay()));

  shortfall = computed(() => {
    const diff = this.totalToPay() - this.totalTendered();
    return diff > 0.005 ? diff : 0;
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

  denominations = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05];

  private cashierCheckDone = false;

  ngOnInit(): void {
    this.loadCashierInfo();
    this.loadBanks();
  }

  ngOnDestroy(): void {}

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

      const [cashierData, validateData] = await Promise.all([
        firstValueFrom(this.api.get<any>('/api/platinum/receipt-prepaid/active-cashier-details', { userId: String(userId) })).catch(() => null),
        firstValueFrom(this.api.get<any>('/api/platinum/receipt-prepaid/validate-cashier', { userId: String(userId), finYear })).catch(() => null),
      ]);

      const resolvedFinYear = finYear || (cashierData?.finYear ? String(cashierData.finYear) : '');
      const hasPendingDayEnd = validateData?.hasPendingDayEnd === true;
      const hasDayEndReturned = validateData?.hasDayEndReturned === true;
      const isActive = validateData?.isActive === true || (cashierData && !cashierData._error && cashierData.cashOffice_ID);

      if (hasDayEndReturned) {
        this.sessionActive.set(true);
        this.sessionStatus.set('returned');
        this.sessionReturnReason.set(validateData?.returnReason || validateData?.declineReason || '');
        this.cashierInfo.set({ ...cashierData, finYear: resolvedFinYear });
        this.cashierCheckDone = true;
        this.loadPaymentConfig();
        this.sessionLoading.set(false);
        return;
      }

      if (hasPendingDayEnd) {
        this.sessionActive.set(false);
        this.sessionStatus.set('pending_approval');
        this.sessionReturnReason.set('');
        this.cashierInfo.set({ ...cashierData, finYear: resolvedFinYear });
        this.sessionLoading.set(false);
        return;
      }

      if (cashierData && !cashierData._error && isActive) {
        this.cashierInfo.set({
          ...cashierData,
          finYear: resolvedFinYear,
        });
        this.sessionActive.set(true);
        this.sessionStatus.set('active');
        this.cashierCheckDone = true;
        this.loadPaymentConfig();

        if (validateData?.receiptRange) {
          this.receiptRange.set(validateData.receiptRange);
        }
      } else {
        this.cashierInfo.set({ finYear: resolvedFinYear });
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

  async search(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Please complete cashier setup first.');
      return;
    }
    const query = this.searchQuery().trim();
    if (!query || query.length < 2) return;
    this.searchLoading.set(true);
    this.searchActive.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: query })
      );
      const results = Array.isArray(data) ? data : data?.accounts || data?.results || data?.data || [];
      this.searchResults.set(results);
    } catch {
      this.searchResults.set([]);
      this.toast.error('Search failed. Please try again.');
    } finally {
      this.searchLoading.set(false);
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.search();
    if (event.key === 'Escape') this.clearSearch();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchActive.set(false);
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
    return r?.address || r?.physicalAddress || r?.deliveryAddress || r?.locationAddress || '';
  }

  getAccountStatus(r: any): string {
    return r?.status || r?.accountStatus || r?.statusDesc || 'Active';
  }

  getAccountId(r: any): number {
    return r?.account_ID || r?.accountID || r?.accountId || 0;
  }

  async selectAccount(result: any): Promise<void> {
    const accountId = this.getAccountId(result);
    const accountNo = this.getAccountNo(result);
    const existing = this.transactionItems().find(i => i.accountId === accountId || i.accountNumber === accountNo);
    if (existing) {
      this.toast.error('This account is already in the transaction.');
      this.clearSearch();
      return;
    }

    this.accountDetailLoading.set(true);
    let detailData: any = null;
    try {
      detailData = await firstValueFrom(
        this.api.get<any>('/api/platinum/receipt-prepaid/cons-account-details', { accountId: String(accountId || accountNo) })
      );
    } catch (e: any) {
      this.toast.show('Could not load full account details, using search data.', 'info');
    }
    this.accountDetailLoading.set(false);

    const merged = { ...result, ...(detailData && !detailData._error ? detailData : {}) };
    const balance = this.getAccountBalance(merged);

    const item: TransactionItem = {
      id: crypto.randomUUID(),
      accountId: accountId,
      accountNumber: accountNo,
      name: this.getAccountName(merged),
      address: this.getAccountAddress(merged),
      amountDue: balance,
      amountToPay: 0,
      billId: merged.billId || merged.bill_ID || 0,
      cutOffID: merged.cutOffID || merged.cutoff_ID || 0,
      cutOffAmount: merged.cutOffAmount || 0,
      debtAmount: merged.debtAmount || 0,
      debtArrangementId: merged.debtArrangementId || merged.debtArrangement_ID || 0,
      sundryDebtorsId: merged.sundryDebtorsId || merged.sundryDebtors_ID || 0,
      billingCycleId: merged.billingCycleId || merged.billingCycle_ID || 0,
      originalData: merged,
    };
    this.transactionItems.update(items => [...items, item]);
    this.clearSearch();
    this.toast.success(`Added ${item.name} (${item.accountNumber})`);
  }

  updateItemAmount(id: string, amount: number): void {
    this.transactionItems.update(items =>
      items.map(item => item.id === id ? { ...item, amountToPay: Math.max(0, amount || 0) } : item)
    );
  }

  removeItem(id: string): void {
    this.transactionItems.update(items => items.filter(item => item.id !== id));
  }

  payFullAmount(id: string): void {
    this.transactionItems.update(items =>
      items.map(item => item.id === id ? { ...item, amountToPay: item.amountDue } : item)
    );
  }

  payAllFull(): void {
    this.transactionItems.update(items =>
      items.map(item => ({ ...item, amountToPay: item.amountDue }))
    );
  }

  clearTransaction(): void {
    this.transactionItems.set([]);
    this.resetTenderFields();
    this.showPaymentPanel.set(false);
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

  openPaymentPanel(): void {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Please complete cashier setup first.');
      return;
    }
    if (!this.hasItems() || this.totalToPay() <= 0) {
      this.toast.error('Add items and enter amounts first.');
      return;
    }
    this.resetTenderFields();
    if (this.canTenderCash()) {
      this.cashAmount.set(this.totalToPay());
      this.activeTender.set('cash');
    } else if (this.canTenderCard()) {
      this.cardAmount.set(this.totalToPay());
      this.activeTender.set('card');
    } else if (this.canTenderCheque()) {
      this.chequeAmount.set(this.totalToPay());
      this.activeTender.set('cheque');
    } else if (this.canTenderEft()) {
      this.eftAmount.set(this.totalToPay());
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
    const remaining = this.totalToPay() - this.cardAmount() - this.chequeAmount() - this.eftAmount();
    this.cashAmount.set(Math.max(0, Math.round(remaining * 100) / 100));
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

  getPaymentTypeId(): number {
    const types = this.paymentTypes();
    if (this.cardAmount() > 0) {
      const cardType = types.find((t: any) => (t.paymentTypeName || t.name || '').toLowerCase().includes('card'));
      return cardType?.paymentTypeId || cardType?.payment_type_ID || 3;
    }
    if (this.chequeAmount() > 0) {
      const chequeType = types.find((t: any) => (t.paymentTypeName || t.name || '').toLowerCase().includes('cheque'));
      return chequeType?.paymentTypeId || chequeType?.payment_type_ID || 2;
    }
    if (this.eftAmount() > 0) {
      const eftType = types.find((t: any) => (t.paymentTypeName || t.name || '').toLowerCase().includes('eft'));
      return eftType?.paymentTypeId || eftType?.payment_type_ID || 5;
    }
    const cashType = types.find((t: any) => (t.paymentTypeName || t.name || '').toLowerCase().includes('cash'));
    return cashType?.paymentTypeId || cashType?.payment_type_ID || 1;
  }

  getPaymentOptionId(): number {
    const options = this.paymentOptions();
    if (options.length > 0) {
      return options[0]?.paymentOptionId || options[0]?.payment_option_ID || options[0]?.id || 1;
    }
    return 1;
  }

  getPaymentTypeName(): string {
    const id = this.getPaymentTypeId();
    const types = this.paymentTypes();
    const found = types.find((t: any) => (t.paymentTypeId || t.payment_type_ID) === id);
    return found?.paymentTypeName || found?.name || (id === 3 ? 'CreditCard' : id === 2 ? 'Cheque' : id === 5 ? 'EFT' : 'Cash');
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

    this.processingPayment.set(true);
    const userId = this.user()?.user_ID;
    const ci = this.cashierInfo();
    const finYear = ci?.finYear || '';
    const now = new Date();
    const receiptDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
    const items = this.transactionItems();
    const paymentType = this.getPaymentTypeId();
    const cardNum = this.cardNumber().replace(/\s/g, '');

    try {
      let result: any;
      if (items.length === 1) {
        const item = items[0];
        const payload = {
          account: {
            account_ID: item.accountId,
            accountNumber: item.accountNumber,
            name: item.name,
            outStandingAmt: item.amountDue,
            billId: item.billId,
            cutOffID: item.cutOffID,
            cutOffAmount: item.cutOffAmount,
            debtAmount: item.debtAmount,
            debtArrangementId: item.debtArrangementId,
            sundryDebtorsId: item.sundryDebtorsId,
            billingCycleId: item.billingCycleId,
          },
          requestModel: {
            finYear,
            receiptDate,
            totalAmount: item.amountToPay,
            tenderAmount: this.totalTendered(),
            changeAmount: this.changeAmount(),
            paymentType,
            paymentOption: this.getPaymentOptionId(),
            outStandingAmount: item.amountDue,
            cutOffID: item.cutOffID,
            cutOffAmount: item.cutOffAmount,
            debtAmount: item.debtAmount,
            debtArrangementId: item.debtArrangementId,
            sundryDebtorsId: item.sundryDebtorsId,
            cardNumber: cardNum,
            apiTransactionID: 0,
            isReconciled: 0,
            isCancelled: 0,
          },
        };
        result = await firstValueFrom(
          this.api.post(`/api/platinum/billing-payment/submit-consumer-payment/${userId}`, payload)
        );
      } else {
        const payload = {
          accounts: items.map(item => ({
            accountID: item.accountId,
            account_ID: item.accountId,
            accountNumber: item.accountNumber,
            name: item.name,
            outstandingAmount: item.amountDue,
            outStandingAmt: item.amountDue,
            paymentAmount: item.amountToPay,
            billId: item.billId,
            cutOffID: item.cutOffID,
            cutOffAmount: item.cutOffAmount,
            debtAmount: item.debtAmount,
            debtArrangementId: item.debtArrangementId,
            sundryDebtorsId: item.sundryDebtorsId,
            billingCycleId: item.billingCycleId,
          })),
          requestModel: {
            finYear,
            receiptDate,
            totalAmount: this.totalToPay(),
            tenderAmount: this.totalTendered(),
            changeAmount: this.changeAmount(),
            paymentType,
            paymentOption: this.getPaymentOptionId(),
            outStandingAmount: this.totalDue(),
            cardNumber: cardNum,
            apiTransactionID: 0,
            isReconciled: 0,
            isCancelled: 0,
          },
        };
        result = await firstValueFrom(
          this.api.post(`/api/platinum/billing-payment/submit-multiple-payment/${userId}`, payload)
        );
      }

      this.receiptData.set(result);
      this.showReceipt.set(true);
      this.showPaymentPanel.set(false);
      this.toast.success('Payment processed successfully!');
      this.transactionItems.set([]);
      this.resetTenderFields();
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Payment processing failed.');
    } finally {
      this.processingPayment.set(false);
    }
  }

  async printReceipt(): Promise<void> {
    const rd = this.receiptData();
    if (!rd) return;
    this.printingReceipt.set(true);
    try {
      const receiptNo = rd.receiptNumber || rd.receipt_no || rd.receiptNo || '';
      const userId = this.user()?.user_ID;
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment/print-receipt', {
          receiptNo, userId, isPOS: true,
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
      } else {
        this.toast.success('Receipt sent to printer.');
      }
    } catch {
      this.toast.error('Failed to print receipt.');
    } finally {
      this.printingReceipt.set(false);
    }
  }

  closeReceipt(): void {
    this.showReceipt.set(false);
    this.receiptData.set(null);
  }

  openCancelDialog(): void {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Please complete cashier setup first.');
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
      this.toast.error('No active cashier session. Cannot cancel receipts.');
      return;
    }
    if (!this.cancelReceiptNo()) {
      this.toast.error('Enter a receipt number to cancel.');
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
      this.toast.error('No active cashier session. Please complete cashier setup first.');
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
      this.toast.error('No active cashier session. Cannot submit drop box.');
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
          reference: this.dropBoxReference(),
          userId: this.user()?.user_ID,
          cashierId: this.cashierInfo()?.id || this.cashierInfo()?.cashier_ID,
          cashOfficeId: this.cashierInfo()?.cashOffice_ID,
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

  async searchClearance(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Please complete cashier setup first.');
      return;
    }
    const id = this.clearanceSearchId().trim();
    if (!id) return;
    this.clearanceSearching.set(true);
    this.clearanceError.set('');
    this.clearanceData.set(null);
    try {
      const paddedId = id.padStart(12, '0');
      const [dataResult, accountsResult] = await Promise.all([
        firstValueFrom(this.api.post<any>('/api/platinum/billing-payment-clearance/get-clearance-data', { clearanceId: paddedId })),
        firstValueFrom(this.api.post<any>('/api/platinum/billing-payment-clearance/get-accounts-for-clearance', { clearanceId: paddedId, userId: this.user()?.user_ID })),
      ]);
      const dataItems = dataResult?.items || (Array.isArray(dataResult) ? dataResult : []);
      const accounts = accountsResult?.items || (Array.isArray(accountsResult) ? accountsResult : []);
      if (dataItems.length === 0 && accounts.length === 0) {
        this.clearanceError.set('No clearance certificate found with this ID.');
        return;
      }
      const info = dataItems[0] || {};
      this.clearanceData.set({
        clearanceId: paddedId,
        status: info.status || info.statusDesc || 'Pending',
        ownerName: info.name || info.ownerName || '',
        propertyDesc: info.propertyDesc || info.address || '',
        accounts: accounts.map((a: any) => ({
          accountId: a.accountID || a.account_ID || 0,
          accountNumber: a.accountNumber || a.account_no || '',
          name: a.name || '',
          amount: Number(a.amount || a.outstandingAmount || 0),
          paymentAmount: Number(a.paymentAmount || a.amount || 0),
          serviceType: a.serviceType || a.description || '',
        })),
        totalDue: accounts.reduce((s: number, a: any) => s + Number(a.paymentAmount || a.amount || 0), 0),
      });
    } catch (e: any) {
      this.clearanceError.set(e?.error?.message || 'Clearance search failed.');
    } finally {
      this.clearanceSearching.set(false);
    }
  }

  async submitClearancePayment(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Cannot process payments.');
      return;
    }
    const cd = this.clearanceData();
    if (!cd) return;
    this.processingPayment.set(true);
    try {
      const userId = this.user()?.user_ID;
      const ci = this.cashierInfo();
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment-clearance/submit-payment', {
          clearanceId: cd.clearanceId,
          clearance_ID: cd.clearanceId,
          userId,
          cashierId: ci?.id || ci?.cashier_ID || userId,
          cashOfficeId: ci?.cashOffice_ID,
          paidAmount: cd.totalDue,
          totalAmount: cd.totalDue,
          paymentTypeId: this.getPaymentTypeId(),
          cardNumber: this.cardNumber().replace(/\s/g, ''),
          chequeNo: this.chequeNumber(),
          bankBranchCode: this.banks().find(b => b.bankID === this.chequeBankId())?.branchCode || '',
          finYear: ci?.finYear || '',
        })
      );
      this.receiptData.set(result);
      this.showReceipt.set(true);
      this.clearanceData.set(null);
      this.clearanceSearchId.set('');
      this.toast.success('Clearance payment processed successfully!');
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Clearance payment failed.');
    } finally {
      this.processingPayment.set(false);
    }
  }

  async loadPrepaidServiceTypes(): Promise<void> {
    try {
      const data: any = await firstValueFrom(
        this.api.get<any>('/api/platinum/receipt-prepaid/service-type-wise-prepaid-list')
      );
      this.prepaidServiceTypes.set(Array.isArray(data) ? data : []);
    } catch (e: any) {
      this.toast.error('Failed to load prepaid service types.');
    }
  }

  async searchPrepaid(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Please complete cashier setup first.');
      return;
    }
    const meter = this.prepaidMeterNo().trim();
    if (!meter) return;
    this.prepaidSearching.set(true);
    this.prepaidError.set('');
    this.prepaidBreakdown.set(null);
    this.prepaidToken.set(null);
    try {
      if (!this.prepaidAmount() || this.prepaidAmount() <= 0) {
        this.prepaidError.set('Please enter a valid prepaid amount.');
        this.prepaidSearching.set(false);
        return;
      }
      if (!this.prepaidSelectedService()) {
        this.prepaidError.set('Please select a service type first.');
        this.prepaidSearching.set(false);
        return;
      }
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/receipt-prepaid/utilipay-breakdown-request', {
          meterNumber: meter,
          amount: this.prepaidAmount(),
          serviceType: this.prepaidSelectedService(),
        })
      );
      if (result && !result._error) {
        this.prepaidBreakdown.set(result);
      } else {
        this.prepaidError.set(result?.message || 'Could not get prepaid breakdown.');
      }
    } catch (e: any) {
      this.prepaidError.set(e?.error?.message || 'Prepaid search failed.');
    } finally {
      this.prepaidSearching.set(false);
    }
  }

  async purchasePrepaidToken(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Cannot purchase tokens.');
      return;
    }
    const bd = this.prepaidBreakdown();
    if (!bd) return;
    this.prepaidProcessing.set(true);
    try {
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/receipt-prepaid/utilipay-token-request', {
          meterNumber: this.prepaidMeterNo(),
          amount: this.prepaidAmount(),
          serviceType: this.prepaidSelectedService(),
          ...bd,
        })
      );
      if (result && !result._error) {
        this.prepaidToken.set(result);
        this.toast.success('Prepaid token purchased successfully!');
      } else {
        this.toast.error(result?.message || 'Token purchase failed.');
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Token purchase failed.');
    } finally {
      this.prepaidProcessing.set(false);
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
    } catch (e: any) {
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
      this.miscScoaItems.set(arr.map((s: any) => ({
        scoaItemId: s.scoaItemId || s.scoa_item_ID || s.scoaItem || s.id || 0,
        scoaItemName: s.scoaItemName || s.description || s.name || '',
        description: s.description || s.scoaItemName || '',
        amount: s.amount || 0,
        isVatable: s.isVatable || false,
        vatPercentage: s.vatPercentage || 0,
      })));
    } catch (e: any) {
      this.toast.error('Failed to load SCOA items for this group.');
    } finally {
      this.miscScoaLoading.set(false);
    }
  }

  async submitMiscPayment(): Promise<void> {
    if (!this.sessionActive()) {
      this.toast.error('No active cashier session. Cannot process payments.');
      return;
    }
    if (!this.miscSelectedGroupId() || !this.miscSelectedScoaId() || this.miscAmount() <= 0) {
      this.toast.error('Select a group, item, and enter an amount.');
      return;
    }
    this.miscProcessing.set(true);
    const userId = this.user()?.user_ID;
    const ci = this.cashierInfo();
    const scoaItem = this.miscScoaItems().find(s => s.scoaItemId === this.miscSelectedScoaId());
    const vatPct = scoaItem?.vatPercentage || 0;
    const isVatable = scoaItem?.isVatable || false;
    const amount = this.miscAmount();
    const vatAmount = isVatable ? Math.round(amount * vatPct / (100 + vatPct) * 100) / 100 : 0;

    try {
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment-miscellaneous/submit', {
          userId,
          cashierId: ci?.id || ci?.cashier_ID || userId,
          cashOfficeId: ci?.cashOffice_ID,
          finYear: ci?.finYear || '',
          miscellaneousPaymentGroup: this.miscSelectedGroupId(),
          scoaItem: this.miscSelectedScoaId(),
          description: this.miscDescription() || scoaItem?.scoaItemName || '',
          lastName: this.miscLastName(),
          initials: this.miscInitials(),
          totalAmount: amount,
          amount: amount - vatAmount,
          vatAmount,
          vatPercentage: vatPct,
          isVatable,
          tenderAmount: amount,
          changeAmount: 0,
          paymentType: this.getPaymentTypeId(),
          receiptDate: new Date().toISOString(),
          cardNo: this.cardNumber().replace(/\s/g, ''),
          expiryDate: this.cardExpiry(),
          chequeNo: this.chequeNumber(),
          bankBranch: this.banks().find(b => b.bankID === this.chequeBankId())?.bankName || '',
          bankBranchCode: this.banks().find(b => b.bankID === this.chequeBankId())?.branchCode || '',
          accHolderName: this.chequeName(),
        })
      );
      this.receiptData.set(result);
      this.showReceipt.set(true);
      this.toast.success('Miscellaneous payment processed!');
      this.miscAmount.set(0);
      this.miscDescription.set('');
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Miscellaneous payment failed.');
    } finally {
      this.miscProcessing.set(false);
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
    return amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getReceiptNo(data: any): string {
    return data?.receiptNumber || data?.receipt_no || data?.receiptNo || data?.ReceiptNo || 'N/A';
  }
}
