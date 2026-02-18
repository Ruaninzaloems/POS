import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Search, X, ChevronLeft, User, Phone,
  CreditCard, Droplets, Zap, FileText, Shield, Gift, Landmark,
  AlertTriangle, Clock, ArrowRight, Loader2, SlidersHorizontal,
  Layers, Home, Activity, Users, Receipt, CalendarDays, Banknote, Scale,
  Gauge, Filter, AlertCircle, Briefcase, Star, ScanBarcode, CheckCircle2,
  CircleDot, Wallet, Gauge as MeterIcon, CalendarCheck, Building2
} from 'lucide-react';
import {
  searchAccounts, getAccountBalance, multiAutocompleteSearch, getAutocompleteType,
  autocomplete,
  type EnquirySearchCriteria, type EnquirySearchResult,
} from '@/lib/enquiries-service';

import { ErrorState } from './enquiries/shared';
import { AccountInfoTab, NameTab, BalanceDebtTab, LinkedAccountsTab } from './enquiries/account-tabs';
import { ServiceBalanceTab, ConsumptionTab, ServicesMetersTab } from './enquiries/service-tabs';
import { TransactionSummaryTab, DetailedTransactionListTab, TransactionHistoryTab } from './enquiries/transaction-tabs';
import { IncentivesTab, DepositsTab, PaymentPlansTab, PaymentExtensionHistoryTab, DebitOrdersTab, RatesValuationsTab } from './enquiries/financial-tabs';
import { PropertyDetailsTab, ContactInfoTab, HandoverTab, NotificationsTab, StatementsTab, ClearanceTab, DebtorNotesTab, Section129Tab, OccupiersTab } from './enquiries/other-tabs';
import { SEARCH_FIELDS, detectSearchType, SmartSearchDropdown, ExpandableResultRow } from './enquiries/search-components';

