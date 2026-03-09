import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import {
  XCircle,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Send,
  ArrowLeft,
} from 'lucide-react';
import {
  fetchHandoverList,
  terminateHandover,
  fetchAttorneyList,
  type HandoverRecord,
  type Attorney,
} from '@/lib/external-api';
import { TERMINATION_REASONS, PAGE_SIZE } from '@/services/debt-config';

export default function HandoverTermination() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [accountFilter, setAccountFilter] = useState('');
  const [attorneyFilter, setAttorneyFilter] = useState('__all__');
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [terminationReason, setTerminationReason] = useState('');
  const [terminationNotes, setTerminationNotes] = useState('');

  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [handoverData, attorneyData] = await Promise.all([
        fetchHandoverList(),
        fetchAttorneyList(),
      ]);
      setHandovers(handoverData);
      setAttorneys(attorneyData);
    } catch (e: any) {
      toast({
        title: 'Load Failed',
        description: e.message || 'Failed to load handover data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredHandovers = useMemo(() => {
    return handovers.filter((h) => {
      if (accountFilter && !h.accountNo.toLowerCase().includes(accountFilter.toLowerCase())) {
        return false;
      }
      if (attorneyFilter !== '__all__' && String(h.attorneyId) !== attorneyFilter) {
        return false;
      }
      if (statusFilter !== '__all__' && h.status !== statusFilter) {
        return false;
      }
      if (dateFrom) {
        const hDate = new Date(h.handoverDate);
        if (hDate < dateFrom) return false;
      }
      if (dateTo) {
        const hDate = new Date(h.handoverDate);
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (hDate > endOfDay) return false;
      }
      return true;
    });
  }, [handovers, accountFilter, attorneyFilter, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredHandovers.length / PAGE_SIZE));
  const paginatedHandovers = filteredHandovers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [accountFilter, attorneyFilter, statusFilter, dateFrom, dateTo]);

  const allVisibleSelected =
    paginatedHandovers.length > 0 &&
    paginatedHandovers.every((h) => selectedIds.has(h.handoverId));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const newSet = new Set(selectedIds);
      paginatedHandovers.forEach((h) => newSet.delete(h.handoverId));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      paginatedHandovers.forEach((h) => newSet.add(h.handoverId));
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSubmitTermination = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select at least one handover to terminate.',
        variant: 'destructive',
      });
      return;
    }
    if (!terminationReason) {
      toast({
        title: 'Reason Required',
        description: 'Please select a termination reason.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await terminateHandover({
        handoverIds: Array.from(selectedIds),
        reason: terminationReason,
        notes: terminationNotes,
      });
      toast({
        title: 'Termination Submitted',
        description: result.message || `${selectedIds.size} handover(s) submitted for termination approval.`,
      });
      setSelectedIds(new Set());
      setTerminationReason('');
      setTerminationNotes('');
      await loadData();
    } catch (e: any) {
      toast({
        title: 'Termination Failed',
        description: e.message || 'Failed to submit termination.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setLocation('/');
  };

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(handovers.map((h) => h.status));
    return Array.from(statuses).sort();
  }, [handovers]);

  const getStatusBadge = (status: string) => {
    const lower = status.toLowerCase();
    if (lower.includes('active'))
      return <Badge data-testid={`badge-status-${status}`} className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">{status}</Badge>;
    if (lower.includes('termination') && lower.includes('approved'))
      return <Badge data-testid={`badge-status-${status}`} className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-[10px]">{status}</Badge>;
    if (lower.includes('pending'))
      return <Badge data-testid={`badge-status-${status}`} className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[10px]">{status}</Badge>;
    if (lower.includes('terminated'))
      return <Badge data-testid={`badge-status-${status}`} className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]">{status}</Badge>;
    return <Badge data-testid={`badge-status-${status}`} variant="outline" className="text-[10px]">{status}</Badge>;
  };

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/20">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground" data-testid="text-page-title">
                Handover Termination
              </h1>
              <p className="text-xs text-muted-foreground">
                Terminate active handovers with supervisor approval
              </p>
            </div>
          </div>
          <HelpTip text="Navigate back to the dashboard">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </HelpTip>
        </div>

        <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="w-4 h-4 text-muted-foreground" />
              Search & Filter
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Account Number</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search account..."
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    data-testid="input-account-filter"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Attorney</label>
                <Select value={attorneyFilter} onValueChange={setAttorneyFilter}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-attorney-filter">
                    <SelectValue placeholder="All Attorneys" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Attorneys</SelectItem>
                    {attorneys.map((a) => (
                      <SelectItem key={a.attorneyId} value={String(a.attorneyId)}>
                        {a.attorneyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Statuses</SelectItem>
                    {uniqueStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Date From</label>
                <DatePicker
                  date={dateFrom}
                  setDate={setDateFrom}
                  placeholder="From date"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Date To</label>
                <DatePicker
                  date={dateTo}
                  setDate={setDateTo}
                  placeholder="To date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Active Handovers</h2>
                <Badge variant="outline" className="text-[10px]" data-testid="badge-handover-count">
                  {filteredHandovers.length} record{filteredHandovers.length !== 1 ? 's' : ''}
                </Badge>
                {selectedIds.size > 0 && (
                  <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]" data-testid="badge-selected-count">
                    {selectedIds.size} selected
                  </Badge>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading handovers...</span>
              </div>
            ) : filteredHandovers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No handovers found matching your filters.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allVisibleSelected}
                            onCheckedChange={toggleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold">Handover ID</TableHead>
                        <TableHead className="text-[11px] font-semibold">Account</TableHead>
                        <TableHead className="text-[11px] font-semibold">Account Name</TableHead>
                        <TableHead className="text-[11px] font-semibold">Attorney</TableHead>
                        <TableHead className="text-[11px] font-semibold">Handover Date</TableHead>
                        <TableHead className="text-[11px] font-semibold text-right">Amount</TableHead>
                        <TableHead className="text-[11px] font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHandovers.map((h) => (
                        <TableRow
                          key={h.handoverId}
                          className={`cursor-pointer transition-colors ${
                            selectedIds.has(h.handoverId)
                              ? 'bg-red-500/5 hover:bg-red-500/10'
                              : 'hover:bg-muted/20'
                          }`}
                          onClick={() => toggleSelect(h.handoverId)}
                          data-testid={`row-handover-${h.handoverId}`}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(h.handoverId)}
                              onCheckedChange={() => toggleSelect(h.handoverId)}
                              data-testid={`checkbox-handover-${h.handoverId}`}
                            />
                          </TableCell>
                          <TableCell className="text-xs font-mono" data-testid={`text-handover-id-${h.handoverId}`}>
                            {h.handoverId}
                          </TableCell>
                          <TableCell className="text-xs font-mono" data-testid={`text-account-${h.handoverId}`}>
                            {h.accountNo}
                          </TableCell>
                          <TableCell className="text-xs" data-testid={`text-account-name-${h.handoverId}`}>
                            {h.accountName}
                          </TableCell>
                          <TableCell className="text-xs" data-testid={`text-attorney-${h.handoverId}`}>
                            {h.attorney}
                          </TableCell>
                          <TableCell className="text-xs" data-testid={`text-date-${h.handoverId}`}>
                            {h.handoverDate ? format(new Date(h.handoverDate), 'dd MMM yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium" data-testid={`text-amount-${h.handoverId}`}>
                            R {h.handedOverAmount?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell data-testid={`cell-status-${h.handoverId}`}>
                            {getStatusBadge(h.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-xs text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <XCircle className="w-4 h-4 text-red-400" />
              Termination Details
              <HelpTip text="Termination requires supervisor approval. Select handovers above, choose a reason, and submit." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
                  Termination Reason <span className="text-red-400">*</span>
                </label>
                <Select value={terminationReason} onValueChange={setTerminationReason}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-termination-reason">
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMINATION_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
                  Notes
                </label>
                <Textarea
                  placeholder="Additional notes for the termination..."
                  value={terminationNotes}
                  onChange={(e) => setTerminationNotes(e.target.value)}
                  className="text-sm min-h-[72px] resize-none"
                  maxLength={250}
                  data-testid="input-termination-notes"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5 text-right">
                  {terminationNotes.length}/250
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Termination requires supervisor approval before it is finalized.
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <HelpTip text="Submit the selected handovers for termination. Requires supervisor approval.">
                  <Button
                    size="sm"
                    onClick={handleSubmitTermination}
                    disabled={submitting || selectedIds.size === 0 || !terminationReason}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    data-testid="button-submit-termination"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        Submit Termination ({selectedIds.size})
                      </>
                    )}
                  </Button>
                </HelpTip>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PosLayout>
  );
}
