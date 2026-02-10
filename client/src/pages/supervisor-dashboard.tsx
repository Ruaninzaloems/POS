import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
  RefreshCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { usePos } from '@/lib/pos-state';

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

// Mock Data
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
  const { returnDayEnd } = usePos();
  const [reconMode, setReconMode] = useState<ReconMode>('PER_CASHIER');
  const [selectedShift, setSelectedShift] = useState<CashierShift | null>(null);
  const [shifts, setShifts] = useState<CashierShift[]>(MOCK_SHIFTS);
  const [filterOffice, setFilterOffice] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [returnReason, setReturnReason] = useState('');
  // const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false); // Removed state

  const filteredShifts = shifts.filter(shift => {
    const matchesOffice = filterOffice === 'All' || shift.cashOffice === filterOffice;
    const matchesSearch = shift.cashierName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOffice && matchesSearch;
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

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Supervisor Dashboard</h1>
            <p className="text-muted-foreground">Reconciliation & Approvals</p>
          </div>
          <div className="flex items-center gap-4">
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
            <div className="text-3xl font-bold text-blue-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <RefreshCcw className="w-3 h-3" /> Waiting for review
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
          <Button variant="outline" className="gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4" />
              More Filters
          </Button>
      </div>

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
                          <TableHead className="text-right">System Total</TableHead>
                          <TableHead className="text-right">Variance</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredShifts.map(shift => (
                          <TableRow key={shift.id}>
                              <TableCell className="font-medium">{shift.cashierName}</TableCell>
                              <TableCell className="text-muted-foreground">{shift.cashOffice}</TableCell>
                              <TableCell>{format(new Date(shift.startTime), 'MMM dd, HH:mm')}</TableCell>
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
                                      onClick={() => {
                                          setSelectedShift(shift);
                                          setReturnReason('');
                                      }}
                                  >
                                      Review
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
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
