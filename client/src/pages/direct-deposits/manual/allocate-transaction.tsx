import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, CheckCircle, AlertCircle, Upload, X, Loader2, Search, Banknote, Building2, FileCheck, Receipt, CreditCard, RotateCcw, FileSpreadsheet, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, Zap, Landmark, Printer, BookOpen } from 'lucide-react';
import { AllocationLine, Account, ClearanceCostSchedule, platinumGetPosItemDetails, platinumSubmitDirectDepositAllocation, createDDVirtualSession, closeDDVirtualSession, platinumLoadDetailsPaymentGrouping, platinumLoadDetailsPaymentGroupingInstitutionData, platinumLoadDetailsConsumerServices, platinumLoadConfirmPaymentDetails, platinumLoadDetailsClearance, platinumGetClearanceDetailsInfo, platinumGetConsumerDetailsData, platinumDDAccountAutocomplete, platinumDDOldAccountAutocomplete, platinumDDClearanceAutocomplete, platinumSearchClearanceIds, platinumGetClearanceData, platinumGetGroupPaymentDetails, fetchMiscPaymentGroups, rebuildFullAccount, platinumSearchAccountsPayment, fetchActiveFinYear, fetchPlatinumUserInfo, searchInstitutions, fetchAccountsByGroup, submitDDAllocationBatch, pollDDAllocationJob, platinumPrintReceiptRaw, getReceiptTransactionDetail } from '@/lib/external-api';
import { Link, useLocation, useRoute } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { AccountEnquiryDialog } from '@/components/account-enquiry-dialog';

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
  type: 'ACCOUNT' | 'CLEARANCE' | 'DIRECT' | 'GROUP' | 'INSTITUTION';
  description?: string;
  rawData?: any;
}

import { validateAllocationAmount, calculateAllocationTotals } from '@/lib/allocation-logic';
import { HelpTip } from '@/components/ui/help-tip';

