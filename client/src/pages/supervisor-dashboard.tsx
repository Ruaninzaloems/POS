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

type DayEndStatus = 'NOT_SUBMITTED' | 'PENDING_APPROVAL' | 'RETURNED' | 'COMPLETED';
type ReconMode = 'PER_CASHIER' | 'CASH_OFFICE';

interface CashierShift {
  id: string;
  cashierName: string;
  cashOffice: string;
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

function mapCashierToShift(c: any, index: number): CashierShift {
  const id = String(c.id || c.cashierId || c.cashier_ID || c.cashier_id || index);
  const name = c.cashierName || c.name || c.userName || c.cashier_name || `Cashier ${id}`;
  const office = c.cashOfficeName || c.cashOffice || c.cash_office || c.officeName || c.office || '';
  const totalAmt = Number(c.totalAmount || c.totalAmt || c.total || c.systemTotal || 0);
  const cashAmt = Number(c.cashAmount || c.cashTotal || c.totalCashAmt || 0);
  const cardAmt = Number(c.cardAmount || c.cardTotal || c.totalCreditAmt || 0);
  const declaredTotal = Number(c.declaredTotal || c.declaredAmount || c.cashierTotal || c.totalDeclared || 0);
  const declaredCash = Number(c.declaredCash || c.cashierCash || 0);
  const declaredCard = Number(c.declaredCard || c.cashierCard || 0);
  const varianceTotal = Number(c.variance || c.varianceAmount || c.totalVariance || 0);
  const txCount = Number(c.transactionCount || c.receiptCount || c.txCount || c.count || 0);

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
    cashOffice: office,
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

export default function SupervisorDashboard() {
  const { returnDayEnd, approveCancellation, recentTransactions, referenceData } = usePos();
  const { toast } = useToast();
  const [reconMode, setReconMode] = useState<ReconMode>('PER_CASHIER');
  
  const pendingCancellations = recentTransactions.filter(tx => tx.status === 'PENDING_CANCELLATION');
  const processedCancellations = recentTransactions.filter(tx => 
      tx.status === 'CANCELLED' || 
      (tx.status === 'COMPLETED' && tx.cancellationReason && tx.cancellationRequestTime)
  );

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

  const loadCashierList = useCallback(async () => {
    setIsLoadingShifts(true);
    try {
      const res = await fetch('/api/platinum/auth-day-end/cashier-list');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      console.log('[Supervisor] Cashier list raw response:', data);
      const items = extractItems(data);
      console.log('[Supervisor] Cashier list items:', items.length, JSON.stringify(items).substring(0, 1000));
      const mapped = items.map((c: any, i: number) => mapCashierToShift(c, i));
      setShifts(mapped);
    } catch (e: any) {
      console.error('[Supervisor] Failed to load cashier list:', e);
      toast({ title: 'Error', description: `Failed to load cashier list: ${e.message}`, variant: 'destructive' });
    } finally {
      setIsLoadingShifts(false);
    }
  }, [toast]);

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
        fetch(`/api/platinum/auth-day-end/cashier-details?cashierId=${cashierId}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/platinum/auth-day-end/cashier-reconcile-by-cashierid?cashierId=${cashierId}`).then(r => r.ok ? r.json() : null).catch(() => null),
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
      totalSystem: number, 
      totalDeclared: number, 
      shifts: CashierShift[],
      status: 'MIXED' | 'READY' | 'COMPLETED'
    }> = {};

    filteredShifts.forEach(shift => {
      if (!groups[shift.cashOffice || 'Unknown']) {
        groups[shift.cashOffice || 'Unknown'] = { 
          totalSystem: 0, 
          totalDeclared: 0, 
          shifts: [],
          status: 'READY'
        };
      }
      const key = shift.cashOffice || 'Unknown';
      groups[key].shifts.push(shift);
      groups[key].totalSystem += shift.systemTotals.total;
      groups[key].totalDeclared += shift.declaredTotals?.total || 0;
      
      if (shift.status === 'NOT_SUBMITTED' || shift.status === 'RETURNED') {
          groups[key].status = 'MIXED';
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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Supervisor Dashboard</h1>
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
                      Cash Office
                  </Button>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{pendingCount + pendingCancellations.length}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <RefreshCcw className="w-3 h-3" /> {pendingCount} shifts, {pendingCancellations.length} voids
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Variances Detected</CardTitle>
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
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Posted (Today)</CardTitle>
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
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total System Revenue</CardTitle>
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
                </h3>
                <TabsList className="bg-white/50 border border-orange-100">
                    <TabsTrigger value="pending" className="text-xs sm:text-sm data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
                        Pending ({pendingCancellations.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs sm:text-sm data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
                        History
                    </TabsTrigger>
                </TabsList>
            </div>
            
            <TabsContent value="pending" className="mt-0">
                {pendingCancellations.length === 0 ? (
                    <div className="text-center py-8 bg-white/50 rounded border border-dashed border-orange-200 text-orange-800/60 text-sm">
                        No pending cancellation requests
                    </div>
                ) : (
                    <div className="bg-white rounded border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Receipt Details</TableHead>
                                    <TableHead className="whitespace-nowrap">Cashier</TableHead>
                                    <TableHead className="whitespace-nowrap">Time</TableHead>
                                    <TableHead className="whitespace-nowrap">Amount</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
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
                                                    
                                                    <HoverCard>
                                                        <HoverCardTrigger asChild>
                                                            <Button variant="link" className="h-auto p-0 text-xs text-blue-600 flex items-center gap-1">
                                                                <Info className="w-3 h-3" /> View Items
                                                            </Button>
                                                        </HoverCardTrigger>
                                                        <HoverCardContent className="w-80">
                                                            <div className="space-y-2">
                                                                <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">Transaction Items</h4>
                                                                {tx.items.map((item, idx) => (
                                                                    <div key={idx} className="text-xs grid grid-cols-[1fr_auto] gap-2">
                                                                        <span className="text-slate-600 truncate" title={item.description}>
                                                                            {item.description}
                                                                        </span>
                                                                        <span className="font-mono font-medium">
                                                                            R {item.amountToPay.toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                                <div className="border-t pt-2 mt-2 flex justify-between font-bold text-xs">
                                                                    <span>Total</span>
                                                                    <span>R {tx.totalAmount.toFixed(2)}</span>
                                                                </div>
                                                                {tx.cancellationReason && (
                                                                    <div className="mt-3 bg-red-50 p-2 rounded border border-red-100 text-xs">
                                                                        <span className="font-bold text-red-700 block mb-0.5">Cancellation Reason:</span>
                                                                        <span className="text-red-600">{tx.cancellationReason}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </HoverCardContent>
                                                    </HoverCard>
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
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900">R {tx.totalAmount.toFixed(2)}</span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {tx.payment.cash > 0 && (
                                                        <Badge variant="outline" className="h-5 px-1.5 bg-green-50 text-green-700 border-green-200 text-[10px] gap-1">
                                                            <Banknote className="w-3 h-3" /> Cash
                                                        </Badge>
                                                    )}
                                                    {tx.payment.card > 0 && (
                                                        <Badge variant="outline" className="h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200 text-[10px] gap-1">
                                                            <CreditCard className="w-3 h-3" /> Card
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
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
                )}
            </TabsContent>
            
            <TabsContent value="history" className="mt-0">
                {processedCancellations.length === 0 ? (
                    <div className="text-center py-8 bg-white/50 rounded border border-dashed border-slate-200 text-slate-500 text-sm">
                        No cancellation history found
                    </div>
                ) : (
                    <div className="bg-white rounded border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Receipt Details</TableHead>
                                    <TableHead className="whitespace-nowrap">Cashier</TableHead>
                                    <TableHead className="whitespace-nowrap">Processed Time</TableHead>
                                    <TableHead className="whitespace-nowrap">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
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
                                            <div className="flex flex-col">
                                                <span className="text-slate-900">{new Date(tx.timestamp).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                                <span className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', day: '2-digit' })}</span>
                                            </div>
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
                )}
            </TabsContent>
          </Tabs>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
          <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                  placeholder="Search cashier..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-cashier"
              />
          </div>
          <Select value={filterOffice} onValueChange={setFilterOffice}>
              <SelectTrigger className="w-full md:w-[200px]" data-testid="select-filter-office">
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
                          <h4 className="font-medium text-sm border-b pb-2">Filter Shifts</h4>
                          
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
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="whitespace-nowrap">Cashier</TableHead>
                          <TableHead className="whitespace-nowrap">Office</TableHead>
                          <TableHead className="whitespace-nowrap">Date</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Tx Count</TableHead>
                          <TableHead className="text-right whitespace-nowrap">System Total</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Variance</TableHead>
                          <TableHead className="text-center whitespace-nowrap">Status</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredShifts.map(shift => (
                          <TableRow key={shift.id} data-testid={`row-cashier-${shift.id}`}>
                              <TableCell className="font-medium">{shift.cashierName}</TableCell>
                              <TableCell className="text-muted-foreground">{shift.cashOffice || '-'}</TableCell>
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
              )}
          </div>
      ) : (
          <div className="grid gap-6">
              {officeGroups && Object.entries(officeGroups).map(([office, data]) => (
                  <div key={office} className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                      <div className="p-3 sm:p-4 border-b bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <h3 className="font-semibold text-base sm:text-lg">{office}</h3>
                          <div className="flex gap-3 sm:gap-4 text-xs sm:text-sm">
                              <div className="flex gap-2">
                                  <span className="text-muted-foreground">Total System:</span>
                                  <span className="font-mono font-medium">{formatCurrency(data.totalSystem)}</span>
                              </div>
                              <div className="flex gap-2">
                                  <span className="text-muted-foreground">Total Declared:</span>
                                  <span className="font-mono font-medium">{formatCurrency(data.totalDeclared)}</span>
                              </div>
                          </div>
                      </div>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Cashier</TableHead>
                                  <TableHead className="text-right">System Total</TableHead>
                                  <TableHead className="text-right">Declared Total</TableHead>
                                  <TableHead className="text-center">Status</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {data.shifts.map(shift => (
                                  <TableRow key={shift.id}>
                                      <TableCell>{shift.cashierName}</TableCell>
                                      <TableCell className="text-right font-mono">{formatCurrency(shift.systemTotals.total)}</TableCell>
                                      <TableCell className="text-right font-mono">{formatCurrency(shift.declaredTotals?.total || 0)}</TableCell>
                                      <TableCell className="text-center"><StatusBadge status={shift.status} /></TableCell>
                                      <TableCell className="text-right">
                                          <Button size="sm" variant="outline" onClick={() => handleReview(shift)}>
                                              Review
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
              ))}
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
                      <DialogDescription className="text-xs sm:text-sm">
                          Cashier ID: {selectedShift.id} | Office: {selectedShift.cashOffice || 'N/A'}
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

                  <DialogFooter className="gap-2 sm:gap-0">
                      <Button 
                          variant="destructive" 
                          className="mr-auto w-32"
                          onClick={handleReturn}
                          disabled={!returnReason.trim() || actionLoading}
                      >
                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Return to Cashier'}
                      </Button>
                      <Button variant="outline" onClick={() => { setSelectedShift(null); setReviewData(null); }}>Cancel</Button>
                      <Button 
                          className="bg-green-600 hover:bg-green-700 w-32"
                          onClick={() => handleApprove(selectedShift.id)}
                          disabled={actionLoading}
                      >
                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve & Post'}
                      </Button>
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
