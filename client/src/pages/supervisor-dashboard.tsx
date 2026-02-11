import React, { useState, useMemo } from 'react';
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
import { CASHIERS, ACCOUNTS } from '@/lib/mock-data';
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
  BarChart3
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

// Types
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
}

// Generate Historical Shifts with Variances
const generateHistoricalShifts = () => {
    const shifts: CashierShift[] = [];
    const today = new Date();
    
    // Generate for past 12 months
    for (let i = 0; i < 365; i++) {
        const date = subDays(today, i);
        // Skip weekends roughly
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        CASHIERS.forEach(cashier => {
             // 80% chance cashier worked
             if (Math.random() > 0.2) {
                 const hasVariance = Math.random() > 0.7; // 30% chance of variance
                 const varianceAmount = hasVariance ? (Math.random() * 200 - 100) : 0; // -100 to +100
                 
                 const systemTotal = 5000 + Math.random() * 10000;
                 const declaredTotal = systemTotal + varianceAmount;
                 
                 shifts.push({
                     id: `HIST-SH-${format(date, 'yyyyMMdd')}-${cashier.id}`,
                     cashierName: cashier.name,
                     cashOffice: cashier.cashOffice,
                     startTime: date.toISOString(),
                     endTime: new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString(),
                     status: 'COMPLETED',
                     systemTotals: { cash: systemTotal * 0.4, card: systemTotal * 0.6, total: systemTotal },
                     declaredTotals: { cash: (systemTotal * 0.4) + varianceAmount, card: systemTotal * 0.6, total: declaredTotal },
                     variance: { cash: varianceAmount, card: 0, total: varianceAmount },
                     transactionCount: Math.floor(20 + Math.random() * 50)
                 });
             }
        });
    }
    return shifts;
};

const HISTORICAL_SHIFTS = generateHistoricalShifts();

// ... existing MOCK_SHIFTS ...
const MOCK_SHIFTS: CashierShift[] = [
  {
    id: "SH-001",
    cashierName: "Sarah Jenkins",
    cashOffice: "Main Civic Center",
    startTime: "2023-10-27T08:00:00",
    endTime: "2023-10-27T16:30:00",
    status: "PENDING_APPROVAL",
    systemTotals: { cash: 5400.00, card: 12500.00, total: 17900.00 },
    declaredTotals: { cash: 5400.00, card: 12500.00, total: 17900.00 },
    variance: { cash: 0, card: 0, total: 0 },
    transactionCount: 42
  },
  {
    id: "SH-002",
    cashierName: "John Doe",
    cashOffice: "Main Civic Center",
    startTime: "2023-10-27T08:15:00",
    endTime: "2023-10-27T16:15:00",
    status: "PENDING_APPROVAL",
    systemTotals: { cash: 3200.50, card: 8900.00, total: 12100.50 },
    declaredTotals: { cash: 3200.00, card: 8900.00, total: 12100.00 },
    variance: { cash: -0.50, card: 0, total: -0.50 },
    transactionCount: 28
  },
  {
    id: "SH-003",
    cashierName: "Emily Davis",
    cashOffice: "Traffic Dept",
    startTime: "2023-10-27T07:45:00",
    status: "NOT_SUBMITTED",
    systemTotals: { cash: 8500.00, card: 4200.00, total: 12700.00 },
    transactionCount: 56
  },
  {
    id: "SH-004",
    cashierName: "Michael Brown",
    cashOffice: "Traffic Dept",
    startTime: "2023-10-27T08:00:00",
    endTime: "2023-10-27T15:00:00",
    status: "RETURNED",
    systemTotals: { cash: 4100.00, card: 2200.00, total: 6300.00 },
    declaredTotals: { cash: 4000.00, card: 2200.00, total: 6200.00 },
    variance: { cash: -100.00, card: 0, total: -100.00 },
    transactionCount: 15
  },
  {
    id: "SH-005",
    cashierName: "Jessica Wilson",
    cashOffice: "Main Civic Center",
    startTime: "2023-10-26T08:00:00",
    endTime: "2023-10-26T16:00:00",
    status: "COMPLETED",
    systemTotals: { cash: 6000.00, card: 10000.00, total: 16000.00 },
    declaredTotals: { cash: 6000.00, card: 10000.00, total: 16000.00 },
    variance: { cash: 0, card: 0, total: 0 },
    transactionCount: 38
  }
];

