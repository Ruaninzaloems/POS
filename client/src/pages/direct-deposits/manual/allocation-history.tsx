import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Printer, FileText, Search, User, FileSpreadsheet, FileIcon, Filter, X, RotateCcw, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { MOCK_BANK_TRANSACTIONS, MOCK_ALLOCATIONS, BankTransaction } from '@/lib/direct-deposits-data';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { ReceiptTemplate } from '@/components/pos/receipt-template';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';

export default function AllocationHistory() {
  const { toast } = useToast();
  const [filterQuery, setFilterQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL'); // ALL, MANUAL, BULK
  
  // Advanced Filters
  const [financialYear, setFinancialYear] = useState('2025/2026');
  const [billingMonth, setBillingMonth] = useState('All');
  const [allocDateFrom, setAllocDateFrom] = useState<Date | undefined>();
  const [allocDateTo, setAllocDateTo] = useState<Date | undefined>();
  const [txnDateFrom, setTxnDateFrom] = useState<Date | undefined>();
  const [txnDateTo, setTxnDateTo] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  
  // Get all allocated and processing transactions
  const allocatedTxns = MOCK_BANK_TRANSACTIONS.filter(t => t.status === 'ALLOCATED' || t.status === 'PROCESSING' || t.status === 'ERROR');
  
  // Enrich with allocation details
  const historyData = allocatedTxns.map(tx => {
      const details = MOCK_ALLOCATIONS.find(a => a.transactionId === tx.id);
      return {
          ...tx,
          details
      };
  });

  // Filter
  const filteredHistory = historyData.filter(item => {
      const matchesSearch = 
        item.description.toLowerCase().includes(filterQuery.toLowerCase()) || 
        item.reference.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (item.details?.allocatedBy || '').toLowerCase().includes(filterQuery.toLowerCase());
      
      const matchesMethod = 
        methodFilter === 'ALL' || 
        (methodFilter === 'MANUAL' && item.details?.method === 'MANUAL') ||
        (methodFilter === 'BULK' && item.details?.method === 'BULK');

      // Date Filters
      let matchesAllocDate = true;
      if (allocDateFrom && allocDateTo && item.details?.allocationDate) {
          const date = new Date(item.details.allocationDate);
          if (isValid(date)) {
              matchesAllocDate = isWithinInterval(date, { 
                  start: startOfDay(allocDateFrom), 
                  end: endOfDay(allocDateTo) 
              });
          }
      }

      let matchesTxnDate = true;
      if (txnDateFrom && txnDateTo) {
          const date = new Date(item.transactionDate);
          if (isValid(date)) {
              matchesTxnDate = isWithinInterval(date, { 
                  start: startOfDay(txnDateFrom), 
                  end: endOfDay(txnDateTo) 
              });
          }
      }

      // Status Filter
      let matchesStatus = true;
      if (statusFilter.length > 0) {
          const status = item.details?.bulkJobStatus || 'Allocated';
          matchesStatus = statusFilter.includes(status);
      }

      // Billing Month & Financial Year (Mock logic as data doesn't explicitly have these fields)
      // For prototype, we'll just return true if filters are default
      const matchesFinYear = true; 
      const matchesBillingMonth = true;

      return matchesSearch && matchesMethod && matchesAllocDate && matchesTxnDate && matchesStatus && matchesFinYear && matchesBillingMonth;
  });

  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const selectedAllocation = selectedTx ? MOCK_ALLOCATIONS.find(a => a.transactionId === selectedTx.id) : null;

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${selectedTx?.id || 'Draft'}`,
  });

  const handleDownload = (format: 'excel' | 'pdf') => {
      // Mock download functionality
      const element = document.createElement("a");
      const fileContent = "TransactionDate,AllocationDate,Description,Reference,Method,AllocatedBy,Amount,Status\n" + 
          filteredHistory.map(t => `${t.transactionDate},"${t.details?.allocationDate || ''}","${t.description}",${t.reference},${t.details?.method || ''},${t.details?.allocatedBy || ''},${t.amount},${t.status}`).join("\n");
      const fileBlob = new Blob([fileContent], { type: format === 'excel' ? "text/csv" : "text/plain" });
      element.href = URL.createObjectURL(fileBlob);
      element.download = `allocation_history.${format === 'excel' ? 'csv' : 'txt'}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  const handleRetry = (tx: any) => {
      toast({
          title: "Retry Initiated",
          description: `Retrying processing for transaction ${tx.reference}`,
      });
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
      setFilterQuery('');
  };

  const activeFiltersCount = [
      allocDateFrom, txnDateFrom, statusFilter.length > 0
  ].filter(Boolean).length;

  return (
    <PosLayout>
       <div className="flex-1 flex flex-col h-full bg-slate-50/50">
        <div className="p-6 border-b bg-white flex flex-col gap-4">
             {/* Header Row */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="flex items-center gap-4">
                     <Link href="/direct-deposits/manual">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                     </Link>
                     <div>
                         <h1 className="text-xl font-bold">Allocation History</h1>
                         <p className="text-sm text-muted-foreground">View processed allocations (Manual & Bulk)</p>
                     </div>
                 </div>

                 <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleDownload('excel')} title="Download Excel">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDownload('pdf')} title="Download PDF">
                        <FileIcon className="w-4 h-4 text-red-600" />
                    </Button>
                 </div>
             </div>

             {/* Filters Row */}
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                
                {/* Standard Search */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Description, Reference..." 
                            className="pl-8 bg-white" 
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Period Selectors */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Financial Period</Label>
                    <div className="flex gap-2">
                         <Select value={financialYear} onValueChange={setFinancialYear}>
                            <SelectTrigger className="bg-white flex-1">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2025/2026">2025/2026</SelectItem>
                                <SelectItem value="2024/2025">2024/2025</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={billingMonth} onValueChange={setBillingMonth}>
                            <SelectTrigger className="bg-white flex-1">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Months</SelectItem>
                                <SelectItem value="July">July</SelectItem>
                                <SelectItem value="August">August</SelectItem>
                                <SelectItem value="September">September</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Advanced Filter Popover */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Advanced Filters</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between bg-white border-dashed text-slate-600">
                                <span className="flex items-center gap-2">
                                    <Filter className="w-3 h-3" />
                                    {activeFiltersCount > 0 ? `${activeFiltersCount} Filters Active` : "Filter by Date & Status"}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 p-4" align="start">
                            <div className="space-y-4">
                                <h4 className="font-medium text-sm border-b pb-2">Filter Options</h4>
                                
                                <div className="space-y-2">
                                    <Label className="text-xs">Allocation Date Range</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1"><DatePicker date={allocDateFrom} setDate={setAllocDateFrom} placeholder="From" className="h-8 text-xs" /></div>
                                        <span className="text-muted-foreground self-center">-</span>
                                        <div className="flex-1"><DatePicker date={allocDateTo} setDate={setAllocDateTo} placeholder="To" className="h-8 text-xs" /></div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs">Transaction Date Range</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1"><DatePicker date={txnDateFrom} setDate={setTxnDateFrom} placeholder="From" className="h-8 text-xs" /></div>
                                        <span className="text-muted-foreground self-center">-</span>
                                        <div className="flex-1"><DatePicker date={txnDateTo} setDate={setTxnDateTo} placeholder="To" className="h-8 text-xs" /></div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs">Status</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Allocated', 'Processing', 'Performing rebuilds', 'Completing reconciliation', 'Bulk allocations complete', 'Error'].map((status) => (
                                            <div key={status} className="flex items-center space-x-2">
                                                <Checkbox 
                                                    id={status} 
                                                    checked={statusFilter.includes(status)}
                                                    onCheckedChange={() => toggleStatusFilter(status)}
                                                />
                                                <label
                                                    htmlFor={status}
                                                    className="text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
                                                    title={status}
                                                >
                                                    {status}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                
                {/* Clear & Method */}
                 <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Allocation Method</Label>
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
                        <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear all filters">
                            <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

             </div>
        </div>

        <div className="p-6">
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Transaction Date</TableHead>
                            <TableHead>Allocation Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Allocated By</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHistory.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {format(new Date(tx.transactionDate), 'dd/MM/yyyy')}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                    {tx.details?.allocationDate ? format(new Date(tx.details.allocationDate), 'dd/MM/yyyy HH:mm') : '-'}
                                </TableCell>
                                <TableCell className="text-sm font-medium">{tx.description}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="font-mono">{tx.reference}</Badge>
                                </TableCell>
                                <TableCell>
                                    {tx.details?.method === 'BULK' ? (
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200">
                                            Bulk
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">
                                            Manual
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3 h-3 text-muted-foreground" />
                                        <span>{tx.details?.allocatedBy || 'Unknown'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                    R {tx.amount.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                    {tx.details?.bulkJobStatus ? (
                                        <Badge 
                                            className={`shadow-none border ${
                                                tx.details.bulkJobStatus === 'Bulk allocations complete' 
                                                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
                                                : tx.details.bulkJobStatus === 'Processing'
                                                ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100'
                                                : tx.details.bulkJobStatus === 'Performing rebuilds'
                                                ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                : tx.details.bulkJobStatus === 'Error'
                                                ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100'
                                                : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100'
                                            }`}
                                        >
                                            {tx.details.bulkJobStatus !== 'Bulk allocations complete' && tx.details.bulkJobStatus !== 'Error' && (
                                                <Loader2 className="w-3 h-3 mr-1 animate-spin inline-block" />
                                            )}
                                            {tx.details.bulkJobStatus === 'Error' && (
                                                <AlertCircle className="w-3 h-3 mr-1 inline-block" />
                                            )}
                                            {tx.details.bulkJobStatus}
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-green-100 text-green-700 border-green-200 shadow-none hover:bg-green-100">
                                            Allocated
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {tx.details?.bulkJobStatus === 'Error' && (
                                            <Button variant="ghost" size="sm" onClick={() => handleRetry(tx)} className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2">
                                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedTx(tx)} className="h-8 px-2">
                                            <Eye className="w-4 h-4 mr-2" /> View
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredHistory.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                    No allocation history found matching your criteria.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
       </div>

       <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Allocation Details</DialogTitle>
                <DialogDescription>Transaction ID: {selectedTx?.id}</DialogDescription>
            </DialogHeader>
            
            {selectedTx && (
                <div className="space-y-6">
                    {/* Bank Transaction Info */}
                    <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="md:col-span-2">
                            <span className="text-muted-foreground block text-xs">Bank Description</span>
                            <span className="font-medium">{selectedTx.description}</span>
                        </div>
                        <div className="md:col-span-2">
                            <span className="text-muted-foreground block text-xs">Bank Reference</span>
                            <span className="font-mono">{selectedTx.reference}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Transaction Date</span>
                            <span>{format(new Date(selectedTx.transactionDate), 'dd MMM yyyy')}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Allocation Date</span>
                            <span>{selectedAllocation?.allocationDate ? format(new Date(selectedAllocation.allocationDate), 'dd MMM yyyy HH:mm') : '-'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Allocated By</span>
                            <span className="font-medium flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {selectedAllocation?.allocatedBy || 'Unknown'}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Total Amount</span>
                            <span className="font-bold">R {selectedTx.amount.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Allocation Lines */}
                    <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            Allocated Lines
                        </h4>
                        <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="h-8">Account / Reference</TableHead>
                                        <TableHead className="h-8">Description</TableHead>
                                        <TableHead className="h-8 text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedAllocation ? (
                                        selectedAllocation.lines.map((line, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono text-xs">{line.accountNo}</TableCell>
                                                <TableCell className="text-xs">{line.description}</TableCell>
                                                <TableCell className="text-right font-mono text-sm">R {line.amount.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                                No allocation details found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {selectedAllocation && (
                                        <TableRow className="bg-slate-50 font-bold">
                                            <TableCell colSpan={2} className="text-right">Total Allocated:</TableCell>
                                            <TableCell className="text-right font-mono">
                                                R {selectedAllocation.lines.reduce((s, l) => s + l.amount, 0).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Hidden Receipt for Printing */}
            <div style={{ display: 'none' }}>
                {selectedTx && selectedAllocation && (
                    <ReceiptTemplate 
                        ref={receiptRef} 
                        transaction={selectedTx} 
                        allocation={selectedAllocation} 
                        isReprint={true}
                    />
                )}
            </div>

            <DialogFooter className="sm:justify-between">
                <div className="text-xs text-muted-foreground flex items-center">
                    Method: {selectedAllocation?.method === 'BULK' ? 'Bulk Import' : 'Manual Allocation'}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSelectedTx(null)}>Close</Button>
                    <Button variant="default" className="gap-2" onClick={handlePrint}>
                        <Printer className="w-4 h-4" /> Print Receipt
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
       </Dialog>
    </PosLayout>
  );
}