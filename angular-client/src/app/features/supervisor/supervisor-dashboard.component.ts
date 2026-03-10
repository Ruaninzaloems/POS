import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface CashierShift {
  id: string;
  userId: number | null;
  cashierName: string;
  cashOffice: string;
  cashOfficeId: number | null;
  groupCashiers: boolean;
  startTime: string;
  status: 'NOT_SUBMITTED' | 'PENDING_APPROVAL' | 'RETURNED' | 'COMPLETED';
  systemTotals: { cash: number; card: number; total: number };
  declaredTotals?: { cash: number; card: number; total: number };
  variance?: { cash: number; card: number; total: number };
  transactionCount: number;
  reconcileId: number | null;
  returnReason?: string | null;
  hasActiveSession: boolean;
  rawData?: any;
}

interface PendingCancelRequest {
  id: string;
  receiptId: number;
  receiptNo: string;
  accountNumber: string;
  amount: number;
  cashierName: string;
  cashierId: number;
  reason: string;
  requestDate: string;
  paymentType: string;
  status: string;
  isMiscPayment: boolean;
}

interface ReviewData {
  details: any;
  reconcile: any;
  cashReceipts: any[];
  cardReceipts: any[];
  chequeReceipts: any[];
  postalReceipts: any[];
  dropboxReceipts: any[];
  offlineReceipts: any[];
  systemVsCashier: any[];
}

