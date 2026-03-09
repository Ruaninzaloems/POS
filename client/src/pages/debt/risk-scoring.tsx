import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Target,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbSep,
  Settings2,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Save,
  Zap,
} from 'lucide-react';
import {
  scoreDebtAccount,
  scoreDebtBulk,
  fetchDebtScores,
  fetchScoringWeights,
  updateScoringWeights,
  fetchAccounts,
} from '@/lib/external-api';
import type { TabMode, RiskScore } from '@/models/debt.models';
import { RISK_COLORS } from '@/services/debt-config';

function RiskBadge({ category }: { category: string }) {
  const c = RISK_COLORS[category as keyof typeof RISK_COLORS] || RISK_COLORS.MEDIUM;
  return (
    <span data-testid={`badge-risk-${category}`} className={`px-2 py-0.5 rounded text-xs font-semibold ${c.bg} ${c.text} ${c.border} border`}>
      {category}
    </span>
  );
}

function ScoreGauge({ score, category }: { score: number; category: string }) {
  const c = RISK_COLORS[category as keyof typeof RISK_COLORS] || RISK_COLORS.MEDIUM;
  return (
    <div data-testid="score-gauge" className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-[#E5E5E5]" />
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeDasharray={`${(score / 100) * 327} 327`} strokeLinecap="round" className={c.text} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${c.text}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <RiskBadge category={category} />
    </div>
  );
}

export default function RiskScoring() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabMode>('score');

  const [accountNo, setAccountNo] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<RiskScore | null>(null);
  const [factors, setFactors] = useState<any[]>([]);

  const [accountSuggestions, setAccountSuggestions] = useState<{ accountNo: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [paymentHistory, setPaymentHistory] = useState('50');
  const [arrearDays, setArrearDays] = useState('0');
  const [lastPaymentDays, setLastPaymentDays] = useState('30');
  const [totalArrears, setTotalArrears] = useState('0');
  const [indigentStatus, setIndigentStatus] = useState('false');
  const [previousLegalActions, setPreviousLegalActions] = useState('0');
  const [locationRisk, setLocationRisk] = useState('50');
  const [waterArrears, setWaterArrears] = useState('0');
  const [electricityArrears, setElectricityArrears] = useState('0');

  const [dashScores, setDashScores] = useState<any[]>([]);
  const [dashTotal, setDashTotal] = useState(0);
  const [dashFilter, setDashFilter] = useState('__all__');
  const [dashPage, setDashPage] = useState(1);
  const [dashLoading, setDashLoading] = useState(false);
  const dashPageSize = 10;

  const [weights, setWeights] = useState<Record<string, { label: string; weight: number; description: string }>>({});
  const [editWeights, setEditWeights] = useState<Record<string, number>>({});
  const [weightsLoading, setWeightsLoading] = useState(false);
  const [weightsSaving, setWeightsSaving] = useState(false);

  const handleAccountSearch = useCallback(async (query: string) => {
    setAccountNo(query);
    if (query.length >= 3) {
      try {
        const results = await fetchAccounts(query);
        setAccountSuggestions(Array.isArray(results) ? results.slice(0, 8) : []);
        setShowSuggestions(true);
      } catch { setAccountSuggestions([]); }
    } else {
      setAccountSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const handleScore = async () => {
    if (!accountNo.trim()) { toast({ title: 'Account number required', variant: 'destructive' }); return; }
    setScoring(true);
    try {
      const accountData = {
        accountNo: accountNo.trim(),
        paymentHistory: parseFloat(paymentHistory) || 50,
        arrearAge: parseInt(arrearDays) || 0,
        arrearDays: parseInt(arrearDays) || 0,
        lastPaymentDays: parseInt(lastPaymentDays) || 30,
        paymentFrequency: parseInt(lastPaymentDays) || 30,
        totalArrears: parseFloat(totalArrears) || 0,
        debtSize: parseFloat(totalArrears) || 0,
        indigentStatus: indigentStatus === 'true',
        previousLegalActions: parseInt(previousLegalActions) || 0,
        locationRisk: parseFloat(locationRisk) || 50,
        waterArrears: parseFloat(waterArrears) || 0,
        electricityArrears: parseFloat(electricityArrears) || 0,
        serviceTypes: [
          ...(parseFloat(waterArrears) > 0 ? ['water'] : []),
          ...(parseFloat(electricityArrears) > 0 ? ['electricity'] : []),
        ],
      };
      const result = await scoreDebtAccount(accountData);
      setScoreResult(result);
      const fs = result.factorScores || result.factor_scores || [];
      setFactors(Array.isArray(fs) ? fs : []);
      toast({ title: 'Account Scored', description: `Risk: ${result.riskCategory} (${result.overallScore})` });
    } catch (err: any) {
      toast({ title: 'Scoring Failed', description: err.message, variant: 'destructive' });
    } finally { setScoring(false); }
  };

  const handleBulkScore = async () => {
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast({ title: 'Enter account numbers', variant: 'destructive' }); return; }
    setScoring(true);
    try {
      const accounts = lines.map(accountNo => ({ accountNo, paymentHistory: 50, arrearAge: 90, lastPaymentDays: 60, totalArrears: 5000, debtSize: 5000, indigentStatus: false, previousLegalActions: 0, locationRisk: 50, serviceTypes: ['water', 'electricity'] }));
      await scoreDebtBulk(accounts);
      toast({ title: 'Bulk Scoring Complete', description: `${lines.length} accounts scored` });
      setBulkInput('');
      loadDashboard();
    } catch (err: any) {
      toast({ title: 'Bulk Scoring Failed', description: err.message, variant: 'destructive' });
    } finally { setScoring(false); }
  };

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const params: Record<string, string> = { limit: String(dashPageSize), offset: String((dashPage - 1) * dashPageSize) };
      if (dashFilter !== '__all__') params.riskCategory = dashFilter;
      const data = await fetchDebtScores(params);
      setDashScores(data.scores || []);
      setDashTotal(data.total || 0);
    } catch (err: any) {
      toast({ title: 'Failed to load scores', description: err.message, variant: 'destructive' });
    } finally { setDashLoading(false); }
  }, [dashPage, dashFilter]);

  const loadWeights = useCallback(async () => {
    setWeightsLoading(true);
    try {
      const w = await fetchScoringWeights();
      setWeights(w);
      const edit: Record<string, number> = {};
      for (const [k, v] of Object.entries(w)) edit[k] = v.weight;
      setEditWeights(edit);
    } catch (err: any) {
      toast({ title: 'Failed to load weights', description: err.message, variant: 'destructive' });
    } finally { setWeightsLoading(false); }
  }, []);

  const handleSaveWeights = async () => {
    setWeightsSaving(true);
    try {
      await updateScoringWeights(editWeights);
      await loadWeights();
      toast({ title: 'Weights Saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save weights', description: err.message, variant: 'destructive' });
    } finally { setWeightsSaving(false); }
  };

  useEffect(() => { if (tab === 'dashboard') loadDashboard(); }, [tab, loadDashboard]);
  useEffect(() => { if (tab === 'weights') loadWeights(); }, [tab, loadWeights]);

  const totalPages = Math.ceil(dashTotal / dashPageSize);
  const lowCount = dashScores.filter(s => s.riskCategory === 'LOW').length;
  const medCount = dashScores.filter(s => s.riskCategory === 'MEDIUM').length;
  const highCount = dashScores.filter(s => s.riskCategory === 'HIGH').length;

  return (
    <PosLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-[#D6D6D6] bg-white">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <button onClick={() => setLocation('/')} className="hover:text-foreground transition-colors" data-testid="link-home">Home</button>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-foreground font-medium">Debt Risk Scoring</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)] flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">Intelligent Debt Risk Scoring</h1>
              <HelpTip text="Score debtor accounts based on payment history, arrear age, debt size, and other risk factors. Scores from 0-100 drive handover priority and legal escalation." />
            </div>
            <div className="flex gap-1">
              {(['score', 'dashboard', 'weights'] as TabMode[]).map(t => (
                <Button key={t} size="sm" variant={tab === t ? 'default' : 'ghost'} onClick={() => setTab(t)} className={tab === t ? 'bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm' : 'text-muted-foreground hover:text-foreground'} data-testid={`tab-${t}`}>
                  {t === 'score' && <><Target className="w-3.5 h-3.5 mr-1" />Score Account</>}
                  {t === 'dashboard' && <><BarChart3 className="w-3.5 h-3.5 mr-1" />Dashboard</>}
                  {t === 'weights' && <><Settings2 className="w-3.5 h-3.5 mr-1" />Weights</>}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F2F4F7] min-h-0">
          <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          {tab === 'score' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Search className="w-4 h-4" />Score Single Account</h3>
                    <div className="relative">
                      <Label className="text-xs text-muted-foreground">Account Number</Label>
                      <Input data-testid="input-account-no" value={accountNo} onChange={e => handleAccountSearch(e.target.value)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Enter account number..." className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      {showSuggestions && accountSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-[#D6D6D6] rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {accountSuggestions.map((s, i) => (
                            <button key={i} className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-[var(--pos-accent-hover-row)]" onClick={() => { setAccountNo(s.accountNo); setShowSuggestions(false); }} data-testid={`suggestion-${i}`}>{s.accountNo} — {s.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Payment History Score (0-100)</Label>
                        <Input data-testid="input-payment-history" type="number" value={paymentHistory} onChange={e => setPaymentHistory(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Arrear Age (days)</Label>
                        <Input data-testid="input-arrear-days" type="number" value={arrearDays} onChange={e => setArrearDays(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Days Since Last Payment</Label>
                        <Input data-testid="input-last-payment" type="number" value={lastPaymentDays} onChange={e => setLastPaymentDays(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Arrears (R)</Label>
                        <Input data-testid="input-total-arrears" type="number" value={totalArrears} onChange={e => setTotalArrears(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Water Arrears (R)</Label>
                        <Input data-testid="input-water-arrears" type="number" value={waterArrears} onChange={e => setWaterArrears(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Electricity Arrears (R)</Label>
                        <Input data-testid="input-electricity-arrears" type="number" value={electricityArrears} onChange={e => setElectricityArrears(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Indigent Status</Label>
                        <Select value={indigentStatus} onValueChange={setIndigentStatus}>
                          <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-indigent"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="false">No</SelectItem><SelectItem value="true">Yes</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Previous Legal Actions</Label>
                        <Input data-testid="input-legal-actions" type="number" value={previousLegalActions} onChange={e => setPreviousLegalActions(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Location Risk (0-100)</Label>
                        <Input data-testid="input-location-risk" type="number" value={locationRisk} onChange={e => setLocationRisk(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] h-9" />
                      </div>
                    </div>
                    <Button onClick={handleScore} disabled={scoring} className="w-full bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-score">
                      {scoring ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Scoring...</> : <><Target className="w-4 h-4 mr-1" />Calculate Risk Score</>}
                    </Button>
                  </CardContent>
                </Card>

                {scoreResult ? (
                  <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                    <CardContent className="p-4 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Risk Score Result</h3>
                      <div className="flex items-center justify-center">
                        <ScoreGauge score={parseFloat(scoreResult.overallScore || scoreResult.overall_score || 0)} category={scoreResult.riskCategory || scoreResult.risk_category || 'LOW'} />
                      </div>
                      <div className="text-center text-sm text-muted-foreground">Account: <span className="text-foreground font-medium">{scoreResult.accountNo || scoreResult.account_no}</span></div>

                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Factor Breakdown</h4>
                      <div className="space-y-2">
                        {factors.map((f: any, i: number) => {
                          const pct = Math.min(100, f.normalizedScore || f.normalized_score || 0);
                          const color = pct <= 30 ? 'bg-emerald-500' : pct <= 60 ? 'bg-amber-500' : 'bg-red-500';
                          return (
                            <div key={i} data-testid={`factor-${f.key}`}>
                              <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                                <span>{f.label}</span>
                                <span>{(f.weightedScore || f.weighted_score || 0).toFixed(1)} pts (weight: {(f.weight || 0).toFixed(0)}%)</span>
                              </div>
                              <div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
                                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                    <CardContent className="p-4 flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Target className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Enter account details and click Score to see risk analysis</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4" />Bulk Score Accounts</h3>
                  <p className="text-xs text-muted-foreground">Enter one account number per line. Default risk factors will be applied. Refine individual scores via the single account scorer.</p>
                  <textarea data-testid="textarea-bulk" className="w-full h-24 bg-[#F7F7F7] border border-[#D6D6D6] text-foreground text-sm rounded-md p-2 resize-none focus:ring-2 focus:ring-[var(--pos-accent)] focus:border-transparent" placeholder="ACC001&#10;ACC002&#10;ACC003" value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
                  <Button onClick={handleBulkScore} disabled={scoring} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-bulk-score">
                    {scoring ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Scoring...</> : <><Zap className="w-4 h-4 mr-1" />Score All</>}
                  </Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-emerald-50 border-emerald-200 rounded-xl"><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-emerald-700">0-30</div><div className="text-xs text-emerald-600">LOW RISK</div><div className="text-[10px] text-muted-foreground mt-1">Monitor only</div></CardContent></Card>
                <Card className="bg-amber-50 border-amber-200 rounded-xl"><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-amber-700">30-60</div><div className="text-xs text-amber-600">MEDIUM RISK</div><div className="text-[10px] text-muted-foreground mt-1">Consider handover</div></CardContent></Card>
                <Card className="bg-red-50 border-red-200 rounded-xl"><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-red-700">60-100</div><div className="text-xs text-red-600">HIGH RISK</div><div className="text-[10px] text-muted-foreground mt-1">Priority escalation</div></CardContent></Card>
              </div>
            </>
          )}

          {tab === 'dashboard' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-emerald-50 border-emerald-200 rounded-xl"><CardContent className="p-3 flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-emerald-700" /><div><div className="text-xl font-bold text-emerald-700" data-testid="text-low-count">{lowCount}</div><div className="text-xs text-emerald-600">Low Risk</div></div></CardContent></Card>
                <Card className="bg-amber-50 border-amber-200 rounded-xl"><CardContent className="p-3 flex items-center gap-3"><AlertTriangle className="w-8 h-8 text-amber-700" /><div><div className="text-xl font-bold text-amber-700" data-testid="text-med-count">{medCount}</div><div className="text-xs text-amber-600">Medium Risk</div></div></CardContent></Card>
                <Card className="bg-red-50 border-red-200 rounded-xl"><CardContent className="p-3 flex items-center gap-3"><XCircle className="w-8 h-8 text-red-700" /><div><div className="text-xl font-bold text-red-700" data-testid="text-high-count">{highCount}</div><div className="text-xs text-red-600">High Risk</div></div></CardContent></Card>
              </div>

              <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Scored Accounts</h3>
                    <Select value={dashFilter} onValueChange={v => { setDashFilter(v); setDashPage(1); }}>
                      <SelectTrigger className="w-40 bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-risk-filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Categories</SelectItem>
                        <SelectItem value="LOW">Low Risk</SelectItem>
                        <SelectItem value="MEDIUM">Medium Risk</SelectItem>
                        <SelectItem value="HIGH">High Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {dashLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : dashScores.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No scored accounts found. Use the Score Account tab to score accounts.</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-[#E5E5E5] hover:bg-transparent bg-[#F7F7F7]">
                              <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account</TableHead>
                              <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Score</TableHead>
                              <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Risk</TableHead>
                              <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Scored By</TableHead>
                              <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Scored At</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-[#E5E5E5]">
                            {dashScores.map((s: any, i: number) => (
                              <TableRow key={i} className="hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-score-${i}`}>
                                <TableCell className="text-foreground text-sm font-mono">{s.accountNo || s.account_no}</TableCell>
                                <TableCell className="text-foreground text-sm font-bold">{parseFloat(s.overallScore || s.overall_score || 0).toFixed(1)}</TableCell>
                                <TableCell><RiskBadge category={s.riskCategory || s.risk_category || 'LOW'} /></TableCell>
                                <TableCell className="text-muted-foreground text-sm">{s.scoredBy || s.scored_by || '-'}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{s.scoredAt || s.scored_at ? new Date(s.scoredAt || s.scored_at).toLocaleString() : '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <span>{dashTotal} total records</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setDashPage(p => Math.max(1, p - 1))} disabled={dashPage <= 1} className="text-muted-foreground h-7"><ChevronLeft className="w-3.5 h-3.5" /></Button>
                          <span>Page {dashPage} of {totalPages || 1}</span>
                          <Button size="sm" variant="ghost" onClick={() => setDashPage(p => Math.min(totalPages, p + 1))} disabled={dashPage >= totalPages} className="text-muted-foreground h-7"><ChevronRight className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'weights' && (
            <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Settings2 className="w-4 h-4" />Scoring Weight Configuration</h3>
                  <Button size="sm" onClick={handleSaveWeights} disabled={weightsSaving} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm" data-testid="button-save-weights">
                    {weightsSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Save Weights
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Adjust how much each factor contributes to the overall risk score. Higher weight = more influence. Weights are automatically normalized.</p>
                {weightsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(weights).map(([key, val]) => (
                      <div key={key} className="space-y-1" data-testid={`weight-${key}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-foreground">{val.label}</Label>
                          <span className="text-sm font-mono text-foreground">{editWeights[key] || 0}%</span>
                        </div>
                        <Slider
                          value={[editWeights[key] || 0]}
                          onValueChange={([v]) => setEditWeights(prev => ({ ...prev, [key]: v }))}
                          min={0} max={50} step={1}
                          className="cursor-pointer"
                        />
                        <p className="text-[10px] text-muted-foreground">{val.description}</p>
                      </div>
                    ))}
                    <div className="p-3 bg-[#F7F7F7] rounded-md">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Weight</span>
                        <span className={`font-bold ${Object.values(editWeights).reduce((s, w) => s + w, 0) === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {Object.values(editWeights).reduce((s, w) => s + w, 0)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Weights are normalized automatically — they don't need to sum to 100, but it's recommended.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        </div>
      </div>
    </PosLayout>
  );
}
