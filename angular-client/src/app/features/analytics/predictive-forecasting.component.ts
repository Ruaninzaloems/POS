import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { getConfidenceLabel } from '../../services/validation.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-predictive-forecasting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './predictive-forecasting.component.html',
  styleUrl: './predictive-forecasting.component.css'
})
export class PredictiveForecastingComponent implements OnInit {
  loading = signal(true);
  data = signal<any>(null);

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.api.get('/api/analytics/predictive-forecasting'));
      this.data.set(result);
    } catch (e: any) {
      this.toast.show(e?.error?.message || e?.message || 'Unknown error', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  get forecast(): any {
    return this.data()?.forecast;
  }

  get riskBreakdown(): any {
    return this.data()?.riskBreakdown;
  }

  get deliveryTrend(): any[] {
    return this.data()?.deliveryTrend || [];
  }

  get channelEffectiveness(): Record<string, any> {
    return this.data()?.channelEffectiveness || {};
  }

  get channelKeys(): string[] {
    return Object.keys(this.channelEffectiveness);
  }

  get keyDrivers(): any[] {
    return this.data()?.keyDrivers || [];
  }

  get maxTrendRate(): number {
    return Math.max(...this.deliveryTrend.map(d => d.rate), 1);
  }

  get predictedRate(): number {
    return this.data()?.predictedRecoveryRate || 0;
  }

  get confidenceScore(): number {
    return this.data()?.confidenceScore || 0;
  }

  get forecast30(): number {
    return this.forecast?.next30Days?.estimatedRate || 0;
  }

  get forecast60(): number {
    return this.forecast?.next60Days?.estimatedRate || 0;
  }

  get forecast90(): number {
    return this.forecast?.next90Days?.estimatedRate || 0;
  }

  getConfidenceLabel(score: number): string {
    return getConfidenceLabel(score);
  }

  getConfidenceColor(score: number): string {
    if (score >= 70) return '#059669';
    if (score >= 40) return '#D97706';
    return '#DC2626';
  }

  getConfidenceDash(score: number): string {
    return `${(score / 100) * 327} 327`;
  }

  getTrendBarWidth(rate: number): string {
    const pct = this.maxTrendRate > 0 ? (rate / this.maxTrendRate) * 100 : 0;
    return `${Math.max(pct, 2)}%`;
  }

  getBarColor(rate: number): string {
    if (rate >= 70) return '#10B981';
    if (rate >= 40) return '#F59E0B';
    return '#EF4444';
  }

  getTextColorClass(rate: number): string {
    if (rate >= 70) return 'text-success';
    if (rate >= 40) return 'text-warning';
    return 'text-danger';
  }

  getChannelStats(channel: string): any {
    return this.channelEffectiveness[channel] || { rate: 0, sent: 0, delivered: 0 };
  }

  getDriverIconClass(impact: string): string {
    if (impact === 'HIGH' || impact === 'POSITIVE') return 'icon-success';
    if (impact === 'LOW' || impact === 'NEGATIVE') return 'icon-danger';
    return 'icon-muted';
  }

  getImpactBadgeClass(impact: string): string {
    if (impact === 'HIGH' || impact === 'NEGATIVE') return 'badge-danger';
    if (impact === 'POSITIVE' || impact === 'LOW') return 'badge-success';
    return 'badge-default';
  }

  get riskTiers(): { key: string; label: string; bgClass: string; textClass: string }[] {
    if (!this.riskBreakdown) return [];
    return [
      { key: 'low', label: 'Low Risk', bgClass: 'tier-low', textClass: 'text-success' },
      { key: 'medium', label: 'Medium Risk', bgClass: 'tier-medium', textClass: 'text-warning' },
      { key: 'high', label: 'High Risk', bgClass: 'tier-high', textClass: 'text-danger' },
    ];
  }

  getRiskTierData(key: string): any {
    return this.riskBreakdown?.[key] || { count: 0, avgScore: 0, expectedRecovery: 0 };
  }

  get forecastPeriods(): { label: string; rate: number; colorClass: string; barColor: string }[] {
    return [
      { label: '30 Days', rate: this.forecast30, colorClass: 'text-success', barColor: '#10B981' },
      { label: '60 Days', rate: this.forecast60, colorClass: 'text-cyan', barColor: '#06B6D4' },
      { label: '90 Days', rate: this.forecast90, colorClass: 'text-violet', barColor: '#8B5CF6' },
    ];
  }
}
