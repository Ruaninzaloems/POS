import { Component, signal, computed, OnInit, inject } from '@angular/core';
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

  cashierList = signal<any[]>([]);
  selectedCashierId = signal('');
  cashierDetails = signal<any>(null);
  isLoadingCashiers = signal(false);
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
    this.totalCashOnHandPlusDropBox() + this.totalCreditAmt() + this.totalChequeAmt()
  );

  ngOnInit(): void {
    this.loadCashierList();
  }

  async loadCashierList(): Promise<void> {
    this.isLoadingCashiers.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/billing-payment-day-end/get-cashier-list')
      );
      const items = this.extractItems(data);
      this.cashierList.set(items);

      if (items.length === 1) {
        const id = String(items[0].id || items[0].cashierId || items[0].cashier_id || '');
        this.selectedCashierId.set(id);
        this.onCashierChange();
      }
    } catch (e) {
      this.toast.error('Failed to load cashier list.');
    } finally {
      this.isLoadingCashiers.set(false);
    }
  }

  async loadCashierDetails(): Promise<void> {
    const cashierId = this.selectedCashierId();
    if (!cashierId) return;

    this.isLoadingDetails.set(true);
    try {
      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/billing-payment-day-end/get-cashier-details', { id: cashierId })
      );
      this.cashierDetails.set(data);
    } catch (e) {
      console.error('Failed to load cashier details', e);
    } finally {
      this.isLoadingDetails.set(false);
    }
  }

  async loadReceiptData(): Promise<void> {
    const cashierId = this.selectedCashierId();
    if (!cashierId) return;

    this.isLoadingReceipts.set(true);
    const id = Number(cashierId);
    const userId = String(this.user()?.user_ID || 213);

    try {
      const [cheques, cards, dropBoxes, reconciles]: any[] = await Promise.all([
        firstValueFrom(this.api.post(`/api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list?id=${id}`, {})).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/billing-payment-day-end/get-cashier-receipt-card-list?id=${id}`, {})).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list?id=${id}`, {})).catch(() => []),
        firstValueFrom(this.api.get('/api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list', { userId, id: cashierId })).catch(() => []),
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

  onCashierChange(): void {
    if (this.selectedCashierId()) {
      this.loadCashierDetails();
      this.loadReceiptData();
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

  async handleSaveReconcile(): Promise<void> {
    if (!this.selectedCashierId()) {
      this.toast.error('Please select a cashier first.');
      return;
    }

    this.isSaving.set(true);
    try {
      const userId = this.user()?.user_ID || 213;
      const denoms = this.denominations();
      const payload = {
        cashierId: Number(this.selectedCashierId()),
        reason: this.reason() || null,
        totalCashAmt: this.cashOnHand(),
        totalChequeAmt: this.totalChequeAmt(),
        totalCoins: this.totalCoins(),
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
        finyear: this.user()?.finYear || null,
      };

      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment-day-end/save-reconcile-data', { userId, ...payload })
      );

      if (result?.error || result?.isError === true || result?.success === false) {
        throw new Error(result?.error || result?.message || 'API rejected the submission.');
      }

      try {
        await firstValueFrom(
          this.api.post('/api/platinum/auth-day-end/validate-cashbook', { cashierId: Number(this.selectedCashierId()) })
        );
      } catch {}

      const cashierOfficeId = Number(
        this.cashierDetails()?.officeId ||
        this.cashierDetails()?.cashOffice_ID ||
        this.cashierDetails()?.const_CashOffice?.cashOffice_ID || 1
      );

      try {
        await firstValueFrom(
          this.api.post('/api/platinum/auth-day-end/submit-day-auth-reconcile', {
            cashierId: Number(this.selectedCashierId()),
            cashBookId: 1,
            cashierOfficeId,
          })
        );
      } catch {}

      this.toast.success('Day-end reconciliation submitted successfully.');
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to save reconciliation data.');
    } finally {
      this.isSaving.set(false);
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

  getCashierName(c: any): string {
    return c.name || c.cashierName || c.userName || `Cashier ${c.id || c.cashierId}`;
  }

  getCashierOffice(): string {
    const d = this.cashierDetails();
    return d?.cashOfficeName || d?.cash_office || d?.cashOffice || d?.officeName || d?.const_CashOffice?.cashOfficeDesc || '-';
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
