import React, { useState } from 'react';
import { usePos } from '@/lib/pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, CreditCard, Banknote, Trash2, Calculator, History, Lock, AlertTriangle, ChevronUp, ChevronDown, ShieldAlert, X } from 'lucide-react';
import { VirtualNumpad } from '@/components/ui/virtual-numpad';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayEndModal } from './day-end-modal';
import { TransactionHistoryModal } from './transaction-history-modal';
import { HelpTip } from '@/components/ui/help-tip';

export function PaymentDrawer() {
  const { 
    payment, 
    setPaymentAmount, 
    setCardReference,
    completeTransaction, 
    transactionItems, 
    removeItem,
    dayEndStatus,
    viewMode,
    isPaymentTypeAllowed
  } = usePos();

  const cashAllowed = isPaymentTypeAllowed(1);
  const cardAllowed = isPaymentTypeAllowed(3);
  const defaultInput = cashAllowed ? 'cash' : cardAllowed ? 'card' : 'cash';
  const [activeInput, setActiveInput] = useState<'cash' | 'card'>(defaultInput);
  const [inputBuffer, setInputBuffer] = useState<string>("");
  const [showDayEnd, setShowDayEnd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  React.useEffect(() => {
      if (!cashAllowed && activeInput === 'cash' && cardAllowed) setActiveInput('card');
      if (!cardAllowed && activeInput === 'card' && cashAllowed) setActiveInput('cash');
  }, [cashAllowed, cardAllowed]);

  React.useEffect(() => {
      if (!cashAllowed && payment.cashAmount > 0) setPaymentAmount('cash', 0);
      if (!cardAllowed && payment.cardAmount > 0) setPaymentAmount('card', 0);
  }, [cashAllowed, cardAllowed]);

  React.useEffect(() => {
      const val = activeInput === 'cash' ? payment.cashAmount : payment.cardAmount;
      if (val === 0 && inputBuffer === "") return;
      if (parseFloat(inputBuffer) !== val) {
          setInputBuffer(val === 0 ? "" : val.toString());
      }
  }, [activeInput, payment.cashAmount, payment.cardAmount]);

  const isCompleteEnabled = 
    transactionItems.length > 0 && 
    payment.tenderTotal >= transactionItems.reduce((acc, i) => acc + i.amountToPay, 0) &&
    transactionItems.reduce((acc, i) => acc + i.amountToPay, 0) > 0 &&
    dayEndStatus === 'OPEN' &&
    transactionItems.every(item => {
        if (item.type === 'DIRECT_INCOME') {
            return (!!item.paidBy && item.paidBy.trim().length > 0) && 
                   (!!item.notes && item.notes.trim().length > 0);
        }
        return true;
    }) &&
    payment.changeDue <= 200;

  const totalDue = transactionItems.reduce((acc, i) => acc + i.amountToPay, 0);

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
    {/* Mobile Bottom Bar (collapsed state) */}
    <div className={`${viewMode === 'desktop' ? 'lg:hidden' : ''} fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transition-transform duration-300 ${isMobileExpanded ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="px-4 py-3 flex items-center justify-between gap-3" onClick={() => setIsMobileExpanded(true)}>
             <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 shrink-0">
                  <Banknote className="w-5 h-5 text-white/80" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Total Due</div>
                  <div className="text-lg font-mono font-bold text-white leading-tight">R {totalDue.toFixed(2)}</div>
                </div>
             </div>
             <div className="flex items-center gap-2">
                {transactionItems.length > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {transactionItems.length} item{transactionItems.length !== 1 ? 's' : ''}
                  </span>
                )}
                <Button size="default" className="bg-white text-blue-900 hover:bg-white/90 shadow-lg font-bold rounded-xl h-10 px-5 active:scale-95 transition-transform" onClick={(e) => { e.stopPropagation(); setIsMobileExpanded(true); }}>
                    Pay <ChevronUp className="ml-1.5 w-4 h-4" />
                </Button>
             </div>
        </div>
    </div>

    {/* Main Drawer */}
    <aside className={`
        fixed inset-x-0 bottom-0 z-50 bg-white border-l border-slate-200/80 shadow-2xl transition-all duration-300 ease-out flex flex-col
        ${viewMode === 'desktop' ? 'lg:static lg:w-[420px] xl:w-[450px] lg:h-full lg:border-l lg:border-t-0 lg:shadow-none' : ''}
        ${isMobileExpanded ? 'h-[90vh] rounded-t-3xl' : `h-0 ${viewMode === 'desktop' ? 'lg:h-full' : ''} overflow-hidden`}
    `}>
      {/* Mobile Swipe Handle + Header */}
      <div className={`${viewMode === 'desktop' ? 'lg:hidden' : ''} shrink-0`}>
        <div className="w-full flex justify-center pt-2 pb-0 cursor-pointer" onClick={() => setIsMobileExpanded(false)}>
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">Payment</h2>
            {dayEndStatus === 'RECONCILED' && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-bold">
                <Lock className="w-2.5 h-2.5" /> Closed
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => setShowHistory(true)}>
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => setShowDayEnd(true)}>
              <Lock className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => setIsMobileExpanded(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className={`${viewMode === 'desktop' ? 'hidden lg:flex' : 'hidden'} p-4 lg:p-5 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100/50 justify-between items-center shrink-0`}>
        <div>
           <h2 className="text-lg lg:text-xl font-bold tracking-tight text-slate-800 flex items-center gap-1.5">Payment Drawer <HelpTip text="Enter cash and/or card amounts to pay for items in your basket. The system calculates change automatically." /></h2>
           <p className="text-sm text-muted-foreground">Touch-enabled checkout</p>
        </div>
        <div className="flex gap-2">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <Tabs defaultValue="payment" className="w-full">
           <div className="px-4 lg:px-6 pt-2 lg:pt-4 shrink-0">
                <TabsList className="grid w-full grid-cols-2 bg-slate-100/80 rounded-xl p-1 h-10 lg:h-11">
                    <TabsTrigger value="items" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 rounded-lg text-xs sm:text-sm font-medium gap-1">Items ({transactionItems.length}) <HelpTip text="View and manage items in your current transaction basket." size="sm" /></TabsTrigger>
                    <TabsTrigger value="payment" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 rounded-lg text-xs sm:text-sm font-medium">Payment</TabsTrigger>
                </TabsList>
           </div>

           <TabsContent value="items" className="p-4 lg:p-6 space-y-3 lg:space-y-4">
                {transactionItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 lg:h-48 text-muted-foreground border-2 border-dashed border-blue-200/50 rounded-2xl bg-blue-50/20">
                      <Banknote className="w-8 h-8 text-blue-300 mb-2" />
                      <p className="text-sm font-medium">No items added</p>
                      <p className="text-xs mt-0.5 text-slate-400">Search to add items to basket</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                    {transactionItems.map((item) => (
                        <div key={item.id} className="relative group flex justify-between items-center p-3 lg:p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all hover:border-blue-200/50 active:scale-[0.99] touch-manipulation">
                            <div className="flex-1 min-w-0 pr-3">
                                <div className="font-semibold text-sm lg:text-lg truncate leading-tight mb-0.5">{item.description}</div>
                                <div className="text-[11px] text-muted-foreground font-mono">{item.reference}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="font-mono font-bold text-sm lg:text-lg">
                                R {item.amountToPay.toFixed(2)}
                                </div>
                            </div>
                             <button 
                                onClick={() => removeItem(item.id)}
                                className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-1 lg:p-1.5 shadow-md lg:opacity-0 lg:group-hover:opacity-100 transition-opacity opacity-100"
                            >
                                <Trash2 className="w-3 h-3 lg:w-4 lg:h-4" />
                            </button>
                        </div>
                    ))}
                    </div>
                )}
           </TabsContent>

           <TabsContent value="payment" className="p-4 lg:p-6 space-y-3 lg:space-y-5">
                 {/* Total Display - Compact on mobile */}
                 <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-blue-100/50 text-center">
                    <div className="text-blue-600/80 uppercase tracking-widest font-bold text-[10px] lg:text-xs mb-0.5 lg:mb-1 flex items-center justify-center gap-1">TOTAL DUE <HelpTip text="The sum of all items in your basket, rounded to the nearest 10 cents." /></div>
                    <div className="text-3xl lg:text-5xl font-mono font-bold text-blue-700">R {totalDue.toFixed(2)}</div>
                 </div>

                 {dayEndStatus === 'RECONCILED' ? (
                     <div className="bg-red-50 border border-red-200 rounded-xl p-4 lg:p-6 text-center text-red-800 space-y-2">
                         <Lock className="w-6 h-6 lg:w-8 lg:h-8 mx-auto opacity-50" />
                         <h3 className="font-bold text-sm lg:text-base">Shift Closed</h3>
                         <p className="text-xs lg:text-sm">Payments cannot be processed after day end reconciliation.</p>
                     </div>
                 ) : (
                 <>
                    {!cashAllowed && !cardAllowed && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-amber-800 text-xs">
                            <AlertTriangle className="w-4 h-4 mx-auto mb-1 opacity-70" />
                            No payment types enabled. Contact your supervisor.
                        </div>
                    )}

                    {/* Cash / Card Input - Compact on mobile */}
                    <div className={`grid gap-2 lg:gap-4 ${cashAllowed && cardAllowed ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {cashAllowed && (
                        <div 
                            onClick={() => setActiveInput('cash')}
                            className={`p-3 lg:p-4 rounded-xl border-2 text-left transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${activeInput === 'cash' ? 'border-green-500 bg-green-50/40 ring-2 ring-green-200/50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'}`}
                        >
                            <div className={`flex items-center gap-1.5 mb-0.5 ${activeInput === 'cash' ? 'text-green-600' : 'text-muted-foreground'}`}>
                                <Banknote className="w-4 h-4" />
                                <span className="font-semibold text-xs uppercase tracking-wide">Cash</span>
                            </div>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="w-full bg-transparent text-xl lg:text-2xl font-mono font-bold focus:outline-none placeholder:text-slate-300"
                                value={activeInput === 'cash' ? inputBuffer : (payment.cashAmount > 0 ? payment.cashAmount.toFixed(2).replace(/\.00$/, '') : "")}
                                placeholder="0.00"
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
                        )}

                        {cardAllowed && (
                        <div 
                            onClick={() => setActiveInput('card')}
                            className={`p-3 lg:p-4 rounded-xl border-2 text-left transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${activeInput === 'card' ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-200/50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'}`}
                        >
                            <div className={`flex items-center gap-1.5 mb-0.5 ${activeInput === 'card' ? 'text-blue-600' : 'text-muted-foreground'}`}>
                                <CreditCard className="w-4 h-4" />
                                <span className="font-semibold text-xs uppercase tracking-wide">Card</span>
                            </div>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="w-full bg-transparent text-xl lg:text-2xl font-mono font-bold focus:outline-none placeholder:text-slate-300"
                                value={activeInput === 'card' ? inputBuffer : (payment.cardAmount > 0 ? payment.cardAmount.toFixed(2).replace(/\.00$/, '') : "")}
                                placeholder="0.00"
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
                        )}
                    </div>

                    {payment.cardAmount > 0 && (
                        <div>
                            <Label className="text-[10px] lg:text-xs text-muted-foreground mb-1 flex items-center gap-1">Card Reference <HelpTip text="Enter the last 4 digits of the card or the slip number from the card machine for audit tracking." /></Label>
                            <Input
                                type="text"
                                placeholder="e.g. last 4 digits or slip number"
                                value={payment.cardReference}
                                onChange={(e) => setCardReference(e.target.value)}
                                className="h-9 lg:h-10 font-mono text-sm"
                                data-testid="input-card-reference"
                            />
                        </div>
                    )}
                    
                    {/* Quick Cash - compact grid on mobile */}
                    {activeInput === 'cash' && cashAllowed && (
                    <div className={`grid grid-cols-3 gap-1.5 lg:gap-2 ${viewMode === 'desktop' ? 'lg:hidden' : ''}`}>
                        {QuickAmounts.map(amt => (
                            <Button 
                                key={amt}
                                variant="outline"
                                className="rounded-lg lg:rounded-xl bg-white border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-all h-10 lg:h-12 text-sm lg:text-base font-mono font-semibold active:scale-95 touch-manipulation"
                                onClick={() => setPaymentAmount('cash', payment.cashAmount + amt)}
                            >
                                +R{amt}
                            </Button>
                        ))}
                    </div>
                    )}

                    {/* Virtual Numpad - compact on mobile */}
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

      {/* Footer - Compact on mobile */}
      <div className="px-4 py-3 lg:p-6 bg-white border-t border-slate-200/80 space-y-2 lg:space-y-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-30 relative shrink-0">
        <div className="flex justify-between items-center">
            <span className="text-xs lg:text-sm font-semibold text-slate-500 flex items-center gap-1">Change <HelpTip text="Change is calculated only on the cash portion. Maximum change allowed is R200.00." /></span>
            <div className="flex items-center gap-2">
                {payment.changeDue > 200 && (
                    <span className="text-[10px] text-destructive font-medium flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        Max R200
                    </span>
                )}
                <span className={`font-mono text-lg lg:text-2xl font-bold ${payment.changeDue > 200 ? 'text-destructive' : 'text-foreground'}`}>
                    R {payment.changeDue.toFixed(2)}
                </span>
            </div>
        </div>

        {!isCompleteEnabled && transactionItems.length > 0 && transactionItems.some(item => 
            item.type === 'DIRECT_INCOME' && (!item.paidBy || item.paidBy.trim().length === 0 || !item.notes || item.notes.trim().length === 0)
        ) && (
            <div className="flex items-center gap-2 text-[10px] lg:text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 lg:px-3 lg:py-2">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Fill in <strong>Notes</strong> and <strong>Paid By</strong> for Direct Income items</span>
            </div>
        )}

        <Button 
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 h-12 lg:h-16 text-base lg:text-xl font-bold rounded-xl disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none active:scale-[0.98] transition-all touch-manipulation" 
          size="lg"
          disabled={!isCompleteEnabled}
          onClick={completeTransaction}
          data-testid="button-complete-transaction"
        >
          COMPLETE (R {payment.tenderTotal.toFixed(2)})
          <ArrowRight className="ml-2 w-5 h-5 lg:w-6 lg:h-6" />
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
