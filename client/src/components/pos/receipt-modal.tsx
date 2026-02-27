import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Printer, Mail, MessageSquare, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { platinumPrintReceiptRaw } from '@/lib/external-api';
import { openReceiptPrintWindow, type ReceiptPrintData } from '@/lib/receipt-print';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

function buildFallbackReceiptData(txn: any, sessionDetails?: any): ReceiptPrintData {
  const rd = txn.receiptDetail || {};
  const sr = txn.splitReceipts?.[0];
  const allocs = txn.allocations || sr?.allocations || [];
  return {
    receiptNo: txn.receiptNumber || rd.receiptNo || sr?.receiptNumber || '',
    receiptDate: rd.receiptDate || rd.paymentDate || new Date().toISOString(),
    accountNumber: rd.accountId || sr?.accountId || '',
    oldAccountCode: rd.oldAccountCode || '',
    accountName: rd.accName || sr?.accountName || txn.description || '',
    sgNumber: rd.sgNumber || '',
    address: rd.accAddress || '',
    totalAmount: txn.totalAmount || rd.tenderAmount || sr?.amount || 0,
    tenderAmount: rd.tenderAmount || txn.totalAmount || sr?.amount || 0,
    changeAmount: rd.changeAmount || 0,
    outstandingBalance: rd.outstandingAmount ?? 0,
    paymentType: rd.paymentType || (sr?.paymentType === 'card' ? 'Credit Card' : 'Cash'),
    paymentOption: rd.paymentOption || 'Consumer Services',
    cashierName: rd.cashierName || '',
    cashOffice: rd.cashOffice || sessionDetails?.officeDesc || '',
    services: allocs.length > 0
      ? allocs.map((a: any) => ({ description: a.service || a.description || '', amount: a.amount ?? a.total ?? 0 }))
      : undefined,
  };
}

