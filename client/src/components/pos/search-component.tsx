import React, { useState, useEffect, useRef } from 'react';
import { Search, CreditCard, Users, Zap, FileText, Layers, Info, Filter, Loader2, Building } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ACCOUNTS, DIRECT_INCOME_ITEMS, ACCOUNT_GROUPS, CLEARANCES, Account } from '@/lib/mock-data';
import { searchInstitutions, InstitutionSearchResult } from '@/lib/external-api';

export function parseMobileFromContactDetails(contactDetails: string | undefined | null): string {
    if (!contactDetails) return '';
    const mobileMatch = contactDetails.match(/<b>\s*Mobile\s*No\.?\s*:?\s*<\/b>\s*([^<]*)/i);
    if (mobileMatch && mobileMatch[1].trim()) return mobileMatch[1].trim();
    const telMatch = contactDetails.match(/<b>\s*Tel\s*Number\s*:?\s*<\/b>\s*([^<]*)/i);
    if (telMatch && telMatch[1].trim()) return telMatch[1].trim();
    return '';
}
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface SearchResult {
    type: 'ACCOUNT' | 'DIRECT' | 'PREPAID' | 'GROUP' | 'CLEARANCE';
    data: any;
    label: string;
}

interface UnifiedSearchProps {
    onSelect?: (result: SearchResult) => void;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
    scope?: 'ALL' | 'ACCOUNT' | 'PREPAID' | 'DIRECT' | 'GROUP' | 'CLEARANCE';
    institutions?: any[];
}

