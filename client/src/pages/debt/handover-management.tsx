import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Briefcase,
  Search,
  Loader2,
  Send,
  XCircle,
  Users,
  RotateCcw,
  User,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  fetchHandoverList,
  submitHandover,
  fetchAttorneyList,
  fetchBillingCycles,
  fetchTowns,
  fetchAgeingRanges,
  type HandoverRecord,
  type Attorney,
} from '@/lib/external-api';
import type { HandoverOption } from '@/models/debt.models';
import { PAGE_SIZE } from '@/services/debt-config';

export default function HandoverManagement() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [handoverOption, setHandoverOption] = useState<HandoverOption>('account');
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState('');
  const [town, setTown] = useState('');
  const [ageing, setAgeing] = useState('');
  const [amountGreaterThan, setAmountGreaterThan] = useState('');

  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [billingCycles, setBillingCycles] = useState<{ id: string; name: string }[]>([]);
  const [towns, setTowns] = useState<{ id: string; name: string }[]>([]);
  const [ageingRanges, setAgeingRanges] = useState<{ id: string; name: string }[]>([]);

  const [rotationAllocations, setRotationAllocations] = useState<{ attorneyId: number; attorneyName: string; percentage: number }[]>([]);

  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [loadingHandovers, setLoadingHandovers] = useState(false);
  const [loadingRef, setLoadingRef] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadRefData = async () => {
      setLoadingRef(true);
      try {
        const [attList, bcList, townList, ageList] = await Promise.all([
          fetchAttorneyList().catch(() => []),
          fetchBillingCycles().catch(() => []),
          fetchTowns().catch(() => []),
          fetchAgeingRanges().catch(() => []),
        ]);
        setAttorneys(attList);
        setBillingCycles(bcList);
        setTowns(townList);
        setAgeingRanges(ageList);
      } catch (e: any) {
        toast({ title: 'Load Error', description: e.message || 'Failed to load reference data.', variant: 'destructive' });
      } finally {
        setLoadingRef(false);
      }
    };
    loadRefData();
  }, []);

  const loadHandovers = useCallback(async () => {
    setLoadingHandovers(true);
    try {
      const data = await fetchHandoverList();
      setHandovers(data);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to load handovers.', variant: 'destructive' });
    } finally {
      setLoadingHandovers(false);
    }
  }, [toast]);

  useEffect(() => {
    loadHandovers();
  }, [loadHandovers]);

  const totalAllocation = rotationAllocations.reduce((sum, a) => sum + a.percentage, 0);

  const addRotationAttorney = () => {
    setRotationAllocations(prev => [...prev, { attorneyId: 0, attorneyName: '', percentage: 0 }]);
  };

  const removeRotationAttorney = (idx: number) => {
    setRotationAllocations(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRotationAttorney = (idx: number, field: 'attorneyId' | 'percentage', value: string) => {
    setRotationAllocations(prev => {
      const updated = [...prev];
      if (field === 'attorneyId') {
        const id = parseInt(value, 10);
        const att = attorneys.find(a => a.attorneyId === id);
        updated[idx] = { ...updated[idx], attorneyId: id, attorneyName: att?.attorneyName || '' };
      } else {
        updated[idx] = { ...updated[idx], percentage: parseFloat(value) || 0 };
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (handoverOption === 'account') {
      if (!accountSearch.trim()) {
        toast({ title: 'Validation', description: 'Please enter an account number.', variant: 'destructive' });
        return;
      }
      if (!selectedAttorneyId) {
        toast({ title: 'Validation', description: 'Please select an attorney.', variant: 'destructive' });
        return;
      }
    }

    if (handoverOption === 'bulk') {
      if (!selectedAttorneyId) {
        toast({ title: 'Validation', description: 'Please select an attorney for bulk handover.', variant: 'destructive' });
        return;
      }
    }

    if (handoverOption === 'rotation') {
      if (rotationAllocations.length === 0) {
        toast({ title: 'Validation', description: 'Please add at least one attorney for rotation.', variant: 'destructive' });
        return;
      }
      if (Math.abs(totalAllocation - 100) > 0.01) {
        toast({ title: 'Validation', description: `Rotation percentages must total 100%. Current total: ${totalAllocation.toFixed(1)}%`, variant: 'destructive' });
        return;
      }
      const hasInvalid = rotationAllocations.some(a => !a.attorneyId || a.percentage <= 0);
      if (hasInvalid) {
        toast({ title: 'Validation', description: 'All rotation entries must have a valid attorney and percentage > 0.', variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const params: any = {
        handoverOption,
        attorneyId: handoverOption !== 'rotation' ? parseInt(selectedAttorneyId, 10) : 0,
      };

      if (handoverOption === 'account') {
        params.accountNo = accountSearch.trim();
      }

      if (handoverOption === 'bulk' || handoverOption === 'rotation') {
        if (billingCycle) params.billingCycle = billingCycle;
        if (town) params.town = town;
        if (ageing) params.ageing = ageing;
        if (amountGreaterThan) params.amountGreaterThan = parseFloat(amountGreaterThan);
      }

      if (handoverOption === 'rotation') {
        params.rotationAllocations = rotationAllocations.map(a => ({
          attorneyId: a.attorneyId,
          percentage: a.percentage,
        }));
      }

      const result = await submitHandover(params);
      toast({ title: 'Success', description: result.message || 'Handover submitted successfully.' });
      loadHandovers();
      handleClear();
    } catch (e: any) {
      toast({ title: 'Submission Failed', description: e.message || 'Failed to submit handover.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setAccountSearch('');
    setSelectedAttorneyId('');
    setBillingCycle('');
    setTown('');
    setAgeing('');
    setAmountGreaterThan('');
    setRotationAllocations([]);
  };

  const paginatedHandovers = handovers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(handovers.length / PAGE_SIZE));

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('active')) return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    if (s.includes('terminated') || s.includes('closed')) return <Badge className="bg-red-500/15 text-red-400 border-red-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    if (s.includes('pending')) return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  const activeAttorneys = attorneys.filter(a => a.isActive);

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight" data-testid="text-page-title">
                Handover Management
              </h1>
              <p className="text-xs text-muted-foreground">Manage attorney handovers for debt recovery</p>
            </div>
          </div>
          <HelpTip text="Submit account handovers to attorneys for debt collection. Choose Account (single), Bulk (all qualifying), or Rotation (auto-distribute by %)." />
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Handover Option</span>
            </div>

            <div className="grid grid-cols-3 gap-2" data-testid="selector-handover-option">
              {([
                { value: 'account' as const, label: 'Account', icon: User, desc: 'Single account + attorney' },
                { value: 'bulk' as const, label: 'Bulk', icon: Users, desc: 'All qualifying + attorney' },
                { value: 'rotation' as const, label: 'Rotation', icon: RotateCcw, desc: 'Auto-distribute by %' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setHandoverOption(opt.value); handleClear(); }}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center ${
                    handoverOption === opt.value
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.1)]'
                      : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/50'
                  }`}
                  data-testid={`button-option-${opt.value}`}
                >
                  <opt.icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] opacity-70 hidden sm:block">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-border/30 pt-4">
              {handoverOption === 'account' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Account Number</label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                        <Input
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          placeholder="Enter account number..."
                          className="pl-8 h-9 text-sm bg-background/50 border-border/50"
                          data-testid="input-account-search"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Attorney</label>
                      <Select value={selectedAttorneyId} onValueChange={setSelectedAttorneyId}>
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-attorney">
                          <SelectValue placeholder="Select attorney..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAttorneys.map(att => (
                            <SelectItem key={att.attorneyId} value={String(att.attorneyId)}>
                              {att.attorneyName} — {att.firmName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {handoverOption === 'bulk' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Billing Cycle</label>
                      <Select value={billingCycle} onValueChange={setBillingCycle}>
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-billing-cycle">
                          <SelectValue placeholder="All cycles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Cycles</SelectItem>
                          {billingCycles.map(bc => (
                            <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Town</label>
                      <Select value={town} onValueChange={setTown}>
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-town">
                          <SelectValue placeholder="All towns" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Towns</SelectItem>
                          {towns.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Ageing</label>
                      <Select value={ageing} onValueChange={setAgeing}>
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-ageing">
                          <SelectValue placeholder="Select ageing..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ageingRanges.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Amount Greater Than</label>
                      <Input
                        type="number"
                        value={amountGreaterThan}
                        onChange={(e) => setAmountGreaterThan(e.target.value)}
                        placeholder="0.00"
                        className="h-9 text-sm bg-background/50 border-border/50"
                        data-testid="input-amount-threshold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Attorney</label>
                      <Select value={selectedAttorneyId} onValueChange={setSelectedAttorneyId}>
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-attorney-bulk">
                          <SelectValue placeholder="Select attorney..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAttorneys.map(att => (
                            <SelectItem key={att.attorneyId} value={String(att.attorneyId)}>
                              {att.attorneyName} — {att.firmName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {handoverOption === 'rotation' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Billing Cycle</label>
                      <Select value={billingCycle} onValueChange={setBillingCycle}>
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-billing-cycle-rotation">
                          <SelectValue placeholder="All cycles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Cycles</SelectItem>
                          {billingCycles.map(bc => (
                            <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Town</label>
                      <Select value={town} onValueChange={setTown}>
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-town-rotation">
                          <SelectValue placeholder="All towns" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Towns</SelectItem>
                          {towns.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Ageing</label>
                      <Select value={ageing} onValueChange={setAgeing}>
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-ageing-rotation">
                          <SelectValue placeholder="Select ageing..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ageingRanges.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Amount Greater Than</label>
                      <Input
                        type="number"
                        value={amountGreaterThan}
                        onChange={(e) => setAmountGreaterThan(e.target.value)}
                        placeholder="0.00"
                        className="h-9 text-sm bg-background/50 border-border/50"
                        data-testid="input-amount-threshold-rotation"
                      />
                    </div>
                  </div>

                  <div className="border border-border/30 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-semibold text-foreground">Attorney Rotation Allocation</span>
                        <HelpTip text="Distribute handovers across multiple attorneys by percentage. Total must equal 100%." />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-xs ${
                            Math.abs(totalAllocation - 100) < 0.01
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                          data-testid="badge-total-allocation"
                        >
                          Total: {totalAllocation.toFixed(1)}%
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={addRotationAttorney}
                          className="h-7 text-xs gap-1 border-border/50"
                          data-testid="button-add-rotation-attorney"
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </Button>
                      </div>
                    </div>

                    {rotationAllocations.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        No attorneys added yet. Click "Add" to begin.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {rotationAllocations.map((alloc, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Select
                              value={alloc.attorneyId ? String(alloc.attorneyId) : ''}
                              onValueChange={(v) => updateRotationAttorney(idx, 'attorneyId', v)}
                            >
                              <SelectTrigger className="h-8 text-xs flex-1 bg-background/50 border-border/50" data-testid={`select-rotation-attorney-${idx}`}>
                                <SelectValue placeholder="Select attorney..." />
                              </SelectTrigger>
                              <SelectContent>
                                {activeAttorneys.map(att => (
                                  <SelectItem key={att.attorneyId} value={String(att.attorneyId)}>
                                    {att.attorneyName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={alloc.percentage || ''}
                                onChange={(e) => updateRotationAttorney(idx, 'percentage', e.target.value)}
                                placeholder="0"
                                className="h-8 w-20 text-xs text-right bg-background/50 border-border/50"
                                min={0}
                                max={100}
                                data-testid={`input-rotation-percentage-${idx}`}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeRotationAttorney(idx)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              data-testid={`button-remove-rotation-${idx}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <Button
                onClick={handleSubmit}
                disabled={submitting || loadingRef}
                className="h-9 text-sm gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-submit-handover"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Submit Handover
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                className="h-9 text-sm gap-1.5 border-border/50"
                data-testid="button-clear"
              >
                <XCircle className="h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation('/')}
                className="h-9 text-sm gap-1.5 border-border/50"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Active Handovers</span>
                <Badge variant="outline" className="text-xs" data-testid="badge-handover-count">
                  {handovers.length}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadHandovers}
                disabled={loadingHandovers}
                className="h-7 text-xs gap-1"
                data-testid="button-refresh-handovers"
              >
                {loadingHandovers ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Refresh
              </Button>
            </div>

            <div className="border border-border/30 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-8 px-3">Handover ID</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-8 px-3">Account</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-8 px-3">Account Name</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-8 px-3">Attorney</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-8 px-3">Handover Date</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-8 px-3">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-8 px-3 text-right">Amount</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider h-8 px-3 text-right">Outstanding Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingHandovers ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Loading handovers...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedHandovers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Briefcase className="h-8 w-8 opacity-30" />
                            <span className="text-xs">No active handovers found</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedHandovers.map((ho) => (
                        <TableRow
                          key={ho.handoverId}
                          className="hover:bg-muted/20 transition-colors cursor-default"
                          data-testid={`row-handover-${ho.handoverId}`}
                        >
                          <TableCell className="text-xs px-3 font-mono" data-testid={`text-handover-id-${ho.handoverId}`}>
                            {ho.handoverId}
                          </TableCell>
                          <TableCell className="text-xs px-3 font-mono" data-testid={`text-handover-account-${ho.handoverId}`}>
                            {ho.accountNo}
                          </TableCell>
                          <TableCell className="text-xs px-3" data-testid={`text-handover-name-${ho.handoverId}`}>
                            {ho.accountName}
                          </TableCell>
                          <TableCell className="text-xs px-3" data-testid={`text-handover-attorney-${ho.handoverId}`}>
                            {ho.attorney}
                          </TableCell>
                          <TableCell className="text-xs px-3" data-testid={`text-handover-date-${ho.handoverId}`}>
                            {ho.handoverDate ? new Date(ho.handoverDate).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="px-3" data-testid={`text-handover-status-${ho.handoverId}`}>
                            {getStatusBadge(ho.status)}
                          </TableCell>
                          <TableCell className="text-xs px-3 text-right font-mono" data-testid={`text-handover-amount-${ho.handoverId}`}>
                            R {(ho.handedOverAmount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-xs px-3 text-right" data-testid={`text-handover-days-${ho.handoverId}`}>
                            {ho.outstandingDays}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages} ({handovers.length} records)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="h-7 w-7 p-0 border-border/50"
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="h-7 w-7 p-0 border-border/50"
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PosLayout>
  );
}
