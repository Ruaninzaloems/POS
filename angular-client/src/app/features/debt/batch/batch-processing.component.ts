import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { BATCH_JOB_TYPE_LABELS, BATCH_STATUS_LABELS } from '../../../services/debt-config';
import { formatDateShort, formatDuration } from '../../../services/format.service';

@Component({
  selector: 'app-batch-processing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './batch-processing.component.html',
  styleUrl: './batch-processing.component.css'
})
export class BatchProcessingComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(true);
  triggeringType = signal<string | null>(null);
  cancellingId = signal<string | null>(null);
  jobs = signal<any[]>([]);
  schedules = signal<any[]>([]);
  filterType = signal('ALL');
  filterStatus = signal('ALL');

  JOB_TYPE_LABELS = BATCH_JOB_TYPE_LABELS;
  STATUS_LABELS = BATCH_STATUS_LABELS;
  jobTypeEntries = Object.entries(BATCH_JOB_TYPE_LABELS);
  statusEntries = Object.entries(BATCH_STATUS_LABELS);

  filteredJobs = computed(() => {
    return this.jobs().filter(j => {
      if (this.filterType() !== 'ALL' && j.jobType !== this.filterType()) return false;
      if (this.filterStatus() !== 'ALL' && j.status !== this.filterStatus()) return false;
      return true;
    });
  });

  activeCount = computed(() => this.jobs().filter(j => j.status === 'RUNNING').length);
  pendingCount = computed(() => this.jobs().filter(j => j.status === 'PENDING' || j.status === 'SCHEDULED').length);
  failedCount = computed(() => this.jobs().filter(j => j.status === 'FAILED').length);
  completedCount = computed(() => this.jobs().filter(j => j.status === 'COMPLETED').length);

  ngOnInit(): void { this.loadData(); }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [jobsData, schedulesData] = await Promise.all([
        firstValueFrom(this.api.get<any>('/api/batch-processing/jobs')),
        firstValueFrom(this.api.get<any>('/api/batch-processing/schedules')),
      ]);
      this.jobs.set(Array.isArray(jobsData) ? jobsData : jobsData?.jobs || []);
      this.schedules.set(Array.isArray(schedulesData) ? schedulesData : schedulesData?.schedules || []);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load batch data');
    } finally {
      this.loading.set(false);
    }
  }

  async handleTrigger(jobType: string): Promise<void> {
    this.triggeringType.set(jobType);
    try {
      await firstValueFrom(this.api.post<any>('/api/batch-processing/trigger', { jobType }));
      this.toast.success(`${BATCH_JOB_TYPE_LABELS[jobType]?.label || jobType} has been queued.`);
      await this.loadData();
    } catch (e: any) {
      this.toast.error(e?.message || 'Error triggering job');
    } finally {
      this.triggeringType.set(null);
    }
  }

  async handleCancel(jobId: string): Promise<void> {
    this.cancellingId.set(jobId);
    try {
      await firstValueFrom(this.api.post<any>('/api/batch-processing/cancel', { jobId }));
      this.toast.success('Batch job has been cancelled.');
      await this.loadData();
    } catch (e: any) {
      this.toast.error(e?.message || 'Error cancelling job');
    } finally {
      this.cancellingId.set(null);
    }
  }

  getStatusClass(status: string): string {
    return BATCH_STATUS_LABELS[status]?.className || BATCH_STATUS_LABELS['PENDING'].className;
  }

  getStatusLabel(status: string): string {
    return BATCH_STATUS_LABELS[status]?.label || status;
  }

  getJobTypeClass(type: string): string {
    return BATCH_JOB_TYPE_LABELS[type]?.color || 'text-gray-600 bg-gray-50 border-gray-200';
  }

  getJobTypeLabel(type: string): string {
    return BATCH_JOB_TYPE_LABELS[type]?.label || type;
  }

  fmtDateShort(d: string | null | undefined): string {
    return formatDateShort(d);
  }

  fmtDuration(start: string | null | undefined, end: string | null | undefined): string {
    return formatDuration(start, end);
  }

  goHome(): void { this.router.navigate(['/']); }
  goDebt(): void { this.router.navigate(['/debt/section129']); }
}
