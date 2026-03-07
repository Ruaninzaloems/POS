import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, AlertCircle, CheckCircle2, Search, RefreshCw, ChevronLeft, Edit2, Save, X, Loader2, FileCheck, Send, ArrowRight, AlertTriangle, Eye, Link2, Unlink, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { HelpTip } from '@/components/ui/help-tip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  platinumThirdPartyPaymentTypes,
  platinumThirdPartyImportFile,
  platinumThirdPartyGetTransactions,
  platinumThirdPartyUpdateTransaction,
  platinumThirdPartyValidateForReconcile,
  platinumThirdPartyCommit,
  platinumThirdPartyAccountSearch,
  platinumThirdPartyValidateAccount,
  platinumThirdPartyCashierDetails,
  fetchBatchAccountNames,
  fetchCashOffices,
  submitGenericImport,
  validateGenericImport,
  fetchGenericImportStatus,
  fetchGenericImportResults,
  fetchGenericImportErrors,
} from '@/lib/external-api';
import { usePos } from '@/lib/pos-state';
import { useToast } from '@/hooks/use-toast';

interface ThirdPartyType {
  id: number;
  name: string;
  description?: string;
}

type MatchStatus = 'Auto-Matched' | 'Manually Matched' | 'Needs Review' | 'Unmatched' | 'Pending';
type FilterTab = 'all' | 'auto-matched' | 'needs-review' | 'unmatched' | 'ready';

interface ImportTransaction {
  index: number;
  importedAccountNumber: string;
  importedReference: string;
  resolvedAccountId: string;
  resolvedAccountNumber: string;
  matchStatus: MatchStatus;
  validated: boolean;
  validationMessage: string;
  documentNumber?: string;
  amount: number;
  comment?: string;
  status: string;
  isDuplicate?: boolean;
  ownerName?: string;
  propertyAddress?: string;
}

type Step = 'import' | 'transactions' | 'committed';

function parseApiErrorMessage(rawMsg: string): string {
  try {
    const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const detail = parsed.detail || parsed.message || '';
      return typeof detail === 'string' ? detail.replace(/^["']|["']$/g, '').trim() : rawMsg;
    }
  } catch (err) { console.error('[PaymentProcessing] Failed to parse API error message:', err); }
  return rawMsg;
}

function matchStatusBadge(status: MatchStatus) {
  switch (status) {
    case 'Auto-Matched':
      return <Badge className="text-[10px] bg-green-100 text-green-800 hover:bg-green-100" data-testid="badge-auto-matched">Auto-Matched</Badge>;
    case 'Manually Matched':
      return <Badge className="text-[10px] bg-[var(--pos-accent-tint)] text-[#6B6B6B] hover:bg-[var(--pos-accent-tint)]" data-testid="badge-manually-matched">Manually Matched</Badge>;
    case 'Needs Review':
      return <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100" data-testid="badge-needs-review">Needs Review</Badge>;
    case 'Unmatched':
      return <Badge variant="destructive" className="text-[10px]" data-testid="badge-unmatched">Unmatched</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]" data-testid="badge-pending">Pending</Badge>;
  }
}

type PageTab = 'third-party' | 'generic-import';

type GenericStep = 'upload' | 'preview' | 'processing' | 'results';

interface GenericPreviewRow {
  rowNum: number;
  accountNumber: string;
  amount: number;
  receiptDate: string;
  paymentTypeId: number;
  ownerName?: string;
  address?: string;
  isValid: boolean;
  validationStatus?: 'valid' | 'unverified' | 'invalid';
  validationMsg?: string;
  isDuplicate?: boolean;
}

interface GenericImportResult {
  accountNo?: string;
  accountName?: string;
  allocatedAmount?: number;
  status?: string;
  errorMessage?: string;
  [key: string]: any;
}

