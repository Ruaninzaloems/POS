import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface ThirdPartyType {
  id: number;
  name: string;
  description?: string;
}

type MatchStatus = 'Auto-Matched' | 'Manually Matched' | 'Needs Review' | 'Unmatched' | 'Pending';
type Step = 'import' | 'transactions' | 'committed';
type FilterTab = 'all' | 'auto-matched' | 'needs-review' | 'unmatched' | 'ready';
type PageTab = 'third-party' | 'generic-import';
type GenericStep = 'upload' | 'preview' | 'processing' | 'results';

interface ImportTransaction {
  index: number;
  importedAccountNumber: string;
  importedReference: string;
  resolvedAccountId: string;
  resolvedAccountNumber: string;
  matchStatus: MatchStatus;
  validated: boolean;
  validationMessage: string;
  documentNumber?: string;
  amount: number;
  comment?: string;
  status: string;
  isDuplicate?: boolean;
  ownerName?: string;
  propertyAddress?: string;
}

interface GenericPreviewRow {
  rowNum: number;
  accountNumber: string;
  amount: number;
  receiptDate: string;
  paymentTypeId: number;
  ownerName?: string;
  address?: string;
  isValid: boolean;
  validationStatus?: 'valid' | 'unverified' | 'invalid';
  validationMsg?: string;
  isDuplicate?: boolean;
}

