import React, { useState, useEffect } from 'react';
import { usePos } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Printer, Mail, MessageSquare, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function ReceiptModal() {
  const { isReceiptModalOpen, closeReceiptModal, payment, transactionItems } = usePos();
  
  // State for receipt options
  const [printSelected, setPrintSelected] = useState(true);
  const [emailSelected, setEmailSelected] = useState(false);
  const [smsSelected, setSmsSelected] = useState(false);
  
  const [emailAddress, setEmailAddress] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // Fake receipt number
  const receiptNo = `REC-${Math.floor(Math.random() * 100000)}`;

  // Load default contact info when modal opens
  useEffect(() => {
    if (isReceiptModalOpen && transactionItems.length > 0) {
        // Try to find contact info from the first account item
        const accountItem = transactionItems.find(item => item.originalData && (item.originalData.email || item.originalData.mobile));
        
        if (accountItem) {
            const data = accountItem.originalData;
            if (data.email) {
                setEmailAddress(data.email);
                // Auto-select if email exists? optional, but prompt says "allow user to add... default email address is pulled"
                // Let's keep it unselected by default but pre-filled, or maybe select if available?
                // "print by default" was requested.
            }
            if (data.mobile) {
                setMobileNumber(data.mobile);
            }
        }
    } else {
        // Reset if closed/reopened
        setPrintSelected(true);
        setEmailSelected(false);
        setSmsSelected(false);
    }
  }, [isReceiptModalOpen, transactionItems]);

  const handleComplete = () => {
      // In a real app, this would trigger the actual print/send jobs
      console.log('Receipt Options:', {
          receiptNo,
          print: printSelected,
          email: emailSelected ? emailAddress : null,
          sms: smsSelected ? mobileNumber : null
      });
      closeReceiptModal();
  };

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
            
            <div className="mt-6 space-y-4">
                <p className="text-sm font-medium mb-2">Receipt Options</p>
                
                {/* Print Option */}
                <div 
                    className={`flex items-center space-x-3 border p-3 rounded-lg cursor-pointer transition-colors ${printSelected ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/50'}`}
                    onClick={() => setPrintSelected(!printSelected)}
                >
                    <Checkbox id="print-opt" checked={printSelected} onCheckedChange={(c) => setPrintSelected(!!c)} />
                    <Label htmlFor="print-opt" className="flex-1 cursor-pointer flex items-center gap-2 font-medium">
                        <Printer className="w-4 h-4 text-muted-foreground" /> Print Receipt
                    </Label>
                </div>

                {/* Email Option */}
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

                {/* SMS Option */}
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
            </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2 border-t pt-4">
          <Button variant="ghost" onClick={closeReceiptModal}>Close</Button>
          <Button onClick={handleComplete} className="min-w-[140px]">
              New Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
