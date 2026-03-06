import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@/lib/external-api';
import { usePos } from '@/lib/pos-state';

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

export default function ThirdPartyPaymentProcessing() {
  const posState = usePos();
  const [step, setStep] = useState<Step>('import');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

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
          }
        }
      })
      .catch((e) => console.error('Failed to load cashier details:', e));
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
            {step !== 'import' && (
              <Button variant="outline" onClick={handleNewImport} className="gap-2" data-testid="button-new-import">
                <ChevronLeft className="h-4 w-4" /> New Import
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6">

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
                    className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] gap-2 min-w-[150px] w-full sm:w-auto"
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-1 bg-[var(--pos-accent)] rounded-full"></div>
                        <CardTitle className="text-lg font-medium text-slate-800">
                          Imported Transactions
                          {importId && <span className="text-sm font-normal text-muted-foreground ml-2">(Import: {importId})</span>}
                        </CardTitle>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => loadTransactions()} disabled={loadingTxns} className="gap-1" data-testid="button-refresh-txns">
                          <RefreshCw className={`h-3.5 w-3.5 ${loadingTxns ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleValidateForReconcile}
                          disabled={validating || transactions.length === 0}
                          className="gap-1 text-[var(--pos-accent)] border-[#D6D6D6] hover:bg-[var(--pos-accent-tint)]"
                          data-testid="button-validate"
                        >
                          {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                          Validate
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCommit}
                          disabled={committing || transactions.length === 0 || !allValidated}
                          className="gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
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
                      <TabsList className="bg-[#F2F4F7] h-8">
                        <TabsTrigger value="all" className="text-xs h-7 px-3" data-testid="tab-all">
                          All ({counts.total})
                        </TabsTrigger>
                        <TabsTrigger value="auto-matched" className="text-xs h-7 px-3" data-testid="tab-auto-matched">
                          Auto-Matched ({counts.autoMatched})
                        </TabsTrigger>
                        <TabsTrigger value="needs-review" className="text-xs h-7 px-3" data-testid="tab-needs-review">
                          Needs Review ({counts.needsReview})
                        </TabsTrigger>
                        <TabsTrigger value="unmatched" className="text-xs h-7 px-3" data-testid="tab-unmatched">
                          Unmatched ({counts.unmatched})
                        </TabsTrigger>
                        <TabsTrigger value="ready" className="text-xs h-7 px-3" data-testid="tab-ready">
                          Ready ({counts.validated})
                        </TabsTrigger>
                      </TabsList>
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
                    <div className="overflow-x-auto">
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
                <Button onClick={handleNewImport} className="gap-2 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] mt-4" data-testid="button-start-new">
                  <Upload className="h-4 w-4" /> Start New Import
                </Button>
              </CardContent>
            </Card>
          )}
          </div>
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Search className="h-4 w-4" /> Search & Link Account</DialogTitle>
            <DialogDescription>Find the correct consumer account to link to this transaction.</DialogDescription>
          </DialogHeader>
          {searchIdx !== null && transactions.find(t => t.index === searchIdx) && (
            <div className="bg-[#F7F7F7] rounded-lg p-3 text-sm border mb-2">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Imported Account:</span> <span className="font-mono font-medium">{transactions.find(t => t.index === searchIdx)!.importedAccountNumber}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">R {transactions.find(t => t.index === searchIdx)!.amount.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Reference:</span> <span className="font-mono">{transactions.find(t => t.index === searchIdx)!.importedReference || '-'}</span></div>
                <div><span className="text-muted-foreground">Current Match:</span> {matchStatusBadge(transactions.find(t => t.index === searchIdx)!.matchStatus)}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">Account No</Label>
              <Input value={searchAccountNo} onChange={(e) => setSearchAccountNo(e.target.value)} placeholder="e.g. 123456" className="h-8 text-sm" data-testid="input-search-account" onKeyDown={(e) => e.key === 'Enter' && handleAccountSearch()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Name</Label>
              <Input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="e.g. Smith" className="h-8 text-sm" data-testid="input-search-name" onKeyDown={(e) => e.key === 'Enter' && handleAccountSearch()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Street</Label>
              <Input value={searchStreet} onChange={(e) => setSearchStreet(e.target.value)} placeholder="e.g. Main" className="h-8 text-sm" data-testid="input-search-street" onKeyDown={(e) => e.key === 'Enter' && handleAccountSearch()} />
            </div>
          </div>
          <Button onClick={handleAccountSearch} disabled={searching} size="sm" className="gap-1 mb-4" data-testid="button-do-search">
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </Button>
          {searchResults.length > 0 ? (
            <div className="max-h-[300px] overflow-auto border rounded">
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4" /> Transaction Details</DialogTitle>
            <DialogDescription>Full details for this imported transaction.</DialogDescription>
          </DialogHeader>
          {viewTxn && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
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
