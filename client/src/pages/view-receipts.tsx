import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Search, Printer, FileDown, RefreshCw, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { useReactToPrint } from 'react-to-print';
import { cn } from '@/lib/utils';
import {
    fetchViewReceiptCashiers,
    searchAccountNumbers,
    searchReceiptNumbers,
    fetchReceiptList,
    searchSebataReceipts,
    ViewReceiptCashier,
    ViewReceiptItem,
    ReceiptSearchQuery,
    platinumPrintReceiptRaw,
} from '@/lib/external-api';
import { useToast } from '@/hooks/use-toast';
import { usePos } from '@/lib/pos-state';

export default function ViewReceipts() {
    const { toast } = useToast();

    const [cashiers, setCashiers] = useState<ViewReceiptCashier[]>([]);
    const { platinumCashierId } = usePos();
    const [cashierFilter, setCashierFilter] = useState("");
    const [fromDate, setFromDate] = useState<Date | undefined>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1);
    });
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [accountFilter, setAccountFilter] = useState("");
    const [receiptFilter, setReceiptFilter] = useState("");

    const [accountSuggestions, setAccountSuggestions] = useState<string[]>([]);
    const [receiptSuggestions, setReceiptSuggestions] = useState<string[]>([]);
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const [showReceiptDropdown, setShowReceiptDropdown] = useState(false);
    const accountInputRef = useRef<HTMLInputElement>(null);
    const receiptInputRef = useRef<HTMLInputElement>(null);

    const [receipts, setReceipts] = useState<ViewReceiptItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingCashiers, setLoadingCashiers] = useState(false);

    const [selectedReceipt, setSelectedReceipt] = useState<ViewReceiptItem | null>(null);
    const [printingReceiptId, setPrintingReceiptId] = useState<string | number | null>(null);
    const [dataSource, setDataSource] = useState<'none' | 'platinum' | 'sebata'>('none');

    useEffect(() => {
        const loadCashiers = async () => {
            setLoadingCashiers(true);
            try {
                const data = await fetchViewReceiptCashiers();
                setCashiers(data);
                if (!cashierFilter) {
                    setCashierFilter('0');
                }
            } catch (e) {
                console.warn('Failed to load cashiers', e);
            } finally {
                setLoadingCashiers(false);
            }
        };
        loadCashiers();
    }, []);

    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const handleAccountSearch = useCallback((value: string) => {
        setAccountFilter(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (value.length >= 3) {
            debounceRef.current = setTimeout(async () => {
                const results = await searchAccountNumbers(value);
                setAccountSuggestions(results);
                setShowAccountDropdown(results.length > 0);
            }, 300);
        } else {
            setAccountSuggestions([]);
            setShowAccountDropdown(false);
        }
    }, []);

    const receiptDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const handleReceiptSearch = useCallback((value: string) => {
        setReceiptFilter(value);
        if (receiptDebounceRef.current) clearTimeout(receiptDebounceRef.current);
        if (value.length >= 3) {
            receiptDebounceRef.current = setTimeout(async () => {
                const results = await searchReceiptNumbers(value);
                setReceiptSuggestions(results);
                setShowReceiptDropdown(results.length > 0);
            }, 300);
        } else {
            setReceiptSuggestions([]);
            setShowReceiptDropdown(false);
        }
    }, []);

    const handleSearch = async (page: number = 1) => {
        if (!cashierFilter && !accountFilter && !receiptFilter) {
            toast({
                title: "Filter Required",
                description: "Please select a cashier, or enter an account number or receipt number.",
                variant: "destructive",
            });
            return;
        }
        const hasSpecificFilter = !!accountFilter || !!receiptFilter;
        if ((!cashierFilter || cashierFilter === '0') && !hasSpecificFilter) {
            const from = fromDate || new Date();
            const to = toDate || new Date();
            const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 7) {
                toast({
                    title: "Date Range Too Wide",
                    description: "When searching all cashiers without an account or receipt number, please use a date range of 7 days or less.",
                    variant: "destructive",
                });
                return;
            }
        }
        const effectiveFromDate = fromDate || new Date();
        setIsLoading(true);
        try {
            const query: ReceiptSearchQuery = {
                fromDate: format(effectiveFromDate, "yyyy-MM-dd'T'00:00:00"),
                toDate: toDate ? format(toDate, "yyyy-MM-dd'T'23:59:59") : undefined,
                page,
                pageSize,
                orderby: 'receiptDate',
                shortDirection: 'desc',
                cashierId: cashierFilter || '0',
            };
            if (accountFilter) {
                query.accountNumber = accountFilter;
            }
            if (receiptFilter) {
                query.receiptNo = receiptFilter;
            }

            console.log('[ViewReceipts] Searching with query:', query);
            const result = await fetchReceiptList(query);
            const platinumFailed = (result as any)._platinumError === true;
            console.log('[ViewReceipts] Platinum result:', result.items.length, 'items, platinumFailed:', platinumFailed);

            if (result.items.length > 0 && !platinumFailed) {
                setReceipts(result.items);
                setTotalCount(result.totalCount);
                setCurrentPage(page);
                setDataSource('platinum');
            } else {
                console.log('[ViewReceipts] Trying Sebata receipt search...');
                const cashierObj = cashiers.find(c => String(c.id) === cashierFilter);
                const sebataFilters: { receiptNo?: string; cashierName?: string; accountNumber?: string } = {};
                if (receiptFilter) sebataFilters.receiptNo = receiptFilter;
                if (cashierObj) sebataFilters.cashierName = cashierObj.name;
                if (accountFilter) sebataFilters.accountNumber = accountFilter;

                const sebataItems = await searchSebataReceipts(sebataFilters);
                console.log('[ViewReceipts] Sebata result:', sebataItems.length, 'items');

                setReceipts(sebataItems);
                setTotalCount(sebataItems.length);
                setCurrentPage(1);
                setDataSource(sebataItems.length > 0 ? 'sebata' : 'none');

                if (sebataItems.length === 0) {
                    toast({
                        title: "No Results",
                        description: platinumFailed
                            ? "Platinum receipt API is temporarily unavailable. No matching receipts found in Sebata."
                            : "No receipts found matching your criteria.",
                    });
                } else if (platinumFailed) {
                    toast({
                        title: "Using Sebata Data",
                        description: "Platinum receipt API is temporarily unavailable. Showing receipts from Sebata.",
                    });
                }
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
        setCashierFilter("0");
        const now = new Date();
        setFromDate(new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1));
        setToDate(new Date());
        setAccountFilter("");
        setReceiptFilter("");
        setReceipts([]);
        setTotalCount(0);
        setCurrentPage(1);
        setDataSource('none');
    };

    const handlePrintReceipt = async (receipt: ViewReceiptItem) => {
        const serialNo = (receipt as any).serialNo || receipt.receiptId || (receipt as any).id;
        if (!serialNo) {
            toast({
                title: "Print Failed",
                description: "No receipt identifier found.",
                variant: "destructive",
            });
            return;
        }
        setPrintingReceiptId(serialNo);
        try {
            const res = await platinumPrintReceiptRaw([Number(serialNo)]);
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                let errMsg = `HTTP ${res.status}`;
                try {
                    const errJson = JSON.parse(errText);
                    errMsg = errJson.message || errJson.detail || errMsg;
                } catch {
                    if (errText) errMsg = errText.substring(0, 200);
                }
                throw new Error(errMsg);
            }
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/pdf')) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 60000);
                toast({
                    title: "Receipt Ready",
                    description: `Receipt ${receipt.receiptNo || serialNo} opened for printing.`,
                });
            } else {
                toast({
                    title: "Print Sent",
                    description: `Receipt ${receipt.receiptNo || serialNo} sent to print.`,
                });
            }
        } catch (e: any) {
            console.warn('Failed to print receipt', e);
            toast({
                title: "Print Failed",
                description: e?.message || "Could not print the receipt.",
                variant: "destructive",
            });
        } finally {
            setPrintingReceiptId(null);
        }
    };

    const formatReceiptDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            if (dateStr.includes('/')) {
                return dateStr.substring(0, 16);
            }
            const d = new Date(dateStr);
            return d.toLocaleString('en-ZA', {
                timeZone: 'Africa/Johannesburg',
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false,
            });
        } catch {
            return dateStr;
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const getCashierDisplayName = (c: ViewReceiptCashier) => {
        if (c.name) return c.name;
        return `Cashier ${c.id}`;
    };

    return (
        <PosLayout>
            <div className="w-full h-full bg-slate-100 overflow-y-auto">
                <div className="bg-white border-b shadow-sm">
                    <div className="px-3 sm:px-6 py-3 sm:py-4 border-b">
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800" data-testid="text-page-title">View Receipts</h1>
                    </div>

                    <div className="p-3 sm:p-6 bg-slate-50/50">
                        <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 sm:mb-4 border-l-2 border-blue-500 pl-2">
                                View Receipt Information
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 sm:gap-y-6">
                                <div className="space-y-3 sm:space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                                        <label className="text-sm font-medium text-left sm:text-right text-slate-600">Cashier Name</label>
                                        <Select value={cashierFilter} onValueChange={setCashierFilter}>
                                            <SelectTrigger className="h-9" data-testid="select-cashier-filter">
                                                <SelectValue placeholder={loadingCashiers ? "Loading..." : "Select a cashier..."} />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[250px]">
                                                <SelectItem value="0">All Cashiers</SelectItem>
                                                {cashiers.map(c => (
                                                    <SelectItem key={c.id} value={String(c.cashierId || c.id)}>
                                                        {getCashierDisplayName(c)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                                        <label className="text-sm font-medium text-left sm:text-right text-slate-600">From Date <span className="text-red-500">*</span></label>
                                        <DatePicker
                                            date={fromDate}
                                            setDate={setFromDate}
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                                        <label className="text-sm font-medium text-left sm:text-right text-slate-600">Account Number</label>
                                        <div className="relative">
                                            <Input
                                                ref={accountInputRef}
                                                className="h-9"
                                                value={accountFilter}
                                                onChange={e => handleAccountSearch(e.target.value)}
                                                onFocus={() => accountSuggestions.length > 0 && setShowAccountDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowAccountDropdown(false), 200)}
                                                placeholder="Type to search account..."
                                                data-testid="input-account-filter"
                                            />
                                            {accountFilter && (
                                                <button
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                    onClick={() => { setAccountFilter(""); setAccountSuggestions([]); }}
                                                    type="button"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {showAccountDropdown && accountSuggestions.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                                    {accountSuggestions.map((acct, i) => (
                                                        <button
                                                            key={i}
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 font-mono"
                                                            onMouseDown={() => {
                                                                setAccountFilter(String(acct));
                                                                setShowAccountDropdown(false);
                                                            }}
                                                            data-testid={`suggestion-account-${i}`}
                                                        >
                                                            {String(acct)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 sm:space-y-4">
                                    <div className="hidden md:block h-9"></div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                                        <label className="text-sm font-medium text-left sm:text-right text-slate-600">To Date <span className="text-red-500">*</span></label>
                                        <DatePicker
                                            date={toDate}
                                            setDate={setToDate}
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                                        <label className="text-sm font-medium text-left sm:text-right text-slate-600">Receipt Number</label>
                                        <div className="relative">
                                            <Input
                                                ref={receiptInputRef}
                                                className="h-9"
                                                value={receiptFilter}
                                                onChange={e => handleReceiptSearch(e.target.value)}
                                                onFocus={() => receiptSuggestions.length > 0 && setShowReceiptDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowReceiptDropdown(false), 200)}
                                                placeholder="Type to search receipt..."
                                                data-testid="input-receipt-filter"
                                            />
                                            {receiptFilter && (
                                                <button
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                    onClick={() => { setReceiptFilter(""); setReceiptSuggestions([]); }}
                                                    type="button"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {showReceiptDropdown && receiptSuggestions.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                                    {receiptSuggestions.map((rn, i) => (
                                                        <button
                                                            key={i}
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 font-mono"
                                                            onMouseDown={() => {
                                                                setReceiptFilter(String(rn));
                                                                setShowReceiptDropdown(false);
                                                            }}
                                                            data-testid={`suggestion-receipt-${i}`}
                                                        >
                                                            {String(rn)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center gap-3 mt-6 sm:mt-8">
                                <Button className="bg-slate-800 hover:bg-slate-900 w-28 sm:w-32 text-sm" onClick={() => handleSearch(1)} disabled={isLoading} data-testid="button-load">
                                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} Load
                                </Button>
                                <Button variant="outline" className="w-28 sm:w-32 bg-slate-100 hover:bg-slate-200 border-slate-300 text-sm" onClick={handleClear} data-testid="button-cancel">
                                    <RefreshCw className="w-4 h-4 mr-2" /> Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 sm:mb-4">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider border-l-2 border-slate-500 pl-2 flex items-center gap-2">
                            Receipt Information {totalCount > 0 && <span className="text-blue-600">({totalCount} records)</span>}
                            {dataSource === 'platinum' && totalCount > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-300 bg-blue-50 font-normal normal-case" data-testid="badge-source-platinum">Platinum</Badge>
                            )}
                            {dataSource === 'sebata' && totalCount > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300 bg-amber-50 font-normal normal-case" data-testid="badge-source-sebata">Sebata</Badge>
                            )}
                        </div>
                        <div className="flex gap-2 items-center">
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                        disabled={currentPage <= 1 || isLoading}
                                        onClick={() => handleSearch(currentPage - 1)}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <span className="text-xs text-slate-600 px-2">
                                        {currentPage}/{totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                        disabled={currentPage >= totalPages || isLoading}
                                        onClick={() => handleSearch(currentPage + 1)}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile card view for receipts */}
                    <div className="sm:hidden space-y-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Loading receipts...
                            </div>
                        ) : receipts.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                No receipts found. Use the filters above and click Load.
                            </div>
                        ) : receipts.map((receipt, idx) => {
                            const r = receipt as any;
                            const cancelField = r.cancel || '';
                            const isCancelled = receipt.isCancelled === 1 || r.is_cancelled === 1 || r.isCancelled === true || cancelField.toLowerCase().includes('cancel');
                            const acctNo = receipt.accountNumber || r.accountNo || r.accountID || '';
                            const receiptNo = receipt.receiptNo || r.receipt_no || '';
                            const payType = receipt.paymentType || r.payment_type || '';
                            const dateStr = receipt.receiptDate || r.receipt_date || '';
                            const amount = receipt.amount ?? r.receiptAmount ?? 0;
                            const cashier = receipt.cashierName || r.cashier_name || r.cashier || '';
                            return (
                                <Card key={r.serialNo || receipt.receiptId || idx} className={cn("p-3", isCancelled && "border-red-200 bg-red-50/30")} data-testid={`card-receipt-${idx}`}>
                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                        <div className="min-w-0">
                                            <div className="font-mono text-sm font-medium text-blue-700">{receiptNo || '-'}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{acctNo || '-'}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-mono font-bold text-sm">R {Number(amount).toFixed(2)}</div>
                                            {isCancelled ? (
                                                <Badge variant="destructive" className="text-[10px] px-1 py-0">Cancelled</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-700 border-green-300 bg-green-50">Completed</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>{payType} | {formatReceiptDate(dateStr)}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 text-[10px] px-2"
                                            onClick={() => handlePrintReceipt(receipt)}
                                            disabled={printingReceiptId !== null}
                                        >
                                            {printingReceiptId === ((receipt as any).serialNo || receipt.receiptId || (receipt as any).id) ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Printer className="w-3 h-3 mr-1" />} Print
                                        </Button>
                                    </div>
                                    {cashier && <div className="text-[10px] text-muted-foreground mt-1">Cashier: {cashier}</div>}
                                </Card>
                            );
                        })}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden sm:block flex-1 border rounded-md bg-white shadow-sm overflow-auto">
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
                                    <TableHead className="min-w-[100px] font-bold text-slate-700 sticky right-[120px] bg-slate-100">Action</TableHead>
                                    <TableHead className="min-w-[120px] font-bold text-slate-700 sticky right-0 bg-slate-100">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={15} className="h-24 text-center text-muted-foreground">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Loading receipts from billing system...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : receipts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={15} className="h-24 text-center text-muted-foreground">
                                            No receipts found. Use the filters above and click Load.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    receipts.map((receipt, idx) => {
                                        const r = receipt as any;
                                        const cancelField = r.cancel || '';
                                        const isCancelled = receipt.isCancelled === 1 || r.is_cancelled === 1 || r.isCancelled === true || cancelField.toLowerCase().includes('cancel');
                                        const acctNo = receipt.accountNumber || r.accountNo || r.accountID || r.account_number || '';
                                        const receiptNo = receipt.receiptNo || r.receipt_no || '';
                                        const payType = receipt.paymentType || r.payment_type || r.payMode || '';
                                        const payOption = receipt.paymentOption || r.payment_option || r.billType || '';
                                        const dateStr = receipt.receiptDate || r.receipt_date || '';
                                        const staged = receipt.isStaged ?? r.is_staged ?? r.staged ?? false;
                                        const stagedStr = typeof staged === 'string' ? staged : (staged ? 'Yes' : 'No');
                                        const amount = receipt.amount ?? r.receiptAmount ?? 0;
                                        const tender = receipt.tenderAmount ?? r.tender_amount ?? 0;
                                        const change = receipt.changeAmount ?? r.change_amount ?? 0;
                                        const cashier = receipt.cashierName || r.cashier_name || r.cashier || '';
                                        const cashBook = receipt.cashBook || r.cash_book || r.cashOfficeName || r.cashBook || '';
                                        const cashOffice = receipt.cashOffice || r.cash_office || r.cashOfficeName || r.cashierOffice || '';
                                        const cancelReason = receipt.cancellationReason || r.cancellation_reason || r.reasonForCancel || '';

                                        return (
                                            <TableRow
                                                key={r.serialNo || receipt.receiptId || idx}
                                                className={cn(
                                                    isCancelled && 'bg-red-50/50',
                                                    'hover:bg-slate-50 cursor-pointer'
                                                )}
                                                data-testid={`row-receipt-${idx}`}
                                            >
                                                <TableCell className="text-xs">{(currentPage - 1) * pageSize + idx + 1}</TableCell>
                                                <TableCell className="font-mono text-xs">{acctNo}</TableCell>
                                                <TableCell className="font-mono text-xs font-medium text-blue-700">{receiptNo}</TableCell>
                                                <TableCell className="text-xs">{payType}</TableCell>
                                                <TableCell className="text-xs">{payOption}</TableCell>
                                                <TableCell className="text-xs whitespace-nowrap">{formatReceiptDate(dateStr)}</TableCell>
                                                <TableCell className="text-xs">
                                                    {(stagedStr === 'Yes' || staged === true) ? (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-700 border-green-300 bg-green-50">Yes</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">{stagedStr || 'No'}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-medium text-xs">
                                                    {Number(amount).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                    {Number(tender).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                    {Number(change).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-xs">{cashier}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={cashBook}>
                                                    {cashBook || '-'}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {cashOffice || '-'}
                                                </TableCell>
                                                <TableCell className="sticky right-[120px] bg-white shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-medium px-3 shadow-sm"
                                                        onClick={(e) => { e.stopPropagation(); handlePrintReceipt(receipt); }}
                                                        disabled={printingReceiptId !== null}
                                                        data-testid={`button-print-${idx}`}
                                                    >
                                                        {printingReceiptId === ((receipt as any).serialNo || receipt.receiptId || (receipt as any).id) ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1" />}
                                                        Print
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="sticky right-0 bg-white shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                    {isCancelled ? (
                                                        <div>
                                                            <Badge variant="destructive" className="rounded-sm px-1.5 py-0.5 text-[10px]">Cancelled</Badge>
                                                            {cancelReason && (
                                                                <div className="text-[9px] text-red-500 italic mt-0.5 max-w-[150px] truncate" title={cancelReason}>
                                                                    {cancelReason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="rounded-sm px-1.5 py-0.5 text-[10px] text-green-700 border-green-300 bg-green-50">{cancelField || 'Active'}</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalCount > 0 && (
                        <div className="hidden sm:flex justify-between items-center mt-3 text-xs text-slate-500">
                            <span>
                                Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} receipts
                            </span>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        disabled={currentPage <= 1 || isLoading}
                                        onClick={() => handleSearch(currentPage - 1)}
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
                                    </Button>
                                    <span className="px-3">Page {currentPage} of {totalPages}</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        disabled={currentPage >= totalPages || isLoading}
                                        onClick={() => handleSearch(currentPage + 1)}
                                    >
                                        Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </PosLayout>
    );
}