export function UnifiedSearch({ onSelect, placeholder, autoFocus, className, scope = 'ALL', institutions = [] }: UnifiedSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter logic
  const results = React.useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    // User requested to ONLY return from microservices for accounts.
    // We will disable local account search.
    // We will keep other types (Direct Income, etc) if they are not part of the account microservice yet, 
    // but based on "only return from microservices", we might want to hide them or user implies account search.
    
    // For safety in this prototype step, I will comment out the local ACCOUNT search 
    // but keep the others (Direct Income, Clearance) as they likely don't have endpoints yet 
    // and might be needed for the POS to function (e.g. paying for a fine).
    
    const q = searchQuery.toLowerCase();
    let combinedResults: SearchResult[] = [];
    
    /* 
    // DISABLED LOCAL ACCOUNT SEARCH - USING EXTERNAL API ONLY
    if (scope === 'ALL' || scope === 'ACCOUNT') {
        const accounts = ACCOUNTS.filter(a => 
          a.accountNo.toLowerCase().includes(q) || 
          a.name.toLowerCase().includes(q) ||
          a.idNo.includes(q) ||
          a.address.toLowerCase().includes(q) ||
          (a.sgNo && a.sgNo.toLowerCase().includes(q)) ||
          (a.oldCode && a.oldCode.toLowerCase().includes(q))
        ).map(a => ({ type: 'ACCOUNT' as const, data: a, label: `${a.accountNo} - ${a.name}` }));
        combinedResults = [...combinedResults, ...accounts];
    }

    if (scope === 'ALL' || scope === 'PREPAID') {
        const prepaid = ACCOUNTS.filter(a => 
            a.prepaidMeterNo && (
                a.prepaidMeterNo.includes(q) ||
                a.name.toLowerCase().includes(q) ||
                a.accountNo.toLowerCase().includes(q) ||
                a.address.toLowerCase().includes(q) ||
                (a.sgNo && a.sgNo.toLowerCase().includes(q)) ||
                (a.oldCode && a.oldCode.toLowerCase().includes(q)) ||
                a.idNo.includes(q)
            )
        ).map(a => ({ type: 'PREPAID' as const, data: a, label: `${a.prepaidType || 'Meter'}: ${a.prepaidMeterNo} (${a.name})` }));
        combinedResults = [...combinedResults, ...prepaid];
    }
    */

    // Keep these valid for POS functionality until replaced by APIs
    if (scope === 'ALL' || scope === 'DIRECT') {
        const di = DIRECT_INCOME_ITEMS.filter(d => 
          d.description.toLowerCase().includes(q) ||
          d.groupName.toLowerCase().includes(q)
        ).map(d => ({ type: 'DIRECT' as const, data: d, label: `${d.description} (${d.groupName})` }));
        combinedResults = [...combinedResults, ...di];
    }

    if (scope === 'ALL' || scope === 'GROUP') {
        const instResults = institutions.filter((inst: any) =>
          inst.Description && inst.Description.toLowerCase().includes(q) && inst.IsEnabled
        ).slice(0, 5).map((inst: any) => ({
            type: 'GROUP' as const,
            data: { institutionID: inst.Id, institutionDesc: inst.Description, isLocal: true },
            label: `Group: ${inst.Description}`
        }));
        combinedResults = [...combinedResults, ...instResults];
    }

    if (scope === 'ALL' || scope === 'CLEARANCE') {
        const clearances = CLEARANCES.filter(c =>
            c.scheduleNo.toLowerCase().includes(q)
        ).map(c => ({ type: 'CLEARANCE' as const, data: c, label: `Clearance: ${c.scheduleNo}` }));
        combinedResults = [...combinedResults, ...clearances];
    }

    return combinedResults.slice(0, 8);
  }, [searchQuery, scope, institutions]);

  // External Search Logic
  const [externalResults, setExternalResults] = useState<SearchResult[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);

  const searchExternalApi = async (query: string) => {
      if (query.length < 3) return;
      setIsSearchingExternal(true);
      try {
          const proxyBase = '/api/proxy/billing-enquiry-search';
          
          let accountRequests = [];

          if (/^\d+$/.test(query)) {
              const p1 = new URLSearchParams();
              p1.append('accountId', query);
              accountRequests.push(fetch(`${proxyBase}?${p1.toString()}`));

              const p2 = new URLSearchParams();
              p2.append('oldAccount', query);
              accountRequests.push(fetch(`${proxyBase}?${p2.toString()}`));

              const p3 = new URLSearchParams();
              p3.append('physicalMeterNumber', query);
              accountRequests.push(fetch(`${proxyBase}?${p3.toString()}`));
          } else {
              const p = new URLSearchParams();
              p.append('companyName', query);
              accountRequests.push(fetch(`${proxyBase}?${p.toString()}`));

              const p2 = new URLSearchParams();
              p2.append('deliveryAddress', query);
              accountRequests.push(fetch(`${proxyBase}?${p2.toString()}`));
          }

          const [accountResponses, institutionResults] = await Promise.all([
              Promise.all(accountRequests),
              searchInstitutions(query),
          ]);

          let allAccountData: any[] = [];
          for (const res of accountResponses) {
              if (res.ok) {
                  const data = await res.json();
                  if (Array.isArray(data)) {
                      allAccountData = [...allAccountData, ...data];
                  } else if (data.value && Array.isArray(data.value)) {
                      allAccountData = [...allAccountData, ...data.value];
                  }
              }
          }

          const uniqueAccounts = Array.from(new Map(allAccountData.map(item => [item.accountID, item])).values());

          const accountResults: SearchResult[] = uniqueAccounts.slice(0, 10).map((item: any) => ({
              type: 'ACCOUNT' as const,
              data: {
                  accountNo: item.accountNumber || item.oldAccountCode || `${item.accountID}`,
                  name: item.name || 'Unknown',
                  idNo: '-',
                  address: item.address || item.locationAddress || '',
                  outstandingAmount: item.outStandingAmount || 0,
                  status: item.accountStatus || 'Active',
                  email: '',
                  mobile: parseMobileFromContactDetails(item.contactDetails),
                  accountType: item.accountType || 'Consumer',
                  sgNo: item.sgNumber || '',
                  oldCode: item.oldAccountCode || '',
                  prepaidMeterNo: '',
                  unitId: item.unitID,
                  apiId: item.accountID,
              } as Account,
              label: `${item.accountNumber || item.oldAccountCode || item.accountID} - ${item.name || 'Unknown'}`
          }));

          const groupedInstitutions = new Map<number, { desc: string; members: InstitutionSearchResult[] }>();
          for (const inst of institutionResults) {
              if (inst.institutionID != null) {
                  if (!groupedInstitutions.has(inst.institutionID)) {
                      groupedInstitutions.set(inst.institutionID, { desc: inst.institutionDesc || 'Unknown Group', members: [] });
                  }
                  groupedInstitutions.get(inst.institutionID)!.members.push(inst);
              }
          }

          const groupResults: SearchResult[] = Array.from(groupedInstitutions.entries()).slice(0, 5).map(([instId, group]) => ({
              type: 'GROUP' as const,
              data: {
                  institutionID: instId,
                  institutionDesc: group.desc,
                  members: group.members,
                  totalOutstanding: group.members.reduce((sum, m) => sum + (m.outStandingAmt || 0), 0),
                  memberCount: group.members.length,
              },
              label: `Group: ${group.desc} (${group.members.length} accounts)`
          }));

          setExternalResults([...groupResults, ...accountResults]);
      } catch (error) {
          console.error("Account search failed:", error);
          setExternalResults([]);
      } finally {
          setIsSearchingExternal(false);
      }
  };

  // Debounce external search
  useEffect(() => {
      const timer = setTimeout(() => {
          if (searchQuery.length >= 3) {
              searchExternalApi(searchQuery);
          } else {
              setExternalResults([]);
          }
      }, 800); // 800ms debounce for network calls

      return () => clearTimeout(timer);
  }, [searchQuery]);

  // Combine results
  const combinedResults = React.useMemo(() => {
      return [...results, ...externalResults];
  }, [results, externalResults]);

  useEffect(() => {
    if (searchQuery.length >= 2) setIsOpen(true);
    else setIsOpen(false);
  }, [searchQuery]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
      setSearchQuery('');
      setIsOpen(false);
      if (onSelect) {
          onSelect(result);
      }
  };

  return (
    <div className={`relative w-full z-50 flex gap-2 ${className || ''}`} ref={wrapperRef}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder || "Search Account / Meter / Group / Clearance..."}
          className="pl-10 h-12 text-lg shadow-sm border-primary/20 focus-visible:ring-primary/30"
          autoFocus={autoFocus}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
             <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">Esc</span>
            </kbd>
        </div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 border-primary/20 bg-background">
            <Info className="h-5 w-5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <h4 className="font-medium leading-none mb-4">Search Tips</h4>
            <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground text-right">Accounts:</span>
                <span>Name, Account No, ID No, SG No, Old Code, or Address.</span>
                
                <span className="font-semibold text-foreground text-right">Prepaid:</span>
                <span>Meter No or Owner Details.</span>
                
                <span className="font-semibold text-foreground text-right">Groups:</span>
                <span>Group Name (e.g. "Sunset").</span>
                
                <span className="font-semibold text-foreground text-right">Clearance:</span>
                <span>Schedule No (e.g. "CLR-2023").</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {isOpen && (results.length > 0 || externalResults.length > 0 || isSearchingExternal) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground rounded-lg border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-[100] max-h-[60vh] overflow-y-auto">
          <div className="py-1">
            {isSearchingExternal && (
                <div className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-2 bg-muted/30">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Searching external database...
                </div>
            )}
            
            {combinedResults.map((result, idx) => (
              <button
                key={`${result.type}-${idx}`}
                className="w-full text-left px-4 py-4 hover:bg-muted/50 focus:bg-muted focus:outline-none flex items-center gap-4 transition-colors group border-b last:border-0"
                onClick={() => handleSelect(result)}
              >
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm
                  ${result.type === 'ACCOUNT' ? 'bg-blue-100 text-blue-600' : ''}
                  ${result.type === 'PREPAID' ? 'bg-yellow-100 text-yellow-600' : ''}
                  ${result.type === 'DIRECT' ? 'bg-green-100 text-green-600' : ''}
                  ${result.type === 'GROUP' ? 'bg-purple-100 text-purple-600' : ''}
                  ${result.type === 'CLEARANCE' ? 'bg-amber-100 text-amber-600' : ''}
                `}>
                  {result.type === 'ACCOUNT' && <Users className="w-6 h-6" />}
                  {result.type === 'PREPAID' && <Zap className="w-6 h-6" />}
                  {result.type === 'DIRECT' && <CreditCard className="w-6 h-6" />}
                  {result.type === 'GROUP' && <Building className="w-6 h-6" />}
                  {result.type === 'CLEARANCE' && <FileText className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                      {result.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {result.type === 'ACCOUNT' && (result.data as any).address}
                    {result.type === 'DIRECT' && (result.data as any).scoaItem}
                    {result.type === 'GROUP' && (result.data as any).members && (
                        <span>Total Outstanding: R {((result.data as any).totalOutstanding || 0).toFixed(2)} | {(result.data as any).memberCount} account(s)</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            
            {combinedResults.length === 0 && !isSearchingExternal && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                    No results found locally or externally.
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
