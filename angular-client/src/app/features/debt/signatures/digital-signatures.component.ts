import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { DOC_TYPES, SIGNATURE_STATUS_LABELS } from '../../../services/debt-config';
import { formatDate, formatCurrency } from '../../../services/format.service';
import type { SignatureRequest } from '../../../models/debt.models';

@Component({
  selector: 'app-digital-signatures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './digital-signatures.component.html',
  styleUrl: './digital-signatures.component.css'
})
export class DigitalSignaturesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(true);
  tab = signal('requests');
  requests = signal<any[]>([]);
  auditLog = signal<any[]>([]);
  loadingAudit = signal(false);

  filterStatus = signal('ALL');
  filterDocType = signal('ALL');
  searchText = signal('');

  showCreateDialog = signal(false);
  showDetailDialog = signal(false);
  detailRequest = signal<SignatureRequest | null>(null);
  loadingDetail = signal(false);
  saving = signal(false);

  formAccountNo = signal('');
  formDocType = signal('AOD');
  formSignerName = signal('');
  formSignerEmail = signal('');
  formSignerMobile = signal('');
  formAmount = signal('');
  formNotes = signal('');
  formExpiryDays = signal('7');

  DOC_TYPES = DOC_TYPES;
  STATUS_LABELS = SIGNATURE_STATUS_LABELS;
  statusEntries = Object.entries(SIGNATURE_STATUS_LABELS);

  filtered = computed(() => {
    return this.requests().filter(r => {
      if (this.filterStatus() !== 'ALL' && r.status !== this.filterStatus()) return false;
      if (this.filterDocType() !== 'ALL' && r.documentType !== this.filterDocType()) return false;
      if (this.searchText()) {
        const s = this.searchText().toLowerCase();
        if (!r.accountNo?.toLowerCase().includes(s) && !r.signerName?.toLowerCase().includes(s) && !r.signerEmail?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  });

  pendingCount = computed(() => this.requests().filter(r => r.status === 'PENDING' || r.status === 'SENT').length);
  signedCount = computed(() => this.requests().filter(r => r.status === 'SIGNED').length);
  declinedCount = computed(() => this.requests().filter(r => r.status === 'DECLINED').length);
  expiredCount = computed(() => this.requests().filter(r => r.status === 'EXPIRED').length);

  ngOnInit(): void { this.loadRequests(); }

  async loadRequests(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any>('/api/digital-signatures'));
      this.requests.set(Array.isArray(data) ? data : data?.requests || []);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load requests');
    } finally {
      this.loading.set(false);
    }
  }

  async loadAudit(): Promise<void> {
    this.loadingAudit.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any>('/api/digital-signatures/audit-log'));
      this.auditLog.set(Array.isArray(data) ? data : data?.entries || []);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load audit log');
    } finally {
      this.loadingAudit.set(false);
    }
  }

  onTabChange(t: string): void {
    this.tab.set(t);
    if (t === 'audit' && this.auditLog().length === 0) this.loadAudit();
  }

  openCreate(): void {
    this.formAccountNo.set('');
    this.formDocType.set('AOD');
    this.formSignerName.set('');
    this.formSignerEmail.set('');
    this.formSignerMobile.set('');
    this.formAmount.set('');
    this.formNotes.set('');
    this.formExpiryDays.set('7');
    this.showCreateDialog.set(true);
  }

  async openDetail(req: any): Promise<void> {
    this.detailRequest.set(req);
    this.showDetailDialog.set(true);
    this.loadingDetail.set(true);
    try {
      const data = await firstValueFrom(this.api.get<SignatureRequest>(`/api/digital-signatures/${req.id}`));
      this.detailRequest.set(data);
    } catch {
    } finally {
      this.loadingDetail.set(false);
    }
  }

  async handleCreate(): Promise<void> {
    if (!this.formAccountNo().trim() || !this.formSignerName().trim() || !this.formSignerEmail().trim()) {
      this.toast.error('Account number, signer name and email are required');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post<any>('/api/digital-signatures', {
        accountNo: this.formAccountNo(),
        documentType: this.formDocType(),
        signerName: this.formSignerName(),
        signerEmail: this.formSignerEmail(),
        signerMobile: this.formSignerMobile() || undefined,
        amount: this.formAmount() ? parseFloat(this.formAmount()) : undefined,
        notes: this.formNotes() || undefined,
        expiryDays: parseInt(this.formExpiryDays()) || 7,
      }));
      this.toast.success(`Request sent to ${this.formSignerName()} at ${this.formSignerEmail()}`);
      this.showCreateDialog.set(false);
      await this.loadRequests();
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to create request');
    } finally {
      this.saving.set(false);
    }
  }

  getStatusClass(status: string): string {
    return SIGNATURE_STATUS_LABELS[status]?.className || SIGNATURE_STATUS_LABELS['PENDING'].className;
  }

  getStatusLabel(status: string): string {
    return SIGNATURE_STATUS_LABELS[status]?.label || status;
  }

  getDocTypeLabel(value: string): string {
    return DOC_TYPES.find(d => d.value === value)?.label || value;
  }

  fmtDate(d: string | null | undefined): string { return formatDate(d); }
  fmtCurrency(v: number | null | undefined): string { return formatCurrency(v); }

  goHome(): void { this.router.navigate(['/']); }
  goDebt(): void { this.router.navigate(['/debt/section129']); }
}
