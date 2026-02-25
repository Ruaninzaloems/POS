import React, { useState } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { UnifiedSearch } from '@/components/pos/unified-search';
import { TransactionPanels } from '@/components/pos/transaction-panels';
import { PaymentDrawer } from '@/components/pos/payment-drawer';
import { ReceiptModal } from '@/components/pos/receipt-modal';
import { Button } from '@/components/ui/button';
import { Search, Layers, CreditCard, Zap, FileCheck, Package, ArrowRight, Sparkles, Box } from 'lucide-react';
import { EasyPayModal } from '@/components/pos/easy-pay-modal';
import { DropBoxModal } from '@/components/pos/drop-box-modal';
import { usePos } from '@/lib/pos-state';
import { EasyPayBill } from '@/lib/external-api';

function PosPageContent() {
  const [isEasyPayOpen, setIsEasyPayOpen] = useState(false);
  const [isDropBoxOpen, setIsDropBoxOpen] = useState(false);
  const [dropBoxReason, setDropBoxReason] = useState<string | undefined>();
  const [isSearchActive, setIsSearchActive] = useState(false);
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
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
          
          <div className="px-3 sm:px-5 lg:px-6 py-2.5 sm:py-3 bg-white border-b border-slate-100 z-30 shrink-0 relative sticky top-0">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <div className="flex-1">
                <UnifiedSearch onSearchActiveChange={setIsSearchActive} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300 h-9 px-2.5 sm:px-3"
                onClick={() => { setDropBoxReason(undefined); setIsDropBoxOpen(true); }}
                data-testid="button-drop-box"
              >
                <Box className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline text-xs font-medium">Drop Box</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-36 lg:pb-0 relative z-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <TransactionPanels isSearchActive={isSearchActive} />
          </div>
        </div>

        <PaymentDrawer />
        
        <ReceiptModal />
        <EasyPayModal 
          open={isEasyPayOpen} 
          onOpenChange={setIsEasyPayOpen}
          onAddToTransaction={handleAddEasyPay}
        />
        <DropBoxModal
          isOpen={isDropBoxOpen}
          onClose={() => setIsDropBoxOpen(false)}
          triggerReason={dropBoxReason}
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
