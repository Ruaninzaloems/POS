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

const CHANNEL_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  sms: { icon: Phone, label: 'SMS', color: 'text-green-400', bg: 'bg-green-500/20' },
  email: { icon: Mail, label: 'Email', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  letter: { icon: FileText, label: 'Printed Letter', color: 'text-amber-400', bg: 'bg-amber-500/20' },
};

interface Step {
  dayOffset: number;
  channel: string;
  templateName: string;
  templateBody: string;
  subject: string;
  isAutomated: boolean;
}

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
  const [selectedTimeline, setSelectedTimeline] = useState<any>(null);
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
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-700/40">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <button onClick={() => setLocation('/')} className="hover:text-white transition-colors" data-testid="link-home">Home</button>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-white font-medium">Communication Timelines</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <h1 className="text-lg font-semibold">Automated Communication Timelines</h1>
              <HelpTip text="Configure automated escalation timelines for debt recovery. Define when SMS, email, WhatsApp, and printed letter communications are sent, and enroll accounts for automated processing." />
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-create-timeline">
              <Plus className="w-3.5 h-3.5 mr-1" />New Timeline
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showCreate && (
            <Card className="bg-slate-800/40 border-blue-700/40 border-2">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-blue-300">Create New Timeline</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">Name</Label>
                    <Input data-testid="input-timeline-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Standard Debt Recovery" className="bg-slate-900/60 border-slate-600/50 text-white h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Description</Label>
                    <Input data-testid="input-timeline-desc" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description..." className="bg-slate-900/60 border-slate-600/50 text-white h-9" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={creating} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-timeline">
                    {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}Create
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-slate-400">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-slate-800/40 border-slate-700/40 lg:col-span-1">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Timelines</h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : timelines.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">No timelines yet. Create one to get started.</div>
                ) : (
                  <div className="space-y-2">
                    {timelines.map((tl: any) => (
                      <div key={tl.id} className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedTimeline?.id === tl.id ? 'bg-blue-900/30 border-blue-600/50' : 'bg-slate-900/40 border-slate-700/30 hover:bg-slate-800/60'}`} onClick={() => loadTimelineDetail(tl.id)} data-testid={`timeline-card-${tl.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-white">{tl.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${tl.isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); handleDelete(tl.id); }} className="text-red-400 hover:text-red-300 h-6 w-6 p-0"><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        {tl.description && <p className="text-xs text-slate-500 mt-1">{tl.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/40 border-slate-700/40 lg:col-span-2">
              <CardContent className="p-4">
                {!selectedTimeline ? (
                  <div className="flex items-center justify-center h-64 text-slate-500">
                    <div className="text-center">
                      <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Select a timeline to view and edit its escalation steps</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-300">{selectedTimeline.name} — Steps</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={addStep} className="text-blue-400 hover:text-blue-300" data-testid="button-add-step">
                          <Plus className="w-3.5 h-3.5 mr-1" />Add Step
                        </Button>
                        <Button size="sm" onClick={handleSaveSteps} disabled={saving} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-steps">
                          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}Save
                        </Button>
                      </div>
                    </div>

                    <div className="relative">
                      {steps.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">No steps configured. Add steps to define the escalation flow.</div>
                      ) : (
                        <div className="space-y-3">
                          {steps.sort((a, b) => a.dayOffset - b.dayOffset).map((step, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && (
                                <div className="flex items-center justify-center">
                                  <ArrowDown className="w-4 h-4 text-slate-600" />
                                  <span className="text-[10px] text-slate-600 ml-1">+{step.dayOffset - steps[i - 1].dayOffset} days</span>
                                </div>
                              )}
                              <div className="p-3 bg-slate-900/60 rounded-md border border-slate-700/30 space-y-2" data-testid={`step-${i}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">Day {step.dayOffset}</span>
                                    <ChannelBadge channel={step.channel} />
                                    {step.isAutomated && <span className="text-[10px] text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">Auto</span>}
                                    {!step.isAutomated && <span className="text-[10px] text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded">Manual</span>}
                                  </div>
                                  <Button size="sm" variant="ghost" onClick={() => removeStep(i)} className="text-red-400 hover:text-red-300 h-6 w-6 p-0"><X className="w-3.5 h-3.5" /></Button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-[10px] text-slate-500">Day Offset</Label>
                                    <Input type="number" value={step.dayOffset} onChange={e => updateStep(i, 'dayOffset', parseInt(e.target.value) || 0)} className="bg-slate-800/60 border-slate-600/40 text-white h-8 text-xs" />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-slate-500">Channel</Label>
                                    <Select value={step.channel} onValueChange={v => updateStep(i, 'channel', v)}>
                                      <SelectTrigger className="bg-slate-800/60 border-slate-600/40 text-white h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="sms">SMS</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="letter">Printed Letter</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-slate-500">Template Name</Label>
                                    <Input value={step.templateName} onChange={e => updateStep(i, 'templateName', e.target.value)} className="bg-slate-800/60 border-slate-600/40 text-white h-8 text-xs" placeholder="e.g., Initial Reminder" />
                                  </div>
                                </div>
                                {(step.channel === 'email' || step.channel === 'letter') && (
                                  <div>
                                    <Label className="text-[10px] text-slate-500">Subject</Label>
                                    <Input value={step.subject} onChange={e => updateStep(i, 'subject', e.target.value)} className="bg-slate-800/60 border-slate-600/40 text-white h-8 text-xs" placeholder="Email/Letter subject..." />
                                  </div>
                                )}
                                <div>
                                  <Label className="text-[10px] text-slate-500">Message Template</Label>
                                  <textarea value={step.templateBody} onChange={e => updateStep(i, 'templateBody', e.target.value)} className="w-full h-16 bg-slate-800/60 border border-slate-600/40 text-white text-xs rounded-md p-2 resize-none" placeholder="Use {accountNo} as placeholder..." />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch checked={step.isAutomated} onCheckedChange={v => updateStep(i, 'isAutomated', v)} />
                                  <Label className="text-xs text-slate-400">{step.isAutomated ? 'Automated (sent automatically on schedule)' : 'Manual (requires user action)'}</Label>
                                </div>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    <Card className="bg-slate-900/60 border-slate-700/30">
                      <CardContent className="p-3 space-y-2">
                        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2"><Users className="w-3.5 h-3.5" />Enroll Account</h4>
                        <div className="flex gap-2 relative">
                          <div className="flex-1 relative">
                            <Input data-testid="input-enroll-account" value={enrollAccount} onChange={e => handleAccountSearch(e.target.value)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Enter account number..." className="bg-slate-800/60 border-slate-600/40 text-white h-9" />
                            {showSuggestions && accountSuggestions.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg max-h-32 overflow-y-auto">
                                {accountSuggestions.map((s, i) => (
                                  <button key={i} className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white" onClick={() => { setEnrollAccount(s.accountNo); setShowSuggestions(false); }}>{s.accountNo} — {s.name}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button onClick={handleEnroll} disabled={enrolling || !enrollAccount.trim()} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-enroll">
                            {enrolling ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}Enroll
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-500">Enrolling an account schedules all timeline steps automatically from today.</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-blue-900/10 border-blue-700/20">
            <CardContent className="p-3">
              <p className="text-xs text-blue-300/60">
                <strong className="text-blue-300/80">How it works:</strong> Create a timeline with escalation steps (e.g., Day 1 SMS → Day 3 Email → Day 7 WhatsApp → Day 14 Section 129 → Day 30 Handover). Enroll accounts to automatically schedule communications. Use the Communication Dashboard to monitor delivery status across all channels.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PosLayout>
  );
}
