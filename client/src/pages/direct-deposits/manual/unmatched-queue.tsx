import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, Filter, FileSpreadsheet, FileText, X, HelpCircle, Loader2, ChevronLeft, ChevronRight, Sparkles, Building2, MapPin, Hash, RefreshCw, ChevronDown, ChevronUp, Calendar, Banknote, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { Label } from '@/components/ui/label';
import { HelpTip } from '@/components/ui/help-tip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { platinumGetBankReconPosItemList, platinumCheckSelectedItemProcessed, platinumSearchAccountsPayment, fetchActiveFinYear } from '@/lib/external-api';
import { usePos } from '@/lib/pos-state';
import { useToast } from '@/hooks/use-toast';

interface BankReconPosItem {
  posItem_ID: number;
  dateOfTransaction: string;
  bankReconID: number;
  amount: number;
  reference: string;
  note: string;
  dateCaptured: string;
  capturerID: number;
  dateModified: string | null;
  modifierID: number;
  directDepositTypeID: number | null;
  cashbookTransactionID: number;
  billingAllocated: boolean;
  dateAllocated: string | null;
}

interface SuggestedMatch {
  accountId: number;
  accountNo: string;
  name: string;
  oldAccountCode?: string;
  outstandingAmount?: number;
  matchType: 'account_number' | 'old_account' | 'erf_number' | 'reference';
  matchDetail: string;
  confidence: number;
}

const AREA_ABBREVIATIONS: Record<string, string> = {
  'grg': 'george',
  'oud': 'oudtshoorn',
  'pac': 'pacaltsdorp',
  'her': 'herold',
  'hrl': 'herolds bay',
  'wil': 'wilderness',
  'hoe': 'hoekwil',
  'tou': 'touwsranten',
  'bla': 'blanco',
  'con': 'conville',
  'ros': 'rosemoor',
  'lav': 'lawaaikamp',
  'the': 'thembalethu',
  'bor': 'borchards',
  'uni': 'uniondale',
  'wtr': 'water',
  'mtr': 'meter',
  'pmt': 'payment',
};

function parseDescriptionForClues(note: string, reference: string): { accountNumbers: string[]; erfNumbers: { erf: string; area: string }[]; oldAccountCodes: string[]; keywords: string[] } {
  const text = `${note || ''} ${reference || ''}`.toUpperCase();
  const accountNumbers: string[] = [];
  const erfNumbers: { erf: string; area: string }[] = [];
  const oldAccountCodes: string[] = [];
  const keywords: string[] = [];

  const accPatterns = [
    /USER\s+(\d{4,})/gi,
    /ACC(?:OUNT)?\s*(?:NO\.?|#)?\s*(\d{4,})/gi,
    /(\d{8,})/g,
  ];

  const seenNums = new Set<string>();
  for (const pattern of accPatterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const num = match[1];
      if (num && num.length >= 4 && num.length <= 15 && !seenNums.has(num)) {
        const numVal = parseInt(num, 10);
        if (numVal > 100 && numVal < 999999999999) {
          seenNums.add(num);
          accountNumbers.push(num);
        }
      }
    }
  }

  const erfPatterns = [
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+(?:\/\d+)?)\s*(?:AREA:?\s*)?(\w+)?/gi,
    /ERF\s*(\d+(?:\/\d+)?)\s+(\w+)/gi,
    /ERF(\d+)/gi,
  ];
  for (const pattern of erfPatterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const erfNum = match[1];
      let area = (match[2] || '').toLowerCase().trim();
      if (area && AREA_ABBREVIATIONS[area]) {
        area = AREA_ABBREVIATIONS[area];
      }
      if (erfNum) {
        erfNumbers.push({ erf: erfNum, area: area || 'george' });
      }
    }
  }

  const oldCodePatterns = [
    /SEQ\/?(\w+)/gi,
    /\/(\d{6,})\b/g,
  ];
  for (const pattern of oldCodePatterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const code = match[1];
      if (code && code.length >= 3) {
        oldAccountCodes.push(code);
      }
    }
  }

  for (const [abbr, full] of Object.entries(AREA_ABBREVIATIONS)) {
    const abbrUpper = abbr.toUpperCase();
    if (text.includes(abbrUpper) || text.includes(full.toUpperCase())) {
      if (!keywords.includes(full)) keywords.push(full);
    }
  }

  const areaNames = text.match(/\b(GEORGE|WILDERNESS|PACALTSDORP|BLANCO|CONVILLE|THEMBALETHU|OUDTSHOORN|UNIONDALE|HEROLDS?\s*BAY)\b/gi);
  if (areaNames) {
    for (const area of areaNames) {
      const a = area.toLowerCase();
      if (!keywords.includes(a)) keywords.push(a);
    }
  }

  return { accountNumbers, erfNumbers, oldAccountCodes, keywords };
}

