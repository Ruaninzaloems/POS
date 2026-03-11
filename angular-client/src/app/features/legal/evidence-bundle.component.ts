import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { EvidenceBundle } from '../../models/legal.models';
import { EVIDENCE_BUNDLE_SECTIONS } from '../../services/debt-config';
import { formatDate } from '../../services/format.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-evidence-bundle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './evidence-bundle.component.html',
  styleUrl: './evidence-bundle.component.css'
})
export class EvidenceBundleComponent implements OnInit {
  accountNo = signal('');
  generating = signal(false);
  bundles = signal<EvidenceBundle[]>([]);
  loading = signal(true);
  expandedId = signal<number | null>(null);
  expandedBundle = signal<EvidenceBundle | null>(null);
  loadingDetail = signal(false);

  gridPage = signal(1);
  gridPageSize = 10;

  bundleSections = EVIDENCE_BUNDLE_SECTIONS;

  paginatedBundles = computed(() => {
    const all = this.bundles();
    const start = (this.gridPage() - 1) * this.gridPageSize;
    return all.slice(start, start + this.gridPageSize);
  });

  totalGridPages = computed(() => Math.ceil(this.bundles().length / this.gridPageSize));

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBundles();
  }

  async loadBundles(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any>('/api/legal/evidence-bundles'));
      this.bundles.set(Array.isArray(data) ? data : []);
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to load evidence bundles.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  async handleGenerate(): Promise<void> {
    if (!this.accountNo().trim()) {
      this.toast.show('Please enter an account number.', 'error');
      return;
    }
    this.generating.set(true);
    try {
      await firstValueFrom(this.api.post('/api/legal/evidence-bundle', { accountNo: this.accountNo().trim() }));
      this.toast.show(`Evidence bundle generated for account ${this.accountNo()}.`, 'success');
      this.accountNo.set('');
      await this.loadBundles();
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to generate evidence bundle.', 'error');
    } finally {
      this.generating.set(false);
    }
  }

  async handleExpand(bundle: EvidenceBundle): Promise<void> {
    if (this.expandedId() === bundle.id) {
      this.expandedId.set(null);
      this.expandedBundle.set(null);
      return;
    }
    this.expandedId.set(bundle.id);
    this.loadingDetail.set(true);
    try {
      const detail = await firstValueFrom(this.api.get<EvidenceBundle>(`/api/legal/evidence-bundle/${bundle.id}`));
      this.expandedBundle.set(detail);
    } catch {
      this.expandedBundle.set(bundle);
    } finally {
      this.loadingDetail.set(false);
    }
  }

  formatDateStr(d: string | null | undefined): string {
    return formatDate(d);
  }

  sectionHasData(bundleData: Record<string, any>, key: string): boolean {
    const data = bundleData?.[key];
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    if (typeof data === 'object') return Object.keys(data).length > 0;
    return !!data;
  }

  getSectionCount(bundleData: Record<string, any>, key: string): number {
    const data = bundleData?.[key];
    if (Array.isArray(data)) return data.length;
    if (this.sectionHasData(bundleData, key)) return 1;
    return 0;
  }

  getSectionItems(bundleData: Record<string, any>, key: string): any[] {
    const data = bundleData?.[key];
    if (Array.isArray(data)) return data.slice(0, 5);
    return [];
  }

  getSectionRemainingCount(bundleData: Record<string, any>, key: string): number {
    const data = bundleData?.[key];
    if (Array.isArray(data) && data.length > 5) return data.length - 5;
    return 0;
  }

  formatItem(item: any): string {
    if (typeof item === 'string') return item;
    return JSON.stringify(item).slice(0, 80);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.handleGenerate();
  }

  prevPage(): void {
    this.gridPage.update(p => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.gridPage.update(p => Math.min(this.totalGridPages(), p + 1));
  }
}
