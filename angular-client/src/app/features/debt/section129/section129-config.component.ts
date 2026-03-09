import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { getFinancialYear } from '../../../services/format.service';
import { SECTION129_DEFAULTS } from '../../../services/debt-config';
import type { Section129ConfigEntry, Attorney, CostItem, AttorneyRotationItem, ConfigViewMode } from '../../../models/debt.models';

@Component({
  selector: 'app-section129-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './section129-config.component.html',
  styleUrl: './section129-config.component.css'
})
export class Section129ConfigComponent implements OnInit {
  viewMode: ConfigViewMode = 'landing';
  isNewEntry = false;
  currentFY = getFinancialYear();

  finYear = this.currentFY;
  configEntries: Section129ConfigEntry[] = [];
  loading = signal(false);
  searched = false;

  enabled = true;
  selectedFinYear = this.currentFY;
  section129Template: string = SECTION129_DEFAULTS.section129Template;
  smsTemplate: string = SECTION129_DEFAULTS.smsTemplate;
  lapseDays: number = SECTION129_DEFAULTS.lapseDays;
  noticesPerFile: number = SECTION129_DEFAULTS.noticesPerFile;
  costItems: CostItem[] = [];
  activateRotation: boolean = SECTION129_DEFAULTS.activateRotation;
  attorneyRotation: AttorneyRotationItem[] = [];

  addBillTypeId = '';
  addBillAmount = '';
  addAttorneyId = '';
  addPercentDebtor = '';
  addPercentHandover = '';

  templates: { id: string; name: string }[] = [];
  smsTemplates: { id: string; name: string }[] = [];
  additionalBillingTypes: { id: string; name: string }[] = [];
  attorneys: Attorney[] = [];
  saving = signal(false);

  selectedEntry: Section129ConfigEntry | null = null;

  finYears: string[] = [];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {
    const now = new Date();
    const cy = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    this.finYears = [];
    for (let y = cy - 5; y <= cy + 1; y++) {
      this.finYears.push(`${y - 1}/${y}`);
    }
  }

  ngOnInit(): void {
    this.loadDropdowns();
  }

