import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpTip } from '@/components/ui/help-tip';
import {
  Search, Filter, RotateCcw, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, AlertCircle, CheckCircle2, Clock, XCircle, Activity, FileBarChart, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw,
  Hash, Layers, Calendar, DollarSign, User, FileText, CreditCard, Package
} from 'lucide-react';
import {
  fetchBulkProgressFinancialYears,
  fetchBulkProgressMonthList,
  fetchBulkProgressProcessList,
  fetchBulkAllocationList,
  fetchBulkProgressDirectDeposit,
  fetchViewReceiptCashiers,
  platinumGetPosItemDetails,
  retryBulkAllocationJob,
  type BulkProgressSearchQuery,
} from '@/lib/external-api';
import { useToast } from '@/hooks/use-toast';

function getStatusBadge(status: string | null | undefined) {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  const s = status.toLowerCase();
  if (s.includes('complete') || s === 'success' || s === 'done')
    return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />{status}</Badge>;
  if (s.includes('progress') || s.includes('processing') || s.includes('running') || s.includes('busy'))
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
  if (s.includes('fail') || s.includes('error'))
    return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
  if (s.includes('pending') || s.includes('queued') || s.includes('waiting'))
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
  if (s.includes('cancel'))
    return <Badge className="bg-gray-100 text-gray-700 border-gray-200"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  } catch { return val; }
}

function formatNumber(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('en-ZA');
}

