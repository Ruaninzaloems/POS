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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { platinumGetAuthDayEndCashierList, platinumGetAuthDayEndCashierDetails, platinumGetAuthDayEndCashierReconcile, platinumGetPendingCancelRequests, platinumApproveCancelReceipt, platinumDeclineCancelReceipt } from '@/lib/external-api';
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
  Loader2
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

  let status: DayEndStatus = 'PENDING_APPROVAL';
  const rawStatus = String(c.status || c.reconcileStatus || c.dayEndStatus || '').toLowerCase();
  if (rawStatus.includes('complet') || rawStatus.includes('post') || rawStatus.includes('finish') || rawStatus.includes('approved')) {
    status = 'COMPLETED';
  } else if (rawStatus.includes('return')) {
    status = 'RETURNED';
  } else if (rawStatus.includes('not') || rawStatus.includes('open') || rawStatus.includes('submit')) {
    status = 'NOT_SUBMITTED';
  }

  return {
    id,
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
    rawData: c,
  };
}

const FINANCIAL_YEARS = ['2025/2026', '2024/2025', '2023/2024', '2022/2023'];
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
  raw?: any;
}

export default function SupervisorDashboard() {
  const { returnDayEnd, approveCancellation, recentTransactions, referenceData, platinumUser } = usePos();
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
        id: Number(req.id),
        userId: platinumUser?.user_ID || 0,
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
        id: Number(req.id),
        userId: platinumUser?.user_ID || 0,
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

  const filteredShifts = shifts.filter(shift => {
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

  const pendingCount = shifts.filter(s => s.status === 'PENDING_APPROVAL').length;
  const varianceCount = shifts.filter(s => (s.variance?.total || 0) !== 0 && s.status === 'PENDING_APPROVAL').length;
  const totalPosted = shifts.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + s.systemTotals.total, 0);
  const totalSystemRevenue = shifts.reduce((sum, s) => sum + s.systemTotals.total, 0);

  const loadReviewData = useCallback(async (cashierId: string) => {
    setReviewLoading(true);
    setReviewData(null);
    setReviewTab('cash');
    try {
      const [detailsRes, reconcileRes, cashRes, cardRes, chequeRes, postalRes, dropboxRes, sysVsCashierRes] = await Promise.all([
        platinumGetAuthDayEndCashierDetails({ id: cashierId }).catch(() => null),
        platinumGetAuthDayEndCashierReconcile({ cashierId }).catch(() => null),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-cash-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch(() => []),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-card-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch(() => []),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-cheque-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch(() => []),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-postal-order-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch(() => []),
        apiRequest('POST', `/api/platinum/auth-day-end/cashier-receipt-drop-box-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch(() => []),
        apiRequest('POST', `/api/platinum/auth-day-end/system-vs-cashier-data-list?id=${cashierId}`, PAGER_BODY).then(r => r.json()).catch(() => []),
      ]);

      console.log('[Supervisor] Review details:', detailsRes);
      console.log('[Supervisor] Review reconcile:', reconcileRes);
      console.log('[Supervisor] Cash receipts:', cashRes);
      console.log('[Supervisor] Card receipts:', cardRes);
      console.log('[Supervisor] System vs Cashier:', sysVsCashierRes);

      setReviewData({
        details: detailsRes,
        reconcile: reconcileRes,
        cashReceipts: extractItems(cashRes),
        cardReceipts: extractItems(cardRes),
        chequeReceipts: extractItems(chequeRes),
        postalReceipts: extractItems(postalRes),
        dropboxReceipts: extractItems(dropboxRes),
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
      await apiRequest('POST', `/api/platinum/auth-day-end/finish-day-end-reconcile?userId=${cashierId}`, {});
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

  const handleReturn = async () => {
    if (!selectedShift || !returnReason) return;
    setActionLoading(true);
    try {
      await apiRequest('POST', '/api/platinum/auth-day-end/return-day-end-reconcile', {
        id: Number(selectedShift.id),
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

  const renderReceiptTable = (receipts: any[], type: string) => {
    if (receipts.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No {type} receipts found
        </div>
      );
    }
    return (
      <div className="border rounded-md overflow-auto max-h-[300px]">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0">
            <TableRow>
              <TableHead className="text-xs py-2">#</TableHead>
              <TableHead className="text-xs py-2">Account/Ref</TableHead>
              <TableHead className="text-xs py-2">Receipt No</TableHead>
              <TableHead className="text-xs py-2">Date</TableHead>
              <TableHead className="text-xs py-2">Cancelled</TableHead>
              <TableHead className="text-xs py-2 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((item, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50">
                <TableCell className="text-xs py-1.5">{idx + 1}</TableCell>
                <TableCell className="text-xs font-mono py-1.5">{item.accountNumber || item.accountId || item.invoiceNumber || item.account || '-'}</TableCell>
                <TableCell className="text-xs font-mono py-1.5">{item.receiptNo || item.receipt_no || item.receiptNumber || '-'}</TableCell>
                <TableCell className="text-xs py-1.5">{item.receiptDate || item.receiptDateTime || item.date || '-'}</TableCell>
                <TableCell className="text-xs py-1.5">
                  {item.isCancelled === 1 || item.isCancelled === true ? (
                    <Badge variant="destructive" className="text-[9px]">Yes</Badge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-right font-mono font-medium py-1.5">R {Number(item.amount || item.totalAmount || 0).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <PosLayout>
    <div className="h-full overflow-y-auto bg-slate-50 p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">Supervisor Dashboard <HelpTip text="Monitor cashier activities, review day-end submissions, and approve cancellation requests." side="right" /></h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Reconciliation & Approvals</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border shadow-sm">
                <div className="text-xs font-medium text-muted-foreground">Administrator</div>
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">AD</div>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">Pending Approvals <HelpTip text="Total number of cashier day-end submissions and cancellation requests awaiting supervisor review." /></CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{pendingCount + allPendingCancellationCount}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <RefreshCcw className="w-3 h-3" /> {pendingCount} shifts, {allPendingCancellationCount} voids
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">Variances Detected <HelpTip text="Number of pending shifts where the cashier's declared amount differs from the system total." /></CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-red-600">{varianceCount}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Requires attention
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">Total Posted (Today) <HelpTip text="Sum of all successfully reconciled and approved cashier shift totals for today." /></CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-3xl font-bold text-green-600">{formatCurrency(totalPosted)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Successfully reconciled
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">Total System Revenue <HelpTip text="Combined system-recorded revenue across all active cashier shifts, regardless of approval status." /></CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-3xl font-bold text-purple-600">{formatCurrency(totalSystemRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> All active shifts
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
          <Tabs defaultValue="pending" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
                <h3 className="font-semibold text-orange-900 flex items-center gap-2 text-sm sm:text-base">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    Cancellation Requests
                    <HelpTip text="Transactions that cashiers have requested to void. Review the reason before approving." />
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-orange-700 hover:bg-orange-100" onClick={loadPendingCancelRequests} disabled={cancelRequestsLoading}>
                        <RefreshCcw className={`w-3 h-3 ${cancelRequestsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </h3>
                <TabsList className="bg-white/50 border border-orange-100">
                    <TabsTrigger value="pending" className="text-xs sm:text-sm data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
                        Pending ({allPendingCancellationCount})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs sm:text-sm data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
                        History
                    </TabsTrigger>
                </TabsList>
            </div>
            
            <TabsContent value="pending" className="mt-0">
                {cancelRequestsLoading ? (
                    <div className="text-center py-8 bg-white/50 rounded border border-dashed border-orange-200 text-orange-800/60 text-sm flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading pending cancellation requests...
                    </div>
                ) : allPendingCancellationCount === 0 ? (
                    <div className="text-center py-8 bg-white/50 rounded border border-dashed border-orange-200 text-orange-800/60 text-sm">
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
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase text-[10px] tracking-wider font-semibold">{req.paymentType}</span>
                                            )}
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-700 border-blue-300 bg-blue-50">API</Badge>
                                        </div>
                                    </div>
                                    <span className="font-bold text-slate-900 font-mono">R {req.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>{req.cashierName || 'Unknown'}</span>
                                    <span className="text-xs">{req.requestDate ? new Date(req.requestDate).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false }) + ' · ' + new Date(req.requestDate).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' }) : '—'}</span>
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
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase text-[10px] tracking-wider font-semibold">{mainType}</span>
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-700 border-amber-300 bg-amber-50">Local</Badge>
                                        </div>
                                    </div>
                                    <span className="font-bold text-slate-900 font-mono">R {tx.totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>{cashier?.name || 'Unknown Cashier'}</span>
                                    <span className="text-xs">{new Date(tx.timestamp).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false }) + ' · ' + new Date(tx.timestamp).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' })}</span>
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
                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase text-[10px] tracking-wider font-semibold">
                                                            {req.paymentType}
                                                        </span>
                                                    )}
                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-700 border-blue-300 bg-blue-50">API</Badge>
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
                                                    <span className="text-xs text-muted-foreground">{new Date(req.requestDate).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' })}</span>
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
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase text-[10px] tracking-wider font-semibold">
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
                                                <span className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' })}</span>
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
                    <div className="text-center py-8 bg-white/50 rounded border border-dashed border-slate-200 text-slate-500 text-sm">
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
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase text-[10px] tracking-wider font-semibold">
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
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
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
                    <Button variant="outline" className={`gap-2 w-full md:w-auto ${filterVariance || filterStatus !== 'All' || filterDate !== 'All' ? 'bg-slate-100 border-slate-300' : ''}`}>
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
        <TabsList className="bg-white border w-full justify-start h-auto p-1 flex-wrap gap-1">
            <HelpTip text="Active = currently working, Pending = awaiting approval, Reconciled = shift approved and closed." className="ml-1" />
            <TabsTrigger value="All" className="text-xs sm:text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                All Active
            </TabsTrigger>
            <TabsTrigger value="PENDING_APPROVAL" className="text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <span className="hidden sm:inline">Pending </span>Approval
                {pendingCount > 0 && <Badge variant="secondary" className="ml-1 sm:ml-2 h-4 px-1 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="NOT_SUBMITTED" className="text-xs sm:text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">Not <span className="hidden sm:inline">Submitted</span><span className="sm:hidden">Sub</span></TabsTrigger>
            <TabsTrigger value="RETURNED" className="text-xs sm:text-sm data-[state=active]:bg-red-50 data-[state=active]:text-red-700">Returned</TabsTrigger>
            <TabsTrigger value="COMPLETED" className="text-xs sm:text-sm data-[state=active]:bg-green-50 data-[state=active]:text-green-700">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoadingShifts ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading cashier shifts...
        </div>
      ) : reconMode === 'PER_CASHIER' ? (
          <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
              <div className="p-3 sm:p-4 border-b bg-slate-50 flex items-center justify-between">
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
                                          {shift.groupCashiers && <Badge variant="outline" className="text-[8px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">Grouped</Badge>}
                                      </p>
                                  )}
                              </div>
                              <StatusBadge status={shift.status} />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{new Date(shift.startTime).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
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
                                  {shift.groupCashiers && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">Grouped</Badge>}
                              </TableCell>
                              <TableCell>{new Date(shift.startTime).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
                              <TableCell className="text-right">{shift.transactionCount}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(shift.systemTotals.total)}</TableCell>
                              <TableCell className={`text-right font-mono font-bold ${(shift.variance?.total || 0) !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {(shift.variance?.total || 0) === 0 ? '-' : formatCurrency(shift.variance?.total || 0)}
                              </TableCell>
                              <TableCell className="text-center">
                                  <StatusBadge status={shift.status} />
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
              {officeGroups && Object.entries(officeGroups).map(([office, data]) => {
                  const variance = data.totalSystem - data.totalDeclared;
                  const allPending = data.shifts.every(s => s.status === 'PENDING_APPROVAL');
                  const allCompleted = data.shifts.every(s => s.status === 'COMPLETED');
                  const someNotSubmitted = data.shifts.some(s => s.status === 'NOT_SUBMITTED' || s.status === 'RETURNED');
                  
                  return (
                  <div key={office} className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                      <div className="p-3 sm:p-4 border-b bg-slate-50">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-base sm:text-lg">{office}</h3>
                                  {data.groupCashiers ? (
                                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                          <Users className="w-3 h-3 mr-1" /> Grouped
                                      </Badge>
                                  ) : (
                                      <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                                          Individual
                                      </Badge>
                                  )}
                                  {allCompleted && <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">All Reconciled</Badge>}
                              </div>
                              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                                  <div className="flex gap-1.5">
                                      <span className="text-muted-foreground">System:</span>
                                      <span className="font-mono font-medium">{formatCurrency(data.totalSystem)}</span>
                                  </div>
                                  <div className="flex gap-1.5">
                                      <span className="text-muted-foreground">Declared:</span>
                                      <span className="font-mono font-medium">{formatCurrency(data.totalDeclared)}</span>
                                  </div>
                                  {variance !== 0 && (
                                      <div className="flex gap-1.5">
                                          <span className="text-muted-foreground">Variance:</span>
                                          <span className={`font-mono font-bold ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(variance)}</span>
                                      </div>
                                  )}
                                  <div className="flex gap-1.5">
                                      <span className="text-muted-foreground">Cashiers:</span>
                                      <span className="font-medium">{data.shifts.length}</span>
                                  </div>
                              </div>
                          </div>
                          {data.groupCashiers && someNotSubmitted && (
                              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  Not all cashiers in this office have submitted their day-end. Grouped reconciliation requires all cashiers to submit before the office can be approved.
                              </div>
                          )}
                      </div>
                      <div className="sm:hidden space-y-2 p-3">
                          {data.shifts.map(shift => (
                              <div key={`mobile-office-${shift.id}`} className="bg-white border rounded-xl p-3 space-y-2" data-testid={`mobile-office-shift-${shift.id}`}>
                                  <div className="flex items-start justify-between">
                                      <span className="font-bold text-slate-900">{shift.cashierName}</span>
                                      <StatusBadge status={shift.status} />
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                      <div>
                                          <span className="text-muted-foreground text-xs">System Total</span>
                                          <p className="font-mono font-medium">{formatCurrency(shift.systemTotals.total)}</p>
                                      </div>
                                      <div className="text-right">
                                          <span className="text-muted-foreground text-xs">Declared Total</span>
                                          <p className="font-mono font-medium">{formatCurrency(shift.declaredTotals?.total || 0)}</p>
                                      </div>
                                  </div>
                                  <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full h-10 active:scale-[0.99]"
                                      onClick={() => handleReview(shift)}
                                      data-testid={`mobile-office-review-${shift.id}`}
                                  >
                                      Review Cashier
                                  </Button>
                              </div>
                          ))}
                          {data.groupCashiers && allPending && !someNotSubmitted && (
                              <Button
                                  className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl"
                                  onClick={async () => {
                                      for (const shift of data.shifts) {
                                          await handleApprove(shift.id);
                                      }
                                  }}
                                  disabled={actionLoading}
                                  data-testid={`button-approve-office-${office}`}
                              >
                                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                  Approve Entire Office ({data.shifts.length} cashiers)
                              </Button>
                          )}
                      </div>
                      <div className="hidden sm:block">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Cashier</TableHead>
                                  <TableHead className="text-right">System Total</TableHead>
                                  <TableHead className="text-right">Declared Total</TableHead>
                                  <TableHead className="text-right">Variance</TableHead>
                                  <TableHead className="text-center">Status</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {data.shifts.map(shift => {
                                  const shiftVariance = shift.systemTotals.total - (shift.declaredTotals?.total || 0);
                                  return (
                                  <TableRow key={shift.id}>
                                      <TableCell className="font-medium">{shift.cashierName}</TableCell>
                                      <TableCell className="text-right font-mono">{formatCurrency(shift.systemTotals.total)}</TableCell>
                                      <TableCell className="text-right font-mono">{formatCurrency(shift.declaredTotals?.total || 0)}</TableCell>
                                      <TableCell className={`text-right font-mono font-bold ${shiftVariance !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {shiftVariance === 0 ? '-' : formatCurrency(shiftVariance)}
                                      </TableCell>
                                      <TableCell className="text-center"><StatusBadge status={shift.status} /></TableCell>
                                      <TableCell className="text-right">
                                          <Button size="sm" variant="outline" onClick={() => handleReview(shift)}>
                                              Review
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                                  );
                              })}
                          </TableBody>
                      </Table>
                      </div>
                      {data.groupCashiers && allPending && !someNotSubmitted && (
                          <div className="hidden sm:flex p-3 sm:p-4 border-t bg-green-50 items-center justify-between">
                              <div className="text-sm text-green-800">
                                  All {data.shifts.length} cashiers have submitted. This is a grouped office — approve all cashiers together.
                              </div>
                              <Button
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold px-6"
                                  onClick={async () => {
                                      setActionLoading(true);
                                      try {
                                          for (const shift of data.shifts) {
                                              await apiRequest('POST', `/api/platinum/auth-day-end/finish-day-end-reconcile?userId=${shift.id}`, {});
                                          }
                                          toast({ title: 'Success', description: `All ${data.shifts.length} cashiers in ${office} approved.` });
                                          loadCashierList();
                                      } catch (e: any) {
                                          toast({ title: 'Error', description: `Approval failed: ${e.message}`, variant: 'destructive' });
                                      } finally {
                                          setActionLoading(false);
                                      }
                                  }}
                                  disabled={actionLoading}
                                  data-testid={`button-approve-office-desktop-${office}`}
                              >
                                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                  Approve Entire Office
                              </Button>
                          </div>
                      )}
                  </div>
                  );
              })}
          </div>
      )}

      <Dialog open={showVarianceHistory} onOpenChange={setShowVarianceHistory}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Cashier Variance Statistics
                </DialogTitle>
                <DialogDescription>
                    Analyze historical shortages and surpluses per cashier
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-6 py-4 flex-1 overflow-hidden">
                <div className="flex flex-wrap items-end gap-4 bg-slate-50 p-4 rounded-lg border">
                    <div className="flex flex-col gap-1.5">
                        <Label>Financial Year</Label>
                        <Select value={statsFinancialYear} onValueChange={(val) => updateStatsPeriod(val, statsMonth)}>
                            <SelectTrigger className="w-[140px] bg-white">
                                <SelectValue placeholder="All Years" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Years</SelectItem>
                                {FINANCIAL_YEARS.map(fy => (
                                    <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label>Month</Label>
                        <Select 
                            value={statsMonth} 
                            onValueChange={(val) => updateStatsPeriod(statsFinancialYear, val)}
                            disabled={statsFinancialYear === 'All'}
                        >
                            <SelectTrigger className="w-[140px] bg-white">
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
                        <Label>Cashier</Label>
                        <Select value={statsCashier} onValueChange={setStatsCashier}>
                            <SelectTrigger className="w-[180px] bg-white">
                                <SelectValue placeholder="All Cashiers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Cashiers</SelectItem>
                                {shifts.map(s => (
                                    <SelectItem key={s.id} value={s.cashierName}>{s.cashierName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-red-50 border-red-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-red-800">Total Shortage</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {formatCurrency(varianceStats?.totalShortage || 0)}
                            </div>
                            <p className="text-xs text-red-700 mt-1">
                                {varianceStats?.shortageCount} occurrences
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-green-800">Total Surplus</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {formatCurrency(varianceStats?.totalSurplus || 0)}
                            </div>
                            <p className="text-xs text-green-700 mt-1">
                                {varianceStats?.surplusCount} occurrences
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-blue-800">Net Variance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${
                                (varianceStats?.netVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                                {formatCurrency(varianceStats?.netVariance || 0)}
                            </div>
                            <p className="text-xs text-blue-700 mt-1">
                                Over {varianceStats?.shiftCount} shifts
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-slate-50 border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-800">Performance Rating</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-700">
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
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0">
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
                                        <TableCell>{new Date(shift.startTime).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
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
        </DialogContent>
      </Dialog>

      {selectedShift && (
          <Dialog open={!!selectedShift} onOpenChange={() => { setSelectedShift(null); setReviewData(null); }}>
              <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto">
                  <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                          Reconciliation Review: <span className="text-blue-600">{selectedShift.cashierName}</span>
                      </DialogTitle>
                      <DialogDescription className="text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                          <span>Cashier ID: {selectedShift.id} | Office: {selectedShift.cashOffice || 'N/A'}</span>
                          {selectedShift.groupCashiers && (
                              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
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
                              
                              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                      <Banknote className="w-4 h-4 text-gray-500" />
                                      <span>Cash</span>
                                  </div>
                                  <span className="font-mono font-medium">{formatCurrency(Number(reviewData.details?.totalCashAmt || reviewData.details?.cashAmount || selectedShift.systemTotals.cash || 0))}</span>
                              </div>

                              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                      <CreditCard className="w-4 h-4 text-gray-500" />
                                      <span>Card</span>
                                  </div>
                                  <span className="font-mono font-medium">{formatCurrency(Number(reviewData.details?.totalCreditAmt || reviewData.details?.cardAmount || selectedShift.systemTotals.card || 0))}</span>
                              </div>

                              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-gray-500" />
                                      <span>Cheque</span>
                                  </div>
                                  <span className="font-mono font-medium">{formatCurrency(Number(reviewData.details?.totalChequeAmt || reviewData.details?.chequeAmount || 0))}</span>
                              </div>

                              <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border border-gray-200">
                                  <span className="font-bold text-gray-700">Total</span>
                                  <span className="font-mono font-bold text-lg">{formatCurrency(Number(reviewData.details?.totalAmt || reviewData.details?.totalAmount || selectedShift.systemTotals.total || 0))}</span>
                              </div>
                          </div>

                          <div className="space-y-4">
                              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">Reconcile Data</h3>
                              {reviewData.reconcile ? (
                                <>
                                  <div className="grid grid-cols-2 gap-2">
                                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                          <div className="text-xs text-blue-700 mb-1">Cash Declared</div>
                                          <div className="font-mono font-bold">{formatCurrency(Number(reviewData.reconcile.totalCashAmt || reviewData.reconcile.cashDeclared || 0))}</div>
                                      </div>
                                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                          <div className="text-xs text-blue-700 mb-1">Card Declared</div>
                                          <div className="font-mono font-bold">{formatCurrency(Number(reviewData.reconcile.totalCreditAmt || reviewData.reconcile.cardDeclared || 0))}</div>
                                      </div>
                                  </div>
                                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                      <div className="text-xs text-blue-700 mb-1">Float</div>
                                      <div className="font-mono font-bold">{formatCurrency(Number(reviewData.reconcile.cashFloat || reviewData.reconcile.float || 0))}</div>
                                  </div>
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
                          <div className="bg-gray-50 px-4 py-2 border-b text-xs font-semibold text-muted-foreground">
                            SYSTEM VS CASHIER COMPARISON
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            <Table>
                              <TableHeader className="bg-slate-50 sticky top-0">
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
                            <TabsList className="bg-white border">
                              <TabsTrigger value="cash" className="text-xs">Cash ({reviewData.cashReceipts.length})</TabsTrigger>
                              <TabsTrigger value="card" className="text-xs">Card ({reviewData.cardReceipts.length})</TabsTrigger>
                              <TabsTrigger value="cheque" className="text-xs">Cheque ({reviewData.chequeReceipts.length})</TabsTrigger>
                              <TabsTrigger value="postal" className="text-xs">Postal ({reviewData.postalReceipts.length})</TabsTrigger>
                              <TabsTrigger value="dropbox" className="text-xs">Dropbox ({reviewData.dropboxReceipts.length})</TabsTrigger>
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
                        </Tabs>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Return Reason (required to return)</Label>
                        <Input 
                          value={returnReason} 
                          onChange={(e) => setReturnReason(e.target.value)} 
                          placeholder="Enter reason for returning to cashier..."
                          data-testid="input-return-reason"
                        />
                      </div>
                    </div>
                  ) : null}

                  {selectedShift.groupCashiers && (
                      <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          This cashier belongs to a grouped office ({selectedShift.cashOffice}). All cashiers in this office must be reconciled together. Use the "Per Cash Office" view to approve the entire office at once.
                      </div>
                  )}
                  <DialogFooter className="gap-2 sm:gap-0">
                      <div className="flex items-center gap-1 mr-auto">
                        <Button 
                            variant="destructive" 
                            className="w-32"
                            onClick={handleReturn}
                            disabled={!returnReason.trim() || actionLoading}
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Return to Cashier'}
                        </Button>
                        <HelpTip text="Send this submission back to the cashier for correction." />
                      </div>
                      <Button variant="outline" onClick={() => { setSelectedShift(null); setReviewData(null); }}>Cancel</Button>
                      <div className="flex items-center gap-1">
                        <Button 
                            className="bg-green-600 hover:bg-green-700 w-32"
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
    </PosLayout>
  );
}

function StatusBadge({ status }: { status: DayEndStatus }) {
    switch (status) {
        case 'NOT_SUBMITTED':
            return <Badge variant="outline" className="text-gray-500 border-gray-300">Open</Badge>;
        case 'PENDING_APPROVAL':
            return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">Pending Approval</Badge>;
        case 'RETURNED':
            return <Badge variant="destructive">Returned</Badge>;
        case 'COMPLETED':
            return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 shadow-none">Posted</Badge>;
        default:
            return null;
    }
}
