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
  type: string;
  description: string;
  reference: string;
  amountDue: number;
  amountToPay: number;
  originalData?: any;
}

interface SearchResult {
  accountNo: string;
  name: string;
  outstandingAmount: number;
  status: string;
  address?: string;
  meterNo?: string;
  accountType?: string;
}

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

  loading = signal(false);
  error = signal('');
  searchQuery = signal('');
  searchLoading = signal(false);
  searchResults = signal<SearchResult[]>([]);
  searchActive = signal(false);
  transactionItems = signal<TransactionItem[]>([]);
  showPaymentDrawer = signal(false);
  cashAmount = signal(0);
  cardAmount = signal(0);
  cardReference = signal('');
  processingPayment = signal(false);
  receiptData = signal<any>(null);
  showReceipt = signal(false);

  user = this.auth.user;

  totalDue = computed(() => this.transactionItems().reduce((sum, item) => sum + item.amountDue, 0));
  totalToPay = computed(() => this.transactionItems().reduce((sum, item) => sum + item.amountToPay, 0));
  hasItems = computed(() => this.transactionItems().length > 0);
  totalPayment = computed(() => this.cashAmount() + this.cardAmount());
  changeAmount = computed(() => Math.max(0, this.totalPayment() - this.totalToPay()));

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.clearTransaction();
  }

  async search(): Promise<void> {
    const query = this.searchQuery().trim();
    if (!query || query.length < 3) return;

    this.searchLoading.set(true);
    this.searchActive.set(true);
    this.error.set('');

    try {
      const data: any = await firstValueFrom(
        this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: query })
      );
      const results = Array.isArray(data) ? data : data?.accounts || data?.results || data?.data || [];
      this.searchResults.set(results.map((acc: any) => ({
        accountNo: acc.accountNo || acc.account_no || acc.accountNumber || '',
        name: acc.name || acc.accountName || acc.consumerName || '',
        outstandingAmount: Number(acc.outstandingAmount || acc.balance || acc.totalDue || 0),
        status: acc.status || acc.accountStatus || 'Active',
        address: acc.address || acc.physicalAddress || '',
        meterNo: acc.meterNo || acc.prepaidMeterNo || '',
        accountType: acc.accountType || 'Normal',
      })));
    } catch (e: any) {
      this.error.set('Search failed. Please try again.');
      this.searchResults.set([]);
    } finally {
      this.searchLoading.set(false);
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.search();
    }
    if (event.key === 'Escape') {
      this.clearSearch();
    }
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchActive.set(false);
  }

  selectAccount(result: SearchResult): void {
    const item: TransactionItem = {
      id: crypto.randomUUID(),
      type: result.accountType === 'Prepaid' ? 'PREPAID' : 'CONSUMER_SERVICES',
      description: `${result.name} (${result.accountNo})`,
      reference: result.accountNo,
      amountDue: result.outstandingAmount,
      amountToPay: 0,
      originalData: result,
    };
    this.transactionItems.update(items => [...items, item]);
    this.clearSearch();
  }

  updateItemAmount(id: string, amount: number): void {
    this.transactionItems.update(items =>
      items.map(item => item.id === id ? { ...item, amountToPay: amount } : item)
    );
  }

  removeItem(id: string): void {
    this.transactionItems.update(items => items.filter(item => item.id !== id));
  }

  clearTransaction(): void {
    this.transactionItems.set([]);
    this.cashAmount.set(0);
    this.cardAmount.set(0);
    this.cardReference.set('');
    this.showPaymentDrawer.set(false);
  }

  payFullAmount(id: string): void {
    this.transactionItems.update(items =>
      items.map(item => item.id === id ? { ...item, amountToPay: item.amountDue } : item)
    );
  }

  openPaymentDrawer(): void {
    if (!this.hasItems() || this.totalToPay() <= 0) {
      this.toast.error('Please add items and enter amounts to pay.');
      return;
    }
    this.showPaymentDrawer.set(true);
  }

  closePaymentDrawer(): void {
    this.showPaymentDrawer.set(false);
  }

  async processPayment(): Promise<void> {
    if (this.totalPayment() < this.totalToPay()) {
      this.toast.error('Payment amount is less than the total amount due.');
      return;
    }

    this.processingPayment.set(true);
    try {
      const payload = {
        items: this.transactionItems().map(item => ({
          accountNo: item.reference,
          amount: item.amountToPay,
          type: item.type,
        })),
        payment: {
          cash: this.cashAmount(),
          card: this.cardAmount(),
          cardReference: this.cardReference(),
        },
        totalAmount: this.totalToPay(),
      };

      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/pos/process-payment', payload)
      );

      this.receiptData.set(result);
      this.showReceipt.set(true);
      this.toast.success('Payment processed successfully.');
      this.showPaymentDrawer.set(false);
      this.clearTransaction();
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Payment processing failed.');
    } finally {
      this.processingPayment.set(false);
    }
  }

  closeReceipt(): void {
    this.showReceipt.set(false);
    this.receiptData.set(null);
  }

  navigateToCashierSetup(): void {
    this.router.navigate(['/cashier-setup']);
  }

  navigateToDayEnd(): void {
    this.router.navigate(['/cashier-day-end']);
  }

  formatCurrency(amount: number): string {
    return `R ${amount.toFixed(2)}`;
  }
}
