import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Send,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbSep,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Play,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchCommunicationLog,
  fetchScheduledCommunications,
  fetchCommunicationStats,
  processScheduledCommunications,
  dispatchCommunication,
  fetchAccounts,
} from '@/lib/external-api';

type TabMode = 'dashboard' | 'log' | 'scheduled' | 'send';

const CHANNEL_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  sms: { icon: Phone, label: 'SMS', color: 'text-green-400', bg: 'bg-green-500/20' },
  email: { icon: Mail, label: 'Email', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  letter: { icon: FileText, label: 'Letter', color: 'text-amber-400', bg: 'bg-amber-500/20' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  SENT: { color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  DELIVERED: { color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  FAILED: { color: 'text-red-400', bg: 'bg-red-500/20' },
  PENDING: { color: 'text-amber-400', bg: 'bg-amber-500/20' },
  COMPLETED: { color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  SKIPPED: { color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

function ChannelBadge({ channel }: { channel: string }) {
  const cfg = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.sms;
  const Icon = cfg.icon;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}><Icon className="w-3 h-3" />{cfg.label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.color}`}>{status}</span>;
}

export default function CommunicationDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabMode>('dashboard');

  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [logs, setLogs] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logChannel, setLogChannel] = useState('__all__');
  const [logStatus, setLogStatus] = useState('__all__');
  const [logAccount, setLogAccount] = useState('');
  const logPageSize = 10;

  const [scheduled, setScheduled] = useState<any[]>([]);
  const [schedTotal, setSchedTotal] = useState(0);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedPage, setSchedPage] = useState(1);
  const [schedStatus, setSchedStatus] = useState('__all__');
  const [processing, setProcessing] = useState(false);
  const schedPageSize = 10;

  const [sendChannel, setSendChannel] = useState('sms');
  const [sendAccount, setSendAccount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [accountSuggestions, setAccountSuggestions] = useState<{ accountNo: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchCommunicationStats();
      setStats(data);
    } catch (err: any) {
      toast({ title: 'Failed to load stats', description: err.message, variant: 'destructive' });
    } finally { setStatsLoading(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const params: Record<string, string> = { limit: String(logPageSize), offset: String((logPage - 1) * logPageSize) };
      if (logChannel !== '__all__') params.channel = logChannel;
      if (logStatus !== '__all__') params.status = logStatus;
      if (logAccount.trim()) params.accountNo = logAccount.trim();
      const data = await fetchCommunicationLog(params);
      setLogs(data.logs || []);
      setLogTotal(data.total || 0);
    } catch (err: any) {
      toast({ title: 'Failed to load communication log', description: err.message, variant: 'destructive' });
    } finally { setLogLoading(false); }
  }, [logPage, logChannel, logStatus, logAccount]);

  const loadScheduled = useCallback(async () => {
    setSchedLoading(true);
    try {
      const params: Record<string, string> = { limit: String(schedPageSize), offset: String((schedPage - 1) * schedPageSize) };
      if (schedStatus !== '__all__') params.status = schedStatus;
      const data = await fetchScheduledCommunications(params);
      setScheduled(data.scheduled || []);
      setSchedTotal(data.total || 0);
    } catch (err: any) {
      toast({ title: 'Failed to load scheduled', description: err.message, variant: 'destructive' });
    } finally { setSchedLoading(false); }
  }, [schedPage, schedStatus]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const result = await processScheduledCommunications();
      toast({ title: 'Processing Complete', description: `${result.processed} processed: ${result.succeeded} succeeded, ${result.failed} failed` });
      loadScheduled();
      loadStats();
    } catch (err: any) {
      toast({ title: 'Processing Failed', description: err.message, variant: 'destructive' });
    } finally { setProcessing(false); }
  };

  const handleAccountSearch = useCallback(async (query: string) => {
    setSendAccount(query);
    if (query.length >= 3) {
      try {
        const results = await fetchAccounts(query);
        setAccountSuggestions(Array.isArray(results) ? results.slice(0, 8) : []);
        setShowSuggestions(true);
      } catch { setAccountSuggestions([]); }
    } else { setAccountSuggestions([]); setShowSuggestions(false); }
  }, []);

  const handleSend = async () => {
    if (!sendAccount.trim() || !sendRecipient.trim() || !sendMessage.trim()) {
      toast({ title: 'All fields required', variant: 'destructive' }); return;
    }
    setSending(true);
    try {
      await dispatchCommunication({ accountNo: sendAccount.trim(), channel: sendChannel, recipient: sendRecipient.trim(), subject: sendSubject.trim() || undefined, messageBody: sendMessage.trim() });
      toast({ title: 'Communication Sent', description: `${sendChannel.toUpperCase()} dispatched to ${sendRecipient}` });
      setSendRecipient('');
      setSendSubject('');
      setSendMessage('');
    } catch (err: any) {
      toast({ title: 'Send Failed', description: err.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  useEffect(() => { if (tab === 'dashboard') loadStats(); }, [tab, loadStats]);
  useEffect(() => { if (tab === 'log') loadLogs(); }, [tab, loadLogs]);
  useEffect(() => { if (tab === 'scheduled') loadScheduled(); }, [tab, loadScheduled]);

  const logTotalPages = Math.ceil(logTotal / logPageSize);
  const schedTotalPages = Math.ceil(schedTotal / schedPageSize);

  return (
    <PosLayout>
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-700/40">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <button onClick={() => setLocation('/')} className="hover:text-white transition-colors" data-testid="link-home">Home</button>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-white font-medium">Communication Dashboard</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5 text-cyan-400" />
              <h1 className="text-lg font-semibold">Omni-Channel Communication Dashboard</h1>
              <HelpTip text="Monitor delivery status across all communication channels — SMS, Email, WhatsApp, and printed letters. Track scheduled communications and dispatch ad-hoc messages." />
            </div>
            <div className="flex gap-1">
              {(['dashboard', 'log', 'scheduled', 'send'] as TabMode[]).map(t => (
                <Button key={t} size="sm" variant={tab === t ? 'default' : 'ghost'} onClick={() => setTab(t)} className={tab === t ? 'bg-cyan-600 hover:bg-cyan-700' : 'text-slate-400 hover:text-white'} data-testid={`tab-${t}`}>
                  {t === 'dashboard' && <><BarChart3 className="w-3.5 h-3.5 mr-1" />Overview</>}
                  {t === 'log' && <><FileText className="w-3.5 h-3.5 mr-1" />Log</>}
                  {t === 'scheduled' && <><Clock className="w-3.5 h-3.5 mr-1" />Scheduled</>}
                  {t === 'send' && <><Send className="w-3.5 h-3.5 mr-1" />Send</>}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'dashboard' && (
            <>
              {statsLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
              ) : !stats ? (
                <div className="text-center py-12 text-slate-500">No communication data yet.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-slate-800/40 border-slate-700/40"><CardContent className="p-3 flex items-center gap-3"><Send className="w-8 h-8 text-cyan-400" /><div><div className="text-xl font-bold text-white" data-testid="text-total-sent">{stats.totalSent}</div><div className="text-xs text-slate-400">Total Sent</div></div></CardContent></Card>
                    <Card className="bg-emerald-900/20 border-emerald-700/30"><CardContent className="p-3 flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-emerald-400" /><div><div className="text-xl font-bold text-emerald-400" data-testid="text-total-delivered">{stats.totalDelivered}</div><div className="text-xs text-emerald-300">Delivered</div></div></CardContent></Card>
                    <Card className="bg-red-900/20 border-red-700/30"><CardContent className="p-3 flex items-center gap-3"><XCircle className="w-8 h-8 text-red-400" /><div><div className="text-xl font-bold text-red-400" data-testid="text-total-failed">{stats.totalFailed}</div><div className="text-xs text-red-300">Failed</div></div></CardContent></Card>
                    <Card className="bg-amber-900/20 border-amber-700/30"><CardContent className="p-3 flex items-center gap-3"><Clock className="w-8 h-8 text-amber-400" /><div><div className="text-xl font-bold text-amber-400" data-testid="text-total-pending">{stats.totalPending}</div><div className="text-xs text-amber-300">Pending</div></div></CardContent></Card>
                  </div>

                  <Card className="bg-slate-800/40 border-slate-700/40">
                    <CardContent className="p-4">
                      <h3 className="text-sm font-semibold text-slate-300 mb-3">Delivery by Channel</h3>
                      {Object.keys(stats.byChannel || {}).length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-sm">No channel data yet. Send communications to see delivery stats.</div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {Object.entries(stats.byChannel as Record<string, { sent: number; delivered: number; failed: number }>).map(([ch, data]) => {
                            const cfg = CHANNEL_CONFIG[ch] || CHANNEL_CONFIG.sms;
                            const Icon = cfg.icon;
                            const total = data.sent + data.failed;
                            const deliveryRate = total > 0 ? Math.round((data.delivered / total) * 100) : 0;
                            return (
                              <Card key={ch} className="bg-slate-900/60 border-slate-700/30">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                                    <span className="text-sm font-medium text-white">{cfg.label}</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1 text-center">
                                    <div><div className="text-lg font-bold text-white">{data.sent}</div><div className="text-[10px] text-slate-500">Sent</div></div>
                                    <div><div className="text-lg font-bold text-emerald-400">{data.delivered}</div><div className="text-[10px] text-slate-500">Delivered</div></div>
                                    <div><div className="text-lg font-bold text-red-400">{data.failed}</div><div className="text-[10px] text-slate-500">Failed</div></div>
                                  </div>
                                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${deliveryRate}%` }} />
                                  </div>
                                  <div className="text-[10px] text-slate-500 text-center">{deliveryRate}% delivery rate</div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {tab === 'log' && (
            <Card className="bg-slate-800/40 border-slate-700/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-300">Communication Log</h3>
                  <div className="flex gap-2">
                    <Input value={logAccount} onChange={e => { setLogAccount(e.target.value); setLogPage(1); }} placeholder="Account..." className="w-32 bg-slate-900/60 border-slate-600/50 text-white h-8 text-xs" data-testid="input-log-account" />
                    <Select value={logChannel} onValueChange={v => { setLogChannel(v); setLogPage(1); }}>
                      <SelectTrigger className="w-28 bg-slate-900/60 border-slate-600/50 text-white h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Channels</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="letter">Letter</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={logStatus} onValueChange={v => { setLogStatus(v); setLogPage(1); }}>
                      <SelectTrigger className="w-24 bg-slate-900/60 border-slate-600/50 text-white h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Status</SelectItem>
                        <SelectItem value="SENT">Sent</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {logLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">No communication records found.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700/40 hover:bg-transparent">
                            <TableHead className="text-slate-400 text-xs">Account</TableHead>
                            <TableHead className="text-slate-400 text-xs">Channel</TableHead>
                            <TableHead className="text-slate-400 text-xs">Recipient</TableHead>
                            <TableHead className="text-slate-400 text-xs">Status</TableHead>
                            <TableHead className="text-slate-400 text-xs">Delivery</TableHead>
                            <TableHead className="text-slate-400 text-xs">Sent By</TableHead>
                            <TableHead className="text-slate-400 text-xs">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log: any, i: number) => (
                            <TableRow key={i} className="border-slate-700/40 hover:bg-slate-800/60" data-testid={`row-log-${i}`}>
                              <TableCell className="text-white text-sm font-mono">{log.accountNo || log.account_no}</TableCell>
                              <TableCell><ChannelBadge channel={log.channel} /></TableCell>
                              <TableCell className="text-slate-300 text-sm">{log.recipient || '-'}</TableCell>
                              <TableCell><StatusBadge status={log.status} /></TableCell>
                              <TableCell><StatusBadge status={log.deliveryStatus || log.delivery_status || 'PENDING'} /></TableCell>
                              <TableCell className="text-slate-400 text-sm">{log.sentBy || log.sent_by || '-'}</TableCell>
                              <TableCell className="text-slate-400 text-sm">{log.sentAt || log.sent_at ? new Date(log.sentAt || log.sent_at).toLocaleString() : '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                      <span>{logTotal} total records</span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage <= 1} className="text-slate-400 h-7"><ChevronLeft className="w-3.5 h-3.5" /></Button>
                        <span>Page {logPage} of {logTotalPages || 1}</span>
                        <Button size="sm" variant="ghost" onClick={() => setLogPage(p => Math.min(logTotalPages, p + 1))} disabled={logPage >= logTotalPages} className="text-slate-400 h-7"><ChevronRight className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'scheduled' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Select value={schedStatus} onValueChange={v => { setSchedStatus(v); setSchedPage(1); }}>
                    <SelectTrigger className="w-32 bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-sched-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleProcess} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-process">
                  {processing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}Process Due Communications
                </Button>
              </div>
              <Card className="bg-slate-800/40 border-slate-700/40">
                <CardContent className="p-4">
                  {schedLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                  ) : scheduled.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">No scheduled communications found. Enroll accounts in a timeline to schedule automated messages.</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-700/40 hover:bg-transparent">
                              <TableHead className="text-slate-400 text-xs">Account</TableHead>
                              <TableHead className="text-slate-400 text-xs">Scheduled Date</TableHead>
                              <TableHead className="text-slate-400 text-xs">Status</TableHead>
                              <TableHead className="text-slate-400 text-xs">Processed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {scheduled.map((s: any, i: number) => (
                              <TableRow key={i} className="border-slate-700/40 hover:bg-slate-800/60" data-testid={`row-sched-${i}`}>
                                <TableCell className="text-white text-sm font-mono">{s.accountNo || s.account_no}</TableCell>
                                <TableCell className="text-slate-300 text-sm">{s.scheduledDate || s.scheduled_date ? new Date(s.scheduledDate || s.scheduled_date).toLocaleString() : '-'}</TableCell>
                                <TableCell><StatusBadge status={s.status} /></TableCell>
                                <TableCell className="text-slate-400 text-sm">{s.processedAt || s.processed_at ? new Date(s.processedAt || s.processed_at).toLocaleString() : '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                        <span>{schedTotal} total</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setSchedPage(p => Math.max(1, p - 1))} disabled={schedPage <= 1} className="text-slate-400 h-7"><ChevronLeft className="w-3.5 h-3.5" /></Button>
                          <span>Page {schedPage} of {schedTotalPages || 1}</span>
                          <Button size="sm" variant="ghost" onClick={() => setSchedPage(p => Math.min(schedTotalPages, p + 1))} disabled={schedPage >= schedTotalPages} className="text-slate-400 h-7"><ChevronRight className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'send' && (
            <Card className="bg-slate-800/40 border-slate-700/40">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2"><Send className="w-4 h-4" />Send Ad-Hoc Communication</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <Label className="text-xs text-slate-400">Account Number</Label>
                    <Input data-testid="input-send-account" value={sendAccount} onChange={e => handleAccountSearch(e.target.value)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Search account..." className="bg-slate-900/60 border-slate-600/50 text-white h-9" />
                    {showSuggestions && accountSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg max-h-32 overflow-y-auto">
                        {accountSuggestions.map((s, i) => (
                          <button key={i} className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white" onClick={() => { setSendAccount(s.accountNo); setShowSuggestions(false); }}>{s.accountNo} — {s.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Channel</Label>
                    <Select value={sendChannel} onValueChange={setSendChannel}>
                      <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-send-channel"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="letter">Printed Letter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Recipient ({sendChannel === 'email' ? 'Email Address' : sendChannel === 'letter' ? 'Postal Address' : 'Mobile Number'})</Label>
                    <Input data-testid="input-send-recipient" value={sendRecipient} onChange={e => setSendRecipient(e.target.value)} placeholder={sendChannel === 'email' ? 'user@example.com' : sendChannel === 'letter' ? 'Postal address...' : '0821234567'} className="bg-slate-900/60 border-slate-600/50 text-white h-9" />
                  </div>
                  {(sendChannel === 'email' || sendChannel === 'letter') && (
                    <div>
                      <Label className="text-xs text-slate-400">Subject</Label>
                      <Input data-testid="input-send-subject" value={sendSubject} onChange={e => setSendSubject(e.target.value)} placeholder="Subject line..." className="bg-slate-900/60 border-slate-600/50 text-white h-9" />
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Message</Label>
                  <textarea data-testid="textarea-send-message" value={sendMessage} onChange={e => setSendMessage(e.target.value)} className="w-full h-28 bg-slate-900/60 border border-slate-600/50 text-white text-sm rounded-md p-2 resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent" placeholder="Enter your message..." />
                </div>
                <Button onClick={handleSend} disabled={sending} className="bg-cyan-600 hover:bg-cyan-700" data-testid="button-send">
                  {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Send {CHANNEL_CONFIG[sendChannel]?.label || 'Message'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PosLayout>
  );
}
