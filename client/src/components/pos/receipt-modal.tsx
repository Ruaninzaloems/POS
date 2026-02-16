import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePos } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Printer, Mail, MessageSquare, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PosReceiptTemplate } from './pos-receipt-template';
import { PermitTemplate } from './permit-template';

export function ReceiptModal() {
  const { isReceiptModalOpen, closeReceiptModal, payment, transactionItems, recentTransactions, transactionProcessing, currentTransactionId } = usePos();
  const printRef = useRef<HTMLDivElement>(null);
  
  const currentTransaction = currentTransactionId 
    ? recentTransactions.find(t => t.id === currentTransactionId) || recentTransactions[0]
    : recentTransactions[0];
  
  const permitItem = transactionItems.find(i => i.type === 'DIRECT_INCOME' && 
      (i.description.toLowerCase().includes('permit') || i.description.toLowerCase().includes('certificate')));
  const isPermit = !!permitItem;

  const [printSelected, setPrintSelected] = useState(true);
  const [emailSelected, setEmailSelected] = useState(false);
  const [smsSelected, setSmsSelected] = useState(false);
  
  const [emailAddress, setEmailAddress] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${isPermit ? 'Permit' : 'Receipt'}-${currentTransaction?.receiptNumber || 'New'}</title>
        <style>
          body { margin: 0; padding: 10px; font-family: 'Courier New', monospace; font-size: 12px; }
          * { box-sizing: border-box; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .justify-center { justify-content: center; }
          .items-center { align-items: center; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-semibold { font-weight: 600; }
          .font-mono { font-family: 'Courier New', monospace; }
          .text-xs { font-size: 10px; }
          .text-sm { font-size: 11px; }
          .text-lg { font-size: 14px; }
          .text-xl { font-size: 16px; }
          .mb-0\\.5 { margin-bottom: 2px; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mb-3 { margin-bottom: 12px; }
          .mb-4 { margin-bottom: 16px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .mt-3 { margin-top: 12px; }
          .mt-4 { margin-top: 16px; }
          .pt-2 { padding-top: 8px; }
          .pt-3 { padding-top: 12px; }
          .pb-2 { padding-bottom: 8px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .py-2 { padding-top: 8px; padding-bottom: 8px; }
          .px-2 { padding-left: 8px; padding-right: 8px; }
          .p-2 { padding: 8px; }
          .border-t { border-top: 1px solid #d1d5db; }
          .border-b { border-bottom: 1px solid #d1d5db; }
          .border { border: 1px solid #d1d5db; }
          .border-dashed { border-style: dashed; }
          .border-gray-300 { border-color: #d1d5db; }
          .border-gray-400 { border-color: #9ca3af; }
          .bg-gray-50 { background-color: #f9fafb; }
          .bg-gray-100 { background-color: #f3f4f6; }
          .rounded { border-radius: 4px; }
          .space-y-1 > * + * { margin-top: 4px; }
          .gap-1 { gap: 4px; }
          .gap-2 { gap: 8px; }
          .w-full { width: 100%; }
          .flex-1 { flex: 1; }
          .italic { font-style: italic; }
          .line-through { text-decoration: line-through; }
          .text-red-600 { color: #dc2626; }
          .text-red-700 { color: #b91c1c; }
          .text-gray-400 { color: #9ca3af; }
          .text-gray-500 { color: #6b7280; }
          .text-muted-foreground { color: #6b7280; }
          .uppercase { text-transform: uppercase; }
          .tracking-wider { letter-spacing: 0.05em; }
          .flex-col { flex-direction: column; }
          @media print { body { margin: 0; padding: 5px; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      closeReceiptModal();
    }, 300);
  }, [isPermit, currentTransaction, closeReceiptModal]);

  useEffect(() => {
    if (isReceiptModalOpen && transactionItems.length > 0) {
        const accountItem = transactionItems.find(item => item.originalData && (item.originalData.email || item.originalData.mobile));
        
        if (accountItem) {
            const data = accountItem.originalData;
            if (data.email) {
                setEmailAddress(data.email);
            }
            if (data.mobile) {
                setMobileNumber(data.mobile);
            }
        }
    } else {
        setPrintSelected(true);
        setEmailSelected(false);
        setSmsSelected(false);
    }
  }, [isReceiptModalOpen, transactionItems]);

  const handleComplete = () => {
      console.log('Receipt Options:', {
          receiptNo: currentTransaction?.receiptNumber,
          print: printSelected,
          email: emailSelected ? emailAddress : null,
          sms: smsSelected ? mobileNumber : null
      });

      if (printSelected) {
          handlePrint();
      } else {
          closeReceiptModal();
      }
  };

  if (!currentTransaction) return null;

  const paymentFailed = !transactionProcessing && (!currentTransaction.receiptNumber || currentTransaction.receiptNumber === 'PENDING');
  const paymentSucceeded = !transactionProcessing && !paymentFailed;

  return (
    <Dialog open={isReceiptModalOpen} onOpenChange={(open) => !open && closeReceiptModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center space-y-3 pb-4 border-b">
          {transactionProcessing ? (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <DialogTitle className="text-2xl">Posting to Billing System...</DialogTitle>
              <DialogDescription className="text-lg text-muted-foreground font-medium">
                 Please wait while the payment is being processed
              </DialogDescription>
            </>
          ) : paymentFailed ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
                <XCircle className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl text-red-600" data-testid="text-payment-failed">Payment Failed</DialogTitle>
              <DialogDescription className="text-lg text-red-500 font-medium" data-testid="text-receipt-number">
                 No receipt number was returned from the billing system. The payment was not processed successfully.
              </DialogDescription>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl" data-testid="text-payment-success">Payment Successful</DialogTitle>
              <DialogDescription className="text-lg font-mono text-foreground font-medium" data-testid="text-receipt-number">
                 {currentTransaction.receiptNumber}
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        
        <div className="py-6 space-y-4">
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-bold font-mono">R {payment.tenderTotal.toFixed(2)}</span>
            </div>
            {payment.cashAmount > 0 && payment.cardAmount > 0 && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Cash</span>
                        <span className="font-mono">R {payment.cashAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Card</span>
                        <span className="font-mono">R {payment.cardAmount.toFixed(2)}</span>
                    </div>
                </div>
            )}
            {payment.changeDue > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                    <span>Change Given</span>
                    <span className="font-bold font-mono">R {payment.changeDue.toFixed(2)}</span>
                </div>
            )}
            {currentTransaction?.splitReceipts && currentTransaction.splitReceipts.length > 1 && !transactionProcessing && (
                <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                    <p className="font-medium mb-1">{currentTransaction.splitReceipts.length} receipts generated</p>
                    {currentTransaction.splitReceipts.map((sr, i) => (
                        <div key={i} className="flex justify-between">
                            <span>{sr.receiptNumber} ({sr.paymentType})</span>
                            <span className="font-mono">R {sr.amount.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            )}
            
            {paymentSucceeded && <div className="mt-6 space-y-4">
                <p className="text-sm font-medium mb-2">Receipt Options</p>
                
                <div 
                    className={`flex items-center space-x-3 border p-3 rounded-lg cursor-pointer transition-colors ${printSelected ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/50'}`}
                    onClick={() => setPrintSelected(!printSelected)}
                >
                    <Checkbox id="print-opt" checked={printSelected} onCheckedChange={(c) => setPrintSelected(!!c)} />
                    <Label htmlFor="print-opt" className="flex-1 cursor-pointer flex items-center gap-2 font-medium">
                        <Printer className="w-4 h-4 text-muted-foreground" /> Print Receipt
                    </Label>
                </div>

                <div className={`border rounded-lg transition-all ${emailSelected ? 'border-primary bg-primary/5' : 'border-input'}`}>
                    <div 
                        className="flex items-center space-x-3 p-3 cursor-pointer hover:bg-muted/50 rounded-t-lg"
                        onClick={() => setEmailSelected(!emailSelected)}
                    >
                        <Checkbox id="email-opt" checked={emailSelected} onCheckedChange={(c) => setEmailSelected(!!c)} />
                        <Label htmlFor="email-opt" className="flex-1 cursor-pointer flex items-center gap-2 font-medium">
                            <Mail className="w-4 h-4 text-muted-foreground" /> Email Receipt
                        </Label>
                    </div>
                    {emailSelected && (
                        <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2">
                            <Input 
                                value={emailAddress} 
                                onChange={(e) => setEmailAddress(e.target.value)}
                                placeholder="Enter email address"
                                className="h-8 bg-white"
                            />
                        </div>
                    )}
                </div>

                <div className={`border rounded-lg transition-all ${smsSelected ? 'border-primary bg-primary/5' : 'border-input'}`}>
                    <div 
                        className="flex items-center space-x-3 p-3 cursor-pointer hover:bg-muted/50 rounded-t-lg"
                        onClick={() => setSmsSelected(!smsSelected)}
                    >
                        <Checkbox id="sms-opt" checked={smsSelected} onCheckedChange={(c) => setSmsSelected(!!c)} />
                        <Label htmlFor="sms-opt" className="flex-1 cursor-pointer flex items-center gap-2 font-medium">
                            <MessageSquare className="w-4 h-4 text-muted-foreground" /> SMS Receipt
                        </Label>
                    </div>
                    {smsSelected && (
                        <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2">
                            <Input 
                                value={mobileNumber} 
                                onChange={(e) => setMobileNumber(e.target.value)}
                                placeholder="Enter mobile number"
                                className="h-8 bg-white"
                            />
                        </div>
                    )}
                </div>
            </div>}
        </div>

        <DialogFooter className="sm:justify-between gap-2 border-t pt-4">
          <Button variant="ghost" onClick={closeReceiptModal} disabled={transactionProcessing}>Close</Button>
          {!paymentFailed && (
            <Button onClick={handleComplete} className="min-w-[140px]" disabled={transactionProcessing}>
                {transactionProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  printSelected ? 'Print & Complete' : 'Complete'
                )}
            </Button>
          )}
        </DialogFooter>
        
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '80mm' }}>
            <div ref={printRef}>
                {isPermit ? (
                     <PermitTemplate transaction={currentTransaction} items={transactionItems} />
                ) : (
                     <PosReceiptTemplate transaction={currentTransaction} />
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
