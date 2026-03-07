import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { platinumGetAuthDayEndCashierList, platinumGetAuthDayEndCashierDetails, platinumGetAuthDayEndCashierReconcile, platinumGetAuthDayEndCashbookList, platinumGetPendingCancelRequests, platinumApproveCancelReceipt, platinumDeclineCancelReceipt, platinumAuthDayEndValidateCashbook, platinumAuthDayEndSubmitReconcile, platinumAuthDayEndPrintCashReport, platinumAuthDayEndPrintDepositSlip, platinumAuthDayEndDirectCancelReceipt, platinumPerOfficeCashOfficeList, platinumPerOfficeCashOfficeSelection, platinumPerOfficeCashierSummary, platinumPerOfficeCashierReconcileStatus, platinumPerOfficeProcessStagingPayments, platinumPerOfficeAddStage, platinumPerOfficeVerifyCashierReconcile, platinumPerOfficeSubmitReconcile, platinumPerOfficeFinishStage, platinumPerOfficeCancelReceipt, platinumPerOfficeReturnReconcile, platinumPerOfficePrintCashReport, platinumPerOfficePrintDepositSlip } from '@/lib/external-api';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ArrowLeft, 
  MoreHorizontal,
  TrendingUp,
  CreditCard,
  Banknote,
  Lock,
  RotateCcw,
  Eye,
  Filter,
  Download,
  AlertTriangle,
  RefreshCcw,
  Info,
  Calendar as CalendarIcon,
  BarChart3,
  Loader2,
  Mail,
  Printer,
  Wifi,
  WifiOff,
  Trash2
} from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, subMonths } from 'date-fns';
import { usePos } from '@/lib/pos-state';
import { PosLayout } from '@/components/layout/pos-layout';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { HelpTip } from '@/components/ui/help-tip';

type DayEndStatus = 'NOT_SUBMITTED' | 'PENDING_APPROVAL' | 'RETURNED' | 'COMPLETED';
type ReconMode = 'PER_CASHIER' | 'CASH_OFFICE';

interface CashierShift {
  id: string;
  userId: number | null;
  cashierName: string;
  cashOffice: string;
  cashOfficeId: number | null;
  groupCashiers: boolean;
  startTime: string;
  endTime?: string;
  status: DayEndStatus;
  systemTotals: {
    cash: number;
    card: number;
    total: number;
  };
  declaredTotals?: {
    cash: number;
    card: number;
    total: number;
  };
  variance?: {
    cash: number;
    card: number;
    total: number;
  };
  transactionCount: number;
  reconcileId: number | null;
  returnReason?: string | null;
  hasActiveSession: boolean;
  rawData?: any;
}

interface OfficeConfig {
  groupCashiers: boolean;
  cashOfficeDesc: string;
  cashOnHandLimit: number | null;
}

const formatCurrency = (amount: number) => {
  return `R ${amount.toFixed(2)}`;
};

function extractItems(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    return data.items || data.value || data.results || data.data || data.rows || [];
  }
  return [];
}

const PAGER_BODY = { pageNumber: 1, pageSize: 100, query: "", orderBy: "" };

function mapCashierToShift(c: any, index: number, officeConfigs?: Record<string, OfficeConfig>): CashierShift {
  const id = String(c.id || c.cashierId || c.cashier_ID || c.cashier_id || index);
  const name = c.cashierName || c.name || c.userName || c.cashier_name || `Cashier ${id}`;
  const office = c.cashOfficeName || c.cashOffice || c.cash_office || c.officeName || c.office || '';
  const officeId = Number(c.cashOfficeId || c.cashOffice_ID || c.cash_office_id || c.officeId || c.office_id || 0) || null;
  const rawUserId = Number(c.user_Id || c.userId || c.user_id || c.capturerId || 0) || null;
  const rawReconcileId = Number(c.cashierReconcile_Id || c.reconcileId || c.reconcile_id || c.cashierReconcileId || 0) || null;
  const totalAmt = Number(c.totalAmount || c.totalAmt || c.total || c.systemTotal || 0);
  const cashAmt = Number(c.cashAmount || c.cashTotal || c.totalCashAmt || 0);
  const cardAmt = Number(c.cardAmount || c.cardTotal || c.totalCreditAmt || 0);
  const declaredTotal = Number(c.declaredTotal || c.declaredAmount || c.cashierTotal || c.totalDeclared || 0);
  const declaredCash = Number(c.declaredCash || c.cashierCash || 0);
  const declaredCard = Number(c.declaredCard || c.cashierCard || 0);
  const varianceTotal = Number(c.variance || c.varianceAmount || c.totalVariance || 0);
  const txCount = Number(c.transactionCount || c.receiptCount || c.txCount || c.count || 0);

  const officeConfig = officeId && officeConfigs ? officeConfigs[String(officeId)] : undefined;
  const groupCashiers = officeConfig?.groupCashiers ?? c.groupCashiers ?? false;

  let status: DayEndStatus = 'NOT_SUBMITTED';
  const rawStatus = String(c.status || c.reconcileStatus || c.dayEndStatus || '').toLowerCase().trim();
  if (rawStatus.includes('not yet submitted') || rawStatus.includes('not submitted') || rawStatus.includes('not_submitted') || rawStatus === 'not submitted') {
    status = 'NOT_SUBMITTED';
  } else if (rawStatus.includes('return')) {
    status = 'RETURNED';
  } else if (rawStatus.includes('complet') || rawStatus.includes('post') || rawStatus.includes('finish') || rawStatus.includes('approved')) {
    status = 'COMPLETED';
  } else if (rawStatus.includes('submit') || rawStatus.includes('pending') || rawStatus.includes('awaiting')) {
    status = 'PENDING_APPROVAL';
  } else if (rawStatus.includes('not') || rawStatus.includes('open') || rawStatus === '') {
    status = 'NOT_SUBMITTED';
  } else if (rawReconcileId && rawReconcileId > 0) {
    status = 'PENDING_APPROVAL';
  }

  const returnReason = c.returnReason || c.reason || c.returnedReason || c.comments || null;

  return {
    id,
    userId: rawUserId,
    cashierName: name,
    cashOffice: officeConfig?.cashOfficeDesc || office,
    cashOfficeId: officeId,
    groupCashiers,
    startTime: c.startTime || c.reconcileDate || c.date || c.createdDate || new Date().toISOString(),
    status,
    systemTotals: { cash: cashAmt, card: cardAmt, total: totalAmt || (cashAmt + cardAmt) },
    declaredTotals: declaredTotal > 0 || declaredCash > 0 ? { cash: declaredCash, card: declaredCard, total: declaredTotal || (declaredCash + declaredCard) } : undefined,
    variance: varianceTotal !== 0 ? { cash: 0, card: 0, total: varianceTotal } : { cash: 0, card: 0, total: 0 },
    transactionCount: txCount,
    reconcileId: rawReconcileId,
    returnReason,
    hasActiveSession: c.isActive === true,
    rawData: c,
  };
}

const generateFinancialYears = (currentFinYear?: string): string[] => {
  if (currentFinYear) {
    const startYear = parseInt(currentFinYear.split('/')[0]);
    if (!isNaN(startYear)) {
      return Array.from({ length: 4 }, (_, i) => `${startYear - i}/${startYear - i + 1}`);
    }
  }
  return [];
};
const MONTHS = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
];

interface PendingCancelRequest {
  id: string;
  receiptId: number;
  receiptNo: string;
  accountNumber: string;
  amount: number;
  cashierName: string;
  cashierId: number;
  reason: string;
  requestDate: string;
  paymentType: string;
  status: string;
  isMiscPayment: boolean;
  raw?: any;
}

