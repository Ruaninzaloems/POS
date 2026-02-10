import React from 'react';
import { usePos } from '@/lib/pos-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, CreditCard, Banknote, Trash2 } from 'lucide-react';

export function PaymentDrawer() {
  const { 
    payment, 
    setPaymentAmount, 
    completeTransaction, 
    transactionItems, 
    removeItem 
  } = usePos();

  const isCompleteEnabled = 
    transactionItems.length > 0 && 
    payment.tenderTotal >= transactionItems.reduce((acc, i) => acc + i.amountToPay, 0) &&
    transactionItems.reduce((acc, i) => acc + i.amountToPay, 0) > 0;

  const totalDue = transactionItems.reduce((acc, i) => acc + i.amountToPay, 0);

  return (
    <aside className="w-[400px] bg-card border-l flex flex-col shadow-xl z-10 h-full">
      <div className="p-6 border-b bg-muted/30">
        <h2 className="text-xl font-semibold mb-1">Payment Drawer</h2>
        <p className="text-sm text-muted-foreground">Review and complete transaction</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Cart Items Summary */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Line Items</h3>
            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">{transactionItems.length}</span>
          </div>
          
          {transactionItems.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
              <p>No items added</p>
              <p className="text-xs mt-1">Search to begin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactionItems.map((item) => (
                <div key={item.id} className="group flex justify-between items-start p-3 bg-background rounded-lg border shadow-sm hover:border-primary/50 transition-colors">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="font-medium truncate" title={item.description}>{item.description}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.reference}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                     <div className="font-mono font-medium">
                       R {item.amountToPay.toFixed(2)}
                     </div>
                     <button 
                       onClick={() => removeItem(item.id)}
                       className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                       aria-label="Remove item"
                     >
                       <Trash2 className="w-3 h-3" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* Payment Inputs */}
        <section className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2">Tender Type</h3>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="cash-input" className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-green-600" />
                Cash Amount
              </Label>
              <Input 
                id="cash-input"
                type="number" 
                value={payment.cashAmount || ''} 
                onChange={(e) => setPaymentAmount('cash', parseFloat(e.target.value) || 0)}
                className="font-mono text-right text-lg"
                placeholder="0.00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="card-input" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Card Amount
              </Label>
              <Input 
                id="card-input"
                type="number" 
                value={payment.cardAmount || ''} 
                onChange={(e) => setPaymentAmount('card', parseFloat(e.target.value) || 0)}
                className="font-mono text-right text-lg"
                placeholder="0.00"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Totals & Action */}
      <div className="p-6 bg-muted/50 border-t space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Due</span>
            <span className="font-mono font-semibold">R {totalDue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Tendered</span>
            <span className={`font-mono font-semibold ${payment.tenderTotal >= totalDue ? 'text-green-600' : 'text-orange-600'}`}>
              R {payment.tenderTotal.toFixed(2)}
            </span>
          </div>
          {payment.changeDue > 0 && (
            <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t">
              <span>Change Due</span>
              <span className="font-mono">R {payment.changeDue.toFixed(2)}</span>
            </div>
          )}
        </div>

        <Button 
          className="w-full h-12 text-lg shadow-md" 
          size="lg"
          disabled={!isCompleteEnabled}
          onClick={completeTransaction}
        >
          Complete Payment
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </aside>
  );
}
