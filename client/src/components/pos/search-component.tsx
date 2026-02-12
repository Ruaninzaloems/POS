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

  // Filter logic (mocked)
  const results = React.useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const q = searchQuery.toLowerCase();
    let combinedResults: SearchResult[] = [];
    
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
          // Construct query params - try to match query against multiple fields since it's a unified search
          const baseUrl = 'https://george-uat-ems-billing-api.azurewebsites.net/api/billing-enquiry-search';
          
          // We'll try to guess the type of input or just send it as multiple params?
          // The API takes individual params. Let's try sending it as accountId if numeric, or companyName/other if string
          const params = new URLSearchParams();
          
          if (/^\d+$/.test(query)) {
              params.append('accountId', query);
          } else {
              params.append('companyName', query); // Fallback search field
              // potentially add mobileNumber or emailAddress if query looks like them
          }

          const response = await fetch(`${baseUrl}?${params.toString()}`, {
              method: 'GET',
              headers: {
                  'Accept': 'application/json',
                  // 'Content-Type': 'application/json' 
              }
          });

          if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data)) {
                  const mapped = data.map((item: any) => ({
                      type: 'ACCOUNT' as const,
                      data: {
                          // Map external API fields to our internal Account interface
                          accountNo: item.accountNumber || item.accountId || 'Unknown',
                          name: item.consumerName || item.companyName || 'Unknown',
                          idNo: item.idNumber || item.registrationNumber || '-',
                          address: item.physicalAddress || item.locationAddress || 'Unknown Address',
                          outstandingAmount: item.balance || item.outstandingBalance || 0,
                          status: item.status || 'Active',
                          email: item.emailAddress,
                          mobile: item.cellNumber || item.mobileNumber,
                          accountType: 'External Consumer'
                      } as Account,
                      label: `${item.accountNumber || item.accountId} - ${item.consumerName || item.companyName} (External)`
                  }));
                  setExternalResults(mapped);
              }
          } else {
             throw new Error(`API returned ${response.status}`);
          }
      } catch (error) {
          console.error("External API Search Failed:", error);
          
          // FALLBACK SIMULATION FOR PROTOTYPE
          // Since we can't control CORS on the target server, we simulate what a successful response looks like
          // so the user can verify the UI/UX integration.
          
          const simulatedResults = [
              {
                  accountNumber: "999000123456",
                  consumerName: "External Live User 1",
                  idNumber: "8001015555089",
                  physicalAddress: "123 Live API Road, Cloud City",
                  balance: 5432.10,
                  status: "Active",
                  emailAddress: "live.user@example.com",
                  cellNumber: "0829999999"
              },
              {
                  accountNumber: "999000987654",
                  consumerName: "Azure Services Ltd",
                  registrationNumber: "2023/555555/07",
                  physicalAddress: "456 Server Lane, Datacenter Park",
                  balance: 12500.00,
                  status: "Arrears",
                  emailAddress: "billing@azure-test.com",
                  cellNumber: "0118888888"
              }
          ].filter(item => 
              item.accountNumber.includes(query) || 
              item.consumerName.toLowerCase().includes(query.toLowerCase())
          );

          if (simulatedResults.length > 0) {
              const mapped = simulatedResults.map((item: any) => ({
                  type: 'ACCOUNT' as const,
                  data: {
                      accountNo: item.accountNumber,
                      name: item.consumerName,
                      idNo: item.idNumber || item.registrationNumber || '-',
                      address: item.physicalAddress,
                      outstandingAmount: item.balance,
                      status: item.status,
                      email: item.emailAddress,
                      mobile: item.cellNumber,
                      accountType: 'External Consumer'
                  } as Account,
                  label: `${item.accountNumber} - ${item.consumerName} (External-Sim)`
              }));
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
