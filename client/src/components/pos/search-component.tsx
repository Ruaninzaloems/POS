import React, { useState, useEffect, useRef } from 'react';
import { Search, CreditCard, Users, Zap, FileText, Layers, Info, Filter } from 'lucide-react';
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
}

export function UnifiedSearch({ onSelect, placeholder, autoFocus, className }: UnifiedSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter logic (mocked)
  const results = React.useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const q = searchQuery.toLowerCase();
    
    const accounts = ACCOUNTS.filter(a => 
      a.accountNo.toLowerCase().includes(q) || 
      a.name.toLowerCase().includes(q) ||
      a.idNo.includes(q) ||
      a.address.toLowerCase().includes(q) ||
      (a.sgNo && a.sgNo.toLowerCase().includes(q)) ||
      (a.oldCode && a.oldCode.toLowerCase().includes(q))
    ).map(a => ({ type: 'ACCOUNT' as const, data: a, label: `${a.accountNo} - ${a.name}` }));

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

    const di = DIRECT_INCOME_ITEMS.filter(d => 
      d.description.toLowerCase().includes(q) ||
      d.groupName.toLowerCase().includes(q)
    ).map(d => ({ type: 'DIRECT' as const, data: d, label: `${d.description} (${d.groupName})` }));

    const groups = ACCOUNT_GROUPS.filter(g =>
      g.name.toLowerCase().includes(q)
    ).map(g => ({ type: 'GROUP' as const, data: g, label: `Group: ${g.name}` }));

    const clearances = CLEARANCES.filter(c =>
        c.scheduleNo.toLowerCase().includes(q)
    ).map(c => ({ type: 'CLEARANCE' as const, data: c, label: `Clearance: ${c.scheduleNo}` }));

    return [...accounts, ...prepaid, ...di, ...groups, ...clearances].slice(0, 8);
  }, [searchQuery]);

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

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground rounded-lg border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-[100]">
          <div className="py-1">
            {results.map((result, idx) => (
              <button
                key={idx}
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
                  {result.type === 'GROUP' && <Layers className="w-6 h-6" />}
                  {result.type === 'CLEARANCE' && <FileText className="w-6 h-6" />}
                </div>
                <div>
                  <div className="font-semibold text-lg group-hover:text-primary transition-colors">{result.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {result.type === 'ACCOUNT' && (result.data as any).address}
                    {result.type === 'DIRECT' && (result.data as any).scoaItem}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
