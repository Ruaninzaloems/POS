import React from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { MOCK_BANK_TRANSACTIONS } from '@/lib/direct-deposits-data';

export default function AllocationHistory() {
  const history = MOCK_BANK_TRANSACTIONS.filter(t => t.status === 'ALLOCATED');

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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell className="font-mono text-xs">{tx.transactionDate}</TableCell>
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
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
       </div>
    </PosLayout>
  );
}
