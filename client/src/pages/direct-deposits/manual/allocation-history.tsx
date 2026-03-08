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
import { fetchBulkAllocationList, fetchBulkProgressFinancialYears, fetchBulkProgressMonthList, fetchBulkProgressProcessList, fetchDirectDepositJobAccountDetails, fetchBulkProgressDirectDeposit, fetchDirectDepositJobDetails, fetchBulkProgressJobAccountDetails, retryBulkAllocationJob, fetchBankStatementNotes, fetchGenericImportErrors, fetchGenericImportStatus, BulkProgressSearchQuery } from '@/lib/external-api';
import { searchAccounts } from '@/lib/enquiries-service';
import { usePos } from '@/lib/pos-state';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from '@/components/ui/date-picker';
import { AccountEnquiryDialog } from '@/components/account-enquiry-dialog';
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
  
  const [financialYear, setFinancialYear] = useState(platinumUser?.finYear || '');
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
  const [enquiryAccountId, setEnquiryAccountId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [jobAccountDetails, setJobAccountDetails] = useState<any[] | null>(null);
  
  const [financialYears, setFinancialYears] = useState<string[]>(platinumUser?.finYear ? [platinumUser.finYear] : []);
  const [monthList, setMonthList] = useState<{id: number; name: string}[]>([]);
  const [processList, setProcessList] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetchBulkProgressFinancialYears(),
      fetchBulkProgressMonthList(),
      fetchBulkProgressProcessList(),
    ]).then(([years, months, processes]) => {
      if (years.length > 0) {
        setFinancialYears(years);
        if (!financialYear && years.length > 0) setFinancialYear(years[0]);
      }
      if (months.length > 0) setMonthList(months);
      if (processes.length > 0) setProcessList(processes);
    }).catch((e) => {
      console.error('Failed to load filter options from API:', e);
      toast({ title: 'Error', description: 'Failed to load filter options from API.', variant: 'destructive' });
    });
  }, []);

  const posItemNoteCache = useRef<Record<number, string>>({});

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
      const items: AllocationRecord[] = Array.isArray(result?.items || result?.data || []) ? (result?.items || result?.data || []) : [];

      const needsNote = items.filter(item =>
        (!item.paymentReference || item.paymentReference === '0') &&
        item.posItemID > 0 &&
        !posItemNoteCache.current[item.posItemID]
      );
      const uniquePosItemIds = [...new Set(needsNote.map(i => i.posItemID))];

      if (uniquePosItemIds.length > 0) {
        try {
          const notes = await fetchBankStatementNotes(uniquePosItemIds);
          Object.entries(notes).forEach(([id, note]) => {
            if (note && note !== '0') {
              posItemNoteCache.current[Number(id)] = note;
            }
          });
        } catch (err) {
          console.error('[AllocationHistory] Failed to fetch POS item notes:', err);
        }
      }

      const enriched = items.map(item => {
        if ((!item.paymentReference || item.paymentReference === '0') && posItemNoteCache.current[item.posItemID]) {
          return { ...item, paymentReference: posItemNoteCache.current[item.posItemID] };
        }
        return item;
      });

      setAllocationData(enriched);
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
          const [jobAccountResult, errorAccountResult, importErrorsResult, statusResult] = await Promise.allSettled([
              fetchBulkProgressJobAccountDetails(tx.directDepositJob_ID),
              fetchDirectDepositJobAccountDetails(tx.directDepositJob_ID),
              fetchGenericImportErrors(tx.directDepositJob_ID),
              fetchGenericImportStatus(tx.directDepositJob_ID),
          ]);

          const errorMap = new Map<string, string>();
          if (importErrorsResult.status === 'fulfilled') {
              const errData = importErrorsResult.value;
              const errList = errData?.errors || (Array.isArray(errData) ? errData : []);
              errList.forEach((e: any) => {
                  const accNo = e.accountNumber || e.accountNo || e.account_No || '';
                  const msg = e.message || e.errorMessage || e.error || e.failedStep || '';
                  if (accNo && msg) errorMap.set(accNo, msg);
              });
          }

          const receiptMap = new Map<string, string>();
          if (errorAccountResult.status === 'fulfilled') {
              const errAccts = errorAccountResult.value;
              const errItems = Array.isArray(errAccts) ? errAccts : errAccts?.items || [];
              errItems.forEach((r: any) => {
                  const accNo = r.accountNumber || r.accountNo || '';
                  const rcpt = String(r.receiptNumber ?? '').trim();
                  if (accNo && rcpt) receiptMap.set(accNo, rcpt);
              });
          }
          if (statusResult.status === 'fulfilled') {
              const statusData = statusResult.value;
              const statusRows = Array.isArray(statusData?.rows) ? statusData.rows : Array.isArray(statusData) ? statusData : [];
              statusRows.forEach((r: any) => {
                  const accNo = r.accountNumber || r.accountNo || '';
                  const rcpt = String(r.receiptNumber ?? '').trim();
                  if (accNo && rcpt && !receiptMap.has(accNo)) receiptMap.set(accNo, rcpt);
              });
          }

          let details: any[] | null = null;

          if (jobAccountResult.status === 'fulfilled') {
              const data = jobAccountResult.value;
              const items = Array.isArray(data) ? data : data?.items || data?.data || null;
              if (items && items.length > 0) {
                  details = items;
              }
          }

          if (!details && errorAccountResult.status === 'fulfilled') {
              const data = errorAccountResult.value;
              const items = Array.isArray(data) ? data : data?.items || data?.data || null;
              if (items && items.length > 0) {
                  details = items;
              }
          }

          if (details) {
              details = details.map((acc: any) => {
                  const accNo = acc.accountNo || acc.accountNumber || acc.account_No || '';
                  const isFailed = acc.status === 'Error' || acc.isAllocated === false;
                  const merged: any = { ...acc };
                  if (!merged.receiptNumber && !merged.receiptNo) {
                      const rcpt = receiptMap.get(accNo);
                      if (rcpt) merged.receiptNumber = rcpt;
                  }
                  const errMsg = errorMap.get(accNo);
                  if (errMsg && !merged.errorMessage) {
                      merged.errorMessage = errMsg;
                  }
                  if (isFailed && !merged.errorMessage && !errMsg) {
                      merged.errorMessage = 'Allocation failed — error details not available from API. Use the Retry button or check the account manually.';
                  }
                  return merged;
              });

              const needsNameLookup = details.filter((a: any) => {
                  const name = a.name || a.accountName || a.surname || a.companyName || '';
                  return !name;
              });
              if (needsNameLookup.length > 0) {
                  const nameMap = new Map<string, string>();
                  const uniqueAccNos = Array.from(new Set(needsNameLookup.map((a: any) =>
                      (a.accountNo || a.accountNumber || a.account_No || '').replace(/^0+/, '')
                  ).filter(Boolean)));
                  const batchSize = 10;
                  for (let i = 0; i < uniqueAccNos.length; i += batchSize) {
                      const batch = uniqueAccNos.slice(i, i + batchSize);
                      const lookups = batch.map(async (accNo) => {
                          try {
                              const results = await searchAccounts({ accountNo: accNo });
                              if (Array.isArray(results) && results.length > 0) {
                                  const r = results[0] as any;
                                  const name = r.name || r.ownerName || r.companyName || r.fullName || '';
                                  if (name) nameMap.set(accNo, name);
                              }
                          } catch {}
                      });
                      await Promise.all(lookups);
                  }
                  if (nameMap.size > 0) {
                      details = details.map((acc: any) => {
                          const existingName = acc.name || acc.accountName || acc.surname || acc.companyName || '';
                          if (existingName) return acc;
                          const accNo = (acc.accountNo || acc.accountNumber || acc.account_No || '').replace(/^0+/, '');
                          const lookedUpName = nameMap.get(accNo);
                          return lookedUpName ? { ...acc, accountName: lookedUpName } : acc;
                      });
                  }
              }
          }

          setJobAccountDetails(details);
      } catch (err) {
          console.error('[AllocationHistory] Failed to load job account details:', err);
      } finally {
          setDetailsLoading(false);
      }
  };

  const isErrorStatus = (status: string) => {
      const lower = status.toLowerCase();
      return lower.includes('error') || lower.includes('with errors') || lower.includes('failed');
  };

  const isStuckStatus = (status: string) => {
      const lower = status.toLowerCase();
      return lower.includes('processing') || lower.includes('rebuild') || lower.includes('reconcil');
  };

  const isJobStale = (tx: AllocationRecord) => {
      if (!isStuckStatus(tx.job_Status)) return false;
      if (!tx.dateCaptured) return false;
      const captured = new Date(tx.dateCaptured);
      if (isNaN(captured.getTime())) return false;
      const ageMinutes = (Date.now() - captured.getTime()) / (1000 * 60);
      return ageMinutes > 30;
  };

  const canRetryJob = (tx: AllocationRecord) => {
      return isErrorStatus(tx.job_Status) || isJobStale(tx);
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
      const lower = status.toLowerCase();
      if (lower.includes('error') || lower.includes('fail')) {
          return 'bg-red-100 text-red-700 border-red-200';
      } else if (lower.includes('complete') || lower === 'completed' || lower === 'success' || lower === 'done') {
          return 'bg-green-100 text-green-700 border-green-200';
      } else if (lower.includes('processing') || lower.includes('rebuild') || lower.includes('reconcil') || lower.includes('receipt')) {
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
       <div className="flex flex-col flex-1 min-h-0 overflow-auto sm:overflow-hidden">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                 <div className="flex items-center gap-3">
                     <Link href="/direct-deposits/manual">
                        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-10 sm:w-10">
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
                    <Button variant="outline" size="icon" className="h-10 w-10 sm:h-10 sm:w-10" onClick={loadData} title="Refresh" disabled={loading} data-testid="button-refresh">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" size="icon" className="h-10 w-10 sm:h-10 sm:w-10" onClick={() => handleDownload('excel')} title="Download CSV" data-testid="button-download-csv">
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
                        <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear all filters" className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" data-testid="button-clear-filters">
                            <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>
             </div>
        </div>

        <div className="sm:flex-1 sm:overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">Loading allocation history...</span>
                </div>
            ) : (
            <>
            <div className="sm:hidden space-y-3">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No allocation history found.</div>
              ) : filteredHistory.map(tx => (
                <Card key={tx.directDepositJob_ID} className="p-4" data-testid={`card-allocation-${tx.directDepositJob_ID}`}>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm break-words">{tx.fileName}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                        <span>{formatDate(tx.fileDate)}</span>
                        {tx.paymentReference && tx.paymentReference !== '0' && (
                          <>
                            <span className="text-[#D6D6D6]">|</span>
                            <span className="text-[11px] font-medium tracking-wide text-[var(--pos-accent-dark)] bg-[var(--pos-accent-tint)] px-2 py-px rounded-full truncate max-w-[180px]" title={tx.paymentReference}>{tx.paymentReference}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm shrink-0">R {tx.allocatedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <Badge variant="secondary" className={`border text-xs ${getProcessBadgeColor(tx.process)} shadow-none font-normal`}>
                      {tx.process}
                    </Badge>
                    <Badge variant="secondary" className={`text-xs ${isManual(tx) ? 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                      {isManual(tx) ? 'Manual' : 'Bulk'}
                    </Badge>
                    <Badge className={`shadow-none border text-xs ${getStatusBadge(tx.job_Status)}`}>
                      {tx.job_Status === 'Bulk allocations complete' ? 'Completed' : tx.job_Status}
                    </Badge>
                    {isJobStale(tx) && (
                      <Badge className="shadow-none border text-xs bg-amber-100 text-amber-700 border-amber-200">
                        <AlertCircle className="w-3 h-3 mr-1" />Stuck
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{tx.records} record{tx.records !== 1 ? 's' : ''}</span>
                    <div className="flex gap-2">
                      {canRetryJob(tx) && (
                        <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px] text-xs px-3 text-amber-600 border-amber-200" onClick={() => handleRetry(tx)} disabled={retrying === tx.directDepositJob_ID} data-testid={`button-retry-mobile-${tx.directDepositJob_ID}`}>
                          {retrying === tx.directDepositJob_ID ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 mr-1" /> Retry</>}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] text-xs px-3" onClick={() => openDetails(tx)} data-testid={`button-view-mobile-${tx.directDepositJob_ID}`}>
                        <Eye className="w-4 h-4 mr-1" /> Details
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="hidden sm:block overflow-x-auto">
                <Table className="min-w-[1100px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[90px]">Date</TableHead>
                            <TableHead className="w-[140px]">Captured</TableHead>
                            <TableHead className="w-[120px]">File / Description</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead className="w-[120px]">Process</TableHead>
                            <TableHead className="w-[65px]">Method</TableHead>
                            <TableHead className="w-[55px] text-center">Records</TableHead>
                            <TableHead className="w-[95px] text-right">Amount</TableHead>
                            <TableHead className="w-[180px] text-center">Status</TableHead>
                            <TableHead className="w-[100px] text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHistory.map(tx => (
                            <TableRow key={tx.directDepositJob_ID}>
                                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDate(tx.fileDate)}
                                </TableCell>
                                <TableCell className="font-mono text-xs whitespace-nowrap">
                                    {formatDateTime(tx.dateCaptured)}
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                    <div className="truncate" title={tx.fileName}>{tx.fileName}</div>
                                    {tx.filePath && (
                                        <div className="text-[10px] text-muted-foreground truncate" title={tx.filePath}>{tx.filePath}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {tx.paymentReference && tx.paymentReference !== '0' ? (
                                        <span className="inline-flex items-center text-[11px] font-medium tracking-wide text-[var(--pos-accent-dark)] bg-[var(--pos-accent-tint)] px-2 py-0.5 rounded-full truncate max-w-full" title={tx.paymentReference}>{tx.paymentReference}</span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className={`border text-[11px] ${getProcessBadgeColor(tx.process)} shadow-none font-normal`}>
                                        {tx.process}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className={`text-[11px] ${isManual(tx) ? 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
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
                                    <div className="flex flex-col items-center gap-1">
                                        <Badge className={`shadow-none border text-[11px] whitespace-nowrap ${getStatusBadge(tx.job_Status)}`}>
                                            {isStuckStatus(tx.job_Status) && !isErrorStatus(tx.job_Status) && !isJobStale(tx) && (
                                                <Loader2 className="w-3 h-3 mr-1 animate-spin inline-block" />
                                            )}
                                            {isErrorStatus(tx.job_Status) && (
                                                <AlertCircle className="w-3 h-3 mr-1 inline-block" />
                                            )}
                                            {tx.job_Status === 'Bulk allocations complete' ? 'Completed' : tx.job_Status}
                                        </Badge>
                                        {isJobStale(tx) && (
                                            <Badge className="shadow-none border text-[10px] bg-amber-100 text-amber-700 border-amber-200 whitespace-nowrap">
                                                <AlertCircle className="w-2.5 h-2.5 mr-0.5 inline" />Stuck &gt;30min
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        {canRetryJob(tx) && (
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
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 px-2 gap-3">
                    <div className="text-xs sm:text-sm text-muted-foreground">
                        Page {page} of {totalPages} ({totalCount.toLocaleString()} total)
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="min-h-[44px] sm:min-h-0 px-4 sm:px-3" data-testid="button-prev-page">
                            <ChevronLeft className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="min-h-[44px] sm:min-h-0 px-4 sm:px-3" data-testid="button-next-page">
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
        <DialogContent className="max-w-[100vw] sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col rounded-none sm:rounded-lg border-0 sm:border">
            <DialogHeader className="border-b pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <DialogTitle className="text-base sm:text-lg">Allocation Details</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">Job ID: {selectedTx?.directDepositJob_ID} | POS Item: {selectedTx?.posItemID}</DialogDescription>
                    </div>
                    <div className="flex gap-2">
                         {selectedTx && canRetryJob(selectedTx) && (
                             <Button size="sm" variant="outline" className="min-h-[44px] sm:min-h-0 text-xs sm:text-sm text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => selectedTx && handleRetry(selectedTx)} disabled={retrying === selectedTx?.directDepositJob_ID} data-testid="button-retry-dialog">
                                 {retrying === selectedTx?.directDepositJob_ID ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">{isJobStale(selectedTx) && !isErrorStatus(selectedTx.job_Status) ? 'Retry Stuck' : 'Retry'}</span></>}
                             </Button>
                         )}
                         <Button size="sm" variant="outline" className="min-h-[44px] sm:min-h-0 text-xs sm:text-sm" onClick={handlePrint} data-testid="button-print-dialog">
                            <Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Print</span>
                         </Button>
                    </div>
                </div>
            </DialogHeader>
            
            {selectedTx && (
                <div className="space-y-6 overflow-y-auto p-4 flex-1" ref={receiptRef}>
                    <div className="flex flex-col sm:flex-row justify-between items-start border-b pb-4 gap-3">
                        <div className="flex gap-3 sm:gap-4">
                           <div className="h-10 w-10 sm:h-12 sm:w-12 bg-[var(--pos-accent)] rounded flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0">
                                M
                           </div>
                           <div>
                               <h2 className="text-lg sm:text-xl font-bold text-[#2E2E2E]">Platinum POS</h2>
                               <p className="text-xs sm:text-sm text-muted-foreground">Direct Deposit Allocation Report</p>
                           </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <div className="text-xs sm:text-sm font-medium text-[#6B6B6B]">Report Date</div>
                            <div className="font-mono text-xs sm:text-sm">{new Date().toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '')}</div>
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
                                    <dd className="col-span-2 flex items-center gap-1.5 flex-wrap">
                                        <Badge className={`shadow-none border ${getStatusBadge(selectedTx.job_Status)}`}>
                                            {selectedTx.job_Status === 'Bulk allocations complete' ? 'Completed' : selectedTx.job_Status}
                                        </Badge>
                                        {isJobStale(selectedTx) && (
                                            <Badge className="shadow-none border text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                                <AlertCircle className="w-2.5 h-2.5 mr-0.5" />Stuck &gt;30min
                                            </Badge>
                                        )}
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
                            <>
                            {(() => {
                                const failedAccounts = jobAccountDetails.filter((a: any) => a.status === 'Error' || a.errorMessage || a.isAllocated === false);
                                const successCount = jobAccountDetails.length - failedAccounts.length;
                                return (
                                    <>
                                    {(failedAccounts.length > 0 || successCount > 0) && (
                                        <div className={`mb-3 p-3 border rounded-lg flex items-center justify-between ${failedAccounts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                            <div className="flex items-center gap-2">
                                                {failedAccounts.length > 0 ? (
                                                    <>
                                                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                                        <div>
                                                            <span className="text-sm font-semibold text-red-700">{failedAccounts.length} Failed Allocation{failedAccounts.length !== 1 ? 's' : ''}</span>
                                                            <p className="text-xs text-red-600">See error details below each failed account.</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-sm font-semibold text-green-700">All accounts allocated successfully</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {successCount > 0 && <Badge className="bg-green-100 text-green-700 border-green-200 shadow-none text-[10px]">{successCount} Success</Badge>}
                                                {failedAccounts.length > 0 && <Badge className="bg-red-100 text-red-700 border-red-200 shadow-none text-[10px]">{failedAccounts.length} Failed</Badge>}
                                            </div>
                                        </div>
                                    )}
                                    <div className="hidden sm:block border border-[#D6D6D6] rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[#F7F7F7]">
                                                    <TableHead className="text-xs">Account No</TableHead>
                                                    <TableHead className="text-xs">Name</TableHead>
                                                    <TableHead className="text-xs text-right">Amount</TableHead>
                                                    <TableHead className="text-xs text-center">Receipt ID</TableHead>
                                                    <TableHead className="text-xs text-center">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {jobAccountDetails.map((acc: any, idx: number) => {
                                                    const isFailed = acc.status === 'Error' || acc.errorMessage || acc.isAllocated === false;
                                                    const accNo = acc.accountNo || acc.accountNumber || acc.account_No || acc.accountId || '-';
                                                    const receiptNo = acc.receiptNumber || acc.receiptNo || acc.receipt_No || null;
                                                    return (
                                                        <React.Fragment key={idx}>
                                                            <TableRow className={isFailed ? 'bg-red-50/50' : ''}>
                                                                <TableCell className="font-mono text-xs font-medium">
                                                                    <button
                                                                        className="text-[var(--pos-accent-dark)] hover:underline cursor-pointer font-mono font-medium"
                                                                        onClick={() => setEnquiryAccountId(accNo)}
                                                                        title="Open account enquiry"
                                                                        data-testid={`link-enquiry-${idx}`}
                                                                    >
                                                                        {accNo}
                                                                    </button>
                                                                </TableCell>
                                                                <TableCell className="text-xs">{acc.name || acc.accountName || acc.surname || acc.description || acc.companyName || '-'}</TableCell>
                                                                <TableCell className="text-right font-mono text-xs">R {Number(acc.amount ?? acc.allocatedAmount ?? 0).toFixed(2)}</TableCell>
                                                                <TableCell className="text-center font-mono text-xs text-muted-foreground">{receiptNo ? String(receiptNo).trim() : '-'}</TableCell>
                                                                <TableCell className="text-center">
                                                                    <Badge className={`shadow-none border text-[10px] ${isFailed ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                                        {isFailed ? <><AlertCircle className="w-2.5 h-2.5 mr-0.5 inline" />Error</> : 'Success'}
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                            {isFailed && acc.errorMessage && (
                                                                <TableRow className="bg-red-50/30">
                                                                    <TableCell colSpan={5} className="py-1.5 px-4">
                                                                        <div className="flex items-start gap-2 text-xs text-red-700">
                                                                            <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                                                                            <span className="break-words">{acc.errorMessage}</span>
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
                                    <div className="sm:hidden space-y-2">
                                        {jobAccountDetails.map((acc: any, idx: number) => {
                                            const isFailed = acc.status === 'Error' || acc.errorMessage || acc.isAllocated === false;
                                            const receiptNo = acc.receiptNumber || acc.receiptNo || acc.receipt_No || null;
                                            return (
                                                <div key={idx} className={`border rounded-lg p-3 ${isFailed ? 'border-red-200 bg-red-50' : 'border-[#D6D6D6] bg-[#F7F7F7]'}`} data-testid={`card-account-detail-${idx}`}>
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <div className="min-w-0 flex-1">
                                                            <button
                                                                className="font-mono text-xs font-medium text-[var(--pos-accent-dark)] hover:underline cursor-pointer"
                                                                onClick={() => setEnquiryAccountId(acc.accountNo || acc.accountNumber || acc.account_No || acc.accountId || '')}
                                                                data-testid={`link-enquiry-mobile-${idx}`}
                                                            >
                                                                {acc.accountNo || acc.accountNumber || acc.account_No || acc.accountId || '-'}
                                                            </button>
                                                            <div className="text-xs text-muted-foreground truncate">{acc.name || acc.accountName || acc.surname || acc.description || acc.companyName || '-'}</div>
                                                        </div>
                                                        <Badge className={`shadow-none border text-[10px] shrink-0 ${isFailed ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                            {isFailed ? 'Error' : 'Success'}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-mono text-sm font-bold">R {Number(acc.amount ?? acc.allocatedAmount ?? 0).toFixed(2)}</div>
                                                        {receiptNo && <div className="text-[10px] text-muted-foreground font-mono">Receipt ID: {String(receiptNo).trim()}</div>}
                                                    </div>
                                                    {isFailed && acc.errorMessage && (
                                                        <div className="mt-2 p-2 bg-red-100/50 rounded border border-red-200 text-[11px] text-red-700 flex items-start gap-1.5">
                                                            <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                                                            <span className="break-words">{acc.errorMessage}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    </>
                                );
                            })()}
                            </>
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
       <AccountEnquiryDialog
           open={enquiryAccountId !== null}
           onClose={() => setEnquiryAccountId(null)}
           accountId={enquiryAccountId || ''}
       />
    </PosLayout>
  );
}