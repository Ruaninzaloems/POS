import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PROCESS_STATUS_LABELS } from '../../../services/debt-config';
import { formatDateShort, formatCurrency } from '../../../services/format.service';
import type { ProcessMonitoringOverview } from '../../../models/debt.models';

@Component({
  selector: 'app-process-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './process-monitoring.component.html',
  styleUrl: './process-monitoring.component.css'
})
export class ProcessMonitoringComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(true);
  tab = signal('overview');
  overview = signal<ProcessMonitoringOverview | null>(null);
  activeRuns = signal<any[]>([]);
  failedRuns = signal<any[]>([]);
  pendingApprovals = signal<any[]>([]);
  handoverQueues = signal<any[]>([]);
  terminationQueues = signal<any[]>([]);

  stats = computed(() => [
    { label: 'Active Runs', value: this.overview()?.activeRuns ?? this.activeRuns().length, colorClass: 'stat-blue' },
    { label: 'Failed Runs', value: this.overview()?.failedRuns ?? this.failedRuns().length, colorClass: 'stat-red' },
    { label: 'Pending Approvals', value: this.overview()?.pendingApprovals ?? this.pendingApprovals().length, colorClass: 'stat-amber' },
    { label: 'Handover Queue', value: this.overview()?.handoverQueued ?? this.handoverQueues().length, colorClass: 'stat-indigo' },
    { label: 'Termination Queue', value: this.overview()?.terminationQueued ?? this.terminationQueues().length, colorClass: 'stat-purple' },
  ]);

  overviewSections = computed(() => [
    { title: 'Active Runs', items: this.activeRuns(), tab: 'active', borderClass: 'border-left-blue' },
    { title: 'Failed Runs', items: this.failedRuns(), tab: 'failed', borderClass: 'border-left-red' },
    { title: 'Pending Approvals', items: this.pendingApprovals(), tab: 'approvals', borderClass: 'border-left-amber' },
    { title: 'Handover Queue', items: this.handoverQueues(), tab: 'handovers', borderClass: 'border-left-indigo' },
    { title: 'Termination Queue', items: this.terminationQueues(), tab: 'terminations', borderClass: 'border-left-purple' },
  ]);

  ngOnInit(): void { this.loadData(); }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const results = await Promise.allSettled([
        firstValueFrom(this.api.get<ProcessMonitoringOverview>('/api/process-monitoring/overview')),
        firstValueFrom(this.api.get<any>('/api/process-monitoring/active-runs')),
        firstValueFrom(this.api.get<any>('/api/process-monitoring/failed-runs')),
        firstValueFrom(this.api.get<any>('/api/process-monitoring/pending-approvals')),
        firstValueFrom(this.api.get<any>('/api/process-monitoring/handover-queues')),
        firstValueFrom(this.api.get<any>('/api/process-monitoring/termination-queues')),
      ]);
      const [ovR, arR, frR, paR, hqR, tqR] = results;
      if (ovR.status === 'fulfilled') this.overview.set(ovR.value);
      if (arR.status === 'fulfilled') { const ar = arR.value; this.activeRuns.set(Array.isArray(ar) ? ar : ar?.runs || []); }
      if (frR.status === 'fulfilled') { const fr = frR.value; this.failedRuns.set(Array.isArray(fr) ? fr : fr?.runs || []); }
      if (paR.status === 'fulfilled') { const pa = paR.value; this.pendingApprovals.set(Array.isArray(pa) ? pa : pa?.approvals || []); }
      if (hqR.status === 'fulfilled') { const hq = hqR.value; this.handoverQueues.set(Array.isArray(hq) ? hq : hq?.queues || []); }
      if (tqR.status === 'fulfilled') { const tq = tqR.value; this.terminationQueues.set(Array.isArray(tq) ? tq : tq?.queues || []); }
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        this.toast.error(`${failed.length} monitoring data source(s) unavailable`);
      }
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load monitoring data');
    } finally {
      this.loading.set(false);
    }
  }

  setTab(t: string): void { this.tab.set(t); }

  getStatusClass(status: string): string {
    return PROCESS_STATUS_LABELS[status]?.className || 'bg-gray-100 text-gray-700 border-gray-200';
  }

  getStatusLabel(status: string): string {
    return PROCESS_STATUS_LABELS[status]?.label || status;
  }

  getItemLabel(item: any): string {
    return item.runType || item.jobType || item.accountNo || item.description || 'Item';
  }

  fmtDateShort(d: string | null | undefined): string { return formatDateShort(d); }
  fmtCurrency(v: number | null | undefined): string { return formatCurrency(v); }

  goHome(): void { this.router.navigate(['/']); }
  goDebt(): void { this.router.navigate(['/debt/section129']); }
}
