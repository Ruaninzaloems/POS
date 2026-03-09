import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatFileSize, getFinancialYearList } from '../../../services/format.service';
import { getStatusColor } from '../../../services/validation.service';
import type { Section129Config, Section129Run, Section129RunFile } from '../../../models/debt.models';
import type { RunType, HandoverOption, DistributionType } from '../../../models/debt.models';

@Component({
  selector: 'app-section129-notices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './section129-notices.component.html',
  styleUrl: './section129-notices.component.css'
})
export class Section129NoticesComponent implements OnInit {
  config = signal<Section129Config | null>(null);
  configLoading = signal(true);
  runs = signal<Section129Run[]>([]);
  runsLoading = signal(true);
  submitting = signal(false);

  finYear: string;
  finMonth: string;
  runType: RunType = 'trial-review';
  handoverOption: HandoverOption = 'account';

  billingCycles: { id: string; name: string }[] = [];
  towns: { id: string; name: string }[] = [];
  propertyCategories: { id: string; name: string }[] = [];
  accountTypes: { id: string; name: string }[] = [];
  personTypes: { id: string; name: string }[] = [];
  ageingRanges: { id: string; name: string }[] = [];

  billingCycle = '';
  town = '';
  suburb = '';
  propertyCategory = '';
  accountType = '';
  typeOfPerson = '';
  serviceGroupCode = '';
  ageing = '';
  amountGreaterThan = '';
  includeIndigents = false;
  includePensioners = false;
  excludeDepositBalances = false;

  contactPerson = '';
  contactPhone = '';
  contactEmail = '';

  distributionType: DistributionType = 'email';
  mustEmailBePrinted = false;

  gridPage = 1;
  gridPageSize = 10;

  fileModalOpen = false;
  fileModalRunId: number | null = null;
  runFiles: Section129RunFile[] = [];
  filesLoading = false;
  downloadingFileId: number | null = null;
  finalRunningId: number | null = null;
  deleteConfirmRunId: number | null = null;
  isDeleting = false;

  finYears: string[] = [];
  months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  NON_DELETABLE_STATUSES = ['Approved', 'Authorized', 'Final Running', 'Final Complete'];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    this.finYear = `${year - 1}/${year}`;
    this.finMonth = String(now.getMonth() + 1);
    this.finYears = getFinancialYearList(5);
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    const results = await Promise.allSettled([
      firstValueFrom(this.api.get('/api/section129/config')),
      firstValueFrom(this.api.get('/api/section129/runs')),
      firstValueFrom(this.api.get('/api/billing-cycles')),
      firstValueFrom(this.api.get('/api/towns')),
      firstValueFrom(this.api.get('/api/property-categories')),
      firstValueFrom(this.api.get('/api/account-types')),
      firstValueFrom(this.api.get('/api/person-types')),
      firstValueFrom(this.api.get('/api/ageing-ranges')),
    ]);

    if (results[0].status === 'fulfilled') this.config.set(results[0].value);
    this.configLoading.set(false);

    if (results[1].status === 'fulfilled') this.runs.set(results[1].value || []);
    this.runsLoading.set(false);

