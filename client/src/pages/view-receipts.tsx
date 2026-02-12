import React, { useState, useRef } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Search, Printer, FileDown, RefreshCw, Loader2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { ReceiptTemplate } from '@/components/pos/receipt-template';
import { useReactToPrint } from 'react-to-print';
import { BankTransaction, AllocationDraft } from '@/lib/direct-deposits-data';
import { cn } from '@/lib/utils';
import { listTransactionsApi, fetchBillingStageCashierReceiptDetails } from '@/lib/external-api';
import { useToast } from '@/hooks/use-toast';
import { usePos } from '@/lib/pos-state';

interface ReceiptRow {
    id: string;
    receiptNo: string;
    accountId: string;
    paymentType: string;
    paymentOption: string;
    receiptDate: string;
    staged: boolean;
    amount: number;
    tenderAmount: number;
    changeAmount: number;
    cashierName: string;
    cashBook: string;
    cashierOffice: string;
    status: string;
    cancellationReason?: string;
    billingDetails?: any[];
}

export default function ViewReceipts() {
    const { referenceData } = usePos();
    const cashiers = referenceData.cashiers || [];

    const [cashierFilter, setCashierFilter] = useState("ALL");
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date(2023, 0, 1));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [accountFilter, setAccountFilter] = useState("");
    const [receiptFilter, setReceiptFilter] = useState("");

    const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
    const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRow | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            const filters: any = {};
            if (cashierFilter && cashierFilter !== "ALL") {
                const matchedCashier = cashiers.find(c => c.name === cashierFilter);
                if (matchedCashier) filters.cashierId = matchedCashier.id;
            }
            if (fromDate) filters.fromDate = fromDate.toISOString();
            if (toDate) {
                const endOfDay = new Date(toDate);
                endOfDay.setHours(23, 59, 59, 999);
                filters.toDate = endOfDay.toISOString();
            }

            const transactions = await listTransactionsApi(filters);

            let rows: ReceiptRow[] = transactions.map((tx: any) => {
                const items = tx.items || [];
                const firstItem = items[0];
                const accountRef = firstItem?.reference || firstItem?.accountNo || '';

                return {
                    id: tx.id?.toString() || crypto.randomUUID(),
                    receiptNo: tx.receiptNumber || '',
                    accountId: accountRef,
                    paymentType: tx.paymentType || 'Cash',
                    paymentOption: firstItem?.type === 'CONSUMER_SERVICES' ? 'Consumer Services'
                        : firstItem?.type === 'PREPAID' ? 'Prepaid Recharge'
                        : firstItem?.type === 'DIRECT_INCOME' ? 'Direct Income'
                        : firstItem?.type === 'CLEARANCE' ? 'Clearance'
                        : firstItem?.description || 'Payment',
                    receiptDate: tx.createdAt || new Date().toISOString(),
                    staged: false,
                    amount: parseFloat(tx.totalAmount) || 0,
                    tenderAmount: parseFloat(tx.tenderAmount) || 0,
                    changeAmount: parseFloat(tx.changeAmount) || 0,
                    cashierName: tx.cashierName || 'Unknown',
                    cashBook: '',
                    cashierOffice: tx.cashOfficeId || '',
                    status: tx.status || 'COMPLETED',
                    cancellationReason: tx.cancellationReason || undefined,
                };
            });

            if (accountFilter) {
                rows = rows.filter(r => r.accountId.toLowerCase().includes(accountFilter.toLowerCase()));
            }
            if (receiptFilter) {
                rows = rows.filter(r => r.receiptNo.toLowerCase().includes(receiptFilter.toLowerCase()));
            }

            rows.sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime());

            for (const row of rows) {
                if (row.receiptNo) {
                    try {
                        const details = await fetchBillingStageCashierReceiptDetails(row.receiptNo);
                        if (details && details.length > 0) {
                            row.billingDetails = details;
                            row.staged = true;
                            const totalBillingAmount = details.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
                            if (totalBillingAmount > 0) {
                                row.amount = totalBillingAmount;
                            }
                        }
                    } catch (e) {
                        // API detail fetch failed silently, continue with DB data
                    }
                }
            }

            setReceipts(rows);

            if (rows.length === 0) {
                toast({
                    title: "No Results",
                    description: "No receipts found matching your criteria.",
                });
            }
        } catch (error) {
            console.error("Failed to load receipts", error);
            toast({
                title: "Error",
                description: "Failed to load receipt data. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setCashierFilter("ALL");
        setFromDate(new Date(2023, 0, 1));
        setToDate(new Date());
        setAccountFilter("");
        setReceiptFilter("");
        setReceipts([]);
    };

    const handlePrint = useReactToPrint({
        contentRef: receiptRef,
        documentTitle: `Receipt-${selectedReceipt?.receiptNo || 'Copy'}`,
    });

    const triggerPrint = (receipt: ReceiptRow) => {
        setSelectedReceipt(receipt);
        setTimeout(() => {
            handlePrint();
        }, 100);
    };

    const handleExport = (type: 'PDF' | 'EXCEL') => {
        alert(`Exporting to ${type} is not implemented yet, but would generate a file for ${receipts.length} receipts.`);
    };

    const mapReceiptToTemplateData = (receipt: ReceiptRow) => {
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
                <div className="bg-white border-b shadow-sm">
                    <div className="px-6 py-4 border-b">
                        <h1 className="text-xl font-bold text-slate-800" data-testid="text-page-title">View Receipts</h1>
                    </div>

                    <div className="p-6 bg-slate-50/50">
                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-l-2 border-blue-500 pl-2">
                                View Receipt Information
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">Cashier Name <span className="text-red-500">*</span></label>
                                        <Select value={cashierFilter} onValueChange={setCashierFilter}>
                                            <SelectTrigger className="h-9" data-testid="select-cashier-filter">
                                                <SelectValue placeholder="-- All --" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">-- All --</SelectItem>
                                                {cashiers.map(c => (
                                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">From Date <span className="text-red-500">*</span></label>
                                        <DatePicker
                                            date={fromDate}
                                            setDate={setFromDate}
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">Account Number</label>
                                        <Input
                                            className="h-9"
                                            value={accountFilter}
                                            onChange={e => setAccountFilter(e.target.value)}
                                            placeholder="e.g. 000000059905"
                                            data-testid="input-account-filter"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="hidden md:block h-9"></div>

                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">To Date <span className="text-red-500">*</span></label>
                                        <DatePicker
                                            date={toDate}
                                            setDate={setToDate}
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <label className="text-sm font-medium text-right text-slate-600">Receipt Number</label>
                                        <Input
                                            className="h-9"
                                            value={receiptFilter}
                                            onChange={e => setReceiptFilter(e.target.value)}
                                            placeholder="Enter Receipt Number"
                                            data-testid="input-receipt-filter"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center gap-3 mt-8">
                                <Button className="bg-slate-800 hover:bg-slate-900 w-32" onClick={handleSearch} disabled={isLoading} data-testid="button-load">
                                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} Load
                                </Button>
                                <Button variant="outline" className="w-32 bg-slate-100 hover:bg-slate-200 border-slate-300" onClick={handleClear} data-testid="button-cancel">
                                    <RefreshCw className="w-4 h-4 mr-2" /> Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider border-l-2 border-slate-500 pl-2">
                            Receipt Information
                        </div>
                        <div className="flex gap-2">
                             <Button variant="outline" size="sm" className="h-8 gap-2 text-green-700 bg-green-50 border-green-200 hover:bg-green-100" onClick={() => handleExport('EXCEL')} data-testid="button-export-excel">
                                <FileDown className="w-4 h-4" /> Excel
                             </Button>
                             <Button variant="outline" size="sm" className="h-8 gap-2 text-red-700 bg-red-50 border-red-200 hover:bg-red-100" onClick={() => handleExport('PDF')} data-testid="button-export-pdf">
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
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={16} className="h-24 text-center text-muted-foreground">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Loading receipts...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : receipts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={16} className="h-24 text-center text-muted-foreground">
                                            No receipts found. Use the filters above and click Load.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    receipts.map((receipt, idx) => (
                                        <TableRow key={receipt.id} className={receipt.status === 'CANCELLED' ? 'bg-red-50/50' : ''} data-testid={`row-receipt-${idx}`}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell className="font-mono text-xs">{receipt.accountId}</TableCell>
                                            <TableCell className="font-mono text-xs font-medium text-blue-700">{receipt.receiptNo}</TableCell>
                                            <TableCell>{receipt.paymentType}</TableCell>
                                            <TableCell className="text-xs">{receipt.paymentOption}</TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {receipt.receiptDate ? format(new Date(receipt.receiptDate), 'dd/MM/yyyy HH:mm') : '-'}
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
                                                {receipt.cashBook || '-'}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {receipt.cashierOffice || '-'}
                                            </TableCell>
                                            <TableCell className="sticky right-0 bg-white shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-medium px-3 shadow-sm" onClick={() => triggerPrint(receipt)} data-testid={`button-print-${idx}`}>
                                                    <Printer className="w-3.5 h-3.5 mr-2" /> Print
                                                </Button>
                                            </TableCell>
                                            <TableCell className="sticky right-0 bg-white shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                {receipt.status === 'CANCELLED' ? (
                                                    <Badge variant="destructive" className="rounded-sm px-1 py-0 text-[10px]">Cancelled</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="rounded-sm px-1 py-0 text-[10px] text-green-700 border-green-300 bg-green-50">Completed</Badge>
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

                <div style={{ display: 'none' }}>
                    {selectedReceipt && templateData && (
                        <ReceiptTemplate
                            ref={receiptRef}
                            transaction={templateData.transaction}
                            allocation={templateData.allocation}
                            isReprint={true}
                            isCancelled={selectedReceipt.status === 'CANCELLED'}
                        />
                    )}
                </div>
            </div>
        </PosLayout>
    );
}
