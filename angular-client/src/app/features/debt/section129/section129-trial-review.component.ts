import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { getStatusColor } from '../../../services/validation.service';
import { PAGE_SIZE } from '../../../services/debt-config';
import type { Section129Run, Section129RunAccount } from '../../../models/debt.models';

@Component({
  selector: 'app-section129-trial-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './section129-trial-review.component.html',
  styleUrl: './section129-trial-review.component.css'
})
export class Section129TrialReviewComponent implements OnInit {
  runId = 0;
  accounts = signal<Section129RunAccount[]>([]);
  runInfo = signal<Section129Run | null>(null);
  loading = signal(true);
  submitting = signal(false);
  selectedIds = new Set<number>();
  finalReviewComplete = false;
  currentPage = 1;
  pageSize = PAGE_SIZE;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.runId = parseInt(this.route.snapshot.paramMap.get('runId') || '0', 10);
    if (this.runId) this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [accountsData, runsData] = await Promise.all([
        firstValueFrom(this.api.get('/api/platinum/billing-debt/section129-run-accounts', { runId: String(this.runId) })),
        firstValueFrom(this.api.get('/api/platinum/billing-debt/section129-runs')),
      ]);
      this.accounts.set(accountsData || []);
      const run = (runsData || []).find((r: Section129Run) => r.runId === this.runId) || null;
      this.runInfo.set(run);
      const preSelected = new Set<number>(
        (accountsData || []).filter((a: Section129RunAccount) => a.selected).map((a: Section129RunAccount) => a.accountId)
      );
      this.selectedIds = preSelected.size > 0 ? preSelected : new Set<number>((accountsData || []).map((a: Section129RunAccount) => a.accountId));
    } catch (err: any) {
      this.toast.show(err?.error?.message || err?.message || 'Could not load trial run accounts.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  get totalPages(): number {
    return Math.ceil(this.accounts().length / this.pageSize);
  }

  get paginatedAccounts(): Section129RunAccount[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.accounts().slice(start, start + this.pageSize);
  }

  get allOnPageSelected(): boolean {
    const page = this.paginatedAccounts;
    if (page.length === 0) return false;
    return page.every(a => this.selectedIds.has(a.accountId));
  }

  get totalQualifyingAmount(): number {
    return this.accounts()
      .filter(a => this.selectedIds.has(a.accountId))
      .reduce((sum, a) => sum + (a.qualifyingAmount || 0), 0);
  }

  get totalNoticeFees(): number {
    return this.accounts()
      .filter(a => this.selectedIds.has(a.accountId))
      .reduce((sum, a) => sum + (a.noticeFees || 0), 0);
  }

  isSelected(accountId: number): boolean {
    return this.selectedIds.has(accountId);
  }

  toggleAccount(accountId: number): void {
    if (this.selectedIds.has(accountId)) {
      this.selectedIds.delete(accountId);
    } else {
      this.selectedIds.add(accountId);
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  toggleSelectAll(): void {
    const page = this.paginatedAccounts;
    if (this.allOnPageSelected) {
      page.forEach(a => this.selectedIds.delete(a.accountId));
    } else {
      page.forEach(a => this.selectedIds.add(a.accountId));
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  getStatusColor(status: string): string {
    return getStatusColor(status);
  }

  formatCurrency(value: number): string {
    return `R ${(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  }

  getDaysClass(days: number): string {
    if (days > 90) return 'text-danger';
    if (days > 60) return 'text-warning';
    return '';
  }

  async handleSubmit(): Promise<void> {
    if (this.selectedIds.size === 0) {
      this.toast.show('Please select at least one account before submitting.', 'error');
      return;
    }
    this.submitting.set(true);
    try {
      const result: any = await firstValueFrom(this.api.post('/api/platinum/billing-debt/section129-trial-review-submit', {
        runId: this.runId,
        selectedAccountIds: Array.from(this.selectedIds),
        finalReviewComplete: this.finalReviewComplete,
      }));
      this.toast.show(result?.message || `Successfully submitted review for ${this.selectedIds.size} account(s).`, 'success');
      this.router.navigate(['/debt/section129']);
    } catch (err: any) {
      this.toast.show(err?.error?.message || err?.message || 'Failed to submit trial review.', 'error');
    } finally {
      this.submitting.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/debt/section129']);
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }
}
