import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, CheckCircle, AlertCircle, Upload, X, Loader2, Search, Banknote, Building2, FileCheck, Receipt, CreditCard, RotateCcw } from 'lucide-react';
import { AllocationLine } from '@/lib/direct-deposits-data';
import { Link, useLocation, useRoute } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Account, ClearanceCostSchedule } from '@/lib/mock-data';
import { platinumGetPosItemDetails, platinumSubmitDirectDepositAllocation, platinumLoadDetailsPaymentGrouping, platinumLoadConfirmPaymentDetails, platinumLoadDetailsClearance, platinumGetClearanceDetailsInfo, platinumDDAccountAutocomplete, platinumDDOldAccountAutocomplete, platinumDDClearanceAutocomplete, fetchMiscPaymentGroups, rebuildFullAccount } from '@/lib/external-api';

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
      const seen = new Set<number>();
      const isNumeric = /^\d+$/.test(query);
      const parseResults = (data: any) => {
        if (Array.isArray(data)) return data;
        if (data?.value && Array.isArray(data.value)) return data.value;
        return [];
      };

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

      if (searchScope === 'CLEARANCE') {
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
      ddSearchTimerRef.current = setTimeout(() => performDDSearch(value), 250);
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

        const urlParams = new URLSearchParams(window.location.search);
        const preAccountId = urlParams.get('accountId');
        const preAccountNo = urlParams.get('accountNo');
        const preName = urlParams.get('name');
        const preAmount = urlParams.get('amount');
        if (preAccountId && preAccountNo) {
          setSelectedAccount({
            accountNo: preAccountNo,
            name: preName || 'Unknown',
            description: preName || preAccountNo,
            accountId: parseInt(preAccountId, 10),
            allocationType: 'ACCOUNT',
          });
          setNewLineAmount(preAmount && parseFloat(preAmount) > 0 ? parseFloat(preAmount).toFixed(2) : "0.00");
        }
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
                          userId: -3,
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
                  const confirmResponse = await platinumLoadConfirmPaymentDetails({}, {
                      billType,
                      accountID: accountIdStr,
                      posItem: String(transaction.posItem_ID),
                  });
                  console.log('[Direct Deposit] load-confirm-payment-details RESPONSE:', JSON.stringify(confirmResponse));
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
                  userId: -3,
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

  const allocationPercent = transaction.amount > 0 ? Math.min(100, (allocatedTotal / transaction.amount) * 100) : 0;

  const scopeOptions = [
    { value: 'ALL', label: 'All', icon: Search },
    { value: 'ACCOUNT', label: 'Account', icon: Building2 },
    { value: 'CLEARANCE', label: 'Clearance', icon: FileCheck },
    { value: 'DIRECT', label: 'Income', icon: Receipt },
  ] as const;

  return (
    <PosLayout>
      <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100/80">
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-b bg-white/80 backdrop-blur-sm flex items-center gap-4 sticky top-0 z-10">
             <Link href="/direct-deposits/manual">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-slate-100" data-testid="button-back">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
             </Link>
             <div className="flex-1">
                 <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Allocate Transaction</h1>
                 <p className="text-xs text-muted-foreground mt-0.5">POS Item <span className="font-mono font-medium">#{transaction.posItem_ID}</span></p>
             </div>
             <Badge variant={isFullyAllocated ? "default" : "secondary"} className={`hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs ${isFullyAllocated ? 'bg-emerald-500 hover:bg-emerald-500' : ''}`}>
                {isFullyAllocated ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {isFullyAllocated ? 'Fully Allocated' : `${allocationPercent.toFixed(0)}% Allocated`}
             </Badge>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

            <div className="lg:col-span-4 xl:col-span-3 space-y-5">
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bank Deposit</h2>
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Recon ID: {transaction.bankReconID}</p>
                        </div>
                    </div>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Description</label>
                        <p className="text-sm font-medium text-slate-800 leading-relaxed">{transaction.note || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Reference</label>
                        <Badge variant="secondary" className="font-mono text-xs">{transaction.reference || '-'}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <div>
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Date</label>
                            <span className="font-mono text-xs">{transaction.dateOfTransaction ? new Date(transaction.dateOfTransaction).toLocaleDateString('en-ZA') : '-'}</span>
                        </div>
                    </div>
                </div>
                <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block mb-1">Total Amount</label>
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight">R {transaction.amount.toFixed(2)}</div>
                </div>
              </div>

              <div className="rounded-xl border bg-white shadow-sm p-5">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Allocation Progress</h3>
                <div className="space-y-3">
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${isFullyAllocated ? 'bg-emerald-500' : allocationPercent > 0 ? 'bg-blue-500' : 'bg-slate-200'}`}
                            style={{ width: `${allocationPercent}%` }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                            <div className="text-[11px] text-muted-foreground mb-0.5">Allocated</div>
                            <div className="text-sm font-bold font-mono text-slate-800">R {allocatedTotal.toFixed(2)}</div>
                        </div>
                        <div className={`rounded-lg p-2.5 text-center ${Math.abs(remaining) < 0.01 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <div className={`text-[11px] ${Math.abs(remaining) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>Remaining</div>
                            <div className={`text-sm font-bold font-mono ${Math.abs(remaining) < 0.01 ? 'text-emerald-700' : 'text-red-700'}`}>R {remaining.toFixed(2)}</div>
                        </div>
                    </div>
                    <div className="text-[11px] text-center text-muted-foreground">{lines.length} allocation line{lines.length !== 1 ? 's' : ''}</div>
                </div>
              </div>

              <div className="space-y-2">
                {remaining > 0.005 && (
                  <Button variant="outline" onClick={handleReturnToCashbook} className="w-full justify-center gap-2 h-10 text-sm text-orange-700 border-orange-200 hover:bg-orange-50 hover:border-orange-300">
                      <RotateCcw className="w-3.5 h-3.5" /> Return R {remaining.toFixed(2)} to Cashbook
                  </Button>
                )}
                <Button
                    className={`w-full justify-center gap-2 h-11 text-sm font-medium transition-all ${isFullyAllocated ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    disabled={!isFullyAllocated || posting}
                    onClick={handlePost}
                >
                    {posting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <CheckCircle className="w-4 h-4" />
                    )}
                    {posting ? 'Posting...' : 'Post Allocation'}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-8 xl:col-span-9">
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-gradient-to-r from-white to-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold tracking-tight">Allocation Lines</h2>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-slate-200">
                            <Upload className="w-3.5 h-3.5" /> Import CSV
                        </Button>
                    </div>

                    <div className="flex items-center gap-1.5 mb-3">
                        {scopeOptions.map(opt => {
                            const Icon = opt.icon;
                            const isActive = searchScope === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    data-testid={`scope-${opt.value.toLowerCase()}`}
                                    onClick={() => setSearchScope(opt.value as any)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                        isActive
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                    }`}
                                >
                                    <Icon className="w-3 h-3" />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative" ref={ddSearchRef}>
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            data-testid="input-dd-search"
                            placeholder={
                                searchScope === 'ALL' ? "Search by account number, name, or old code..." :
                                searchScope === 'ACCOUNT' ? "Search consumer account number or name..." :
                                searchScope === 'CLEARANCE' ? "Search clearance certificate..." :
                                "Search direct income group..."
                            }
                            className="h-11 pl-10 pr-10 bg-slate-50 border-slate-200 rounded-lg focus:bg-white transition-colors"
                            value={ddSearchQuery}
                            onChange={e => handleDDSearchInput(e.target.value)}
                            onFocus={() => { if (ddSearchResults.length > 0) setDdDropdownOpen(true); }}
                        />
                        {ddSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />}
                        {ddSearchQuery && !ddSearching && (
                            <button className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => { setDdSearchQuery(''); setDdSearchResults([]); setDdDropdownOpen(false); }}>
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        {ddDropdownOpen && ddSearchResults.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 max-h-80 overflow-y-auto">
                                {ddSearchResults.map((result, idx) => (
                                    <button
                                        key={`${result.type}-${result.accountId}-${idx}`}
                                        data-testid={`dd-result-${result.type}-${result.accountId}`}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100/80 last:border-b-0 flex items-center gap-3 transition-colors"
                                        onClick={() => handleSelectDDResult(result)}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            result.type === 'ACCOUNT' ? 'bg-blue-50 text-blue-600' :
                                            result.type === 'CLEARANCE' ? 'bg-amber-50 text-amber-600' :
                                            'bg-emerald-50 text-emerald-600'
                                        }`}>
                                            {result.type === 'ACCOUNT' ? <Building2 className="w-3.5 h-3.5" /> :
                                             result.type === 'CLEARANCE' ? <FileCheck className="w-3.5 h-3.5" /> :
                                             <Receipt className="w-3.5 h-3.5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-slate-800 truncate">
                                                {result.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {result.accountNo}
                                                {result.oldAccountCode ? ` | Old: ${result.oldAccountCode}` : ''}
                                                {result.description && !result.oldAccountCode ? ` | ${result.description}` : ''}
                                            </div>
                                        </div>
                                        {result.outstandingAmount != null && result.outstandingAmount !== 0 && (
                                            <span className="text-xs font-mono font-medium text-slate-500 shrink-0 bg-slate-50 px-2 py-1 rounded">
                                                R {result.outstandingAmount.toFixed(2)}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        {ddDropdownOpen && ddSearchResults.length === 0 && !ddSearching && ddSearchQuery.length >= 2 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 p-6 text-center">
                                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">No results found for "<span className="font-medium text-slate-600">{ddSearchQuery}</span>"</p>
                            </div>
                        )}
                    </div>
                </div>

                {selectedAccount && (
                    <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/30 border-b border-blue-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    selectedAccount.allocationType === 'CLEARANCE' ? 'bg-amber-100 text-amber-700' :
                                    selectedAccount.allocationType === 'DIRECT' ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {selectedAccount.allocationType === 'CLEARANCE' ? <FileCheck className="w-5 h-5" /> :
                                     selectedAccount.allocationType === 'DIRECT' ? <Receipt className="w-5 h-5" /> :
                                     <Building2 className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 truncate">{selectedAccount.name}</div>
                                    <div className="text-xs text-slate-500 font-mono truncate">{selectedAccount.accountNo}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 sm:shrink-0">
                                <div className="relative flex-1 sm:w-36">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R</span>
                                    <Input
                                        ref={inputRef}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="h-10 pl-7 font-mono font-bold text-right bg-white border-blue-200 focus:border-blue-400"
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
                                </div>
                                <Button onClick={handleAddLine} size="icon" className="h-10 w-10 bg-blue-600 hover:bg-blue-700 rounded-lg shrink-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                                <Button onClick={() => { setSelectedAccount(null); setNewLineAmount(''); }} size="icon" variant="ghost" className="h-10 w-10 text-slate-400 hover:text-slate-600 shrink-0">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {selectedClearance && (
                    <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50/30 border-b border-amber-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                    <FileCheck className="w-5 h-5 text-amber-700" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-800">{selectedClearance.scheduleNo}</div>
                                    <div className="text-xs text-slate-500">
                                        {selectedClearance.linkedAccounts.length} accounts | Due: <span className="font-mono font-medium">R {selectedClearance.totalDue.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => setSelectedClearance(null)} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {selectedClearance.linkedAccounts.map(account => {
                                const s118_1 = selectedClearance.section118_1_Breakdown.filter(i => i.accountNo === account.accountNo);
                                const s118_3 = selectedClearance.section118_3_Breakdown.filter(i => i.accountNo === account.accountNo);
                                if (s118_1.length === 0 && s118_3.length === 0) return null;
                                return (
                                    <div key={account.accountNo} className="bg-white/70 backdrop-blur-sm p-3.5 rounded-lg border border-amber-100/80">
                                        <div className="text-sm font-medium mb-2.5 flex items-center gap-2">
                                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-mono">{account.accountNo}</span>
                                            <span className="text-slate-700">{account.name}</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {s118_1.length > 0 && (
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Section 118(1)</label>
                                                    {s118_1.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-2">
                                                            <span className="text-xs truncate flex-1" title={item.item}>{item.item}</span>
                                                            <Input type="number" className="h-8 w-28 text-right font-mono text-sm" value={clearanceAllocations[`118_1_${account.accountNo}_${idx}`] || ''} onChange={e => setClearanceAllocations(prev => ({ ...prev, [`118_1_${account.accountNo}_${idx}`]: parseFloat(e.target.value) || 0 }))} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {s118_3.length > 0 && (
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Section 118(3)</label>
                                                    {s118_3.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-2">
                                                            <span className="text-xs truncate flex-1" title={item.item}>{item.item}</span>
                                                            <Input type="number" className="h-8 w-28 text-right font-mono text-sm" value={clearanceAllocations[`118_3_${account.accountNo}_${idx}`] || ''} onChange={e => setClearanceAllocations(prev => ({ ...prev, [`118_3_${account.accountNo}_${idx}`]: parseFloat(e.target.value) || 0 }))} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 pt-3 border-t border-amber-200/60 flex justify-between items-center">
                            <div className="text-sm">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="ml-2 font-bold font-mono">R {Object.values(clearanceAllocations).reduce((a, b) => a + b, 0).toFixed(2)}</span>
                            </div>
                            <Button onClick={handleAddClearanceLines} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                                <Plus className="w-4 h-4" /> Add Lines
                            </Button>
                        </div>
                    </div>
                )}

                <div className="min-h-[280px] sm:min-h-[360px]">
                    {lines.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-6 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                <Banknote className="w-7 h-7 text-slate-400" />
                            </div>
                            <h3 className="text-sm font-medium text-slate-600 mb-1">No allocations yet</h3>
                            <p className="text-xs text-muted-foreground max-w-xs">Use the search bar above to find consumer accounts, clearance certificates, or direct income items to allocate to.</p>
                            {remaining > 0.005 && (
                                <Button variant="outline" size="sm" onClick={handleReturnToCashbook} className="mt-5 text-orange-600 border-orange-200 hover:bg-orange-50 gap-1.5 text-xs">
                                    <RotateCcw className="w-3 h-3" /> Return R {remaining.toFixed(2)} to Cashbook
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="sm:hidden divide-y">
                                {lines.map((line, idx) => (
                                    <div key={line.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                                            line.allocationType === 'CASHBOOK' ? 'bg-orange-50 text-orange-600' :
                                            line.allocationType === 'CLEARANCE' ? 'bg-amber-50 text-amber-600' :
                                            line.allocationType === 'DIRECT' || line.allocationType === 'GROUP' ? 'bg-emerald-50 text-emerald-600' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-700 truncate">{line.description || line.accountNo}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{line.accountNo}</div>
                                        </div>
                                        <span className="font-mono text-sm font-semibold text-slate-800 shrink-0">R {line.amount.toFixed(2)}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0 rounded-lg" onClick={() => handleRemoveLine(line.id)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <table className="hidden sm:table w-full">
                                <thead>
                                    <tr className="border-b bg-slate-50/50">
                                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3 w-8">#</th>
                                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Account</th>
                                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Description</th>
                                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Type</th>
                                        <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Amount</th>
                                        <th className="px-3 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {lines.map((line, idx) => (
                                        <tr key={line.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-5 py-3">
                                                <span className="text-xs text-muted-foreground">{idx + 1}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="font-mono text-sm text-slate-700">{line.accountNo}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-sm text-slate-500 truncate block max-w-[300px]">{line.description}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <Badge variant="secondary" className={`text-[10px] font-medium ${
                                                    line.allocationType === 'CASHBOOK' ? 'bg-orange-50 text-orange-700' :
                                                    line.allocationType === 'CLEARANCE' ? 'bg-amber-50 text-amber-700' :
                                                    line.allocationType === 'DIRECT' || line.allocationType === 'GROUP' ? 'bg-emerald-50 text-emerald-700' :
                                                    'bg-blue-50 text-blue-700'
                                                }`}>
                                                    {line.allocationType === 'CASHBOOK' ? 'Return' :
                                                     line.allocationType === 'CLEARANCE' ? 'Clearance' :
                                                     line.allocationType === 'DIRECT' || line.allocationType === 'GROUP' ? 'Income' : 'Account'}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="font-mono text-sm font-semibold text-slate-800">R {line.amount.toFixed(2)}</span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-lg" onClick={() => handleRemoveLine(line.id)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                {lines.length > 0 && (
                    <div className="px-5 py-4 border-t bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-6 text-sm">
                            <div>
                                <span className="text-muted-foreground">Allocated:</span>
                                <span className="ml-1.5 font-bold font-mono">R {allocatedTotal.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Remaining:</span>
                                <span className={`ml-1.5 font-bold font-mono ${Math.abs(remaining) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    R {remaining.toFixed(2)}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:hidden">
                            {remaining > 0.005 && (
                                <Button variant="outline" size="sm" onClick={handleReturnToCashbook} className="flex-1 text-orange-700 border-orange-200 hover:bg-orange-50 text-xs gap-1.5">
                                    <RotateCcw className="w-3 h-3" /> Cashbook
                                </Button>
                            )}
                            <Button
                                size="sm"
                                className={`flex-1 text-xs gap-1.5 ${isFullyAllocated ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-200 text-slate-400'}`}
                                disabled={!isFullyAllocated || posting}
                                onClick={handlePost}
                            >
                                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                {posting ? 'Posting...' : 'Post'}
                            </Button>
                        </div>
                    </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </PosLayout>
  );
}
