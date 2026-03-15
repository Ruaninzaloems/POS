import { Component, signal, computed, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface DenominationDef {
  key: string;
  label: string;
  value: number;
}

const NOTE_DENOMINATIONS: DenominationDef[] = [
  { key: 'n200', label: 'R200', value: 200 },
  { key: 'n100', label: 'R100', value: 100 },
  { key: 'n50', label: 'R50', value: 50 },
  { key: 'n20', label: 'R20', value: 20 },
  { key: 'n10', label: 'R10', value: 10 },
];

const COIN_DENOMINATIONS: DenominationDef[] = [
  { key: 'co5', label: 'R5', value: 5 },
  { key: 'co2', label: 'R2', value: 2 },
  { key: 'co1', label: 'R1', value: 1 },
  { key: 'c50', label: '50c', value: 0.50 },
  { key: 'c20', label: '20c', value: 0.20 },
  { key: 'c10', label: '10c', value: 0.10 },
  { key: 'c5', label: '5c', value: 0.05 },
  { key: 'c1', label: '1c', value: 0.01 },
];

@Component({
  selector: 'app-cashier-day-end',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cashier-day-end.component.html',
  styleUrl: './cashier-day-end.component.css'
})
export class CashierDayEndComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  user = this.auth.user;

  noteDenominations = NOTE_DENOMINATIONS;
  coinDenominations = COIN_DENOMINATIONS;

  sessionLoading = signal(true);
  sessionActive = signal(false);
  sessionCashierId = signal<number | null>(null);
  sessionCashierName = signal('');
  sessionOfficeName = signal('');
  sessionOfficeId = signal<number | null>(null);
  sessionCashFloat = signal(0);

  cashierDetails = signal<any>(null);
  isLoadingDetails = signal(false);

  chequeList = signal<any[]>([]);
  cardList = signal<any[]>([]);
  dropBoxList = signal<any[]>([]);
  reconcileList = signal<any[]>([]);
  isLoadingReceipts = signal(false);

  denominations = signal<Record<string, number>>({
    n200: 0, n100: 0, n50: 0, n20: 0, n10: 0,
    c1: 0, c5: 0, c10: 0, c20: 0, c50: 0,
    co1: 0, co2: 0, co5: 0,
  });

  totalCashAmt = signal(0);
  totalCreditAmt = signal(0);
  totalChequeAmt = signal(0);
  reason = signal('');
  isSaving = signal(false);
  showTransactionHistory = signal(false);
  enableDenominationCounting = signal(true);

  activeSection = signal<'takings' | 'cancellation' | 'dropbox'>('takings');

  cancelSearchQuery = signal('');
  cancelSearching = signal(false);
  cancelFoundReceipt = signal<any>(null);
  cancelSearchError = signal('');
  cancelReason = signal('');
  isCancellingReceipt = signal(false);
  showConfirmDialog = signal(false);
  confirmDialogAction = signal<'submit' | 'cancel' | null>(null);

  today = (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })();

  totalNotes = computed(() =>
    NOTE_DENOMINATIONS.reduce((sum, d) => sum + (this.denominations()[d.key] || 0) * d.value, 0)
  );

  totalCoins = computed(() =>
    COIN_DENOMINATIONS.reduce((sum, d) => sum + (this.denominations()[d.key] || 0) * d.value, 0)
  );

  calculatedCashTotal = computed(() => this.totalNotes() + this.totalCoins());

  cashOnHand = computed(() =>
    this.enableDenominationCounting() ? this.calculatedCashTotal() : this.totalCashAmt()
  );

  dropBoxTotal = computed(() =>
    this.dropBoxList().reduce((s, r) => s + (Number(r.amount) || 0), 0)
  );

  totalCashOnHandPlusDropBox = computed(() => this.cashOnHand() + this.dropBoxTotal());

  grandTotal = computed(() =>
    this.totalCashOnHandPlusDropBox() + this.totalCreditAmt()
  );

  cancellableReceipts = computed(() =>
    this.reconcileList().filter(r => !this.isCancelled(r))
  );

  ngOnInit(): void {
    this.detectSession();
  }

  async detectSession(): Promise<void> {
    this.sessionLoading.set(true);
    try {
      const userId = this.user()?.user_ID;
      const finYear = this.user()?.finYear || '';
      if (!userId) {
        this.sessionActive.set(false);
        return;
      }

      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/auth/active-cashier-by-userid', {
          userid: String(userId),
          finYear
        })
      ).catch(() => null);

      if (!data || data._error) {
        this.sessionActive.set(false);
        return;
      }

      const isActive = data.isActive === true || data.active === true;
      const hasPendingDayEnd = data.hasPendingDayEnd === true;
      const hasDayEndReturned = data.hasDayEndReturned === true;

      if (!isActive && !hasPendingDayEnd && !hasDayEndReturned) {
        this.sessionActive.set(false);
        return;
      }

      this.sessionActive.set(true);
      const cashierId = data.cashierId || data.details?.id || data.id || null;
      this.sessionCashierId.set(cashierId ? Number(cashierId) : null);

      const name = data.cashierName || data.details?.userName || data.details?.name || this.user()?.userName || '';
      this.sessionCashierName.set(name);

      const office = data.officeName || data.details?.const_CashOffice?.cashOfficeDesc || data.cashOfficeName || '';
      this.sessionOfficeName.set(office);

      const officeId = data.officeId || data.details?.officeId || data.details?.const_CashOffice?.cashOffice_ID || null;
      this.sessionOfficeId.set(officeId ? Number(officeId) : null);

      const cashFloat = data.cashFloat || data.details?.cashFloat || 0;
      this.sessionCashFloat.set(Number(cashFloat) || 0);

      if (cashierId) {
        this.loadCashierDetails(cashierId);
        this.loadReceiptData(cashierId);
      }
    } catch {
      this.sessionActive.set(false);
    } finally {
      this.sessionLoading.set(false);
    }
  }

  async loadCashierDetails(cashierId: number): Promise<void> {
    this.isLoadingDetails.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/billing-payment-day-end/get-cashier-details', { id: String(cashierId) })
      );
      this.cashierDetails.set(data);
      if (data) {
        const office = data.cashOfficeName || data.cash_office || data.cashOffice || data.officeName || data.const_CashOffice?.cashOfficeDesc || '';
        if (office && !this.sessionOfficeName()) this.sessionOfficeName.set(office);
      }
    } catch (e) {
      console.error('Failed to load cashier details', e);
    } finally {
      this.isLoadingDetails.set(false);
    }
  }

  async loadReceiptData(cashierId: number): Promise<void> {
    this.isLoadingReceipts.set(true);
    const userId = String(this.user()?.user_ID || '');

    try {
      const [cheques, cards, dropBoxes, reconciles]: any[] = await Promise.all([
        firstValueFrom(this.api.post(`/api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list?id=${cashierId}`, {})).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/billing-payment-day-end/get-cashier-receipt-card-list?id=${cashierId}`, {})).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list?id=${cashierId}`, {})).catch(() => []),
        firstValueFrom(this.api.get('/api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list', { userId, id: String(cashierId) })).catch(() => []),
      ]);

      const chequeItems = this.extractItems(cheques);
      const cardItems = this.extractItems(cards);
      const dropBoxItems = this.extractItems(dropBoxes);
      const reconcileItems = this.extractItems(reconciles);

      this.chequeList.set(chequeItems);
      this.cardList.set(cardItems);
      this.dropBoxList.set(dropBoxItems);
      this.reconcileList.set(reconcileItems);

      this.totalChequeAmt.set(chequeItems.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0));
      this.totalCreditAmt.set(cardItems.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0));
    } catch (e) {
      console.error('Failed to load receipt data', e);
    } finally {
      this.isLoadingReceipts.set(false);
    }
  }

  updateDenomination(key: string, count: number): void {
    this.denominations.update(prev => ({ ...prev, [key]: Math.max(0, count) }));
  }

  getDenominationCount(key: string): number {
    return this.denominations()[key] || 0;
  }

  getDenominationTotal(key: string, value: number): number {
    return (this.denominations()[key] || 0) * value;
  }

  requestSaveReconcile(): void {
    const cashierId = this.sessionCashierId();
    if (!cashierId) {
      this.toast.error('No active session found. Cannot submit reconciliation.');
      return;
    }
    if (!this.sessionActive()) {
      this.toast.error('Session is not active. Please start a session first.');
      return;
    }
    const finYear = this.user()?.finYear;
    if (!finYear) {
      this.toast.error('Financial year missing from your session. Please log in again.');
      return;
    }
    this.confirmDialogAction.set('submit');
    this.showConfirmDialog.set(true);
  }

  dismissConfirmDialog(): void {
    this.showConfirmDialog.set(false);
    this.confirmDialogAction.set(null);
  }

  confirmDialogAccepted(): void {
    if (this.isSaving() || this.isCancellingReceipt()) return;
    const action = this.confirmDialogAction();
    this.showConfirmDialog.set(false);
    this.confirmDialogAction.set(null);
    if (action === 'submit') {
      this.handleSaveReconcile();
    } else if (action === 'cancel') {
      this.handleRequestCancel();
    }
  }

  async handleSaveReconcile(): Promise<void> {
    if (this.isSaving()) return;
    const cashierId = this.sessionCashierId();
    if (!cashierId) { this.toast.error('No active session found.'); return; }
    const finYear = this.user()?.finYear;
    if (!finYear) { this.toast.error('Financial year missing. Please log in again.'); return; }

    this.isSaving.set(true);
    try {
      const userId = this.user()?.user_ID || '';
      const denoms = this.enableDenominationCounting() ? this.denominations() : {
        n200: 0, n100: 0, n50: 0, n20: 0, n10: 0,
        c1: 0, c5: 0, c10: 0, c20: 0, c50: 0,
        co1: 0, co2: 0, co5: 0,
      };
      const payload = {
        cashierId: Number(cashierId),
        reason: this.reason() || null,
        totalCashAmt: this.cashOnHand(),
        totalChequeAmt: this.totalChequeAmt(),
        totalCoins: this.enableDenominationCounting() ? this.totalCoins() : 0,
        totalCreditAmt: this.totalCreditAmt(),
        totalAmt: this.grandTotal(),
        n10: denoms['n10'] || 0,
        n20: denoms['n20'] || 0,
        n50: denoms['n50'] || 0,
        n100: denoms['n100'] || 0,
        n200: denoms['n200'] || 0,
        co1: denoms['co1'] || 0,
        co2: denoms['co2'] || 0,
        co5: denoms['co5'] || 0,
        c1: denoms['c1'] || 0,
        c5: denoms['c5'] || 0,
        c10: denoms['c10'] || 0,
        c20: denoms['c20'] || 0,
        c50: denoms['c50'] || 0,
        finyear: finYear,
      };

      console.log('[DayEnd] Step 1: save-reconcile-data payload:', JSON.stringify(payload));
      const result: any = await firstValueFrom(
        this.api.post(`/api/platinum/billing-payment-day-end/save-reconcile-data?userId=${userId}`, payload)
      );
      console.log('[DayEnd] Step 1 response:', JSON.stringify(result));

      if (result?.error || result?.isError === true || result?.success === false) {
        const errMsg = result?.error || result?.message || result?.errorMessage || 'API rejected the submission.';
        throw new Error(errMsg);
      }

      try {
        console.log('[DayEnd] Step 2: validate-cashbook for cashier', cashierId);
        await firstValueFrom(
          this.api.post('/api/platinum/auth-day-end/validate-cashbook', { cashierId: Number(cashierId) })
        );
        console.log('[DayEnd] validate-cashbook passed');
      } catch (valErr: any) {
        console.warn('[DayEnd] validate-cashbook warning (continuing):', valErr?.message);
        this.toast.warning('Cashbook validation had a warning — submission will continue.');
      }

      const cashierOfficeId = this.sessionOfficeId() || Number(
        this.cashierDetails()?.officeId ||
        this.cashierDetails()?.cashOffice_ID ||
        this.cashierDetails()?.const_CashOffice?.cashOffice_ID || 1
      );

      let cashBookId = 0;
      try {
        const cashbooks: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end/cashbook-list'));
        const books = Array.isArray(cashbooks) ? cashbooks : [];
        if (books.length > 0) {
          const match = books.find((b: any) => Number(b.cashOfficeId || b.cashOffice_ID) === Number(cashierOfficeId));
          cashBookId = match?.id || match?.cashBookId || match?.cashBook_ID || books[0]?.id || books[0]?.cashBookId || 1;
          console.log('[DayEnd] Resolved cashBookId from cashbook-list:', cashBookId);
        } else {
          cashBookId = 1;
        }
      } catch (cbErr: any) {
        console.warn('[DayEnd] cashbook-list fetch failed, using fallback:', cbErr?.message);
        cashBookId = 1;
      }

      try {
        console.log('[DayEnd] Step 3: submit-day-auth-reconcile for cashier', cashierId, 'cashBookId', cashBookId, 'officeId', cashierOfficeId);
        const submitResult: any = await firstValueFrom(
          this.api.post(`/api/platinum/auth-day-end/submit-day-auth-reconcile?cashierId=${cashierId}`, {
            cashierId: Number(cashierId),
            cashBookId: Number(cashBookId),
            cashierOfficeId: Number(cashierOfficeId),
          })
        );
        console.log('[DayEnd] submit-day-auth-reconcile response:', JSON.stringify(submitResult));

        if (submitResult?.isSuccess === false || submitResult?.error) {
          const errMsg = submitResult?.message || submitResult?.error || 'Failed to submit day-end for authorization.';
          console.error('[DayEnd] submit-day-auth-reconcile returned error:', errMsg);
          this.toast.error('Day-end data saved, but supervisor authorization may not have completed. Please check with your supervisor.');
          return;
        }
      } catch (subErr: any) {
        console.warn('[DayEnd] submit-day-auth-reconcile warning (continuing):', subErr?.message);
        this.toast.warning('Day-end data saved. Supervisor authorization step had a warning — please verify with your supervisor.');
      }

      this.toast.success('Day-end reconciliation submitted for supervisor approval.');
      setTimeout(() => this.router.navigate(['/']), 1500);
    } catch (e: any) {
      console.error('[DayEnd] API error:', e);
      this.toast.error(e?.message || 'Failed to save reconciliation data. Please check your connection and try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async searchCancelReceipt(): Promise<void> {
    const query = this.cancelSearchQuery().trim();
    if (!query) return;

    this.cancelSearching.set(true);
    this.cancelFoundReceipt.set(null);
    this.cancelSearchError.set('');

    try {
      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/view-receipt/search-receipt-numbers', { receiptNumbers: query })
      );

      const results = Array.isArray(data) ? data : (data?.result || data?.data || []);
      if (!Array.isArray(results) || results.length === 0) {
        this.cancelSearchError.set(`No receipt found for "${query}". Please check the number and try again.`);
        return;
      }

      const match = results.find((r: any) => {
        const rNo = String(r.receiptNo || r.receipt_no || r.receiptNumber || '');
        return rNo.includes(query) || query.includes(rNo);
      }) || results[0];

      this.cancelFoundReceipt.set(match);
    } catch (e: any) {
      this.cancelSearchError.set(e?.message || 'Failed to search for receipt. Please try again.');
    } finally {
      this.cancelSearching.set(false);
    }
  }

  clearCancelSearch(): void {
    this.cancelSearchQuery.set('');
    this.cancelFoundReceipt.set(null);
    this.cancelSearchError.set('');
    this.cancelReason.set('');
  }

  async handleRequestCancel(): Promise<void> {
    const receipt = this.cancelFoundReceipt();
    const reason = this.cancelReason();
    if (!receipt) {
      this.toast.error('Please search for a receipt first.');
      return;
    }
    const receiptId = receipt.receiptId || receipt.receiptID || receipt.receipt_ID || receipt.id;
    if (!receiptId) {
      this.toast.error('Could not determine receipt ID. Please try a different receipt.');
      return;
    }
    if (!reason.trim()) {
      this.toast.error('Please provide a reason for cancellation.');
      return;
    }

    this.isCancellingReceipt.set(true);
    try {
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/auth-day-end/request-cancel-receipt', {
          receiptId: Number(receiptId),
          reason: reason.trim(),
          cashierId: this.sessionCashierId(),
          userId: this.user()?.user_ID,
        })
      );

      if (result?.error || result?.isError === true || result?.success === false) {
        throw new Error(result?.error || result?.message || 'API rejected the cancellation request.');
      }

      this.toast.success('Cancellation request submitted. Awaiting supervisor approval.');
      this.clearCancelSearch();

      const cid = this.sessionCashierId();
      if (cid) this.loadReceiptData(cid);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to submit cancellation request.');
    } finally {
      this.isCancellingReceipt.set(false);
    }
  }

  resetForm(): void {
    this.denominations.set({
      n200: 0, n100: 0, n50: 0, n20: 0, n10: 0,
      c1: 0, c5: 0, c10: 0, c20: 0, c50: 0,
      co1: 0, co2: 0, co5: 0,
    });
    this.totalCashAmt.set(0);
    this.reason.set('');
  }

  getReceiptLabel(item: any): string {
    const no = item.receiptNo || item.receipt_no || '';
    const acc = item.accountNumber || item.accountId || '';
    return no ? `${no} — ${acc}` : acc || `Receipt #${item.id || '?'}`;
  }

  getPayTypeLabel(item: any): string {
    if (item.paymentTypeId === 1) return 'Cash';
    if (item.paymentTypeId === 3) return 'Credit Card';
    if (item.paymentTypeId === 4) return 'Postal Order';
    return item.paymentType || item.payMode || '-';
  }

  formatDate(item: any): string {
    const dateVal = item.dateCaptured || item.receiptDate || item.date;
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch {
      return '-';
    }
  }

  isCancelled(item: any): boolean {
    return item.isCancelled === 1 || item.isCancelled === true;
  }

  private extractItems(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      return data.items || data.value || data.results || data.data || data.rows || [];
    }
    return [];
  }

  formatCurrency(amount: number): string {
    return amount.toFixed(2);
  }
}