export default function AllocateTransaction() {
  const [, params] = useRoute('/direct-deposits/manual/allocate/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [transaction, setTransaction] = useState<BankReconPosItem | null>(null);
  const [loadingTx, setLoadingTx] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postingStatus, setPostingStatus] = useState('');
  const [postingStep, setPostingStep] = useState(0);
  const [postingTotalSteps, setPostingTotalSteps] = useState(0);
  const [postingErrors, setPostingErrors] = useState<string[]>([]);
  const [postComplete, setPostComplete] = useState(false);
  const [completedLines, setCompletedLines] = useState<{ accountNo: string; accountId?: number; description: string; amount: number; allocationType: string; receiptId?: number | null; depositMasterId?: number | null }[]>([]);
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTitle, setLedgerTitle] = useState('');
  const [printingReceiptId, setPrintingReceiptId] = useState<number | null>(null);
  const [lines, setLines] = useState<AllocationLine[]>([]);
  const [linesPage, setLinesPage] = useState(1);
  const LINES_PER_PAGE = 10;
  
  const [searchScope, setSearchScope] = useState<'ALL' | 'ACCOUNT' | 'PREPAID' | 'INSTITUTION' | 'CLEARANCE' | 'DIRECT' | 'GROUP'>('ALL');
  
  const [selectedAccount, setSelectedAccount] = useState<{accountNo: string, name: string, description?: string, accountId?: number, allocationType?: string, miscPaymentGroupId?: number} | null>(null);
  const [newLineAmount, setNewLineAmount] = useState('');

  const [selectedClearance, setSelectedClearance] = useState<ClearanceCostSchedule | null>(null);
  const [clearanceAllocations, setClearanceAllocations] = useState<Record<string, number>>({});
  const [loadingClearanceDetails, setLoadingClearanceDetails] = useState(false);
  const [clearanceLoadError, setClearanceLoadError] = useState<string | null>(null);
  
  const [ddSearchQuery, setDdSearchQuery] = useState('');
  const [ddSearchResults, setDdSearchResults] = useState<DDSearchResult[]>([]);
  const [ddSearching, setDdSearching] = useState(false);
  const [ddDropdownOpen, setDdDropdownOpen] = useState(false);
  const ddSearchRef = useRef<HTMLDivElement>(null);
  const ddSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ddSearchVersionRef = useRef(0);
  
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
  
  const [enquiryAccountId, setEnquiryAccountId] = useState<string | null>(null);
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
      .catch((err) => { console.error('[AllocateTransaction] Failed to fetch misc payment groups:', err); setMiscGroupsLoaded(true); });
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
    const searchVersion = ++ddSearchVersionRef.current;
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

      const primaryResults: DDSearchResult[] = [];
      const secondaryResults: DDSearchResult[] = [];

      const pushResults = () => {
        if (searchVersion !== ddSearchVersionRef.current) return;
        const combined = [...primaryResults, ...secondaryResults].slice(0, 15);
        setDdSearchResults(combined);
        if (combined.length > 0) setDdDropdownOpen(true);
      };

      const primaryTasks: Promise<void>[] = [];
      const secondaryFactories: (() => Promise<void>)[] = [];

      if (searchScope === 'ALL' || searchScope === 'ACCOUNT' || searchScope === 'PREPAID') {
        const resultType: 'ACCOUNT' | 'CLEARANCE' | 'DIRECT' | 'GROUP' = searchScope === 'PREPAID' ? 'ACCOUNT' : 'ACCOUNT';
        const allocType = searchScope === 'PREPAID' ? 'PREPAID' : 'ACCOUNT';
        primaryTasks.push((async () => {
          const searchBody: Record<string, any> = {};
          if (isNumeric) {
            searchBody.accountNo = query;
          } else {
            searchBody.name = query;
          }

          const accountResults = await platinumSearchAccountsPayment(searchBody).catch((err) => { console.error('[AllocateTransaction] Failed to search accounts:', err); return []; });

          let accountHits = 0;
          for (const item of parseResults(accountResults)) {
            const accId = item.account_ID || item.accountID || item.id;
            if (accId && !seen.has(accId)) {
              seen.add(accId);
              accountHits++;
              primaryResults.push({
                accountId: accId,
                accountNo: item.accountNumber || item.accountNo || String(accId),
                name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
                oldAccountCode: item.oldAccountCode || '',
                outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
                type: resultType,
                rawData: { ...item, _allocationType: allocType },
              });
            }
          }
          pushResults();

          if (isNumeric && accountHits === 0) {
            const oldAccountResults = await platinumSearchAccountsPayment({ oldAccountCode: query }).catch(() => []);
            for (const item of parseResults(oldAccountResults)) {
              const accId = item.account_ID || item.accountID || item.id;
              if (accId && !seen.has(accId)) {
                seen.add(accId);
                primaryResults.push({
                  accountId: accId,
                  accountNo: item.accountNumber || item.accountNo || String(accId),
                  name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
                  oldAccountCode: item.oldAccountCode || query,
                  outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
                  type: resultType,
                  description: `Found via old account code: ${query}`,
                  rawData: { ...item, _allocationType: allocType },
                });
              }
            }
            pushResults();
          }
        })());
      }

      if (searchScope === 'ALL' || searchScope === 'DIRECT') {
        if (miscGroupsLoaded && miscGroups.length > 0) {
          const q = query.toLowerCase();
          const matchedGroups = miscGroups.filter(g => 
            g.name && g.name.toLowerCase().includes(q)
          ).slice(0, 5);
          for (const g of matchedGroups) {
            primaryResults.push({
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

      const makeClearanceTask = () => async () => {
        try {
          if (isNumeric) {
            const clearanceIds = await platinumSearchClearanceIds(query);
            if (Array.isArray(clearanceIds)) {
              for (const formattedId of clearanceIds) {
                secondaryResults.push({
                  accountId: 0,
                  accountNo: formattedId,
                  name: `Clearance ${formattedId}`,
                  type: 'CLEARANCE',
                  rawData: { clearanceFormattedId: formattedId },
                });
              }
              pushResults();
              return;
            }
          }
          const clearanceResults = await platinumDDClearanceAutocomplete(query);
          if (Array.isArray(clearanceResults)) {
            for (const item of clearanceResults) {
              secondaryResults.push({
                accountId: item.account_ID || item.accountId || item.id || 0,
                accountNo: item.accountNumber || item.certificateNo || item.displayItem || String(item.id || ''),
                name: item.name || item.displayItem || item.description || 'Clearance',
                type: 'CLEARANCE',
                rawData: item,
              });
            }
            pushResults();
          }
        } catch (err) {
          console.error('[AllocateTransaction] Failed to search clearance IDs:', err);
        }
      };

      const makeGroupTask = () => async () => {
        try {
          const groupResults = await platinumGetGroupPaymentDetails({ searchTerm: query });
          const groupArr = Array.isArray(groupResults) ? groupResults : (groupResults?.value || []);
          for (const g of groupArr.slice(0, 5)) {
            const gId = g.groupId || g.id || g.group_ID || 0;
            if (!seen.has(gId + 100000)) {
              seen.add(gId + 100000);
              secondaryResults.push({
                accountId: g.accountId || g.account_ID || 0,
                accountNo: g.accountNumber || g.accountNo || `GRP-${gId}`,
                name: g.name || g.description || g.groupName || 'Payment Group',
                type: 'GROUP',
                description: `Payment Grouping: ${g.name || g.description || g.groupName || ''}`,
                rawData: g,
              });
            }
          }
          pushResults();
        } catch (err) {
          console.error('[AllocateTransaction] Failed to search group payment details:', err);
        }
      };

      const makeInstitutionTask = () => async () => {
        try {
          const institutionResults = await searchInstitutions(query);
          for (const inst of institutionResults.slice(0, 10)) {
            const instId = inst.institutionID || 0;
            if (instId && !seen.has(instId + 200000)) {
              seen.add(instId + 200000);
              secondaryResults.push({
                accountId: instId,
                accountNo: `INST-${instId}`,
                name: inst.institutionDesc || 'Institution',
                type: 'INSTITUTION',
                description: `Institution: ${inst.institutionDesc || ''}`,
                rawData: inst,
              });
            }
          }
          pushResults();
        } catch (err) {
          console.error('[AllocateTransaction] Failed to search institutions:', err);
        }
      };

      if (searchScope === 'ALL' || searchScope === 'CLEARANCE') {
        if (isNumeric || searchScope === 'CLEARANCE') {
          if (searchScope === 'CLEARANCE') {
            primaryTasks.push(makeClearanceTask()());
          } else {
            secondaryFactories.push(makeClearanceTask());
          }
        }
      }

      if (searchScope === 'GROUP' || (searchScope === 'ALL' && !isNumeric)) {
        if (searchScope === 'GROUP') {
          primaryTasks.push(makeGroupTask()());
        } else {
          secondaryFactories.push(makeGroupTask());
        }
      }

      if (searchScope === 'INSTITUTION' || (searchScope === 'ALL' && !isNumeric)) {
        if (searchScope === 'INSTITUTION') {
          primaryTasks.push(makeInstitutionTask()());
        } else {
          secondaryFactories.push(makeInstitutionTask());
        }
      }

      await Promise.all(primaryTasks);
      pushResults();

      if (secondaryFactories.length > 0 && searchVersion === ddSearchVersionRef.current) {
        Promise.all(secondaryFactories.map(f => f())).then(() => pushResults()).catch(() => {});
      }
    } catch (err) {
      console.error('DD search error:', err);
      if (searchVersion === ddSearchVersionRef.current) setDdSearchResults([]);
    } finally {
      if (searchVersion === ddSearchVersionRef.current) setDdSearching(false);
    }
  }, [searchScope, miscGroups, miscGroupsLoaded, toast]);

  const handleDDSearchInput = (value: string) => {
    setDdSearchQuery(value);
    if (ddSearchTimerRef.current) clearTimeout(ddSearchTimerRef.current);
    if (value.length >= 2) {
      ddSearchTimerRef.current = setTimeout(() => performDDSearch(value), 150);
    } else {
      setDdSearchResults([]);
      setDdDropdownOpen(false);
    }
  };

  const loadClearanceDetails = async (result: DDSearchResult) => {
    if (!transaction) return;
    setLoadingClearanceDetails(true);
    setClearanceLoadError(null);
    setSelectedClearance(null);
    
    const rawItem = result.rawData || {};
    const formattedClearanceId = rawItem.clearanceFormattedId || result.accountNo || '';
    
    console.log(`[Clearance] Loading details for clearanceId=${formattedClearanceId}, posItemID=${transaction.posItem_ID}`);
    
    try {
      let clearanceData: any = null;

      if (formattedClearanceId) {
        try {
          clearanceData = await platinumGetClearanceData(formattedClearanceId);
          console.log('[Clearance] get-clearance-data response:', JSON.stringify(clearanceData)?.substring(0, 2000));
        } catch (e: any) {
          console.warn('[Clearance] get-clearance-data failed, trying legacy endpoints:', e.message);
        }
      }

      if (clearanceData && clearanceData.items && Array.isArray(clearanceData.items) && clearanceData.items.length > 0) {
        const item = clearanceData.items[0];
        const clearanceStagingId = item.clearanceStaging_ID || 0;
        const accountID = item.accountID || '';
        const scheduleNo = formattedClearanceId || String(clearanceStagingId);

        const linkedAccounts: Account[] = [{
          accountNo: item.accountID || '',
          name: item.name || '',
          apiId: parseInt(String(item.accountID).replace(/^0+/, ''), 10) || 0,
          outstandingAmount: item.remaining || item.total || 0,
        } as Account];

        const section118_1: { item: string; amount: number; accountNo: string }[] = [];
        const section118_3: { item: string; amount: number; accountNo: string }[] = [];

        if (item.total1181 && item.total1181 > 0) {
          section118_1.push({
            item: 'Section 118(1) — Municipal Debt',
            amount: item.total1181,
            accountNo: item.accountID || '',
          });
        }
        if (item.total1183 && item.total1183 > 0) {
          section118_3.push({
            item: 'Section 118(3) — Rates Clearance',
            amount: item.total1183,
            accountNo: item.accountID || '',
          });
        }

        const totalDue = item.remaining ?? item.total ?? ((item.total1181 || 0) + (item.total1183 || 0));

        const costSchedule: ClearanceCostSchedule = {
          scheduleNo,
          costScheduleID: clearanceStagingId,
          status: item.status || '-',
          totalDue,
          linkedAccounts,
          section118_1_Breakdown: section118_1,
          section118_3_Breakdown: section118_3,
          clearanceData: {
            sgNumber: item.sgNumber || '',
            locationAddress: item.locationAddress || '',
            expiryDate: item.clearanceExpiryDateStr || item.clearanceExpiryDate || '',
            accountName: item.name || '',
            paid: item.paid || 0,
            total: item.total || 0,
            remaining: item.remaining || 0,
          },
        };

        console.log('[Clearance] Built cost schedule from get-clearance-data:', JSON.stringify(costSchedule));
        setSelectedClearance(costSchedule);
        return;
      }

      const costScheduleID = rawItem.costScheduleID || rawItem.costSchedule_ID || rawItem.id || rawItem.clearanceId || rawItem.clearanceFormattedId || rawItem.clearanceStaging_ID || result.accountId || 0;
      const accountID = rawItem.account_ID || rawItem.accountId || rawItem.accountID || result.accountId || 0;

      console.log(`[Clearance] Falling back to legacy endpoints: costScheduleID=${costScheduleID}, accountID=${accountID}`);

      const [clearanceInfo, loadResult] = await Promise.allSettled([
        platinumGetClearanceDetailsInfo({
          costScheduleID: String(costScheduleID),
          accountID: String(accountID),
          transactionAmount: transaction.amount,
          posItemID: transaction.posItem_ID,
        }),
        platinumLoadDetailsClearance({
          costScheduleID: String(costScheduleID),
          posItemID: transaction.posItem_ID,
          transactionAmount: transaction.amount,
        }),
      ]);
      
      const detailsData = clearanceInfo.status === 'fulfilled' ? clearanceInfo.value : null;
      const loadData = loadResult.status === 'fulfilled' ? loadResult.value : null;
      
      if (!detailsData && !loadData) {
        const infoErr = clearanceInfo.status === 'rejected' ? (clearanceInfo.reason?.message || 'Unknown error') : '';
        const loadErr = loadResult.status === 'rejected' ? (loadResult.reason?.message || 'Unknown error') : '';
        throw new Error(`Failed to load clearance details. Details: ${infoErr}. Load: ${loadErr}`);
      }

      const legacyScheduleNo = rawItem.displayItem || rawItem.certificateNo || rawItem.accountNumber || result.accountNo || String(costScheduleID);
      const numericCostScheduleID = Number(costScheduleID) || 0;
      
      if (!numericCostScheduleID) {
        throw new Error(`Invalid costScheduleID (${costScheduleID}) from API response.`);
      }

      const primaryData = detailsData || loadData;
      
      const rawAccounts = primaryData.accounts || primaryData.linkedAccounts || [];
      if (!Array.isArray(rawAccounts) || rawAccounts.length === 0) {
        throw new Error(`No linked accounts returned for cost schedule ${legacyScheduleNo}.`);
      }

      const legacyLinkedAccounts: Account[] = rawAccounts.map((acc: any) => ({
        accountNo: acc.accountNumber || acc.accountNo || String(acc.account_ID || acc.accountId || ''),
        name: [acc.initials, acc.lastName].filter(Boolean).join(' ') || acc.name || acc.ownerName || '',
        apiId: acc.account_ID || acc.accountId || acc.accountID || 0,
        outstandingAmount: acc.outStandingAmt || acc.outstandingAmount || acc.totalDue || 0,
      } as Account));

      const rawItems = primaryData.items || primaryData.costScheduleItems || primaryData.section118Items || [];
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new Error(`No cost schedule items returned for ${legacyScheduleNo}.`);
      }

      const legacySection118_1: { item: string; amount: number; accountNo: string }[] = [];
      const legacySection118_3: { item: string; amount: number; accountNo: string }[] = [];
      let legacyTotalDue = 0;
      
      for (const sItem of rawItems) {
        const sectionType = sItem.sectionType || sItem.section || sItem.type || '';
        const entry = {
          item: sItem.description || sItem.name || sItem.item || '',
          amount: sItem.amount || sItem.totalAmount || sItem.balance || 0,
          accountNo: sItem.accountNumber || sItem.accountNo || '',
        };
        legacyTotalDue += entry.amount;
        if (String(sectionType).includes('3') || String(sectionType) === '118(3)') {
          legacySection118_3.push(entry);
        } else {
          legacySection118_1.push(entry);
        }
      }
      
      const legacyCostSchedule: ClearanceCostSchedule = {
        scheduleNo: legacyScheduleNo,
        costScheduleID: numericCostScheduleID,
        status: 'Active',
        totalDue: legacyTotalDue,
        linkedAccounts: legacyLinkedAccounts,
        section118_1_Breakdown: legacySection118_1,
        section118_3_Breakdown: legacySection118_3,
      };
      
      console.log('[Clearance] Built cost schedule from legacy API:', JSON.stringify(legacyCostSchedule));
      setSelectedClearance(legacyCostSchedule);
    } catch (err: any) {
      console.error('[Clearance] Failed to load details:', err);
      setClearanceLoadError(err.message || 'Failed to load clearance details from Platinum API');
    } finally {
      setLoadingClearanceDetails(false);
    }
  };

  const handleSelectDDResult = (result: DDSearchResult) => {
    setDdDropdownOpen(false);
    setDdSearchQuery('');
    setDdSearchResults([]);

    if (result.type === 'ACCOUNT') {
      const allocType = result.rawData?._allocationType || 'ACCOUNT';
      setSelectedAccount({
        accountNo: result.accountNo,
        name: result.name,
        description: result.oldAccountCode ? `${result.name} (Old: ${result.oldAccountCode})` : result.name,
        accountId: result.accountId,
        allocationType: allocType,
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
    } else if (result.type === 'GROUP') {
      setSelectedAccount({
        accountNo: result.accountNo,
        name: result.name,
        description: result.description || `Payment Grouping: ${result.name}`,
        accountId: result.accountId,
        allocationType: 'GROUP',
        miscPaymentGroupId: result.rawData?.id || result.rawData?.groupId || 0,
      });
      setNewLineAmount("0.00");
      setSelectedClearance(null);
    } else if (result.type === 'INSTITUTION') {
      handleSelectInstitution(result);
    } else if (result.type === 'CLEARANCE') {
      setSelectedAccount(null);
      setNewLineAmount('');
      setClearanceAllocations({});
      setClearanceLoadError(null);
      loadClearanceDetails(result);
    }
  };

  const [loadingInstitution, setLoadingInstitution] = useState(false);

  const handleSelectInstitution = async (result: DDSearchResult) => {
    const instId = result.rawData?.institution_ID || result.rawData?.institutionID || result.accountId;
    if (!instId || !transaction) return;

    setLoadingInstitution(true);
    try {
      const accounts = await fetchAccountsByGroup(instId);
      if (!accounts || accounts.length === 0) {
        toast({ title: "No Linked Accounts", description: `No accounts found linked to institution "${result.name}".`, variant: "destructive" });
        return;
      }

      const validAccounts = accounts.filter(acc => {
        const accId = acc.account_ID || acc.accountID || acc.id || 0;
        return accId > 0;
      });

      if (validAccounts.length === 0) {
        toast({ title: "No Valid Accounts", description: `No accounts with valid IDs found for institution "${result.name}".`, variant: "destructive" });
        return;
      }

      let budgetRemaining = transaction.amount - allocatedTotal;
      if (budgetRemaining <= 0) {
        toast({ title: "Fully Allocated", description: "The transaction is already fully allocated. Remove or reduce existing lines first.", variant: "destructive" });
        return;
      }

      const newLines: AllocationLine[] = [];
      for (const acc of validAccounts) {
        if (budgetRemaining <= 0) break;

        const accId = acc.account_ID || acc.accountID || acc.id;
        const accNo = acc.accountNumber || acc.accountNo || String(accId);
        const accName = acc.name || acc.accountDesc || [acc.initials, acc.lastName].filter(Boolean).join(' ') || 'Unknown';
        const outstanding = acc.outStandingAmt || acc.outstandingAmount || 0;

        let lineAmount: number;
        if (outstanding > 0) {
          lineAmount = Math.min(outstanding, budgetRemaining);
        } else {
          lineAmount = Math.round((budgetRemaining / (validAccounts.length - newLines.length)) * 100) / 100;
        }
        lineAmount = Math.min(lineAmount, budgetRemaining);

        if (lineAmount <= 0) continue;

        newLines.push({
          id: Math.random().toString(36).substr(2, 9),
          accountNo: accNo,
          amount: lineAmount,
          description: `${result.name} — ${accName}`,
          allocationType: 'ACCOUNT',
          accountId: accId,
        });

        budgetRemaining -= lineAmount;
      }

      if (newLines.length === 0) {
        toast({ title: "No Allocations", description: "Could not allocate any amount to the linked accounts.", variant: "destructive" });
        return;
      }

      setLines(prev => [...prev, ...newLines]);
      const skipped = validAccounts.length - newLines.length;
      const msg = skipped > 0
        ? `Added ${newLines.length} account(s) from "${result.name}" (${skipped} skipped — budget exhausted). Adjust amounts as needed.`
        : `Added ${newLines.length} account(s) from "${result.name}". Adjust amounts as needed.`;
      toast({ title: "Institution Accounts Added", description: msg });
    } catch (err: any) {
      console.error('[AllocateTransaction] Failed to fetch institution accounts:', err);
      toast({ title: "Institution Load Failed", description: err.message || "Failed to load accounts for this institution.", variant: "destructive" });
    } finally {
      setLoadingInstitution(false);
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

  const handleDownloadTemplate = async (format: 'csv' | 'xlsx') => {
    const headers = ['AccountNumber', 'Amount'];
    const sampleRows = [
      ['100234', '500.00'],
      ['100567', '1200.50'],
      ['200891', '750.00'],
    ];

    if (format === 'csv') {
      const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'allocation_import_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      try {
        const XLSX = await import('xlsx-js-style');
        const wb = XLSX.utils.book_new();
        const wsData = [headers, ...sampleRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }];
        const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4472C4' } }, alignment: { horizontal: 'center' } };
        headers.forEach((_, i) => {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
          if (ws[cellRef]) ws[cellRef].s = headerStyle;
        });
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'allocation_import_template.xlsx');
      } catch (err: any) {
        toast({ title: 'Download Error', description: err.message || 'Failed to generate Excel template.', variant: 'destructive' });
      }
    }
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
          const XLSX = await import('xlsx-js-style');
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

     const numCostScheduleId = selectedClearance.costScheduleID || 0;

     const buildLine = (item: { item: string; amount: number; accountNo: string }, idx: number, sectionLabel: string, sectionPrefix: string) => {
         const key = `${sectionPrefix}_${item.accountNo}_${idx}`;
         const amount = clearanceAllocations[key] || 0;
         if (amount > 0) {
             const matchedAccount = item.accountNo
                 ? selectedClearance.linkedAccounts.find(a => a.accountNo === item.accountNo)
                 : null;
             const itemAccountId = matchedAccount?.apiId || clearanceAccountId;
             const lineAccountNo = item.accountNo || matchedAccount?.accountNo || selectedClearance.linkedAccounts[0]?.accountNo || '';
             newLines.push({
                 id: Math.random().toString(36).substr(2, 9),
                 accountNo: lineAccountNo,
                 amount: amount,
                 description: `Clearance ${selectedClearance.scheduleNo} - ${sectionLabel}: ${item.item}`,
                 allocationType: 'CLEARANCE',
                 accountId: itemAccountId,
                 clearanceId: numCostScheduleId,
                 costScheduleId: numCostScheduleId,
                 outstandingAmount: item.amount,
             });
             totalToAdd += amount;
         }
     };

     selectedClearance.section118_1_Breakdown.forEach((item, idx) => buildLine(item, idx, '118(1)', '118_1'));
     selectedClearance.section118_3_Breakdown.forEach((item, idx) => buildLine(item, idx, '118(3)', '118_3'));

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

  const handleUpdateLineAmount = (id: string, rawValue: string) => {
      const parsed = parseFloat(rawValue);
      if (isNaN(parsed)) return;
      const clamped = Math.max(0, parsed);
      setLines(prev => prev.map(l => l.id === id ? { ...l, amount: clamped } : l));
  };

  const handlePost = async () => {
      const invalidLines = lines.filter(l => !l.amount || l.amount <= 0 || !isFinite(l.amount));
      if (invalidLines.length > 0) {
          toast({ title: "Validation Error", description: "All allocation lines must have an amount greater than zero.", variant: "destructive" });
          return;
      }
      if (!isFullyAllocated) {
          toast({ title: "Validation Error", description: "Allocated total must equal transaction amount.", variant: "destructive" });
          return;
      }

      if (!transaction) return;

      const posItemId = transaction.posItem_ID || 0;
      const reconId = transaction.bankReconID || 0;
      if (posItemId <= 0) {
          toast({ title: 'Validation Error', description: 'posItemId is missing or zero. Cannot proceed.', variant: 'destructive' });
          return;
      }
      if (reconId <= 0) {
          toast({ title: 'Validation Error', description: 'reconId (bankReconID) is missing or zero. Cannot proceed.', variant: 'destructive' });
          return;
      }

      setPosting(true);
      setPostingErrors([]);
      setPostingStep(0);
      setPostingStatus('Preparing batch...');

      try {
          setPostingStatus('Fetching financial year...');
          let finYear: string;
          try {
              finYear = await fetchActiveFinYear();
          } catch (e: any) {
              toast({ title: 'Financial Year Error', description: `Could not fetch active financial year from API: ${e?.message || 'Unknown error'}. Cannot proceed.`, variant: 'destructive' });
              setPosting(false);
              setPostingStatus('');
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

          setPostingStatus('Submitting batch to server...');
          const batchPayload = {
              posItemId,
              reconId,
              financialYear: finYear,
              transactionDate,
              transactionNote: transaction.note || transaction.reference || '',
              lines: lines.map(l => ({
                  accountNo: l.accountNo,
                  accountId: l.accountId,
                  amount: l.amount,
                  allocationType: l.allocationType || 'ACCOUNT',
                  description: l.description,
                  miscPaymentGroupId: l.miscPaymentGroupId,
                  clearanceId: l.clearanceId,
                  vatAmount: l.vatAmount,
                  lastName: l.lastName,
                  initials: l.initials,
              })),
          };

          let batchResult: { jobId: string; message: string };
          try {
              batchResult = await submitDDAllocationBatch(batchPayload);
          } catch (e: any) {
              if (e?.message?.includes('already being processed')) {
                  toast({ title: 'Already Processing', description: 'This allocation is already being processed on the server. Please wait.', variant: 'destructive' });
                  setPosting(false);
                  setPostingStatus('');
                  return;
              }
              throw e;
          }

          const { jobId } = batchResult;
          console.log(`[Direct Deposit] Batch job started: ${jobId}`);

          const activeLines = lines.filter(l => l.accountNo !== 'CASHBOOK-RTN' && l.allocationType !== 'CASHBOOK');
          setPostingTotalSteps(activeLines.length);

          const pollInterval = 1500;
          const maxPollTime = 10 * 60 * 1000;
          const startTime = Date.now();

          while (true) {
              await new Promise(resolve => setTimeout(resolve, pollInterval));

              if (Date.now() - startTime > maxPollTime) {
                  toast({
                      title: 'Polling Timeout',
                      description: 'The server is still processing your allocation. It will complete in the background. Check the allocation history for results.',
                      variant: 'destructive',
                  });
                  break;
              }

              try {
                  const jobStatus = await pollDDAllocationJob(jobId);

                  setPostingStep(jobStatus.processedLines);
                  setPostingTotalSteps(jobStatus.totalLines);
                  setPostingStatus(jobStatus.currentLine);

                  if (jobStatus.errors.length > 0) {
                      setPostingErrors(jobStatus.errors);
                  }

                  if (jobStatus.status !== 'PROCESSING') {
                      const successResults = jobStatus.results.filter((r: any) => r.status === 'SUCCESS');
                      const successfulLines = successResults.map((r: any) => ({
                          accountNo: r.accountNo,
                          accountId: lines.find(l => l.accountNo === r.accountNo)?.accountId,
                          description: lines.find(l => l.accountNo === r.accountNo)?.description || '',
                          amount: r.amount,
                          allocationType: r.allocationType,
                          receiptId: r.apiResponse?.receiptId || null,
                          depositMasterId: r.apiResponse?.depositMasterId || null,
                      }));

                      if (successfulLines.length > 0) {
                          const accountLinesToRebuild = successfulLines.filter((l: any) =>
                              (l.allocationType === 'ACCOUNT' || l.allocationType === 'PREPAID' || l.allocationType === 'CLEARANCE' || l.allocationType === 'GROUP')
                              && l.accountId && l.accountId > 0
                          );
                          const uniqueAccountIds = Array.from(new Set(accountLinesToRebuild.map((l: any) => l.accountId)));
                          if (uniqueAccountIds.length > 0) {
                              setPostingStatus(`Rebuilding ${uniqueAccountIds.length} account(s)...`);
                              const REBUILD_TIMEOUT = 15000;
                              const rebuildWithTimeout = (id: number) => Promise.race([
                                  rebuildFullAccount(id),
                                  new Promise((_, reject) => setTimeout(() => reject(new Error('Rebuild timeout')), REBUILD_TIMEOUT))
                              ]);
                              await Promise.allSettled(uniqueAccountIds.map(id => rebuildWithTimeout(id as number)));
                          }
                      }

                      setCompletedLines(successfulLines);

                      if (jobStatus.status === 'COMPLETED') {
                          toast({
                              title: "Allocation Posted Successfully",
                              description: `POS Item #${posItemId} — all ${jobStatus.completedLines} line(s) submitted successfully.`,
                          });
                      } else if (jobStatus.status === 'PARTIAL_FAILURE') {
                          toast({
                              title: 'Allocation Partially Complete',
                              description: `${jobStatus.completedLines} of ${jobStatus.totalLines} line(s) submitted. ${jobStatus.failedLines} failed.`,
                              variant: 'destructive',
                          });
                      } else {
                          toast({
                              title: 'Allocation Failed',
                              description: `No lines could be submitted. ${jobStatus.errors[0] || 'Unknown error'}`,
                              variant: 'destructive',
                          });
                      }

                      setPostComplete(true);
                      break;
                  }
              } catch (pollErr) {
                  console.warn('[Direct Deposit] Poll error (retrying):', pollErr);
              }
          }
      } catch (e: any) {
          console.error("Failed to submit allocation batch", e);
          toast({
              title: 'Submission Error',
              description: e.message || 'An unexpected error occurred while posting the allocation.',
              variant: 'destructive',
          });
      } finally {
          setPosting(false);
          setPostingStatus('');
      }
  };

  const handlePrintReceipt = async (receiptId: number | number[]) => {
    const displayId = Array.isArray(receiptId) ? receiptId[0] : receiptId;
    setPrintingReceiptId(displayId);
    try {
      const response = await platinumPrintReceiptRaw(receiptId);
      if (!response.ok) {
        toast({ title: 'Print Failed', description: `Could not fetch receipt PDF (HTTP ${response.status})`, variant: 'destructive' });
        return;
      }
      const blob = await response.blob();
      if (blob.size < 100) {
        toast({ title: 'Print Failed', description: 'Receipt PDF is empty — the API may not have generated it yet.', variant: 'destructive' });
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e: any) {
      toast({ title: 'Print Error', description: e?.message || 'Failed to print receipt', variant: 'destructive' });
    } finally {
      setPrintingReceiptId(null);
    }
  };

  const handleViewLedger = async (receiptId: number, lineLabel: string) => {
    setLedgerTitle(lineLabel);
    setLedgerDialogOpen(true);
    setLedgerLoading(true);
    setLedgerData(null);
    try {
      const data = await getReceiptTransactionDetail(receiptId);
      setLedgerData(data);
    } catch (e: any) {
      toast({ title: 'Ledger Error', description: e?.message || 'Failed to fetch ledger postings', variant: 'destructive' });
      setLedgerData(null);
    } finally {
      setLedgerLoading(false);
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

  if (postComplete && transaction) {
    const accountLines = completedLines.filter(l => l.allocationType === 'ACCOUNT' || l.allocationType === 'PREPAID' || l.allocationType === 'CLEARANCE');
    const totalAllocated = completedLines.reduce((sum, l) => sum + l.amount, 0);
    const linesWithReceipts = completedLines.filter(l => l.receiptId && l.receiptId > 0);

    return (
      <PosLayout>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E]" data-testid="text-allocation-complete-title">Allocation Complete</h1>
                <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">POS Item #{transaction.posItem_ID} — R {transaction.amount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">

              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-green-800" data-testid="text-post-success">Allocation Posted Successfully</h2>
                <p className="text-sm text-green-700 mt-1">
                  {completedLines.length} allocation line{completedLines.length !== 1 ? 's' : ''} submitted — R {totalAllocated.toFixed(2)} allocated
                </p>
              </div>

              {postingErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">Some lines had errors:</span>
                  </div>
                  {postingErrors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700 ml-6">{err}</p>
                  ))}
                </div>
              )}

              {completedLines.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E0E0E0] shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-[#F7F7F7] border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-1 bg-[var(--pos-accent)] rounded-full"></div>
                      <h3 className="text-sm font-medium text-slate-800">Allocated Lines</h3>
                      <span className="text-xs text-muted-foreground hidden sm:inline">— view receipts, ledger postings, or account enquiry</span>
                    </div>
                    {linesWithReceipts.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => {
                          const receiptIds = linesWithReceipts.map(l => l.receiptId!);
                          handlePrintReceipt(receiptIds);
                        }}
                        disabled={printingReceiptId !== null}
                        data-testid="button-print-all-receipts"
                      >
                        {printingReceiptId !== null ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Printer className="h-3 w-3" />
                        )}
                        Print All ({linesWithReceipts.length}) Receipts
                      </Button>
                    )}
                  </div>
                  <div className="divide-y">
                    {completedLines.map((line, i) => (
                      <div key={i} className="px-4 py-3 hover:bg-[#FAFAFA]" data-testid={`row-completed-line-${i}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                              {line.allocationType === 'ACCOUNT' || line.allocationType === 'PREPAID' ? (
                                <Building2 className="h-4 w-4 text-green-700" />
                              ) : line.allocationType === 'CLEARANCE' ? (
                                <FileCheck className="h-4 w-4 text-green-700" />
                              ) : line.allocationType === 'GROUP' ? (
                                <CreditCard className="h-4 w-4 text-green-700" />
                              ) : (
                                <Receipt className="h-4 w-4 text-green-700" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-mono font-medium text-slate-800">{line.accountNo || '-'}</span>
                                <Badge variant="outline" className="text-[10px]">{line.allocationType}</Badge>
                                {line.receiptId && line.receiptId > 0 && (
                                  <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">Receipt #{line.receiptId}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{line.description || '-'}</p>
                            </div>
                          </div>
                          <span className="text-sm font-mono font-semibold text-slate-800 shrink-0 ml-2">R {line.amount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 ml-11 flex-wrap">
                          {line.receiptId && line.receiptId > 0 && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-7 text-xs"
                                onClick={() => handlePrintReceipt(line.receiptId!)}
                                disabled={printingReceiptId === line.receiptId}
                                data-testid={`button-print-receipt-${i}`}
                              >
                                {printingReceiptId === line.receiptId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Printer className="h-3 w-3" />
                                )}
                                Print Receipt
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-7 text-xs"
                                onClick={() => handleViewLedger(line.receiptId!, `${line.allocationType} ${line.accountNo} — R ${line.amount.toFixed(2)}`)}
                                data-testid={`button-view-ledger-${i}`}
                              >
                                <BookOpen className="h-3 w-3" /> View Ledger
                              </Button>
                            </>
                          )}
                          {(line.allocationType === 'ACCOUNT' || line.allocationType === 'PREPAID' || line.allocationType === 'CLEARANCE') && line.accountNo && line.accountNo !== '-' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-7 text-xs border-[var(--pos-accent)] text-[var(--pos-accent-dark)] hover:bg-[var(--pos-accent-tint)]"
                              onClick={() => setEnquiryAccountId(line.accountNo)}
                              data-testid={`button-enquiry-${i}`}
                            >
                              <Eye className="h-3 w-3" /> View Enquiry
                            </Button>
                          )}
                          {!line.receiptId && (
                            <span className="text-xs text-muted-foreground italic">No receipt generated by API</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <Button
                  onClick={() => setLocation('/direct-deposits/manual')}
                  className="gap-2 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white px-6"
                  data-testid="button-back-to-queue"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Queue
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={ledgerDialogOpen} onOpenChange={setLedgerDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[var(--pos-accent-dark)]" />
                Ledger Postings
              </DialogTitle>
              <DialogDescription>{ledgerTitle}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto min-h-0">
              {ledgerLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-sm text-muted-foreground">Loading ledger postings...</span>
                </div>
              )}
              {!ledgerLoading && !ledgerData && (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No ledger data available for this receipt.</p>
                  <p className="text-xs mt-1">The API may not have generated the ledger postings yet.</p>
                </div>
              )}
              {!ledgerLoading && ledgerData && typeof ledgerData === 'string' && (
                <div className="p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-slate-800 bg-[#F7F7F7] rounded-lg p-4 border">{ledgerData}</pre>
                </div>
              )}
              {!ledgerLoading && ledgerData && Array.isArray(ledgerData) && ledgerData.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#F7F7F7] border-b">
                        {Object.keys(ledgerData[0]).map((key) => (
                          <th key={key} className="px-3 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">
                            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ledgerData.map((row: any, ri: number) => (
                        <tr key={ri} className="hover:bg-[#FAFAFA]">
                          {Object.values(row).map((val: any, ci: number) => (
                            <td key={ci} className="px-3 py-2 text-xs whitespace-nowrap">
                              {val === null || val === undefined ? '-' :
                                typeof val === 'number' ? val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                                String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!ledgerLoading && ledgerData && typeof ledgerData === 'object' && !Array.isArray(ledgerData) && (
                <div className="space-y-2 p-4">
                  {Object.entries(ledgerData).map(([key, val]: [string, any]) => (
                    <div key={key} className="flex justify-between items-center py-1 border-b border-dashed last:border-0">
                      <span className="text-xs font-medium text-slate-600">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                      <span className="text-xs text-slate-800 font-mono">
                        {val === null || val === undefined ? '-' :
                          typeof val === 'number' ? val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                          String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AccountEnquiryDialog
          open={enquiryAccountId !== null}
          onClose={() => setEnquiryAccountId(null)}
          accountId={enquiryAccountId || ''}
        />
      </PosLayout>
    );
  }

  const allocationPercent = transaction.amount > 0 ? Math.min(100, (allocatedTotal / transaction.amount) * 100) : 0;

  const scopeOptions = [
    { value: 'ALL', label: 'All', icon: Search },
    { value: 'ACCOUNT', label: 'Account', icon: Building2 },
    { value: 'PREPAID', label: 'Prepaid', icon: Zap },
    { value: 'INSTITUTION', label: 'Institution', icon: Landmark },
    { value: 'GROUP', label: 'Grouping', icon: CreditCard },
    { value: 'CLEARANCE', label: 'Clearance', icon: FileCheck },
    { value: 'DIRECT', label: 'Income', icon: Receipt },
  ] as const;

  return (
    <PosLayout>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-2 sm:gap-4">
             <Link href="/direct-deposits/manual">
                <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9 rounded-full hover:bg-[#F2F4F7]" data-testid="button-back">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
             </Link>
             <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                 <Banknote className="w-5 h-5 text-white" />
             </div>
             <div className="flex-1 min-w-0">
                 <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E] truncate">Allocate Transaction</h1>
                 <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">POS Item <span className="font-mono font-medium">#{transaction.posItem_ID}</span></p>
             </div>
             <Badge variant={isFullyAllocated ? "default" : "secondary"} className={`hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs ${isFullyAllocated ? 'bg-emerald-500 hover:bg-emerald-500' : ''}`}>
                {isFullyAllocated ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {isFullyAllocated ? 'Fully Allocated' : `${allocationPercent.toFixed(0)}% Allocated`}
             </Badge>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F4F7]">
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
            <div className="mt-2 h-1.5 bg-[#F2F4F7] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${isFullyAllocated ? 'bg-emerald-500' : allocationPercent > 0 ? 'bg-[var(--pos-accent)]' : 'bg-slate-200'}`}
                style={{ width: `${allocationPercent}%` }}
              />
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

            <div className="hidden lg:block lg:col-span-4 xl:col-span-3 space-y-5">
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-[#F7F7F7]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[var(--pos-accent-tint)] flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-[var(--pos-accent)]" />
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
                            <span className="font-mono text-xs">{transaction.dateOfTransaction ? new Date(transaction.dateOfTransaction).toLocaleDateString('en-GB') : '-'}</span>
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
                    <div className="h-2.5 bg-[#F2F4F7] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${isFullyAllocated ? 'bg-emerald-500' : allocationPercent > 0 ? 'bg-[var(--pos-accent)]' : 'bg-slate-200'}`}
                            style={{ width: `${allocationPercent}%` }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#F7F7F7] rounded-lg p-2.5 text-center">
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
                {posting && (
                  <div className="rounded-xl border border-[#D6D6D6] bg-[var(--pos-accent-tint)] p-4 space-y-3" data-testid="posting-progress-panel">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#2E2E2E]">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--pos-accent)]" />
                      Posting Allocation
                    </div>
                    <div className="h-2 bg-[#D6D6D6]/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--pos-accent)] rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${postingTotalSteps > 0 ? Math.round((postingStep / postingTotalSteps) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-[#6B6B6B] truncate flex-1 mr-2">{postingStatus}</p>
                      <span className="text-[11px] text-[#6B6B6B] font-mono whitespace-nowrap">{postingStep}/{postingTotalSteps}</span>
                    </div>
                    {postingErrors.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {postingErrors.map((err, i) => (
                          <p key={i} className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-0.5 truncate" title={err}>{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!posting && remaining > 0.005 && (
                  <Button variant="outline" onClick={handleReturnToCashbook} className="w-full justify-center gap-2 h-10 text-sm text-orange-700 border-orange-200 hover:bg-orange-50 hover:border-orange-300">
                      <RotateCcw className="w-3.5 h-3.5" /> Return R {remaining.toFixed(2)} to Cashbook
                  </Button>
                )}
                {!posting && (
                  <Button
                    className={`w-full justify-center gap-2 h-11 text-sm font-medium transition-all ${isFullyAllocated ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    disabled={!isFullyAllocated || posting}
                    onClick={handlePost}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Post Allocation
                    <HelpTip text="Confirm and post this allocation to the selected account(s)." side="top" className="ml-1" />
                  </Button>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 xl:col-span-9">
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="px-3 sm:px-5 py-3 sm:py-4 border-b bg-[#F7F7F7]">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm sm:text-base font-semibold tracking-tight">Allocation Lines</h2>
                        <Button variant="outline" size="sm" className="h-11 sm:h-8 text-xs gap-1.5 border-[#D6D6D6]" data-testid="button-import-csv" onClick={() => setCsvDialogOpen(true)}>
                            <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Import</span> File
                        </Button>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
                        <HelpTip text="Choose whether to allocate to a specific account, group, or clearance." side="bottom" className="mr-1" />
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
                                            : 'bg-[#F2F4F7] text-slate-500 hover:bg-[#F2F4F7] hover:text-slate-700'
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
                        <HelpTip text="Search for the consumer account to receive this deposit allocation." side="top" className="absolute right-10 top-1/2 -translate-y-1/2 z-10" />
                        <Input
                            data-testid="input-dd-search"
                            placeholder={
                                searchScope === 'ALL' ? "Search account, name, old code..." :
                                searchScope === 'ACCOUNT' ? "Search account number or name..." :
                                searchScope === 'PREPAID' ? "Search account for prepaid recharge..." :
                                searchScope === 'INSTITUTION' ? "Search institution name..." :
                                searchScope === 'GROUP' ? "Search payment grouping..." :
                                searchScope === 'CLEARANCE' ? "Search clearance certificate..." :
                                "Search direct income group..."
                            }
                            className="h-10 sm:h-11 pl-9 sm:pl-10 pr-10 bg-[#F7F7F7] border-[#D6D6D6] rounded-lg focus:bg-white transition-colors text-sm"
                            value={ddSearchQuery}
                            onChange={e => handleDDSearchInput(e.target.value)}
                            onFocus={() => { if (ddSearchResults.length > 0) setDdDropdownOpen(true); }}
                        />
                        {ddSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[var(--pos-accent)]" />}
                        {ddSearchQuery && !ddSearching && (
                            <button className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => { setDdSearchQuery(''); setDdSearchResults([]); setDdDropdownOpen(false); }}>
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        {ddDropdownOpen && ddSearchResults.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-[#D6D6D6] rounded-xl shadow-xl shadow-slate-200/50 max-h-80 overflow-y-auto">
                                {ddSearchResults.map((result, idx) => (
                                    <button
                                        key={`${result.type}-${result.accountId}-${idx}`}
                                        data-testid={`dd-result-${result.type}-${result.accountId}`}
                                        className="w-full text-left px-4 py-3 hover:bg-[#F7F7F7] border-b border-[#E5E5E5] last:border-b-0 flex items-center gap-3 transition-colors"
                                        onClick={() => handleSelectDDResult(result)}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            result.type === 'ACCOUNT' ? 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)]' :
                                            result.type === 'INSTITUTION' ? 'bg-indigo-50 text-indigo-600' :
                                            result.type === 'GROUP' ? 'bg-purple-50 text-purple-600' :
                                            result.type === 'CLEARANCE' ? 'bg-amber-50 text-amber-600' :
                                            'bg-emerald-50 text-emerald-600'
                                        }`}>
                                            {result.type === 'ACCOUNT' ? <Building2 className="w-3.5 h-3.5" /> :
                                             result.type === 'INSTITUTION' ? <Landmark className="w-3.5 h-3.5" /> :
                                             result.type === 'GROUP' ? <CreditCard className="w-3.5 h-3.5" /> :
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
                                            <span className="text-xs font-mono font-medium text-slate-500 shrink-0 bg-[#F7F7F7] px-2 py-1 rounded">
                                                R {result.outstandingAmount.toFixed(2)}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        {ddDropdownOpen && ddSearchResults.length === 0 && !ddSearching && ddSearchQuery.length >= 2 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-[#D6D6D6] rounded-xl shadow-xl shadow-slate-200/50 p-6 text-center">
                                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">No results found for "<span className="font-medium text-slate-600">{ddSearchQuery}</span>"</p>
                            </div>
                        )}
                    </div>
                </div>

                {selectedAccount && (
                    <div className="px-3 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-[var(--pos-accent-tint)] to-[#F7F7F7] border-b border-[#D6D6D6] animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
                            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                                    selectedAccount.allocationType === 'CLEARANCE' ? 'bg-amber-100 text-amber-700' :
                                    selectedAccount.allocationType === 'DIRECT' ? 'bg-emerald-100 text-emerald-700' :
                                    selectedAccount.allocationType === 'GROUP' ? 'bg-purple-100 text-purple-700' :
                                    'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)]'
                                }`}>
                                    {selectedAccount.allocationType === 'CLEARANCE' ? <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" /> :
                                     selectedAccount.allocationType === 'DIRECT' ? <Receipt className="w-4 h-4 sm:w-5 sm:h-5" /> :
                                     selectedAccount.allocationType === 'GROUP' ? <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" /> :
                                     <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs sm:text-sm font-semibold text-slate-800 break-words sm:truncate">{selectedAccount.name}</div>
                                    <div className="text-[11px] sm:text-xs text-slate-500 font-mono break-words sm:truncate">{selectedAccount.accountNo}</div>
                                </div>
                                <Button onClick={() => { setSelectedAccount(null); setNewLineAmount(''); }} size="icon" variant="ghost" className="h-11 w-11 sm:hidden text-slate-400 hover:text-slate-600 shrink-0 ml-auto">
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 sm:shrink-0">
                                <div className="relative flex-1 sm:w-36">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R</span>
                                    <HelpTip text="Enter the amount to allocate to this account. Cannot exceed the unallocated balance." side="top" className="absolute right-2 top-1/2 -translate-y-1/2 z-10" />
                                    <Input
                                        ref={inputRef}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="h-9 sm:h-10 pl-7 font-mono font-bold text-right bg-white border-[#D6D6D6] focus:border-[var(--pos-accent)] text-sm"
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
                                <Button onClick={handleAddLine} size="icon" className="h-9 sm:h-10 w-9 sm:w-10 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] rounded-lg shrink-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                                <Button onClick={() => { setSelectedAccount(null); setNewLineAmount(''); }} size="icon" variant="ghost" className="hidden sm:flex h-10 w-10 text-slate-400 hover:text-slate-600 shrink-0">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {loadingClearanceDetails && (
                    <div className="px-3 sm:px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50/30 border-b border-amber-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                            <div>
                                <div className="text-sm font-medium text-slate-700">Loading clearance details...</div>
                                <div className="text-xs text-slate-500">Fetching cost schedule and linked accounts</div>
                            </div>
                        </div>
                    </div>
                )}

                {loadingInstitution && (
                    <div className="px-3 sm:px-5 py-4 bg-gradient-to-r from-indigo-50 to-blue-50/30 border-b border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                            <div>
                                <div className="text-sm font-medium text-slate-700">Loading institution accounts...</div>
                                <div className="text-xs text-slate-500">Fetching linked accounts for this institution</div>
                            </div>
                        </div>
                    </div>
                )}

                {clearanceLoadError && !selectedClearance && !loadingClearanceDetails && (
                    <div className="px-3 sm:px-5 py-3 bg-red-50 border-b border-red-100 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-sm text-red-700">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{clearanceLoadError}</span>
                        </div>
                    </div>
                )}

                {selectedClearance && (() => {
                    const allItems118_1 = selectedClearance.section118_1_Breakdown;
                    const allItems118_3 = selectedClearance.section118_3_Breakdown;

                    const accountNosFromItems = new Set([
                        ...allItems118_1.map(i => i.accountNo),
                        ...allItems118_3.map(i => i.accountNo),
                    ]);
                    const linkedAccountNos = new Set(selectedClearance.linkedAccounts.map(a => a.accountNo));
                    const hasUnmatchedItems = [...accountNosFromItems].some(no => no && !linkedAccountNos.has(no));
                    const hasEmptyAccountItems = [...accountNosFromItems].some(no => !no);

                    const showByAccount = !hasUnmatchedItems && !hasEmptyAccountItems && selectedClearance.linkedAccounts.length > 0;

                    const allocTotal = Object.values(clearanceAllocations).reduce((a, b) => a + b, 0);
                    const clearanceRemaining = selectedClearance.totalDue - allocTotal;

                    const handleAutoFill = () => {
                        const newAlloc: Record<string, number> = {};
                        let budgetLeft = transaction ? Math.min(transaction.amount - allocatedTotal, selectedClearance.totalDue) : selectedClearance.totalDue;
                        allItems118_1.forEach((item, idx) => {
                            const key = `118_1_${item.accountNo}_${idx}`;
                            const fillAmt = Math.min(item.amount, budgetLeft);
                            if (fillAmt > 0) { newAlloc[key] = parseFloat(fillAmt.toFixed(2)); budgetLeft -= fillAmt; }
                        });
                        allItems118_3.forEach((item, idx) => {
                            const key = `118_3_${item.accountNo}_${idx}`;
                            const fillAmt = Math.min(item.amount, budgetLeft);
                            if (fillAmt > 0) { newAlloc[key] = parseFloat(fillAmt.toFixed(2)); budgetLeft -= fillAmt; }
                        });
                        setClearanceAllocations(newAlloc);
                    };

                    const renderItemRow = (item: { item: string; amount: number; accountNo: string }, idx: number, sectionPrefix: string) => {
                        const key = `${sectionPrefix}_${item.accountNo}_${idx}`;
                        return (
                            <div key={key} className="flex items-center gap-2 py-1" data-testid={`clearance-item-${key}`}>
                                <div className="flex-1 min-w-0">
                                    <span className="text-xs truncate block" title={item.item}>{item.item}</span>
                                    {item.accountNo && <span className="text-[10px] text-muted-foreground font-mono">{item.accountNo}</span>}
                                </div>
                                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap w-16 sm:w-24 text-right shrink-0" title="Outstanding amount">R {item.amount.toFixed(2)}</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={item.amount}
                                    className="h-9 sm:h-8 w-20 sm:w-28 text-right font-mono text-sm shrink-0"
                                    placeholder="0.00"
                                    value={clearanceAllocations[key] ?? ''}
                                    onChange={e => setClearanceAllocations(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                    data-testid={`input-${key}`}
                                />
                            </div>
                        );
                    };

                    return (
                    <div className="px-3 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-amber-50 to-orange-50/30 border-b border-amber-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                    <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 break-words" data-testid="clearance-schedule-no">{selectedClearance.scheduleNo}</div>
                                    <div className="text-xs text-slate-500">
                                        {selectedClearance.linkedAccounts.length} account{selectedClearance.linkedAccounts.length !== 1 ? 's' : ''} | Total Due: <span className="font-mono font-medium">R {selectedClearance.totalDue.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                                <Button size="sm" variant="outline" onClick={handleAutoFill} className="h-9 sm:h-8 text-xs text-amber-700 border-amber-200 hover:bg-amber-100 gap-1" data-testid="btn-auto-fill-clearance">
                                    <CheckCircle2 className="w-3 h-3" /> Auto-fill
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setSelectedClearance(null)} className="h-9 w-9 sm:h-8 sm:w-8 text-slate-400 hover:text-slate-600" data-testid="btn-close-clearance">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {selectedClearance.clearanceData && (
                            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-lg border border-amber-100/80 mb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5" data-testid="clearance-property-details">
                                <div>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Account</span>
                                    <div className="text-xs font-medium text-slate-700">{selectedClearance.clearanceData.accountName || '—'}</div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">SG Number</span>
                                    <div className="text-xs font-mono text-slate-700">{selectedClearance.clearanceData.sgNumber || '—'}</div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Address</span>
                                    <div className="text-xs text-slate-700 truncate" title={selectedClearance.clearanceData.locationAddress}>{selectedClearance.clearanceData.locationAddress || '—'}</div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Expiry Date</span>
                                    <div className="text-xs text-slate-700">{selectedClearance.clearanceData.expiryDate || '—'}</div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Paid</span>
                                    <div className="text-xs font-mono text-green-700">R {(selectedClearance.clearanceData.paid || 0).toFixed(2)}</div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Remaining</span>
                                    <div className="text-xs font-mono text-amber-700">R {(selectedClearance.clearanceData.remaining || 0).toFixed(2)}</div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {showByAccount ? (
                                selectedClearance.linkedAccounts.map(account => {
                                    const s118_1 = allItems118_1.filter(i => i.accountNo === account.accountNo);
                                    const s118_3 = allItems118_3.filter(i => i.accountNo === account.accountNo);
                                    if (s118_1.length === 0 && s118_3.length === 0) return null;
                                    return (
                                        <div key={account.accountNo} className="bg-white/70 backdrop-blur-sm p-3.5 rounded-lg border border-amber-100/80">
                                            <div className="text-sm font-medium mb-2.5 flex items-center gap-2">
                                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-mono">{account.accountNo}</span>
                                                <span className="text-slate-700">{account.name}</span>
                                                {account.outstandingAmount > 0 && <span className="text-[10px] text-muted-foreground ml-auto font-mono">Bal: R {account.outstandingAmount.toFixed(2)}</span>}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {s118_1.length > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Section 118(1)</label>
                                                            <span className="text-[10px] text-muted-foreground font-mono">Due</span>
                                                        </div>
                                                        {s118_1.map((item, idx) => renderItemRow(item, idx, '118_1'))}
                                                    </div>
                                                )}
                                                {s118_3.length > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Section 118(3)</label>
                                                            <span className="text-[10px] text-muted-foreground font-mono">Due</span>
                                                        </div>
                                                        {s118_3.map((item, idx) => renderItemRow(item, idx, '118_3'))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="bg-white/70 backdrop-blur-sm p-3.5 rounded-lg border border-amber-100/80">
                                    {selectedClearance.linkedAccounts.length > 0 && (
                                        <div className="mb-3">
                                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Linked Accounts</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedClearance.linkedAccounts.map(acc => (
                                                    <span key={acc.accountNo || acc.apiId} className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-mono">
                                                        {acc.accountNo} {acc.name ? `- ${acc.name}` : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {allItems118_1.length > 0 && (
                                        <div className="space-y-1 mb-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Section 118(1)</label>
                                                <span className="text-[10px] text-muted-foreground font-mono">Due / Allocate</span>
                                            </div>
                                            {allItems118_1.map((item, idx) => renderItemRow(item, idx, '118_1'))}
                                        </div>
                                    )}
                                    {allItems118_3.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Section 118(3)</label>
                                                <span className="text-[10px] text-muted-foreground font-mono">Due / Allocate</span>
                                            </div>
                                            {allItems118_3.map((item, idx) => renderItemRow(item, idx, '118_3'))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="mt-4 pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row sm:flex-wrap justify-between items-start sm:items-center gap-2">
                            <div className="text-sm flex items-center gap-3">
                                <div>
                                    <span className="text-muted-foreground">Allocated:</span>
                                    <span className={`ml-1.5 font-bold font-mono ${Math.abs(clearanceRemaining) < 0.01 ? 'text-green-700' : allocTotal > selectedClearance.totalDue ? 'text-red-600' : 'text-slate-800'}`} data-testid="clearance-alloc-total">
                                        R {allocTotal.toFixed(2)}
                                    </span>
                                </div>
                                {Math.abs(clearanceRemaining) >= 0.01 && (
                                    <div className="text-xs text-muted-foreground">
                                        Remaining: <span className="font-mono font-medium">R {clearanceRemaining.toFixed(2)}</span>
                                    </div>
                                )}
                                {Math.abs(clearanceRemaining) < 0.01 && allocTotal > 0 && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Fully matched</Badge>
                                )}
                            </div>
                            <Button onClick={handleAddClearanceLines} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 w-full sm:w-auto h-10 sm:h-9" data-testid="btn-add-clearance-lines">
                                <Plus className="w-4 h-4" /> Add Lines
                            </Button>
                        </div>
                    </div>
                    );
                })()}

                <div className="min-h-[280px] sm:min-h-[360px]">
                    {lines.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-6 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[#F2F4F7] flex items-center justify-center mb-4">
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
                                    <div key={line.id} className="px-3 py-3 hover:bg-[#F7F7F7]/50 transition-colors" data-testid={`mobile-line-card-${idx}`}>
                                        <div className="flex items-start gap-2.5 mb-2">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                                                line.allocationType === 'CASHBOOK' ? 'bg-orange-50 text-orange-600' :
                                                line.allocationType === 'CLEARANCE' ? 'bg-amber-50 text-amber-600' :
                                                line.allocationType === 'DIRECT' ? 'bg-emerald-50 text-emerald-600' :
                                                line.allocationType === 'GROUP' ? 'bg-purple-50 text-purple-600' :
                                                'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)]'
                                            }`}>
                                                {startIdx + idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-700 break-words leading-snug">{line.description || line.accountNo}</div>
                                                {line.allocationType === 'ACCOUNT' || line.allocationType === 'PREPAID' ? (
                                                    <button className="text-xs text-[var(--pos-accent-dark)] hover:underline cursor-pointer font-mono mt-0.5" onClick={() => setEnquiryAccountId(String(line.accountNo))} data-testid={`mobile-line-enquiry-${idx}`}>{line.accountNo}</button>
                                                ) : (
                                                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{line.accountNo}</div>
                                                )}
                                                <Badge variant="secondary" className={`text-[10px] font-medium mt-1 ${
                                                    line.allocationType === 'CASHBOOK' ? 'bg-orange-50 text-orange-700' :
                                                    line.allocationType === 'CLEARANCE' ? 'bg-amber-50 text-amber-700' :
                                                    line.allocationType === 'DIRECT' ? 'bg-emerald-50 text-emerald-700' :
                                                    line.allocationType === 'GROUP' ? 'bg-purple-50 text-purple-700' :
                                                    line.allocationType === 'PREPAID' ? 'bg-yellow-50 text-yellow-700' :
                                                    'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)]'
                                                }`}>
                                                    {line.allocationType === 'CASHBOOK' ? 'Return' :
                                                     line.allocationType === 'CLEARANCE' ? 'Clearance' :
                                                     line.allocationType === 'DIRECT' ? 'Income' :
                                                     line.allocationType === 'GROUP' ? 'Grouping' :
                                                     line.allocationType === 'PREPAID' ? 'Prepaid' : 'Account'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-[38px]">
                                            <div className="flex items-center gap-1 flex-1 min-w-0">
                                                <span className="text-xs text-muted-foreground shrink-0">R</span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="h-9 text-right font-mono text-sm font-semibold text-slate-800 px-2 flex-1"
                                                    value={line.amount}
                                                    onChange={(e) => handleUpdateLineAmount(line.id, e.target.value)}
                                                    data-testid={`input-mobile-amount-${idx}`}
                                                />
                                            </div>
                                            {(line.allocationType === 'ACCOUNT' || line.allocationType === 'PREPAID') && (
                                                <Button variant="outline" size="icon" className="h-9 w-9 text-[var(--pos-accent-dark)] border-[var(--pos-accent-light)] hover:bg-[var(--pos-accent-tint)] shrink-0 rounded-lg" onClick={() => setEnquiryAccountId(String(line.accountNo))} data-testid={`mobile-line-enquiry-btn-${idx}`}>
                                                    <Search className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0 rounded-lg" onClick={() => handleRemoveLine(line.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <table className="hidden sm:table w-full">
                                <thead>
                                    <tr className="border-b bg-[#F7F7F7]/50">
                                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3 w-8">#</th>
                                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Account</th>
                                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Description</th>
                                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Type</th>
                                        <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Amount</th>
                                        <th className="px-3 py-3 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E5E5E5]">
                                    {pageLines.map((line, idx) => (
                                        <tr key={line.id} className="hover:bg-[#F7F7F7]/50 transition-colors group">
                                            <td className="px-5 py-3">
                                                <span className="text-xs text-muted-foreground">{startIdx + idx + 1}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                {line.allocationType === 'ACCOUNT' || line.allocationType === 'PREPAID' ? (
                                                    <button className="font-mono text-sm text-[var(--pos-accent-dark)] hover:underline cursor-pointer font-medium" onClick={() => setEnquiryAccountId(String(line.accountNo))} data-testid={`link-line-enquiry-${idx}`}>{line.accountNo}</button>
                                                ) : (
                                                    <span className="font-mono text-sm text-slate-700">{line.accountNo}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-sm text-slate-500 truncate block max-w-[300px]">{line.description}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <Badge variant="secondary" className={`text-[10px] font-medium ${
                                                    line.allocationType === 'CASHBOOK' ? 'bg-orange-50 text-orange-700' :
                                                    line.allocationType === 'CLEARANCE' ? 'bg-amber-50 text-amber-700' :
                                                    line.allocationType === 'DIRECT' ? 'bg-emerald-50 text-emerald-700' :
                                                    line.allocationType === 'GROUP' ? 'bg-purple-50 text-purple-700' :
                                                    line.allocationType === 'PREPAID' ? 'bg-yellow-50 text-yellow-700' :
                                                    'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)]'
                                                }`}>
                                                    {line.allocationType === 'CASHBOOK' ? 'Return' :
                                                     line.allocationType === 'CLEARANCE' ? 'Clearance' :
                                                     line.allocationType === 'DIRECT' ? 'Income' :
                                                     line.allocationType === 'GROUP' ? 'Grouping' :
                                                     line.allocationType === 'PREPAID' ? 'Prepaid' : 'Account'}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <span className="text-xs text-muted-foreground">R</span>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="w-28 h-7 text-right font-mono text-sm font-semibold text-slate-800 px-2"
                                                        value={line.amount}
                                                        onChange={(e) => handleUpdateLineAmount(line.id, e.target.value)}
                                                        data-testid={`input-line-amount-${idx}`}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1 justify-end">
                                                    {(line.allocationType === 'ACCOUNT' || line.allocationType === 'PREPAID') && (
                                                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 text-[var(--pos-accent-dark)] border-[var(--pos-accent-light)] hover:bg-[var(--pos-accent-tint)] opacity-0 group-hover:opacity-100 transition-all" onClick={() => setEnquiryAccountId(String(line.accountNo))} data-testid={`button-line-enquiry-${idx}`}>
                                                            <Search className="w-3 h-3" />
                                                            Enquiry
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-lg" onClick={() => handleRemoveLine(line.id)}>
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-5 py-3 border-t bg-[#F7F7F7]/30">
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
                    <div className="flex px-3 sm:px-5 py-3 sm:py-4 border-t bg-[#F7F7F7] items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm">
                            <div>
                                <span className="text-muted-foreground">Allocated:</span>
                                <span className="ml-1 sm:ml-1.5 font-bold font-mono">R {allocatedTotal.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Remaining:</span>
                                <span className={`ml-1 sm:ml-1.5 font-bold font-mono ${Math.abs(remaining) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
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

        <div className="lg:hidden sticky bottom-0 z-10 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-4 py-3">
          {posting ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-[#2E2E2E]">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--pos-accent)]" />
                <span className="truncate flex-1">{postingStatus}</span>
                <span className="text-[11px] text-[#6B6B6B] font-mono">{postingStep}/{postingTotalSteps}</span>
              </div>
              <div className="h-2 bg-[#D6D6D6]/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--pos-accent)] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${postingTotalSteps > 0 ? Math.round((postingStep / postingTotalSteps) * 100) : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {remaining > 0.005 && (
                <Button variant="outline" size="sm" onClick={handleReturnToCashbook} className="text-orange-700 border-orange-200 hover:bg-orange-50 text-xs gap-1.5 h-11">
                  <RotateCcw className="w-3.5 h-3.5" /> Cashbook
                </Button>
              )}
              <Button
                className={`flex-1 h-11 text-sm font-medium gap-1.5 ${isFullyAllocated ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                disabled={!isFullyAllocated || posting}
                onClick={handlePost}
              >
                <CheckCircle className="w-4 h-4" />
                Post Allocation
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={csvDialogOpen} onOpenChange={(open) => { if (!csvProcessing) { if (!open) handleCsvDialogClose(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[85vh] h-[calc(100vh-2rem)] sm:h-auto overflow-hidden flex flex-col mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[var(--pos-accent)]" />
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
                  className="w-full max-w-md border-2 border-dashed border-[#D6D6D6] rounded-xl p-10 text-center cursor-pointer hover:border-[var(--pos-accent)] hover:bg-[var(--pos-accent-tint)] transition-all"
                  onClick={() => csvFileInputRef.current?.click()}
                  data-testid="csv-dropzone"
                >
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-sm font-medium text-slate-700 mb-1">Click to select a file</p>
                  <p className="text-xs text-muted-foreground">Supported formats: .csv, .txt, .xlsx, .xls</p>
                </div>
                <div className="mt-6 w-full max-w-md bg-[#F7F7F7] rounded-lg p-4 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-slate-600 text-sm mb-2">Expected file format:</p>
                  <p className="font-mono bg-white px-2 py-1 rounded border text-[11px]">AccountNumber, Amount</p>
                  <p className="font-mono bg-white px-2 py-1 rounded border text-[11px]">100234, 500.00</p>
                  <p className="font-mono bg-white px-2 py-1 rounded border text-[11px]">100567, 1200.50</p>
                  <p className="mt-2">Headers are auto-detected. CSV supports comma, semicolon, and tab delimiters. Excel files use the first sheet.</p>
                  <div className="mt-3 pt-3 border-t border-[#E5E5E5]">
                    <p className="font-medium text-slate-600 text-sm mb-2">Download template:</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleDownloadTemplate('xlsx')}
                        data-testid="button-download-template-xlsx"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Excel (.xlsx)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleDownloadTemplate('csv')}
                        data-testid="button-download-template-csv"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV (.csv)
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {csvStep === 'preview' && (
              <div className="space-y-3 p-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium text-slate-700">{csvParsedRows.length} row(s) from <span className="font-mono text-xs bg-[#F2F4F7] px-1.5 py-0.5 rounded">{csvFile?.name}</span></span>
                  <Button variant="ghost" size="sm" className="text-xs text-slate-500 gap-1" onClick={() => { setCsvStep('upload'); setCsvParsedRows([]); setCsvFile(null); }}>
                    <X className="w-3 h-3" /> Change file
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F7F7F7] border-b">
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
                          <tr key={start + idx} className="hover:bg-[#F7F7F7]/50">
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
                <div className="bg-[var(--pos-accent-tint)] rounded-lg p-3 flex items-center gap-2 text-xs text-[#6B6B6B]">
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
                    <div className="bg-[var(--pos-accent-tint)] rounded-lg p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Looking up accounts... {done} / {total}</span>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={handleCsvCancelLookup} data-testid="button-cancel-lookup">
                          <X className="w-3 h-3" /> Stop
                        </Button>
                      </div>
                      <div className="w-full bg-[#D6D6D6]/30 rounded-full h-3 overflow-hidden">
                        <div className="bg-[var(--pos-accent)] h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-right text-xs font-semibold text-[#6B6B6B]">{pct}%</div>
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
                      <tr className="bg-[#F7F7F7] border-b">
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
                              {row.status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--pos-accent)] mx-auto" />}
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
                <Button onClick={handleCsvLookup} className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] gap-1.5">
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
      <AccountEnquiryDialog
          open={enquiryAccountId !== null}
          onClose={() => setEnquiryAccountId(null)}
          accountId={enquiryAccountId || ''}
      />
    </PosLayout>
  );
}