export default function SupervisorDashboard() {
  const { returnDayEnd, approveCancellation, recentTransactions, referenceData, platinumUser, siteInfo } = usePos();
  const isSite02 = siteInfo?.id === 'site02';
  const { toast } = useToast();
  const [reconMode, setReconMode] = useState<ReconMode>('PER_CASHIER');
  
  const [pendingCancelRequests, setPendingCancelRequests] = useState<PendingCancelRequest[]>([]);
  const [cancelRequestsLoading, setCancelRequestsLoading] = useState(false);
  const [cancelActionLoading, setCancelActionLoading] = useState<string | null>(null);
  const [processedCancelRequests, setProcessedCancelRequests] = useState<PendingCancelRequest[]>([]);

  const loadPendingCancelRequests = useCallback(async () => {
    setCancelRequestsLoading(true);
    try {
      const data = await platinumGetPendingCancelRequests();
      console.log('[Supervisor] Pending cancel requests raw:', JSON.stringify(data).substring(0, 800));
      const items = Array.isArray(data) ? data : (data?.items || data?.value || data?.data || data?.results || []);
      const mapped: PendingCancelRequest[] = items.map((item: any, idx: number) => ({
        id: String(item.id || item.receiptId || item.receipt_id || idx),
        receiptId: Number(item.receiptId || item.receipt_id || item.id || 0),
        receiptNo: String(item.receiptNo || item.receipt_no || item.receiptNumber || ''),
        accountNumber: String(item.accountNumber || item.accountNo || item.account_number || ''),
        amount: Number(item.amount || item.totalAmount || item.receiptAmount || 0),
        cashierName: item.cashierName || item.cashier_name || item.requestedBy || '',
        cashierId: Number(item.cashierId || item.cashier_id || item.userId || 0),
        reason: item.reason || item.cancellationReason || item.returnReason || item.cancelReason || '',
        requestDate: item.requestDate || item.requestedDate || item.createdDate || item.date || '',
        paymentType: item.paymentType || item.payMode || '',
        status: item.status || 'PENDING',
        isMiscPayment: item.isMiscPayment === true || item.isMiscPayment === 1 || item.is_misc_payment === true,
        raw: item,
      }));
      setPendingCancelRequests(mapped);
    } catch (e: any) {
      console.error('[Supervisor] Failed to load pending cancel requests:', e);
      setPendingCancelRequests([]);
    } finally {
      setCancelRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingCancelRequests();
  }, [loadPendingCancelRequests]);

  const handleApproveCancelRequest = async (req: PendingCancelRequest) => {
    setCancelActionLoading(req.id);
    try {
      await platinumApproveCancelReceipt({
        receiptId: req.receiptId,
        reason: req.reason || 'Approved by supervisor',
        isMiscPayment: req.isMiscPayment || false,
      });
      toast({ title: 'Cancellation Approved', description: `Receipt ${req.receiptNo || req.receiptId} has been voided.` });
      setProcessedCancelRequests(prev => [...prev, { ...req, status: 'APPROVED' }]);
      setPendingCancelRequests(prev => prev.filter(r => r.id !== req.id));
      loadPendingCancelRequests();
    } catch (e: any) {
      console.error('[Supervisor] Approve cancel failed:', e);
      toast({ title: 'Error', description: `Approve failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setCancelActionLoading(null);
    }
  };

  const handleDeclineCancelRequest = async (req: PendingCancelRequest) => {
    setCancelActionLoading(req.id);
    try {
      await platinumDeclineCancelReceipt({
        receiptId: req.receiptId,
        reason: req.reason || 'Declined by supervisor',
        isMiscPayment: req.isMiscPayment || false,
      });
      toast({ title: 'Cancellation Declined', description: `Receipt ${req.receiptNo || req.receiptId} cancellation was rejected.` });
      setProcessedCancelRequests(prev => [...prev, { ...req, status: 'DECLINED' }]);
      setPendingCancelRequests(prev => prev.filter(r => r.id !== req.id));
      loadPendingCancelRequests();
    } catch (e: any) {
      console.error('[Supervisor] Decline cancel failed:', e);
      toast({ title: 'Error', description: `Decline failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setCancelActionLoading(null);
    }
  };

  const pendingCancellations = recentTransactions.filter(tx => tx.status === 'PENDING_CANCELLATION');
  const processedCancellations = recentTransactions.filter(tx => 
      tx.status === 'CANCELLED' || 
      (tx.status === 'COMPLETED' && tx.cancellationReason && tx.cancellationRequestTime)
  );
  
  const allPendingCancellationCount = pendingCancelRequests.length + pendingCancellations.length;

  const [selectedShift, setSelectedShift] = useState<CashierShift | null>(null);
  const [shifts, setShifts] = useState<CashierShift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);
  const [filterOffice, setFilterOffice] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [returnReason, setReturnReason] = useState('');
  
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState<{
    details: any;
    reconcile: any;
    cashReceipts: any[];
    cardReceipts: any[];
    chequeReceipts: any[];
    postalReceipts: any[];
    dropboxReceipts: any[];
    offlineReceipts: any[];
    systemVsCashier: any[];
  } | null>(null);
  const [reviewTab, setReviewTab] = useState('cash');
  const [actionLoading, setActionLoading] = useState(false);

  const [showVarianceHistory, setShowVarianceHistory] = useState(false);
  const [statsDateRange, setStatsDateRange] = useState<{from: Date, to: Date} | undefined>({
      from: subDays(new Date(), 30),
      to: new Date()
  });
  const [statsCashier, setStatsCashier] = useState<string>('All');
  const [statsFinancialYear, setStatsFinancialYear] = useState<string>('All');
  const [statsMonth, setStatsMonth] = useState<string>('All');

  const updateStatsPeriod = (fy: string, month: string) => {
      setStatsFinancialYear(fy);
      setStatsMonth(month);

      if (fy !== 'All') {
          const [startYearStr, endYearStr] = fy.split('/');
          const startYear = parseInt(startYearStr);
          const endYear = parseInt(endYearStr);

          if (month !== 'All') {
              const monthIndex = parseInt(month);
              let targetYear = startYear;
              if (monthIndex < 6) {
                  targetYear = endYear;
              } else {
                  targetYear = startYear;
              }
              const fromDate = new Date(targetYear, monthIndex, 1);
              const toDate = endOfMonth(fromDate);
              setStatsDateRange({ from: fromDate, to: toDate });
          } else {
              setStatsDateRange({
                  from: new Date(startYear, 6, 1),
                  to: new Date(endYear, 5, 30)
              });
          }
      }
  };

  const [filterVariance, setFilterVariance] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('All');

  const [officeConfigs, setOfficeConfigs] = useState<Record<string, OfficeConfig>>({});

  const [perOfficeList, setPerOfficeList] = useState<any[]>([]);
  const [perOfficeSelectedId, setPerOfficeSelectedId] = useState<number | null>(null);
  const [perOfficeData, setPerOfficeData] = useState<{
    cashBookId: number;
    cashBookName: string;
    cashierSummary: any[];
    completionStatus: string;
    allVerified: boolean;
    validationResult?: { isValid: boolean; message: string };
  } | null>(null);
  const [perOfficeLoading, setPerOfficeLoading] = useState(false);
  const [perOfficeStaged, setPerOfficeStaged] = useState(false);
  const [perOfficeVerifying, setPerOfficeVerifying] = useState<number | null>(null);
  const [perOfficeSubmitting, setPerOfficeSubmitting] = useState(false);

  const loadPerOfficeList = useCallback(async () => {
    try {
      const data = await platinumPerOfficeCashOfficeList();
      const items = Array.isArray(data) ? data : (data as any)?.items || [];
      setPerOfficeList(items);
      console.log('[Supervisor] Per-office list loaded:', items.length, 'offices');
    } catch (e: any) {
      console.error('[Supervisor] Failed to load per-office list:', e);
      setPerOfficeList([]);
    }
  }, []);

  const handlePerOfficeSelect = useCallback(async (cashOfficeId: number) => {
    setPerOfficeSelectedId(cashOfficeId);
    setPerOfficeData(null);
    setPerOfficeLoading(true);
    setPerOfficeStaged(false);
    try {
      const data = await platinumPerOfficeCashOfficeSelection(cashOfficeId);
      console.log('[Supervisor] Per-office selection response:', data);
      setPerOfficeData({
        cashBookId: data?.cashBookId || data?.cashbookId || 0,
        cashBookName: data?.cashBookName || data?.cashbookName || '',
        cashierSummary: Array.isArray(data?.cashierSummary) ? data.cashierSummary : extractItems(data?.cashierSummary),
        completionStatus: data?.completionStatus || '',
        allVerified: data?.allVerified === true,
        validationResult: data?.validationResult,
      });
    } catch (e: any) {
      console.error('[Supervisor] Per-office selection failed:', e);
      toast({ title: 'Error', description: `Failed to load office data: ${e.message}`, variant: 'destructive' });
    } finally {
      setPerOfficeLoading(false);
    }
  }, [toast]);

  const refreshPerOfficeSummary = useCallback(async () => {
    if (!perOfficeSelectedId) return;
    try {
      const data = await platinumPerOfficeCashierSummary(perOfficeSelectedId);
      console.log('[Supervisor] Per-office summary refresh:', data);
      const items = data?.data || data?.cashierSummary || (Array.isArray(data) ? data : []);
      setPerOfficeData(prev => prev ? {
        ...prev,
        cashierSummary: items,
        completionStatus: data?.completionStatus || prev.completionStatus,
        allVerified: data?.allVerified === true,
        validationResult: data?.validationResult || prev.validationResult,
      } : null);
    } catch (e: any) {
      console.error('[Supervisor] Per-office summary refresh failed:', e);
    }
  }, [perOfficeSelectedId]);

  const handlePerOfficeAddStage = useCallback(async () => {
    try {
      await platinumPerOfficeAddStage();
      setPerOfficeStaged(true);
      console.log('[Supervisor] Per-office stage lock acquired');
    } catch (e: any) {
      console.warn('[Supervisor] Per-office add-stage warning:', e.message);
      setPerOfficeStaged(true);
    }
  }, []);

  const handlePerOfficeFinishStage = useCallback(async () => {
    try {
      await platinumPerOfficeFinishStage();
      setPerOfficeStaged(false);
      console.log('[Supervisor] Per-office stage lock released');
    } catch (e: any) {
      console.warn('[Supervisor] Per-office finish-stage warning:', e.message);
      setPerOfficeStaged(false);
    }
  }, []);

  const handlePerOfficeProcessStaging = useCallback(async (cashOfficeId: number) => {
    try {
      await platinumPerOfficeProcessStagingPayments(cashOfficeId);
      console.log('[Supervisor] Per-office staging payments processed');
    } catch (e: any) {
      console.warn('[Supervisor] Per-office process-staging warning:', e.message);
    }
  }, []);

  const handlePerOfficeVerifyCashier = useCallback(async (cashierId: number) => {
    if (!perOfficeSelectedId || !perOfficeData) return;
    setPerOfficeVerifying(cashierId);
    try {
      await handlePerOfficeAddStage();
      await handlePerOfficeProcessStaging(perOfficeSelectedId);
      const result = await platinumPerOfficeVerifyCashierReconcile({
        cashierId,
        cashOfficeId: perOfficeSelectedId,
        cashBookId: perOfficeData.cashBookId,
      });
      console.log('[Supervisor] Per-office verify cashier result:', result);
      if (result?.isSuccess === false) {
        toast({ title: 'Verification Failed', description: result.message || 'Cashier verification failed.', variant: 'destructive' });
      } else {
        toast({ title: 'Verified', description: `Cashier ${cashierId} verified successfully.` });
      }
      await refreshPerOfficeSummary();
    } catch (e: any) {
      console.error('[Supervisor] Per-office verify cashier failed:', e);
      toast({ title: 'Error', description: `Verification failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setPerOfficeVerifying(null);
    }
  }, [perOfficeSelectedId, perOfficeData, handlePerOfficeAddStage, handlePerOfficeProcessStaging, refreshPerOfficeSummary, toast]);

  const handlePerOfficeSubmitAll = useCallback(async () => {
    if (!perOfficeSelectedId || !perOfficeData) return;
    setPerOfficeSubmitting(true);
    try {
      const result = await platinumPerOfficeSubmitReconcile({
        cashOfficeId: perOfficeSelectedId,
        cashBookId: perOfficeData.cashBookId,
      });
      console.log('[Supervisor] Per-office submit-reconcile result:', result);
      if (result?.isSuccess === false) {
        toast({ title: 'Submission Failed', description: result.message || 'Office reconciliation submission failed.', variant: 'destructive' });
      } else {
        toast({ title: 'Office Reconciled', description: `All cashiers in this office have been fully reconciled.` });
      }
      await handlePerOfficeFinishStage();
      await refreshPerOfficeSummary();
      loadCashierList();
    } catch (e: any) {
      console.error('[Supervisor] Per-office submit failed:', e);
      toast({ title: 'Error', description: `Office submission failed: ${e.message}`, variant: 'destructive' });
      await handlePerOfficeFinishStage();
    } finally {
      setPerOfficeSubmitting(false);
    }
  }, [perOfficeSelectedId, perOfficeData, handlePerOfficeFinishStage, refreshPerOfficeSummary, toast]);

  const handlePerOfficeReturn = useCallback(async (cashierReconcileId: number, reason: string) => {
    try {
      await platinumPerOfficeReturnReconcile({ id: cashierReconcileId, returnReason: reason });
      toast({ title: 'Returned', description: 'Cashier reconcile returned for correction.' });
      await handlePerOfficeFinishStage();
      await refreshPerOfficeSummary();
    } catch (e: any) {
      console.error('[Supervisor] Per-office return failed:', e);
      toast({ title: 'Error', description: `Return failed: ${e.message}`, variant: 'destructive' });
      await handlePerOfficeFinishStage();
    }
  }, [handlePerOfficeFinishStage, refreshPerOfficeSummary, toast]);

  const handlePerOfficeCancelReceipt = useCallback(async (receiptId: number, reason: string) => {
    try {
      await platinumPerOfficeCancelReceipt({ id: receiptId, returnReason: reason });
      toast({ title: 'Receipt Cancelled', description: `Receipt ${receiptId} cancelled.` });
      await refreshPerOfficeSummary();
    } catch (e: any) {
      toast({ title: 'Error', description: `Cancel receipt failed: ${e.message}`, variant: 'destructive' });
    }
  }, [refreshPerOfficeSummary, toast]);

  const handlePerOfficePrintCashReport = useCallback(async (cashOfficeId: number) => {
    try {
      toast({ title: 'Generating...', description: 'Preparing cash report...' });
      const officeName = perOfficeList.find((o: any) => (o.cashOffice_ID || o.id) === cashOfficeId)?.cashOfficeDesc || '-';
      const reconcileDate = new Date().toISOString().split('T')[0];
      const result = await platinumPerOfficePrintCashReport({ cashierId: cashOfficeId, cashierName: officeName, reconcileDate });
      if (result && typeof result === 'string' && result.startsWith('JVB')) {
        const byteChars = atob(result);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else if (result?.fileContents || result?.base64) {
        const b64 = result.fileContents || result.base64;
        const byteChars = atob(b64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else {
        toast({ title: 'Cash Report', description: 'Report generated.' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: `Failed: ${e.message}`, variant: 'destructive' });
    }
  }, [perOfficeList, toast]);

  const handlePerOfficePrintDepositSlip = useCallback(async (cashOfficeId: number) => {
    try {
      toast({ title: 'Generating...', description: 'Preparing deposit slip...' });
      const officeName = perOfficeList.find((o: any) => (o.cashOffice_ID || o.id) === cashOfficeId)?.cashOfficeDesc || '-';
      const reconcileDate = new Date().toISOString().split('T')[0];
      const result = await platinumPerOfficePrintDepositSlip({ cashierId: cashOfficeId, cashierName: officeName, reconcileDate });
      if (result && typeof result === 'string' && result.startsWith('JVB')) {
        const byteChars = atob(result);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else if (result?.fileContents || result?.base64) {
        const b64 = result.fileContents || result.base64;
        const byteChars2 = atob(b64);
        const byteArr2 = new Uint8Array(byteChars2.length);
        for (let i = 0; i < byteChars2.length; i++) byteArr2[i] = byteChars2.charCodeAt(i);
        const blob = new Blob([byteArr2], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else {
        toast({ title: 'Deposit Slip', description: 'Slip generated.' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: `Failed: ${e.message}`, variant: 'destructive' });
    }
  }, [perOfficeList, toast]);

  useEffect(() => {
    if (reconMode === 'CASH_OFFICE') {
      loadPerOfficeList();
    }
  }, [reconMode, loadPerOfficeList]);

  const loadCashierList = useCallback(async () => {
    setIsLoadingShifts(true);
    try {
      const data = await platinumGetAuthDayEndCashierList();
      console.log('[Supervisor] Cashier list raw response:', data);

      let items: any[];
      let offices: Record<string, OfficeConfig> = {};

      if (data && data.cashiers && data.offices) {
        items = extractItems(data.cashiers);
        offices = data.offices || {};
        console.log('[Supervisor] Enriched response — cashiers:', items.length, ', offices:', Object.keys(offices).length);
      } else {
        items = extractItems(data);
      }

      setOfficeConfigs(offices);
      console.log('[Supervisor] Cashier list items:', items.length, JSON.stringify(items).substring(0, 1000));
      const mapped = items.map((c: any, i: number) => mapCashierToShift(c, i, offices));
      setShifts(mapped);

      const hasGrouped = mapped.some((s: CashierShift) => s.groupCashiers);
      const hasIndividual = mapped.some((s: CashierShift) => !s.groupCashiers);
      if (hasGrouped && !hasIndividual) {
        setReconMode('CASH_OFFICE');
      } else if (!hasGrouped && hasIndividual) {
        setReconMode('PER_CASHIER');
      }
      console.log(`[Supervisor] Office grouping: ${hasGrouped ? 'some grouped' : 'none grouped'}, ${hasIndividual ? 'some individual' : 'none individual'}`);
    } catch (e: any) {
      console.error('[Supervisor] Failed to load cashier list:', e);
      toast({ title: 'Error', description: `Failed to load cashier list: ${e.message}`, variant: 'destructive' });
    } finally {
      setIsLoadingShifts(false);
    }
  }, []);

  useEffect(() => {
    loadCashierList();
  }, [loadCashierList]);

  const uniqueOffices = useMemo(() => {
    const offices = new Set(shifts.map(s => s.cashOffice).filter(Boolean));
    return Array.from(offices);
  }, [shifts]);

  const activeShifts = shifts.filter(shift => {
    if (shift.status === 'NOT_SUBMITTED' && !shift.hasActiveSession) return false;
    return true;
  });

  const filteredShifts = activeShifts.filter(shift => {
    const matchesOffice = filterOffice === 'All' || shift.cashOffice === filterOffice;
    const matchesSearch = shift.cashierName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVariance = !filterVariance || (shift.variance?.total || 0) !== 0;
    
    const matchesStatus = filterStatus === 'All' 
        ? (
            shift.status !== 'COMPLETED' || 
            (shift.status === 'COMPLETED' && isWithinInterval(new Date(shift.startTime), { 
                start: new Date(new Date().setHours(0,0,0,0)), 
                end: new Date() 
            }))
          )
        : shift.status === filterStatus;
    
    let matchesDate = true;
    if (filterDate === 'Today') {
        matchesDate = isWithinInterval(new Date(shift.startTime), { start: new Date(new Date().setHours(0,0,0,0)), end: new Date() });
    } else if (filterDate === 'Yesterday') {
        const yesterday = subDays(new Date(), 1);
        matchesDate = isWithinInterval(new Date(shift.startTime), { 
            start: new Date(yesterday.setHours(0,0,0,0)), 
            end: new Date(yesterday.setHours(23,59,59,999)) 
        });
    }

    return matchesOffice && matchesSearch && matchesVariance && matchesStatus && matchesDate;
  });

  const pendingCount = activeShifts.filter(s => s.status === 'PENDING_APPROVAL').length;
  const varianceCount = activeShifts.filter(s => (s.variance?.total || 0) !== 0 && s.status === 'PENDING_APPROVAL').length;
  const totalPosted = activeShifts.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + s.systemTotals.total, 0);
  const totalSystemRevenue = activeShifts.reduce((sum, s) => sum + s.systemTotals.total, 0);

  const loadReviewData = useCallback(async (cashierId: string) => {
    setReviewLoading(true);
    setReviewData(null);
    setReviewTab('cash');
    try {
      const [detailsRes, reconcileRes, cashRes, cardRes, chequeRes, postalRes, dropboxRes, offlineRes, sysVsCashierRes] = await Promise.all([
        platinumGetAuthDayEndCashierDetails({ id: cashierId }).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch cashier details:', err); return null; }),
        platinumGetAuthDayEndCashierReconcile({ cashierId }).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch cashier reconcile:', err); return null; }),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-cash-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch cash receipt list:', err); return []; }),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-card-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch card receipt list:', err); return []; }),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-cheque-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch cheque receipt list:', err); return []; }),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-postal-order-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch postal order receipt list:', err); return []; }),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-drop-box-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch drop box receipt list:', err); return []; }),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-offline-data-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch offline data list:', err); return []; }),
        apiRequest('POST', `/api/platinum/auth-day-end/system-vs-cashier-data-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch((err) => { console.error('[SupervisorDashboard] Failed to fetch system vs cashier data list:', err); return []; }),
      ]);

      console.log('[Supervisor] Review details:', detailsRes);
      console.log('[Supervisor] Review reconcile:', reconcileRes);

      setReviewData({
        details: detailsRes,
        reconcile: reconcileRes,
        cashReceipts: extractItems(cashRes),
        cardReceipts: extractItems(cardRes),
        chequeReceipts: extractItems(chequeRes),
        postalReceipts: extractItems(postalRes),
        dropboxReceipts: extractItems(dropboxRes),
        offlineReceipts: extractItems(offlineRes),
        systemVsCashier: extractItems(sysVsCashierRes),
      });
    } catch (e: any) {
      console.error('[Supervisor] Failed to load review data:', e);
      toast({ title: 'Error', description: `Failed to load review data: ${e.message}`, variant: 'destructive' });
    } finally {
      setReviewLoading(false);
    }
  }, [toast]);

  const handleReview = useCallback((shift: CashierShift) => {
    setSelectedShift(shift);
    setReturnReason('');
    loadReviewData(shift.id);
  }, [loadReviewData]);

  const handleApprove = async (cashierId: string) => {
    setActionLoading(true);
    try {
      try {
        console.log('[Supervisor] Step 1: validate-cashbook for cashier', cashierId);
        await platinumAuthDayEndValidateCashbook(Number(cashierId));
      } catch (valErr: any) {
        console.warn('[Supervisor] validate-cashbook warning (continuing):', valErr.message);
      }

      const cashierOfficeId = selectedShift?.cashOfficeId || reviewData?.details?.cashierOfficeId || reviewData?.details?.officeId || 1;
      let cashBookId = reviewData?.details?.cashBookId || reviewData?.details?.cashbookId || 0;
      if (!cashBookId) {
        try {
          const cashbooks = await platinumGetAuthDayEndCashbookList();
          const books = Array.isArray(cashbooks) ? cashbooks : [];
          if (books.length > 0) {
            const match = books.find((b: any) => Number(b.cashOfficeId || b.cashOffice_ID) === Number(cashierOfficeId));
            cashBookId = match?.id || match?.cashBookId || match?.cashBook_ID || books[0]?.id || books[0]?.cashBookId || 1;
            console.log('[Supervisor] Resolved cashBookId from cashbook-list:', cashBookId);
          } else {
            cashBookId = 1;
          }
        } catch (cbErr: any) {
          console.warn('[Supervisor] cashbook-list fetch failed, using fallback:', cbErr.message);
          cashBookId = 1;
        }
      }
      console.log('[Supervisor] Step 2: submit-day-auth-reconcile for cashier', cashierId, 'cashBookId', cashBookId, 'officeId', cashierOfficeId);
      const submitResult = await platinumAuthDayEndSubmitReconcile({ cashierId: Number(cashierId), cashBookId: Number(cashBookId), cashierOfficeId: Number(cashierOfficeId) });
      if (submitResult?.isSuccess === false || submitResult?.error) {
        throw new Error(submitResult?.message || submitResult?.error || 'Failed to submit day-end authorization.');
      }

      const resolvedUserId = selectedShift?.userId || reviewData?.details?.user_Id || reviewData?.details?.userId || reviewData?.details?.capturerId || platinumUser?.user_ID || 0;
      if (!resolvedUserId) {
        throw new Error('Cannot determine user ID for this cashier. Please check cashier details.');
      }
      console.log('[Supervisor] Step 3: finish-day-end-reconcile — userId=', resolvedUserId, '(cashierId=', cashierId, ')');
      await apiRequest('POST', `/api/platinum/auth-day-end/finish-day-end-reconcile?userId=${resolvedUserId}`, {});
      toast({ title: 'Success', description: 'Day-end reconciliation approved successfully.' });
      setSelectedShift(null);
      loadCashierList();
    } catch (e: any) {
      console.error('[Supervisor] Approve failed:', e);
      toast({ title: 'Error', description: `Approve failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintCashReport = async (cashierId: string) => {
    try {
      toast({ title: 'Generating...', description: 'Preparing cash report...' });
      const cashierName = selectedShift?.cashierName || 'Cashier';
      const reconcileDate = new Date().toISOString().split('T')[0];
      const result = await platinumAuthDayEndPrintCashReport({ cashierId: Number(cashierId), cashierName, reconcileDate });
      if (result && typeof result === 'string' && result.startsWith('JVB')) {
        const byteChars = atob(result);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else if (result?.fileContents || result?.base64) {
        const b64 = result.fileContents || result.base64;
        const byteChars = atob(b64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else {
        toast({ title: 'Cash Report', description: 'Report generated. Check if a download started.' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: `Failed to generate cash report: ${e.message}`, variant: 'destructive' });
    }
  };

  const handlePrintDepositSlip = async (cashierId: string) => {
    try {
      toast({ title: 'Generating...', description: 'Preparing deposit slip...' });
      const cashierName = selectedShift?.cashierName || 'Cashier';
      const reconcileDate = new Date().toISOString().split('T')[0];
      const result = await platinumAuthDayEndPrintDepositSlip({ cashierId: Number(cashierId), cashierName, reconcileDate });
      if (result && typeof result === 'string' && result.startsWith('JVB')) {
        const byteChars = atob(result);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else if (result?.fileContents || result?.base64) {
        const b64 = result.fileContents || result.base64;
        const byteChars = atob(b64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else {
        toast({ title: 'Deposit Slip', description: 'Slip generated. Check if a download started.' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: `Failed to generate deposit slip: ${e.message}`, variant: 'destructive' });
    }
  };

  const handleDirectCancelReceipt = async (receiptId: number, reason: string) => {
    try {
      await platinumAuthDayEndDirectCancelReceipt({
        id: receiptId,
        returnReason: reason,
        userId: platinumUser?.user_ID || 0,
      });
      toast({ title: 'Receipt Cancelled', description: `Receipt ${receiptId} has been directly cancelled.` });
      if (selectedShift) loadReviewData(selectedShift.id);
    } catch (e: any) {
      console.error('[Supervisor] Direct cancel receipt failed:', e);
      toast({ title: 'Error', description: `Direct cancel failed: ${e.message}`, variant: 'destructive' });
    }
  };

  const handleReturn = async () => {
    if (!selectedShift || !returnReason) return;
    setActionLoading(true);
    try {
      const reconcileId = reviewData?.reconcile?.cashierReconcile_Id || reviewData?.reconcile?.id || selectedShift.reconcileId || Number(selectedShift.id);
      console.log('[Supervisor] return-day-end-reconcile — reconcileId=', reconcileId, '(cashierId=', selectedShift.id, ')');
      await apiRequest('POST', '/api/platinum/auth-day-end/return-day-end-reconcile', {
        id: reconcileId,
        returnReason: returnReason,
      });
      toast({ title: 'Returned', description: 'Day-end reconciliation returned to cashier.' });
      setSelectedShift(null);
      setReturnReason('');
      loadCashierList();
    } catch (e: any) {
      console.error('[Supervisor] Return failed:', e);
      toast({ title: 'Error', description: `Return failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelReceipt = async (receiptId: number, reason: string) => {
    try {
      await apiRequest('POST', '/api/platinum/auth-day-end/cancel-receipt', {
        id: receiptId,
        returnReason: reason,
      });
      toast({ title: 'Receipt Cancelled', description: 'Receipt has been cancelled.' });
      if (selectedShift) loadReviewData(selectedShift.id);
    } catch (e: any) {
      console.error('[Supervisor] Cancel receipt failed:', e);
      toast({ title: 'Error', description: `Cancel receipt failed: ${e.message}`, variant: 'destructive' });
    }
  };

  const officeGroups = React.useMemo(() => {
    if (reconMode !== 'CASH_OFFICE') return null;
    
    const groups: Record<string, { 
      officeId: number | null;
      groupCashiers: boolean;
      totalSystem: number; 
      totalDeclared: number; 
      shifts: CashierShift[];
      status: 'MIXED' | 'READY' | 'COMPLETED';
      allSubmitted: boolean;
      pendingCount: number;
    }> = {};

    filteredShifts.forEach(shift => {
      const key = shift.cashOffice || 'Unknown';
      if (!groups[key]) {
        groups[key] = { 
          officeId: shift.cashOfficeId,
          groupCashiers: shift.groupCashiers,
          totalSystem: 0, 
          totalDeclared: 0, 
          shifts: [],
          status: 'READY',
          allSubmitted: true,
          pendingCount: 0,
        };
      }
      groups[key].shifts.push(shift);
      groups[key].totalSystem += shift.systemTotals.total;
      groups[key].totalDeclared += shift.declaredTotals?.total || 0;
      
      if (shift.status === 'NOT_SUBMITTED' || shift.status === 'RETURNED') {
          groups[key].status = 'MIXED';
          groups[key].allSubmitted = false;
      }
      if (shift.status === 'PENDING_APPROVAL') {
          groups[key].pendingCount++;
      }
      if (shift.status === 'COMPLETED') {
          if (groups[key].shifts.every(s => s.status === 'COMPLETED')) {
              groups[key].status = 'COMPLETED';
          }
      }
    });

    return groups;
  }, [filteredShifts, reconMode]);

  const varianceStats = useMemo(() => {
      return {
          history: [] as CashierShift[],
          totalShortage: 0,
          totalSurplus: 0,
          netVariance: 0,
          shortageCount: 0,
          surplusCount: 0,
          shiftCount: 0
      };
  }, [statsDateRange, statsCashier]);

  const [directCancelId, setDirectCancelId] = useState<number | null>(null);
  const [directCancelReason, setDirectCancelReason] = useState('');

  const renderReceiptTable = (receipts: any[], type: string) => {
    if (receipts.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No {type} receipts found
        </div>
      );
    }
    return (
      <>
      <div className="sm:hidden space-y-2 max-h-[300px] overflow-auto">
        {receipts.map((item, idx) => {
          const receiptId = item.id || item.receiptId || item.receipt_id;
          const isCancelled = item.isCancelled === 1 || item.isCancelled === true;
          return (
            <div key={idx} className="bg-white border rounded-xl p-3 space-y-2" data-testid={`mobile-receipt-card-${type}-${idx}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-sm">{item.receiptNo || item.receipt_no || item.receiptNumber || '-'}</span>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.accountNumber || item.accountId || item.invoiceNumber || item.account || '-'}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900">R {Number(item.amount || item.totalAmount || 0).toFixed(2)}</span>
                  {isCancelled && <Badge variant="destructive" className="text-[9px] ml-1">Voided</Badge>}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.receiptDate || item.receiptDateTime || item.date || '-'}</span>
                <span>#{idx + 1}</span>
              </div>
              {!isCancelled && receiptId && (
                directCancelId === receiptId ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      className="h-11 text-sm"
                      placeholder="Reason for cancellation..."
                      value={directCancelReason}
                      onChange={e => setDirectCancelReason(e.target.value)}
                      data-testid={`input-cancel-reason-${receiptId}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-11 flex-1"
                        onClick={() => { setDirectCancelId(null); setDirectCancelReason(''); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-11 flex-1"
                        onClick={() => {
                          handleDirectCancelReceipt(receiptId, directCancelReason);
                          setDirectCancelId(null);
                          setDirectCancelReason('');
                        }}
                        disabled={!directCancelReason.trim()}
                        data-testid={`button-confirm-cancel-${receiptId}`}
                      >
                        Confirm Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full h-11 text-red-600 hover:text-red-700 hover:bg-red-50 active:scale-[0.99]"
                    onClick={() => setDirectCancelId(receiptId)}
                    data-testid={`button-cancel-receipt-${receiptId}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Cancel Receipt
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>
      <div className="hidden sm:block border rounded-md overflow-auto max-h-[300px]">
        <Table>
          <TableHeader className="bg-[#F7F7F7] sticky top-0">
            <TableRow>
              <TableHead className="text-xs py-2">#</TableHead>
              <TableHead className="text-xs py-2">Account/Ref</TableHead>
              <TableHead className="text-xs py-2">Receipt No</TableHead>
              <TableHead className="text-xs py-2">Date</TableHead>
              <TableHead className="text-xs py-2">Cancelled</TableHead>
              <TableHead className="text-xs py-2 text-right">Amount</TableHead>
              <TableHead className="text-xs py-2 text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((item, idx) => {
              const receiptId = item.id || item.receiptId || item.receipt_id;
              const isCancelled = item.isCancelled === 1 || item.isCancelled === true;
              return (
                <TableRow key={idx} className="hover:bg-[#F7F7F7]">
                  <TableCell className="text-xs py-1.5">{idx + 1}</TableCell>
                  <TableCell className="text-xs font-mono py-1.5">{item.accountNumber || item.accountId || item.invoiceNumber || item.account || '-'}</TableCell>
                  <TableCell className="text-xs font-mono py-1.5">{item.receiptNo || item.receipt_no || item.receiptNumber || '-'}</TableCell>
                  <TableCell className="text-xs py-1.5">{item.receiptDate || item.receiptDateTime || item.date || '-'}</TableCell>
                  <TableCell className="text-xs py-1.5">
                    {isCancelled ? (
                      <Badge variant="destructive" className="text-[9px]">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono font-medium py-1.5">R {Number(item.amount || item.totalAmount || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-center py-1.5">
                    {!isCancelled && receiptId ? (
                      directCancelId === receiptId ? (
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-6 text-[10px] w-24"
                            placeholder="Reason..."
                            value={directCancelReason}
                            onChange={e => setDirectCancelReason(e.target.value)}
                            data-testid={`input-cancel-reason-${receiptId}`}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => {
                              handleDirectCancelReceipt(receiptId, directCancelReason);
                              setDirectCancelId(null);
                              setDirectCancelReason('');
                            }}
                            disabled={!directCancelReason.trim()}
                            data-testid={`button-confirm-cancel-${receiptId}`}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1 text-[10px]"
                            onClick={() => { setDirectCancelId(null); setDirectCancelReason(''); }}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDirectCancelId(receiptId)}
                          data-testid={`button-cancel-receipt-${receiptId}`}
                        >
                          <Trash2 className="w-3 h-3 mr-0.5" /> Cancel
                        </Button>
                      )
                    ) : isCancelled ? (
                      <span className="text-muted-foreground text-[10px]">Voided</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      </>
    );
  };

  return (
    <PosLayout>
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E] flex items-center gap-2">Supervisor Dashboard <HelpTip text="Monitor cashier activities, review day-end submissions, and approve cancellation requests." side="right" /></h1>
            <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Reconciliation & Approvals</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border shadow-sm">
              <div className="text-xs font-medium text-muted-foreground">Administrator</div>
              <div className="w-6 h-6 rounded-full bg-[#2E2E2E] text-white flex items-center justify-center text-xs">AD</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              className="gap-2 bg-white text-xs sm:text-sm"
              size="sm"
              onClick={() => setShowVarianceHistory(true)}
            >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Cashier </span>Statistics
            </Button>
            <Button
              variant="outline"
              className="gap-2 bg-white text-xs sm:text-sm"
              size="sm"
              onClick={loadCashierList}
              disabled={isLoadingShifts}
            >
                {isLoadingShifts ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Refresh
            </Button>
            <div className="bg-white rounded-lg border p-1 flex items-center shadow-sm">
                <Button 
                    variant={reconMode === 'PER_CASHIER' ? 'secondary' : 'ghost'} 
                    size="sm"
                    className="text-xs sm:text-sm px-2 sm:px-3"
                    onClick={() => setReconMode('PER_CASHIER')}
                >
                    Per Cashier
                </Button>
                <Switch 
                  checked={reconMode === 'CASH_OFFICE'} 
                  onCheckedChange={(c) => setReconMode(c ? 'CASH_OFFICE' : 'PER_CASHIER')}
                  className="mx-1 sm:mx-2"
                />
                <Button 
                    variant={reconMode === 'CASH_OFFICE' ? 'secondary' : 'ghost'} 
                    size="sm"
                    className="text-xs sm:text-sm px-2 sm:px-3"
                    onClick={() => setReconMode('CASH_OFFICE')}
                >
                    Per Cash Office
                </Button>
                <HelpTip text="Cash offices with 'Group Cashiers' enabled require all cashiers to be reconciled together as a group. Offices without grouping allow individual cashier reconciliation. This toggle switches between the two views." className="ml-1" />
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border border-[#D6D6D6] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-[#6B6B6B] flex items-center gap-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center mr-1">
                <RefreshCcw className="w-3 h-3 text-white" />
              </div>
              Pending Approvals <HelpTip text="Total number of cashier day-end submissions and cancellation requests awaiting supervisor review." />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-[#2E2E2E]">{pendingCount + allPendingCancellationCount}</div>
            <p className="text-xs text-[#6B6B6B] mt-1 flex items-center gap-1">
                {pendingCount} shifts, {allPendingCancellationCount} voids
            </p>
          </CardContent>
        </Card>
        
        <Card className="border border-[#D6D6D6] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-[#6B6B6B] flex items-center gap-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#D14343] to-[#B83030] flex items-center justify-center mr-1">
                <AlertTriangle className="w-3 h-3 text-white" />
              </div>
              Variances Detected <HelpTip text="Number of pending shifts where the cashier's declared amount differs from the system total." />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-[#D14343]">{varianceCount}</div>
            <p className="text-xs text-[#6B6B6B] mt-1 flex items-center gap-1">
                Requires attention
            </p>
          </CardContent>
        </Card>

        <Card className="border border-[#D6D6D6] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-[#6B6B6B] flex items-center gap-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#4CAF50] to-[#388E3C] flex items-center justify-center mr-1">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>

              Total Posted (Today) <HelpTip text="Sum of all successfully reconciled and approved cashier shift totals for today." />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-3xl font-bold text-[#2E2E2E]">{formatCurrency(totalPosted)}</div>
            <p className="text-xs text-[#6B6B6B] mt-1 flex items-center gap-1">
                Successfully reconciled
            </p>
          </CardContent>
        </Card>

        <Card className="border border-[#D6D6D6] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-[#6B6B6B] flex items-center gap-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center mr-1">
                <TrendingUp className="w-3 h-3 text-white" />
              </div>
              Total System Revenue <HelpTip text="Combined system-recorded revenue across all active cashier shifts, regardless of approval status." />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-3xl font-bold text-[#2E2E2E]">{formatCurrency(totalSystemRevenue)}</div>
            <p className="text-xs text-[#6B6B6B] mt-1 flex items-center gap-1">
                All active shifts
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-[#D6D6D6] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <CardContent className="p-3 sm:p-4">
          <Tabs defaultValue="pending" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
                <h3 className="font-semibold text-[#2E2E2E] flex items-center gap-2 text-sm sm:text-base">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center">
                      <AlertCircle className="h-3.5 w-3.5 text-white" />
                    </div>
                    Cancellation Requests
                    <HelpTip text="Transactions that cashiers have requested to void. Review the reason before approving." />
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[#6B6B6B] hover:bg-[#F7F7F7]" onClick={loadPendingCancelRequests} disabled={cancelRequestsLoading}>
                        <RefreshCcw className={`w-3 h-3 ${cancelRequestsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </h3>
                <TabsList className="bg-[#F2F4F7] border border-[#D6D6D6] rounded-xl p-1">
                    <TabsTrigger value="pending" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2E2E2E] data-[state=active]:shadow-sm">
                        Pending ({allPendingCancellationCount})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2E2E2E] data-[state=active]:shadow-sm">
                        History
                    </TabsTrigger>
                </TabsList>
            </div>
            
            <TabsContent value="pending" className="mt-0">
                {cancelRequestsLoading ? (
                    <div className="text-center py-8 bg-[#F7F7F7] rounded-xl border border-dashed border-[#D6D6D6] text-[#6B6B6B] text-sm flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading pending cancellation requests...
                    </div>
                ) : allPendingCancellationCount === 0 ? (
                    <div className="text-center py-8 bg-[#F7F7F7] rounded-xl border border-dashed border-[#D6D6D6] text-[#6B6B6B] text-sm">
                        No pending cancellation requests
                    </div>
                ) : (
                    <>
                    <div className="sm:hidden space-y-2">
                        {pendingCancelRequests.map(req => (
                            <div key={`mobile-api-${req.id}`} className="bg-white border rounded-xl p-3 space-y-2" data-testid={`mobile-cancel-card-${req.id}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="font-mono font-bold text-slate-900">{req.receiptNo || `#${req.receiptId}`}</span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {req.paymentType && (
                                                <span className="bg-[#F2F4F7] px-1.5 py-0.5 rounded border border-[#D6D6D6] uppercase text-[10px] tracking-wider font-semibold">{req.paymentType}</span>
                                            )}
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-[#6B6B6B] border-[#D6D6D6] bg-[#F7F7F7]">API</Badge>
                                        </div>
                                    </div>
                                    <span className="font-bold text-slate-900 font-mono">R {req.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>{req.cashierName || 'Unknown'}</span>
                                    <span className="text-xs">{req.requestDate ? new Date(req.requestDate).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false }) + ' · ' + new Date(req.requestDate).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' }) : '—'}</span>
                                </div>
                                {req.reason && <p className="text-xs text-red-600 truncate" title={req.reason}>{req.reason}</p>}
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 h-10 active:scale-[0.99]"
                                        onClick={() => handleDeclineCancelRequest(req)}
                                        disabled={cancelActionLoading === req.id}
                                        data-testid={`mobile-reject-cancel-${req.id}`}
                                    >
                                        {cancelActionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                        Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white h-10 active:scale-[0.99]"
                                        onClick={() => handleApproveCancelRequest(req)}
                                        disabled={cancelActionLoading === req.id}
                                        data-testid={`mobile-approve-cancel-${req.id}`}
                                    >
                                        {cancelActionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                        Approve Void
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {pendingCancellations.map(tx => {
                            const cashier = referenceData.cashiers.find(c => c.id === tx.cashierId);
                            const mainType = tx.items[0]?.type.replace('_', ' ') || 'Unknown';
                            return (
                            <div key={`mobile-local-${tx.id}`} className="bg-white border rounded-xl p-3 space-y-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="font-mono font-bold text-slate-900">{tx.receiptNumber}</span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="bg-[#F2F4F7] px-1.5 py-0.5 rounded border border-[#D6D6D6] uppercase text-[10px] tracking-wider font-semibold">{mainType}</span>
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-700 border-amber-300 bg-amber-50">Local</Badge>
                                        </div>
                                    </div>
                                    <span className="font-bold text-slate-900 font-mono">R {tx.totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>{cashier?.name || 'Unknown Cashier'}</span>
                                    <span className="text-xs">{new Date(tx.timestamp).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false }) + ' · ' + new Date(tx.timestamp).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' })}</span>
                                </div>
                                {tx.cancellationReason && <p className="text-xs text-red-600 truncate" title={tx.cancellationReason}>{tx.cancellationReason}</p>}
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 h-10 active:scale-[0.99]"
                                        onClick={() => approveCancellation(tx.id, false)}
                                    >
                                        Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white h-10 active:scale-[0.99]"
                                        onClick={() => approveCancellation(tx.id, true)}
                                    >
                                        Approve Void
                                    </Button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                    <div className="hidden sm:block bg-white rounded border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Receipt Details</TableHead>
                                    <TableHead className="whitespace-nowrap">Cashier</TableHead>
                                    <TableHead className="whitespace-nowrap">Time</TableHead>
                                    <TableHead className="whitespace-nowrap">Amount</TableHead>
                                    <TableHead className="whitespace-nowrap">Reason</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingCancelRequests.map(req => (
                                    <TableRow key={`api-${req.id}`}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-slate-900">{req.receiptNo || `#${req.receiptId}`}</span>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    {req.accountNumber && <span className="font-mono">{req.accountNumber}</span>}
                                                    {req.paymentType && (
                                                        <span className="bg-[#F2F4F7] px-1.5 py-0.5 rounded border border-[#D6D6D6] uppercase text-[10px] tracking-wider font-semibold">
                                                            {req.paymentType}
                                                        </span>
                                                    )}
                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 text-[#6B6B6B] border-[#D6D6D6] bg-[#F7F7F7]">API</Badge>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{req.cashierName || 'Unknown'}</span>
                                                <span className="text-xs text-muted-foreground">ID: {req.cashierId}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {req.requestDate ? (
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900">{new Date(req.requestDate).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                                    <span className="text-xs text-muted-foreground">{new Date(req.requestDate).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' })}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold text-slate-900 font-mono">R {req.amount.toFixed(2)}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-red-600 max-w-[150px] truncate block" title={req.reason}>{req.reason || '—'}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                                                    onClick={() => handleDeclineCancelRequest(req)}
                                                    disabled={cancelActionLoading === req.id}
                                                >
                                                    {cancelActionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                                    Reject
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    className="bg-green-600 hover:bg-green-700 text-white h-8"
                                                    onClick={() => handleApproveCancelRequest(req)}
                                                    disabled={cancelActionLoading === req.id}
                                                >
                                                    {cancelActionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                                    Approve Void
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {pendingCancellations.map(tx => {
                                    const cashier = referenceData.cashiers.find(c => c.id === tx.cashierId);
                                    const mainType = tx.items[0]?.type.replace('_', ' ') || 'Unknown';
                                    
                                    return (
                                    <TableRow key={tx.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-slate-900">{tx.receiptNumber}</span>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <span className="bg-[#F2F4F7] px-1.5 py-0.5 rounded border border-[#D6D6D6] uppercase text-[10px] tracking-wider font-semibold">
                                                        {mainType}
                                                    </span>
                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-700 border-amber-300 bg-amber-50">Local</Badge>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{cashier?.name || 'Unknown Cashier'}</span>
                                                <span className="text-xs text-muted-foreground">{tx.cashierId}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-slate-900">{new Date(tx.timestamp).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                                <span className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' })}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold text-slate-900">R {tx.totalAmount.toFixed(2)}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-red-600 max-w-[150px] truncate block" title={tx.cancellationReason}>{tx.cancellationReason || '—'}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                                                    onClick={() => approveCancellation(tx.id, false)}
                                                >
                                                    Reject
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    className="bg-green-600 hover:bg-green-700 text-white h-8"
                                                    onClick={() => approveCancellation(tx.id, true)}
                                                >
                                                    Approve Void
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    )})}
                            </TableBody>
                        </Table>
                    </div>
                    </>
                )}
            </TabsContent>
            
            <TabsContent value="history" className="mt-0">
                {processedCancellations.length === 0 && processedCancelRequests.length === 0 ? (
                    <div className="text-center py-8 bg-[#F7F7F7] rounded-xl border border-dashed border-[#D6D6D6] text-[#6B6B6B] text-sm">
                        No cancellation history found
                    </div>
                ) : (
                    <>
                    <div className="sm:hidden space-y-2">
                        {processedCancelRequests.map(req => (
                            <div key={`mobile-hist-api-${req.id}`} className="bg-white border rounded-xl p-3 space-y-2" data-testid={`mobile-cancel-history-${req.id}`}>
                                <div className="flex items-start justify-between">
                                    <span className="font-mono font-bold text-slate-900">{req.receiptNo || `#${req.receiptId}`}</span>
                                    <span className="font-bold font-mono">R {req.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{req.cashierName || 'Unknown'}</span>
                                    {req.status === 'APPROVED' ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Declined</Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                        {processedCancellations.map(tx => {
                            const cashier = referenceData.cashiers.find(c => c.id === tx.cashierId);
                            const isRejected = tx.status === 'COMPLETED';
                            return (
                            <div key={`mobile-hist-local-${tx.id}`} className="bg-white border rounded-xl p-3 space-y-2" data-testid={`mobile-cancel-history-${tx.id}`}>
                                <div className="flex items-start justify-between">
                                    <span className="font-mono font-bold text-slate-900">{tx.receiptNumber}</span>
                                    <span className="font-bold font-mono">R {tx.totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{cashier?.name || 'Unknown Cashier'}</span>
                                    {isRejected ? (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                    <div className="hidden sm:block bg-white rounded border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Receipt Details</TableHead>
                                    <TableHead className="whitespace-nowrap">Cashier</TableHead>
                                    <TableHead className="whitespace-nowrap">Amount</TableHead>
                                    <TableHead className="whitespace-nowrap">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedCancelRequests.map(req => (
                                    <TableRow key={`api-hist-${req.id}`}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-slate-900">{req.receiptNo || `#${req.receiptId}`}</span>
                                                {req.accountNumber && <span className="text-xs text-muted-foreground font-mono">{req.accountNumber}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-medium text-slate-900">{req.cashierName || 'Unknown'}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold font-mono">R {req.amount.toFixed(2)}</span>
                                        </TableCell>
                                        <TableCell>
                                            {req.status === 'APPROVED' ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Declined</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {processedCancellations.map(tx => {
                                    const cashier = referenceData.cashiers.find(c => c.id === tx.cashierId);
                                    const mainType = tx.items[0]?.type.replace('_', ' ') || 'Unknown';
                                    const isRejected = tx.status === 'COMPLETED';
                                    
                                    return (
                                    <TableRow key={tx.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-slate-900">{tx.receiptNumber}</span>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <span className="bg-[#F2F4F7] px-1.5 py-0.5 rounded border border-[#D6D6D6] uppercase text-[10px] tracking-wider font-semibold">
                                                        {mainType}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{cashier?.name || 'Unknown Cashier'}</span>
                                                <span className="text-xs text-muted-foreground">{tx.cashierId}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold font-mono">R {tx.totalAmount.toFixed(2)}</span>
                                        </TableCell>
                                        <TableCell>
                                            {isRejected ? (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                    Rejected
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    Approved
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    )})}
                            </TableBody>
                        </Table>
                    </div>
                    </>
                )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center bg-[#F7F7F7] p-3 sm:p-4 rounded-xl border border-[#D6D6D6]">
          <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                  placeholder="Search cashier..." 
                  className="pl-9 h-10 sm:h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-cashier"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2"><HelpTip text="Filter the cashier list by name. Type to search." /></span>
          </div>
          <Select value={filterOffice} onValueChange={setFilterOffice}>
              <SelectTrigger className="w-full md:w-[200px] h-10 sm:h-9" data-testid="select-filter-office">
                  <SelectValue placeholder="Filter by Office" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="All">All Offices</SelectItem>
                  {uniqueOffices.map(office => (
                    <SelectItem key={office} value={office}>{office}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2 w-full md:w-auto" asChild>
              <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`gap-2 w-full md:w-auto ${filterVariance || filterStatus !== 'All' || filterDate !== 'All' ? 'bg-[#F2F4F7] border-[#D6D6D6]' : ''}`}>
                        <Filter className="w-4 h-4" />
                        More Filters
                        {(filterVariance || filterStatus !== 'All' || filterDate !== 'All') && (
                            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">Active</Badge>
                        )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                      <div className="space-y-4">
                          <h4 className="font-medium text-sm border-b pb-2 flex items-center gap-1">Filter Shifts <HelpTip text="Narrow down the cashier shift list by date or variance status." /></h4>
                          
                          <div className="space-y-2">
                              <Label htmlFor="date">Date Period</Label>
                              <Select value={filterDate} onValueChange={setFilterDate}>
                                  <SelectTrigger id="date">
                                      <SelectValue placeholder="Any Time" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="All">Any Time</SelectItem>
                                      <SelectItem value="Today">Today</SelectItem>
                                      <SelectItem value="Yesterday">Yesterday</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>

                          <div className="flex items-center space-x-2 pt-2">
                              <Switch id="variance-mode" checked={filterVariance} onCheckedChange={setFilterVariance} />
                              <Label htmlFor="variance-mode">Show Variances Only</Label>
                          </div>
                          
                          {(filterVariance || filterStatus !== 'All' || filterDate !== 'All') && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 h-8 mt-2"
                                onClick={() => {
                                    setFilterStatus('All');
                                    setFilterVariance(false);
                                    setFilterDate('All');
                                }}
                              >
                                  Reset Filters
                              </Button>
                          )}
                      </div>
                  </PopoverContent>
              </Popover>
          </Button>
      </div>
      
      <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-full">
        <TabsList className="bg-[#F2F4F7] border border-[#D6D6D6] rounded-xl w-full justify-start h-auto p-1 flex-wrap gap-1">
            <HelpTip text="Active = currently working, Pending = awaiting approval, Reconciled = shift approved and closed." className="ml-1" />
            <TabsTrigger value="All" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2E2E2E] data-[state=active]:shadow-sm">
                All Active
            </TabsTrigger>
            <TabsTrigger value="PENDING_APPROVAL" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[var(--pos-accent)]">
                <span className="hidden sm:inline">Pending</span>Approval
                {pendingCount > 0 && <Badge variant="secondary" className="ml-1 sm:ml-2 h-4 px-1 text-[10px] bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="NOT_SUBMITTED" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2E2E2E] data-[state=active]:shadow-sm">Not<span className="hidden sm:inline">Submitted</span><span className="sm:hidden">Sub</span></TabsTrigger>
            <TabsTrigger value="RETURNED" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#D14343] data-[state=active]:shadow-sm">Returned</TabsTrigger>
            <TabsTrigger value="COMPLETED" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#4CAF50] data-[state=active]:shadow-sm">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoadingShifts ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading cashier shifts...
        </div>
      ) : reconMode === 'PER_CASHIER' ? (
          <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
              <div className="p-3 sm:p-4 border-b bg-[#F7F7F7] flex items-center justify-between">
                  <h3 className="font-semibold text-sm sm:text-base">Cashier Shifts</h3>
                  <span className="text-xs text-muted-foreground">{filteredShifts.length} cashier(s)</span>
              </div>
              {filteredShifts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No cashier shifts found. Cashiers may not have submitted day-end yet.
                </div>
              ) : (
              <>
              <div className="sm:hidden space-y-2 p-3">
                  {filteredShifts.map(shift => (
                      <div key={`mobile-shift-${shift.id}`} className="bg-white border rounded-xl p-3 space-y-2" data-testid={`mobile-shift-card-${shift.id}`}>
                          <div className="flex items-start justify-between">
                              <div>
                                  <span className="font-bold text-slate-900">{shift.cashierName}</span>
                                  {shift.cashOffice && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                          {shift.cashOffice}
                                          {shift.groupCashiers && <Badge variant="outline" className="text-[8px] px-1 py-0 bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border-[#D6D6D6]">Grouped</Badge>}
                                      </p>
                                  )}
                              </div>
                              <StatusBadge status={shift.status} returnReason={shift.returnReason} />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{new Date(shift.startTime).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                              <span className="text-muted-foreground">{shift.transactionCount} tx</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                              <div>
                                  <span className="text-muted-foreground text-xs">System Total</span>
                                  <p className="font-mono font-medium">{formatCurrency(shift.systemTotals.total)}</p>
                              </div>
                              <div className="text-right">
                                  <span className="text-muted-foreground text-xs">Variance</span>
                                  <p className={`font-mono font-bold ${(shift.variance?.total || 0) !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {(shift.variance?.total || 0) === 0 ? '-' : formatCurrency(shift.variance?.total || 0)}
                                  </p>
                              </div>
                          </div>
                          <Button
                              size="sm"
                              variant="ghost"
                              className="w-full h-10 active:scale-[0.99]"
                              data-testid={`mobile-review-${shift.id}`}
                              onClick={() => handleReview(shift)}
                          >
                              Review
                          </Button>
                      </div>
                  ))}
              </div>
              <div className="hidden sm:block">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="whitespace-nowrap">Cashier</TableHead>
                          <TableHead className="whitespace-nowrap">Office</TableHead>
                          <TableHead className="whitespace-nowrap">Date</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Tx Count</TableHead>
                          <TableHead className="text-right whitespace-nowrap">System Total</TableHead>
                          <TableHead className="text-right whitespace-nowrap"><span className="inline-flex items-center gap-1">Variance <HelpTip text="The difference between counted and expected cash. Positive = over, Negative = short." /></span></TableHead>
                          <TableHead className="text-center whitespace-nowrap">Status</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredShifts.map(shift => (
                          <TableRow key={shift.id} data-testid={`row-cashier-${shift.id}`}>
                              <TableCell className="font-medium">{shift.cashierName}</TableCell>
                              <TableCell className="text-muted-foreground">
                                  <span>{shift.cashOffice || '-'}</span>
                                  {shift.groupCashiers && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border-[#D6D6D6]">Grouped</Badge>}
                              </TableCell>
                              <TableCell>{new Date(shift.startTime).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
                              <TableCell className="text-right">{shift.transactionCount}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(shift.systemTotals.total)}</TableCell>
                              <TableCell className={`text-right font-mono font-bold ${(shift.variance?.total || 0) !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {(shift.variance?.total || 0) === 0 ? '-' : formatCurrency(shift.variance?.total || 0)}
                              </TableCell>
                              <TableCell className="text-center">
                                  <StatusBadge status={shift.status} returnReason={shift.returnReason} />
                              </TableCell>
                              <TableCell className="text-right">
                                  <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-8 px-2 lg:px-3"
                                      data-testid={`button-review-${shift.id}`}
                                      onClick={() => handleReview(shift)}
                                  >
                                      Review
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
              </div>
              </>
              )}
          </div>
      ) : (
          <div className="grid gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                      <Label className="text-sm font-medium whitespace-nowrap">Cash Office:</Label>
                      <Select
                          value={perOfficeSelectedId ? String(perOfficeSelectedId) : ''}
                          onValueChange={(val) => handlePerOfficeSelect(Number(val))}
                      >
                          <SelectTrigger className="w-full sm:w-72" data-testid="select-per-office">
                              <SelectValue placeholder="Select a grouped cash office..." />
                          </SelectTrigger>
                          <SelectContent>
                              {perOfficeList.map((office: any) => (
                                  <SelectItem key={office.cashOffice_ID || office.id} value={String(office.cashOffice_ID || office.id)}>
                                      {office.cashOfficeDesc || office.name || `Office ${office.cashOffice_ID || office.id}`}
                                  </SelectItem>
                              ))}
                              {perOfficeList.length === 0 && (
                                  <SelectItem value="none" disabled>No grouped offices found</SelectItem>
                              )}
                          </SelectContent>
                      </Select>
                      {perOfficeData && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="bg-[#F7F7F7]">{perOfficeData.cashBookName || `Cashbook ${perOfficeData.cashBookId}`}</Badge>
                              <span>{perOfficeData.completionStatus}</span>
                          </div>
                      )}
                      {perOfficeSelectedId && (
                          <Button size="sm" variant="ghost" onClick={refreshPerOfficeSummary} data-testid="button-refresh-per-office">
                              <RefreshCcw className="w-3.5 h-3.5" />
                          </Button>
                      )}
                  </div>

                  {perOfficeLoading && (
                      <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--pos-accent)]" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading office data...</span>
                      </div>
                  )}

                  {!perOfficeLoading && perOfficeData && perOfficeData.cashierSummary.length > 0 && (
                      <>
                          <div className="sm:hidden space-y-2 p-3">
                              {perOfficeData.cashierSummary.map((cs: any) => {
                                  const cId = cs.cashierId || cs.cashier_ID || cs.id;
                                  const cName = cs.cashierName || cs.name || `Cashier ${cId}`;
                                  const cStatus = cs.statusDesc || cs.status || 'Pending';
                                  const isVerified = cStatus.toLowerCase().includes('verif');
                                  const isReturned = cStatus.toLowerCase().includes('return');
                                  const isPending = !isVerified && !isReturned;
                                  return (
                                      <div key={`mobile-po-${cId}`} className="bg-white border rounded-xl p-3 space-y-3" data-testid={`mobile-po-card-${cId}`}>
                                          <div className="flex items-center justify-between">
                                              <span className="font-bold text-slate-900">{cName}</span>
                                              <Badge variant="outline" className={cn(
                                                  'text-[10px]',
                                                  isVerified && 'bg-green-50 text-green-700 border-green-200',
                                                  isReturned && 'bg-amber-50 text-amber-700 border-amber-200',
                                                  isPending && 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border-[#D6D6D6]'
                                              )}>
                                                  {cStatus}
                                              </Badge>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                              <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="flex-1 h-11 active:scale-[0.99]"
                                                  onClick={() => {
                                                      const fakeShift: CashierShift = {
                                                          id: String(cId),
                                                          userId: null,
                                                          cashierName: cName,
                                                          cashOffice: perOfficeList.find(o => (o.cashOffice_ID || o.id) === perOfficeSelectedId)?.cashOfficeDesc || '',
                                                          cashOfficeId: perOfficeSelectedId,
                                                          groupCashiers: true,
                                                          startTime: new Date().toISOString(),
                                                          status: isVerified ? 'COMPLETED' : isReturned ? 'RETURNED' : 'PENDING_APPROVAL',
                                                          systemTotals: { cash: 0, card: 0, total: 0 },
                                                          variance: { cash: 0, card: 0, total: 0 },
                                                          transactionCount: 0,
                                                          reconcileId: null,
                                                          hasActiveSession: false,
                                                      };
                                                      handleReview(fakeShift);
                                                  }}
                                                  data-testid={`button-review-po-${cId}`}
                                              >
                                                  <Eye className="w-3.5 h-3.5 mr-1" /> Review
                                              </Button>
                                              {isPending && (
                                                  <Button
                                                      size="sm"
                                                      className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white active:scale-[0.99]"
                                                      disabled={perOfficeVerifying === cId}
                                                      onClick={() => handlePerOfficeVerifyCashier(Number(cId))}
                                                      data-testid={`button-verify-po-${cId}`}
                                                  >
                                                      {perOfficeVerifying === cId ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                                                      Verify
                                                  </Button>
                                              )}
                                              {isPending && (
                                                  <Popover>
                                                      <PopoverTrigger asChild>
                                                          <Button size="sm" variant="outline" className="flex-1 h-11 text-amber-600 border-amber-300 active:scale-[0.99]" data-testid={`button-return-po-${cId}`}>
                                                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return
                                                          </Button>
                                                      </PopoverTrigger>
                                                      <PopoverContent className="w-72">
                                                          <div className="space-y-2">
                                                              <Label className="text-xs font-medium">Return Reason</Label>
                                                              <Input
                                                                  className="h-11"
                                                                  placeholder="e.g. Cash count mismatch"
                                                                  value={returnReason}
                                                                  onChange={(e) => setReturnReason(e.target.value)}
                                                                  data-testid={`input-return-reason-po-${cId}`}
                                                              />
                                                              <Button
                                                                  size="sm"
                                                                  className="w-full h-11"
                                                                  disabled={!returnReason}
                                                                  onClick={async () => {
                                                                      const reconcileId = cs.cashierReconcileId || cs.reconcileId || cId;
                                                                      await handlePerOfficeReturn(Number(reconcileId), returnReason);
                                                                      setReturnReason('');
                                                                  }}
                                                                  data-testid={`button-confirm-return-po-${cId}`}
                                                              >
                                                                  Confirm Return
                                                              </Button>
                                                          </div>
                                                      </PopoverContent>
                                                  </Popover>
                                              )}
                                              {isVerified && <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                          <div className="hidden sm:block">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Cashier</TableHead>
                                      <TableHead className="text-center">Status</TableHead>
                                      <TableHead className="text-right">Action</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {perOfficeData.cashierSummary.map((cs: any) => {
                                      const cId = cs.cashierId || cs.cashier_ID || cs.id;
                                      const cName = cs.cashierName || cs.name || `Cashier ${cId}`;
                                      const cStatus = cs.statusDesc || cs.status || 'Pending';
                                      const isVerified = cStatus.toLowerCase().includes('verif');
                                      const isReturned = cStatus.toLowerCase().includes('return');
                                      const isPending = !isVerified && !isReturned;
                                      return (
                                          <TableRow key={cId}>
                                              <TableCell className="font-medium">{cName}</TableCell>
                                              <TableCell className="text-center">
                                                  <Badge variant="outline" className={cn(
                                                      'text-[10px]',
                                                      isVerified && 'bg-green-50 text-green-700 border-green-200',
                                                      isReturned && 'bg-amber-50 text-amber-700 border-amber-200',
                                                      isPending && 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border-[#D6D6D6]'
                                                  )}>
                                                      {cStatus}
                                                  </Badge>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                  <div className="flex items-center justify-end gap-2">
                                                      <Button
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={() => {
                                                              const fakeShift: CashierShift = {
                                                                  id: String(cId),
                                                                  userId: null,
                                                                  cashierName: cName,
                                                                  cashOffice: perOfficeList.find(o => (o.cashOffice_ID || o.id) === perOfficeSelectedId)?.cashOfficeDesc || '',
                                                                  cashOfficeId: perOfficeSelectedId,
                                                                  groupCashiers: true,
                                                                  startTime: new Date().toISOString(),
                                                                  status: isVerified ? 'COMPLETED' : isReturned ? 'RETURNED' : 'PENDING_APPROVAL',
                                                                  systemTotals: { cash: 0, card: 0, total: 0 },
                                                                  variance: { cash: 0, card: 0, total: 0 },
                                                                  transactionCount: 0,
                                                                  reconcileId: null,
                                                                  hasActiveSession: false,
                                                              };
                                                              handleReview(fakeShift);
                                                          }}
                                                          data-testid={`button-review-po-${cId}`}
                                                      >
                                                          <Eye className="w-3.5 h-3.5 mr-1" /> Review
                                                      </Button>
                                                      {isPending && (
                                                          <Button
                                                              size="sm"
                                                              className="bg-green-600 hover:bg-green-700 text-white"
                                                              disabled={perOfficeVerifying === cId}
                                                              onClick={() => handlePerOfficeVerifyCashier(Number(cId))}
                                                              data-testid={`button-verify-po-${cId}`}
                                                          >
                                                              {perOfficeVerifying === cId ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                                                              Verify
                                                          </Button>
                                                      )}
                                                      {isPending && (
                                                          <Popover>
                                                              <PopoverTrigger asChild>
                                                                  <Button size="sm" variant="outline" className="text-amber-600 border-amber-300" data-testid={`button-return-po-${cId}`}>
                                                                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return
                                                                  </Button>
                                                              </PopoverTrigger>
                                                              <PopoverContent className="w-72">
                                                                  <div className="space-y-2">
                                                                      <Label className="text-xs font-medium">Return Reason</Label>
                                                                      <Input
                                                                          placeholder="e.g. Cash count mismatch"
                                                                          value={returnReason}
                                                                          onChange={(e) => setReturnReason(e.target.value)}
                                                                          data-testid={`input-return-reason-po-${cId}`}
                                                                      />
                                                                      <Button
                                                                          size="sm"
                                                                          className="w-full"
                                                                          disabled={!returnReason}
                                                                          onClick={async () => {
                                                                              const reconcileId = cs.cashierReconcileId || cs.reconcileId || cId;
                                                                              await handlePerOfficeReturn(Number(reconcileId), returnReason);
                                                                              setReturnReason('');
                                                                          }}
                                                                          data-testid={`button-confirm-return-po-${cId}`}
                                                                      >
                                                                          Confirm Return
                                                                      </Button>
                                                                  </div>
                                                              </PopoverContent>
                                                          </Popover>
                                                      )}
                                                      {isVerified && <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>}
                                                  </div>
                                              </TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                          </div>

                          {perOfficeData.allVerified && (
                              <div className="p-3 sm:p-4 border-t bg-green-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                  <div className="text-sm text-green-800 font-medium text-center sm:text-left">
                                      All cashiers verified. Ready for final office-level submission.
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                      <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-11 sm:h-9"
                                          onClick={() => perOfficeSelectedId && handlePerOfficePrintCashReport(perOfficeSelectedId)}
                                          data-testid="button-po-print-cash-report"
                                      >
                                          <Printer className="w-3.5 h-3.5 mr-1" /> Cash Report
                                      </Button>
                                      <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-11 sm:h-9"
                                          onClick={() => perOfficeSelectedId && handlePerOfficePrintDepositSlip(perOfficeSelectedId)}
                                          data-testid="button-po-print-deposit-slip"
                                      >
                                          <Printer className="w-3.5 h-3.5 mr-1" /> Deposit Slip
                                      </Button>
                                      <Button
                                          className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold px-6 h-11 sm:h-9"
                                          disabled={perOfficeSubmitting}
                                          onClick={handlePerOfficeSubmitAll}
                                          data-testid="button-submit-per-office"
                                      >
                                          {perOfficeSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                          Submit Office Reconciliation
                                      </Button>
                                  </div>
                              </div>
                          )}

                          {!perOfficeData.allVerified && perOfficeData.validationResult && !perOfficeData.validationResult.isValid && (
                              <div className="p-3 border-t bg-amber-50 text-xs text-amber-700 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 shrink-0" />
                                  {perOfficeData.validationResult.message || 'Not all cashiers have been verified. Verify each cashier before submitting the office.'}
                              </div>
                          )}

                          {!perOfficeData.allVerified && (!perOfficeData.validationResult || perOfficeData.validationResult.isValid) && (
                              <div className="p-3 border-t bg-[var(--pos-accent-tint)] text-xs text-[#6B6B6B] flex items-center gap-2">
                                  <Info className="w-4 h-4 shrink-0" />
                                  Verify each cashier individually, then submit the office reconciliation once all are verified.
                              </div>
                          )}
                      </>
                  )}

                  {!perOfficeLoading && perOfficeData && perOfficeData.cashierSummary.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                          No cashiers found for this office.
                      </div>
                  )}

                  {!perOfficeLoading && !perOfficeSelectedId && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                          Select a grouped cash office above to begin per-office reconciliation.
                      </div>
                  )}
              </div>
          </div>
      )}

      <Dialog open={showVarianceHistory} onOpenChange={setShowVarianceHistory}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <TrendingUp className="w-5 h-5 text-[var(--pos-accent)]" />
                    Cashier Variance Statistics
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                    Analyze historical shortages and surpluses per cashier
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 sm:gap-6 py-4 flex-1 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 bg-[#F7F7F7] p-3 sm:p-4 rounded-lg border">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs sm:text-sm">Financial Year</Label>
                        <Select value={statsFinancialYear} onValueChange={(val) => updateStatsPeriod(val, statsMonth)}>
                            <SelectTrigger className="w-full bg-white h-11 sm:h-9">
                                <SelectValue placeholder="All Years" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Years</SelectItem>
                                {generateFinancialYears(platinumUser?.finYear).map(fy => (
                                    <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs sm:text-sm">Month</Label>
                        <Select 
                            value={statsMonth} 
                            onValueChange={(val) => updateStatsPeriod(statsFinancialYear, val)}
                            disabled={statsFinancialYear === 'All'}
                        >
                            <SelectTrigger className="w-full bg-white h-11 sm:h-9">
                                <SelectValue placeholder="All Months" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Months</SelectItem>
                                {MONTHS.map(m => (
                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs sm:text-sm">Cashier</Label>
                        <Select value={statsCashier} onValueChange={setStatsCashier}>
                            <SelectTrigger className="w-full bg-white h-11 sm:h-9">
                                <SelectValue placeholder="All Cashiers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Cashiers</SelectItem>
                                {activeShifts.map(s => (
                                    <SelectItem key={s.id} value={s.cashierName}>{s.cashierName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Card className="bg-red-50 border-red-200 shadow-sm">
                        <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium text-red-800">Total Shortage</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                            <div className="text-lg sm:text-2xl font-bold text-red-600">
                                {formatCurrency(varianceStats?.totalShortage || 0)}
                            </div>
                            <p className="text-xs text-red-700 mt-1">
                                {varianceStats?.shortageCount} occurrences
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200 shadow-sm">
                        <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium text-green-800">Total Surplus</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                            <div className="text-lg sm:text-2xl font-bold text-green-600">
                                {formatCurrency(varianceStats?.totalSurplus || 0)}
                            </div>
                            <p className="text-xs text-green-700 mt-1">
                                {varianceStats?.surplusCount} occurrences
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-[var(--pos-accent-tint)] border-[#D6D6D6] shadow-sm">
                        <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium text-[#2E2E2E]">Net Variance</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                            <div className={`text-lg sm:text-2xl font-bold ${
                                (varianceStats?.netVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                                {formatCurrency(varianceStats?.netVariance || 0)}
                            </div>
                            <p className="text-xs text-[#6B6B6B] mt-1">
                                Over {varianceStats?.shiftCount} shifts
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-[#F7F7F7] border-[#D6D6D6] shadow-sm">
                        <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium text-slate-800">Performance Rating</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                            <div className="text-lg sm:text-2xl font-bold text-slate-700">
                                {varianceStats?.shiftCount ? 
                                    `${(100 - (((varianceStats.shortageCount + varianceStats.surplusCount) / varianceStats.shiftCount) * 100)).toFixed(0)}%` 
                                    : 'N/A'
                                }
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                                Accuracy Rate
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="border rounded-md flex-1 overflow-auto">
                    <div className="sm:hidden space-y-2 p-2">
                        {varianceStats?.history.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No historical data found for this period
                            </div>
                        ) : (
                            varianceStats?.history.map(shift => (
                                <div key={shift.id} className="bg-white border rounded-xl p-3 space-y-2" data-testid={`mobile-variance-card-${shift.id}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-slate-900 text-sm">{shift.cashierName}</span>
                                        <span className="text-xs text-muted-foreground">{new Date(shift.startTime).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <span className="text-muted-foreground block">System</span>
                                            <span className="font-mono">{formatCurrency(shift.systemTotals.total)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">Declared</span>
                                            <span className="font-mono">{formatCurrency(shift.declaredTotals?.total || 0)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-muted-foreground block">Variance</span>
                                            <span className={`font-mono font-bold ${(shift.variance?.total || 0) !== 0 ? ((shift.variance?.total || 0) < 0 ? 'text-red-600' : 'text-green-600') : 'text-slate-400'}`}>
                                                {formatCurrency(shift.variance?.total || 0)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Badge variant="outline" className={
                                            (shift.variance?.total || 0) === 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"
                                        }>
                                            {(shift.variance?.total || 0) === 0 ? 'Balanced' : 'Variance'}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="hidden sm:block">
                    <Table>
                        <TableHeader className="bg-[#F7F7F7] sticky top-0">
                            <TableRow>
                                <TableHead className="whitespace-nowrap">Date</TableHead>
                                <TableHead className="whitespace-nowrap">Cashier</TableHead>
                                <TableHead className="text-right whitespace-nowrap">System Total</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Declared Total</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Variance</TableHead>
                                <TableHead className="text-center whitespace-nowrap">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {varianceStats?.history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No historical data found for this period
                                    </TableCell>
                                </TableRow>
                            ) : (
                                varianceStats?.history.map(shift => (
                                    <TableRow key={shift.id}>
                                        <TableCell>{new Date(shift.startTime).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
                                        <TableCell>{shift.cashierName}</TableCell>
                                        <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(shift.systemTotals.total)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(shift.declaredTotals?.total || 0)}</TableCell>
                                        <TableCell className={`text-right font-mono font-bold ${(shift.variance?.total || 0) !== 0 ? ((shift.variance?.total || 0) < 0 ? 'text-red-600' : 'text-green-600') : 'text-slate-400'}`}>
                                            {formatCurrency(shift.variance?.total || 0)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={
                                                (shift.variance?.total || 0) === 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"
                                            }>
                                                {(shift.variance?.total || 0) === 0 ? 'Balanced' : 'Variance'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    </div>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {selectedShift && (
          <Dialog open={!!selectedShift} onOpenChange={() => { setSelectedShift(null); setReviewData(null); }}>
              <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto">
                  <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                          Reconciliation Review: <span className="text-[var(--pos-accent)]">{selectedShift.cashierName}</span>
                      </DialogTitle>
                      <DialogDescription className="text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                          <span>Cashier ID: {selectedShift.id} | Office: {selectedShift.cashOffice || 'N/A'}</span>
                          {selectedShift.groupCashiers && (
                              <Badge variant="outline" className="text-[9px] bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border-[#D6D6D6]">
                                  <Users className="w-3 h-3 mr-1" /> Grouped Office
                              </Badge>
                          )}
                      </DialogDescription>
                  </DialogHeader>

                  {reviewLoading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Loading reconciliation data...
                    </div>
                  ) : reviewData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                          <div className="space-y-4">
                              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">System Totals</h3>
                              
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg gap-1">
                                  <div className="flex items-center gap-2">
                                      <Banknote className="w-4 h-4 text-gray-500 shrink-0" />
                                      <span className="text-xs sm:text-sm">Cash on Hand + Drop Box</span>
                                  </div>
                                  <span className="font-mono font-medium text-sm sm:text-base ml-6 sm:ml-0">{formatCurrency(Number(reviewData.details?.totalCashAmt || reviewData.details?.cashAmount || selectedShift.systemTotals.cash || 0) + Number(reviewData.details?.totalDropBoxAmt || reviewData.details?.dropBoxAmount || 0))}</span>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg gap-1">
                                  <div className="flex items-center gap-2">
                                      <CreditCard className="w-4 h-4 text-gray-500 shrink-0" />
                                      <span className="text-xs sm:text-sm">Debit/Credit Card</span>
                                  </div>
                                  <span className="font-mono font-medium text-sm sm:text-base ml-6 sm:ml-0">{formatCurrency(Number(reviewData.details?.totalCreditAmt || reviewData.details?.cardAmount || selectedShift.systemTotals.card || 0))}</span>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg gap-1">
                                  <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                                      <span className="text-xs sm:text-sm">Cheque Receipts</span>
                                  </div>
                                  <span className="font-mono font-medium text-sm sm:text-base ml-6 sm:ml-0">{formatCurrency(Number(reviewData.details?.totalChequeAmt || reviewData.details?.chequeAmount || 0))}</span>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg gap-1">
                                  <div className="flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                                      <span className="text-xs sm:text-sm">Postal Order Receipts</span>
                                  </div>
                                  <span className="font-mono font-medium text-sm sm:text-base ml-6 sm:ml-0">{formatCurrency(Number(reviewData.details?.totalPostalOrderAmt || reviewData.details?.postalOrderAmount || 0))}</span>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-100 rounded-lg border border-gray-200 gap-1">
                                  <span className="font-bold text-gray-700 text-sm sm:text-base">Grand Total (R)</span>
                                  <span className="font-mono font-bold text-base sm:text-lg">{formatCurrency(Number(reviewData.details?.totalAmt || reviewData.details?.totalAmount || selectedShift.systemTotals.total || 0))}</span>
                              </div>
                          </div>

                          <div className="space-y-4">
                              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">Cashier Declared Totals</h3>
                              {reviewData.reconcile ? (
                                <>
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-[var(--pos-accent-tint)] rounded-lg border border-[#D6D6D6] gap-1">
                                      <span className="text-xs sm:text-sm text-[#2E2E2E]">Cash on Hand + Drop Box</span>
                                      <span className="font-mono font-bold text-sm sm:text-base">{formatCurrency(Number(reviewData.reconcile.totalCashAmt || reviewData.reconcile.cashDeclared || 0) + Number(reviewData.reconcile.totalDropBoxAmt || reviewData.reconcile.dropBoxDeclared || 0))}</span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-[var(--pos-accent-tint)] rounded-lg border border-[#D6D6D6] gap-1">
                                      <span className="text-xs sm:text-sm text-[#2E2E2E]">Debit/Credit Card</span>
                                      <span className="font-mono font-bold text-sm sm:text-base">{formatCurrency(Number(reviewData.reconcile.totalCreditAmt || reviewData.reconcile.cardDeclared || 0))}</span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-[var(--pos-accent-tint)] rounded-lg border border-[#D6D6D6] gap-1">
                                      <span className="text-xs sm:text-sm text-[#2E2E2E]">Cheque Receipts</span>
                                      <span className="font-mono font-bold text-sm sm:text-base">{formatCurrency(Number(reviewData.reconcile.totalChequeAmt || reviewData.reconcile.chequeDeclared || 0))}</span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-[var(--pos-accent-tint)] rounded-lg border border-[#D6D6D6] gap-1">
                                      <span className="text-xs sm:text-sm text-[#2E2E2E]">Postal Order Receipts</span>
                                      <span className="font-mono font-bold text-sm sm:text-base">{formatCurrency(Number(reviewData.reconcile.totalPostalOrderAmt || reviewData.reconcile.postalOrderDeclared || 0))}</span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-[var(--pos-accent-tint-strong)] rounded-lg border border-[#D6D6D6] gap-1">
                                      <span className="font-bold text-[#2E2E2E] text-sm sm:text-base">Grand Total (R)</span>
                                      <span className="font-mono font-bold text-base sm:text-lg">{formatCurrency(Number(reviewData.reconcile.totalAmt || reviewData.reconcile.totalDeclared || 0))}</span>
                                  </div>
                                  {Number(reviewData.reconcile.cashFloat || reviewData.reconcile.float || 0) > 0 && (
                                    <div className="flex justify-between items-center p-2.5 bg-[#F7F7F7] rounded-lg border border-[#D6D6D6] text-sm">
                                        <span className="text-slate-600">Float</span>
                                        <span className="font-mono font-medium text-slate-700">{formatCurrency(Number(reviewData.reconcile.cashFloat || reviewData.reconcile.float || 0))}</span>
                                    </div>
                                  )}
                                  {reviewData.reconcile.reason && (
                                    <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                                        <span className="text-amber-700 font-medium">Reason: </span>
                                        <span className="text-amber-800">{reviewData.reconcile.reason}</span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground italic bg-muted/20 rounded-lg border-2 border-dashed p-8">
                                    No reconcile data available
                                </div>
                              )}
                          </div>
                      </div>

                      {reviewData.systemVsCashier.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 sm:px-4 py-2 border-b text-xs font-semibold text-muted-foreground">
                            SYSTEM VS CASHIER COMPARISON
                          </div>
                          <div className="sm:hidden space-y-2 p-2 max-h-[200px] overflow-y-auto">
                            {reviewData.systemVsCashier.map((row: any, idx: number) => (
                              <div key={idx} className="bg-white border rounded-lg p-2.5 space-y-1.5">
                                <span className="text-xs font-medium text-slate-900">{row.description || row.paymentType || row.type || `Row ${idx + 1}`}</span>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground block">System</span>
                                    <span className="font-mono">{formatCurrency(Number(row.systemAmount || row.systemTotal || 0))}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Cashier</span>
                                    <span className="font-mono">{formatCurrency(Number(row.cashierAmount || row.cashierTotal || 0))}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-muted-foreground block">Variance</span>
                                    <span className={`font-mono font-bold ${Number(row.variance || row.difference || 0) !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {formatCurrency(Number(row.variance || row.difference || 0))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="hidden sm:block max-h-[200px] overflow-y-auto">
                            <Table>
                              <TableHeader className="bg-[#F7F7F7] sticky top-0">
                                <TableRow>
                                  <TableHead className="text-xs">Description</TableHead>
                                  <TableHead className="text-xs text-right">System</TableHead>
                                  <TableHead className="text-xs text-right">Cashier</TableHead>
                                  <TableHead className="text-xs text-right">Variance</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reviewData.systemVsCashier.map((row: any, idx: number) => (
                                  <TableRow key={idx}>
                                    <TableCell className="text-xs">{row.description || row.paymentType || row.type || `Row ${idx + 1}`}</TableCell>
                                    <TableCell className="text-xs text-right font-mono">{formatCurrency(Number(row.systemAmount || row.systemTotal || 0))}</TableCell>
                                    <TableCell className="text-xs text-right font-mono">{formatCurrency(Number(row.cashierAmount || row.cashierTotal || 0))}</TableCell>
                                    <TableCell className={`text-xs text-right font-mono font-bold ${Number(row.variance || row.difference || 0) !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {formatCurrency(Number(row.variance || row.difference || 0))}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      <div className="border rounded-lg overflow-hidden">
                        <Tabs value={reviewTab} onValueChange={setReviewTab}>
                          <div className="bg-gray-50 px-4 py-2 border-b">
                            <TabsList className="bg-white border flex-wrap h-auto gap-0.5">
                              <TabsTrigger value="cash" className="text-xs">Cash ({reviewData.cashReceipts.length})</TabsTrigger>
                              <TabsTrigger value="card" className="text-xs">Card ({reviewData.cardReceipts.length})</TabsTrigger>
                              <TabsTrigger value="cheque" className="text-xs">Cheque ({reviewData.chequeReceipts.length})</TabsTrigger>
                              <TabsTrigger value="postal" className="text-xs">Postal ({reviewData.postalReceipts.length})</TabsTrigger>
                              <TabsTrigger value="dropbox" className="text-xs">Dropbox ({reviewData.dropboxReceipts.length})</TabsTrigger>
                              <TabsTrigger value="offline" className="text-xs"><WifiOff className="w-3 h-3 mr-1" />Offline ({reviewData.offlineReceipts?.length || 0})</TabsTrigger>
                            </TabsList>
                          </div>
                          <TabsContent value="cash" className="mt-0 p-2">
                            {renderReceiptTable(reviewData.cashReceipts, 'cash')}
                          </TabsContent>
                          <TabsContent value="card" className="mt-0 p-2">
                            {renderReceiptTable(reviewData.cardReceipts, 'card')}
                          </TabsContent>
                          <TabsContent value="cheque" className="mt-0 p-2">
                            {renderReceiptTable(reviewData.chequeReceipts, 'cheque')}
                          </TabsContent>
                          <TabsContent value="postal" className="mt-0 p-2">
                            {renderReceiptTable(reviewData.postalReceipts, 'postal order')}
                          </TabsContent>
                          <TabsContent value="dropbox" className="mt-0 p-2">
                            {renderReceiptTable(reviewData.dropboxReceipts, 'dropbox')}
                          </TabsContent>
                          <TabsContent value="offline" className="mt-0 p-2">
                            {renderReceiptTable(reviewData.offlineReceipts || [], 'offline')}
                          </TabsContent>
                        </Tabs>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Return Reason (required to return)</Label>
                        <Input 
                          className="h-11 sm:h-9"
                          value={returnReason} 
                          onChange={(e) => setReturnReason(e.target.value)} 
                          placeholder="Enter reason for returning to cashier..."
                          data-testid="input-return-reason"
                        />
                      </div>
                    </div>
                  ) : null}

                  {selectedShift.groupCashiers && (
                      <div className="text-xs text-[#6B6B6B] bg-[var(--pos-accent-tint)] border border-[#D6D6D6] rounded-lg px-3 py-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          This cashier belongs to a grouped office ({selectedShift.cashOffice}). All cashiers in this office must be reconciled together. Use the "Per Cash Office" view to approve the entire office at once.
                      </div>
                  )}
                  <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 border-t pt-3 mb-2">
                    <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => handlePrintCashReport(selectedShift.id)} data-testid="button-print-cash-report">
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> Cash Report
                    </Button>
                    <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => handlePrintDepositSlip(selectedShift.id)} data-testid="button-print-deposit-slip">
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> Deposit Slip
                    </Button>
                    <HelpTip text="Generate printable PDF reports for this cashier's shift." />
                  </div>
                  <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                      <div className="flex items-center gap-1 sm:mr-auto w-full sm:w-auto">
                        <Button 
                            variant="destructive" 
                            className="flex-1 sm:flex-initial sm:w-32 h-11 sm:h-9"
                            onClick={handleReturn}
                            disabled={!returnReason.trim() || actionLoading}
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Return to Cashier'}
                        </Button>
                        <HelpTip text="Send this submission back to the cashier for correction." />
                      </div>
                      <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-9" onClick={() => { setSelectedShift(null); setReviewData(null); }}>Cancel</Button>
                      <div className="flex items-center gap-1 w-full sm:w-auto">
                        <Button 
                            className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-initial sm:w-32 h-11 sm:h-9"
                            onClick={() => handleApprove(selectedShift.id)}
                            disabled={actionLoading}
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve & Post'}
                        </Button>
                        <HelpTip text="Accept this cashier's day-end reconciliation and close their shift." />
                      </div>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      )}
    </div>
    </div>
    </PosLayout>
  );
}

function StatusBadge({ status, returnReason }: { status: DayEndStatus; returnReason?: string | null }) {
    switch (status) {
        case 'NOT_SUBMITTED':
            return <Badge variant="outline" className="text-gray-500 border-gray-300">Not Submitted</Badge>;
        case 'PENDING_APPROVAL':
            return <Badge variant="secondary" className="bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)] hover:bg-[var(--pos-accent-tint-strong)]">Pending Approval</Badge>;
        case 'RETURNED':
            if (returnReason) {
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="destructive" className="cursor-help">Returned</Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px]">
                                <p className="text-xs font-medium">Return Reason:</p>
                                <p className="text-xs">{returnReason}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            }
            return <Badge variant="destructive">Returned</Badge>;
        case 'COMPLETED':
            return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 shadow-none">Approved</Badge>;
        default:
            return null;
    }
}
