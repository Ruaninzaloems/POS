import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Search, Printer, Loader2, X, ChevronLeft, ChevronRight, Filter, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, FileText, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import {
    fetchViewReceiptCashiers,
    searchAccountNumbers,
    searchReceiptNumbers,
    fetchReceiptList,
    searchSebataReceipts,
    searchCashbookTransactionTrace,
    fetchActiveFinYear,
    CashbookTransactionTraceResult,
    ViewReceiptCashier,
    ViewReceiptItem,
    ReceiptSearchQuery,
    platinumPrintReceiptRaw,
    fetchPosMultiReceiptPrint,
} from '@/lib/external-api';
import { useToast } from '@/hooks/use-toast';
import { usePos } from '@/lib/pos-state';
import { openSlipPrintWindow, ReceiptPrintData } from '@/lib/receipt-print';

type SortField = 'receiptNo' | 'accountNumber' | 'amount' | 'receiptDate' | 'cashierName' | 'paymentType' | 'paymentOption';
type SortDir = 'asc' | 'desc';

function inferPaymentMethod(receipt: ViewReceiptItem): string {
    const r = receipt as any;
    const cardNo = r.cardNo || r.card_no || r.cardNumber || '';
    const chequeNo = r.chequeNo || r.cheque_no || r.chequeNumber || '';
    const nameOnCheque = r.nameOnCheque || r.name_on_cheque || '';
    const payType = (receipt.paymentType || r.payment_type || r.payMode || '').toLowerCase();

    if (cardNo && cardNo.trim()) return 'Credit Card';
    if ((chequeNo && chequeNo.trim()) || (nameOnCheque && nameOnCheque.trim())) return 'Cheque';
    if (payType.includes('eft')) return 'EFT';
    if (payType.includes('postal')) return 'Postal Order';
    if (payType.includes('credit') || payType.includes('card')) return 'Credit Card';
    if (payType.includes('cheque')) return 'Cheque';
    if (payType.includes('cash') && !payType.includes('cashier')) return 'Cash';
    return 'Cash';
}

