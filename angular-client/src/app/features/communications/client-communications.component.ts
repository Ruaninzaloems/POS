import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface Recipient {
  id: string;
  accountId: number;
  accountNo: string;
  name: string;
  email: string;
  additionalEmails: string[];
  mobile: string;
  address: string;
  outstanding: number;
  selected: boolean;
  contactLoading: boolean;
  contactLoaded: boolean;
}

interface Attachment {
  id: string;
  name: string;
  size: number;
}

type CommMode = 'email' | 'sms';

@Component({
  selector: 'app-client-communications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-communications.component.html',
  styleUrl: './client-communications.component.css'
})
export class ClientCommunicationsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  loading = signal(false);
  error = signal('');
  mode = signal<CommMode>('email');

  recipients = signal<Recipient[]>([]);
  searchQuery = signal('');
  searching = signal(false);
  searchResults = signal<any[]>([]);
  searchDropdownOpen = signal(false);
  contactIndicators = signal<Record<number, { email: boolean; mobile: boolean; loading: boolean }>>({});

  subject = signal('');
  messageBody = signal('');
  attachments = signal<Attachment[]>([]);

  importing = signal(false);
  importProgress = signal({ current: 0, total: 0, added: 0 });
  contactEnriching = signal(false);
  contactEnrichProgress = signal({ current: 0, total: 0 });
  showPreview = signal(false);

  private recipientIds = new Set<number>();
  private searchTimer: any = null;

  selectedRecipients = computed(() => this.recipients().filter(r => r.selected));
  validEmailRecipients = computed(() => this.selectedRecipients().filter(r => r.email || r.additionalEmails.length > 0));
  validSmsRecipients = computed(() => this.selectedRecipients().filter(r => r.mobile));
  totalEmailAddresses = computed(() => this.validEmailRecipients().reduce((sum, r) => sum + (r.email ? 1 : 0) + r.additionalEmails.length, 0));

  ngOnInit(): void {
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  private handleClickOutside = (e: MouseEvent) => {
    const container = document.querySelector('.search-container');
    if (container && !container.contains(e.target as Node)) {
      this.searchDropdownOpen.set(false);
    }
  };

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  private isValidEmail(val: any): boolean {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    return trimmed.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  private isValidMobile(val: any): boolean {
    if (typeof val !== 'string') return false;
    const cleaned = val.replace(/[\s\-()]/g, '');
    if (/^0[6-8]\d{8}$/.test(cleaned)) return true;
    if (/^\+27[6-8]\d{8}$/.test(cleaned)) return true;
    if (/^27[6-8]\d{8}$/.test(cleaned)) return true;
    if (/^0\d{9}$/.test(cleaned)) return true;
    return false;
  }

  private normalizeMobile(val: string): string {
    const cleaned = val.replace(/[\s\-()]/g, '');
    if (/^\+27\d{9}$/.test(cleaned)) return '0' + cleaned.slice(3);
    if (/^27\d{9}$/.test(cleaned)) return '0' + cleaned.slice(2);
    return cleaned;
  }

  private extractContactInfo(contactRes: any, nameRes: any): { email: string; mobile: string } {
    let email = '';
    let mobile = '';

    const pickEmail = (...vals: any[]) => vals.find(v => this.isValidEmail(v))?.trim() || '';
    const pickMobile = (...vals: any[]) => {
      const found = vals.find(v => this.isValidMobile(v));
      return found ? this.normalizeMobile(found.trim()) : '';
    };

    if (contactRes && !contactRes._error) {
      const c = Array.isArray(contactRes) ? contactRes[0] : contactRes;
      email = pickEmail(c?.email, c?.eMail, c?.emailAddress, c?.Email);
      mobile = pickMobile(c?.cellphone, c?.cellPhone, c?.mobile, c?.mobileNumber, c?.CellPhone);
    }
    if (nameRes && !nameRes._error) {
      const n = Array.isArray(nameRes) ? nameRes[0] : nameRes;
      if (!email) email = pickEmail(n?.email, n?.eMail, n?.emailAddress);
      if (!mobile) mobile = pickMobile(n?.cellphone, n?.cellPhone, n?.mobile);
    }

    return { email, mobile };
  }

  async performSearch(query: string): Promise<void> {
    if (query.length < 2) {
      this.searchResults.set([]);
      this.searchDropdownOpen.set(false);
      return;
    }
    this.searching.set(true);
    try {
      const isNumeric = /^\d+$/.test(query);
      const searchBody: any = {};
      if (isNumeric) { searchBody.accountNo = query; } else { searchBody.name = query; }

      const rawData: any = await firstValueFrom(this.api.post('/api/platinum/billing-payment/search-accounts', searchBody)).catch(() => []);
      const items = Array.isArray(rawData) ? rawData : (rawData?.value || []);
      const results = items.slice(0, 20);
      this.searchResults.set(results);
      this.searchDropdownOpen.set(results.length > 0);

      results.forEach((item: any) => {
        const accId = item.account_ID || item.accountID || item.id;
        if (accId && !this.contactIndicators()[accId]) {
          this.contactIndicators.update(prev => ({ ...prev, [accId]: { email: false, mobile: false, loading: true } }));
          Promise.all([
            firstValueFrom(this.api.get('/api/platinum/billing-account-management/get-contact-details', { accountId: String(accId) })).catch(() => null),
            firstValueFrom(this.api.get('/api/platinum/billing-enquiry/name-info-by-account', { accountId: String(accId) })).catch(() => null),
          ]).then(([contactRes, nameRes]) => {
            const { email, mobile } = this.extractContactInfo(contactRes, nameRes);
            this.contactIndicators.update(prev => ({ ...prev, [accId]: { email: !!email, mobile: !!mobile, loading: false } }));
          });
        }
      });
    } catch {
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (value.length >= 2) {
      this.searchTimer = setTimeout(() => this.performSearch(value), 300);
    } else {
      this.searchResults.set([]);
      this.searchDropdownOpen.set(false);
    }
  }

  private async fetchContactDetails(accountId: number): Promise<{ email: string; mobile: string; additionalEmails: string[] }> {
    let additionalEmails: string[] = [];
    try {
      const [contactRes, nameRes, addEmailRes] = await Promise.all([
        firstValueFrom(this.api.get('/api/platinum/billing-account-management/get-contact-details', { accountId: String(accountId) })).catch(() => null),
        firstValueFrom(this.api.get('/api/platinum/billing-enquiry/name-info-by-account', { accountId: String(accountId) })).catch(() => null),
        firstValueFrom(this.api.get('/api/platinum/billing-account-management/get-additional-emails', { accountId: String(accountId) })).catch(() => null),
      ]);

      const { email, mobile } = this.extractContactInfo(contactRes, nameRes);

      if (addEmailRes && !addEmailRes._error) {
        const emails = Array.isArray(addEmailRes) ? addEmailRes : (addEmailRes?.value || addEmailRes?.emails || []);
        additionalEmails = emails
          .map((e: any) => e?.email || e?.emailAddress || e?.Email || (typeof e === 'string' ? e : ''))
          .filter((e: string) => this.isValidEmail(e));
      }

      return { email, mobile, additionalEmails };
    } catch {
      return { email: '', mobile: '', additionalEmails: [] };
    }
  }

  async addRecipient(item: any): Promise<void> {
    const accId = item.account_ID || item.accountID || item.id;
    if (this.recipientIds.has(accId)) {
      this.toast.info(`Account ${accId} is already in the recipient list.`);
      return;
    }

    const accNo = item.accountNumber || item.accountNo || String(accId);
    const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
    const address = item.deliveryAddress?.replace(/\r?\n/g, ', ') || '';
    const outstanding = item.outStandingAmt || item.outstandingAmount || 0;

    this.recipientIds.add(accId);
    const newRecipient: Recipient = {
      id: `r-${Date.now()}-${accId}`, accountId: accId, accountNo: accNo, name, email: '',
      additionalEmails: [], mobile: '', address, outstanding, selected: true,
      contactLoading: true, contactLoaded: false,
    };

    this.recipients.update(prev => [...prev, newRecipient]);
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchDropdownOpen.set(false);

    try {
      const contactInfo = await this.fetchContactDetails(accId);
      this.recipients.update(prev => prev.map(r =>
        r.accountId === accId ? { ...r, ...contactInfo, contactLoading: false, contactLoaded: true } : r
      ));
    } catch {
      this.recipients.update(prev => prev.map(r =>
        r.accountId === accId ? { ...r, contactLoading: false, contactLoaded: true } : r
      ));
    }
  }

  removeRecipient(id: string): void {
    const removed = this.recipients().find(r => r.id === id);
    if (removed) this.recipientIds.delete(removed.accountId);
    this.recipients.update(prev => prev.filter(r => r.id !== id));
  }

  toggleRecipient(id: string): void {
    this.recipients.update(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  }

  updateRecipientField(id: string, field: 'email' | 'mobile', value: string): void {
    this.recipients.update(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  selectAll(): void { this.recipients.update(prev => prev.map(r => ({ ...r, selected: true }))); }
  deselectAll(): void { this.recipients.update(prev => prev.map(r => ({ ...r, selected: false }))); }
  clearAll(): void { this.recipientIds.clear(); this.recipients.set([]); }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < input.files.length; i++) {
      const f = input.files[i];
      newAttachments.push({ id: `att-${Date.now()}-${i}`, name: f.name, size: f.size });
    }
    this.attachments.update(prev => [...prev, ...newAttachments]);
    input.value = '';
  }

  removeAttachment(id: string): void {
    this.attachments.update(prev => prev.filter(a => a.id !== id));
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  handleSend(): void {
    if (this.mode() === 'email') {
      if (this.validEmailRecipients().length === 0) {
        this.toast.error('None of the selected accounts have email addresses.');
        return;
      }
      if (!this.subject().trim()) {
        this.toast.error('Please enter an email subject.');
        return;
      }
    } else {
      if (this.validSmsRecipients().length === 0) {
        this.toast.error('None of the selected accounts have mobile numbers.');
        return;
      }
    }
    if (!this.messageBody().trim()) {
      this.toast.error('Please enter a message body.');
      return;
    }

    const recipients = this.mode() === 'email' ? this.validEmailRecipients() : this.validSmsRecipients();
    const count = this.mode() === 'email' ? this.totalEmailAddresses() : this.validSmsRecipients().length;

    const payload = {
      mode: this.mode(),
      subject: this.mode() === 'email' ? this.subject() : undefined,
      body: this.messageBody(),
      recipients: recipients.map(r => ({
        accountId: r.accountId, accountNo: r.accountNo, name: r.name,
        email: r.email, additionalEmails: r.additionalEmails, mobile: r.mobile,
      })),
      attachmentCount: this.attachments().length,
      attachmentNames: this.attachments().map(a => a.name),
    };

    console.log('[ClientCommunications] SEND payload:', JSON.stringify(payload, null, 2));
    this.toast.success(`${this.mode() === 'email' ? `Email to ${count} address(es)` : `SMS to ${count} number(s)`} \u2014 sending is disabled in this prototype. Payload logged to console.`);
  }

  async handleCsvImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importing.set(true);
    this.importProgress.set({ current: 0, total: 0, added: 0 });

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const accountNos: string[] = [];
      for (const line of lines) {
        const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/"/g, ''));
        for (const part of parts) {
          const cleaned = part.replace(/\D/g, '');
          if (cleaned.length >= 2 && cleaned.length <= 15) accountNos.push(cleaned);
        }
      }

      const unique = Array.from(new Set(accountNos));
      if (unique.length === 0) {
        this.toast.error('Could not find any new valid account numbers in the file.');
        this.importing.set(false);
        return;
      }

      this.importProgress.set({ current: 0, total: unique.length, added: 0 });
      let totalAdded = 0;
      const pendingContactIds: number[] = [];
      const BATCH_SIZE = 20;

      for (let batchStart = 0; batchStart < unique.length; batchStart += BATCH_SIZE) {
        const batch = unique.slice(batchStart, batchStart + BATCH_SIZE);
        const searchPromises = batch.map(async (accNo) => {
          try {
            const rawData: any = await firstValueFrom(this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: accNo })).catch(() => []);
            const data = rawData || [];
            const items: any[] = Array.isArray(data) ? data : (data?.value || []);
            return items.find((i: any) => {
              const itemAccNo = String(i.accountNumber || i.accountNo || i.account_ID || i.accountID || i.id || '');
              return itemAccNo === accNo || itemAccNo.replace(/^0+/, '') === accNo.replace(/^0+/, '');
            }) || (items.length > 0 ? items[0] : null);
          } catch { return null; }
        });

        const foundItems = await Promise.all(searchPromises);
        for (const item of foundItems) {
          if (!item) continue;
          const accId = item.account_ID || item.accountID || item.id;
          if (accId && !this.recipientIds.has(accId)) {
            const accNo = item.accountNumber || item.accountNo || String(accId);
            const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
            const address = item.deliveryAddress?.replace(/\r?\n/g, ', ') || '';
            const outstanding = item.outStandingAmt || item.outstandingAmount || 0;

            this.recipientIds.add(accId);
            const newRecipient: Recipient = {
              id: `r-${Date.now()}-${accId}`, accountId: accId, accountNo: accNo, name, email: '',
              additionalEmails: [], mobile: '', address, outstanding, selected: true,
              contactLoading: true, contactLoaded: false,
            };
            this.recipients.update(prev => [...prev, newRecipient]);
            totalAdded++;
            pendingContactIds.push(accId);
          }
        }
        this.importProgress.set({ current: Math.min(batchStart + BATCH_SIZE, unique.length), total: unique.length, added: totalAdded });
      }

      this.toast.success(`Import complete: Added ${totalAdded} account(s).${pendingContactIds.length > 0 ? ' Loading contact details in background...' : ''}`);
      this.importing.set(false);
      this.importProgress.set({ current: 0, total: 0, added: 0 });

      if (pendingContactIds.length > 0) {
        this.contactEnriching.set(true);
        this.contactEnrichProgress.set({ current: 0, total: pendingContactIds.length });
        const CONTACT_BATCH_SIZE = 10;

        for (let ci = 0; ci < pendingContactIds.length; ci += CONTACT_BATCH_SIZE) {
          const contactBatch = pendingContactIds.slice(ci, ci + CONTACT_BATCH_SIZE);
          const contactResults = await Promise.all(
            contactBatch.map(async (accId: number) => {
              const info = await this.fetchContactDetails(accId);
              return { accId, info };
            })
          );

          this.recipients.update(prev => {
            const updates = new Map(contactResults.map(cr => [cr.accId, cr.info]));
            return prev.map(r => {
              const info = updates.get(r.accountId);
              return info ? { ...r, ...info, contactLoading: false, contactLoaded: true } : r;
            });
          });

          this.contactEnrichProgress.set({ current: Math.min(ci + CONTACT_BATCH_SIZE, pendingContactIds.length), total: pendingContactIds.length });
        }

        this.contactEnriching.set(false);
        this.toast.success(`Loaded contact info for ${pendingContactIds.length} account(s).`);
      }
    } catch {
      this.toast.error('Could not read the file.');
    } finally {
      this.importing.set(false);
      this.importProgress.set({ current: 0, total: 0, added: 0 });
      input.value = '';
    }
  }

  isAlreadyAdded(accId: number): boolean {
    return this.recipientIds.has(accId);
  }

  formatFileSizeTotal(): string {
    const total = this.attachments().reduce((s, a) => s + a.size, 0);
    return this.formatFileSize(total);
  }

  previewToLine(): string {
    const vr = this.validEmailRecipients();
    const shown = vr.slice(0, 3).map(r => `${r.name} <${r.email}>`).join('; ');
    return vr.length > 3 ? `${shown} (+${vr.length - 3} more)` : shown;
  }

  previewFileNames(): string {
    return this.attachments().map(a => a.name).join(', ');
  }

  downloadTemplate(): void {
    const csv = 'AccountNumber\n000000001234\n000000005678\n000000009012';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_template.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
