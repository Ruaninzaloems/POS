import React, { useState } from 'react';
import { usePos } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Lock, RotateCcw } from 'lucide-react';

interface DayEndModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DayEndModal({ isOpen, onClose }: DayEndModalProps) {
  const { submitDayEnd, dayEndStatus, dayEndReturnReason } = usePos();
  const [cashOnHand, setCashOnHand] = useState('');
  const [cardTotal, setCardTotal] = useState('');
  const [step, setStep] = useState<'capture' | 'confirm' | 'success'>('capture');

  const handleSubmit = () => {
    if (step === 'capture') {
      setStep('confirm');
    } else if (step === 'confirm') {
      submitDayEnd({
        cashOnHand: parseFloat(cashOnHand) || 0,
        cardTotal: parseFloat(cardTotal) || 0
      });
      setStep('success');
    }
  };

  const handleClose = () => {
    if (step === 'success') {
       onClose();
       // Reset for demo purposes if needed, but in real app would stay closed
       setStep('capture');
       setCashOnHand('');
       setCardTotal('');
    } else {
       onClose();
    }
  };

  if (dayEndStatus === 'RECONCILED') {
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-6 h-6" />
                Day End Reconciled
              </DialogTitle>
              <DialogDescription>
                This shift has already been reconciled and closed by a supervisor.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <div className="bg-muted p-4 rounded-lg flex flex-col gap-2 items-center text-center">
                    <Lock className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="font-medium">Terminals are locked for this user.</p>
                </div>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Day End Reconciliation</DialogTitle>
          <DialogDescription>
            Please capture your physical cash and card totals.
            <br />
            <span className="font-semibold text-yellow-600 flex items-center gap-1 mt-1 text-xs uppercase tracking-wide">
                <AlertTriangle className="w-3 h-3" />
                Blind Balancing - System totals hidden
            </span>
          </DialogDescription>
        </DialogHeader>
        
        {/* Supervisor Return Message */}
        {dayEndReturnReason && step === 'capture' && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-2">
                <div className="flex items-start gap-3">
                    <RotateCcw className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-red-800 text-sm uppercase">Returned by Supervisor</h4>
                        <p className="text-sm text-red-700 mt-1">{dayEndReturnReason}</p>
                        <p className="text-xs text-red-600 mt-2 font-medium">Please verify your cash/card counts and resubmit.</p>
                    </div>
                </div>
            </div>
        )}

        {step === 'capture' && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="cash-total" className="text-lg font-semibold">Cash On Hand Total</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">R</span>
                <Input 
                  id="cash-total" 
                  type="number" 
                  className="pl-8 text-2xl font-mono font-bold h-14" 
                  placeholder="0.00"
                  value={cashOnHand}
                  onChange={(e) => setCashOnHand(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">Count all notes and coins in your drawer.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-total" className="text-lg font-semibold">Credit Card Total</Label>
               <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">R</span>
                <Input 
                  id="card-total" 
                  type="number" 
                  className="pl-8 text-2xl font-mono font-bold h-14" 
                  placeholder="0.00"
                  value={cardTotal}
                  onChange={(e) => setCardTotal(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">Sum of all merchant slips for this shift.</p>
            </div>
          </div>
        )}

        {step === 'confirm' && (
             <div className="py-6 space-y-4">
                 <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
                     <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                     <div className="text-sm text-yellow-800">
                         <p className="font-bold mb-1">Confirm Submission?</p>
                         <p>Once submitted, you cannot modify these figures. Variances will be logged for supervisor review.</p>
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 text-center">
                     <div className="p-3 bg-muted rounded-lg">
                         <div className="text-xs text-muted-foreground uppercase">Cash Declared</div>
                         <div className="text-xl font-mono font-bold">R {parseFloat(cashOnHand).toFixed(2)}</div>
                     </div>
                     <div className="p-3 bg-muted rounded-lg">
                         <div className="text-xs text-muted-foreground uppercase">Card Declared</div>
                         <div className="text-xl font-mono font-bold">R {parseFloat(cardTotal).toFixed(2)}</div>
                     </div>
                 </div>
             </div>
        )}

        {step === 'success' && (
            <div className="py-8 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-green-800">Reconciliation Submitted</h3>
                <p className="text-muted-foreground max-w-xs">
                    Your day end figures have been captured and sent for supervisor approval.
                </p>
            </div>
        )}

        <DialogFooter className="sm:justify-between">
           {step !== 'success' && (
               <Button variant="ghost" onClick={onClose}>Cancel</Button>
           )}
           {step === 'capture' && (
               <Button 
                onClick={handleSubmit} 
                className="w-full sm:w-auto font-bold"
                disabled={!cashOnHand || !cardTotal}
               >
                   Next: Confirm
               </Button>
           )}
           {step === 'confirm' && (
               <Button onClick={handleSubmit} className="w-full sm:w-auto font-bold bg-yellow-600 hover:bg-yellow-700 text-white">
                   Submit & Close Shift
               </Button>
           )}
           {step === 'success' && (
               <Button onClick={handleClose} className="w-full font-bold">
                   Return to Dashboard
               </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