interface OfficeConfig {
  groupCashiers: boolean;
  cashOfficeDesc: string;
  cashOnHandLimit: number | null;
}

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supervisor-dashboard.component.html',
  styleUrl: './supervisor-dashboard.component.css'
})
export class SupervisorDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  activeTab = signal<'day-end' | 'cancellations'>('day-end');
  reconMode = signal<'PER_CASHIER' | 'CASH_OFFICE'>('PER_CASHIER');

  shifts = signal<CashierShift[]>([]);
  isLoadingShifts = signal(false);
  filterOffice = signal('All');
  filterStatus = signal('All');
  searchQuery = signal('');

  selectedShift = signal<CashierShift | null>(null);
  reviewLoading = signal(false);
  reviewData = signal<ReviewData | null>(null);
  reviewTab = signal('cash');
  actionLoading = signal(false);
  returnReason = signal('');

  pendingCancelRequests = signal<PendingCancelRequest[]>([]);
  cancelRequestsLoading = signal(false);
  cancelActionLoading = signal<string | null>(null);

  perOfficeList = signal<any[]>([]);
  perOfficeSelectedId = signal<number | null>(null);
  perOfficeData = signal<any>(null);
  perOfficeLoading = signal(false);
  perOfficeSubmitting = signal(false);
  perOfficeVerifying = signal<number | null>(null);
  perOfficeStaged = signal(false);
  perOfficeCashierStatuses = signal<Record<number, any>>({});

  posCashierData = signal<any[]>([]);

  directCancelId = signal<number | null>(null);
  directCancelReason = signal('');

  officeConfigs = signal<Record<string, OfficeConfig>>({});

  private pagerBody = { pageNumber: 1, pageSize: 100, query: '', orderBy: '' };

  uniqueOffices = computed(() => {
    const offices = new Set(this.shifts().map(s => s.cashOffice).filter(Boolean));
    return Array.from(offices);
  });

  activeShifts = computed(() => {
    return this.shifts().filter(s => !(s.status === 'NOT_SUBMITTED' && !s.hasActiveSession));
  });

  filteredShifts = computed(() => {
    return this.activeShifts().filter(s => {
      const matchesOffice = this.filterOffice() === 'All' || s.cashOffice === this.filterOffice();
      const matchesSearch = (s.cashierName || '').toLowerCase().includes(this.searchQuery().toLowerCase());
      const matchesStatus = this.filterStatus() === 'All' || s.status === this.filterStatus();
      return matchesOffice && matchesSearch && matchesStatus;
    });
  });

  pendingCount = computed(() => this.activeShifts().filter(s => s.status === 'PENDING_APPROVAL').length);
  varianceCount = computed(() => this.activeShifts().filter(s => (s.variance?.total || 0) !== 0 && s.status === 'PENDING_APPROVAL').length);
  totalPosted = computed(() => this.activeShifts().filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + s.systemTotals.total, 0));
  totalSystemRevenue = computed(() => this.activeShifts().reduce((sum, s) => sum + s.systemTotals.total, 0));

  ngOnInit(): void {
    this.loadCashierList();
    this.loadPendingCancelRequests();
    this.loadPosCashierData();
  }

  formatCurrency(amount: number): string {
    return `R ${amount.toFixed(2)}`;
  }

  private extractItems(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      return data.items || data.value || data.results || data.data || data.rows || [];
    }
    return [];
  }

  private mapCashierToShift(c: any, index: number): CashierShift {
    const id = String(c.id || c.cashierId || c.cashier_ID || c.cashier_id || index);
    const name = c.cashierName || c.name || c.userName || c.cashier_name || `Cashier ${id}`;
    const office = c.cashOfficeName || c.cashOffice || c.cash_office || c.officeName || c.office || '';
    const officeId = Number(c.cashOfficeId || c.cashOffice_ID || c.cash_office_id || c.officeId || c.office_id || 0) || null;
    const rawUserId = Number(c.user_Id || c.userId || c.user_id || c.capturerId || 0) || null;
    const rawReconcileId = Number(c.cashierReconcile_Id || c.reconcileId || c.reconcile_id || c.cashierReconcileId || 0) || null;
    const totalAmt = Number(c.totalAmount || c.totalAmt || c.total || c.systemTotal || 0);
    const cashAmt = Number(c.cashAmount || c.cashTotal || c.totalCashAmt || 0);
    const cardAmt = Number(c.cardAmount || c.cardTotal || c.totalCreditAmt || 0);
    const declaredTotal = Number(c.declaredTotal || c.declaredAmount || c.cashierTotal || c.totalDeclared || 0);
    const declaredCash = Number(c.declaredCash || c.cashierCash || 0);
    const declaredCard = Number(c.declaredCard || c.cashierCard || 0);
    const varianceTotal = Number(c.variance || c.varianceAmount || c.totalVariance || 0);
    const txCount = Number(c.transactionCount || c.receiptCount || c.txCount || c.count || 0);

    const officeConfig = officeId && this.officeConfigs() ? this.officeConfigs()[String(officeId)] : undefined;
    const groupCashiers = officeConfig?.groupCashiers ?? c.groupCashiers ?? false;

    let status: CashierShift['status'] = 'NOT_SUBMITTED';
    const rawStatus = String(c.status || c.reconcileStatus || c.dayEndStatus || '').toLowerCase().trim();
    if (rawStatus.includes('not yet submitted') || rawStatus.includes('not submitted') || rawStatus.includes('not_submitted') || rawStatus === 'not submitted') {
      status = 'NOT_SUBMITTED';
    } else if (rawStatus.includes('return')) {
      status = 'RETURNED';
    } else if (rawStatus.includes('complet') || rawStatus.includes('post') || rawStatus.includes('finish') || rawStatus.includes('approved')) {
      status = 'COMPLETED';
    } else if (rawStatus.includes('submit') || rawStatus.includes('pending') || rawStatus.includes('awaiting')) {
      status = 'PENDING_APPROVAL';
    } else if (rawStatus.includes('not') || rawStatus.includes('open') || rawStatus === '') {
      status = 'NOT_SUBMITTED';
    } else if (rawReconcileId && rawReconcileId > 0) {
      status = 'PENDING_APPROVAL';
    }

    const returnReason = c.returnReason || c.reason || c.returnedReason || c.comments || null;

    return {
      id, userId: rawUserId, cashierName: name,
      cashOffice: officeConfig?.cashOfficeDesc || office,
      cashOfficeId: officeId,
      groupCashiers,
      startTime: c.startTime || c.reconcileDate || c.date || c.createdDate || new Date().toISOString(),
      status,
      systemTotals: { cash: cashAmt, card: cardAmt, total: totalAmt || (cashAmt + cardAmt) },
      declaredTotals: declaredTotal > 0 || declaredCash > 0 ? { cash: declaredCash, card: declaredCard, total: declaredTotal || (declaredCash + declaredCard) } : undefined,
      variance: varianceTotal !== 0 ? { cash: 0, card: 0, total: varianceTotal } : { cash: 0, card: 0, total: 0 },
      transactionCount: txCount,
      reconcileId: rawReconcileId,
      returnReason,
      hasActiveSession: c.isActive === true,
      rawData: c,
    };
  }

  async loadCashierList(): Promise<void> {
    this.isLoadingShifts.set(true);
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end/cashier-list'));
      let items: any[];
      if (data && data.cashiers) {
        items = this.extractItems(data.cashiers);
      } else {
        items = this.extractItems(data);
      }
      const mapped = items.map((c: any, i: number) => this.mapCashierToShift(c, i));
      this.shifts.set(mapped);

      const hasGrouped = mapped.some(s => s.groupCashiers);
      const hasIndividual = mapped.some(s => !s.groupCashiers);
      if (hasGrouped && !hasIndividual) this.reconMode.set('CASH_OFFICE');
      else if (!hasGrouped && hasIndividual) this.reconMode.set('PER_CASHIER');
    } catch (e: any) {
      this.toast.error('Failed to load cashier list: ' + (e?.message || 'Unknown error'));
    } finally {
      this.isLoadingShifts.set(false);
    }
  }

  async loadPendingCancelRequests(): Promise<void> {
    this.cancelRequestsLoading.set(true);
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end/pending-cancel-requests'));
      const items = Array.isArray(data) ? data : (data?.items || data?.value || data?.data || data?.results || []);
      this.pendingCancelRequests.set(items.map((item: any, idx: number) => ({
        id: String(item.id || item.receiptId || item.receipt_id || idx),
        receiptId: Number(item.receiptId || item.receipt_id || item.id || 0),
        receiptNo: String(item.receiptNo || item.receipt_no || item.receiptNumber || ''),
        accountNumber: String(item.accountNumber || item.accountNo || item.account_number || ''),
        amount: Number(item.amount || item.totalAmount || item.receiptAmount || 0),
        cashierName: item.cashierName || item.cashier_name || item.requestedBy || '',
        cashierId: Number(item.cashierId || item.cashier_id || item.userId || 0),
        reason: item.reason || item.cancellationReason || item.returnReason || item.cancelReason || '',
        requestDate: item.requestDate || item.requestedDate || item.createdDate || item.date || '',
        paymentType: item.paymentType || item.payMode || '',
        status: item.status || 'PENDING',
        isMiscPayment: item.isMiscPayment === true || item.isMiscPayment === 1 || item.is_misc_payment === true,
      })));
    } catch (e: any) {
      this.toast.error('Failed to load cancellation requests: ' + (e?.message || 'Unknown error'));
      this.pendingCancelRequests.set([]);
    } finally {
      this.cancelRequestsLoading.set(false);
    }
  }

  async handleReview(shift: CashierShift): Promise<void> {
    this.selectedShift.set(shift);
    this.returnReason.set('');
    this.reviewLoading.set(true);
    this.reviewData.set(null);
    this.reviewTab.set('cash');
    try {
      const [details, reconcile, cashRes, cardRes, chequeRes, postalRes, dropboxRes, offlineRes, sysVsCashierRes] = await Promise.all([
        firstValueFrom(this.api.get('/api/platinum/auth-day-end/cashier-details', { id: String(shift.id) })).catch(() => null),
        firstValueFrom(this.api.get('/api/platinum/auth-day-end/cashier-reconcile-by-cashierid', { cashierId: String(shift.id) })).catch(() => null),
        firstValueFrom(this.api.post(`/api/platinum/auth-day-end/cashier-receipt-cash-list?id=${shift.id}`, this.pagerBody)).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/auth-day-end/cashier-receipt-card-list?id=${shift.id}`, this.pagerBody)).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/auth-day-end/cashier-receipt-cheque-list?id=${shift.id}`, this.pagerBody)).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/auth-day-end/cashier-receipt-postal-order-list?id=${shift.id}`, this.pagerBody)).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/auth-day-end/cashier-receipt-drop-box-list?id=${shift.id}`, this.pagerBody)).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/auth-day-end/cashier-receipt-offline-data-list?id=${shift.id}`, this.pagerBody)).catch(() => []),
        firstValueFrom(this.api.post(`/api/platinum/auth-day-end/system-vs-cashier-data-list?id=${shift.id}`, this.pagerBody)).catch(() => []),
      ]);
      this.reviewData.set({
        details, reconcile,
        cashReceipts: this.extractItems(cashRes),
        cardReceipts: this.extractItems(cardRes),
        chequeReceipts: this.extractItems(chequeRes),
        postalReceipts: this.extractItems(postalRes),
        dropboxReceipts: this.extractItems(dropboxRes),
        offlineReceipts: this.extractItems(offlineRes),
        systemVsCashier: this.extractItems(sysVsCashierRes),
      });
    } catch (e: any) {
      this.toast.error('Failed to load review data: ' + (e?.message || 'Unknown error'));
    } finally {
      this.reviewLoading.set(false);
    }
  }

  async handleApprove(cashierId: string): Promise<void> {
    this.actionLoading.set(true);
    try {
      try {
        await firstValueFrom(this.api.post(`/api/platinum/auth-day-end/validate-cashbook?cashierId=${cashierId}`));
      } catch {}

      const shift = this.selectedShift();
      const details = this.reviewData()?.details;
      const cashierOfficeId = shift?.cashOfficeId || details?.cashierOfficeId || 0;
      let cashBookId = details?.cashBookId || details?.cashbookId || 0;
      if (!cashBookId) {
        try {
          const cashbooks: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end/cashbook-list'));
          const books = Array.isArray(cashbooks) ? cashbooks : [];
          if (books.length > 0) {
            const match = books.find((b: any) => Number(b.cashOfficeId || b.cashOffice_ID) === Number(cashierOfficeId));
            cashBookId = match?.id || match?.cashBookId || books[0]?.id || 0;
          }
        } catch {}
      }

      await firstValueFrom(this.api.post('/api/platinum/auth-day-end/submit-day-auth-reconcile', {
        cashierId: Number(cashierId), cashBookId: Number(cashBookId), cashierOfficeId: Number(cashierOfficeId)
      }));

      const resolvedUserId = shift?.userId || details?.user_Id || details?.userId || this.auth.user()?.user_ID || 0;
      await firstValueFrom(this.api.post(`/api/platinum/auth-day-end/finish-day-end-reconcile?userId=${resolvedUserId}`, {}));

      this.toast.success('Day-end reconciliation approved successfully.');
      this.selectedShift.set(null);
      this.loadCashierList();
    } catch (e: any) {
      this.toast.error('Approve failed: ' + (e?.message || 'Unknown error'));
    } finally {
      this.actionLoading.set(false);
    }
  }

  async handleReturn(): Promise<void> {
    const shift = this.selectedShift();
    if (!shift || !this.returnReason()) return;
    this.actionLoading.set(true);
    try {
      const reconcileId = this.reviewData()?.reconcile?.cashierReconcile_Id || this.reviewData()?.reconcile?.id || shift.reconcileId || Number(shift.id);
      await firstValueFrom(this.api.post('/api/platinum/auth-day-end/return-day-end-reconcile', {
        id: reconcileId, returnReason: this.returnReason()
      }));
      this.toast.success('Day-end reconciliation returned to cashier.');
      this.selectedShift.set(null);
      this.returnReason.set('');
      this.loadCashierList();
    } catch (e: any) {
      this.toast.error('Return failed: ' + (e?.message || 'Unknown error'));
    } finally {
      this.actionLoading.set(false);
    }
  }

  async handleApproveCancelRequest(req: PendingCancelRequest): Promise<void> {
    this.cancelActionLoading.set(req.id);
    try {
      await firstValueFrom(this.api.post('/api/platinum/auth-day-end/approve-cancel-receipt', {
        receiptId: req.receiptId, reason: req.reason || 'Approved by supervisor', isMiscPayment: req.isMiscPayment
      }));
      this.toast.success(`Receipt ${req.receiptNo || req.receiptId} has been voided.`);
      this.pendingCancelRequests.update(prev => prev.filter(r => r.id !== req.id));
      this.loadPendingCancelRequests();
    } catch (e: any) {
      this.toast.error('Approve failed: ' + (e?.message || 'Unknown error'));
    } finally {
      this.cancelActionLoading.set(null);
    }
  }

  async handleDeclineCancelRequest(req: PendingCancelRequest): Promise<void> {
    this.cancelActionLoading.set(req.id);
    try {
      await firstValueFrom(this.api.post('/api/platinum/auth-day-end/decline-cancel-receipt', {
        receiptId: req.receiptId, reason: req.reason || 'Declined by supervisor', isMiscPayment: req.isMiscPayment
      }));
      this.toast.success(`Receipt ${req.receiptNo || req.receiptId} cancellation was rejected.`);
      this.pendingCancelRequests.update(prev => prev.filter(r => r.id !== req.id));
      this.loadPendingCancelRequests();
    } catch (e: any) {
      this.toast.error('Decline failed: ' + (e?.message || 'Unknown error'));
    } finally {
      this.cancelActionLoading.set(null);
    }
  }

  async handleDirectCancel(receiptId: number, reason: string): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/api/platinum/auth-day-end/cancel-receipt', {
        id: receiptId, returnReason: reason, userId: this.auth.user()?.user_ID || 0
      }));
      this.toast.success(`Receipt ${receiptId} has been directly cancelled.`);
      this.directCancelId.set(null);
      this.directCancelReason.set('');
      const shift = this.selectedShift();
      if (shift) this.handleReview(shift);
    } catch (e: any) {
      this.toast.error('Direct cancel failed: ' + (e?.message || 'Unknown error'));
    }
  }

  async handlePrintCashReport(cashierId: string): Promise<void> {
    try {
      this.toast.info('Preparing cash report...');
      const cashierName = this.selectedShift()?.cashierName || 'Cashier';
      const reconcileDate = new Date().toISOString().split('T')[0];
      const result: any = await firstValueFrom(this.api.post('/api/platinum/auth-day-end/print-cash-report', {
        cashierId: Number(cashierId), cashierName, reconcileDate
      }));
      this.openPdfFromResult(result);
    } catch (e: any) {
      this.toast.error('Failed to generate cash report: ' + (e?.message || 'Unknown error'));
    }
  }

  async handlePrintDepositSlip(cashierId: string): Promise<void> {
    try {
      this.toast.info('Preparing deposit slip...');
      const cashierName = this.selectedShift()?.cashierName || 'Cashier';
      const reconcileDate = new Date().toISOString().split('T')[0];
      const result: any = await firstValueFrom(this.api.post('/api/platinum/auth-day-end/print-deposit-slip', {
        cashierId: Number(cashierId), cashierName, reconcileDate
      }));
      this.openPdfFromResult(result);
    } catch (e: any) {
      this.toast.error('Failed to generate deposit slip: ' + (e?.message || 'Unknown error'));
    }
  }

  private openPdfFromResult(result: any): void {
    const b64 = typeof result === 'string' ? result : (result?.fileContents || result?.base64);
    if (b64) {
      const byteChars = atob(b64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } else {
      this.toast.success('Report generated.');
    }
  }

  closeReview(): void {
    this.selectedShift.set(null);
    this.reviewData.set(null);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING_APPROVAL': return 'badge-warning';
      case 'COMPLETED': return 'badge-success';
      case 'RETURNED': return 'badge-danger';
      default: return 'badge-default';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING_APPROVAL': return 'Pending';
      case 'COMPLETED': return 'Completed';
      case 'RETURNED': return 'Returned';
      case 'NOT_SUBMITTED': return 'Not Submitted';
      default: return status;
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    } catch { return dateStr; }
  }

  async loadPerOfficeList(): Promise<void> {
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end-per-office/cash-office-list'));
      this.perOfficeList.set(Array.isArray(data) ? data : (data?.items || []));
    } catch (e: any) {
      this.toast.error('Failed to load cash office list: ' + (e?.message || 'Unknown error'));
      this.perOfficeList.set([]);
    }
  }

  async handlePerOfficeSelect(cashOfficeId: number): Promise<void> {
    this.perOfficeSelectedId.set(cashOfficeId);
    this.perOfficeData.set(null);
    this.perOfficeLoading.set(true);
    this.perOfficeStaged.set(false);
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end-per-office/cash-office-selection', { cashOfficeId: String(cashOfficeId) }));
      this.perOfficeData.set({
        cashBookId: data?.cashBookId || data?.cashbookId || 0,
        cashBookName: data?.cashBookName || data?.cashbookName || '',
        cashierSummary: Array.isArray(data?.cashierSummary) ? data.cashierSummary : this.extractItems(data?.cashierSummary),
        completionStatus: data?.completionStatus || '',
        allVerified: data?.allVerified === true,
        validationResult: data?.validationResult,
      });
      this.loadAllPerOfficeCashierStatuses();
    } catch (e: any) {
      this.toast.error('Failed to load office data: ' + (e?.message || ''));
    } finally {
      this.perOfficeLoading.set(false);
    }
  }

  async refreshPerOfficeSummary(): Promise<void> {
    if (!this.perOfficeSelectedId()) return;
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end-per-office/cashier-summary-by-office', { cashOfficeId: String(this.perOfficeSelectedId()) }));
      const items = data?.data || data?.cashierSummary || (Array.isArray(data) ? data : []);
      const prev = this.perOfficeData();
      if (prev) {
        this.perOfficeData.set({
          ...prev,
          cashierSummary: items,
          completionStatus: data?.completionStatus || prev.completionStatus,
          allVerified: data?.allVerified === true,
          validationResult: data?.validationResult || prev.validationResult,
        });
      }
    } catch {
    }
  }

  async handlePerOfficeVerifyCashier(cashierId: number): Promise<void> {
    if (!this.perOfficeSelectedId() || !this.perOfficeData()) return;
    this.perOfficeVerifying.set(cashierId);
    try {
      try { await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/add-stage')); } catch {}
      try { await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/process-staging-payments', { cashOfficeId: this.perOfficeSelectedId() })); } catch {}

      const result: any = await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/verify-cashier-reconcile', {
        cashierId, cashOfficeId: this.perOfficeSelectedId(), cashBookId: this.perOfficeData().cashBookId,
      }));
      if (result?.isSuccess === false) {
        this.toast.error(result.message || 'Cashier verification failed.');
      } else {
        this.toast.success(`Cashier ${cashierId} verified successfully.`);
      }
      await this.refreshPerOfficeSummary();
    } catch (e: any) {
      this.toast.error('Verification failed: ' + (e?.message || ''));
    } finally {
      this.perOfficeVerifying.set(null);
    }
  }

  async handlePerOfficeSubmitAll(): Promise<void> {
    if (!this.perOfficeSelectedId() || !this.perOfficeData()) return;
    this.perOfficeSubmitting.set(true);
    try {
      const result: any = await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/submit-reconcile-per-office', {
        cashOfficeId: this.perOfficeSelectedId(), cashBookId: this.perOfficeData().cashBookId,
      }));
      if (result?.isSuccess === false) {
        this.toast.error(result.message || 'Office reconciliation submission failed.');
      } else {
        this.toast.success('All cashiers in this office have been fully reconciled.');
      }
      try { await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/finish-stage')); } catch {}
      await this.refreshPerOfficeSummary();
      this.loadCashierList();
    } catch (e: any) {
      this.toast.error('Office submission failed: ' + (e?.message || ''));
      try { await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/finish-stage')); } catch {}
    } finally {
      this.perOfficeSubmitting.set(false);
    }
  }

  async handlePerOfficeReturn(cashierReconcileId: number, reason: string): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/return-day-end-reconcile', { id: cashierReconcileId, returnReason: reason }));
      this.toast.success('Cashier reconcile returned for correction.');
      try { await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/finish-stage')); } catch {}
      await this.refreshPerOfficeSummary();
    } catch (e: any) {
      this.toast.error('Return failed: ' + (e?.message || ''));
      try { await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/finish-stage')); } catch {}
    }
  }

  async handlePerOfficeCancelReceipt(receiptId: number, reason: string): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/api/platinum/auth-day-end-per-office/cancel-day-auth-reconcile-receipt', { id: receiptId, returnReason: reason }));
      this.toast.success(`Receipt ${receiptId} cancelled.`);
      await this.refreshPerOfficeSummary();
    } catch (e: any) {
      this.toast.error('Cancel receipt failed: ' + (e?.message || ''));
    }
  }

  async loadPosCashierData(): Promise<void> {
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end/pos-cashier'));
      const items = this.extractItems(data);
      this.posCashierData.set(items);
    } catch (e: any) {
      this.posCashierData.set([]);
    }
  }

  async loadPerOfficeCashierReconcileStatus(cashierId: number, cashOfficeId: number): Promise<any> {
    try {
      const data: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end-per-office/cashier-reconcile-status', {
        cashierId: String(cashierId),
        cashOfficeId: String(cashOfficeId),
      }));
      this.perOfficeCashierStatuses.update(prev => ({ ...prev, [cashierId]: data }));
      return data;
    } catch (e: any) {
      return null;
    }
  }

  async loadAllPerOfficeCashierStatuses(): Promise<void> {
    const officeId = this.perOfficeSelectedId();
    const summary = this.perOfficeData()?.cashierSummary || [];
    if (!officeId || summary.length === 0) return;
    const results: Record<number, any> = {};
    await Promise.all(summary.map(async (cs: any) => {
      const cid = cs.cashierId || cs.id || cs.cashier_ID;
      if (!cid) return;
      try {
        const data: any = await firstValueFrom(this.api.get('/api/platinum/auth-day-end-per-office/cashier-reconcile-status', {
          cashierId: String(cid),
          cashOfficeId: String(officeId),
        }));
        results[cid] = data;
      } catch {}
    }));
    this.perOfficeCashierStatuses.set(results);
  }

  switchReconMode(mode: 'PER_CASHIER' | 'CASH_OFFICE'): void {
    this.reconMode.set(mode);
    if (mode === 'CASH_OFFICE') this.loadPerOfficeList();
  }
}
