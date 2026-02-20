import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Search, Printer, Loader2, X, ChevronLeft, ChevronRight, Filter, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
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

type SortField = 'receiptNo' | 'accountNumber' | 'amount' | 'receiptDate' | 'cashierName' | 'paymentType' | 'paymentOption';
type SortDir = 'asc' | 'desc';

function getReceiptField(receipt: ViewReceiptItem, field: string): any {
    const r = receipt as any;
    switch (field) {
        case 'accountNumber': return receipt.accountNumber || r.accountNo || r.accountID || r.account_number || '';
        case 'receiptNo': return receipt.receiptNo || r.receipt_no || '';
        case 'paymentType': return receipt.paymentType || r.payment_type || r.payMode || '';
        case 'paymentOption': return receipt.paymentOption || r.payment_option || r.billType || '';
        case 'receiptDate': return receipt.receiptDate || r.receipt_date || '';
        case 'amount': return receipt.amount ?? r.receiptAmount ?? 0;
        case 'tenderAmount': return receipt.tenderAmount ?? r.tender_amount ?? 0;
        case 'changeAmount': return receipt.changeAmount ?? r.change_amount ?? 0;
        case 'cashierName': return receipt.cashierName || r.cashier_name || r.cashier || '';
        case 'cashBook': return receipt.cashBook || r.cash_book || r.cashOfficeName || r.cashBook || '';
        case 'cashOffice': return receipt.cashOffice || r.cash_office || r.cashOfficeName || r.cashierOffice || '';
        case 'staged': {
            const s = receipt.isStaged ?? r.is_staged ?? r.staged ?? false;
            return typeof s === 'string' ? s : (s ? 'Yes' : 'No');
        }
        case 'isCancelled': {
            const cancelField = r.cancel || '';
            return receipt.isCancelled === 1 || r.is_cancelled === 1 || r.isCancelled === true || cancelField.toLowerCase().includes('cancel');
        }
        case 'cancelField': return r.cancel || '';
        case 'cancellationReason': return receipt.cancellationReason || r.cancellation_reason || r.reasonForCancel || '';
        case 'serialNo': return r.serialNo || receipt.receiptId || r.id || '';
        default: return '';
    }
}

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

    const [quickSearch, setQuickSearch] = useState('');
    const [filterPaymentType, setFilterPaymentType] = useState('__all__');
    const [filterPaymentOption, setFilterPaymentOption] = useState('__all__');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'cancelled'>('all');
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [showFilters, setShowFilters] = useState(false);

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
        setQuickSearch('');
        setFilterPaymentType('__all__');
        setFilterPaymentOption('__all__');
        setFilterStatus('all');
        setSortField(null);
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
        setQuickSearch('');
        setFilterPaymentType('__all__');
        setFilterPaymentOption('__all__');
        setFilterStatus('all');
        setSortField(null);
    };

    const handlePrintReceipt = async (receipt: ViewReceiptItem) => {
        const serialNo = getReceiptField(receipt, 'serialNo');
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
                    description: `Receipt ${getReceiptField(receipt, 'receiptNo') || serialNo} opened for printing.`,
                });
            } else {
                toast({
                    title: "Print Sent",
                    description: `Receipt ${getReceiptField(receipt, 'receiptNo') || serialNo} sent to print.`,
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

    const uniquePaymentTypes = useMemo(() => {
        const set = new Set<string>();
        receipts.forEach(r => {
            const v = getReceiptField(r, 'paymentType');
            if (v) set.add(v);
        });
        return Array.from(set).sort();
    }, [receipts]);

    const uniquePaymentOptions = useMemo(() => {
        const set = new Set<string>();
        receipts.forEach(r => {
            const v = getReceiptField(r, 'paymentOption');
            if (v) set.add(v);
        });
        return Array.from(set).sort();
    }, [receipts]);

    const filteredReceipts = useMemo(() => {
        let result = receipts;

        if (filterPaymentType !== '__all__') {
            result = result.filter(r => getReceiptField(r, 'paymentType') === filterPaymentType);
        }
        if (filterPaymentOption !== '__all__') {
            result = result.filter(r => getReceiptField(r, 'paymentOption') === filterPaymentOption);
        }
        if (filterStatus !== 'all') {
            result = result.filter(r => {
                const cancelled = getReceiptField(r, 'isCancelled');
                return filterStatus === 'cancelled' ? cancelled : !cancelled;
            });
        }
        if (quickSearch.trim()) {
            const q = quickSearch.trim().toLowerCase();
            result = result.filter(r => {
                const searchable = [
                    getReceiptField(r, 'accountNumber'),
                    getReceiptField(r, 'receiptNo'),
                    getReceiptField(r, 'paymentType'),
                    getReceiptField(r, 'paymentOption'),
                    getReceiptField(r, 'cashierName'),
                    getReceiptField(r, 'cashBook'),
                    String(getReceiptField(r, 'amount')),
                ].join(' ').toLowerCase();
                return searchable.includes(q);
            });
        }

        if (sortField) {
            result = [...result].sort((a, b) => {
                let va = getReceiptField(a, sortField);
                let vb = getReceiptField(b, sortField);
                if (sortField === 'amount') {
                    va = Number(va) || 0;
                    vb = Number(vb) || 0;
                    return sortDir === 'asc' ? va - vb : vb - va;
                }
                if (sortField === 'receiptDate') {
                    const da = new Date(va).getTime() || 0;
                    const db = new Date(vb).getTime() || 0;
                    return sortDir === 'asc' ? da - db : db - da;
                }
                const sa = String(va).toLowerCase();
                const sb = String(vb).toLowerCase();
                const cmp = sa.localeCompare(sb);
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [receipts, filterPaymentType, filterPaymentOption, filterStatus, quickSearch, sortField, sortDir]);

    const activeFilterCount = [
        filterPaymentType !== '__all__',
        filterPaymentOption !== '__all__',
        filterStatus !== 'all',
        quickSearch.trim().length > 0,
    ].filter(Boolean).length;

    const clearAllFilters = () => {
        setQuickSearch('');
        setFilterPaymentType('__all__');
        setFilterPaymentOption('__all__');
        setFilterStatus('all');
        setSortField(null);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDir === 'desc') setSortDir('asc');
            else { setSortField(null); setSortDir('desc'); }
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
        return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" /> : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
    };

    const filteredTotal = useMemo(() => {
        return filteredReceipts.reduce((sum, r) => sum + (Number(getReceiptField(r, 'amount')) || 0), 0);
    }, [filteredReceipts]);

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
                                    <X className="w-4 h-4 mr-2" /> Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
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

                    {receipts.length > 0 && (
                        <div className="bg-white border rounded-lg shadow-sm mb-3 overflow-hidden" data-testid="filter-toolbar">
                            <div className="flex items-center gap-2 p-2 sm:p-3 border-b bg-slate-50/80">
                                <div className="relative flex-1 max-w-xs">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <Input
                                        className="h-8 pl-8 text-sm bg-white"
                                        placeholder="Quick search in results..."
                                        value={quickSearch}
                                        onChange={e => setQuickSearch(e.target.value)}
                                        data-testid="input-quick-search"
                                    />
                                    {quickSearch && (
                                        <button
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            onClick={() => setQuickSearch('')}
                                            type="button"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                <Button
                                    variant={showFilters ? "default" : "outline"}
                                    size="sm"
                                    className={cn("h-8 text-xs gap-1.5", showFilters && "bg-blue-600 hover:bg-blue-700")}
                                    onClick={() => setShowFilters(!showFilters)}
                                    data-testid="button-toggle-filters"
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Filters</span>
                                    {activeFilterCount > 0 && (
                                        <span className={cn(
                                            "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                                            showFilters ? "bg-white text-blue-600" : "bg-blue-600 text-white"
                                        )}>
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </Button>

                                {activeFilterCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                                        onClick={clearAllFilters}
                                        data-testid="button-clear-filters"
                                    >
                                        <X className="w-3 h-3 mr-1" /> Clear
                                    </Button>
                                )}

                                <div className="hidden sm:flex items-center gap-3 ml-auto text-xs text-slate-500">
                                    {activeFilterCount > 0 && filteredReceipts.length !== receipts.length && (
                                        <span className="font-medium text-blue-600">{filteredReceipts.length} of {receipts.length} shown</span>
                                    )}
                                    <span className="font-mono font-medium text-slate-700">
                                        Total: R {filteredTotal.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {showFilters && (
                                <div className="p-2 sm:p-3 bg-blue-50/30 border-b">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                                        <div>
                                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Payment Type</label>
                                            <Select value={filterPaymentType} onValueChange={setFilterPaymentType}>
                                                <SelectTrigger className="h-8 text-xs bg-white" data-testid="select-filter-payment-type">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">All Types</SelectItem>
                                                    {uniquePaymentTypes.map(t => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Payment Option</label>
                                            <Select value={filterPaymentOption} onValueChange={setFilterPaymentOption}>
                                                <SelectTrigger className="h-8 text-xs bg-white" data-testid="select-filter-payment-option">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">All Options</SelectItem>
                                                    {uniquePaymentOptions.map(t => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
                                            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                                                <SelectTrigger className="h-8 text-xs bg-white" data-testid="select-filter-status">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Statuses</SelectItem>
                                                    <SelectItem value="active">Active Only</SelectItem>
                                                    <SelectItem value="cancelled">Cancelled Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeFilterCount > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-slate-50/50 border-b">
                                    <span className="text-[10px] text-slate-400 uppercase font-medium mr-1">Active:</span>
                                    {quickSearch.trim() && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 cursor-pointer" onClick={() => setQuickSearch('')}>
                                            Search: "{quickSearch}" <X className="w-2.5 h-2.5" />
                                        </Badge>
                                    )}
                                    {filterPaymentType !== '__all__' && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-200 cursor-pointer" onClick={() => setFilterPaymentType('__all__')}>
                                            Type: {filterPaymentType} <X className="w-2.5 h-2.5" />
                                        </Badge>
                                    )}
                                    {filterPaymentOption !== '__all__' && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 cursor-pointer" onClick={() => setFilterPaymentOption('__all__')}>
                                            Option: {filterPaymentOption} <X className="w-2.5 h-2.5" />
                                        </Badge>
                                    )}
                                    {filterStatus !== 'all' && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 cursor-pointer" onClick={() => setFilterStatus('all')}>
                                            Status: {filterStatus} <X className="w-2.5 h-2.5" />
                                        </Badge>
                                    )}
                                </div>
                            )}

                            <div className="flex sm:hidden items-center justify-between px-2 py-1.5 bg-slate-50/50 border-b text-xs text-slate-500">
                                {activeFilterCount > 0 && filteredReceipts.length !== receipts.length && (
                                    <span className="font-medium text-blue-600">{filteredReceipts.length} of {receipts.length} shown</span>
                                )}
                                <span className="font-mono font-medium text-slate-700 ml-auto">
                                    Total: R {filteredTotal.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Mobile card view for receipts */}
                    <div className="sm:hidden space-y-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Loading receipts...
                            </div>
                        ) : filteredReceipts.length === 0 && receipts.length > 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                No receipts match the current filters. Try adjusting your filters.
                            </div>
                        ) : filteredReceipts.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                No receipts found. Use the filters above and click Load.
                            </div>
                        ) : filteredReceipts.map((receipt, idx) => {
                            const isCancelled = getReceiptField(receipt, 'isCancelled');
                            const acctNo = getReceiptField(receipt, 'accountNumber');
                            const receiptNo = getReceiptField(receipt, 'receiptNo');
                            const payType = getReceiptField(receipt, 'paymentType');
                            const payOption = getReceiptField(receipt, 'paymentOption');
                            const dateStr = getReceiptField(receipt, 'receiptDate');
                            const amount = getReceiptField(receipt, 'amount');
                            const cashier = getReceiptField(receipt, 'cashierName');
                            const serialNo = getReceiptField(receipt, 'serialNo');
                            return (
                                <Card key={serialNo || idx} className={cn("p-3", isCancelled && "border-red-200 bg-red-50/30")} data-testid={`card-receipt-${idx}`}>
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
                                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-700 border-green-300 bg-green-50">Active</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-1.5">
                                        {payType && <Badge variant="outline" className="text-[9px] px-1 py-0 text-slate-600 border-slate-200 bg-slate-50">{payType}</Badge>}
                                        {payOption && <Badge variant="outline" className="text-[9px] px-1 py-0 text-violet-600 border-violet-200 bg-violet-50">{payOption}</Badge>}
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>{formatReceiptDate(dateStr)}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 text-[10px] px-2"
                                            onClick={() => handlePrintReceipt(receipt)}
                                            disabled={printingReceiptId !== null}
                                        >
                                            {printingReceiptId === serialNo ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Printer className="w-3 h-3 mr-1" />} Print
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
                                    <TableHead className="min-w-[120px] font-bold text-slate-700 cursor-pointer select-none hover:text-blue-700" onClick={() => handleSort('accountNumber')}>
                                        <span className="inline-flex items-center">Account ID <SortIcon field="accountNumber" /></span>
                                    </TableHead>
                                    <TableHead className="min-w-[140px] font-bold text-slate-700 cursor-pointer select-none hover:text-blue-700" onClick={() => handleSort('receiptNo')}>
                                        <span className="inline-flex items-center">Receipt No <SortIcon field="receiptNo" /></span>
                                    </TableHead>
                                    <TableHead className="min-w-[100px] font-bold text-slate-700 cursor-pointer select-none hover:text-blue-700" onClick={() => handleSort('paymentType')}>
                                        <span className="inline-flex items-center">Payment Type <SortIcon field="paymentType" /></span>
                                    </TableHead>
                                    <TableHead className="min-w-[150px] font-bold text-slate-700 cursor-pointer select-none hover:text-blue-700" onClick={() => handleSort('paymentOption')}>
                                        <span className="inline-flex items-center">Payment Option <SortIcon field="paymentOption" /></span>
                                    </TableHead>
                                    <TableHead className="min-w-[140px] font-bold text-slate-700 cursor-pointer select-none hover:text-blue-700" onClick={() => handleSort('receiptDate')}>
                                        <span className="inline-flex items-center">Date/Time <SortIcon field="receiptDate" /></span>
                                    </TableHead>
                                    <TableHead className="min-w-[80px] font-bold text-slate-700">Staged</TableHead>
                                    <TableHead className="min-w-[100px] text-right font-bold text-slate-700 cursor-pointer select-none hover:text-blue-700" onClick={() => handleSort('amount')}>
                                        <span className="inline-flex items-center justify-end w-full">Amount <SortIcon field="amount" /></span>
                                    </TableHead>
                                    <TableHead className="min-w-[100px] text-right font-bold text-slate-700">Tender</TableHead>
                                    <TableHead className="min-w-[100px] text-right font-bold text-slate-700">Change</TableHead>
                                    <TableHead className="min-w-[150px] font-bold text-slate-700 cursor-pointer select-none hover:text-blue-700" onClick={() => handleSort('cashierName')}>
                                        <span className="inline-flex items-center">Cashier <SortIcon field="cashierName" /></span>
                                    </TableHead>
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
                                ) : filteredReceipts.length === 0 && receipts.length > 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={15} className="h-24 text-center text-muted-foreground">
                                            No receipts match the current filters. Try adjusting your filters above.
                                        </TableCell>
                                    </TableRow>
                                ) : filteredReceipts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={15} className="h-24 text-center text-muted-foreground">
                                            No receipts found. Use the filters above and click Load.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredReceipts.map((receipt, idx) => {
                                        const isCancelled = getReceiptField(receipt, 'isCancelled');
                                        const acctNo = getReceiptField(receipt, 'accountNumber');
                                        const receiptNo = getReceiptField(receipt, 'receiptNo');
                                        const payType = getReceiptField(receipt, 'paymentType');
                                        const payOption = getReceiptField(receipt, 'paymentOption');
                                        const dateStr = getReceiptField(receipt, 'receiptDate');
                                        const staged = getReceiptField(receipt, 'staged');
                                        const amount = getReceiptField(receipt, 'amount');
                                        const tender = getReceiptField(receipt, 'tenderAmount');
                                        const change = getReceiptField(receipt, 'changeAmount');
                                        const cashier = getReceiptField(receipt, 'cashierName');
                                        const cashBook = getReceiptField(receipt, 'cashBook');
                                        const cashOffice = getReceiptField(receipt, 'cashOffice');
                                        const cancelField = getReceiptField(receipt, 'cancelField');
                                        const cancelReason = getReceiptField(receipt, 'cancellationReason');
                                        const serialNo = getReceiptField(receipt, 'serialNo');

                                        return (
                                            <TableRow
                                                key={serialNo || idx}
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
                                                    {(staged === 'Yes' || staged === true) ? (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-700 border-green-300 bg-green-50">Yes</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">{staged || 'No'}</span>
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
                                                        {printingReceiptId === serialNo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1" />}
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
                                Showing {filteredReceipts.length !== receipts.length ? `${filteredReceipts.length} filtered of ` : ''}{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} receipts
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
