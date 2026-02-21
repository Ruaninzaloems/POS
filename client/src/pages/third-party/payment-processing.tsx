import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, AlertCircle, CheckCircle2, Search, RefreshCw, ChevronLeft, Edit2, Save, X, Loader2, FileCheck, Send, ArrowRight, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { HelpTip } from '@/components/ui/help-tip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
} from '@/lib/external-api';
import { usePos } from '@/lib/pos-state';

interface ThirdPartyType {
  id: number;
  name: string;
  description?: string;
}

interface ImportTransaction {
  index: number;
  accountNumber: string;
  oldAccountNumber: string;
  newAccountNumber: string;
  documentNumber?: string;
  amount: number;
  reference: string;
  comment?: string;
  status: string;
  isValid: boolean;
  isDuplicate?: boolean;
  validationMessage?: string;
  ownerName?: string;
  propertyAddress?: string;
  hasAccountMismatch: boolean;
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
  } catch {}
  return rawMsg;
}

export default function ThirdPartyPaymentProcessing() {
  const posState = usePos();
  const [step, setStep] = useState<Step>('import');

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
    const finYear = posState?.platinumUser?.finYear || '2025/2026';
    if (!userId) return;
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

  const lookupCurrentAccounts = async (accountNumbers: string[]): Promise<Map<string, { accountNumber: string; accountId: string; ownerName: string; propertyAddress: string }>> => {
    const mapping = new Map<string, { accountNumber: string; accountId: string; ownerName: string; propertyAddress: string }>();
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
            const currentAccNo = result.accountNumber || '';
            const currentAccId = result.accountId || '';
            const resolvedAcct = currentAccId || currentAccNo;
            mapping.set(accNo, {
              accountNumber: currentAccNo,
              accountId: currentAccId,
              ownerName: result.ownerName || '',
              propertyAddress: result.propertyAddress || '',
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
        const fileAccounts = txns.map((t: any) => t.oldAccountNumber || t.accountNumber || t.accountNo || '');
        const migrationMap = await lookupCurrentAccounts(fileAccounts);

        const migratedEntries: { index: number; oldAcct: string; newAcct: string }[] = [];
        const builtTxns = txns.map((t: any, i: number) => {
          const oldAcct = t.oldAccountNumber || t.accountNumber || t.accountNo || '';
          const apiNewAcct = t.newAccountNumber || '';
          const lookupResult = migrationMap.get(oldAcct);
          const resolvedAcct = lookupResult ? (lookupResult.accountId || lookupResult.accountNumber || oldAcct) : (apiNewAcct || oldAcct);
          const mismatch = oldAcct !== '' && resolvedAcct !== '' && oldAcct !== resolvedAcct;
          const idx = t.index ?? i;
          if (mismatch && !apiNewAcct) {
            migratedEntries.push({ index: idx, oldAcct, newAcct: resolvedAcct });
          }
          return {
            index: idx,
            accountNumber: oldAcct,
            oldAccountNumber: oldAcct,
            newAccountNumber: resolvedAcct,
            documentNumber: t.documentNumber || '',
            amount: t.amount || 0,
            reference: t.reference || t.paymentReference || '',
            comment: mismatch ? `Changed to EMS Account: ${resolvedAcct} from Old account in file: ${oldAcct}` : (t.comment || ''),
            status: t.status || (mismatch ? 'Account Updated' : 'Pending'),
            isValid: t.isValid !== false,
            isDuplicate: t.isDuplicate || false,
            validationMessage: t.validationMessage || t.statusMessage || '',
            ownerName: lookupResult?.ownerName || t.ownerName || t.name || '',
            propertyAddress: lookupResult?.propertyAddress || t.propertyAddress || t.address || '',
            hasAccountMismatch: mismatch,
          };
        });

        setTransactions(builtTxns);

        if (migratedEntries.length > 0) {
          setLoadProgress({ step: `Auto-updating ${migratedEntries.length} migrated account(s) on server...`, percent: 96 });
          const updateBatchSize = 5;
          for (let i = 0; i < migratedEntries.length; i += updateBatchSize) {
            const batch = migratedEntries.slice(i, i + updateBatchSize);
            const updates = batch.map(entry =>
              platinumThirdPartyUpdateTransaction(useId, entry.index, {
                newAccountNumber: entry.newAcct,
                comment: `Changed to EMS Account: ${entry.newAcct} from Old account in file: ${entry.oldAcct}`,
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
    setEditAccountNo(txn.newAccountNumber || txn.accountNumber);
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
        const mismatch = txn.oldAccountNumber !== '' && editAccountNo !== '' && txn.oldAccountNumber !== editAccountNo;
        return {
          ...txn,
          newAccountNumber: editAccountNo,
          comment: editComment,
          hasAccountMismatch: mismatch,
          status: mismatch ? 'Account Updated' : txn.status,
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

  const openAccountSearch = (txnIndex: number) => {
    setSearchIdx(txnIndex);
    setSearchAccountNo("");
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
    const ownerName = account.ownerName || account.name || account.owner || '';
    const propertyAddress = account.propertyAddress || account.address || account.street || '';
    if (searchIdx !== null && importId) {
      setSearchOpen(false);
      setSavingEdit(true);
      try {
        await platinumThirdPartyUpdateTransaction(importId, searchIdx, {
          newAccountNumber: accNo,
          comment: `Reassigned to ${accNo}`,
        });
        setTransactions(prev => prev.map(txn => {
          if (txn.index !== searchIdx) return txn;
          const mismatch = txn.oldAccountNumber !== '' && accNo !== '' && txn.oldAccountNumber !== accNo;
          return {
            ...txn,
            newAccountNumber: accNo,
            comment: `Reassigned to ${accNo}`,
            ownerName: ownerName || txn.ownerName,
            propertyAddress: propertyAddress || txn.propertyAddress,
            hasAccountMismatch: mismatch,
            status: mismatch ? 'Account Updated' : txn.status,
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
    setCommitting(true);
    setCommitResult(null);
    try {
      const selectedType = thirdPartyTypes.find(t => String(t.id) === selectedTypeId);
      const result = await platinumThirdPartyCommit(importId, {
        groupId: 0,
        cashBookId: Number(cashBookId),
        paymentReference: paymentRef,
        fileName: file?.name || '',
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
  };

  const validCount = transactions.filter(t => t.isValid).length;
  const invalidCount = transactions.filter(t => !t.isValid).length;
  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <PosLayout>
      <div className="flex-1 overflow-auto bg-slate-50 p-3 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

          <div className="flex justify-between items-center">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2" data-testid="text-page-title">Third Party Payment Processing <HelpTip text="Import and process bulk payment files from banks and external payment providers." /></h1>
            {step !== 'import' && (
              <Button variant="outline" onClick={handleNewImport} className="gap-2" data-testid="button-new-import">
                <ChevronLeft className="h-4 w-4" /> New Import
              </Button>
            )}
          </div>

          {step === 'import' && (
            <Card className="border-t-4 border-t-blue-600 shadow-sm">
              <CardHeader className="bg-slate-100/50 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
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
                        className="bg-slate-50 cursor-not-allowed"
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
                      className="cursor-pointer bg-white file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                    className="bg-blue-600 hover:bg-blue-700 gap-2 min-w-[150px] w-full sm:w-auto"
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Total Transactions</p>
                  <p className="text-xl font-bold text-slate-900" data-testid="text-total-count">{transactions.length}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Valid</p>
                  <p className="text-xl font-bold text-green-600" data-testid="text-valid-count">{validCount}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Invalid</p>
                  <p className="text-xl font-bold text-red-600" data-testid="text-invalid-count">{invalidCount}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Updated Accounts</p>
                  <p className="text-xl font-bold text-blue-600" data-testid="text-migrated-count">{transactions.filter(t => t.hasAccountMismatch).length}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold text-blue-600" data-testid="text-total-amount">R {totalAmount.toFixed(2)}</p>
                </Card>
              </div>

              {transactions.some(t => t.hasAccountMismatch) && (
                <Alert className="bg-blue-50 border-blue-200">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Account Numbers Updated</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    {transactions.filter(t => t.hasAccountMismatch).length} transaction(s) had old account numbers in the import file. 
                    These have been automatically changed to the correct EMS consumer account numbers. See the Comment column for details.
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
                            {validationResult.missingCommentCount > 0 && (
                              <span className="text-orange-600 font-medium">Missing Comments: {validationResult.missingCommentCount}</span>
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
                    {commitResult.message || commitResult.error || 'Payments have been committed and allocated.'}
                  </AlertDescription>
                </Alert>
              )}

              <Card className="border-t-4 border-t-blue-600 shadow-sm">
                <CardHeader className="bg-slate-100/50 pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
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
                        className="gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
                        data-testid="button-validate"
                      >
                        {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                        Validate
                      </Button>
                      <HelpTip text="Check all imported transactions against the system before processing." />
                      <Button
                        size="sm"
                        onClick={handleCommit}
                        disabled={committing || transactions.length === 0}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                        data-testid="button-commit"
                      >
                        {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Commit & Allocate
                      </Button>
                      <HelpTip text="Post all validated transactions to the consumer accounts. This action cannot be undone." />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingTxns ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3 px-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      <div className="text-sm font-medium">{loadProgress.step || 'Loading...'}</div>
                      <div className="w-full max-w-md">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${loadProgress.percent}%` }}
                          />
                        </div>
                        <div className="text-xs text-center mt-1 text-muted-foreground">{loadProgress.percent}%</div>
                      </div>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No transactions found for this import.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="w-[50px]"><span className="flex items-center gap-1"># <HelpTip text="Row number of the imported transaction." /></span></TableHead>
                            <TableHead><span className="flex items-center gap-1">Account Number <HelpTip text="The consumer account number this payment will be allocated to." /></span></TableHead>
                            <TableHead><span className="flex items-center gap-1">Owner / Name <HelpTip text="The registered owner or account holder name." /></span></TableHead>
                            <TableHead className="text-right"><span className="flex items-center justify-end gap-1">Amount <HelpTip text="Payment amount in Rands to be allocated." /></span></TableHead>
                            <TableHead><span className="flex items-center gap-1">Reference <HelpTip text="The payment reference from the import file." /></span></TableHead>
                            <TableHead><span className="flex items-center gap-1">Comment <HelpTip text="System or user comments, including account migration notes." /></span></TableHead>
                            <TableHead><span className="flex items-center gap-1">Status <HelpTip text="Transaction status: Pending (awaiting validation), Account Updated (account number was migrated), Valid (ready to commit), or Error (needs correction)." /></span></TableHead>
                            <TableHead className="text-center w-[120px]"><span className="flex items-center justify-center gap-1">Actions <HelpTip text="Edit the account number or search for the correct account." /></span></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((txn) => (
                            <TableRow key={txn.index} className={`${!txn.isValid ? 'bg-red-50/50' : ''}`} title={!txn.isValid ? 'Transactions with errors need to be corrected or removed before committing.' : ''}>
                              <TableCell className="text-xs text-muted-foreground">{txn.index + 1}</TableCell>
                              <TableCell>
                                {editingIdx === txn.index ? (
                                  <div className="flex gap-1">
                                    <Input
                                      value={editAccountNo}
                                      onChange={(e) => setEditAccountNo(e.target.value)}
                                      className="h-7 text-xs w-36"
                                      data-testid={`input-edit-account-${txn.index}`}
                                    />
                                  </div>
                                ) : (
                                  <span className="font-mono text-sm text-blue-700 font-medium">{txn.newAccountNumber}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{txn.ownerName || '-'}</TableCell>
                              <TableCell className="text-right font-mono text-sm">R {txn.amount.toFixed(2)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{txn.reference}</TableCell>
                              <TableCell className="text-xs max-w-[220px]">
                                {txn.hasAccountMismatch ? (
                                  <span className="text-slate-600">
                                    Changed to EMS Account: {txn.newAccountNumber} from Old account in file: {txn.oldAccountNumber}
                                  </span>
                                ) : txn.comment ? (
                                  <span className="text-slate-500">{txn.comment}</span>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  {txn.isDuplicate && (
                                    <span className="flex items-center gap-0.5">
                                      <Badge variant="destructive" className="text-[10px]">
                                        Duplicate
                                      </Badge>
                                      <HelpTip text="This transaction appears to be a duplicate of another entry in the file." />
                                    </span>
                                  )}
                                  <Badge
                                    variant={txn.isValid ? "default" : "destructive"}
                                    className={`text-xs ${txn.isValid && !txn.hasAccountMismatch ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''} ${txn.isValid && txn.hasAccountMismatch ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : ''}`}
                                  >
                                    {txn.status}
                                  </Badge>
                                </div>
                                {txn.validationMessage && !txn.hasAccountMismatch && (
                                  <p className="text-xs text-red-500 mt-0.5 max-w-[200px] truncate" title={txn.validationMessage}>
                                    {txn.validationMessage}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {editingIdx === txn.index ? (
                                  <div className="flex gap-1 justify-center">
                                    <Button size="sm" variant="ghost" onClick={handleSaveEdit} disabled={savingEdit} className="h-7 w-7 p-0" data-testid={`button-save-edit-${txn.index}`}>
                                      {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-green-600" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0">
                                      <X className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 justify-center">
                                    <Button size="sm" variant="ghost" onClick={() => handleStartEdit(txn)} className="h-7 w-7 p-0" title="Edit account" data-testid={`button-edit-${txn.index}`}>
                                      <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => openAccountSearch(txn.index)} className="h-7 w-7 p-0" title="Search account" data-testid={`button-search-${txn.index}`}>
                                      <Search className="h-3.5 w-3.5 text-slate-600" />
                                    </Button>
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
                <p className="text-muted-foreground max-w-md mx-auto">
                  All valid transactions from import {importId} have been committed and allocated to their respective accounts.
                </p>
                <Button onClick={handleNewImport} className="gap-2 bg-blue-600 hover:bg-blue-700 mt-4" data-testid="button-start-new">
                  <Upload className="h-4 w-4" /> Start New Import
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search Account</DialogTitle>
            <DialogDescription>Find the correct account to assign to this transaction.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">Account No</Label>
              <Input value={searchAccountNo} onChange={(e) => setSearchAccountNo(e.target.value)} placeholder="e.g. 123456" className="h-8 text-sm" data-testid="input-search-account" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Name</Label>
              <Input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="e.g. Smith" className="h-8 text-sm" data-testid="input-search-name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Street</Label>
              <Input value={searchStreet} onChange={(e) => setSearchStreet(e.target.value)} placeholder="e.g. Main" className="h-8 text-sm" data-testid="input-search-street" />
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
                  <TableRow className="bg-slate-50 text-xs">
                    <TableHead>Account</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((acc, i) => (
                    <TableRow key={i} className="text-xs cursor-pointer hover:bg-blue-50" onClick={() => handleSelectAccount(acc)}>
                      <TableCell className="font-mono">{acc.accountNumber || acc.accountNo || acc.account_Number || '-'}</TableCell>
                      <TableCell>{acc.ownerName || acc.name || acc.owner || '-'}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{acc.propertyAddress || acc.address || acc.street || '-'}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600" data-testid={`button-select-account-${i}`}>
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : searching ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Searching...</div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Enter search criteria and click Search to find accounts.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
