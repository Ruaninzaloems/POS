import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Workflow,
  Loader2,
  ChevronRight as BreadcrumbSep,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Settings2,
  FileText,
  Zap,
  Clock,
  Shield,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  Play,
  Pause,
  ListOrdered,
} from 'lucide-react';
import {
  fetchProcessWorkflows,
  fetchProcessWorkflow,
  createProcessWorkflow,
  updateProcessWorkflow,
  deleteProcessWorkflow,
  fetchWorkflowStages,
  createWorkflowStage,
  updateWorkflowStage,
  deleteWorkflowStage,
  reorderWorkflowStages,
} from '@/lib/external-api';
import type { ProcessWorkflow, StageRule, StageTemplate, StageAction, StageTimer, WorkflowStage } from '@/models/debt.models';
import { formatDate } from '@/services/format.service';
import { RULE_FIELDS, RULE_OPERATORS, WORKFLOW_ACTION_TYPES, CHANNEL_OPTIONS } from '@/services/debt-config';

type Workflow_ = ProcessWorkflow;
type Stage = WorkflowStage;
const ACTION_TYPES = WORKFLOW_ACTION_TYPES;

function emptyTimer(): StageTimer {
  return { waitDays: 14, businessDaysOnly: true, escalateOnExpiry: false };
}

function emptyStage(workflowId: string | number, stageNumber: number): Stage {
  return {
    id: 0,
    workflowId,
    stageNumber,
    name: '',
    description: '',
    isActive: true,
    rules: [],
    templates: [],
    actions: [],
    timer: emptyTimer(),
  };
}