function getReceiptField(receipt: ViewReceiptItem, field: string): any {
    const r = receipt as any;
    switch (field) {
        case 'accountNumber': return receipt.accountNumber || r.accountNo || r.accountID || r.account_number || '';
        case 'receiptNo': return receipt.receiptNo || r.receipt_no || '';
        case 'paymentType': return receipt.paymentType || r.payment_type || r.payMode || '';
        case 'paymentMethod': return inferPaymentMethod(receipt);
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
    const [filterPaymentMethod, setFilterPaymentMethod] = useState('__all__');
    const [filterPaymentType, setFilterPaymentType] = useState('__all__');
    const [filterPaymentOption, setFilterPaymentOption] = useState('__all__');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'cancelled'>('all');
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [showFilters, setShowFilters] = useState(false);

    const [cashbookSearchText, setCashbookSearchText] = useState('');
    const [cashbookFinYear, setCashbookFinYear] = useState('');
    const [cashbookMonth, setCashbookMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [cashbookSearching, setCashbookSearching] = useState(false);
    const [cashbookResults, setCashbookResults] = useState<CashbookTransactionTraceResult[] | null>(null);
    const [cashbookSearchStatus, setCashbookSearchStatus] = useState('');
    const [cashbookSuggestions, setCashbookSuggestions] = useState<CashbookTransactionTraceResult[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionsRef = React.useRef<HTMLDivElement>(null);
    const suggestionsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

    useEffect(() => {
        fetchActiveFinYear().then(fy => {
            if (!cashbookFinYear) setCashbookFinYear(fy);
        });
    }, []);

    useEffect(() => {
        if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
        if (cashbookSearchText.length < 3) {
            setCashbookSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        setSuggestionsLoading(true);
        setShowSuggestions(true);
        suggestionsTimerRef.current = setTimeout(async () => {
            try {
                const monthNum = cashbookMonth ? parseInt(cashbookMonth, 10) : new Date().getMonth() + 1;
                const results = await searchCashbookTransactionTrace(
                    cashbookSearchText,
                    cashbookFinYear || undefined,
                    monthNum
                );
                setCashbookSuggestions(results.slice(0, 8));
            } catch {
                setCashbookSuggestions([]);
            } finally {
                setSuggestionsLoading(false);
            }
        }, 400);
        return () => { if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current); };
    }, [cashbookSearchText, cashbookFinYear, cashbookMonth]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
        setFilterPaymentMethod('__all__');
        setFilterPaymentType('__all__');
        setFilterPaymentOption('__all__');
        setFilterStatus('all');
        setSortField(null);
        try {
            const hasSpecificLookup = !!receiptFilter || !!accountFilter;
            const searchFromDate = hasSpecificLookup
                ? new Date(new Date().getFullYear() - 2, 0, 1)
                : effectiveFromDate;
            const searchToDate = toDate || new Date();

            const query: ReceiptSearchQuery = {
                fromDate: format(searchFromDate, "yyyy-MM-dd'T'00:00:00"),
                toDate: format(searchToDate, "yyyy-MM-dd'T'23:59:59"),
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

    const handleCashbookTraceSearch = async () => {
        if (!cashbookSearchText || cashbookSearchText.length < 3) {
            toast({ title: "Search Too Short", description: "Please enter at least 3 characters for the bank reference search.", variant: "destructive" });
            return;
        }
        if (!cashbookMonth || cashbookMonth === '__all__') {
            toast({ title: "Month Required", description: "Please select a specific month for cashbook trace.", variant: "destructive" });
            return;
        }
        setShowSuggestions(false);
        setCashbookSearching(true);
        setCashbookResults([]);
        setCashbookSearchStatus('Searching cashbook transactions...');
        setReceipts([]);
        setTotalCount(0);
        setDataSource('none');
        try {
            const monthNum = parseInt(cashbookMonth, 10);
            setCashbookSearchStatus(`Querying Platinum API for "${cashbookSearchText}"...`);
            const results = await searchCashbookTransactionTrace(
                cashbookSearchText,
                cashbookFinYear || undefined,
                monthNum
            );
            setCashbookResults(results);
            setCashbookSearchStatus('');
            if (results.length === 0) {
                toast({ title: "No Results", description: `No cashbook transactions found matching "${cashbookSearchText}".` });
            } else {
                toast({ title: "Results Found", description: `Found ${results.length} cashbook transaction${results.length !== 1 ? 's' : ''}.` });
            }
        } catch (e: any) {
            setCashbookSearchStatus('');
            toast({ title: "Search Failed", description: e.message || "Cashbook transaction trace search failed.", variant: "destructive" });
        } finally {
            setCashbookSearching(false);
        }
    };

    const handleLoadReceiptsFromCashbook = async (item: CashbookTransactionTraceResult) => {
        const receiptNo = item.receiptNo || item.receipt_No || item.receiptNumber || (item as any).receipt_no || '';
        const accountNumber = item.accountNumber || item.account_Number || item.accountNo || (item as any).account_no || '';

        if (receiptNo) {
            setReceiptFilter(String(receiptNo));
            setAccountFilter('');
            setCashierFilter('0');
        } else if (accountNumber) {
            setAccountFilter(String(accountNumber));
            setReceiptFilter('');
            setCashierFilter('0');
        } else {
            toast({ title: "No Reference", description: "This cashbook entry has no receipt or account number to look up.", variant: "destructive" });
            return;
        }

        setTimeout(() => handleSearch(1), 100);
    };

    const handleClear = () => {
        setCashierFilter("0");
        const now = new Date();
        setFromDate(new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1));
        setToDate(new Date());
        setAccountFilter("");
        setReceiptFilter("");
        setCashbookSearchText('');
        setCashbookResults(null);
        setCashbookSearchStatus('');
        setReceipts([]);
        setTotalCount(0);
        setCurrentPage(1);
        setDataSource('none');
        setQuickSearch('');
        setFilterPaymentMethod('__all__');
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
            const multiData = await fetchPosMultiReceiptPrint(String(serialNo));
            const items = Array.isArray(multiData) ? multiData : [];
            const first: any = items.length > 0 ? items[0] : null;
            const services = items.map((s: any) => ({
                serviceDescription: s.serviceDescription || s.description || s.service || '',
                amount: s.amount ?? s.serviceAmount ?? 0,
            }));
            const totalFromServices = services.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
            const fallbackTotal = getReceiptField(receipt, 'amount') || 0;
            const finalTotal = totalFromServices > 0 ? totalFromServices : fallbackTotal;

            if (!first && finalTotal === 0) {
                toast({ title: "Print Issue", description: "Could not retrieve receipt details. Trying PDF fallback...", variant: "destructive" });
                try {
                    const res = await platinumPrintReceiptRaw([Number(serialNo)]);
                    if (res.ok) {
                        const ct = res.headers.get('content-type') || '';
                        if (ct.includes('application/pdf')) {
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                            setTimeout(() => URL.revokeObjectURL(url), 60000);
                            return;
                        }
                    }
                } catch {}
                const printData: ReceiptPrintData = {
                    receiptNo: getReceiptField(receipt, 'receiptNo'),
                    receiptDate: getReceiptField(receipt, 'receiptDate'),
                    accountNumber: getReceiptField(receipt, 'accountNumber'),
                    totalAmount: fallbackTotal,
                    paymentType: getReceiptField(receipt, 'paymentType'),
                    paymentOption: getReceiptField(receipt, 'paymentOption'),
                    cashierName: getReceiptField(receipt, 'cashierName'),
                    cashOffice: getReceiptField(receipt, 'cashBook'),
                    services: [],
                };
                openSlipPrintWindow(printData, true);
                return;
            }

            const printData: ReceiptPrintData = {
                receiptNo: first?.receiptNo || first?.receiptNumber || getReceiptField(receipt, 'receiptNo'),
                receiptDate: first?.receiptDate || getReceiptField(receipt, 'receiptDate'),
                accountNumber: first?.accountNumber || first?.accountNo || getReceiptField(receipt, 'accountNumber'),
                consumerName: first?.consumerName || first?.consumer || '',
                municipalityName: first?.municipalityName || 'George Municipality',
                address: first?.address || '',
                totalAmount: finalTotal,
                paymentType: first?.paymentType || getReceiptField(receipt, 'paymentType'),
                paymentOption: first?.paymentOption || getReceiptField(receipt, 'paymentOption'),
                cashierName: first?.cashierName || first?.cashier || getReceiptField(receipt, 'cashierName'),
                cashOffice: first?.cashOfficeName || first?.cashOffice || getReceiptField(receipt, 'cashBook'),
                services,
            };

            const win = openSlipPrintWindow(printData, true);
            if (!win) {
                toast({ title: "Popup Blocked", description: "Please allow popups for this site to print receipts.", variant: "destructive" });
                return;
            }
            toast({
                title: "Receipt Ready",
                description: `Receipt ${printData.receiptNo || serialNo} opened for reprinting.`,
            });
        } catch (e: any) {
            console.warn('Multi-receipt fetch failed, falling back to basic print:', e);
            const printData: ReceiptPrintData = {
                receiptNo: getReceiptField(receipt, 'receiptNo'),
                receiptDate: getReceiptField(receipt, 'receiptDate'),
                accountNumber: getReceiptField(receipt, 'accountNumber'),
                consumerName: '',
                municipalityName: 'George Municipality',
                totalAmount: getReceiptField(receipt, 'amount') || 0,
                paymentType: getReceiptField(receipt, 'paymentType'),
                paymentOption: getReceiptField(receipt, 'paymentOption'),
                cashierName: getReceiptField(receipt, 'cashierName'),
                cashOffice: getReceiptField(receipt, 'cashBook'),
                services: [],
            };
            const win = openSlipPrintWindow(printData, true);
            if (!win) {
                toast({ title: "Popup Blocked", description: "Please allow popups for this site to print receipts.", variant: "destructive" });
            }
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

    const uniquePaymentMethods = useMemo(() => {
        const set = new Set<string>();
        receipts.forEach(r => {
            const v = getReceiptField(r, 'paymentMethod');
            if (v) set.add(v);
        });
        return Array.from(set).sort();
    }, [receipts]);

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

        if (filterPaymentMethod !== '__all__') {
            result = result.filter(r => getReceiptField(r, 'paymentMethod') === filterPaymentMethod);
        }
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
    }, [receipts, filterPaymentMethod, filterPaymentType, filterPaymentOption, filterStatus, quickSearch, sortField, sortDir]);

    const activeFilterCount = [
        filterPaymentMethod !== '__all__',
        filterPaymentType !== '__all__',
        filterPaymentOption !== '__all__',
        filterStatus !== 'all',
        quickSearch.trim().length > 0,
    ].filter(Boolean).length;

    const clearAllFilters = () => {
        setQuickSearch('');
        setFilterPaymentMethod('__all__');
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
                                            <SelectTrigger className="h-10 sm:h-9" data-testid="select-cashier-filter">
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
                                            className="h-10 sm:h-9"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                                        <label className="text-sm font-medium text-left sm:text-right text-slate-600">Account Number</label>
                                        <div className="relative">
                                            <Input
                                                ref={accountInputRef}
                                                className="h-10 sm:h-9"
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
                                                            className="w-full text-left px-3 py-3 sm:py-2 text-sm hover:bg-blue-50 font-mono"
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
                                            className="h-10 sm:h-9"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                                        <label className="text-sm font-medium text-left sm:text-right text-slate-600">Receipt Number</label>
                                        <div className="relative">
                                            <Input
                                                ref={receiptInputRef}
                                                className="h-10 sm:h-9"
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
                                                            className="w-full text-left px-3 py-3 sm:py-2 text-sm hover:bg-blue-50 font-mono"
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

                            <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] items-start md:items-center gap-1 md:gap-4 mb-3">
                                    <label className="text-sm font-medium text-left md:text-right text-slate-600 whitespace-nowrap flex items-center gap-1">
                                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                        Cashbook Trace
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                                        <div className="relative" ref={suggestionsRef}>
                                            <Input
                                                className="h-10 sm:h-9 font-mono text-xs"
                                                value={cashbookSearchText}
                                                onChange={e => setCashbookSearchText(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { setShowSuggestions(false); handleCashbookTraceSearch(); }
                                                    if (e.key === 'Escape') setShowSuggestions(false);
                                                }}
                                                onFocus={() => { if (cashbookSuggestions.length > 0) setShowSuggestions(true); }}
                                                placeholder="Bank reference e.g. EFT28012026/457163..."
                                                data-testid="input-cashbook-search"
                                                autoComplete="off"
                                            />
                                            {cashbookSearchText && (
                                                <button
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                                                    onClick={() => { setCashbookSearchText(''); setCashbookResults(null); setCashbookSuggestions([]); setShowSuggestions(false); }}
                                                    type="button"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {showSuggestions && (suggestionsLoading || cashbookSuggestions.length > 0) && (
                                                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[280px] overflow-y-auto">
                                                    {suggestionsLoading && cashbookSuggestions.length === 0 && (
                                                        <div className="px-3 py-3 flex items-center gap-2 text-xs text-slate-500">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                                            Searching cashbook transactions...
                                                        </div>
                                                    )}
                                                    {cashbookSuggestions.map((item, idx) => {
                                                        const desc = (item as any).transactionDetails || (item as any).description || '';
                                                        const receiptNo = (item as any).receiptNo || (item as any).receipt_No || '';
                                                        const accNo = (item as any).accountNumber || (item as any).account_Number || '';
                                                        const debit = Number((item as any).debit) || 0;
                                                        const credit = Number((item as any).credit) || 0;
                                                        const amount = (item as any).amount ?? (debit > 0 ? debit : credit) ?? 0;
                                                        const cashbook = (item as any).cashbookReference || (item as any).documentNumber || '';
                                                        return (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                className="w-full text-left px-3 py-3 sm:py-2 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                                                onClick={() => {
                                                                    setShowSuggestions(false);
                                                                    setCashbookResults([item]);
                                                                    setCashbookSearchText(desc || cashbookSearchText);
                                                                }}
                                                                data-testid={`cashbook-suggestion-${idx}`}
                                                            >
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-mono text-slate-800 truncate">{desc || '(no description)'}</p>
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5 text-[10px] text-slate-500">
                                                                            {receiptNo && <span>Receipt: <span className="font-semibold text-indigo-700">{receiptNo}</span></span>}
                                                                            {accNo && <span>Account: {accNo}</span>}
                                                                            {cashbook && <span>Cashbook: {cashbook}</span>}
                                                                        </div>
                                                                    </div>
                                                                    {amount > 0 && (
                                                                        <span className="text-xs font-mono font-semibold text-slate-700 whitespace-nowrap">R {Number(amount).toFixed(2)}</span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                    {suggestionsLoading && cashbookSuggestions.length > 0 && (
                                                        <div className="px-3 py-2 flex items-center gap-2 text-[10px] text-slate-400">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> Loading more...
                                                        </div>
                                                    )}
                                                    {!suggestionsLoading && cashbookSuggestions.length > 0 && (
                                                        <div className="px-3 py-1.5 bg-slate-50 text-[10px] text-slate-400 text-center border-t">
                                                            Click a result or press Enter to run full trace
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <Select value={cashbookFinYear} onValueChange={setCashbookFinYear}>
                                            <SelectTrigger className="h-10 sm:h-9 w-full sm:w-[130px] text-xs" data-testid="select-cashbook-finyear">
                                                <SelectValue placeholder="Fin Year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(() => {
                                                    const yr = new Date().getFullYear();
                                                    const options = [];
                                                    for (let i = -1; i <= 2; i++) {
                                                        const y = yr - i;
                                                        options.push(`${y}/${y + 1}`);
                                                    }
                                                    return options.map(fy => (
                                                        <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                                                    ));
                                                })()}
                                            </SelectContent>
                                        </Select>
                                        <Select value={cashbookMonth} onValueChange={setCashbookMonth}>
                                            <SelectTrigger className="h-10 sm:h-9 w-full sm:w-[100px] text-xs" data-testid="select-cashbook-month">
                                                <SelectValue placeholder="Month" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'].map((m, i) => (
                                                    <SelectItem key={i + 1} value={String(i + 1)}>{m} ({i + 1})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            className="h-10 sm:h-8 w-full sm:w-auto bg-indigo-700 hover:bg-indigo-800 text-xs gap-1.5 whitespace-nowrap"
                                            onClick={handleCashbookTraceSearch}
                                            disabled={cashbookSearching || !cashbookSearchText}
                                            data-testid="button-cashbook-search"
                                        >
                                            {cashbookSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                            Trace
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 md:ml-[136px]">Search cashbook transactions by bank reference/description to find billing receipts</p>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6 sm:mt-8">
                                <Button className="h-11 sm:h-10 bg-slate-800 hover:bg-slate-900 w-full sm:w-32 text-sm active:scale-[0.99]" onClick={() => handleSearch(1)} disabled={isLoading} data-testid="button-load">
                                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} Load
                                </Button>
                                <Button variant="outline" className="h-11 sm:h-10 w-full sm:w-32 bg-slate-100 hover:bg-slate-200 border-slate-300 text-sm active:scale-[0.99]" onClick={handleClear} data-testid="button-cancel">
                                    <X className="w-4 h-4 mr-2" /> Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {(cashbookResults !== null || cashbookSearching) && (
                    <div className="p-3 sm:p-6 border-b border-slate-200">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider border-l-2 border-indigo-500 pl-2 mb-3 flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                            Cashbook Transaction Trace Results
                            {cashbookSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                            {!cashbookSearching && cashbookResults && <span className="text-indigo-600 font-normal normal-case">({cashbookResults.length} result{cashbookResults.length !== 1 ? 's' : ''})</span>}
                        </div>
                        {cashbookSearching && (
                            <div className="mb-4">
                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-600 h-1.5 rounded-full animate-pulse" style={{ width: '100%', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
                                </div>
                                <p className="text-xs text-indigo-600 mt-2 flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {cashbookSearchStatus || 'Searching...'}
                                </p>
                                <style>{`
                                    @keyframes indeterminate {
                                        0% { transform: translateX(-100%); }
                                        50% { transform: translateX(0%); }
                                        100% { transform: translateX(100%); }
                                    }
                                `}</style>
                            </div>
                        )}
                        {!cashbookSearching && cashbookResults && cashbookResults.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                No cashbook transactions matching this search were found.
                            </div>
                        ) : !cashbookSearching && cashbookResults && cashbookResults.length > 0 && (
                            <>
                                <div className="sm:hidden space-y-2">
                                    {cashbookResults.map((item, idx) => {
                                        const desc = (item as any).transactionDetails || item.description || '';
                                        const receiptNo = item.receiptNo || (item as any).receipt_No || '';
                                        const accountNo = item.accountNumber || (item as any).account_Number || '';
                                        const debit = Number((item as any).debit) || 0;
                                        const credit = Number((item as any).credit) || 0;
                                        const postingDate = (item as any).postingDate || '';
                                        const receiptDate = (item as any).receiptDate || '';
                                        const docNum = (item as any).documentNumber || '';
                                        const cashbookRef = (item as any).cashbookReference || '';
                                        return (
                                            <div key={idx} className="bg-white border rounded-xl p-3 space-y-1.5" data-testid={`mobile-cashbook-card-${idx}`}>
                                                <p className="font-mono text-xs text-slate-800 truncate" title={desc}>{desc || '(no description)'}</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-mono text-sm font-bold text-blue-700" data-testid={`mobile-cashbook-receipt-no-${idx}`}>
                                                        {receiptNo ? `Receipt: ${receiptNo}` : docNum ? `Doc: ${docNum}` : '-'}
                                                    </span>
                                                    <span className="font-mono text-sm font-bold text-right" data-testid={`mobile-cashbook-amount-${idx}`}>
                                                        {debit > 0 && <span className="text-red-600">R {debit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>}
                                                        {credit > 0 && <span className="text-green-600">R {credit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>}
                                                        {debit === 0 && credit === 0 && '-'}
                                                    </span>
                                                </div>
                                                {accountNo > 0 && <div className="text-xs text-slate-600" data-testid={`mobile-cashbook-account-no-${idx}`}>Account: {accountNo}</div>}
                                                <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                                                    {receiptDate && <span>Receipt: {new Date(receiptDate).toLocaleDateString('en-ZA')}</span>}
                                                    {postingDate && <span>Posted: {new Date(postingDate).toLocaleDateString('en-ZA')}</span>}
                                                    {!receiptDate && !postingDate && <span>-</span>}
                                                </div>
                                                {cashbookRef && <div className="text-[10px] text-slate-400">Ref: {cashbookRef}</div>}
                                                {(receiptNo || accountNo) && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full h-10 text-xs gap-1.5 text-indigo-700 border-indigo-300 hover:bg-indigo-50 active:scale-[0.99]"
                                                        onClick={() => handleLoadReceiptsFromCashbook(item)}
                                                        data-testid={`mobile-cashbook-view-${idx}`}
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        View Receipt
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="hidden sm:block overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-indigo-50/50">
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2">Description</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2">Receipt No</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2">Account No</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2">Receipt Date</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2">Doc No</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2 text-right">Debit</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2 text-right">Credit</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2">Posting Date</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2">Cashbook Ref</TableHead>
                                                <TableHead className="text-[10px] font-bold text-indigo-700 py-2 text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {cashbookResults.map((item, idx) => {
                                                const desc = (item as any).transactionDetails || item.description || '';
                                                const receiptNo = item.receiptNo || (item as any).receipt_No || '';
                                                const accountNo = item.accountNumber || (item as any).account_Number || '';
                                                const debit = Number((item as any).debit) || 0;
                                                const credit = Number((item as any).credit) || 0;
                                                const postingDate = (item as any).postingDate || '';
                                                const receiptDate = (item as any).receiptDate || '';
                                                const docNum = (item as any).documentNumber || '';
                                                const cashbookRef = (item as any).cashbookReference || '';
                                                return (
                                                    <TableRow key={idx} className="hover:bg-indigo-50/30" data-testid={`cashbook-result-${idx}`}>
                                                        <TableCell className="text-[11px] font-mono max-w-[250px] truncate" title={desc}>{desc || '-'}</TableCell>
                                                        <TableCell className="text-[11px] font-mono font-semibold text-blue-700">{receiptNo || '-'}</TableCell>
                                                        <TableCell className="text-[11px] font-mono">{accountNo && accountNo > 0 ? accountNo : '-'}</TableCell>
                                                        <TableCell className="text-[10px] text-slate-600">
                                                            {receiptDate ? new Date(receiptDate).toLocaleDateString('en-ZA') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-[11px] font-mono text-slate-600">{docNum || '-'}</TableCell>
                                                        <TableCell className="text-[11px] font-mono font-bold text-right text-red-600">
                                                            {debit > 0 ? `R ${debit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-[11px] font-mono font-bold text-right text-green-600">
                                                            {credit > 0 ? `R ${credit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-[10px] text-slate-600">
                                                            {postingDate ? new Date(postingDate).toLocaleDateString('en-ZA') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-[10px] text-slate-600">{cashbookRef || '-'}</TableCell>
                                                        <TableCell className="text-center">
                                                            {(receiptNo || accountNo) ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 text-[10px] px-2 gap-1 text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                                                                    onClick={() => handleLoadReceiptsFromCashbook(item)}
                                                                    data-testid={`button-load-receipt-${idx}`}
                                                                >
                                                                    <FileText className="w-3 h-3" />
                                                                    View Receipt
                                                                </Button>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400">-</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </div>
                )}

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
                                        className="h-10 sm:h-8 pl-8 text-sm bg-white"
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
                                    className={cn("h-10 sm:h-8 text-xs gap-1.5", showFilters && "bg-blue-600 hover:bg-blue-700")}
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
                                        className="h-10 sm:h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                                        <div>
                                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Payment Method</label>
                                            <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                                                <SelectTrigger className="h-8 text-xs bg-white" data-testid="select-filter-payment-method">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">All Methods</SelectItem>
                                                    {uniquePaymentMethods.map(t => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
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
                                    {filterPaymentMethod !== '__all__' && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200 cursor-pointer" onClick={() => setFilterPaymentMethod('__all__')}>
                                            Method: {filterPaymentMethod} <X className="w-2.5 h-2.5" />
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
                            const payMethod = getReceiptField(receipt, 'paymentMethod');
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
                                        {payMethod && <Badge variant="outline" className="text-[9px] px-1 py-0 text-sky-700 border-sky-200 bg-sky-50">{payMethod}</Badge>}
                                        {payType && <Badge variant="outline" className="text-[9px] px-1 py-0 text-slate-600 border-slate-200 bg-slate-50">{payType}</Badge>}
                                        {payOption && <Badge variant="outline" className="text-[9px] px-1 py-0 text-violet-600 border-violet-200 bg-violet-50">{payOption}</Badge>}
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>{formatReceiptDate(dateStr)}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-10 text-xs px-3 active:scale-[0.99]"
                                            onClick={() => handlePrintReceipt(receipt)}
                                            disabled={printingReceiptId !== null}
                                            data-testid={`mobile-receipt-print-${idx}`}
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
                                    <TableHead className="min-w-[100px] font-bold text-slate-700">
                                        <span className="inline-flex items-center">Method</span>
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
                                        <TableCell colSpan={16} className="h-24 text-center text-muted-foreground">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Loading receipts from billing system...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredReceipts.length === 0 && receipts.length > 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={16} className="h-24 text-center text-muted-foreground">
                                            No receipts match the current filters. Try adjusting your filters above.
                                        </TableCell>
                                    </TableRow>
                                ) : filteredReceipts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={16} className="h-24 text-center text-muted-foreground">
                                            No receipts found. Use the filters above and click Load.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredReceipts.map((receipt, idx) => {
                                        const isCancelled = getReceiptField(receipt, 'isCancelled');
                                        const acctNo = getReceiptField(receipt, 'accountNumber');
                                        const receiptNo = getReceiptField(receipt, 'receiptNo');
                                        const payType = getReceiptField(receipt, 'paymentType');
                                        const payMethod = getReceiptField(receipt, 'paymentMethod');
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
                                                <TableCell className="text-xs">
                                                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium",
                                                        payMethod === 'Cash' && "text-green-700 border-green-300 bg-green-50",
                                                        payMethod === 'Credit Card' && "text-blue-700 border-blue-300 bg-blue-50",
                                                        payMethod === 'EFT' && "text-purple-700 border-purple-300 bg-purple-50",
                                                        payMethod === 'Cheque' && "text-amber-700 border-amber-300 bg-amber-50",
                                                        payMethod === 'Postal Order' && "text-orange-700 border-orange-300 bg-orange-50",
                                                    )}>{payMethod}</Badge>
                                                </TableCell>
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