interface GenericImportResult {
  accountNo?: string;
  accountName?: string;
  allocatedAmount?: number;
  status?: string;
  errorMessage?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-payment-processing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-processing.component.html',
  styleUrl: './payment-processing.component.css'
})
export class PaymentProcessingComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  loading = signal(false);
  error = signal('');
  pageTab = signal<PageTab>('third-party');
  step = signal<Step>('import');
  activeFilter = signal<FilterTab>('all');

  thirdPartyTypes = signal<ThirdPartyType[]>([]);
  loadingTypes = signal(true);
  selectedTypeId = signal('');
  paymentRef = signal('');
  cashBookId = signal('0');
  file = signal<File | null>(null);
  isProcessing = signal(false);
  processResult = signal<{ success: boolean; message: string } | null>(null);

  importId = signal('');
  transactions = signal<ImportTransaction[]>([]);
  loadingTxns = signal(false);
  loadProgress = signal({ step: '', percent: 0 });

  showCommitConfirm = signal(false);
  showResetConfirm = signal(false);
  showGiSubmitConfirm = signal(false);
  showGiBackConfirm = signal(false);

  editingIdx = signal<number | null>(null);
  editAccountNo = signal('');
  editComment = signal('');
  savingEdit = signal(false);

  searchOpen = signal(false);
  searchIdx = signal<number | null>(null);
  searchAccountNo = signal('');
  searchName = signal('');
  searchStreet = signal('');
  searchResults = signal<any[]>([]);
  searching = signal(false);

  viewOpen = signal(false);
  viewTxn = signal<ImportTransaction | null>(null);

  validating = signal(false);
  validationResult = signal<any>(null);
  committing = signal(false);
  commitResult = signal<any>(null);

  cashierInfo = signal<any>(null);

  giStep = signal<GenericStep>('upload');
  giFile = signal<File | null>(null);
  giPaymentRef = signal('');
  giReceiptDate = signal(new Date().toISOString().split('T')[0]);
  giPaymentTypeId = signal('5');
  giPostToCashbook = signal(true);
  giSubmitting = signal(false);
  giJobId = signal('');
  giStatus = signal<any>(null);
  giPolling = signal(false);
  giResults = signal<GenericImportResult[]>([]);
  giErrors = signal<GenericImportResult[]>([]);
  giLoadingResults = signal(false);
  giError = signal('');
  giPreviewRows = signal<GenericPreviewRow[]>([]);
  giPreviewLoading = signal(false);
  giCashOffices = signal<Array<{ id: string; name: string }>>([]);
  giSelectedCashOfficeId = signal('');
  giLoadingCashOffices = signal(false);
  giDragOver = signal(false);

  private giPollRef: any = null;

  filteredTransactions = computed(() => {
    const filter = this.activeFilter();
    const txns = this.transactions();
    if (filter === 'all') return txns;
    if (filter === 'auto-matched') return txns.filter(t => t.matchStatus === 'Auto-Matched');
    if (filter === 'needs-review') return txns.filter(t => t.matchStatus === 'Needs Review');
    if (filter === 'unmatched') return txns.filter(t => t.matchStatus === 'Unmatched');
    if (filter === 'ready') return txns.filter(t => t.validated);
    return txns;
  });

  matchCounts = computed(() => {
    const txns = this.transactions();
    return {
      all: txns.length,
      autoMatched: txns.filter(t => t.matchStatus === 'Auto-Matched').length,
      needsReview: txns.filter(t => t.matchStatus === 'Needs Review').length,
      unmatched: txns.filter(t => t.matchStatus === 'Unmatched').length,
      ready: txns.filter(t => t.validated).length,
    };
  });

  totalImportAmount = computed(() => this.transactions().reduce((s, t) => s + t.amount, 0));

  ngOnInit(): void {
    this.loadThirdPartyTypes();
    this.loadCashierInfo();
  }

  ngOnDestroy(): void {
    if (this.giPollRef) {
      clearInterval(this.giPollRef);
      this.giPollRef = null;
    }
  }

  async loadThirdPartyTypes(): Promise<void> {
    this.loadingTypes.set(true);
    try {
      const types: any = await firstValueFrom(this.api.get('/api/platinum/third-party-payments/types'));
      if (Array.isArray(types)) {
        this.thirdPartyTypes.set(types.map((t: any) => ({
          id: t.thirdPartyTypeId ?? t.id,
          name: t.description ?? t.name ?? '',
          description: t.description,
        })));
      }
    } catch (e: any) {
      this.toast.warning('Could not load third party types. You may need to refresh the page.');
    } finally {
      this.loadingTypes.set(false);
    }
  }

  async loadCashierInfo(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    try {
      const details: any = await firstValueFrom(this.api.get('/api/platinum/third-party-payments/cashier-details', {
        userId: String(user.user_ID), finYear: user.finYear
      }));
      if (details && !details._error) {
        this.cashierInfo.set(details);
        if (details.cashOfficeId) {
          this.cashBookId.set(String(details.cashOfficeId));
          this.giSelectedCashOfficeId.set(String(details.cashOfficeId));
        }
      }
    } catch {
    }

    this.giLoadingCashOffices.set(true);
    try {
      const user = this.auth.user();
      const offices: any = await firstValueFrom(this.api.get('/api/platinum/receipt-prepaid/cash-offices', {
        finYear: user?.finYear || ''
      }));
      if (Array.isArray(offices) && offices.length > 0) {
        this.giCashOffices.set(offices.map((o: any) => ({
          id: String(o.cashOffice_ID || o.id || ''),
          name: o.cashOfficeDesc || o.name || `Office ${o.cashOffice_ID || o.id}`
        })));
      }
    } catch {
    }
    this.giLoadingCashOffices.set(false);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.file.set(input.files[0]);
    }
  }

  async handleImport(): Promise<void> {
    if (!this.selectedTypeId() || !this.file()) {
      this.processResult.set({ success: false, message: 'Please select a third party type and upload a file.' });
      return;
    }
    this.isProcessing.set(true);
    this.processResult.set(null);
    try {
      const fileContent = await this.file()!.text();
      const result: any = await firstValueFrom(this.api.post('/api/platinum/third-party-payments/import-file', {
        ContentType: this.file()!.type || 'text/plain',
        FileName: this.file()!.name,
        Name: this.file()!.name,
        Length: this.file()!.size,
        thirdpartyTypeId: Number(this.selectedTypeId()),
        paymentReference: this.paymentRef(),
        cashBookId: Number(this.cashBookId()),
        fileContent,
      }));

      if (result && !result._error) {
        const id = result.importId || result.id || result;
        this.importId.set(String(id));
        this.processResult.set({ success: true, message: `Successfully imported file '${this.file()!.name}'.${typeof id === 'string' || typeof id === 'number' ? ` Import ID: ${id}` : ''}` });
        if (id) {
          this.step.set('transactions');
          this.loadTransactions(String(id));
        }
      } else {
        const detail = result?.detail || result?.message || '';
        const cleanMsg = typeof detail === 'string' ? detail.replace(/^["']|["']$/g, '').trim() : detail;
        this.processResult.set({ success: false, message: cleanMsg || 'Import failed. Please check the file format and try again.' });
      }
    } catch (e: any) {
      this.processResult.set({ success: false, message: this.parseApiErrorMessage(e?.message || 'Import failed.') });
    } finally {
      this.isProcessing.set(false);
    }
  }

  private parseApiErrorMessage(rawMsg: string): string {
    try {
      const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const detail = parsed.detail || parsed.message || '';
        return typeof detail === 'string' ? detail.replace(/^["']|["']$/g, '').trim() : rawMsg;
      }
    } catch {
    }
    return rawMsg;
  }

  async loadTransactions(id?: string): Promise<void> {
    const useId = id || this.importId();
    if (!useId) return;
    this.loadingTxns.set(true);
    this.loadProgress.set({ step: 'Fetching transactions from server...', percent: 5 });
    try {
      const txns: any = await firstValueFrom(this.api.get(`/api/platinum/third-party-payments/${useId}/transactions`));
      if (Array.isArray(txns)) {
        this.loadProgress.set({ step: `Loaded ${txns.length} transaction(s). Resolving consumer accounts...`, percent: 20 });
        const fileAccounts: string[] = [];
        txns.forEach((t: any) => {
          const primary = t.oldAccountNumber || t.accountNumber || t.accountNo || '';
          if (primary) fileAccounts.push(primary);
          const ref = t.reference || t.paymentReference || '';
          if (ref && ref !== primary && /^\d{5,}$/.test(ref.trim())) {
            fileAccounts.push(ref.trim());
          }
        });

        const migrationMap = await this.lookupCurrentAccounts(fileAccounts);
        const migratedEntries: { index: number; oldAcct: string; newAcct: string }[] = [];

        const builtTxns: ImportTransaction[] = txns.map((t: any, i: number) => {
          const importedAcct = t.oldAccountNumber || t.accountNumber || t.accountNo || '';
          const apiNewAcct = t.newAccountNumber || '';
          const ref = (t.reference || t.paymentReference || '').trim();
          let lookupResult = migrationMap.get(importedAcct);
          if (!lookupResult && ref && ref !== importedAcct && /^\d{5,}$/.test(ref)) {
            lookupResult = migrationMap.get(ref);
          }
          const idx = t.index ?? i;

          let resolvedAccountId = '';
          let resolvedAccountNumber = '';
          let matchStatus: MatchStatus = 'Pending';
          let validated = false;
          let validationMessage = '';

          if (lookupResult) {
            resolvedAccountId = lookupResult.accountId || lookupResult.accountNumber || '';
            resolvedAccountNumber = lookupResult.accountNumber || '';
            if (lookupResult.matchCount === 1) {
              matchStatus = 'Auto-Matched';
              validated = true;
              validationMessage = importedAcct !== resolvedAccountId ? `Old account "${importedAcct}" resolved to "${resolvedAccountId}"` : 'Exact match found';
            } else if (lookupResult.matchCount > 1) {
              matchStatus = 'Needs Review';
              validationMessage = `${lookupResult.matchCount} possible matches found`;
            }
          } else if (apiNewAcct) {
            resolvedAccountId = apiNewAcct;
            resolvedAccountNumber = apiNewAcct;
            matchStatus = 'Auto-Matched';
            validated = true;
            validationMessage = 'Matched via server lookup';
          } else {
            matchStatus = 'Unmatched';
            validationMessage = 'No matching account found in the system';
          }

          const mismatch = importedAcct !== '' && resolvedAccountId !== '' && importedAcct !== resolvedAccountId;
          if (mismatch && !apiNewAcct && matchStatus === 'Auto-Matched') {
            migratedEntries.push({ index: idx, oldAcct: importedAcct, newAcct: resolvedAccountId });
          }

          return {
            index: idx,
            importedAccountNumber: importedAcct,
            importedReference: t.documentNumber || t.reference || t.paymentReference || '',
            resolvedAccountId, resolvedAccountNumber,
            matchStatus, validated, validationMessage,
            documentNumber: t.documentNumber || '',
            amount: t.amount || 0,
            comment: mismatch ? `Auto-matched: Old "${importedAcct}" \u2192 New "${resolvedAccountId}"` : (t.comment || ''),
            status: t.status || (mismatch ? 'Account Updated' : 'Pending'),
            isDuplicate: t.isDuplicate || false,
            ownerName: lookupResult?.ownerName || t.ownerName || t.name || '',
            propertyAddress: lookupResult?.propertyAddress || t.propertyAddress || t.address || '',
          };
        });

        this.transactions.set(builtTxns);

        if (migratedEntries.length > 0) {
          this.loadProgress.set({ step: `Auto-updating ${migratedEntries.length} migrated account(s)...`, percent: 96 });
          const updateBatchSize = 5;
          for (let i = 0; i < migratedEntries.length; i += updateBatchSize) {
            const batch = migratedEntries.slice(i, i + updateBatchSize);
            const updates = batch.map(entry =>
              firstValueFrom(this.api.put(`/api/platinum/third-party-payments/${useId}/transactions/${entry.index}`, {
                newAccountNumber: entry.newAcct,
                comment: `Auto-matched: Old "${entry.oldAcct}" \u2192 New "${entry.newAcct}"`,
              })).catch(() => {})
            );
            await Promise.all(updates);
          }
        }

        this.loadProgress.set({ step: 'Done', percent: 100 });
      }
    } catch (e: any) {
      this.loadProgress.set({ step: 'Failed to load transactions', percent: 0 });
    } finally {
      this.loadingTxns.set(false);
    }
  }

  private async lookupCurrentAccounts(accountNumbers: string[]): Promise<Map<string, { accountNumber: string; accountId: string; ownerName: string; propertyAddress: string; matchCount: number }>> {
    const mapping = new Map<string, { accountNumber: string; accountId: string; ownerName: string; propertyAddress: string; matchCount: number }>();
    const unique = Array.from(new Set(accountNumbers.filter(a => a.length > 0)));
    if (unique.length === 0) return mapping;
    const batchSize = 10;
    for (let i = 0; i < unique.length; i += batchSize) {
      const processed = Math.min(i + batchSize, unique.length);
      this.loadProgress.set({ step: `Resolving consumer accounts (${processed}/${unique.length})...`, percent: 50 + Math.round((processed / unique.length) * 45) });
      const batch = unique.slice(i, i + batchSize);
      const lookups = batch.map(async (accNo) => {
        try {
          const results: any = await firstValueFrom(this.api.post('/api/platinum/billing-enquiry/enquiry-results', { accountID: accNo }));
          const arr = Array.isArray(results) ? results : [];
          if (arr.length > 0) {
            const r = arr[0];
            mapping.set(accNo, {
              accountNumber: r.accountNumber || '',
              accountId: r.accountID || r.accountId || '',
              ownerName: r.name || r.ownerName || '',
              propertyAddress: r.locationAddress || r.address || r.propertyAddress || '',
              matchCount: arr.length,
            });
          }
        } catch {
        }
      });
      await Promise.all(lookups);
    }
    return mapping;
  }

  startEdit(txn: ImportTransaction): void {
    this.editingIdx.set(txn.index);
    this.editAccountNo.set(txn.resolvedAccountId || txn.importedAccountNumber);
    this.editComment.set(txn.comment || '');
  }

  async saveEdit(): Promise<void> {
    if (this.editingIdx() === null) return;
    this.savingEdit.set(true);
    try {
      await firstValueFrom(this.api.put(`/api/platinum/third-party-payments/${this.importId()}/transactions/${this.editingIdx()}`, {
        newAccountNumber: this.editAccountNo(), comment: this.editComment()
      }));
      this.transactions.update(prev => prev.map(t => {
        if (t.index !== this.editingIdx()) return t;
        return {
          ...t,
          resolvedAccountId: this.editAccountNo(),
          resolvedAccountNumber: this.editAccountNo(),
          comment: this.editComment(),
          matchStatus: 'Manually Matched' as MatchStatus,
          validated: true, validationMessage: 'Manually linked by user',
          status: 'Account Updated',
        };
      }));
      this.editingIdx.set(null);
    } catch (e: any) {
      this.toast.error('Failed to update: ' + (e?.message || ''));
    } finally {
      this.savingEdit.set(false);
    }
  }

  cancelEdit(): void { this.editingIdx.set(null); }

  clearLink(txnIndex: number): void {
    this.transactions.update(prev => prev.map(t => {
      if (t.index !== txnIndex) return t;
      return { ...t, resolvedAccountId: '', resolvedAccountNumber: '', matchStatus: 'Unmatched' as MatchStatus, validated: false, validationMessage: 'Link cleared by user', comment: 'Link cleared \u2014 needs re-assignment' };
    }));
    if (this.importId()) {
      firstValueFrom(this.api.put(`/api/platinum/third-party-payments/${this.importId()}/transactions/${txnIndex}`, {
        newAccountNumber: '', comment: 'Link cleared \u2014 needs re-assignment'
      })).catch(() => {});
    }
  }

  openSearch(txnIndex: number): void {
    const txn = this.transactions().find(t => t.index === txnIndex);
    this.searchIdx.set(txnIndex);
    this.searchAccountNo.set(txn?.importedAccountNumber || '');
    this.searchName.set('');
    this.searchStreet.set('');
    this.searchResults.set([]);
    this.searchOpen.set(true);
  }

  async handleAccountSearch(): Promise<void> {
    this.searching.set(true);
    try {
      const body: Record<string, string> = {};
      if (this.searchAccountNo()) body['accountID'] = this.searchAccountNo();
      if (this.searchName()) body['name'] = this.searchName();
      if (this.searchStreet()) body['locationAddress'] = this.searchStreet();
      const results: any = await firstValueFrom(this.api.post('/api/platinum/billing-enquiry/enquiry-results', body));
      const arr = Array.isArray(results) ? results : [];
      this.searchResults.set(arr.slice(0, 50).map((r: any) => ({
        accountNumber: r.accountNumber || '',
        accountId: r.accountID || r.accountId || '',
        ownerName: r.name || r.ownerName || '',
        propertyAddress: r.locationAddress || r.address || r.propertyAddress || '',
        accountStatus: r.accountStatus || '',
      })));
    } catch (e) {
      void e;
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  async selectSearchResult(result: any): Promise<void> {
    const idx = this.searchIdx();
    if (idx === null) return;
    const accNo = result.accountNumber || result.accountNo || result.accountId || '';
    const accId = result.accountId || accNo;
    const ownerName = result.ownerName || result.name || '';
    const propertyAddress = result.propertyAddress || result.address || '';
    this.searchOpen.set(false);
    if (this.importId()) {
      this.savingEdit.set(true);
      try {
        await firstValueFrom(this.api.put(`/api/platinum/third-party-payments/${this.importId()}/transactions/${idx}`, {
          newAccountNumber: accId, comment: `Manually linked to account ${accId} (${ownerName})`
        }));
        this.transactions.update(prev => prev.map(t => {
          if (t.index !== idx) return t;
          return {
            ...t,
            resolvedAccountId: accId, resolvedAccountNumber: accNo,
            matchStatus: 'Manually Matched' as MatchStatus, validated: true,
            validationMessage: 'Manually linked by user', status: 'Account Updated',
            ownerName: ownerName || t.ownerName,
            propertyAddress: propertyAddress || t.propertyAddress,
            comment: `Manually linked to account ${accNo}`,
          };
        }));
      } catch (e: any) {
        console.error('Failed to update transaction after search:', e);
      } finally {
        this.savingEdit.set(false);
      }
    }
  }

  async handleValidate(): Promise<void> {
    this.validating.set(true);
    try {
      const result: any = await firstValueFrom(this.api.post(`/api/platinum/third-party-payments/${this.importId()}/validate-for-reconcile`, {}));
      this.validationResult.set(result);
      if (result?.isValid || result?.isSuccess) {
        this.toast.success('Validation passed. Ready to commit.');
      } else {
        this.toast.error('Validation failed: ' + (result?.message || 'Some transactions have issues.'));
      }
      await this.loadTransactions();
    } catch (e: any) {
      this.toast.error('Validation failed: ' + (e?.message || ''));
    } finally {
      this.validating.set(false);
    }
  }

  requestCommit(): void {
    this.commitResult.set(null);
    const unvalidatedCount = this.transactions().filter(t => !t.validated).length;
    if (unvalidatedCount > 0) {
      this.toast.error(`Cannot commit: ${unvalidatedCount} transaction(s) are not validated. Please resolve all Unmatched and Needs Review items first.`);
      return;
    }
    if (this.matchCounts().ready === 0) {
      this.toast.error('No validated payments ready to commit.');
      return;
    }
    this.showCommitConfirm.set(true);
  }

  confirmCommit(): void {
    this.showCommitConfirm.set(false);
    this.handleCommit();
  }

  cancelCommit(): void {
    this.showCommitConfirm.set(false);
  }

  requestResetImport(): void {
    if (this.transactions().length > 0 && this.step() === 'transactions') {
      this.showResetConfirm.set(true);
    } else {
      this.resetImport();
    }
  }

  confirmResetImport(): void {
    this.showResetConfirm.set(false);
    this.resetImport();
  }

  cancelResetImport(): void {
    this.showResetConfirm.set(false);
  }

  requestGiSubmit(): void {
    const validCount = this.giPreviewRows().filter(r => r.isValid).length;
    if (validCount === 0) {
      this.toast.error('No valid payment rows to submit.');
      return;
    }
    this.showGiSubmitConfirm.set(true);
  }

  confirmGiSubmit(): void {
    this.showGiSubmitConfirm.set(false);
    this.handleGiSubmit();
  }

  cancelGiSubmit(): void {
    this.showGiSubmitConfirm.set(false);
  }

  requestGiBack(): void {
    if (this.giPreviewRows().length > 0 && this.giStep() === 'preview') {
      this.showGiBackConfirm.set(true);
    } else {
      this.giStep.set('upload');
    }
  }

  confirmGiBack(): void {
    this.showGiBackConfirm.set(false);
    this.giStep.set('upload');
  }

  cancelGiBack(): void {
    this.showGiBackConfirm.set(false);
  }

  async handleCommit(): Promise<void> {
    const unvalidatedCount = this.transactions().filter(t => !t.validated).length;
    if (unvalidatedCount > 0) {
      this.toast.error(`Cannot commit: ${unvalidatedCount} transaction(s) are not validated.`);
      return;
    }
    const user = this.auth.user();
    if (!user?.finYear) {
      this.toast.error('Financial year missing from your session. Please log in again.');
      return;
    }
    this.committing.set(true);
    try {
      const selectedType = this.thirdPartyTypes().find(t => String(t.id) === this.selectedTypeId());
      const result: any = await firstValueFrom(this.api.post(`/api/platinum/third-party-payments/${this.importId()}/commit`, {
        groupId: selectedType?.id || Number(this.selectedTypeId()) || 0,
        cashBookId: Number(this.cashBookId()),
        paymentReference: this.paymentRef(),
        fileName: this.file()?.name || '',
        userId: user.user_ID,
        finYear: user.finYear,
      }));
      this.commitResult.set(result);
      if (result && !result._error && !result.error) {
        this.step.set('committed');
        this.toast.success('Payments committed successfully.');
      } else {
        this.toast.error('Commit failed: ' + (result?.message || result?.detail || 'Unknown error'));
      }
    } catch (e: any) {
      const msg = 'Commit failed: ' + (e?.message || 'Unknown error');
      this.commitResult.set({ error: true, message: msg });
      this.toast.error(msg);
    } finally {
      this.committing.set(false);
    }
  }

  resetImport(): void {
    this.step.set('import');
    this.file.set(null);
    this.importId.set('');
    this.transactions.set([]);
    this.processResult.set(null);
    this.validationResult.set(null);
    this.commitResult.set(null);
    this.loadProgress.set({ step: '', percent: 0 });
    this.activeFilter.set('all');
  }

  formatCurrency(amount: number): string {
    return `R ${(amount || 0).toFixed(2)}`;
  }

  getMatchBadgeClass(status: MatchStatus): string {
    switch (status) {
      case 'Auto-Matched': return 'badge-success';
      case 'Manually Matched': return 'badge-info';
      case 'Needs Review': return 'badge-warning';
      case 'Unmatched': return 'badge-danger';
      default: return 'badge-default';
    }
  }

  openView(txn: ImportTransaction): void {
    this.viewTxn.set(txn);
    this.viewOpen.set(true);
  }

  closeView(): void {
    this.viewOpen.set(false);
    this.viewTxn.set(null);
  }

  onGiFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.giFile.set(input.files[0]);
    }
  }

  onGiDragOver(event: DragEvent): void {
    event.preventDefault();
    this.giDragOver.set(true);
  }

  onGiDragLeave(): void {
    this.giDragOver.set(false);
  }

  onGiDrop(event: DragEvent): void {
    event.preventDefault();
    this.giDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files && files[0]) {
      this.giFile.set(files[0]);
    }
  }

  giPreviewTotal = computed(() => this.giPreviewRows().reduce((s, r) => s + (r.amount || 0), 0));

  giValidationProgress = signal<{ phase: string; percent: number; detail: string; validatedCount: number; totalCount: number; validCount: number; invalidCount: number } | null>(null);
  giCsvHasPaymentType = signal(false);
  giCsvHasReceiptDate = signal(false);
  giPreviewSkipped = signal<string[]>([]);

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  async handleGiPreview(): Promise<void> {
    if (!this.giFile()) {
      this.giError.set('Please select a CSV file.');
      return;
    }
    this.giPreviewLoading.set(true);
    this.giError.set('');
    this.giPreviewRows.set([]);
    this.giPreviewSkipped.set([]);
    this.giValidationProgress.set({ phase: 'parsing', percent: 0, detail: 'Reading CSV file...', validatedCount: 0, totalCount: 0, validCount: 0, invalidCount: 0 });

    try {
      const text = await this.giFile()!.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

      this.giValidationProgress.update(p => p ? { ...p, percent: 5, detail: `Read ${lines.length - 1} data rows from file` } : p);

      if (lines.length < 2) {
        this.giError.set('CSV must have a header row and at least one data row.');
        this.giPreviewLoading.set(false);
        this.giValidationProgress.set(null);
        return;
      }

      const header = this.parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const accIdx = header.findIndex(h => h === 'accountnumber' || h === 'accountno' || h === 'account');
      const amtIdx = header.findIndex(h => h === 'amount' || h === 'amt');
      const dateIdx = header.findIndex(h => h === 'receiptdate' || h === 'date');
      const ptIdx = header.findIndex(h => h === 'paymenttypeid' || h === 'paymenttype' || h === 'paytype');
      this.giCsvHasPaymentType.set(ptIdx !== -1);
      this.giCsvHasReceiptDate.set(dateIdx !== -1);

      if (accIdx === -1) { this.giError.set('CSV missing required column: AccountNumber'); this.giPreviewLoading.set(false); this.giValidationProgress.set(null); return; }
      if (amtIdx === -1) { this.giError.set('CSV missing required column: Amount'); this.giPreviewLoading.set(false); this.giValidationProgress.set(null); return; }

      this.giValidationProgress.update(p => p ? { ...p, percent: 10, detail: 'Parsing rows and formatting data...' } : p);

      const rawReceiptDate = this.giReceiptDate() || new Date().toISOString().split('T')[0];
      const defaultDateParts = rawReceiptDate.split('-');
      const defaultReceiptDate = defaultDateParts.length === 3
        ? `${defaultDateParts[2]}/${defaultDateParts[1]}/${defaultDateParts[0]}`
        : (() => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })();
      const defaultPaymentTypeId = Number(this.giPaymentTypeId()) || 5;

      const formatDateDDMMYYYY = (dateStr: string): string => {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return defaultReceiptDate;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      };

      const parsedRows: Array<{ rowNum: number; accountNumber: string; amount: number; receiptDate: string; paymentTypeId: number }> = [];
      const skipped: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = this.parseCsvLine(lines[i]);
        const rawAcc = cols[accIdx] || '';
        const rawAmt = cols[amtIdx] || '';
        if (!rawAcc && !rawAmt) { skipped.push(`Row ${i + 1}: completely empty row`); continue; }

        const digits = rawAcc.replace(/\D/g, '');
        if (digits.length === 0 || digits.length > 12) { skipped.push(`Row ${i + 1}: invalid account number "${rawAcc}"`); continue; }

        const amount = parseFloat((rawAmt || '0').replace(/[^0-9.\-]/g, ''));
        if (isNaN(amount) || amount <= 0) { skipped.push(`Row ${i + 1}: invalid amount "${rawAmt}"`); continue; }

        const receiptDate = dateIdx !== -1 && cols[dateIdx] ? formatDateDDMMYYYY(cols[dateIdx]) : defaultReceiptDate;
        const paymentTypeId = ptIdx !== -1 && cols[ptIdx] ? (parseInt(cols[ptIdx]) || defaultPaymentTypeId) : defaultPaymentTypeId;

        parsedRows.push({
          rowNum: i + 1,
          accountNumber: digits.padStart(12, '0'),
          amount,
          receiptDate,
          paymentTypeId,
        });
      }

      this.giPreviewSkipped.set(skipped);
      if (parsedRows.length === 0) {
        this.giError.set('No data rows found in CSV. Check the file format.');
        this.giPreviewLoading.set(false);
        this.giValidationProgress.set(null);
        return;
      }

      const BATCH_SIZE = 50;
      const allResults: any[] = [];
      const allDuplicates: string[] = [];

      for (let batchStart = 0; batchStart < parsedRows.length; batchStart += BATCH_SIZE) {
        const batch = parsedRows.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(parsedRows.length / BATCH_SIZE);
        const batchEnd = Math.min(batchStart + BATCH_SIZE, parsedRows.length);

        this.giValidationProgress.update(p => p ? {
          ...p, phase: 'validating',
          percent: 15 + Math.round((batchStart / parsedRows.length) * 70),
          detail: `Batch ${batchNum}/${totalBatches} — Validating rows ${batchStart + 1}–${batchEnd} against Platinum API...`,
          validatedCount: batchStart,
        } : p);

        const validation: any = await firstValueFrom(
          this.api.post('/api/platinum/direct-deposit-allocation/validate-generic-import', { payments: batch })
        );

        if (validation?._error || !validation?.results) {
          this.giError.set(validation?.detail || validation?.message || `API validation failed on batch ${batchNum}. Please try again.`);
          this.giPreviewLoading.set(false);
          this.giValidationProgress.set(null);
          return;
        }

        allResults.push(...validation.results);
        if (validation.duplicates) allDuplicates.push(...validation.duplicates);

        const batchValid = validation.results.filter((r: any) => r.isValid).length;
        const batchInvalid = validation.results.filter((r: any) => !r.isValid).length;

        this.giValidationProgress.update(p => p ? {
          ...p,
          percent: 15 + Math.round((batchEnd / parsedRows.length) * 70),
          detail: `Batch ${batchNum}/${totalBatches} complete — ${batchValid} matched, ${batchInvalid} invalid`,
          validatedCount: batchEnd,
          validCount: (p.validCount || 0) + batchValid,
          invalidCount: (p.invalidCount || 0) + batchInvalid,
        } : p);

        if (batchStart + BATCH_SIZE < parsedRows.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      this.giValidationProgress.update(p => p ? { ...p, phase: 'building', percent: 90, detail: 'Building preview table...' } : p);

      const globalDuplicateCheck: Record<string, number[]> = {};
      allResults.forEach((r: any, idx: number) => {
        const acc = r.accountNumber;
        if (!globalDuplicateCheck[acc]) globalDuplicateCheck[acc] = [];
        globalDuplicateCheck[acc].push(idx);
      });

      const previewRows: GenericPreviewRow[] = allResults.map((r: any) => {
        const isDup = r.isDuplicate || (globalDuplicateCheck[r.accountNumber]?.length > 1);
        return {
          rowNum: r.rowNum,
          accountNumber: r.accountNumber,
          amount: r.amount,
          receiptDate: r.receiptDate,
          paymentTypeId: r.paymentTypeId,
          ownerName: r.ownerName || '',
          address: r.address || '',
          isValid: r.isValid,
          validationStatus: r.validationStatus || (r.isValid ? 'valid' : 'invalid'),
          validationMsg: isDup && r.isValid ? (r.validationMsg ? r.validationMsg + '; Duplicate account' : 'Duplicate account in file') : (r.validationMsg || ''),
          isDuplicate: isDup,
        };
      });

      const validCount = previewRows.filter(r => r.isValid).length;
      const invalidCount = previewRows.filter(r => !r.isValid).length;
      const dupCount = previewRows.filter(r => r.isDuplicate).length;

      this.giValidationProgress.set({
        phase: 'done', percent: 100,
        detail: `Complete — ${validCount} matched, ${invalidCount} invalid${dupCount > 0 ? `, ${dupCount} duplicates` : ''}`,
        validatedCount: parsedRows.length, totalCount: parsedRows.length,
        validCount, invalidCount,
      });

      await new Promise(r => setTimeout(r, 600));

      this.giPreviewRows.set(previewRows);
      this.giStep.set('preview');
    } catch (e: any) {
      console.error('[GenericImport] Preview failed:', e);
      this.giError.set(e?.message || 'Failed to validate CSV file.');
    } finally {
      this.giPreviewLoading.set(false);
      this.giValidationProgress.set(null);
    }
  }

  async handleGiSubmit(): Promise<void> {
    const validRows = this.giPreviewRows().filter(r => r.isValid);
    if (validRows.length === 0) {
      this.toast.error('No valid payment rows to submit. All rows failed account validation.');
      return;
    }
    const user = this.auth.user();
    if (!user?.finYear) {
      this.toast.error('Financial year missing from your session. Please log in again.');
      return;
    }
    if (!user?.user_ID) {
      this.toast.error('User ID not available. Please log in again.');
      return;
    }
    const cashierInfo = this.cashierInfo();
    const cashOfficeId = Number(this.giSelectedCashOfficeId()) || Number(cashierInfo?.cashOfficeId) || 0;
    const cashierId = Number(cashierInfo?.cashierId) || 0;
    if (!cashOfficeId || !cashierId) {
      this.toast.error('Cashier session details not available. Please start a session first.');
      return;
    }
    this.giSubmitting.set(true);
    this.giError.set('');
    try {
      const payments = validRows.map(r => ({
        receiptDate: r.receiptDate,
        accountNumber: r.accountNumber,
        amount: r.amount,
        paymentTypeId: r.paymentTypeId,
      }));

      const payload = {
        cashOfficeId,
        cashierId,
        userId: user.user_ID,
        finYear: user.finYear,
        postToCashbook: this.giPostToCashbook(),
        payments,
      };

      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/direct-deposit-allocation/submit-generic-import', payload)
      );

      if (result && !result._error && result.isSuccess !== false) {
        const jobId = result.jobId || result.job_ID || result.directDepositJob_ID || result.id;
        const totalCount = result.totalCount || payments.length;
        if (jobId) {
          this.giJobId.set(String(jobId));
          this.giStep.set('processing');
          this.toast.success(result.message || `${totalCount} payment(s) submitted for processing.`);
          this.startGiPolling();
        } else {
          this.toast.success(result.message || `${totalCount} payment(s) submitted. Check allocation progress for results.`);
          this.giStep.set('results');
        }
      } else {
        const detail = result?.detail || result?.message || 'Import submission failed.';
        this.giError.set(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
    } catch (e: any) {
      console.error('[GenericImport] Submit failed:', e);
      this.giError.set(e?.message || 'Failed to submit generic import.');
    } finally {
      this.giSubmitting.set(false);
    }
  }

  private startGiPolling(): void {
    if (this.giPollRef) clearInterval(this.giPollRef);
    this.giPolling.set(true);
    this.giPollRef = setInterval(async () => {
      try {
        const status: any = await firstValueFrom(
          this.api.get(`/api/platinum/direct-deposit-allocation/generic-import-status/${this.giJobId()}`)
        );
        this.giStatus.set(status);
        const statusStr = (status?.status || status?.job_Status || status?.jobStatus || '').toLowerCase();
        const isComplete = statusStr.includes('complete') || statusStr.includes('done') || statusStr.includes('finished');
        const isFailed = statusStr.includes('fail') || statusStr.includes('error');
        if (isComplete || isFailed) {
          clearInterval(this.giPollRef);
          this.giPollRef = null;
          this.giPolling.set(false);
          await this.loadGiResults();
        }
      } catch (e: any) {
        console.error('[GenericImport] Status poll failed:', e);
        clearInterval(this.giPollRef);
        this.giPollRef = null;
        this.giPolling.set(false);
        this.giError.set(`Failed to check job status: ${e?.message || 'Unknown error'}`);
      }
    }, 3000);
  }

  private async loadGiResults(): Promise<void> {
    this.giLoadingResults.set(true);
    try {
      const [resultsSettled, errorsSettled] = await Promise.allSettled([
        firstValueFrom(this.api.get(`/api/platinum/direct-deposit-allocation/generic-import-results/${this.giJobId()}`)),
        firstValueFrom(this.api.get(`/api/platinum/direct-deposit-allocation/generic-import-errors/${this.giJobId()}`)),
      ]);

      let successRows: any[] = [];
      let errorRows: any[] = [];

      if (resultsSettled.status === 'fulfilled' && Array.isArray(resultsSettled.value)) {
        successRows = resultsSettled.value;
      }

      if (errorsSettled.status === 'fulfilled') {
        const errData = errorsSettled.value as any;
        if (Array.isArray(errData)) {
          errorRows = errData;
        } else if (errData?.errors && Array.isArray(errData.errors)) {
          errorRows = errData.errors.map((e: any) => ({
            accountNo: e.accountNumber,
            allocatedAmount: e.amount,
            status: 'Error',
            errorMessage: e.message || e.errorMessage || 'Allocation failed',
          }));
        }
      }

      const status = this.giStatus();
      if (successRows.length === 0 && status?.rows) {
        const statusRows = status.rows as any[];
        successRows = statusRows
          .filter((r: any) => r.isAllocated === true)
          .map((r: any) => ({
            accountNo: r.accountNumber,
            allocatedAmount: r.amount,
            status: 'Allocated',
            receiptNumber: String(r.receiptNumber ?? r.receiptNo ?? '').trim(),
          }));
        if (errorRows.length === 0) {
          errorRows = statusRows
            .filter((r: any) => r.isAllocated === false)
            .map((r: any) => ({
              accountNo: r.accountNumber,
              allocatedAmount: r.amount,
              status: 'Error',
              errorMessage: r.errorMessage || 'Allocation failed — error details not available from API',
            }));
        }
      }

      const normalizeAccNo = (v: string) => String(v || '').trim().replace(/^0+/, '');
      const previewNameMap = new Map<string, string>();
      this.giPreviewRows().forEach(pr => {
        if (pr.accountNumber && pr.ownerName) {
          previewNameMap.set(normalizeAccNo(pr.accountNumber), pr.ownerName);
        }
      });
      const enrichWithName = (row: any) => {
        if (row.accountName || row.name || row.ownerName) return row;
        const accNo = normalizeAccNo(row.accountNo || row.accountNumber || row.account_Number || '');
        const name = previewNameMap.get(accNo);
        return name ? { ...row, accountName: name } : row;
      };
      successRows = successRows.map(enrichWithName);
      errorRows = errorRows.map(enrichWithName);

      this.giResults.set(successRows);
      this.giErrors.set(errorRows);
      this.giStep.set('results');
      this.toast.success(`Import complete: ${successRows.length} successful, ${errorRows.length} failed.`);
    } catch (e: any) {
      console.error('[GenericImport] Failed to load results:', e);
      this.toast.error('Failed to load results: ' + (e?.message || ''));
      this.giStep.set('results');
    } finally {
      this.giLoadingResults.set(false);
    }
  }

  resetGi(): void {
    this.giStep.set('upload');
    this.giFile.set(null);
    this.giPaymentRef.set('');
    this.giPreviewRows.set([]);
    this.giPreviewSkipped.set([]);
    this.giResults.set([]);
    this.giErrors.set([]);
    this.giJobId.set('');
    this.giStatus.set(null);
    this.giError.set('');
    this.giCsvHasPaymentType.set(false);
    this.giCsvHasReceiptDate.set(false);
    this.giValidationProgress.set(null);
    if (this.giPollRef) {
      clearInterval(this.giPollRef);
      this.giPollRef = null;
    }
  }
}
