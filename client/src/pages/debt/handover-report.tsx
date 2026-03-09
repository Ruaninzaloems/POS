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
  Search,
  Loader2,
  Send,
  XCircle,
  RotateCcw,
  Filter,
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
    if (s.includes('active')) return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    if (s.includes('terminated') || s.includes('closed')) return <Badge className="bg-red-500/15 text-red-400 border-red-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    if (s.includes('pending')) return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  const resultColumns = results.length > 0 ? Object.keys(results[0]) : [];

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
              <FileBarChart className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight" data-testid="text-page-title">
                Handover Report
              </h1>
              <p className="text-xs text-muted-foreground">Billing &gt; Reports &gt; Debt Recovery &gt; Handover Report</p>
            </div>
          </div>
          <HelpTip text="Generate handover reports filtered by financial year, billing month, billing cycle, attorney, and account number." />
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Report Filters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Financial Year</Label>
                <Select value={finYear} onValueChange={setFinYear}>
                  <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-fin-year">
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
                <Label className="text-xs font-medium text-muted-foreground">Billing Month</Label>
                <Select value={finMonth} onValueChange={setFinMonth}>
                  <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-fin-month">
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
                <Label className="text-xs font-medium text-muted-foreground">Billing Cycle</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-billing-cycle">
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
                <Label className="text-xs font-medium text-muted-foreground">Attorney</Label>
                <Select value={selectedAttorneyId} onValueChange={setSelectedAttorneyId}>
                  <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50" data-testid="select-attorney">
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
                <Label className="text-xs font-medium text-muted-foreground">Account Number</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="Enter account number..."
                    className="pl-8 h-9 text-sm bg-background/50 border-border/50"
                    data-testid="input-account-no"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <Button
                onClick={handleSubmit}
                disabled={loadingResults || loadingRef}
                className="gap-1.5 h-9 text-sm"
                data-testid="button-submit"
              >
                {loadingResults ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Submit
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={loadingResults}
                className="gap-1.5 h-9 text-sm border-border/50"
                data-testid="button-clear"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loadingResults}
                className="gap-1.5 h-9 text-sm border-border/50"
                data-testid="button-cancel"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {loadingResults && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            <span className="ml-2 text-sm text-muted-foreground">Loading report data...</span>
          </div>
        )}

        {!loadingResults && hasSearched && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileBarChart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Results</span>
                  <Badge variant="outline" className="text-xs" data-testid="badge-result-count">
                    {results.length} record{results.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="h-7 w-7 p-0"
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2" data-testid="text-page-info">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="h-7 w-7 p-0"
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-results">
                  No handover records found for the selected criteria.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/30">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {resultColumns.map(col => (
                          <TableHead key={col} className="text-xs font-semibold whitespace-nowrap">
                            {col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedResults.map((row, idx) => (
                        <TableRow
                          key={idx}
                          className="hover:bg-muted/20 transition-colors"
                          data-testid={`row-result-${idx}`}
                        >
                          {resultColumns.map(col => (
                            <TableCell key={col} className="text-xs whitespace-nowrap">
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
    </PosLayout>
  );
}
