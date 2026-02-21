import React, { useState } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { UnifiedSearch } from '@/components/pos/unified-search';
import { TransactionPanels } from '@/components/pos/transaction-panels';
import { PaymentDrawer } from '@/components/pos/payment-drawer';
import { ReceiptModal } from '@/components/pos/receipt-modal';
import { Button } from '@/components/ui/button';
import { Search, Layers, CreditCard, Zap, FileCheck, Package, ArrowRight, Sparkles } from 'lucide-react';
import { EasyPayModal } from '@/components/pos/easy-pay-modal';
import { usePos } from '@/lib/pos-state';
import { EasyPayBill } from '@/lib/external-api';

function PosPageContent() {
  const [isEasyPayOpen, setIsEasyPayOpen] = useState(false);
  const { addItem, transactionItems } = usePos();

  const handleAddEasyPay = (bill: EasyPayBill) => {
    addItem({
      id: bill.id,
      type: 'DIRECT_INCOME',
      description: `EasyPay: ${bill.billerName} - ${bill.accountName}`,
      reference: bill.reference,
      amountDue: bill.amount,
      amountToPay: bill.amount,
      originalData: bill
    });
  };

  const hasItems = transactionItems.length > 0;

  return (
    <PosLayout>
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative z-0 overflow-hidden">
          
          <div className="px-3 sm:px-5 lg:px-6 py-2.5 sm:py-3 bg-white border-b border-slate-100 z-10 shrink-0">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <div className="flex-1">
                <UnifiedSearch />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 lg:pb-0">
            <TransactionPanels />
          </div>
        </div>

        <PaymentDrawer />
        
        <ReceiptModal />
        <EasyPayModal 
          open={isEasyPayOpen} 
          onOpenChange={setIsEasyPayOpen}
          onAddToTransaction={handleAddEasyPay}
        />
      </div>
    </PosLayout>
  );
}

export default function PosPage() {
  return (
      <PosPageContent />
  );
}