function FieldAutocompleteInput({ fieldKey, placeholder, value, onChange, onSelectAndSearch, onEnter, onAutoResults }: {
  fieldKey: string; placeholder: string; value: string;
  onChange: (key: string, val: string) => void;
  onSelectAndSearch: (key: string, val: string, accountId: number) => void;
  onEnter: () => void;
  onAutoResults?: (accountIds: number[]) => void;
}) {
  const [suggestions, setSuggestions] = useState<{ displayItem: string; accountId: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (val: string) => {
    onChange(fieldKey, val);
    if (debRef.current) clearTimeout(debRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    const acType = getAutocompleteType(fieldKey);
    if (!acType) return;
    setLoading(true);
    debRef.current = setTimeout(async () => {
      const tok = ++tokenRef.current;
      try {
        const items = await autocomplete(val.trim(), acType);
        if (tokenRef.current !== tok) return;
        const valid = items.filter(s => s.accountId && s.accountId > 0);
        setSuggestions(valid.slice(0, 20));
        setOpen(true);
        const uniqueIds = [...new Set(valid.map(s => s.accountId))].slice(0, 5);
        if (uniqueIds.length > 0 && onAutoResults) onAutoResults(uniqueIds);
      } catch {
        if (tokenRef.current === tok) setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { setOpen(false); onEnter(); } if (e.key === 'Escape') setOpen(false); }}
        className="w-full h-8 px-2 text-xs rounded border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        data-testid={`input-field-${fieldKey}`}
      />
      {loading && <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 animate-spin" />}
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded shadow-lg z-50 max-h-[200px] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={`${s.accountId}-${i}`}
              onClick={() => {
                onChange(fieldKey, s.displayItem);
                setOpen(false);
                onSelectAndSearch(fieldKey, s.displayItem, s.accountId);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
              data-testid={`suggestion-${fieldKey}-${i}`}
            >
              {s.displayItem}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneralEnquiriesContent() {
  const [quickQuery, setQuickQuery] = useState('');
  const [criteria, setCriteria] = useState<EnquirySearchCriteria>({});
  const [dropdownResults, setDropdownResults] = useState<EnquirySearchResult[]>([]);
  const [results, setResults] = useState<EnquirySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownSearching, setDropdownSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EnquirySearchResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<'quick' | 'advanced'>('quick');
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [headerBalance, setHeaderBalance] = useState<number | null>(null);
  const [pinnedAccounts, setPinnedAccounts] = useState<EnquirySearchResult[]>([]);
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = Object.values(criteria).filter(v => v && String(v).trim()).length;

  const toggleQuickFilter = (filter: string) => {
    setQuickFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  const togglePinAccount = (account: EnquirySearchResult) => {
    const id = account.account_ID || account.accountID;
    setPinnedAccounts(prev => {
      const exists = prev.some(a => (a.account_ID || a.accountID) === id);
      if (exists) return prev.filter(a => (a.account_ID || a.accountID) !== id);
      return [...prev, account].slice(0, 10);
    });
  };

  const isAccountPinned = (account: EnquirySearchResult) => {
    const id = account.account_ID || account.accountID;
    return pinnedAccounts.some(a => (a.account_ID || a.accountID) === id);
  };

  const detectedType = useMemo(() => detectSearchType(quickQuery), [quickQuery]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedAccount) { setHeaderBalance(null); return; }
    const id = selectedAccount.account_ID || selectedAccount.accountID;
    if (!id) return;
    setHeaderBalance(null);
    getAccountBalance(id).then((bal: any) => {
      if (Array.isArray(bal)) {
        const total = bal.reduce((sum: number, s: any) => sum + (s.totalOutStanding || 0), 0);
        setHeaderBalance(total);
      } else {
        const total = bal?.totalBalance ?? bal?.totalDue ?? bal?.balance ?? bal?.outstandingBalance ?? null;
        if (total !== null && total !== undefined) setHeaderBalance(Number(total));
      }
    }).catch(() => {});
  }, [selectedAccount]);

  const quickSearchTokenRef = useRef(0);
  const fullSearchTokenRef = useRef(0);
  const balanceCacheRef = useRef<Map<number, number>>(new Map());

  const enrichWithBalances = useCallback(async (accounts: EnquirySearchResult[], tokenRef: React.MutableRefObject<number>, token: number, setter: (val: EnquirySearchResult[]) => void) => {
    const applyCache = (accts: EnquirySearchResult[]) => accts.map(acct => {
      const id = acct.account_ID || acct.accountID;
      const cached = id ? balanceCacheRef.current.get(id) : undefined;
      return cached !== undefined ? { ...acct, outStandingAmount: cached, _balanceEnriched: true } : acct;
    });

    const toFetch = accounts.filter(acct => {
      const id = acct.account_ID || acct.accountID;
      return id && !balanceCacheRef.current.has(id);
    });

    if (toFetch.length === 0) {
      if (tokenRef.current === token) setter(applyCache(accounts));
      return;
    }

    const BATCH = 5;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      if (tokenRef.current !== token) return;
      const batch = toFetch.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (acct) => {
        const id = acct.account_ID || acct.accountID;
        if (!id) return;
        try {
          const balanceData = await getAccountBalance(id);
          if (balanceData) {
            let bal: number | undefined;
            if (Array.isArray(balanceData)) {
              bal = balanceData.reduce((sum: number, svc: any) => sum + (svc.totalOutStanding ?? svc.totalOutstanding ?? 0), 0);
            } else {
              bal = balanceData.totalBalance ?? balanceData.totalOutstanding ?? balanceData.outStandingAmount ?? balanceData.balance;
            }
            if (bal !== undefined && bal !== null) {
              balanceCacheRef.current.set(id, bal);
            }
          }
        } catch {}
      }));
      if (tokenRef.current === token) setter(applyCache([...accounts]));
    }
  }, []);

  const doQuickSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setDropdownResults([]);
      setDropdownSearching(false);
      return;
    }
    setDropdownSearching(true);
    const { field } = detectSearchType(query);
    const token = ++quickSearchTokenRef.current;
    try {
      let data: EnquirySearchResult[];
      const [multiAcData, enquiryData] = await Promise.allSettled([
        multiAutocompleteSearch(query.trim()),
        searchAccounts({ [field]: query.trim() } as any),
      ]);
      if (quickSearchTokenRef.current !== token) return;
      const acResults = multiAcData.status === 'fulfilled' ? multiAcData.value.results : [];
      const eqResults = enquiryData.status === 'fulfilled' ? enquiryData.value : [];
      const seen = new Set<number>();
      data = [];
      for (const r of [...eqResults, ...acResults]) {
        const id = r.account_ID || r.accountID;
        if (id && !seen.has(id)) { seen.add(id); data.push(r); }
      }
      if (quickSearchTokenRef.current !== token) return;
      setDropdownResults(data);
      setShowDropdown(true);
      enrichWithBalances(data, quickSearchTokenRef, token, setDropdownResults);
    } catch (e: any) {
      if (quickSearchTokenRef.current === token) setDropdownResults([]);
    } finally {
      setDropdownSearching(false);
    }
  }, [enrichWithBalances]);

  const handleQuickQueryChange = (val: string) => {
    setQuickQuery(val);
    setHighlightIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      setShowDropdown(true);
      setDropdownSearching(true);
      debounceRef.current = setTimeout(() => doQuickSearch(val), 400);
    } else {
      setShowDropdown(val.trim().length > 0);
      setDropdownResults([]);
      setDropdownSearching(false);
    }
  };

  const handleSelectAccount = (account: EnquirySearchResult) => {
    setSelectedAccount(account);
    setActiveTab('account');
    setShowDropdown(false);
    const term = quickQuery.trim();
    if (term && !recentSearches.includes(term)) {
      setRecentSearches(prev => [term, ...prev].slice(0, 8));
    }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, Math.min(dropdownResults.length - 1, 49)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < dropdownResults.length) {
        handleSelectAccount(dropdownResults[highlightIdx]);
      } else {
        handleFullSearch();
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightIdx(-1);
    }
  };

  const handleFullSearch = useCallback(async () => {
    const hasQuick = quickQuery.trim().length >= 2;
    const hasAdvanced = Object.values(criteria).some(v => v && String(v).trim());
    if (!hasQuick && !hasAdvanced) return;

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setShowDropdown(false);
    const term = quickQuery.trim();
    if (term && !recentSearches.includes(term)) {
      setRecentSearches(prev => [term, ...prev].slice(0, 8));
    }
    const token = ++fullSearchTokenRef.current;
    try {
      let searchCriteria: EnquirySearchCriteria = { ...criteria };
      if (hasQuick) {
        const { field } = detectSearchType(quickQuery);
        searchCriteria = { ...searchCriteria, [field]: quickQuery.trim() };
      }
      let data: EnquirySearchResult[];
      if (hasQuick && !hasAdvanced) {
        const mainPromise = searchAccounts(searchCriteria);
        const acPromise = multiAutocompleteSearch(quickQuery.trim());
        const mainResults = await mainPromise;
        if (fullSearchTokenRef.current !== token) return;
        setResults(mainResults);
        setSearching(false);
        enrichWithBalances(mainResults, fullSearchTokenRef, token, setResults);
        try {
          const acData = await acPromise;
          if (fullSearchTokenRef.current !== token) return;
          const acResults = acData.results || [];
          if (acResults.length > 0) {
            const seen = new Set<number>();
            data = [];
            for (const r of [...mainResults, ...acResults]) {
              const id = r.account_ID || r.accountID;
              if (id && !seen.has(id)) { seen.add(id); data.push(r); }
            }
            setResults(data);
            enrichWithBalances(data, fullSearchTokenRef, token, setResults);
          }
        } catch {}
        return;
      } else {
        data = await searchAccounts(searchCriteria);
      }
      if (fullSearchTokenRef.current !== token) return;
      setResults(data);
      enrichWithBalances(data, fullSearchTokenRef, token, setResults);
    } catch (e: any) {
      if (fullSearchTokenRef.current === token) {
        setSearchError(e.message || 'Search failed');
        setResults([]);
      }
    } finally {
      setSearching(false);
    }
  }, [quickQuery, criteria, recentSearches, enrichWithBalances]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setCriteria(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAutoResults = useCallback(async (accountIds: number[]) => {
    const token = ++fullSearchTokenRef.current;
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const lookups = await Promise.allSettled(
        accountIds.map(id =>
          searchAccounts({ accountNo: String(id) })
        )
      );
      if (fullSearchTokenRef.current !== token) return;
      const all: EnquirySearchResult[] = [];
      const seen = new Set<number>();
      for (const r of lookups) {
        if (r.status === 'fulfilled') {
          for (const acct of r.value) {
            const aid = acct.account_ID || acct.accountID;
            if (aid && !seen.has(aid)) { seen.add(aid); all.push(acct); }
          }
        }
      }
      setResults(all);
      setSearching(false);
      enrichWithBalances(all, fullSearchTokenRef, token, setResults);
    } catch {
      if (fullSearchTokenRef.current === token) setResults([]);
    } finally {
      setSearching(false);
    }
  }, [enrichWithBalances]);

  const handleFieldSelect = useCallback(async (key: string, displayValue: string, accountId: number) => {
    const token = ++fullSearchTokenRef.current;
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setShowDropdown(false);
    try {
      const data = await searchAccounts({ accountNo: String(accountId) });
      if (fullSearchTokenRef.current !== token) return;
      setResults(data);
      setSearching(false);
      enrichWithBalances(data, fullSearchTokenRef, token, setResults);
    } catch (e: any) {
      if (fullSearchTokenRef.current === token) {
        setSearchError(e.message || 'Search failed');
        setResults([]);
      }
    } finally {
      setSearching(false);
    }
  }, [enrichWithBalances]);

  const handleClear = () => {
    setQuickQuery('');
    setCriteria({});
    setResults([]);
    setDropdownResults([]);
    setHasSearched(false);
    setSearchError(null);
    setSelectedAccount(null);
    setShowDropdown(false);
    setHighlightIdx(-1);
    inputRef.current?.focus();
  };

  const QUICK_FILTER_CHIPS = [
    { key: 'active', label: 'Active', icon: <CheckCircle2 className="w-3 h-3" /> },
    { key: 'owner', label: 'Owner/Occupier', icon: <User className="w-3 h-3" /> },
    { key: 'arrears', label: 'In Arrears', icon: <Wallet className="w-3 h-3" /> },
    { key: 'meter', label: 'Has Meter', icon: <Gauge className="w-3 h-3" /> },
    { key: 'payplan', label: 'Has Pay Plan', icon: <CalendarCheck className="w-3 h-3" /> },
  ];

  const EXAMPLE_SEARCHES = [
    { value: '000000003698', label: 'Account Number' },
    { value: 'Van der Merwe', label: 'Name' },
    { value: '8501015012087', label: 'ID Number' },
    { value: '0821234567', label: 'Phone' },
  ];

  const filteredResults = useMemo(() => {
    if (quickFilters.size === 0) return results;
    return results.filter(account => {
      const status = (account.accountStatus || account.statusDesc || '').toLowerCase();
      const accType = (account.accountType || account.accountDesc || '').toLowerCase();
      const outstanding = account.outStandingAmount ?? account.outStandingAmt ?? 0;
      if (quickFilters.has('active') && status !== 'active') return false;
      if (quickFilters.has('owner') && !accType.includes('occupier') && !accType.includes('owner')) return false;
      if (quickFilters.has('arrears') && outstanding <= 0) return false;
      return true;
    });
  }, [results, quickFilters]);

  if (selectedAccount) {
    const accountId = selectedAccount.account_ID || selectedAccount.accountID;
    const propertyId = selectedAccount.propertyID ? Number(selectedAccount.propertyID) : (selectedAccount.unitID || selectedAccount.unitPartitionID || undefined);
    const unitId = selectedAccount.unitID || undefined;
    const isActive = (selectedAccount.accountStatus || selectedAccount.statusDesc)?.toLowerCase() === 'active';
    const accountName = selectedAccount.name || selectedAccount.surname_Company || 'Unknown';
    const accountNum = selectedAccount.accountNumber || selectedAccount.accountID || selectedAccount.account_ID;

    type TabItem = { value: string; label: string; icon: React.ReactNode; color: string };
    type TabGroup = { heading: string; tabs: TabItem[] };

    const tabGroups: TabGroup[] = [
      {
        heading: 'ACCOUNT & PARTY',
        tabs: [
          { value: 'account', label: 'Account', icon: <User className="w-3.5 h-3.5" />, color: 'blue' },
          { value: 'name', label: 'Name', icon: <Users className="w-3.5 h-3.5" />, color: 'indigo' },
          { value: 'property', label: 'Property', icon: <Home className="w-3.5 h-3.5" />, color: 'amber' },
          { value: 'linked-accounts', label: 'Linked Accounts', icon: <Building2 className="w-3.5 h-3.5" />, color: 'purple' },
          { value: 'occupiers', label: 'Occupiers', icon: <Users className="w-3.5 h-3.5" />, color: 'violet' },
          { value: 'contact', label: 'Contact', icon: <Phone className="w-3.5 h-3.5" />, color: 'violet' },
          { value: 'handover', label: 'Handover', icon: <ArrowRight className="w-3.5 h-3.5" />, color: 'orange' },
        ],
      },
      {
        heading: 'SERVICES & CONSUMPTION',
        tabs: [
          { value: 'services', label: 'Services', icon: <Layers className="w-3.5 h-3.5" />, color: 'emerald' },
          { value: 'services-meters', label: 'Meters', icon: <Gauge className="w-3.5 h-3.5" />, color: 'emerald' },
          { value: 'consumption', label: 'Consumption', icon: <Droplets className="w-3.5 h-3.5" />, color: 'cyan' },
        ],
      },
      {
        heading: 'FINANCIAL',
        tabs: [
          { value: 'balance', label: 'Balance / Debt', icon: <CreditCard className="w-3.5 h-3.5" />, color: 'red' },
          { value: 'txn-detailed', label: 'Transaction Detail', icon: <Activity className="w-3.5 h-3.5" />, color: 'indigo' },
          { value: 'txn-summary', label: 'Transaction Summary', icon: <FileText className="w-3.5 h-3.5" />, color: 'slate' },
          { value: 'transactions', label: 'Receipts', icon: <Receipt className="w-3.5 h-3.5" />, color: 'blue' },
          { value: 'deposits', label: 'Deposits', icon: <Banknote className="w-3.5 h-3.5" />, color: 'lime' },
          { value: 'payment-plans', label: 'Payment Plans', icon: <CalendarDays className="w-3.5 h-3.5" />, color: 'purple' },
          { value: 'payment-extensions', label: 'Extensions', icon: <Clock className="w-3.5 h-3.5" />, color: 'amber' },
        ],
      },
      {
        heading: 'BILLING & TARIFFS',
        tabs: [
          { value: 'rates', label: 'Rates', icon: <Scale className="w-3.5 h-3.5" />, color: 'orange' },
          { value: 'debit-orders', label: 'Debit Orders', icon: <Landmark className="w-3.5 h-3.5" />, color: 'teal' },
          { value: 'statements', label: 'Statements', icon: <FileText className="w-3.5 h-3.5" />, color: 'blue' },
        ],
      },
      {
        heading: 'COMPLIANCE & LEGAL',
        tabs: [
          { value: 'clearance', label: 'Clearance', icon: <Shield className="w-3.5 h-3.5" />, color: 'emerald' },
          { value: 'debtor-notes', label: 'Debtor Notes', icon: <Briefcase className="w-3.5 h-3.5" />, color: 'red' },
          { value: 'section129', label: 'Section 129', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'rose' },
        ],
      },
      {
        heading: 'NOTIFICATIONS & INCENTIVES',
        tabs: [
          { value: 'notifications', label: 'Notifications', icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'yellow' },
          { value: 'incentives', label: 'Incentives', icon: <Gift className="w-3.5 h-3.5" />, color: 'pink' },
        ],
      },
    ];

    const tabColorMap: Record<string, { bg: string; border: string; text: string; iconBg: string; activeBg: string; activeBorder: string; activeText: string; activeIconBg: string }> = {
      blue: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-blue-50 text-blue-500', activeBg: 'bg-blue-50', activeBorder: 'border-blue-400 ring-1 ring-blue-200', activeText: 'text-blue-800', activeIconBg: 'bg-blue-500 text-white' },
      indigo: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-indigo-50 text-indigo-500', activeBg: 'bg-indigo-50', activeBorder: 'border-indigo-400 ring-1 ring-indigo-200', activeText: 'text-indigo-800', activeIconBg: 'bg-indigo-500 text-white' },
      red: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-red-50 text-red-500', activeBg: 'bg-red-50', activeBorder: 'border-red-400 ring-1 ring-red-200', activeText: 'text-red-800', activeIconBg: 'bg-red-500 text-white' },
      emerald: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-emerald-50 text-emerald-500', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-400 ring-1 ring-emerald-200', activeText: 'text-emerald-800', activeIconBg: 'bg-emerald-500 text-white' },
      amber: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-amber-50 text-amber-600', activeBg: 'bg-amber-50', activeBorder: 'border-amber-400 ring-1 ring-amber-200', activeText: 'text-amber-800', activeIconBg: 'bg-amber-500 text-white' },
      cyan: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-cyan-50 text-cyan-500', activeBg: 'bg-cyan-50', activeBorder: 'border-cyan-400 ring-1 ring-cyan-200', activeText: 'text-cyan-800', activeIconBg: 'bg-cyan-500 text-white' },
      violet: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-violet-50 text-violet-500', activeBg: 'bg-violet-50', activeBorder: 'border-violet-400 ring-1 ring-violet-200', activeText: 'text-violet-800', activeIconBg: 'bg-violet-500 text-white' },
      orange: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-orange-50 text-orange-500', activeBg: 'bg-orange-50', activeBorder: 'border-orange-400 ring-1 ring-orange-200', activeText: 'text-orange-800', activeIconBg: 'bg-orange-500 text-white' },
      pink: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-pink-50 text-pink-500', activeBg: 'bg-pink-50', activeBorder: 'border-pink-400 ring-1 ring-pink-200', activeText: 'text-pink-800', activeIconBg: 'bg-pink-500 text-white' },
      lime: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-lime-50 text-lime-600', activeBg: 'bg-lime-50', activeBorder: 'border-lime-400 ring-1 ring-lime-200', activeText: 'text-lime-800', activeIconBg: 'bg-lime-500 text-white' },
      slate: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-slate-100 text-slate-500', activeBg: 'bg-slate-100', activeBorder: 'border-slate-400 ring-1 ring-slate-300', activeText: 'text-slate-800', activeIconBg: 'bg-slate-600 text-white' },
      purple: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-purple-50 text-purple-500', activeBg: 'bg-purple-50', activeBorder: 'border-purple-400 ring-1 ring-purple-200', activeText: 'text-purple-800', activeIconBg: 'bg-purple-500 text-white' },
      teal: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-teal-50 text-teal-500', activeBg: 'bg-teal-50', activeBorder: 'border-teal-400 ring-1 ring-teal-200', activeText: 'text-teal-800', activeIconBg: 'bg-teal-500 text-white' },
      yellow: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-yellow-50 text-yellow-600', activeBg: 'bg-yellow-50', activeBorder: 'border-yellow-400 ring-1 ring-yellow-200', activeText: 'text-yellow-800', activeIconBg: 'bg-yellow-500 text-white' },
      rose: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-rose-50 text-rose-500', activeBg: 'bg-rose-50', activeBorder: 'border-rose-400 ring-1 ring-rose-200', activeText: 'text-rose-800', activeIconBg: 'bg-rose-500 text-white' },
    };

    return (
      <div className="flex flex-col h-full overflow-hidden bg-slate-50/80">
        <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm">
          <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
            <button
              onClick={() => setSelectedAccount(null)}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors group"
              data-testid="button-back-to-results"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>

            <div className="h-8 w-px bg-slate-200" />

            <div className="shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {accountName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-bold text-slate-900 truncate" data-testid="text-selected-account-name">
                  {accountName}
                </h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {selectedAccount.accountStatus || selectedAccount.statusDesc || 'Unknown'}
                </span>
                {(selectedAccount.accountType || selectedAccount.accountDesc) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200" data-testid="badge-account-type">
                    {selectedAccount.accountType || selectedAccount.accountDesc}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono">
                Acc: {accountNum}
                {selectedAccount.oldAccountCode && <span className="text-slate-400"> | Old: {selectedAccount.oldAccountCode}</span>}
              </div>
            </div>

            <div className="shrink-0 ml-auto text-right pl-4" data-testid="header-balance-section">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">Outstanding Balance</div>
              {headerBalance !== null ? (
                <div className={`text-xl font-bold font-mono tracking-tight ${headerBalance > 0 ? 'text-red-600' : headerBalance < 0 ? 'text-emerald-600' : 'text-slate-800'}`} data-testid="text-header-balance">
                  R {headerBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              ) : (
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="shrink-0 bg-white border-b border-slate-200 sticky top-0 z-20">
              <div className="px-4 sm:px-5 py-3">
                <TabsList className="h-auto bg-transparent p-0 w-full block">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                    {tabGroups.map((group) => (
                      <div key={group.heading}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group.heading}</div>
                        <div className="flex flex-wrap gap-1">
                          {group.tabs.map(tab => {
                            const colors = tabColorMap[tab.color] || tabColorMap.blue;
                            const isTabActive = activeTab === tab.value;
                            return (
                              <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={`
                                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium
                                  transition-all duration-150 cursor-pointer
                                  ${isTabActive
                                    ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText} shadow-sm font-semibold`
                                    : `${colors.bg} ${colors.border} ${colors.text} hover:border-slate-300 hover:bg-slate-50`
                                  }
                                `}
                                data-testid={`tab-${tab.value}`}
                              >
                                <span className={`shrink-0 w-4.5 h-4.5 rounded flex items-center justify-center transition-colors ${isTabActive ? colors.activeIconBg : colors.iconBg}`}>
                                  {tab.icon}
                                </span>
                                {tab.label}
                              </TabsTrigger>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsList>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-50/80 to-slate-100/50">
              <TabsContent value="account" className="m-0"><AccountInfoTab account={selectedAccount} /></TabsContent>
              <TabsContent value="name" className="m-0"><NameTab accountId={accountId} /></TabsContent>
              <TabsContent value="balance" className="m-0"><BalanceDebtTab accountId={accountId} /></TabsContent>
              <TabsContent value="services" className="m-0"><ServiceBalanceTab accountId={accountId} /></TabsContent>
              <TabsContent value="property" className="m-0"><PropertyDetailsTab accountId={accountId} /></TabsContent>
              <TabsContent value="consumption" className="m-0"><ConsumptionTab accountId={accountId} /></TabsContent>
              <TabsContent value="contact" className="m-0"><ContactInfoTab accountId={accountId} /></TabsContent>
              <TabsContent value="handover" className="m-0"><HandoverTab accountId={accountId} /></TabsContent>
              <TabsContent value="incentives" className="m-0"><IncentivesTab accountId={accountId} /></TabsContent>
              <TabsContent value="deposits" className="m-0"><DepositsTab accountId={accountId} /></TabsContent>
              <TabsContent value="transactions" className="m-0"><TransactionHistoryTab accountId={accountId} accountNumber={selectedAccount.accountNumber || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="txn-summary" className="m-0"><TransactionSummaryTab accountId={accountId} accountNumber={selectedAccount.accountNumber || selectedAccount.oldAccountCode || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="txn-detailed" className="m-0"><DetailedTransactionListTab accountId={accountId} /></TabsContent>
              <TabsContent value="services-meters" className="m-0"><ServicesMetersTab accountId={accountId} unitId={unitId} /></TabsContent>
              <TabsContent value="payment-plans" className="m-0"><PaymentPlansTab accountId={accountId} /></TabsContent>
              <TabsContent value="payment-extensions" className="m-0"><PaymentExtensionHistoryTab accountId={accountId} /></TabsContent>
              <TabsContent value="debit-orders" className="m-0"><DebitOrdersTab accountId={accountId} /></TabsContent>
              <TabsContent value="rates" className="m-0"><RatesValuationsTab accountId={accountId} propertyId={propertyId} /></TabsContent>
              <TabsContent value="notifications" className="m-0"><NotificationsTab accountId={accountId} /></TabsContent>
              <TabsContent value="statements" className="m-0"><StatementsTab accountId={accountId} /></TabsContent>
              <TabsContent value="clearance" className="m-0"><ClearanceTab accountId={accountId} /></TabsContent>
              <TabsContent value="debtor-notes" className="m-0"><DebtorNotesTab accountId={accountId} /></TabsContent>
              <TabsContent value="section129" className="m-0"><Section129Tab accountId={accountId} /></TabsContent>
              <TabsContent value="linked-accounts" className="m-0"><LinkedAccountsTab accountId={accountId} onSelectAccount={(acct) => { setSelectedAccount(acct); setActiveTab('account'); }} /></TabsContent>
              <TabsContent value="occupiers" className="m-0"><OccupiersTab accountId={accountId} /></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700" data-testid="text-page-title">General Enquiries</h2>
          <div className="flex items-center gap-2">
            {hasSearched && (
              <Badge variant="outline" className="text-[10px] h-5" data-testid="text-result-count">
                {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
                {quickFilters.size > 0 && ` (filtered from ${results.length})`}
              </Badge>
            )}
          </div>
        </div>

        <div ref={dropdownContainerRef} className="relative">
          <div className="relative flex items-stretch" role="search" aria-label="Account search">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" aria-hidden="true" />

            {dropdownSearching && (
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={quickQuery}
              onChange={(e) => handleQuickQueryChange(e.target.value)}
              onKeyDown={handleQuickKeyDown}
              onFocus={() => { if (quickQuery.trim().length >= 2 || recentSearches.length > 0 || pinnedAccounts.length > 0) setShowDropdown(true); }}
              placeholder="Search by account number, name, ID number, phone, email..."
              className="w-full h-11 pl-10 pr-[180px] rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
              data-testid="input-smart-search"
              aria-label="Search accounts"
              aria-controls="search-dropdown"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              role="combobox"
            />

            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {quickQuery.trim().length >= 2 && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap
                  ${detectedType.unsupported
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-blue-50 text-blue-600 border border-blue-200'}`}
                  data-testid="badge-detected-type"
                >
                  {detectedType.unsupported ? <AlertTriangle className="w-2.5 h-2.5" /> : <CircleDot className="w-2.5 h-2.5" />}
                  {detectedType.label}
                </span>
              )}

              {quickQuery && (
                <button
                  onClick={handleClear}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  data-testid="button-clear-quick"
                  aria-label="Clear search"
                  tabIndex={0}
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Scan ID / Barcode"
                data-testid="button-scan-barcode"
                aria-label="Scan ID or barcode"
                tabIndex={0}
              >
                <ScanBarcode className="w-4 h-4" />
              </button>

              <button
                onClick={handleFullSearch}
                disabled={searching || (quickQuery.trim().length < 2 && !Object.values(criteria).some(v => v && String(v).trim()))}
                className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white flex items-center gap-1.5 text-xs font-medium transition-colors shadow-sm"
                data-testid="button-search"
                aria-label="Search"
                tabIndex={0}
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Search
              </button>
            </div>
          </div>

          <div className="mt-2 border border-slate-200 rounded-lg bg-slate-50/50 p-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Filter className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Billing Enquiry Search</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold">{activeFilterCount}</span>
              )}
              {activeFilterCount > 0 && (
                <button onClick={() => setCriteria({})} className="text-[10px] text-blue-600 hover:text-blue-800 underline underline-offset-2 ml-auto" data-testid="button-clear-field-filters">Clear</button>
              )}
              <button
                onClick={() => setShowFiltersPanel(prev => !prev)}
                className="ml-auto text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                data-testid="button-toggle-advanced"
              >
                <SlidersHorizontal className="w-3 h-3" />
                More Fields
              </button>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {[
                { key: 'accountNo', placeholder: 'Account No.' },
                { key: 'name', placeholder: 'Name / Company' },
                { key: 'emailAddress', placeholder: 'Email Address' },
                { key: 'physicalMeterNumber', placeholder: 'Meter Number' },
                { key: 'oldAccountCode', placeholder: 'Old Account Code' },
                { key: 'idNo', placeholder: 'ID / Reg. Number' },
                { key: 'locationAddress', placeholder: 'Location Address' },
                { key: 'sgNumber', placeholder: 'Erf/SG Number' },
              ].map(f => (
                <FieldAutocompleteInput
                  key={f.key}
                  fieldKey={f.key}
                  placeholder={f.placeholder}
                  value={(criteria as any)[f.key] || ''}
                  onChange={handleFieldChange}
                  onSelectAndSearch={handleFieldSelect}
                  onEnter={handleFullSearch}
                  onAutoResults={handleAutoResults}
                />
              ))}
            </div>
            <p className="text-[10px] text-red-500 mt-1.5 font-medium">** At Least One Search Parameter Must Be Entered</p>
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={handleFullSearch}
                disabled={searching || (quickQuery.trim().length < 2 && !Object.values(criteria).some(v => v && String(v).trim()))}
                className="h-7 px-3 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                data-testid="button-field-search"
              >
                {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Search
              </button>
              <button
                onClick={() => { setCriteria({}); setQuickQuery(''); setResults([]); setHasSearched(false); setSearchError(null); }}
                className="h-7 px-3 rounded bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-medium transition-colors"
                data-testid="button-field-clear"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap" role="group" aria-label="Quick filters">
            {QUICK_FILTER_CHIPS.map(chip => (
              <button
                key={chip.key}
                onClick={() => toggleQuickFilter(chip.key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all
                  ${quickFilters.has(chip.key)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
                data-testid={`chip-filter-${chip.key}`}
                aria-pressed={quickFilters.has(chip.key)}
                tabIndex={0}
              >
                {chip.icon}
                {chip.label}
              </button>
            ))}
            {quickFilters.size > 0 && (
              <button
                onClick={() => setQuickFilters(new Set())}
                className="text-[10px] text-blue-600 hover:text-blue-800 ml-1 underline underline-offset-2"
                data-testid="button-clear-quick-filters"
              >
                Clear
              </button>
            )}
          </div>

          {quickQuery.trim().length >= 2 && (
            <SmartSearchDropdown
              results={dropdownResults}
              loading={dropdownSearching}
              query={quickQuery}
              highlightIdx={highlightIdx}
              onSelect={handleSelectAccount}
              visible={showDropdown}
              onPin={togglePinAccount}
              isPinned={isAccountPinned}
              maxResults={20}
              onViewAll={() => { setShowDropdown(false); handleFullSearch(); }}
            />
          )}

          {quickQuery.trim().length < 2 && showDropdown && (recentSearches.length > 0 || pinnedAccounts.length > 0) && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1 max-h-[400px] overflow-y-auto" id="search-dropdown" role="listbox">
              {pinnedAccounts.length > 0 && (
                <>
                  <div className="px-4 py-1.5 flex items-center gap-2 border-b border-slate-100">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pinned Accounts</span>
                  </div>
                  {pinnedAccounts.map((acct, i) => {
                    const acctNum = acct.accountNumber || acct.accountID || acct.account_ID;
                    const bal = acct.outStandingAmount ?? acct.outStandingAmt ?? 0;
                    return (
                      <button
                        key={acct.account_ID || acct.accountID || i}
                        onClick={() => handleSelectAccount(acct)}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center gap-3"
                        data-testid={`pinned-account-${i}`}
                        role="option"
                      >
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-800">{acct.name || acct.surname_Company || 'Unknown'}</span>
                          <span className="text-[10px] font-mono text-blue-600 ml-2">{acctNum}</span>
                        </div>
                        <span className={`text-xs font-mono font-semibold ${bal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          R {bal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}

              {recentSearches.length > 0 && (
                <>
                  <div className="px-4 py-1.5 flex items-center gap-2 border-b border-slate-100 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Recent Searches</span>
                  </div>
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuickQuery(term); handleQuickQueryChange(term); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                      data-testid={`recent-search-${i}`}
                      role="option"
                    >
                      <Clock className="w-3 h-3 text-slate-300" />
                      {term}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50">
        {searchError && (
          <div className="p-4">
            <ErrorState message={searchError} onRetry={handleFullSearch} />
          </div>
        )}

        {!hasSearched && !searchError && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 px-8 py-12">
            <div className="relative mb-4">
              <Search className="w-12 h-12 opacity-10" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <Zap className="w-3 h-3 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-3">Quick Start</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {EXAMPLE_SEARCHES.map((example, i) => (
                <button
                  key={i}
                  onClick={() => { setQuickQuery(example.value); handleQuickQueryChange(example.value); inputRef.current?.focus(); }}
                  className="group flex items-center gap-2 text-xs px-3.5 py-2 rounded-lg border border-slate-200 text-slate-500
                    hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm"
                  data-testid={`example-search-${i}`}
                >
                  <span className="font-mono text-blue-600 group-hover:text-blue-800">{example.value}</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-blue-500">{example.label}</span>
                </button>
              ))}
            </div>
            {pinnedAccounts.length > 0 && (
              <div className="mt-6 w-full max-w-md">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-semibold text-slate-500">Pinned Accounts</span>
                </div>
                <div className="grid gap-1.5">
                  {pinnedAccounts.map((acct, i) => {
                    const acctNum = acct.accountNumber || acct.accountID || acct.account_ID;
                    const bal = acct.outStandingAmount ?? acct.outStandingAmt ?? 0;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSelectAccount(acct)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all text-left"
                        data-testid={`pinned-home-${i}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 text-sm font-bold">
                          {(acct.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">{acct.name || 'Unknown'}</div>
                          <div className="text-[10px] font-mono text-slate-400">{acctNum}</div>
                        </div>
                        <div className={`text-xs font-mono font-semibold ${bal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          R {bal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {searching && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
            <p className="text-sm text-slate-500">Searching...</p>
          </div>
        )}

        {hasSearched && !searching && !searchError && filteredResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 px-8">
            <Search className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-semibold text-slate-600 mb-2">No results found</p>
            {detectedType.unsupported ? (
              <div className="text-center">
                <p className="text-xs text-amber-600 font-medium">Email search is not supported by the API</p>
                <p className="text-xs mt-1.5 text-slate-500">Search by Account Number, Name, ID, Address, Mobile, Passport, Old Code, or Meter Number</p>
              </div>
            ) : (
              <div className="text-center space-y-1.5">
                <p className="text-xs text-slate-500">Suggestions:</p>
                <ul className="text-xs text-slate-400 space-y-0.5">
                  <li>Check your spelling</li>
                  <li>Try fewer words or characters</li>
                  <li>Search by account number for exact results</li>
                  {quickFilters.size > 0 && <li className="text-blue-600 font-medium">Remove active quick filters to see all results</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {filteredResults.length > 0 && (
          <div className="overflow-x-auto" data-testid="table-search-results">
            <table className="w-full text-xs border-collapse min-w-[1100px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 border-b-2 border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="w-8 px-1 py-2.5"></th>
                  <th className="w-8 px-1 py-2.5"></th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[140px]">Account No.</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap">Name</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[200px]">Address</th>
                  <th className="text-center px-2 py-2.5 whitespace-nowrap w-[70px]">Status</th>
                  <th className="text-center px-2 py-2.5 whitespace-nowrap w-[130px]">Type</th>
                  <th className="text-right px-2 py-2.5 whitespace-nowrap w-[110px]">Outstanding</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[100px]">Old Code</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[180px]">SG Number</th>
                  <th className="w-[60px] px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((account, i) => {
                  const aid = account.accountID || account.account_ID || i;
                  return (
                    <ExpandableResultRow
                      key={aid}
                      account={account}
                      onSelect={handleSelectAccount}
                      isExpanded={expandedRowId === aid}
                      onToggleExpand={() => setExpandedRowId(prev => prev === aid ? null : aid)}
                      searchQuery={quickQuery}
                      onPin={togglePinAccount}
                      isPinned={isAccountPinned(account)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showFiltersPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowFiltersPanel(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-[380px] max-w-[90vw] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right duration-200" role="dialog" aria-label="Advanced Filters">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">Advanced Filters</h3>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">{activeFilterCount}</span>
                )}
              </div>
              <button
                onClick={() => setShowFiltersPanel(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close filters panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {SEARCH_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`search-${field.key}`} className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-1.5 flex items-center gap-1.5">
                    <field.icon className="w-3 h-3" />
                    {field.label}
                  </Label>
                  <Input
                    id={`search-${field.key}`}
                    placeholder={field.placeholder}
                    value={(criteria as any)[field.key] || ''}
                    onChange={(e) => setCriteria(prev => ({ ...prev, [field.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleFullSearch(); setShowFiltersPanel(false); } }}
                    className="h-9 text-sm"
                    data-testid={`input-search-${field.key}`}
                  />
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-slate-200 px-5 py-3 flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCriteria({})} className="text-xs" data-testid="button-clear-filters">
                  Clear All
                </Button>
              )}
              <Button
                onClick={() => { handleFullSearch(); setShowFiltersPanel(false); }}
                disabled={searching}
                className="flex-1 h-9 gap-2"
                data-testid="button-apply-filters"
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Apply & Search
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function GeneralEnquiries() {
  return (
    <PosLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <GeneralEnquiriesContent />
      </div>
    </PosLayout>
  );
}
