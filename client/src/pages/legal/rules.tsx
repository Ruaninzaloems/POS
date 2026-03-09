import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Scale,
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbSep,
  Check,
  History,
} from 'lucide-react';
import {
  fetchLegalRules,
  createLegalRule,
  updateLegalRule,
  deleteLegalRule,
} from '@/lib/external-api';
import type { LegalRuleVersion } from '@shared/schema';

const CATEGORIES = [
  { value: 'NCA', label: 'National Credit Act' },
  { value: 'MSA', label: 'Municipal Systems Act' },
  { value: 'MPRA', label: 'Municipal Property Rates Act' },
  { value: 'POPIA', label: 'POPIA' },
  { value: 'CPA', label: 'Consumer Protection Act' },
];

const CATEGORY_LABELS: Record<string, string> = {
  NCA: 'National Credit Act',
  MSA: 'Municipal Systems Act',
  MPRA: 'Municipal Property Rates Act',
  POPIA: 'POPIA',
  CPA: 'Consumer Protection Act',
};

type RuleFormData = {
  ruleCode: string;
  title: string;
  legislationRef: string;
  description: string;
  category: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};

const emptyForm: RuleFormData = {
  ruleCode: '',
  title: '',
  legislationRef: '',
  description: '',
  category: 'NCA',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
  isActive: true,
};