async function searchForSuggestions(note: string, reference: string): Promise<SuggestedMatch[]> {
  const clues = parseDescriptionForClues(note, reference);
  const suggestions: SuggestedMatch[] = [];
  const seenIds = new Set<number>();

  const searchPromises: Promise<void>[] = [];

  for (const accNum of clues.accountNumbers.slice(0, 3)) {
    searchPromises.push(
      platinumSearchAccountsPayment({ accountNo: accNum })
        .catch(() => [])
        .then((rawData: any) => {
          const items = Array.isArray(rawData) ? rawData : rawData?.value || [];
          for (const item of items.slice(0, 3)) {
            const accId = item.account_ID || item.accountID || item.id;
            if (accId && !seenIds.has(accId)) {
              seenIds.add(accId);
              const accountNo = item.accountNumber || item.accountNo || String(accId);
              const nameMatch = accountNo.includes(accNum) || String(accId).includes(accNum);
              suggestions.push({
                accountId: accId,
                accountNo,
                name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
                oldAccountCode: item.oldAccountCode,
                outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
                matchType: 'account_number',
                matchDetail: `Account number contains "${accNum}"`,
                confidence: nameMatch ? 85 : 60,
              });
            }
          }
        })
        .catch(() => {})
    );
  }

  for (const accNum of clues.accountNumbers.slice(0, 2)) {
    searchPromises.push(
      platinumSearchAccountsPayment({ oldAccountCode: accNum })
        .catch(() => [])
        .then((rawData: any) => {
          const items = Array.isArray(rawData) ? rawData : rawData?.value || [];
          for (const item of items.slice(0, 2)) {
            const accId = item.account_ID || item.accountID || item.id;
            if (accId && !seenIds.has(accId)) {
              seenIds.add(accId);
              suggestions.push({
                accountId: accId,
                accountNo: item.accountNumber || item.accountNo || String(accId),
                name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
                oldAccountCode: item.oldAccountCode,
                outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
                matchType: 'old_account',
                matchDetail: `Old account code matches "${accNum}"`,
                confidence: 75,
              });
            }
          }
        })
        .catch(() => {})
    );
  }

  for (const erf of clues.erfNumbers.slice(0, 2)) {
    const erfSearches = [`erf ${erf.erf}`];
    if (erf.area) erfSearches.push(`erf ${erf.erf} ${erf.area}`);

    for (const erfSearch of erfSearches) {
      searchPromises.push(
        platinumSearchAccountsPayment({ name: erfSearch })
          .catch(() => [])
          .then((rawData: any) => {
            const items = Array.isArray(rawData) ? rawData : rawData?.value || [];
            for (const item of items.slice(0, 3)) {
              const accId = item.account_ID || item.accountID || item.id;
              if (accId && !seenIds.has(accId)) {
                seenIds.add(accId);
                const hasAreaMatch = erf.area && (
                  (item.name || '').toLowerCase().includes(erf.area) ||
                  (item.address || '').toLowerCase().includes(erf.area)
                );
                suggestions.push({
                  accountId: accId,
                  accountNo: item.accountNumber || item.accountNo || String(accId),
                  name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
                  oldAccountCode: item.oldAccountCode,
                  outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
                  matchType: 'erf_number',
                  matchDetail: `Property: ERF ${erf.erf}${erf.area ? ` ${erf.area}` : ''}${hasAreaMatch ? ' (area confirmed)' : ''}`,
                  confidence: hasAreaMatch ? 80 : 70,
                });
              }
            }
          })
          .catch(() => {})
      );
    }
  }

  if (clues.keywords.length > 0 && clues.erfNumbers.length === 0 && clues.accountNumbers.length === 0) {
    for (const keyword of clues.keywords.slice(0, 2)) {
      searchPromises.push(
        platinumSearchAccountsPayment({ name: keyword })
          .catch(() => [])
          .then((rawData: any) => {
            const items = Array.isArray(rawData) ? rawData : rawData?.value || [];
            for (const item of items.slice(0, 2)) {
              const accId = item.account_ID || item.accountID || item.id;
              if (accId && !seenIds.has(accId)) {
                seenIds.add(accId);
                suggestions.push({
                  accountId: accId,
                  accountNo: item.accountNumber || item.accountNo || String(accId),
                  name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
                  oldAccountCode: item.oldAccountCode,
                  outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
                  matchType: 'reference',
                  matchDetail: `Area/keyword match: "${keyword}"`,
                  confidence: 40,
                });
              }
            }
          })
          .catch(() => {})
      );
    }
  }

  await Promise.all(searchPromises);

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, 5);
}