// Helper for currency formatting
const formatCurrency = (amount: number) => {
  return `R ${amount.toFixed(2)}`;
};

// Add function to generate report data
function generateReportData(shift: CashierShift) {
  // Generate mock detailed transactions for the report since we don't have them in the shift object
  const types = ['Consumer Services', 'Prepaid Electricity', 'Prepaid Water', 'Direct Income', 'Clearance'];
  const transactions = [];
  
  // Create ~20 random transactions
  for(let i=0; i<20; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const amount = Math.floor(Math.random() * 500) + 50;
    transactions.push({
      receiptNo: `REC-${10000 + i}`,
      time: format(new Date(), 'HH:mm:ss'),
      type,
      description: `${type} Payment`,
      amount: amount
    });
  }
  
  return transactions;
}

// Add function to download CSV
function downloadReport(shift: CashierShift) {
  const transactions = generateReportData(shift);
  
  // Group by Type
  const groups: Record<string, typeof transactions> = {};
  transactions.forEach(tx => {
    if(!groups[tx.type]) groups[tx.type] = [];
    groups[tx.type].push(tx);
  });
  
  // Build CSV Content
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Transaction Report\n";
  csvContent += `Cashier,${shift.cashierName}\n`;
  csvContent += `Office,${shift.cashOffice}\n`;
  csvContent += `Date,${format(new Date(shift.startTime), 'yyyy-MM-dd')}\n\n`;
  
  Object.entries(groups).forEach(([type, txs]) => {
    csvContent += `TYPE: ${type}\n`;
    csvContent += "Receipt No,Time,Description,Amount\n";
    
    let groupTotal = 0;
    txs.forEach(tx => {
      csvContent += `${tx.receiptNo},${tx.time},${tx.description},${tx.amount.toFixed(2)}\n`;
      groupTotal += tx.amount;
    });
    
    csvContent += `,,TOTAL ${type.toUpperCase()},${groupTotal.toFixed(2)}\n\n`;
  });
  
  // Trigger Download
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `day_end_report_${shift.cashierName.replace(' ', '_')}_${format(new Date(), 'yyyyMMdd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function SupervisorDashboard() {
  const { returnDayEnd, approveCancellation, recentTransactions } = usePos();
  const [reconMode, setReconMode] = useState<ReconMode>('PER_CASHIER');
  
  // Pending Cancellations
  const pendingCancellations = recentTransactions.filter(tx => tx.status === 'PENDING_CANCELLATION');
  const processedCancellations = recentTransactions.filter(tx => 
      tx.status === 'CANCELLED' || 
      (tx.status === 'COMPLETED' && tx.cancellationReason && tx.cancellationRequestTime)
  );

  const [selectedShift, setSelectedShift] = useState<CashierShift | null>(null);
  const [shifts, setShifts] = useState<CashierShift[]>(MOCK_SHIFTS);
  const [filterOffice, setFilterOffice] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [returnReason, setReturnReason] = useState('');
  
  // Variance History State
  const [showVarianceHistory, setShowVarianceHistory] = useState(false);
  const [statsDateRange, setStatsDateRange] = useState<{from: Date, to: Date} | undefined>({
      from: subDays(new Date(), 30),
      to: new Date()
  });
  const [statsCashier, setStatsCashier] = useState<string>('All');

  const [filterVariance, setFilterVariance] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('All');

  const filteredShifts = shifts.filter(shift => {
    const matchesOffice = filterOffice === 'All' || shift.cashOffice === filterOffice;
    const matchesSearch = shift.cashierName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVariance = !filterVariance || (shift.variance?.total || 0) !== 0;
    
    // Status Logic
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

  const handleApprove = (id: string) => {
    setShifts(prev => prev.map(s => s.id === id ? { ...s, status: 'COMPLETED' } : s));
    setSelectedShift(null);
  };

  const handleReturn = () => { // Changed signature
    if (selectedShift && returnReason) {
        setShifts(prev => prev.map(s => s.id === selectedShift.id ? { ...s, status: 'RETURNED' } : s));
        returnDayEnd(returnReason); 
        setSelectedShift(null);
        setReturnReason('');
    }
  };

  // Grouping for Cash Office Mode
  const officeGroups = React.useMemo(() => {
    if (reconMode !== 'CASH_OFFICE') return null;
    
    const groups: Record<string, { 
      totalSystem: number, 
      totalDeclared: number, 
      shifts: CashierShift[],
      status: 'MIXED' | 'READY' | 'COMPLETED'
    }> = {};

    filteredShifts.forEach(shift => {
      if (!groups[shift.cashOffice]) {
        groups[shift.cashOffice] = { 
          totalSystem: 0, 
          totalDeclared: 0, 
          shifts: [],
          status: 'READY'
        };
      }
      groups[shift.cashOffice].shifts.push(shift);
      groups[shift.cashOffice].totalSystem += shift.systemTotals.total;
      groups[shift.cashOffice].totalDeclared += shift.declaredTotals?.total || 0;
      
      if (shift.status === 'NOT_SUBMITTED' || shift.status === 'RETURNED') {
          groups[shift.cashOffice].status = 'MIXED';
      }
    });

    return groups;
  }, [filteredShifts, reconMode]);

  // Variance History Calculation
  const varianceStats = useMemo(() => {
      if (!statsDateRange?.from || !statsDateRange?.to) return null;

      const filteredHistory = HISTORICAL_SHIFTS.filter(shift => {
          const shiftDate = new Date(shift.startTime);
          const inDateRange = isWithinInterval(shiftDate, { start: statsDateRange.from, end: statsDateRange.to });
          const matchesCashier = statsCashier === 'All' || shift.cashierName === statsCashier;
          return inDateRange && matchesCashier;
      });

      const totalShortage = filteredHistory.reduce((acc, shift) => acc + (shift.variance?.total && shift.variance.total < 0 ? Math.abs(shift.variance.total) : 0), 0);
      const totalSurplus = filteredHistory.reduce((acc, shift) => acc + (shift.variance?.total && shift.variance.total > 0 ? shift.variance.total : 0), 0);
      const netVariance = totalSurplus - totalShortage;
      const shortageCount = filteredHistory.filter(s => s.variance?.total && s.variance.total < 0).length;
      const surplusCount = filteredHistory.filter(s => s.variance?.total && s.variance.total > 0).length;
      
      // Sort by date desc
      const sortedHistory = [...filteredHistory].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      return {
          history: sortedHistory,
          totalShortage,
          totalSurplus,
          netVariance,
          shortageCount,
          surplusCount,
          shiftCount: filteredHistory.length
      };
  }, [statsDateRange, statsCashier]);

  return (
    <PosLayout>
    <div className="h-full overflow-y-auto bg-slate-50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Supervisor Dashboard</h1>
            <p className="text-muted-foreground">Reconciliation & Approvals</p>
          </div>
          <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                className="gap-2 bg-white"
                onClick={() => setShowVarianceHistory(true)}
              >
                  <BarChart3 className="w-4 h-4" />
                  Cashier Statistics
              </Button>
              <div className="bg-white rounded-lg border p-1 flex items-center shadow-sm">
                  <Button 
                      variant={reconMode === 'PER_CASHIER' ? 'secondary' : 'ghost'} 
                      size="sm"
                      onClick={() => setReconMode('PER_CASHIER')}
                  >
                      Per Cashier
                  </Button>
                  <Switch 
                    checked={reconMode === 'CASH_OFFICE'} 
                    onCheckedChange={(c) => setReconMode(c ? 'CASH_OFFICE' : 'PER_CASHIER')}
                    className="mx-2"
                  />
                  <Button 
                      variant={reconMode === 'CASH_OFFICE' ? 'secondary' : 'ghost'} 
                      size="sm"
                      onClick={() => setReconMode('CASH_OFFICE')}
                  >
                      Cash Office
                  </Button>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border shadow-sm">
                  <div className="text-xs font-medium text-muted-foreground">Administrator</div>
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">AD</div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{pendingCount + pendingCancellations.length}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <RefreshCcw className="w-3 h-3" /> {pendingCount} shifts, {pendingCancellations.length} voids
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variances Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{varianceCount}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Requires attention
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Posted (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">R 16,000.00</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Successfully reconciled
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total System Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">R 49,001.00</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> All active shifts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cancellation Approvals Section */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <Tabs defaultValue="pending" className="w-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Cancellation Requests
                </h3>
                <TabsList className="bg-white/50 border border-orange-100">
                    <TabsTrigger value="pending" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
                        Pending ({pendingCancellations.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
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
                    <div className="bg-white rounded border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Receipt Details</TableHead>
                                    <TableHead>Cashier</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingCancellations.map(tx => {
                                    const cashier = CASHIERS.find(c => c.id === tx.cashierId);
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
                                                <span className="text-slate-900">{format(new Date(tx.timestamp), 'HH:mm')}</span>
                                                <span className="text-xs text-muted-foreground">{format(new Date(tx.timestamp), 'MMM dd')}</span>
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
                    <div className="bg-white rounded border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Receipt Details</TableHead>
                                    <TableHead>Cashier</TableHead>
                                    <TableHead>Processed Time</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedCancellations.map(tx => {
                                    const cashier = CASHIERS.find(c => c.id === tx.cashierId);
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
                                                <span className="text-slate-900">{format(new Date(tx.timestamp), 'HH:mm')}</span>
                                                <span className="text-xs text-muted-foreground">{format(new Date(tx.timestamp), 'MMM dd')}</span>
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

      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
          <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                  placeholder="Search cashier..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
          <Select value={filterOffice} onValueChange={setFilterOffice}>
              <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by Office" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="All">All Offices</SelectItem>
                  <SelectItem value="Main Civic Center">Main Civic Center</SelectItem>
                  <SelectItem value="Traffic Dept">Traffic Dept</SelectItem>
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
      
      {/* Quick Status Filters */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-full">
        <TabsList className="bg-white border w-full justify-start h-auto p-1 flex-wrap gap-1">
            <TabsTrigger value="All" className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                All Active
            </TabsTrigger>
            <TabsTrigger value="PENDING_APPROVAL" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                Pending Approval
                {pendingCount > 0 && <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="NOT_SUBMITTED" className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">Not Submitted</TabsTrigger>
            <TabsTrigger value="RETURNED" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">Returned</TabsTrigger>
            <TabsTrigger value="COMPLETED" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {reconMode === 'PER_CASHIER' ? (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-slate-50">
                  <h3 className="font-semibold">Cashier Shifts</h3>
              </div>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Cashier</TableHead>
                          <TableHead>Office</TableHead>
                          <TableHead>Shift Start</TableHead>
                          <TableHead className="text-right">Tx Count</TableHead>
                          <TableHead className="text-right">Voids</TableHead>
                          <TableHead className="text-right">System Total</TableHead>
                          <TableHead className="text-right">Variance</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredShifts.map(shift => {
                          // Find cashier ID from name to look up transactions
                          const cashierProfile = CASHIERS.find(c => c.name === shift.cashierName);
                          // Calculate void count from global transactions
                          const voidCount = recentTransactions.filter(t => 
                              t.cashierId === cashierProfile?.id && 
                              (t.status === 'CANCELLED' || t.status === 'PENDING_CANCELLATION')
                          ).length;

                          return (
                          <TableRow key={shift.id}>
                              <TableCell className="font-medium">{shift.cashierName}</TableCell>
                              <TableCell className="text-muted-foreground">{shift.cashOffice}</TableCell>
                              <TableCell>{format(new Date(shift.startTime), 'MMM dd, HH:mm')}</TableCell>
                              <TableCell className="text-right">{shift.transactionCount}</TableCell>
                              <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                      <span className={`font-bold ${voidCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                          {voidCount}
                                      </span>
                                      {voidCount > 2 && (
                                          <HoverCard>
                                              <HoverCardTrigger>
                                                  <AlertCircle className="w-3 h-3 text-red-500 cursor-help" />
                                              </HoverCardTrigger>
                                              <HoverCardContent className="w-60 text-xs">
                                                  High cancellation rate detected for this cashier. Monitor performance.
                                              </HoverCardContent>
                                          </HoverCard>
                                      )}
                                  </div>
                              </TableCell>
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
                                      onClick={() => {
                                          setSelectedShift(shift);
                                          setReturnReason('');
                                      }}
                                  >
                                      Review
                                  </Button>
                              </TableCell>
                          </TableRow>
                      )})}
                  </TableBody>
              </Table>
          </div>
      ) : (
          <div className="grid gap-6">
              {officeGroups && Object.entries(officeGroups).map(([office, data]) => (
                  <div key={office} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                      <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{office}</h3>
                          <div className="flex gap-4 text-sm">
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
                                          <Button size="sm" variant="outline" onClick={() => downloadReport(shift)}>
                                              <Download className="w-3 h-3 mr-1" /> Report
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

      {/* Variance History Modal */}
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
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-4 bg-slate-50 p-4 rounded-lg border">
                    <div className="flex flex-col gap-1.5">
                        <Label>Date Range Preset</Label>
                        <Select onValueChange={(val) => {
                            const now = new Date();
                            if (val === 'financial_year') {
                                // Assume Fin Year starts July 1st
                                const currentYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
                                setStatsDateRange({
                                    from: new Date(currentYear, 6, 1), // July 1st
                                    to: new Date(currentYear + 1, 5, 30) // June 30th
                                });
                            } else if (val === 'billing_month') {
                                // Current billing month (e.g., 25th prev month to 24th this month)
                                const startDay = 25;
                                let fromDate = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
                                let toDate = new Date(now.getFullYear(), now.getMonth(), startDay - 1);
                                setStatsDateRange({ from: fromDate, to: toDate });
                            } else if (val === 'last_30') {
                                setStatsDateRange({ from: subDays(now, 30), to: now });
                            } else if (val === 'this_year') {
                                setStatsDateRange({ from: startOfYear(now), to: now });
                            }
                        }}>
                            <SelectTrigger className="w-[180px] bg-white">
                                <SelectValue placeholder="Select Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="last_30">Last 30 Days</SelectItem>
                                <SelectItem value="billing_month">Current Billing Month</SelectItem>
                                <SelectItem value="financial_year">Financial Year (Jul-Jun)</SelectItem>
                                <SelectItem value="this_year">This Calendar Year</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label>Cashier</Label>
                        <Select value={statsCashier} onValueChange={setStatsCashier}>
                            <SelectTrigger className="w-[200px] bg-white">
                                <SelectValue placeholder="All Cashiers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Cashiers</SelectItem>
                                {CASHIERS.map(c => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label>Custom Range</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[240px] justify-start text-left font-normal bg-white",
                                        !statsDateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {statsDateRange?.from ? (
                                        statsDateRange.to ? (
                                            <>
                                                {format(statsDateRange.from, "LLL dd, y")} -{" "}
                                                {format(statsDateRange.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(statsDateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={statsDateRange?.from}
                                    selected={statsDateRange as any}
                                    onSelect={setStatsDateRange as any}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-red-50 border-red-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-red-800">Total Shortages</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {formatCurrency(varianceStats?.totalShortage || 0)}
                            </div>
                            <p className="text-xs text-red-700 mt-1">
                                {varianceStats?.shortageCount} shifts with shortages
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-green-800">Total Surpluses</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {formatCurrency(varianceStats?.totalSurplus || 0)}
                            </div>
                            <p className="text-xs text-green-700 mt-1">
                                {varianceStats?.surplusCount} shifts with surpluses
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

                {/* History Table */}
                <div className="border rounded-md flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Cashier</TableHead>
                                <TableHead className="text-right">System Total</TableHead>
                                <TableHead className="text-right">Declared Total</TableHead>
                                <TableHead className="text-right">Variance</TableHead>
                                <TableHead className="text-center">Status</TableHead>
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
                                        <TableCell>{format(new Date(shift.startTime), 'yyyy-MM-dd')}</TableCell>
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
          <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
              {/* NOTE: We now switch content based on mode (Cashier vs Office) */}
              {reconMode === 'CASH_OFFICE' ? (
                /* Cash Office Mode Verification Modal */
                <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0 gap-0">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                        <div>
                             <h2 className="text-xl font-bold tracking-tight">Cash Office Day End Reconcile Verification</h2>
                             <p className="text-xs text-muted-foreground">Authorise Day End Reconcile Per Cash Office</p>
                        </div>
                        <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium border border-orange-200">
                             Welcome Francois Naude (2025/2026 M8)
                        </div>
                    </div>

                    <div className="p-6 space-y-8 bg-white min-h-[600px]">
                        {/* Top Filters / Status */}
                        <div className="flex justify-between items-start">
                            <div className="space-y-4 w-1/3">
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label className="text-right text-xs uppercase tracking-wider text-muted-foreground">Cash Office*</Label>
                                    <Select defaultValue={selectedShift.cashOffice}>
                                        <SelectTrigger className="col-span-2 h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={selectedShift.cashOffice}>{selectedShift.cashOffice}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label className="text-right text-xs uppercase tracking-wider text-muted-foreground">CashBook*</Label>
                                    <Select defaultValue="FNB">
                                        <SelectTrigger className="col-span-2 h-8 bg-muted/20">
                                            <SelectValue placeholder="First National Bank" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FNB">First National Bank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="text-red-600 font-bold text-sm">0 Out of 1 Completed</div>
                                <div className="text-sm text-muted-foreground">Reconcile Date: {format(new Date(), 'dd/MM/yyyy')}</div>
                            </div>
                        </div>

                        {/* Cashier Information Table */}
                        <div className="space-y-1">
                             <div className="bg-gradient-to-r from-gray-200 to-gray-300 px-2 py-1 text-xs font-bold text-gray-700 flex items-center border rounded-t-sm">
                                <span className="mr-2">▼</span> Cashier Information
                             </div>
                             <div className="border rounded-sm overflow-hidden">
                                 <Table>
                                     <TableHeader className="bg-gray-100">
                                         <TableRow className="h-8">
                                             <TableHead className="h-8 py-0 text-xs font-bold text-gray-700 border-r">Cashier Id</TableHead>
                                             <TableHead className="h-8 py-0 text-xs font-bold text-gray-700 border-r">Cashier Name</TableHead>
                                             <TableHead className="h-8 py-0 text-xs font-bold text-gray-700">Cashier Reconcile Status</TableHead>
                                         </TableRow>
                                     </TableHeader>
                                     <TableBody>
                                         <TableRow className="h-8">
                                             <TableCell className="py-1 text-sm border-r">28758</TableCell>
                                             <TableCell className="py-1 text-sm border-r">Cashier UPDI</TableCell>
                                             <TableCell className="py-1 text-sm">Not Yet Submitted</TableCell>
                                         </TableRow>
                                     </TableBody>
                                 </Table>
                             </div>
                        </div>

                        {/* Payout Information */}
                        <div className="space-y-1">
                             <div className="bg-gradient-to-r from-gray-200 to-gray-300 px-2 py-1 text-xs font-bold text-gray-700 flex items-center border rounded-t-sm">
                                <span className="mr-2">▼</span> Payout Information
                             </div>
                             <div className="border-b border-x p-2">
                                 <div className="text-sm border-b border-gray-200 pb-1 mb-1">DropBox Payment</div>
                             </div>
                        </div>

                         {/* Receipt Information */}
                         <div className="space-y-1">
                             <div className="bg-gradient-to-r from-gray-200 to-gray-300 px-2 py-1 text-xs font-bold text-gray-700 flex items-center border rounded-t-sm">
                                <span className="mr-2">▼</span> Receipt Information
                             </div>
                             <div className="border-x border-b p-4 space-y-4">
                                 <div className="border-b border-gray-300 pb-1">
                                     <span className="text-sm font-medium">Cash</span>
                                 </div>
                                 <div className="border-b border-gray-300 pb-1">
                                     <span className="text-sm font-medium">Cheque</span>
                                 </div>
                                 <div className="border-b border-gray-300 pb-1">
                                     <span className="text-sm font-medium">Credit Card</span>
                                 </div>
                                 <div className="border-b border-gray-300 pb-1">
                                     <span className="text-sm font-medium">Postal Order</span>
                                 </div>
                                 
                                 <div className="flex justify-center py-2">
                                     <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-full px-12 py-1 text-sm font-bold text-gray-700 shadow-sm w-2/3 text-center border">
                                         Grand Total
                                     </div>
                                 </div>
                             </div>
                        </div>

                         {/* System vs Cashier Totals */}
                         <div className="space-y-1">
                             <div className="bg-gradient-to-r from-gray-200 to-gray-300 px-2 py-1 text-xs font-bold text-gray-700 flex items-center border rounded-t-sm">
                                <span className="mr-2">▼</span> System vs Cashier Totals
                             </div>
                             <div className="h-12 border-x border-b bg-gray-50/20"></div>
                        </div>

                         {/* Reason */}
                         <div className="space-y-1">
                            <Label className="text-xs">Reason (*if returned to cashier)</Label>
                            <Input className="bg-white h-8" />
                         </div>

                    </div>
                    
                    <DialogFooter className="p-4 border-t bg-gray-50 flex justify-center sm:justify-center">
                        <Button className="bg-gradient-to-b from-gray-700 to-black text-white px-8 h-8 shadow-md hover:from-gray-600 hover:to-gray-900" onClick={() => setSelectedShift(null)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
              ) : (
                /* Per Cashier Mode Verification Modal (Existing Logic) */
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                          Reconciliation Review: <span className="text-blue-600">{selectedShift.cashierName}</span>
                      </DialogTitle>
                      <DialogDescription>
                          Shift ID: {selectedShift.id} | Office: {selectedShift.cashOffice}
                      </DialogDescription>
                  </DialogHeader>

                  <div className="grid grid-cols-2 gap-8 py-4">
                      {/* Left: System Totals */}
                      <div className="space-y-4">
                          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">System Totals</h3>
                          
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                  <Banknote className="w-4 h-4 text-gray-500" />
                                  <span>Cash System</span>
                              </div>
                              <span className="font-mono font-medium">R {selectedShift.systemTotals.cash.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-gray-500" />
                                  <span>Card System</span>
                              </div>
                              <span className="font-mono font-medium">R {selectedShift.systemTotals.card.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border border-gray-200">
                              <span className="font-bold text-gray-700">Total System</span>
                              <span className="font-mono font-bold text-lg">R {selectedShift.systemTotals.total.toFixed(2)}</span>
                          </div>
                      </div>

                      {/* Right: Declared & Variance */}
                      <div className="space-y-4">
                          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">Declared & Variance</h3>
                          
                          {selectedShift.status === 'NOT_SUBMITTED' ? (
                               <div className="h-full flex items-center justify-center text-muted-foreground italic bg-muted/20 rounded-lg border-2 border-dashed">
                                   Not submitted yet
                               </div>
                           ) : (
                               <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <div className="text-xs text-blue-700 mb-1">Cash Declared</div>
                                        <div className="font-mono font-bold">R {selectedShift.declaredTotals?.cash.toFixed(2)}</div>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <div className="text-xs text-blue-700 mb-1">Card Declared</div>
                                        <div className="font-mono font-bold">R {selectedShift.declaredTotals?.card.toFixed(2)}</div>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-lg border ${selectedShift.variance?.total === 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold flex items-center gap-2">
                                            {selectedShift.variance?.total === 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                            Total Variance
                                        </span>
                                        <span className="font-mono font-bold text-xl">R {selectedShift.variance?.total.toFixed(2)}</span>
                                    </div>
                                </div>
                               </>
                           )}
                      </div>
                  </div>

                  {/* Transaction List Preview */}
                  <div className="border rounded-lg overflow-hidden mt-2">
                       <div className="bg-gray-50 px-4 py-2 border-b text-xs font-semibold text-muted-foreground flex justify-between items-center">
                           <span>TRANSACTION SUMMARY</span>
                           <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs gap-1 bg-white"
                              onClick={() => downloadReport(selectedShift)}
                           >
                              <Download className="w-3 h-3" />
                              Export Report
                           </Button>
                       </div>
                       <div className="max-h-[150px] overflow-y-auto">
                           <Table>
                               <TableBody>
                                   {[1,2,3].map(i => (
                                       <TableRow key={i} className="text-xs">
                                           <TableCell className="font-mono">REC-{Math.floor(Math.random()*900000)}</TableCell>
                                           <TableCell>{format(new Date(), 'HH:mm:ss')}</TableCell>
                                           <TableCell>Consumer Payment</TableCell>
                                           <TableCell className="text-right font-mono">R {(Math.random() * 500).toFixed(2)}</TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                       </div>
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                      {selectedShift.status === 'PENDING_APPROVAL' && (
                          <>
                            <Button 
                                variant="destructive" 
                                className="mr-auto w-32"
                                onClick={handleReturn}
                                disabled={!returnReason.trim()}
                            >
                                Return to Cashier
                            </Button>
                            <Button variant="outline" onClick={() => setSelectedShift(null)}>Cancel</Button>
                            <Button 
                                className="bg-green-600 hover:bg-green-700 w-32"
                                onClick={() => handleApprove(selectedShift.id)}
                            >
                                Approve & Post
                            </Button>
                          </>
                      )}
                      {selectedShift.status !== 'PENDING_APPROVAL' && (
                          <Button onClick={() => setSelectedShift(null)}>Close</Button>
                      )}
                  </DialogFooter>
              </DialogContent>
            )}
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
