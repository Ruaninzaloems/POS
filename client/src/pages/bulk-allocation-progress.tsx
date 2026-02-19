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
import {
  Search, Filter, RotateCcw, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, AlertCircle, CheckCircle2, Clock, XCircle, Activity, FileBarChart, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  fetchBulkProgressFinancialYears,
  fetchBulkProgressMonthList,
  fetchBulkProgressProcessList,
  fetchBulkAllocationList,
  fetchBulkProgressDirectDeposit,
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

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);

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
        count = result['@odata.count'] ?? result.totalCount ?? result.value.length;
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

  async function viewJobDetail(job: any) {
    setSelectedJob(job);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);

    const jobId = job.directDepositJob_ID ?? job.jobId ?? job.id ?? job.bulkAllocationId;
    if (!jobId) {
      setDetailData(job);
      setDetailLoading(false);
      return;
    }

    try {
      const data = await fetchBulkProgressDirectDeposit(jobId);
      setDetailData(data || job);
    } catch {
      setDetailData(job);
    } finally {
      setDetailLoading(false);
    }
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

  const completedCount = allocationData.filter(j => {
    const s = getJobStatus(j);
    return s.includes('complete') || s === 'success' || s === 'done';
  }).length;
  const errorCount = allocationData.filter(j => {
    const s = getJobStatus(j);
    return s.includes('fail') || s.includes('error');
  }).length;
  const inProgressCount = allocationData.filter(j => {
    const s = getJobStatus(j);
    return s.includes('progress') || s.includes('processing') || s.includes('running') || s.includes('busy') || s.includes('pending');
  }).length;

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
      <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <span className="text-sm font-mono text-right max-w-[60%] break-words">{display}</span>
      </div>
    );
  }

  return (
    <PosLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto" data-testid="bulk-allocation-progress-page">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileBarChart className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900" data-testid="text-page-title">Bulk Allocation Progress</h1>
            <p className="text-sm text-muted-foreground">Monitor and track bulk allocation jobs, progress, and errors</p>
          </div>
        </div>

        <Card data-testid="card-filters">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" /> Search Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={() => { setPage(1); searchAllocations(1); }}
                disabled={loading || loadingFilters}
                className="gap-1.5"
                data-testid="button-search"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </Button>
              <Button variant="outline" onClick={resetFilters} className="gap-1.5" data-testid="button-reset">
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Per page:</Label>
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
          </CardContent>
        </Card>

        {hasSearched && allocationData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="summary-cards">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Jobs</p>
                  <p className="text-lg font-bold" data-testid="text-total-count">{formatNumber(totalCount)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-lg font-bold text-green-700" data-testid="text-completed-count">{completedCount}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                  <p className="text-lg font-bold text-blue-700" data-testid="text-progress-count">{inProgressCount}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Errors</p>
                  <p className="text-lg font-bold text-red-700" data-testid="text-error-count">{errorCount}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <Card data-testid="card-results">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm text-muted-foreground">Searching bulk allocations...</p>
              </div>
            ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-3 bg-blue-50 rounded-full mb-3">
                  <FileBarChart className="w-8 h-8 text-blue-400" />
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
            ) : (
              <>
                <div className="overflow-x-auto">
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
                      {allocationData.map((job, idx) => {
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); viewJobDetail(job); }}
                                data-testid={`button-view-${jobId}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t" data-testid="pagination">
                  <p className="text-sm text-muted-foreground">
                    Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {formatNumber(totalCount)} results
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => handlePageChange(1)} data-testid="button-first-page">
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => handlePageChange(page - 1)} data-testid="button-prev-page">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm px-3 font-medium">
                      Page {page} of {totalPages}
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
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-job-detail">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-500" />
                Job Details {selectedJob && `— #${selectedJob.jobId ?? selectedJob.id ?? ''}`}
              </DialogTitle>
              <DialogDescription>
                Detailed information for this bulk allocation job
              </DialogDescription>
            </DialogHeader>
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                <p className="text-sm text-muted-foreground">Loading job details...</p>
              </div>
            ) : detailData ? (
              <div className="space-y-1">
                {renderDetailField('Job ID', detailData.directDepositJob_ID ?? detailData.jobId ?? detailData.id)}
                {renderDetailField('Process', detailData.process)}
                {renderDetailField('Payment Reference', detailData.paymentReference)}
                {renderDetailField('Financial Year', detailData.financialYear)}
                {renderDetailField('Billing Period ID', detailData.billPeriodId)}
                <div className="flex justify-between py-2 items-center">
                  <span className="text-sm text-muted-foreground font-medium">Status</span>
                  {getStatusBadge(detailData.job_Status ?? detailData.status)}
                </div>
                {renderDetailField('File Name', detailData.fileName)}
                {renderDetailField('File Path', detailData.filePath)}
                {renderDetailField('File Date', detailData.fileDate)}
                {renderDetailField('Date Captured', detailData.dateCaptured)}
                {renderDetailField('Records', detailData.records ?? detailData.totalRecords)}
                {renderDetailField('Allocated Amount', detailData.allocatedAmount != null
                  ? `R ${Number(detailData.allocatedAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : null)}
                {renderDetailField('Payment Type ID', detailData.paymentTypeID)}
                {renderDetailField('Cashier ID', detailData.cashierID)}
                {renderDetailField('Capturer ID', detailData.capturerID)}
                {renderDetailField('Group ID', detailData.groupID)}
                {renderDetailField('POS Item ID', detailData.posItemID)}

                {Object.entries(detailData).map(([key, value]) => {
                  const knownKeys = ['directDepositJob_ID', 'jobId', 'id', 'process', 'paymentReference',
                    'financialYear', 'billPeriodId', 'job_Status', 'status', 'fileName', 'filePath',
                    'fileDate', 'dateCaptured', 'records', 'totalRecords', 'allocatedAmount',
                    'paymentTypeID', 'cashierID', 'capturerID', 'groupID', 'posItemID'];
                  if (knownKeys.includes(key)) return null;
                  if (value == null || value === '' || typeof value === 'object') return null;
                  const label = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())
                    .replace(/_/g, ' ')
                    .trim();
                  return <React.Fragment key={key}>{renderDetailField(label, value)}</React.Fragment>;
                })}

                {detailData.errors && Array.isArray(detailData.errors) && detailData.errors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Errors ({detailData.errors.length})
                    </h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {detailData.errors.map((err: any, i: number) => (
                        <div key={i} className="bg-red-50 border border-red-100 rounded p-2 text-xs">
                          {typeof err === 'string' ? err : (
                            <>
                              {err.accountNo && <span className="font-mono font-bold mr-2">{err.accountNo}</span>}
                              {err.message || err.error || err.description || JSON.stringify(err)}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailData.errorDetails && typeof detailData.errorDetails === 'string' && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Error Details
                    </h4>
                    <div className="bg-red-50 border border-red-100 rounded p-2 text-xs font-mono whitespace-pre-wrap">
                      {detailData.errorDetails}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No detail data available for this job.
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PosLayout>
  );
}
