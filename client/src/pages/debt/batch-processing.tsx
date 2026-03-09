import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Cog,
  Loader2,
  ChevronRight as BreadcrumbSep,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Timer,
  ListChecks,
  Zap,
  Users,
} from 'lucide-react';
import {
  fetchBatchJobs,
  fetchBatchSchedules,
  triggerBatchJob,
  cancelBatchJob,
} from '@/lib/external-api';
import { formatDateShort, formatDuration } from '@/services/format.service';
import { BATCH_JOB_TYPE_LABELS, BATCH_STATUS_LABELS } from '@/services/debt-config';

const JOB_TYPE_ICONS: Record<string, React.ReactNode> = {
  TRIAL_RUN: <ListChecks className="h-4 w-4" />,
  FINAL_RUN: <Zap className="h-4 w-4" />,
  LAPSE_CHECK: <Clock className="h-4 w-4" />,
  NOTIFICATION: <AlertTriangle className="h-4 w-4" />,
  ATTORNEY_ALLOCATION: <Users className="h-4 w-4" />,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5" />,
  RUNNING: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-3.5 w-3.5" />,
  FAILED: <XCircle className="h-3.5 w-3.5" />,
  CANCELLED: <Pause className="h-3.5 w-3.5" />,
  SCHEDULED: <Calendar className="h-3.5 w-3.5" />,
};

function StatusBadge({ status }: { status: string }) {
  const cfg = BATCH_STATUS_LABELS[status] || BATCH_STATUS_LABELS.PENDING;
  const icon = STATUS_ICONS[status] || STATUS_ICONS.PENDING;
  return (
    <span data-testid={`badge-status-${status}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cfg.className}`}>
      {icon} {cfg.label}
    </span>
  );
}

function JobTypeBadge({ type }: { type: string }) {
  const cfg = BATCH_JOB_TYPE_LABELS[type] || { label: type, color: 'text-gray-600 bg-gray-50 border-gray-200' };
  const icon = JOB_TYPE_ICONS[type] || <Cog className="h-4 w-4" />;
  return (
    <span data-testid={`badge-type-${type}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cfg.color}`}>
      {icon} {cfg.label}
    </span>
  );
}

