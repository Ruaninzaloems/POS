import React, { useState, useEffect } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle, AlertCircle, Upload, Filter, X } from 'lucide-react';
import { MOCK_BANK_TRANSACTIONS, MOCK_ALLOCATIONS, BankTransaction, AllocationLine, saveTransactions, saveAllocations } from '@/lib/direct-deposits-data';
import { Link, useLocation, useRoute } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { ACCOUNTS, Account, ClearanceCostSchedule } from '@/lib/mock-data';
import { UnifiedSearch as SearchComponent, SearchResult } from '@/components/pos/search-component';
import { validateAllocationAmount, calculateAllocationTotals, mapSearchResultToAllocationTarget } from '@/lib/allocation-logic';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function AllocateTransaction() {
  const [, params] = useRoute('/direct-deposits/manual/allocate/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [transaction, setTransaction] = useState<BankTransaction | null>(null);
  const [lines, setLines] = useState<AllocationLine[]>([]);
  
  // Search Filter Scope
  const [searchScope, setSearchScope] = useState<'ALL' | 'ACCOUNT' | 'PREPAID' | 'DIRECT' | 'GROUP' | 'CLEARANCE'>('ALL');
  
  // New Line State
  const [selectedAccount, setSelectedAccount] = useState<{accountNo: string, name: string, description?: string} | null>(null);
  const [newLineAmount, setNewLineAmount] = useState('');

  // Clearance Allocation State
  const [selectedClearance, setSelectedClearance] = useState<ClearanceCostSchedule | null>(null);
  const [clearanceAllocations, setClearanceAllocations] = useState<Record<string, number>>({});
  
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedAccount && inputRef.current) {
        // Short timeout to ensure DOM is ready and focus takes precedence
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 10);
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (params?.id) {
        const tx = MOCK_BANK_TRANSACTIONS.find(t => t.id === params.id);
        if (tx) setTransaction(tx);
    }
  }, [params?.id]);

  const { allocatedTotal, remaining, isFullyAllocated } = transaction 
    ? calculateAllocationTotals(lines, transaction.amount)
    : { allocatedTotal: 0, remaining: 0, isFullyAllocated: false };

  const handleSearchResult = (result: SearchResult) => {
    if (result.type === 'CLEARANCE') {
        const clearance = result.data as ClearanceCostSchedule;
        setSelectedClearance(clearance);
        setSelectedAccount(null); // Clear account selection if any
        
        // Initialize allocations with defaults
        const defaults: Record<string, number> = {};
        
        clearance.section118_1_Breakdown.forEach((item, idx) => {
             defaults[`118_1_${item.accountNo}_${idx}`] = item.amount;
        });
        
        clearance.section118_3_Breakdown.forEach((item, idx) => {
             defaults[`118_3_${item.accountNo}_${idx}`] = item.amount;
        });
        
        setClearanceAllocations(defaults);
        return;
    }

    const target = mapSearchResultToAllocationTarget(result);
    
    if (target) {
        setSelectedAccount(target);
        setNewLineAmount("0.00");
        setSelectedClearance(null); // Clear clearance selection if any
    } else {
        toast({ title: "Unsupported Type", description: "This item type cannot be allocated to directly.", variant: "destructive" });
    }
  };

  const handleReturnToCashbook = () => {
      if (remaining <= 0) return;
      
      setLines(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          accountNo: "CASHBOOK-RTN",
          amount: remaining,
          description: "Returned to Cashbook (Unallocated)"
      }]);
  };

  const handleAddLine = () => {
      if (!selectedAccount || !newLineAmount) return;
      
      const amount = parseFloat(newLineAmount);
      
      if (!transaction) return;

      const validation = validateAllocationAmount(amount, allocatedTotal, transaction.amount);
      
      if (!validation.valid) {
          toast({ 
            title: validation.error?.includes("Invalid") ? "Invalid Amount" : "Over-allocation Error", 
            description: validation.error, 
            variant: "destructive" 
          });
          return;
      }
      
      setLines(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          accountNo: selectedAccount.accountNo,
          amount: amount,
          description: selectedAccount.description || `Payment to ${selectedAccount.name}`
      }]);
      
      setSelectedAccount(null);
      setNewLineAmount('');
  };

  const handleAddClearanceLines = () => {
     if (!selectedClearance) return;
     
     const newLines: AllocationLine[] = [];
     let totalToAdd = 0;

     // Process 118(1) allocations
     selectedClearance.section118_1_Breakdown.forEach((item, idx) => {
         const key = `118_1_${item.accountNo}_${idx}`;
         const amount = clearanceAllocations[key] || 0;
         if (amount > 0) {
             newLines.push({
                 id: Math.random().toString(36).substr(2, 9),
                 accountNo: item.accountNo,
                 amount: amount,
                 description: `Clearance ${selectedClearance.scheduleNo} - 118(1): ${item.item}`
             });
             totalToAdd += amount;
         }
     });

     // Process 118(3) allocations
     selectedClearance.section118_3_Breakdown.forEach((item, idx) => {
         const key = `118_3_${item.accountNo}_${idx}`;
         const amount = clearanceAllocations[key] || 0;
         if (amount > 0) {
             newLines.push({
                 id: Math.random().toString(36).substr(2, 9),
                 accountNo: item.accountNo,
                 amount: amount,
                 description: `Clearance ${selectedClearance.scheduleNo} - 118(3): ${item.item}`
             });
             totalToAdd += amount;
         }
     });

     if (totalToAdd === 0) {
         toast({ title: "No Amounts", description: "Please enter at least one allocation amount.", variant: "destructive" });
         return;
     }
     
     if (transaction) {
         const validation = validateAllocationAmount(totalToAdd, allocatedTotal, transaction.amount);
         if (!validation.valid) {
             toast({ 
                title: "Over-allocation Error", 
                description: validation.error, 
                variant: "destructive" 
             });
             return;
         }
     }

     setLines(prev => [...prev, ...newLines]);
     setSelectedClearance(null);
     setClearanceAllocations({});
  };

  const handleRemoveLine = (id: string) => {
      setLines(prev => prev.filter(l => l.id !== id));
  };

  const handlePost = () => {
      if (!isFullyAllocated) {
          toast({ title: "Validation Error", description: "Allocated total must equal transaction amount.", variant: "destructive" });
          return;
      }

      // Update the global mock data
      const txIndex = MOCK_BANK_TRANSACTIONS.findIndex(t => t.id === transaction?.id);
      if (txIndex !== -1 && transaction) {
          MOCK_BANK_TRANSACTIONS[txIndex].status = "ALLOCATED";
          MOCK_BANK_TRANSACTIONS[txIndex].allocatedAmount = MOCK_BANK_TRANSACTIONS[txIndex].amount;

          // Save the allocation lines
          MOCK_ALLOCATIONS.push({
            transactionId: transaction.id,
            lines: [...lines],
            status: 'POSTED',
            updatedAt: new Date().toISOString()
          });

          // Persist changes
          saveTransactions();
          saveAllocations();
      }
      
      toast({ title: "Allocation Posted", description: "Transaction successfully allocated." });
      setLocation('/direct-deposits/manual');
  };

  if (!transaction) return <div className="p-8">Loading...</div>;

  return (
    <PosLayout>
      <div className="flex-1 flex flex-col h-full bg-slate-50/50">
        <div className="p-6 border-b bg-white flex items-center gap-4">
             <Link href="/direct-deposits/manual">
                <Button variant="ghost" size="icon">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
             </Link>
             <div>
                 <h1 className="text-xl font-bold">Allocate Transaction</h1>
                 <p className="text-sm text-muted-foreground font-mono">{transaction.id}</p>
             </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Transaction Details (Left Panel) */}
            <Card className="lg:col-span-1 h-fit">
                <CardHeader className="bg-slate-50 pb-4">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Bank Transaction</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Description</label>
                        <div className="font-medium text-lg">{transaction.description}</div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Bank Reference</label>
                        <Badge variant="outline" className="font-mono text-base px-2 py-0.5">{transaction.reference}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Date</label>
                            <div className="font-mono">{transaction.transactionDate}</div>
                        </div>
                        <div>
                             <label className="text-xs text-muted-foreground block mb-1">Source</label>
                             <div className="text-sm">{transaction.bankAccount}</div>
                        </div>
                    </div>
                    
                    <div className="pt-6 border-t mt-4">
                         <label className="text-xs text-muted-foreground block mb-1">Total Amount</label>
                         <div className="text-3xl font-bold text-slate-900">R {transaction.amount.toFixed(2)}</div>
                    </div>
                </CardContent>
            </Card>

            {/* Allocation Workspace (Right Panel) */}
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle className="text-lg">Allocation Lines</CardTitle>
                    </CardHeader>
                    
                    {/* Unified Search Bar Area */}
                    <div className="px-6 pb-6 border-b">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <SearchComponent 
                                    onSelect={handleSearchResult} 
                                    placeholder={
                                        searchScope === 'ALL' ? "Search Account / Meter / Group / Clearance..." : 
                                        `Search ${searchScope.charAt(0) + searchScope.slice(1).toLowerCase()}...`
                                    }
                                    className="max-w-full"
                                    scope={searchScope}
                                />
                            </div>
                            
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={`h-12 border-slate-200 ${searchScope !== 'ALL' ? 'bg-slate-100 border-slate-300' : ''}`}>
                                        <Filter className="w-4 h-4 mr-2" /> 
                                        {searchScope === 'ALL' ? 'Filter' : searchScope.charAt(0) + searchScope.slice(1).toLowerCase()}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-4" align="end">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <h4 className="font-medium text-sm">Search Scope</h4>
                                            {searchScope !== 'ALL' && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-auto p-0 text-xs text-red-600 hover:text-red-700 hover:bg-transparent"
                                                    onClick={() => setSearchScope('ALL')}
                                                >
                                                    Reset
                                                </Button>
                                            )}
                                        </div>
                                        <RadioGroup value={searchScope} onValueChange={(val: any) => setSearchScope(val)}>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="ALL" id="scope-all" />
                                                <Label htmlFor="scope-all">All Items</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="ACCOUNT" id="scope-account" />
                                                <Label htmlFor="scope-account">Consumer Accounts</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="PREPAID" id="scope-prepaid" />
                                                <Label htmlFor="scope-prepaid">Prepaid Meters</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="GROUP" id="scope-group" />
                                                <Label htmlFor="scope-group">Groups</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="CLEARANCE" id="scope-clearance" />
                                                <Label htmlFor="scope-clearance">Clearance Certificates</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="DIRECT" id="scope-direct" />
                                                <Label htmlFor="scope-direct">Direct Income Items</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Button variant="outline" className="h-12 border-slate-200">
                                <Upload className="w-4 h-4 mr-2" /> Import CSV
                            </Button>
                        </div>
                        
                        {/* Selected Account Preview / Amount Entry */}
                        {selectedAccount && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-end gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex-1">
                                    <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Selected Allocation Target</div>
                                    <div className="font-medium text-lg text-slate-900">{selectedAccount.accountNo}</div>
                                    <div className="text-sm text-slate-500">{selectedAccount.name}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 block mb-1">Amount to Allocate</label>
                                    <div className="flex gap-2">
                                        <Input 
                                            ref={inputRef}
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            className="h-10 w-32 font-bold text-right" 
                                            value={newLineAmount}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val && parseFloat(val) < 0) return;
                                                if (val.includes('.') && val.split('.')[1].length > 2) return;
                                                setNewLineAmount(val);
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={e => e.key === 'Enter' && handleAddLine()}
                                        />
                                        <Button onClick={handleAddLine} className="bg-blue-600 hover:bg-blue-700">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Clearance Cost Schedule Allocator */}
                        {selectedClearance && (
                            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-1">Clearance Allocation</div>
                                        <div className="font-medium text-lg text-slate-900">{selectedClearance.scheduleNo}</div>
                                        <div className="text-sm text-slate-500">
                                            Linked Accounts: {selectedClearance.linkedAccounts.length} | 
                                            Total Due: <span className="font-mono font-medium">R {selectedClearance.totalDue.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => setSelectedClearance(null)} className="h-6 w-6 p-0 text-slate-400">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="space-y-6">
                                    {selectedClearance.linkedAccounts.map(account => {
                                        const s118_1 = selectedClearance.section118_1_Breakdown.filter(i => i.accountNo === account.accountNo);
                                        const s118_3 = selectedClearance.section118_3_Breakdown.filter(i => i.accountNo === account.accountNo);
                                        
                                        if (s118_1.length === 0 && s118_3.length === 0) return null;

                                        return (
                                            <div key={account.accountNo} className="bg-white/60 p-3 rounded border border-amber-100">
                                                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{account.accountNo}</span>
                                                    {account.name}
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Section 118(1) */}
                                                    {s118_1.length > 0 && (
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-muted-foreground uppercase">Section 118(1)</label>
                                                            {s118_1.map((item, idx) => (
                                                                <div key={idx} className="flex items-center justify-between gap-2">
                                                                    <span className="text-xs truncate flex-1" title={item.item}>{item.item}</span>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-28 text-right font-mono text-sm"
                                                                        value={clearanceAllocations[`118_1_${account.accountNo}_${idx}`] || ''}
                                                                        onChange={e => setClearanceAllocations(prev => ({
                                                                            ...prev,
                                                                            [`118_1_${account.accountNo}_${idx}`]: parseFloat(e.target.value) || 0
                                                                        }))}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Section 118(3) */}
                                                    {s118_3.length > 0 && (
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-muted-foreground uppercase">Section 118(3)</label>
                                                            {s118_3.map((item, idx) => (
                                                                <div key={idx} className="flex items-center justify-between gap-2">
                                                                    <span className="text-xs truncate flex-1" title={item.item}>{item.item}</span>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-28 text-right font-mono text-sm"
                                                                        value={clearanceAllocations[`118_3_${account.accountNo}_${idx}`] || ''}
                                                                        onChange={e => setClearanceAllocations(prev => ({
                                                                            ...prev,
                                                                            [`118_3_${account.accountNo}_${idx}`]: parseFloat(e.target.value) || 0
                                                                        }))}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 pt-3 border-t border-amber-200 flex justify-between items-center">
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Total Clearance Allocation:</span>
                                        <span className="ml-2 font-bold font-mono">
                                            R {Object.values(clearanceAllocations).reduce((a, b) => a + b, 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <Button onClick={handleAddClearanceLines} className="bg-amber-600 hover:bg-amber-700 text-white">
                                        <Plus className="w-4 h-4 mr-2" /> Add Clearance Lines
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <CardContent className="pt-0 min-h-[300px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Account No</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-40 text-center text-muted-foreground bg-slate-50/30">
                                            <div className="flex flex-col items-center gap-2">
                                                <p>No allocations yet. Use the search bar above to find accounts or items.</p>
                                                {remaining > 0 && (
                                                    <Button variant="outline" size="sm" onClick={handleReturnToCashbook} className="mt-2 text-orange-600 border-orange-200 hover:bg-orange-50">
                                                        Return Remaining (R {remaining.toFixed(2)}) to Cashbook
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    lines.map(line => (
                                        <TableRow key={line.id}>
                                            <TableCell className="font-mono">{line.accountNo}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{line.description}</TableCell>
                                            <TableCell className="text-right font-mono">R {line.amount.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveLine(line.id)}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="bg-slate-50 border-t p-4 flex justify-between items-center">
                         <div className="flex gap-6 text-sm">
                             <div>
                                 <span className="text-muted-foreground mr-2">Allocated:</span>
                                 <span className="font-bold">R {allocatedTotal.toFixed(2)}</span>
                             </div>
                             <div>
                                 <span className="text-muted-foreground mr-2">Remaining:</span>
                                 <span className={`font-bold ${Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                     R {remaining.toFixed(2)}
                                 </span>
                             </div>
                         </div>
                         <div className="flex gap-2">
                             {remaining > 0 && (
                                <Button variant="outline" onClick={handleReturnToCashbook} className="text-orange-700 border-orange-200 hover:bg-orange-50">
                                    Return Balance to Cashbook
                                </Button>
                             )}
                             <Button 
                                className={`${isFullyAllocated ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300'}`}
                                disabled={!isFullyAllocated}
                                onClick={handlePost}
                             >
                                {isFullyAllocated ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                                Post Allocation
                             </Button>
                         </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
      </div>
    </PosLayout>
  );
}
