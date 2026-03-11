import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { TERMINATION_REASONS, PAGE_SIZE } from '../../../services/debt-config';
import { formatCurrency, formatDate } from '../../../services/format.service';
import { Attorney, HandoverRecord } from '../../../models/debt.models';

@Component({
  selector: 'app-handover-termination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './handover-termination.component.html',
  styleUrls: ['./handover-termination.component.css']
})
export class HandoverTerminationComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  handovers = signal<HandoverRecord[]>([]);
  attorneys = signal<Attorney[]>([]);
  loading = signal(true);
  submitting = signal(false);

  accountFilter = signal('');
  attorneyFilter = signal('__all__');
  statusFilter = signal('__all__');
  dateFrom = signal('');
  dateTo = signal('');

  selectedIds = signal<Set<number>>(new Set());
  terminationReason = signal('');
  terminationNotes = signal('');

  currentPage = signal(1);

  TERMINATION_REASONS = TERMINATION_REASONS;
  formatCurrency = formatCurrency;
  formatDate = formatDate;

  uniqueStatuses = computed(() => {
    const statuses = new Set(this.handovers().map(h => h.status));
    return Array.from(statuses).sort();
  });

  filteredHandovers = computed(() => {
    return this.handovers().filter(h => {
      if (this.accountFilter() && !h.accountNo.toLowerCase().includes(this.accountFilter().toLowerCase())) return false;
      if (this.attorneyFilter() !== '__all__' && String(h.attorneyId) !== this.attorneyFilter()) return false;
      if (this.statusFilter() !== '__all__' && h.status !== this.statusFilter()) return false;
      if (this.dateFrom()) {
        const hDate = new Date(h.handoverDate);
        if (hDate < new Date(this.dateFrom())) return false;
      }
      if (this.dateTo()) {
        const hDate = new Date(h.handoverDate);
        const endOfDay = new Date(this.dateTo());
        endOfDay.setHours(23, 59, 59, 999);
        if (hDate > endOfDay) return false;
      }
      return true;
    });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredHandovers().length / PAGE_SIZE))
  );

  paginatedHandovers = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filteredHandovers().slice(start, start + PAGE_SIZE);
  });

  allVisibleSelected = computed(() => {
    const paginated = this.paginatedHandovers();
    return paginated.length > 0 && paginated.every(h => this.selectedIds().has(h.handoverId));
  });

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [handoverData, attorneyData] = await Promise.all([
        firstValueFrom(this.api.get<HandoverRecord[]>('/api/platinum/billing-debt/handover-list')),
        firstValueFrom(this.api.get<Attorney[]>('/api/platinum/billing-debt/attorney-list')),
      ]);
      this.handovers.set(Array.isArray(handoverData) ? handoverData : []);
      this.attorneys.set(Array.isArray(attorneyData) ? attorneyData : []);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load handover data.');
    } finally {
      this.loading.set(false);
    }
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.selectedIds.set(new Set());
  }

  toggleSelectAll(): void {
    const newSet = new Set(this.selectedIds());
    if (this.allVisibleSelected()) {
      this.paginatedHandovers().forEach(h => newSet.delete(h.handoverId));
    } else {
      this.paginatedHandovers().forEach(h => newSet.add(h.handoverId));
    }
    this.selectedIds.set(newSet);
  }

  toggleSelect(id: number): void {
    const newSet = new Set(this.selectedIds());
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    this.selectedIds.set(newSet);
  }

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  async handleSubmitTermination(): Promise<void> {
    if (this.selectedIds().size === 0) {
      this.toast.error('Please select at least one handover to terminate.');
      return;
    }
    if (!this.terminationReason()) {
      this.toast.error('Please select a termination reason.');
      return;
    }
    this.submitting.set(true);
    try {
      const result = await firstValueFrom(this.api.post<any>('/api/platinum/billing-debt/handover-terminate', {
        handoverIds: Array.from(this.selectedIds()),
        reason: this.terminationReason(),
        notes: this.terminationNotes(),
      }));
      this.toast.success(result.message || `${this.selectedIds().size} handover(s) submitted for termination approval.`);
      this.selectedIds.set(new Set());
      this.terminationReason.set('');
      this.terminationNotes.set('');
      await this.loadData();
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to submit termination.');
    } finally {
      this.submitting.set(false);
    }
  }

  getStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('active')) return 'badge-success';
    if (s.includes('termination') && s.includes('approved')) return 'badge-info';
    if (s.includes('pending')) return 'badge-warning';
    if (s.includes('terminated')) return 'badge-danger';
    return 'badge-outline';
  }

  prevPage(): void { this.currentPage.update(p => Math.max(1, p - 1)); }
  nextPage(): void { this.currentPage.update(p => Math.min(this.totalPages(), p + 1)); }

  goBack(): void { this.router.navigate(['/']); }
}
