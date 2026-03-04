import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, X, ChevronDown, ChevronUp, Hash, User, Building2,
  MapPin, Phone, Mail, ArrowRight, Loader2, Filter,
  FileText, CreditCard, Zap, Home, Landmark,
  ChevronRight, Eye, Layers, Activity, AlertTriangle, Star
} from 'lucide-react';
import {
  searchAccounts, getAccountBalance, getServiceTypeBalance,
  getBasicAccountDetails, getPropertyDetails, getAllServices,
  getSectionalTitleScheme,
  type EnquirySearchCriteria, type EnquirySearchResult,
} from '@/lib/enquiries-service';
import { InfoField } from './shared';

export const SEARCH_FIELDS = [
  { key: 'accountNo', label: 'Account Number', placeholder: 'e.g. 000000003698', icon: Hash, smart: true },
  { key: 'oldAccountCode', label: 'Old Account Code', placeholder: 'Legacy code', icon: FileText, smart: false },
  { key: 'name', label: 'Name / Company', placeholder: 'Search by name', icon: User, smart: true },
  { key: 'idNo', label: 'ID / Registration No.', placeholder: '13 digit ID number', icon: CreditCard, smart: true },
  { key: 'emailAddress', label: 'Email Address', placeholder: 'user@example.com', icon: Mail, smart: true },
  { key: 'physicalMeterNumber', label: 'Meter Number', placeholder: 'Physical meter number', icon: Zap, smart: false },
  { key: 'locationAddress', label: 'Location / Erf Address', placeholder: 'Street, location or erf', icon: MapPin, smart: false },
  { key: 'mobileNumber', label: 'Mobile Number', placeholder: '0821234567', icon: Phone, smart: false },
  { key: 'passportNumber', label: 'Passport Number', placeholder: 'Passport number', icon: CreditCard, smart: false },
  { key: 'sgNumber', label: 'SG Number', placeholder: 'e.g. C027/0002/00013110/00000', icon: Home, smart: false },
  { key: 'erfNumber', label: 'ERF Number', placeholder: 'e.g. 13110', icon: Landmark, smart: false },
] as const;

export function detectSearchType(query: string): { field: string; label: string; unsupported?: boolean } {
  const trimmed = query.trim();
  if (/^0\d{9}$/.test(trimmed)) return { field: 'mobileNumber', label: 'Mobile Number' };
  if (/^\d{13}$/.test(trimmed)) return { field: 'idNo', label: 'ID Number' };
  if (/^[A-Z]\d{3}\/\d{4}\/\d+\/\d+$/i.test(trimmed)) return { field: 'sgNumber', label: 'SG Number' };
  if (/^\d{6,15}$/.test(trimmed)) return { field: 'accountNo', label: 'Account / ERF / Meter' };
  if (/^\d{1,5}$/.test(trimmed)) return { field: 'accountNo', label: 'Account / ERF / Meter' };
  if (/@/.test(trimmed) || /\.(com|co\.za|org|net|gov|ac\.za)$/i.test(trimmed) || /^(gmail|yahoo|outlook|hotmail|webmail|mail)/i.test(trimmed)) {
    return { field: 'emailAddress', label: 'Email Address' };
  }
  return { field: 'name', label: 'Name / Address' };
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2 || !text) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200/70 text-inherit rounded-sm px-0.5 font-bold">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

