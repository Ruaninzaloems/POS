import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle, AlertCircle, Upload, Filter, X, Loader2, Search } from 'lucide-react';
import { AllocationLine } from '@/lib/direct-deposits-data';
import { Link, useLocation, useRoute } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Account, ClearanceCostSchedule } from '@/lib/mock-data';
import { platinumGetPosItemDetails, platinumSubmitDirectDepositAllocation, platinumLoadDetailsPaymentGrouping, platinumLoadConfirmPaymentDetails, platinumLoadDetailsClearance, platinumGetClearanceDetailsInfo, platinumDDClearanceAutocomplete, fetchMiscPaymentGroups, rebuildFullAccount } from '@/lib/external-api';

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

interface DDSearchResult {
  accountId: number;
  accountNo: string;
  name: string;
  oldAccountCode?: string;
  outstandingAmount?: number;
  type: 'ACCOUNT' | 'CLEARANCE' | 'DIRECT';
  description?: string;
  rawData?: any;
}

import { validateAllocationAmount, calculateAllocationTotals } from '@/lib/allocation-logic';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function AllocateTransaction() {
  const [, params] = useRoute('/direct-deposits/manual/allocate/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [transaction, setTransaction] = useState<BankReconPosItem | null>(null);
  const [loadingTx, setLoadingTx] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [lines, setLines] = useState<AllocationLine[]>([]);
  
  const [searchScope, setSearchScope] = useState<'ALL' | 'ACCOUNT' | 'CLEARANCE' | 'DIRECT'>('ALL');
  
  const [selectedAccount, setSelectedAccount] = useState<{accountNo: string, name: string, description?: string, accountId?: number, allocationType?: string, miscPaymentGroupId?: number} | null>(null);
  const [newLineAmount, setNewLineAmount] = useState('');

  const [selectedClearance, setSelectedClearance] = useState<ClearanceCostSchedule | null>(null);
  const [clearanceAllocations, setClearanceAllocations] = useState<Record<string, number>>({});
  
  const [ddSearchQuery, setDdSearchQuery] = useState('');
  const [ddSearchResults, setDdSearchResults] = useState<DDSearchResult[]>([]);
  const [ddSearching, setDdSearching] = useState(false);
  const [ddDropdownOpen, setDdDropdownOpen] = useState(false);
  const ddSearchRef = useRef<HTMLDivElement>(null);
  const ddSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [miscGroups, setMiscGroups] = useState<any[]>([]);
  const [miscGroupsLoaded, setMiscGroupsLoaded] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedAccount && inputRef.current) {
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 10);
    }
  }, [selectedAccount]);

  useEffect(() => {
    fetchMiscPaymentGroups()
      .then(groups => { setMiscGroups(groups); setMiscGroupsLoaded(true); })
      .catch(() => setMiscGroupsLoaded(true));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ddSearchRef.current && !ddSearchRef.current.contains(e.target as Node)) {
        setDdDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performDDSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setDdSearchResults([]);
      return;
    }
    setDdSearching(true);
    try {
      const results: DDSearchResult[] = [];
      const isNumeric = /^\d+$/.test(query);

      if (searchScope === 'ALL' || searchScope === 'ACCOUNT') {
        const searchBody: Record<string, any> = {};
        if (isNumeric) {
          searchBody.accountNo = query;
        } else {
          searchBody.name = query;
        }

        const searches: Promise<any>[] = [
          fetch('/api/platinum/billing-payment/search-accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchBody),
          }).then(r => r.ok ? r.json() : []).catch(() => []),
        ];
        if (isNumeric) {
          searches.push(
            fetch('/api/platinum/billing-payment/search-accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ oldAccountCode: query }),
            }).then(r => r.ok ? r.json() : []).catch(() => [])
          );
        }

        const [accountResults, oldAccountResults] = await Promise.all(searches);

        const seen = new Set<number>();
        const parseResults = (data: any) => {
          if (Array.isArray(data)) return data;
          if (data?.value && Array.isArray(data.value)) return data.value;
          return [];
        };

        for (const item of parseResults(accountResults)) {
          const accId = item.account_ID || item.accountID || item.id;
          if (accId && !seen.has(accId)) {
            seen.add(accId);
            results.push({
              accountId: accId,
              accountNo: item.accountNumber || item.accountNo || String(accId),
              name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
              oldAccountCode: item.oldAccountCode || '',
              outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
              type: 'ACCOUNT',
              rawData: item,
            });
          }
        }

        if (oldAccountResults) {
          for (const item of parseResults(oldAccountResults)) {
            const accId = item.account_ID || item.accountID || item.id;
            if (accId && !seen.has(accId)) {
              seen.add(accId);
              results.push({
                accountId: accId,
                accountNo: item.accountNumber || item.accountNo || String(accId),
                name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
                oldAccountCode: item.oldAccountCode || query,
                outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
                type: 'ACCOUNT',
                description: `Found via old account code: ${query}`,
                rawData: item,
              });
            }
          }
        }
      }

      if (searchScope === 'ALL' || searchScope === 'CLEARANCE') {
        try {
          const clearanceResults = await platinumDDClearanceAutocomplete(query);
          if (Array.isArray(clearanceResults)) {
            for (const item of clearanceResults) {
              results.push({
                accountId: item.account_ID || item.accountId || item.id || 0,
                accountNo: item.accountNumber || item.certificateNo || String(item.id || ''),
                name: item.name || item.displayItem || 'Clearance',
                type: 'CLEARANCE',
                rawData: item,
              });
            }
          }
        } catch {}
      }

      if (searchScope === 'ALL' || searchScope === 'DIRECT') {
        if (miscGroupsLoaded && miscGroups.length > 0) {
          const q = query.toLowerCase();
          const matchedGroups = miscGroups.filter(g => 
            g.name && g.name.toLowerCase().includes(q)
          ).slice(0, 5);
          for (const g of matchedGroups) {
            results.push({
              accountId: 0,
              accountNo: `MISC-${g.id}`,
              name: g.name,
              type: 'DIRECT',
              description: g.name,
              rawData: g,
            });
          }
        }
      }

      setDdSearchResults(results.slice(0, 15));
      setDdDropdownOpen(results.length > 0);
    } catch (err) {
      console.error('DD search error:', err);
      setDdSearchResults([]);
    } finally {
      setDdSearching(false);
    }
  }, [searchScope, miscGroups, miscGroupsLoaded]);

  const handleDDSearchInput = (value: string) => {
    setDdSearchQuery(value);
    if (ddSearchTimerRef.current) clearTimeout(ddSearchTimerRef.current);
    if (value.length >= 2) {
      ddSearchTimerRef.current = setTimeout(() => performDDSearch(value), 400);
    } else {
      setDdSearchResults([]);
      setDdDropdownOpen(false);
    }
  };

  const handleSelectDDResult = (result: DDSearchResult) => {
    setDdDropdownOpen(false);
    setDdSearchQuery('');
    setDdSearchResults([]);

    if (result.type === 'ACCOUNT') {
      setSelectedAccount({
        accountNo: result.accountNo,
        name: result.name,
        description: result.oldAccountCode ? `${result.name} (Old: ${result.oldAccountCode})` : result.name,
        accountId: result.accountId,
        allocationType: 'ACCOUNT',
      });
      setNewLineAmount("0.00");
      setSelectedClearance(null);
    } else if (result.type === 'DIRECT') {
      setSelectedAccount({
        accountNo: result.accountNo,
        name: result.name,
        description: result.description || result.name,
        accountId: 0,
        allocationType: 'DIRECT',
        miscPaymentGroupId: result.rawData?.id || 0,
      });
      setNewLineAmount("0.00");
      setSelectedClearance(null);
    } else if (result.type === 'CLEARANCE') {
      setSelectedAccount({
        accountNo: result.accountNo,
        name: result.name,
        description: `Clearance: ${result.name}`,
        accountId: result.accountId,
        allocationType: 'CLEARANCE',
      });
      setNewLineAmount("0.00");
      setSelectedClearance(null);
    }
  };

  useEffect(() => {
    if (params?.id) {
        const posItemId = parseInt(params.id, 10);
        if (isNaN(posItemId)) return;
        
        setLoadingTx(true);
        setLoadError(null);
        platinumGetPosItemDetails(posItemId)
          .then((result: any) => {
            if (result && result.posItem_ID) {
              setTransaction(result as BankReconPosItem);
            } else {
              setLoadError(`POS item #${posItemId} not found.`);
            }
          })
          .catch((e: any) => {
            console.error("Failed to load POS item", e);
            setLoadError(e.message || "Failed to load POS item details from Platinum API.");
          })
          .finally(() => setLoadingTx(false));
    }
  }, [params?.id]);

  const { allocatedTotal, remaining, isFullyAllocated } = transaction 
    ? calculateAllocationTotals(lines, transaction.amount)
    : { allocatedTotal: 0, remaining: 0, isFullyAllocated: false };

  const handleSearchResult = (result: DDSearchResult) => {
    handleSelectDDResult(result);
  };

  const handleReturnToCashbook = () => {
      if (remaining <= 0) return;
      
      setLines(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          accountNo: "CASHBOOK-RTN",
          amount: remaining,
          description: "Returned to Cashbook (Unallocated)",
          allocationType: 'CASHBOOK',
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
          description: selectedAccount.description || `Payment to ${selectedAccount.name}`,
          allocationType: (selectedAccount.allocationType || 'ACCOUNT') as AllocationLine['allocationType'],
          accountId: selectedAccount.accountId,
          miscPaymentGroupId: selectedAccount.miscPaymentGroupId,
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
                 description: `Clearance ${selectedClearance.scheduleNo} - 118(1): ${item.item}`,
                 allocationType: 'CLEARANCE',
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
                 description: `Clearance ${selectedClearance.scheduleNo} - 118(3): ${item.item}`,
                 allocationType: 'CLEARANCE',
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

  const handlePost = async () => {
      if (!isFullyAllocated) {
          toast({ title: "Validation Error", description: "Allocated total must equal transaction amount.", variant: "destructive" });
          return;
      }

      if (!transaction) return;

      setPosting(true);

      try {
          let finYear = '2025/2026';
          try {
              const res = await fetch('/api/platinum/active-fin-year');
              if (res.ok) {
                  const data = await res.json();
                  if (typeof data === 'string') finYear = data;
                  else if (data?.financialYear) finYear = data.financialYear;
              }
          } catch {}

          let userId = -1;
          try {
              const userRes = await fetch('/api/platinum/auth/user-info');
              if (userRes.ok) {
                  const userInfo = await userRes.json();
                  if (userInfo?.user_ID) userId = userInfo.user_ID;
              }
          } catch {}

          if (userId <= 0) {
              toast({ title: 'User Session Error', description: 'Could not determine your user ID. Please log in again and retry.', variant: 'destructive' });
              setPosting(false);
              return;
          }

          const now = new Date();
          const saFormatter = new Intl.DateTimeFormat('en-ZA', {
              timeZone: 'Africa/Johannesburg',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          });
          const saParts = saFormatter.formatToParts(now);
          const getPart = (type: string) => saParts.find(p => p.type === type)?.value || '';
          const receiptDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
          const transactionDate = transaction.dateOfTransaction || receiptDate;

          let submittedCount = 0;
          for (const line of lines) {
              if (line.accountNo === 'CASHBOOK-RTN' || line.allocationType === 'CASHBOOK') continue;

              const allocType = line.allocationType || 'ACCOUNT';
              let billType = 'ConsumerServices';
              if (allocType === 'DIRECT' || allocType === 'GROUP') {
                  billType = 'MiscPayment';
              } else if (allocType === 'CLEARANCE') {
                  billType = 'ClearancePayment';
              }

              const accountIdStr = line.accountId ? String(line.accountId) : '';

              try {
                  if (allocType === 'DIRECT' || allocType === 'GROUP') {
                      console.log(`[Direct Deposit] Step 1: load-details-payment-grouping`);
                      await platinumLoadDetailsPaymentGrouping({
                          amount: line.amount,
                          dateOfTransaction: transactionDate,
                          cashbookID: transaction.cashbookTransactionID || 0,
                          posItemId: transaction.posItem_ID,
                          paymentTypeID: 3,
                          userId,
                          finYear,
                          page: 1,
                          pageSize: 100,
                      });
                  } else if (allocType === 'CLEARANCE') {
                      console.log(`[Direct Deposit] Step 1: load-details-clearance`);
                      const pagerBody = { page: 1, pageSize: 100, orderby: null, shortDirection: null };
                      await platinumLoadDetailsClearance(pagerBody);

                      console.log(`[Direct Deposit] Step 2: get-clearance-details-info for ${accountIdStr}`);
                      await platinumGetClearanceDetailsInfo({
                          costScheduleID: accountIdStr,
                          accountID: accountIdStr,
                          posItemID: transaction.posItem_ID,
                          transactionAmount: line.amount,
                      });
                  }
              } catch (prepErr) {
                  console.warn(`[Direct Deposit] Preparation step warning (non-blocking):`, prepErr);
              }

              try {
                  console.log(`[Direct Deposit] load-confirm-payment-details for ${billType}, account ${accountIdStr}`);
                  await platinumLoadConfirmPaymentDetails({}, {
                      billType,
                      accountID: accountIdStr,
                      posItem: String(transaction.posItem_ID),
                  });
              } catch (confirmErr) {
                  console.warn(`[Direct Deposit] Confirm step warning (non-blocking):`, confirmErr);
              }

              const submitData: any = {
                  outstandingAmount: line.amount,
                  paidAmount: line.amount,
                  transactionDate,
                  reconId: transaction.bankReconID || 0,
                  posItemId: transaction.posItem_ID,
                  billType,
                  accountId: (allocType === 'ACCOUNT' || allocType === 'CLEARANCE') ? (line.accountId || 0) : 0,
                  masterId: 0,
                  userId,
                  description: line.description || transaction.note || '',
                  groupId: 0,
                  initials: '',
                  lastName: '',
                  financialYear: finYear,
                  miscPaymentGroupId: (allocType === 'DIRECT' || allocType === 'GROUP') ? (line.miscPaymentGroupId || 0) : 0,
                  amount: line.amount,
                  vatAmount: 0,
                  totalAmount: line.amount,
                  receiptDate,
                  paymentTypeId: 3,
                  vatableVote: 0,
                  vatPercentage: 0,
              };

              console.log('[Direct Deposit] submit-details-data:', submitData);
              const result = await platinumSubmitDirectDepositAllocation(submitData);
              console.log('[Direct Deposit] Submit result:', result);

              if (result && result.success === false) {
                  toast({
                      title: 'Submission Failed',
                      description: result.message || `Failed to submit allocation for ${line.accountNo}. ${submittedCount} line(s) were already submitted.`,
                      variant: 'destructive',
                  });
                  setPosting(false);
                  return;
              }
              submittedCount++;
          }

          const accountLines = lines.filter(l =>
              (l.allocationType === 'ACCOUNT' || l.allocationType === 'PREPAID' || l.allocationType === 'CLEARANCE')
              && l.accountNo && l.accountNo !== 'CASHBOOK-RTN'
          );
          const uniqueAccountNos = Array.from(new Set(accountLines.map(l => l.accountNo)));

          if (uniqueAccountNos.length > 0) {
              console.log('[Direct Deposit] Running account rebuilds for:', uniqueAccountNos);
              const rebuildResults = await Promise.allSettled(
                  uniqueAccountNos.map(accNo => {
                      const accId = accountLines.find(l => l.accountNo === accNo)?.accountId;
                      if (accId) {
                          return rebuildFullAccount(accId);
                      }
                      return rebuildFullAccount(parseInt(accNo.replace(/^0+/, ''), 10));
                  })
              );
              const failures = rebuildResults.filter(r => r.status === 'rejected');
              if (failures.length > 0) {
                  console.warn('[Direct Deposit] Some rebuilds failed:', failures);
                  toast({
                      title: "Allocation Posted - Rebuild Warning",
                      description: `Allocation successful. ${failures.length} of ${uniqueAccountNos.length} account rebuild(s) could not complete. These will be retried automatically.`,
                      variant: "default",
                  });
              } else {
                  toast({
                      title: "Allocation Posted Successfully",
                      description: `POS Item #${transaction.posItem_ID} allocated (R ${transaction.amount.toFixed(2)}). ${uniqueAccountNos.length} account(s) rebuilt.`,
                  });
              }
          } else {
              toast({
                  title: "Allocation Posted Successfully",
                  description: `POS Item #${transaction.posItem_ID} allocated (R ${transaction.amount.toFixed(2)}).`,
              });
          }

          setLocation('/direct-deposits/manual');
      } catch (e: any) {
          console.error("Failed to submit allocation", e);
          toast({
              title: 'Submission Error',
              description: e.message || 'An unexpected error occurred while posting the allocation.',
              variant: 'destructive',
          });
      } finally {
          setPosting(false);
      }
  };

  if (loadingTx) return (
    <PosLayout>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    </PosLayout>
  );
  
  if (!transaction) return (
    <PosLayout>
      <div className="p-8 text-center text-muted-foreground">
        {loadError ? (
          <div className="space-y-2">
            <p className="text-red-600">{loadError}</p>
            <Link href="/direct-deposits/manual"><Button variant="link">Back to queue</Button></Link>
          </div>
        ) : (
          <div>POS item not found. <Link href="/direct-deposits/manual"><Button variant="link">Back to queue</Button></Link></div>
        )}
      </div>
    </PosLayout>
  );

  return (
    <PosLayout>
      <div className="flex-1 flex flex-col h-full bg-slate-50/50">
        <div className="p-3 sm:p-6 border-b bg-white flex items-center gap-3 sm:gap-4">
             <Link href="/direct-deposits/manual">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" data-testid="button-back">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
             </Link>
             <div>
                 <h1 className="text-base sm:text-xl font-bold">Allocate Transaction</h1>
                 <p className="text-xs sm:text-sm text-muted-foreground font-mono">POS Item #{transaction.posItem_ID}</p>
             </div>
        </div>

        <div className="p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card className="lg:col-span-1 h-fit">
                <CardHeader className="bg-slate-50 pb-4">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Bank Recon POS Item</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Description</label>
                        <div className="font-medium text-lg">{transaction.note || '-'}</div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Reference</label>
                        <Badge variant="outline" className="font-mono text-base px-2 py-0.5">{transaction.reference || '-'}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Transaction Date</label>
                            <div className="font-mono">{transaction.dateOfTransaction ? new Date(transaction.dateOfTransaction).toLocaleDateString('en-ZA') : '-'}</div>
                        </div>
                        <div>
                             <label className="text-xs text-muted-foreground block mb-1">Bank Recon ID</label>
                             <div className="text-sm font-mono">{transaction.bankReconID}</div>
                        </div>
                    </div>
                    
                    <div className="pt-4 sm:pt-6 border-t mt-4">
                         <label className="text-xs text-muted-foreground block mb-1">Total Amount</label>
                         <div className="text-2xl sm:text-3xl font-bold text-slate-900">R {transaction.amount.toFixed(2)}</div>
                    </div>
                </CardContent>
            </Card>

            {/* Allocation Workspace (Right Panel) */}
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle className="text-lg">Allocation Lines</CardTitle>
                    </CardHeader>
                    
                    <div className="px-3 sm:px-6 pb-4 sm:pb-6 border-b">
                        <div className="flex gap-2">
                            <div className="flex-1 min-w-0 relative" ref={ddSearchRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        data-testid="input-dd-search"
                                        placeholder={
                                            searchScope === 'ALL' ? "Search account number, name, or old code..." : 
                                            searchScope === 'ACCOUNT' ? "Search account number or name..." :
                                            searchScope === 'CLEARANCE' ? "Search clearance certificate..." :
                                            "Search direct income item..."
                                        }
                                        className="h-10 sm:h-12 pl-10 pr-8"
                                        value={ddSearchQuery}
                                        onChange={e => handleDDSearchInput(e.target.value)}
                                        onFocus={() => { if (ddSearchResults.length > 0) setDdDropdownOpen(true); }}
                                    />
                                    {ddSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                                    {ddSearchQuery && !ddSearching && (
                                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setDdSearchQuery(''); setDdSearchResults([]); setDdDropdownOpen(false); }}>
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {ddDropdownOpen && ddSearchResults.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                                        {ddSearchResults.map((result, idx) => (
                                            <button
                                                key={`${result.type}-${result.accountId}-${idx}`}
                                                data-testid={`dd-result-${result.type}-${result.accountId}`}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-center gap-3"
                                                onClick={() => handleSelectDDResult(result)}
                                            >
                                                <Badge variant="outline" className={`shrink-0 text-xs ${
                                                    result.type === 'ACCOUNT' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    result.type === 'CLEARANCE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-green-50 text-green-700 border-green-200'
                                                }`}>
                                                    {result.type === 'ACCOUNT' ? 'ACC' : result.type === 'CLEARANCE' ? 'CLR' : 'INC'}
                                                </Badge>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm truncate">
                                                        {result.accountNo} - {result.name}
                                                    </div>
                                                    {result.oldAccountCode && (
                                                        <div className="text-xs text-muted-foreground">Old Code: {result.oldAccountCode}</div>
                                                    )}
                                                    {result.description && !result.oldAccountCode && (
                                                        <div className="text-xs text-muted-foreground truncate">{result.description}</div>
                                                    )}
                                                </div>
                                                {result.outstandingAmount != null && result.outstandingAmount !== 0 && (
                                                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                                                        R {result.outstandingAmount.toFixed(2)}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {ddDropdownOpen && ddSearchResults.length === 0 && !ddSearching && ddSearchQuery.length >= 2 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
                                        No results found for "{ddSearchQuery}"
                                    </div>
                                )}
                            </div>
                            
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={`h-10 sm:h-12 border-slate-200 shrink-0 ${searchScope !== 'ALL' ? 'bg-slate-100 border-slate-300' : ''}`}>
                                        <Filter className="w-4 h-4 sm:mr-2" /> 
                                        <span className="hidden sm:inline">{searchScope === 'ALL' ? 'Filter' : searchScope}</span>
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

                            <Button variant="outline" className="h-10 sm:h-12 border-slate-200 shrink-0">
                                <Upload className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Import CSV</span>
                            </Button>
                        </div>
                        
                        {/* Selected Account Preview / Amount Entry */}
                        {selectedAccount && (
                            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-100 rounded-lg flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Selected Allocation Target</div>
                                    <div className="font-medium text-base sm:text-lg text-slate-900 truncate">{selectedAccount.accountNo}</div>
                                    <div className="text-sm text-slate-500 truncate">{selectedAccount.name}</div>
                                </div>
                                <div className="w-full sm:w-auto">
                                    <label className="text-xs text-slate-500 block mb-1">Amount to Allocate</label>
                                    <div className="flex gap-2">
                                        <Input 
                                            ref={inputRef}
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            className="h-10 flex-1 sm:w-32 font-bold text-right" 
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

                    <CardContent className="pt-0 min-h-[200px] sm:min-h-[300px]">
                        {/* Mobile allocation lines */}
                        <div className="sm:hidden">
                          {lines.length === 0 ? (
                            <div className="py-10 text-center text-muted-foreground text-sm">
                              <p>No allocations yet. Search above to find accounts.</p>
                              {remaining > 0 && (
                                <Button variant="outline" size="sm" onClick={handleReturnToCashbook} className="mt-3 text-orange-600 border-orange-200 hover:bg-orange-50 text-xs">
                                  Return Remaining (R {remaining.toFixed(2)}) to Cashbook
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="divide-y">
                              {lines.map(line => (
                                <div key={line.id} className="py-2.5 flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-mono text-xs font-medium truncate">{line.accountNo}</div>
                                    <div className="text-xs text-muted-foreground truncate">{line.description}</div>
                                  </div>
                                  <span className="font-mono text-sm font-medium shrink-0">R {line.amount.toFixed(2)}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 shrink-0" onClick={() => handleRemoveLine(line.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Desktop allocation lines table */}
                        <Table className="hidden sm:table">
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
                    <CardFooter className="bg-slate-50 border-t p-3 sm:p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                         <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm">
                             <div>
                                 <span className="text-muted-foreground mr-1">Allocated:</span>
                                 <span className="font-bold">R {allocatedTotal.toFixed(2)}</span>
                             </div>
                             <div>
                                 <span className="text-muted-foreground mr-1">Remaining:</span>
                                 <span className={`font-bold ${Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                     R {remaining.toFixed(2)}
                                 </span>
                             </div>
                         </div>
                         <div className="flex gap-2 w-full sm:w-auto">
                             {remaining > 0 && (
                                <Button variant="outline" size="sm" onClick={handleReturnToCashbook} className="text-orange-700 border-orange-200 hover:bg-orange-50 text-xs sm:text-sm flex-1 sm:flex-initial">
                                    <span className="hidden sm:inline">Return Balance to </span>Cashbook
                                </Button>
                             )}
                             <Button 
                                size="sm"
                                className={`flex-1 sm:flex-initial text-xs sm:text-sm ${isFullyAllocated ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300'}`}
                                disabled={!isFullyAllocated || posting}
                                onClick={handlePost}
                             >
                                {posting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : isFullyAllocated ? (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                )}
                                {posting ? 'Posting...' : 'Post Allocation'}
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
