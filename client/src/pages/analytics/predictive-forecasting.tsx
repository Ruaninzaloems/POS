import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  TrendingUp,
  Loader2,
  ChevronRight as BreadcrumbSep,
  Target,
  BarChart3,
  AlertTriangle,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Calendar,
  Activity,
  Signal,
} from 'lucide-react';
import { fetchPredictiveForecasting } from '@/lib/external-api';

const IMPACT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
  MEDIUM: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
  LOW: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  POSITIVE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  NEUTRAL: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' },
  NEGATIVE: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
};

function ImpactBadge({ impact }: { impact: string }) {
  const c = IMPACT_COLORS[impact] || IMPACT_COLORS.NEUTRAL;
  return (
    <span data-testid={`badge-impact-${impact}`} className={`px-2 py-0.5 rounded text-xs font-semibold ${c.bg} ${c.text} ${c.border} border`}>
      {impact}
    </span>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  const barColor = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const label = score >= 70 ? 'High Confidence' : score >= 40 ? 'Moderate Confidence' : 'Low Confidence';
  return (
    <div data-testid="confidence-gauge" className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-700/50" />
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeDasharray={`${(score / 100) * 327} 327`} strokeLinecap="round" className={color} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}%</span>
        </div>
      </div>
      <span className="text-xs text-slate-400 mt-1">{label}</span>
    </div>
  );
}