export function ReceiptModal() {
  const { isReceiptModalOpen, closeReceiptModal, payment, transactionItems, recentTransactions, transactionProcessing, processingStep, currentTransactionId, processingRecord, sessionDetails } = usePos();
  
  const currentTransaction = processingRecord && currentTransactionId && processingRecord.id === currentTransactionId
    ? processingRecord
    : currentTransactionId 
      ? recentTransactions.find(t => t.id === currentTransactionId) || null
      : null;

  const [printSelected, setPrintSelected] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStepRef = useRef<string>('');

  useEffect(() => {
    if (transactionProcessing) {
      if (processingStep !== prevStepRef.current) {
        prevStepRef.current = processingStep || '';
        setElapsed(0);
      }
      if (!elapsedRef.current) {
        elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      }
    } else {
      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
      setElapsed(0);
      prevStepRef.current = '';
    }
    return () => { if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; } };
  }, [transactionProcessing, processingStep]);
  const [emailSelected, setEmailSelected] = useState(false);
  const [smsSelected, setSmsSelected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [emailAddress, setEmailAddress] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  const { toast } = useToast();

  const [printError, setPrintError] = useState<string | null>(null);

  const handlePrint = useCallback(async () => {
    if (!currentTransaction) return;
    setPrintError(null);

    const receiptIds: number[] = [];
    if (currentTransaction.splitReceipts && currentTransaction.splitReceipts.length > 0) {
      for (const sr of currentTransaction.splitReceipts) {
        if (sr.receiptId && !receiptIds.includes(sr.receiptId)) {
          receiptIds.push(sr.receiptId);
        }
      }
    }

    if (receiptIds.length === 0) {
      const txnAny = currentTransaction as any;
      const altId = txnAny.receiptId || txnAny.serialNo || txnAny.receipt_ID;
      if (altId && !isNaN(Number(altId))) {
        receiptIds.push(Number(altId));
      }
    }

    if (receiptIds.length === 0) {
      const errMsg = 'No receipt IDs available. The payment was processed but no receipt identifier was returned by the billing system.';
      console.error('[ReceiptModal] ' + errMsg);
      setPrintError(errMsg);
      toast({ title: 'Print Failed', description: errMsg, variant: 'destructive' });
      return;
    }

    const receiptNos: string[] = [];
    if (currentTransaction.splitReceipts && currentTransaction.splitReceipts.length > 0) {
      for (const sr of currentTransaction.splitReceipts) {
        if (sr.receiptNumber && !receiptNos.includes(sr.receiptNumber)) {
          receiptNos.push(sr.receiptNumber);
        }
      }
    }
    if (receiptNos.length === 0 && currentTransaction.receiptNumber) {
      receiptNos.push(currentTransaction.receiptNumber);
    }

    const cashIds = currentTransaction.splitReceipts?.filter(sr => sr.paymentType === 'cash').map(sr => sr.receiptId).filter(Boolean) || [];
    const cardIds = currentTransaction.splitReceipts?.filter(sr => sr.paymentType === 'card').map(sr => sr.receiptId).filter(Boolean) || [];
    const isSplitPrint = cashIds.length > 0 && cardIds.length > 0;
    console.log(`[ReceiptModal] Printing ${isSplitPrint ? 'CONSOLIDATED split payment' : 'single'} receipt. IDs: [${receiptIds.join(', ')}], ReceiptNos: [${receiptNos.join(', ')}]${isSplitPrint ? ` (Cash: [${cashIds.join(', ')}], Card: [${cardIds.join(', ')}])` : ''}`);

    setIsPrinting(true);
    try {
      const res = await platinumPrintReceiptRaw(receiptIds, receiptNos.length > 0 ? receiptNos : undefined);
      if (!res.ok) {
        let detail = '';
        let isWrongReceipt = false;
        try { const errJson = await res.json(); detail = errJson.detail || errJson.message || ''; isWrongReceipt = !!errJson.wrongReceipt; } catch { detail = `HTTP ${res.status}`; }
        console.error('[ReceiptModal] print-receipt API failed:', res.status, detail, isWrongReceipt ? '(wrong receipt detected)' : '');
        console.log('[ReceiptModal] Attempting local receipt generation as fallback...');
        const fallbackData = buildFallbackReceiptData(currentTransaction, sessionDetails);
        if (fallbackData.receiptNo) {
          openReceiptPrintWindow(fallbackData, false);
          const toastMsg = isWrongReceipt
            ? 'The billing system returned a receipt for a different transaction — a correct receipt was generated from your transaction data.'
            : 'The billing system PDF was unavailable — a receipt was generated from your transaction data.';
          toast({ title: 'Receipt Generated Locally', description: toastMsg });
          closeReceiptModal();
          return;
        }
        const errMsg = `Receipt print failed — the billing system returned an error: ${detail || `HTTP ${res.status}`}. You can reprint from View Receipts.`;
        setPrintError(errMsg);
        toast({ title: 'Print Failed', description: errMsg, variant: 'destructive' });
        return;
      }

      const blob = await res.blob();
      if (blob.size < 100) {
        console.error('[ReceiptModal] print-receipt returned tiny response:', blob.size, 'bytes');
        console.log('[ReceiptModal] Attempting local receipt generation as fallback...');
        const fallbackData = buildFallbackReceiptData(currentTransaction, sessionDetails);
        if (fallbackData.receiptNo) {
          openReceiptPrintWindow(fallbackData, false);
          toast({ title: 'Receipt Generated Locally', description: 'The billing system returned an empty PDF — a receipt was generated from your transaction data.' });
          closeReceiptModal();
          return;
        }
        const errMsg = 'Receipt print failed — the billing system returned an empty PDF. You can reprint from View Receipts.';
        setPrintError(errMsg);
        toast({ title: 'Print Failed', description: errMsg, variant: 'destructive' });
        return;
      }
      const pdfUrl = URL.createObjectURL(blob);
      const pdfTab = window.open(pdfUrl, '_blank');
      if (!pdfTab) {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `Receipt_${currentTransaction.receiptNumber || 'print'}.pdf`;
        link.click();
      }
      closeReceiptModal();
    } catch (err: any) {
      console.error('[ReceiptModal] PDF print error:', err);
      console.log('[ReceiptModal] Attempting local receipt generation as fallback...');
      const fallbackData = buildFallbackReceiptData(currentTransaction, sessionDetails);
      if (fallbackData.receiptNo) {
        openReceiptPrintWindow(fallbackData, false);
        toast({ title: 'Receipt Generated Locally', description: 'The billing system PDF was unavailable — a receipt was generated from your transaction data.' });
        closeReceiptModal();
        return;
      }
      const errMsg = `Receipt print failed: ${err.message || 'Unknown error'}. You can reprint from View Receipts.`;
      setPrintError(errMsg);
      toast({ title: 'Print Failed', description: errMsg, variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  }, [currentTransaction, closeReceiptModal, toast]);

  useEffect(() => {
    if (isReceiptModalOpen && transactionItems.length > 0) {
        const accountItem = transactionItems.find(item => item.originalData && (item.originalData.email || item.originalData.mobile));
        
        if (accountItem) {
            const data = accountItem.originalData;
            if (data.email) {
                setEmailAddress(data.email);
            }
            if (data.mobile) {
                setMobileNumber(data.mobile);
            }
        }
    } else {
        setPrintSelected(true);
        setEmailSelected(false);
        setSmsSelected(false);
    }
  }, [isReceiptModalOpen, transactionItems]);

  const handleComplete = () => {
      console.log('Receipt Options:', {
          receiptNo: currentTransaction?.receiptNumber,
          print: printSelected,
          email: emailSelected ? emailAddress : null,
          sms: smsSelected ? mobileNumber : null
      });

      if (printSelected) {
          handlePrint();
      } else {
          closeReceiptModal();
      }
  };

  if (!currentTransaction) return null;

  const paymentFailed = !transactionProcessing && !currentTransaction.receiptNumber;
  const paymentSucceeded = !transactionProcessing && !paymentFailed;

  const isSplitPayment = payment.cashAmount > 0 && payment.cardAmount > 0;
  const splitReceipts = currentTransaction?.splitReceipts || [];
  const cashReceipts = splitReceipts.filter(sr => sr.paymentType === 'cash');
  const cardReceipts = splitReceipts.filter(sr => sr.paymentType === 'card');
  const isPartialSuccess = paymentSucceeded && isSplitPayment && cashReceipts.length > 0 && cardReceipts.length === 0;

  return (
    <Dialog open={isReceiptModalOpen} onOpenChange={(open) => !open && closeReceiptModal()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="items-center text-center space-y-3 pb-4 border-b flex-shrink-0">
          {transactionProcessing ? (
            (() => {
              const stepText = processingStep || 'Preparing payment...';
              const progressMatch = stepText.match(/(\d+)\s+of\s+(\d+)/);
              const current = progressMatch ? parseInt(progressMatch[1]) : 0;
              const total = progressMatch ? parseInt(progressMatch[2]) : 0;
              const pct = total > 0 ? Math.round((current / total) * 100) : -1;
              const dashIdx = stepText.indexOf('—');
              const acctDetail = dashIdx > -1 ? stepText.slice(dashIdx + 1).replace(/\.{3}$/, '').trim() : '';
              const phaseText = dashIdx > -1 ? stepText.slice(0, dashIdx).trim() : stepText.replace(/\.{3}$/, '').trim();

              const acctCountMatch = stepText.match(/(\d+)\s+account/);
              const acctCount = acctCountMatch ? parseInt(acctCountMatch[1]) : 0;
              const isSubmitting = stepText.toLowerCase().includes('submitting');
              const estimatedSec = isSubmitting && acctCount > 0 ? Math.ceil(acctCount * 3.2) : 0;
              const submitPct = isSubmitting && estimatedSec > 0 ? Math.min(95, Math.round((elapsed / estimatedSec) * 100)) : -1;

              return (
                <>
                  <div className="w-16 h-16 bg-[var(--pos-accent-tint-strong)] rounded-full flex items-center justify-center text-[var(--pos-accent)] mb-2 relative">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    {pct >= 0 && (
                      <span className="absolute -bottom-1 -right-1 bg-[var(--pos-accent)] text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                        {pct}%
                      </span>
                    )}
                    {submitPct >= 0 && pct < 0 && (
                      <span className="absolute -bottom-1 -right-1 bg-[var(--pos-accent)] text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                        {submitPct}%
                      </span>
                    )}
                  </div>
                  <DialogTitle className="text-xl">Processing Receipt...</DialogTitle>
                  <div className="w-full space-y-2 mt-1">
                    <p className="text-sm text-muted-foreground font-medium text-center">{phaseText}</p>
                    {acctDetail && (
                      <p className="text-xs font-semibold text-[var(--pos-accent)] text-center truncate max-w-[280px] mx-auto">{acctDetail}</p>
                    )}
                    {pct >= 0 ? (
                      <div className="px-2">
                        <Progress value={pct} className="h-2" />
                        <p className="text-[10px] text-muted-foreground text-center mt-1">{current} of {total} completed</p>
                      </div>
                    ) : submitPct >= 0 ? (
                      <div className="px-2">
                        <Progress value={submitPct} className="h-2" />
                        <p className="text-[10px] text-muted-foreground text-center mt-1">
                          ~{Math.max(0, estimatedSec - elapsed)}s remaining ({elapsed}s / ~{estimatedSec}s)
                        </p>
                      </div>
                    ) : elapsed > 2 && (
                      <p className="text-xs text-muted-foreground text-center animate-pulse">{elapsed}s elapsed</p>
                    )}
                  </div>
                </>
              );
            })()
          ) : paymentFailed ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
                <XCircle className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl text-red-600" data-testid="text-payment-failed">Payment Failed</DialogTitle>
              <DialogDescription className="text-lg text-red-500 font-medium" data-testid="text-receipt-number">
                 No receipt number was returned from the billing system. The payment was not processed successfully.
              </DialogDescription>
            </>
          ) : isPartialSuccess ? (
            <>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl text-amber-700" data-testid="text-payment-partial">Partial Payment Posted</DialogTitle>
              <DialogDescription className="text-sm text-amber-600 font-medium" data-testid="text-receipt-number">
                Cash receipt created ({currentTransaction.receiptNumber}). Card portion (R {payment.cardAmount.toFixed(2)}) failed: {currentTransaction.splitCardFailReason || 'Not accepted by the billing system.'}
              </DialogDescription>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl" data-testid="text-payment-success">Payment Successful</DialogTitle>
              <DialogDescription className="text-lg font-mono text-foreground font-medium" data-testid="text-receipt-number">
                 {currentTransaction.receiptNumber}
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        
        <div className="py-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {paymentSucceeded && (() => {
              const items = currentTransaction.items || transactionItems;
              const consumerItems = items.filter((i: TransactionItem) => i.type === 'CONSUMER_SERVICES' || i.type === 'MULTI_ACCOUNT' || i.type === 'ACCOUNT_GROUP');
              const clearanceItems = items.filter((i: TransactionItem) => i.type === 'CLEARANCE');
              const directIncomeItems = items.filter((i: TransactionItem) => i.type === 'DIRECT_INCOME');
              const hasSingleAccount = consumerItems.length === 1 && clearanceItems.length === 0 && directIncomeItems.length === 0;
              const hasMultipleAccounts = consumerItems.length > 1;

              return (
                <div className="space-y-3">
                  {hasSingleAccount && consumerItems[0] && (
                    <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Account</span>
                        <span className="font-mono font-medium">{consumerItems[0].reference}</span>
                      </div>
                      {(consumerItems[0].originalData?.accountName || consumerItems[0].originalData?.name || consumerItems[0].description) && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium truncate ml-4 text-right">{consumerItems[0].originalData?.accountName || consumerItems[0].originalData?.name || consumerItems[0].description}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {hasMultipleAccounts && (
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">{consumerItems.length} accounts processed</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {consumerItems.map((item: TransactionItem, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="font-mono text-muted-foreground">{item.reference}</span>
                            <span className="font-mono">R {item.amountToPay.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {clearanceItems.length > 0 && (
                    <div className="bg-[var(--pos-accent-tint)] rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-[var(--pos-accent)]">Clearance</p>
                      {clearanceItems.map((item: TransactionItem, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Account</span>
                            <span className="font-mono font-medium">{item.reference}</span>
                          </div>
                          {item.originalData?.costScheduleNo && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Cost Schedule</span>
                              <span className="font-mono font-medium">{item.originalData.costScheduleNo}</span>
                            </div>
                          )}
                          {item.originalData?.costScheduleDescription && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Description</span>
                              <span className="font-medium truncate ml-4 text-right">{item.originalData.costScheduleDescription}</span>
                            </div>
                          )}
                          {(item.originalData?.accountName || item.originalData?.name || item.description) && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Name</span>
                              <span className="font-medium truncate ml-4 text-right">{item.originalData?.accountName || item.originalData?.name || item.description}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {directIncomeItems.length > 0 && (
                    <div className="bg-emerald-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-emerald-700">{directIncomeItems.length} direct income item{directIncomeItems.length > 1 ? 's' : ''}</p>
                      {directIncomeItems.map((item: TransactionItem, idx: number) => {
                        const sr = splitReceipts.find(s => s.receiptDetail?.miscDescription === item.description || s.receiptDetail?.paymentOption === 'Miscellaneous Payment');
                        const detail = sr?.receiptDetail;
                        const vatRate = item.originalData?.vatRate || 15;
                        const isVatable = vatRate > 0;
                        const amtExVat = isVatable ? item.amountToPay / (1 + vatRate / 100) : item.amountToPay;
                        const vatAmt = isVatable ? item.amountToPay - amtExVat : 0;
                        const groupName = item.originalData?.groupName || item.originalData?.miscGroup || '';
                        const paidBy = item.paidBy || detail?.accName || 'Walk-in';
                        return (
                          <div key={idx} className="space-y-1 border-b border-emerald-200 pb-2 last:border-0 last:pb-0">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-emerald-800 truncate mr-2">{item.description}</span>
                              <span className="font-mono font-bold shrink-0">R {item.amountToPay.toFixed(2)}</span>
                            </div>
                            {groupName && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Group</span>
                                <span className="text-right truncate ml-4">{groupName}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Paid By</span>
                              <span className="font-medium">{paidBy}</span>
                            </div>
                            {isVatable && (
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Amount ex VAT</span>
                                <span className="font-mono">R {amtExVat.toFixed(2)}</span>
                              </div>
                            )}
                            {isVatable && vatAmt > 0 && (
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>VAT ({vatRate}%)</span>
                                <span className="font-mono">R {vatAmt.toFixed(2)}</span>
                              </div>
                            )}
                            {item.notes && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Reference</span>
                                <span className="text-right truncate ml-4">{item.notes}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-bold font-mono">R {payment.tenderTotal.toFixed(2)}</span>
            </div>
            {payment.cashAmount > 0 && payment.cardAmount > 0 && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Cash</span>
                        <span className="font-mono">R {payment.cashAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Card</span>
                        <span className="font-mono">R {payment.cardAmount.toFixed(2)}</span>
                    </div>
                </div>
            )}
            {payment.changeDue > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                    <span>Change Given</span>
                    <span className="font-bold font-mono">R {payment.changeDue.toFixed(2)}</span>
                </div>
            )}
            {splitReceipts.length > 0 && !transactionProcessing && (() => {
                const hasBothTypes = cashReceipts.length > 0 && cardReceipts.length > 0;
                const cashTotal = cashReceipts.reduce((s, sr) => s + sr.amount, 0);
                const cardTotal = cardReceipts.reduce((s, sr) => s + sr.amount, 0);
                return (
                    <div className="border-t pt-3 mt-2 space-y-2">
                        {hasBothTypes && (
                            <p className="text-xs font-semibold text-green-700 bg-green-50 rounded-md px-2 py-1 text-center">
                                Split Payment — {splitReceipts.length} receipts (consolidated print)
                            </p>
                        )}
                        {isPartialSuccess && (
                            <p className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-md px-2 py-1 text-center">
                                Only cash receipt created — card portion failed{currentTransaction.splitCardFailReason ? `: ${currentTransaction.splitCardFailReason}` : ''}
                            </p>
                        )}
                        {cashReceipts.length > 0 && (
                            <div className="text-xs space-y-0.5">
                                <p className="font-medium text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-green-500" /> Cash {hasBothTypes ? `(R ${cashTotal.toFixed(2)})` : ''}
                                </p>
                                {cashReceipts.map((sr, i) => (
                                    <div key={`cash-${i}`} className="flex justify-between pl-4">
                                        <span className="font-mono text-muted-foreground">{sr.receiptNumber}</span>
                                        <span className="font-mono">R {sr.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {cardReceipts.length > 0 && (
                            <div className="text-xs space-y-0.5">
                                <p className="font-medium text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-green-500" /> Card {hasBothTypes ? `(R ${cardTotal.toFixed(2)})` : ''}
                                </p>
                                {cardReceipts.map((sr, i) => (
                                    <div key={`card-${i}`} className="flex justify-between pl-4">
                                        <span className="font-mono text-muted-foreground">{sr.receiptNumber}</span>
                                        <span className="font-mono">R {sr.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isSplitPayment && cardReceipts.length === 0 && (
                            <div className="text-xs space-y-0.5">
                                <p className="font-medium text-red-500 flex items-center gap-1">
                                    <XCircle className="w-3 h-3" /> Card (R {payment.cardAmount.toFixed(2)}) — failed
                                </p>
                                {currentTransaction.splitCardFailReason && (
                                    <p className="text-xs text-red-400 pl-4 break-words">{currentTransaction.splitCardFailReason}</p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })()}
            
            {paymentSucceeded && <div className="mt-6 space-y-4">
                <p className="text-sm font-medium mb-2">Receipt Options</p>
                
                <div 
                    className={`flex items-center space-x-3 border p-4 rounded-xl cursor-pointer transition-colors touch-manipulation ${printSelected ? 'border-[var(--pos-accent)] bg-[var(--pos-accent-tint)] ring-1 ring-[var(--pos-accent-shadow)]' : 'border-input hover:bg-muted/50'}`}
                    onClick={() => setPrintSelected(!printSelected)}
                >
                    <Checkbox id="print-opt" checked={printSelected} onCheckedChange={(c) => setPrintSelected(!!c)} />
                    <Label htmlFor="print-opt" className="flex-1 cursor-pointer flex items-center gap-2 font-medium">
                        <Printer className="w-5 h-5 text-[var(--pos-accent)]" /> Print Receipt
                    </Label>
                </div>

                <div className={`border rounded-xl transition-all ${emailSelected ? 'border-[var(--pos-accent)] bg-[var(--pos-accent-tint)] ring-1 ring-[var(--pos-accent-shadow)]' : 'border-input'}`}>
                    <div 
                        className="flex items-center space-x-3 p-4 cursor-pointer hover:bg-muted/50 rounded-t-xl touch-manipulation"
                        onClick={() => setEmailSelected(!emailSelected)}
                    >
                        <Checkbox id="email-opt" checked={emailSelected} onCheckedChange={(c) => setEmailSelected(!!c)} />
                        <Label htmlFor="email-opt" className="flex-1 cursor-pointer flex items-center gap-2 font-medium">
                            <Mail className="w-5 h-5 text-[var(--pos-accent)]" /> Email Receipt
                        </Label>
                    </div>
                    {emailSelected && (
                        <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2">
                            <Input 
                                value={emailAddress} 
                                onChange={(e) => setEmailAddress(e.target.value)}
                                placeholder="Enter email address"
                                className="h-11 bg-white rounded-lg"
                            />
                        </div>
                    )}
                </div>

                <div className={`border rounded-xl transition-all ${smsSelected ? 'border-[var(--pos-accent)] bg-[var(--pos-accent-tint)] ring-1 ring-[var(--pos-accent-shadow)]' : 'border-input'}`}>
                    <div 
                        className="flex items-center space-x-3 p-4 cursor-pointer hover:bg-muted/50 rounded-t-xl touch-manipulation"
                        onClick={() => setSmsSelected(!smsSelected)}
                    >
                        <Checkbox id="sms-opt" checked={smsSelected} onCheckedChange={(c) => setSmsSelected(!!c)} />
                        <Label htmlFor="sms-opt" className="flex-1 cursor-pointer flex items-center gap-2 font-medium">
                            <MessageSquare className="w-5 h-5 text-[var(--pos-accent)]" /> SMS Receipt
                        </Label>
                    </div>
                    {smsSelected && (
                        <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2">
                            <Input 
                                value={mobileNumber} 
                                onChange={(e) => setMobileNumber(e.target.value)}
                                placeholder="Enter mobile number"
                                className="h-11 bg-white rounded-lg"
                            />
                        </div>
                    )}
                </div>
            </div>}

            {printError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl" data-testid="print-error-banner">
                    <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-red-800">Print Failed</p>
                            <p className="text-xs text-red-600 mt-0.5">{printError}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <DialogFooter className="sm:justify-between gap-2 border-t pt-4 flex-shrink-0">
          <Button variant="ghost" onClick={closeReceiptModal} disabled={transactionProcessing || isPrinting} className="h-12 sm:h-10 rounded-xl">Close</Button>
          {!paymentFailed && (
            <Button onClick={handleComplete} className="min-w-[140px] h-12 sm:h-10 rounded-xl bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] shadow-lg shadow-[0_1px_3px_rgba(0,0,0,0.15)] font-bold" disabled={transactionProcessing || isPrinting}>
                {transactionProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Please wait...
                  </>
                ) : isPrinting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching Receipt...
                  </>
                ) : (
                  printSelected ? 'Print & Complete' : 'Complete'
                )}
            </Button>
          )}
        </DialogFooter>
        
      </DialogContent>
    </Dialog>
  );
}
