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
  ShieldCheck,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  fetchSection129Runs,
  authorizeSection129Run,
  type Section129Run,
} from '@/lib/external-api';
import type { ReviewDecision, AuthorizationRow } from '@/models/debt.models';

export default function Section129Authorization() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<AuthorizationRow[]>([]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const allRuns = await fetchSection129Runs();
      const pending = allRuns.filter(
        (r) => {
          const s = (r.status || '').toLowerCase().replace(/[–—]/g, '-');
          return s.includes('notice issued') && s.includes('trial') && !s.includes('review') && !s.includes('final');
        }
      );
      setRows(
        pending.map((run) => ({
          run,
          review: '',
          notes: '',
        }))
      );
    } catch (err: any) {
      toast({
        title: 'Failed to Load',
        description: err.message || 'Could not fetch Section 129 runs for authorization.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const updateRow = (index: number, field: 'review' | 'notes', value: string) => {
    setRows((prev) => {
      const next = [...prev];
      if (field === 'review') {
        next[index] = { ...next[index], review: value as ReviewDecision };
      } else {
        next[index] = { ...next[index], notes: value.slice(0, 250) };
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const actionableRows = rows.filter((r) => r.review !== '');
    if (actionableRows.length === 0) {
      toast({
        title: 'No Decisions Made',
        description: 'Please select Approve or Decline for at least one run before submitting.',
        variant: 'destructive',
      });
      return;
    }

    const missingNotes = actionableRows.filter((r) => r.review === 'Decline' && !r.notes.trim());
    if (missingNotes.length > 0) {
      toast({
        title: 'Notes Required',
        description: 'Please provide notes for all declined runs.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of actionableRows) {
      try {
        await authorizeSection129Run({
          runId: row.run.runId,
          notes: row.notes,
          review: row.review,
        });
        successCount++;
      } catch (err: any) {
        errorCount++;
        console.error(`[Section129Auth] Failed to authorize run ${row.run.runId}:`, err);
      }
    }

    setSubmitting(false);

    if (successCount > 0) {
      toast({
        title: 'Authorization Submitted',
        description: `${successCount} run(s) processed successfully.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
      });
      await loadRuns();
    } else {
      toast({
        title: 'Authorization Failed',
        description: 'All authorization requests failed. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setLocation('/');
  };

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight" data-testid="text-page-title">
                Section 129 Authorization
              </h1>
              <p className="text-xs text-muted-foreground">
                Review and authorize trial runs for final notice generation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HelpTip text="Refresh the list of pending authorizations from the server." side="bottom">
              <Button
                variant="outline"
                size="sm"
                onClick={loadRuns}
                disabled={loading}
                className="border-border text-muted-foreground hover:bg-muted"
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </HelpTip>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="border-border text-muted-foreground hover:bg-muted"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>
          </div>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                <p className="text-sm text-muted-foreground">Loading pending authorizations...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-foreground" data-testid="text-no-pending">No Pending Authorizations</p>
                <p className="text-xs text-muted-foreground max-w-sm text-center">
                  There are no Section 129 trial runs awaiting authorization. All runs have been processed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-xs font-semibold text-muted-foreground w-[140px]">
                        <HelpTip text="Select Approve to authorize the run for final notice generation, or Decline to reject it." side="bottom">
                          <span>Review</span>
                        </HelpTip>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground w-[200px]">
                        <HelpTip text="Optional notes for the authorization decision (max 250 characters). Required when declining." side="bottom">
                          <span>Notes</span>
                        </HelpTip>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Run ID</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Distribution</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Actioned By</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Date Created</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Billing Cycle</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground text-right">Accounts</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow
                        key={row.run.runId}
                        className={`border-border/30 transition-colors ${
                          row.review === 'Approve'
                            ? 'bg-emerald-500/[0.04]'
                            : row.review === 'Decline'
                            ? 'bg-red-500/[0.04]'
                            : ''
                        }`}
                        data-testid={`row-authorization-${row.run.runId}`}
                      >
                        <TableCell>
                          <Select
                            value={row.review || '__none__'}
                            onValueChange={(val) => updateRow(index, 'review', val === '__none__' ? '' : val)}
                          >
                            <SelectTrigger
                              className="h-8 text-xs w-[120px] border-border/50"
                              data-testid={`select-review-${row.run.runId}`}
                            >
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select...</SelectItem>
                              <SelectItem value="Approve">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  Approve
                                </span>
                              </SelectItem>
                              <SelectItem value="Decline">
                                <span className="flex items-center gap-1.5">
                                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                                  Decline
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.notes}
                            onChange={(e) => updateRow(index, 'notes', e.target.value)}
                            placeholder="Authorization notes..."
                            maxLength={250}
                            className="h-8 text-xs border-border/50"
                            data-testid={`input-notes-${row.run.runId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono font-medium text-foreground" data-testid={`text-runid-${row.run.runId}`}>
                            {row.run.runId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/30 text-amber-500 bg-amber-500/10"
                            data-testid={`badge-status-${row.run.runId}`}
                          >
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {row.run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{row.run.distributionType || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{row.run.actionedBy || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {row.run.dateCreated
                              ? new Date(row.run.dateCreated).toLocaleDateString('en-ZA', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{row.run.billingCycle || '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-medium text-foreground">
                            {row.run.totalAccounts?.toLocaleString() || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-medium text-foreground">
                            {row.run.totalAmount != null
                              ? `R ${row.run.totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              <span data-testid="text-pending-count">{rows.length} pending authorization(s)</span>
              {rows.filter((r) => r.review !== '').length > 0 && (
                <Badge variant="secondary" className="text-[10px]" data-testid="badge-decisions-count">
                  {rows.filter((r) => r.review !== '').length} decision(s) made
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={submitting}
                className="border-border text-muted-foreground hover:bg-muted"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <HelpTip text="Submit all authorization decisions. Approved runs will be promoted to 'Notice Issued – Final' status." side="top">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting || rows.filter((r) => r.review !== '').length === 0}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white border-0 shadow-md"
                  data-testid="button-submit"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1.5" />
                      Submit Authorization
                    </>
                  )}
                </Button>
              </HelpTip>
            </div>
          </div>
        )}
      </div>
    </PosLayout>
  );
}
