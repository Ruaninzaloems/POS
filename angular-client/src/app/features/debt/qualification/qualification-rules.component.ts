import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { QUALIFICATION_FIELD_OPTIONS, QUALIFICATION_OPERATOR_OPTIONS } from '../../../services/debt-config';
import { Condition } from '../../../models/debt.models';

@Component({
  selector: 'app-qualification-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './qualification-rules.component.html',
  styleUrls: ['./qualification-rules.component.css']
})
export class QualificationRulesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  rules = signal<any[]>([]);
  loading = signal(false);
  showEditor = signal(false);
  editingId = signal<number | null>(null);
  ruleName = signal('');
  ruleDescription = signal('');
  rulePriority = signal('0');
  conditions = signal<Condition[]>([]);
  saving = signal(false);
  runningRuleId = signal<number | null>(null);
  runResults = signal<any>(null);
  testAccounts = signal('');

  FIELD_OPTIONS = QUALIFICATION_FIELD_OPTIONS;
  OPERATOR_OPTIONS = QUALIFICATION_OPERATOR_OPTIONS;

  previewText = computed(() => {
    return this.conditions().map((c, i) => {
      const fieldLabel = this.getFieldLabel(c.field);
      const prefix = i === 0 ? 'WHERE' : c.logicOperator;
      return `${prefix} ${fieldLabel} ${c.operator} ${c.value}`;
    }).join('\n');
  });

  ngOnInit(): void { this.loadRules(); }

  async loadRules(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any[]>('/api/debt-scoring/qualification-rules'));
      this.rules.set(Array.isArray(data) ? data : []);
    } catch (err: any) { this.toast.error(err?.message || 'Failed to load rules'); }
    finally { this.loading.set(false); }
  }

  getFieldLabel(field: string): string {
    return this.FIELD_OPTIONS.find(f => f.value === field)?.label || field;
  }

  openNew(): void {
    this.editingId.set(null);
    this.ruleName.set('');
    this.ruleDescription.set('');
    this.rulePriority.set('0');
    this.conditions.set([{ field: 'totalArrears', operator: '>', value: '0', logicOperator: 'AND' }]);
    this.showEditor.set(true);
  }

  openEdit(rule: any): void {
    this.editingId.set(rule.id);
    this.ruleName.set(rule.name);
    this.ruleDescription.set(rule.description || '');
    this.rulePriority.set(String(rule.priority || 0));
    const conds = rule.conditions as Condition[];
    this.conditions.set(Array.isArray(conds) && conds.length > 0 ? [...conds] : [{ field: 'totalArrears', operator: '>', value: '0', logicOperator: 'AND' }]);
    this.showEditor.set(true);
  }

  addCondition(): void {
    this.conditions.update(c => [...c, { field: 'totalArrears', operator: '>', value: '0', logicOperator: 'AND' }]);
  }

  removeCondition(index: number): void {
    this.conditions.update(c => c.filter((_, i) => i !== index));
  }

  updateCondition(index: number, field: string, value: string): void {
    this.conditions.update(c => c.map((cond, i) => i === index ? { ...cond, [field]: value } : cond));
  }

  async handleSave(): Promise<void> {
    if (!this.ruleName().trim()) { this.toast.error('Rule name required'); return; }
    if (this.conditions().length === 0) { this.toast.error('At least one condition required'); return; }
    this.saving.set(true);
    try {
      const existingRule = this.editingId() ? this.rules().find(r => r.id === this.editingId()) : null;
      const payload = {
        name: this.ruleName().trim(),
        description: this.ruleDescription().trim() || null,
        priority: parseInt(this.rulePriority()) || 0,
        conditions: this.conditions().map((c, i) => ({
          field: c.field,
          operator: c.operator,
          value: isNaN(Number(c.value)) ? c.value : Number(c.value),
          logicOperator: i === 0 ? 'AND' : c.logicOperator,
        })),
        isActive: existingRule ? existingRule.isActive : true,
      };
      if (this.editingId()) {
        await firstValueFrom(this.api.put<any>(`/api/debt-scoring/qualification-rules/${this.editingId()}`, payload));
        this.toast.success('Rule Updated');
      } else {
        await firstValueFrom(this.api.post<any>('/api/debt-scoring/qualification-rules', payload));
        this.toast.success('Rule Created');
      }
      this.showEditor.set(false);
      this.loadRules();
    } catch (err: any) { this.toast.error(err?.message || 'Save failed'); }
    finally { this.saving.set(false); }
  }

  async handleDelete(id: number): Promise<void> {
    if (!confirm('Delete this qualification rule?')) return;
    try {
      await firstValueFrom(this.api.delete<any>(`/api/debt-scoring/qualification-rules/${id}`));
      this.toast.success('Rule Deleted');
      this.loadRules();
    } catch (err: any) { this.toast.error(err?.message || 'Delete failed'); }
  }

  async handleToggle(rule: any): Promise<void> {
    try {
      await firstValueFrom(this.api.put<any>(`/api/debt-scoring/qualification-rules/${rule.id}`, { isActive: !rule.isActive }));
      this.loadRules();
    } catch (err: any) { this.toast.error(err?.message || 'Toggle failed'); }
  }

  async handleRun(ruleId: number): Promise<void> {
    const lines = this.testAccounts().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { this.toast.error('Enter test accounts in the panel below before running.'); return; }
    this.runningRuleId.set(ruleId);
    try {
      const accounts = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        const acc: Record<string, any> = { accountNo: parts[0] || line };
        if (parts[1]) acc['totalArrears'] = parseFloat(parts[1]) || 0;
        if (parts[2]) acc['arrearDays'] = parseInt(parts[2]) || 0;
        if (parts[3]) acc['lastPaymentDays'] = parseInt(parts[3]) || 0;
        if (parts[4]) acc['propertyValue'] = parseFloat(parts[4]) || 0;
        if (parts[5]) acc['waterArrears'] = parseFloat(parts[5]) || 0;
        if (parts[6]) acc['electricityArrears'] = parseFloat(parts[6]) || 0;
        return acc;
      });
      const result = await firstValueFrom(this.api.post<any>(`/api/debt-scoring/qualification-rules/${ruleId}/run`, { accounts }));
      this.runResults.set(result);
      this.toast.success(`${result.matchedCount} of ${result.totalEvaluated} accounts matched`);
    } catch (err: any) { this.toast.error(err?.message || 'Run failed'); }
    finally { this.runningRuleId.set(null); }
  }

  goBack(): void { this.router.navigate(['/']); }
}
