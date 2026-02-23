import React, { useState, useEffect } from 'react';
import { usePos } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Loader2, Banknote, Coins, CreditCard, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { platinumSaveDayEndReconcileData } from '@/lib/external-api';
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
  { key: 'n200' as const, label: 'R200', value: 200 },
  { key: 'n100' as const, label: 'R100', value: 100 },
  { key: 'n50' as const, label: 'R50', value: 50 },
  { key: 'n20' as const, label: 'R20', value: 20 },
  { key: 'n10' as const, label: 'R10', value: 10 },
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
  const { platinumCashierId, platinumUser, currentUser } = usePos();
  const { toast } = useToast();

  const [step, setStep] = useState<'capture' | 'confirm' | 'submitting' | 'success' | 'error'>('capture');
  const [errorMessage, setErrorMessage] = useState('');

  const [denominations, setDenominations] = useState<DenominationState>(INITIAL_DENOMINATIONS);
  const [totalCreditAmt, setTotalCreditAmt] = useState('');
  const [totalChequeAmt, setTotalChequeAmt] = useState('');
  const [reason, setReason] = useState('');
  const [showDenominations, setShowDenominations] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('capture');
      setDenominations(INITIAL_DENOMINATIONS);
      setTotalCreditAmt('');
      setTotalChequeAmt('');
      setReason('');
      setErrorMessage('');
      setShowDenominations(false);
    }
  }, [isOpen]);

  const updateDenomination = (key: keyof DenominationState, value: string) => {
    const num = parseInt(value) || 0;
    setDenominations(prev => ({ ...prev, [key]: Math.max(0, num) }));
  };

  const totalNotes = NOTE_DENOMINATIONS.reduce((sum, d) => sum + (denominations[d.key] * d.value), 0);
  const totalCoins = COIN_DENOMINATIONS.reduce((sum, d) => sum + (denominations[d.key] * d.value), 0);
  const totalCashAmt = totalNotes + totalCoins;
  const creditAmt = parseFloat(totalCreditAmt) || 0;
  const chequeAmt = parseFloat(totalChequeAmt) || 0;
  const grandTotal = totalCashAmt + creditAmt + chequeAmt;

  const handleNext = () => {
    setStep('confirm');
  };

  const handleSubmit = async () => {
    setStep('submitting');
    try {
      const userId = platinumUser?.user_ID || Number(currentUser?.id) || 213;
      const cashierId = platinumCashierId || 0;
      const finYear = platinumUser?.finYear || '2025/2026';

      const payload = {
        cashierId: Number(cashierId),
        reason: reason || null,
        totalCashAmt: totalCashAmt,
        totalChequeAmt: chequeAmt,
        totalCoins: totalCoins,
        totalCreditAmt: creditAmt,
        totalAmt: grandTotal,
        n10: denominations.n10,
        n20: denominations.n20,
        n50: denominations.n50,
        n100: denominations.n100,
        n200: denominations.n200,
        co1: denominations.co1,
        co2: denominations.co2,
        co5: denominations.co5,
        c1: denominations.c1,
        c5: denominations.c5,
        c10: denominations.c10,
        c20: denominations.c20,
        c50: denominations.c50,
        finyear: finYear,
      };

      console.log('[DayEndModal] Submitting reconcile payload:', JSON.stringify(payload));
      await platinumSaveDayEndReconcileData(userId, payload);
      setStep('success');
      toast({ title: 'Success', description: 'Day-end reconciliation submitted for supervisor approval.' });
    } catch (e: any) {
      console.error('[DayEndModal] API error:', e);
      setErrorMessage(e?.message || 'Failed to save reconciliation data.');
      setStep('error');
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Day End Reconciliation</DialogTitle>
          <DialogDescription>
            Capture your physical cash, card and cheque totals to close your shift.
            <br />
            <span className="font-semibold text-yellow-600 flex items-center gap-1 mt-1 text-xs uppercase tracking-wide">
              <AlertTriangle className="w-3 h-3" />
              Blind Balancing - System totals hidden
            </span>
          </DialogDescription>
        </DialogHeader>

        {step === 'capture' && (
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-600" />
                  Cash On Hand Total
                </Label>
                <div className="text-lg font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded" data-testid="text-cash-total">
                  R {totalCashAmt.toFixed(2)}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowDenominations(!showDenominations)}
                data-testid="button-toggle-denominations"
              >
                {showDenominations ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                {showDenominations ? 'Hide' : 'Show'} Denomination Breakdown
              </Button>

              {showDenominations && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border rounded-lg p-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Notes</Label>
                    {NOTE_DENOMINATIONS.map(d => (
                      <div key={d.key} className="flex items-center gap-1.5">
                        <div className="w-11 text-xs font-medium text-right shrink-0">{d.label}</div>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          placeholder="0"
                          className="h-8 font-mono text-right text-sm"
                          value={denominations[d.key] || ''}
                          onChange={(e) => updateDenomination(d.key, e.target.value)}
                          data-testid={`input-denom-${d.key}`}
                        />
                        <div className="w-16 text-[10px] text-muted-foreground text-right font-mono">
                          R {(denominations[d.key] * d.value).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    <div className="text-xs font-bold text-right pt-1 border-t">
                      Notes: R {totalNotes.toFixed(2)}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Coins</Label>
                    {COIN_DENOMINATIONS.map(d => (
                      <div key={d.key} className="flex items-center gap-1.5">
                        <div className="w-11 text-xs font-medium text-right shrink-0">{d.label}</div>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          placeholder="0"
                          className="h-8 font-mono text-right text-sm"
                          value={denominations[d.key] || ''}
                          onChange={(e) => updateDenomination(d.key, e.target.value)}
                          data-testid={`input-denom-${d.key}`}
                        />
                        <div className="w-16 text-[10px] text-muted-foreground text-right font-mono">
                          R {(denominations[d.key] * d.value).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    <div className="text-xs font-bold text-right pt-1 border-t">
                      Coins: R {totalCoins.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit-total" className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Credit Card Total
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">R</span>
                <Input
                  id="credit-total"
                  type="number"
                  className="pl-8 text-xl font-mono font-bold h-12"
                  placeholder="0.00"
                  value={totalCreditAmt}
                  onChange={(e) => setTotalCreditAmt(e.target.value)}
                  data-testid="input-credit-total"
                />
              </div>
              <p className="text-xs text-muted-foreground">Sum of all merchant slips for this shift.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cheque-total" className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Cheque Total
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">R</span>
                <Input
                  id="cheque-total"
                  type="number"
                  className="pl-8 text-xl font-mono font-bold h-12"
                  placeholder="0.00"
                  value={totalChequeAmt}
                  onChange={(e) => setTotalChequeAmt(e.target.value)}
                  data-testid="input-cheque-total"
                />
              </div>
              <p className="text-xs text-muted-foreground">Total of all cheques received during this shift.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-semibold">Reason (optional)</Label>
              <Input
                id="reason"
                type="text"
                className="h-10"
                placeholder="Enter reason if there is a variance..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="input-reason"
              />
            </div>

            <div className="bg-slate-100 border rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-600">Grand Total</span>
                <span className="text-xl font-mono font-bold text-primary" data-testid="text-grand-total">
                  R {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="py-4 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-bold mb-1">Confirm Submission?</p>
                <p>Once submitted, you cannot modify these figures. Variances will be logged for supervisor review.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Cash</div>
                <div className="text-lg font-mono font-bold" data-testid="text-confirm-cash">R {totalCashAmt.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Card</div>
                <div className="text-lg font-mono font-bold" data-testid="text-confirm-card">R {creditAmt.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Cheque</div>
                <div className="text-lg font-mono font-bold" data-testid="text-confirm-cheque">R {chequeAmt.toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase font-bold">Grand Total</div>
              <div className="text-2xl font-mono font-bold text-primary" data-testid="text-confirm-total">R {grandTotal.toFixed(2)}</div>
            </div>

            {reason && (
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold">Reason:</span> {reason}
              </div>
            )}
          </div>
        )}

        {step === 'submitting' && (
          <div className="py-12 flex flex-col items-center text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Submitting reconciliation to Platinum API...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-green-800">Reconciliation Submitted</h3>
            <p className="text-muted-foreground max-w-xs">
              Your day end figures have been submitted to the Platinum API and sent for supervisor approval.
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="py-6 space-y-4">
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-bold mb-1">Submission Failed</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {step === 'capture' && (
            <>
              <Button variant="ghost" onClick={handleClose} data-testid="button-cancel">Cancel</Button>
              <Button
                onClick={handleNext}
                className="w-full sm:w-auto font-bold"
                data-testid="button-next"
              >
                Next: Confirm
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="ghost" onClick={() => setStep('capture')} data-testid="button-back">Back</Button>
              <Button
                onClick={handleSubmit}
                className="w-full sm:w-auto font-bold bg-yellow-600 hover:bg-yellow-700 text-white"
                data-testid="button-submit"
              >
                Submit & Close Shift
              </Button>
            </>
          )}
          {step === 'submitting' && (
            <Button disabled className="w-full">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...
            </Button>
          )}
          {step === 'success' && (
            <Button onClick={handleClose} className="w-full font-bold" data-testid="button-done">
              Return to Dashboard
            </Button>
          )}
          {step === 'error' && (
            <>
              <Button variant="ghost" onClick={() => setStep('capture')} data-testid="button-retry-back">Back to Edit</Button>
              <Button onClick={handleSubmit} className="font-bold" data-testid="button-retry">Retry</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
