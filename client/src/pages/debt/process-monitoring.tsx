import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Activity,
  Loader2,
  ChevronRight as BreadcrumbSep,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Briefcase,
  FileWarning,
  ListChecks,
  ArrowRightLeft,
  Pause,
  Eye,
} from 'lucide-react';
import {
  fetchProcessMonitoringOverview,
  fetchActiveRuns,
  fetchFailedRuns,
  fetchPendingApprovals,
  fetchHandoverQueues,
  fetchTerminationQueues,
} from '@/lib/external-api';
import { formatDateShort, formatCurrency } from '@/services/format.service';
import { PROCESS_STATUS_LABELS } from '@/services/debt-config';
import type { ProcessMonitoringOverview, ProcessRun, ApprovalItem, HandoverQueueItem, TerminationQueueItem } from '@/models/debt.models';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  RUNNING: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-3.5 w-3.5" />,
  FAILED: <XCircle className="h-3.5 w-3.5" />,
  PENDING: <Clock className="h-3.5 w-3.5" />,
  AWAITING_APPROVAL: <AlertTriangle className="h-3.5 w-3.5" />,
  QUEUED: <Clock className="h-3.5 w-3.5" />,
  PROCESSING: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  REJECTED: <XCircle className="h-3.5 w-3.5" />,
  APPROVED: <CheckCircle2 className="h-3.5 w-3.5" />,
  TERMINATED: <Pause className="h-3.5 w-3.5" />,
};

function StatusBadge({ status }: { status: string }) {
  const cfg = PROCESS_STATUS_LABELS[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };
  const icon = STATUS_ICONS[status] || <Clock className="h-3.5 w-3.5" />;
  return (
    <span data-testid={`badge-status-${status}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cfg.className}`}>
      {icon} {cfg.label}
    </span>
  );
}