export default function BulkAllocationProgress() {
  const { toast } = useToast();

  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [monthList, setMonthList] = useState<any[]>([]);
  const [processList, setProcessList] = useState<any[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedProcess, setSelectedProcess] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<string>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [allocationData, setAllocationData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  async function loadFilterOptions() {
    setLoadingFilters(true);
    try {
      const [years, months, processes] = await Promise.all([
        fetchBulkProgressFinancialYears(),
        fetchBulkProgressMonthList(),
        fetchBulkProgressProcessList(),
      ]);
      setFinancialYears(years);
      setMonthList(months);
      setProcessList(processes);

      if (years.length > 0) {
        const defaultYear = typeof years[0] === 'object' ? (years[0].value || years[0].id || years[0].name || String(years[0])) : String(years[0]);
        setSelectedYear(defaultYear);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: 'Failed to load filter options: ' + e.message, variant: 'destructive' });
    } finally {
      setLoadingFilters(false);
    }
  }

  const searchAllocations = useCallback(async (p?: number) => {
    const currentPage = p ?? page;
    setLoading(true);
    setHasSearched(true);
    try {
      const query: BulkProgressSearchQuery = {
        financialYear: selectedYear && selectedYear !== '__all__' ? selectedYear : null,
        process: selectedProcess && selectedProcess !== '__all__' ? selectedProcess : null,
        billingMonth: selectedMonth && selectedMonth !== '__all__' ? parseInt(selectedMonth, 10) : null,
        orderby: sortField || null,
        page: currentPage,
        pageSize,
        shortDirection: sortDirection || null,
      };
      const result = await fetchBulkAllocationList(query);

      let items: any[] = [];
      let count = 0;

      if (Array.isArray(result)) {
        items = result;
        count = result.length;
      } else if (result?.data && Array.isArray(result.data)) {
        items = result.data;
        count = result.totalCount ?? result.total ?? result.data.length;
      } else if (result?.value && Array.isArray(result.value)) {
        items = result.value;
        count = result.totalCount ?? result.value.length;
      } else if (result?.items && Array.isArray(result.items)) {
        items = result.items;
        count = result.totalCount ?? result.total ?? result.items.length;
      } else {
        items = [];
        count = 0;
      }

      setAllocationData(items);
      setTotalCount(count);
    } catch (e: any) {
      toast({ title: 'Search Error', description: e.message, variant: 'destructive' });
      setAllocationData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedProcess, selectedMonth, sortField, sortDirection, page, pageSize, toast]);

  const cashierCacheRef = React.useRef<Map<number, string>>(new Map());
  const [cashierCacheLoaded, setCashierCacheLoaded] = React.useState(false);

  const loadCashierCache = useCallback(async () => {
    if (cashierCacheLoaded) return;
    try {
      const cashiers = await fetchViewReceiptCashiers();
      if (Array.isArray(cashiers)) {
        cashiers.forEach((c: any) => {
          const id = c.id ?? c.cashierId ?? c.userId;
          const name = c.name ?? c.cashierName ?? c.userName ?? c.fullName;
          if (id && name) cashierCacheRef.current.set(Number(id), name);
        });
      }
      setCashierCacheLoaded(true);
    } catch {}
  }, [cashierCacheLoaded]);

  function resolveCashierName(id: number | null | undefined): string | null {
    if (id == null) return null;
    return cashierCacheRef.current.get(Number(id)) || null;
  }

  async function viewJobDetail(job: any) {
    setSelectedJob(job);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);

    loadCashierCache();

    const jobId = job.directDepositJob_ID ?? job.jobId ?? job.id ?? job.bulkAllocationId;
    if (!jobId) {
      setDetailData(job);
      setDetailLoading(false);
      return;
    }

    try {
      const [data, posItemData] = await Promise.all([
        fetchBulkProgressDirectDeposit(jobId),
        job.posItemID ? platinumGetPosItemDetails(job.posItemID).catch(() => null) : Promise.resolve(null),
      ]);

      const enriched = { ...(data || job) };
      if (posItemData && posItemData.posItem_ID) {
        enriched._posItemNote = posItemData.note || posItemData.description || posItemData.reference || null;
        enriched._posItemAmount = posItemData.amount;
        enriched._posItemDate = posItemData.dateOfTransaction || posItemData.dateCaptured;
      }
      setDetailData(enriched);
    } catch {
      setDetailData(job);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRetryJob(job: any, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const jobId = job.directDepositJob_ID ?? job.jobId ?? job.id;
    const userId = job.capturerID ?? job.cashierID ?? 0;
    if (!jobId) {
      toast({ title: 'Error', description: 'Cannot determine Job ID for retry', variant: 'destructive' });
      return;
    }
    setRetryingJobId(jobId);
    try {
      await retryBulkAllocationJob(jobId, userId);
      toast({ title: 'Retry Submitted', description: `Job #${jobId} has been resubmitted for processing.` });
      searchAllocations(page);
    } catch (err: any) {
      toast({ title: 'Retry Failed', description: err.message || 'Could not retry this job', variant: 'destructive' });
    } finally {
      setRetryingJobId(null);
    }
  }

  function isErrorStatus(job: any): boolean {
    const s = getJobStatus(job);
    return s.includes('fail') || s.includes('error');
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    searchAllocations(newPage);
  }

  function resetFilters() {
    setSelectedYear(financialYears.length > 0
      ? (typeof financialYears[0] === 'object' ? (financialYears[0].value || financialYears[0].id || String(financialYears[0])) : String(financialYears[0]))
      : '');
    setSelectedProcess('');
    setSelectedMonth('');
    setSortField('');
    setSortDirection('desc');
    setPage(1);
    setStatusFilter(null);
    setAllocationData([]);
    setTotalCount(0);
    setHasSearched(false);
  }

  function getOptionLabel(item: any): string {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    return item?.label || item?.name || item?.description || item?.text || item?.value || String(item);
  }
  function getOptionValue(item: any): string {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    return item?.value ?? item?.id ?? item?.name ?? String(item);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function getJobStatus(j: any): string {
    return (j.job_Status || j.status || j.jobStatus || '').toLowerCase();
  }

  function getStatusCategory(s: string): string {
    if (s.includes('rebuild')) return 'rebuilds';
    if (s.includes('recon') || s.includes('reconcil')) return 'recon';
    if (s.includes('complete') || s === 'success' || s === 'done') return 'completed';
    if (s.includes('fail') || s.includes('error')) return 'failed';
    if (s.includes('progress') || s.includes('processing') || s.includes('running') || s.includes('busy')) return 'in_progress';
    if (s.includes('pending') || s.includes('queued') || s.includes('waiting')) return 'pending';
    if (s.includes('cancel')) return 'cancelled';
    return 'other';
  }

  const statusCounts = allocationData.reduce((acc, j) => {
    const cat = getStatusCategory(getJobStatus(j));
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredByStatus = statusFilter
    ? allocationData.filter(j => getStatusCategory(getJobStatus(j)) === statusFilter)
    : allocationData;

  function toggleStatusFilter(cat: string) {
    setStatusFilter(prev => prev === cat ? null : cat);
  }

  const statusCards = [
    { key: 'all', label: 'Total Jobs', count: allocationData.length, icon: Activity, color: 'blue', textColor: 'text-[var(--pos-accent)]' },
    { key: 'rebuilds', label: 'Performing Rebuilds', count: statusCounts.rebuilds || 0, icon: RotateCcw, color: 'orange', textColor: 'text-orange-700' },
    { key: 'recon', label: 'Completing Recon', count: statusCounts.recon || 0, icon: Activity, color: 'purple', textColor: 'text-purple-700' },
    { key: 'in_progress', label: 'In Progress', count: statusCounts.in_progress || 0, icon: Clock, color: 'blue', textColor: 'text-[var(--pos-accent)]' },
    { key: 'completed', label: 'Completed', count: statusCounts.completed || 0, icon: CheckCircle2, color: 'green', textColor: 'text-green-700' },
    { key: 'pending', label: 'Pending', count: statusCounts.pending || 0, icon: Clock, color: 'yellow', textColor: 'text-yellow-700' },
    { key: 'failed', label: 'Failed', count: statusCounts.failed || 0, icon: XCircle, color: 'red', textColor: 'text-red-700' },
    { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled || 0, icon: XCircle, color: 'gray', textColor: 'text-gray-600' },
  ];

  function SortableHeader({ field, label }: { field: string; label: string }) {
    const isActive = sortField === field;
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={() => handleSort(field)}
        data-testid={`header-sort-${field}`}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-30" />
          )}
        </div>
      </TableHead>
    );
  }

  function renderDetailField(label: string, value: any) {
    if (value == null || value === '') return null;
    const display = typeof value === 'number' ? formatNumber(value) :
      (typeof value === 'string' && (value.includes('T') || value.includes('Z')) && !isNaN(Date.parse(value)))
        ? formatDate(value) : String(value);
    return (
      <div className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-gray-100 last:border-0 gap-0.5 sm:gap-2">
        <span className="text-xs sm:text-sm text-muted-foreground font-medium">{label}</span>
        <span className="text-sm font-mono sm:text-right max-w-full sm:max-w-[60%] break-words">{display}</span>
      </div>
    );
  }

  return (
    <PosLayout>
      <div className="flex flex-col h-full overflow-hidden" data-testid="bulk-allocation-progress-page">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
              <FileBarChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E]" data-testid="text-page-title">Bulk Allocation Progress</h1>
              <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Monitor and track bulk allocation jobs, progress, and errors</p>
            </div>
          </div>

          <div className="bg-[#F7F7F7] rounded-xl p-4 border border-[#D6D6D6]" data-testid="card-filters">
            <div className="text-sm font-medium flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4" /> Search Filters
            </div>
            <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Financial Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear} disabled={loadingFilters} data-testid="select-financial-year">
                  <SelectTrigger data-testid="trigger-financial-year">
                    <SelectValue placeholder={loadingFilters ? 'Loading...' : 'All Years'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Years</SelectItem>
                    {financialYears.map((fy, i) => (
                      <SelectItem key={i} value={getOptionValue(fy)}>{getOptionLabel(fy)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Process</Label>
                <Select value={selectedProcess} onValueChange={setSelectedProcess} disabled={loadingFilters} data-testid="select-process">
                  <SelectTrigger data-testid="trigger-process">
                    <SelectValue placeholder={loadingFilters ? 'Loading...' : 'All Processes'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Processes</SelectItem>
                    {processList.map((p, i) => (
                      <SelectItem key={i} value={getOptionValue(p)}>{getOptionLabel(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Billing Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loadingFilters} data-testid="select-billing-month">
                  <SelectTrigger data-testid="trigger-billing-month">
                    <SelectValue placeholder={loadingFilters ? 'Loading...' : 'All Months'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Months</SelectItem>
                    {monthList.map((m, i) => (
                      <SelectItem key={i} value={getOptionValue(m)}>{getOptionLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Status</Label>
                <Select value={statusFilter ?? '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? null : v)} data-testid="select-status-filter">
                  <SelectTrigger data-testid="trigger-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed / Error</SelectItem>
                    <SelectItem value="rebuilds">Performing Rebuilds</SelectItem>
                    <SelectItem value="recon">Completing Recon</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                onClick={() => { setPage(1); searchAllocations(1); }}
                disabled={loading || loadingFilters}
                className="gap-1.5 flex-1 sm:flex-none"
                data-testid="button-search"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </Button>
              <Button variant="outline" onClick={resetFilters} className="gap-1.5 flex-1 sm:flex-none" data-testid="button-reset">
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs text-muted-foreground hidden sm:inline">Per page:</Label>
                <Select value={String(pageSize)} onValueChange={v => { setPageSize(parseInt(v, 10)); setPage(1); }} data-testid="select-page-size">
                  <SelectTrigger className="w-20 h-8" data-testid="trigger-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6 space-y-3 sm:space-y-4">

        {hasSearched && allocationData.length > 0 && (
          <div data-testid="summary-cards">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground">Status Overview</span>
              <HelpTip text="Shows the status of each account being processed in the bulk allocation." side="right" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {statusCards.filter(c => c.key === 'all' || c.count > 0).map((card) => {
                const IconComp = card.icon;
                const isActive = (card.key === 'all' && statusFilter === null) || statusFilter === card.key;
                const colorMap: Record<string, string> = {
                  blue: 'bg-[var(--pos-accent-tint)] border-[#D6D6D6] text-[var(--pos-accent)]',
                  green: 'bg-green-50 border-green-200 text-green-500',
                  red: 'bg-red-50 border-red-200 text-red-500',
                  orange: 'bg-orange-50 border-orange-200 text-orange-500',
                  purple: 'bg-purple-50 border-purple-200 text-purple-500',
                  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-500',
                  gray: 'bg-gray-50 border-gray-200 text-gray-500',
                };
                const ringMap: Record<string, string> = {
                  blue: 'ring-[var(--pos-accent)]', green: 'ring-green-400', red: 'ring-red-400',
                  orange: 'ring-orange-400', purple: 'ring-purple-400', yellow: 'ring-yellow-400', gray: 'ring-gray-400',
                };
                return (
                  <Card
                    key={card.key}
                    className={`p-2.5 sm:p-3 cursor-pointer transition-all hover:shadow-md ${isActive ? `ring-2 ${ringMap[card.color]} shadow-md` : 'hover:ring-1 hover:ring-gray-200'}`}
                    onClick={() => card.key === 'all' ? setStatusFilter(null) : toggleStatusFilter(card.key)}
                    data-testid={`card-status-${card.key}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${colorMap[card.color]}`}>
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{card.label}</p>
                        <p className={`text-base sm:text-lg font-bold ${card.textColor}`}>{card.count}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {statusFilter && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="gap-1 text-xs">
                  Filtered: {statusCards.find(c => c.key === statusFilter)?.label}
                  <button onClick={() => setStatusFilter(null)} className="ml-1 hover:text-red-500">
                    <XCircle className="w-3 h-3" />
                  </button>
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Showing {filteredByStatus.length} of {allocationData.length} jobs
                </span>
              </div>
            )}
          </div>
        )}

        <Card data-testid="card-results">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--pos-accent)] mb-3" />
                <p className="text-sm text-muted-foreground">Searching bulk allocations...</p>
              </div>
            ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-3 bg-[var(--pos-accent-tint)] rounded-full mb-3">
                  <FileBarChart className="w-8 h-8 text-[var(--pos-accent)]" />
                </div>
                <p className="font-semibold text-gray-700">Bulk Allocation Progress</p>
                <p className="text-sm text-muted-foreground mt-1">Select filters and click Search to view allocation jobs</p>
              </div>
            ) : allocationData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-3 bg-gray-50 rounded-full mb-3">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <p className="font-semibold text-gray-700">No Results Found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your filter criteria</p>
              </div>
            ) : filteredByStatus.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-3 bg-gray-50 rounded-full mb-3">
                  <Filter className="w-8 h-8 text-gray-400" />
                </div>
                <p className="font-semibold text-gray-700">No Jobs Match This Status</p>
                <p className="text-sm text-muted-foreground mt-1">Click a different status card or clear the filter</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setStatusFilter(null)}>Show All Jobs</Button>
              </div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="block sm:hidden divide-y" data-testid="mobile-job-list">
                  {filteredByStatus.map((job, idx) => {
                    const jobId = job.directDepositJob_ID ?? job.jobId ?? job.id ?? idx;
                    const process = job.process ?? '—';
                    const reference = job.paymentReference ?? '—';
                    const status = job.job_Status ?? job.status ?? '';
                    const dateCaptured = job.dateCaptured ?? job.fileDate ?? '';
                    const records = job.records ?? job.totalRecords;
                    const amount = job.allocatedAmount;

                    return (
                      <div
                        key={jobId}
                        className="p-3 active:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => viewJobDetail(job)}
                        data-testid={`card-job-${jobId}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono text-sm font-semibold">#{jobId}</span>
                              {getStatusBadge(status)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{process}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isErrorStatus(job) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                onClick={(e) => handleRetryJob(job, e)}
                                disabled={retryingJobId === jobId}
                                data-testid={`button-retry-mobile-${jobId}`}
                              >
                                {retryingJobId === jobId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0"
                              onClick={(e) => { e.stopPropagation(); viewJobDetail(job); }}
                              data-testid={`button-view-mobile-${jobId}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div>
                            <span className="text-muted-foreground">Ref: </span>
                            <span className="font-medium truncate">{reference}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Records: </span>
                            <span className="font-medium">{formatNumber(records)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Amount: </span>
                            <span className="font-semibold">{amount != null ? `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Date: </span>
                            <span className="font-medium">{formatDate(dateCaptured)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <SortableHeader field="directDepositJob_ID" label="Job ID" />
                        <SortableHeader field="process" label="Process" />
                        <SortableHeader field="paymentReference" label="Reference" />
                        <SortableHeader field="financialYear" label="Fin Year" />
                        <SortableHeader field="job_Status" label="Status" />
                        <SortableHeader field="dateCaptured" label="Date Captured" />
                        <SortableHeader field="fileName" label="File Name" />
                        <SortableHeader field="records" label="Records" />
                        <SortableHeader field="allocatedAmount" label="Amount" />
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredByStatus.map((job, idx) => {
                        const jobId = job.directDepositJob_ID ?? job.jobId ?? job.id ?? idx;
                        const process = job.process ?? '—';
                        const reference = job.paymentReference ?? '—';
                        const year = job.financialYear ?? '—';
                        const status = job.job_Status ?? job.status ?? '';
                        const dateCaptured = job.dateCaptured ?? job.fileDate ?? '';
                        const fileName = job.fileName ?? '—';
                        const records = job.records ?? job.totalRecords;
                        const amount = job.allocatedAmount;

                        return (
                          <TableRow
                            key={jobId}
                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => viewJobDetail(job)}
                            data-testid={`row-job-${jobId}`}
                          >
                            <TableCell className="font-mono text-sm font-medium" data-testid={`text-job-id-${jobId}`}>{jobId}</TableCell>
                            <TableCell className="text-sm" data-testid={`text-process-${jobId}`}>{process}</TableCell>
                            <TableCell className="text-sm max-w-[180px] truncate" data-testid={`text-ref-${jobId}`}>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild><span>{reference}</span></TooltipTrigger>
                                  <TooltipContent>{reference}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-sm" data-testid={`text-year-${jobId}`}>{year}</TableCell>
                            <TableCell data-testid={`badge-status-${jobId}`}>{getStatusBadge(status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(dateCaptured)}</TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild><span>{fileName}</span></TooltipTrigger>
                                  <TooltipContent>{fileName}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-sm font-medium text-right">{formatNumber(records)}</TableCell>
                            <TableCell className="text-sm font-medium text-right">
                              {amount != null ? `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => { e.stopPropagation(); viewJobDetail(job); }}
                                        data-testid={`button-view-${jobId}`}
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View Details</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {isErrorStatus(job) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                          onClick={(e) => handleRetryJob(job, e)}
                                          disabled={retryingJobId === jobId}
                                          data-testid={`button-retry-${jobId}`}
                                        >
                                          {retryingJobId === jobId ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <RefreshCw className="w-4 h-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Skip failed items or retry the allocation for specific accounts.</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-4 py-3 border-t gap-2" data-testid="pagination">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {statusFilter
                      ? `${filteredByStatus.length} of ${allocationData.length} jobs`
                      : `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, totalCount)} of ${formatNumber(totalCount)}`
                    }
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => handlePageChange(1)} data-testid="button-first-page">
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => handlePageChange(page - 1)} data-testid="button-prev-page">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs sm:text-sm px-2 sm:px-3 font-medium">
                      {page}/{totalPages}
                    </span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)} data-testid="button-next-page">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => handlePageChange(totalPages)} data-testid="button-last-page">
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0" data-testid="dialog-job-detail">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-full bg-[var(--pos-accent-tint)] flex items-center justify-center mb-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--pos-accent)]" />
                </div>
                <p className="text-sm font-medium text-slate-600">Loading job details...</p>
                <p className="text-xs text-slate-400 mt-1">Fetching allocation information</p>
              </div>
            ) : detailData ? (
              <>
                {(() => {
                  const jobId = detailData.directDepositJob_ID ?? detailData.jobId ?? detailData.id;
                  const jobStatus = detailData.job_Status ?? detailData.status ?? '';
                  const statusLower = (jobStatus || '').toLowerCase();
                  const isComplete = statusLower.includes('complete') || statusLower === 'success' || statusLower === 'done';
                  const isError = statusLower.includes('fail') || statusLower.includes('error');
                  const isInProgress = statusLower.includes('progress') || statusLower.includes('processing') || statusLower.includes('running');
                  const allocAmount = detailData.allocatedAmount != null ? Number(detailData.allocatedAmount) : null;
                  const recordCount = detailData.records ?? detailData.totalRecords;
                  const cashierName = detailData.cashierID != null ? (resolveCashierName(detailData.cashierID) || null) : null;
                  const capturerName = detailData.capturerID != null ? (resolveCashierName(detailData.capturerID) || null) : null;
                  const payTypeLabel = detailData.paymentTypeID != null
                    ? (detailData.paymentTypeID === 4 ? 'EFT' : detailData.paymentTypeID === 1 ? 'Cash' : detailData.paymentTypeID === 3 ? 'Credit Card' : `Type ${detailData.paymentTypeID}`)
                    : null;
                  const posItemDisplay = detailData.posItemID != null
                    ? (detailData._posItemNote
                      ? `#${detailData.posItemID} — ${detailData._posItemNote}${detailData._posItemAmount != null ? ` (R ${Number(detailData._posItemAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})` : ''}`
                      : `#${detailData.posItemID}`)
                    : null;

                  const knownKeys = ['directDepositJob_ID', 'jobId', 'id', 'process', 'paymentReference',
                    'financialYear', 'billPeriodId', 'job_Status', 'status', 'fileName', 'filePath',
                    'fileDate', 'dateCaptured', 'records', 'totalRecords', 'allocatedAmount',
                    'paymentTypeID', 'cashierID', 'capturerID', 'groupID', 'posItemID',
                    '_posItemNote', '_posItemAmount', '_posItemDate', 'errors', 'errorDetails'];
                  const extraFields = Object.entries(detailData).filter(([key, value]) =>
                    !knownKeys.includes(key) && value != null && value !== '' && typeof value !== 'object'
                  );

                  return (
                    <>
                      <div className={`px-5 sm:px-6 pt-5 sm:pt-6 pb-4 ${isComplete ? 'bg-gradient-to-br from-emerald-50 to-green-50/50' : isError ? 'bg-gradient-to-br from-red-50 to-rose-50/50' : isInProgress ? 'bg-gradient-to-br from-[var(--pos-accent-tint)] to-[var(--pos-accent-tint)]' : 'bg-gradient-to-br from-slate-50 to-[var(--pos-accent-tint)]'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isComplete ? 'bg-emerald-100 text-emerald-600' : isError ? 'bg-red-100 text-red-600' : isInProgress ? 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]' : 'bg-slate-100 text-slate-600'}`}>
                              {isComplete ? <CheckCircle2 className="w-5 h-5" /> : isError ? <XCircle className="w-5 h-5" /> : isInProgress ? <Activity className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                              <DialogTitle className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                                Job #{jobId || '—'}
                              </DialogTitle>
                              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                                {detailData.process || 'Bulk Allocation Job'}
                              </DialogDescription>
                            </div>
                          </div>
                          <div className="shrink-0 mt-0.5">
                            {getStatusBadge(jobStatus)}
                          </div>
                        </div>

                        {(allocAmount != null || recordCount != null) && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                            {allocAmount != null && (
                              <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-white/60 shadow-sm px-3 py-2.5" data-testid="detail-allocated-amount">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Allocated Amount</p>
                                <p className="text-lg sm:text-xl font-bold text-emerald-700 font-mono mt-0.5">
                                  R {allocAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            )}
                            {recordCount != null && (
                              <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-white/60 shadow-sm px-3 py-2.5" data-testid="detail-records">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Records</p>
                                <p className="text-lg sm:text-xl font-bold text-[var(--pos-accent)] font-mono mt-0.5">
                                  {formatNumber(recordCount)}
                                </p>
                              </div>
                            )}
                            {payTypeLabel && (
                              <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-white/60 shadow-sm px-3 py-2.5" data-testid="detail-payment-type">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Payment Type</p>
                                <p className="text-sm font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                  {payTypeLabel}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="px-5 sm:px-6 py-4 space-y-4">
                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                            <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5" /> Job Information
                            </h3>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {detailData.paymentReference && (
                              <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                <span className="text-xs font-medium text-slate-500">Payment Reference</span>
                                <span className="text-sm font-mono font-semibold text-slate-800">{detailData.paymentReference}</span>
                              </div>
                            )}
                            {detailData.financialYear && (
                              <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                <span className="text-xs font-medium text-slate-500">Financial Year</span>
                                <span className="text-sm font-semibold text-slate-700">{detailData.financialYear}</span>
                              </div>
                            )}
                            {detailData.billPeriodId != null && (
                              <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                <span className="text-xs font-medium text-slate-500">Billing Period ID</span>
                                <span className="text-sm font-mono text-slate-700">{detailData.billPeriodId}</span>
                              </div>
                            )}
                            {detailData.groupID != null && (
                              <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                <span className="text-xs font-medium text-slate-500">Group ID</span>
                                <span className="text-sm font-mono text-slate-700">{detailData.groupID}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {(detailData.fileName || detailData.filePath || detailData.fileDate || detailData.dateCaptured) && (
                          <div className="rounded-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> File & Dates
                              </h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {detailData.fileName && (
                                <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                  <span className="text-xs font-medium text-slate-500">File Name</span>
                                  <span className="text-sm font-mono text-slate-700 break-all">{detailData.fileName === 'Not applicable' ? <span className="text-slate-400 italic font-sans">Not applicable</span> : detailData.fileName}</span>
                                </div>
                              )}
                              {detailData.filePath && (
                                <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-start px-3 py-2.5">
                                  <span className="text-xs font-medium text-slate-500 pt-0.5">File Path</span>
                                  <span className="text-xs font-mono text-slate-600 break-all bg-slate-50 rounded px-2 py-1">{detailData.filePath}</span>
                                </div>
                              )}
                              {detailData.fileDate && (
                                <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                  <span className="text-xs font-medium text-slate-500">File Date</span>
                                  <span className="text-sm text-slate-700 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {formatDate(detailData.fileDate)}
                                  </span>
                                </div>
                              )}
                              {detailData.dateCaptured && (
                                <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                  <span className="text-xs font-medium text-slate-500">Date Captured</span>
                                  <span className="text-sm text-slate-700 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {formatDate(detailData.dateCaptured)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {(cashierName || detailData.cashierID != null || capturerName || detailData.capturerID != null) && (
                          <div className="rounded-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" /> People
                              </h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {(cashierName || detailData.cashierID != null) && (
                                <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                  <span className="text-xs font-medium text-slate-500">Cashier</span>
                                  <span className="text-sm text-slate-700">
                                    {cashierName ? (
                                      <span className="font-medium">{cashierName}</span>
                                    ) : (
                                      <span className="font-mono text-slate-500">ID: {detailData.cashierID}</span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {(capturerName || detailData.capturerID != null) && (
                                <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                  <span className="text-xs font-medium text-slate-500">Capturer</span>
                                  <span className="text-sm text-slate-700">
                                    {capturerName ? (
                                      <span className="font-medium">{capturerName}</span>
                                    ) : (
                                      <span className="font-mono text-slate-500">ID: {detailData.capturerID}</span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {posItemDisplay && (
                          <div className="rounded-lg border border-[#D6D6D6] bg-[var(--pos-accent-tint)] overflow-hidden">
                            <div className="bg-[var(--pos-accent-tint)] px-3 py-2 border-b border-[#D6D6D6]">
                              <h3 className="text-[11px] uppercase tracking-wider font-bold text-[var(--pos-accent)] flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5" /> POS Item
                              </h3>
                            </div>
                            <div className="px-3 py-3">
                              <p className="text-sm font-mono text-[#2E2E2E] break-words" data-testid="detail-pos-item">{posItemDisplay}</p>
                            </div>
                          </div>
                        )}

                        {extraFields.length > 0 && (
                          <div className="rounded-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5" /> Additional Details
                              </h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {extraFields.map(([key, value]) => {
                                const label = key
                                  .replace(/([A-Z])/g, ' $1')
                                  .replace(/^./, str => str.toUpperCase())
                                  .replace(/_/g, ' ')
                                  .trim();
                                const display = typeof value === 'number' ? formatNumber(value as number) :
                                  (typeof value === 'string' && (value.includes('T') || value.includes('Z')) && !isNaN(Date.parse(value)))
                                    ? formatDate(value) : String(value);
                                return (
                                  <div key={key} className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] items-center px-3 py-2.5">
                                    <span className="text-xs font-medium text-slate-500">{label}</span>
                                    <span className="text-sm font-mono text-slate-700 break-words">{display}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {detailData.errors && Array.isArray(detailData.errors) && detailData.errors.length > 0 && (
                          <div className="rounded-lg border border-red-200 overflow-hidden">
                            <div className="bg-red-50 px-3 py-2 border-b border-red-200">
                              <h3 className="text-[11px] uppercase tracking-wider font-bold text-red-600 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" /> Errors
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 ml-1">{detailData.errors.length}</Badge>
                              </h3>
                            </div>
                            <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
                              {detailData.errors.map((err: any, i: number) => (
                                <div key={i} className="bg-white border border-red-100 rounded-lg p-2.5 text-xs flex items-start gap-2">
                                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                  <span className="text-red-800">
                                    {typeof err === 'string' ? err : (
                                      <>
                                        {err.accountNo && <span className="font-mono font-bold mr-2 text-red-600">{err.accountNo}</span>}
                                        {err.message || err.error || err.description || JSON.stringify(err)}
                                      </>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {detailData.errorDetails && typeof detailData.errorDetails === 'string' && (
                          <div className="rounded-lg border border-red-200 overflow-hidden">
                            <div className="bg-red-50 px-3 py-2 border-b border-red-200">
                              <h3 className="text-[11px] uppercase tracking-wider font-bold text-red-600 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" /> Error Details
                              </h3>
                            </div>
                            <div className="p-3">
                              <pre className="bg-white border border-red-100 rounded-lg p-3 text-xs font-mono text-red-800 whitespace-pre-wrap overflow-x-auto">
                                {detailData.errorDetails}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Eye className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">No detail data available</p>
                <p className="text-xs text-slate-400 mt-1">Could not load information for this job</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </PosLayout>
  );
}