export default function LegalRulesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [rules, setRules] = useState<LegalRuleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('__all__');
  const [gridPage, setGridPage] = useState(1);
  const gridPageSize = 10;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<LegalRuleVersion | null>(null);
  const [form, setForm] = useState<RuleFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [historyRule, setHistoryRule] = useState<LegalRuleVersion | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLegalRules({
        category: categoryFilter !== '__all__' ? categoryFilter : undefined,
      });
      setRules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to fetch legal rules.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, toast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const filteredRules = rules.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.ruleCode.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.legislationRef.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });

  const paginatedRules = filteredRules.slice((gridPage - 1) * gridPageSize, gridPage * gridPageSize);
  const totalGridPages = Math.ceil(filteredRules.length / gridPageSize);

  const openAddDialog = () => {
    setEditingRule(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: LegalRuleVersion) => {
    setEditingRule(rule);
    setForm({
      ruleCode: rule.ruleCode,
      title: rule.title,
      legislationRef: rule.legislationRef,
      description: rule.description || '',
      category: rule.category,
      effectiveFrom: rule.effectiveFrom ? new Date(rule.effectiveFrom).toISOString().split('T')[0] : '',
      effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo).toISOString().split('T')[0] : '',
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.ruleCode.trim() || !form.title.trim() || !form.legislationRef.trim() || !form.category) {
      toast({ title: 'Validation Error', description: 'Rule Code, Title, Legislation Reference, and Category are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ruleCode: form.ruleCode.trim(),
        title: form.title.trim(),
        legislationRef: form.legislationRef.trim(),
        description: form.description.trim() || null,
        category: form.category,
        effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : new Date().toISOString(),
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
        isActive: form.isActive,
      };
      if (editingRule) {
        await updateLegalRule(editingRule.id, payload);
        toast({ title: 'Rule Updated', description: `Legal rule "${form.title}" has been updated.` });
      } else {
        await createLegalRule(payload);
        toast({ title: 'Rule Created', description: `Legal rule "${form.title}" has been created.` });
      }
      setDialogOpen(false);
      setEditingRule(null);
      loadRules();
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message || 'Failed to save legal rule.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: LegalRuleVersion) => {
    if (!window.confirm(`Are you sure you want to deactivate rule "${rule.ruleCode}"?`)) return;
    try {
      await deleteLegalRule(rule.id);
      toast({ title: 'Rule Deactivated', description: `Rule "${rule.ruleCode}" has been deactivated.` });
      loadRules();
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err.message || 'Failed to deactivate rule.', variant: 'destructive' });
    }
  };

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-0">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1" data-testid="text-breadcrumb">
            <span>Compliance</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-slate-300">Legal Rules Administration</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <Scale className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight" data-testid="text-page-title">
                  Legal Rules Administration
                </h1>
                <p className="text-xs text-slate-400">Manage legal rule versions for compliance validation</p>
              </div>
            </div>
            <Button
              onClick={openAddDialog}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              data-testid="button-add-rule"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Rule
            </Button>
          </div>

          <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <Input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setGridPage(1); }}
                    placeholder="Search by rule code, title, or legislation..."
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-search-rules"
                  />
                </div>
                <div className="w-full sm:w-56">
                  <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setGridPage(1); }}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-category-filter">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Categories</SelectItem>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading legal rules...
                </div>
              ) : filteredRules.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8" data-testid="text-no-rules">
                  No legal rules found.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700/50 hover:bg-transparent">
                          <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Rule Code</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Title</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Legislation</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Category</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Version</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Effective From</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Status</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRules.map((rule) => (
                          <TableRow
                            key={rule.id}
                            className="border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                            data-testid={`row-rule-${rule.id}`}
                          >
                            <TableCell className="text-xs text-slate-300 font-mono whitespace-nowrap" data-testid={`text-rule-code-${rule.id}`}>
                              {rule.ruleCode}
                            </TableCell>
                            <TableCell className="text-xs text-slate-300 max-w-[200px] truncate" data-testid={`text-rule-title-${rule.id}`}>
                              {rule.title}
                            </TableCell>
                            <TableCell className="text-xs text-slate-400 max-w-[200px] truncate">
                              {rule.legislationRef}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/20 text-violet-400">
                                {CATEGORY_LABELS[rule.category] || rule.category}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-300 text-center">
                              v{rule.version}
                            </TableCell>
                            <TableCell className="text-xs text-slate-300 whitespace-nowrap">
                              {rule.effectiveFrom ? new Date(rule.effectiveFrom).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                rule.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                              }`} data-testid={`status-rule-${rule.id}`}>
                                {rule.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-violet-400"
                                  onClick={() => openEditDialog(rule)}
                                  title="Edit Rule"
                                  data-testid={`button-edit-rule-${rule.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-amber-400"
                                  onClick={() => setHistoryRule(historyRule?.id === rule.id ? null : rule)}
                                  title="Version History"
                                  data-testid={`button-history-rule-${rule.id}`}
                                >
                                  <History className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                                  onClick={() => handleDelete(rule)}
                                  title="Deactivate Rule"
                                  data-testid={`button-delete-rule-${rule.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {historyRule && (
                    <div className="mt-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700/40">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-white flex items-center gap-1">
                          <History className="w-3.5 h-3.5 text-amber-400" />
                          Version History — {historyRule.ruleCode}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400"
                          onClick={() => setHistoryRule(null)}
                          data-testid="button-close-history"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3 text-xs text-slate-400 p-2 bg-slate-800/50 rounded">
                          <span className="font-mono text-violet-400">v{historyRule.version}</span>
                          <span className="text-slate-300">{historyRule.title}</span>
                          <span>Effective: {historyRule.effectiveFrom ? new Date(historyRule.effectiveFrom).toLocaleDateString() : '—'}</span>
                          {historyRule.effectiveTo && (
                            <span>Until: {new Date(historyRule.effectiveTo).toLocaleDateString()}</span>
                          )}
                          <span className={historyRule.isActive ? 'text-emerald-400' : 'text-red-400'}>
                            {historyRule.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-slate-500 ml-auto">
                            Updated: {historyRule.updatedAt ? new Date(historyRule.updatedAt).toLocaleString() : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {totalGridPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
                      <span className="text-xs text-slate-500">
                        Page {gridPage} of {totalGridPages} ({filteredRules.length} rule{filteredRules.length !== 1 ? 's' : ''})
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setGridPage(p => Math.max(1, p - 1))}
                          disabled={gridPage <= 1}
                          className="h-7 px-2 text-slate-400"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setGridPage(p => Math.min(totalGridPages, p + 1))}
                          disabled={gridPage >= totalGridPages}
                          className="h-7 px-2 text-slate-400"
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-white" data-testid="text-dialog-title">
                {editingRule ? 'Edit Legal Rule' : 'Add Legal Rule'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-400"
                onClick={() => setDialogOpen(false)}
                data-testid="button-close-dialog"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Rule Code *</Label>
                <Input
                  value={form.ruleCode}
                  onChange={(e) => setForm(f => ({ ...f, ruleCode: e.target.value }))}
                  placeholder="e.g. NCA_S129_NOTICE"
                  className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                  disabled={!!editingRule}
                  data-testid="input-rule-code"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Rule title"
                  className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                  data-testid="input-rule-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Legislation Reference *</Label>
                <Input
                  value={form.legislationRef}
                  onChange={(e) => setForm(f => ({ ...f, legislationRef: e.target.value }))}
                  placeholder="e.g. National Credit Act 34 of 2005, Section 129(1)(a)"
                  className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                  data-testid="input-legislation-ref"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Description</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Rule description..."
                  className="w-full bg-slate-900/60 border border-slate-600/50 text-white text-sm rounded-md p-2 min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  data-testid="input-rule-description"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-rule-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Effective From *</Label>
                  <Input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-effective-from"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Effective To</Label>
                  <Input
                    type="date"
                    value={form.effectiveTo}
                    onChange={(e) => setForm(f => ({ ...f, effectiveTo: e.target.value }))}
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-effective-to"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-violet-600' : 'bg-slate-600'}`}
                  data-testid="toggle-is-active"
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <Label className="text-xs text-slate-300">Active</Label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                data-testid="button-cancel-dialog"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-700 text-white"
                data-testid="button-save-rule"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                {editingRule ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PosLayout>
  );
}
