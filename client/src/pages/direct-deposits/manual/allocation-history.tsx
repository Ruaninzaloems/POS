import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Printer, FileText, Search, User } from 'lucide-react';
import { Link } from 'wouter';
import { MOCK_BANK_TRANSACTIONS, MOCK_ALLOCATIONS, BankTransaction } from '@/lib/direct-deposits-data';
import { format } from 'date-fns';
import { ReceiptTemplate } from '@/components/pos/receipt-template';

export default function AllocationHistory() {
  const [filterQuery, setFilterQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL'); // ALL, MANUAL, BULK
  
  // Get all allocated transactions
  const allocatedTxns = MOCK_BANK_TRANSACTIONS.filter(t => t.status === 'ALLOCATED');
  
  // Enrich with allocation details
  const historyData = allocatedTxns.map(tx => {
      const details = MOCK_ALLOCATIONS.find(a => a.transactionId === tx.id);
      return {
          ...tx,
          details
      };
  });

  // Filter
  const filteredHistory = historyData.filter(item => {
      const matchesSearch = 
        item.description.toLowerCase().includes(filterQuery.toLowerCase()) || 
        item.reference.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (item.details?.allocatedBy || '').toLowerCase().includes(filterQuery.toLowerCase());
      
      const matchesMethod = 
        methodFilter === 'ALL' || 
        (methodFilter === 'MANUAL' && item.details?.method === 'MANUAL') ||
        (methodFilter === 'BULK' && item.details?.method === 'BULK');

      return matchesSearch && matchesMethod;
  });

  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const selectedAllocation = selectedTx ? MOCK_ALLOCATIONS.find(a => a.transactionId === selectedTx.id) : null;

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${selectedTx?.id || 'Draft'}`,
  });

  return (
    <PosLayout>
       <div className="flex-1 flex flex-col h-full bg-slate-50/50">
        <div className="p-6 border-b bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                 <Link href="/direct-deposits/manual">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                 </Link>
                 <div>
                     <h1 className="text-xl font-bold">Allocation History</h1>
                     <p className="text-sm text-muted-foreground">View processed allocations (Manual & Bulk)</p>
                 </div>
             </div>

             <div className="flex gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search description, reference, user..." 
                        className="pl-8" 
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                    />
                </div>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Methods</SelectItem>
                        <SelectItem value="MANUAL">Manual Only</SelectItem>
                        <SelectItem value="BULK">Bulk Only</SelectItem>
                    </SelectContent>
                </Select>
             </div>
        </div>

        <div className="p-6">
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Transaction Date</TableHead>
                            <TableHead>Allocation Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Allocated By</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHistory.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {format(new Date(tx.transactionDate), 'dd/MM/yyyy')}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                    {tx.details?.allocationDate ? format(new Date(tx.details.allocationDate), 'dd/MM/yyyy HH:mm') : '-'}
                                </TableCell>
                                <TableCell className="text-sm font-medium">{tx.description}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="font-mono">{tx.reference}</Badge>
                                </TableCell>
                                <TableCell>
                                    {tx.details?.method === 'BULK' ? (
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200">
                                            Bulk
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">
                                            Manual
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3 h-3 text-muted-foreground" />
                                        <span>{tx.details?.allocatedBy || 'Unknown'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                    R {tx.amount.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge className="bg-green-100 text-green-700 border-green-200 shadow-none hover:bg-green-100">
                                        Allocated
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedTx(tx)}>
                                        <Eye className="w-4 h-4 mr-2" /> View
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredHistory.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                    No allocation history found matching your criteria.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
       </div>

       <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Allocation Details</DialogTitle>
                <DialogDescription>Transaction ID: {selectedTx?.id}</DialogDescription>
            </DialogHeader>
            
            {selectedTx && (
                <div className="space-y-6">
                    {/* Bank Transaction Info */}
                    <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="md:col-span-2">
                            <span className="text-muted-foreground block text-xs">Bank Description</span>
                            <span className="font-medium">{selectedTx.description}</span>
                        </div>
                        <div className="md:col-span-2">
                            <span className="text-muted-foreground block text-xs">Bank Reference</span>
                            <span className="font-mono">{selectedTx.reference}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Transaction Date</span>
                            <span>{format(new Date(selectedTx.transactionDate), 'dd MMM yyyy')}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Allocation Date</span>
                            <span>{selectedAllocation?.allocationDate ? format(new Date(selectedAllocation.allocationDate), 'dd MMM yyyy HH:mm') : '-'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Allocated By</span>
                            <span className="font-medium flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {selectedAllocation?.allocatedBy || 'Unknown'}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Total Amount</span>
                            <span className="font-bold">R {selectedTx.amount.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Allocation Lines */}
                    <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            Allocated Lines
                        </h4>
                        <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="h-8">Account / Reference</TableHead>
                                        <TableHead className="h-8">Description</TableHead>
                                        <TableHead className="h-8 text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedAllocation ? (
                                        selectedAllocation.lines.map((line, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono text-xs">{line.accountNo}</TableCell>
                                                <TableCell className="text-xs">{line.description}</TableCell>
                                                <TableCell className="text-right font-mono text-sm">R {line.amount.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                                No allocation details found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {selectedAllocation && (
                                        <TableRow className="bg-slate-50 font-bold">
                                            <TableCell colSpan={2} className="text-right">Total Allocated:</TableCell>
                                            <TableCell className="text-right font-mono">
                                                R {selectedAllocation.lines.reduce((s, l) => s + l.amount, 0).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Hidden Receipt for Printing */}
            <div style={{ display: 'none' }}>
                {selectedTx && selectedAllocation && (
                    <ReceiptTemplate 
                        ref={receiptRef} 
                        transaction={selectedTx} 
                        allocation={selectedAllocation} 
                        isReprint={true}
                    />
                )}
            </div>

            <DialogFooter className="sm:justify-between">
                <div className="text-xs text-muted-foreground flex items-center">
                    Method: {selectedAllocation?.method === 'BULK' ? 'Bulk Import' : 'Manual Allocation'}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSelectedTx(null)}>Close</Button>
                    <Button variant="default" className="gap-2" onClick={handlePrint}>
                        <Printer className="w-4 h-4" /> Print Receipt
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
       </Dialog>
    </PosLayout>
  );
}