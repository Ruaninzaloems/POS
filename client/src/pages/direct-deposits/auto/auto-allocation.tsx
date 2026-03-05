import React, { useState, useCallback, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { usePos } from '@/lib/pos-state';
import {
  platinumGetBulkUnprocessed,
  platinumGetBulkProcessed,
  platinumBulkReconcile,
  platinumBulkPrintProcessed,
} from '@/lib/external-api';
import { format, subDays } from 'date-fns';
import {
  Loader2, Search, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Printer, Play, Calendar, Banknote, Hash,
  FileText, ArrowRight, RotateCcw, Package, Clock, CheckCheck,
  Ban, Info, ListFilter, Eye, EyeOff
} from 'lucide-react';

interface BankReconPosItem {
  posItem_ID: number;
  dateOfTransaction: string;
  bankReconID: number;
  amount: number;
  reference: string;
  note: string | null;
  dateCaptured: string;
  capturerID: number;
  dateModified: string | null;
  modifierID: number | null;
  directDepositTypeID: number | null;
  cashbookTransactionID: number | null;
  billingAllocated: boolean;
  dateAllocated: string | null;
}

interface RejectedItem {
  item: BankReconPosItem | null;
  rejectionReason: string | null;
}

interface UnprocessedBatch {
  num: number;
  items: BankReconPosItem[];
  rejectedItems: RejectedItem[];
  cashBookAuthoriseDate: string;
  cashBookAuthoriseDateStr: string | null;
  numberOfRecords: number;
  totalValue: number;
  billingAllocated: number;
  billingAllocatedAmount: number;
  billingUnAllocated: number;
  billingUnAllocatedAmount: number;
  rejected: number;
  rejectedAmount: number;
  maxBankReconID: number | null;
}

interface ProcessedBatch {
  num: number;
  cashBookAuthoriseDate: string;
  cashBookAuthoriseDateStr: string | null;
  numberOfRecords: number;
  totalValue: number;
  posItemIds: string | null;
  numberOfRecordsProcessed: number;
  totalProcessedAmount: number;
  numberOfRecordsRejected: number;
  totalRejectedAmount: number;
}

function formatCurrency(val: number): string {
  return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch { return dateStr; }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy HH:mm');
  } catch { return dateStr; }
}

function StatCard({ label, value, subValue, icon, color, tip }: {
  label: string; value: string | number; subValue?: string; icon: React.ReactNode; color: string; tip?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white',
    green: 'from-emerald-500 to-emerald-600 text-white',
    amber: 'from-amber-500 to-amber-600 text-white',
    red: 'from-red-500 to-red-600 text-white',
    slate: 'from-slate-500 to-slate-600 text-white',
    purple: 'from-purple-500 to-purple-600 text-white',
  };
  return (
    <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br ${colorMap[color] || colorMap.blue} flex items-center justify-center shadow-sm`}>
            {icon}
          </div>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            {label}
            {tip && <HelpTip text={tip} side="top" />}
          </span>
        </div>
        <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono mt-1" data-testid={`stat-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        {subValue && <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{subValue}</div>}
      </div>
    </div>
  );
}

