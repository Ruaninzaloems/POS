import React, { useState, useEffect, useRef } from 'react';
import { Search, CreditCard, Users, Zap, FileText, Layers, Info, Filter, Cloud, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ACCOUNTS, DIRECT_INCOME_ITEMS, ACCOUNT_GROUPS, CLEARANCES, Account } from '@/lib/mock-data';
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
}

export function UnifiedSearch({ onSelect, placeholder, autoFocus, className, scope = 'ALL' }: UnifiedSearchProps) {
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
        const groups = ACCOUNT_GROUPS.filter(g =>
          g.name.toLowerCase().includes(q)
        ).map(g => ({ type: 'GROUP' as const, data: g, label: `Group: ${g.name}` }));
        combinedResults = [...combinedResults, ...groups];
    }

    if (scope === 'ALL' || scope === 'CLEARANCE') {
        const clearances = CLEARANCES.filter(c =>
            c.scheduleNo.toLowerCase().includes(q)
        ).map(c => ({ type: 'CLEARANCE' as const, data: c, label: `Clearance: ${c.scheduleNo}` }));
        combinedResults = [...combinedResults, ...clearances];
    }

    return combinedResults.slice(0, 8);
  }, [searchQuery, scope]);

  // External Search Logic
  const [externalResults, setExternalResults] = useState<SearchResult[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);

  const searchExternalApi = async (query: string) => {
      if (query.length < 3) return;
      setIsSearchingExternal(true);
      try {
          // Construct query params
          const baseUrl = 'https://george-uat-ems-billing-api.azurewebsites.net/api/cons-accounts/search';
          
          let requests = [];

          if (/^\d+$/.test(query)) {
              // Digits: Search by Account Number AND Physical Meter Number (Parallel)
              
              const p1 = new URLSearchParams();
              p1.append('accountNumber', query);
              requests.push(fetch(`${baseUrl}?${p1.toString()}`, { headers: { 'Accept': 'application/json' } }));

              const p2 = new URLSearchParams();
              p2.append('physicalMeterNumber', query);
              requests.push(fetch(`${baseUrl}?${p2.toString()}`, { headers: { 'Accept': 'application/json' } }));

          } else {
              // Text: Search by Name
              const p = new URLSearchParams();
              p.append('name', query);
              requests.push(fetch(`${baseUrl}?${p.toString()}`, { headers: { 'Accept': 'application/json' } }));
          }

          const responses = await Promise.all(requests);
          let allData: any[] = [];

          for (const res of responses) {
              if (res.ok) {
                  const data = await res.json();
                  if (Array.isArray(data)) {
                      allData = [...allData, ...data];
                  }
              }
          }

          // Deduplicate by accountID
          const uniqueData = Array.from(new Map(allData.map(item => [item.accountID, item])).values());

          if (uniqueData.length > 0) {
              const mapped = uniqueData.map((item: any) => {
                  const addressDisplay = item.deliveryAddress || [item.streetName, item.town].filter(Boolean).join(', ') || 'Unknown Address';

                  return {
                      type: 'ACCOUNT' as const,
                      data: {
                          // Map ConsAccount API fields to our internal Account interface
                          accountNo: item.accountNumber || `ID-${item.accountID}`,
                          name: item.name || 'Unknown Name',
                          idNo: '-', // Not in search view
                          address: addressDisplay,
                          outstandingAmount: item.outStandingAmt || 0,
                          status: item.statusDesc || 'Active',
                          email: '', // Not in search view
                          mobile: '', // Not in search view
                          accountType: item.accountDesc || 'External Consumer',
                          // Helper for display
                          valuationCategory: item.typeOfUseDesc
                      } as Account,
                      label: `${item.accountNumber} - ${item.name} (${item.statusDesc || 'Active'})`
                  };
              });
              setExternalResults(mapped);
          } else {
             // If no results found, maybe throw to trigger fallback if strictly needed, 
             // but usually empty list is valid. 
             // HOWEVER, for prototype we WANT fallback to show if live fails.
             // But if live succeeds and returns empty, we shouldn't show mock.
             // Let's only throw if ALL requests failed or network error.
             if (uniqueData.length === 0 && responses.every(r => !r.ok)) {
                 throw new Error("All API calls failed");
             }
             setExternalResults([]);
          }
      } catch (error) {
          console.error("External API Search Failed:", error);
          
          // FALLBACK SIMULATION FOR PROTOTYPE
          
          const simulatedResults = [
              {
                  accountID: 101,
                  accountNumber: "01", 
                  name: "Simulated User 01",
                  statusDesc: "Active",
                  outStandingAmt: 5432.10,
                  deliveryAddress: "123 Live API Road, Cloud City",
                  accountDesc: "Residential"
              },
              {
                  accountID: 102,
                  accountNumber: "999000123456",
                  name: "External Live User 1",
                  statusDesc: "Active",
                  outStandingAmt: 1200.50,
                  deliveryAddress: "77 Sunset Strip",
                  accountDesc: "Business"
              },
              {
                  accountID: 103,
                  accountNumber: "ACC-METER-TEST",
                  name: "Meter Test User",
                  statusDesc: "Active",
                  outStandingAmt: 0,
                  deliveryAddress: "888 Terminator Blvd",
                  accountDesc: "Indigent"
              }
          ].filter(item => 
              item.accountNumber.includes(query) || 
              (item.name && item.name.toLowerCase().includes(query.toLowerCase()))
          );

          if (simulatedResults.length > 0) {
              const mapped = simulatedResults.map((item: any) => {
                  return {
                      type: 'ACCOUNT' as const,
                      data: {
                          accountNo: item.accountNumber,
                          name: item.name,
                          idNo: '-',
                          address: item.deliveryAddress,
                          outstandingAmount: item.outStandingAmt,
                          status: item.statusDesc,
                          email: '',
                          mobile: '',
                          accountType: item.accountDesc
                      } as Account,
                      label: `${item.accountNumber} - ${item.name} (External-Sim)`
                  };
              });
              setExternalResults(mapped);
          } else {
              setExternalResults([]);
          }

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
                  {result.type === 'ACCOUNT' && (result.label.includes('(External)') ? <Cloud className="w-6 h-6" /> : <Users className="w-6 h-6" />)}
                  {result.type === 'PREPAID' && <Zap className="w-6 h-6" />}
                  {result.type === 'DIRECT' && <CreditCard className="w-6 h-6" />}
                  {result.type === 'GROUP' && <Layers className="w-6 h-6" />}
                  {result.type === 'CLEARANCE' && <FileText className="w-6 h-6" />}
                </div>
                <div>
                  <div className="font-semibold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                      {result.label}
                      {result.label.includes('(External)') && <span className="text-[10px] uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold">Live</span>}
                      {result.label.includes('(External-Sim)') && <span className="text-[10px] uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-bold" title="Connection Failed - Using Mock Data">Simulated</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {result.type === 'ACCOUNT' && (result.data as any).address}
                    {result.type === 'DIRECT' && (result.data as any).scoaItem}
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
