import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Filter,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Play,
  X,
  ChevronRight as BreadcrumbSep,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchQualificationRules,
  createQualificationRule,
  updateQualificationRule,
  deleteQualificationRule,
  runQualificationRule,
} from '@/lib/external-api';
import type { Condition, QualificationRunResult } from '@/models/debt.models';
import { QUALIFICATION_FIELD_OPTIONS, QUALIFICATION_OPERATOR_OPTIONS } from '@/services/debt-config';

const FIELD_OPTIONS = QUALIFICATION_FIELD_OPTIONS;
const OPERATOR_OPTIONS = QUALIFICATION_OPERATOR_OPTIONS;

function FieldLabel({ field }: { field: string }) {
  const opt = FIELD_OPTIONS.find(f => f.value === field);
  return <span className="text-xs text-foreground">{opt?.label || field}</span>;
}

export default function QualificationRules() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [rulePriority, setRulePriority] = useState('0');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [saving, setSaving] = useState(false);

  const [runningRuleId, setRunningRuleId] = useState<number | null>(null);
  const [runResults, setRunResults] = useState<QualificationRunResult | null>(null);

  const [testAccounts, setTestAccounts] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchQualificationRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Failed to load rules', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const openNew = () => {
    setEditingId(null);
    setRuleName('');
    setRuleDescription('');
    setRulePriority('0');
    setConditions([{ field: 'totalArrears', operator: '>', value: '0', logicOperator: 'AND' }]);
    setShowEditor(true);
  };

  const openEdit = (rule: any) => {
    setEditingId(rule.id);
    setRuleName(rule.name);
    setRuleDescription(rule.description || '');
    setRulePriority(String(rule.priority || 0));
    const conds = rule.conditions as Condition[];
    setConditions(Array.isArray(conds) && conds.length > 0 ? conds : [{ field: 'totalArrears', operator: '>', value: '0', logicOperator: 'AND' }]);
    setShowEditor(true);
  };

  const addCondition = () => {
    setConditions(prev => [...prev, { field: 'totalArrears', operator: '>', value: '0', logicOperator: 'AND' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof Condition, value: string) => {
    setConditions(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleSave = async () => {
    if (!ruleName.trim()) { toast({ title: 'Rule name required', variant: 'destructive' }); return; }
    if (conditions.length === 0) { toast({ title: 'At least one condition required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const existingRule = editingId ? rules.find(r => r.id === editingId) : null;
      const payload = {
        name: ruleName.trim(),
        description: ruleDescription.trim() || null,
        priority: parseInt(rulePriority) || 0,
        conditions: conditions.map((c, i) => ({
          field: c.field,
          operator: c.operator,
          value: isNaN(Number(c.value)) ? c.value : Number(c.value),
          logicOperator: i === 0 ? 'AND' : c.logicOperator,
        })),
        isActive: existingRule ? existingRule.isActive : true,
      };
      if (editingId) {
        await updateQualificationRule(editingId, payload);
        toast({ title: 'Rule Updated' });
      } else {
        await createQualificationRule(payload);
        toast({ title: 'Rule Created' });
      }
      setShowEditor(false);
      loadRules();
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this qualification rule?')) return;
    try {
      await deleteQualificationRule(id);
      toast({ title: 'Rule Deleted' });
      loadRules();
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggle = async (rule: any) => {
    try {
      await updateQualificationRule(rule.id, { isActive: !rule.isActive });
      loadRules();
    } catch (err: any) {
      toast({ title: 'Toggle Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleRun = async (ruleId: number) => {
    const lines = testAccounts.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast({ title: 'Enter test accounts', description: 'Add account data in the test panel below before running.', variant: 'destructive' });
      return;
    }
    setRunningRuleId(ruleId);
    try {
      const accounts = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        const acc: Record<string, any> = { accountNo: parts[0] || line };
        if (parts[1]) acc.totalArrears = parseFloat(parts[1]) || 0;
        if (parts[2]) acc.arrearDays = parseInt(parts[2]) || 0;
        if (parts[3]) acc.lastPaymentDays = parseInt(parts[3]) || 0;
        if (parts[4]) acc.propertyValue = parseFloat(parts[4]) || 0;
        if (parts[5]) acc.waterArrears = parseFloat(parts[5]) || 0;
        if (parts[6]) acc.electricityArrears = parseFloat(parts[6]) || 0;
        return acc;
      });
      const result = await runQualificationRule(ruleId, accounts);
      setRunResults(result);
      toast({ title: 'Rule Executed', description: `${result.matchedCount} of ${result.totalEvaluated} accounts matched` });
    } catch (err: any) {
      toast({ title: 'Run Failed', description: err.message, variant: 'destructive' });
    } finally { setRunningRuleId(null); }
  };

  return (
    <PosLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-[#D6D6D6] bg-white">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <button onClick={() => setLocation('/')} className="hover:text-foreground transition-colors" data-testid="link-home">Home</button>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-foreground font-medium">Smart Qualification Rules</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)] flex items-center justify-center">
                <Filter className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">Smart Qualification Rules</h1>
              <HelpTip text="Define complex qualification rules with multiple conditions to identify accounts meeting specific criteria for debt recovery, handover, or legal escalation." />
            </div>
            <Button size="sm" onClick={openNew} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-add-rule">
              <Plus className="w-3.5 h-3.5 mr-1" />Add Rule
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F2F4F7] min-h-0">
          <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          {showEditor && (
            <Card className="bg-white border-[var(--pos-accent)] border-2 shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{editingId ? 'Edit Rule' : 'New Qualification Rule'}</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowEditor(false)} className="text-muted-foreground hover:text-foreground h-7"><X className="w-4 h-4" /></Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Rule Name</Label>
                    <Input data-testid="input-rule-name" value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g., High-value water debtors" className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input data-testid="input-rule-desc" value={ruleDescription} onChange={e => setRuleDescription(e.target.value)} placeholder="Optional description..." className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Priority (higher = first)</Label>
                    <Input data-testid="input-rule-priority" type="number" value={rulePriority} onChange={e => setRulePriority(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Conditions</Label>
                  {conditions.map((cond, i) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`condition-${i}`}>
                      {i > 0 && (
                        <Select value={cond.logicOperator} onValueChange={v => updateCondition(i, 'logicOperator', v)}>
                          <SelectTrigger className="w-20 bg-[#F7F7F7] border-[#D6D6D6] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent>
                        </Select>
                      )}
                      {i === 0 && <div className="w-20 text-xs text-muted-foreground text-center">WHERE</div>}
                      <Select value={cond.field} onValueChange={v => updateCondition(i, 'field', v)}>
                        <SelectTrigger className="flex-1 bg-[#F7F7F7] border-[#D6D6D6] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={cond.operator} onValueChange={v => updateCondition(i, 'operator', v)}>
                        <SelectTrigger className="w-20 bg-[#F7F7F7] border-[#D6D6D6] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OPERATOR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={cond.value} onChange={e => updateCondition(i, 'value', e.target.value)} className="w-32 bg-[#F7F7F7] border-[#D6D6D6] h-8 text-xs" placeholder="Value" />
                      <Button size="sm" variant="ghost" onClick={() => removeCondition(i)} className="text-red-500 hover:text-red-700 h-7 w-7 p-0" disabled={conditions.length <= 1}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={addCondition} className="text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)]" data-testid="button-add-condition">
                    <Plus className="w-3.5 h-3.5 mr-1" />Add Condition
                  </Button>
                </div>

                <div className="p-3 bg-[#F7F7F7] rounded-md">
                  <p className="text-xs text-muted-foreground font-mono">
                    {conditions.map((c, i) => {
                      const fieldLabel = FIELD_OPTIONS.find(f => f.value === c.field)?.label || c.field;
                      const prefix = i === 0 ? 'WHERE' : c.logicOperator;
                      return `${prefix} ${fieldLabel} ${c.operator} ${c.value}`;
                    }).join('\n')}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-save-rule">
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    {editingId ? 'Update Rule' : 'Create Rule'}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowEditor(false)} className="text-muted-foreground">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Filter className="w-4 h-4" />Qualification Rules</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No qualification rules defined. Click "Add Rule" to create one.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#E5E5E5] hover:bg-transparent bg-[#F7F7F7]">
                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Name</TableHead>
                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Conditions</TableHead>
                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Priority</TableHead>
                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active</TableHead>
                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</TableHead>
                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-[#E5E5E5]">
                      {rules.map((rule: any) => {
                        const conds = (rule.conditions || []) as Condition[];
                        return (
                          <TableRow key={rule.id} className="hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-rule-${rule.id}`}>
                            <TableCell>
                              <div className="text-foreground text-sm font-medium">{rule.name}</div>
                              {rule.description && <div className="text-xs text-muted-foreground">{rule.description}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                {conds.slice(0, 3).map((c, ci) => (
                                  <div key={ci} className="text-xs text-muted-foreground font-mono">
                                    <span className="text-amber-700">{ci === 0 ? '' : c.logicOperator + ' '}</span>
                                    <FieldLabel field={c.field} /> <span className="text-cyan-700">{c.operator}</span> <span className="text-foreground">{String(c.value)}</span>
                                  </div>
                                ))}
                                {conds.length > 3 && <div className="text-[10px] text-muted-foreground">+{conds.length - 3} more</div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-foreground text-sm">{rule.priority}</TableCell>
                            <TableCell>
                              <Switch checked={rule.isActive} onCheckedChange={() => handleToggle(rule)} data-testid={`switch-active-${rule.id}`} />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{rule.createdAt ? new Date(rule.createdAt).toLocaleDateString() : '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleRun(rule.id)} disabled={runningRuleId === rule.id} className="text-emerald-600 hover:text-emerald-700 h-7" data-testid={`button-run-${rule.id}`}>
                                  {runningRuleId === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openEdit(rule)} className="text-muted-foreground hover:text-foreground h-7" data-testid={`button-edit-${rule.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(rule.id)} className="text-red-500 hover:text-red-700 h-7" data-testid={`button-delete-${rule.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Play className="w-4 h-4" />Test Accounts Data</h3>
              <p className="text-xs text-muted-foreground">Enter account data as CSV lines to test rules against. Format: <span className="font-mono text-foreground">accountNo, totalArrears, arrearDays, lastPaymentDays, propertyValue, waterArrears, electricityArrears</span></p>
              <textarea
                data-testid="textarea-test-accounts"
                className="w-full h-28 bg-[#F7F7F7] border border-[#D6D6D6] text-foreground text-sm rounded-md p-2 resize-none focus:ring-2 focus:ring-[var(--pos-accent)] focus:border-transparent font-mono"
                placeholder={"ACC001, 15000, 120, 90, 800000, 5000, 3000\nACC002, 3000, 30, 15, 250000, 1000, 500\nACC003, 45000, 200, 180, 1200000, 15000, 12000"}
                value={testAccounts}
                onChange={e => setTestAccounts(e.target.value)}
              />
            </CardContent>
          </Card>

          {runResults && (
            <Card className="bg-white border-emerald-300 border-2 shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Rule Execution Results — {runResults.rule?.name}</h3>
                  <Button size="sm" variant="ghost" onClick={() => setRunResults(null)} className="text-muted-foreground h-7"><X className="w-4 h-4" /></Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-[#F7F7F7] rounded text-center">
                    <div className="text-xl font-bold text-foreground">{runResults.totalEvaluated}</div>
                    <div className="text-xs text-muted-foreground">Evaluated</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded text-center">
                    <div className="text-xl font-bold text-emerald-700">{runResults.matchedCount}</div>
                    <div className="text-xs text-emerald-600">Matched</div>
                  </div>
                  <div className="p-3 bg-[#F7F7F7] rounded text-center">
                    <div className="text-xl font-bold text-muted-foreground">{runResults.unmatchedCount}</div>
                    <div className="text-xs text-muted-foreground">Unmatched</div>
                  </div>
                </div>
                {runResults.matched && runResults.matched.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#E5E5E5] hover:bg-transparent bg-[#F7F7F7]">
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Arrears</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Arrear Days</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Last Payment</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Property Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-[#E5E5E5]">
                        {runResults.matched.map((m: any, i: number) => (
                          <TableRow key={i} className="hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-matched-${i}`}>
                            <TableCell className="text-foreground text-sm font-mono">{m.accountNo}</TableCell>
                            <TableCell className="text-foreground text-sm">R {(m.totalArrears || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-foreground text-sm">{m.arrearDays || 0}</TableCell>
                            <TableCell className="text-foreground text-sm">{m.lastPaymentDays || 0} days ago</TableCell>
                            <TableCell className="text-foreground text-sm">R {(m.propertyValue || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-amber-50 border-amber-200 rounded-xl">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-semibold mb-1">Example Qualification Rules</p>
                  <ul className="space-y-0.5 text-amber-600">
                    <li>Water arrears {'>'} 90 days AND electricity arrears {'>'} R1,000 AND no payment in 60 days AND property value {'>'} R500k</li>
                    <li>Total arrears {'>'} R20,000 AND risk score {'>'} 60 AND previous legal actions = 0</li>
                    <li>Rates arrears {'>'} R5,000 OR refuse arrears {'>'} R3,000</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </PosLayout>
  );
}
