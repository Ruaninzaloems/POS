import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Printer, Mail, MessageSquare, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { platinumPrintReceiptRaw, platinumPrintMiscReceiptRaw } from '@/lib/external-api';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

const BASE_TIMEOUT_SECONDS = 120;
const CHUNK_SIZE = 25;
const MAX_CONCURRENT = 3;
const PER_CHUNK_TIMEOUT_SECONDS = 120;

export function ReceiptModal() {
  const { isReceiptModalOpen, closeReceiptModal, payment, transactionItems, recentTransactions, transactionProcessing, processingStep, currentTransactionId, processingRecord, sessionDetails, forceFailTransaction, siteInfo } = usePos();

  const TRANSACTION_TIMEOUT_SECONDS = useMemo(() => {
    const itemCount = transactionItems.length;
    if (itemCount <= 5) return BASE_TIMEOUT_SECONDS;
    if (itemCount > CHUNK_SIZE) {
      const numChunks = Math.ceil(itemCount / CHUNK_SIZE);
      const numRounds = Math.ceil(numChunks / MAX_CONCURRENT);
      return Math.max(BASE_TIMEOUT_SECONDS, numRounds * PER_CHUNK_TIMEOUT_SECONDS + 30);
    }
    return Math.max(BASE_TIMEOUT_SECONDS, itemCount * 8);
  }, [transactionItems.length]);
  
  const currentTransaction = processingRecord && currentTransactionId && processingRecord.id === currentTransactionId
    ? processingRecord
    : currentTransactionId 
      ? recentTransactions.find(t => t.id === currentTransactionId) || null
      : null;

  const [printSelected, setPrintSelected] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStepRef = useRef<string>('');
  const [totalElapsed, setTotalElapsed] = useState(0);
  const totalElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutFiredRef = useRef(false);

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

  useEffect(() => {
    if (transactionProcessing) {
      setTotalElapsed(0);
      setTimedOut(false);
      timeoutFiredRef.current = false;
      totalElapsedRef.current = setInterval(() => {
        setTotalElapsed(prev => {
          const next = prev + 1;
          if (next >= TRANSACTION_TIMEOUT_SECONDS) {
            setTimedOut(true);
          }
          return next;
        });
      }, 1000);
    } else {
      if (totalElapsedRef.current) { clearInterval(totalElapsedRef.current); totalElapsedRef.current = null; }
      setTotalElapsed(0);
      setTimedOut(false);
      timeoutFiredRef.current = false;
    }
    return () => { if (totalElapsedRef.current) { clearInterval(totalElapsedRef.current); totalElapsedRef.current = null; } };
  }, [transactionProcessing]);

  useEffect(() => {
    if (timedOut && transactionProcessing && forceFailTransaction && !timeoutFiredRef.current) {
      timeoutFiredRef.current = true;
      console.error(`[ReceiptModal] Transaction timed out after ${TRANSACTION_TIMEOUT_SECONDS}s (${transactionItems.length} items) — forcing failure`);
      forceFailTransaction(`Transaction timed out after ${Math.floor(TRANSACTION_TIMEOUT_SECONDS / 60)}+ minutes (${transactionItems.length} accounts). The payment may not have completed on the server. Please check View Receipts before retrying.`);
    }
  }, [timedOut, transactionProcessing, forceFailTransaction]);
  const [emailSelected, setEmailSelected] = useState(false);
  const [smsSelected, setSmsSelected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [consolidatedSelected, setConsolidatedSelected] = useState(false);
  
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

    const isMiscReceipt = currentTransaction.splitReceipts?.some(sr => sr.receiptDetail?.paymentOption === 'Miscellaneous Payment') ||
      (transactionItems.length > 0 && transactionItems.every((i: TransactionItem) => i.type === 'DIRECT_INCOME'));
    console.log(`[ReceiptModal] Printing ${isMiscReceipt ? 'MISC' : isSplitPrint ? 'CONSOLIDATED split payment' : 'single'} receipt. IDs: [${receiptIds.join(', ')}], ReceiptNos: [${receiptNos.join(', ')}]${isSplitPrint ? ` (Cash: [${cashIds.join(', ')}], Card: [${cardIds.join(', ')}])` : ''}`);

    setIsPrinting(true);
    try {
      let finalBlob: Blob | null = null;

      if (isMiscReceipt) {
        for (const rid of receiptIds) {
          console.log(`[ReceiptModal] Using print-miscellaneous-receipt for misc receipt id=${rid}`);
          try {
            const miscRes = await platinumPrintMiscReceiptRaw(rid);
            if (miscRes.ok) {
              const b = await miscRes.blob();
              if (b.size >= 100) {
                const pdfUrl = URL.createObjectURL(b);
                const printFrame = document.createElement('iframe');
                printFrame.style.position = 'fixed';
                printFrame.style.top = '-10000px';
                printFrame.style.left = '-10000px';
                printFrame.style.width = '0';
                printFrame.style.height = '0';
                printFrame.src = pdfUrl;
                document.body.appendChild(printFrame);
                printFrame.onload = () => {
                  try { printFrame.contentWindow?.print(); } catch { window.open(pdfUrl, '_blank'); }
                  setTimeout(() => { document.body.removeChild(printFrame); URL.revokeObjectURL(pdfUrl); }, 60000);
                };
                if (!finalBlob) finalBlob = b;
              } else {
                console.warn(`[ReceiptModal] print-miscellaneous-receipt returned tiny PDF (${b.size} bytes) for id=${rid}`);
              }
            } else {
              let detail = '';
              try { const errJson = await miscRes.json(); detail = errJson.detail || errJson.message || ''; } catch { detail = `HTTP ${miscRes.status}`; }
              console.warn(`[ReceiptModal] print-miscellaneous-receipt failed for id=${rid}: ${detail}`);
            }
          } catch (e: any) {
            console.warn(`[ReceiptModal] print-miscellaneous-receipt error for id=${rid}: ${e.message}`);
          }
        }
        if (finalBlob) {
          closeReceiptModal();
          setIsPrinting(false);
          return;
        }
        console.warn(`[ReceiptModal] All misc receipt prints failed, falling back to print-receipt`);
      }

      if (!finalBlob) {
        const res = await platinumPrintReceiptRaw(receiptIds, receiptNos.length > 0 ? receiptNos : undefined);
        if (!res.ok) {
          let detail = '';
          try { const errJson = await res.json(); detail = errJson.detail || errJson.message || ''; } catch { detail = `HTTP ${res.status}`; }
          console.error('[ReceiptModal] print-receipt API failed:', res.status, detail);
          const errMsg = `Receipt print failed — the billing system returned an error: ${detail || `HTTP ${res.status}`}. You can reprint from View Receipts.`;
          setPrintError(errMsg);
          toast({ title: 'Print Failed', description: errMsg, variant: 'destructive' });
          return;
        }
        finalBlob = await res.blob();
        if (!finalBlob || finalBlob.size < 100) {
          console.error('[ReceiptModal] print-receipt returned tiny response:', finalBlob?.size, 'bytes');
          const errMsg = 'Receipt print failed — the billing system returned an empty PDF. You can reprint from View Receipts.';
          setPrintError(errMsg);
          toast({ title: 'Print Failed', description: errMsg, variant: 'destructive' });
          return;
        }
      }
      const pdfUrl = URL.createObjectURL(finalBlob);
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.top = '-10000px';
      printFrame.style.left = '-10000px';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.src = pdfUrl;
      document.body.appendChild(printFrame);
      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.print();
        } catch {
          window.open(pdfUrl, '_blank');
        }
        setTimeout(() => {
          document.body.removeChild(printFrame);
          URL.revokeObjectURL(pdfUrl);
        }, 60000);
      };
      closeReceiptModal();
    } catch (err: any) {
      console.error('[ReceiptModal] PDF print error:', err);
      const errMsg = `Receipt print failed: ${err.message || 'Unknown error'}. You can reprint from View Receipts.`;
      setPrintError(errMsg);
      toast({ title: 'Print Failed', description: errMsg, variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  }, [currentTransaction, transactionItems, closeReceiptModal, toast]);

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
        setConsolidatedSelected(false);
    }
  }, [isReceiptModalOpen, transactionItems]);

  const handlePrintConsolidated = useCallback(() => {
    if (!currentTransaction) return;
    const items = currentTransaction.items || transactionItems;
    const consumerItems = items.filter((i: TransactionItem) => i.type === 'CONSUMER_SERVICES' || i.type === 'MULTI_ACCOUNT' || i.type === 'ACCOUNT_GROUP');
    const clearanceItems = items.filter((i: TransactionItem) => i.type === 'CLEARANCE');
    const directIncomeItems = items.filter((i: TransactionItem) => i.type === 'DIRECT_INCOME');
    const prepaidItems = items.filter((i: TransactionItem) => i.type === 'PREPAID');
    const srs = currentTransaction.splitReceipts || [];
    const cashRecs = srs.filter(sr => sr.paymentType === 'cash');
    const cardRecs = srs.filter(sr => sr.paymentType === 'card');
    const hasBoth = cashRecs.length > 0 && cardRecs.length > 0;
    const cashierName = sessionDetails?.cashierName || currentTransaction.splitReceipts?.[0]?.receiptDetail?.cashierName || '';
    const cashOffice = sessionDetails?.officeDesc || currentTransaction.splitReceipts?.[0]?.receiptDetail?.cashOffice || '';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    const r = (n: number) => `R ${n.toFixed(2)}`;
    const line = (l: string, v: string) => `<tr><td style="text-align:left">${l}</td><td style="text-align:right;white-space:nowrap">${v}</td></tr>`;
    const sep = () => '<tr><td colspan="2" style="border-bottom:1px dashed #000;padding:2px 0"></td></tr>';
    const heading = (t: string) => `<tr><td colspan="2" style="font-weight:bold;text-align:left;padding:6px 0 2px">${t}</td></tr>`;

    let rows = '';
    const siteName = siteInfo?.name || cashOffice || 'Municipality';
    rows += `<tr><td colspan="2" style="text-align:center;font-weight:bold;font-size:14px;padding-bottom:2px">${siteName}</td></tr>`;
    rows += `<tr><td colspan="2" style="text-align:center;font-size:10px;padding-bottom:6px">Consolidated Receipt</td></tr>`;
    rows += sep();
    rows += line('Receipt No', currentTransaction.receiptNumber || '');
    rows += line('Date', `${dateStr} ${timeStr}`);
    if (cashierName) rows += line('Cashier', cashierName);
    if (cashOffice) rows += line('Cash Office', cashOffice);
    rows += sep();

    if (consumerItems.length > 0) {
      rows += heading(`${consumerItems.length} Account${consumerItems.length > 1 ? 's' : ''}`);
      consumerItems.forEach((item: TransactionItem) => {
        rows += line(item.reference || 'Account', r(item.amountToPay));
        const name = item.originalData?.accountName || item.originalData?.name || item.description;
        if (name) rows += `<tr><td colspan="2" style="font-size:10px;color:#555;padding-left:4px">${name}</td></tr>`;
      });
      rows += sep();
    }

    if (clearanceItems.length > 0) {
      rows += heading('Clearance');
      clearanceItems.forEach((item: TransactionItem) => {
        rows += line(item.reference || 'Clearance', r(item.amountToPay));
        if (item.originalData?.costScheduleNo) rows += `<tr><td colspan="2" style="font-size:10px;color:#555;padding-left:4px">CS: ${item.originalData.costScheduleNo}</td></tr>`;
      });
      rows += sep();
    }

    if (directIncomeItems.length > 0) {
      rows += heading(`${directIncomeItems.length} Direct Income`);
      directIncomeItems.forEach((item: TransactionItem) => {
        const groupName = item.originalData?.groupName || item.originalData?.miscGroup || '';
        const vatRate = item.originalData?.vatRate || 15;
        const isVatable = vatRate > 0;
        const amtExVat = isVatable ? item.amountToPay / (1 + vatRate / 100) : item.amountToPay;
        const vatAmt = isVatable ? item.amountToPay - amtExVat : 0;
        const paidBy = item.paidBy || 'Walk-in';

        rows += `<tr><td style="text-align:left;font-weight:bold;font-size:11px">${item.description || ''}</td><td style="text-align:right;font-weight:bold">${r(item.amountToPay)}</td></tr>`;
        if (groupName) rows += line('  Group', groupName);
        rows += line('  Paid By', paidBy);
        if (isVatable) {
          rows += line('  Amount ex VAT', r(amtExVat));
          if (vatAmt > 0) rows += line(`  VAT (${vatRate}%)`, r(vatAmt));
        }
        if (item.notes) rows += line('  Reference', item.notes);
      });
      rows += sep();
    }

    if (prepaidItems.length > 0) {
      rows += heading(`${prepaidItems.length} Prepaid`);
      prepaidItems.forEach((item: TransactionItem) => {
        const isWater = item.originalData?.prepaidType === 'Water';
        rows += line(`${isWater ? 'Water' : 'Electricity'} - ${item.reference}`, r(item.amountToPay));
      });
      rows += sep();
    }

    rows += `<tr><td style="text-align:left;font-weight:bold;font-size:13px;padding:4px 0">Total Paid</td><td style="text-align:right;font-weight:bold;font-size:13px">${r(payment.tenderTotal)}</td></tr>`;
    if (payment.cashAmount > 0 && payment.cardAmount > 0) {
      rows += line('Cash', r(payment.cashAmount));
      rows += line('Card', r(payment.cardAmount));
    }
    if (payment.changeDue > 0) {
      rows += line('Change', r(payment.changeDue));
    }
    rows += sep();

    if (srs.length > 0) {
      if (hasBoth) {
        rows += `<tr><td colspan="2" style="text-align:center;font-size:10px;font-weight:bold;padding:4px 0">Split Payment — ${srs.length} of ${srs.length} receipts</td></tr>`;
      }
      if (cashRecs.length > 0) {
        const cashTotal = cashRecs.reduce((s, sr) => s + sr.amount, 0);
        rows += `<tr><td colspan="2" style="font-size:10px;font-weight:bold;padding:4px 0 1px">Cash ${hasBoth ? `(${r(cashTotal)})` : ''}</td></tr>`;
        cashRecs.forEach(sr => {
          rows += `<tr><td style="font-size:10px;font-family:monospace;padding-left:4px">${sr.receiptNumber}</td><td style="text-align:right;font-size:10px;font-family:monospace">${r(sr.amount)}</td></tr>`;
        });
      }
      if (cardRecs.length > 0) {
        const cardTotal = cardRecs.reduce((s, sr) => s + sr.amount, 0);
        rows += `<tr><td colspan="2" style="font-size:10px;font-weight:bold;padding:4px 0 1px">Card ${hasBoth ? `(${r(cardTotal)})` : ''}</td></tr>`;
        cardRecs.forEach(sr => {
          rows += `<tr><td style="font-size:10px;font-family:monospace;padding-left:4px">${sr.receiptNumber}</td><td style="text-align:right;font-size:10px;font-family:monospace">${r(sr.amount)}</td></tr>`;
        });
      }
      rows += sep();
    }

    rows += `<tr><td colspan="2" style="text-align:center;padding:8px 0 4px;font-size:11px">Thank you.</td></tr>`;

    const html = `<!DOCTYPE html><html><head><style>
@page { margin: 0; size: 80mm auto; }
@media print { body { margin: 0; } }
body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 72mm; margin: 0 auto; padding: 4mm; }
table { width: 100%; border-collapse: collapse; }
td { padding: 1px 0; vertical-align: top; font-size: 11px; }
</style></head><body><table>${rows}</table></body></html>`;

    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 300);
    }
  }, [currentTransaction, transactionItems, payment, sessionDetails, siteInfo]);

  const handleComplete = () => {
      console.log('Receipt Options:', {
          receiptNo: currentTransaction?.receiptNumber,
          print: printSelected,
          consolidated: consolidatedSelected,
          email: emailSelected ? emailAddress : null,
          sms: smsSelected ? mobileNumber : null
      });

      if (consolidatedSelected) {
          handlePrintConsolidated();
      }

      if (printSelected) {
          handlePrint();
      } else if (!consolidatedSelected) {
          closeReceiptModal();
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
    <Dialog open={isReceiptModalOpen} onOpenChange={(open) => { if (!open && !transactionProcessing && !isPrinting) closeReceiptModal(); }}>
      <DialogContent className="max-w-[100vw] sm:max-w-md h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden rounded-none sm:rounded-lg border-0 sm:border" hideCloseButton={transactionProcessing || isPrinting} preventClose={transactionProcessing || isPrinting}>
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
                      <p className="text-xs font-semibold text-[var(--pos-accent)] text-center mx-auto break-words">{acctDetail}</p>
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
                 {currentTransaction.declineReason || 'No receipt number was returned from the billing system. The payment was not processed successfully.'}
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
              {splitReceipts.length > 1 && (
                <p className="text-xs text-muted-foreground mt-1">{splitReceipts.length} of {splitReceipts.length} receipts</p>
              )}
              {splitReceipts.length === 1 && (
                <p className="text-xs text-muted-foreground mt-1">1 of 1 receipt</p>
              )}
            </>
          )}
        </DialogHeader>
        
        <div className="py-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {paymentSucceeded && (() => {
              const items = currentTransaction.items || transactionItems;
              const consumerItems = items.filter((i: TransactionItem) => i.type === 'CONSUMER_SERVICES' || i.type === 'MULTI_ACCOUNT' || i.type === 'ACCOUNT_GROUP');
              const clearanceItems = items.filter((i: TransactionItem) => i.type === 'CLEARANCE');
              const directIncomeItems = items.filter((i: TransactionItem) => i.type === 'DIRECT_INCOME');
              const prepaidItems = items.filter((i: TransactionItem) => i.type === 'PREPAID');
              const hasSingleAccount = consumerItems.length === 1 && clearanceItems.length === 0 && directIncomeItems.length === 0 && prepaidItems.length === 0;
              const hasMultipleAccounts = consumerItems.length > 1;

              return (
                <div className="space-y-3">
                  {hasSingleAccount && consumerItems[0] && (
                    <div className="bg-[#F7F7F7] rounded-lg p-3 space-y-1">
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
                    <div className="bg-[#F7F7F7] rounded-lg p-3 space-y-2">
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
                  {prepaidItems.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-700">{prepaidItems.length} prepaid recharge{prepaidItems.length > 1 ? 's' : ''}</p>
                      {prepaidItems.map((item: TransactionItem, idx: number) => {
                        const isWater = item.originalData?.prepaidType === 'Water';
                        return (
                          <div key={idx} className="space-y-1 border-b border-amber-200 pb-2 last:border-0 last:pb-0">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-amber-800">{isWater ? 'Water' : 'Electricity'} Prepaid</span>
                              <span className="font-mono font-bold">R {item.amountToPay.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Meter</span>
                              <span className="font-mono font-medium">{item.reference}</span>
                            </div>
                            {(item.originalData?.name || item.description) && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Customer</span>
                                <span className="font-medium truncate ml-4 text-right">{item.originalData?.name || item.description}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {currentTransaction.vendingData && (() => {
                        const vd = currentTransaction.vendingData;
                        const isPerMeter = typeof vd === 'object' && !Array.isArray(vd);
                        return (
                          <div className="bg-amber-100 rounded-md p-2 mt-1 space-y-1">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 mb-1">Token / Vending Data</p>
                            {isPerMeter ? (
                              Object.entries(vd).map(([meter, token]: [string, any]) => (
                                <div key={meter} className="space-y-0.5">
                                  <p className="text-[10px] text-amber-600">Meter: {meter}</p>
                                  <p className="text-xs font-mono font-bold text-amber-900 break-all" data-testid={`text-vending-token-${meter}`}>
                                    {typeof token === 'string' ? token : JSON.stringify(token)}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs font-mono font-bold text-amber-900 break-all" data-testid="text-vending-token">
                                {typeof vd === 'string' ? vd : JSON.stringify(vd)}
                              </p>
                            )}
                          </div>
                        );
                      })()}
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
                                Split Payment — {splitReceipts.length} of {splitReceipts.length} receipts (consolidated print)
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

                <div 
                    className={`flex items-center space-x-3 border p-4 rounded-xl cursor-pointer transition-colors touch-manipulation ${consolidatedSelected ? 'border-[var(--pos-accent)] bg-[var(--pos-accent-tint)] ring-1 ring-[var(--pos-accent-shadow)]' : 'border-input hover:bg-muted/50'}`}
                    onClick={() => setConsolidatedSelected(!consolidatedSelected)}
                >
                    <Checkbox id="consolidated-opt" checked={consolidatedSelected} onCheckedChange={(c) => setConsolidatedSelected(!!c)} />
                    <Label htmlFor="consolidated-opt" className="flex-1 cursor-pointer flex items-center gap-2 font-medium">
                        <Printer className="w-5 h-5 text-[var(--pos-accent)]" /> Print Consolidated Receipt
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

        {transactionProcessing ? (
          <div className="border-t pt-3 flex-shrink-0">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Do not close this window — transaction in progress ({totalElapsed}s{transactionItems.length > 5 ? ` / ~${Math.ceil(TRANSACTION_TIMEOUT_SECONDS / 60)}min max` : ''})</span>
            </div>
          </div>
        ) : (
          <DialogFooter className="sm:justify-between gap-2 border-t pt-4 flex-shrink-0">
            <Button variant="ghost" onClick={closeReceiptModal} disabled={isPrinting} className="h-12 sm:h-10 rounded-xl" data-testid="button-close-receipt">Close</Button>
            {!paymentFailed && (
              <Button onClick={handleComplete} className="min-w-[140px] h-12 sm:h-10 rounded-xl bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] shadow-lg shadow-[0_1px_3px_rgba(0,0,0,0.15)] font-bold" disabled={isPrinting} data-testid="button-complete-receipt">
                  {isPrinting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Fetching Receipt...
                    </>
                  ) : (
                    (printSelected || consolidatedSelected) ? 'Print & Complete' : 'Complete'
                  )}
              </Button>
            )}
          </DialogFooter>
        )}
        
      </DialogContent>
    </Dialog>
  );
}
