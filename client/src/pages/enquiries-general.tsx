import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpTip } from '@/components/ui/help-tip';
import { Badge } from '@/components/ui/badge';
import {
  Search, X, ChevronLeft, User, Phone,
  CreditCard, Droplets, Zap, FileText, Shield, Gift, Landmark,
  AlertTriangle, Clock, ArrowRight, Loader2, SlidersHorizontal,
  Layers, Home, Activity, Users, Receipt, CalendarDays, Banknote, Scale,
  Gauge, Filter, AlertCircle, Briefcase, Star, ScanBarcode, CheckCircle2,
  CircleDot, Wallet, Gauge as MeterIcon, CalendarCheck, Building2, Send,
  BarChart3, ChevronDown, Check
} from 'lucide-react';
import {
  searchAccounts, getAccountBalance, multiAutocompleteSearch, getAutocompleteType,
  autocomplete, prefetchAccountData, clearEnquiryCache,
  type EnquirySearchCriteria, type EnquirySearchResult,
} from '@/lib/enquiries-service';

import { ErrorState } from './enquiries/shared';
import { AccountInfoTab, NameTab, BalanceDebtTab, LinkedAccountsTab } from './enquiries/account-tabs';
import { ServiceBalanceTab, ConsumptionTab, ServicesMetersTab } from './enquiries/service-tabs';
import { TransactionSummaryTab, DetailedTransactionListTab, TransactionHistoryTab, NextBillEstimateTab } from './enquiries/transaction-tabs';
import { IncentivesTab, DepositsTab, PaymentPlansTab, PaymentExtensionHistoryTab, DebitOrdersTab, RatesValuationsTab, BilledVsPaidTab } from './enquiries/financial-tabs';
import { PropertyDetailsTab, ContactInfoTab, HandoverTab, NotificationsTab, StatementsTab, ClearanceTab, DebtorNotesTab, Section129Tab, OccupiersTab, SendStatementsTab, IndigentHistoryTab } from './enquiries/other-tabs';
import { SEARCH_FIELDS, detectSearchType, SmartSearchDropdown, ExpandableResultRow } from './enquiries/search-components';

