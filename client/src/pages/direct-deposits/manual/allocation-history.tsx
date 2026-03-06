import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Printer, FileText, Search, User, FileSpreadsheet, FileIcon, Filter, X, RotateCcw, AlertCircle, File, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { fetchBulkAllocationList, fetchBulkProgressFinancialYears, fetchBulkProgressMonthList, fetchBulkProgressProcessList, fetchDirectDepositJobAccountDetails, fetchBulkProgressDirectDeposit, retryBulkAllocationJob, BulkProgressSearchQuery } from '@/lib/external-api';
import { usePos } from '@/lib/pos-state';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTip } from '@/components/ui/help-tip';

interface AllocationRecord {
  directDepositJob_ID: number;
  paymentTypeID: number;
  fileName: string;
  fileDate: string;
  filePath: string | null;
  cashierID: number;
  capturerID: number;
  dateCaptured: string;
  paymentReference: string;
  groupID: number | null;
  job_Status: string;
  financialYear: string;
  billPeriodId: number;
  allocatedAmount: number;
  process: string;
  records: number;
  posItemID: number;
}

export default function AllocationHistory() {
  const { toast } = useToast();
  const { platinumUser } = usePos();
  const [filterQuery, setFilterQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  
  const [financialYear, setFinancialYear] = useState('2025/2026');
  const [billingMonth, setBillingMonth] = useState('All');
  const [processFilter, setProcessFilter] = useState('All');
  const [allocDateFrom, setAllocDateFrom] = useState<Date | undefined>();
  const [allocDateTo, setAllocDateTo] = useState<Date | undefined>();
  const [txnDateFrom, setTxnDateFrom] = useState<Date | undefined>();
  const [txnDateTo, setTxnDateTo] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  
  const [allocationData, setAllocationData] = useState<AllocationRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [retrying, setRetrying] = useState<number | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [jobAccountDetails, setJobAccountDetails] = useState<any[] | null>(null);
  
  const [financialYears, setFinancialYears] = useState<string[]>(['2025/2026', '2024/2025']);
  const [monthList, setMonthList] = useState<{id: number; name: string}[]>([]);
  const [processList, setProcessList] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetchBulkProgressFinancialYears(),
      fetchBulkProgressMonthList(),
      fetchBulkProgressProcessList(),
    ]).then(([years, months, processes]) => {
      if (years.length > 0) setFinancialYears(years);
      if (months.length > 0) setMonthList(months);
      if (processes.length > 0) setProcessList(processes);
    }).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const monthId = billingMonth !== 'All' ? parseInt(billingMonth) : null;
      const query: BulkProgressSearchQuery = {
        financialYear: financialYear,
        process: processFilter !== 'All' ? processFilter : null,
        billingMonth: monthId,
        orderby: 'fileDate',
        page: page,
        pageSize: pageSize,
        shortDirection: 'desc',
      };
      const result = await fetchBulkAllocationList(query);
      const items = result?.items || result?.data || [];
      setAllocationData(Array.isArray(items) ? items : []);
      setTotalCount(result?.totalCount || 0);
    } catch (err) {
      console.error('Failed to load allocation history:', err);
      toast({ title: 'Error', description: 'Failed to load allocation history', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [financialYear, billingMonth, processFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [financialYear, billingMonth, processFilter]);

  const filteredHistory = allocationData.filter(item => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      (item.fileName || '').toLowerCase().includes(q) ||
      (item.paymentReference || '').toLowerCase().includes(q) ||
      (item.process || '').toLowerCase().includes(q) ||
      String(item.posItemID).includes(q) ||
      String(item.allocatedAmount).includes(q)
    );
  }).filter(item => {
    if (methodFilter === 'ALL') return true;
    if (methodFilter === 'MANUAL') return item.fileName === 'Manual Allocation' || item.fileName === 'Not applicable';
    if (methodFilter === 'BULK') return item.fileName !== 'Manual Allocation' && item.fileName !== 'Not applicable';
    return true;
  }).filter(item => {
    if (statusFilter.length === 0) return true;
    return statusFilter.includes(item.job_Status);
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  const [selectedTx, setSelectedTx] = useState<AllocationRecord | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Allocation-${selectedTx?.directDepositJob_ID || 'Draft'}`,
  });

  const handleRetry = async (tx: AllocationRecord) => {
      const currentUserId = platinumUser?.user_ID;
      if (!currentUserId) {
          toast({ title: 'Error', description: 'User session not found. Please log in again.', variant: 'destructive' });
          return;
      }
      setRetrying(tx.directDepositJob_ID);
      try {
          await retryBulkAllocationJob(tx.directDepositJob_ID, currentUserId);
          toast({ title: 'Retry Initiated', description: `Job #${tx.directDepositJob_ID} has been resubmitted for processing.` });
          loadData();
      } catch (err: any) {
          toast({ title: 'Retry Failed', description: err.message || 'Failed to retry allocation job.', variant: 'destructive' });
      } finally {
          setRetrying(null);
      }
  };

  const openDetails = async (tx: AllocationRecord) => {
      setSelectedTx(tx);
      setJobAccountDetails(null);
      setDetailsLoading(true);
      try {
          const accountDetails = await fetchDirectDepositJobAccountDetails(tx.directDepositJob_ID);
          setJobAccountDetails(Array.isArray(accountDetails) ? accountDetails : accountDetails?.items || accountDetails?.data || null);
      } catch {
      } finally {
          setDetailsLoading(false);
      }
  };

  const isErrorStatus = (status: string) => {
      const lower = status.toLowerCase();
      return lower.includes('error') || lower.includes('with errors') || lower.includes('failed');
  };

  const handleDownload = (fmt: 'excel' | 'pdf') => {
      const element = document.createElement("a");
      const fileContent = "FileDate,CapturedDate,Description,Reference,Process,Method,Amount,Status,Records\n" + 
          filteredHistory.map(t => {
              const fd = t.fileDate ? new Date(t.fileDate).toLocaleDateString('en-GB') : '';
              const cd = t.dateCaptured ? new Date(t.dateCaptured).toLocaleDateString('en-GB') : '';
              const method = (t.fileName === 'Manual Allocation' || t.fileName === 'Not applicable') ? 'Manual' : 'Bulk';
              return `${fd},${cd},"${t.fileName}","${t.paymentReference}",${t.process},${method},${t.allocatedAmount},${t.job_Status},${t.records}`;
          }).join("\n");
      const fileBlob = new Blob([fileContent], { type: fmt === 'excel' ? "text/csv" : "text/plain" });
      element.href = URL.createObjectURL(fileBlob);
      element.download = `allocation_history.${fmt === 'excel' ? 'csv' : 'txt'}`;
      element.style.display = 'none';
      (document.body || document.documentElement).appendChild(element);
      element.click();
      element.remove();
  };

  const getProcessBadgeColor = (process: string) => {
      switch(process) {
          case 'Consumer Services': return 'bg-sky-100 text-sky-700 border-sky-200';
          case 'Direct Deposits': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
          case 'Clearances': return 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]';
          case 'Miscellaneous Payment': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'Third Party Payments': return 'bg-purple-100 text-purple-700 border-purple-200';
          default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
  };

  const getStatusBadge = (status: string) => {
      if (status === 'Completed' || status === 'Bulk allocations complete') {
          return 'bg-green-100 text-green-700 border-green-200';
      } else if (status === 'Error') {
          return 'bg-red-100 text-red-700 border-red-200';
      } else if (status === 'Processing' || status === 'Performing rebuilds' || status === 'Completing reconciliation') {
          return 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]';
      }
      return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const toggleStatusFilter = (status: string) => {
      setStatusFilter(prev => 
          prev.includes(status) 
          ? prev.filter(s => s !== status)
          : [...prev, status]
      );
  };
  
  const clearFilters = () => {
      setAllocDateFrom(undefined);
      setAllocDateTo(undefined);
      setTxnDateFrom(undefined);
      setTxnDateTo(undefined);
      setStatusFilter([]);
      setMethodFilter('ALL');
      setProcessFilter('All');
      setFilterQuery('');
  };

  const activeFiltersCount = [
      statusFilter.length > 0, processFilter !== 'All'
  ].filter(Boolean).length;

  const isManual = (item: AllocationRecord) => item.fileName === 'Manual Allocation' || item.fileName === 'Not applicable';

  const getPaymentTypeName = (id: number) => {
      switch(id) {
          case 1: return 'Cash';
          case 2: return 'Cheque';
          case 3: return 'Credit Card';
          case 4: return 'Postal Order';
          case 5: return 'EFT';
          default: return `Type ${id}`;
      }
  };

  const formatDate = (d: string | null) => {
      if (!d) return '-';
      try { return new Date(d).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '-'; }
  };
  const formatDateTime = (d: string | null) => {
      if (!d) return '-';
      try { return new Date(d).toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ''); } catch { return '-'; }
  };

  return (
    <PosLayout>
       <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                 <div className="flex items-center gap-3">
                     <Link href="/direct-deposits/manual">
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                     </Link>
                     <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                         <FileText className="w-5 h-5 text-white" />
                     </div>
                     <div>
                         <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E]">Allocation History <HelpTip text="View previously completed deposit allocations and their status." side="right" /></h1>
                         <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
                           {totalCount > 0 ? `${totalCount.toLocaleString()} allocations found` : 'Processed allocations (Manual & Bulk)'}
                         </p>
                     </div>
                 </div>

                 <div className="flex gap-2 ml-11 sm:ml-0">
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={loadData} title="Refresh" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => handleDownload('excel')} title="Download CSV">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    </Button>
                 </div>
             </div>

             <div className="bg-[#F7F7F7] rounded-xl p-4 border border-[#D6D6D6] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 items-end">
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Search <HelpTip text="Filter by date, status, or cashier to find specific allocations." side="right" /></Label>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="File, Reference, Process..." 
                            className="pl-8 bg-white" 
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Financial Year</Label>
                    <Select value={financialYear} onValueChange={setFinancialYear}>
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {financialYears.map(y => (
                                <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Billing Month</Label>
                    <Select value={billingMonth} onValueChange={setBillingMonth}>
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Months</SelectItem>
                            {monthList.map(m => (
                                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Process</Label>
                    <Select value={processFilter} onValueChange={setProcessFilter}>
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Processes</SelectItem>
                            {processList.map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Method</Label>
                    <div className="flex gap-2">
                        <Select value={methodFilter} onValueChange={setMethodFilter}>
                            <SelectTrigger className="bg-white flex-1">
                                <SelectValue placeholder="All Methods" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Methods</SelectItem>
                                <SelectItem value="MANUAL">Manual Only</SelectItem>
                                <SelectItem value="BULK">Bulk Only</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear all filters">
                            <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>
             </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">Loading allocation history...</span>
                </div>
            ) : (
            <>
            <div className="sm:hidden space-y-2">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No allocation history found.</div>
              ) : filteredHistory.map(tx => (
                <Card key={tx.directDepositJob_ID} className="p-3">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{tx.fileName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span>{formatDate(tx.fileDate)}</span>
                        {tx.paymentReference && tx.paymentReference !== '0' && (
                          <>
                            <span className="text-[#D6D6D6]">|</span>
                            <span className="text-[11px] font-medium tracking-wide text-[var(--pos-accent-dark)] bg-[var(--pos-accent-tint)] px-2 py-px rounded-full truncate max-w-[140px]" title={tx.paymentReference}>{tx.paymentReference}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm shrink-0">R {tx.allocatedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <Badge variant="secondary" className={`border text-xs ${getProcessBadgeColor(tx.process)} shadow-none font-normal`}>
                      {tx.process}
                    </Badge>
                    <Badge variant="secondary" className={`text-xs ${isManual(tx) ? 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                      {isManual(tx) ? 'Manual' : 'Bulk'}
                    </Badge>
                    <Badge className={`shadow-none border text-xs ${getStatusBadge(tx.job_Status)}`}>
                      {tx.job_Status === 'Bulk allocations complete' ? 'Completed' : tx.job_Status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{tx.records} record{tx.records !== 1 ? 's' : ''}</span>
                    <div className="flex gap-1">
                      {isErrorStatus(tx.job_Status) && (
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-amber-600 border-amber-200" onClick={() => handleRetry(tx)} disabled={retrying === tx.directDepositJob_ID}>
                          {retrying === tx.directDepositJob_ID ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3 mr-1" /> Retry</>}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => openDetails(tx)}>
                        <Eye className="w-3 h-3 mr-1" /> Details
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="hidden sm:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Captured</TableHead>
                            <TableHead>File / Description</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Process</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead className="text-center">Records</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHistory.map(tx => (
                            <TableRow key={tx.directDepositJob_ID}>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {formatDate(tx.fileDate)}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                    {formatDateTime(tx.dateCaptured)}
                                </TableCell>
                                <TableCell className="text-sm font-medium max-w-[200px]">
                                    <div className="truncate" title={tx.fileName}>{tx.fileName}</div>
                                    {tx.filePath && (
                                        <div className="text-[10px] text-muted-foreground truncate" title={tx.filePath}>{tx.filePath}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {tx.paymentReference && tx.paymentReference !== '0' ? (
                                        <span className="inline-flex items-center text-[11px] font-medium tracking-wide text-[var(--pos-accent-dark)] bg-[var(--pos-accent-tint)] px-2.5 py-0.5 rounded-full max-w-[180px] truncate" title={tx.paymentReference}>{tx.paymentReference}</span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className={`border ${getProcessBadgeColor(tx.process)} shadow-none font-normal`}>
                                        {tx.process}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className={isManual(tx) ? 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]' : 'bg-purple-100 text-purple-700 border-purple-200'}>
                                        {isManual(tx) ? 'Manual' : 'Bulk'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center font-mono text-sm">
                                    {tx.records}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                    R {tx.allocatedAmount.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge className={`shadow-none border ${getStatusBadge(tx.job_Status)}`}>
                                        {(tx.job_Status === 'Processing' || tx.job_Status === 'Performing rebuilds' || tx.job_Status === 'Completing reconciliation' || tx.job_Status === 'Processing receipts') && (
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin inline-block" />
                                        )}
                                        {isErrorStatus(tx.job_Status) && (
                                            <AlertCircle className="w-3 h-3 mr-1 inline-block" />
                                        )}
                                        {tx.job_Status === 'Bulk allocations complete' ? 'Completed' : tx.job_Status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        {isErrorStatus(tx.job_Status) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRetry(tx)}
                                                disabled={retrying === tx.directDepositJob_ID}
                                                className="h-8 px-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                                                data-testid={`button-retry-${tx.directDepositJob_ID}`}
                                            >
                                                {retrying === tx.directDepositJob_ID ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                                )}
                                                {retrying !== tx.directDepositJob_ID && 'Retry'}
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => openDetails(tx)} className="h-8 px-2" data-testid={`button-view-${tx.directDepositJob_ID}`}>
                                            <Eye className="w-4 h-4 mr-1 text-slate-500" /> View
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredHistory.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                    No allocation history found matching your criteria.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                    <div className="text-sm text-muted-foreground">
                        Page {page} of {totalPages} ({totalCount.toLocaleString()} total)
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                            Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
            </>
            )}
        </div>
       </div>

       <Dialog open={!!selectedTx} onOpenChange={(open) => { if (!open) { setSelectedTx(null); setJobAccountDetails(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col w-[95vw] sm:w-auto">
            <DialogHeader className="border-b pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <DialogTitle className="text-base sm:text-lg">Allocation Details</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">Job ID: {selectedTx?.directDepositJob_ID} | POS Item: {selectedTx?.posItemID}</DialogDescription>
                    </div>
                    <div className="flex gap-2">
                         {selectedTx && isErrorStatus(selectedTx.job_Status) && (
                             <Button size="sm" variant="outline" className="text-xs sm:text-sm text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => selectedTx && handleRetry(selectedTx)} disabled={retrying === selectedTx?.directDepositJob_ID} data-testid="button-retry-dialog">
                                 {retrying === selectedTx?.directDepositJob_ID ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Retry</span></>}
                             </Button>
                         )}
                         <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={handlePrint}>
                            <Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Print</span>
                         </Button>
                    </div>
                </div>
            </DialogHeader>
            
            {selectedTx && (
                <div className="space-y-6 overflow-y-auto p-4 flex-1" ref={receiptRef}>
                    <div className="flex justify-between items-start border-b pb-4">
                        <div className="flex gap-4">
                           <div className="h-12 w-12 bg-[var(--pos-accent)] rounded flex items-center justify-center text-white font-bold text-xl">
                                M
                           </div>
                           <div>
                               <h2 className="text-xl font-bold text-[#2E2E2E]">Platinum POS</h2>
                               <p className="text-sm text-muted-foreground">Direct Deposit Allocation Report</p>
                           </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-medium text-[#6B6B6B]">Report Date</div>
                            <div className="font-mono text-sm">{new Date().toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '')}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                        <div>
                             <h3 className="font-bold text-sm text-[#2E2E2E] uppercase tracking-wider mb-4 border-b pb-2">Allocation Info</h3>
                             <dl className="space-y-2 text-sm">
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">File:</dt>
                                    <dd className="col-span-2 font-medium">{selectedTx.fileName}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Reference:</dt>
                                    <dd className="col-span-2"><span className="inline-flex items-center text-[11px] font-medium tracking-wide text-[var(--pos-accent-dark)] bg-[var(--pos-accent-tint)] px-2.5 py-0.5 rounded-full max-w-full truncate">{selectedTx.paymentReference && selectedTx.paymentReference !== '0' ? selectedTx.paymentReference : '-'}</span></dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Payment Type:</dt>
                                    <dd className="col-span-2 font-medium">{getPaymentTypeName(selectedTx.paymentTypeID)}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">File Date:</dt>
                                    <dd className="col-span-2">{formatDateTime(selectedTx.fileDate)}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Captured:</dt>
                                    <dd className="col-span-2">{formatDateTime(selectedTx.dateCaptured)}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Process:</dt>
                                    <dd className="col-span-2">
                                        <Badge variant="secondary" className={`border ${getProcessBadgeColor(selectedTx.process)} shadow-none`}>{selectedTx.process}</Badge>
                                    </dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Financial Year:</dt>
                                    <dd className="col-span-2">{selectedTx.financialYear}</dd>
                                </div>
                             </dl>
                        </div>
                        <div>
                             <h3 className="font-bold text-sm text-[#2E2E2E] uppercase tracking-wider mb-4 border-b pb-2">Status & Amount</h3>
                             <dl className="space-y-2 text-sm">
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Status:</dt>
                                    <dd className="col-span-2">
                                        <Badge className={`shadow-none border ${getStatusBadge(selectedTx.job_Status)}`}>
                                            {selectedTx.job_Status === 'Bulk allocations complete' ? 'Completed' : selectedTx.job_Status}
                                        </Badge>
                                    </dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Method:</dt>
                                    <dd className="col-span-2">
                                        <Badge variant="secondary" className={isManual(selectedTx) ? 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]' : 'bg-purple-100 text-purple-700 border-purple-200'}>
                                            {isManual(selectedTx) ? 'Manual' : 'Bulk'}
                                        </Badge>
                                    </dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Records:</dt>
                                    <dd className="col-span-2 font-medium">{selectedTx.records}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">POS Item ID:</dt>
                                    <dd className="col-span-2 font-mono">{selectedTx.posItemID}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Cashier ID:</dt>
                                    <dd className="col-span-2 font-mono">{selectedTx.cashierID}</dd>
                                </div>
                                {selectedTx.filePath && (
                                    <div className="grid grid-cols-3">
                                        <dt className="text-muted-foreground">File Path:</dt>
                                        <dd className="col-span-2 font-mono text-xs break-all">{selectedTx.filePath}</dd>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 mt-4 pt-2 border-t">
                                    <dt className="font-bold text-[#2E2E2E]">Total Amount:</dt>
                                    <dd className="col-span-2 font-bold text-[#2E2E2E]">R {selectedTx.allocatedAmount.toFixed(2)}</dd>
                                </div>
                             </dl>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="font-bold text-sm text-[#2E2E2E] uppercase tracking-wider mb-3">Allocated Account(s)</h3>
                        {detailsLoading ? (
                            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading account details...
                            </div>
                        ) : jobAccountDetails && jobAccountDetails.length > 0 ? (
                            <div className="border border-[#D6D6D6] rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-[#F7F7F7]">
                                            <TableHead className="text-xs">Account No</TableHead>
                                            <TableHead className="text-xs">Name</TableHead>
                                            <TableHead className="text-xs text-right">Amount</TableHead>
                                            <TableHead className="text-xs text-center">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {jobAccountDetails.map((acc: any, idx: number) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono text-xs">{acc.accountNo || acc.accountNumber || acc.account_No || acc.accountId || '-'}</TableCell>
                                                <TableCell className="text-xs">{acc.name || acc.accountName || acc.surname || acc.description || '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">R {Number(acc.amount ?? acc.allocatedAmount ?? 0).toFixed(2)}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={`shadow-none border text-[10px] ${acc.status === 'Error' || acc.errorMessage ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                        {acc.status || (acc.errorMessage ? 'Error' : 'OK')}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground py-2">No account allocation details available for this job.</p>
                        )}
                    </div>

                    <div className="border-t pt-4 text-xs text-center text-muted-foreground mt-4">
                        <p>Generated by Platinum POS System</p>
                    </div>
                </div>
            )}
        </DialogContent>
       </Dialog>
    </PosLayout>
  );
}