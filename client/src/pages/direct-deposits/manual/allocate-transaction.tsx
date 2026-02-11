import React, { useState, useEffect } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle, AlertCircle, Upload, Filter } from 'lucide-react';
import { MOCK_BANK_TRANSACTIONS, BankTransaction, AllocationLine } from '@/lib/direct-deposits-data';
import { Link, useLocation, useRoute } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { ACCOUNTS, Account } from '@/lib/mock-data';
import { UnifiedSearch as SearchComponent, SearchResult } from '@/components/pos/search-component';

export default function AllocateTransaction() {
  const [, params] = useRoute('/direct-deposits/manual/allocate/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [transaction, setTransaction] = useState<BankTransaction | null>(null);
  const [lines, setLines] = useState<AllocationLine[]>([]);
  
  // New Line State
  const [selectedAccount, setSelectedAccount] = useState<{accountNo: string, name: string, description?: string} | null>(null);
  const [newLineAmount, setNewLineAmount] = useState('');
  
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

  const allocatedTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const remaining = transaction ? transaction.amount - allocatedTotal : 0;
  // Use a small epsilon for floating point comparison to ensure full allocation is detected
  const isFullyAllocated = Math.abs(remaining) < 0.005;

  const handleSearchResult = (result: SearchResult) => {
    if (result.type === 'ACCOUNT') {
        const acc = result.data as Account;
        setSelectedAccount({ 
            accountNo: acc.accountNo, 
            name: acc.name,
            description: `Payment to ${acc.name}` 
        });
        setNewLineAmount("0.00");
    } else if (result.type === 'PREPAID') {
        const acc = result.data as Account;
        const prepaidType = acc.prepaidType || 'Electricity';
        setSelectedAccount({ 
            accountNo: acc.accountNo, 
            name: `${prepaidType} Meter: ${acc.prepaidMeterNo}`,
            description: `Prepaid ${prepaidType}: ${acc.prepaidMeterNo} (${acc.name})`
        }); 
        setNewLineAmount("0.00");
    } else if (result.type === 'DIRECT') {
        const item = result.data;
        setSelectedAccount({ 
            accountNo: item.scoaItem, 
            name: item.description,
            description: `Direct Income: ${item.description}`
        });
        setNewLineAmount("0.00");
    } else if (result.type === 'GROUP') {
        const group = result.data as any;
        setSelectedAccount({
            accountNo: group.id,
            name: group.name,
            description: `Group Payment: ${group.name}`
        });
        setNewLineAmount("0.00");
    } else if (result.type === 'CLEARANCE') {
        const clr = result.data as any;
        setSelectedAccount({
            accountNo: clr.scheduleNo,
            name: `Clearance ${clr.scheduleNo}`,
            description: `Clearance Payment: ${clr.scheduleNo}`
        });
        setNewLineAmount("0.00");
    } else {
        // Fallback for any other type - just use it as is if possible, or show error
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
      if (isNaN(amount) || amount <= 0) {
          toast({ title: "Invalid Amount", variant: "destructive" });
          return;
      }

      // Validation: Check if new amount + allocatedTotal exceeds transaction amount
      // Floating point safe comparison
      if (transaction && (allocatedTotal + amount) > (transaction.amount + 0.005)) {
          toast({ 
              title: "Over-allocation Error", 
              description: `Cannot allocate R ${amount.toFixed(2)}. Remaining balance is R ${remaining.toFixed(2)}.`, 
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

  const handleRemoveLine = (id: string) => {
      setLines(prev => prev.filter(l => l.id !== id));
  };

  const handlePost = () => {
      if (!isFullyAllocated) {
          toast({ title: "Validation Error", description: "Allocated total must equal transaction amount.", variant: "destructive" });
          return;
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
                                    placeholder="Search Account / Meter / Group / Clearance / Direct Item..."
                                    className="max-w-full"
                                />
                            </div>
                            <Button variant="outline" className="h-12 border-slate-200">
                                <Filter className="w-4 h-4 mr-2" /> Filter
                            </Button>
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
