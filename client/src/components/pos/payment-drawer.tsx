import React, { useState } from 'react';
import { usePos } from '@/lib/pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, CreditCard, Banknote, Trash2, Calculator, History, Lock, AlertTriangle, ChevronUp, ChevronDown, ShieldAlert } from 'lucide-react';
import { VirtualNumpad } from '@/components/ui/virtual-numpad';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayEndModal } from './day-end-modal';
import { TransactionHistoryModal } from './transaction-history-modal';

export function PaymentDrawer() {
  const { 
    payment, 
    setPaymentAmount, 
    completeTransaction, 
    transactionItems, 
    removeItem,
    dayEndStatus,
    currentTransactionLimit,
    viewMode
  } = usePos();

  const [activeInput, setActiveInput] = useState<'cash' | 'card'>('cash');
  const [inputBuffer, setInputBuffer] = useState<string>("");
  const [showDayEnd, setShowDayEnd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // Sync buffer when switching inputs or external changes (simplified)
  React.useEffect(() => {
      const val = activeInput === 'cash' ? payment.cashAmount : payment.cardAmount;
      if (val === 0 && inputBuffer === "") return; // Initial state
      if (parseFloat(inputBuffer) !== val) {
          setInputBuffer(val === 0 ? "" : val.toString());
      }
  }, [activeInput, payment.cashAmount, payment.cardAmount]);

  const isCompleteEnabled = 
    transactionItems.length > 0 && 
    payment.tenderTotal >= transactionItems.reduce((acc, i) => acc + i.amountToPay, 0) &&
    transactionItems.reduce((acc, i) => acc + i.amountToPay, 0) > 0 &&
    dayEndStatus === 'OPEN' &&
    // Check mandatory fields for Direct Income
    transactionItems.every(item => {
        if (item.type === 'DIRECT_INCOME') {
            return (!!item.paidBy && item.paidBy.trim().length > 0) && 
                   (!!item.notes && item.notes.trim().length > 0);
        }
        return true;
    }) &&
    payment.changeDue <= 200 && // Limit change to R200
    payment.tenderTotal <= currentTransactionLimit; // Check against configured limit

  const totalDue = transactionItems.reduce((acc, i) => acc + i.amountToPay, 0);

  // Numpad Logic
  const handleNumpadInput = (val: string) => {
      let newStr = inputBuffer;
      
      if (val === '.') {
          if (newStr.includes('.')) return;
          newStr = newStr === "" ? "0." : newStr + ".";
      } else {
          newStr = newStr === "0" ? val : newStr + val;
      }
      
      setInputBuffer(newStr);
      setPaymentAmount(activeInput, parseFloat(newStr) || 0);
  };

  const handleBackspace = () => {
      const newStr = inputBuffer.slice(0, -1);
      setInputBuffer(newStr);
      setPaymentAmount(activeInput, newStr === '' ? 0 : parseFloat(newStr) || 0);
  };

  const QuickAmounts = [10, 20, 50, 100, 200, 500];

  return (
    <>
    {/* Mobile Toggle Button (when collapsed) */}
    <div className={`${viewMode === 'desktop' ? 'lg:hidden' : ''} fixed bottom-0 left-0 right-0 z-40 bg-card border-t shadow-[0_-4px_10px_rgba(0,0,0,0.1)] transition-transform duration-300 ${isMobileExpanded ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="p-4 flex items-center justify-between" onClick={() => setIsMobileExpanded(true)}>
             <div>
                <div className="text-xs text-muted-foreground uppercase font-bold">Total Due</div>
                <div className="text-xl font-mono font-bold text-primary">R {totalDue.toFixed(2)}</div>
             </div>
             <Button size="lg" className="shadow-lg" onClick={(e) => { e.stopPropagation(); setIsMobileExpanded(true); }}>
                 Pay <ChevronUp className="ml-2 w-4 h-4" />
             </Button>
        </div>
    </div>

    {/* Main Drawer */}
    <aside className={`
        fixed inset-x-0 bottom-0 z-50 bg-card shadow-2xl transition-all duration-300 flex flex-col
        ${viewMode === 'desktop' ? 'lg:static lg:w-[450px] lg:h-full lg:border-l lg:border-t-0 lg:shadow-none' : ''}
        ${isMobileExpanded ? 'h-[85vh] rounded-t-2xl' : `h-0 ${viewMode === 'desktop' ? 'lg:h-full' : ''} overflow-hidden`}
    `}>
      {/* Mobile Handle */}
      <div className={`${viewMode === 'desktop' ? 'lg:hidden' : ''} w-full flex justify-center pt-2 pb-1 cursor-pointer`} onClick={() => setIsMobileExpanded(false)}>
          <div className="w-12 h-1.5 bg-muted rounded-full" />
      </div>

      <div className="p-4 lg:p-6 border-b bg-muted/30 flex justify-between items-center">
        <div>
           <h2 className="text-lg lg:text-xl font-bold tracking-tight">Payment Drawer</h2>
           <div className="flex items-center gap-2">
               <p className={`text-sm text-muted-foreground ${viewMode === 'desktop' ? 'hidden lg:block' : 'hidden'}`}>Touch-enabled checkout</p>
               {dayEndStatus === 'RECONCILED' && (
                   <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                       <Lock className="w-3 h-3" /> Shift Closed
                   </span>
               )}
           </div>
        </div>
        <div className="flex gap-2">
            <Button variant="ghost" size="icon" className={viewMode === 'desktop' ? "lg:hidden" : ""} onClick={() => setIsMobileExpanded(false)}>
                <ChevronDown className="w-6 h-6" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowHistory(true)} title="Transaction History">
                <History className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button 
                variant={dayEndStatus === 'RECONCILED' ? 'destructive' : 'outline'} 
                size="icon" 
                onClick={() => setShowDayEnd(true)} 
                title="Day End Reconciliation"
                className={dayEndStatus === 'RECONCILED' ? 'opacity-50' : ''}
            >
                <Lock className="w-5 h-5 text-muted-foreground" />
            </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="payment" className="w-full">
           <div className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-2 h-12">
                    <TabsTrigger value="items" className="text-md">Line Items ({transactionItems.length})</TabsTrigger>
                    <TabsTrigger value="payment" className="text-md">Payment</TabsTrigger>
                </TabsList>
           </div>

           <TabsContent value="items" className="p-6 space-y-4 min-h-[400px]">
                {transactionItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                    <p>No items added</p>
                    <p className="text-xs mt-1">Search to add items</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                    {transactionItems.map((item) => (
                        <div key={item.id} className="relative group flex justify-between items-center p-4 bg-background rounded-xl border shadow-sm active:border-primary transition-all active:scale-[0.99] touch-manipulation">
                            <div className="flex-1 min-w-0 pr-3">
                                <div className="font-semibold text-lg truncate leading-none mb-1">{item.description}</div>
                                <div className="text-xs text-muted-foreground font-mono">{item.reference}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="font-mono font-bold text-lg">
                                R {item.amountToPay.toFixed(2)}
                                </div>
                            </div>
                             <button 
                                onClick={() => removeItem(item.id)}
                                className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1.5 shadow-md lg:opacity-0 lg:group-hover:opacity-100 transition-opacity opacity-100"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    </div>
                )}
           </TabsContent>

           <TabsContent value="payment" className="p-6 space-y-6">
                 {/* Total Display */}
                 <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 text-center">
                    <div className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-1">Total Due</div>
                    <div className="text-4xl font-mono font-bold text-primary">R {totalDue.toFixed(2)}</div>
                 </div>

                 {totalDue > currentTransactionLimit && (
                     <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-800 flex items-center gap-3">
                         <div className="bg-red-100 p-2 rounded-full">
                            <ShieldAlert className="w-5 h-5" />
                         </div>
                         <div className="text-left">
                             <h3 className="font-bold text-sm">Limit Exceeded</h3>
                             <p className="text-xs">Transaction exceeds limit of R {currentTransactionLimit.toFixed(2)}</p>
                         </div>
                     </div>
                 )}
                 
                 {dayEndStatus === 'RECONCILED' ? (
                     <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-800 space-y-2">
                         <Lock className="w-8 h-8 mx-auto opacity-50" />
                         <h3 className="font-bold">Shift Closed</h3>
                         <p className="text-sm">Payments cannot be processed after day end reconciliation.</p>
                     </div>
                 ) : (
                 <>
                    {/* Input Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div 
                            onClick={() => setActiveInput('cash')}
                            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${activeInput === 'cash' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-transparent bg-muted hover:bg-muted/80'}`}
                        >
                            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                                <Banknote className="w-5 h-5" />
                                <span className="font-medium text-sm">Cash</span>
                            </div>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="w-full bg-transparent text-2xl font-mono font-bold focus:outline-none"
                                value={activeInput === 'cash' ? inputBuffer : (payment.cashAmount > 0 ? payment.cashAmount.toFixed(2).replace(/\.00$/, '') : "")}
                                placeholder="0"
                                onChange={(e) => {
                                    if (activeInput !== 'cash') setActiveInput('cash');
                                    const val = e.target.value;
                                    if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                                        setInputBuffer(val);
                                        setPaymentAmount('cash', parseFloat(val) || 0);
                                    }
                                }}
                                onFocus={() => setActiveInput('cash')}
                            />
                        </div>

                        <div 
                            onClick={() => setActiveInput('card')}
                            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${activeInput === 'card' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-transparent bg-muted hover:bg-muted/80'}`}
                        >
                            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                                <CreditCard className="w-5 h-5" />
                                <span className="font-medium text-sm">Card</span>
                            </div>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="w-full bg-transparent text-2xl font-mono font-bold focus:outline-none"
                                value={activeInput === 'card' ? inputBuffer : (payment.cardAmount > 0 ? payment.cardAmount.toFixed(2).replace(/\.00$/, '') : "")}
                                placeholder="0"
                                onChange={(e) => {
                                    if (activeInput !== 'card') setActiveInput('card');
                                    const val = e.target.value;
                                    if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                                        setInputBuffer(val);
                                        setPaymentAmount('card', parseFloat(val) || 0);
                                    }
                                }}
                                onFocus={() => setActiveInput('card')}
                            />
                        </div>
                    </div>
                    
                    {/* Quick Cash */}
                    <div className={`grid grid-cols-3 gap-2 ${viewMode === 'desktop' ? 'lg:hidden' : ''}`}>
                        {QuickAmounts.map(amt => (
                            <Button 
                                key={amt}
                                variant="outline"
                                className="h-12 text-lg font-mono bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                                onClick={() => setPaymentAmount(activeInput, (activeInput === 'cash' ? payment.cashAmount : payment.cardAmount) + amt)}
                            >
                                +R{amt}
                            </Button>
                        ))}
                    </div>

                    <Separator className={`${viewMode === 'desktop' ? 'lg:hidden' : ''}`} />
                    
                    {/* Virtual Numpad */}
                    <div className={`${viewMode === 'desktop' ? 'lg:hidden' : ''}`}>
                        <VirtualNumpad 
                            onInput={handleNumpadInput} 
                            onClear={handleBackspace} 
                            className="w-full"
                        />
                    </div>
                 </>
                 )}
           </TabsContent>
        </Tabs>
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-card border-t space-y-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-30 relative pb-8 lg:pb-6">
        <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground font-medium">Change Due</span>
            <div className="flex flex-col items-end">
                <span className={`font-mono text-2xl font-bold ${payment.changeDue > 200 ? 'text-destructive' : 'text-foreground'}`}>
                    R {payment.changeDue.toFixed(2)}
                </span>
                {payment.changeDue > 200 && (
                    <span className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        Max change R200.00
                    </span>
                )}
            </div>
        </div>

        {!isCompleteEnabled && transactionItems.length > 0 && transactionItems.some(item => 
            item.type === 'DIRECT_INCOME' && (!item.paidBy || item.paidBy.trim().length === 0 || !item.notes || item.notes.trim().length === 0)
        ) && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Fill in <strong>Description/Notes</strong> and <strong>Paid By</strong> for all Direct Income items</span>
            </div>
        )}

        <Button 
          className="w-full h-16 text-xl font-bold shadow-lg active:scale-[0.98] transition-all" 
          size="lg"
          disabled={!isCompleteEnabled}
          onClick={completeTransaction}
          data-testid="button-complete-transaction"
        >
          COMPLETE (R {payment.tenderTotal.toFixed(2)})
          <ArrowRight className="ml-2 w-6 h-6" />
        </Button>
      </div>
    </aside>

    {/* Backdrop for mobile */}
    {isMobileExpanded && (
        <div 
            className={`fixed inset-0 bg-black/50 z-40 ${viewMode === 'desktop' ? 'lg:hidden' : ''} backdrop-blur-sm`}
            onClick={() => setIsMobileExpanded(false)}
        />
    )}

    <DayEndModal isOpen={showDayEnd} onClose={() => setShowDayEnd(false)} />
    <TransactionHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </>
  );
}