  async loadDropdowns(): Promise<void> {
    try {
      const results = await Promise.allSettled([
        firstValueFrom(this.api.get('/api/section129/templates')),
        firstValueFrom(this.api.get('/api/section129/sms-templates')),
        firstValueFrom(this.api.get('/api/additional-billing-types')),
        firstValueFrom(this.api.get('/api/attorneys')),
      ]);
      if (results[0].status === 'fulfilled') this.templates = Array.isArray(results[0].value) ? results[0].value : [];
      if (results[1].status === 'fulfilled') this.smsTemplates = Array.isArray(results[1].value) ? results[1].value : [];
      if (results[2].status === 'fulfilled') this.additionalBillingTypes = Array.isArray(results[2].value) ? results[2].value : [];
      if (results[3].status === 'fulfilled') this.attorneys = Array.isArray(results[3].value) ? results[3].value : [];
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        this.toast.show(`${failed.length} dropdown source(s) unavailable from Platinum API.`, 'error');
      }
    } catch (e: any) {
      this.toast.show(e?.message || 'Failed to load configuration data from Platinum API.', 'error');
    }
  }

  async handleSearch(): Promise<void> {
    this.loading.set(true);
    this.searched = true;
    try {
      const data = await firstValueFrom(this.api.get('/api/section129/config-list', { finYear: this.finYear }));
      this.configEntries = Array.isArray(data) ? data : [];
    } catch (e: any) {
      this.toast.show(e?.error?.message || e?.message || 'Failed to load config entries', 'error');
      this.configEntries = [];
    } finally {
      this.loading.set(false);
    }
  }

  handleClear(): void {
    this.finYear = this.currentFY;
    this.configEntries = [];
    this.searched = false;
  }

  openAddNew(): void {
    this.isNewEntry = true;
    this.selectedEntry = null;
    this.enabled = true;
    this.selectedFinYear = this.currentFY;
    this.section129Template = SECTION129_DEFAULTS.section129Template;
    this.smsTemplate = SECTION129_DEFAULTS.smsTemplate;
    this.lapseDays = SECTION129_DEFAULTS.lapseDays;
    this.noticesPerFile = SECTION129_DEFAULTS.noticesPerFile;
    this.costItems = [];
    this.activateRotation = SECTION129_DEFAULTS.activateRotation;
    this.attorneyRotation = [];
    this.addBillTypeId = '';
    this.addBillAmount = '';
    this.addAttorneyId = '';
    this.addPercentDebtor = '';
    this.addPercentHandover = '';
    this.viewMode = 'detail';
  }

  openEntryDetail(entry: Section129ConfigEntry): void {
    this.isNewEntry = false;
    this.selectedEntry = entry;
    this.enabled = entry.enabled;
    this.selectedFinYear = entry.finYear;
    this.section129Template = entry.section129Template || SECTION129_DEFAULTS.section129Template;
    this.smsTemplate = entry.smsTemplate || SECTION129_DEFAULTS.smsTemplate;
    this.lapseDays = entry.lapseDays ?? SECTION129_DEFAULTS.lapseDays;
    this.noticesPerFile = entry.noticesPerFile ?? SECTION129_DEFAULTS.noticesPerFile;
    this.costItems = entry.costItems || [];
    this.activateRotation = entry.activateRotation ?? false;
    this.attorneyRotation = entry.attorneyRotation || [];
    this.viewMode = 'detail';
  }

  handleAddCostItem(): void {
    if (!this.addBillTypeId && !this.addBillAmount) return;
    if ((!this.addBillTypeId && this.addBillAmount) || (this.addBillTypeId && !this.addBillAmount)) {
      this.toast.show('Both or none of the cost parameters must be supplied.', 'error');
      return;
    }
    const amt = parseFloat(this.addBillAmount);
    if (isNaN(amt) || amt < 0) {
      this.toast.show('Amount cannot be less than zero.', 'error');
      return;
    }
    if (this.costItems.some(c => c.additionalBillingTypeId === this.addBillTypeId)) {
      const typeName = this.additionalBillingTypes.find(t => t.id === this.addBillTypeId)?.name || this.addBillTypeId;
      this.toast.show(`Duplicate for additional-billing-type "${typeName}" not allowed.`, 'error');
      return;
    }
    const typeName = this.additionalBillingTypes.find(t => t.id === this.addBillTypeId)?.name || this.addBillTypeId;
    this.costItems = [...this.costItems, { nr: this.costItems.length + 1, additionalBillingTypeId: this.addBillTypeId, additionalBillingTypeName: typeName, amount: amt }];
    this.addBillTypeId = '';
    this.addBillAmount = '';
  }

  removeCostItem(idx: number): void {
    this.costItems = this.costItems.filter((_, i) => i !== idx).map((item, i) => ({ ...item, nr: i + 1 }));
  }

  handleAddAttorney(): void {
    if (!this.addAttorneyId) return;
    const pctDebtor = parseInt(this.addPercentDebtor || '0', 10);
    const pctHandover = parseInt(this.addPercentHandover || '0', 10);
    if (pctDebtor > 0 && pctHandover > 0) {
      this.toast.show('Either/OR one of the percentage parameters must be supplied.', 'error');
      return;
    }
    if (pctDebtor === 0 && pctHandover === 0) {
      this.toast.show('Please supply a value for at least one percentage allocation.', 'error');
      return;
    }
    if (pctDebtor < 0 || pctDebtor > 100 || pctHandover < 0 || pctHandover > 100) {
      this.toast.show('Percentage must be between 0 and 100.', 'error');
      return;
    }
    const attyId = parseInt(this.addAttorneyId, 10);
    if (this.attorneyRotation.some(a => a.attorneyId === attyId)) {
      const name = this.attorneys.find(a => a.attorneyId === attyId)?.attorneyName || this.addAttorneyId;
      this.toast.show(`Duplicate for attorney "${name}" not allowed.`, 'error');
      return;
    }
    const name = this.attorneys.find(a => a.attorneyId === attyId)?.attorneyName || `Attorney ${attyId}`;
    this.attorneyRotation = [...this.attorneyRotation, { nr: this.attorneyRotation.length + 1, attorneyId: attyId, attorneyName: name, percentDebtorCount: pctDebtor, percentHandoverAmount: pctHandover }];
    this.addAttorneyId = '';
    this.addPercentDebtor = '';
    this.addPercentHandover = '';
  }

  removeAttorney(idx: number): void {
    this.attorneyRotation = this.attorneyRotation.filter((_, i) => i !== idx).map((item, i) => ({ ...item, nr: i + 1 }));
  }

  get activeAttorneys(): Attorney[] {
    return this.attorneys.filter(a => a.isActive);
  }

  get totalDebtorPercent(): number {
    return this.attorneyRotation.reduce((s, a) => s + a.percentDebtorCount, 0);
  }

  get totalHandoverPercent(): number {
    return this.attorneyRotation.reduce((s, a) => s + a.percentHandoverAmount, 0);
  }

  get totalFees(): number {
    return this.costItems.reduce((s, c) => s + c.amount, 0);
  }

  validate(): string | null {
    if (!this.selectedFinYear) return 'Please supply a value for Financial Year.';
    if (!this.section129Template) return 'Please supply a value for Section 129 Template.';
    if (!this.smsTemplate) return 'Please supply a value for SMS Notification Template.';
    if (this.lapseDays < 14 || this.lapseDays > 99) return 'The Section 129 – Letter of Demand lapse days must be > 0 and < 100.';
    if (this.noticesPerFile < 1) return 'The No-of-notices-per-file cannot be less than 1.';
    if (this.enabled && this.isNewEntry) {
      const existingEnabled = this.configEntries.find(
        (entry) => entry.finYear === this.selectedFinYear && entry.enabled && entry.id !== this.selectedEntry?.id
      );
      if (existingEnabled) {
        return 'An enabled configuration already exists for this financial year. Please disable it first.';
      }
    }
    if (this.activateRotation && this.attorneyRotation.length > 0) {
      const usingDebtor = this.attorneyRotation.some(a => a.percentDebtorCount > 0);
      const usingHandover = this.attorneyRotation.some(a => a.percentHandoverAmount > 0);
      if (usingDebtor && usingHandover) return 'Either/OR one of the percentage parameters must be supplied — cannot mix.';
      if (usingDebtor && this.totalDebtorPercent !== 100) return 'Percentage Allocation in Debtor Count must sum to 100%.';
      if (usingHandover && this.totalHandoverPercent !== 100) return 'Percentage Allocation in Handover Amount must sum to 100%.';
      if (!usingDebtor && !usingHandover) return 'Please supply percentage allocation for the attorney rotation.';
    }
    return null;
  }

  async handleSubmit(): Promise<void> {
    const err = this.validate();
    if (err) {
      this.toast.show(err, 'error');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post('/api/section129/config', {
        id: this.selectedEntry?.id,
        enabled: this.enabled,
        finYear: this.selectedFinYear,
        section129Template: this.section129Template,
        smsTemplate: this.smsTemplate,
        lapseDays: this.lapseDays,
        noticesPerFile: this.noticesPerFile,
        costItems: this.costItems,
        activateRotation: this.activateRotation,
        attorneyRotation: this.attorneyRotation,
      }));
      this.toast.show('Section 129 configuration saved successfully.', 'success');
      this.viewMode = 'landing';
      this.handleSearch();
    } catch (e: any) {
      this.toast.show(e?.error?.message || e?.message || 'Failed to save configuration', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  handleCancel(): void {
    this.viewMode = 'landing';
  }
}