function FieldAutocompleteInput({ fieldKey, placeholder, value, onChange, onSelectAllLinked, onSelectByFieldValue, onEnter, onAutoResults }: {
  fieldKey: string; placeholder: string; value: string;
  onChange: (key: string, val: string) => void;
  onSelectAllLinked: (accountIds: number[]) => void;
  onSelectByFieldValue: (fieldKey: string, displayValue: string) => void;
  onEnter: () => void;
  onAutoResults?: (fieldKey: string, accountIds: number[]) => void;
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
        setSuggestions(items.slice(0, 25));
        setOpen(true);
        const withIds = items.filter(s => s.accountId && s.accountId > 0);
        const uniqueIds = Array.from(new Set(withIds.map(s => s.accountId))).slice(0, 5);
        if (uniqueIds.length > 0 && onAutoResults) onAutoResults(fieldKey, uniqueIds);
      } catch {
        if (tokenRef.current === tok) setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = (selected: { displayItem: string; accountId: number }) => {
    onChange(fieldKey, selected.displayItem);
    setOpen(false);
    const allLinkedIds = Array.from(new Set(
      suggestions
        .filter(s => s.displayItem === selected.displayItem && s.accountId > 0)
        .map(s => s.accountId)
    ));
    if (allLinkedIds.length > 0) {
      onSelectAllLinked(allLinkedIds);
    } else {
      onSelectByFieldValue(fieldKey, selected.displayItem);
    }
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
        className="w-full h-9 sm:h-8 px-2.5 sm:px-2 text-xs rounded-lg sm:rounded border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 sm:focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        data-testid={`input-field-${fieldKey}`}
      />
      {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 animate-spin" />}
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto overscroll-contain">
          {suggestions.map((s, i) => (
            <button
              key={`${s.accountId}-${i}`}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-2.5 py-2 sm:py-1.5 text-xs text-slate-700 hover:bg-blue-50 active:bg-blue-100 transition-colors border-b border-slate-100 last:border-0"
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
  const [mobileTabMenuOpen, setMobileTabMenuOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<'quick' | 'advanced'>('quick');
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [headerBalance, setHeaderBalance] = useState<number | null>(null);
  const [pinnedAccounts, setPinnedAccounts] = useState<EnquirySearchResult[]>([]);
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [mobileFormCollapsed, setMobileFormCollapsed] = useState(true);
  const [fieldSearchOpen, setFieldSearchOpen] = useState(false);
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
      const enquiryPromise = searchAccounts({ [field]: query.trim() } as any).catch(() => [] as EnquirySearchResult[]);
      const acPromise = multiAutocompleteSearch(query.trim()).catch(() => ({ suggestions: [], results: [] as EnquirySearchResult[] }));

      const eqResults = await enquiryPromise;
      if (quickSearchTokenRef.current !== token) return;
      if (eqResults.length > 0) {
        setDropdownResults(eqResults);
        setShowDropdown(true);
        setDropdownSearching(false);
        enrichWithBalances(eqResults, quickSearchTokenRef, token, setDropdownResults);
      }

      const acData = await acPromise;
      if (quickSearchTokenRef.current !== token) return;
      const acResults = acData.results || [];
      if (acResults.length > 0 || eqResults.length > 0) {
        const seen = new Set<number>();
        const merged: EnquirySearchResult[] = [];
        for (const r of [...eqResults, ...acResults]) {
          const id = r.account_ID || r.accountID;
          if (id && !seen.has(id)) { seen.add(id); merged.push(r); }
        }
        setDropdownResults(merged);
        setShowDropdown(true);
        enrichWithBalances(merged, quickSearchTokenRef, token, setDropdownResults);
      } else {
        setDropdownResults([]);
        setShowDropdown(true);
      }
    } catch (e: any) {
      if (quickSearchTokenRef.current === token) setDropdownResults([]);
    } finally {
      if (quickSearchTokenRef.current === token) setDropdownSearching(false);
    }
  }, [enrichWithBalances]);

  const handleQuickQueryChange = (val: string) => {
    setQuickQuery(val);
    setHighlightIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      setShowDropdown(true);
      setDropdownSearching(true);
      debounceRef.current = setTimeout(() => doQuickSearch(val), 250);
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
    const aid = account.account_ID || account.accountID;
    if (aid) prefetchAccountData(aid);
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
        if (mainResults.length > 0) { setMobileFormCollapsed(true); setFieldSearchOpen(false); }
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
      if (data.length > 0) { setMobileFormCollapsed(true); setFieldSearchOpen(false); }
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

  const handleAutoResults = useCallback(async (fieldKey: string, accountIds: number[]) => {
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

  const handleSelectByFieldValue = useCallback(async (key: string, displayValue: string) => {
    const token = ++fullSearchTokenRef.current;
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setShowDropdown(false);
    try {
      let searchVal = displayValue.trim();
      if (key === 'name') {
        searchVal = searchVal.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
      const fieldCriteria: EnquirySearchCriteria = { [key]: searchVal };
      const data = await searchAccounts(fieldCriteria);
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

  const handleSelectAllLinked = useCallback(async (accountIds: number[]) => {
    const token = ++fullSearchTokenRef.current;
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setShowDropdown(false);
    try {
      const lookups = await Promise.allSettled(
        accountIds.map(id => searchAccounts({ accountNo: String(id) }))
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
    setMobileFormCollapsed(true);
    setFieldSearchOpen(false);
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

    type TabItem = { value: string; label: string; icon: React.ReactNode; color: string; tip?: string };
    type TabGroup = { heading: string; tabs: TabItem[] };

    const tabGroups: TabGroup[] = [
      {
        heading: 'ACCOUNT & PARTY',
        tabs: [
          { value: 'account', label: 'Account', icon: <User className="w-3.5 h-3.5" />, color: 'blue', tip: 'View account holder details, status, and registration information.' },
          { value: 'name', label: 'Name', icon: <Users className="w-3.5 h-3.5" />, color: 'indigo', tip: 'View and search account holder name details.' },
          { value: 'property', label: 'Property', icon: <Home className="w-3.5 h-3.5" />, color: 'amber', tip: 'View property details, address, and zoning information.' },
          { value: 'linked-accounts', label: 'Linked Accounts', icon: <Building2 className="w-3.5 h-3.5" />, color: 'purple', tip: 'View other accounts linked to this property or owner.' },
          { value: 'occupiers', label: 'Occupiers', icon: <Users className="w-3.5 h-3.5" />, color: 'violet', tip: 'View current and previous property occupiers.' },
          { value: 'contact', label: 'Contact', icon: <Phone className="w-3.5 h-3.5" />, color: 'violet', tip: 'View contact details such as phone, email, and postal address.' },
          { value: 'handover', label: 'Handover', icon: <ArrowRight className="w-3.5 h-3.5" />, color: 'orange', tip: 'View handover history and debt collection status.' },
        ],
      },
      {
        heading: 'SERVICES & CONSUMPTION',
        tabs: [
          { value: 'services', label: 'Services', icon: <Layers className="w-3.5 h-3.5" />, color: 'emerald', tip: 'View active services and their current balances.' },
          { value: 'services-meters', label: 'Meters', icon: <Gauge className="w-3.5 h-3.5" />, color: 'emerald', tip: 'View meter details, readings, and meter history.' },
          { value: 'consumption', label: 'Consumption', icon: <Droplets className="w-3.5 h-3.5" />, color: 'cyan', tip: 'View water and electricity consumption trends and history.' },
        ],
      },
      {
        heading: 'FINANCIAL',
        tabs: [
          { value: 'balance', label: 'Balance / Debt', icon: <CreditCard className="w-3.5 h-3.5" />, color: 'red', tip: 'View outstanding balances, debt age analysis, and arrears breakdown.' },
          { value: 'txn-detailed', label: 'Transaction Detail', icon: <Activity className="w-3.5 h-3.5" />, color: 'indigo', tip: 'View detailed individual transactions with full line-item breakdown.' },
          { value: 'txn-summary', label: 'Transaction Summary', icon: <FileText className="w-3.5 h-3.5" />, color: 'slate', tip: 'View summarised transaction totals grouped by period.' },
          { value: 'transactions', label: 'Receipts', icon: <Receipt className="w-3.5 h-3.5" />, color: 'blue', tip: 'View payment receipts and receipt history.' },
          { value: 'deposits', label: 'Deposits', icon: <Banknote className="w-3.5 h-3.5" />, color: 'lime', tip: 'View deposit amounts held on the account.' },
          { value: 'payment-plans', label: 'Payment Plans', icon: <CalendarDays className="w-3.5 h-3.5" />, color: 'purple', tip: 'View active and historical payment arrangements.' },
          { value: 'payment-extensions', label: 'Extensions', icon: <Clock className="w-3.5 h-3.5" />, color: 'amber', tip: 'View payment extension requests and their status.' },
          { value: 'billed-vs-paid', label: 'Billed vs Paid', icon: <BarChart3 className="w-3.5 h-3.5" />, color: 'indigo', tip: 'Compare billed amounts against payments received per period.' },
        ],
      },
      {
        heading: 'BILLING & TARIFFS',
        tabs: [
          { value: 'next-bill', label: 'Next Bill Estimate', icon: <CalendarCheck className="w-3.5 h-3.5" />, color: 'purple', tip: 'Calculate an estimated total for the upcoming billing period based on active services, metered consumption, property rates, rebates, and additional billing.' },
          { value: 'rates', label: 'Rates', icon: <Scale className="w-3.5 h-3.5" />, color: 'orange', tip: 'View rates valuations and property assessment details.' },
          { value: 'debit-orders', label: 'Debit Orders', icon: <Landmark className="w-3.5 h-3.5" />, color: 'teal', tip: 'View debit order mandates and processing history.' },
          { value: 'statements', label: 'Statements', icon: <FileText className="w-3.5 h-3.5" />, color: 'blue', tip: 'View and download previous account statements.' },
          { value: 'send-statements', label: 'Send Statements', icon: <Send className="w-3.5 h-3.5" />, color: 'indigo', tip: 'Generate and send a statement for the selected period to the account holder\'s email or mobile.' },
        ],
      },
      {
        heading: 'COMPLIANCE & LEGAL',
        tabs: [
          { value: 'clearance', label: 'Clearance', icon: <Shield className="w-3.5 h-3.5" />, color: 'emerald', tip: 'View clearance certificate status and history.' },
          { value: 'debtor-notes', label: 'Debtor Notes', icon: <Briefcase className="w-3.5 h-3.5" />, color: 'red', tip: 'View internal notes and flags on the debtor account.' },
          { value: 'section129', label: 'Section 129', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'rose', tip: 'View Section 129 legal notice history and status.' },
        ],
      },
      {
        heading: 'NOTIFICATIONS & SUBSIDIES',
        tabs: [
          { value: 'notifications', label: 'Notifications', icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'yellow', tip: 'View SMS, email, and letter notifications sent to this account.' },
          { value: 'incentives', label: 'Incentives', icon: <Gift className="w-3.5 h-3.5" />, color: 'pink', tip: 'View incentive and discount programmes applied to this account.' },
          { value: 'indigent', label: 'Indigent Subsidy', icon: <Shield className="w-3.5 h-3.5" />, color: 'teal', tip: 'View indigent subsidy registration and benefit history.' },
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
          <div className="px-3 sm:px-6 py-2 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSelectedAccount(null)}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors group shrink-0"
                data-testid="button-back-to-results"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <div className="h-6 w-px bg-slate-200 hidden sm:block" />

              <div className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-sm">
                {accountName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 truncate max-w-[140px] sm:max-w-none" data-testid="text-selected-account-name">
                    {accountName}
                  </h2>
                  <HelpTip text="Current status of this municipal account — Active, Inactive, or Closed." side="bottom">
                    <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold cursor-help ${isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {selectedAccount.accountStatus || selectedAccount.statusDesc || 'Unknown'}
                    </span>
                  </HelpTip>
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5 font-mono truncate">
                  Acc: {accountNum}
                  {selectedAccount.oldAccountCode && <span className="text-slate-400"> | Old: {selectedAccount.oldAccountCode}</span>}
                </div>
              </div>

              <div className="shrink-0 text-right" data-testid="header-balance-section">
                <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 justify-end">Balance <HelpTip text="Total outstanding balance across all services on this account." side="left" /></div>
                {headerBalance !== null ? (
                  <div className={`text-sm sm:text-xl font-bold font-mono tracking-tight ${headerBalance > 0 ? 'text-red-600' : headerBalance < 0 ? 'text-emerald-600' : 'text-slate-800'}`} data-testid="text-header-balance">
                    R {headerBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : (
                  <div className="h-5 w-16 sm:h-6 sm:w-24 bg-slate-100 rounded animate-pulse" />
                )}
              </div>
            </div>

            {(selectedAccount.accountType || selectedAccount.accountDesc) && (
              <div className="mt-1 sm:hidden">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200" data-testid="badge-account-type">
                  {selectedAccount.accountType || selectedAccount.accountDesc}
                </span>
              </div>
            )}
            {(selectedAccount.accountType || selectedAccount.accountDesc) && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200 ml-[88px]" data-testid="badge-account-type-desktop">
                {selectedAccount.accountType || selectedAccount.accountDesc}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="shrink-0 bg-white border-b border-slate-200 sticky top-0 z-20 relative">
              <div className="px-3 sm:px-5 py-2 sm:py-3">
                <TabsList className="h-auto bg-transparent p-0 w-full block">
                  <div className="hidden sm:grid sm:grid-cols-3 gap-x-6 gap-y-3">
                    {tabGroups.map((group) => (
                      <div key={group.heading}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group.heading}</div>
                        <div className="flex flex-wrap gap-1">
                          {group.tabs.map(tab => {
                            const colors = tabColorMap[tab.color] || tabColorMap.blue;
                            const isTabActive = activeTab === tab.value;
                            return (
                              <HelpTip key={tab.value} text={tab.tip || tab.label} side="bottom">
                                <TabsTrigger
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
                              </HelpTip>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="sm:hidden">
                    {(() => {
                      const allTabs = tabGroups.flatMap(g => g.tabs);
                      const currentTab = allTabs.find(t => t.value === activeTab) || allTabs[0];
                      const currentGroup = tabGroups.find(g => g.tabs.some(t => t.value === activeTab));
                      const currentColors = tabColorMap[currentTab.color] || tabColorMap.blue;
                      return (
                        <>
                          <button
                            onClick={() => setMobileTabMenuOpen(!mobileTabMenuOpen)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${currentColors.activeBg} ${currentColors.activeBorder} ${currentColors.activeText}`}
                            data-testid="button-mobile-tab-selector"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${currentColors.activeIconBg}`}>
                                {currentTab.icon}
                              </span>
                              <div className="min-w-0 text-left">
                                <div className="text-xs font-semibold truncate">{currentTab.label}</div>
                                <div className="text-[9px] text-slate-400 uppercase tracking-wider">{currentGroup?.heading}</div>
                              </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${mobileTabMenuOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {mobileTabMenuOpen && (
                            <>
                              <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setMobileTabMenuOpen(false)} />
                              <div className="fixed left-2 right-2 z-40 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-y-auto overscroll-contain p-2" style={{ top: '140px', maxHeight: 'calc(100vh - 160px)' }}>
                                {tabGroups.map((group) => (
                                  <div key={group.heading} className="mb-1.5">
                                    <div className="px-1 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">{group.heading}</div>
                                    <div className="grid grid-cols-3 gap-1">
                                      {group.tabs.map(tab => {
                                        const colors = tabColorMap[tab.color] || tabColorMap.blue;
                                        const isTabActive = activeTab === tab.value;
                                        return (
                                          <TabsTrigger
                                            key={tab.value}
                                            value={tab.value}
                                            onClick={() => setMobileTabMenuOpen(false)}
                                            className={`
                                              flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg border text-[10px] font-medium cursor-pointer transition-all active:scale-[0.97]
                                              ${isTabActive
                                                ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText} font-semibold shadow-sm`
                                                : `bg-white border-slate-200 text-slate-600 hover:bg-slate-50`
                                              }
                                            `}
                                            data-testid={`tab-mobile-${tab.value}`}
                                          >
                                            <span className={`w-6 h-6 rounded-md flex items-center justify-center ${isTabActive ? colors.activeIconBg : colors.iconBg}`}>
                                              {tab.icon}
                                            </span>
                                            <span className="truncate w-full text-center leading-tight">{tab.label}</span>
                                          </TabsTrigger>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </TabsList>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-50/80 to-slate-100/50">
              <TabsContent value="account" className="m-0"><AccountInfoTab account={selectedAccount} /></TabsContent>
              <TabsContent value="name" className="m-0"><NameTab accountId={accountId} onNavigateToAccount={(acct) => { setSelectedAccount(acct); setActiveTab('account'); }} /></TabsContent>
              <TabsContent value="balance" className="m-0"><BalanceDebtTab accountId={accountId} accountNumber={selectedAccount.accountNumber || selectedAccount.oldAccountCode || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="services" className="m-0"><ServiceBalanceTab accountId={accountId} /></TabsContent>
              <TabsContent value="property" className="m-0"><PropertyDetailsTab accountId={accountId} /></TabsContent>
              <TabsContent value="consumption" className="m-0"><ConsumptionTab accountId={accountId} accountNumber={selectedAccount.accountNumber || selectedAccount.oldAccountCode || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="contact" className="m-0"><ContactInfoTab accountId={accountId} /></TabsContent>
              <TabsContent value="handover" className="m-0"><HandoverTab accountId={accountId} /></TabsContent>
              <TabsContent value="incentives" className="m-0"><IncentivesTab accountId={accountId} /></TabsContent>
              <TabsContent value="deposits" className="m-0"><DepositsTab accountId={accountId} /></TabsContent>
              <TabsContent value="transactions" className="m-0"><TransactionHistoryTab accountId={accountId} accountNumber={selectedAccount.accountNumber || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="txn-summary" className="m-0"><TransactionSummaryTab accountId={accountId} accountNumber={selectedAccount.accountNumber || selectedAccount.oldAccountCode || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="txn-detailed" className="m-0"><DetailedTransactionListTab accountId={accountId} accountNumber={selectedAccount.accountNumber || selectedAccount.oldAccountCode || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="services-meters" className="m-0"><ServicesMetersTab accountId={accountId} unitId={unitId} accountNumber={selectedAccount.accountNumber || selectedAccount.oldAccountCode || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="payment-plans" className="m-0"><PaymentPlansTab accountId={accountId} /></TabsContent>
              <TabsContent value="payment-extensions" className="m-0"><PaymentExtensionHistoryTab accountId={accountId} /></TabsContent>
              <TabsContent value="debit-orders" className="m-0"><DebitOrdersTab accountId={accountId} /></TabsContent>
              <TabsContent value="billed-vs-paid" className="m-0"><BilledVsPaidTab accountId={accountId} /></TabsContent>
              <TabsContent value="next-bill" className="m-0"><NextBillEstimateTab accountId={accountId} accountNumber={selectedAccount.accountNumber || selectedAccount.oldAccountCode || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="rates" className="m-0"><RatesValuationsTab accountId={accountId} propertyId={propertyId} /></TabsContent>
              <TabsContent value="notifications" className="m-0"><NotificationsTab accountId={accountId} /></TabsContent>
              <TabsContent value="statements" className="m-0"><StatementsTab accountId={accountId} /></TabsContent>
              <TabsContent value="send-statements" className="m-0"><SendStatementsTab accountId={accountId} /></TabsContent>
              <TabsContent value="clearance" className="m-0"><ClearanceTab accountId={accountId} propertyId={propertyId} currentAccountNumber={String(accountNum)} currentAccountName={accountName} /></TabsContent>
              <TabsContent value="debtor-notes" className="m-0"><DebtorNotesTab accountId={accountId} /></TabsContent>
              <TabsContent value="section129" className="m-0"><Section129Tab accountId={accountId} /></TabsContent>
              <TabsContent value="linked-accounts" className="m-0"><LinkedAccountsTab accountId={accountId} onSelectAccount={(acct) => { setSelectedAccount(acct); setActiveTab('account'); }} /></TabsContent>
              <TabsContent value="occupiers" className="m-0"><OccupiersTab accountId={accountId} /></TabsContent>
              <TabsContent value="indigent" className="m-0"><IndigentHistoryTab accountId={accountId} /></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-1" data-testid="text-page-title">General Enquiries <HelpTip text="Look up consumer account details, balances, transaction history, and billing information." side="bottom" /></h2>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {hasSearched && (
              <Badge variant="outline" className="text-[9px] sm:text-[10px] h-5" data-testid="text-result-count">
                {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
                {quickFilters.size > 0 && ` (of ${results.length})`}
              </Badge>
            )}
            {recentSearches.length > 0 && (
              <button
                onClick={() => { setShowDropdown(true); inputRef.current?.focus(); }}
                className="sm:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Recent searches"
                data-testid="button-recent-mobile"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div ref={dropdownContainerRef} className="relative">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Quick Search</span>
            <HelpTip text="Enter an account number, property reference, or customer name for a quick lookup." side="right" />
          </div>
          <div className="relative flex items-stretch" role="search" aria-label="Account search">
            <Search className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" aria-hidden="true" />

            {dropdownSearching && (
              <div className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
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
              placeholder="Search account, name, ID, phone..."
              className="w-full h-11 sm:h-11 pl-9 sm:pl-10 pr-[88px] sm:pr-[180px] rounded-xl sm:rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
              data-testid="input-smart-search"
              aria-label="Search accounts"
              aria-controls="search-dropdown"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              role="combobox"
            />

            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1">
              {quickQuery.trim().length >= 2 && (
                <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap
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
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                  data-testid="button-clear-quick"
                  aria-label="Clear search"
                  tabIndex={0}
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <HelpTip text="Scan a barcode or ID document to auto-fill the search field." side="bottom">
                <button
                  className="hidden sm:flex p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Scan ID / Barcode"
                  data-testid="button-scan-barcode"
                  aria-label="Scan ID or barcode"
                  tabIndex={0}
                >
                  <ScanBarcode className="w-4 h-4" />
                </button>
              </HelpTip>

              <button
                onClick={handleFullSearch}
                disabled={searching || (quickQuery.trim().length < 2 && !Object.values(criteria).some(v => v && String(v).trim()))}
                className="h-8 w-8 sm:h-8 sm:w-auto sm:px-3 rounded-lg sm:rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 text-white flex items-center justify-center gap-1.5 text-xs font-medium transition-colors shadow-sm"
                data-testid="button-search"
                aria-label="Search"
                tabIndex={0}
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </div>

          {quickQuery.trim().length >= 2 && (
            <div className="sm:hidden flex items-center gap-1.5 mt-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium
                ${detectedType.unsupported
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-blue-50 text-blue-600 border border-blue-200'}`}
                data-testid="badge-detected-type-mobile"
              >
                {detectedType.unsupported ? <AlertTriangle className="w-2.5 h-2.5" /> : <CircleDot className="w-2.5 h-2.5" />}
                {detectedType.label}
              </span>
              <button
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                title="Scan ID / Barcode"
                data-testid="button-scan-barcode-mobile"
              >
                <ScanBarcode className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="mt-2 border border-slate-200 rounded-xl sm:rounded-lg bg-slate-50/50 overflow-hidden">
            <button
              onClick={() => {
                setFieldSearchOpen(prev => !prev);
                setMobileFormCollapsed(prev => !prev);
              }}
              className="w-full flex items-center justify-between gap-1.5 px-3 py-2.5 sm:px-2.5 sm:py-2 hover:bg-slate-100/70 active:bg-slate-100 transition-colors"
              data-testid="button-toggle-filters"
            >
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-slate-400" />
                <span className="text-[11px] sm:text-[10px] font-semibold text-slate-600 sm:text-slate-500 sm:uppercase sm:tracking-wider">Field Search</span>
                <HelpTip text="Search by specific fields like account number, name, meter number, etc. for precise results." side="right" />
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] sm:min-w-[16px] sm:h-[16px] rounded-full bg-blue-600 text-white text-[9px] font-bold px-1">{activeFilterCount}</span>
                )}
                {activeFilterCount > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCriteria({}); }}
                    className="hidden sm:inline text-[10px] text-blue-600 hover:text-blue-800 underline underline-offset-2"
                    data-testid="button-clear-field-filters"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  onClick={(e) => { e.stopPropagation(); setShowFiltersPanel(prev => !prev); }}
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 cursor-pointer"
                  data-testid="button-toggle-advanced"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  More
                </span>
                <ChevronDown className={`w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-400 transition-transform duration-200 ${fieldSearchOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            <div className={`${fieldSearchOpen ? 'block animate-in fade-in slide-in-from-top-2 duration-200' : 'hidden'} px-2 sm:px-2.5 pt-2 pb-2 border-t border-slate-200/60`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
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
                    onSelectAllLinked={handleSelectAllLinked}
                    onSelectByFieldValue={handleSelectByFieldValue}
                    onEnter={handleFullSearch}
                    onAutoResults={handleAutoResults}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[9px] sm:text-[10px] text-red-500 font-medium">** At Least One Parameter Required</p>
                <div className="sm:hidden">
                  <button
                    onClick={() => setShowFiltersPanel(prev => !prev)}
                    className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    data-testid="button-toggle-advanced-mobile"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    More
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  onClick={handleFullSearch}
                  disabled={searching || (quickQuery.trim().length < 2 && !Object.values(criteria).some(v => v && String(v).trim()))}
                  className="h-8 sm:h-7 px-4 sm:px-3 rounded-lg sm:rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 text-white flex items-center gap-1.5 text-xs sm:text-[11px] font-medium transition-colors shadow-sm"
                  data-testid="button-field-search"
                >
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Search
                </button>
                <button
                  onClick={() => { setCriteria({}); setQuickQuery(''); setResults([]); setHasSearched(false); setSearchError(null); setFieldSearchOpen(false); setMobileFormCollapsed(true); }}
                  className="h-8 sm:h-7 px-4 sm:px-3 rounded-lg sm:rounded bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 text-xs sm:text-[11px] font-medium transition-colors"
                  data-testid="button-field-clear"
                >
                  Clear
                </button>
                {activeFilterCount > 0 && (
                  <button onClick={() => setCriteria({})} className="sm:hidden text-[10px] text-blue-600 hover:text-blue-800 underline underline-offset-2 ml-auto" data-testid="button-clear-field-filters-mobile">
                    Clear Filters ({activeFilterCount})
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-hide pb-0.5 sm:flex-wrap sm:overflow-visible ${!fieldSearchOpen && hasSearched ? 'hidden sm:flex' : ''}`} role="group" aria-label="Quick filters">
            <HelpTip text="Active search filters. Click to remove a filter." side="bottom" className="shrink-0" />
            {QUICK_FILTER_CHIPS.map(chip => (
              <button
                key={chip.key}
                onClick={() => toggleQuickFilter(chip.key)}
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 sm:py-1 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap active:scale-95
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
                    <HelpTip text="Quick access to frequently viewed accounts. Pin accounts for easy reference." side="right" />
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
          <div className="flex flex-col items-center justify-center h-full text-slate-400 px-4 sm:px-8 py-8 sm:py-12">
            <div className="relative mb-3 sm:mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center border border-blue-100">
                <Search className="w-7 h-7 sm:w-9 sm:h-9 text-blue-300" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                <Zap className="w-3 h-3 text-white" />
              </div>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-1">Search Municipal Accounts</p>
            <p className="text-[10px] sm:text-xs text-slate-400 mb-4 sm:mb-5 text-center max-w-xs">Search by account number, name, ID, phone, address or meter number</p>

            <div className="w-full max-w-sm sm:max-w-none">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Try an example</p>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center justify-center gap-1.5 sm:gap-2">
                {EXAMPLE_SEARCHES.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuickQuery(example.value); handleQuickQueryChange(example.value); inputRef.current?.focus(); }}
                    className="group flex flex-col sm:flex-row items-start sm:items-center gap-0.5 sm:gap-2 text-[11px] sm:text-xs px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-lg border border-slate-200 text-slate-500
                      hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 active:bg-blue-100 transition-all shadow-sm bg-white"
                    data-testid={`example-search-${i}`}
                  >
                    <span className="font-mono text-blue-600 group-hover:text-blue-800 text-[11px]">{example.value}</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 group-hover:text-blue-500">{example.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {recentSearches.length > 0 && (
              <div className="mt-5 sm:mt-6 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recent</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuickQuery(term); handleQuickQueryChange(term); inputRef.current?.focus(); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] text-slate-600 hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100 transition-all"
                      data-testid={`recent-chip-${i}`}
                    >
                      <Clock className="w-2.5 h-2.5 text-slate-300" />
                      <span className="font-mono">{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pinnedAccounts.length > 0 && (
              <div className="mt-5 sm:mt-6 w-full max-w-sm sm:max-w-md">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pinned Accounts</span>
                  <HelpTip text="Quick access to frequently viewed accounts. Pin accounts for easy reference." side="right" />
                </div>
                <div className="grid gap-1.5">
                  {pinnedAccounts.map((acct, i) => {
                    const acctNum = acct.accountNumber || acct.accountID || acct.account_ID;
                    const bal = acct.outStandingAmount ?? acct.outStandingAmt ?? 0;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSelectAccount(acct)}
                        className="flex items-center gap-2.5 sm:gap-3 px-3 py-2 rounded-xl sm:rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100 transition-all text-left shadow-sm"
                        data-testid={`pinned-home-${i}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 text-xs sm:text-sm font-bold ring-1 ring-amber-200">
                          {(acct.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] sm:text-sm font-medium text-slate-800 truncate">{acct.name || 'Unknown'}</div>
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
          <>
            <div className="sm:hidden px-3 pt-2.5 pb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{filteredResults.length} Account{filteredResults.length !== 1 ? 's' : ''}</span>
                {quickFilters.size > 0 && (
                  <span className="text-[9px] text-blue-600 font-medium">(filtered)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!fieldSearchOpen && (
                  <button
                    onClick={() => { setFieldSearchOpen(true); setMobileFormCollapsed(false); }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-medium active:text-blue-900"
                    data-testid="button-show-filters-mobile"
                  >
                    <Filter className="w-2.5 h-2.5" />
                    Filters
                  </button>
                )}
                <button
                  onClick={handleClear}
                  className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                  data-testid="button-new-search-mobile"
                >
                  <Search className="w-2.5 h-2.5" />
                  New
                </button>
              </div>
            </div>
            <div className="sm:hidden px-2.5 pb-2 pt-0 space-y-1.5" data-testid="mobile-search-results">
              {filteredResults.map((account, i) => {
                const aid = account.accountID || account.account_ID || i;
                const acctNum = account.accountNumber || account.accountID || account.account_ID;
                const name = account.name || account.surname_Company || 'Unknown';
                const address = account.locationAddress || account.propertyAddress || '';
                const status = account.accountStatus || account.statusDesc || '';
                const isActive = status.toLowerCase() === 'active';
                const outstanding = account.outStandingAmount ?? account.outStandingAmt ?? 0;
                const acctType = account.accountType || account.accountDesc || '';
                const borderColor = isActive
                  ? (outstanding > 0 ? 'border-l-amber-400' : 'border-l-emerald-400')
                  : 'border-l-slate-300';
                return (
                  <button
                    key={aid}
                    onClick={() => handleSelectAccount(account)}
                    className={`w-full text-left bg-white border border-slate-200 ${borderColor} border-l-[3px] rounded-lg p-2.5 hover:bg-blue-50/50 hover:border-blue-200 transition-all shadow-sm active:scale-[0.99] active:shadow-none`}
                    data-testid={`mobile-result-${i}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                        isActive ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[13px] font-semibold text-slate-900 truncate">{name}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-mono text-blue-600 font-medium">{acctNum}</span>
                          <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide ${isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                            <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {status}
                          </span>
                        </div>
                        {address && <div className="text-[10px] text-slate-500 truncate leading-tight">{address.replace(/\r\n/g, ', ')}</div>}
                        {acctType && <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide font-medium">{acctType}</div>}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <div className={`text-[13px] font-bold font-mono ${outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                          R {outstanding.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex items-center gap-0.5 text-[9px] text-slate-400">
                          <span>View</span>
                          <ArrowRight className="w-3 h-3 text-blue-400" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="hidden sm:block overflow-x-auto" data-testid="table-search-results">
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
          </>
        )}
      </div>

      {showFiltersPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 sm:bg-black/20 z-40 backdrop-blur-[1px] sm:backdrop-blur-none"
            onClick={() => setShowFiltersPanel(false)}
          />
          <div className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[380px] sm:max-w-[90vw] max-h-[85vh] sm:max-h-none bg-white shadow-2xl border-t sm:border-t-0 sm:border-l border-slate-200 z-50 flex flex-col rounded-t-2xl sm:rounded-none animate-in slide-in-from-bottom sm:slide-in-from-right duration-200" role="dialog" aria-label="Advanced Filters">
            <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2 mb-1" />
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">All Search Fields</h3>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">{activeFilterCount}</span>
                )}
              </div>
              <button
                onClick={() => setShowFiltersPanel(false)}
                className="p-2 sm:p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                aria-label="Close filters panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3 sm:space-y-4">
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
                    className="h-10 sm:h-9 text-sm rounded-lg sm:rounded-md"
                    data-testid={`input-search-${field.key}`}
                  />
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-slate-200 px-4 sm:px-5 py-3 sm:py-3 flex items-center gap-2 pb-safe">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCriteria({})} className="text-xs h-10 sm:h-8" data-testid="button-clear-filters">
                  Clear All
                </Button>
              )}
              <Button
                onClick={() => { handleFullSearch(); setShowFiltersPanel(false); }}
                disabled={searching}
                className="flex-1 h-10 sm:h-9 gap-2 rounded-lg sm:rounded-md"
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