    if (results[2].status === 'fulfilled') this.billingCycles = results[2].value || [];
    if (results[3].status === 'fulfilled') this.towns = results[3].value || [];
    if (results[4].status === 'fulfilled') this.propertyCategories = results[4].value || [];
    if (results[5].status === 'fulfilled') this.accountTypes = results[5].value || [];
    if (results[6].status === 'fulfilled') this.personTypes = results[6].value || [];
    if (results[7].status === 'fulfilled') this.ageingRanges = results[7].value || [];
  }

  get paginatedRuns(): Section129Run[] {
    const all = this.runs();
    return all.slice((this.gridPage - 1) * this.gridPageSize, this.gridPage * this.gridPageSize);
  }

  get totalGridPages(): number {
    return Math.ceil(this.runs().length / this.gridPageSize);
  }

  getStatusColor(status: string): string {
    return getStatusColor(status);
  }

  formatFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  canDeleteRun(run: Section129Run): boolean {
    return !this.NON_DELETABLE_STATUSES.includes(run.status);
  }

  async handleSubmit(): Promise<void> {
    if (!this.billingCycle) {
      this.toast.show('Please select a billing cycle.', 'error');
      return;
    }
    this.submitting.set(true);
    try {
      const params: any = {
        finYear: this.finYear,
        finMonth: this.finMonth,
        runType: this.runType,
        billingCycle: this.billingCycle,
        town: this.town && this.town !== '__all__' ? this.town : undefined,
        suburb: this.suburb && this.suburb !== '__all__' ? this.suburb : undefined,
        propertyCategory: this.propertyCategory && this.propertyCategory !== '__all__' ? this.propertyCategory : undefined,
        accountType: this.accountType && this.accountType !== '__all__' ? this.accountType : undefined,
        typeOfPerson: this.typeOfPerson && this.typeOfPerson !== '__all__' ? this.typeOfPerson : undefined,
        serviceGroupCode: this.serviceGroupCode && this.serviceGroupCode !== '__all__' ? this.serviceGroupCode : undefined,
        ageing: this.ageing && this.ageing !== '__all__' ? this.ageing : undefined,
        amountGreaterThan: this.amountGreaterThan ? parseFloat(this.amountGreaterThan) : undefined,
        includeIndigents: this.includeIndigents,
        includePensioners: this.includePensioners,
        excludeDepositBalances: this.excludeDepositBalances,
        contactPerson: this.contactPerson || undefined,
        phone: this.contactPhone || undefined,
        email: this.contactEmail || undefined,
        distributionType: this.distributionType,
        mustEmailBePrinted: this.distributionType === 'email' ? this.mustEmailBePrinted : undefined,
        handoverOption: this.handoverOption,
      };
      await firstValueFrom(this.api.post('/api/section129/trial-run', params));
      this.toast.show(`Section 129 ${this.runType} run has been submitted successfully.`, 'success');
      await this.loadData();
    } catch (err: any) {
      this.toast.show(err?.error?.message || err?.message || 'Failed to submit Section 129 run.', 'error');
    } finally {
      this.submitting.set(false);
    }
  }

  handleClear(): void {
    this.billingCycle = '';
    this.town = '';
    this.suburb = '';
    this.propertyCategory = '';
    this.accountType = '';
    this.typeOfPerson = '';
    this.serviceGroupCode = '';
    this.ageing = '';
    this.amountGreaterThan = '';
    this.includeIndigents = false;
    this.includePensioners = false;
    this.excludeDepositBalances = false;
    this.contactPerson = '';
    this.contactPhone = '';
    this.contactEmail = '';
    this.distributionType = 'email';
    this.mustEmailBePrinted = false;
  }

  async openFileModal(runId: number): Promise<void> {
    this.fileModalRunId = runId;
    this.fileModalOpen = true;
    this.filesLoading = true;
    this.runFiles = [];
    try {
      const files = await firstValueFrom(this.api.get(`/api/section129/runs/${runId}/files`));
      this.runFiles = files || [];
    } catch (err: any) {
      this.toast.show(err?.error?.message || 'Failed to load run files.', 'error');
    } finally {
      this.filesLoading = false;
    }
  }

  closeFileModal(): void {
    this.fileModalOpen = false;
    this.fileModalRunId = null;
    this.runFiles = [];
  }

  async handleDownloadFile(fileId: number): Promise<void> {
    this.downloadingFileId = fileId;
    try {
      await firstValueFrom(this.api.get(`/api/section129/files/${fileId}/download`));
      this.toast.show('File download has started.', 'success');
    } catch (err: any) {
      this.toast.show(err?.error?.message || 'Failed to download file.', 'error');
    } finally {
      this.downloadingFileId = null;
    }
  }

  async handleFinalRun(runId: number): Promise<void> {
    this.finalRunningId = runId;
    try {
      await firstValueFrom(this.api.post('/api/section129/final-run', { runId }));
      this.toast.show(`Section 129 final run for run #${runId} has been submitted successfully.`, 'success');
      await this.loadData();
    } catch (err: any) {
      this.toast.show(err?.error?.message || 'Failed to submit final run.', 'error');
    } finally {
      this.finalRunningId = null;
    }
  }

  confirmDelete(runId: number): void {
    this.deleteConfirmRunId = runId;
  }

  cancelDelete(): void {
    this.deleteConfirmRunId = null;
  }

  async handleDeleteRun(): Promise<void> {
    if (!this.deleteConfirmRunId) return;
    this.isDeleting = true;
    try {
      await firstValueFrom(this.api.delete(`/api/section129/runs/${this.deleteConfirmRunId}`));
      this.toast.show(`Section 129 run #${this.deleteConfirmRunId} has been removed.`, 'success');
      this.deleteConfirmRunId = null;
      await this.loadData();
    } catch (err: any) {
      this.toast.show(err?.error?.message || 'Failed to delete run.', 'error');
    } finally {
      this.isDeleting = false;
    }
  }

  handleRowClick(run: Section129Run): void {
    if (run.status === 'Trial Run Review' || run.status === 'Trial Review') {
      this.router.navigate(['/debt/section129/review', run.runId]);
    }
  }

  prevPage(): void {
    if (this.gridPage > 1) this.gridPage--;
  }

  nextPage(): void {
    if (this.gridPage < this.totalGridPages) this.gridPage++;
  }
}