export default function ThirdPartyPaymentProcessing() {
  const posState = usePos();
  const { toast } = useToast();
  const [pageTab, setPageTab] = useState<PageTab>('third-party');
  const [step, setStep] = useState<Step>('import');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const [giStep, setGiStep] = useState<GenericStep>('upload');
  const [giFile, setGiFile] = useState<File | null>(null);
  const [giPaymentRef, setGiPaymentRef] = useState('');
  const [giReceiptDate, setGiReceiptDate] = useState(() => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(now);
  });
  const [giPaymentTypeId, setGiPaymentTypeId] = useState('5');
  const [giPostToCashbook, setGiPostToCashbook] = useState(true);
  const [giSubmitting, setGiSubmitting] = useState(false);
  const [giJobId, setGiJobId] = useState<string>('');
  const [giStatus, setGiStatus] = useState<any>(null);
  const [giPolling, setGiPolling] = useState(false);
  const [giResults, setGiResults] = useState<GenericImportResult[]>([]);
  const [giErrors, setGiErrors] = useState<GenericImportResult[]>([]);
  const [giLoadingResults, setGiLoadingResults] = useState(false);
  const [giError, setGiError] = useState<string>('');
  const [giPreviewRows, setGiPreviewRows] = useState<GenericPreviewRow[]>([]);
  const [giPreviewSkipped, setGiPreviewSkipped] = useState<string[]>([]);
  const [giPreviewLoading, setGiPreviewLoading] = useState(false);
  const [giDragOver, setGiDragOver] = useState(false);
  const giFileInputRef = useRef<HTMLInputElement>(null);
  const [giCashOffices, setGiCashOffices] = useState<Array<{ id: string; name: string }>>([]);
  const [giSelectedCashOfficeId, setGiSelectedCashOfficeId] = useState<string>('');
  const [giLoadingCashOffices, setGiLoadingCashOffices] = useState(false);
  const [giValidationProgress, setGiValidationProgress] = useState<{
    phase: 'parsing' | 'validating' | 'building' | 'done';
    percent: number;
    detail: string;
    validatedCount: number;
    totalCount: number;
    validCount: number;
    invalidCount: number;
  } | null>(null);
  const giPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (giPollRef.current) {
        clearInterval(giPollRef.current);
        giPollRef.current = null;
      }
    };
  }, []);

  const [thirdPartyTypes, setThirdPartyTypes] = useState<ThirdPartyType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined);
  const [paymentRef, setPaymentRef] = useState("");
  const [cashBookId, setCashBookId] = useState("0");
  const [cashierInfo, setCashierInfo] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{success: boolean; message: string} | null>(null);

  const [importId, setImportId] = useState<string>("");
  const [transactions, setTransactions] = useState<ImportTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editAccountNo, setEditAccountNo] = useState("");
  const [editComment, setEditComment] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIdx, setSearchIdx] = useState<number | null>(null);
  const [searchAccountNo, setSearchAccountNo] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchStreet, setSearchStreet] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewTxn, setViewTxn] = useState<ImportTransaction | null>(null);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);

  const [loadProgress, setLoadProgress] = useState({ step: '', percent: 0 });

  useEffect(() => {
    loadThirdPartyTypes();
  }, []);

  useEffect(() => {
    const userId = posState?.platinumUser?.user_ID;
    const finYear = posState?.platinumUser?.finYear;
    if (!userId || !finYear) return;
    platinumThirdPartyCashierDetails(userId, finYear)
      .then((details) => {
        if (details && !details._error) {
          setCashierInfo(details);
          if (details.cashOfficeId) {
            setCashBookId(String(details.cashOfficeId));
            setGiSelectedCashOfficeId(String(details.cashOfficeId));
          }
        }
      })
      .catch((e) => console.error('Failed to load cashier details:', e));

    setGiLoadingCashOffices(true);
    fetchCashOffices()
      .then((offices) => {
        if (Array.isArray(offices) && offices.length > 0) {
          setGiCashOffices(offices.map(o => ({ id: o.id, name: o.name })));
        }
      })
      .catch((e) => console.error('Failed to load cash offices:', e))
      .finally(() => setGiLoadingCashOffices(false));
  }, [posState?.platinumUser?.user_ID]);

  const loadThirdPartyTypes = async () => {
    setLoadingTypes(true);
    try {
      const types = await platinumThirdPartyPaymentTypes();
      if (Array.isArray(types)) {
        setThirdPartyTypes(types.map((t: any) => ({
          id: t.thirdPartyTypeId ?? t.id,
          name: t.description ?? t.name ?? '',
          description: t.description ?? '',
        })));
      }
    } catch (e) {
      console.error('Failed to load third party types:', e);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedTypeId || selectedTypeId === '' || !file) {
      setProcessResult({ success: false, message: "Please select a third party type and upload a file." });
      return;
    }

    setIsProcessing(true);
    setProcessResult(null);

    try {
      const fileContent = await file.text();
      const result = await platinumThirdPartyImportFile({
        ContentType: file.type || 'text/plain',
        FileName: file.name,
        Name: file.name,
        Length: file.size,
        thirdpartyTypeId: Number(selectedTypeId),
        paymentReference: paymentRef,
        cashBookId: Number(cashBookId),
        fileContent,
      });

      if (result && !result._error) {
        const id = result.importId || result.id || result;
        setImportId(String(id));
        setProcessResult({
          success: true,
          message: `Successfully imported file '${file.name}'. ${typeof id === 'string' || typeof id === 'number' ? `Import ID: ${id}` : ''}`
        });
        if (id) {
          setStep('transactions');
          loadTransactions(String(id));
        }
      } else {
        const detail = result?.detail || result?.message || '';
        const cleanMsg = typeof detail === 'string' ? detail.replace(/^["']|["']$/g, '').trim() : detail;
        setProcessResult({
          success: false,
          message: cleanMsg || 'Import failed. Please check the file format and try again.'
        });
      }
    } catch (e: any) {
      const errMsg = parseApiErrorMessage(e.message || 'Import failed.');
      setProcessResult({ success: false, message: errMsg });
    } finally {
      setIsProcessing(false);
    }
  };

  const lookupCurrentAccounts = async (accountNumbers: string[]): Promise<Map<string, { accountNumber: string; accountId: string; ownerName: string; propertyAddress: string; matchCount: number }>> => {
    const mapping = new Map<string, { accountNumber: string; accountId: string; ownerName: string; propertyAddress: string; matchCount: number }>();
    const unique = Array.from(new Set(accountNumbers.filter(a => a.length > 0)));
    if (unique.length === 0) return mapping;
    const batchSize = 10;
    const totalBatches = Math.ceil(unique.length / batchSize);
    for (let i = 0; i < unique.length; i += batchSize) {
      const batchNum = Math.floor(i / batchSize) + 1;
      const processed = Math.min(i + batchSize, unique.length);
      setLoadProgress({ step: `Resolving consumer accounts (${processed}/${unique.length})...`, percent: 50 + Math.round((batchNum / totalBatches) * 45) });
      const batch = unique.slice(i, i + batchSize);
      const lookups = batch.map(async (accNo) => {
        try {
          const results = await platinumThirdPartyAccountSearch({ accountNo: accNo });
          if (Array.isArray(results) && results.length > 0) {
            const result = results[0];
            mapping.set(accNo, {
              accountNumber: result.accountNumber || '',
              accountId: result.accountId || '',
              ownerName: result.ownerName || '',
              propertyAddress: result.propertyAddress || '',
              matchCount: results.length,
            });
          }
        } catch (e) {
          console.warn(`Account lookup failed for ${accNo}:`, e);
        }
      });
      await Promise.all(lookups);
    }
    return mapping;
  };

  const loadTransactions = async (id?: string) => {
    const useId = id || importId;
    if (!useId) return;
    setLoadingTxns(true);
    setLoadProgress({ step: 'Fetching transactions from server...', percent: 5 });
    try {
      const txns = await platinumThirdPartyGetTransactions(useId);
      if (Array.isArray(txns)) {
        setLoadProgress({ step: `Loaded ${txns.length} transaction(s). Resolving consumer accounts...`, percent: 20 });
        const fileAccounts: string[] = [];
        txns.forEach((t: any) => {
          const primary = t.oldAccountNumber || t.accountNumber || t.accountNo || '';
          if (primary) fileAccounts.push(primary);
          const ref = t.reference || t.paymentReference || '';
          if (ref && ref !== primary && /^\d{5,}$/.test(ref.trim())) {
            fileAccounts.push(ref.trim());
          }
        });
        const migrationMap = await lookupCurrentAccounts(fileAccounts);

        const migratedEntries: { index: number; oldAcct: string; newAcct: string }[] = [];
        const builtTxns: ImportTransaction[] = txns.map((t: any, i: number) => {
          const importedAcct = t.oldAccountNumber || t.accountNumber || t.accountNo || '';
          const apiNewAcct = t.newAccountNumber || '';
          const ref = (t.reference || t.paymentReference || '').trim();
          let lookupResult = migrationMap.get(importedAcct);
          if (!lookupResult && ref && ref !== importedAcct && /^\d{5,}$/.test(ref)) {
            lookupResult = migrationMap.get(ref);
          }
          const idx = t.index ?? i;

          let resolvedAccountId = '';
          let resolvedAccountNumber = '';
          let matchStatus: MatchStatus = 'Pending';
          let validated = false;
          let validationMessage = '';

          if (lookupResult) {
            resolvedAccountId = lookupResult.accountId || lookupResult.accountNumber || '';
            resolvedAccountNumber = lookupResult.accountNumber || '';

            if (lookupResult.matchCount === 1) {
              matchStatus = 'Auto-Matched';
              validated = true;
              validationMessage = importedAcct !== resolvedAccountId
                ? `Old account "${importedAcct}" resolved to current account "${resolvedAccountId}"`
                : 'Exact match found';
            } else if (lookupResult.matchCount > 1) {
              matchStatus = 'Needs Review';
              validated = false;
              validationMessage = `${lookupResult.matchCount} possible matches found — please verify`;
            }
          } else if (apiNewAcct) {
            resolvedAccountId = apiNewAcct;
            resolvedAccountNumber = apiNewAcct;
            matchStatus = 'Auto-Matched';
            validated = true;
            validationMessage = 'Matched via server lookup';
          } else {
            matchStatus = 'Unmatched';
            validated = false;
            validationMessage = 'No matching account found in the system';
          }

          const mismatch = importedAcct !== '' && resolvedAccountId !== '' && importedAcct !== resolvedAccountId;
          if (mismatch && !apiNewAcct && matchStatus === 'Auto-Matched') {
            migratedEntries.push({ index: idx, oldAcct: importedAcct, newAcct: resolvedAccountId });
          }

          return {
            index: idx,
            importedAccountNumber: importedAcct,
            importedReference: t.documentNumber || t.reference || t.paymentReference || '',
            resolvedAccountId,
            resolvedAccountNumber,
            matchStatus,
            validated,
            validationMessage,
            documentNumber: t.documentNumber || '',
            amount: t.amount || 0,
            comment: mismatch ? `Auto-matched: Old "${importedAcct}" → New "${resolvedAccountId}"` : (t.comment || ''),
            status: t.status || (mismatch ? 'Account Updated' : 'Pending'),
            isDuplicate: t.isDuplicate || false,
            ownerName: lookupResult?.ownerName || t.ownerName || t.name || '',
            propertyAddress: lookupResult?.propertyAddress || t.propertyAddress || t.address || '',
          };
        });

        setTransactions(builtTxns);

        const needsNameLookup = builtTxns.filter(t => !t.ownerName && (t.resolvedAccountId || t.importedAccountNumber));
        if (needsNameLookup.length > 0) {
          const accNos = [...new Set(needsNameLookup.map(t => t.resolvedAccountId || t.importedAccountNumber).filter(Boolean))];
          fetchBatchAccountNames(accNos).then((nameMap) => {
            console.log(`[ThirdParty] Batch name lookup resolved ${Object.keys(nameMap).length}/${accNos.length} names`);
            setTransactions(prev => prev.map(txn => {
              const key = txn.resolvedAccountId || txn.importedAccountNumber;
              const found = nameMap[key];
              if (found && (found.name || found.address)) {
                return {
                  ...txn,
                  ownerName: found.name || txn.ownerName,
                  propertyAddress: found.address || txn.propertyAddress,
                };
              }
              return txn;
            }));
          }).catch(e => console.warn('[ThirdParty] Batch name lookup failed:', e));
        }

        if (migratedEntries.length > 0) {
          setLoadProgress({ step: `Auto-updating ${migratedEntries.length} migrated account(s) on server...`, percent: 96 });
          const updateBatchSize = 5;
          for (let i = 0; i < migratedEntries.length; i += updateBatchSize) {
            const batch = migratedEntries.slice(i, i + updateBatchSize);
            const updates = batch.map(entry =>
              platinumThirdPartyUpdateTransaction(useId, entry.index, {
                newAccountNumber: entry.newAcct,
                comment: `Auto-matched: Old "${entry.oldAcct}" → New "${entry.newAcct}"`,
              }).catch(e => console.warn(`Auto-update failed for index ${entry.index}:`, e))
            );
            await Promise.all(updates);
            const done = Math.min(i + updateBatchSize, migratedEntries.length);
            setLoadProgress({ step: `Auto-updating migrated accounts (${done}/${migratedEntries.length})...`, percent: 96 + Math.round((done / migratedEntries.length) * 4) });
          }
        }

        setLoadProgress({ step: 'Done', percent: 100 });
      }
    } catch (e: any) {
      console.error('Failed to load transactions:', e);
      setLoadProgress({ step: 'Failed to load transactions', percent: 0 });
    } finally {
      setLoadingTxns(false);
    }
  };

  const handleStartEdit = (txn: ImportTransaction) => {
    setEditingIdx(txn.index);
    setEditAccountNo(txn.resolvedAccountId || txn.importedAccountNumber);
    setEditComment(txn.comment || '');
  };

  const handleSaveEdit = async () => {
    if (editingIdx === null) return;
    setSavingEdit(true);
    try {
      await platinumThirdPartyUpdateTransaction(importId, editingIdx, {
        newAccountNumber: editAccountNo,
        comment: editComment,
      });
      setTransactions(prev => prev.map(txn => {
        if (txn.index !== editingIdx) return txn;
        return {
          ...txn,
          resolvedAccountId: editAccountNo,
          resolvedAccountNumber: editAccountNo,
          comment: editComment,
          matchStatus: 'Manually Matched' as MatchStatus,
          validated: true,
          validationMessage: 'Manually linked by user',
          status: 'Account Updated',
        };
      }));
      setEditingIdx(null);
    } catch (e: any) {
      console.error('Failed to update transaction:', e);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
  };

  const handleClearLink = (txnIndex: number) => {
    setTransactions(prev => prev.map(txn => {
      if (txn.index !== txnIndex) return txn;
      return {
        ...txn,
        resolvedAccountId: '',
        resolvedAccountNumber: '',
        matchStatus: 'Unmatched' as MatchStatus,
        validated: false,
        validationMessage: 'Link cleared by user',
        comment: 'Link cleared — needs re-assignment',
      };
    }));
    if (importId) {
      platinumThirdPartyUpdateTransaction(importId, txnIndex, {
        newAccountNumber: '',
        comment: 'Link cleared — needs re-assignment',
      }).catch(e => console.warn('Failed to clear link on server:', e));
    }
  };

  const openAccountSearch = (txnIndex: number) => {
    const txn = transactions.find(t => t.index === txnIndex);
    setSearchIdx(txnIndex);
    setSearchAccountNo(txn?.importedAccountNumber || "");
    setSearchName("");
    setSearchStreet("");
    setSearchResults([]);
    setSearchOpen(true);
  };

  const handleAccountSearch = async () => {
    setSearching(true);
    try {
      const results = await platinumThirdPartyAccountSearch({
        accountNo: searchAccountNo || undefined,
        name: searchName || undefined,
        street: searchStreet || undefined,
      });
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (e: any) {
      console.error('Account search failed:', e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectAccount = async (account: any) => {
    const accNo = account.accountNumber || account.accountNo || account.account_Number || '';
    const accId = account.accountId || accNo;
    const ownerName = account.ownerName || account.name || account.owner || '';
    const propertyAddress = account.propertyAddress || account.address || account.street || '';
    const serverAcct = accId || accNo;
    if (searchIdx !== null && importId) {
      setSearchOpen(false);
      setSavingEdit(true);
      try {
        await platinumThirdPartyUpdateTransaction(importId, searchIdx, {
          newAccountNumber: serverAcct,
          comment: `Manually linked to account ${serverAcct} (${ownerName})`,
        });
        setTransactions(prev => prev.map(txn => {
          if (txn.index !== searchIdx) return txn;
          return {
            ...txn,
            resolvedAccountId: accId,
            resolvedAccountNumber: accNo,
            comment: `Manually linked to account ${accNo}`,
            ownerName: ownerName || txn.ownerName,
            propertyAddress: propertyAddress || txn.propertyAddress,
            matchStatus: 'Manually Matched' as MatchStatus,
            validated: true,
            validationMessage: 'Manually linked by user',
            status: 'Account Updated',
          };
        }));
      } catch (e: any) {
        console.error('Failed to update transaction after search:', e);
      } finally {
        setSavingEdit(false);
        setEditingIdx(null);
      }
    } else {
      setSearchOpen(false);
    }
  };

  const handleViewAccount = (txn: ImportTransaction) => {
    setViewTxn(txn);
    setViewOpen(true);
  };

  const handleValidateForReconcile = async () => {
    if (!importId) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await platinumThirdPartyValidateForReconcile(importId);
      setValidationResult(result);
      await loadTransactions();
    } catch (e: any) {
      setValidationResult({ error: true, message: e.message });
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!importId) return;
    const unvalidatedCount = transactions.filter(t => !t.validated).length;
    if (unvalidatedCount > 0) {
      setCommitResult({ error: true, message: `Cannot commit: ${unvalidatedCount} transaction(s) are not validated. Please resolve all Unmatched and Needs Review items first.` });
      return;
    }
    setCommitting(true);
    setCommitResult(null);
    try {
      const selectedType = thirdPartyTypes.find(t => String(t.id) === selectedTypeId);
      const userId = posState?.platinumUser?.user_ID || 0;
      const finYear = posState?.platinumUser?.finYear;
      if (!finYear) {
        toast({ title: 'Session Error', description: 'Financial year missing from your session. Please log in again.', variant: 'destructive' });
        setCommitting(false);
        return;
      }
      const result = await platinumThirdPartyCommit(importId, {
        groupId: selectedType?.id || Number(selectedTypeId) || 0,
        cashBookId: Number(cashBookId),
        paymentReference: paymentRef,
        fileName: file?.name || '',
        userId,
        finYear,
      });
      setCommitResult(result);
      if (result && !result._error && !result.error) {
        setStep('committed');
      }
    } catch (e: any) {
      setCommitResult({ error: true, message: e.message });
    } finally {
      setCommitting(false);
    }
  };

  const handleNewImport = () => {
    setStep('import');
    setImportId("");
    setTransactions([]);
    setFile(null);
    setPaymentRef("");
    setSelectedTypeId(undefined);
    setProcessResult(null);
    setValidationResult(null);
    setCommitResult(null);
    setActiveFilter('all');
  };

  const parseCsvLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const parseGenericImportCsv = (csvText: string, defaultReceiptDate: string, defaultPaymentTypeId: number): Array<{ receiptDate: string; accountNumber: string; amount: number; paymentTypeId: number }> => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

    const header = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const accIdx = header.findIndex(h => h === 'accountnumber' || h === 'accountno' || h === 'account');
    const amtIdx = header.findIndex(h => h === 'amount' || h === 'amt');
    const dateIdx = header.findIndex(h => h === 'receiptdate' || h === 'date');
    const ptIdx = header.findIndex(h => h === 'paymenttypeid' || h === 'paymenttype' || h === 'paytype');

    if (accIdx === -1) throw new Error('CSV missing required column: AccountNumber');
    if (amtIdx === -1) throw new Error('CSV missing required column: Amount');

    const formatDateDDMMYYYY = (dateStr: string): string => {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return defaultReceiptDate;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const skippedRows: string[] = [];
    const payments: Array<{ receiptDate: string; accountNumber: string; amount: number; paymentTypeId: number }> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const rawAcc = cols[accIdx] || '';
      const rawAmt = cols[amtIdx] || '';
      if (!rawAcc || !rawAmt) { skippedRows.push(`Row ${i + 1}: empty account or amount`); continue; }

      const digits = rawAcc.replace(/\D/g, '');
      if (digits.length === 0 || digits.length > 12) { skippedRows.push(`Row ${i + 1}: invalid account number "${rawAcc}"`); continue; }

      const amount = parseFloat(rawAmt.replace(/[^0-9.\-]/g, ''));
      if (isNaN(amount) || amount <= 0) { skippedRows.push(`Row ${i + 1}: invalid amount "${rawAmt}"`); continue; }

      const receiptDate = dateIdx !== -1 && cols[dateIdx] ? formatDateDDMMYYYY(cols[dateIdx]) : defaultReceiptDate;
      const paymentTypeId = ptIdx !== -1 && cols[ptIdx] ? (parseInt(cols[ptIdx]) || defaultPaymentTypeId) : defaultPaymentTypeId;

      payments.push({
        receiptDate,
        accountNumber: digits.padStart(12, '0'),
        amount,
        paymentTypeId,
      });
    }
    if (skippedRows.length > 0) {
      console.warn(`[GenericImport] Skipped ${skippedRows.length} row(s):`, skippedRows.slice(0, 10).join('; '));
    }
    return payments;
  };

  const handlePreviewFile = async () => {
    if (!giFile) return;
    setGiPreviewLoading(true);
    setGiError('');
    setGiPreviewRows([]);
    setGiPreviewSkipped([]);
    setGiValidationProgress({ phase: 'parsing', percent: 0, detail: 'Reading CSV file...', validatedCount: 0, totalCount: 0, validCount: 0, invalidCount: 0 });

    try {
      await new Promise(r => setTimeout(r, 300));
      const fileContent = await giFile.text();
      const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

      setGiValidationProgress(p => p ? { ...p, percent: 5, detail: `Read ${lines.length - 1} data rows from file` } : p);

      if (lines.length < 2) {
        setGiError('CSV must have a header row and at least one data row.');
        setGiPreviewLoading(false);
        setGiValidationProgress(null);
        return;
      }

      const header = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const accIdx = header.findIndex(h => h === 'accountnumber' || h === 'accountno' || h === 'account');
      const amtIdx = header.findIndex(h => h === 'amount' || h === 'amt');
      const dateIdx = header.findIndex(h => h === 'receiptdate' || h === 'date');
      const ptIdx = header.findIndex(h => h === 'paymenttypeid' || h === 'paymenttype' || h === 'paytype');

      if (accIdx === -1) { setGiError('CSV missing required column: AccountNumber'); setGiPreviewLoading(false); setGiValidationProgress(null); return; }
      if (amtIdx === -1) { setGiError('CSV missing required column: Amount'); setGiPreviewLoading(false); setGiValidationProgress(null); return; }

      setGiValidationProgress(p => p ? { ...p, percent: 10, detail: 'Parsing rows and formatting data...' } : p);
      await new Promise(r => setTimeout(r, 200));

      const defaultDateParts = giReceiptDate ? giReceiptDate.split('-') : [];
      const defaultReceiptDate = defaultDateParts.length === 3
        ? `${defaultDateParts[2]}/${defaultDateParts[1]}/${defaultDateParts[0]}`
        : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
      const defaultPaymentTypeId = Number(giPaymentTypeId) || 5;

      const formatDateDDMMYYYY = (dateStr: string): string => {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return defaultReceiptDate;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      };

      const parsedRows: Array<{ rowNum: number; accountNumber: string; amount: number; receiptDate: string; paymentTypeId: number }> = [];
      const skipped: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const rawAcc = cols[accIdx] || '';
        const rawAmt = cols[amtIdx] || '';

        if (!rawAcc && !rawAmt) {
          skipped.push(`Row ${i + 1}: completely empty row`);
          continue;
        }

        const digits = rawAcc.replace(/\D/g, '');
        const amount = parseFloat((rawAmt || '0').replace(/[^0-9.\-]/g, ''));
        const receiptDate = dateIdx !== -1 && cols[dateIdx] ? formatDateDDMMYYYY(cols[dateIdx]) : defaultReceiptDate;
        const paymentTypeId = ptIdx !== -1 && cols[ptIdx] ? (parseInt(cols[ptIdx]) || defaultPaymentTypeId) : defaultPaymentTypeId;

        parsedRows.push({
          rowNum: i + 1,
          accountNumber: digits.length > 0 ? digits.padStart(12, '0') : rawAcc,
          amount: isNaN(amount) ? 0 : amount,
          receiptDate,
          paymentTypeId,
        });
      }

      setGiPreviewSkipped(skipped);

      if (parsedRows.length === 0) {
        setGiError('No data rows found in CSV. Check the file format.');
        setGiPreviewLoading(false);
        setGiValidationProgress(null);
        return;
      }


      const uniqueAccounts = new Set(parsedRows.map(r => r.accountNumber).filter(a => /^\d{12}$/.test(a)));
      setGiValidationProgress({
        phase: 'validating',
        percent: 15,
        detail: `Validating ${uniqueAccounts.size} unique accounts against Platinum API...`,
        validatedCount: 0,
        totalCount: parsedRows.length,
        validCount: 0,
        invalidCount: 0,
      });

      const BATCH_SIZE = 50;
      const allResults: any[] = [];
      const allDuplicates: string[] = [];

      for (let batchStart = 0; batchStart < parsedRows.length; batchStart += BATCH_SIZE) {
        const batch = parsedRows.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(parsedRows.length / BATCH_SIZE);
        const batchEnd = Math.min(batchStart + BATCH_SIZE, parsedRows.length);

        setGiValidationProgress(p => p ? {
          ...p,
          phase: 'validating',
          percent: 15 + Math.round((batchStart / parsedRows.length) * 70),
          detail: `Batch ${batchNum}/${totalBatches} — Validating rows ${batchStart + 1}–${batchEnd} against Platinum API...`,
          validatedCount: batchStart,
        } : p);

        const validation = await validateGenericImport(batch);

        if (validation._error || !validation.results) {
          setGiError(validation.detail || validation.message || `API validation failed on batch ${batchNum}. Please try again.`);
          setGiPreviewLoading(false);
          setGiValidationProgress(null);
          return;
        }

        allResults.push(...validation.results);
        if (validation.duplicates) allDuplicates.push(...validation.duplicates);

        const batchValid = validation.results.filter((r: any) => r.isValid).length;
        const batchInvalid = validation.results.filter((r: any) => !r.isValid).length;

        setGiValidationProgress(p => p ? {
          ...p,
          percent: 15 + Math.round((batchEnd / parsedRows.length) * 70),
          detail: `Batch ${batchNum}/${totalBatches} complete — ${batchValid} matched, ${batchInvalid} invalid`,
          validatedCount: batchEnd,
          validCount: (p.validCount || 0) + batchValid,
          invalidCount: (p.invalidCount || 0) + batchInvalid,
        } : p);

        if (batchStart + BATCH_SIZE < parsedRows.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      setGiValidationProgress(p => p ? { ...p, phase: 'building', percent: 90, detail: 'Building preview table...' } : p);
      await new Promise(r => setTimeout(r, 200));

      const globalDuplicateCheck: Record<string, number[]> = {};
      allResults.forEach((r: any, idx: number) => {
        const acc = r.accountNumber;
        if (!globalDuplicateCheck[acc]) globalDuplicateCheck[acc] = [];
        globalDuplicateCheck[acc].push(idx);
      });

      const previewRows: GenericPreviewRow[] = allResults.map((r: any, idx: number) => {
        const isDup = r.isDuplicate || (globalDuplicateCheck[r.accountNumber]?.length > 1);
        return {
          rowNum: r.rowNum,
          accountNumber: r.accountNumber,
          amount: r.amount,
          receiptDate: r.receiptDate,
          paymentTypeId: r.paymentTypeId,
          ownerName: r.ownerName || '',
          address: r.address || '',
          isValid: r.isValid,
          validationStatus: r.validationStatus || (r.isValid ? 'valid' : 'invalid'),
          validationMsg: isDup && r.isValid ? (r.validationMsg ? r.validationMsg + '; Duplicate account' : 'Duplicate account in file') : (r.validationMsg || ''),
          isDuplicate: isDup,
        };
      });

      const validCount = previewRows.filter(r => r.isValid).length;
      const invalidCount = previewRows.filter(r => !r.isValid).length;
      const dupCount = previewRows.filter(r => r.isDuplicate).length;

      setGiValidationProgress({
        phase: 'done',
        percent: 100,
        detail: `Complete — ${validCount} matched, ${invalidCount} invalid${dupCount > 0 ? `, ${dupCount} duplicates` : ''}`,
        validatedCount: parsedRows.length,
        totalCount: parsedRows.length,
        validCount,
        invalidCount,
      });

      await new Promise(r => setTimeout(r, 600));

      setGiPreviewRows(previewRows);
      setGiStep('preview');
    } catch (e: any) {
      console.error('[GenericImport] Preview failed:', e);
      setGiError(e.message || 'Failed to validate CSV file.');
    } finally {
      setGiPreviewLoading(false);
      setGiValidationProgress(null);
    }
  };

  const handleGenericImportSubmit = async () => {
    if (giPreviewRows.length === 0) {
      toast({ title: 'No Data', description: 'No valid payment rows to submit.', variant: 'destructive' });
      return;
    }
    const userId = posState?.platinumUser?.user_ID;
    const finYear = posState?.platinumUser?.finYear;
    if (!finYear) {
      toast({ title: 'Session Error', description: 'Financial year missing from your session. Please log in again.', variant: 'destructive' });
      return;
    }
    if (!userId) {
      toast({ title: 'Session Error', description: 'User ID not available. Please log in again.', variant: 'destructive' });
      return;
    }
    const cashOfficeId = giSelectedCashOfficeId ? Number(giSelectedCashOfficeId) : (cashierInfo?.cashOfficeId ? Number(cashierInfo.cashOfficeId) : 0);
    const cashierId = posState?.platinumCashierId || 0;
    if (!cashOfficeId || !cashierId) {
      toast({ title: 'Session Error', description: 'Cashier session details not available. Please start a session first.', variant: 'destructive' });
      return;
    }

    setGiSubmitting(true);
    setGiError('');
    try {
      const validRows = giPreviewRows.filter(r => r.isValid);
      const payments = validRows.map(r => ({
        receiptDate: r.receiptDate,
        accountNumber: r.accountNumber,
        amount: r.amount,
        paymentTypeId: r.paymentTypeId,
      }));

      if (payments.length === 0) {
        setGiError('No valid payment rows to submit. All rows failed account validation.');
        setGiSubmitting(false);
        return;
      }

      const result = await submitGenericImport({
        cashOfficeId,
        cashierId,
        userId,
        finYear,
        postToCashbook: giPostToCashbook,
        payments,
      });

      if (result && !result._error && result.isSuccess !== false) {
        const jobId = result.jobId || result.job_ID || result.directDepositJob_ID || result.id;
        const totalCount = result.totalCount || payments.length;
        if (jobId) {
          setGiJobId(String(jobId));
          setGiStep('processing');
          toast({ title: 'Import Accepted', description: result.message || `${totalCount} payment(s) submitted for processing.` });
          startPolling(String(jobId));
        } else {
          toast({ title: 'Import Submitted', description: result.message || `${totalCount} payment(s) submitted. Check allocation progress for results.` });
          setGiStep('results');
        }
      } else {
        const detail = result?.detail || result?.message || 'Import submission failed.';
        setGiError(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
    } catch (e: any) {
      console.error('[GenericImport] Submit failed:', e);
      setGiError(e.message || 'Failed to submit generic import.');
    } finally {
      setGiSubmitting(false);
    }
  };

  const stopPolling = () => {
    if (giPollRef.current) {
      clearInterval(giPollRef.current);
      giPollRef.current = null;
    }
    setGiPolling(false);
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    setGiPolling(true);
    giPollRef.current = setInterval(async () => {
      try {
        const status = await fetchGenericImportStatus(jobId);
        setGiStatus(status);
        const statusStr = (status?.status || status?.job_Status || status?.jobStatus || '').toLowerCase();
        const isComplete = statusStr.includes('complete') || statusStr.includes('done') || statusStr.includes('finished');
        const isFailed = statusStr.includes('fail') || statusStr.includes('error');

        if (isComplete || isFailed) {
          stopPolling();
          await loadGenericResults(jobId);
        }
      } catch (e: any) {
        console.error('[GenericImport] Status poll failed:', e);
        stopPolling();
        setGiError(`Failed to check job status: ${e.message}`);
      }
    }, 3000);
  };

  const loadGenericResults = async (jobId: string) => {
    setGiLoadingResults(true);
    try {
      const [results, errors] = await Promise.all([
        fetchGenericImportResults(jobId),
        fetchGenericImportErrors(jobId),
      ]);
      setGiResults(Array.isArray(results) ? results : []);
      setGiErrors(Array.isArray(errors) ? errors : []);
      setGiStep('results');
    } catch (e: any) {
      console.error('[GenericImport] Failed to load results:', e);
      setGiError(`Failed to load results: ${e.message}`);
      setGiStep('results');
    } finally {
      setGiLoadingResults(false);
    }
  };

  const handleGenericNewImport = () => {
    stopPolling();
    setGiStep('upload');
    setGiFile(null);
    setGiPaymentRef('');
    setGiJobId('');
    setGiStatus(null);
    setGiResults([]);
    setGiErrors([]);
    setGiError('');
    setGiPreviewRows([]);
    setGiPreviewSkipped([]);
  };

  const giStatusText = useMemo(() => {
    if (!giStatus) return 'Waiting...';
    return giStatus.status || giStatus.job_Status || giStatus.jobStatus || giStatus.message || 'Processing...';
  }, [giStatus]);

  const giProgressPercent = useMemo(() => {
    if (!giStatus) return 0;
    if (giStatus.progress !== undefined) return Number(giStatus.progress);
    if (giStatus.percentComplete !== undefined) return Number(giStatus.percentComplete);
    const s = (giStatus.status || giStatus.job_Status || '').toLowerCase();
    if (s.includes('complete') || s.includes('done')) return 100;
    if (s.includes('progress') || s.includes('processing')) return 50;
    return 10;
  }, [giStatus]);

  const counts = useMemo(() => {
    const autoMatched = transactions.filter(t => t.matchStatus === 'Auto-Matched').length;
    const manuallyMatched = transactions.filter(t => t.matchStatus === 'Manually Matched').length;
    const needsReview = transactions.filter(t => t.matchStatus === 'Needs Review').length;
    const unmatched = transactions.filter(t => t.matchStatus === 'Unmatched').length;
    const validated = transactions.filter(t => t.validated).length;
    const total = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    return { autoMatched, manuallyMatched, needsReview, unmatched, validated, total, totalAmount };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    switch (activeFilter) {
      case 'auto-matched': return transactions.filter(t => t.matchStatus === 'Auto-Matched');
      case 'needs-review': return transactions.filter(t => t.matchStatus === 'Needs Review');
      case 'unmatched': return transactions.filter(t => t.matchStatus === 'Unmatched' || t.matchStatus === 'Pending');
      case 'ready': return transactions.filter(t => t.validated);
      default: return transactions;
    }
  }, [transactions, activeFilter]);

  const allValidated = counts.validated === counts.total && counts.total > 0;

  return (
    <PosLayout>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                <ExternalLink className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E] flex items-center gap-2" data-testid="text-page-title">Third Party Payment Processing <HelpTip text="Import and process bulk payment files from banks and external payment providers. The system automatically resolves old account numbers to current EMS accounts." /></h1>
                <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Import and process bulk payment files from banks and external payment providers</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pageTab === 'third-party' && step !== 'import' && (
                <Button variant="outline" onClick={handleNewImport} className="gap-2 h-11 sm:h-9" data-testid="button-new-import">
                  <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">New Import</span><span className="sm:hidden">Back</span>
                </Button>
              )}
              {pageTab === 'generic-import' && giStep !== 'upload' && (
                <Button variant="outline" onClick={handleGenericNewImport} className="gap-2 h-11 sm:h-9" data-testid="button-gi-new-import">
                  <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">New Import</span><span className="sm:hidden">Back</span>
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as PageTab)}>
              <TabsList className="bg-[#F2F4F7] h-11 sm:h-9 w-full sm:w-auto">
                <TabsTrigger value="third-party" className="text-sm h-10 sm:h-8 px-4 flex-1 sm:flex-initial" data-testid="tab-third-party">
                  Third Party Import
                </TabsTrigger>
                <TabsTrigger value="generic-import" className="text-sm h-10 sm:h-8 px-4 flex-1 sm:flex-initial" data-testid="tab-generic-import">
                  Generic Import
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6">

          {pageTab === 'third-party' && (<>

          {step === 'import' && (
            <Card className="border-t-4 border-t-[var(--pos-accent)] shadow-sm">
              <CardHeader className="bg-[#F2F4F7]/50 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1 bg-[var(--pos-accent)] rounded-full"></div>
                  <CardTitle className="text-lg font-medium text-slate-800">
                    Third Party Payments - Import
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">

                {processResult && (
                  <Alert variant={processResult.success ? "default" : "destructive"} className={processResult.success ? "bg-green-50 border-green-200 text-green-800" : ""}>
                    {processResult.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>{processResult.success ? "Success" : "Error"}</AlertTitle>
                    <AlertDescription>{processResult.message}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="paymentRef">Payment Reference</Label>
                    <Input
                      id="paymentRef"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="Enter reference number"
                      className="bg-white"
                      data-testid="input-payment-ref"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cashBookId">Cash Office</Label>
                    {cashierInfo ? (
                      <Input
                        id="cashBookId"
                        value={`${cashierInfo.cashOfficeId} - ${cashierInfo.cashOfficeDesc || ''}`}
                        readOnly
                        className="bg-[#F7F7F7] cursor-not-allowed"
                        data-testid="input-cashbook-id"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          id="cashBookId"
                          value={cashBookId}
                          onChange={(e) => setCashBookId(e.target.value)}
                          placeholder="Loading..."
                          className="bg-white"
                          type="number"
                          data-testid="input-cashbook-id"
                        />
                        {posState?.platinumUser?.user_ID && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thirdParty" className="after:content-['*'] after:ml-0.5 after:text-red-500 flex items-center gap-1">
                      Select Third Party <HelpTip text="Select the payment method used for these transactions (e.g., EFT, debit order)." />
                    </Label>
                    {loadingTypes ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading types...
                      </div>
                    ) : (
                      <Select value={selectedTypeId} onValueChange={(val) => setSelectedTypeId(val)}>
                        <SelectTrigger id="thirdParty" className={!selectedTypeId ? "border-red-300 bg-white" : "bg-white"} data-testid="select-third-party">
                          <SelectValue placeholder="-- Select Third Party --" />
                        </SelectTrigger>
                        <SelectContent>
                          {thirdPartyTypes.map(tp => (
                            <SelectItem key={String(tp.id)} value={String(tp.id)}>
                              {tp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fileUpload" className="flex items-center gap-1">Select File <HelpTip text="Upload a CSV or payment file from the bank containing bulk payment transactions." /></Label>
                    <Input
                      id="fileUpload"
                      type="file"
                      onChange={handleFileChange}
                      accept=".csv,.txt,.xml"
                      className="cursor-pointer bg-white file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[var(--pos-accent-tint)] file:text-[#6B6B6B] hover:file:bg-[var(--pos-accent-tint-strong)]"
                      data-testid="input-file-upload"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum file size: 5 MB. Allowed extensions: .csv, .txt, .xml
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t">
                  <Button
                    onClick={handleImport}
                    disabled={isProcessing || !selectedTypeId || !file}
                    className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] gap-2 min-w-[150px] w-full sm:w-auto h-11 sm:h-10"
                    data-testid="button-import"
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Import & Process</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'transactions' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold text-slate-900" data-testid="text-total-count">{counts.total}</p>
                </Card>
                <Card className="p-3 border-green-200 bg-green-50/50">
                  <p className="text-xs text-muted-foreground">Auto-Matched</p>
                  <p className="text-xl font-bold text-green-600" data-testid="text-auto-matched-count">{counts.autoMatched}</p>
                </Card>
                <Card className="p-3 border-[#D6D6D6] bg-[var(--pos-accent-tint)]">
                  <p className="text-xs text-muted-foreground">Manually Matched</p>
                  <p className="text-xl font-bold text-[var(--pos-accent)]" data-testid="text-manual-matched-count">{counts.manuallyMatched}</p>
                </Card>
                <Card className="p-3 border-amber-200 bg-amber-50/50">
                  <p className="text-xs text-muted-foreground">Needs Review</p>
                  <p className="text-xl font-bold text-amber-600" data-testid="text-needs-review-count">{counts.needsReview}</p>
                </Card>
                <Card className="p-3 border-red-200 bg-red-50/50">
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                  <p className="text-xl font-bold text-red-600" data-testid="text-unmatched-count">{counts.unmatched}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold text-[#2E2E2E]" data-testid="text-total-amount">R {counts.totalAmount.toFixed(2)}</p>
                </Card>
              </div>

              {counts.unmatched > 0 && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Unmatched Transactions</AlertTitle>
                  <AlertDescription>
                    {counts.unmatched} transaction(s) could not be matched to an account. Use the Search & Link action on each row to find and assign the correct account before committing.
                  </AlertDescription>
                </Alert>
              )}

              {counts.needsReview > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Transactions Need Review</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    {counts.needsReview} transaction(s) matched multiple possible accounts. Please review and confirm the correct account for each.
                  </AlertDescription>
                </Alert>
              )}

              {counts.autoMatched > 0 && counts.unmatched === 0 && counts.needsReview === 0 && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">All Accounts Resolved</AlertTitle>
                  <AlertDescription className="text-green-700">
                    All {counts.total} transactions have been matched to current EMS accounts. {counts.autoMatched} auto-matched, {counts.manuallyMatched} manually matched. Ready to validate and commit.
                  </AlertDescription>
                </Alert>
              )}

              {validationResult && (
                <Alert
                  variant={validationResult.error || validationResult.isValid === false ? "destructive" : "default"}
                  className={!validationResult.error && validationResult.isValid !== false ? "bg-green-50 border-green-200 text-green-800" : ""}
                >
                  {validationResult.error || validationResult.isValid === false
                    ? <AlertCircle className="h-4 w-4" />
                    : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  <AlertTitle>
                    {validationResult.error
                      ? "Validation Failed"
                      : validationResult.isValid === false
                        ? "Validation Issues Found"
                        : "Validation Passed"}
                  </AlertTitle>
                  <AlertDescription>
                    {validationResult.error
                      ? validationResult.message
                      : (
                        <div className="space-y-1 mt-1">
                          {validationResult.errors?.length > 0 && (
                            <ul className="list-disc list-inside text-sm">
                              {validationResult.errors.map((err: string, i: number) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm mt-2">
                            {validationResult.invalidAccountCount > 0 && (
                              <span className="text-red-600 font-medium">Invalid Accounts: {validationResult.invalidAccountCount}</span>
                            )}
                            {validationResult.emptyAccountCount > 0 && (
                              <span className="text-orange-600 font-medium">Empty Accounts: {validationResult.emptyAccountCount}</span>
                            )}
                            {validationResult.isValid && (
                              <span className="text-green-700 font-medium">All transactions are valid and ready to commit.</span>
                            )}
                          </div>
                        </div>
                      )}
                  </AlertDescription>
                </Alert>
              )}

              {commitResult && (
                <Alert variant={commitResult.error ? "destructive" : "default"} className={!commitResult.error ? "bg-green-50 border-green-200 text-green-800" : ""}>
                  {commitResult.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  <AlertTitle>{commitResult.error ? "Commit Failed" : "Committed Successfully"}</AlertTitle>
                  <AlertDescription>
                    {commitResult.message || commitResult.error || (commitResult.masterId ? `Payments committed — Master ID: ${commitResult.masterId}` : 'Payments have been committed and allocated.')}
                  </AlertDescription>
                </Alert>
              )}

              <Card className="border-t-4 border-t-[var(--pos-accent)] shadow-sm">
                <CardHeader className="bg-[#F2F4F7]/50 pb-3 border-b">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-1 bg-[var(--pos-accent)] rounded-full shrink-0"></div>
                        <CardTitle className="text-base sm:text-lg font-medium text-slate-800 truncate">
                          Imported Transactions
                          {importId && <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-2">(Import: {importId})</span>}
                        </CardTitle>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => loadTransactions()} disabled={loadingTxns} className="gap-1 h-11 sm:h-8 flex-1 sm:flex-initial" data-testid="button-refresh-txns">
                          <RefreshCw className={`h-3.5 w-3.5 ${loadingTxns ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleValidateForReconcile}
                          disabled={validating || transactions.length === 0}
                          className="gap-1 text-[var(--pos-accent)] border-[#D6D6D6] hover:bg-[var(--pos-accent-tint)] h-11 sm:h-8 flex-1 sm:flex-initial"
                          data-testid="button-validate"
                        >
                          {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                          Validate
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCommit}
                          disabled={committing || transactions.length === 0 || !allValidated}
                          className="gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 h-11 sm:h-8 w-full sm:w-auto"
                          title={!allValidated ? `${counts.total - counts.validated} unresolved transaction(s) — resolve all before committing` : ''}
                          data-testid="button-commit"
                        >
                          {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Commit & Allocate ({counts.validated}/{counts.total})
                        </Button>
                        <HelpTip text="Only validated (matched) transactions can be committed. Resolve all Unmatched and Needs Review items first." />
                      </div>
                    </div>

                    <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterTab)} className="w-full">
                      <div className="overflow-x-auto -mx-2 px-2">
                        <TabsList className="bg-[#F2F4F7] h-11 sm:h-8 w-max sm:w-auto">
                          <TabsTrigger value="all" className="text-xs h-10 sm:h-7 px-3" data-testid="tab-all">
                            All ({counts.total})
                          </TabsTrigger>
                          <TabsTrigger value="auto-matched" className="text-xs h-10 sm:h-7 px-3" data-testid="tab-auto-matched">
                            <span className="hidden sm:inline">Auto-Matched</span><span className="sm:hidden">Auto</span> ({counts.autoMatched})
                          </TabsTrigger>
                          <TabsTrigger value="needs-review" className="text-xs h-10 sm:h-7 px-3" data-testid="tab-needs-review">
                            Review ({counts.needsReview})
                          </TabsTrigger>
                          <TabsTrigger value="unmatched" className="text-xs h-10 sm:h-7 px-3" data-testid="tab-unmatched">
                            <span className="hidden sm:inline">Unmatched</span><span className="sm:hidden">None</span> ({counts.unmatched})
                          </TabsTrigger>
                          <TabsTrigger value="ready" className="text-xs h-10 sm:h-7 px-3" data-testid="tab-ready">
                            Ready ({counts.validated})
                          </TabsTrigger>
                        </TabsList>
                      </div>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingTxns ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3 px-8">
                      <Loader2 className="h-6 w-6 animate-spin text-[var(--pos-accent)]" />
                      <div className="text-sm font-medium">{loadProgress.step || 'Loading...'}</div>
                      <div className="w-full max-w-md">
                        <div className="h-2 bg-[#D6D6D6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--pos-accent)] rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${loadProgress.percent}%` }}
                          />
                        </div>
                        <div className="text-xs text-center mt-1 text-muted-foreground">{loadProgress.percent}%</div>
                      </div>
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {transactions.length === 0 ? 'No transactions found for this import.' : `No transactions match the "${activeFilter}" filter.`}
                    </div>
                  ) : (
                    <>
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#F7F7F7]">
                              <TableHead className="w-[40px]">#</TableHead>
                              <TableHead>
                                <span className="flex items-center gap-1">Account Match <HelpTip text="Shows the imported account number and the resolved current EMS account. If different, the old number was automatically mapped." /></span>
                              </TableHead>
                              <TableHead>Owner / Name</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>
                                <span className="flex items-center gap-1">Match Status <HelpTip text="Auto-Matched = system found exact match. Needs Review = multiple matches found. Unmatched = no match. Manually Matched = linked by user." /></span>
                              </TableHead>
                              <TableHead className="text-center w-[150px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTransactions.map((txn) => (
                              <TableRow
                                key={txn.index}
                                className={`${!txn.validated ? 'bg-red-50/30' : txn.matchStatus === 'Auto-Matched' && txn.importedAccountNumber !== txn.resolvedAccountId ? 'bg-[var(--pos-accent-tint)]' : ''}`}
                                data-testid={`row-txn-${txn.index}`}
                              >
                                <TableCell className="text-xs text-muted-foreground font-mono">{txn.index + 1}</TableCell>
                                <TableCell>
                                  {editingIdx === txn.index ? (
                                    <div className="space-y-1">
                                      <div className="text-[10px] text-muted-foreground">Imported: <span className="font-mono">{txn.importedAccountNumber}</span></div>
                                      <Input
                                        value={editAccountNo}
                                        onChange={(e) => setEditAccountNo(e.target.value)}
                                        className="h-7 text-xs w-40 font-mono"
                                        placeholder="New account number"
                                        data-testid={`input-edit-account-${txn.index}`}
                                      />
                                    </div>
                                  ) : (
                                    <div className="space-y-0.5">
                                      {txn.importedAccountNumber !== txn.resolvedAccountId && txn.resolvedAccountId ? (
                                        <>
                                          <div className="text-[10px] text-muted-foreground line-through">
                                            Imported: <span className="font-mono">{txn.importedAccountNumber}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <ArrowRight className="h-3 w-3 text-green-600 shrink-0" />
                                            <span className="font-mono text-sm text-green-700 font-medium">{txn.resolvedAccountId}</span>
                                          </div>
                                        </>
                                      ) : txn.resolvedAccountId ? (
                                        <span className="font-mono text-sm text-[var(--pos-accent)] font-medium">{txn.resolvedAccountId}</span>
                                      ) : (
                                        <div className="space-y-0.5">
                                          <span className="font-mono text-sm text-red-600">{txn.importedAccountNumber}</span>
                                          <div className="text-[10px] text-red-500">No match found</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm max-w-[150px] truncate" title={txn.ownerName || '-'}>{txn.ownerName || '-'}</TableCell>
                                <TableCell className="text-right font-mono text-sm">R {txn.amount.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={txn.importedReference}>{txn.importedReference || '-'}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      {matchStatusBadge(txn.matchStatus)}
                                      {txn.isDuplicate && (
                                        <Badge variant="destructive" className="text-[10px]">Dup</Badge>
                                      )}
                                    </div>
                                    {txn.validationMessage && (
                                      <p className="text-[10px] text-muted-foreground max-w-[180px] truncate" title={txn.validationMessage}>
                                        {txn.validationMessage}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {editingIdx === txn.index ? (
                                    <div className="flex gap-1 justify-center">
                                      <Button size="sm" variant="ghost" onClick={handleSaveEdit} disabled={savingEdit} className="h-7 w-7 p-0" title="Save" data-testid={`button-save-edit-${txn.index}`}>
                                        {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-green-600" />}
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0" title="Cancel">
                                        <X className="h-3.5 w-3.5 text-red-500" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-0.5 justify-center">
                                      <Button size="sm" variant="ghost" onClick={() => handleViewAccount(txn)} className="h-7 w-7 p-0" title="View details" data-testid={`button-view-${txn.index}`}>
                                        <Eye className="h-3.5 w-3.5 text-slate-500" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => openAccountSearch(txn.index)} className="h-7 w-7 p-0" title="Search & Link" data-testid={`button-search-${txn.index}`}>
                                        <Search className="h-3.5 w-3.5 text-[var(--pos-accent)]" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => handleStartEdit(txn)} className="h-7 w-7 p-0" title="Override Link" data-testid={`button-edit-${txn.index}`}>
                                        <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                                      </Button>
                                      {txn.resolvedAccountId && (
                                        <Button size="sm" variant="ghost" onClick={() => handleClearLink(txn.index)} className="h-7 w-7 p-0" title="Clear Link" data-testid={`button-clear-${txn.index}`}>
                                          <Unlink className="h-3.5 w-3.5 text-red-400" />
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="sm:hidden divide-y divide-[#E5E7EB]">
                        {filteredTransactions.map((txn) => (
                          <div
                            key={txn.index}
                            className={`p-4 space-y-3 ${!txn.validated ? 'bg-red-50/30' : txn.matchStatus === 'Auto-Matched' && txn.importedAccountNumber !== txn.resolvedAccountId ? 'bg-[var(--pos-accent-tint)]' : ''}`}
                            data-testid={`card-txn-${txn.index}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs text-muted-foreground font-mono shrink-0">#{txn.index + 1}</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {matchStatusBadge(txn.matchStatus)}
                                  {txn.isDuplicate && <Badge variant="destructive" className="text-[10px]">Dup</Badge>}
                                </div>
                              </div>
                              <span className="font-mono text-sm font-bold text-[#2E2E2E] shrink-0">R {txn.amount.toFixed(2)}</span>
                            </div>

                            <div className="space-y-1.5">
                              {editingIdx === txn.index ? (
                                <div className="space-y-2">
                                  <div className="text-xs text-muted-foreground">Imported: <span className="font-mono">{txn.importedAccountNumber}</span></div>
                                  <Input
                                    value={editAccountNo}
                                    onChange={(e) => setEditAccountNo(e.target.value)}
                                    className="h-11 text-sm font-mono"
                                    placeholder="New account number"
                                    data-testid={`input-edit-account-mobile-${txn.index}`}
                                  />
                                </div>
                              ) : (
                                <div>
                                  {txn.importedAccountNumber !== txn.resolvedAccountId && txn.resolvedAccountId ? (
                                    <div className="space-y-0.5">
                                      <div className="text-[11px] text-muted-foreground line-through">
                                        Imported: <span className="font-mono">{txn.importedAccountNumber}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <ArrowRight className="h-3 w-3 text-green-600 shrink-0" />
                                        <span className="font-mono text-sm text-green-700 font-medium break-all">{txn.resolvedAccountId}</span>
                                      </div>
                                    </div>
                                  ) : txn.resolvedAccountId ? (
                                    <span className="font-mono text-sm text-[var(--pos-accent)] font-medium break-all">{txn.resolvedAccountId}</span>
                                  ) : (
                                    <div className="space-y-0.5">
                                      <span className="font-mono text-sm text-red-600 break-all">{txn.importedAccountNumber}</span>
                                      <div className="text-[11px] text-red-500">No match found</div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {txn.ownerName && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium text-slate-600">{txn.ownerName}</span>
                                </div>
                              )}

                              {txn.importedReference && (
                                <div className="text-xs text-muted-foreground">
                                  Ref: <span className="font-mono">{txn.importedReference}</span>
                                </div>
                              )}

                              {txn.validationMessage && (
                                <p className="text-[11px] text-muted-foreground">{txn.validationMessage}</p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                              {editingIdx === txn.index ? (
                                <>
                                  <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit} className="h-11 flex-1 gap-1.5 bg-green-600 hover:bg-green-700" data-testid={`button-save-edit-mobile-${txn.index}`}>
                                    {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-11 flex-1 gap-1.5">
                                    <X className="h-4 w-4" /> Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleViewAccount(txn)} className="h-11 flex-1 gap-1.5" data-testid={`button-view-mobile-${txn.index}`}>
                                    <Eye className="h-4 w-4" /> View
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openAccountSearch(txn.index)} className="h-11 flex-1 gap-1.5 text-[var(--pos-accent)] border-[var(--pos-accent)]" data-testid={`button-search-mobile-${txn.index}`}>
                                    <Search className="h-4 w-4" /> Link
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleStartEdit(txn)} className="h-11 gap-1.5 px-3" data-testid={`button-edit-mobile-${txn.index}`}>
                                    <Edit2 className="h-4 w-4 text-amber-600" />
                                  </Button>
                                  {txn.resolvedAccountId && (
                                    <Button size="sm" variant="outline" onClick={() => handleClearLink(txn.index)} className="h-11 gap-1.5 px-3" data-testid={`button-clear-mobile-${txn.index}`}>
                                      <Unlink className="h-4 w-4 text-red-400" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {step === 'committed' && (
            <Card className="border-t-4 border-t-green-600 shadow-sm">
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold text-slate-900">Payments Committed Successfully</h2>
                <p className="text-muted-foreground">
                  All validated transactions from import {importId} have been committed and allocated to their respective accounts using resolved (current) account numbers.
                </p>
                {commitResult?.masterId && (
                  <p className="text-sm font-medium text-slate-700">
                    Master ID: <span className="font-mono bg-[#F2F4F7] px-2 py-0.5 rounded">{commitResult.masterId}</span>
                  </p>
                )}
                <Button onClick={handleNewImport} className="gap-2 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] mt-4 h-11 sm:h-10 w-full sm:w-auto" data-testid="button-start-new">
                  <Upload className="h-4 w-4" /> Start New Import
                </Button>
              </CardContent>
            </Card>
          )}

          </>)}

          {pageTab === 'generic-import' && (<>

            {giStep === 'upload' && (
              <Card className="border-t-4 border-t-[var(--pos-accent)] shadow-sm">
                <CardHeader className="bg-gradient-to-r from-[#F2F4F7] to-white pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--pos-accent), var(--pos-accent-dark))' }}>
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-slate-800">
                          Generic Import
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Upload a CSV file to allocate direct deposit payments in bulk</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 text-xs border-slate-300"
                      data-testid="button-gi-download-template"
                      onClick={() => {
                        const header = 'AccountNumber,Amount,ReceiptDate,PaymentTypeId';
                        const dateParts = (giReceiptDate || new Date().toISOString().slice(0, 10)).split('-');
                        const todayFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : giReceiptDate;
                        const sample1 = `000000013088,1500.00,${todayFormatted},5`;
                        const sample2 = `000000022906,750.50,${todayFormatted},3`;
                        const csv = [header, sample1, sample2].join('\r\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'generic_import_template.csv';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">

                  {giError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Import Error</AlertTitle>
                      <AlertDescription>{giError}</AlertDescription>
                    </Alert>
                  )}

                  <div
                    className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group ${
                      giDragOver
                        ? 'border-[var(--pos-accent)] scale-[1.01] shadow-lg'
                        : giFile
                          ? 'border-green-300 bg-green-50/30'
                          : 'border-slate-300 hover:border-[var(--pos-accent)] hover:shadow-sm'
                    }`}
                    style={giDragOver ? { backgroundColor: 'color-mix(in srgb, var(--pos-accent) 8%, transparent)' } : {}}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setGiDragOver(true); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setGiDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setGiDragOver(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setGiDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
                        setGiFile(file);
                        setGiError('');
                      } else {
                        setGiError('Please drop a CSV file (.csv or .txt)');
                      }
                    }}
                    onClick={() => giFileInputRef.current?.click()}
                    data-testid="dropzone-gi-file"
                  >
                    <input
                      ref={giFileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      data-testid="input-gi-file"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setGiFile(f);
                        setGiError('');
                        if (e.target) e.target.value = '';
                      }}
                    />
                    <div className="flex flex-col items-center justify-center py-8 px-4 sm:py-10">
                      {giFile ? (
                        <>
                          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                            <FileCheck className="h-6 w-6 text-green-600" />
                          </div>
                          <div className="text-sm font-semibold text-slate-800">{giFile.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">{(giFile.size / 1024).toFixed(1)} KB</div>
                          <button
                            type="button"
                            className="mt-3 text-xs text-[var(--pos-accent-dark)] hover:underline font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGiFile(null);
                              if (giFileInputRef.current) giFileInputRef.current.value = '';
                            }}
                            data-testid="button-gi-remove-file"
                          >
                            Remove file
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="h-14 w-14 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ background: 'color-mix(in srgb, var(--pos-accent) 15%, transparent)' }}>
                            <Upload className="h-7 w-7" style={{ color: 'var(--pos-accent)' }} />
                          </div>
                          <div className="text-sm font-medium text-slate-700">
                            {giDragOver ? 'Drop your CSV file here' : 'Drag & drop your CSV file here'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">or click to browse</div>
                          <div className="text-[10px] text-muted-foreground mt-3 px-4 py-1.5 bg-slate-100 rounded-full">
                            Supports .csv and .txt — no row limit
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="gi-cash-office" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Cash Office</Label>
                        {giCashOffices.length > 0 ? (
                          <Select value={giSelectedCashOfficeId} onValueChange={setGiSelectedCashOfficeId}>
                            <SelectTrigger id="gi-cash-office" className="mt-1.5 h-11 sm:h-10" data-testid="select-gi-cash-office">
                              <SelectValue placeholder={giLoadingCashOffices ? 'Loading...' : 'Select cash office'} />
                            </SelectTrigger>
                            <SelectContent>
                              {giCashOffices.map((office) => (
                                <SelectItem key={office.id} value={office.id}>{office.id} — {office.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="mt-1.5 h-11 sm:h-10 px-3 rounded-md border bg-slate-50 flex items-center text-sm text-slate-600">
                            {giLoadingCashOffices ? (
                              <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading cash offices...</span>
                            ) : cashierInfo ? (
                              <span>{cashierInfo.cashOfficeId} — {cashierInfo.cashOfficeName || cashierInfo.cashOfficeDesc || 'Cash Office'}</span>
                            ) : (
                              <span className="text-muted-foreground">No cash offices available</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="gi-payment-type" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Method</Label>
                        <Select value={giPaymentTypeId} onValueChange={setGiPaymentTypeId}>
                          <SelectTrigger id="gi-payment-type" className="mt-1.5 h-11 sm:h-10" data-testid="select-gi-payment-type">
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Cash</SelectItem>
                            <SelectItem value="2">Cheque</SelectItem>
                            <SelectItem value="3">Credit Card</SelectItem>
                            <SelectItem value="4">Postal Order</SelectItem>
                            <SelectItem value="5">EFT</SelectItem>
                            <SelectItem value="6">Third Party Payment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="gi-receipt-date" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Receipt Date</Label>
                        <Input
                          id="gi-receipt-date"
                          type="date"
                          className="mt-1.5 h-11 sm:h-10"
                          value={giReceiptDate}
                          onChange={(e) => setGiReceiptDate(e.target.value)}
                          data-testid="input-gi-receipt-date"
                        />
                      </div>
                      <div>
                        <Label htmlFor="gi-payment-ref" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Reference <span className="text-muted-foreground font-normal normal-case">(optional)</span></Label>
                        <Input
                          id="gi-payment-ref"
                          className="mt-1.5 h-11 sm:h-10"
                          placeholder="e.g. Batch 2026-03"
                          value={giPaymentRef}
                          onChange={(e) => setGiPaymentRef(e.target.value)}
                          data-testid="input-gi-payment-ref"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-lg border bg-slate-50/80">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${giPostToCashbook ? 'bg-green-100' : 'bg-slate-200'}`}>
                          <FileCheck className={`h-4 w-4 ${giPostToCashbook ? 'text-green-600' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-700">Post to Cashbook</div>
                          <div className="text-[11px] text-muted-foreground">Automatically post allocations to the cashbook after processing</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={giPostToCashbook}
                        onClick={() => setGiPostToCashbook(!giPostToCashbook)}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${giPostToCashbook ? 'bg-green-500' : 'bg-slate-300'}`}
                        data-testid="toggle-gi-post-to-cashbook"
                      >
                        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${giPostToCashbook ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {giValidationProgress ? (
                    <div className="pt-3 border-t space-y-3" data-testid="gi-validation-progress">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--pos-accent)' }} />
                        <span>Validating Import File</span>
                      </div>

                      <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${giValidationProgress.percent}%`,
                            background: giValidationProgress.phase === 'done'
                              ? '#22c55e'
                              : 'linear-gradient(90deg, var(--pos-accent), var(--pos-accent-dark))',
                          }}
                        />
                        {giValidationProgress.phase === 'validating' && (
                          <div
                            className="absolute inset-y-0 rounded-full animate-pulse opacity-40"
                            style={{
                              left: `${Math.max(0, giValidationProgress.percent - 8)}%`,
                              width: '8%',
                              background: 'var(--pos-accent)',
                            }}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{giValidationProgress.detail}</span>
                        <span className="font-mono tabular-nums">{giValidationProgress.percent}%</span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {[
                          { label: 'Parsing CSV', phase: 'parsing' as const, icon: '📄' },
                          { label: 'API Validation', phase: 'validating' as const, icon: '🔍' },
                          { label: 'Building Preview', phase: 'building' as const, icon: '📋' },
                        ].map((step, i) => {
                          const phases = ['parsing', 'validating', 'building', 'done'];
                          const currentIdx = phases.indexOf(giValidationProgress.phase);
                          const stepIdx = phases.indexOf(step.phase);
                          const isComplete = currentIdx > stepIdx;
                          const isCurrent = currentIdx === stepIdx;
                          return (
                            <div key={step.phase} className="flex items-center gap-1.5">
                              {i > 0 && <div className={`w-4 h-px ${isComplete ? 'bg-green-400' : 'bg-slate-200'}`} />}
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-300 ${
                                isComplete
                                  ? 'bg-green-50 border-green-200 text-green-700'
                                  : isCurrent
                                    ? 'border-[var(--pos-accent)] text-slate-700 shadow-sm'
                                    : 'bg-slate-50 border-slate-200 text-slate-400'
                              }`} style={isCurrent ? { backgroundColor: 'color-mix(in srgb, var(--pos-accent) 10%, transparent)' } : {}}>
                                {isComplete ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : isCurrent ? (
                                  <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--pos-accent)' }} />
                                ) : (
                                  <div className="h-3 w-3 rounded-full border border-slate-300" />
                                )}
                                {step.label}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {giValidationProgress.phase === 'validating' && giValidationProgress.totalCount > 0 && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 rounded-lg p-2 border">
                            <div className="text-lg font-semibold text-slate-700 tabular-nums">{giValidationProgress.validatedCount}<span className="text-slate-400 text-sm">/{giValidationProgress.totalCount}</span></div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Checked</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                            <div className="text-lg font-semibold text-green-600 tabular-nums">{giValidationProgress.validCount}</div>
                            <div className="text-[10px] text-green-600 uppercase tracking-wider">Matched</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                            <div className="text-lg font-semibold text-red-500 tabular-nums">{giValidationProgress.invalidCount}</div>
                            <div className="text-[10px] text-red-500 uppercase tracking-wider">Invalid</div>
                          </div>
                        </div>
                      )}

                      {giValidationProgress.phase === 'done' && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-2.5 border border-green-200">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">Validation complete — loading preview...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-end pt-2 border-t">
                      <Button
                        onClick={handlePreviewFile}
                        disabled={!giFile || giPreviewLoading}
                        className="gap-2 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white h-11 sm:h-10 w-full sm:w-auto"
                        data-testid="button-gi-preview"
                      >
                        {giPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        {giPreviewLoading ? 'Validating...' : 'Preview & Validate'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {giStep === 'preview' && (
              <Card className="border-t-4 border-t-[var(--pos-accent)] shadow-sm">
                <CardHeader className="bg-[#F2F4F7]/50 pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-1 bg-[var(--pos-accent)] rounded-full"></div>
                    <CardTitle className="text-lg font-medium text-slate-800">
                      Generic Import — Preview & Validate
                    </CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review the parsed data below. Matched and unverified accounts will be submitted. Only rows with format errors are excluded.
                  </p>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">

                  {giError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Validation Error</AlertTitle>
                      <AlertDescription>{giError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 border text-center">
                      <div className="text-2xl font-bold text-slate-800" data-testid="text-gi-preview-total">{giPreviewRows.length}</div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Rows</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                      <div className="text-2xl font-bold text-green-700" data-testid="text-gi-preview-valid">{giPreviewRows.filter(r => r.validationStatus === 'valid').length}</div>
                      <div className="text-[11px] text-green-600 uppercase tracking-wider mt-0.5">Matched</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-center">
                      <div className="text-2xl font-bold text-amber-700" data-testid="text-gi-preview-unverified">{giPreviewRows.filter(r => r.validationStatus === 'unverified').length}</div>
                      <div className="text-[11px] text-amber-600 uppercase tracking-wider mt-0.5">Unverified</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
                      <div className="text-2xl font-bold text-red-700" data-testid="text-gi-preview-invalid">{giPreviewRows.filter(r => !r.isValid).length}</div>
                      <div className="text-[11px] text-red-600 uppercase tracking-wider mt-0.5">Invalid</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
                      <div className="text-2xl font-bold text-blue-700" data-testid="text-gi-preview-amount">
                        R {giPreviewRows.filter(r => r.isValid).reduce((s, r) => s + r.amount, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-blue-600 uppercase tracking-wider mt-0.5">Submittable Total</div>
                    </div>
                  </div>

                  {giPreviewSkipped.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Skipped Rows ({giPreviewSkipped.length})</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                          {giPreviewSkipped.slice(0, 10).map((msg, i) => (
                            <li key={i}>{msg}</li>
                          ))}
                          {giPreviewSkipped.length > 10 && (
                            <li className="text-muted-foreground">...and {giPreviewSkipped.length - 10} more</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-[11px] font-semibold w-[40px]">#</TableHead>
                            <TableHead className="text-[11px] font-semibold">Status</TableHead>
                            <TableHead className="text-[11px] font-semibold">Account No.</TableHead>
                            <TableHead className="text-[11px] font-semibold">Owner / Name</TableHead>
                            <TableHead className="text-[11px] font-semibold text-right">Amount</TableHead>
                            <TableHead className="text-[11px] font-semibold">Date</TableHead>
                            <TableHead className="text-[11px] font-semibold">Pay Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {giPreviewRows.map((row, idx) => (
                            <TableRow
                              key={idx}
                              className={!row.isValid ? 'bg-red-50/50' : row.validationStatus === 'unverified' ? 'bg-amber-50/30' : row.isDuplicate ? 'bg-amber-50/50' : ''}
                              data-testid={`row-gi-preview-${idx}`}
                            >
                              <TableCell className="text-xs text-muted-foreground py-2">{row.rowNum}</TableCell>
                              <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                  {row.validationStatus === 'valid' ? (
                                    <Badge className="text-[10px] bg-green-100 text-green-800 hover:bg-green-100 gap-1 w-fit" data-testid={`badge-gi-valid-${idx}`}>
                                      <CheckCircle2 className="h-3 w-3" />
                                      Matched
                                    </Badge>
                                  ) : row.validationStatus === 'unverified' ? (
                                    <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1 w-fit" data-testid={`badge-gi-unverified-${idx}`}>
                                      <AlertTriangle className="h-3 w-3" />
                                      Unverified
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-[10px] gap-1 w-fit" data-testid={`badge-gi-invalid-${idx}`}>
                                      <AlertCircle className="h-3 w-3" />
                                      {row.validationMsg || 'Invalid'}
                                    </Badge>
                                  )}
                                  {row.isDuplicate && (
                                    <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1 w-fit">
                                      <AlertTriangle className="h-3 w-3" />
                                      Duplicate
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs py-2" data-testid={`text-gi-acc-${idx}`}>{row.accountNumber}</TableCell>
                              <TableCell className="text-xs py-2" data-testid={`text-gi-name-${idx}`}>
                                {row.ownerName || <span className="text-muted-foreground italic">—</span>}
                                {row.address && (
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{row.address}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-right py-2" data-testid={`text-gi-amount-${idx}`}>
                                R {row.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-xs py-2">{row.receiptDate}</TableCell>
                              <TableCell className="text-xs py-2">
                                {({1:'Cash',2:'Cheque',3:'Card',4:'Postal',5:'EFT',6:'3rd Party',7:'Journal'} as Record<number,string>)[row.paymentTypeId] || row.paymentTypeId}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {giPreviewRows.some(r => r.validationStatus === 'unverified') && (
                    <Alert className="border-amber-200 bg-amber-50/50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800">Unverified Accounts ({giPreviewRows.filter(r => r.validationStatus === 'unverified').length})</AlertTitle>
                      <AlertDescription className="text-sm text-amber-700">
                        The account lookup API returned errors, so these accounts couldn't be verified beforehand.
                        They will still be submitted — Platinum will validate them during processing and report any issues in the results.
                      </AlertDescription>
                    </Alert>
                  )}

                  {giPreviewRows.some(r => !r.isValid) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Invalid Rows ({giPreviewRows.filter(r => !r.isValid).length})</AlertTitle>
                      <AlertDescription className="text-sm">
                        {giPreviewRows.filter(r => !r.isValid).length} row(s) have format errors (empty account, invalid amount, etc.) and will be excluded from submission.
                      </AlertDescription>
                    </Alert>
                  )}

                  {giPreviewRows.some(r => r.isDuplicate) && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Duplicate Accounts Detected</AlertTitle>
                      <AlertDescription className="text-sm">
                        Some account numbers appear more than once in the file. Duplicate entries are highlighted in amber.
                        They will still be submitted unless they also fail validation.
                      </AlertDescription>
                    </Alert>
                  )}

                  {giPreviewRows.filter(r => r.isValid).length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4 border space-y-2">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">API Payload Summary</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                        <div><span className="text-muted-foreground">Cash Office:</span> <span className="font-medium">{giSelectedCashOfficeId ? `${giSelectedCashOfficeId} — ${giCashOffices.find(o => o.id === giSelectedCashOfficeId)?.name || ''}` : (cashierInfo?.cashOfficeName || cashierInfo?.cashOfficeId || '-')}</span></div>
                        <div><span className="text-muted-foreground">Cashier ID:</span> <span className="font-medium">{posState?.platinumCashierId || '-'}</span></div>
                        <div><span className="text-muted-foreground">User ID:</span> <span className="font-medium">{posState?.platinumUser?.user_ID || '-'}</span></div>
                        <div><span className="text-muted-foreground">Fin Year:</span> <span className="font-medium">{posState?.platinumUser?.finYear || '-'}</span></div>
                        <div><span className="text-muted-foreground">Post to Cashbook:</span> <span className="font-medium">{giPostToCashbook ? 'Yes' : 'No'}</span></div>
                        <div><span className="text-muted-foreground">Submittable Payments:</span> <span className="font-medium">{giPreviewRows.filter(r => r.isValid).length} ({giPreviewRows.filter(r => r.validationStatus === 'valid').length} matched + {giPreviewRows.filter(r => r.validationStatus === 'unverified').length} unverified)</span></div>
                        <div><span className="text-muted-foreground">Total Amount:</span> <span className="font-bold">R {giPreviewRows.filter(r => r.isValid).reduce((s, r) => s + r.amount, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                        <div><span className="text-muted-foreground">Date Format:</span> <span className="font-medium">dd/MM/yyyy</span></div>
                        <div><span className="text-muted-foreground">Account Format:</span> <span className="font-medium">12-digit zero-padded</span></div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGiStep('upload');
                        setGiPreviewRows([]);
                        setGiPreviewSkipped([]);
                        setGiError('');
                      }}
                      className="gap-2 h-11 sm:h-10"
                      data-testid="button-gi-back-to-upload"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back to Upload
                    </Button>
                    <Button
                      onClick={handleGenericImportSubmit}
                      disabled={giSubmitting || giPreviewRows.filter(r => r.isValid).length === 0}
                      className="gap-2 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white h-11 sm:h-10"
                      data-testid="button-gi-confirm-submit"
                    >
                      {giSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {giSubmitting ? 'Submitting...' : `Confirm & Submit ${giPreviewRows.filter(r => r.isValid).length} Payment(s)`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {giStep === 'processing' && (
              <Card className="border-t-4 border-t-[var(--pos-accent)] shadow-sm">
                <CardHeader className="bg-[#F2F4F7]/50 pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-1 bg-[var(--pos-accent)] rounded-full"></div>
                    <CardTitle className="text-lg font-medium text-slate-800">
                      Generic Import — Processing
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">

                  {giError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Processing Error</AlertTitle>
                      <AlertDescription>{giError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="text-center py-8 space-y-4">
                    <div className="flex justify-center">
                      <Loader2 className="h-12 w-12 animate-spin text-[var(--pos-accent)]" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-800" data-testid="text-gi-status">{giStatusText}</p>
                      <p className="text-sm text-muted-foreground mt-1">Job ID: <span className="font-mono" data-testid="text-gi-job-id">{giJobId}</span></p>
                    </div>
                    <div className="max-w-md mx-auto">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-[var(--pos-accent)] h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(giProgressPercent, 100)}%` }}
                          data-testid="progress-gi"
                        ></div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{giProgressPercent}% complete</p>
                    </div>
                    {giPolling && (
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Checking status every 3 seconds...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {giStep === 'results' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="shadow-sm">
                    <CardContent className="py-4 px-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <FileCheck className="h-5 w-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Records</p>
                        <p className="text-xl font-bold text-slate-800" data-testid="text-gi-total">{giResults.length + giErrors.length}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="py-4 px-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-green-700" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Successful</p>
                        <p className="text-xl font-bold text-green-700" data-testid="text-gi-success">{giResults.length}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="py-4 px-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-red-700" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Errors</p>
                        <p className="text-xl font-bold text-red-700" data-testid="text-gi-errors">{giErrors.length}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {giLoadingResults && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading results...
                  </div>
                )}

                {giResults.length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader className="bg-[#F2F4F7]/50 pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <CardTitle className="text-sm font-medium text-slate-800">Successful Allocations</CardTitle>
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">{giResults.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[300px] overflow-auto hidden sm:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#F7F7F7] text-[10px] uppercase tracking-wider">
                              <TableHead>Account</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {giResults.map((r, i) => (
                              <TableRow key={i} className="text-xs" data-testid={`row-gi-result-${i}`}>
                                <TableCell className="font-mono">{r.accountNo || r.accountNumber || r.account_Number || '-'}</TableCell>
                                <TableCell>{r.accountName || r.name || r.ownerName || '-'}</TableCell>
                                <TableCell className="text-right font-mono">{r.allocatedAmount !== undefined ? `R ${Number(r.allocatedAmount).toFixed(2)}` : r.amount !== undefined ? `R ${Number(r.amount).toFixed(2)}` : '-'}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">{r.status || 'Allocated'}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="sm:hidden max-h-[300px] overflow-auto divide-y divide-[#E5E7EB]">
                        {giResults.map((r, i) => (
                          <div key={i} className="p-3 space-y-1" data-testid={`card-gi-result-${i}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-medium">{r.accountNo || r.accountNumber || r.account_Number || '-'}</span>
                              <span className="font-mono text-xs font-bold">{r.allocatedAmount !== undefined ? `R ${Number(r.allocatedAmount).toFixed(2)}` : r.amount !== undefined ? `R ${Number(r.amount).toFixed(2)}` : '-'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground truncate">{r.accountName || r.name || r.ownerName || '-'}</span>
                              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 shrink-0">{r.status || 'Allocated'}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {giErrors.length > 0 && (
                  <Card className="shadow-sm border-red-200">
                    <CardHeader className="bg-red-50/50 pb-3 border-b border-red-200">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <CardTitle className="text-sm font-medium text-red-800">Import Errors</CardTitle>
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{giErrors.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[300px] overflow-auto hidden sm:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-red-50/50 text-[10px] uppercase tracking-wider">
                              <TableHead>Account</TableHead>
                              <TableHead>Error</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {giErrors.map((e, i) => (
                              <TableRow key={i} className="text-xs" data-testid={`row-gi-error-${i}`}>
                                <TableCell className="font-mono">{e.accountNo || e.accountNumber || e.account_Number || '-'}</TableCell>
                                <TableCell className="text-red-700">{e.errorMessage || e.error || e.message || '-'}</TableCell>
                                <TableCell className="text-right font-mono">{e.allocatedAmount !== undefined ? `R ${Number(e.allocatedAmount).toFixed(2)}` : e.amount !== undefined ? `R ${Number(e.amount).toFixed(2)}` : '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="sm:hidden max-h-[300px] overflow-auto divide-y divide-[#E5E7EB]">
                        {giErrors.map((e, i) => (
                          <div key={i} className="p-3 space-y-1" data-testid={`card-gi-error-${i}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-medium">{e.accountNo || e.accountNumber || e.account_Number || '-'}</span>
                              <span className="font-mono text-xs font-bold">{e.allocatedAmount !== undefined ? `R ${Number(e.allocatedAmount).toFixed(2)}` : e.amount !== undefined ? `R ${Number(e.amount).toFixed(2)}` : '-'}</span>
                            </div>
                            <p className="text-xs text-red-700 break-words">{e.errorMessage || e.error || e.message || '-'}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!giLoadingResults && giResults.length === 0 && giErrors.length === 0 && (
                  <Card className="shadow-sm">
                    <CardContent className="py-12 text-center">
                      <FileCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No results or errors returned for this import.</p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleGenericNewImport} className="gap-2 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white h-11 sm:h-10 w-full sm:w-auto" data-testid="button-gi-new">
                    <Upload className="h-4 w-4" /> New Import
                  </Button>
                </div>
              </>
            )}

          </>)}

          </div>
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Search className="h-4 w-4" /> Search & Link Account</DialogTitle>
            <DialogDescription>Find the correct consumer account to link to this transaction.</DialogDescription>
          </DialogHeader>
          {searchIdx !== null && transactions.find(t => t.index === searchIdx) && (
            <div className="bg-[#F7F7F7] rounded-lg p-3 text-sm border mb-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-wrap gap-1"><span className="text-muted-foreground">Imported Account:</span> <span className="font-mono font-medium break-all">{transactions.find(t => t.index === searchIdx)!.importedAccountNumber}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">R {transactions.find(t => t.index === searchIdx)!.amount.toFixed(2)}</span></div>
                <div className="flex flex-wrap gap-1"><span className="text-muted-foreground">Reference:</span> <span className="font-mono break-all">{transactions.find(t => t.index === searchIdx)!.importedReference || '-'}</span></div>
                <div className="flex flex-wrap items-center gap-1"><span className="text-muted-foreground">Current Match:</span> {matchStatusBadge(transactions.find(t => t.index === searchIdx)!.matchStatus)}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">Account No</Label>
              <Input value={searchAccountNo} onChange={(e) => setSearchAccountNo(e.target.value)} placeholder="e.g. 123456" className="h-11 sm:h-8 text-sm" data-testid="input-search-account" onKeyDown={(e) => e.key === 'Enter' && handleAccountSearch()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Name</Label>
              <Input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="e.g. Smith" className="h-11 sm:h-8 text-sm" data-testid="input-search-name" onKeyDown={(e) => e.key === 'Enter' && handleAccountSearch()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Street</Label>
              <Input value={searchStreet} onChange={(e) => setSearchStreet(e.target.value)} placeholder="e.g. Main" className="h-11 sm:h-8 text-sm" data-testid="input-search-street" onKeyDown={(e) => e.key === 'Enter' && handleAccountSearch()} />
            </div>
          </div>
          <Button onClick={handleAccountSearch} disabled={searching} size="sm" className="gap-1 mb-4 h-11 sm:h-8 w-full sm:w-auto" data-testid="button-do-search">
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </Button>
          {searchResults.length > 0 ? (
            <>
              <div className="max-h-[300px] overflow-auto border rounded hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F7F7F7] text-xs">
                      <TableHead>Account</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((acc, i) => (
                      <TableRow key={i} className="text-xs cursor-pointer hover:bg-[var(--pos-accent-tint)]" onClick={() => handleSelectAccount(acc)}>
                        <TableCell className="font-mono font-medium">{acc.accountNumber || acc.accountNo || acc.account_Number || '-'}</TableCell>
                        <TableCell>{acc.ownerName || acc.name || acc.owner || '-'}</TableCell>
                        <TableCell className="truncate max-w-[200px]">{acc.propertyAddress || acc.address || acc.street || '-'}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="default" className="h-6 text-xs gap-1" data-testid={`button-select-account-${i}`}>
                            <Link2 className="h-3 w-3" /> Link
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="sm:hidden max-h-[300px] overflow-auto divide-y divide-[#E5E7EB] border rounded">
                {searchResults.map((acc, i) => (
                  <div key={i} className="p-3 space-y-2 active:bg-[var(--pos-accent-tint)]" data-testid={`card-search-result-${i}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-mono text-sm font-medium break-all">{acc.accountNumber || acc.accountNo || acc.account_Number || '-'}</div>
                        <div className="text-xs text-slate-600">{acc.ownerName || acc.name || acc.owner || '-'}</div>
                        <div className="text-xs text-muted-foreground break-words">{acc.propertyAddress || acc.address || acc.street || '-'}</div>
                      </div>
                    </div>
                    <Button size="sm" variant="default" className="h-11 w-full text-sm gap-1.5" onClick={() => handleSelectAccount(acc)} data-testid={`button-select-account-mobile-${i}`}>
                      <Link2 className="h-4 w-4" /> Link This Account
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : searching ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Enter search criteria and click Search to find accounts.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4" /> Transaction Details</DialogTitle>
            <DialogDescription>Full details for this imported transaction.</DialogDescription>
          </DialogHeader>
          {viewTxn && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-[#F7F7F7] rounded p-2.5 border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Imported Account</div>
                  <div className="font-mono font-medium">{viewTxn.importedAccountNumber}</div>
                </div>
                <div className="bg-[#F7F7F7] rounded p-2.5 border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Resolved Account</div>
                  <div className="font-mono font-medium">{viewTxn.resolvedAccountId || <span className="text-red-500 italic">Not resolved</span>}</div>
                </div>
                <div className="bg-[#F7F7F7] rounded p-2.5 border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Amount</div>
                  <div className="font-mono font-medium">R {viewTxn.amount.toFixed(2)}</div>
                </div>
                <div className="bg-[#F7F7F7] rounded p-2.5 border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Match Status</div>
                  <div>{matchStatusBadge(viewTxn.matchStatus)}</div>
                </div>
                <div className="bg-[#F7F7F7] rounded p-2.5 border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Reference</div>
                  <div className="font-mono text-xs">{viewTxn.importedReference || '-'}</div>
                </div>
                <div className="bg-[#F7F7F7] rounded p-2.5 border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Validated</div>
                  <div>{viewTxn.validated ? <Badge className="bg-green-100 text-green-800 text-[10px]">Yes</Badge> : <Badge variant="destructive" className="text-[10px]">No</Badge>}</div>
                </div>
              </div>
              <div className="bg-[#F7F7F7] rounded p-2.5 border text-sm">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Owner / Name</div>
                <div>{viewTxn.ownerName || '-'}</div>
              </div>
              <div className="bg-[#F7F7F7] rounded p-2.5 border text-sm">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Property Address</div>
                <div>{viewTxn.propertyAddress || '-'}</div>
              </div>
              {viewTxn.validationMessage && (
                <div className="bg-[#F7F7F7] rounded p-2.5 border text-sm">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Validation Message</div>
                  <div className="text-xs">{viewTxn.validationMessage}</div>
                </div>
              )}
              {viewTxn.comment && (
                <div className="bg-[#F7F7F7] rounded p-2.5 border text-sm">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Comment</div>
                  <div className="text-xs">{viewTxn.comment}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