export default function ProcessEngine() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<Workflow_[]>([]);

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow_ | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [expandedStage, setExpandedStage] = useState<number | string | null>(null);

  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow_ | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [saving, setSaving] = useState(false);

  const [wfName, setWfName] = useState('');
  const [wfDescription, setWfDescription] = useState('');
  const [wfActive, setWfActive] = useState(true);

  const [stName, setStName] = useState('');
  const [stDescription, setStDescription] = useState('');
  const [stActive, setStActive] = useState(true);
  const [stRules, setStRules] = useState<StageRule[]>([]);
  const [stTemplates, setStTemplates] = useState<StageTemplate[]>([]);
  const [stActions, setStActions] = useState<StageAction[]>([]);
  const [stTimer, setStTimer] = useState<StageTimer>(emptyTimer());
  const [stageTab, setStageTab] = useState('rules');

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProcessWorkflows();
      setWorkflows(Array.isArray(data) ? data : data?.workflows || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadWorkflows(); }, [loadWorkflows]);

  const loadStages = useCallback(async (wfId: string | number) => {
    setLoadingStages(true);
    try {
      const data = await fetchWorkflowStages(String(wfId));
      const stageList = Array.isArray(data) ? data : data?.stages || [];
      stageList.sort((a: Stage, b: Stage) => a.stageNumber - b.stageNumber);
      setStages(stageList);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingStages(false);
    }
  }, [toast]);

  const openWorkflowDetail = async (wf: Workflow_) => {
    setSelectedWorkflow(wf);
    setViewMode('detail');
    setExpandedStage(null);
    await loadStages(wf.id);
  };

  const openCreateWorkflow = () => {
    setEditingWorkflow(null);
    setWfName(''); setWfDescription(''); setWfActive(true);
    setShowWorkflowDialog(true);
  };

  const openEditWorkflow = (wf: Workflow_) => {
    setEditingWorkflow(wf);
    setWfName(wf.name); setWfDescription(wf.description || ''); setWfActive(wf.isActive);
    setShowWorkflowDialog(true);
  };

  const handleSaveWorkflow = async () => {
    if (!wfName.trim()) {
      toast({ title: 'Validation', description: 'Workflow name is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      if (editingWorkflow) {
        await updateProcessWorkflow(String(editingWorkflow.id), { name: wfName, description: wfDescription, isActive: wfActive });
        toast({ title: 'Workflow Updated', description: `${wfName} has been updated.` });
      } else {
        await createProcessWorkflow({ name: wfName, description: wfDescription, isActive: wfActive });
        toast({ title: 'Workflow Created', description: `${wfName} has been created.` });
      }
      setShowWorkflowDialog(false);
      await loadWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = async (wf: Workflow_) => {
    if (!window.confirm(`Delete workflow "${wf.name}"? This will remove all stages, rules, and actions.`)) return;
    try {
      await deleteProcessWorkflow(String(wf.id));
      toast({ title: 'Deleted', description: `${wf.name} has been deleted.` });
      if (selectedWorkflow?.id === wf.id) { setViewMode('list'); setSelectedWorkflow(null); }
      await loadWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const openCreateStage = () => {
    if (!selectedWorkflow) return;
    setEditingStage(null);
    const nextNum = stages.length > 0 ? Math.max(...stages.map(s => s.stageNumber)) + 1 : 1;
    setStName(''); setStDescription(''); setStActive(true);
    setStRules([]); setStTemplates([]); setStActions([]); setStTimer(emptyTimer());
    setStageTab('rules');
    setShowStageDialog(true);
  };

  const openEditStage = (stage: Stage) => {
    setEditingStage(stage);
    setStName(stage.name); setStDescription(stage.description || ''); setStActive(stage.isActive);
    setStRules(stage.rules || []); setStTemplates(stage.templates || []); setStActions(stage.actions || []);
    setStTimer(stage.timer || emptyTimer());
    setStageTab('rules');
    setShowStageDialog(true);
  };

  const handleSaveStage = async () => {
    if (!selectedWorkflow || !stName.trim()) {
      toast({ title: 'Validation', description: 'Stage name is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const payload = {
        workflowId: selectedWorkflow.id,
        stageNumber: editingStage ? editingStage.stageNumber : (stages.length > 0 ? Math.max(...stages.map(s => s.stageNumber)) + 1 : 1),
        name: stName,
        description: stDescription,
        isActive: stActive,
        rules: stRules,
        templates: stTemplates,
        actions: stActions,
        timer: stTimer,
      };
      if (editingStage) {
        await updateWorkflowStage(String(selectedWorkflow.id), String(editingStage.id), payload);
        toast({ title: 'Stage Updated', description: `${stName} has been updated.` });
      } else {
        await createWorkflowStage(String(selectedWorkflow.id), payload);
        toast({ title: 'Stage Created', description: `${stName} has been added.` });
      }
      setShowStageDialog(false);
      await loadStages(selectedWorkflow.id);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStage = async (stage: Stage) => {
    if (!selectedWorkflow) return;
    if (!window.confirm(`Delete stage "${stage.name}"?`)) return;
    try {
      await deleteWorkflowStage(String(selectedWorkflow.id), String(stage.id));
      toast({ title: 'Deleted', description: `${stage.name} has been deleted.` });
      await loadStages(selectedWorkflow.id);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const moveStage = async (stage: Stage, direction: 'up' | 'down') => {
    if (!selectedWorkflow) return;
    const idx = stages.findIndex(s => s.id === stage.id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= stages.length - 1) return;
    const newStages = [...stages];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const tempNum = newStages[idx].stageNumber;
    newStages[idx].stageNumber = newStages[swapIdx].stageNumber;
    newStages[swapIdx].stageNumber = tempNum;
    [newStages[idx], newStages[swapIdx]] = [newStages[swapIdx], newStages[idx]];
    setStages(newStages);
    try {
      await reorderWorkflowStages(String(selectedWorkflow.id), newStages.map(s => ({ id: s.id, stageNumber: s.stageNumber })));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      await loadStages(selectedWorkflow.id);
    }
  };

  const addRule = () => setStRules([...stRules, { field: 'daysPastDue', operator: 'gte', value: '', logicOperator: 'AND' }]);
  const removeRule = (i: number) => setStRules(stRules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, key: string, val: string) => { const r = [...stRules]; (r[i] as any)[key] = val; setStRules(r); };

  const addTemplate = () => setStTemplates([...stTemplates, { templateCode: '', templateName: '', channel: 'SMS' }]);
  const removeTemplate = (i: number) => setStTemplates(stTemplates.filter((_, idx) => idx !== i));
  const updateTemplate = (i: number, key: string, val: string) => { const t = [...stTemplates]; (t[i] as any)[key] = val; setStTemplates(t); };

  const addAction = () => setStActions([...stActions, { actionType: 'SEND_SMS', description: '', isAutomated: true, config: '' }]);
  const removeAction = (i: number) => setStActions(stActions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, key: string, val: any) => { const a = [...stActions]; (a[i] as any)[key] = val; setStActions(a); };

  const renderRuleSummary = (rules: StageRule[]) => {
    if (!rules || rules.length === 0) return <span className="text-gray-400 text-xs">No rules</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {rules.map((r, i) => {
          const fieldLabel = RULE_FIELDS.find(f => f.value === r.field)?.label || r.field;
          const opLabel = RULE_OPERATORS.find(o => o.value === r.operator)?.label?.split(' ')[0] || r.operator;
          return (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-xs font-bold text-[var(--pos-accent)]">{r.logicOperator || 'AND'}</span>}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {fieldLabel} {opLabel} {r.value}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <PosLayout>
        <div className="flex-1 overflow-y-auto bg-[#F2F4F7] p-4">
          <div className="shrink-0 mb-4">
            <div className="flex items-center text-sm text-gray-500 mb-2">
              <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/')} data-testid="link-home">Home</span>
              <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
              <span className="text-gray-900 font-medium">Debt Process Engine</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[#C4835E]">
                <Workflow className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-page-title">
                  Debt Process Engine
                  <HelpTip text="Configure debt recovery workflows with ordered stages. Each stage has entry rules, document templates, automated actions, and timers — making the system infinitely configurable without hardcoding flows." />
                </h1>
                <p className="text-sm text-gray-500">Configurable workflow engine for debt recovery processes</p>
              </div>
              <Button size="sm" onClick={openCreateWorkflow} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-create-workflow">
                <Plus className="h-4 w-4 mr-1" /> New Workflow
              </Button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto space-y-4">
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--pos-accent)]" />
                  </div>
                ) : workflows.length === 0 ? (
                  <div className="text-center py-12">
                    <Workflow className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No workflows configured yet</p>
                    <p className="text-xs text-gray-400 mt-1">Create a workflow to define your debt recovery process stages</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#D6D6D6]">
                        <TableHead className="text-xs">Workflow Name</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs text-center">Stages</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                        <TableHead className="text-xs">Last Modified</TableHead>
                        <TableHead className="text-xs text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workflows.map((wf, idx) => (
                        <TableRow key={wf.id} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)] cursor-pointer" onClick={() => openWorkflowDetail(wf)} data-testid={`row-workflow-${idx}`}>
                          <TableCell className="text-sm font-medium text-gray-900">{wf.name}</TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-[250px] truncate">{wf.description || '—'}</TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <ListOrdered className="h-3 w-3" /> {wf.stageCount ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {wf.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <Play className="h-3 w-3" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                <Pause className="h-3 w-3" /> Inactive
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">{formatDate(wf.modifiedAt)}</TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditWorkflow(wf)} title="Edit" data-testid={`button-edit-wf-${idx}`}>
                                <Pencil className="h-3.5 w-3.5 text-gray-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteWorkflow(wf)} title="Delete" data-testid={`button-delete-wf-${idx}`}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showWorkflowDialog} onOpenChange={setShowWorkflowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-medium text-gray-700">Workflow Name</Label>
                <Input value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="e.g. Standard Debt Recovery" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-wf-name" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700">Description</Label>
                <Textarea value={wfDescription} onChange={(e) => setWfDescription(e.target.value)} placeholder="Describe the workflow purpose..." className="bg-[#F7F7F7] border-[#D6D6D6] min-h-[80px]" data-testid="input-wf-description" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={wfActive} onCheckedChange={setWfActive} data-testid="switch-wf-active" />
                <Label className="text-sm text-gray-700">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWorkflowDialog(false)} className="border-[#D6D6D6]">Cancel</Button>
              <Button onClick={handleSaveWorkflow} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-save-workflow">
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} {editingWorkflow ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PosLayout>
    );
  }

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] p-4">
        <div className="shrink-0 mb-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/')} data-testid="link-home">Home</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="cursor-pointer hover:text-gray-700" onClick={() => { setViewMode('list'); setSelectedWorkflow(null); }} data-testid="link-engine">Debt Process Engine</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="text-gray-900 font-medium">{selectedWorkflow?.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[#C4835E]">
              <Workflow className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-workflow-name">
                {selectedWorkflow?.name}
                {selectedWorkflow?.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200"><Play className="h-3 w-3" /> Active</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200"><Pause className="h-3 w-3" /> Inactive</span>
                )}
              </h1>
              <p className="text-sm text-gray-500">{selectedWorkflow?.description || 'No description'}</p>
            </div>
            <Button size="sm" variant="outline" className="border-[#D6D6D6]" onClick={() => selectedWorkflow && loadStages(selectedWorkflow.id)} disabled={loadingStages} data-testid="button-refresh-stages">
              <RefreshCw className={`h-4 w-4 ${loadingStages ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={openCreateStage} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-add-stage">
              <Plus className="h-4 w-4 mr-1" /> Add Stage
            </Button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto space-y-3">
          {loadingStages && stages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--pos-accent)]" />
            </div>
          ) : stages.length === 0 ? (
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="py-12">
                <div className="text-center">
                  <ListOrdered className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No stages defined yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add stages to define the workflow sequence</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            stages.map((stage, idx) => {
              const isExpanded = expandedStage === stage.id;
              return (
                <Card key={stage.id} className={`bg-white border-[#D6D6D6] shadow-sm transition-all ${!stage.isActive ? 'opacity-60' : ''}`} data-testid={`card-stage-${idx}`}>
                  <CardContent className="p-0">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#F7F7F7] transition-colors"
                      onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); moveStage(stage, 'up'); }} disabled={idx === 0} data-testid={`button-move-up-${idx}`}>
                          <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); moveStage(stage, 'down'); }} disabled={idx === stages.length - 1} data-testid={`button-move-down-${idx}`}>
                          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                      </div>

                      <div className="w-10 h-10 rounded-full bg-[var(--pos-accent)] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {stage.stageNumber}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm">{stage.name}</h3>
                          {!stage.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 font-medium">Disabled</span>
                          )}
                        </div>
                        {stage.description && <p className="text-xs text-gray-500 truncate">{stage.description}</p>}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-1 text-xs text-gray-500" title="Rules">
                          <Filter className="h-3.5 w-3.5" /> {stage.rules?.length || 0}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500" title="Templates">
                          <FileText className="h-3.5 w-3.5" /> {stage.templates?.length || 0}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500" title="Actions">
                          <Zap className="h-3.5 w-3.5" /> {stage.actions?.length || 0}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500" title="Timer">
                          <Clock className="h-3.5 w-3.5" /> {stage.timer?.waitDays || 0}d
                        </div>
                      </div>

                      {idx < stages.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 hidden md:block" />
                      )}

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditStage(stage)} title="Edit" data-testid={`button-edit-stage-${idx}`}>
                          <Pencil className="h-3.5 w-3.5 text-gray-600" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteStage(stage)} title="Delete" data-testid={`button-delete-stage-${idx}`}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>

                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#D6D6D6] p-4 bg-[#F7F7F7]">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1"><Filter className="h-3 w-3" /> Rules ({stage.rules?.length || 0})</h4>
                            {renderRuleSummary(stage.rules)}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1"><FileText className="h-3 w-3" /> Templates ({stage.templates?.length || 0})</h4>
                            {(!stage.templates || stage.templates.length === 0) ? (
                              <span className="text-gray-400 text-xs">No templates</span>
                            ) : (
                              <div className="space-y-1">
                                {stage.templates.map((t, i) => (
                                  <div key={i} className="flex items-center gap-1 text-xs">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">{t.channel || 'DOC'}</span>
                                    <span className="text-gray-700 truncate">{t.templateName || t.templateCode}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1"><Zap className="h-3 w-3" /> Actions ({stage.actions?.length || 0})</h4>
                            {(!stage.actions || stage.actions.length === 0) ? (
                              <span className="text-gray-400 text-xs">No actions</span>
                            ) : (
                              <div className="space-y-1">
                                {stage.actions.map((a, i) => (
                                  <div key={i} className="flex items-center gap-1 text-xs">
                                    <span className={`px-1.5 py-0.5 rounded font-medium border ${a.isAutomated ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                      {a.isAutomated ? 'Auto' : 'Manual'}
                                    </span>
                                    <span className="text-gray-700 truncate">{ACTION_TYPES.find(at => at.value === a.actionType)?.label || a.actionType}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Timer</h4>
                            <div className="space-y-1 text-xs text-gray-700">
                              <p><span className="font-medium">Wait:</span> {stage.timer?.waitDays || 0} days</p>
                              <p><span className="font-medium">Business days only:</span> {stage.timer?.businessDaysOnly ? 'Yes' : 'No'}</p>
                              <p><span className="font-medium">Escalate on expiry:</span> {stage.timer?.escalateOnExpiry ? 'Yes' : 'No'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {stages.length > 0 && (
            <Card className="bg-white border-[#D6D6D6] shadow-sm border-dashed">
              <CardContent className="py-4">
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-2 text-gray-400">
                    {stages.map((s, i) => (
                      <React.Fragment key={s.id}>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${s.isActive ? 'bg-[var(--pos-accent)] text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {s.stageNumber}. {s.name}
                        </span>
                        {i < stages.length - 1 && <ArrowRight className="h-4 w-4 text-gray-300" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-[var(--pos-accent)]" />
              {editingStage ? `Edit Stage — ${editingStage.name}` : 'Add Stage'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">Stage Name</Label>
                <Input value={stName} onChange={(e) => setStName(e.target.value)} placeholder="e.g. Section 129 Notice" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-stage-name" />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs font-medium text-gray-700">Description</Label>
                  <Input value={stDescription} onChange={(e) => setStDescription(e.target.value)} placeholder="Brief description..." className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-stage-desc" />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={stActive} onCheckedChange={setStActive} data-testid="switch-stage-active" />
                  <Label className="text-xs text-gray-700">Active</Label>
                </div>
              </div>
            </div>

            <Tabs value={stageTab} onValueChange={setStageTab}>
              <TabsList className="w-full justify-start bg-[#F7F7F7] border border-[#D6D6D6]">
                <TabsTrigger value="rules" className="text-xs gap-1 data-[state=active]:bg-white" data-testid="tab-rules">
                  <Filter className="h-3.5 w-3.5" /> Rules ({stRules.length})
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-xs gap-1 data-[state=active]:bg-white" data-testid="tab-templates">
                  <FileText className="h-3.5 w-3.5" /> Templates ({stTemplates.length})
                </TabsTrigger>
                <TabsTrigger value="actions" className="text-xs gap-1 data-[state=active]:bg-white" data-testid="tab-actions">
                  <Zap className="h-3.5 w-3.5" /> Actions ({stActions.length})
                </TabsTrigger>
                <TabsTrigger value="timer" className="text-xs gap-1 data-[state=active]:bg-white" data-testid="tab-timer">
                  <Clock className="h-3.5 w-3.5" /> Timer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rules" className="mt-3 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">Define conditions that must be met before this stage activates</p>
                  <Button size="sm" variant="outline" className="border-[#D6D6D6] text-xs h-7" onClick={addRule} data-testid="button-add-rule">
                    <Plus className="h-3 w-3 mr-1" /> Add Rule
                  </Button>
                </div>
                {stRules.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No rules — stage will always qualify</p>
                ) : (
                  <div className="space-y-2">
                    {stRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border border-[#D6D6D6] bg-[#F7F7F7]" data-testid={`rule-row-${i}`}>
                        {i > 0 && (
                          <Select value={rule.logicOperator || 'AND'} onValueChange={(v) => updateRule(i, 'logicOperator', v)}>
                            <SelectTrigger className="w-[80px] h-7 text-xs bg-white border-[#D6D6D6]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Select value={rule.field} onValueChange={(v) => updateRule(i, 'field', v)}>
                          <SelectTrigger className="w-[180px] h-7 text-xs bg-white border-[#D6D6D6]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RULE_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={rule.operator} onValueChange={(v) => updateRule(i, 'operator', v)}>
                          <SelectTrigger className="w-[140px] h-7 text-xs bg-white border-[#D6D6D6]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RULE_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          value={rule.value}
                          onChange={(e) => updateRule(i, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 h-7 text-xs bg-white border-[#D6D6D6]"
                        />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeRule(i)} data-testid={`button-remove-rule-${i}`}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="templates" className="mt-3 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">Link document/message templates used in this stage</p>
                  <Button size="sm" variant="outline" className="border-[#D6D6D6] text-xs h-7" onClick={addTemplate} data-testid="button-add-template">
                    <Plus className="h-3 w-3 mr-1" /> Add Template
                  </Button>
                </div>
                {stTemplates.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No templates linked</p>
                ) : (
                  <div className="space-y-2">
                    {stTemplates.map((tpl, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border border-[#D6D6D6] bg-[#F7F7F7]" data-testid={`template-row-${i}`}>
                        <Select value={tpl.channel || 'SMS'} onValueChange={(v) => updateTemplate(i, 'channel', v)}>
                          <SelectTrigger className="w-[110px] h-7 text-xs bg-white border-[#D6D6D6]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CHANNEL_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          value={tpl.templateCode}
                          onChange={(e) => updateTemplate(i, 'templateCode', e.target.value)}
                          placeholder="Template Code"
                          className="w-[150px] h-7 text-xs bg-white border-[#D6D6D6]"
                        />
                        <Input
                          value={tpl.templateName}
                          onChange={(e) => updateTemplate(i, 'templateName', e.target.value)}
                          placeholder="Template Name"
                          className="flex-1 h-7 text-xs bg-white border-[#D6D6D6]"
                        />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeTemplate(i)} data-testid={`button-remove-template-${i}`}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="mt-3 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">Define what happens when this stage executes</p>
                  <Button size="sm" variant="outline" className="border-[#D6D6D6] text-xs h-7" onClick={addAction} data-testid="button-add-action">
                    <Plus className="h-3 w-3 mr-1" /> Add Action
                  </Button>
                </div>
                {stActions.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No actions defined</p>
                ) : (
                  <div className="space-y-2">
                    {stActions.map((act, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border border-[#D6D6D6] bg-[#F7F7F7]" data-testid={`action-row-${i}`}>
                        <Select value={act.actionType} onValueChange={(v) => updateAction(i, 'actionType', v)}>
                          <SelectTrigger className="w-[200px] h-7 text-xs bg-white border-[#D6D6D6]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          value={act.description || ''}
                          onChange={(e) => updateAction(i, 'description', e.target.value)}
                          placeholder="Description (optional)"
                          className="flex-1 h-7 text-xs bg-white border-[#D6D6D6]"
                        />
                        <div className="flex items-center gap-1">
                          <Switch checked={act.isAutomated} onCheckedChange={(v) => updateAction(i, 'isAutomated', v)} />
                          <span className={`text-[10px] font-semibold ${act.isAutomated ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {act.isAutomated ? 'Auto' : 'Manual'}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeAction(i)} data-testid={`button-remove-action-${i}`}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timer" className="mt-3">
                <p className="text-xs text-gray-500 mb-3">Configure how long to wait before progressing to the next stage</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      Wait Period (days)
                      <HelpTip text="Number of days to wait at this stage before the account can progress to the next stage" />
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="365"
                      value={stTimer.waitDays}
                      onChange={(e) => setStTimer({ ...stTimer, waitDays: parseInt(e.target.value) || 0 })}
                      className="bg-[#F7F7F7] border-[#D6D6D6]"
                      data-testid="input-wait-days"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="flex items-center gap-2">
                      <Switch checked={stTimer.businessDaysOnly} onCheckedChange={(v) => setStTimer({ ...stTimer, businessDaysOnly: v })} data-testid="switch-business-days" />
                      <Label className="text-xs text-gray-700 flex items-center gap-1">
                        Business days only
                        <HelpTip text="If enabled, weekends and public holidays are excluded from the wait period calculation" />
                      </Label>
                    </div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="flex items-center gap-2">
                      <Switch checked={stTimer.escalateOnExpiry} onCheckedChange={(v) => setStTimer({ ...stTimer, escalateOnExpiry: v })} data-testid="switch-escalate" />
                      <Label className="text-xs text-gray-700 flex items-center gap-1">
                        Auto-escalate on expiry
                        <HelpTip text="If enabled, the account automatically progresses to the next stage when the timer expires. Otherwise, manual approval is required." />
                      </Label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageDialog(false)} className="border-[#D6D6D6]">Cancel</Button>
            <Button onClick={handleSaveStage} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-save-stage">
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} {editingStage ? 'Update Stage' : 'Add Stage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWorkflowDialog} onOpenChange={setShowWorkflowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium text-gray-700">Workflow Name</Label>
              <Input value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="e.g. Standard Debt Recovery" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-wf-name-detail" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Description</Label>
              <Textarea value={wfDescription} onChange={(e) => setWfDescription(e.target.value)} placeholder="Describe the workflow purpose..." className="bg-[#F7F7F7] border-[#D6D6D6] min-h-[80px]" data-testid="input-wf-description-detail" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={wfActive} onCheckedChange={setWfActive} data-testid="switch-wf-active-detail" />
              <Label className="text-sm text-gray-700">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkflowDialog(false)} className="border-[#D6D6D6]">Cancel</Button>
            <Button onClick={handleSaveWorkflow} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-save-wf-detail">
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} {editingWorkflow ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