export default function ProcessMonitoring() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState<ProcessMonitoringOverview | null>(null);
  const [activeRuns, setActiveRuns] = useState<any[]>([]);
  const [failedRuns, setFailedRuns] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [handoverQueues, setHandoverQueues] = useState<any[]>([]);
  const [terminationQueues, setTerminationQueues] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchProcessMonitoringOverview(),
        fetchActiveRuns(),
        fetchFailedRuns(),
        fetchPendingApprovals(),
        fetchHandoverQueues(),
        fetchTerminationQueues(),
      ]);
      const [ovR, arR, frR, paR, hqR, tqR] = results;
      if (ovR.status === 'fulfilled') setOverview(ovR.value);
      if (arR.status === 'fulfilled') { const ar = arR.value; setActiveRuns(Array.isArray(ar) ? ar : ar?.runs || []); }
      if (frR.status === 'fulfilled') { const fr = frR.value; setFailedRuns(Array.isArray(fr) ? fr : fr?.runs || []); }
      if (paR.status === 'fulfilled') { const pa = paR.value; setPendingApprovals(Array.isArray(pa) ? pa : pa?.approvals || []); }
      if (hqR.status === 'fulfilled') { const hq = hqR.value; setHandoverQueues(Array.isArray(hq) ? hq : hq?.queues || []); }
      if (tqR.status === 'fulfilled') { const tq = tqR.value; setTerminationQueues(Array.isArray(tq) ? tq : tq?.queues || []); }
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        toast({ title: 'Partial Load Error', description: `${failed.length} monitoring data source(s) unavailable from Platinum API.`, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Platinum API unavailable', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = [
    { label: 'Active Runs', value: overview?.activeRuns ?? activeRuns.length, icon: <Play className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Failed Runs', value: overview?.failedRuns ?? failedRuns.length, icon: <XCircle className="h-5 w-5 text-red-600" />, bg: 'bg-red-50', color: 'text-red-600' },
    { label: 'Pending Approvals', value: overview?.pendingApprovals ?? pendingApprovals.length, icon: <AlertTriangle className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-50', color: 'text-amber-600' },
    { label: 'Handover Queue', value: overview?.handoverQueue ?? handoverQueues.length, icon: <Briefcase className="h-5 w-5 text-indigo-600" />, bg: 'bg-indigo-50', color: 'text-indigo-600' },
    { label: 'Termination Queue', value: overview?.terminationQueue ?? terminationQueues.length, icon: <FileWarning className="h-5 w-5 text-purple-600" />, bg: 'bg-purple-50', color: 'text-purple-600' },
  ];

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] p-4">
        <div className="shrink-0 mb-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/')} data-testid="link-home">Home</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/debt/section129')} data-testid="link-debt">Debt Management</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="text-gray-900 font-medium">Process Monitoring</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[#C4835E]">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-page-title">
                Process Monitoring
                <HelpTip text="Real-time dashboard showing active batch runs, failed processes, pending approvals, handover queues, and termination queues" />
              </h1>
              <p className="text-sm text-gray-500">Monitor all debt recovery processes in real time</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-[#D6D6D6]"
              onClick={loadData}
              disabled={loading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.map((s, i) => (
              <Card key={i} className="bg-white border-[#D6D6D6] shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color}`} data-testid={`text-stat-${i}`}>{s.value}</p>
                    </div>
                    <div className={`p-2 ${s.bg} rounded-lg`}>{s.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-0">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full justify-start rounded-none border-b border-[#D6D6D6] bg-[#F7F7F7] px-2 pt-2 pb-0 h-auto">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[var(--pos-accent)] rounded-b-none text-xs gap-1" data-testid="tab-overview">
                    <Activity className="h-3.5 w-3.5" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[var(--pos-accent)] rounded-b-none text-xs gap-1" data-testid="tab-active">
                    <Play className="h-3.5 w-3.5" /> Active Runs
                    {activeRuns.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">{activeRuns.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="failed" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[var(--pos-accent)] rounded-b-none text-xs gap-1" data-testid="tab-failed">
                    <XCircle className="h-3.5 w-3.5" /> Failed
                    {failedRuns.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">{failedRuns.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="approvals" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[var(--pos-accent)] rounded-b-none text-xs gap-1" data-testid="tab-approvals">
                    <AlertTriangle className="h-3.5 w-3.5" /> Pending Approvals
                    {pendingApprovals.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">{pendingApprovals.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="handovers" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[var(--pos-accent)] rounded-b-none text-xs gap-1" data-testid="tab-handovers">
                    <Briefcase className="h-3.5 w-3.5" /> Handover Queue
                    {handoverQueues.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">{handoverQueues.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="terminations" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[var(--pos-accent)] rounded-b-none text-xs gap-1" data-testid="tab-terminations">
                    <FileWarning className="h-3.5 w-3.5" /> Termination Queue
                    {terminationQueues.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">{terminationQueues.length}</span>}
                  </TabsTrigger>
                </TabsList>

                <div className="p-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--pos-accent)]" />
                    </div>
                  ) : (
                    <>
                      <TabsContent value="overview" className="mt-0">
                        <OverviewTab
                          activeRuns={activeRuns}
                          failedRuns={failedRuns}
                          pendingApprovals={pendingApprovals}
                          handoverQueues={handoverQueues}
                          terminationQueues={terminationQueues}
                          onTabChange={setTab}
                        />
                      </TabsContent>
                      <TabsContent value="active" className="mt-0">
                        <RunsTable runs={activeRuns} emptyMessage="No active runs" testPrefix="active" />
                      </TabsContent>
                      <TabsContent value="failed" className="mt-0">
                        <RunsTable runs={failedRuns} emptyMessage="No failed runs" testPrefix="failed" />
                      </TabsContent>
                      <TabsContent value="approvals" className="mt-0">
                        <ApprovalsTable approvals={pendingApprovals} />
                      </TabsContent>
                      <TabsContent value="handovers" className="mt-0">
                        <QueueTable items={handoverQueues} emptyMessage="No items in handover queue" testPrefix="handover" />
                      </TabsContent>
                      <TabsContent value="terminations" className="mt-0">
                        <QueueTable items={terminationQueues} emptyMessage="No items in termination queue" testPrefix="termination" />
                      </TabsContent>
                    </>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </PosLayout>
  );
}

function OverviewTab({ activeRuns, failedRuns, pendingApprovals, handoverQueues, terminationQueues, onTabChange }: {
  activeRuns: any[]; failedRuns: any[]; pendingApprovals: any[]; handoverQueues: any[]; terminationQueues: any[]; onTabChange: (t: string) => void;
}) {
  const sections = [
    { title: 'Active Runs', items: activeRuns, tab: 'active', icon: <Play className="h-4 w-4 text-blue-600" />, color: 'border-l-blue-500' },
    { title: 'Failed Runs', items: failedRuns, tab: 'failed', icon: <XCircle className="h-4 w-4 text-red-600" />, color: 'border-l-red-500' },
    { title: 'Pending Approvals', items: pendingApprovals, tab: 'approvals', icon: <AlertTriangle className="h-4 w-4 text-amber-600" />, color: 'border-l-amber-500' },
    { title: 'Handover Queue', items: handoverQueues, tab: 'handovers', icon: <Briefcase className="h-4 w-4 text-indigo-600" />, color: 'border-l-indigo-500' },
    { title: 'Termination Queue', items: terminationQueues, tab: 'terminations', icon: <FileWarning className="h-4 w-4 text-purple-600" />, color: 'border-l-purple-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {sections.map((s) => (
        <div key={s.tab} className={`border border-[#D6D6D6] rounded-lg p-4 border-l-4 ${s.color} bg-white`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {s.icon}
              <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
            </div>
            <span className="text-lg font-bold text-gray-900" data-testid={`text-overview-${s.tab}`}>{s.items.length}</span>
          </div>
          {s.items.length === 0 ? (
            <p className="text-xs text-gray-400">No items</p>
          ) : (
            <div className="space-y-1.5">
              {s.items.slice(0, 3).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate max-w-[60%]">{item.runType || item.jobType || item.accountNo || item.description || `Item ${i + 1}`}</span>
                  <StatusBadge status={item.status} />
                </div>
              ))}
              {s.items.length > 3 && (
                <button
                  className="text-xs text-[var(--pos-accent)] hover:underline flex items-center gap-1 mt-1"
                  onClick={() => onTabChange(s.tab)}
                  data-testid={`button-view-all-${s.tab}`}
                >
                  <Eye className="h-3 w-3" /> View all {s.items.length} items
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RunsTable({ runs, emptyMessage, testPrefix }: { runs: any[]; emptyMessage: string; testPrefix: string }) {
  if (runs.length === 0) return <p className="text-sm text-gray-500 text-center py-8">{emptyMessage}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#D6D6D6]">
          <TableHead className="text-xs">Run Type</TableHead>
          <TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Started</TableHead>
          <TableHead className="text-xs">Completed</TableHead>
          <TableHead className="text-xs text-right">Total</TableHead>
          <TableHead className="text-xs text-right">Processed</TableHead>
          <TableHead className="text-xs text-right">Errors</TableHead>
          <TableHead className="text-xs">Error Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((r: any, i: number) => (
          <TableRow key={r.id || i} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-${testPrefix}-${i}`}>
            <TableCell className="text-sm font-medium text-gray-900">{r.runType || r.jobType || '—'}</TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell className="text-sm text-gray-700">{formatDateShort(r.startedAt)}</TableCell>
            <TableCell className="text-sm text-gray-700">{formatDateShort(r.completedAt)}</TableCell>
            <TableCell className="text-sm text-gray-700 text-right font-medium">{r.totalCount ?? '—'}</TableCell>
            <TableCell className="text-sm text-emerald-600 text-right font-medium">{r.processedCount ?? '—'}</TableCell>
            <TableCell className="text-sm text-red-600 text-right font-medium">{r.errorCount ?? '—'}</TableCell>
            <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">{r.errorMessage || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ApprovalsTable({ approvals }: { approvals: any[] }) {
  if (approvals.length === 0) return <p className="text-sm text-gray-500 text-center py-8">No pending approvals</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#D6D6D6]">
          <TableHead className="text-xs">Type</TableHead>
          <TableHead className="text-xs">Description</TableHead>
          <TableHead className="text-xs">Submitted By</TableHead>
          <TableHead className="text-xs">Submitted At</TableHead>
          <TableHead className="text-xs text-right">Accounts</TableHead>
          <TableHead className="text-xs text-right">Amount</TableHead>
          <TableHead className="text-xs">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {approvals.map((a: any, i: number) => (
          <TableRow key={a.id || i} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-approval-${i}`}>
            <TableCell className="text-sm font-medium text-gray-900">{a.approvalType || a.type || '—'}</TableCell>
            <TableCell className="text-sm text-gray-700 max-w-[200px] truncate">{a.description || '—'}</TableCell>
            <TableCell className="text-sm text-gray-700">{a.submittedBy || '—'}</TableCell>
            <TableCell className="text-sm text-gray-700">{formatDateShort(a.submittedAt)}</TableCell>
            <TableCell className="text-sm text-gray-700 text-right font-medium">{a.accountCount ?? '—'}</TableCell>
            <TableCell className="text-sm text-gray-700 text-right font-medium">{formatCurrency(a.totalAmount)}</TableCell>
            <TableCell><StatusBadge status={a.status || 'AWAITING_APPROVAL'} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function QueueTable({ items, emptyMessage, testPrefix }: { items: any[]; emptyMessage: string; testPrefix: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-500 text-center py-8">{emptyMessage}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#D6D6D6]">
          <TableHead className="text-xs">Account No</TableHead>
          <TableHead className="text-xs">Account Holder</TableHead>
          <TableHead className="text-xs text-right">Outstanding</TableHead>
          <TableHead className="text-xs">Attorney</TableHead>
          <TableHead className="text-xs">Queued At</TableHead>
          <TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item: any, i: number) => (
          <TableRow key={item.id || i} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-${testPrefix}-${i}`}>
            <TableCell className="text-sm font-mono font-medium text-gray-900">{item.accountNo || '—'}</TableCell>
            <TableCell className="text-sm text-gray-700">{item.accountHolder || item.ownerName || '—'}</TableCell>
            <TableCell className="text-sm text-gray-700 text-right font-medium">{formatCurrency(item.outstandingAmount)}</TableCell>
            <TableCell className="text-sm text-gray-700">{item.attorneyName || item.attorney || '—'}</TableCell>
            <TableCell className="text-sm text-gray-700">{formatDateShort(item.queuedAt || item.createdAt)}</TableCell>
            <TableCell><StatusBadge status={item.status || 'QUEUED'} /></TableCell>
            <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">{item.reason || item.terminationReason || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
