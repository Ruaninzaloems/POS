import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useParams } from 'wouter';
import {
  fetchSection129RunAccounts,
  fetchSection129Runs,
  submitSection129TrialReview,
  type Section129RunAccount,
  type Section129Run,
} from '@/lib/external-api';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  ArrowLeft,
  Users,
  Hash,
  MapPin,
  Shield,
  Tag,
  Clock,
  DollarSign,
  Receipt,
} from 'lucide-react';
import { PAGE_SIZE } from '@/services/debt-config';
import { getStatusColor } from '@/services/validation.service';

export default function Section129TrialReview() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams<{ runId: string }>();
  const runId = params?.runId ? parseInt(params.runId, 10) : 0;

  const [accounts, setAccounts] = useState<Section129RunAccount[]>([]);
  const [runInfo, setRunInfo] = useState<Section129Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [finalReviewComplete, setFinalReviewComplete] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!runId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [accountsData, runsData] = await Promise.all([
          fetchSection129RunAccounts(runId),
          fetchSection129Runs(),
        ]);
        setAccounts(accountsData);
        const run = runsData.find(r => r.runId === runId) || null;
        setRunInfo(run);
        const preSelected = new Set(
          accountsData.filter(a => a.selected).map(a => a.accountId)
        );
        setSelectedIds(preSelected.size > 0 ? preSelected : new Set(accountsData.map(a => a.accountId)));
      } catch (err: any) {
        toast({
          title: 'Failed to Load',
          description: err.message || 'Could not load trial run accounts.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [runId]);

  const totalPages = Math.ceil(accounts.length / PAGE_SIZE);
  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return accounts.slice(start, start + PAGE_SIZE);
  }, [accounts, currentPage]);

  const allOnPageSelected = useMemo(() => {
    if (paginatedAccounts.length === 0) return false;
    return paginatedAccounts.every(a => selectedIds.has(a.accountId));
  }, [paginatedAccounts, selectedIds]);

  const toggleAccount = useCallback((accountId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginatedAccounts.forEach(a => next.delete(a.accountId));
      } else {
        paginatedAccounts.forEach(a => next.add(a.accountId));
      }
      return next;
    });
  }, [allOnPageSelected, paginatedAccounts]);

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: 'No Accounts Selected',
        description: 'Please select at least one account before submitting.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitSection129TrialReview({
        runId,
        selectedAccountIds: Array.from(selectedIds),
        finalReviewComplete,
      });
      toast({
        title: 'Review Submitted',
        description: result.message || `Successfully submitted review for ${selectedIds.size} account(s).`,
      });
      setLocation('/debt/section129');
    } catch (err: any) {
      toast({
        title: 'Submission Failed',
        description: err.message || 'Failed to submit trial review.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalQualifyingAmount = useMemo(() => {
    return accounts
      .filter(a => selectedIds.has(a.accountId))
      .reduce((sum, a) => sum + (a.qualifyingAmount || 0), 0);
  }, [accounts, selectedIds]);

  const totalNoticeFees = useMemo(() => {
    return accounts
      .filter(a => selectedIds.has(a.accountId))
      .reduce((sum, a) => sum + (a.noticeFees || 0), 0);
  }, [accounts, selectedIds]);

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/debt/section129')}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Notices</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2" data-testid="text-page-title">
                  <FileCheck className="w-5 h-5 text-amber-600" />
                  Trial Run Review
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review and select accounts for Section 129 notice processing
                </p>
              </div>
            </div>
          </div>

          <Card className="border border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Run ID</span>
                  <span className="text-sm font-semibold text-foreground" data-testid="text-run-id">
                    {runId || '—'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${runInfo ? getStatusColor(runInfo.status) : 'bg-slate-100 text-slate-500'}`}
                    data-testid="badge-run-status"
                  >
                    {runInfo?.status || 'Loading...'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Handover Option</span>
                  <span className="text-sm font-medium text-foreground" data-testid="text-handover-option">
                    {runInfo?.handoverOption || '—'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Created</span>
                  <span className="text-sm text-foreground" data-testid="text-date-created">
                    {runInfo?.dateCreated || '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Total Accounts</div>
                <div className="text-lg sm:text-xl font-bold text-foreground" data-testid="text-total-accounts">
                  {accounts.length}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Selected</div>
                <div className="text-lg sm:text-xl font-bold text-blue-600" data-testid="text-selected-count">
                  {selectedIds.size}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Qualifying Amount</div>
                <div className="text-lg sm:text-xl font-bold text-emerald-600" data-testid="text-qualifying-total">
                  R {totalQualifyingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Notice Fees</div>
                <div className="text-lg sm:text-xl font-bold text-amber-600" data-testid="text-fees-total">
                  R {totalNoticeFees.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm text-muted-foreground">Loading trial run accounts...</p>
                </div>
              ) : accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <AlertTriangle className="w-10 h-10 text-amber-400" />
                  <p className="text-sm text-muted-foreground">No accounts found for this trial run.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation('/debt/section129')}
                    data-testid="button-back-empty"
                  >
                    Back to Notices
                  </Button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead className="w-10">
                            <HelpTip text="Select or deselect all accounts on this page">
                              <Checkbox
                                checked={allOnPageSelected}
                                onCheckedChange={toggleSelectAll}
                                data-testid="checkbox-select-all"
                              />
                            </HelpTip>
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600">Account No</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 hidden sm:table-cell">Address</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 hidden md:table-cell">Indigent</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 hidden md:table-cell">Rebate</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 hidden lg:table-cell">SG Number</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 text-right">Days O/S</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 text-right">Qualifying Amt</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 text-right hidden sm:table-cell">Notice Fees</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedAccounts.map((account) => {
                          const isSelected = selectedIds.has(account.accountId);
                          return (
                            <TableRow
                              key={account.accountId}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-blue-50/60 hover:bg-blue-50/80'
                                  : 'hover:bg-slate-50/60'
                              }`}
                              onClick={() => toggleAccount(account.accountId)}
                              data-testid={`row-account-${account.accountId}`}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleAccount(account.accountId)}
                                  data-testid={`checkbox-account-${account.accountId}`}
                                />
                              </TableCell>
                              <TableCell className="text-sm font-medium text-foreground" data-testid={`text-account-no-${account.accountId}`}>
                                {account.accountNo}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate hidden sm:table-cell" title={account.address}>
                                {account.address || '—'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    account.indigentStatus?.toLowerCase() === 'yes'
                                      ? 'bg-orange-50 text-orange-600 border-orange-200'
                                      : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}
                                  data-testid={`badge-indigent-${account.accountId}`}
                                >
                                  {account.indigentStatus || 'No'}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    account.rebateStatus?.toLowerCase() === 'yes'
                                      ? 'bg-purple-50 text-purple-600 border-purple-200'
                                      : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}
                                  data-testid={`badge-rebate-${account.accountId}`}
                                >
                                  {account.rebateStatus || 'No'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono hidden lg:table-cell">
                                {account.sgNumber || '—'}
                              </TableCell>
                              <TableCell className="text-sm text-right font-medium" data-testid={`text-days-${account.accountId}`}>
                                <span className={account.outstandingDays > 90 ? 'text-red-600' : account.outstandingDays > 60 ? 'text-amber-600' : 'text-foreground'}>
                                  {account.outstandingDays}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-right font-medium text-foreground" data-testid={`text-amount-${account.accountId}`}>
                                R {(account.qualifyingAmount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-sm text-right text-muted-foreground hidden sm:table-cell">
                                R {(account.noticeFees || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                      <span className="text-xs text-muted-foreground" data-testid="text-pagination-info">
                        Page {currentPage} of {totalPages} ({accounts.length} accounts)
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

          {!loading && accounts.length > 0 && (
            <Card className="border border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <HelpTip text="When enabled, submitting changes the run status from 'Trial Run Review' to 'Trial Run', marking the review as complete.">
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={finalReviewComplete}
                          onCheckedChange={setFinalReviewComplete}
                          data-testid="switch-final-review"
                        />
                        <Label className="text-sm font-medium cursor-pointer" htmlFor="final-review">
                          Final Review Complete
                        </Label>
                        {finalReviewComplete && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                    </HelpTip>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setLocation('/debt/section129')}
                      className="gap-1.5"
                      data-testid="button-cancel"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || selectedIds.size === 0}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="button-submit"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Submit Review ({selectedIds.size})
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PosLayout>
  );
}