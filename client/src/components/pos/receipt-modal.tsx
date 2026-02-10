import React from 'react';
import { usePos } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Printer, Mail, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ReceiptModal() {
  const { isReceiptModalOpen, closeReceiptModal, payment, transactionItems } = usePos();

  // Fake receipt number
  const receiptNo = `REC-${Math.floor(Math.random() * 100000)}`;

  return (
    <Dialog open={isReceiptModalOpen} onOpenChange={(open) => !open && closeReceiptModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center space-y-3 pb-4 border-b">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <DialogTitle className="text-2xl">Payment Successful</DialogTitle>
          <DialogDescription className="text-lg font-mono text-foreground font-medium">
             {receiptNo}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6 space-y-4">
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-bold font-mono">R {payment.tenderTotal.toFixed(2)}</span>
            </div>
            {payment.changeDue > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                    <span>Change Given</span>
                    <span className="font-bold font-mono">R {payment.changeDue.toFixed(2)}</span>
                </div>
            )}
            
            <div className="mt-6 space-y-3">
                <p className="text-sm font-medium mb-2">Receipt Options</p>
                <div className="grid grid-cols-2 gap-3">
                     <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                        <Printer className="w-4 h-4" /> Print Receipt
                     </Button>
                     <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                        <Mail className="w-4 h-4" /> Email Receipt
                     </Button>
                     <Button variant="outline" className="justify-start gap-2 h-auto py-3 col-span-2">
                        <MessageSquare className="w-4 h-4" /> SMS Receipt
                     </Button>
                </div>
            </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2 border-t pt-4">
          <Button variant="ghost" onClick={closeReceiptModal}>Close</Button>
          <Button onClick={closeReceiptModal} className="min-w-[120px]">New Transaction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
