import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { RULE_FIELDS, RULE_OPERATORS, WORKFLOW_ACTION_TYPES, CHANNEL_OPTIONS } from '../../../services/debt-config';
import { formatDate } from '../../../services/format.service';
import type { ProcessWorkflow, WorkflowStage, StageRule, StageTemplate, StageAction, StageTimer } from '../../../models/debt.models';

@Component({
  selector: 'app-process-engine',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './process-engine.component.html',
  styleUrl: './process-engine.component.css'
})
export class ProcessEngineComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(true);
  workflows = signal<ProcessWorkflow[]>([]);
  viewMode = signal<'list' | 'detail'>('list');
  selectedWorkflow = signal<ProcessWorkflow | null>(null);
  stages = signal<WorkflowStage[]>([]);
  loadingStages = signal(false);
  expandedStage = signal<number | string | null>(null);

  showWorkflowDialog = signal(false);
  showStageDialog = signal(false);
  editingWorkflow = signal<ProcessWorkflow | null>(null);
  editingStage = signal<WorkflowStage | null>(null);
  saving = signal(false);

  wfName = signal('');
  wfDescription = signal('');
  wfActive = signal(true);

  stName = signal('');
  stDescription = signal('');
  stActive = signal(true);
  stRules = signal<StageRule[]>([]);
  stTemplates = signal<StageTemplate[]>([]);
  stActions = signal<StageAction[]>([]);
  stTimer = signal<StageTimer>({ waitDays: 14, businessDaysOnly: true, escalateOnExpiry: false });
  stageTab = signal('rules');

  RULE_FIELDS = RULE_FIELDS;
  RULE_OPERATORS = RULE_OPERATORS;
  ACTION_TYPES = WORKFLOW_ACTION_TYPES;
  CHANNEL_OPTIONS = CHANNEL_OPTIONS;

  ngOnInit(): void { this.loadWorkflows(); }

  async loadWorkflows(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any>('/api/process-engine/workflows'));
      this.workflows.set(Array.isArray(data) ? data : data?.workflows || []);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load workflows');
    } finally {
      this.loading.set(false);
    }
  }

  async loadStages(wfId: string | number): Promise<void> {
    this.loadingStages.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any>(`/api/process-engine/workflows/${wfId}/stages`));
      const stageList: WorkflowStage[] = Array.isArray(data) ? data : data?.stages || [];
      stageList.sort((a, b) => a.stageNumber - b.stageNumber);
      this.stages.set(stageList);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load stages');
    } finally {
      this.loadingStages.set(false);
    }
  }

  async openWorkflowDetail(wf: ProcessWorkflow): Promise<void> {
    this.selectedWorkflow.set(wf);
    this.viewMode.set('detail');
    this.expandedStage.set(null);
    await this.loadStages(wf.id);
  }

  backToList(): void {
    this.viewMode.set('list');
    this.selectedWorkflow.set(null);
  }

  openCreateWorkflow(): void {
    this.editingWorkflow.set(null);
    this.wfName.set('');
    this.wfDescription.set('');
    this.wfActive.set(true);
    this.showWorkflowDialog.set(true);
  }

  openEditWorkflow(wf: ProcessWorkflow, event?: Event): void {
    event?.stopPropagation();
    this.editingWorkflow.set(wf);
    this.wfName.set(wf.name);
    this.wfDescription.set(wf.description || '');
    this.wfActive.set(wf.isActive);
    this.showWorkflowDialog.set(true);
  }

  async handleSaveWorkflow(): Promise<void> {
    if (!this.wfName().trim()) {
      this.toast.error('Workflow name is required');
      return;
    }
    this.saving.set(true);
    try {
      const payload = { name: this.wfName(), description: this.wfDescription(), isActive: this.wfActive() };
      if (this.editingWorkflow()) {
        await firstValueFrom(this.api.put<any>(`/api/process-engine/workflows/${this.editingWorkflow()!.id}`, payload));
        this.toast.success(`${this.wfName()} has been updated.`);
      } else {
        await firstValueFrom(this.api.post<any>('/api/process-engine/workflows', payload));
        this.toast.success(`${this.wfName()} has been created.`);
      }
      this.showWorkflowDialog.set(false);
      await this.loadWorkflows();
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to save workflow');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDeleteWorkflow(wf: ProcessWorkflow, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!confirm(`Delete workflow "${wf.name}"? This will remove all stages, rules, and actions.`)) return;
    try {
      await firstValueFrom(this.api.delete<any>(`/api/process-engine/workflows/${wf.id}`));
      this.toast.success(`${wf.name} has been deleted.`);
      if (this.selectedWorkflow()?.id === wf.id) { this.viewMode.set('list'); this.selectedWorkflow.set(null); }
      await this.loadWorkflows();
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to delete workflow');
    }
  }

  openCreateStage(): void {
    if (!this.selectedWorkflow()) return;
    this.editingStage.set(null);
    this.stName.set('');
    this.stDescription.set('');
    this.stActive.set(true);
    this.stRules.set([]);
    this.stTemplates.set([]);
    this.stActions.set([]);
    this.stTimer.set({ waitDays: 14, businessDaysOnly: true, escalateOnExpiry: false });
    this.stageTab.set('rules');
    this.showStageDialog.set(true);
  }

  openEditStage(stage: WorkflowStage): void {
    this.editingStage.set(stage);
    this.stName.set(stage.name);
    this.stDescription.set(stage.description || '');
    this.stActive.set(stage.isActive);
    this.stRules.set([...(stage.rules || [])]);
    this.stTemplates.set([...(stage.templates || [])]);
    this.stActions.set([...(stage.actions || [])]);
    this.stTimer.set(stage.timer || { waitDays: 14, businessDaysOnly: true, escalateOnExpiry: false });
    this.stageTab.set('rules');
    this.showStageDialog.set(true);
  }

  async handleSaveStage(): Promise<void> {
    const wf = this.selectedWorkflow();
    if (!wf || !this.stName().trim()) {
      this.toast.error('Stage name is required');
      return;
    }
    this.saving.set(true);
    try {
      const payload = {
        workflowId: wf.id,
        stageNumber: this.editingStage() ? this.editingStage()!.stageNumber : (this.stages().length > 0 ? Math.max(...this.stages().map(s => s.stageNumber)) + 1 : 1),
        name: this.stName(),
        description: this.stDescription(),
        isActive: this.stActive(),
        rules: this.stRules(),
        templates: this.stTemplates(),
        actions: this.stActions(),
        timer: this.stTimer(),
      };
      if (this.editingStage()) {
        await firstValueFrom(this.api.put<any>(`/api/process-engine/workflows/${wf.id}/stages/${this.editingStage()!.id}`, payload));
        this.toast.success(`${this.stName()} has been updated.`);
      } else {
        await firstValueFrom(this.api.post<any>(`/api/process-engine/workflows/${wf.id}/stages`, payload));
        this.toast.success(`${this.stName()} has been added.`);
      }
      this.showStageDialog.set(false);
      await this.loadStages(wf.id);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to save stage');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDeleteStage(stage: WorkflowStage): Promise<void> {
    const wf = this.selectedWorkflow();
    if (!wf) return;
    if (!confirm(`Delete stage "${stage.name}"?`)) return;
    try {
      await firstValueFrom(this.api.delete<any>(`/api/process-engine/workflows/${wf.id}/stages/${stage.id}`));
      this.toast.success(`${stage.name} has been deleted.`);
      await this.loadStages(wf.id);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to delete stage');
    }
  }

  async moveStage(stage: WorkflowStage, direction: 'up' | 'down'): Promise<void> {
    const wf = this.selectedWorkflow();
    if (!wf) return;
    const currentStages = [...this.stages()];
    const idx = currentStages.findIndex(s => s.id === stage.id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= currentStages.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const tempNum = currentStages[idx].stageNumber;
    currentStages[idx] = { ...currentStages[idx], stageNumber: currentStages[swapIdx].stageNumber };
    currentStages[swapIdx] = { ...currentStages[swapIdx], stageNumber: tempNum };
    [currentStages[idx], currentStages[swapIdx]] = [currentStages[swapIdx], currentStages[idx]];
    this.stages.set(currentStages);
    try {
      await firstValueFrom(this.api.post<any>(`/api/process-engine/workflows/${wf.id}/stages/reorder`, currentStages.map(s => ({ id: s.id, stageNumber: s.stageNumber }))));
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to reorder');
      await this.loadStages(wf.id);
    }
  }

  toggleExpanded(stageId: number | string): void {
    this.expandedStage.set(this.expandedStage() === stageId ? null : stageId);
  }

  addRule(): void {
    this.stRules.update(r => [...r, { field: 'daysPastDue', operator: 'gte', value: '', logicOperator: 'AND' }]);
  }

  removeRule(i: number): void {
    this.stRules.update(r => r.filter((_, idx) => idx !== i));
  }

  updateRule(i: number, key: string, val: string): void {
    this.stRules.update(r => r.map((rule, idx) => idx === i ? { ...rule, [key]: val } : rule));
  }

  addTemplate(): void {
    this.stTemplates.update(t => [...t, { templateCode: '', templateName: '', channel: 'SMS' }]);
  }

  removeTemplate(i: number): void {
    this.stTemplates.update(t => t.filter((_, idx) => idx !== i));
  }

  updateTemplate(i: number, key: string, val: string): void {
    this.stTemplates.update(t => t.map((tpl, idx) => idx === i ? { ...tpl, [key]: val } : tpl));
  }

  addAction(): void {
    this.stActions.update(a => [...a, { actionType: 'SEND_SMS', description: '', isAutomated: true, config: '' }]);
  }

  removeAction(i: number): void {
    this.stActions.update(a => a.filter((_, idx) => idx !== i));
  }

  updateAction(i: number, key: string, val: any): void {
    this.stActions.update(a => a.map((act, idx) => idx === i ? { ...act, [key]: val } : act));
  }

  updateTimerField(key: string, val: any): void {
    this.stTimer.update(t => ({ ...t, [key]: val }));
  }

  getRuleFieldLabel(field: string): string {
    return RULE_FIELDS.find(f => f.value === field)?.label || field;
  }

  getRuleOperatorLabel(op: string): string {
    const full = RULE_OPERATORS.find(o => o.value === op)?.label;
    return full?.split(' ')[0] || op;
  }

  getActionTypeLabel(at: string): string {
    return WORKFLOW_ACTION_TYPES.find(a => a.value === at)?.label || at;
  }

  fmtDate(d: string | null | undefined): string { return formatDate(d); }

  goHome(): void { this.router.navigate(['/']); }
}
