import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  BarChart3,
  Loader2,
  ChevronRight as BreadcrumbSep,
  DollarSign,
  TrendingUp,
  Scale,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Briefcase,
} from 'lucide-react';
import {
  fetchDebtOverview,
  fetchAgingAnalysis,
  fetchRecoveryStats,
  fetchLegalPipeline,
  fetchAttorneyPerformance,
  fetchRiskDistribution,
} from '@/lib/external-api';

const RISK_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  LOW: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', bar: 'bg-emerald-500' },
  MEDIUM: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', bar: 'bg-amber-500' },
  HIGH: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', bar: 'bg-red-500' },
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${value.toFixed(2)}`;
}

function RiskBadge({ category }: { category: string }) {
  const c = RISK_COLORS[category as keyof typeof RISK_COLORS] || RISK_COLORS.MEDIUM;
  return (
    <span data-testid={`badge-risk-${category}`} className={`px-2 py-0.5 rounded text-xs font-semibold ${c.bg} ${c.text} ${c.border} border`}>
      {category}
    </span>
  );
}

export default function ExecutiveDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<any>(null);
  const [aging, setAging] = useState<any>(null);
  const [recovery, setRecovery] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any>(null);
  const [attorneys, setAttorneys] = useState<any>(null);
  const [risk, setRisk] = useState<any>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ag, rc, pl, at, ri] = await Promise.all([
        fetchDebtOverview().catch(() => null),
        fetchAgingAnalysis().catch(() => null),
        fetchRecoveryStats().catch(() => null),
        fetchLegalPipeline().catch(() => null),
        fetchAttorneyPerformance().catch(() => null),
        fetchRiskDistribution().catch(() => null),
      ]);
      setOverview(ov);
      setAging(ag);
      setRecovery(rc);
      setPipeline(pl);
      setAttorneys(at);
      setRisk(ri);
    } catch (err: any) {
      toast({ title: 'Failed to load dashboard', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalDebt = aging
    ? (aging.agingAmounts?.current || 0) + (aging.agingAmounts?.days30 || 0) + (aging.agingAmounts?.days60 || 0) + (aging.agingAmounts?.days90 || 0) + (aging.agingAmounts?.days120plus || 0)
    : 0;

  const totalComms = recovery?.totalCommunications || 0;
  const deliveredAll = recovery?.allTime
    ? Object.values(recovery.allTime as Record<string, { sent: number; delivered: number; failed: number }>).reduce((s, ch) => s + ch.delivered, 0)
    : 0;
  const sentAll = recovery?.allTime
    ? Object.values(recovery.allTime as Record<string, { sent: number; delivered: number; failed: number }>).reduce((s, ch) => s + ch.sent, 0)
    : 0;
  const overallRecoveryRate = sentAll > 0 ? Math.round((deliveredAll / sentAll) * 100) : 0;

  const totalLegal = pipeline?.totalLegalActions || 0;
  const totalScored = risk?.totalScored || 0;

  const agingBuckets = aging?.agingBuckets || { current: 0, days30: 0, days60: 0, days90: 0, days120plus: 0 };
  const agingAmounts = aging?.agingAmounts || { current: 0, days30: 0, days60: 0, days90: 0, days120plus: 0 };
  const maxAgingAmount = Math.max(agingAmounts.current, agingAmounts.days30, agingAmounts.days60, agingAmounts.days90, agingAmounts.days120plus, 1);

  const pipelineStages = pipeline?.pipeline || {};
  const pipelineEntries = [
    { label: 'Section 129 Notices', value: pipelineStages['Section 129 Notices'] || 0, color: 'bg-blue-500' },
    { label: 'Handover Initiated', value: pipelineStages['Handover Initiated'] || 0, color: 'bg-amber-500' },
    { label: 'In Collection', value: pipelineStages['In Collection'] || 0, color: 'bg-orange-500' },
    { label: 'Recovered', value: pipelineStages['Recovered'] || 0, color: 'bg-emerald-500' },
  ];
  const maxPipeline = Math.max(...pipelineEntries.map(p => p.value), 1);

  const attorneyList = attorneys?.attorneys || [];
  const riskDist = risk?.distribution || {};

  const recoveryByPeriod = recovery ? [
    { label: 'Last 30 Days', data: recovery.last30Days || {} },
    { label: 'Last 60 Days', data: recovery.last60Days || {} },
    { label: 'Last 90 Days', data: recovery.last90Days || {} },
  ] : [];

  return (
    <PosLayout>
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-700/40">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <button onClick={() => setLocation('/')} className="hover:text-white transition-colors" data-testid="link-home">Home</button>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-white font-medium">Executive Debt Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            <h1 className="text-lg font-semibold">Executive Debt Dashboard</h1>
            <HelpTip text="High-level overview of municipal debt, aging trends, recovery rates, legal pipeline, attorney performance, and risk distribution." />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <span className="ml-3 text-slate-400">Loading dashboard data...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-3 flex items-center gap-3">
                    <DollarSign className="w-8 h-8 text-violet-400" />
                    <div>
                      <div className="text-xl font-bold text-white" data-testid="text-total-debt">{formatCurrency(totalDebt)}</div>
                      <div className="text-xs text-slate-400">Total Debt</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-900/20 border-emerald-700/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-emerald-400" />
                    <div>
                      <div className="text-xl font-bold text-emerald-400" data-testid="text-recovery-rate">{overallRecoveryRate}%</div>
                      <div className="text-xs text-emerald-300">Recovery Rate</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-blue-900/20 border-blue-700/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Scale className="w-8 h-8 text-blue-400" />
                    <div>
                      <div className="text-xl font-bold text-blue-400" data-testid="text-legal-count">{totalLegal}</div>
                      <div className="text-xs text-blue-300">Accounts in Legal</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-900/20 border-amber-700/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Users className="w-8 h-8 text-amber-400" />
                    <div>
                      <div className="text-xl font-bold text-amber-400" data-testid="text-scored-count">{totalScored}</div>
                      <div className="text-xs text-amber-300">Scored Accounts</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-violet-400" />
                      Debt Aging Breakdown
                    </h3>
                    {aging && aging.totalAccounts > 0 ? (
                      <div className="space-y-3">
                        {[
                          { label: 'Current', count: agingBuckets.current, amount: agingAmounts.current, color: 'bg-emerald-500' },
                          { label: '30 Days', count: agingBuckets.days30, amount: agingAmounts.days30, color: 'bg-blue-500' },
                          { label: '60 Days', count: agingBuckets.days60, amount: agingAmounts.days60, color: 'bg-amber-500' },
                          { label: '90 Days', count: agingBuckets.days90, amount: agingAmounts.days90, color: 'bg-orange-500' },
                          { label: '120+ Days', count: agingBuckets.days120plus, amount: agingAmounts.days120plus, color: 'bg-red-500' },
                        ].map((bucket) => (
                          <div key={bucket.label} data-testid={`aging-bucket-${bucket.label.replace(/\s+/g, '-').toLowerCase()}`}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">{bucket.label} <span className="text-slate-500">({bucket.count} accounts)</span></span>
                              <span className="text-white font-medium">{formatCurrency(bucket.amount)}</span>
                            </div>
                            <div className="h-4 bg-slate-700/50 rounded-full overflow-hidden">
                              <div className={`h-full ${bucket.color} rounded-full transition-all`} style={{ width: `${(bucket.amount / maxAgingAmount) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                        <div className="text-xs text-slate-500 text-right mt-1">{aging.totalAccounts} total accounts</div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 text-sm">No aging data available. Score accounts to populate aging analysis.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Recovery Rate Trend
                    </h3>
                    {recoveryByPeriod.length > 0 && totalComms > 0 ? (
                      <div className="space-y-4">
                        {recoveryByPeriod.map((period) => {
                          const channels = period.data as Record<string, { sent: number; delivered: number; failed: number }>;
                          const periodSent = Object.values(channels).reduce((s, ch) => s + ch.sent, 0);
                          const periodDelivered = Object.values(channels).reduce((s, ch) => s + ch.delivered, 0);
                          const rate = periodSent > 0 ? Math.round((periodDelivered / periodSent) * 100) : 0;
                          return (
                            <div key={period.label} data-testid={`recovery-period-${period.label.replace(/\s+/g, '-').toLowerCase()}`}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">{period.label}</span>
                                <span className={`font-medium ${rate >= 70 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{rate}%</span>
                              </div>
                              <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{periodSent} sent / {periodDelivered} delivered</div>
                            </div>
                          );
                        })}
                        <div className="border-t border-slate-700/40 pt-2 flex justify-between text-xs">
                          <span className="text-slate-400">All Time</span>
                          <span className="text-white font-medium">{totalComms} communications total</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 text-sm">No recovery data available. Send communications to track recovery rates.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-blue-400" />
                      Legal Pipeline
                    </h3>
                    {totalLegal > 0 ? (
                      <div className="space-y-3">
                        {pipelineEntries.map((stage, idx) => (
                          <div key={stage.label} data-testid={`pipeline-stage-${idx}`}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">{stage.label}</span>
                              <span className="text-white font-medium">{stage.value}</span>
                            </div>
                            <div className="h-6 bg-slate-700/50 rounded overflow-hidden relative">
                              <div className={`h-full ${stage.color} rounded transition-all flex items-center justify-end pr-2`} style={{ width: `${Math.max((stage.value / maxPipeline) * 100, stage.value > 0 ? 10 : 0)}%` }}>
                                {stage.value > 0 && <span className="text-[10px] text-white font-medium">{stage.value}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                          <span>Flow: Section 129 → Handover → Collection → Recovery</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 text-sm">No legal actions recorded yet.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Risk Distribution
                    </h3>
                    {totalScored > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-6 bg-slate-700/50 rounded-full overflow-hidden flex">
                            {['LOW', 'MEDIUM', 'HIGH'].map((cat) => {
                              const catData = riskDist[cat];
                              const pct = catData ? (catData.count / totalScored) * 100 : 0;
                              const colors: Record<string, string> = { LOW: 'bg-emerald-500', MEDIUM: 'bg-amber-500', HIGH: 'bg-red-500' };
                              return pct > 0 ? (
                                <div key={cat} className={`h-full ${colors[cat]} flex items-center justify-center transition-all`} style={{ width: `${pct}%` }} data-testid={`risk-segment-${cat.toLowerCase()}`}>
                                  {pct >= 10 && <span className="text-[10px] text-white font-medium">{Math.round(pct)}%</span>}
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: 'LOW', icon: CheckCircle2, label: 'Low Risk', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-900/20', borderClass: 'border-emerald-700/30' },
                            { key: 'MEDIUM', icon: AlertTriangle, label: 'Medium Risk', colorClass: 'text-amber-400', bgClass: 'bg-amber-900/20', borderClass: 'border-amber-700/30' },
                            { key: 'HIGH', icon: XCircle, label: 'High Risk', colorClass: 'text-red-400', bgClass: 'bg-red-900/20', borderClass: 'border-red-700/30' },
                          ].map(({ key, icon: Icon, label, colorClass, bgClass, borderClass }) => {
                            const d = riskDist[key] || { count: 0, avgScore: 0 };
                            return (
                              <Card key={key} className={`${bgClass} ${borderClass}`}>
                                <CardContent className="p-2 text-center">
                                  <Icon className={`w-5 h-5 mx-auto mb-1 ${colorClass}`} />
                                  <div className={`text-lg font-bold ${colorClass}`} data-testid={`text-risk-${key.toLowerCase()}-count`}>{d.count}</div>
                                  <div className="text-[10px] text-slate-400">{label}</div>
                                  <div className="text-[10px] text-slate-500">Avg: {d.avgScore}</div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 text-sm">No scored accounts. Use Risk Scoring to score accounts.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-slate-800/40 border-slate-700/40">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-cyan-400" />
                    Attorney Performance
                  </h3>
                  {attorneyList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700/40 hover:bg-transparent">
                            <TableHead className="text-slate-400 text-xs">Attorney</TableHead>
                            <TableHead className="text-slate-400 text-xs text-right">Accounts</TableHead>
                            <TableHead className="text-slate-400 text-xs text-right">Total Debt</TableHead>
                            <TableHead className="text-slate-400 text-xs text-right">Recovered</TableHead>
                            <TableHead className="text-slate-400 text-xs text-right">Rate</TableHead>
                            <TableHead className="text-slate-400 text-xs text-right">Active</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attorneyList.map((att: any, i: number) => (
                            <TableRow key={i} className="border-slate-700/40 hover:bg-slate-800/60" data-testid={`row-attorney-${i}`}>
                              <TableCell className="text-white text-sm font-medium">{att.name}</TableCell>
                              <TableCell className="text-slate-300 text-sm text-right">{att.totalAccounts}</TableCell>
                              <TableCell className="text-slate-300 text-sm text-right">{formatCurrency(att.totalDebt)}</TableCell>
                              <TableCell className="text-emerald-400 text-sm text-right">{formatCurrency(att.recoveredAmount)}</TableCell>
                              <TableCell className="text-right">
                                <span className={`text-sm font-medium ${att.recoveryRate >= 50 ? 'text-emerald-400' : att.recoveryRate >= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {att.recoveryRate}%
                                </span>
                              </TableCell>
                              <TableCell className="text-slate-300 text-sm text-right">{att.activeAccounts}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">No attorney performance data available. Handover accounts to attorneys to track performance.</div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </PosLayout>
  );
}
