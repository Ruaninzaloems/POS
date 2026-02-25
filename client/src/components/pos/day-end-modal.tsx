import React, { useState, useEffect } from 'react';
import { usePos } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2, Banknote, Coins, CreditCard, FileText, ChevronDown, ChevronUp, Mail, User, Building2, Calendar, Clock, ArrowRight, Receipt, XCircle, Archive } from 'lucide-react';
import { platinumSaveDayEndReconcileData, platinumGetDayEndReconcileList } from '@/lib/external-api';
import { useToast } from '@/hooks/use-toast';

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
      const data = await platinumGetDayEndReconcileList({ userId: String(userId) });
      const items = Array.isArray(data) ? data : (data as any)?.items || (data as any)?.value || [];
      console.log('[DayEndModal] Receipt history loaded:', items.length, 'items');
      setReceiptHistory(items);
    } catch (e) {
      console.error('[DayEndModal] Failed to load receipt history:', e);
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

  const getBillTypeLabel = (billTypeId: number, isMisc: number | boolean) => {
    if (isMisc) return 'Direct Income';
    switch (billTypeId) {
      case 1: return 'Consumer Services';
      case 3: return 'Account Grouping';
      case 4: return 'Direct Income';
      case 6: return 'Clearance';
      default: return `Bill Type ${billTypeId}`;
    }
  };

  const systemCashTotal = receiptHistory.filter(r => !r.isCancelled && r.paymentTypeId === 1).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const systemCardTotal = receiptHistory.filter(r => !r.isCancelled && r.paymentTypeId === 3).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const systemTotal = receiptHistory.filter(r => !r.isCancelled).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);

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

      console.log('[DayEndModal] Submitting reconcile payload:', JSON.stringify(payload));
      const result = await platinumSaveDayEndReconcileData(userId, payload);
      console.log('[DayEndModal] API response:', JSON.stringify(result));

      if (result?.error || result?.isError === true || result?.success === false) {
        const errMsg = result?.error || result?.message || result?.errorMessage || 'API rejected the submission. Please check the values and try again.';
        console.error('[DayEndModal] API returned error in response:', errMsg);
        setErrorMessage(errMsg);
        setStep('error');
        return;
      }

      setStep('success');
      toast({ title: 'Success', description: 'Day-end reconciliation submitted for supervisor approval.' });
      if (typeof (window as any).__posEndSessionAfterDayEnd === 'function') {
        (window as any).__posEndSessionAfterDayEnd();
      }
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
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-xl border-0 shadow-2xl">
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 text-white px-6 py-5 rounded-t-xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Day End Reconciliation</h2>
              <p className="text-blue-100 text-sm mt-1">Close your shift and submit figures for approval</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 text-right">
              <div className="text-[10px] uppercase tracking-wider text-blue-200 font-medium">Cashier ID</div>
              <div className="text-sm font-bold font-mono">{platinumCashierId || '-'}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-blue-100">
              <User className="w-3.5 h-3.5" />
              <span className="font-semibold text-white">{cashierName}</span>
            </span>
            <span className="flex items-center gap-1.5 text-blue-100">
              <Building2 className="w-3.5 h-3.5" />
              {officeName}
            </span>
            <span className="flex items-center gap-1.5 text-blue-100">
              <Calendar className="w-3.5 h-3.5" />
              {dateStr}
            </span>
            <span className="flex items-center gap-1.5 text-blue-100">
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

            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-sky-50/40 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-blue-900">Credit Card Total</div>
                  <div className="text-[11px] text-blue-600">Sum of all merchant slips for this shift</div>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 font-mono font-bold text-lg">R</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-9 text-xl font-mono font-bold h-12 bg-white border-blue-200 focus-visible:ring-blue-400"
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

            <div className="rounded-xl border border-indigo-200 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-indigo-50/50 transition-colors"
                onClick={() => setShowHistory(!showHistory)}
                data-testid="button-toggle-history"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-indigo-900">Transaction History</div>
                    <div className="text-[11px] text-indigo-500">
                      {isLoadingHistory ? 'Loading...' : `${receiptHistory.length} receipt${receiptHistory.length !== 1 ? 's' : ''} this session`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {receiptHistory.length > 0 && !isLoadingHistory && (
                    <span className="text-sm font-mono font-bold text-indigo-700">
                      R {systemTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {showHistory ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
                </div>
              </button>

              {showHistory && (
                <div className="border-t border-indigo-200 bg-indigo-50/30">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-sm text-indigo-500">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading receipts...
                    </div>
                  ) : receiptHistory.length === 0 ? (
                    <div className="text-center py-6 text-sm text-slate-500">No receipts found for this session</div>
                  ) : (
                    <div className="max-h-[280px] overflow-y-auto">
                      <div className="divide-y divide-indigo-100">
                        {receiptHistory.map((item, idx) => (
                          <div key={idx} className={`px-5 py-2.5 flex items-center gap-3 ${item.isCancelled ? 'opacity-50 bg-red-50/50' : 'hover:bg-indigo-50'}`} data-testid={`receipt-row-${idx}`}>
                            <div className="w-6 text-center text-[10px] font-bold text-indigo-400">{idx + 1}</div>
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
                                <span className="text-[10px] text-slate-500">{getBillTypeLabel(item.billTypeID, item.isMiscPayment)}</span>
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

                      <div className="border-t border-indigo-200 bg-indigo-100/60 px-5 py-2.5">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-[9px] uppercase text-indigo-500 font-bold">System Cash</div>
                            <div className="text-xs font-mono font-bold text-indigo-800">R {systemCashTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-indigo-500 font-bold">System Card</div>
                            <div className="text-xs font-mono font-bold text-indigo-800">R {systemCardTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-indigo-500 font-bold">System Total</div>
                            <div className="text-xs font-mono font-bold text-indigo-900">R {systemTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                          </div>
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

            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-4 flex items-center justify-between shadow-lg">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-medium text-blue-200">Grand Total</div>
                <div className="text-xs text-blue-200 mt-0.5">Cash + Card{hasCheque ? ' + Cheque' : ''}{hasPostalOrder ? ' + Postal' : ''}{hasDropBox ? ' + Drop Box' : ''}</div>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-white" data-testid="text-grand-total">
                R {grandTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg border p-3 text-center">
                  <Banknote className="w-4 h-4 text-green-500 mx-auto mb-1" />
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Cash</div>
                  <div className="text-base font-mono font-bold text-green-700" data-testid="text-confirm-cash">
                    R {totalCashAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-white rounded-lg border p-3 text-center">
                  <CreditCard className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Card</div>
                  <div className="text-base font-mono font-bold text-blue-700" data-testid="text-confirm-card">
                    R {creditAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                {hasCheque && chequeAmt > 0 && (
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <FileText className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Cheque</div>
                    <div className="text-base font-mono font-bold text-purple-700" data-testid="text-confirm-cheque">
                      R {chequeAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {hasPostalOrder && postalOrderAmt > 0 && (
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <Mail className="w-4 h-4 text-teal-500 mx-auto mb-1" />
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Postal</div>
                    <div className="text-base font-mono font-bold text-teal-700" data-testid="text-confirm-postal">
                      R {postalOrderAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {hasDropBox && dropBoxAmt > 0 && (
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <Archive className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Drop Box</div>
                    <div className="text-base font-mono font-bold text-amber-700" data-testid="text-confirm-dropbox">
                      R {dropBoxAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
              </div>

              {reason && (
                <div className="text-xs text-slate-500 bg-white rounded-lg border p-2.5">
                  <span className="font-semibold text-slate-600">Reason:</span> {reason}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-4 text-center shadow-lg">
              <div className="text-[10px] uppercase tracking-widest font-medium text-blue-200">Grand Total</div>
              <div className="text-3xl font-mono font-black text-white mt-1" data-testid="text-confirm-total">
                R {grandTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {step === 'submitting' && (
          <div className="px-6 py-16 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
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
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold px-6 shadow-md"
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
            <Button onClick={onClose} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold shadow-md" data-testid="button-done">
              Return to Dashboard
            </Button>
          )}
          {step === 'error' && (
            <>
              <Button variant="ghost" onClick={() => setStep('capture')} className="text-slate-500" data-testid="button-retry-back">Back to Edit</Button>
              <Button onClick={handleSubmit} className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold px-6" data-testid="button-retry">Retry Submission</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      )}
    </Dialog>
  );
}
