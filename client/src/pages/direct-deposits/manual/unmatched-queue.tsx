import React, { useState } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, Filter, Banknote, FileSpreadsheet, FileText } from 'lucide-react';
import { MOCK_BANK_TRANSACTIONS } from '@/lib/direct-deposits-data';
import { filterUnmatchedTransactions } from '@/lib/direct-deposits-logic';
import { Link, useLocation } from 'wouter';
import { format } from 'date-fns';

export default function UnmatchedQueue() {
  const [searchTerm, setSearchTerm] = useState('');
  const [transactions] = useState(MOCK_BANK_TRANSACTIONS);
  const [, setLocation] = useLocation();

  const filtered = filterUnmatchedTransactions(transactions, searchTerm);

  return (
    <PosLayout>
      <div className="flex-1 flex flex-col h-full bg-slate-50/50">
        <div className="p-6 border-b bg-white space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Direct Deposits: Manual Allocation</h1>
              <p className="text-muted-foreground">Unmatched Bank Transactions Queue</p>
            </div>
            <div className="flex gap-2">
                <Link href="/direct-deposits/manual/history">
                    <Button variant="outline" className="gap-2">
                        <HistoryIcon className="w-4 h-4" />
                        Allocation History
                    </Button>
                </Link>
            </div>
          </div>

          <div className="flex gap-4">
             <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by description, reference or amount..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
             <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" /> Filter
             </Button>
             <div className="h-10 w-px bg-slate-200 mx-2" />
             <Button variant="outline" size="icon" title="Export Excel">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
             </Button>
             <Button variant="outline" size="icon" title="Export PDF">
                <FileText className="w-4 h-4 text-red-600" />
             </Button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                        {format(new Date(tx.transactionDate), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.bankAccount}</TableCell>
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className="font-mono">{tx.reference}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                        R {tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            Unmatched
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button 
                            size="sm" 
                            className="h-8 bg-blue-600 hover:bg-blue-700"
                            onClick={() => setLocation(`/direct-deposits/manual/allocate/${tx.id}`)}
                        >
                            Allocate <ArrowRight className="ml-2 w-3 h-3" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            No unmatched transactions found matching your search.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </PosLayout>
  );
}

function HistoryIcon(props: any) {
    return (
        <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
      <path d="M3 3v9h9" />
      <path d="M12 7v5l4 2" />
    </svg>
    )
}
