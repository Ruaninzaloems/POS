import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, Filter, Banknote, FileSpreadsheet, FileText, X, Info, HelpCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { platinumGetBankReconPosItemList, platinumCheckSelectedItemProcessed } from '@/lib/external-api';
import { usePos } from '@/lib/pos-state';

import { useToast } from '@/hooks/use-toast';

interface BankReconPosItem {
  posItem_ID: number;
  dateOfTransaction: string;
  bankReconID: number;
  amount: number;
  reference: string;
  note: string;
  dateCaptured: string;
  capturerID: number;
  dateModified: string | null;
  modifierID: number;
  directDepositTypeID: number | null;
  cashbookTransactionID: number;
  billingAllocated: boolean;
  dateAllocated: string | null;
}

export default function UnmatchedQueue() {
  const [searchTerm, setSearchTerm] = useState('');
  const [, setLocation] = useLocation();
  const { currentUser } = usePos();
  const { toast } = useToast();
  const [items, setItems] = useState<BankReconPosItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingItemId, setCheckingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [txnDateFrom, setTxnDateFrom] = useState<Date | undefined>();
  const [txnDateTo, setTxnDateTo] = useState<Date | undefined>();

  const loadData = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await platinumGetBankReconPosItemList({
        page: pageNum,
        pageSize,
        orderby: 'dateOfTransaction',
        shortDirection: 'desc',
      });
      const data = result as any;
      const fetchedItems: BankReconPosItem[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(fetchedItems);
      setTotalCount(data?.totalCount ?? fetchedItems.length);
    } catch (e: any) {
      console.error("Failed to load bank recon POS items", e);
      setError(e.message || "Failed to load data from Platinum API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(page);
  }, [page, loadData]);

  const filtered = items.filter(item => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (item.note || '').toLowerCase().includes(term) ||
        (item.reference || '').toLowerCase().includes(term) ||
        item.amount.toString().includes(searchTerm) ||
        item.posItem_ID.toString().includes(searchTerm);
      if (!matchesSearch) return false;
    }

    if (txnDateFrom && txnDateTo) {
      const date = new Date(item.dateOfTransaction);
      if (isValid(date)) {
        if (!isWithinInterval(date, {
          start: startOfDay(txnDateFrom),
          end: endOfDay(txnDateTo)
        })) return false;
      }
    }

    return true;
  });

  const activeFiltersCount = [txnDateFrom].filter(Boolean).length;

  const clearFilters = () => {
    setTxnDateFrom(undefined);
    setTxnDateTo(undefined);
    setSearchTerm('');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleAllocateClick = async (posItemId: number) => {
    setCheckingItemId(posItemId);
    try {
      let finYear = '2025/2026';
      try {
        const res = await fetch('/api/platinum/active-fin-year');
        if (res.ok) finYear = await res.json();
      } catch {}

      const checkUserId = currentUser?.id ? Number(currentUser.id) : -1;
      const result = await platinumCheckSelectedItemProcessed(
        checkUserId,
        finYear,
        posItemId
      );

      if (result && result.success === false) {
        toast({
          title: 'Item Already Processed',
          description: result.message || 'This POS item has already been processed and cannot be allocated.',
          variant: 'destructive',
        });
        return;
      }

      setLocation(`/direct-deposits/manual/allocate/${posItemId}`);
    } catch (e: any) {
      console.error("Failed to check item processed status", e);
      setLocation(`/direct-deposits/manual/allocate/${posItemId}`);
    } finally {
      setCheckingItemId(null);
    }
  };

  const handleDownload = (fmt: 'excel' | 'pdf') => {
    const element = document.createElement("a");
    const fileContent = "Date,Description,Reference,Amount,Allocated,POS Item ID\n" +
      filtered.map(t => `${t.dateOfTransaction},"${t.note}",${t.reference},${t.amount},${t.billingAllocated},${t.posItem_ID}`).join("\n");
    const fileBlob = new Blob([fileContent], { type: fmt === 'excel' ? "text/csv" : "text/plain" });
    element.href = URL.createObjectURL(fileBlob);
    element.download = `bank_recon_positems.${fmt === 'excel' ? 'csv' : 'txt'}`;
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900" data-testid="text-page-title">Direct Deposits: Manual Allocation</h1>
              <p className="text-muted-foreground">Bank Reconciliation POS Items ({totalCount.toLocaleString()} total)</p>
            </div>
            <div className="flex gap-2">
                <Link href="/direct-deposits/manual/history">
                    <Button variant="outline" className="gap-2" data-testid="button-allocation-history">
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
                                Review Items
                            </h4>
                            <p>This queue shows bank reconciliation POS items from Platinum. Review the description and reference columns to identify each deposit.</p>
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
                                Search & Filter
                            </h4>
                            <p>Use the search bar to find specific amounts, references or descriptions. Use the filter button to narrow down by date range.</p>
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">3</div>
                                Allocate Funds
                            </h4>
                            <p>Click the <strong>Allocate</strong> button on any item to open the allocation screen, where you can assign the funds to the correct municipal account(s).</p>
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
                  data-testid="input-search"
                />
             </div>

             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className={`gap-2 ${activeFiltersCount > 0 ? 'bg-slate-100 border-slate-300' : ''}`} data-testid="button-filter">
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
                    </div>
                </PopoverContent>
             </Popover>

             <Button variant="outline" size="sm" onClick={() => loadData(page)} disabled={loading} data-testid="button-refresh">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
             </Button>

             <div className="h-10 w-px bg-slate-200 mx-2" />
             <Button variant="outline" size="icon" title="Export Excel" onClick={() => handleDownload('excel')} data-testid="button-export-excel">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
             </Button>
             <Button variant="outline" size="icon" title="Export PDF" onClick={() => handleDownload('pdf')} data-testid="button-export-pdf">
                <FileText className="w-4 h-4 text-red-600" />
             </Button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error loading data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground" data-testid="text-empty-state">
                      {items.length === 0 ? 'No bank reconciliation POS items found.' : 'No items matching your search.'}
                    </TableCell>
                  </TableRow>
                ) : filtered.map(tx => (
                  <TableRow
                    key={tx.posItem_ID}
                    data-testid={`row-positem-${tx.posItem_ID}`}
                    className={`${!tx.billingAllocated ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => !tx.billingAllocated && checkingItemId === null && handleAllocateClick(tx.posItem_ID)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{tx.posItem_ID}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                        {tx.dateOfTransaction ? format(new Date(tx.dateOfTransaction), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-xs truncate" title={tx.note}>
                      {tx.note || '-'}
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="font-mono">{tx.reference || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                        R {(tx.amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                        {tx.billingAllocated ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                              Allocated
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                              Unmatched
                          </Badge>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                        {!tx.billingAllocated && (
                          <Button
                              size="sm"
                              className="h-8 bg-blue-600 hover:bg-blue-700"
                              disabled={checkingItemId === tx.posItem_ID}
                              onClick={() => handleAllocateClick(tx.posItem_ID)}
                              data-testid={`button-allocate-${tx.posItem_ID}`}
                          >
                              {checkingItemId === tx.posItem_ID ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-2" />
                              ) : null}
                              Allocate <ArrowRight className="ml-2 w-3 h-3" />
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({totalCount.toLocaleString()} items)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
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
