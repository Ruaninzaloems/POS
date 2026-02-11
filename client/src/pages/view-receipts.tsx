import React, { useState, useRef } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Search, Printer, FileDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { MOCK_RECEIPTS, Receipt } from '@/lib/receipt-data';
import { CASHIERS } from '@/lib/mock-data';
import { ReceiptTemplate } from '@/components/pos/receipt-template';
import { useReactToPrint } from 'react-to-print';
import { BankTransaction, AllocationDraft } from '@/lib/direct-deposits-data';
import { cn } from '@/lib/utils';

export default function ViewReceipts() {
    // Filters
    const [cashierFilter, setCashierFilter] = useState("ALL");
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date(2023, 0, 1));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [accountFilter, setAccountFilter] = useState("");
    const [receiptFilter, setReceiptFilter] = useState("");
    
    // Data
    const [filteredReceipts, setFilteredReceipts] = useState<Receipt[]>(MOCK_RECEIPTS);
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    // Filter Logic
    const handleSearch = () => {
        let results = MOCK_RECEIPTS;

        if (cashierFilter && cashierFilter !== "ALL") {
            results = results.filter(r => r.cashierName === cashierFilter);
        }

        if (fromDate) {
            results = results.filter(r => new Date(r.receiptDate) >= fromDate);
        }

        if (toDate) {
            // Set to end of day
            const endOfDay = new Date(toDate);
            endOfDay.setHours(23, 59, 59, 999);
            results = results.filter(r => new Date(r.receiptDate) <= endOfDay);
        }

        if (accountFilter) {
            results = results.filter(r => r.accountId.toLowerCase().includes(accountFilter.toLowerCase()));
        }

        if (receiptFilter) {
            results = results.filter(r => r.receiptNo.toLowerCase().includes(receiptFilter.toLowerCase()));
        }

        setFilteredReceipts(results);
    };

    const handleClear = () => {
        setCashierFilter("ALL");
        setFromDate(new Date(2023, 0, 1));
        setToDate(new Date());
        setAccountFilter("");
        setReceiptFilter("");
        setFilteredReceipts(MOCK_RECEIPTS);
    };

    // Print Logic
    const handlePrint = useReactToPrint({
        contentRef: receiptRef,
        documentTitle: `Receipt-${selectedReceipt?.receiptNo || 'Copy'}`,
    });

    const triggerPrint = (receipt: Receipt) => {
        setSelectedReceipt(receipt);
        // Small timeout to allow state update and render before printing
        setTimeout(() => {
            handlePrint();
        }, 100);
    };

    // Mock PDF/Excel Export
    const handleExport = (type: 'PDF' | 'EXCEL') => {
        alert(`Exporting to ${type} is not implemented in mock mode, but would generate a file for ${filteredReceipts.length} receipts.`);
    };

    // Helper to map Receipt to the ReceiptTemplate props (since template uses BankTransaction type)
    // In a real app these types would likely be shared or properly mapped
    const mapReceiptToTemplateData = (receipt: Receipt) => {
        if (!receipt) return { transaction: {} as any, allocation: {} as any };

        const mockTx: BankTransaction = {
            id: receipt.id,
            transactionDate: receipt.receiptDate,
            description: receipt.paymentOption,
            amount: receipt.amount,
            reference: receipt.accountId,
            status: 'ALLOCATED',
            allocatedAmount: receipt.amount,
            bankAccount: receipt.cashBook
        };

        const mockAllocation: AllocationDraft = {
            transactionId: receipt.id,
            status: 'POSTED',
            updatedAt: receipt.receiptDate,
            lines: [{
                id: '1',
                accountNo: receipt.accountId,
                amount: receipt.amount,
                description: `${receipt.paymentOption} - ${receipt.paymentType}`
            }]
        };

        return { transaction: mockTx, allocation: mockAllocation };
    };

    const templateData = selectedReceipt ? mapReceiptToTemplateData(selectedReceipt) : null;

    return (
        <PosLayout>
            <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
                {/* Header / Filter Section */}
                <div className="bg-white border-b shadow-sm">
                    <div className="px-6 py-4 border-b">
                        <h1 className="text-xl font-bold text-slate-800">View Receipts</h1>
                    </div>
                    
                    <div className="p-6 bg-slate-50/50">
                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-l-2 border-blue-500 pl-2">
                                View Receipt Information
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                {/* Left Column */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">Cashier Name <span className="text-red-500">*</span></label>
                                        <Select value={cashierFilter} onValueChange={setCashierFilter}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="-- All --" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">-- All --</SelectItem>
                                                {CASHIERS.map(c => (
                                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">From Date <span className="text-red-500">*</span></label>
                                        <Input 
                                            type="date" 
                                            className="h-9"
                                            value={fromDate ? format(fromDate, 'yyyy-MM-dd') : ''}
                                            onChange={(e) => setFromDate(e.target.value ? new Date(e.target.value) : undefined)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">Account Number</label>
                                        <Input 
                                            className="h-9" 
                                            value={accountFilter}
                                            onChange={e => setAccountFilter(e.target.value)}
                                            placeholder="e.g. 000000059905"
                                        />
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-4">
                                    <div className="hidden md:block h-9"></div> {/* Spacer for Cashier Name */}

                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">To Date <span className="text-red-500">*</span></label>
                                        <Input 
                                            type="date" 
                                            className="h-9"
                                            value={toDate ? format(toDate, 'yyyy-MM-dd') : ''}
                                            onChange={(e) => setToDate(e.target.value ? new Date(e.target.value) : undefined)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">Receipt Number</label>
                                        <Input 
                                            className="h-9" 
                                            value={receiptFilter}
                                            onChange={e => setReceiptFilter(e.target.value)}
                                            placeholder="Enter Receipt Number"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center gap-3 mt-8">
                                <Button className="bg-slate-800 hover:bg-slate-900 w-32" onClick={handleSearch}>
                                    <Search className="w-4 h-4 mr-2" /> Load
                                </Button>
                                <Button variant="outline" className="w-32 bg-slate-100 hover:bg-slate-200 border-slate-300" onClick={handleClear}>
                                    <RefreshCw className="w-4 h-4 mr-2" /> Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                <div className="flex-1 p-6 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider border-l-2 border-slate-500 pl-2">
                            Receipt Information
                        </div>
                        <div className="flex gap-2">
                             <Button variant="outline" size="sm" className="h-8 gap-2 text-green-700 bg-green-50 border-green-200 hover:bg-green-100" onClick={() => handleExport('EXCEL')}>
                                <FileDown className="w-4 h-4" /> Excel
                             </Button>
                             <Button variant="outline" size="sm" className="h-8 gap-2 text-red-700 bg-red-50 border-red-200 hover:bg-red-100" onClick={() => handleExport('PDF')}>
                                <FileDown className="w-4 h-4" /> PDF
                             </Button>
                        </div>
                    </div>

                    <div className="flex-1 border rounded-md bg-white shadow-sm overflow-auto">
                        <Table>
                            <TableHeader className="bg-slate-100 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[50px] font-bold text-slate-700">No</TableHead>
                                    <TableHead className="min-w-[120px] font-bold text-slate-700">Account ID</TableHead>
                                    <TableHead className="min-w-[140px] font-bold text-slate-700">Receipt No</TableHead>
                                    <TableHead className="min-w-[100px] font-bold text-slate-700">Payment Type</TableHead>
                                    <TableHead className="min-w-[150px] font-bold text-slate-700">Payment Option</TableHead>
                                    <TableHead className="min-w-[140px] font-bold text-slate-700">Date/Time</TableHead>
                                    <TableHead className="min-w-[80px] font-bold text-slate-700">Staged</TableHead>
                                    <TableHead className="min-w-[100px] text-right font-bold text-slate-700">Amount</TableHead>
                                    <TableHead className="min-w-[100px] text-right font-bold text-slate-700">Tender</TableHead>
                                    <TableHead className="min-w-[100px] text-right font-bold text-slate-700">Change</TableHead>
                                    <TableHead className="min-w-[150px] font-bold text-slate-700">Cashier</TableHead>
                                    <TableHead className="min-w-[200px] font-bold text-slate-700">Cash Book</TableHead>
                                    <TableHead className="min-w-[150px] font-bold text-slate-700">Cashier Office</TableHead>
                                    <TableHead className="min-w-[100px] font-bold text-slate-700 sticky right-0 bg-slate-100">Action</TableHead>
                                    <TableHead className="min-w-[120px] font-bold text-slate-700 sticky right-0 bg-slate-100">Status</TableHead>
                                    <TableHead className="min-w-[200px] font-bold text-slate-700">Cancellation Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReceipts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={16} className="h-24 text-center text-muted-foreground">
                                            No receipts found matching criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredReceipts.map((receipt, idx) => (
                                        <TableRow key={receipt.id} className={receipt.status === 'CANCELLED' ? 'bg-red-50/50' : ''}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell className="font-mono text-xs">{receipt.accountId}</TableCell>
                                            <TableCell className="font-mono text-xs font-medium text-blue-700">{receipt.receiptNo}</TableCell>
                                            <TableCell>{receipt.paymentType}</TableCell>
                                            <TableCell className="text-xs">{receipt.paymentOption}</TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {format(new Date(receipt.receiptDate), 'dd/MM/yyyy HH:mm')}
                                            </TableCell>
                                            <TableCell>{receipt.staged ? 'Yes' : 'No'}</TableCell>
                                            <TableCell className="text-right font-mono font-medium">
                                                {receipt.amount.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                {receipt.tenderAmount.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                {receipt.changeAmount.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-xs">{receipt.cashierName}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={receipt.cashBook}>
                                                {receipt.cashBook}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {receipt.cashierOffice}
                                            </TableCell>
                                            <TableCell className="sticky right-0 bg-white shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-medium px-3 shadow-sm" onClick={() => triggerPrint(receipt)}>
                                                    <Printer className="w-3.5 h-3.5 mr-2" /> Print
                                                </Button>
                                            </TableCell>
                                            <TableCell className="sticky right-0 bg-white shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                {receipt.status === 'CANCELLED' ? (
                                                    <Badge variant="destructive" className="rounded-sm px-1 py-0 text-[10px]">Cancelled</Badge>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs italic text-red-600">
                                                {receipt.cancellationReason}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Hidden Receipt for Printing */}
                <div style={{ display: 'none' }}>
                    {selectedReceipt && templateData && (
                        <ReceiptTemplate 
                            ref={receiptRef} 
                            transaction={templateData.transaction} 
                            allocation={templateData.allocation} 
                            isReprint={true}
                        />
                    )}
                </div>
            </div>
        </PosLayout>
    );
}
