import React, { useState } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, Filter, Banknote, FileSpreadsheet, FileText, X, Info, HelpCircle } from 'lucide-react';
import { MOCK_BANK_TRANSACTIONS } from '@/lib/direct-deposits-data';
import { filterUnmatchedTransactions } from '@/lib/direct-deposits-logic';
import { Link, useLocation } from 'wouter';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function UnmatchedQueue() {
  const [searchTerm, setSearchTerm] = useState('');
  const [transactions] = useState(MOCK_BANK_TRANSACTIONS);
  const [, setLocation] = useLocation();

  // Advanced Filters
  const [txnDateFrom, setTxnDateFrom] = useState<Date | undefined>();
  const [txnDateTo, setTxnDateTo] = useState<Date | undefined>();
  const [bankAccountFilter, setBankAccountFilter] = useState('ALL');

  // Logic to get unique bank accounts for filter
  const uniqueBankAccounts = Array.from(new Set(transactions.map(t => t.bankAccount)));

  const filtered = filterUnmatchedTransactions(transactions, searchTerm).filter(item => {
      // Date Filter
      let matchesDate = true;
      if (txnDateFrom && txnDateTo) {
          const date = new Date(item.transactionDate);
          if (isValid(date)) {
              matchesDate = isWithinInterval(date, { 
                  start: startOfDay(txnDateFrom), 
                  end: endOfDay(txnDateTo) 
              });
          }
      }

      // Bank Account Filter
      let matchesBank = true;
      if (bankAccountFilter !== 'ALL') {
          matchesBank = item.bankAccount === bankAccountFilter;
      }

      return matchesDate && matchesBank;
  });
  
  const activeFiltersCount = [txnDateFrom, bankAccountFilter !== 'ALL'].filter(Boolean).length;

  const clearFilters = () => {
      setTxnDateFrom(undefined);
      setTxnDateTo(undefined);
      setBankAccountFilter('ALL');
      setSearchTerm('');
  };

  const handleDownload = (format: 'excel' | 'pdf') => {
      // Mock download functionality
      const element = document.createElement("a");
      const fileContent = "Date,BankAccount,Description,Reference,Amount,Status\n" + 
          filtered.map(t => `${t.transactionDate},"${t.bankAccount}","${t.description}",${t.reference},${t.amount},Unmatched`).join("\n");
      const fileBlob = new Blob([fileContent], { type: format === 'excel' ? "text/csv" : "text/plain" });
      element.href = URL.createObjectURL(fileBlob);
      element.download = `unmatched_transactions.${format === 'excel' ? 'csv' : 'txt'}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

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

          <Accordion type="single" collapsible className="w-full bg-blue-50/50 border border-blue-100 rounded-lg px-4">
            <AccordionItem value="help" className="border-0">
                <AccordionTrigger className="hover:no-underline py-2 text-sm text-blue-700">
                    <span className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        How to use this page
                    </span>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2 text-sm text-slate-600">
                        <div className="space-y-1">
                            <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</div>
                                Review Unmatched
                            </h4>
                            <p>This queue shows all bank deposits that couldn't be automatically matched to a customer account. Review the description and reference columns to identify the payer.</p>
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
                                Search & Filter
                            </h4>
                            <p>Use the search bar to find specific amounts or references. Use the filter button to narrow down by date range or specific bank accounts.</p>
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">3</div>
                                Allocate Funds
                            </h4>
                            <p>Click the <strong>Allocate</strong> button on any transaction to open the allocation screen, where you can assign the funds to the correct municipal account(s).</p>
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
          </Accordion>

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
             
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className={`gap-2 ${activeFiltersCount > 0 ? 'bg-slate-100 border-slate-300' : ''}`}>
                        <Filter className="w-4 h-4" /> 
                        {activeFiltersCount > 0 ? `${activeFiltersCount} Filters` : 'Filter'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-4" align="start">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="font-medium text-sm">Filter Options</h4>
                            {activeFiltersCount > 0 && (
                                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-red-600" onClick={clearFilters}>
                                    Clear all
                                </Button>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Transaction Date Range</Label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1"><DatePicker date={txnDateFrom} setDate={setTxnDateFrom} placeholder="dd/mm/yyyy" className="h-8 text-xs" /></div>
                                <span className="text-muted-foreground">-</span>
                                <div className="flex-1"><DatePicker date={txnDateTo} setDate={setTxnDateTo} placeholder="dd/mm/yyyy" className="h-8 text-xs" /></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Bank Account</Label>
                            <Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="All Accounts" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Accounts</SelectItem>
                                    {uniqueBankAccounts.map(account => (
                                        <SelectItem key={account} value={account}>{account}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </PopoverContent>
             </Popover>

             <div className="h-10 w-px bg-slate-200 mx-2" />
             <Button variant="outline" size="icon" title="Export Excel" onClick={() => handleDownload('excel')}>
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
             </Button>
             <Button variant="outline" size="icon" title="Export PDF" onClick={() => handleDownload('pdf')}>
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
