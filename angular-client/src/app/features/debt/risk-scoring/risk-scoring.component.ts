import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { RISK_COLORS } from '../../../services/debt-config';
import { TabMode } from '../../../models/debt.models';

@Component({
  selector: 'app-risk-scoring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './risk-scoring.component.html',
  styleUrls: ['./risk-scoring.component.css']
})
export class RiskScoringComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  tab = signal<TabMode>('score');
  accountNo = signal('');
  bulkInput = signal('');
  scoring = signal(false);
  scoreResult = signal<any>(null);
  factors = signal<any[]>([]);

  paymentHistory = signal('50');
  arrearDays = signal('0');
  lastPaymentDays = signal('30');
  totalArrears = signal('0');
  indigentStatus = signal('false');
  previousLegalActions = signal('0');
  locationRisk = signal('50');
  waterArrears = signal('0');
  electricityArrears = signal('0');

  dashScores = signal<any[]>([]);
  dashTotal = signal(0);
  dashFilter = signal('__all__');
  dashPage = signal(1);
  dashLoading = signal(false);
  dashPageSize = 10;

  weights = signal<Record<string, { label: string; weight: number; description: string }>>({});
  editWeights = signal<Record<string, number>>({});
  weightsLoading = signal(false);
  weightsSaving = signal(false);

  RISK_COLORS = RISK_COLORS;

  dashTotalPages = computed(() => Math.max(1, Math.ceil(this.dashTotal() / this.dashPageSize)));
  lowCount = computed(() => this.dashScores().filter(s => s.riskCategory === 'LOW').length);
  medCount = computed(() => this.dashScores().filter(s => s.riskCategory === 'MEDIUM').length);
  highCount = computed(() => this.dashScores().filter(s => s.riskCategory === 'HIGH').length);
  weightEntries = computed(() => Object.entries(this.weights()) as [string, { label: string; weight: number; description: string }][]);
  totalWeight = computed(() => Object.values(this.editWeights()).reduce((s, w) => s + w, 0));

  ngOnInit(): void {}

  getGaugeStroke(score: number): string { return `${(score / 100) * 327} 327`; }

  getRiskColorClass(category: string, type: 'text' | 'bg' | 'border' | 'bar'): string {
    const c = RISK_COLORS[category] || RISK_COLORS['MEDIUM'];
    return c[type] || '';
  }

  getFactorBarClass(pct: number): string {
    if (pct <= 30) return 'bar-low';
    if (pct <= 60) return 'bar-medium';
    return 'bar-high';
  }

  getScoreValue(): number {
    const r = this.scoreResult();
    return parseFloat(r?.overallScore || r?.overall_score || 0);
  }

  getScoreCategory(): string {
    const r = this.scoreResult();
    return r?.riskCategory || r?.risk_category || 'LOW';
  }

  getFactorPct(f: any): number {
    return Math.min(100, f.normalizedScore || f.normalized_score || 0);
  }

  async handleScore(): Promise<void> {
    if (!this.accountNo().trim()) { this.toast.error('Account number required'); return; }
    this.scoring.set(true);
    try {
      const result = await firstValueFrom(this.api.post<any>('/api/debt-scoring/score-account', {
        accountNo: this.accountNo().trim(),
        paymentHistory: parseFloat(this.paymentHistory()) || 50,
        arrearAge: parseInt(this.arrearDays()) || 0,
        arrearDays: parseInt(this.arrearDays()) || 0,
        lastPaymentDays: parseInt(this.lastPaymentDays()) || 30,
        paymentFrequency: parseInt(this.lastPaymentDays()) || 30,
        totalArrears: parseFloat(this.totalArrears()) || 0,
        debtSize: parseFloat(this.totalArrears()) || 0,
        indigentStatus: this.indigentStatus() === 'true',
        previousLegalActions: parseInt(this.previousLegalActions()) || 0,
        locationRisk: parseFloat(this.locationRisk()) || 50,
        waterArrears: parseFloat(this.waterArrears()) || 0,
        electricityArrears: parseFloat(this.electricityArrears()) || 0,
        serviceTypes: [
          ...(parseFloat(this.waterArrears()) > 0 ? ['water'] : []),
          ...(parseFloat(this.electricityArrears()) > 0 ? ['electricity'] : []),
        ],
      }));
      this.scoreResult.set(result);
      const fs = result.factorScores || result.factor_scores || [];
      this.factors.set(Array.isArray(fs) ? fs : []);
      this.toast.success(`Risk: ${result.riskCategory || result.risk_category} (${result.overallScore || result.overall_score || 0})`);
    } catch (err: any) {
      this.toast.error(err?.message || 'Scoring failed');
    } finally { this.scoring.set(false); }
  }

  async handleBulkScore(): Promise<void> {
    const lines = this.bulkInput().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { this.toast.error('Enter account numbers'); return; }
    this.scoring.set(true);
    try {
      const accounts = lines.map(accountNo => ({ accountNo, paymentHistory: 50, arrearAge: 90, lastPaymentDays: 60, totalArrears: 5000, debtSize: 5000, indigentStatus: false, previousLegalActions: 0, locationRisk: 50, serviceTypes: ['water', 'electricity'] }));
      await firstValueFrom(this.api.post<any>('/api/debt-scoring/score-bulk', { accounts }));
      this.toast.success(`${lines.length} accounts scored`);
      this.bulkInput.set('');
      this.loadDashboard();
    } catch (err: any) { this.toast.error(err?.message || 'Bulk scoring failed'); }
    finally { this.scoring.set(false); }
  }

  async loadDashboard(): Promise<void> {
    this.dashLoading.set(true);
    try {
      const params: any = { limit: String(this.dashPageSize), offset: String((this.dashPage() - 1) * this.dashPageSize) };
      if (this.dashFilter() !== '__all__') params.riskCategory = this.dashFilter();
      const data = await firstValueFrom(this.api.get<any>('/api/debt-scoring/scores', params));
      this.dashScores.set(data?.scores || []);
      this.dashTotal.set(data?.total || 0);
    } catch (err: any) { this.toast.error(err?.message || 'Failed to load scores'); }
    finally { this.dashLoading.set(false); }
  }

  async loadWeights(): Promise<void> {
    this.weightsLoading.set(true);
    try {
      const w = await firstValueFrom(this.api.get<any>('/api/debt-scoring/weights'));
      this.weights.set(w || {});
      const edit: Record<string, number> = {};
      for (const [k, v] of Object.entries(w || {})) edit[k] = (v as any).weight;
      this.editWeights.set(edit);
    } catch (err: any) { this.toast.error(err?.message || 'Failed to load weights'); }
    finally { this.weightsLoading.set(false); }
  }

  async handleSaveWeights(): Promise<void> {
    this.weightsSaving.set(true);
    try {
      await firstValueFrom(this.api.put<any>('/api/debt-scoring/weights', this.editWeights()));
      await this.loadWeights();
      this.toast.success('Weights saved');
    } catch (err: any) { this.toast.error(err?.message || 'Failed to save weights'); }
    finally { this.weightsSaving.set(false); }
  }

  updateEditWeight(key: string, value: number): void {
    this.editWeights.update(w => ({ ...w, [key]: value }));
  }

  onTabChange(t: TabMode): void {
    this.tab.set(t);
    if (t === 'dashboard') this.loadDashboard();
    if (t === 'weights') this.loadWeights();
  }

  onDashFilterChange(value: string): void {
    this.dashFilter.set(value);
    this.dashPage.set(1);
    this.loadDashboard();
  }

  dashPrevPage(): void { this.dashPage.update(p => Math.max(1, p - 1)); this.loadDashboard(); }
  dashNextPage(): void { this.dashPage.update(p => Math.min(this.dashTotalPages(), p + 1)); this.loadDashboard(); }

  goBack(): void { this.router.navigate(['/']); }
}
