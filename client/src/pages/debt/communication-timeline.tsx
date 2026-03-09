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
  Clock,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ChevronRight as BreadcrumbSep,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  ArrowDown,
  Users,
  Play,
} from 'lucide-react';
import {
  fetchCommunicationTimelines,
  fetchCommunicationTimeline,
  createCommunicationTimeline,
  updateCommunicationTimeline,
  deleteCommunicationTimeline,
  setTimelineSteps,
  enrollInTimeline,
  fetchAccounts,
} from '@/lib/external-api';
import { CHANNEL_CONFIG as SHARED_CHANNEL_CONFIG } from '@/services/debt-config';
import type { CommunicationStep, CommunicationTimeline as CommunicationTimelineType } from '@/models/debt.models';

type Step = CommunicationStep;

const CHANNEL_ICONS: Record<string, any> = {
  sms: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  letter: FileText,
};

const CHANNEL_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = Object.fromEntries(
  Object.entries(SHARED_CHANNEL_CONFIG).map(([key, cfg]) => [
    key,
    { ...cfg, label: key === 'letter' ? 'Printed Letter' : cfg.label, icon: CHANNEL_ICONS[key] || Phone },
  ])
);

function ChannelBadge({ channel }: { channel: string }) {
  const cfg = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.sms;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

export default function CommunicationTimeline() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [timelines, setTimelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState<CommunicationTimeline | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [saving, setSaving] = useState(false);

  const [enrollAccount, setEnrollAccount] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [accountSuggestions, setAccountSuggestions] = useState<{ accountNo: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadTimelines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCommunicationTimelines();
      setTimelines(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Failed to load timelines', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, []);

  const loadTimelineDetail = useCallback(async (id: number) => {
    try {
      const data = await fetchCommunicationTimeline(id);
      setSelectedTimeline(data.timeline);
      setSteps((data.steps || []).map((s: any) => ({
        dayOffset: s.dayOffset ?? s.day_offset ?? 0,
        channel: s.channel || 'sms',
        templateName: s.templateName ?? s.template_name ?? '',
        templateBody: s.templateBody ?? s.template_body ?? '',
        subject: s.subject || '',
        isAutomated: s.isAutomated ?? s.is_automated ?? true,
      })));
    } catch (err: any) {
      toast({ title: 'Failed to load timeline', description: err.message, variant: 'destructive' });
    }
  }, []);

  useEffect(() => { loadTimelines(); }, [loadTimelines]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const tl = await createCommunicationTimeline({ name: newName.trim(), description: newDesc.trim() || null, isActive: true });
      toast({ title: 'Timeline Created' });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      loadTimelines();
      loadTimelineDetail(tl.id);
    } catch (err: any) {
      toast({ title: 'Create Failed', description: err.message, variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this timeline and all its steps?')) return;
    try {
      await deleteCommunicationTimeline(id);
      toast({ title: 'Timeline Deleted' });
      if (selectedTimeline?.id === id) { setSelectedTimeline(null); setSteps([]); }
      loadTimelines();
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' });
    }
  };

  const addStep = () => {
    setSteps(prev => [...prev, { dayOffset: (prev.length > 0 ? Math.max(...prev.map(s => s.dayOffset)) + 7 : 1), channel: 'sms', templateName: '', templateBody: '', subject: '', isAutomated: true }]);
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof Step, value: any) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleSaveSteps = async () => {
    if (!selectedTimeline) return;
    setSaving(true);
    try {
      await setTimelineSteps(selectedTimeline.id, steps.map(s => ({
        timelineId: selectedTimeline.id,
        dayOffset: s.dayOffset,
        channel: s.channel,
        templateName: s.templateName || null,
        templateBody: s.templateBody || null,
        subject: s.subject || null,
        isAutomated: s.isAutomated,
      })));
      toast({ title: 'Timeline Steps Saved' });
      loadTimelineDetail(selectedTimeline.id);
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleAccountSearch = useCallback(async (query: string) => {
    setEnrollAccount(query);
    if (query.length >= 3) {
      try {
        const results = await fetchAccounts(query);
        setAccountSuggestions(Array.isArray(results) ? results.slice(0, 8) : []);
        setShowSuggestions(true);
      } catch { setAccountSuggestions([]); }
    } else { setAccountSuggestions([]); setShowSuggestions(false); }
  }, []);

  const handleEnroll = async () => {
    if (!enrollAccount.trim() || !selectedTimeline) return;
    setEnrolling(true);
    try {
      const result = await enrollInTimeline(enrollAccount.trim(), selectedTimeline.id);
      toast({ title: 'Account Enrolled', description: `${result.scheduledCount} communications scheduled` });
      setEnrollAccount('');
    } catch (err: any) {
      toast({ title: 'Enroll Failed', description: err.message, variant: 'destructive' });
    } finally { setEnrolling(false); }
  };

  return (
    <PosLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-[#D6D6D6] bg-white">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <button onClick={() => setLocation('/')} className="hover:text-foreground transition-colors" data-testid="link-home">Home</button>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-foreground font-medium">Communication Timelines</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)] flex items-center justify-center">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">Automated Communication Timelines</h1>
              <HelpTip text="Configure automated escalation timelines for debt recovery. Define when SMS, email, WhatsApp, and printed letter communications are sent, and enroll accounts for automated processing." />
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-create-timeline">
              <Plus className="w-3.5 h-3.5 mr-1" />New Timeline
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F2F4F7] min-h-0">
          <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          {showCreate && (
            <Card className="bg-white border-[var(--pos-accent)] border-2 shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Create New Timeline</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input data-testid="input-timeline-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Standard Debt Recovery" className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input data-testid="input-timeline-desc" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description..." className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={creating} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-save-timeline">
                    {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}Create
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-muted-foreground">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl lg:col-span-1">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Timelines</h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : timelines.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No timelines yet. Create one to get started.</div>
                ) : (
                  <div className="space-y-2">
                    {timelines.map((tl: any) => (
                      <div key={tl.id} className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedTimeline?.id === tl.id ? 'bg-blue-50 border-blue-300' : 'bg-[#F7F7F7] border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]'}`} onClick={() => loadTimelineDetail(tl.id)} data-testid={`timeline-card-${tl.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-foreground">{tl.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${tl.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); handleDelete(tl.id); }} className="text-red-500 hover:text-red-700 h-6 w-6 p-0"><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        {tl.description && <p className="text-xs text-muted-foreground mt-1">{tl.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl lg:col-span-2">
              <CardContent className="p-4">
                {!selectedTimeline ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Select a timeline to view and edit its escalation steps</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">{selectedTimeline.name} — Steps</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={addStep} className="text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)]" data-testid="button-add-step">
                          <Plus className="w-3.5 h-3.5 mr-1" />Add Step
                        </Button>
                        <Button size="sm" onClick={handleSaveSteps} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-save-steps">
                          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}Save
                        </Button>
                      </div>
                    </div>

                    <div className="relative">
                      {steps.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">No steps configured. Add steps to define the escalation flow.</div>
                      ) : (
                        <div className="space-y-3">
                          {steps.sort((a, b) => a.dayOffset - b.dayOffset).map((step, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && (
                                <div className="flex items-center justify-center">
                                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground ml-1">+{step.dayOffset - steps[i - 1].dayOffset} days</span>
                                </div>
                              )}
                              <div className="p-3 bg-[#F7F7F7] rounded-md border border-[#D6D6D6] space-y-2" data-testid={`step-${i}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Day {step.dayOffset}</span>
                                    <ChannelBadge channel={step.channel} />
                                    {step.isAutomated && <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Auto</span>}
                                    {!step.isAutomated && <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Manual</span>}
                                  </div>
                                  <Button size="sm" variant="ghost" onClick={() => removeStep(i)} className="text-red-500 hover:text-red-700 h-6 w-6 p-0"><X className="w-3.5 h-3.5" /></Button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Day Offset</Label>
                                    <Input type="number" value={step.dayOffset} onChange={e => updateStep(i, 'dayOffset', parseInt(e.target.value) || 0)} className="bg-white border-[#D6D6D6] h-8 text-xs" />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Channel</Label>
                                    <Select value={step.channel} onValueChange={v => updateStep(i, 'channel', v)}>
                                      <SelectTrigger className="bg-white border-[#D6D6D6] h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="sms">SMS</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="letter">Printed Letter</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Template Name</Label>
                                    <Input value={step.templateName} onChange={e => updateStep(i, 'templateName', e.target.value)} className="bg-white border-[#D6D6D6] h-8 text-xs" placeholder="e.g., Initial Reminder" />
                                  </div>
                                </div>
                                {(step.channel === 'email' || step.channel === 'letter') && (
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Subject</Label>
                                    <Input value={step.subject} onChange={e => updateStep(i, 'subject', e.target.value)} className="bg-white border-[#D6D6D6] h-8 text-xs" placeholder="Email/Letter subject..." />
                                  </div>
                                )}
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Message Template</Label>
                                  <textarea value={step.templateBody} onChange={e => updateStep(i, 'templateBody', e.target.value)} className="w-full h-16 bg-white border border-[#D6D6D6] text-foreground text-xs rounded-md p-2 resize-none" placeholder="Use {accountNo} as placeholder..." />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch checked={step.isAutomated} onCheckedChange={v => updateStep(i, 'isAutomated', v)} />
                                  <Label className="text-xs text-muted-foreground">{step.isAutomated ? 'Automated (sent automatically on schedule)' : 'Manual (requires user action)'}</Label>
                                </div>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    <Card className="bg-[#F7F7F7] border-[#D6D6D6] rounded-xl">
                      <CardContent className="p-3 space-y-2">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-2"><Users className="w-3.5 h-3.5" />Enroll Account</h4>
                        <div className="flex gap-2 relative">
                          <div className="flex-1 relative">
                            <Input data-testid="input-enroll-account" value={enrollAccount} onChange={e => handleAccountSearch(e.target.value)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Enter account number..." className="bg-white border-[#D6D6D6] h-9" />
                            {showSuggestions && accountSuggestions.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-[#D6D6D6] rounded-md shadow-lg max-h-32 overflow-y-auto">
                                {accountSuggestions.map((s, i) => (
                                  <button key={i} className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-[var(--pos-accent-hover-row)]" onClick={() => { setEnrollAccount(s.accountNo); setShowSuggestions(false); }}>{s.accountNo} — {s.name}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button onClick={handleEnroll} disabled={enrolling || !enrollAccount.trim()} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-enroll">
                            {enrolling ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}Enroll
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Enrolling an account schedules all timeline steps automatically from today.</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-blue-50 border-blue-200 rounded-xl">
            <CardContent className="p-3">
              <p className="text-xs text-blue-700">
                <strong className="text-blue-800">How it works:</strong> Create a timeline with escalation steps (e.g., Day 1 SMS → Day 3 Email → Day 7 WhatsApp → Day 14 Section 129 → Day 30 Handover). Enroll accounts to automatically schedule communications. Use the Communication Dashboard to monitor delivery status across all channels.
              </p>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </PosLayout>
  );
}
