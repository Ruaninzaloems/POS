import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, CheckCircle, AlertCircle, Upload, X, Loader2, Search, Banknote, Building2, FileCheck, Receipt, CreditCard, RotateCcw, FileSpreadsheet, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AllocationLine, Account, ClearanceCostSchedule, platinumGetPosItemDetails, platinumSubmitDirectDepositAllocation, platinumLoadDetailsPaymentGrouping, platinumLoadConfirmPaymentDetails, platinumLoadDetailsClearance, platinumGetClearanceDetailsInfo, platinumDDAccountAutocomplete, platinumDDOldAccountAutocomplete, platinumDDClearanceAutocomplete, fetchMiscPaymentGroups, rebuildFullAccount, platinumSearchAccountsPayment, fetchActiveFinYear, fetchPlatinumUserInfo } from '@/lib/external-api';
import { Link, useLocation, useRoute } from 'wouter';
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
  const [linesPage, setLinesPage] = useState(1);
  const LINES_PER_PAGE = 10;
  
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

  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsedRows, setCsvParsedRows] = useState<{ accountNo: string; amount: number; raw: string }[]>([]);
  const [csvLookupResults, setCsvLookupResults] = useState<{ accountNo: string; amount: number; status: 'pending' | 'loading' | 'found' | 'not_found' | 'error'; name?: string; accountId?: number; outstandingAmount?: number; errorMsg?: string }[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvStep, setCsvStep] = useState<'upload' | 'preview' | 'lookup' | 'done'>('upload');
  const [csvPage, setCsvPage] = useState(1);
  const CSV_PAGE_SIZE = 20;
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const csvCancelRef = useRef(false);
  
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
          platinumSearchAccountsPayment(searchBody).catch(() => []),
        ];
        if (isNumeric) {
          searches.push(
            platinumSearchAccountsPayment({ oldAccountCode: query }).catch(() => [])
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

  const parseRowsFromColumns = (rows: string[][], sourceLabel: string) => {
    if (rows.length === 0) {
      toast({ title: 'Empty File', description: `The ${sourceLabel} file appears to be empty.`, variant: 'destructive' });
      return;
    }

    const firstCols = rows[0].map(c => String(c).trim());
    const hasHeader = firstCols.length >= 2
      && firstCols.some(c => /^(account|acc|accno|account.?n)/i.test(c))
      && firstCols.some(c => /^(amount|amt|value|total)/i.test(c));
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const parsed: { accountNo: string; amount: number; raw: string }[] = [];
    for (const cols of dataRows) {
      if (cols.length < 2) continue;
      const c0 = String(cols[0]).trim().replace(/^["']|["']$/g, '');
      const c1 = String(cols[1]).trim().replace(/^["']|["']$/g, '');
      if (!c0) continue;

      let accountNo = '';
      let amount = 0;

      const numericFirst = parseFloat(c0.replace(/\s/g, ''));
      const numericSecond = parseFloat(c1.replace(/\s/g, ''));

      if (!isNaN(numericSecond) && numericSecond > 0 && c0.length > 0) {
        accountNo = c0.replace(/\s/g, '');
        amount = numericSecond;
      } else if (!isNaN(numericFirst) && numericFirst > 0 && cols.length >= 2) {
        if (c1 && /[a-zA-Z]/.test(c1)) {
          accountNo = c0.replace(/\s/g, '');
          const amtCol = cols.find((c, i) => i >= 2 && !isNaN(parseFloat(String(c).trim().replace(/\s/g, ''))));
          amount = amtCol ? parseFloat(String(amtCol).trim().replace(/\s/g, '')) : 0;
        } else {
          accountNo = c0.replace(/\s/g, '');
          amount = numericSecond;
        }
      }

      if (accountNo && amount > 0) {
        parsed.push({ accountNo, amount, raw: cols.map(c => String(c)).join(', ') });
      }
    }

    if (parsed.length === 0) {
      toast({ title: 'No Valid Data', description: `Could not find any rows with account numbers and amounts. Ensure your file has at least 2 columns: Account Number and Amount.`, variant: 'destructive' });
      return;
    }

    setCsvParsedRows(parsed);
    setCsvStep('preview');
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const isExcel = /\.(xlsx?|xls)$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const XLSX = await import('xlsx');
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
          const filtered = jsonRows.filter(r => r.some((c: any) => String(c).trim()));
          parseRowsFromColumns(filtered.map(r => r.map((c: any) => String(c))), 'Excel');
        } catch (err: any) {
          toast({ title: 'Excel Parse Error', description: err.message || 'Failed to read Excel file.', variant: 'destructive' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        const rawLines = text.split(/\r?\n/).filter(l => l.trim());

        const sampleLines = rawLines.slice(0, Math.min(5, rawLines.length));
        const countChar = (lines: string[], ch: string) => lines.reduce((sum, l) => sum + (l.split(ch).length - 1), 0);
        const semiCount = countChar(sampleLines, ';');
        const tabCount = countChar(sampleLines, '\t');
        const delimiter = semiCount >= sampleLines.length ? ';' : tabCount >= sampleLines.length ? '\t' : ',';

        const rows = rawLines.map(line => line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
        parseRowsFromColumns(rows, 'CSV');
      };
      reader.readAsText(file);
    }
  };

  const handleCsvLookup = async () => {
    if (csvParsedRows.length === 0) return;
    setCsvStep('lookup');
    setCsvPage(1);
    setCsvProcessing(true);
    csvCancelRef.current = false;

    type CsvLookupRow = typeof csvLookupResults[number];
    const results: CsvLookupRow[] = csvParsedRows.map(row => ({
      accountNo: row.accountNo,
      amount: row.amount,
      status: 'pending' as const,
    }));
    setCsvLookupResults([...results]);

    const parseResults = (data: any) => {
      if (Array.isArray(data)) return data;
      if (data?.value && Array.isArray(data.value)) return data.value;
      return [];
    };

    const BATCH_SIZE = 50;
    for (let batchStart = 0; batchStart < results.length; batchStart += BATCH_SIZE) {
      if (csvCancelRef.current) break;

      const batchEnd = Math.min(batchStart + BATCH_SIZE, results.length);
      const batchIndices: number[] = [];
      for (let i = batchStart; i < batchEnd; i++) {
        results[i] = { ...results[i], status: 'loading' };
        batchIndices.push(i);
      }
      setCsvLookupResults([...results]);

      const batchPromises = batchIndices.map(async (i) => {
        if (csvCancelRef.current) return;
        try {
          const searchBody: Record<string, any> = { accountNo: results[i].accountNo };
          const apiResult = await platinumSearchAccountsPayment(searchBody);
          const items = parseResults(apiResult);

          if (items.length > 0) {
            const item = items[0];
            const accId = item.account_ID || item.accountID || item.id;
            const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
            const outstanding = item.outStandingAmt || item.outstandingAmount || 0;
            results[i] = { ...results[i], status: 'found', name, accountId: accId, outstandingAmount: outstanding };
          } else {
            results[i] = { ...results[i], status: 'not_found', errorMsg: 'Account not found' };
          }
        } catch (err: any) {
          results[i] = { ...results[i], status: 'error', errorMsg: err.message || 'Lookup failed' };
        }
      });

      await Promise.all(batchPromises);
      setCsvLookupResults([...results]);
    }

    if (csvCancelRef.current) {
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'loading' || results[i].status === 'pending') {
          results[i] = { ...results[i], status: 'error', errorMsg: 'Cancelled' };
        }
      }
      setCsvLookupResults([...results]);
    }

    setCsvProcessing(false);
    setCsvStep('done');
  };

  const handleCsvCancelLookup = () => {
    csvCancelRef.current = true;
  };

  const handleCsvAddToLines = () => {
    if (!transaction) return;
    const found = csvLookupResults.filter(r => r.status === 'found' && r.accountId);
    let currentTotal = allocatedTotal;

    const newLines: AllocationLine[] = [];
    const skipped: string[] = [];

    for (const row of found) {
      const validation = validateAllocationAmount(row.amount, currentTotal, transaction.amount);
      if (!validation.valid) {
        skipped.push(`${row.accountNo} (R ${row.amount.toFixed(2)}) - ${validation.error}`);
        continue;
      }
      newLines.push({
        id: Math.random().toString(36).substr(2, 9),
        accountNo: row.accountNo,
        amount: row.amount,
        description: `CSV Import: ${row.name || row.accountNo}`,
        allocationType: 'ACCOUNT',
        accountId: row.accountId,
      });
      currentTotal += row.amount;
    }

    if (newLines.length > 0) {
      setLines(prev => [...prev, ...newLines]);
    }

    if (skipped.length > 0) {
      toast({
        title: `${newLines.length} Added, ${skipped.length} Skipped`,
        description: skipped.slice(0, 3).join('; ') + (skipped.length > 3 ? `... and ${skipped.length - 3} more` : ''),
        variant: 'destructive',
      });
    } else {
      toast({ title: 'CSV Import Complete', description: `${newLines.length} allocation line(s) added from CSV.` });
    }

    setCsvDialogOpen(false);
    setCsvFile(null);
    setCsvParsedRows([]);
    setCsvLookupResults([]);
    setCsvStep('upload');
  };

  const handleCsvDialogClose = () => {
    if (csvProcessing) return;
    setCsvDialogOpen(false);
    setCsvFile(null);
    setCsvParsedRows([]);
    setCsvLookupResults([]);
    setCsvStep('upload');
    setCsvPage(1);
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
     const clearanceAccountId = selectedClearance.linkedAccounts?.[0]?.apiId || 0;

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
                 accountId: clearanceAccountId,
                 clearanceId: parseInt(selectedClearance.scheduleNo, 10) || 0,
                 outstandingAmount: item.amount,
             });
             totalToAdd += amount;
         }
     });

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
                 accountId: clearanceAccountId,
                 clearanceId: parseInt(selectedClearance.scheduleNo, 10) || 0,
                 outstandingAmount: item.amount,
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
              finYear = await fetchActiveFinYear();
          } catch {}

          let userId = -1;
          try {
              const userInfo = await fetchPlatinumUserInfo();
              if (userInfo?.user_ID) userId = userInfo.user_ID;
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

          const ALLOC_TYPE_ORDER: Record<string, number> = {
              'ACCOUNT': 1,
              'PREPAID': 1,
              'CLEARANCE': 2,
              'DIRECT': 3,
              'CASHBOOK': 4,
          };

          const sortedLines = [...lines].sort((a, b) => {
              const orderA = ALLOC_TYPE_ORDER[a.allocationType || 'ACCOUNT'] || 99;
              const orderB = ALLOC_TYPE_ORDER[b.allocationType || 'ACCOUNT'] || 99;
              return orderA - orderB;
          });

          console.log('[Direct Deposit] Processing order:', sortedLines.map(l => `${l.allocationType}:${l.accountNo}:R${l.amount}`));

          let submittedCount = 0;
          for (const line of sortedLines) {
              if (line.accountNo === 'CASHBOOK-RTN' || line.allocationType === 'CASHBOOK') continue;

              const allocType = line.allocationType || 'ACCOUNT';

              let billType = '1';
              if (allocType === 'DIRECT') {
                  billType = '4';
              } else if (allocType === 'CLEARANCE') {
                  billType = '6';
              }

              const accountIdStr = line.accountId ? String(line.accountId) : '';

              try {
                  if (allocType === 'DIRECT') {
                      console.log(`[Direct Deposit] Step 1: load-details-payment-grouping for misc (billType 4)`);
                      await platinumLoadDetailsPaymentGrouping({
                          amount: line.amount,
                          dateOfTransaction: transactionDate,
                          cashbookID: transaction.cashbookTransactionID || 0,
                          posItemId: transaction.posItem_ID,
                          paymentTypeID: 3,
                          userId: userId,
                          finYear,
                          page: 1,
                          pageSize: 100,
                      });
                  } else if (allocType === 'CLEARANCE') {
                      console.log(`[Direct Deposit] Step 1: load-details-clearance (billType 6)`);
                      const pagerBody = { page: 1, pageSize: 100, orderby: null, shortDirection: null };
                      await platinumLoadDetailsClearance(pagerBody);

                      console.log(`[Direct Deposit] Step 2: get-clearance-details-info for ${accountIdStr}`);
                      await platinumGetClearanceDetailsInfo({
                          costScheduleID: line.clearanceId ? String(line.clearanceId) : accountIdStr,
                          accountID: accountIdStr,
                          posItemID: transaction.posItem_ID,
                          transactionAmount: line.amount,
                      });
                  }
              } catch (prepErr) {
                  console.warn(`[Direct Deposit] Preparation step warning (non-blocking):`, prepErr);
              }

              try {
                  console.log(`[Direct Deposit] load-confirm-payment-details for billType=${billType}, account ${accountIdStr}`);
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
                  posItemId: transaction.posItem_ID,
                  reconId: transaction.bankReconID || 0,
                  userId: userId,
                  financialYear: finYear,
                  transactionDate,
                  paidAmount: line.amount,
                  billType,
                  accountId: (allocType === 'ACCOUNT' || allocType === 'PREPAID' || allocType === 'CLEARANCE') ? (line.accountId || 0) : 0,
                  paymentTypeId: line.paymentTypeId ?? 5,
                  description: line.description || transaction.note || '',
                  reference: line.reference || transaction.reference || '',
                  note: line.note || transaction.note || '',
                  outstandingAmount: line.outstandingAmount ?? line.amount,
                  receiptDate: receiptDate,
              };

              if (allocType === 'CLEARANCE') {
                  submitData.clearanceId = line.clearanceId || 0;
              }

              if (allocType === 'DIRECT') {
                  submitData.miscPaymentGroupId = line.miscPaymentGroupId || 0;
                  submitData.lastName = line.lastName || '';
                  submitData.initials = line.initials || '';
                  submitData.amount = line.amount;
                  submitData.vatAmount = line.vatAmount ?? 0;
                  submitData.totalAmount = line.amount;
                  submitData.vatableVote = line.vatableVote ?? 0;
                  submitData.vatPercentage = line.vatPercentage ?? 0;
              }

              console.log(`[Direct Deposit] submit-details-data (${allocType}, billType=${billType}):`, submitData);
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
      <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100/80 overflow-hidden">
        <div className="px-3 sm:px-8 py-3 sm:py-5 border-b bg-white/80 backdrop-blur-sm flex items-center gap-2 sm:gap-4 sticky top-0 z-20">
             <Link href="/direct-deposits/manual">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-slate-100" data-testid="button-back">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
             </Link>
             <div className="flex-1 min-w-0">
                 <h1 className="text-base sm:text-xl font-semibold tracking-tight truncate">Allocate Transaction</h1>
                 <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">POS Item <span className="font-mono font-medium">#{transaction.posItem_ID}</span></p>
             </div>
             <Badge variant={isFullyAllocated ? "default" : "secondary"} className={`hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs ${isFullyAllocated ? 'bg-emerald-500 hover:bg-emerald-500' : ''}`}>
                {isFullyAllocated ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {isFullyAllocated ? 'Fully Allocated' : `${allocationPercent.toFixed(0)}% Allocated`}
             </Badge>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="lg:hidden px-3 py-2.5 bg-white border-b z-10 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{transaction.note || 'Bank Deposit'}</p>
                  <div className="text-base font-bold font-mono tracking-tight">R {transaction.amount.toFixed(2)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className={`text-xs ${Math.abs(remaining) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>Remaining</div>
                  <div className={`text-sm font-bold font-mono ${Math.abs(remaining) < 0.01 ? 'text-emerald-700' : 'text-red-700'}`}>R {remaining.toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${isFullyAllocated ? 'bg-emerald-500' : allocationPercent > 0 ? 'bg-blue-500' : 'bg-slate-200'}`}
                style={{ width: `${allocationPercent}%` }}
              />
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

            <div className="hidden lg:block lg:col-span-4 xl:col-span-3 space-y-5">
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
                <div className="px-3 sm:px-5 py-3 sm:py-4 border-b bg-gradient-to-r from-white to-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm sm:text-base font-semibold tracking-tight">Allocation Lines</h2>
                        <Button variant="outline" size="sm" className="h-7 sm:h-8 text-xs gap-1.5 border-slate-200" data-testid="button-import-csv" onClick={() => setCsvDialogOpen(true)}>
                            <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Import</span> File
                        </Button>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 mb-3 overflow-x-auto pb-0.5">
                        {scopeOptions.map(opt => {
                            const Icon = opt.icon;
                            const isActive = searchScope === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    data-testid={`scope-${opt.value.toLowerCase()}`}
                                    onClick={() => setSearchScope(opt.value as any)}
                                    className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
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
                        <Search className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            data-testid="input-dd-search"
                            placeholder={
                                searchScope === 'ALL' ? "Search account, name, old code..." :
                                searchScope === 'ACCOUNT' ? "Search account number or name..." :
                                searchScope === 'CLEARANCE' ? "Search clearance certificate..." :
                                "Search direct income group..."
                            }
                            className="h-10 sm:h-11 pl-9 sm:pl-10 pr-10 bg-slate-50 border-slate-200 rounded-lg focus:bg-white transition-colors text-sm"
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
                    <div className="px-3 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-blue-50 to-indigo-50/30 border-b border-blue-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
                            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                                    selectedAccount.allocationType === 'CLEARANCE' ? 'bg-amber-100 text-amber-700' :
                                    selectedAccount.allocationType === 'DIRECT' ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {selectedAccount.allocationType === 'CLEARANCE' ? <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" /> :
                                     selectedAccount.allocationType === 'DIRECT' ? <Receipt className="w-4 h-4 sm:w-5 sm:h-5" /> :
                                     <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{selectedAccount.name}</div>
                                    <div className="text-[11px] sm:text-xs text-slate-500 font-mono truncate">{selectedAccount.accountNo}</div>
                                </div>
                                <Button onClick={() => { setSelectedAccount(null); setNewLineAmount(''); }} size="icon" variant="ghost" className="h-7 w-7 sm:hidden text-slate-400 hover:text-slate-600 shrink-0 ml-auto">
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 sm:shrink-0">
                                <div className="relative flex-1 sm:w-36">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R</span>
                                    <Input
                                        ref={inputRef}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="h-9 sm:h-10 pl-7 font-mono font-bold text-right bg-white border-blue-200 focus:border-blue-400 text-sm"
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
                                <Button onClick={handleAddLine} size="icon" className="h-9 sm:h-10 w-9 sm:w-10 bg-blue-600 hover:bg-blue-700 rounded-lg shrink-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                                <Button onClick={() => { setSelectedAccount(null); setNewLineAmount(''); }} size="icon" variant="ghost" className="hidden sm:flex h-10 w-10 text-slate-400 hover:text-slate-600 shrink-0">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {selectedClearance && (
                    <div className="px-3 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-amber-50 to-orange-50/30 border-b border-amber-100 animate-in fade-in slide-in-from-top-2 duration-200">
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
                    ) : (() => {
                        const totalPages = Math.ceil(lines.length / LINES_PER_PAGE);
                        const safePage = Math.min(linesPage, totalPages);
                        const startIdx = (safePage - 1) * LINES_PER_PAGE;
                        const pageLines = lines.slice(startIdx, startIdx + LINES_PER_PAGE);
                        return (
                        <>
                            <div className="sm:hidden divide-y">
                                {pageLines.map((line, idx) => (
                                    <div key={line.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                                            line.allocationType === 'CASHBOOK' ? 'bg-orange-50 text-orange-600' :
                                            line.allocationType === 'CLEARANCE' ? 'bg-amber-50 text-amber-600' :
                                            line.allocationType === 'DIRECT' ? 'bg-emerald-50 text-emerald-600' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                            {startIdx + idx + 1}
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
                                    {pageLines.map((line, idx) => (
                                        <tr key={line.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-5 py-3">
                                                <span className="text-xs text-muted-foreground">{startIdx + idx + 1}</span>
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
                                                    line.allocationType === 'DIRECT' ? 'bg-emerald-50 text-emerald-700' :
                                                    'bg-blue-50 text-blue-700'
                                                }`}>
                                                    {line.allocationType === 'CASHBOOK' ? 'Return' :
                                                     line.allocationType === 'CLEARANCE' ? 'Clearance' :
                                                     line.allocationType === 'DIRECT' ? 'Income' : 'Account'}
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

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-5 py-3 border-t bg-slate-50/30">
                                    <span className="text-xs text-muted-foreground">
                                        Showing {startIdx + 1}–{Math.min(startIdx + LINES_PER_PAGE, lines.length)} of {lines.length} lines
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setLinesPage(p => Math.max(1, p - 1))} data-testid="button-lines-prev-page">
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </Button>
                                        {(() => {
                                            const pages: number[] = [];
                                            const maxButtons = 5;
                                            let start = Math.max(1, safePage - Math.floor(maxButtons / 2));
                                            let end = Math.min(totalPages, start + maxButtons - 1);
                                            if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);
                                            for (let i = start; i <= end; i++) pages.push(i);
                                            return pages.map(p => (
                                                <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="icon" className={`h-7 w-7 text-xs ${p === safePage ? 'bg-slate-800 text-white' : ''}`} onClick={() => setLinesPage(p)} data-testid={`button-lines-page-${p}`}>
                                                    {p}
                                                </Button>
                                            ));
                                        })()}
                                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setLinesPage(p => Math.min(totalPages, p + 1))} data-testid="button-lines-next-page">
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                        );
                    })()}
                </div>

                {lines.length > 0 && (
                    <div className="hidden sm:flex px-5 py-4 border-t bg-gradient-to-r from-slate-50 to-white items-center justify-between">
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
                    </div>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="lg:hidden sticky bottom-0 z-10 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center gap-2">
          {remaining > 0.005 && (
            <Button variant="outline" size="sm" onClick={handleReturnToCashbook} className="text-orange-700 border-orange-200 hover:bg-orange-50 text-xs gap-1.5 h-10">
              <RotateCcw className="w-3.5 h-3.5" /> Cashbook
            </Button>
          )}
          <Button
            className={`flex-1 h-10 text-sm font-medium gap-1.5 ${isFullyAllocated ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            disabled={!isFullyAllocated || posting}
            onClick={handlePost}
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {posting ? 'Posting...' : 'Post Allocation'}
          </Button>
        </div>
      </div>

      <Dialog open={csvDialogOpen} onOpenChange={(open) => { if (!csvProcessing) { if (!open) handleCsvDialogClose(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[85vh] h-[calc(100vh-2rem)] sm:h-auto overflow-hidden flex flex-col mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Import File
            </DialogTitle>
            <DialogDescription>
              {csvStep === 'upload' && 'Upload a CSV or Excel file with account numbers and amounts to bulk-add allocation lines.'}
              {csvStep === 'preview' && `${csvParsedRows.length} row(s) parsed from the file. Review and proceed to look up accounts.`}
              {csvStep === 'lookup' && 'Looking up account information from Platinum API...'}
              {csvStep === 'done' && 'Lookup complete. Add the found accounts to your allocation lines.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {csvStep === 'upload' && (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  className="hidden"
                  onChange={handleCsvFileSelect}
                  data-testid="input-csv-file"
                />
                <div
                  className="w-full max-w-md border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                  onClick={() => csvFileInputRef.current?.click()}
                  data-testid="csv-dropzone"
                >
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-sm font-medium text-slate-700 mb-1">Click to select a file</p>
                  <p className="text-xs text-muted-foreground">Supported formats: .csv, .txt, .xlsx, .xls</p>
                </div>
                <div className="mt-6 w-full max-w-md bg-slate-50 rounded-lg p-4 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-slate-600 text-sm mb-2">Expected file format:</p>
                  <p className="font-mono bg-white px-2 py-1 rounded border text-[11px]">AccountNumber, Amount</p>
                  <p className="font-mono bg-white px-2 py-1 rounded border text-[11px]">100234, 500.00</p>
                  <p className="font-mono bg-white px-2 py-1 rounded border text-[11px]">100567, 1200.50</p>
                  <p className="mt-2">Headers are auto-detected. CSV supports comma, semicolon, and tab delimiters. Excel files use the first sheet.</p>
                </div>
              </div>
            )}

            {csvStep === 'preview' && (
              <div className="space-y-3 p-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium text-slate-700">{csvParsedRows.length} row(s) from <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{csvFile?.name}</span></span>
                  <Button variant="ghost" size="sm" className="text-xs text-slate-500 gap-1" onClick={() => { setCsvStep('upload'); setCsvParsedRows([]); setCsvFile(null); }}>
                    <X className="w-3 h-3" /> Change file
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-8">#</th>
                        <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account No</th>
                        <th className="text-right px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(() => {
                        const totalPg = Math.ceil(csvParsedRows.length / CSV_PAGE_SIZE);
                        const pg = Math.min(csvPage, totalPg || 1);
                        const start = (pg - 1) * CSV_PAGE_SIZE;
                        return csvParsedRows.slice(start, start + CSV_PAGE_SIZE).map((row, idx) => (
                          <tr key={start + idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 text-xs text-muted-foreground">{start + idx + 1}</td>
                            <td className="px-4 py-2 font-mono text-sm">{row.accountNo}</td>
                            <td className="px-4 py-2 text-right font-mono text-sm font-medium">R {row.amount.toFixed(2)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                {csvParsedRows.length > CSV_PAGE_SIZE && (() => {
                  const totalPg = Math.ceil(csvParsedRows.length / CSV_PAGE_SIZE);
                  const pg = Math.min(csvPage, totalPg);
                  const start = (pg - 1) * CSV_PAGE_SIZE;
                  return (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-muted-foreground">Showing {start + 1}–{Math.min(start + CSV_PAGE_SIZE, csvParsedRows.length)} of {csvParsedRows.length}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={pg <= 1} onClick={() => setCsvPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                        <span className="text-xs text-muted-foreground px-2">Page {pg} of {totalPg}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={pg >= totalPg} onClick={() => setCsvPage(p => p + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  );
                })()}
                <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2 text-xs text-blue-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Total import amount: <span className="font-bold font-mono">R {csvParsedRows.reduce((s, r) => s + r.amount, 0).toFixed(2)}</span> | Remaining to allocate: <span className="font-bold font-mono">R {remaining.toFixed(2)}</span></span>
                </div>
              </div>
            )}

            {(csvStep === 'lookup' || csvStep === 'done') && (
              <div className="space-y-3 p-1">
                {csvProcessing && (() => {
                  const done = csvLookupResults.filter(r => r.status === 'found' || r.status === 'not_found' || r.status === 'error').length;
                  const total = csvLookupResults.length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <div className="bg-blue-50 rounded-lg p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Looking up accounts... {done} / {total}</span>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={handleCsvCancelLookup} data-testid="button-cancel-lookup">
                          <X className="w-3 h-3" /> Stop
                        </Button>
                      </div>
                      <div className="w-full bg-blue-200/50 rounded-full h-3 overflow-hidden">
                        <div className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-right text-xs font-semibold text-blue-700">{pct}%</div>
                    </div>
                  );
                })()}
                {csvStep === 'done' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-emerald-700">{csvLookupResults.filter(r => r.status === 'found').length}</div>
                      <div className="text-[11px] text-emerald-600">Found</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-red-700">{csvLookupResults.filter(r => r.status === 'not_found').length}</div>
                      <div className="text-[11px] text-red-600">Not Found</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-amber-700">{csvLookupResults.filter(r => r.status === 'error').length}</div>
                      <div className="text-[11px] text-amber-600">Errors</div>
                    </div>
                  </div>
                )}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-8">#</th>
                        <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account</th>
                        <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                        <th className="text-right px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="text-center px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-20">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(() => {
                        const totalPg = Math.ceil(csvLookupResults.length / CSV_PAGE_SIZE) || 1;
                        const pg = Math.min(csvPage, totalPg);
                        const start = (pg - 1) * CSV_PAGE_SIZE;
                        return csvLookupResults.slice(start, start + CSV_PAGE_SIZE).map((row, idx) => (
                          <tr key={start + idx} className={`${row.status === 'not_found' || row.status === 'error' ? 'bg-red-50/30' : row.status === 'found' ? 'bg-emerald-50/20' : ''}`}>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{start + idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs">{row.accountNo}</td>
                            <td className="px-3 py-2 text-xs truncate max-w-[180px]">{row.name || row.errorMsg || '-'}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs font-medium">R {row.amount.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center">
                              {row.status === 'pending' && <span className="text-xs text-slate-400">Pending</span>}
                              {row.status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 mx-auto" />}
                              {row.status === 'found' && <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />}
                              {row.status === 'not_found' && <AlertTriangle className="w-4 h-4 text-red-400 mx-auto" />}
                              {row.status === 'error' && <AlertCircle className="w-4 h-4 text-amber-500 mx-auto" />}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                {csvLookupResults.length > CSV_PAGE_SIZE && (() => {
                  const totalPg = Math.ceil(csvLookupResults.length / CSV_PAGE_SIZE);
                  const pg = Math.min(csvPage, totalPg);
                  const start = (pg - 1) * CSV_PAGE_SIZE;
                  return (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-muted-foreground">Showing {start + 1}–{Math.min(start + CSV_PAGE_SIZE, csvLookupResults.length)} of {csvLookupResults.length}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={pg <= 1} onClick={() => setCsvPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                        <span className="text-xs text-muted-foreground px-2">Page {pg} of {totalPg}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={pg >= totalPg} onClick={() => setCsvPage(p => p + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4 mt-2 gap-2">
            {csvStep === 'upload' && (
              <Button variant="outline" onClick={handleCsvDialogClose}>Cancel</Button>
            )}
            {csvStep === 'preview' && (
              <>
                <Button variant="outline" onClick={handleCsvDialogClose}>Cancel</Button>
                <Button onClick={handleCsvLookup} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                  <Search className="w-3.5 h-3.5" /> Look Up Accounts
                </Button>
              </>
            )}
            {csvStep === 'lookup' && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5" onClick={handleCsvCancelLookup}>
                <X className="w-3.5 h-3.5" /> Stop Lookup
              </Button>
            )}
            {csvStep === 'done' && (
              <>
                <Button variant="outline" onClick={handleCsvDialogClose}>Cancel</Button>
                {csvLookupResults.filter(r => r.status === 'found').length > 0 && (
                  <Button onClick={handleCsvAddToLines} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add {csvLookupResults.filter(r => r.status === 'found').length} Account(s)
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
