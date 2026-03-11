import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import type { Section129Run, ReviewDecision, AuthorizationRow } from '../../../models/debt.models';

@Component({
  selector: 'app-section129-authorization',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './section129-authorization.component.html',
  styleUrl: './section129-authorization.component.css'
})
export class Section129AuthorizationComponent implements OnInit {
  loading = signal(true);
  submitting = signal(false);
  rows: AuthorizationRow[] = [];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRuns();
  }

  async loadRuns(): Promise<void> {
    this.loading.set(true);
    try {
      const allRuns: Section129Run[] = await firstValueFrom(this.api.get('/api/platinum/billing-debt/section129-runs'));
      const pending = (allRuns || []).filter((r) => {
        const s = (r.status || '').toLowerCase().replace(/[–—]/g, '-');
        return s.includes('notice issued') && s.includes('trial') && !s.includes('review') && !s.includes('final');
      });
      this.rows = pending.map((run) => ({ run, review: '' as ReviewDecision, notes: '' }));
    } catch (err: any) {
      this.toast.show(err?.error?.message || err?.message || 'Could not fetch Section 129 runs for authorization.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  updateReview(index: number, value: string): void {
    this.rows[index] = { ...this.rows[index], review: value as ReviewDecision };
  }

  updateNotes(index: number, value: string): void {
    this.rows[index] = { ...this.rows[index], notes: value.slice(0, 250) };
  }

  get decisionsCount(): number {
    return this.rows.filter(r => r.review !== '').length;
  }

  formatDate(d: string | undefined): string {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
    } catch {
      return d;
    }
  }

  formatAmount(amount: number | undefined): string {
    if (amount == null) return '—';
    return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  }

  getRowClass(review: ReviewDecision): string {
    if (review === 'Approve') return 'row-approve';
    if (review === 'Decline') return 'row-decline';
    return '';
  }

  async handleSubmit(): Promise<void> {
    const actionableRows = this.rows.filter(r => r.review !== '');
    if (actionableRows.length === 0) {
      this.toast.show('Please select Approve or Decline for at least one run before submitting.', 'error');
      return;
    }
    const missingNotes = actionableRows.filter(r => r.review === 'Decline' && !r.notes.trim());
    if (missingNotes.length > 0) {
      this.toast.show('Please provide notes for all declined runs.', 'error');
      return;
    }

    this.submitting.set(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of actionableRows) {
      try {
        await firstValueFrom(this.api.post('/api/platinum/billing-debt/section129-authorize', {
          runId: row.run.runId,
          notes: row.notes,
          review: row.review,
        }));
        successCount++;
      } catch {
        errorCount++;
      }
    }

    this.submitting.set(false);

    if (successCount > 0) {
      this.toast.show(`${successCount} run(s) processed successfully.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`, 'success');
      await this.loadRuns();
    } else {
      this.toast.show('All authorization requests failed. Please try again.', 'error');
    }
  }

  handleCancel(): void {
    this.router.navigate(['/']);
  }
}
