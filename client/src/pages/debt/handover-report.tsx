import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  FileBarChart,
  Loader2,
  Send,
  XCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  fetchHandoverReport,
  fetchAttorneyList,
  fetchBillingCycles,
  type Attorney,
} from '@/lib/external-api';

const PAGE_SIZE = 50;

export default function HandoverReport() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [finYear, setFinYear] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year - 1}/${year}`;
  });
  const [finMonth, setFinMonth] = useState('__all__');
  const [billingCycle, setBillingCycle] = useState('__all__');
  const [selectedAttorneyId, setSelectedAttorneyId] = useState('__all__');
  const [accountNo, setAccountNo] = useState('');

  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [billingCycles, setBillingCycles] = useState<{ id: string; name: string }[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);

  const [results, setResults] = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadRefData = async () => {
      setLoadingRef(true);
      try {
        const [attList, bcList] = await Promise.all([
          fetchAttorneyList().catch(() => []),
          fetchBillingCycles().catch(() => []),
        ]);
        setAttorneys(attList);
        setBillingCycles(bcList);
      } catch (e: any) {
        toast({ title: 'Load Error', description: e.message || 'Failed to load reference data.', variant: 'destructive' });
      } finally {
        setLoadingRef(false);
      }
    };
    loadRefData();
  }, []);

  const finYears = (() => {
    const now = new Date();
    const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => {
      const end = currentFY - i;
      return `${end - 1}/${end}`;
    });
  })();

  const billingMonths = [
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
  ];

  const handleSubmit = async () => {
    setLoadingResults(true);
    setHasSearched(true);
    setCurrentPage(1);
    try {
      const params: any = { finYear };
      if (finMonth && finMonth !== '__all__') params.finMonth = finMonth;
      if (billingCycle && billingCycle !== '__all__') params.billingCycle = billingCycle;
      if (selectedAttorneyId && selectedAttorneyId !== '__all__') params.attorneyId = parseInt(selectedAttorneyId, 10);
      if (accountNo.trim()) params.accountNo = accountNo.trim();

      const data = await fetchHandoverReport(params);
      const arr = Array.isArray(data) ? data : (data?.value && Array.isArray(data.value) ? data.value : data?.items && Array.isArray(data.items) ? data.items : []);
      setResults(arr);
      if (arr.length === 0) {
        toast({ title: 'No Results', description: 'No handover records found for the selected criteria.' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch handover report.', variant: 'destructive' });
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleClear = () => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    setFinYear(`${year - 1}/${year}`);
    setFinMonth('__all__');
    setBillingCycle('__all__');
    setSelectedAttorneyId('__all__');
    setAccountNo('');
    setResults([]);
    setHasSearched(false);
    setCurrentPage(1);
  };

  const handleCancel = () => {
    setLocation('/');
  };

  const paginatedResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  const getStatusBadge = (status: string) => {
    if (!status) return <Badge variant="outline" data-testid="badge-status-unknown">—</Badge>;
    const s = status.toLowerCase();
    if (s.includes('active')) return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" data-testid={`badge-status-${status}`}>{status}</Badge>;
    if (s.includes('terminated') || s.includes('closed')) return <Badge className="bg-red-500/15 text-red-400 border-red-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    if (s.includes('pending')) return <Badge className="bg-amber-50 text-amber-700 border-amber-200" data-testid={`badge-status-${status}`}>{status}</Badge>;
    return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  const resultColumns = results.length > 0 ? Object.keys(results[0]) : [];

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] min-h-0">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1" data-testid="text-breadcrumb">
            <span>Billing</span>
            <ChevronRight className="w-3 h-3" />
            <span>Reports</span>
            <ChevronRight className="w-3 h-3" />
            <span>Debt Recovery</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Handover Report</span>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
              <FileBarChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight" data-testid="text-page-title">
                Handover Report
              </h1>
              <p className="text-xs text-muted-foreground">Generate and view handover reports for debt recovery</p>
            </div>
          </div>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Financial Year
                    <HelpTip text="Select the financial year for the report" side="right" />
                  </Label>
                  <Select value={finYear} onValueChange={setFinYear}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-fin-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {finYears.map(fy => (
                        <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Billing Month
                    <HelpTip text="Filter by billing month (July-June financial year)" side="right" />
                  </Label>
                  <Select value={finMonth} onValueChange={setFinMonth}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-fin-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {billingMonths.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Billing Cycle
                    <HelpTip text="Filter by billing cycle" side="right" />
                  </Label>
                  <Select value={billingCycle} onValueChange={setBillingCycle}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-billing-cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {billingCycles.map(bc => (
                        <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Attorney
                    <HelpTip text="Filter by assigned attorney" side="right" />
                  </Label>
                  <Select value={selectedAttorneyId} onValueChange={setSelectedAttorneyId}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-attorney">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {attorneys.filter(a => a.isActive).map(att => (
                        <SelectItem key={att.attorneyId} value={String(att.attorneyId)}>
                          {att.attorneyName} — {att.firmName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Account Number
                    <HelpTip text="Filter by specific account number" side="right" />
                  </Label>
                  <Input
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="Enter account number"
                    className="bg-[#F7F7F7] border-[#D6D6D6] h-9"
                    data-testid="input-account-no"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={loadingResults || loadingRef}
                  className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm"
                  data-testid="button-submit"
                >
                  {loadingResults ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  Submit
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  className="border-[#D6D6D6] text-foreground hover:bg-[var(--pos-accent-tint)]"
                  data-testid="button-clear"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Clear
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-[#D6D6D6] text-foreground hover:bg-[var(--pos-accent-tint)]"
                  data-testid="button-cancel"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {loadingResults && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading report data...
            </div>
          )}

          {!loadingResults && hasSearched && (
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground" data-testid="text-results-title">
                    Results ({results.length} record{results.length !== 1 ? 's' : ''})
                  </h2>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="h-7 px-2 text-muted-foreground"
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground px-2" data-testid="text-page-info">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="h-7 px-2 text-muted-foreground"
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {results.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8" data-testid="text-no-results">
                    No handover records found for the selected criteria.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#E5E5E5] hover:bg-transparent">
                          {resultColumns.map(col => (
                            <TableHead key={col} className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                              {col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedResults.map((row, idx) => (
                          <TableRow
                            key={idx}
                            className="border-[#E5E5E5] hover:bg-[var(--pos-accent-hover-row)] transition-colors"
                            data-testid={`row-result-${idx}`}
                          >
                            {resultColumns.map(col => (
                              <TableCell key={col} className="text-xs text-foreground whitespace-nowrap">
                                {col.toLowerCase().includes('status')
                                  ? getStatusBadge(String(row[col] || ''))
                                  : col.toLowerCase().includes('amount') || col.toLowerCase().includes('balance')
                                    ? typeof row[col] === 'number'
                                      ? `R ${row[col].toFixed(2)}`
                                      : row[col] ?? '—'
                                    : row[col] ?? '—'
                                }
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PosLayout>
  );
}