function AutoAllocationContent() {
  const { currentUser } = usePos();
  const { toast } = useToast();

  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unprocessedBatches, setUnprocessedBatches] = useState<UnprocessedBatch[]>([]);
  const [processedBatches, setProcessedBatches] = useState<ProcessedBatch[]>([]);
  const [expandedBatchNum, setExpandedBatchNum] = useState<number | null>(null);
  const [expandedProcessedNum, setExpandedProcessedNum] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeView, setActiveView] = useState<'unprocessed' | 'processed'>('unprocessed');
  const [showRejected, setShowRejected] = useState(false);
  const [processingBatchNum, setProcessingBatchNum] = useState<number | null>(null);

  const userId = currentUser?.id ? Number(currentUser.id) : undefined;
  const userName = currentUser?.name || 'Cashier';

  const handleFetchUnprocessed = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setExpandedBatchNum(null);
    try {
      const data = await platinumGetBulkUnprocessed({
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      });
      const batches = Array.isArray(data) ? data : (data as any)?.unProcessedBatches || (data as any)?.batches || [];
      setUnprocessedBatches(batches);

      if (batches.length === 0) {
        toast({ title: 'No unprocessed deposits found', description: 'Try adjusting the date range', variant: 'default' });
      }
    } catch (e: any) {
      const msg = e.message || 'Failed to fetch unprocessed deposits';
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, toast]);

  const handleFetchProcessed = useCallback(async () => {
    if (unprocessedBatches.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        unProcessedBatches: unprocessedBatches,
        processedBatches: processedBatches,
      };
      const data = await platinumGetBulkProcessed(payload);
      const batches = Array.isArray(data) ? data : (data as any)?.processedBatches || [];
      setProcessedBatches(batches);
      setActiveView('processed');
    } catch (e: any) {
      toast({ title: 'Error fetching processed data', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [unprocessedBatches, processedBatches, toast]);

  const handleReconcile = useCallback(async (batch: UnprocessedBatch) => {
    if (!userId || isNaN(userId)) {
      toast({ title: 'Error', description: 'Valid user ID not available. Please log in again.', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    setProcessingBatchNum(batch.num);
    setError(null);
    try {
      const payload = {
        userId: userId,
        selectedItem: batch,
        unProcessedBatches: unprocessedBatches,
        processedBatches: processedBatches,
      };
      const result = await platinumBulkReconcile(payload);
      toast({ title: 'Reconciliation complete', description: `Batch ${batch.num} processed successfully` });

      if (result?.unProcessedBatches) setUnprocessedBatches(result.unProcessedBatches);
      if (result?.processedBatches) setProcessedBatches(result.processedBatches);

      await handleFetchUnprocessed();
    } catch (e: any) {
      toast({ title: 'Reconciliation failed', description: e.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
      setProcessingBatchNum(null);
    }
  }, [userId, unprocessedBatches, processedBatches, toast, handleFetchUnprocessed]);

  const handlePrint = useCallback(async (batch: ProcessedBatch) => {
    setPrinting(true);
    try {
      const payload = {
        userName: userName,
        selectedItem: batch,
        processedBatches: processedBatches.map(b => ({
          ...b,
          items: [],
          rejectedItems: [],
        })),
      };
      const result = await platinumBulkPrintProcessed(payload);
      if (result) {
        toast({ title: 'Print report generated', description: 'The processed deposit report is ready' });
      }
    } catch (e: any) {
      toast({ title: 'Print failed', description: e.message, variant: 'destructive' });
    } finally {
      setPrinting(false);
    }
  }, [userName, processedBatches, toast]);

  const totalUnprocessedRecords = useMemo(() => unprocessedBatches.reduce((sum, b) => sum + b.numberOfRecords, 0), [unprocessedBatches]);
  const totalUnprocessedValue = useMemo(() => unprocessedBatches.reduce((sum, b) => sum + b.totalValue, 0), [unprocessedBatches]);
  const totalAllocated = useMemo(() => unprocessedBatches.reduce((sum, b) => sum + b.billingAllocated, 0), [unprocessedBatches]);
  const totalAllocatedAmount = useMemo(() => unprocessedBatches.reduce((sum, b) => sum + b.billingAllocatedAmount, 0), [unprocessedBatches]);
  const totalUnallocated = useMemo(() => unprocessedBatches.reduce((sum, b) => sum + b.billingUnAllocated, 0), [unprocessedBatches]);
  const totalUnallocatedAmount = useMemo(() => unprocessedBatches.reduce((sum, b) => sum + b.billingUnAllocatedAmount, 0), [unprocessedBatches]);
  const totalRejected = useMemo(() => unprocessedBatches.reduce((sum, b) => sum + b.rejected, 0), [unprocessedBatches]);
  const totalRejectedAmount = useMemo(() => unprocessedBatches.reduce((sum, b) => sum + b.rejectedAmount, 0), [unprocessedBatches]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E] flex items-center gap-2" data-testid="text-page-title">
                Direct Deposits Auto Allocation
                <HelpTip text="Automatically allocate EFT and direct deposit payments to consumer accounts in bulk. Select a date range, fetch unprocessed batches, and process them for automatic allocation." side="bottom" />
              </h1>
              <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Bulk process and reconcile direct deposit payments</p>
            </div>
          </div>
          {hasSearched && unprocessedBatches.length > 0 && (
            <div className="flex bg-[#F2F4F7] rounded-xl p-1 gap-1 border border-[#D6D6D6]">
              <button
                onClick={() => setActiveView('unprocessed')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeView === 'unprocessed' ? 'bg-white text-[#2E2E2E] shadow-[0_1px_3px_rgba(0,0,0,0.15)]' : 'text-[#6B6B6B] hover:text-[#2E2E2E]'}`}
                data-testid="tab-unprocessed"
              >
                Unprocessed
              </button>
              <button
                onClick={() => { setActiveView('processed'); handleFetchProcessed(); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeView === 'processed' ? 'bg-white text-[#2E2E2E] shadow-[0_1px_3px_rgba(0,0,0,0.15)]' : 'text-[#6B6B6B] hover:text-[#2E2E2E]'}`}
                data-testid="tab-processed"
              >
                Processed
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4 bg-[#F7F7F7] rounded-xl p-4 border border-[#D6D6D6]">
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-[#2E2E2E] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--pos-accent)]" />
                From Date
                <HelpTip text="Start date for the deposit search range" side="top" />
              </Label>
              <DatePicker
                date={fromDate}
                setDate={(d: Date | undefined) => d && setFromDate(d)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#2E2E2E] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--pos-accent)]" />
                To Date
                <HelpTip text="End date for the deposit search range" side="top" />
              </Label>
              <DatePicker
                date={toDate}
                setDate={(d: Date | undefined) => d && setToDate(d)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleFetchUnprocessed}
              disabled={loading}
              className="h-10 gap-2.5 px-5 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)] text-white font-semibold text-sm flex-1 sm:flex-none rounded-lg"
              data-testid="button-fetch-unprocessed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Fetch Deposits
            </Button>
            {hasSearched && (
              <Button
                onClick={handleFetchUnprocessed}
                variant="outline"
                size="icon"
                className="h-10 w-10 border-[#D6D6D6] hover:bg-[var(--pos-accent-tint)] rounded-lg"
                disabled={loading}
                data-testid="button-refresh"
              >
                <RotateCcw className="w-4 h-4 text-[#6B6B6B]" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
        {error && (
          <Alert variant="destructive" className="mb-4" data-testid="alert-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!hasSearched && (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="max-w-lg w-full">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center mx-auto mb-5 shadow-[0_4px_16px_rgba(230,165,126,0.3)]">
                  <Package className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-bold text-[#2E2E2E] mb-2">Fetch Unprocessed Deposits</h2>
                <p className="text-sm text-[#6B6B6B] max-w-sm mx-auto">Select a date range above and click "Fetch Deposits" to load unprocessed direct deposits for automatic allocation.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { step: '1', icon: <Search className="w-5 h-5" />, title: 'Search', desc: 'Set date range and fetch deposits' },
                  { step: '2', icon: <ListFilter className="w-5 h-5" />, title: 'Review', desc: 'Review batches and allocations' },
                  { step: '3', icon: <CheckCheck className="w-5 h-5" />, title: 'Process', desc: 'Reconcile and confirm deposits' },
                ].map((s) => (
                  <div key={s.step} className="bg-white rounded-xl border border-[#D6D6D6] p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-shadow">
                    <div className="w-10 h-10 rounded-full bg-[var(--pos-accent-tint-strong)] flex items-center justify-center mx-auto mb-3 text-[var(--pos-accent)]">
                      {s.icon}
                    </div>
                    <div className="text-[10px] font-bold text-[var(--pos-accent)] uppercase tracking-widest mb-1">Step {s.step}</div>
                    <div className="text-sm font-semibold text-[#2E2E2E] mb-1">{s.title}</div>
                    <div className="text-xs text-[#6B6B6B] leading-relaxed">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-[#6B6B6B]">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#D6D6D6] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.08)] mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--pos-accent)]" />
            </div>
            <p className="text-sm font-semibold text-[#2E2E2E] mb-1">Loading deposits...</p>
            <p className="text-xs text-[#6B6B6B]">Fetching data from the server</p>
          </div>
        )}

        {hasSearched && !loading && activeView === 'unprocessed' && (
          <>
            {unprocessedBatches.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4" data-testid="stats-summary">
                <StatCard
                  label="Total Records"
                  value={totalUnprocessedRecords}
                  subValue={formatCurrency(totalUnprocessedValue)}
                  icon={<Hash className="w-3.5 h-3.5 text-white" />}
                  color="blue"
                  tip="Total number of direct deposit records found in the date range"
                />
                <StatCard
                  label="Allocated"
                  value={totalAllocated}
                  subValue={formatCurrency(totalAllocatedAmount)}
                  icon={<CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  color="green"
                  tip="Records already matched to consumer accounts"
                />
                <StatCard
                  label="Unallocated"
                  value={totalUnallocated}
                  subValue={formatCurrency(totalUnallocatedAmount)}
                  icon={<Clock className="w-3.5 h-3.5 text-white" />}
                  color="amber"
                  tip="Records awaiting allocation to consumer accounts"
                />
                <StatCard
                  label="Rejected"
                  value={totalRejected}
                  subValue={formatCurrency(totalRejectedAmount)}
                  icon={<XCircle className="w-3.5 h-3.5 text-white" />}
                  color="red"
                  tip="Records that could not be automatically allocated"
                />
              </div>
            )}

            {unprocessedBatches.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <CheckCheck className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-base font-bold text-[#2E2E2E] mb-1">All Caught Up</p>
                <p className="text-sm text-[#6B6B6B] text-center max-w-xs">All deposits in the selected date range have been processed. Try a different date range to find more.</p>
              </div>
            )}

            <div className="space-y-2 sm:space-y-3" data-testid="unprocessed-batches">
              {unprocessedBatches.map((batch) => {
                const isExpanded = expandedBatchNum === batch.num;
                const isProcessingThis = processingBatchNum === batch.num;
                const allocPct = batch.numberOfRecords > 0 ? Math.round((batch.billingAllocated / batch.numberOfRecords) * 100) : 0;
                return (
                  <div key={batch.num} className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden" data-testid={`batch-unprocessed-${batch.num}`}>
                    <button
                      onClick={() => setExpandedBatchNum(isExpanded ? null : batch.num)}
                      className="w-full text-left px-3 sm:px-4 py-3 hover:bg-[#F7F7F7]/50 transition-colors"
                      data-testid={`button-expand-batch-${batch.num}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-sm">
                          {batch.num}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              Batch {batch.num}
                            </span>
                            <Badge variant="outline" className="text-[9px] h-5">
                              <Calendar className="w-2.5 h-2.5 mr-0.5" />
                              {batch.cashBookAuthoriseDateStr || formatDate(batch.cashBookAuthoriseDate)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] sm:text-xs text-slate-500">
                            <span className="flex items-center gap-0.5">
                              <Hash className="w-3 h-3" />
                              {batch.numberOfRecords} records
                            </span>
                            <span className="font-mono font-semibold text-slate-700">{formatCurrency(batch.totalValue)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="hidden sm:flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" /> {batch.billingAllocated}
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                              <Clock className="w-2.5 h-2.5" /> {batch.billingUnAllocated}
                            </span>
                            {batch.rejected > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 ring-1 ring-red-200">
                                <XCircle className="w-2.5 h-2.5" /> {batch.rejected}
                              </span>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      <div className="mt-2 w-full bg-[#F2F4F7] rounded-full h-1.5">
                        <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${allocPct}%` }} />
                      </div>
                      <div className="mt-0.5 flex justify-between text-[9px] text-slate-400">
                        <span>{allocPct}% allocated</span>
                        <span>{batch.billingUnAllocated} pending</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#D6D6D6] animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 sm:p-4 bg-[#F7F7F7]/50">
                          <div className="text-center p-2 rounded-lg bg-white border border-[#D6D6D6]">
                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Allocated</div>
                            <div className="text-sm font-bold text-emerald-700">{batch.billingAllocated}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{formatCurrency(batch.billingAllocatedAmount)}</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-white border border-[#D6D6D6]">
                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Unallocated</div>
                            <div className="text-sm font-bold text-amber-700">{batch.billingUnAllocated}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{formatCurrency(batch.billingUnAllocatedAmount)}</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-white border border-[#D6D6D6] col-span-2 sm:col-span-1">
                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Rejected</div>
                            <div className="text-sm font-bold text-red-700">{batch.rejected}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{formatCurrency(batch.rejectedAmount)}</div>
                          </div>
                        </div>

                        {batch.maxBankReconID && (
                          <div className="px-3 sm:px-4 py-1.5 bg-[#F7F7F7]/50 text-[10px] text-slate-500 flex items-center gap-1.5 border-t border-[#E5E5E5]">
                            <Info className="w-3 h-3 text-slate-400" />
                            Max Bank Recon ID: <span className="font-mono font-bold text-slate-700">{batch.maxBankReconID}</span>
                          </div>
                        )}

                        <div className="p-3 sm:p-4 border-t border-[#E5E5E5]">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              <ListFilter className="w-3.5 h-3.5 text-slate-400" />
                              Deposit Items ({batch.items?.length || 0})
                              <HelpTip text="Individual deposit records within this batch" side="right" />
                            </h4>
                            {batch.rejectedItems && batch.rejectedItems.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowRejected(!showRejected); }}
                                className="text-[10px] text-red-600 hover:text-red-800 flex items-center gap-1 font-medium"
                                data-testid={`button-toggle-rejected-${batch.num}`}
                              >
                                {showRejected ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {showRejected ? 'Hide' : 'Show'} Rejected ({batch.rejectedItems.length})
                              </button>
                            )}
                          </div>

                          {batch.items && batch.items.length > 0 && (
                            <div className="overflow-x-auto rounded-lg border border-[#D6D6D6]">
                              <table className="w-full text-xs border-collapse min-w-[700px]" data-testid={`table-items-${batch.num}`}>
                                <thead>
                                  <tr className="bg-[#F2F4F7] text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                                    <th className="text-left px-2 py-2 whitespace-nowrap">POS Item ID</th>
                                    <th className="text-left px-2 py-2 whitespace-nowrap">Date</th>
                                    <th className="text-left px-2 py-2 whitespace-nowrap">Reference</th>
                                    <th className="text-left px-2 py-2 whitespace-nowrap">Note</th>
                                    <th className="text-right px-2 py-2 whitespace-nowrap">Amount</th>
                                    <th className="text-center px-2 py-2 whitespace-nowrap">Bank Recon ID</th>
                                    <th className="text-center px-2 py-2 whitespace-nowrap">Allocated</th>
                                    <th className="text-left px-2 py-2 whitespace-nowrap">Allocated Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batch.items.map((item, idx) => (
                                    <tr key={item.posItem_ID || idx} className="border-t border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)] transition-colors" data-testid={`item-row-${item.posItem_ID}`}>
                                      <td className="px-2 py-2 font-mono text-[var(--pos-accent)] font-medium">{item.posItem_ID}</td>
                                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(item.dateOfTransaction)}</td>
                                      <td className="px-2 py-2 max-w-[150px] truncate" title={item.reference}>{item.reference || '-'}</td>
                                      <td className="px-2 py-2 max-w-[150px] truncate text-slate-500" title={item.note || ''}>{item.note || '-'}</td>
                                      <td className="px-2 py-2 text-right font-mono font-semibold whitespace-nowrap">{formatCurrency(item.amount)}</td>
                                      <td className="px-2 py-2 text-center font-mono text-slate-500">{item.bankReconID}</td>
                                      <td className="px-2 py-2 text-center">
                                        {item.billingAllocated
                                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                          : <Clock className="w-4 h-4 text-amber-400 mx-auto" />
                                        }
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-slate-500">{formatDateTime(item.dateAllocated)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {batch.items && batch.items.length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-xs">No item details available for this batch</div>
                          )}

                          {showRejected && batch.rejectedItems && batch.rejectedItems.length > 0 && (
                            <div className="mt-3">
                              <h4 className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-2">
                                <Ban className="w-3.5 h-3.5" />
                                Rejected Items ({batch.rejectedItems.length})
                              </h4>
                              <div className="overflow-x-auto rounded-lg border border-red-200">
                                <table className="w-full text-xs border-collapse min-w-[600px]" data-testid={`table-rejected-${batch.num}`}>
                                  <thead>
                                    <tr className="bg-red-50 text-[10px] uppercase tracking-wider text-red-600 font-semibold">
                                      <th className="text-left px-2 py-2">POS Item ID</th>
                                      <th className="text-left px-2 py-2">Reference</th>
                                      <th className="text-right px-2 py-2">Amount</th>
                                      <th className="text-left px-2 py-2">Rejection Reason</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {batch.rejectedItems.map((rej, idx) => (
                                      <tr key={idx} className="border-t border-red-100 hover:bg-red-50/50">
                                        <td className="px-2 py-2 font-mono">{rej.item?.posItem_ID || '-'}</td>
                                        <td className="px-2 py-2 truncate max-w-[200px]">{rej.item?.reference || '-'}</td>
                                        <td className="px-2 py-2 text-right font-mono font-semibold">{rej.item ? formatCurrency(rej.item.amount) : '-'}</td>
                                        <td className="px-2 py-2 text-red-600 font-medium">{rej.rejectionReason || 'Unknown reason'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="px-3 sm:px-4 py-3 border-t border-[#D6D6D6] bg-[#F7F7F7] flex items-center justify-between gap-2">
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            {batch.billingUnAllocated > 0
                              ? `${batch.billingUnAllocated} items pending allocation`
                              : 'All items allocated'}
                          </div>
                          <Button
                            onClick={(e) => { e.stopPropagation(); handleReconcile(batch); }}
                            disabled={processing || batch.billingUnAllocated === 0}
                            size="sm"
                            className="h-8 gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-sm"
                            data-testid={`button-reconcile-${batch.num}`}
                          >
                            {isProcessingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            {isProcessingThis ? 'Processing...' : 'Process & Reconcile'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {unprocessedBatches.length > 0 && (
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={() => {
                    if (unprocessedBatches.length > 0 && confirm('Process ALL unprocessed batches? This will reconcile all pending deposits automatically.')) {
                      (async () => {
                        for (const batch of unprocessedBatches) {
                          if (batch.billingUnAllocated > 0) {
                            await handleReconcile(batch);
                          }
                        }
                      })();
                    }
                  }}
                  disabled={processing || unprocessedBatches.every(b => b.billingUnAllocated === 0)}
                  className="h-10 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md"
                  data-testid="button-process-all"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                  Process All Batches ({unprocessedBatches.filter(b => b.billingUnAllocated > 0).length})
                </Button>
              </div>
            )}
          </>
        )}

        {hasSearched && !loading && activeView === 'processed' && (
          <>
            {processedBatches.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-[#F7F7F7] border border-[#D6D6D6] flex items-center justify-center mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <FileText className="w-8 h-8 text-[#6B6B6B]" />
                </div>
                <p className="text-base font-bold text-[#2E2E2E] mb-1">No Processed Batches</p>
                <p className="text-sm text-[#6B6B6B] text-center max-w-xs">Process unprocessed batches first to see them here.</p>
              </div>
            )}

            <div className="space-y-2 sm:space-y-3" data-testid="processed-batches">
              {processedBatches.map((batch) => {
                const isExpanded = expandedProcessedNum === batch.num;
                const successRate = batch.numberOfRecords > 0 ? Math.round((batch.numberOfRecordsProcessed / batch.numberOfRecords) * 100) : 0;
                return (
                  <div key={batch.num} className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden" data-testid={`batch-processed-${batch.num}`}>
                    <button
                      onClick={() => setExpandedProcessedNum(isExpanded ? null : batch.num)}
                      className="w-full text-left px-3 sm:px-4 py-3 hover:bg-[#F7F7F7]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-sm">
                          {batch.num}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">Processed Batch {batch.num}</span>
                            <Badge variant="outline" className="text-[9px] h-5">
                              <Calendar className="w-2.5 h-2.5 mr-0.5" />
                              {batch.cashBookAuthoriseDateStr || formatDate(batch.cashBookAuthoriseDate)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] sm:text-xs text-slate-500">
                            <span>{batch.numberOfRecords} total</span>
                            <span className="text-emerald-600 font-semibold">{batch.numberOfRecordsProcessed} processed</span>
                            {batch.numberOfRecordsRejected > 0 && (
                              <span className="text-red-500 font-semibold">{batch.numberOfRecordsRejected} rejected</span>
                            )}
                            <span className="font-mono font-semibold text-slate-700">{formatCurrency(batch.totalValue)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handlePrint(batch); }}
                            disabled={printing}
                            className="h-7 gap-1 text-[10px]"
                            data-testid={`button-print-${batch.num}`}
                          >
                            {printing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                            Print
                          </Button>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      <div className="mt-2 w-full bg-[#F2F4F7] rounded-full h-1.5">
                        <div className="bg-gradient-to-r from-emerald-400 to-teal-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${successRate}%` }} />
                      </div>
                      <div className="mt-0.5 flex justify-between text-[9px] text-slate-400">
                        <span>{successRate}% success rate</span>
                        <span>{batch.numberOfRecordsRejected} rejected</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#D6D6D6] p-3 sm:p-4 bg-[#F7F7F7]/50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="text-center p-2 rounded-lg bg-white border border-[#D6D6D6]">
                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Total Records</div>
                            <div className="text-sm font-bold text-slate-800">{batch.numberOfRecords}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{formatCurrency(batch.totalValue)}</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-white border border-emerald-200">
                            <div className="text-[9px] text-emerald-600 uppercase tracking-wider font-semibold">Processed</div>
                            <div className="text-sm font-bold text-emerald-700">{batch.numberOfRecordsProcessed}</div>
                            <div className="text-[10px] text-emerald-600 font-mono">{formatCurrency(batch.totalProcessedAmount)}</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-white border border-red-200">
                            <div className="text-[9px] text-red-600 uppercase tracking-wider font-semibold">Rejected</div>
                            <div className="text-sm font-bold text-red-700">{batch.numberOfRecordsRejected}</div>
                            <div className="text-[10px] text-red-600 font-mono">{formatCurrency(batch.totalRejectedAmount)}</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-white border border-[#D6D6D6]">
                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">POS Item IDs</div>
                            <div className="text-[10px] text-slate-600 font-mono break-all max-h-12 overflow-y-auto">{batch.posItemIds || 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DirectDepositsAutoAllocation() {
  return (
    <PosLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <AutoAllocationContent />
      </div>
    </PosLayout>
  );
}
