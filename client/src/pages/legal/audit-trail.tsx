import React, { useState, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Shield,
  Loader2,
  Search,
  RotateCcw,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbSep,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { fetchComplianceLogs } from '@/lib/external-api';

const ACTION_TYPES = [
  { value: '__all__', label: 'All' },
  { value: 'NOTICE_ISSUED', label: 'Notice Issued' },
  { value: 'HANDOVER_SUBMITTED', label: 'Handover Submitted' },
  { value: 'AUTHORIZATION', label: 'Authorization' },
  { value: 'FINAL_RUN', label: 'Final Run' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'CONFIG_CHANGE', label: 'Config Change' },
];

function isCourtReady(row: any): boolean {
  return !!(
    row.actionType &&
    row.entityType &&
    row.entityId &&
    row.userId &&
    row.userName &&
    row.ipAddress &&
    row.apiCallId &&
    row.timestamp &&
    row.legislationRef
  );
}

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-ZA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function ComplianceAuditTrail() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [actionType, setActionType] = useState('__all__');
  const [accountNo, setAccountNo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [gridPage, setGridPage] = useState(1);
  const gridPageSize = 10;

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setGridPage(1);
    setExpandedRow(null);
    try {
      const params: Record<string, string> = {};
      if (actionType !== '__all__') params.actionType = actionType;
      if (accountNo.trim()) params.accountNo = accountNo.trim();
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (userFilter.trim()) params.userId = userFilter.trim();

      const data = await fetchComplianceLogs(params);
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Query Failed', description: err.message || 'Failed to fetch compliance logs.', variant: 'destructive' });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [actionType, accountNo, dateFrom, dateTo, userFilter, toast]);

  const handleClear = () => {
    setActionType('__all__');
    setAccountNo('');
    setDateFrom('');
    setDateTo('');
    setUserFilter('');
    setResults([]);
    setSearched(false);
    setGridPage(1);
    setExpandedRow(null);
  };

  const handleCancel = () => {
    setLocation('/');
  };

  const paginatedResults = results.slice((gridPage - 1) * gridPageSize, gridPage * gridPageSize);
  const totalGridPages = Math.ceil(results.length / gridPageSize);

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-0">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1" data-testid="text-breadcrumb">
            <span>Compliance</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-slate-300">Audit Trail</span>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight" data-testid="text-page-title">
                Compliance Audit Trail
              </h1>
              <p className="text-xs text-slate-400">Court-ready audit log of all compliance actions with full traceability</p>
            </div>
          </div>

          <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Action Type
                    <HelpTip text="Filter by compliance action type" side="right" />
                  </Label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-action-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Account Number
                    <HelpTip text="Filter by account number or entity ID" side="right" />
                  </Label>
                  <Input
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="Enter account number"
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-account-no"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    User
                    <HelpTip text="Filter by user name" side="right" />
                  </Label>
                  <Input
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    placeholder="Enter user name"
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-user"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Date From
                    <HelpTip text="Filter logs from this date" side="right" />
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-date-from"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Date To
                    <HelpTip text="Filter logs up to this date" side="right" />
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-date-to"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  data-testid="button-search"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                  Search
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  data-testid="button-clear"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Clear
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  data-testid="button-cancel"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {searched && (
            <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white" data-testid="text-results-title">
                    Audit Trail ({results.length} record{results.length !== 1 ? 's' : ''})
                  </h2>
                </div>

                {loading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading compliance logs...
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8" data-testid="text-no-results">
                    No compliance logs found matching the selected criteria.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700/50 hover:bg-transparent">
                            <TableHead className="text-xs text-slate-400 font-medium w-8"></TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Status</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Timestamp</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Action Type</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Entity</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">User</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">IP Address</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">API Call ID</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Legislation</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Process Stage</TableHead>
                            <TableHead className="text-xs text-slate-400 font-medium whitespace-nowrap">Proof of Delivery</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedResults.map((row, idx) => {
                            const globalIdx = (gridPage - 1) * gridPageSize + idx;
                            const isExpanded = expandedRow === globalIdx;
                            const courtReady = isCourtReady(row);
                            return (
                              <React.Fragment key={globalIdx}>
                                <TableRow
                                  className="border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer"
                                  onClick={() => setExpandedRow(isExpanded ? null : globalIdx)}
                                  data-testid={`row-audit-${globalIdx}`}
                                >
                                  <TableCell className="text-xs text-slate-300 w-8">
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-slate-400" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-slate-400" />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {courtReady ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium" data-testid={`badge-court-ready-${globalIdx}`}>
                                        <CheckCircle2 className="w-3 h-3" />
                                        Court Ready
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium" data-testid={`badge-incomplete-${globalIdx}`}>
                                        <AlertTriangle className="w-3 h-3" />
                                        Incomplete
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-300 whitespace-nowrap">{formatTimestamp(row.timestamp)}</TableCell>
                                  <TableCell className="text-xs">
                                    <span className="px-2 py-0.5 rounded bg-slate-700/60 text-slate-200 font-mono text-[11px]">
                                      {row.actionType || '—'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-300 whitespace-nowrap">
                                    <span className="text-slate-500 text-[10px]">{row.entityType || ''}</span>
                                    {row.entityType && row.entityId ? ' / ' : ''}
                                    <span className="font-medium">{row.entityId || '—'}</span>
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-300 whitespace-nowrap">{row.userName || row.userId || '—'}</TableCell>
                                  <TableCell className="text-xs text-slate-300 font-mono whitespace-nowrap">{row.ipAddress || '—'}</TableCell>
                                  <TableCell className="text-xs text-slate-300 font-mono whitespace-nowrap max-w-[120px] truncate" title={row.apiCallId || ''}>
                                    {row.apiCallId ? row.apiCallId.substring(0, 8) + '...' : '—'}
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-300 whitespace-nowrap max-w-[150px] truncate" title={row.legislationRef || ''}>
                                    {row.legislationRef || '—'}
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-300 whitespace-nowrap">{row.processStage || '—'}</TableCell>
                                  <TableCell className="text-xs text-slate-300 whitespace-nowrap">{row.proofOfDelivery || '—'}</TableCell>
                                </TableRow>

                                {isExpanded && (
                                  <TableRow className="border-slate-700/30 bg-slate-800/60" data-testid={`row-audit-detail-${globalIdx}`}>
                                    <TableCell colSpan={11} className="p-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Full Details</h4>
                                          <div className="space-y-1.5 text-xs">
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">ID:</span>
                                              <span className="text-slate-300">{row.id}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Action Type:</span>
                                              <span className="text-slate-300">{row.actionType}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Entity Type:</span>
                                              <span className="text-slate-300">{row.entityType}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Entity ID:</span>
                                              <span className="text-slate-300">{row.entityId}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Rule Version ID:</span>
                                              <span className="text-slate-300">{row.ruleVersionId ?? '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Legislation:</span>
                                              <span className="text-slate-300">{row.legislationRef || '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Process Stage:</span>
                                              <span className="text-slate-300">{row.processStage || '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Proof of Delivery:</span>
                                              <span className="text-slate-300">{row.proofOfDelivery || '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">User ID:</span>
                                              <span className="text-slate-300">{row.userId || '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">User Name:</span>
                                              <span className="text-slate-300">{row.userName || '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">IP Address:</span>
                                              <span className="text-slate-300 font-mono">{row.ipAddress || '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">API Call ID:</span>
                                              <span className="text-slate-300 font-mono text-[11px] break-all">{row.apiCallId || '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Document Ver:</span>
                                              <span className="text-slate-300">{row.documentVersion || '—'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-slate-500 w-28 shrink-0">Timestamp:</span>
                                              <span className="text-slate-300">{formatTimestamp(row.timestamp)}</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="space-y-3">
                                          {row.communicationProof && (
                                            <div>
                                              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Communication Proof</h4>
                                              <pre className="bg-slate-900/80 border border-slate-700/50 rounded p-3 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-40 whitespace-pre-wrap" data-testid={`text-comm-proof-${globalIdx}`}>
                                                {typeof row.communicationProof === 'string'
                                                  ? row.communicationProof
                                                  : JSON.stringify(row.communicationProof, null, 2)}
                                              </pre>
                                            </div>
                                          )}

                                          {row.metadata && (
                                            <div>
                                              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Metadata</h4>
                                              <pre className="bg-slate-900/80 border border-slate-700/50 rounded p-3 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-40 whitespace-pre-wrap" data-testid={`text-metadata-${globalIdx}`}>
                                                {typeof row.metadata === 'string'
                                                  ? row.metadata
                                                  : JSON.stringify(row.metadata, null, 2)}
                                              </pre>
                                            </div>
                                          )}

                                          {!row.communicationProof && !row.metadata && (
                                            <p className="text-xs text-slate-500 italic">No additional metadata or communication proof recorded.</p>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {totalGridPages > 1 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
                        <span className="text-xs text-slate-500">
                          Page {gridPage} of {totalGridPages}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setGridPage(p => Math.max(1, p - 1))}
                            disabled={gridPage <= 1}
                            className="h-7 px-2 text-slate-400"
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setGridPage(p => Math.min(totalGridPages, p + 1))}
                            disabled={gridPage >= totalGridPages}
                            className="h-7 px-2 text-slate-400"
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
          )}
        </div>
      </div>
    </PosLayout>
  );
}
