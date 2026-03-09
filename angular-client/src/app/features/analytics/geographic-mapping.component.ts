import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { GeoItem, ViewTab, SortField, SortDir } from '../../models/analytics.models';
import { RISK_COLORS } from '../../services/debt-config';
import { formatCurrency } from '../../services/format.service';
import { sortByField } from '../../services/validation.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-geographic-mapping',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './geographic-mapping.component.html',
  styleUrl: './geographic-mapping.component.css'
})
export class GeographicMappingComponent implements OnInit {
  loading = signal(true);
  data = signal<{
    byWard: GeoItem[];
    bySuburb: GeoItem[];
    byTown: GeoItem[];
    byPropertyType: GeoItem[];
    totalAccounts: number;
  } | null>(null);

  tab = signal<ViewTab>('ward');
  sortField = signal<SortField>('totalDebt');
  sortDir = signal<SortDir>('desc');

  riskColors = RISK_COLORS;

  tabConfig: Record<ViewTab, { label: string; shortLabel: string }> = {
    ward: { label: 'By Ward', shortLabel: 'Ward' },
    suburb: { label: 'By Suburb', shortLabel: 'Suburb' },
    town: { label: 'By Town', shortLabel: 'Town' },
    propertyType: { label: 'By Property Type', shortLabel: 'Property Type' },
  };

  tabKeys: ViewTab[] = ['ward', 'suburb', 'town', 'propertyType'];

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
      const result = await firstValueFrom(this.api.get('/api/analytics/geographic-distribution'));
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

  setTab(t: ViewTab): void {
    this.tab.set(t);
  }

  handleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('desc');
    }
  }

  get currentItems(): GeoItem[] {
    const d = this.data();
    if (!d) return [];
    const map: Record<ViewTab, GeoItem[]> = {
      ward: d.byWard,
      suburb: d.bySuburb,
      town: d.byTown,
      propertyType: d.byPropertyType,
    };
    return sortByField(map[this.tab()] || [], this.sortField() as any, this.sortDir());
  }

  get totalDebtAll(): number {
    return this.currentItems.reduce((s, i) => s + i.totalDebt, 0);
  }

  get totalAccountsAll(): number {
    return this.currentItems.reduce((s, i) => s + i.accountCount, 0);
  }

  get highRiskCount(): number {
    return this.currentItems.filter(i => i.dominantRisk === 'HIGH').length;
  }

  get heatItems(): GeoItem[] {
    return this.currentItems.slice(0, 10);
  }

  fmtCurrency(value: number): string {
    return formatCurrency(value);
  }

  getHeatPct(item: GeoItem): number {
    return this.totalDebtAll > 0 ? (item.totalDebt / this.totalDebtAll) * 100 : 0;
  }

  getHeatBarColor(item: GeoItem): string {
    if (item.dominantRisk === 'HIGH') return '#EF4444';
    if (item.dominantRisk === 'MEDIUM') return '#F59E0B';
    return '#10B981';
  }

  getRiskBadgeClass(risk: string): string {
    if (risk === 'HIGH') return 'badge-danger';
    if (risk === 'MEDIUM') return 'badge-warning';
    if (risk === 'LOW') return 'badge-success';
    return 'badge-default';
  }

  getRiskCountBadgeClass(risk: string): string {
    const c = this.riskColors[risk] || this.riskColors['UNKNOWN'];
    return `risk-count-badge`;
  }

  getHeatBarWidth(score: number): string {
    const clamp = Math.min(100, Math.max(0, score));
    return `${clamp}%`;
  }

  getHeatBarColorForScore(score: number): string {
    if (score >= 60) return '#EF4444';
    if (score >= 30) return '#F59E0B';
    return '#10B981';
  }

  getSortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  getRiskCountKeys(item: GeoItem): string[] {
    return Object.keys(item.riskCounts || {});
  }
}
