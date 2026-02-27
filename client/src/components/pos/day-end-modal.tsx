import React, { useState, useEffect } from 'react';
import { usePos } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2, Banknote, Coins, CreditCard, FileText, ChevronDown, ChevronUp, Mail, User, Building2, Calendar, Clock, ArrowRight, Receipt, XCircle, Archive } from 'lucide-react';
import { platinumSaveDayEndReconcileData, platinumAuthDayEndValidateCashbook, platinumAuthDayEndSubmitReconcile, platinumGetAuthDayEndCashbookList, platinumGetDayEndUnreconciledList } from '@/lib/external-api';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface DayEndModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DenominationState {
  n200: number; n100: number; n50: number; n20: number; n10: number;
  co5: number; co2: number; co1: number;
  c50: number; c20: number; c10: number; c5: number; c1: number;
}

const INITIAL_DENOMINATIONS: DenominationState = {
  n200: 0, n100: 0, n50: 0, n20: 0, n10: 0,
  co5: 0, co2: 0, co1: 0,
  c50: 0, c20: 0, c10: 0, c5: 0, c1: 0,
};

const NOTE_DENOMINATIONS = [
  { key: 'n200' as const, label: 'R200', value: 200, color: 'bg-amber-50 border-amber-200' },
  { key: 'n100' as const, label: 'R100', value: 100, color: 'bg-pink-50 border-pink-200' },
  { key: 'n50' as const, label: 'R50', value: 50, color: 'bg-red-50 border-red-200' },
  { key: 'n20' as const, label: 'R20', value: 20, color: 'bg-orange-50 border-orange-200' },
  { key: 'n10' as const, label: 'R10', value: 10, color: 'bg-green-50 border-green-200' },
];

const COIN_DENOMINATIONS = [
  { key: 'co5' as const, label: 'R5', value: 5 },
  { key: 'co2' as const, label: 'R2', value: 2 },
  { key: 'co1' as const, label: 'R1', value: 1 },
  { key: 'c50' as const, label: '50c', value: 0.50 },
  { key: 'c20' as const, label: '20c', value: 0.20 },
  { key: 'c10' as const, label: '10c', value: 0.10 },
  { key: 'c5' as const, label: '5c', value: 0.05 },
  { key: 'c1' as const, label: '1c', value: 0.01 },
];

