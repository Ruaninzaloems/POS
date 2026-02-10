import React, { useState } from 'react';
import { usePos } from '@/lib/pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, CreditCard, Banknote, Trash2, Calculator } from 'lucide-react';
import { VirtualNumpad } from '@/components/ui/virtual-numpad';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function PaymentDrawer() {
  const { 
    payment, 
    setPaymentAmount, 
    completeTransaction, 
    transactionItems, 
    removeItem 
  } = usePos();

  const [activeInput, setActiveInput] = useState<'cash' | 'card'>('cash');

  const isCompleteEnabled = 
    transactionItems.length > 0 && 
    payment.tenderTotal >= transactionItems.reduce((acc, i) => acc + i.amountToPay, 0) &&
    transactionItems.reduce((acc, i) => acc + i.amountToPay, 0) > 0;

  const totalDue = transactionItems.reduce((acc, i) => acc + i.amountToPay, 0);

  // Numpad Logic
  const handleNumpadInput = (val: string) => {
      const currentVal = activeInput === 'cash' ? payment.cashAmount : payment.cardAmount;
      const currentStr = currentVal.toString();
      
      // Handle decimal
      if (val === '.') {
          if (currentStr.includes('.')) return;
          // Don't convert to number yet if it's just "0."
          // But for this simple implementation, let's just use string parsing
      }

      // Simple concatenation logic for prototype
      // Real POS uses "cent" logic (input * 10 + new) usually
      let newVal = parseFloat(currentStr + val);
      if (val === '.' && !currentStr.includes('.')) {
          // Tricky with number type state. 
          // For now, let's just append normally but since state is number, we need to be careful.
          // Actually, let's just mock the behaviour by assuming user types whole numbers mostly or handles decimals via standard keyboard if needed.
          // Better for touchscreen: Use "Cents" mode. 
          // Let's implement simple "Append" logic, clearing if it was 0
          if (currentVal === 0) newVal = parseFloat(val);
          else newVal = parseFloat(currentStr + val);
      }
      
      // A safer "Touch" approach: Treat input as string concatenation of cents then divide by 100?
      // Let's stick to: If value is 0, replace. If value > 0, append.
      if (val === '.') return; // Skip decimal for this simple numpad implementation to avoid float issues
      
      const str = currentVal === 0 ? val : currentStr + val;
      setPaymentAmount(activeInput, parseFloat(str));
  };

  const handleBackspace = () => {
      const currentVal = activeInput === 'cash' ? payment.cashAmount : payment.cardAmount;
      const str = currentVal.toString();
      const newStr = str.slice(0, -1);
      setPaymentAmount(activeInput, newStr === '' ? 0 : parseFloat(newStr));
  };

  const QuickAmounts = [10, 20, 50, 100, 200, 500];

  return (
    <aside className="w-[450px] bg-card border-l flex flex-col shadow-2xl z-20 h-full flex-shrink-0">
      <div className="p-6 border-b bg-muted/30 flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold tracking-tight">Payment Drawer</h2>
           <p className="text-sm text-muted-foreground">Touch-enabled checkout</p>
        </div>
        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary animate-pulse">
           <Calculator className="w-5 h-5" />
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
                                className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
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

                 {/* Input Selection */}
                 <div className="grid grid-cols-2 gap-4">
                     <button 
                        onClick={() => setActiveInput('cash')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${activeInput === 'cash' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-transparent bg-muted hover:bg-muted/80'}`}
                     >
                        <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                            <Banknote className="w-5 h-5" />
                            <span className="font-medium text-sm">Cash</span>
                        </div>
                        <div className="text-2xl font-mono font-bold">
                            {payment.cashAmount > 0 ? payment.cashAmount.toFixed(0) : <span className="text-muted-foreground/30">0</span>}
                        </div>
                     </button>

                     <button 
                        onClick={() => setActiveInput('card')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${activeInput === 'card' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-transparent bg-muted hover:bg-muted/80'}`}
                     >
                        <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                            <CreditCard className="w-5 h-5" />
                            <span className="font-medium text-sm">Card</span>
                        </div>
                        <div className="text-2xl font-mono font-bold">
                            {payment.cardAmount > 0 ? payment.cardAmount.toFixed(0) : <span className="text-muted-foreground/30">0</span>}
                        </div>
                     </button>
                 </div>
                 
                 {/* Quick Cash */}
                 <div className="grid grid-cols-3 gap-2">
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

                 <Separator />
                 
                 {/* Virtual Numpad */}
                 <VirtualNumpad 
                    onInput={handleNumpadInput} 
                    onClear={handleBackspace} 
                    className="w-full"
                 />
           </TabsContent>
        </Tabs>
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-card border-t space-y-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-30 relative">
        <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground font-medium">Change Due</span>
            <span className="font-mono text-2xl font-bold text-foreground">R {payment.changeDue.toFixed(2)}</span>
        </div>

        <Button 
          className="w-full h-16 text-xl font-bold shadow-lg active:scale-[0.98] transition-all" 
          size="lg"
          disabled={!isCompleteEnabled}
          onClick={completeTransaction}
        >
          COMPLETE (R {payment.tenderTotal.toFixed(2)})
          <ArrowRight className="ml-2 w-6 h-6" />
        </Button>
      </div>
    </aside>
  );
}

