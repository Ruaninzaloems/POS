import React, { useState } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { UnifiedSearch } from '@/components/pos/unified-search';
import { TransactionPanels } from '@/components/pos/transaction-panels';
import { PaymentDrawer } from '@/components/pos/payment-drawer';
import { ReceiptModal } from '@/components/pos/receipt-modal';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { EasyPayModal } from '@/components/pos/easy-pay-modal';
import { usePos } from '@/lib/pos-state';
import { EasyPayBill } from '@/lib/mock-data';

function PosPageContent() {
  const [isEasyPayOpen, setIsEasyPayOpen] = useState(false);
  const { addItem } = usePos();

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

  return (
    <PosLayout>
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        {/* Central Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative z-0 overflow-y-auto lg:overflow-visible">
          
          {/* Search Area */}
          <div className="px-4 lg:px-6 py-4 bg-background border-b z-10 sticky top-0 flex gap-2">
             <div className="flex-1 max-w-2xl mx-auto">
               <UnifiedSearch />
             </div>
             <Button 
               variant="outline" 
               className="hidden md:flex gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
               onClick={() => setIsEasyPayOpen(true)}
             >
               <Globe className="h-4 w-4" />
               EasyPay
             </Button>
             {/* Mobile Icon Button */}
             <Button 
               variant="outline" 
               size="icon"
               className="md:hidden border-blue-200 text-blue-700"
               onClick={() => setIsEasyPayOpen(true)}
             >
               <Globe className="h-4 w-4" />
             </Button>
          </div>

          {/* Dynamic Panel Area */}
          <div className="flex-1 overflow-y-auto lg:overflow-visible">
            <TransactionPanels />
          </div>
        </div>

        {/* Right Drawer */}
        <PaymentDrawer />
        
        {/* Modals */}
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
