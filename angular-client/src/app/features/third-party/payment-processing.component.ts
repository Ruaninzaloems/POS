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
  giReceiptDate = signal(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
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
    } catch {
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
    } catch {}

    this.giLoadingCashOffices.set(true);
    try {
      const offices: any = await firstValueFrom(this.api.get('/api/platinum/receipt-prepaid/cash-offices'));
      if (Array.isArray(offices) && offices.length > 0) {
        this.giCashOffices.set(offices.map((o: any) => ({ id: o.id, name: o.name })));
      }
    } catch {}
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
    } catch {}
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
          const results: any = await firstValueFrom(this.api.get('/api/platinum/third-party-payments/account-search', { accountNo: accNo }));
          if (Array.isArray(results) && results.length > 0) {
            const result = results[0];
            mapping.set(accNo, {
              accountNumber: result.accountNumber || '',
              accountId: result.accountId || '',
              ownerName: result.ownerName || '',
              propertyAddress: result.propertyAddress || '',
              matchCount: results.length,
            });
          }
        } catch {}
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
      const params: Record<string, string> = {};
      if (this.searchAccountNo()) params['accountNo'] = this.searchAccountNo();
      if (this.searchName()) params['name'] = this.searchName();
      if (this.searchStreet()) params['street'] = this.searchStreet();
      const results: any = await firstValueFrom(this.api.get('/api/platinum/third-party-payments/account-search', params));
      this.searchResults.set(Array.isArray(results) ? results : []);
    } catch {
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  selectSearchResult(result: any): void {
    const idx = this.searchIdx();
    if (idx === null) return;
    const accNo = result.accountNumber || result.accountNo || result.accountId || '';
    this.transactions.update(prev => prev.map(t => {
      if (t.index !== idx) return t;
      return {
        ...t,
        resolvedAccountId: accNo, resolvedAccountNumber: accNo,
        matchStatus: 'Manually Matched' as MatchStatus, validated: true,
        validationMessage: 'Manually linked via search',
        ownerName: result.ownerName || result.name || t.ownerName,
        propertyAddress: result.propertyAddress || result.address || t.propertyAddress,
        comment: `Manually matched to ${accNo}`,
      };
    }));
    if (this.importId()) {
      firstValueFrom(this.api.put(`/api/platinum/third-party-payments/${this.importId()}/transactions/${idx}`, {
        newAccountNumber: accNo, comment: `Manually matched to ${accNo}`
      })).catch(() => {});
    }
    this.searchOpen.set(false);
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
    } catch (e: any) {
      this.toast.error('Validation failed: ' + (e?.message || ''));
    } finally {
      this.validating.set(false);
    }
  }

  async handleCommit(): Promise<void> {
    this.committing.set(true);
    try {
      const result: any = await firstValueFrom(this.api.post(`/api/platinum/third-party-payments/${this.importId()}/commit`, {}));
      this.commitResult.set(result);
      this.step.set('committed');
      this.toast.success('Payments committed successfully.');
    } catch (e: any) {
      this.toast.error('Commit failed: ' + (e?.message || ''));
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
}
