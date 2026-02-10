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
  Download
} from 'lucide-react';
import { format } from 'date-fns';

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

import { usePos } from '@/lib/pos-state';

// ... (keep types and Mock Data)

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
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);

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

  const handleReturn = (id: string) => {
    setShifts(prev => prev.map(s => s.id === id ? { ...s, status: 'RETURNED' } : s));
    setSelectedShift(null);
  };
  
  const confirmReturn = () => {
      if (selectedShift) {
          handleReturn(selectedShift.id); // Update local mock list
          // In a real app, this would target the specific cashier.
          // For prototype demo, we broadcast this to the active PosState
          returnDayEnd(returnReason); 
          setIsReturnDialogOpen(false);
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="bg-blue-600 p-2 rounded-lg text-white">
               <LayoutDashboard className="w-6 h-6" />
           </div>
           <div>
               <h1 className="text-xl font-bold text-gray-900">Supervisor Dashboard</h1>
               <p className="text-sm text-muted-foreground">Reconciliation & Approvals</p>
           </div>
        </div>

        <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-gray-100 p-1.5 rounded-lg border">
                <span className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${reconMode === 'PER_CASHIER' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}>
                    Per Cashier
                </span>
                <Switch 
                    checked={reconMode === 'CASH_OFFICE'}
                    onCheckedChange={(c) => setReconMode(c ? 'CASH_OFFICE' : 'PER_CASHIER')}
                />
                <span className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${reconMode === 'CASH_OFFICE' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}>
                    Cash Office
                </span>
            </div>
            
            <div className="h-8 w-px bg-gray-200"></div>
            
            <div className="flex items-center gap-2">
                <div className="text-right">
                    <div className="text-sm font-medium">Administrator</div>
                    <div className="text-xs text-muted-foreground">Finance Dept</div>
                </div>
                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                    AD
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
         <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Status Cards */}
            <div className="grid grid-cols-4 gap-6">
                <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                        <CardDescription>Pending Approvals</CardDescription>
                        <CardTitle className="text-3xl text-blue-700">{pendingCount}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Waiting for review
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="shadow-sm border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                        <CardDescription>Variances Detected</CardDescription>
                        <CardTitle className="text-3xl text-red-700">{varianceCount}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Requires attention
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                        <CardDescription>Total Posted (Today)</CardDescription>
                        <CardTitle className="text-3xl text-green-700">R 16,000.00</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Successfully reconciled
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-l-purple-500">
                     <CardHeader className="pb-2">
                        <CardDescription>Total System Revenue</CardDescription>
                        <CardTitle className="text-3xl text-purple-700">R 49,001.00</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> All active shifts
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-4">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search cashier..." 
                            className="pl-9 w-[250px]" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                     </div>
                     <Select value={filterOffice} onValueChange={setFilterOffice}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by Office" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Offices</SelectItem>
                            <SelectItem value="Main Civic Center">Main Civic Center</SelectItem>
                            <SelectItem value="Traffic Dept">Traffic Dept</SelectItem>
                        </SelectContent>
                     </Select>
                </div>
                
                <Button variant="outline" className="gap-2">
                    <Filter className="w-4 h-4" />
                    More Filters
                </Button>
            </div>

            {/* Table Content */}
            <Card className="shadow-sm">
                <CardHeader className="pb-0 border-b bg-gray-50/50">
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle>{reconMode === 'PER_CASHIER' ? 'Cashier Shifts' : 'Cash Office Summaries'}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {reconMode === 'PER_CASHIER' ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cashier</TableHead>
                                    <TableHead>Office</TableHead>
                                    <TableHead>Shift Start</TableHead>
                                    <TableHead className="text-right">Tx Count</TableHead>
                                    <TableHead className="text-right">System Total</TableHead>
                                    <TableHead className="text-right">Variance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredShifts.map((shift) => (
                                    <TableRow key={shift.id}>
                                        <TableCell className="font-medium">{shift.cashierName}</TableCell>
                                        <TableCell className="text-muted-foreground">{shift.cashOffice}</TableCell>
                                        <TableCell>{format(new Date(shift.startTime), 'MMM dd, HH:mm')}</TableCell>
                                        <TableCell className="text-right">{shift.transactionCount}</TableCell>
                                        <TableCell className="text-right font-mono">R {shift.systemTotals.total.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {shift.status === 'NOT_SUBMITTED' ? (
                                                <span className="text-muted-foreground">-</span>
                                            ) : (
                                                <span className={shift.variance?.total === 0 ? 'text-green-600' : 'text-red-600 font-bold'}>
                                                    R {shift.variance?.total.toFixed(2)}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={shift.status} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedShift(shift)}>
                                                Review
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cash Office</TableHead>
                                    <TableHead className="text-right">Active Shifts</TableHead>
                                    <TableHead className="text-right">Total System</TableHead>
                                    <TableHead className="text-right">Total Declared</TableHead>
                                    <TableHead>Consolidated Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {officeGroups && Object.entries(officeGroups).map(([office, data]) => (
                                    <TableRow key={office}>
                                        <TableCell className="font-medium text-lg">{office}</TableCell>
                                        <TableCell className="text-right">{data.shifts.length}</TableCell>
                                        <TableCell className="text-right font-mono font-medium">R {data.totalSystem.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono">R {data.totalDeclared.toFixed(2)}</TableCell>
                                        <TableCell>
                                            {data.status === 'MIXED' && <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Incomplete</Badge>}
                                            {data.status === 'READY' && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Ready to Post</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" disabled={data.status === 'MIXED'}>
                                                Consolidate & Post
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
         </div>
      </main>

      {/* Review Modal */}
      {selectedShift && (
          <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
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
                                className="mr-auto"
                                onClick={() => setIsReturnDialogOpen(true)}
                            >
                                Return to Cashier
                            </Button>
                            <Button variant="outline" onClick={() => setSelectedShift(null)}>Cancel</Button>
                            <Button 
                                className="bg-green-600 hover:bg-green-700"
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
          </Dialog>
      )}
      
      {/* Return Reason Dialog */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Return Reconciliation</DialogTitle>
                  <DialogDescription>
                      Please provide a reason for returning this reconciliation to the cashier.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <Label htmlFor="reason" className="mb-2 block">Reason / Comment</Label>
                  <textarea 
                      id="reason"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="e.g. Cash count mismatch, please recount."
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                  />
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsReturnDialogOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={confirmReturn} disabled={!returnReason.trim()}>
                      Confirm Return
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
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
