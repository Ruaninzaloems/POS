import React, { useState, useEffect } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { MOCK_BANK_TRANSACTIONS, BankTransaction, AllocationLine } from '@/lib/direct-deposits-data';
import { Link, useLocation, useRoute } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { ACCOUNTS } from '@/lib/mock-data';

export default function AllocateTransaction() {
  const [, params] = useRoute('/direct-deposits/manual/allocate/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [transaction, setTransaction] = useState<BankTransaction | null>(null);
  const [lines, setLines] = useState<AllocationLine[]>([]);
  
  // New Line State
  const [newLineAccount, setNewLineAccount] = useState('');
  const [newLineAmount, setNewLineAmount] = useState('');
  
  useEffect(() => {
    if (params?.id) {
        const tx = MOCK_BANK_TRANSACTIONS.find(t => t.id === params.id);
        if (tx) setTransaction(tx);
    }
  }, [params?.id]);

  const allocatedTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const remaining = transaction ? transaction.amount - allocatedTotal : 0;
  const isFullyAllocated = Math.abs(remaining) < 0.01;

  const handleAddLine = () => {
      if (!newLineAccount || !newLineAmount) return;
      
      const amount = parseFloat(newLineAmount);
      if (isNaN(amount) || amount <= 0) {
          toast({ title: "Invalid Amount", variant: "destructive" });
          return;
      }
      
      // Basic Account Lookup Validation
      const accountExists = ACCOUNTS.find(a => a.accountNo === newLineAccount);
      
      setLines(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          accountNo: newLineAccount,
          amount: amount,
          description: accountExists ? `Payment to ${accountExists.name}` : 'Unknown Account'
      }]);
      
      setNewLineAccount('');
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
                    <CardHeader>
                        <CardTitle className="text-lg">Allocation Lines</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                                {lines.map(line => (
                                    <TableRow key={line.id}>
                                        <TableCell className="font-mono">{line.accountNo}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{line.description}</TableCell>
                                        <TableCell className="text-right font-mono">R {line.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleRemoveLine(line.id)}>
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {/* Input Row */}
                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                    <TableCell>
                                        <Input 
                                            placeholder="ACC-..." 
                                            className="h-8 w-32 font-mono"
                                            value={newLineAccount}
                                            onChange={e => setNewLineAccount(e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-muted-foreground italic">
                                            {newLineAccount ? (ACCOUNTS.find(a => a.accountNo === newLineAccount)?.name || "Unknown Account") : "Enter account no..."}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            placeholder="0.00" 
                                            className="h-8 w-32 text-right ml-auto"
                                            value={newLineAmount}
                                            onChange={e => setNewLineAmount(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddLine()}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button size="icon" className="h-8 w-8" onClick={handleAddLine}>
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
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
                         <Button 
                            className={`${isFullyAllocated ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300'}`}
                            disabled={!isFullyAllocated}
                            onClick={handlePost}
                         >
                            {isFullyAllocated ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                            Post Allocation
                         </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
      </div>
    </PosLayout>
  );
}
