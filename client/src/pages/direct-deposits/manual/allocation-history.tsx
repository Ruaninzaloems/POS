import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Printer, FileText } from 'lucide-react';
import { Link } from 'wouter';
import { MOCK_BANK_TRANSACTIONS, MOCK_ALLOCATIONS, BankTransaction } from '@/lib/direct-deposits-data';
import { format } from 'date-fns';
import { ReceiptTemplate } from '@/components/pos/receipt-template';

export default function AllocationHistory() {
  const history = MOCK_BANK_TRANSACTIONS.filter(t => t.status === 'ALLOCATED');
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const getAllocationDetails = (txId: string) => {
    return MOCK_ALLOCATIONS.find(a => a.transactionId === txId);
  };

  const selectedAllocation = selectedTx ? getAllocationDetails(selectedTx.id) : null;

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: `Receipt-${selectedTx?.id || 'Draft'}`,
  });

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
                 <h1 className="text-xl font-bold">Allocation History</h1>
                 <p className="text-sm text-muted-foreground">View processed allocations</p>
             </div>
        </div>

        <div className="p-6">
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead>Allocated To</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell className="font-mono text-xs">
                                    {format(new Date(tx.transactionDate), 'dd/MM/yyyy')}
                                </TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{tx.reference}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                    R {tx.amount.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge className="bg-green-100 text-green-700 border-green-200 shadow-none">
                                        Allocated
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    Multiple Accounts
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedTx(tx)}>
                                        <Eye className="w-4 h-4 mr-2" /> View
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {history.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No history available.
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
                    <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground block text-xs">Bank Description</span>
                            <span className="font-medium">{selectedTx.description}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Bank Reference</span>
                            <span className="font-mono">{selectedTx.reference}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-xs">Transaction Date</span>
                            <span>{format(new Date(selectedTx.transactionDate), 'dd MMM yyyy')}</span>
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
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
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
                    />
                )}
            </div>

            <DialogFooter className="sm:justify-between">
                <div className="text-xs text-muted-foreground flex items-center">
                    Processed: {selectedAllocation ? format(new Date(selectedAllocation.updatedAt), 'dd MMM yyyy HH:mm') : '-'}
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
