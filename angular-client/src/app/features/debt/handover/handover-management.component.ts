import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PAGE_SIZE } from '../../../services/debt-config';
import { formatCurrency, formatDate } from '../../../services/format.service';
import { Attorney, HandoverRecord, HandoverOption } from '../../../models/debt.models';

@Component({
  selector: 'app-handover-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './handover-management.component.html',
  styleUrls: ['./handover-management.component.css']
})
export class HandoverManagementComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  handoverOption = signal<HandoverOption>('account');
  accountSearch = signal('');
  selectedAttorneyId = signal('');
  billingCycle = signal('');
  town = signal('');
  ageing = signal('');
  amountGreaterThan = signal('');

  attorneys = signal<Attorney[]>([]);
  billingCycles = signal<{ id: string; name: string }[]>([]);
  towns = signal<{ id: string; name: string }[]>([]);
  ageingRanges = signal<{ id: string; name: string }[]>([]);

  rotationAllocations = signal<{ attorneyId: number; attorneyName: string; percentage: number }[]>([]);

  handovers = signal<HandoverRecord[]>([]);
  loadingHandovers = signal(false);
  loadingRef = signal(true);
  submitting = signal(false);
  currentPage = signal(1);

  selectedHandover = signal<HandoverRecord | null>(null);
  accountDetail = signal<any>(null);
  handoverTransactions = signal<any[]>([]);
  loadingDetail = signal(false);

  formatCurrency = formatCurrency;
  formatDate = formatDate;

  activeAttorneys = computed(() => this.attorneys().filter(a => a.isActive));

  totalAllocation = computed(() =>
    this.rotationAllocations().reduce((sum, a) => sum + a.percentage, 0)
  );

  paginatedHandovers = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.handovers().slice(start, start + PAGE_SIZE);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.handovers().length / PAGE_SIZE))
  );

  ngOnInit(): void {
    this.loadRefData();
    this.loadHandovers();
  }

  async loadRefData(): Promise<void> {
    this.loadingRef.set(true);
    try {
      const [attResult, bcResult, townResult, ageResult] = await Promise.allSettled([
        firstValueFrom(this.api.get<Attorney[]>('/api/platinum/billing-debt/attorney-list')),
        firstValueFrom(this.api.get<any[]>('/api/platinum/billing-debt/billing-cycles')),
        firstValueFrom(this.api.get<any[]>('/api/platinum/billing-debt/towns')),
        firstValueFrom(this.api.get<any[]>('/api/platinum/billing-debt/ageing-ranges')),
      ]);
      if (attResult.status === 'fulfilled') this.attorneys.set(attResult.value);
      if (bcResult.status === 'fulfilled') this.billingCycles.set(bcResult.value);
      if (townResult.status === 'fulfilled') this.towns.set(townResult.value);
      if (ageResult.status === 'fulfilled') this.ageingRanges.set(ageResult.value);
    } catch (e: any) {
      this.toast.error('Failed to load reference data');
    } finally {
      this.loadingRef.set(false);
    }
  }

  async loadHandovers(): Promise<void> {
    this.loadingHandovers.set(true);
    try {
      const data = await firstValueFrom(this.api.get<HandoverRecord[]>('/api/platinum/billing-debt/handover-list'));
      this.handovers.set(Array.isArray(data) ? data : []);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load handovers');
    } finally {
      this.loadingHandovers.set(false);
    }
  }

  setOption(opt: HandoverOption): void {
    this.handoverOption.set(opt);
    this.handleClear();
  }

  addRotationAttorney(): void {
    this.rotationAllocations.update(prev => [...prev, { attorneyId: 0, attorneyName: '', percentage: 0 }]);
  }

  removeRotationAttorney(idx: number): void {
    this.rotationAllocations.update(prev => prev.filter((_, i) => i !== idx));
  }

  updateRotationAttorneyId(idx: number, value: string): void {
    const id = parseInt(value, 10);
    const att = this.attorneys().find(a => a.attorneyId === id);
    this.rotationAllocations.update(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], attorneyId: id, attorneyName: att?.attorneyName || '' };
      return updated;
    });
  }

  updateRotationPercentage(idx: number, value: string): void {
    this.rotationAllocations.update(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], percentage: parseFloat(value) || 0 };
      return updated;
    });
  }

  async handleSubmit(): Promise<void> {
    const opt = this.handoverOption();
    if (opt === 'account') {
      if (!this.accountSearch().trim()) { this.toast.error('Please enter an account number.'); return; }
      if (!this.selectedAttorneyId()) { this.toast.error('Please select an attorney.'); return; }
    }
    if (opt === 'bulk') {
      if (!this.selectedAttorneyId()) { this.toast.error('Please select an attorney for bulk handover.'); return; }
    }
    if (opt === 'rotation') {
      if (this.rotationAllocations().length === 0) { this.toast.error('Please add at least one attorney for rotation.'); return; }
      if (Math.abs(this.totalAllocation() - 100) > 0.01) { this.toast.error(`Rotation percentages must total 100%. Current: ${this.totalAllocation().toFixed(1)}%`); return; }
    }

    this.submitting.set(true);
    try {
      const params: any = { handoverOption: opt, attorneyId: opt !== 'rotation' ? parseInt(this.selectedAttorneyId(), 10) : 0 };
      if (opt === 'account') params.accountNo = this.accountSearch().trim();
      if (opt === 'bulk' || opt === 'rotation') {
        if (this.billingCycle()) params.billingCycle = this.billingCycle();
        if (this.town()) params.town = this.town();
        if (this.ageing()) params.ageing = this.ageing();
        if (this.amountGreaterThan()) params.amountGreaterThan = parseFloat(this.amountGreaterThan());
      }
      if (opt === 'rotation') {
        params.rotationAllocations = this.rotationAllocations().map(a => ({ attorneyId: a.attorneyId, percentage: a.percentage }));
      }
      const result = await firstValueFrom(this.api.post<any>('/api/platinum/billing-debt/handover-submit', params));
      this.toast.success(result.message || 'Handover submitted successfully.');
      this.loadHandovers();
      this.handleClear();
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to submit handover.');
    } finally {
      this.submitting.set(false);
    }
  }

  handleClear(): void {
    this.accountSearch.set('');
    this.selectedAttorneyId.set('');
    this.billingCycle.set('');
    this.town.set('');
    this.ageing.set('');
    this.amountGreaterThan.set('');
    this.rotationAllocations.set([]);
  }

  async selectHandover(h: HandoverRecord): Promise<void> {
    if (this.selectedHandover()?.handoverId === h.handoverId) {
      this.selectedHandover.set(null);
      this.accountDetail.set(null);
      this.handoverTransactions.set([]);
      return;
    }
    this.selectedHandover.set(h);
    this.loadingDetail.set(true);
    this.accountDetail.set(null);
    this.handoverTransactions.set([]);
    try {
      const [detail, txns] = await Promise.allSettled([
        firstValueFrom(this.api.get<any>('/api/platinum/billing-debt/handover-account-detail', { handoverId: String(h.handoverId), accountNo: h.accountNo })),
        firstValueFrom(this.api.get<any[]>('/api/platinum/billing-debt/handover-transactions', { handoverId: String(h.handoverId) })),
      ]);
      if (detail.status === 'fulfilled') this.accountDetail.set(detail.value);
      if (txns.status === 'fulfilled') this.handoverTransactions.set(Array.isArray(txns.value) ? txns.value : []);
    } catch (e: any) {
      this.toast.error('Failed to load handover detail');
    } finally {
      this.loadingDetail.set(false);
    }
  }

  closeDetail(): void {
    this.selectedHandover.set(null);
    this.accountDetail.set(null);
    this.handoverTransactions.set([]);
  }

  getStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('active')) return 'badge-success';
    if (s.includes('terminated') || s.includes('closed')) return 'badge-danger';
    if (s.includes('pending')) return 'badge-warning';
    return 'badge-outline';
  }

  prevPage(): void { this.currentPage.update(p => Math.max(1, p - 1)); }
  nextPage(): void { this.currentPage.update(p => Math.min(this.totalPages(), p + 1)); }
}