export function SmartSearchDropdown({
  results, loading, query, highlightIdx, onSelect, visible,
  onPin, isPinned, maxResults = 20, onViewAll
}: {
  results: EnquirySearchResult[];
  loading: boolean;
  query: string;
  highlightIdx: number;
  onSelect: (a: EnquirySearchResult) => void;
  visible: boolean;
  onPin?: (a: EnquirySearchResult) => void;
  isPinned?: (a: EnquirySearchResult) => boolean;
  maxResults?: number;
  onViewAll?: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const capped = results.slice(0, maxResults);
  const hasMore = results.length > maxResults;

  useEffect(() => {
    if (listRef.current && highlightIdx >= 0) {
      const el = listRef.current.children[highlightIdx] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  if (!visible) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-[#D6D6D6] z-50 max-h-[60vh] sm:max-h-[420px] overflow-hidden flex flex-col"
      data-testid="smart-search-dropdown"
      role="listbox"
      id="search-dropdown"
    >
      {loading && results.length === 0 && (
        <div className="flex items-center gap-3 px-3 sm:px-4 py-3 text-sm text-slate-500 border-b border-[#E5E5E5]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--pos-accent)]" />
          <span className="text-xs sm:text-sm">Searching accounts...</span>
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="flex flex-col items-center py-5 sm:py-6 text-slate-400 px-4">
          <Search className="w-6 sm:w-7 h-6 sm:h-7 mb-2 opacity-20" />
          <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-1">No results found</p>
          <ul className="text-[10px] sm:text-[11px] text-slate-400 space-y-0.5 text-center">
            <li>Check your spelling</li>
            <li>Try fewer words or characters</li>
            <li>Search by account number for exact results</li>
          </ul>
        </div>
      )}

      {capped.length > 0 && (
        <>
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#F7F7F7] border-b border-[#E5E5E5] flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {results.length} account{results.length !== 1 ? 's' : ''}
              {hasMore && <span className="text-slate-400 normal-case font-normal"> (top {maxResults})</span>}
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              <kbd className="px-1 py-0.5 bg-[#F2F4F7] rounded text-[9px] font-mono">↑↓</kbd> navigate
              <kbd className="px-1 py-0.5 bg-[#F2F4F7] rounded text-[9px] font-mono ml-1">Enter</kbd> select
              <kbd className="px-1 py-0.5 bg-[#F2F4F7] rounded text-[9px] font-mono ml-1">Esc</kbd> close
            </span>
          </div>
          <div ref={listRef} className="overflow-y-auto flex-1 overscroll-contain" role="listbox">
            {capped.map((account, i) => {
              const bal = account.outStandingAmount ?? account.outStandingAmt ?? 0;
              const acctNum = String(account.accountNumber || account.accountID || account.account_ID || '');
              const isActive = (account.accountStatus || account.statusDesc)?.toLowerCase() === 'active';
              const name = account.name || account.surname_Company || 'Unknown';
              const addr = (account.locationAddress || account.address || account.deliveryAddress || '').replace(/\r\n/g, ', ');
              const pinned = isPinned?.(account);
              return (
                <div
                  key={account.accountID || account.account_ID || i}
                  onClick={() => onSelect(account)}
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-2.5 cursor-pointer transition-all border-b border-[#F0F0F0] last:border-0 active:bg-[var(--pos-accent-tint-strong)]/60
                    ${highlightIdx === i ? 'bg-[var(--pos-accent-tint)] border-l-3 border-l-[var(--pos-accent)]' : 'hover:bg-[#F7F7F7] border-l-3 border-l-transparent'}`}
                  data-testid={`dropdown-account-${account.accountID || account.account_ID || i}`}
                  role="option"
                  aria-selected={highlightIdx === i}
                  tabIndex={-1}
                >
                  <div className={`shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold
                    ${isActive ? 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]' : 'bg-[#F2F4F7] text-slate-500'}`}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-[11px] sm:text-xs font-mono text-[var(--pos-accent)] font-semibold"><HighlightMatch text={acctNum} query={query} /></span>
                      <span className="text-[12px] sm:text-sm font-medium text-slate-800 truncate"><HighlightMatch text={name} query={query} /></span>
                      <Badge
                        variant={isActive ? 'default' : 'secondary'}
                        className="text-[8px] sm:text-[9px] shrink-0 h-3.5 sm:h-4 px-1 sm:px-1.5 hidden sm:inline-flex"
                      >
                        {account.accountStatus || account.statusDesc || '?'}
                      </Badge>
                    </div>
                    {addr && (
                      <div className="text-[9px] sm:text-[10px] text-slate-400 truncate mt-0.5">
                        <HighlightMatch text={addr} query={query} />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1 sm:gap-2">
                    {onPin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onPin(account); }}
                        className={`p-1.5 rounded transition-colors hidden sm:block ${pinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                        title={pinned ? 'Unpin account' : 'Pin account'}
                        aria-label={pinned ? 'Unpin account' : 'Pin account'}
                        data-testid={`btn-pin-dropdown-${i}`}
                      >
                        <Star className={`w-3.5 h-3.5 ${pinned ? 'fill-amber-500' : ''}`} />
                      </button>
                    )}
                    <div className="text-right min-w-[55px] sm:min-w-[90px]">
                      <div className={`text-[11px] sm:text-sm font-mono font-bold ${bal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        R {bal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore && onViewAll && (
            <button
              onClick={onViewAll}
              className="w-full px-4 py-2.5 sm:py-2.5 text-xs text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] hover:bg-[var(--pos-accent-tint)] active:bg-[var(--pos-accent-tint-strong)] transition-colors border-t border-[#E5E5E5] font-medium text-center"
              data-testid="button-view-all-results"
            >
              View all {results.length} results
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function ExpandableResultRow({ account, onSelect, isExpanded, onToggleExpand, searchQuery, onPin, isPinned }: {
  account: EnquirySearchResult;
  onSelect: (account: EnquirySearchResult) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  searchQuery?: string;
  onPin?: (account: EnquirySearchResult) => void;
  isPinned?: boolean;
}) {
  const [enrichedData, setEnrichedData] = useState<{ basicDetails: any; propertyDetails: any; services: any[]; sectionalTitle: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const accountId = account.account_ID || account.accountID;
  const aid = account.accountID || account.account_ID || 0;
  const status = account.accountStatus || account.statusDesc || '-';
  const outstanding = account.outStandingAmount ?? account.outStandingAmt ?? 0;
  const acctType = account.accountType || account.accountDesc || 'Owner / Occupier';
  const addr = account.address || account.deliveryAddress || account.locationAddress || '-';

  const loadEnrichedData = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    Promise.allSettled([
      getBasicAccountDetails(accountId),
      getPropertyDetails(accountId),
      getAllServices(accountId),
      getSectionalTitleScheme(accountId),
    ]).then(([bdResult, pdResult, svcResult, stResult]) => {
      const allFailed = [bdResult, pdResult, svcResult].every(r => r.status === 'rejected');
      if (allFailed) {
        setFetchError(true);
      } else {
        setEnrichedData({
          basicDetails: bdResult.status === 'fulfilled' ? bdResult.value : null,
          propertyDetails: pdResult.status === 'fulfilled' ? (Array.isArray(pdResult.value) ? pdResult.value[0] : pdResult.value) : null,
          services: svcResult.status === 'fulfilled' ? (Array.isArray(svcResult.value) ? svcResult.value : []) : [],
          sectionalTitle: stResult.status === 'fulfilled' ? stResult.value : null,
        });
      }
      setLoaded(true);
      setLoading(false);
    });
  }, [accountId]);

  useEffect(() => {
    if (isExpanded && !loaded && !loading) {
      loadEnrichedData();
    }
  }, [isExpanded, loaded, loading, loadEnrichedData]);

  const bd = enrichedData?.basicDetails || {};
  const pd = enrichedData?.propertyDetails || {};
  const services = enrichedData?.services || [];
  const st = enrichedData?.sectionalTitle;
  const activeServices = services.filter((s: any) => (s.statusDesc || s.status || '').toLowerCase().trim() === 'active');

  return (
    <>
      <tr
        className={`border-b border-[#E5E5E5] transition-colors duration-150 cursor-pointer ${isExpanded ? 'bg-[var(--pos-accent-tint)]/80' : 'hover:bg-[var(--pos-accent-tint)]/60'}`}
        data-testid={`expandable-row-${aid}`}
      >
        <td className="px-1 py-2.5 text-center w-8">
          <button
            onClick={onToggleExpand}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--pos-accent-tint-strong)] transition-colors mx-auto"
            data-testid={`btn-expand-${aid}`}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        </td>
        <td className="px-1 py-2.5 text-center w-8">
          {onPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onPin(account); }}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors mx-auto ${isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
              data-testid={`btn-pin-${aid}`}
              aria-label={isPinned ? 'Unpin account' : 'Pin account'}
            >
              <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-500' : ''}`} />
            </button>
          )}
        </td>
        <td className="px-2 py-2.5 whitespace-nowrap">
          <button
            onClick={() => onSelect(account)}
            className="font-mono text-[var(--pos-accent)] font-semibold hover:text-[var(--pos-accent-dark)] hover:underline text-[13px]"
            data-testid={`btn-account-${aid}`}
          >
            {searchQuery ? <HighlightMatch text={String(account.accountNumber || aid)} query={searchQuery} /> : (account.accountNumber || aid)}
          </button>
        </td>
        <td className="px-2 py-2.5" data-testid={`text-name-${aid}`}>
          <span className="font-medium text-slate-800 text-[13px] whitespace-nowrap">
            {searchQuery ? <HighlightMatch text={account.name || account.surname_Company || '-'} query={searchQuery} /> : (account.name || account.surname_Company || '-')}
          </span>
        </td>
        <td className="px-2 py-2.5 text-slate-500 whitespace-nowrap" data-testid={`text-address-${aid}`}>
          <span className="truncate block max-w-[200px]">
            {searchQuery ? <HighlightMatch text={addr.replace(/\r\n/g, ', ')} query={searchQuery} /> : addr.replace(/\r\n/g, ', ')}
          </span>
        </td>
        <td className="px-2 py-2.5 text-center whitespace-nowrap">
          <Badge
            variant={status.toLowerCase() === 'active' ? 'default' : 'secondary'}
            className="text-[10px]"
            data-testid={`badge-status-${aid}`}
          >
            {status}
          </Badge>
        </td>
        <td className="px-2 py-2.5 text-center whitespace-nowrap">
          <Badge variant="outline" className="text-[10px] font-normal" data-testid={`badge-type-${aid}`}>
            {acctType}
          </Badge>
        </td>
        <td className="px-2 py-2.5 text-right whitespace-nowrap" data-testid={`text-outstanding-${aid}`}>
          <span className={`font-mono text-[13px] font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
            R {outstanding.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </span>
        </td>
        <td className="px-2 py-2.5 text-slate-500 font-mono whitespace-nowrap">
          {account.oldAccountCode || '-'}
        </td>
        <td className="px-2 py-2.5 text-slate-400 font-mono whitespace-nowrap">
          <span className="truncate block max-w-[180px]">{account.sgNumber || '-'}</span>
        </td>
        <td className="px-2 py-2.5 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect(account)}
            className="h-7 px-2 text-xs text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] hover:bg-[var(--pos-accent-tint-strong)]"
            data-testid={`btn-open-${aid}`}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Open
          </Button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={11} className="p-0">
            <div className="bg-gradient-to-b from-[var(--pos-accent-tint)] to-white border-b border-[#D6D6D6] border-l-2 border-l-[var(--pos-accent)] px-2 sm:px-4 py-3 sm:py-4">
          {loading && (
            <div className="flex items-center gap-3 py-8 justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading enriched details...</span>
            </div>
          )}

          {loaded && fetchError && (
            <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="text-sm">Could not load enriched details</span>
              <button onClick={() => { setLoaded(false); setFetchError(false); loadEnrichedData(); }} className="text-xs text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] underline" data-testid={`button-retry-enrich-${aid}`}>Retry</button>
            </div>
          )}

          {loaded && !fetchError && enrichedData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-[#D6D6D6]/60 shadow-sm overflow-hidden" data-testid={`panel-account-details-${aid}`}>
                <div className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] px-4 py-2.5 flex items-center gap-2">
                  <User className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Account Details</span>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div><span className="text-slate-400">Account No:</span> <span className="font-medium text-slate-800">{account.accountNumber || '-'}</span></div>
                    <div><span className="text-slate-400">Old Code:</span> <span className="font-medium text-slate-800">{account.oldAccountCode || '-'}</span></div>
                    <div><span className="text-slate-400">Status:</span> <Badge variant={status.toLowerCase() === 'active' ? 'default' : 'secondary'} className="text-[9px] ml-1">{status}</Badge></div>
                    <div><span className="text-slate-400">Type:</span> <span className="font-medium text-slate-800">{acctType}</span></div>
                    <div className="col-span-2"><span className="text-slate-400">Name:</span> <span className="font-medium text-slate-800">{account.name || account.surname_Company || '-'}</span></div>
                    <div><span className="text-slate-400">Initials:</span> <span className="font-medium text-slate-800">{account.initials || bd.initials || '-'}</span></div>
                    <div><span className="text-slate-400">ID Number:</span> <span className="font-mono font-medium text-slate-800">{account.addName || account.idRegistrationNumber || bd.idRegistrationNumber || '-'}</span></div>
                    <div><span className="text-slate-400">Credit Status:</span> <span className="font-medium text-slate-800">{bd.creditStatusDesc || bd.creditStatus || bd.creditRating || '-'}</span></div>
                    <div><span className="text-slate-400">Solvency:</span> <span className="font-medium text-slate-800">{bd.solvencyDesc || bd.solvency || bd.solvencyStatus || '-'}</span></div>
                    <div><span className="text-slate-400">Institution:</span> <span className="font-medium text-slate-800">{bd.institutionDesc || bd.institution || bd.institutionName || '-'}</span></div>
                    <div><span className="text-slate-400">Group Code:</span> <span className="font-medium text-slate-800">{bd.groupCodeDesc || bd.groupCode || bd.accountGroup || '-'}</span></div>
                    <div><span className="text-slate-400">Payment Group:</span> <span className="font-medium text-slate-800">{bd.paymentGroupDesc || bd.paymentGroup || bd.paymentGroupDescription || '-'}</span></div>
                    <div><span className="text-slate-400">Postal Code:</span> <span className="font-medium text-slate-800">{bd.postalCode || '-'}</span></div>
                    <div><span className="text-slate-400">Email:</span> <span className="font-medium text-slate-800 truncate">{bd.emailId || bd.email || bd.emailAddress || '-'}</span></div>
                    <div><span className="text-slate-400">Contact:</span> <span className="font-medium text-slate-800">{bd.contactNo || bd.contactNumber || bd.tel_Mobile || '-'}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-[#D6D6D6]/60 shadow-sm overflow-hidden" data-testid={`panel-property-${aid}`}>
                <div className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] px-4 py-2.5 flex items-center gap-2">
                  <Home className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Property Information</span>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="col-span-2"><span className="text-slate-400">SG Number:</span> <span className="font-mono font-medium text-slate-800">{account.sgNumber || pd.sgNumber || pd.sg_Number || '-'}</span></div>
                    <div className="col-span-2"><span className="text-slate-400">Address:</span> <span className="font-medium text-slate-800">{[pd.streetNumber, pd.streetName].filter(Boolean).join(' ') || addr.replace(/\r\n/g, ', ')}</span></div>
                    <div><span className="text-slate-400">Suburb:</span> <span className="font-medium text-slate-800">{pd.suburb || '-'}</span></div>
                    <div><span className="text-slate-400">Town:</span> <span className="font-medium text-slate-800">{pd.town || '-'}</span></div>
                    <div><span className="text-slate-400">Ward:</span> <span className="font-medium text-slate-800">{pd.ward || pd.wardNumber || '-'}</span></div>
                    <div><span className="text-slate-400">Type of Use:</span> <span className="font-medium text-slate-800">{pd.typeOfUse || pd.propertyTypeOfUse || pd.typeofUse || '-'}</span></div>
                    <div className="col-span-2"><span className="text-slate-400">Town Planning Zone:</span> <span className="font-medium text-slate-800">{pd.townPlanningZoneType || pd.townPlanningZone || '-'}</span></div>
                    <div><span className="text-slate-400">Market Value:</span> <span className="font-medium text-slate-800">{pd.marketValue != null ? `R ${Number(pd.marketValue).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</span></div>
                    <div><span className="text-slate-400">Stand Size:</span> <span className="font-medium text-slate-800">{pd.standSize || pd.extent || pd.extentM2 || '-'}</span></div>
                    <div><span className="text-slate-400">Land Size:</span> <span className="font-medium text-slate-800">{pd.landSize || pd.landExtent || '-'}</span></div>
                    <div><span className="text-slate-400">Roll Number:</span> <span className="font-medium text-slate-800">{pd.rollNumber || pd.valuationRollNumber || '-'}</span></div>
                    <div><span className="text-slate-400">Rates Tariff:</span> <span className="font-medium text-slate-800">{pd.ratesTariff || pd.tariff || '-'}</span></div>
                    <div><span className="text-slate-400">Master Property:</span> <span className="font-medium text-slate-800">{pd.masterProperty != null ? (pd.masterProperty ? 'Yes' : 'No') : '-'}</span></div>
                    {st && (
                      <>
                        <div><span className="text-slate-400">SS Unit No:</span> <span className="font-medium text-slate-800">{st.ssUnitNumber || st.unitNumber || '-'}</span></div>
                        <div className="col-span-2"><span className="text-slate-400">Sectional Title:</span> <span className="font-medium text-slate-800">{st.schemeName || st.sectionalTitleSchemeName || st.name || '-'}</span></div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-[#D6D6D6]/60 shadow-sm overflow-hidden" data-testid={`panel-services-${aid}`}>
                <div className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] px-4 py-2.5 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Active Services</span>
                  <Badge className="ml-auto bg-white/20 text-white text-[10px] border-0">{activeServices.length} active</Badge>
                </div>
                <div className="p-3 text-xs">
                  {services.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">No services found</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                      {services.map((svc: any, si: number) => {
                        const svcStatus = (svc.statusDesc || svc.status || '-').toLowerCase().trim();
                        const isActive = svcStatus === 'active';
                        return (
                          <div key={si} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${isActive ? 'bg-green-50/60 border border-green-100' : 'bg-[#F7F7F7] border border-[#E5E5E5]'}`} data-testid={`service-item-${aid}-${si}`}>
                            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-slate-700">{svc.serviceDesc || svc.serviceDescription || svc.serviceType || `Service ${si + 1}`}</span>
                              {svc.serviceModeDesc && <span className="text-slate-400 ml-1">({svc.serviceModeDesc})</span>}
                              {svc.tariff && <span className="text-slate-400 ml-1 truncate max-w-[100px] inline-block align-bottom">• {String(svc.tariff).substring(0, 30)}</span>}
                            </div>
                            <Badge
                              variant={isActive ? 'default' : 'secondary'}
                              className={`text-[9px] shrink-0 ${isActive ? 'bg-green-600' : ''}`}
                            >
                              {svc.statusDesc || svc.status || '-'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
