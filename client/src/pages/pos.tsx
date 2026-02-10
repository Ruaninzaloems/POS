import React from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { UnifiedSearch } from '@/components/pos/unified-search';
import { TransactionPanels } from '@/components/pos/transaction-panels';
import { PaymentDrawer } from '@/components/pos/payment-drawer';
import { ReceiptModal } from '@/components/pos/receipt-modal';

function PosPageContent() {
  return (
    <PosLayout>
      <div className="flex flex-1 overflow-hidden relative">
        {/* Central Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative z-0">
          
          {/* Search Area */}
          <div className="px-6 py-4 bg-background border-b z-10 sticky top-0">
             <div className="max-w-2xl mx-auto">
               <UnifiedSearch />
             </div>
          </div>

          {/* Dynamic Panel Area */}
          <TransactionPanels />
        </div>

        {/* Right Drawer */}
        <PaymentDrawer />
        
        {/* Modals */}
        <ReceiptModal />
      </div>
    </PosLayout>
  );
}

export default function PosPage() {
  return (
      <PosPageContent />
  );
}