export function DayEndModal({ isOpen, onClose }: DayEndModalProps) {
  const { platinumCashierId, platinumUser, currentUser, sessionDetails, allowedPaymentTypes, dayEndStatus } = usePos();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<'capture' | 'confirm' | 'submitting' | 'success' | 'error'>('capture');
  const [errorMessage, setErrorMessage] = useState('');

  const [denominations, setDenominations] = useState<DenominationState>(INITIAL_DENOMINATIONS);
  const [cashEntryMode, setCashEntryMode] = useState<'denominations' | 'total'>('denominations');
  const [manualCashTotal, setManualCashTotal] = useState('');
  const [totalCreditAmt, setTotalCreditAmt] = useState('');
  const [totalChequeAmt, setTotalChequeAmt] = useState('');
  const [totalPostalOrderAmt, setTotalPostalOrderAmt] = useState('');
  const [totalDropBoxAmt, setTotalDropBoxAmt] = useState('');
  const [reason, setReason] = useState('');
  const [showDenominations, setShowDenominations] = useState(true);
  const [showCheque, setShowCheque] = useState(false);
  const [showPostalOrder, setShowPostalOrder] = useState(false);
  const [showDropBox, setShowDropBox] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [receiptHistory, setReceiptHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const hasCheque = allowedPaymentTypes.some(t => t.posPaymentType_ID === 2 && t.enabled);
  const hasPostalOrder = allowedPaymentTypes.some(t => t.posPaymentType_ID === 4 && t.enabled);
  const hasDropBox = allowedPaymentTypes.some(t => (t.posPaymentType_ID === 5 || t.posPaymentTypeDesc?.toLowerCase().includes('drop')) && t.enabled);

  const resolvedUserId = platinumUser?.user_ID || Number(currentUser?.id) || 0;

  useEffect(() => {
    if (isOpen) {
      setStep('capture');
      setDenominations(INITIAL_DENOMINATIONS);
      setCashEntryMode('denominations');
      setManualCashTotal('');
      setTotalCreditAmt('');
      setTotalChequeAmt('');
      setTotalPostalOrderAmt('');
      setTotalDropBoxAmt('');
      setReason('');
      setErrorMessage('');
      setShowDenominations(true);
      setShowCheque(false);
      setShowPostalOrder(false);
      setShowDropBox(false);
      setShowHistory(false);
      setReceiptHistory([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && resolvedUserId > 0) {
      loadTransactionHistory(resolvedUserId);
    }
  }, [isOpen, resolvedUserId]);

  const loadTransactionHistory = async (userId: number) => {
    setIsLoadingHistory(true);
    try {
      const cashierId = platinumCashierId || 0;
      console.log('[DayEndModal] Fetching unreconciled receipts for cashier', cashierId);

      const unreconciledData = await platinumGetDayEndUnreconciledList(cashierId);
      const unreconciledItems = Array.isArray(unreconciledData) ? unreconciledData : (unreconciledData as any)?.data || (unreconciledData as any)?.items || (unreconciledData as any)?.value || [];

      const posItems = unreconciledItems.filter((r: any) => {
        const rNo = r.receiptNo || r.receiptNumber || r.receipt_No || '';
        if (rNo.startsWith('EFT')) return false;
        return true;
      });

      console.log('[DayEndModal] Unreconciled-list returned', posItems.length, 'POS receipts (filtered', unreconciledItems.length - posItems.length, 'EFT)');

      const allItems = posItems.map((r: any) => {
        const payType = (r.paymentType || r.paymentTypeName || r.paymentTypeDesc || '').toLowerCase();
        let paymentTypeId = 1;
        if (payType.includes('card') || payType.includes('credit') || payType.includes('debit')) paymentTypeId = 3;
        else if (payType.includes('cheque')) paymentTypeId = 2;
        else if (payType.includes('postal')) paymentTypeId = 4;
        else if (payType.includes('drop')) paymentTypeId = 5;

        const payOpt = (r.paymentOption || r.paymentOptionName || r.paymentOptionDesc || '').toLowerCase();
        const billTypeVal = String(r.billTypeID || r.billType || '');
        let billTypeID = 1;
        let isMiscPayment = 0;
        if (payOpt.includes('misc') || payOpt.includes('direct income') || billTypeVal === '4') { billTypeID = 4; isMiscPayment = 1; }
        else if (payOpt.includes('clearance') || billTypeVal === '6') { billTypeID = 6; }
        else if (payOpt.includes('prepaid') || billTypeVal === '5') { billTypeID = 5; }
        else if (payOpt.includes('group') || payOpt.includes('multiple') || billTypeVal === '3') { billTypeID = 3; }

        return {
          receiptNo: r.receiptNo || r.receiptNumber || r.receipt_No || '',
          accountNumber: r.accountNumber || r.accountNo || '-',
          paidAmount: Number(r.amount || r.paidAmount || r.tenderAmount || r.receiptAmount || 0),
          paymentTypeId,
          paymentTypeDesc: r.paymentType || r.paymentTypeName || (paymentTypeId === 3 ? 'Credit Card' : 'Cash'),
          billTypeID,
          isMiscPayment,
          isCancelled: r.isCancelled === 1 || r.isCancelled === true || r.isCanceled === 1,
          cancellationReason: r.cancellationReason || r.reasonForCancel || undefined,
          dateCaptured: r.receiptDate || r.dateCaptured || '',
          paymentOptionName: r.paymentOption || r.paymentOptionName || '',
          _source: 'unreconciled',
        };
      });

      console.log('[DayEndModal] Final receipt history:', allItems.length, 'unreconciled POS items');
      setReceiptHistory(allItems);
    } catch (e) {
      console.error('[DayEndModal] Failed to load unreconciled receipts:', e);
      setReceiptHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const updateDenomination = (key: keyof DenominationState, value: string) => {
    const num = parseInt(value) || 0;
    setDenominations(prev => ({ ...prev, [key]: Math.max(0, num) }));
  };

  const totalNotes = NOTE_DENOMINATIONS.reduce((sum, d) => sum + (denominations[d.key] * d.value), 0);
  const totalCoins = COIN_DENOMINATIONS.reduce((sum, d) => sum + (denominations[d.key] * d.value), 0);
  const denomCashAmt = totalNotes + totalCoins;
  const totalCashAmt = cashEntryMode === 'total' ? (parseFloat(manualCashTotal) || 0) : denomCashAmt;
  const creditAmt = parseFloat(totalCreditAmt) || 0;
  const chequeAmt = hasCheque ? (parseFloat(totalChequeAmt) || 0) : 0;
  const postalOrderAmt = hasPostalOrder ? (parseFloat(totalPostalOrderAmt) || 0) : 0;
  const dropBoxAmt = hasDropBox ? (parseFloat(totalDropBoxAmt) || 0) : 0;
  const grandTotal = totalCashAmt + creditAmt + chequeAmt + postalOrderAmt + dropBoxAmt;

  const getPaymentTypeLabel = (typeId: number) => {
    switch (typeId) {
      case 1: return 'Cash';
      case 3: return 'Credit Card';
      case 4: return 'Postal Order';
      default: return `Type ${typeId}`;
    }
  };

  const getBillTypeLabel = (billTypeId: number, isMisc: number | boolean, paymentOptionName?: string) => {
    if (paymentOptionName) {
      const opt = paymentOptionName.toLowerCase();
      if (opt.includes('misc') || opt.includes('direct income')) return 'Direct Income';
      if (opt.includes('clearance')) return 'Clearance';
      if (opt.includes('prepaid')) return 'Prepaid Recharge';
      if (opt.includes('group') || opt.includes('multiple')) return 'Account Grouping';
      if (opt.includes('consumer') || opt.includes('property')) return 'Consumer Services';
    }
    if (isMisc) return 'Direct Income';
    switch (billTypeId) {
      case 1: return 'Consumer Services';
      case 3: return 'Account Grouping';
      case 4: return 'Direct Income';
      case 5: return 'Prepaid Recharge';
      case 6: return 'Clearance';
      default: return `Bill Type ${billTypeId}`;
    }
  };

  const activeReceipts = receiptHistory.filter(r => !r.isCancelled);
  const systemCashTotal = activeReceipts.filter(r => r.paymentTypeId === 1).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const systemCardTotal = activeReceipts.filter(r => r.paymentTypeId === 3).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const systemChequeTotal = activeReceipts.filter(r => r.paymentTypeId === 2).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const systemPostalTotal = activeReceipts.filter(r => r.paymentTypeId === 4).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const systemDropBoxTotal = activeReceipts.filter(r => r.paymentTypeId === 5 || String(r.paymentTypeDesc || '').toLowerCase().includes('drop')).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const systemTotal = activeReceipts.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);

  const consumerServicesTotal = activeReceipts.filter(r => (r.billTypeID === 1 || r.billTypeID === 3) && !r.isMiscPayment).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const miscTotal = activeReceipts.filter(r => r.isMiscPayment || r.billTypeID === 4).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const clearanceTotal = activeReceipts.filter(r => r.billTypeID === 6 && !r.isMiscPayment).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const prepaidTotal = activeReceipts.filter(r => r.billTypeID === 5 && !r.isMiscPayment).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);

  const cashierName = platinumUser?.userName || platinumUser?.firstName ? `${platinumUser?.firstName || ''} ${platinumUser?.lastName || ''}`.trim() : currentUser?.name || 'Cashier';
  const officeName = sessionDetails?.officeDesc || 'Cash Office';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = today.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

  const handleNext = () => {
    setStep('confirm');
  };

  const handleSubmit = async () => {
    setStep('submitting');
    try {
      const userId = platinumUser?.user_ID || Number(currentUser?.id) || 213;
      const cashierId = platinumCashierId || 0;
      const finYear = platinumUser?.finYear || '2025/2026';

      const denomsToSend = cashEntryMode === 'denominations' ? denominations : INITIAL_DENOMINATIONS;

      const payload = {
        cashierId: Number(cashierId),
        reason: reason || null,
        totalCashAmt,
        totalChequeAmt: chequeAmt + postalOrderAmt + dropBoxAmt,
        totalCoins: cashEntryMode === 'denominations' ? totalCoins : 0,
        totalCreditAmt: creditAmt,
        totalAmt: grandTotal,
        n10: denomsToSend.n10,
        n20: denomsToSend.n20,
        n50: denomsToSend.n50,
        n100: denomsToSend.n100,
        n200: denomsToSend.n200,
        co1: denomsToSend.co1,
        co2: denomsToSend.co2,
        co5: denomsToSend.co5,
        c1: denomsToSend.c1,
        c5: denomsToSend.c5,
        c10: denomsToSend.c10,
        c20: denomsToSend.c20,
        c50: denomsToSend.c50,
        finyear: finYear,
      };

      console.log('[DayEndModal] Step 1: save-reconcile-data payload:', JSON.stringify(payload));
      const result = await platinumSaveDayEndReconcileData(userId, payload);
      console.log('[DayEndModal] Step 1 response:', JSON.stringify(result));

      if (result?.error || result?.isError === true || result?.success === false) {
        const errMsg = result?.error || result?.message || result?.errorMessage || 'API rejected the submission. Please check the values and try again.';
        console.error('[DayEndModal] save-reconcile-data returned error:', errMsg);
        setErrorMessage(errMsg);
        setStep('error');
        return;
      }

      try {
        console.log('[DayEndModal] Step 2: validate-cashbook for cashier', cashierId);
        await platinumAuthDayEndValidateCashbook(Number(cashierId));
        console.log('[DayEndModal] validate-cashbook passed');
      } catch (valErr: any) {
        console.warn('[DayEndModal] validate-cashbook warning (continuing):', valErr.message);
      }

      const cashierOfficeId = Number(sessionDetails?.officeId) || 1;
      let cashBookId = (platinumUser as any)?.cashBookId || (platinumUser as any)?.cashbookId || 0;
      if (!cashBookId) {
        try {
          const cashbooks = await platinumGetAuthDayEndCashbookList();
          const books = Array.isArray(cashbooks) ? cashbooks : [];
          if (books.length > 0) {
            const match = books.find((b: any) => Number(b.cashOfficeId || b.cashOffice_ID) === cashierOfficeId);
            cashBookId = match?.id || match?.cashBookId || match?.cashBook_ID || books[0]?.id || books[0]?.cashBookId || 1;
            console.log('[DayEndModal] Resolved cashBookId from cashbook-list:', cashBookId);
          } else {
            cashBookId = 1;
          }
        } catch (cbErr: any) {
          console.warn('[DayEndModal] cashbook-list fetch failed, using fallback:', cbErr.message);
          cashBookId = 1;
        }
      }
      try {
        console.log('[DayEndModal] Step 3: submit-day-auth-reconcile for cashier', cashierId, 'cashBookId', cashBookId, 'officeId', cashierOfficeId);
        await platinumAuthDayEndSubmitReconcile({ cashierId: Number(cashierId), cashBookId: Number(cashBookId), cashierOfficeId: Number(cashierOfficeId) });
        console.log('[DayEndModal] submit-day-auth-reconcile succeeded');
      } catch (subErr: any) {
        console.warn('[DayEndModal] submit-day-auth-reconcile warning (continuing):', subErr.message);
      }

      setStep('success');
      toast({ title: 'Success', description: 'Day-end reconciliation submitted for supervisor approval.' });
      if (typeof (window as any).__posEndSessionAfterDayEnd === 'function') {
        (window as any).__posEndSessionAfterDayEnd();
      }
      setTimeout(() => {
        onClose();
        setLocation('/');
      }, 1500);
    } catch (e: any) {
      console.error('[DayEndModal] API error:', e);
      setErrorMessage(e?.message || 'Failed to save reconciliation data. Please check your connection and try again.');
      setStep('error');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {dayEndStatus === 'PENDING_APPROVAL' ? (
        <DialogContent className="sm:max-w-md p-6 rounded-xl border-0 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-4 py-6">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-orange-800">Day-End Already Submitted</h3>
              <p className="text-slate-500 mt-2 text-sm">
                Your day-end reconciliation has already been submitted and is waiting for supervisor approval. You cannot modify or re-submit until the supervisor approves or returns it.
              </p>
            </div>
            <Button onClick={onClose} className="w-full" data-testid="button-close-pending">Close</Button>
          </div>
        </DialogContent>
      ) : (
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-xl border-0 shadow-2xl">
        <div className="bg-[linear-gradient(180deg,var(--pos-accent)_0%,var(--pos-accent-dark)_100%)] text-white px-6 py-5 rounded-t-xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Day End Reconciliation</h2>
              <p className="text-white/70 text-sm mt-1">Close your shift and submit figures for approval</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/70 font-medium">Cashier ID</div>
              <div className="text-sm font-bold font-mono">{platinumCashierId || '-'}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-white/70">
              <User className="w-3.5 h-3.5" />
              <span className="font-semibold text-white">{cashierName}</span>
            </span>
            <span className="flex items-center gap-1.5 text-white/70">
              <Building2 className="w-3.5 h-3.5" />
              {officeName}
            </span>
            <span className="flex items-center gap-1.5 text-white/70">
              <Calendar className="w-3.5 h-3.5" />
              {dateStr}
            </span>
            <span className="flex items-center gap-1.5 text-white/70">
              <Clock className="w-3.5 h-3.5" />
              {timeStr}
            </span>
          </div>
        </div>

        {step === 'capture' && (
          <div className="px-6 py-5 space-y-5">

            <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50/80 to-emerald-50/40 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-green-100/50 transition-colors"
                onClick={() => setShowDenominations(!showDenominations)}
                data-testid="button-toggle-denominations"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-600 text-white flex items-center justify-center shadow-sm">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-green-900">Cash On Hand</div>
                    <div className="text-[11px] text-green-600">
                      {cashEntryMode === 'denominations' ? 'Count notes and coins in your drawer' : 'Enter total cash amount'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xl font-mono font-black text-green-800" data-testid="text-cash-total">
                      R {totalCashAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  {showDenominations ? <ChevronUp className="w-4 h-4 text-green-500" /> : <ChevronDown className="w-4 h-4 text-green-500" />}
                </div>
              </button>

              {showDenominations && (
                <div className="px-5 pb-4 pt-1 border-t border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setCashEntryMode('denominations')}
                      className={`flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition-all ${cashEntryMode === 'denominations' ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-green-700 border-green-300 hover:bg-green-50'}`}
                      data-testid="button-mode-denominations"
                    >
                      <Coins className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      Count Notes & Coins
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashEntryMode('total')}
                      className={`flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition-all ${cashEntryMode === 'total' ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-green-700 border-green-300 hover:bg-green-50'}`}
                      data-testid="button-mode-total"
                    >
                      <Banknote className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      Enter Total
                    </button>
                  </div>

                  {cashEntryMode === 'total' ? (
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-green-500 font-mono font-bold text-lg">R</span>
                      <Input
                        type="number"
                        step="0.01"
                        className="pl-9 text-xl font-mono font-bold h-12 bg-white border-green-200 focus-visible:ring-green-400"
                        placeholder="0.00"
                        value={manualCashTotal}
                        onChange={(e) => setManualCashTotal(e.target.value)}
                        data-testid="input-manual-cash-total"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Banknote className="w-3.5 h-3.5 text-green-700" />
                          <span className="text-[10px] uppercase tracking-widest font-bold text-green-700">Notes</span>
                        </div>
                        <div className="space-y-1.5">
                          {NOTE_DENOMINATIONS.map(d => {
                            const subtotal = denominations[d.key] * d.value;
                            return (
                              <div key={d.key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${d.color} transition-all`}>
                                <div className="w-10 text-xs font-bold text-slate-700 shrink-0">{d.label}</div>
                                <div className="text-slate-400 text-xs shrink-0">x</div>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  placeholder="0"
                                  className="h-8 font-mono text-center text-sm bg-white/80 border-0 shadow-sm focus-visible:ring-green-400 w-16"
                                  value={denominations[d.key] || ''}
                                  onChange={(e) => updateDenomination(d.key, e.target.value)}
                                  data-testid={`input-denom-${d.key}`}
                                />
                                <div className="text-xs font-mono text-slate-500 text-right flex-1">
                                  = R {subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-right text-xs font-bold text-green-800 border-t border-green-200 pt-1.5">
                          R {totalNotes.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Coins className="w-3.5 h-3.5 text-green-700" />
                          <span className="text-[10px] uppercase tracking-widest font-bold text-green-700">Coins</span>
                        </div>
                        <div className="space-y-1.5">
                          {COIN_DENOMINATIONS.map(d => {
                            const subtotal = denominations[d.key] * d.value;
                            return (
                              <div key={d.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 transition-all">
                                <div className="w-10 text-xs font-bold text-slate-700 shrink-0">{d.label}</div>
                                <div className="text-slate-400 text-xs shrink-0">x</div>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  placeholder="0"
                                  className="h-8 font-mono text-center text-sm bg-white/80 border-0 shadow-sm focus-visible:ring-green-400 w-16"
                                  value={denominations[d.key] || ''}
                                  onChange={(e) => updateDenomination(d.key, e.target.value)}
                                  data-testid={`input-denom-${d.key}`}
                                />
                                <div className="text-xs font-mono text-slate-500 text-right flex-1">
                                  = R {subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-right text-xs font-bold text-green-800 border-t border-green-200 pt-1.5">
                          R {totalCoins.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#D6D6D6] bg-[#F7F7F7] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--pos-accent)] text-white flex items-center justify-center shadow-sm">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#2E2E2E]">Credit Card Total</div>
                  <div className="text-[11px] text-[var(--pos-accent)]">Sum of all merchant slips for this shift</div>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B] font-mono font-bold text-lg">R</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-9 text-xl font-mono font-bold h-12 bg-white border-[#D6D6D6] focus-visible:ring-[var(--pos-accent)]"
                  placeholder="0.00"
                  value={totalCreditAmt}
                  onChange={(e) => setTotalCreditAmt(e.target.value)}
                  data-testid="input-credit-total"
                />
              </div>
            </div>

            {hasPostalOrder && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setShowPostalOrder(!showPostalOrder)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-sm">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-800">Postal Order</div>
                      <div className="text-[11px] text-slate-500">Total of postal orders received</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {postalOrderAmt > 0 && (
                      <span className="text-sm font-mono font-bold text-teal-700">R {postalOrderAmt.toFixed(2)}</span>
                    )}
                    {showPostalOrder ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>
                {showPostalOrder && (
                  <div className="px-5 pb-4 pt-1 border-t">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-400 font-mono font-bold text-lg">R</span>
                      <Input
                        type="number"
                        step="0.01"
                        className="pl-9 text-xl font-mono font-bold h-12 bg-white border-teal-200 focus-visible:ring-teal-400"
                        placeholder="0.00"
                        value={totalPostalOrderAmt}
                        onChange={(e) => setTotalPostalOrderAmt(e.target.value)}
                        data-testid="input-postal-order-total"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {hasCheque && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setShowCheque(!showCheque)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-sm">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-800">Cheque</div>
                      <div className="text-[11px] text-slate-500">Total of cheques received during this shift</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {chequeAmt > 0 && (
                      <span className="text-sm font-mono font-bold text-purple-700">R {chequeAmt.toFixed(2)}</span>
                    )}
                    {showCheque ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>
                {showCheque && (
                  <div className="px-5 pb-4 pt-1 border-t">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 font-mono font-bold text-lg">R</span>
                      <Input
                        type="number"
                        step="0.01"
                        className="pl-9 text-xl font-mono font-bold h-12 bg-white border-purple-200 focus-visible:ring-purple-400"
                        placeholder="0.00"
                        value={totalChequeAmt}
                        onChange={(e) => setTotalChequeAmt(e.target.value)}
                        data-testid="input-cheque-total"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {hasDropBox && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setShowDropBox(!showDropBox)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-sm">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-800">Drop Box</div>
                      <div className="text-[11px] text-slate-500">Total of drop box payments received</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {dropBoxAmt > 0 && (
                      <span className="text-sm font-mono font-bold text-amber-700">R {dropBoxAmt.toFixed(2)}</span>
                    )}
                    {showDropBox ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>
                {showDropBox && (
                  <div className="px-5 pb-4 pt-1 border-t">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500 font-mono font-bold text-lg">R</span>
                      <Input
                        type="number"
                        step="0.01"
                        className="pl-9 text-xl font-mono font-bold h-12 bg-white border-amber-200 focus-visible:ring-amber-400"
                        placeholder="0.00"
                        value={totalDropBoxAmt}
                        onChange={(e) => setTotalDropBoxAmt(e.target.value)}
                        data-testid="input-dropbox-total"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-[#D6D6D6] overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#F7F7F7]/50 transition-colors"
                onClick={() => setShowHistory(!showHistory)}
                data-testid="button-toggle-history"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--pos-accent)] text-white flex items-center justify-center shadow-sm">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-[#2E2E2E]">Transaction History</div>
                    <div className="text-[11px] text-[#6B6B6B]">
                      {isLoadingHistory ? 'Loading...' : `${receiptHistory.length} receipt${receiptHistory.length !== 1 ? 's' : ''} this session`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {receiptHistory.length > 0 && !isLoadingHistory && (
                    <span className="text-sm font-mono font-bold text-[var(--pos-accent)]">
                      R {systemTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {showHistory ? <ChevronUp className="w-4 h-4 text-[#6B6B6B]" /> : <ChevronDown className="w-4 h-4 text-[#6B6B6B]" />}
                </div>
              </button>

              {showHistory && (
                <div className="border-t border-[#D6D6D6] bg-[#F7F7F7]/30">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-sm text-[#6B6B6B]">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading receipts...
                    </div>
                  ) : receiptHistory.length === 0 ? (
                    <div className="text-center py-6 text-sm text-slate-500">No receipts found for this session</div>
                  ) : (
                    <div className="max-h-[280px] overflow-y-auto">
                      <div className="divide-y divide-[#D6D6D6]">
                        {receiptHistory.map((item, idx) => (
                          <div key={idx} className={`px-5 py-2.5 flex items-center gap-3 ${item.isCancelled ? 'opacity-50 bg-red-50/50' : 'hover:bg-[#F7F7F7]'}`} data-testid={`receipt-row-${idx}`}>
                            <div className="w-6 text-center text-[10px] font-bold text-[#6B6B6B]">{idx + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-slate-800 truncate" data-testid={`text-receipt-no-${idx}`}>
                                  {item.receiptNo || '-'}
                                </span>
                                {item.isCancelled && (
                                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 flex items-center gap-0.5">
                                    <XCircle className="w-2.5 h-2.5" /> Cancelled
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-500 font-mono">{item.accountNumber || '-'}</span>
                                <span className="text-[10px] text-slate-400">|</span>
                                <span className="text-[10px] text-slate-500">{getBillTypeLabel(item.billTypeID, item.isMiscPayment, item.paymentOptionName)}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-sm font-mono font-bold ${item.isCancelled ? 'text-red-500 line-through' : 'text-slate-800'}`} data-testid={`text-receipt-amount-${idx}`}>
                                R {Number(item.paidAmount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {getPaymentTypeLabel(item.paymentTypeId)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-[#D6D6D6] bg-[var(--pos-accent-tint)] px-5 py-2.5 space-y-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-[#6B6B6B] font-bold mb-1">System Totals</div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--pos-accent)]">Total Cash on Hand + Drop Box</span>
                          <span className="font-mono font-bold text-[#2E2E2E]">R {(systemCashTotal + systemDropBoxTotal).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--pos-accent)]">Total Debit/Credit Card Receipts</span>
                          <span className="font-mono font-bold text-[#2E2E2E]">R {systemCardTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--pos-accent)]">Total Cheque Receipts</span>
                          <span className="font-mono font-bold text-[#2E2E2E]">R {systemChequeTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--pos-accent)]">Total Postal Order Receipts</span>
                          <span className="font-mono font-bold text-[#2E2E2E]">R {systemPostalTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="border-t border-[#D6D6D6] pt-1.5 mt-1.5 space-y-1">
                          <div className="text-[9px] uppercase tracking-wider text-[#6B6B6B] font-bold">By Category</div>
                          {consumerServicesTotal > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-[var(--pos-accent)]">Consumer Services</span>
                              <span className="font-mono font-bold text-[#2E2E2E]">R {consumerServicesTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {miscTotal > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-[var(--pos-accent)]">Direct Income (Misc)</span>
                              <span className="font-mono font-bold text-[#2E2E2E]">R {miscTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {clearanceTotal > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-[var(--pos-accent)]">Clearance</span>
                              <span className="font-mono font-bold text-[#2E2E2E]">R {clearanceTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {prepaidTotal > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-[var(--pos-accent)]">Prepaid Recharge</span>
                              <span className="font-mono font-bold text-[#2E2E2E]">R {prepaidTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between text-xs border-t border-[#D6D6D6] pt-1.5 mt-1.5">
                          <span className="text-[#2E2E2E] font-bold">Grand Total</span>
                          <span className="font-mono font-black text-[#2E2E2E]">R {systemTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="reason" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason (optional)</Label>
              <Input
                id="reason"
                type="text"
                className="mt-1.5 h-10 bg-slate-50"
                placeholder="Enter reason if there is a cash variance..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="input-reason"
              />
            </div>

            <div className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] rounded-xl p-4 shadow-lg space-y-2">
              <div className="flex justify-between items-center text-sm text-white/70">
                <span>Total Cash on Hand + Drop Box</span>
                <span className="font-mono font-bold text-white">R {(totalCashAmt + dropBoxAmt).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-white/70">
                <span>Total Debit/Credit Card Receipts</span>
                <span className="font-mono font-bold text-white">R {creditAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
              {(chequeAmt > 0 || hasCheque) && (
                <div className="flex justify-between items-center text-sm text-white/70">
                  <span>Total Cheque Receipts</span>
                  <span className="font-mono font-bold text-white">R {chequeAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {(postalOrderAmt > 0 || hasPostalOrder) && (
                <div className="flex justify-between items-center text-sm text-white/70">
                  <span>Total Postal Order Receipts</span>
                  <span className="font-mono font-bold text-white">R {postalOrderAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-white/20">
                <div className="text-[10px] uppercase tracking-widest font-medium text-white/70">Grand Total (R)</div>
                <div className="text-2xl sm:text-3xl font-mono font-black text-white" data-testid="text-grand-total">
                  R {grandTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="px-6 py-6 space-y-5">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-bold mb-1">Please confirm your submission</p>
                <p className="text-amber-700">Once submitted, these figures cannot be modified. Your supervisor will review any variances.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">{cashierName}</span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs text-slate-500">{officeName}</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-700 font-medium">Total Cash on Hand + Drop Box (R)</span>
                  </div>
                  <span className="text-base font-mono font-bold text-green-700" data-testid="text-confirm-cash">
                    {(totalCashAmt + dropBoxAmt).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[var(--pos-accent)]" />
                    <span className="text-sm text-slate-700 font-medium">Total Debit/Credit Card Receipts (R)</span>
                  </div>
                  <span className="text-base font-mono font-bold text-[var(--pos-accent)]" data-testid="text-confirm-card">
                    {creditAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-slate-700 font-medium">Total Cheque Receipts (R)</span>
                  </div>
                  <span className="text-base font-mono font-bold text-purple-700" data-testid="text-confirm-cheque">
                    {chequeAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-teal-600" />
                    <span className="text-sm text-slate-700 font-medium">Total Postal Order Receipts (R)</span>
                  </div>
                  <span className="text-base font-mono font-bold text-teal-700" data-testid="text-confirm-postal">
                    {postalOrderAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {reason && (
                <div className="text-xs text-slate-500 bg-white rounded-lg border p-2.5">
                  <span className="font-semibold text-slate-600">Reason:</span> {reason}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] rounded-xl p-4 text-center shadow-lg">
              <div className="text-[10px] uppercase tracking-widest font-medium text-white/70">Grand Total</div>
              <div className="text-3xl font-mono font-black text-white mt-1" data-testid="text-confirm-total">
                R {grandTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {step === 'submitting' && (
          <div className="px-6 py-16 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--pos-accent-tint-strong)] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--pos-accent)]" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Submitting Reconciliation</p>
              <p className="text-sm text-slate-500 mt-1">Please wait while we process your figures...</p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="px-6 py-12 flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-800">Reconciliation Submitted</h3>
              <p className="text-slate-500 mt-2 max-w-sm">
                Thank you, <span className="font-semibold text-slate-700">{cashierName}</span>. Your day-end figures have been submitted for supervisor approval.
              </p>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="px-6 py-8 space-y-4">
            <div className="bg-red-50 border border-red-200 p-5 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-bold mb-1">Submission Failed</p>
                <p className="text-red-600">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t bg-slate-50 rounded-b-xl sm:justify-between">
          {step === 'capture' && (
            <>
              <Button variant="ghost" onClick={onClose} className="text-slate-500" data-testid="button-cancel">Cancel</Button>
              <Button
                onClick={handleNext}
                className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] text-white font-bold px-6 shadow-md"
                data-testid="button-next"
              >
                Review & Confirm
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="ghost" onClick={() => setStep('capture')} className="text-slate-500" data-testid="button-back">Back to Edit</Button>
              <Button
                onClick={handleSubmit}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-6 shadow-md"
                data-testid="button-submit"
              >
                Submit & Close Shift
              </Button>
            </>
          )}
          {step === 'submitting' && (
            <Button disabled className="w-full bg-slate-200 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...
            </Button>
          )}
          {step === 'success' && (
            <Button onClick={() => { onClose(); setLocation('/cashier-setup'); }} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold shadow-md" data-testid="button-done">
              Return to Cashier Setup
            </Button>
          )}
          {step === 'error' && (
            <>
              <Button variant="ghost" onClick={() => setStep('capture')} className="text-slate-500" data-testid="button-retry-back">Back to Edit</Button>
              <Button onClick={handleSubmit} className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white font-bold px-6" data-testid="button-retry">Retry Submission</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      )}
    </Dialog>
  );
}
