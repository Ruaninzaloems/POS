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
import { ArrowLeft, Eye, Printer, FileText, Search, User, FileSpreadsheet, FileIcon, Filter, X, RotateCcw, AlertCircle, File, Download } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
        (item.details?.allocatedBy || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (item.details?.allocationType || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (item.details?.fileName || '').toLowerCase().includes(filterQuery.toLowerCase());
      
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
      const fileContent = "TransactionDate,AllocationDate,Description,Reference,Method,AllocatedBy,Amount,Status,Type,File\n" + 
          filteredHistory.map(t => `${t.transactionDate},"${t.details?.allocationDate || ''}","${t.description}",${t.reference},${t.details?.method || ''},${t.details?.allocatedBy || ''},${t.amount},${t.status},${t.details?.allocationType || ''},${t.details?.fileName || ''}`).join("\n");
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

  const handleDownloadFile = (fileName: string) => {
      // Mock download
      toast({
          title: "Downloading File",
          description: `Downloading source file: ${fileName}`,
      });
  };

  const getAllocationTypeLabel = (type?: string) => {
      switch(type) {
          case 'DIRECT_PAYMENT': return 'Direct Payment';
          case 'CLEARANCE_PAYMENT': return 'Clearance Payment';
          case 'ACCOUNT_PAYMENT': return 'Account Payment';
          case 'ELECTRICITY_RECHARGE': return 'Electricity Recharge';
          case 'WATER_RECHARGE': return 'Water Recharge';
          case 'CSV_FILE': return 'CSV File Upload';
          default: return 'Standard Allocation';
      }
  };

  const getAllocationTypeBadgeColor = (type?: string) => {
      switch(type) {
          case 'DIRECT_PAYMENT': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
          case 'CLEARANCE_PAYMENT': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
          case 'ACCOUNT_PAYMENT': return 'bg-sky-100 text-sky-700 border-sky-200';
          case 'ELECTRICITY_RECHARGE': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'WATER_RECHARGE': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'CSV_FILE': return 'bg-slate-100 text-slate-700 border-slate-200';
          default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
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
                            <TableHead>Type</TableHead>
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
                                    <Badge variant="secondary" className={`border ${getAllocationTypeBadgeColor(tx.details?.allocationType)} shadow-none font-normal`}>
                                        {getAllocationTypeLabel(tx.details?.allocationType)}
                                    </Badge>
                                    {tx.details?.allocationType === 'CSV_FILE' && tx.details?.fileName && (
                                        <div className="mt-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button 
                                                            variant="link" 
                                                            className="h-auto p-0 text-[10px] text-blue-600 flex items-center gap-1"
                                                            onClick={() => handleDownloadFile(tx.details?.fileName || '')}
                                                        >
                                                            <File className="w-3 h-3" />
                                                            <span className="truncate max-w-[100px]">{tx.details.fileName}</span>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Download {tx.details.fileName}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    )}
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
                                            <FileText className="w-4 h-4 mr-2 text-slate-500" /> Report
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredHistory.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle>Allocation Report</DialogTitle>
                        <DialogDescription>Transaction ID: {selectedTx?.id}</DialogDescription>
                    </div>
                    <div className="flex gap-2">
                         <Button size="sm" variant="outline" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" /> Print Report
                         </Button>
                         <Button size="sm" variant="outline" onClick={() => handleDownload('pdf')}>
                            <FileIcon className="w-4 h-4 mr-2" /> Export PDF
                         </Button>
                    </div>
                </div>
            </DialogHeader>
            
            {selectedTx && (
                <div className="space-y-6 overflow-y-auto p-4 flex-1" ref={receiptRef}>
                    {/* Report Header */}
                    <div className="flex justify-between items-start border-b pb-6">
                        <div className="flex gap-4">
                           <div className="h-12 w-12 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xl">
                                M
                           </div>
                           <div>
                               <h2 className="text-xl font-bold text-slate-900">Municipal POS</h2>
                               <p className="text-sm text-muted-foreground">Direct Deposit Allocation Report</p>
                           </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-medium text-slate-500">Report Date</div>
                            <div className="font-mono">{format(new Date(), 'dd MMM yyyy HH:mm')}</div>
                        </div>
                    </div>

                    {/* Allocation Info Grid */}
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                             <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider mb-4 border-b pb-2">Transaction Details</h3>
                             <dl className="space-y-2 text-sm">
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Description:</dt>
                                    <dd className="col-span-2 font-medium">{selectedTx.description}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Reference:</dt>
                                    <dd className="col-span-2 font-mono bg-slate-100 w-fit px-1 rounded">{selectedTx.reference}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Date:</dt>
                                    <dd className="col-span-2">{format(new Date(selectedTx.transactionDate), 'dd/MM/yyyy')}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Bank Account:</dt>
                                    <dd className="col-span-2">{selectedTx.bankAccount}</dd>
                                </div>
                                <div className="grid grid-cols-3 mt-4 pt-2 border-t">
                                    <dt className="font-bold text-slate-900">Total Amount:</dt>
                                    <dd className="col-span-2 font-bold text-slate-900">R {selectedTx.amount.toFixed(2)}</dd>
                                </div>
                             </dl>
                        </div>
                        <div>
                             <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider mb-4 border-b pb-2">Allocation Details</h3>
                             <dl className="space-y-2 text-sm">
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Status:</dt>
                                    <dd className="col-span-2">
                                        <Badge variant="outline" className={getAllocationTypeBadgeColor(selectedAllocation?.allocationType)}>
                                            {selectedAllocation?.bulkJobStatus || selectedTx.status}
                                        </Badge>
                                    </dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Allocated By:</dt>
                                    <dd className="col-span-2">{selectedAllocation?.allocatedBy || 'Unknown'}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Allocation Date:</dt>
                                    <dd className="col-span-2">{selectedAllocation?.allocationDate ? format(new Date(selectedAllocation.allocationDate), 'dd MMM yyyy HH:mm') : '-'}</dd>
                                </div>
                                <div className="grid grid-cols-3">
                                    <dt className="text-muted-foreground">Type:</dt>
                                    <dd className="col-span-2 font-medium">{getAllocationTypeLabel(selectedAllocation?.allocationType)}</dd>
                                </div>
                                {selectedAllocation?.allocationType === 'CSV_FILE' && (
                                    <div className="grid grid-cols-3">
                                        <dt className="text-muted-foreground">Source File:</dt>
                                        <dd className="col-span-2 font-mono text-xs flex items-center gap-1 text-blue-600">
                                            <File className="w-3 h-3" />
                                            {selectedAllocation.fileName || 'Unknown File'}
                                        </dd>
                                    </div>
                                )}
                             </dl>
                        </div>
                    </div>

                    {/* Allocation Lines */}
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Allocation Breakdown
                        </h3>
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="h-8">Account / Reference</TableHead>
                                        <TableHead className="h-8">Description</TableHead>
                                        <TableHead className="h-8 text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(selectedAllocation?.lines || []).length > 0 ? (
                                        selectedAllocation!.lines.map(line => (
                                            <TableRow key={line.id}>
                                                <TableCell className="font-mono text-xs font-medium">{line.accountNo}</TableCell>
                                                <TableCell className="text-sm">{line.description}</TableCell>
                                                <TableCell className="text-right font-mono font-medium">R {line.amount.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground italic">
                                                No specific allocation lines available (e.g. bulk process in progress)
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {/* Total Footer */}
                                    <TableRow className="bg-slate-50 font-bold border-t-2 border-slate-200">
                                        <TableCell colSpan={2} className="text-right">Total Allocated:</TableCell>
                                        <TableCell className="text-right">
                                            R {(selectedAllocation?.lines || []).reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t pt-4 text-xs text-center text-muted-foreground mt-8">
                        <p>Generated by Municipal POS System</p>
                    </div>
                </div>
            )}
        </DialogContent>
       </Dialog>
    </PosLayout>
  );
}