export default function BatchProcessing() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [triggeringType, setTriggeringType] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsData, schedulesData] = await Promise.all([
        fetchBatchJobs(),
        fetchBatchSchedules(),
      ]);
      setJobs(Array.isArray(jobsData) ? jobsData : jobsData?.jobs || []);
      setSchedules(Array.isArray(schedulesData) ? schedulesData : schedulesData?.schedules || []);
    } catch (e: any) {
      toast({ title: 'Failed to load batch data', description: e.message || 'Platinum API unavailable', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTrigger = async (jobType: string) => {
    setTriggeringType(jobType);
    try {
      await triggerBatchJob(jobType);
      toast({ title: 'Job Triggered', description: `${BATCH_JOB_TYPE_LABELS[jobType]?.label || jobType} has been queued.` });
      await loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setTriggeringType(null);
    }
  };

  const handleCancel = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      await cancelBatchJob(jobId);
      toast({ title: 'Job Cancelled', description: 'Batch job has been cancelled.' });
      await loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCancellingId(null);
    }
  };

  const filteredJobs = jobs.filter(j => {
    if (filterType !== 'ALL' && j.jobType !== filterType) return false;
    if (filterStatus !== 'ALL' && j.status !== filterStatus) return false;
    return true;
  });

  const activeCount = jobs.filter(j => j.status === 'RUNNING').length;
  const pendingCount = jobs.filter(j => j.status === 'PENDING' || j.status === 'SCHEDULED').length;
  const failedCount = jobs.filter(j => j.status === 'FAILED').length;
  const completedCount = jobs.filter(j => j.status === 'COMPLETED').length;

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] p-4">
        <div className="shrink-0 mb-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/')} data-testid="link-home">Home</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/debt/section129')} data-testid="link-debt">Debt Management</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="text-gray-900 font-medium">Batch Processing</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[#C4835E]">
              <Cog className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-page-title">
                Batch Processing Engine
                <HelpTip text="Schedule and manage batch processing jobs for trial runs, final runs, lapse checks, notifications, and attorney allocation" />
              </h1>
              <p className="text-sm text-gray-500">Manage scheduled batch jobs for debt recovery operations</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Active</p>
                    <p className="text-2xl font-bold text-blue-600" data-testid="text-active-count">{activeCount}</p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg"><Loader2 className="h-5 w-5 text-blue-600 animate-spin" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
                    <p className="text-2xl font-bold text-indigo-600" data-testid="text-pending-count">{pendingCount}</p>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-lg"><Clock className="h-5 w-5 text-indigo-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p>
                    <p className="text-2xl font-bold text-emerald-600" data-testid="text-completed-count">{completedCount}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Failed</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-failed-count">{failedCount}</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg"><XCircle className="h-5 w-5 text-red-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Play className="h-4 w-4 text-[var(--pos-accent)]" />
                  Trigger Job
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(BATCH_JOB_TYPE_LABELS).map(([type, cfg]) => (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]"
                    disabled={triggeringType !== null}
                    onClick={() => handleTrigger(type)}
                    data-testid={`button-trigger-${type}`}
                  >
                    {triggeringType === type ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : (JOB_TYPE_ICONS[type] || <Cog className="h-4 w-4" />)}
                    <span className="ml-1">{cfg.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--pos-accent)]" />
                  Scheduled Jobs
                </h2>
              </div>
              {schedules.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No scheduled jobs configured</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#D6D6D6]">
                      <TableHead className="text-xs">Job Type</TableHead>
                      <TableHead className="text-xs">Schedule</TableHead>
                      <TableHead className="text-xs">Next Run</TableHead>
                      <TableHead className="text-xs">Last Run</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((s: any, i: number) => (
                      <TableRow key={s.id || i} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-schedule-${i}`}>
                        <TableCell><JobTypeBadge type={s.jobType} /></TableCell>
                        <TableCell className="text-sm text-gray-700">{s.cronExpression || s.schedule || '—'}</TableCell>
                        <TableCell className="text-sm text-gray-700">{formatDateShort(s.nextRunAt)}</TableCell>
                        <TableCell className="text-sm text-gray-700">{formatDateShort(s.lastRunAt)}</TableCell>
                        <TableCell><StatusBadge status={s.status || (s.enabled ? 'SCHEDULED' : 'CANCELLED')} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Timer className="h-4 w-4 text-[var(--pos-accent)]" />
                  Job History
                </h2>
                <div className="flex items-center gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 text-xs w-[160px] bg-[#F7F7F7] border-[#D6D6D6]" data-testid="select-filter-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      {Object.entries(BATCH_JOB_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 text-xs w-[140px] bg-[#F7F7F7] border-[#D6D6D6]" data-testid="select-filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      {Object.entries(BATCH_STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[#D6D6D6]"
                    onClick={loadData}
                    disabled={loading}
                    data-testid="button-refresh-jobs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              {loading && jobs.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--pos-accent)]" />
                </div>
              ) : filteredJobs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No batch jobs found</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#D6D6D6]">
                        <TableHead className="text-xs">Job Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Started</TableHead>
                        <TableHead className="text-xs">Duration</TableHead>
                        <TableHead className="text-xs text-right">Processed</TableHead>
                        <TableHead className="text-xs text-right">Succeeded</TableHead>
                        <TableHead className="text-xs text-right">Failed</TableHead>
                        <TableHead className="text-xs">Triggered By</TableHead>
                        <TableHead className="text-xs text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJobs.map((job: any, idx: number) => (
                        <TableRow key={job.id || idx} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-job-${idx}`}>
                          <TableCell><JobTypeBadge type={job.jobType} /></TableCell>
                          <TableCell><StatusBadge status={job.status} /></TableCell>
                          <TableCell className="text-sm text-gray-700">{formatDateShort(job.startedAt)}</TableCell>
                          <TableCell className="text-sm text-gray-700">{formatDuration(job.startedAt, job.completedAt)}</TableCell>
                          <TableCell className="text-sm text-gray-700 text-right font-medium">{job.totalProcessed ?? '—'}</TableCell>
                          <TableCell className="text-sm text-emerald-600 text-right font-medium">{job.totalSucceeded ?? '—'}</TableCell>
                          <TableCell className="text-sm text-red-600 text-right font-medium">{job.totalFailed ?? '—'}</TableCell>
                          <TableCell className="text-sm text-gray-700">{job.triggeredBy || '—'}</TableCell>
                          <TableCell className="text-center">
                            {(job.status === 'RUNNING' || job.status === 'PENDING') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleCancel(job.id)}
                                disabled={cancellingId === job.id}
                                data-testid={`button-cancel-job-${idx}`}
                              >
                                {cancellingId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PosLayout>
  );
}