export default function UnmatchedQueue() {
  const [searchTerm, setSearchTerm] = useState('');
  const [, setLocation] = useLocation();
  const { currentUser } = usePos();
  const { toast } = useToast();
  const [items, setItems] = useState<BankReconPosItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingItemId, setCheckingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [showHelp, setShowHelp] = useState(false);

  const [txnDateFrom, setTxnDateFrom] = useState<Date | undefined>();
  const [txnDateTo, setTxnDateTo] = useState<Date | undefined>();

  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, SuggestedMatch[]>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<Set<number>>(new Set());

  const loadData = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await platinumGetBankReconPosItemList({
        page: pageNum,
        pageSize,
        orderby: 'dateOfTransaction',
        shortDirection: 'desc',
      });
      const data = result as any;
      const fetchedItems: BankReconPosItem[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(fetchedItems);
      setTotalCount(data?.totalCount ?? fetchedItems.length);
    } catch (e: any) {
      console.error("Failed to load bank recon POS items", e);
      setError(e.message || "Failed to load data from Platinum API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(page);
  }, [page, loadData]);

  const filtered = items.filter(item => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (item.note || '').toLowerCase().includes(term) ||
        (item.reference || '').toLowerCase().includes(term) ||
        item.amount.toString().includes(searchTerm) ||
        item.posItem_ID.toString().includes(searchTerm);
      if (!matchesSearch) return false;
    }
    if (txnDateFrom && txnDateTo) {
      const date = new Date(item.dateOfTransaction);
      if (isValid(date)) {
        if (!isWithinInterval(date, {
          start: startOfDay(txnDateFrom),
          end: endOfDay(txnDateTo)
        })) return false;
      }
    }
    return true;
  });

  const activeFiltersCount = [txnDateFrom].filter(Boolean).length;

  const clearFilters = () => {
    setTxnDateFrom(undefined);
    setTxnDateTo(undefined);
    setSearchTerm('');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleAllocateClick = async (posItemId: number, e?: React.MouseEvent, preselectedAccount?: SuggestedMatch) => {
    if (e) e.stopPropagation();
    setCheckingItemId(posItemId);
    try {
      let finYear = '2025/2026';
      try {
        finYear = await fetchActiveFinYear();
      } catch {}

      const checkUserId = currentUser?.id ? Number(currentUser.id) : -1;
      const result = await platinumCheckSelectedItemProcessed(
        checkUserId,
        finYear,
        posItemId
      );

      const msg = (result?.message || '').toLowerCase();
      const isCashierError = msg.includes('active cashier') || msg.includes('cashier count');
      if (result && result.success === false && !isCashierError) {
        toast({
          title: 'Item Already Processed',
          description: result.message || 'This POS item has already been processed and cannot be allocated.',
          variant: 'destructive',
        });
        return;
      }
      let url = `/direct-deposits/manual/allocate/${posItemId}`;
      if (preselectedAccount) {
        const params = new URLSearchParams();
        params.set('accountId', String(preselectedAccount.accountId));
        params.set('accountNo', preselectedAccount.accountNo);
        params.set('name', preselectedAccount.name);
        const txItem = items.find(i => i.posItem_ID === posItemId);
        if (txItem?.amount) params.set('amount', String(txItem.amount));
        url += `?${params.toString()}`;
      }
      setLocation(url);
    } catch (e: any) {
      console.error("Failed to check item processed status", e);
      let url = `/direct-deposits/manual/allocate/${posItemId}`;
      if (preselectedAccount) {
        const params = new URLSearchParams();
        params.set('accountId', String(preselectedAccount.accountId));
        params.set('accountNo', preselectedAccount.accountNo);
        params.set('name', preselectedAccount.name);
        const txItem = items.find(i => i.posItem_ID === posItemId);
        if (txItem?.amount) params.set('amount', String(txItem.amount));
        url += `?${params.toString()}`;
      }
      setLocation(url);
    } finally {
      setCheckingItemId(null);
    }
  };

  const toggleSuggestion = async (posItemId: number, note: string, reference: string) => {
    if (expandedSuggestion === posItemId) {
      setExpandedSuggestion(null);
      return;
    }
    setExpandedSuggestion(posItemId);
    if (suggestions[posItemId]) return;

    setLoadingSuggestions(prev => new Set(prev).add(posItemId));
    try {
      const results = await searchForSuggestions(note, reference);
      setSuggestions(prev => ({ ...prev, [posItemId]: results }));
    } catch (err) {
      console.error("Failed to get suggestions:", err);
      setSuggestions(prev => ({ ...prev, [posItemId]: [] }));
    } finally {
      setLoadingSuggestions(prev => {
        const next = new Set(prev);
        next.delete(posItemId);
        return next;
      });
    }
  };

  const handleDownload = (fmt: 'excel' | 'pdf') => {
    const element = document.createElement("a");
    const fileContent = "Date,Description,Reference,Amount,Allocated,POS Item ID\n" +
      filtered.map(t => `${t.dateOfTransaction},"${t.note}",${t.reference},${t.amount},${t.billingAllocated},${t.posItem_ID}`).join("\n");
    const fileBlob = new Blob([fileContent], { type: fmt === 'excel' ? "text/csv" : "text/plain" });
    element.href = URL.createObjectURL(fileBlob);
    element.download = `bank_recon_positems.${fmt === 'excel' ? 'csv' : 'txt'}`;
    element.style.display = 'none';
    (document.body || document.documentElement).appendChild(element);
    element.click();
    element.remove();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (confidence >= 60) return 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]';
    return 'bg-[#F2F4F7] text-slate-600 border-[#D6D6D6]';
  };

  const getMatchIcon = (matchType: SuggestedMatch['matchType']) => {
    switch (matchType) {
      case 'account_number': return <Hash className="w-3 h-3" />;
      case 'old_account': return <RotateCcw className="w-3 h-3" />;
      case 'erf_number': return <MapPin className="w-3 h-3" />;
      case 'reference': return <Building2 className="w-3 h-3" />;
    }
  };

  const pageUnmatchedCount = filtered.filter(i => !i.billingAllocated).length;
  const pageAllocatedCount = filtered.filter(i => i.billingAllocated).length;
  const pageTotalAmount = filtered.reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <PosLayout>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E]" data-testid="text-page-title">Direct Deposits: Manual Allocation <HelpTip text="Unallocated EFT and direct deposits awaiting manual allocation to consumer accounts." side="right" /></h1>
                <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Bank Recon POS Items <span className="font-mono font-medium">({totalCount.toLocaleString()} total)</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-xs text-slate-500 gap-1.5" onClick={() => setShowHelp(!showHelp)}>
                    <HelpCircle className="w-3.5 h-3.5" /> Help
                </Button>
                <Link href="/direct-deposits/manual/history">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" data-testid="button-allocation-history">
                        <HistoryIcon className="w-3.5 h-3.5" /> History
                    </Button>
                </Link>
            </div>
          </div>

          {showHelp && (
            <div className="mb-4 p-4 bg-[var(--pos-accent-tint)] border border-[#D6D6D6] rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm text-slate-600">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pos-accent)] text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <div>
                    <h4 className="font-medium text-slate-800 text-sm">Review Items</h4>
                    <p className="text-xs mt-0.5 text-slate-500">Review bank deposits from Platinum. Click the suggestion icon to see smart account matches.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pos-accent)] text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <div>
                    <h4 className="font-medium text-slate-800 text-sm">Search & Filter</h4>
                    <p className="text-xs mt-0.5 text-slate-500">Search by amount, reference, or description. Use date filters to narrow results.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pos-accent)] text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <div>
                    <h4 className="font-medium text-slate-800 text-sm">Allocate Funds</h4>
                    <p className="text-xs mt-0.5 text-slate-500">Click <strong>Allocate</strong> to assign funds to the correct municipal account(s).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
             <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search description, ref, amount..."
                  className="pl-10 h-10 bg-[#F7F7F7] border-[#D6D6D6] rounded-lg focus:bg-white transition-colors text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
                <HelpTip text="Search by reference, amount, or depositor name to find the deposit to allocate." side="bottom" className="absolute right-10 top-1/2 -translate-y-1/2" />
                {searchTerm && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setSearchTerm('')}>
                    <X className="w-4 h-4" />
                  </button>
                )}
             </div>

             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`gap-1.5 h-10 px-3 ${activeFiltersCount > 0 ? 'bg-[var(--pos-accent-tint)] border-[var(--pos-accent)] text-[var(--pos-accent)]' : 'border-[#D6D6D6]'}`} data-testid="button-filter">
                        <Filter className="w-3.5 h-3.5" />
                        <span className="text-xs">{activeFiltersCount > 0 ? `${activeFiltersCount} Filter` : 'Filter'}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 sm:w-96 p-4" align="start">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="font-medium text-sm">Filter Options</h4>
                            {activeFiltersCount > 0 && (
                                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-red-600 hover:text-red-700" onClick={clearFilters}>
                                    Clear all
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Transaction Date Range <HelpTip text="Filter deposits by date range to find specific transactions." side="right" /></Label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1"><DatePicker date={txnDateFrom} setDate={setTxnDateFrom} placeholder="From" className="h-9 text-xs" /></div>
                                <span className="text-muted-foreground text-xs">to</span>
                                <div className="flex-1"><DatePicker date={txnDateTo} setDate={setTxnDateTo} placeholder="To" className="h-9 text-xs" /></div>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
             </Popover>

             <Button variant="outline" size="sm" className="h-10 px-3 gap-1.5 border-[#D6D6D6]" onClick={() => loadData(page)} disabled={loading} data-testid="button-refresh">
                 <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                 <span className="text-xs hidden sm:inline">Refresh</span>
             </Button>

             <div className="hidden sm:block h-8 w-px bg-[#D6D6D6]" />

             <div className="flex gap-1">
               <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-emerald-600" title="Export CSV" onClick={() => handleDownload('excel')} data-testid="button-export-excel">
                  <FileSpreadsheet className="w-4 h-4" />
               </Button>
               <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600" title="Export PDF" onClick={() => handleDownload('pdf')} data-testid="button-export-pdf">
                  <FileText className="w-4 h-4" />
               </Button>
             </div>
          </div>

          <div className="flex items-center gap-3 mt-3 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{pageUnmatchedCount} unmatched</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{pageAllocatedCount} allocated</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-slate-400">on this page ({filtered.length} of {totalCount.toLocaleString()})</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground ml-auto">
              <Banknote className="w-3 h-3" />
              <span>Page total: <span className="font-mono font-medium text-slate-700">R {pageTotalAmount.toFixed(2)}</span></span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
          {error && (
            <Alert variant="destructive" className="mb-3 rounded-xl">
              <AlertTitle>Error loading data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="h-full flex flex-col">
            {/* Mobile card view */}
            <div className="sm:hidden space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--pos-accent)] mb-2" />
                  <span className="text-xs text-muted-foreground">Loading deposits...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16" data-testid="text-empty-state-mobile">
                  <div className="w-14 h-14 rounded-2xl bg-[#F2F4F7] flex items-center justify-center mx-auto mb-3">
                    <Banknote className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">{items.length === 0 ? 'No bank deposits found.' : 'No items match your search.'}</p>
                </div>
              ) : filtered.map(tx => (
                <div key={tx.posItem_ID} data-testid={`card-positem-${tx.posItem_ID}`} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="p-3.5">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-800 truncate">{tx.note || '-'}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          #{tx.posItem_ID} | {tx.dateOfTransaction ? new Date(tx.dateOfTransaction).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </div>
                      </div>
                      {tx.billingAllocated ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0">Allocated</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] shrink-0">Unmatched</Badge>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <Badge variant="secondary" className="font-mono text-[10px]">{tx.reference || '-'}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-800">R {(tx.amount || 0).toFixed(2)}</span>
                        {!tx.billingAllocated && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-500" onClick={(e) => { e.stopPropagation(); toggleSuggestion(tx.posItem_ID, tx.note, tx.reference); }}>
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" className="h-7 text-[10px] bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] px-2" disabled={checkingItemId === tx.posItem_ID} onClick={(e) => handleAllocateClick(tx.posItem_ID, e)} data-testid={`button-allocate-mobile-${tx.posItem_ID}`}>
                              {checkingItemId === tx.posItem_ID ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Allocate <ArrowRight className="ml-1 w-3 h-3" /></>}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedSuggestion === tx.posItem_ID && (
                    <SuggestionPanel
                      posItemId={tx.posItem_ID}
                      suggestions={suggestions[tx.posItem_ID]}
                      loading={loadingSuggestions.has(tx.posItem_ID)}
                      getConfidenceColor={getConfidenceColor}
                      getMatchIcon={getMatchIcon}
                      onAllocate={(posId, account) => handleAllocateClick(posId, undefined, account)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:flex sm:flex-col flex-1 min-h-0 rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b bg-[#F7F7F7]">
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 w-14">ID</th>
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 w-24">Date</th>
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Description</th>
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 w-20">Ref</th>
                    <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 w-28">Amount</th>
                    <th className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 w-24">Status</th>
                    <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 w-36">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--pos-accent)] mb-2" />
                        <span className="text-xs text-muted-foreground">Loading deposits...</span>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center" data-testid="text-empty-state">
                        <div className="w-14 h-14 rounded-2xl bg-[#F2F4F7] flex items-center justify-center mx-auto mb-3">
                          <Banknote className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">{items.length === 0 ? 'No bank deposits found.' : 'No items match your search.'}</p>
                      </td>
                    </tr>
                  ) : filtered.map(tx => (
                    <React.Fragment key={tx.posItem_ID}>
                      <tr
                        data-testid={`row-positem-${tx.posItem_ID}`}
                        className={`transition-colors ${!tx.billingAllocated ? 'cursor-pointer hover:bg-[#F7F7F7]' : ''} ${expandedSuggestion === tx.posItem_ID ? 'bg-amber-50/30' : ''}`}
                        onClick={() => !tx.billingAllocated && checkingItemId === null && handleAllocateClick(tx.posItem_ID)}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{tx.posItem_ID}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-600">
                          <span className="font-mono">{tx.dateOfTransaction ? new Date(tx.dateOfTransaction).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-xs text-slate-700 truncate max-w-[400px]" title={tx.note}>{tx.note || '-'}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[10px] text-slate-500">{tx.reference || '-'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="font-mono text-xs font-semibold text-slate-800">R {(tx.amount || 0).toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {tx.billingAllocated ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Allocated</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Unmatched</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {!tx.billingAllocated && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-8 w-8 p-0 ${expandedSuggestion === tx.posItem_ID ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-amber-600'}`}
                                title="Smart suggestions"
                                onClick={(e) => { e.stopPropagation(); toggleSuggestion(tx.posItem_ID, tx.note, tx.reference); }}
                                data-testid={`button-suggest-${tx.posItem_ID}`}
                              >
                                {loadingSuggestions.has(tx.posItem_ID) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-xs gap-1 px-3"
                                disabled={checkingItemId === tx.posItem_ID}
                                onClick={(e) => handleAllocateClick(tx.posItem_ID, e)}
                                data-testid={`button-allocate-${tx.posItem_ID}`}
                              >
                                {checkingItemId === tx.posItem_ID ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : null}
                                Allocate <ArrowRight className="w-3 h-3" />
                              </Button>
                              <HelpTip text="Open the allocation form to assign this deposit to one or more consumer accounts." side="left" />
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedSuggestion === tx.posItem_ID && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <SuggestionPanel
                              posItemId={tx.posItem_ID}
                              suggestions={suggestions[tx.posItem_ID]}
                              loading={loadingSuggestions.has(tx.posItem_ID)}
                              getConfidenceColor={getConfidenceColor}
                              getMatchIcon={getMatchIcon}
                              onAllocate={(posId, account) => handleAllocateClick(posId, undefined, account)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t bg-[#F7F7F7]/50">
                  <p className="text-xs text-muted-foreground">
                    Page <span className="font-medium text-slate-700">{page}</span> of <span className="font-medium text-slate-700">{totalPages}</span> <span className="text-slate-400">({totalCount.toLocaleString()} items)</span>
                  </p>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-[#D6D6D6]" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-[#D6D6D6]" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile pagination */}
            {totalPages > 1 && (
              <div className="sm:hidden flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">Page {page}/{totalPages}</p>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page-mobile">
                    <ChevronLeft className="w-3 h-3" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} data-testid="button-next-page-mobile">
                    Next <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PosLayout>
  );
}

function SuggestionPanel({ posItemId, suggestions, loading, getConfidenceColor, getMatchIcon, onAllocate }: {
  posItemId: number;
  suggestions?: SuggestedMatch[];
  loading: boolean;
  getConfidenceColor: (c: number) => string;
  getMatchIcon: (t: SuggestedMatch['matchType']) => React.ReactNode;
  onAllocate: (posId: number, account?: SuggestedMatch) => void;
}) {
  return (
    <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/30 border-t border-amber-100 px-5 py-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-amber-800">Smart Suggestions</span>
        <span className="text-[10px] text-amber-600/70">Based on description analysis</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          <span className="text-xs text-amber-700">Analyzing description and searching accounts...</span>
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <div className="py-2 text-xs text-amber-700/70 flex items-center gap-2">
          <Search className="w-3.5 h-3.5" />
          No automatic matches found. Use the Allocate button to search manually.
        </div>
      ) : (
        <div className="space-y-1.5">
          {suggestions.map((s, idx) => (
            <div key={`${s.accountId}-${idx}`} className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-amber-100/60 hover:border-amber-200 transition-colors group">
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-bold ${getConfidenceColor(s.confidence)}`}>
                  {s.confidence}%
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-amber-600 shrink-0">
                {getMatchIcon(s.matchType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-slate-700">{s.accountNo}</span>
                  <span className="text-xs text-slate-500 truncate">{s.name}</span>
                </div>
                <div className="text-[10px] text-amber-600/80 truncate">{s.matchDetail}</div>
              </div>
              {s.outstandingAmount != null && s.outstandingAmount !== 0 && (
                <span className="text-[10px] font-mono text-slate-500 bg-[#F7F7F7] px-1.5 py-0.5 rounded shrink-0">
                  R {s.outstandingAmount.toFixed(2)}
                </span>
              )}
              <Button
                size="sm"
                className="h-7 text-[10px] bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white shrink-0 px-2.5 gap-1"
                onClick={(e) => { e.stopPropagation(); onAllocate(posItemId, s); }}
              >
                Allocate <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryIcon(props: any) {
    return (
        <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
      <path d="M3 3v9h9" />
      <path d="M12 7v5l4 2" />
    </svg>
    )
}