function TrendBar({ data, maxRate }: { data: { period: string; rate: number }; maxRate: number }) {
  const pct = maxRate > 0 ? (data.rate / maxRate) * 100 : 0;
  const color = data.rate >= 70 ? 'bg-emerald-500' : data.rate >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div data-testid={`trend-bar-${data.period}`} className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-28 shrink-0 text-right">{data.period}</span>
      <div className="flex-1 h-6 bg-slate-700/40 rounded-md overflow-hidden relative">
        <div className={`h-full ${color} rounded-md transition-all duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
          {data.rate}%
        </span>
      </div>
    </div>
  );
}

export default function PredictiveForecasting() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPredictiveForecasting();
      setData(result);
    } catch (err: any) {
      toast({ title: 'Failed to load forecasting data', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const forecast = data?.forecast;
  const riskBreakdown = data?.riskBreakdown;
  const deliveryTrend = data?.deliveryTrend || [];
  const channelEffectiveness = data?.channelEffectiveness || {};
  const keyDrivers = data?.keyDrivers || [];
  const maxTrendRate = Math.max(...deliveryTrend.map((d: any) => d.rate), 1);

  return (
    <PosLayout>
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-700/40">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <button onClick={() => setLocation('/')} className="hover:text-white transition-colors" data-testid="link-home">Home</button>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-white font-medium">Predictive Recovery Forecasting</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-400" />
              <h1 className="text-lg font-semibold" data-testid="text-page-title">Predictive Recovery Forecasting</h1>
              <HelpTip text="Predict recovery amounts using historical patterns from communication logs, risk scores, and legal compliance actions. Forecasts are based on weighted risk distribution and communication velocity." />
            </div>
            <Button size="sm" variant="ghost" onClick={loadData} disabled={loading} className="text-slate-400 hover:text-white" data-testid="button-refresh">
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : !data ? (
            <div className="text-center py-20 text-slate-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No forecasting data available. Ensure accounts have been scored and communications logged.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-violet-900/20 border-violet-700/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Target className="w-8 h-8 text-violet-400 shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-violet-300" data-testid="text-predicted-rate">{data.predictedRecoveryRate}%</div>
                      <div className="text-xs text-violet-400">Predicted Recovery Rate</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-cyan-900/20 border-cyan-700/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-cyan-400 shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-cyan-300" data-testid="text-confidence">{data.confidenceScore}%</div>
                      <div className="text-xs text-cyan-400">Confidence Score</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-emerald-900/20 border-emerald-700/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Calendar className="w-8 h-8 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-emerald-300" data-testid="text-forecast-30">{forecast?.next30Days?.estimatedRate || 0}%</div>
                      <div className="text-xs text-emerald-400">30-Day Forecast</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-amber-900/20 border-amber-700/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Activity className="w-8 h-8 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-amber-300" data-testid="text-forecast-90">{forecast?.next90Days?.estimatedRate || 0}%</div>
                      <div className="text-xs text-amber-400">90-Day Forecast</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-violet-400" />
                        Recovery Forecast Timeline
                      </h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: '30 Days', rate: forecast?.next30Days?.estimatedRate || 0, color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700/40' },
                        { label: '60 Days', rate: forecast?.next60Days?.estimatedRate || 0, color: 'text-cyan-400', bg: 'bg-cyan-900/30', border: 'border-cyan-700/40' },
                        { label: '90 Days', rate: forecast?.next90Days?.estimatedRate || 0, color: 'text-violet-400', bg: 'bg-violet-900/30', border: 'border-violet-700/40' },
                      ].map((f, i) => (
                        <div key={i} className={`${f.bg} ${f.border} border rounded-lg p-3 text-center`} data-testid={`forecast-period-${f.label.replace(' ', '-').toLowerCase()}`}>
                          <div className={`text-2xl font-bold ${f.color}`}>{f.rate}%</div>
                          <div className="text-xs text-slate-400 mt-1">Next {f.label}</div>
                          <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${f.color === 'text-emerald-400' ? 'bg-emerald-500' : f.color === 'text-cyan-400' ? 'bg-cyan-500' : 'bg-violet-500'}`} style={{ width: `${Math.min(f.rate, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Model Confidence
                    </h3>
                    <div className="flex items-center justify-center py-2">
                      <ConfidenceGauge score={data.confidenceScore || 0} />
                    </div>
                    <div className="text-xs text-slate-400 text-center px-4">
                      Confidence is computed from delivery rate trends, scored account volume, communication velocity, and legal action history.
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      Delivery Rate Trend (Historical)
                    </h3>
                    {deliveryTrend.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-sm">No delivery trend data available.</div>
                    ) : (
                      <div className="space-y-3">
                        {deliveryTrend.map((d: any, i: number) => (
                          <TrendBar key={i} data={d} maxRate={maxTrendRate} />
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 text-center mt-2">
                      Compares actual vs predicted delivery effectiveness over time
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Signal className="w-4 h-4 text-cyan-400" />
                      Channel Recovery Effectiveness
                    </h3>
                    {Object.keys(channelEffectiveness).length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-sm">No channel data available. Log communications to see effectiveness.</div>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(channelEffectiveness).map(([channel, stats]: [string, any]) => {
                          const barColor = stats.rate >= 70 ? 'bg-emerald-500' : stats.rate >= 40 ? 'bg-amber-500' : 'bg-red-500';
                          const textColor = stats.rate >= 70 ? 'text-emerald-400' : stats.rate >= 40 ? 'text-amber-400' : 'text-red-400';
                          return (
                            <div key={channel} data-testid={`channel-${channel}`} className="bg-slate-900/40 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-medium text-white capitalize">{channel}</span>
                                <span className={`text-sm font-bold ${textColor}`}>{stats.rate}%</span>
                              </div>
                              <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1.5">
                                <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${Math.max(stats.rate, 2)}%` }} />
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>{stats.sent} sent</span>
                                <span>{stats.delivered} delivered</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Risk-Based Recovery Predictions
                    </h3>
                    {!riskBreakdown ? (
                      <div className="text-center py-6 text-slate-500 text-sm">No risk data available.</div>
                    ) : (
                      <div className="space-y-3">
                        {[
                          { key: 'low', label: 'Low Risk', data: riskBreakdown.low, bgClass: 'bg-emerald-900/20 border-emerald-700/30', textClass: 'text-emerald-300', accentClass: 'text-emerald-400' },
                          { key: 'medium', label: 'Medium Risk', data: riskBreakdown.medium, bgClass: 'bg-amber-900/20 border-amber-700/30', textClass: 'text-amber-300', accentClass: 'text-amber-400' },
                          { key: 'high', label: 'High Risk', data: riskBreakdown.high, bgClass: 'bg-red-900/20 border-red-700/30', textClass: 'text-red-300', accentClass: 'text-red-400' },
                        ].map((tier) => (
                          <div key={tier.key} data-testid={`risk-tier-${tier.key}`} className={`${tier.bgClass} border rounded-lg p-3`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-sm font-medium ${tier.textClass}`}>{tier.label}</span>
                              <span className={`text-xs ${tier.accentClass}`}>{tier.data.count} accounts</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wide">Avg Score</div>
                                <div className={`text-lg font-bold ${tier.accentClass}`}>{tier.data.avgScore}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wide">Expected Recovery</div>
                                <div className={`text-lg font-bold ${tier.accentClass}`}>{tier.data.expectedRecovery}%</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Key Prediction Drivers
                    </h3>
                    {keyDrivers.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-sm">No driver data available.</div>
                    ) : (
                      <div className="space-y-2">
                        {keyDrivers.map((driver: any, i: number) => {
                          const ImpactIcon = driver.impact === 'HIGH' || driver.impact === 'POSITIVE'
                            ? ArrowUpRight
                            : driver.impact === 'LOW' || driver.impact === 'NEGATIVE'
                            ? ArrowDownRight
                            : Minus;
                          const iconColor = driver.impact === 'HIGH' || driver.impact === 'POSITIVE'
                            ? 'text-emerald-400'
                            : driver.impact === 'LOW' || driver.impact === 'NEGATIVE'
                            ? 'text-red-400'
                            : 'text-slate-400';
                          return (
                            <div key={i} data-testid={`driver-${i}`} className="bg-slate-900/40 rounded-lg p-3 flex items-start gap-3">
                              <ImpactIcon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-sm font-medium text-white">{driver.factor}</span>
                                  <ImpactBadge impact={driver.impact} />
                                </div>
                                <p className="text-xs text-slate-400">{driver.detail}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-slate-800/40 border-slate-700/40">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-400" />
                    Forecast Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/40 rounded-lg p-4 text-center">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Predicted Recovery Rate</div>
                      <div className="text-3xl font-bold text-violet-400" data-testid="text-summary-rate">{data.predictedRecoveryRate}%</div>
                      <div className="text-xs text-slate-400 mt-1">Based on weighted risk distribution</div>
                    </div>
                    <div className="bg-slate-900/40 rounded-lg p-4 text-center">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Model Confidence</div>
                      <div className="text-3xl font-bold text-cyan-400" data-testid="text-summary-confidence">{data.confidenceScore}%</div>
                      <div className="text-xs text-slate-400 mt-1">Higher with more data points</div>
                    </div>
                    <div className="bg-slate-900/40 rounded-lg p-4 text-center">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">90-Day Outlook</div>
                      <div className="text-3xl font-bold text-emerald-400" data-testid="text-summary-outlook">{forecast?.next90Days?.estimatedRate || 0}%</div>
                      <div className="text-xs text-slate-400 mt-1">Projected recovery improvement</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </PosLayout>
  );
}
