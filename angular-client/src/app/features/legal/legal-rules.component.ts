import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { LegalRuleVersion, RuleFormData } from '../../models/legal.models';
import { LEGAL_CATEGORIES, LEGAL_CATEGORY_LABELS } from '../../services/debt-config';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-legal-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './legal-rules.component.html',
  styleUrl: './legal-rules.component.css'
})
export class LegalRulesComponent implements OnInit {
  loading = signal(true);
  rules = signal<LegalRuleVersion[]>([]);
  searchQuery = signal('');
  categoryFilter = signal('__all__');
  gridPage = signal(1);
  gridPageSize = 10;

  dialogOpen = signal(false);
  editingRule = signal<LegalRuleVersion | null>(null);
  form = signal<RuleFormData>(this.emptyForm());
  saving = signal(false);

  historyRule = signal<LegalRuleVersion | null>(null);

  categories = LEGAL_CATEGORIES;
  categoryLabels = LEGAL_CATEGORY_LABELS;

  filteredRules = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.rules();
    if (!q) return items;
    return items.filter(r =>
      r.ruleCode.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.legislativeRef.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });

  paginatedRules = computed(() => {
    const filtered = this.filteredRules();
    const start = (this.gridPage() - 1) * this.gridPageSize;
    return filtered.slice(start, start + this.gridPageSize);
  });

  totalGridPages = computed(() => Math.ceil(this.filteredRules().length / this.gridPageSize));

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRules();
  }

  emptyForm(): RuleFormData {
    return {
      ruleCode: '',
      title: '',
      legislationRef: '',
      description: '',
      category: 'NCA',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      isActive: true,
    };
  }

  async loadRules(): Promise<void> {
    this.loading.set(true);
    try {
      const params: Record<string, string> = {};
      if (this.categoryFilter() !== '__all__') {
        params['category'] = this.categoryFilter();
      }
      const data = await firstValueFrom(this.api.get<any>('/api/legal/rules', params));
      this.rules.set(Array.isArray(data) ? data : []);
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to fetch legal rules.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.gridPage.set(1);
  }

  onCategoryChange(value: string): void {
    this.categoryFilter.set(value);
    this.gridPage.set(1);
    this.loadRules();
  }

  openAddDialog(): void {
    this.editingRule.set(null);
    this.form.set(this.emptyForm());
    this.dialogOpen.set(true);
  }

  openEditDialog(rule: LegalRuleVersion): void {
    this.editingRule.set(rule);
    this.form.set({
      ruleCode: rule.ruleCode,
      title: rule.title,
      legislationRef: rule.legislativeRef,
      description: rule.description || '',
      category: rule.category,
      effectiveFrom: rule.effectiveFrom ? new Date(rule.effectiveFrom).toISOString().split('T')[0] : '',
      effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo).toISOString().split('T')[0] : '',
      isActive: rule.isActive,
    });
    this.dialogOpen.set(true);
  }

  updateForm(field: keyof RuleFormData, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  async handleSave(): Promise<void> {
    const f = this.form();
    if (!f.ruleCode.trim() || !f.title.trim() || !f.legislationRef.trim() || !f.category) {
      this.toast.show('Rule Code, Title, Legislation Reference, and Category are required.', 'error');
      return;
    }
    this.saving.set(true);
    try {
      const payload = {
        ruleCode: f.ruleCode.trim(),
        title: f.title.trim(),
        legislationRef: f.legislationRef.trim(),
        description: f.description.trim() || null,
        category: f.category,
        effectiveFrom: f.effectiveFrom ? new Date(f.effectiveFrom).toISOString() : new Date().toISOString(),
        effectiveTo: f.effectiveTo ? new Date(f.effectiveTo).toISOString() : null,
        isActive: f.isActive,
      };
      const editing = this.editingRule();
      if (editing) {
        await firstValueFrom(this.api.put(`/api/legal/rules/${editing.id}`, payload));
        this.toast.show(`Legal rule "${f.title}" has been updated.`, 'success');
      } else {
        await firstValueFrom(this.api.post('/api/legal/rules', payload));
        this.toast.show(`Legal rule "${f.title}" has been created.`, 'success');
      }
      this.dialogOpen.set(false);
      this.editingRule.set(null);
      this.loadRules();
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to save legal rule.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDelete(rule: LegalRuleVersion): Promise<void> {
    if (!confirm(`Are you sure you want to deactivate rule "${rule.ruleCode}"?`)) return;
    try {
      await firstValueFrom(this.api.delete(`/api/legal/rules/${rule.id}`));
      this.toast.show(`Rule "${rule.ruleCode}" has been deactivated.`, 'success');
      this.loadRules();
    } catch (e: any) {
      this.toast.show(e?.error?.message || 'Failed to deactivate rule.', 'error');
    }
  }

  toggleHistory(rule: LegalRuleVersion): void {
    const current = this.historyRule();
    this.historyRule.set(current?.id === rule.id ? null : rule);
  }

  closeHistory(): void {
    this.historyRule.set(null);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  toggleActive(): void {
    this.form.update(f => ({ ...f, isActive: !f.isActive }));
  }

  prevPage(): void {
    this.gridPage.update(p => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.gridPage.update(p => Math.min(this.totalGridPages(), p + 1));
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
    } catch { return String(d); }
  }

  formatDateTime(d: string | null | undefined): string {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    } catch { return String(d); }
  }

  getCategoryLabel(cat: string): string {
    return this.categoryLabels[cat] || cat;
  }
}
