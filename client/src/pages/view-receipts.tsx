import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Search, Printer, Loader2, X, ChevronLeft, ChevronRight, Filter, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, FileText, CheckCircle2, AlertCircle, BookOpen, Banknote, CreditCard, Building2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { HelpTip } from '@/components/ui/help-tip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { fetchMunicipalityInfo, type MunicipalityInfo } from '@/lib/external-api';
import {
    fetchViewReceiptCashiers,
    searchAccountNumbers,
    searchReceiptNumbers,
    fetchReceiptList,
    searchCashbookTransactionTrace,
    fetchActiveFinYear,
    searchByBankStatementNote,
    getEftBankStatementNotes,
    CashbookTransactionTraceResult,
    BankStatementNoteResult,
    ViewReceiptCashier,
    ViewReceiptItem,
    ReceiptSearchQuery,
    platinumPrintReceiptRaw,
} from '@/lib/external-api';
import { useToast } from '@/hooks/use-toast';
import { usePos } from '@/lib/pos-state';

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
    const [muniInfo, setMuniInfo] = useState<MunicipalityInfo | null>(null);
    useEffect(() => { fetchMunicipalityInfo().then(setMuniInfo).catch(() => {}); }, []);
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
    const [dataSource, setDataSource] = useState<'none' | 'platinum'>('none');

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

    const [bankNoteSearchText, setBankNoteSearchText] = useState('');
    const [bankNoteSearching, setBankNoteSearching] = useState(false);
    const [bankNoteResults, setBankNoteResults] = useState<BankStatementNoteResult[] | null>(null);
    const [selectedBankNoteItem, setSelectedBankNoteItem] = useState<BankStatementNoteResult | null>(null);

    const [eftAccountSearch, setEftAccountSearch] = useState('');
    const [eftSearching, setEftSearching] = useState(false);
    const [eftResults, setEftResults] = useState<any[] | null>(null);

    const [bankNotePage, setBankNotePage] = useState(1);
    const [eftPage, setEftPage] = useState(1);
    const SUB_PAGE_SIZE = 25;

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
            console.log('[ViewReceipts] Result:', result.items.length, 'items');

            setReceipts(result.items);
            setTotalCount(result.totalCount);
            setCurrentPage(page);
            setDataSource(result.items.length > 0 ? 'platinum' : 'none');

            if (result.items.length === 0) {
                toast({
                    title: "No Results",
                    description: "No receipts found matching your criteria.",
                });
            }
        } catch (error: any) {
            console.error("Failed to load receipts", error);
            toast({
                title: "Error",
                description: error?.message || "Failed to load receipt data. Please try again.",
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

    const handleBankNoteSearch = async () => {
        if (!bankNoteSearchText || bankNoteSearchText.length < 3) {
            toast({ title: "Search Too Short", description: "Please enter at least 3 characters for the bank statement note search.", variant: "destructive" });
            return;
        }
        setBankNoteSearching(true);
        setBankNoteResults([]);
        setBankNotePage(1);
        setReceipts([]);
        setTotalCount(0);
        setDataSource('none');
        try {
            const results = await searchByBankStatementNote(bankNoteSearchText);
            setBankNoteResults(results);
            if (results.length === 0) {
                toast({ title: "No Results", description: `No bank statement notes found matching "${bankNoteSearchText}".` });
            } else {
                toast({ title: "Results Found", description: `Found ${results.length} bank statement result${results.length !== 1 ? 's' : ''}.` });
            }
        } catch (e: any) {
            toast({ title: "Search Failed", description: e.message || "Bank statement note search failed.", variant: "destructive" });
        } finally {
            setBankNoteSearching(false);
        }
    };

    const handleLoadReceiptFromBankNote = (item: BankStatementNoteResult) => {
        setSelectedBankNoteItem(item);
    };

    const handlePrintBankNoteReceipt = async (item: BankStatementNoteResult) => {
        const r = item as any;
        const receiptNo = r.receiptNo ?? r.ReceiptNo ?? '';

        if (!receiptNo) {
            toast({ title: "Print Failed", description: "No receipt number found for this EFT entry.", variant: "destructive" });
            return;
        }
        try {
            let serialNo = Number(receiptNo);
            if (!serialNo || isNaN(serialNo)) {
                const searchRes = await searchReceiptNumbers(String(receiptNo));
                const found: any = Array.isArray(searchRes) ? searchRes[0] : null;
                serialNo = found?.serialNo || found?.receiptId || found?.id || 0;
            }
            if (!serialNo) {
                toast({ title: "Print Failed", description: "Could not resolve receipt serial number for PDF.", variant: "destructive" });
                return;
            }
            const res = await platinumPrintReceiptRaw([serialNo]);
            if (!res.ok) {
                toast({ title: "Print Failed", description: "Could not fetch receipt PDF from billing system.", variant: "destructive" });
                return;
            }
            const blob = await res.blob();
            const pdfUrl = URL.createObjectURL(blob);
            const pdfTab = window.open(pdfUrl, '_blank');
            if (!pdfTab) {
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = `Receipt_EFT_${receiptNo}.pdf`;
                link.click();
            }
            toast({ title: "Receipt Ready", description: `EFT receipt ${receiptNo} opened for printing.` });
        } catch (e: any) {
            console.error('EFT receipt fetch failed:', e);
            toast({ title: "Print Failed", description: "Could not retrieve receipt PDF from the API.", variant: "destructive" });
        }
    };

    const handleEftSearch = async () => {
        if (!eftAccountSearch || eftAccountSearch.length < 1) {
            toast({ title: "Account Required", description: "Please enter an account ID for the EFT search.", variant: "destructive" });
            return;
        }
        setEftSearching(true);
        setEftResults([]);
        setEftPage(1);
        setReceipts([]);
        setTotalCount(0);
        setDataSource('none');
        try {
            const results = await getEftBankStatementNotes(eftAccountSearch);
            const enriched = results.map((r: any) => ({
                ...r,
                _searchAccountId: eftAccountSearch,
            }));
            setEftResults(enriched);
            if (enriched.length === 0) {
                toast({ title: "No Results", description: `No EFT bank statement notes found for account "${eftAccountSearch}".` });
            } else {
                toast({ title: "Results Found", description: `Found ${enriched.length} EFT result${enriched.length !== 1 ? 's' : ''}.` });
            }
        } catch (e: any) {
            toast({ title: "Search Failed", description: e.message || "EFT bank statement notes search failed.", variant: "destructive" });
        } finally {
            setEftSearching(false);
        }
    };

    const handleLoadReceiptFromEft = (item: any) => {
        const receiptNo = item?.receiptNo || item?.receipt_No || item?.receiptNumber;
        const accountNo = item?._searchAccountId || item?.accountNumber || item?.accountNo || item?.accountId || item?.accountID;

        if (receiptNo) {
            setReceiptFilter(String(receiptNo));
            setAccountFilter(accountNo ? String(accountNo) : '');
            setCashierFilter('0');
        } else if (accountNo) {
            setAccountFilter(String(accountNo));
            setReceiptFilter('');
            setCashierFilter('0');
        } else {
            toast({ title: "No Reference", description: "This EFT entry has no receipt or account number to look up.", variant: "destructive" });
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
        setBankNoteSearchText('');
        setBankNoteResults(null);
        setEftAccountSearch('');
        setEftResults(null);
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

    const generateViewReceiptHtml = (receipt: ViewReceiptItem): string => {
        const receiptNo = getReceiptField(receipt, 'receiptNo');
        const acctNo = getReceiptField(receipt, 'accountNumber');
        const amount = Number(getReceiptField(receipt, 'amount')) || 0;
        const tender = Number(getReceiptField(receipt, 'tenderAmount')) || amount;
        const change = Number(getReceiptField(receipt, 'changeAmount')) || 0;
        const cashier = getReceiptField(receipt, 'cashierName');
        const office = getReceiptField(receipt, 'cashOffice');
        const dateStr = getReceiptField(receipt, 'receiptDate');
        const payMethod = getReceiptField(receipt, 'paymentMethod');
        const payOption = getReceiptField(receipt, 'paymentOption');
        const now = new Date();
        return `<!DOCTYPE html><html><head><title>Receipt ${receiptNo}</title>
<style>
  @page { size: 80mm auto; margin: 5mm; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 280px; margin: 0 auto; padding: 10px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  .right { text-align: right; }
  td { vertical-align: top; font-size: 10px; padding: 2px 0; }
  @media print { body { margin: 0; padding: 5px; } }
</style></head><body>
<div class="center bold" style="font-size:13px;margin-bottom:4px;">${muniInfo?.name || 'Municipality'}</div>
<div class="center" style="font-size:10px;">${muniInfo?.address1 || ''}</div>
<div class="center" style="font-size:10px;">${muniInfo?.address2 || ''}</div>
${muniInfo?.vatNo ? `<div class="center" style="font-size:10px;">VAT: ${muniInfo.vatNo}</div>` : ''}
<div class="center bold" style="font-size:10px;margin-top:4px;">** REPRINT **</div>
<div class="line"></div>
<table>
  <tr><td>Receipt No:</td><td class="right bold" style="font-size:11px;">${receiptNo}</td></tr>
  <tr><td>Date:</td><td class="right">${dateStr ? new Date(dateStr).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '-'}</td></tr>
  <tr><td>Account:</td><td class="right">${acctNo}</td></tr>
  ${payOption ? `<tr><td>Option:</td><td class="right">${payOption}</td></tr>` : ''}
</table>
<div class="line"></div>
<table>
  <tr class="bold"><td style="font-size:12px;">TOTAL</td><td class="right" style="font-size:12px;">R ${amount.toFixed(2)}</td></tr>
  <tr><td>Tender:</td><td class="right">R ${tender.toFixed(2)}</td></tr>
  ${change > 0 ? `<tr><td>Change:</td><td class="right">R ${change.toFixed(2)}</td></tr>` : ''}
  <tr><td>Payment:</td><td class="right">${payMethod}</td></tr>
</table>
<div class="line"></div>
<table>
  <tr><td>Cashier:</td><td class="right">${cashier}</td></tr>
  <tr><td>Office:</td><td class="right">${office}</td></tr>
</table>
<div class="line"></div>
<div class="center" style="font-size:9px;margin-top:8px;">${muniInfo?.receiptFooter || 'Thank you'}</div>
<div class="center" style="font-size:8px;color:#999;margin-top:4px;">Reprinted: ${now.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    };

    const handlePrintReceipt = async (receipt: ViewReceiptItem) => {
        const serialNo = getReceiptField(receipt, 'serialNo');
        if (!serialNo) {
            toast({ title: "Print Failed", description: "No receipt identifier found.", variant: "destructive" });
            return;
        }
        setPrintingReceiptId(serialNo);
        try {
            const res = await platinumPrintReceiptRaw([Number(serialNo)]);
            if (!res.ok) {
                console.warn('[ViewReceipts] print-receipt API failed:', res.status, '— generating local receipt');
                const html = generateViewReceiptHtml(receipt);
                const printWindow = window.open('', '_blank');
                if (printWindow) { printWindow.document.write(html); printWindow.document.close(); }
                toast({ title: "Receipt Ready", description: `Receipt ${getReceiptField(receipt, 'receiptNo') || serialNo} generated for printing.` });
                return;
            }
            const blob = await res.blob();
            if (blob.size < 100) {
                console.warn('[ViewReceipts] print-receipt returned tiny response — generating local receipt');
                const html = generateViewReceiptHtml(receipt);
                const printWindow = window.open('', '_blank');
                if (printWindow) { printWindow.document.write(html); printWindow.document.close(); }
                toast({ title: "Receipt Ready", description: `Receipt ${getReceiptField(receipt, 'receiptNo') || serialNo} generated for printing.` });
                return;
            }
            const pdfUrl = URL.createObjectURL(blob);
            const pdfTab = window.open(pdfUrl, '_blank');
            if (!pdfTab) {
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = `Receipt_${getReceiptField(receipt, 'receiptNo') || serialNo}.pdf`;
                link.click();
            }
            toast({ title: "Receipt Ready", description: `Receipt ${getReceiptField(receipt, 'receiptNo') || serialNo} opened for printing.` });
        } catch (e: any) {
            console.error('Receipt fetch failed, generating local receipt:', e);
            const html = generateViewReceiptHtml(receipt);
            const printWindow = window.open('', '_blank');
            if (printWindow) { printWindow.document.write(html); printWindow.document.close(); }
            toast({ title: "Receipt Ready", description: `Receipt ${getReceiptField(receipt, 'receiptNo') || serialNo} generated for printing.` });
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
        return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-[var(--pos-accent)]" /> : <ArrowDown className="w-3 h-3 ml-1 text-[var(--pos-accent)]" />;
    };

    const filteredTotal = useMemo(() => {
        return filteredReceipts.reduce((sum, r) => sum + (Number(getReceiptField(r, 'amount')) || 0), 0);
    }, [filteredReceipts]);

    return (
        <PosLayout>
            <div className="flex flex-col h-full overflow-hidden">
                <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E]" data-testid="text-page-title">View Receipts</h1>
                            <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Search and reprint previously issued receipts <HelpTip text="Search and reprint previously issued receipts. Filter by date, cashier, or receipt number." /></p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6 space-y-4">
                    <Card className="shadow-sm">
                        <CardContent className="p-0">
                            <Tabs defaultValue="receipt-search" className="w-full">
                                <TabsList className="w-full justify-start rounded-none border-b bg-slate-50 h-auto p-0 gap-0">
                                    <TabsTrigger value="receipt-search" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--pos-accent)] data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:text-[#2E2E2E] px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium gap-1.5" data-testid="tab-receipt-search">
                                        <FileText className="w-3.5 h-3.5" />
                                        Receipt Search
                                    </TabsTrigger>
                                    <TabsTrigger value="bank-statement" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:text-emerald-700 px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium gap-1.5" data-testid="tab-bank-statement">
                                        <Banknote className="w-3.5 h-3.5" />
                                        Bank Statement
                                    </TabsTrigger>
                                    <TabsTrigger value="eft-account" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:text-teal-700 px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium gap-1.5" data-testid="tab-eft-account">
                                        <CreditCard className="w-3.5 h-3.5" />
                                        EFT by Account
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="receipt-search" className="mt-0 p-4">
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">Cashier <HelpTip text="Filter receipts by the cashier who processed the transaction." size="sm" /></label>
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
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">From Date <span className="text-red-500">*</span> <HelpTip text="Select the date range to search for receipts." size="sm" /></label>
                                                <DatePicker date={fromDate} setDate={setFromDate} className="h-9" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">To Date <span className="text-red-500">*</span></label>
                                                <DatePicker date={toDate} setDate={setToDate} className="h-9" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">Account Number</label>
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
                                                        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => { setAccountFilter(""); setAccountSuggestions([]); }} type="button">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {showAccountDropdown && accountSuggestions.length > 0 && (
                                                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                                            {accountSuggestions.map((acct, i) => (
                                                                <button key={i} className="w-full text-left px-3 py-3 sm:py-2 text-sm hover:bg-[var(--pos-accent-tint)] font-mono" onMouseDown={() => { setAccountFilter(String(acct)); setShowAccountDropdown(false); }} data-testid={`suggestion-account-${i}`}>
                                                                    {String(acct)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">Receipt Number <HelpTip text="Search for a specific receipt by its number." size="sm" /></label>
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
                                                        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => { setReceiptFilter(""); setReceiptSuggestions([]); }} type="button">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {showReceiptDropdown && receiptSuggestions.length > 0 && (
                                                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                                            {receiptSuggestions.map((rn, i) => (
                                                                <button key={i} className="w-full text-left px-3 py-3 sm:py-2 text-sm hover:bg-[var(--pos-accent-tint)] font-mono" onMouseDown={() => { setReceiptFilter(String(rn)); setShowReceiptDropdown(false); }} data-testid={`suggestion-receipt-${i}`}>
                                                                    {String(rn)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-1">
                                            <Button variant="outline" className="h-9 px-4 text-sm" onClick={handleClear} data-testid="button-cancel">
                                                <X className="w-4 h-4 mr-1.5" /> Clear
                                            </Button>
                                            <Button className="h-9 px-4 bg-[#C9D6E2] hover:bg-[#B7C7D6] border border-[#A9B8C7] text-[#2E2E2E] text-sm" onClick={() => handleSearch(1)} disabled={isLoading} data-testid="button-load">
                                                {isLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />} Load
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="bank-statement" className="mt-0 p-4">
                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Input
                                                placeholder="Search bank statement notes (min 3 chars)..."
                                                value={bankNoteSearchText}
                                                onChange={(e) => setBankNoteSearchText(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleBankNoteSearch()}
                                                className="h-9 text-sm flex-1"
                                                data-testid="input-bank-note-search"
                                            />
                                            <Button
                                                className="h-9 bg-emerald-700 hover:bg-emerald-800 text-sm gap-1.5 whitespace-nowrap"
                                                onClick={handleBankNoteSearch}
                                                disabled={bankNoteSearching || bankNoteSearchText.length < 3}
                                                data-testid="button-bank-note-search"
                                            >
                                                {bankNoteSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                                Search
                                            </Button>
                                        </div>

                                        {bankNoteSearching && (
                                            <div>
                                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-emerald-600 h-1.5 rounded-full animate-pulse" style={{ width: '100%', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
                                                </div>
                                                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-2">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    Searching bank statement notes...
                                                </p>
                                            </div>
                                        )}

                                        {!bankNoteSearching && bankNoteResults && bankNoteResults.length === 0 && (
                                            <div className="text-center py-6 text-slate-400 text-sm">
                                                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                No bank statement notes matching this search were found.
                                            </div>
                                        )}

                                        {!bankNoteSearching && bankNoteResults && bankNoteResults.length > 0 && (() => {
                                            const bankNoteTotalPages = Math.ceil(bankNoteResults.length / SUB_PAGE_SIZE);
                                            const bankNotePagedResults = bankNoteResults.slice((bankNotePage - 1) * SUB_PAGE_SIZE, bankNotePage * SUB_PAGE_SIZE);
                                            return (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs text-emerald-600 font-medium">{bankNoteResults.length} result{bankNoteResults.length !== 1 ? 's' : ''} found{bankNoteTotalPages > 1 ? ` — page ${bankNotePage} of ${bankNoteTotalPages}` : ''}</div>
                                                    {bankNoteTotalPages > 1 && (
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={bankNotePage <= 1} onClick={() => setBankNotePage(p => p - 1)} data-testid="button-banknote-prev">
                                                                <ChevronLeft className="w-4 h-4" />
                                                            </Button>
                                                            <span className="text-xs text-slate-600 px-2">{bankNotePage}/{bankNoteTotalPages}</span>
                                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={bankNotePage >= bankNoteTotalPages} onClick={() => setBankNotePage(p => p + 1)} data-testid="button-banknote-next">
                                                                <ChevronRight className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="sm:hidden space-y-2">
                                                    {bankNotePagedResults.map((item, idx) => {
                                                        const r = item as any;
                                                        const receiptNo = r.receiptNo ?? r.ReceiptNo ?? '';
                                                        const accountId = Number(r.accountId ?? r.AccountId ?? 0);
                                                        const paidAmount = Number(r.paidAmount ?? r.PaidAmount ?? 0);
                                                        const bankAmount = Number(r.bankAmount ?? r.BankAmount ?? 0);
                                                        const payTypeId = Number(r.paymentTypeId ?? r.PaymentTypeId ?? 0);
                                                        const payTypeLabel = payTypeId === 1 ? 'Cash' : payTypeId === 2 ? 'EFT' : payTypeId === 3 ? 'Credit Card' : payTypeId === 4 ? 'Postal Order' : payTypeId === 5 ? 'EFT' : payTypeId > 0 ? `Type ${payTypeId}` : '';
                                                        const dateAllocated = r.billingAllocationDate ?? r.BillingAllocationDate ?? r.dateCaptured ?? r.DateCaptured ?? '';
                                                        const bankDate = r.bankStatementDate ?? r.BankStatementDate ?? '';
                                                        const bankNote = r.bankStatementNote ?? r.BankStatementNote ?? '';
                                                        const status = r.allocationStatus ?? r.AllocationStatus ?? '';
                                                        const cashbookDoc = r.cashbookDocumentNumber ?? r.CashbookDocumentNumber ?? '';
                                                        const cashbookDesc = r.cashbookDescription ?? r.CashbookDescription ?? '';
                                                        const miscDesc = r.miscPaymentGroupDescription ?? r.MiscPaymentGroupDescription ?? '';
                                                        return (
                                                            <div key={idx} className="bg-white border rounded-xl p-3 space-y-1.5" data-testid={`mobile-banknote-card-${idx}`}>
                                                                {bankNote && <div className="font-mono text-xs text-emerald-800 bg-emerald-50 px-2 py-1 rounded truncate" title={bankNote}>{bankNote}</div>}
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-mono text-sm font-bold text-emerald-700" data-testid={`mobile-banknote-receipt-no-${idx}`}>
                                                                        {receiptNo ? `Receipt: ${receiptNo}` : '-'}
                                                                    </span>
                                                                    <span className="font-mono text-sm font-bold text-right" data-testid={`mobile-banknote-amount-${idx}`}>
                                                                        {paidAmount > 0 ? <span className="text-emerald-700">R {paidAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span> : bankAmount > 0 ? <span className="text-[#6B6B6B]">R {bankAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span> : '-'}
                                                                    </span>
                                                                </div>
                                                                {accountId > 0 && <div className="text-xs text-slate-600">Account: {accountId}</div>}
                                                                <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                                                                    {dateAllocated && <span>Allocated: {new Date(dateAllocated).toLocaleDateString('en-ZA')}</span>}
                                                                    {bankDate && <span>Bank Date: {new Date(bankDate).toLocaleDateString('en-ZA')}</span>}
                                                                    {payTypeLabel && <span>Type: {payTypeLabel}</span>}
                                                                </div>
                                                                {status && (
                                                                    <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${status.includes('Not Allocated') ? 'bg-orange-100 text-orange-700' : status.includes('Account') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                                                        {status}
                                                                    </div>
                                                                )}
                                                                {miscDesc && <div className="text-[10px] text-slate-500">Misc: {miscDesc}</div>}
                                                                {cashbookDoc && <div className="text-[10px] text-slate-400">Cashbook: {cashbookDoc}{cashbookDesc ? ` (${cashbookDesc})` : ''}</div>}
                                                                <div className="flex gap-2">
                                                                    {(receiptNo || accountId > 0) && (
                                                                        <Button variant="outline" size="sm" className="flex-1 h-10 text-xs gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 active:scale-[0.99]" onClick={() => handleLoadReceiptFromBankNote(item)} data-testid={`mobile-banknote-view-${idx}`}>
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            View Receipt
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="hidden sm:block overflow-x-auto border rounded-lg">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-emerald-50/50">
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2">Bank Statement Note</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2">Receipt No</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2">Account</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2 text-right">Paid Amount</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2 text-right">Bank Amount</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2">Date Allocated</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2">Bank Date</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2">Payment</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2">Status</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2">Cashbook</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-emerald-700 py-2 text-center">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {bankNotePagedResults.map((item, idx) => {
                                                                const r = item as any;
                                                                const receiptNo = r.receiptNo ?? r.ReceiptNo ?? '';
                                                                const accountId = Number(r.accountId ?? r.AccountId ?? 0);
                                                                const paidAmount = Number(r.paidAmount ?? r.PaidAmount ?? 0);
                                                                const bankAmount = Number(r.bankAmount ?? r.BankAmount ?? 0);
                                                                const payTypeId = Number(r.paymentTypeId ?? r.PaymentTypeId ?? 0);
                                                                const payTypeLabel = payTypeId === 1 ? 'Cash' : payTypeId === 2 ? 'EFT' : payTypeId === 3 ? 'Credit Card' : payTypeId === 4 ? 'Postal Order' : payTypeId === 5 ? 'EFT' : payTypeId > 0 ? `Type ${payTypeId}` : '';
                                                                const dateAllocated = r.billingAllocationDate ?? r.BillingAllocationDate ?? '';
                                                                const bankDate = r.bankStatementDate ?? r.BankStatementDate ?? '';
                                                                const bankNote = r.bankStatementNote ?? r.BankStatementNote ?? '';
                                                                const status = r.allocationStatus ?? r.AllocationStatus ?? '';
                                                                const cashbookDoc = r.cashbookDocumentNumber ?? r.CashbookDocumentNumber ?? '';
                                                                const cashbookDesc = r.cashbookDescription ?? r.CashbookDescription ?? '';
                                                                return (
                                                                    <TableRow key={idx} className="hover:bg-emerald-50/30" data-testid={`banknote-result-${idx}`}>
                                                                        <TableCell className="text-[11px] font-mono max-w-[250px] truncate" title={bankNote}>{bankNote || '-'}</TableCell>
                                                                        <TableCell className="text-[11px] font-mono font-semibold text-emerald-700">{receiptNo || <span className="text-orange-500 text-[10px] italic font-normal">N/A</span>}</TableCell>
                                                                        <TableCell className="text-[11px] font-mono">{accountId > 0 ? accountId : <span className="text-orange-500 text-[10px] italic">N/A</span>}</TableCell>
                                                                        <TableCell className="text-[11px] font-mono font-bold text-right text-emerald-700">
                                                                            {paidAmount > 0 ? `R ${paidAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-[11px] font-mono font-bold text-right text-[#6B6B6B]">
                                                                            {bankAmount > 0 ? `R ${bankAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-[10px] text-slate-600">
                                                                            {dateAllocated ? new Date(dateAllocated).toLocaleDateString('en-ZA') : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-[10px] text-slate-600">
                                                                            {bankDate ? new Date(bankDate).toLocaleDateString('en-ZA') : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-[11px] text-slate-600">{payTypeLabel || '-'}</TableCell>
                                                                        <TableCell className="text-[10px]">
                                                                            {status ? (
                                                                                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${status.includes('Not Allocated') ? 'bg-orange-100 text-orange-700' : status.includes('Account') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                                                                    {status}
                                                                                </span>
                                                                            ) : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-[10px] text-slate-600 max-w-[120px] truncate" title={`${cashbookDoc}${cashbookDesc ? ` (${cashbookDesc})` : ''}`}>
                                                                            {cashbookDoc || '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                            <div className="flex gap-1 justify-center">
                                                                                {(receiptNo || accountId > 0) && (
                                                                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => handleLoadReceiptFromBankNote(item)} data-testid={`button-banknote-view-${idx}`}>
                                                                                        <FileText className="w-3 h-3" />
                                                                                        View
                                                                                    </Button>
                                                                                )}
                                                                                {receiptNo && (
                                                                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => handlePrintBankNoteReceipt(item)} data-testid={`button-banknote-print-${idx}`}>
                                                                                        <Printer className="w-3 h-3" />
                                                                                        Print
                                                                                    </Button>
                                                                                )}
                                                                                {!receiptNo && !(accountId > 0) && (
                                                                                    <span className="text-[10px] text-slate-400">-</span>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </>
                                            );
                                        })()}

                                        {selectedBankNoteItem && (
                                            <div data-testid="bank-note-receipt-detail">
                                                <div className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-2">
                                                    <FileText className="w-3.5 h-3.5" />
                                                    EFT Receipt Detail
                                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto" onClick={() => setSelectedBankNoteItem(null)}>
                                                        <X className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                {(() => {
                                                    const r = selectedBankNoteItem as any;
                                                    const receiptNo = r.receiptNo ?? r.ReceiptNo ?? '';
                                                    const accountId = Number(r.accountId ?? r.AccountId ?? 0);
                                                    const paidAmount = Number(r.paidAmount ?? r.PaidAmount ?? 0);
                                                    const bankAmount = Number(r.bankAmount ?? r.BankAmount ?? 0);
                                                    const dateCaptured = r.dateCaptured ?? r.DateCaptured ?? '';
                                                    const bankDate = r.bankStatementDate ?? r.BankStatementDate ?? '';
                                                    const billingDate = r.billingAllocationDate ?? r.BillingAllocationDate ?? '';
                                                    const dateAllocated = billingDate || dateCaptured;
                                                    const bankNote = r.bankStatementNote ?? r.BankStatementNote ?? '';
                                                    const status = r.allocationStatus ?? r.AllocationStatus ?? '';
                                                    const cashbookDoc = r.cashbookDocumentNumber ?? r.CashbookDocumentNumber ?? '';
                                                    const cashbookDesc = r.cashbookDescription ?? r.CashbookDescription ?? '';
                                                    const miscDesc = r.miscPaymentGroupDescription ?? r.MiscPaymentGroupDescription ?? '';
                                                    const payTypeId = Number(r.paymentTypeId ?? r.PaymentTypeId ?? 0);
                                                    const payTypeLabel = payTypeId === 1 ? 'Cash' : payTypeId === 3 ? 'Credit Card' : payTypeId === 2 ? 'EFT' : payTypeId === 5 ? 'EFT' : payTypeId > 0 ? `Type ${payTypeId}` : 'Unknown';
                                                    const bankReconID = r.bankReconID ?? r.BankReconID ?? '';
                                                    const billingAllocated = r.billingAllocated ?? r.BillingAllocated ?? false;
                                                    return (
                                                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 sm:p-6 max-w-2xl">
                                                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-200">
                                                                <div>
                                                                    <h3 className="text-lg font-bold text-emerald-800">{muniInfo?.name || ''}</h3>
                                                                    <p className="text-xs text-emerald-600">EFT / Bank Statement Receipt</p>
                                                                </div>
                                                                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${status.includes('Not Allocated') ? 'bg-orange-100 text-orange-700 border border-orange-300' : status.includes('Account') ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-100 text-slate-700 border border-slate-300'}`}>
                                                                    {billingAllocated ? 'Allocated' : 'Not Allocated'} - {status || 'Unknown'}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                                <div>
                                                                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Receipt Number</span>
                                                                    <p className="font-mono font-bold text-emerald-800 text-base">{receiptNo || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Account ID</span>
                                                                    <p className="font-mono font-bold text-slate-800 text-base">{accountId > 0 ? accountId : 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Paid Amount</span>
                                                                    <p className="font-mono font-bold text-emerald-700 text-lg">R {paidAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Bank Amount</span>
                                                                    <p className="font-mono font-bold text-[#6B6B6B] text-lg">R {bankAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Date Allocated</span>
                                                                    <p className="font-mono text-slate-700">{dateAllocated ? new Date(dateAllocated).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Bank Statement Date</span>
                                                                    <p className="font-mono text-slate-700">{bankDate ? new Date(bankDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Payment Method</span>
                                                                    <p className="font-mono text-slate-700">{payTypeLabel}</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 pt-3 border-t border-emerald-200 space-y-2">
                                                                <div>
                                                                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Bank Statement Note</span>
                                                                    <p className="font-mono text-xs bg-white/60 rounded px-2 py-1.5 text-emerald-800 border border-emerald-100">{bankNote || '-'}</p>
                                                                </div>
                                                                {cashbookDoc && (
                                                                    <div className="flex gap-4">
                                                                        <div>
                                                                            <span className="text-[10px] uppercase text-slate-500 font-semibold">Cashbook Ref</span>
                                                                            <p className="font-mono text-xs text-slate-700">{cashbookDoc}</p>
                                                                        </div>
                                                                        {cashbookDesc && (
                                                                            <div>
                                                                                <span className="text-[10px] uppercase text-slate-500 font-semibold">Cashbook</span>
                                                                                <p className="font-mono text-xs text-slate-700">{cashbookDesc.trim()}</p>
                                                                            </div>
                                                                        )}
                                                                        {bankReconID && (
                                                                            <div>
                                                                                <span className="text-[10px] uppercase text-slate-500 font-semibold">Recon ID</span>
                                                                                <p className="font-mono text-xs text-slate-700">{bankReconID}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {miscDesc && (
                                                                    <div>
                                                                        <span className="text-[10px] uppercase text-slate-500 font-semibold">Miscellaneous Group</span>
                                                                        <p className="font-mono text-xs text-slate-700">{miscDesc}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="mt-4 pt-3 border-t border-emerald-200 flex gap-2">
                                                                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handlePrintBankNoteReceipt(selectedBankNoteItem)} data-testid="button-print-banknote-receipt">
                                                                    <Printer className="w-3.5 h-3.5" />
                                                                    Print Receipt
                                                                </Button>
                                                                <Button variant="outline" size="sm" className="gap-1.5 text-slate-600" onClick={() => setSelectedBankNoteItem(null)}>
                                                                    <X className="w-3.5 h-3.5" />
                                                                    Close
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="eft-account" className="mt-0 p-4">
                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Input
                                                placeholder="Enter account ID..."
                                                value={eftAccountSearch}
                                                onChange={(e) => setEftAccountSearch(e.target.value.replace(/[^0-9]/g, ''))}
                                                onKeyDown={(e) => e.key === 'Enter' && handleEftSearch()}
                                                className="h-9 text-sm flex-1"
                                                data-testid="input-eft-account-search"
                                            />
                                            <Button
                                                className="h-9 bg-teal-700 hover:bg-teal-800 text-sm gap-1.5 whitespace-nowrap"
                                                onClick={handleEftSearch}
                                                disabled={eftSearching || !eftAccountSearch}
                                                data-testid="button-eft-search"
                                            >
                                                {eftSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                                Search
                                            </Button>
                                        </div>

                                        {eftSearching && (
                                            <div>
                                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-teal-600 h-1.5 rounded-full animate-pulse" style={{ width: '100%', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
                                                </div>
                                                <p className="text-xs text-teal-600 mt-2 flex items-center gap-2">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    Searching EFT bank statement notes...
                                                </p>
                                            </div>
                                        )}

                                        {!eftSearching && eftResults && eftResults.length === 0 && (
                                            <div className="text-center py-6 text-slate-400 text-sm">
                                                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                No EFT bank statement notes found for this account.
                                            </div>
                                        )}

                                        {!eftSearching && eftResults && eftResults.length > 0 && (() => {
                                            const eftTotalPages = Math.ceil(eftResults.length / SUB_PAGE_SIZE);
                                            const eftPagedResults = eftResults.slice((eftPage - 1) * SUB_PAGE_SIZE, eftPage * SUB_PAGE_SIZE);
                                            return (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs text-teal-600 font-medium">{eftResults.length} result{eftResults.length !== 1 ? 's' : ''} found{eftTotalPages > 1 ? ` — page ${eftPage} of ${eftTotalPages}` : ''}</div>
                                                    {eftTotalPages > 1 && (
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={eftPage <= 1} onClick={() => setEftPage(p => p - 1)} data-testid="button-eft-prev">
                                                                <ChevronLeft className="w-4 h-4" />
                                                            </Button>
                                                            <span className="text-xs text-slate-600 px-2">{eftPage}/{eftTotalPages}</span>
                                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={eftPage >= eftTotalPages} onClick={() => setEftPage(p => p + 1)} data-testid="button-eft-next">
                                                                <ChevronRight className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="sm:hidden space-y-2">
                                                    {eftPagedResults.map((item, idx) => {
                                                        const receiptNo = item?.receiptNo ?? '';
                                                        const accountNo = item?._searchAccountId ?? '';
                                                        const amount = Number(item?.amount) || 0;
                                                        const bankDate = item?.bankStatementDate ?? '';
                                                        const allocDate = item?.billingAllocationDate ?? '';
                                                        const bankDesc = item?.bankStatementNote ?? '';
                                                        return (
                                                            <div key={idx} className="bg-white border rounded-xl p-3 space-y-2" data-testid={`mobile-eft-card-${idx}`}>
                                                                <p className="font-mono text-xs text-slate-800 leading-tight" title={bankDesc}>{bankDesc || '(no description)'}</p>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-mono text-sm font-bold text-teal-700" data-testid={`mobile-eft-receipt-no-${idx}`}>
                                                                        {receiptNo || '-'}
                                                                    </span>
                                                                    <span className="font-mono text-sm font-bold text-right text-teal-700" data-testid={`mobile-eft-amount-${idx}`}>
                                                                        R {amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                                                                    <div data-testid={`mobile-eft-account-${idx}`}>
                                                                        <span className="text-slate-400">Account:</span> {accountNo || '-'}
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-400">Type:</span> <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">EFT</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-400">Bank Date:</span> {bankDate ? new Date(bankDate).toLocaleDateString('en-ZA') : '-'}
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-400">Allocated:</span> {allocDate ? new Date(allocDate).toLocaleDateString('en-ZA') : '-'}
                                                                    </div>
                                                                </div>
                                                                {receiptNo && (
                                                                    <Button variant="outline" size="sm" className="w-full h-10 text-xs gap-1.5 text-teal-700 border-teal-300 hover:bg-teal-50 active:scale-[0.99]" onClick={() => handleLoadReceiptFromEft(item)} data-testid={`mobile-eft-view-${idx}`}>
                                                                        <FileText className="w-3.5 h-3.5" />
                                                                        View Receipt
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="hidden sm:block overflow-x-auto border rounded-lg">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-teal-50/50">
                                                                <TableHead className="text-[10px] font-bold text-teal-700 py-2">Bank Statement Note</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-teal-700 py-2">Receipt No</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-teal-700 py-2">Account</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-teal-700 py-2 text-right">Amount</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-teal-700 py-2">Bank Statement Date</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-teal-700 py-2">Allocation Date</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-teal-700 py-2">Payment Type</TableHead>
                                                                <TableHead className="text-[10px] font-bold text-teal-700 py-2 text-center">Action</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {eftResults.map((item, idx) => {
                                                                const receiptNo = item?.receiptNo ?? '';
                                                                const accountNo = item?._searchAccountId ?? '';
                                                                const amount = Number(item?.amount) || 0;
                                                                const bankDate = item?.bankStatementDate ?? '';
                                                                const allocDate = item?.billingAllocationDate ?? '';
                                                                const bankDesc = item?.bankStatementNote ?? '';
                                                                return (
                                                                    <TableRow key={idx} className="hover:bg-teal-50/30" data-testid={`eft-result-${idx}`}>
                                                                        <TableCell className="text-[11px] font-mono max-w-[280px] truncate" title={bankDesc}>{bankDesc || '-'}</TableCell>
                                                                        <TableCell className="text-[11px] font-mono font-semibold text-teal-700">{receiptNo || '-'}</TableCell>
                                                                        <TableCell className="text-[11px] font-mono font-medium">{accountNo || '-'}</TableCell>
                                                                        <TableCell className="text-[11px] font-mono font-bold text-right text-teal-700">
                                                                            R {amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                                                        </TableCell>
                                                                        <TableCell className="text-[10px] text-slate-600 whitespace-nowrap">
                                                                            {bankDate ? new Date(bankDate).toLocaleDateString('en-ZA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-[10px] text-slate-600 whitespace-nowrap">
                                                                            {allocDate ? new Date(allocDate).toLocaleDateString('en-ZA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-[11px]">
                                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">EFT</span>
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                            {receiptNo ? (
                                                                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 text-teal-700 border-teal-300 hover:bg-teal-50" onClick={() => handleLoadReceiptFromEft(item)} data-testid={`button-eft-view-${idx}`}>
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
                                        );
                                    })()}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                            <div className="flex items-center gap-3">
                                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    Receipt Information
                                    {totalCount > 0 && <Badge variant="secondary" className="text-xs font-normal">{totalCount} records</Badge>}
                                    {dataSource === 'platinum' && totalCount > 0 && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-[#6B6B6B] border-[#D6D6D6] bg-[#F7F7F7] font-normal" data-testid="badge-source-platinum">Platinum</Badge>
                                    )}
                                </h2>
                            </div>
                            <div className="flex gap-2 items-center">
                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" disabled={currentPage <= 1 || isLoading} onClick={() => handleSearch(currentPage - 1)}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="text-xs text-slate-600 px-2">{currentPage}/{totalPages}</span>
                                        <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" disabled={currentPage >= totalPages || isLoading} onClick={() => handleSearch(currentPage + 1)}>
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
                                        <Input className="h-10 sm:h-8 pl-8 text-sm bg-white" placeholder="Quick search in results..." value={quickSearch} onChange={e => setQuickSearch(e.target.value)} data-testid="input-quick-search" />
                                        {quickSearch && (
                                            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setQuickSearch('')} type="button">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>

                                    <Button variant={showFilters ? "default" : "outline"} size="sm" className={cn("h-10 sm:h-8 text-xs gap-1.5", showFilters && "bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)]")} onClick={() => setShowFilters(!showFilters)} data-testid="button-toggle-filters">
                                        <SlidersHorizontal className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Filters</span>
                                        {activeFilterCount > 0 && (
                                            <span className={cn("inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold", showFilters ? "bg-white text-[var(--pos-accent)]" : "bg-[var(--pos-accent)] text-white")}>
                                                {activeFilterCount}
                                            </span>
                                        )}
                                    </Button>

                                    {activeFilterCount > 0 && (
                                        <Button variant="ghost" size="sm" className="h-10 sm:h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2" onClick={clearAllFilters} data-testid="button-clear-filters">
                                            <X className="w-3 h-3 mr-1" /> Clear
                                        </Button>
                                    )}

                                    <div className="hidden sm:flex items-center gap-3 ml-auto text-xs text-slate-500">
                                        {activeFilterCount > 0 && filteredReceipts.length !== receipts.length && (
                                            <span className="font-medium text-[var(--pos-accent)]">{filteredReceipts.length} of {receipts.length} shown</span>
                                        )}
                                        <span className="font-mono font-medium text-slate-700">
                                            Total: R {filteredTotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {showFilters && (
                                    <div className="p-2 sm:p-3 bg-[#F7F7F7] border-b">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                                            <div>
                                                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Payment Method</label>
                                                <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                                                    <SelectTrigger className="h-8 text-xs bg-white" data-testid="select-filter-payment-method"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__all__">All Methods</SelectItem>
                                                        {uniquePaymentMethods.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Payment Type</label>
                                                <Select value={filterPaymentType} onValueChange={setFilterPaymentType}>
                                                    <SelectTrigger className="h-8 text-xs bg-white" data-testid="select-filter-payment-type"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__all__">All Types</SelectItem>
                                                        {uniquePaymentTypes.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Payment Option</label>
                                                <Select value={filterPaymentOption} onValueChange={setFilterPaymentOption}>
                                                    <SelectTrigger className="h-8 text-xs bg-white" data-testid="select-filter-payment-option"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__all__">All Options</SelectItem>
                                                        {uniquePaymentOptions.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
                                                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                                                    <SelectTrigger className="h-8 text-xs bg-white" data-testid="select-filter-status"><SelectValue /></SelectTrigger>
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
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-[var(--pos-accent-tint)] text-[#2E2E2E] border-[var(--pos-accent-shadow)] hover:bg-[var(--pos-accent-tint-strong)] cursor-pointer" onClick={() => setQuickSearch('')}>
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
                                        <span className="font-medium text-[var(--pos-accent)]">{filteredReceipts.length} of {receipts.length} shown</span>
                                    )}
                                    <span className="font-mono font-medium text-slate-700 ml-auto">
                                        Total: R {filteredTotal.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}

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
                                    No receipts found. Use the search tabs above to find receipts.
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
                                                <div className="font-mono text-sm font-medium text-[var(--pos-accent)]">{receiptNo || '-'}</div>
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
                                            <Button variant="outline" size="sm" className="h-10 text-xs px-3 active:scale-[0.99]" onClick={() => handlePrintReceipt(receipt)} disabled={printingReceiptId !== null} data-testid={`mobile-receipt-print-${idx}`}>
                                                {printingReceiptId === serialNo ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Printer className="w-3 h-3 mr-1" />} Print
                                            </Button>
                                        </div>
                                        {cashier && <div className="text-[10px] text-muted-foreground mt-1">Cashier: {cashier}</div>}
                                    </Card>
                                );
                            })}
                        </div>

                        <div className="hidden sm:block flex-1 border rounded-md bg-white shadow-sm overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-100 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-[50px] font-bold text-slate-700">No</TableHead>
                                        <TableHead className="min-w-[120px] font-bold text-slate-700 cursor-pointer select-none hover:text-[var(--pos-accent)]" onClick={() => handleSort('accountNumber')}>
                                            <span className="inline-flex items-center">Account ID <HelpTip text="The municipal account number linked to this receipt." size="sm" /> <SortIcon field="accountNumber" /></span>
                                        </TableHead>
                                        <TableHead className="min-w-[140px] font-bold text-slate-700 cursor-pointer select-none hover:text-[var(--pos-accent)]" onClick={() => handleSort('receiptNo')}>
                                            <span className="inline-flex items-center">Receipt No <HelpTip text="The unique receipt number issued for this transaction." size="sm" /> <SortIcon field="receiptNo" /></span>
                                        </TableHead>
                                        <TableHead className="min-w-[100px] font-bold text-slate-700">
                                            <span className="inline-flex items-center">Method <HelpTip text="The payment method used (Cash, Credit Card, EFT, Cheque, etc.)." size="sm" /></span>
                                        </TableHead>
                                        <TableHead className="min-w-[100px] font-bold text-slate-700 cursor-pointer select-none hover:text-[var(--pos-accent)]" onClick={() => handleSort('paymentType')}>
                                            <span className="inline-flex items-center">Payment Type <HelpTip text="The type of payment classification for this transaction." size="sm" /> <SortIcon field="paymentType" /></span>
                                        </TableHead>
                                        <TableHead className="min-w-[150px] font-bold text-slate-700 cursor-pointer select-none hover:text-[var(--pos-accent)]" onClick={() => handleSort('paymentOption')}>
                                            <span className="inline-flex items-center">Payment Option <SortIcon field="paymentOption" /></span>
                                        </TableHead>
                                        <TableHead className="min-w-[140px] font-bold text-slate-700 cursor-pointer select-none hover:text-[var(--pos-accent)]" onClick={() => handleSort('receiptDate')}>
                                            <span className="inline-flex items-center">Date/Time <SortIcon field="receiptDate" /></span>
                                        </TableHead>
                                        <TableHead className="min-w-[80px] font-bold text-slate-700">Staged</TableHead>
                                        <TableHead className="min-w-[100px] text-right font-bold text-slate-700 cursor-pointer select-none hover:text-[var(--pos-accent)]" onClick={() => handleSort('amount')}>
                                            <span className="inline-flex items-center justify-end w-full">Amount <HelpTip text="The total amount paid on this receipt." size="sm" /> <SortIcon field="amount" /></span>
                                        </TableHead>
                                        <TableHead className="min-w-[100px] text-right font-bold text-slate-700">Tender</TableHead>
                                        <TableHead className="min-w-[100px] text-right font-bold text-slate-700">Change</TableHead>
                                        <TableHead className="min-w-[150px] font-bold text-slate-700 cursor-pointer select-none hover:text-[var(--pos-accent)]" onClick={() => handleSort('cashierName')}>
                                            <span className="inline-flex items-center">Cashier <SortIcon field="cashierName" /></span>
                                        </TableHead>
                                        <TableHead className="min-w-[200px] font-bold text-slate-700">Cash Book</TableHead>
                                        <TableHead className="min-w-[150px] font-bold text-slate-700">Cashier Office</TableHead>
                                        <TableHead className="min-w-[100px] font-bold text-slate-700 sticky right-[120px] bg-slate-100"><span className="inline-flex items-center">Action <HelpTip text="Generate a new copy of this receipt for the customer." size="sm" /></span></TableHead>
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
                                                No receipts found. Use the search tabs above to find receipts.
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
                                                    <TableCell className="font-mono text-xs font-medium text-[var(--pos-accent)]">{receiptNo}</TableCell>
                                                    <TableCell className="text-xs">
                                                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium",
                                                            payMethod === 'Cash' && "text-green-700 border-green-300 bg-green-50",
                                                            payMethod === 'Credit Card' && "text-sky-700 border-sky-300 bg-sky-50",
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
                                        <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={currentPage <= 1 || isLoading} onClick={() => handleSearch(currentPage - 1)}>
                                            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
                                        </Button>
                                        <span className="px-3">Page {currentPage} of {totalPages}</span>
                                        <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={currentPage >= totalPages || isLoading} onClick={() => handleSearch(currentPage + 1)}>
                                            Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PosLayout>
    );
}
