import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrencyCompact } from '../../services/format.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-executive-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './executive-dashboard.component.html',
  styleUrl: './executive-dashboard.component.css'
})
export class ExecutiveDashboardComponent implements OnInit {
  loading = signal(true);
  overview = signal<any>(null);
  aging = signal<any>(null);
  recovery = signal<any>(null);
  pipeline = signal<any>(null);
  attorneys = signal<any>(null);
  risk = signal<any>(null);

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const results = await Promise.allSettled([
        firstValueFrom(this.api.get('/api/analytics/debt-overview')),
        firstValueFrom(this.api.get('/api/analytics/aging-analysis')),
        firstValueFrom(this.api.get('/api/analytics/recovery-stats')),
        firstValueFrom(this.api.get('/api/analytics/legal-pipeline')),
        firstValueFrom(this.api.get('/api/analytics/attorney-performance')),
        firstValueFrom(this.api.get('/api/analytics/risk-distribution')),
      ]);
      if (results[0].status === 'fulfilled') this.overview.set(results[0].value);
      if (results[1].status === 'fulfilled') this.aging.set(results[1].value);
      if (results[2].status === 'fulfilled') this.recovery.set(results[2].value);
      if (results[3].status === 'fulfilled') this.pipeline.set(results[3].value);
      if (results[4].status === 'fulfilled') this.attorneys.set(results[4].value);
      if (results[5].status === 'fulfilled') this.risk.set(results[5].value);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        this.toast.show(`${failed.length} dashboard data source(s) unavailable from Platinum API.`, 'error');
      }
    } catch (e: any) {
      this.toast.show(e?.message || 'Platinum API unavailable', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  get totalDebt(): number {
    const a = this.aging();
    if (!a?.agingAmounts) return 0;
    const am = a.agingAmounts;
    return (am.current || 0) + (am.days30 || 0) + (am.days60 || 0) + (am.days90 || 0) + (am.days120plus || 0);
  }

  get overallRecoveryRate(): number {
    const r = this.recovery();
    if (!r?.allTime) return 0;
    const channels = r.allTime as Record<string, { sent: number; delivered: number }>;
    let sent = 0, delivered = 0;
    Object.values(channels).forEach(ch => { sent += ch.sent; delivered += ch.delivered; });
    return sent > 0 ? Math.round((delivered / sent) * 100) : 0;
  }

  get totalLegal(): number {
    return this.pipeline()?.totalLegalActions || 0;
  }

  get totalScored(): number {
    return this.risk()?.totalScored || 0;
  }

  get agingBuckets(): any {
    return this.aging()?.agingBuckets || { current: 0, days30: 0, days60: 0, days90: 0, days120plus: 0 };
  }

  get agingAmounts(): any {
    return this.aging()?.agingAmounts || { current: 0, days30: 0, days60: 0, days90: 0, days120plus: 0 };
  }

  get maxAgingAmount(): number {
    const am = this.agingAmounts;
    return Math.max(am.current, am.days30, am.days60, am.days90, am.days120plus, 1);
  }

  get agingBars(): { label: string; count: number; amount: number; color: string }[] {
    const b = this.agingBuckets;
    const am = this.agingAmounts;
    return [
      { label: 'Current', count: b.current, amount: am.current, color: '#10B981' },
      { label: '30 Days', count: b.days30, amount: am.days30, color: '#3B82F6' },
      { label: '60 Days', count: b.days60, amount: am.days60, color: '#F59E0B' },
      { label: '90 Days', count: b.days90, amount: am.days90, color: '#F97316' },
      { label: '120+ Days', count: b.days120plus, amount: am.days120plus, color: '#EF4444' },
    ];
  }

  get pipelineEntries(): { label: string; value: number; color: string }[] {
    const stages = this.pipeline()?.pipeline || {};
    return [
      { label: 'Section 129 Notices', value: stages['Section 129 Notices'] || 0, color: '#3B82F6' },
      { label: 'Handover Initiated', value: stages['Handover Initiated'] || 0, color: '#F59E0B' },
      { label: 'In Collection', value: stages['In Collection'] || 0, color: '#F97316' },
      { label: 'Recovered', value: stages['Recovered'] || 0, color: '#10B981' },
    ];
  }

  get maxPipeline(): number {
    return Math.max(...this.pipelineEntries.map(p => p.value), 1);
  }

  get attorneyList(): any[] {
    return this.attorneys()?.attorneys || [];
  }

  get riskDist(): Record<string, { count: number; avgScore: number }> {
    return this.risk()?.distribution || {};
  }

  get riskCategories(): { key: string; label: string; colorClass: string; bgClass: string }[] {
    return [
      { key: 'LOW', label: 'Low Risk', colorClass: 'success', bgClass: 'risk-low' },
      { key: 'MEDIUM', label: 'Medium Risk', colorClass: 'warning', bgClass: 'risk-medium' },
      { key: 'HIGH', label: 'High Risk', colorClass: 'danger', bgClass: 'risk-high' },
    ];
  }

  get recoveryByPeriod(): { label: string; data: any }[] {
    const r = this.recovery();
    if (!r) return [];
    return [
      { label: 'Last 30 Days', data: r.last30Days || {} },
      { label: 'Last 60 Days', data: r.last60Days || {} },
      { label: 'Last 90 Days', data: r.last90Days || {} },
    ];
  }

  get totalComms(): number {
    return this.recovery()?.totalCommunications || 0;
  }

  getPeriodRate(period: any): number {
    const channels = period.data as Record<string, { sent: number; delivered: number }>;
    let sent = 0, delivered = 0;
    Object.values(channels).forEach(ch => { sent += ch.sent; delivered += ch.delivered; });
    return sent > 0 ? Math.round((delivered / sent) * 100) : 0;
  }

  getPeriodSent(period: any): number {
    const channels = period.data as Record<string, { sent: number }>;
    return Object.values(channels).reduce((s, ch) => s + ch.sent, 0);
  }

  getPeriodDelivered(period: any): number {
    const channels = period.data as Record<string, { delivered: number }>;
    return Object.values(channels).reduce((s, ch) => s + ch.delivered, 0);
  }

  getRiskSegmentWidth(cat: string): number {
    const d = this.riskDist[cat];
    if (!d || this.totalScored === 0) return 0;
    return (d.count / this.totalScored) * 100;
  }

  getRiskCount(cat: string): number {
    return this.riskDist[cat]?.count || 0;
  }

  getRiskAvgScore(cat: string): number {
    return this.riskDist[cat]?.avgScore || 0;
  }

  agingBarWidth(amount: number): string {
    return `${(amount / this.maxAgingAmount) * 100}%`;
  }

  pipelineBarWidth(value: number): string {
    const pct = Math.max((value / this.maxPipeline) * 100, value > 0 ? 10 : 0);
    return `${pct}%`;
  }

  fmtCurrency(value: number): string {
    return formatCurrencyCompact(value);
  }

  getRateColorClass(rate: number): string {
    if (rate >= 70) return 'text-success';
    if (rate >= 40) return 'text-warning';
    return 'text-danger';
  }

  getRateBarColor(rate: number): string {
    if (rate >= 70) return '#10B981';
    if (rate >= 40) return '#F59E0B';
    return '#EF4444';
  }

  getAttRecoveryClass(rate: number): string {
    if (rate >= 50) return 'text-success';
    if (rate >= 25) return 'text-warning';
    return 'text-danger';
  }
}
