import React, { useState } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Account } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { X } from 'lucide-react';
import { format } from 'date-fns';

export function ReceiptingConsumerPayments({ item }: { item: TransactionItem }) {
  const account = item.originalData as Account;
  const { setViewingItem, removeItem, updateItemAmount, completeTransaction } = usePos();
  
  const [paymentType, setPaymentType] = useState<'cash' | 'card'>('cash');
  const [amount, setAmount] = useState<string>(item.amountToPay > 0 ? item.amountToPay.toString() : "0.00");
  const [tenderAmount, setTenderAmount] = useState<string>("0.00");

  const handleClose = () => {
    if (setViewingItem) {
        setViewingItem(null);
    } else {
        removeItem(item.id);
    }
  };

  const handleAmountChange = (val: string) => {
      setAmount(val);
      const num = parseFloat(val);
      if (!isNaN(num)) {
          updateItemAmount(item.id, num);
      }
  };

  const handleSubmit = () => {
      // In a real app this would trigger payment processing
      // For mockup, we can just close or trigger complete
      completeTransaction();
  };

  return (
    <div className="flex-1 bg-white min-h-full p-8 flex flex-col relative">
      <h2 className="text-xl font-semibold mb-6 text-gray-900">Receipting - Consumer Payments</h2>

      {/* Top Section: Account Details Table */}
      <div className="border border-gray-300 mb-8 text-sm">
        <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
            <div className="bg-gray-100 p-2 font-medium text-gray-700 border-r border-gray-300">Account Number</div>
            <div className="p-2">{account.accountNo}</div>
        </div>
        <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
            <div className="bg-gray-100 p-2 font-medium text-gray-700 border-r border-gray-300">Old Account Code</div>
            <div className="p-2">{account.oldCode || '1002385070'}</div>
        </div>
        <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
            <div className="bg-gray-100 p-2 font-medium text-gray-700 border-r border-gray-300">Name</div>
            <div className="p-2">{account.name}</div>
        </div>
        <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
            <div className="bg-gray-100 p-2 font-medium text-gray-700 border-r border-gray-300">SG Number</div>
            <div className="p-2">{account.sgNo || 'C027/0007/00006388/00000'}</div>
        </div>
        <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
            <div className="bg-gray-100 p-2 font-medium text-gray-700 border-r border-gray-300">Address</div>
            <div className="p-2">{account.address}</div>
        </div>
        <div className="grid grid-cols-[200px_1fr]">
            <div className="bg-gray-100 p-2 font-medium text-gray-700 border-r border-gray-300">Outstanding Amount</div>
            <div className="p-2">{account.outstandingAmount.toFixed(2)}</div>
        </div>
      </div>

      {/* Bottom Section: Payment Form */}
      <div className="flex justify-center mb-8">
        <Card className="w-full max-w-lg shadow-sm border border-gray-200">
            <CardHeader className="pb-4 border-b">
                <CardTitle className="text-xl font-normal text-gray-600">Payment</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="font-normal text-gray-600">Receipt Date</Label>
                    <Input 
                        value={format(new Date(), 'MM/dd/yyyy')} 
                        readOnly 
                        className="bg-gray-50 text-gray-500 border-gray-200"
                    />
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="font-normal text-gray-600">Outstanding Amount</Label>
                    <Input 
                        value={account.outstandingAmount.toFixed(2)} 
                        readOnly 
                        className="bg-gray-200 text-gray-700 font-medium border-gray-300"
                    />
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="font-normal text-gray-600">Amount</Label>
                    <Input 
                        value={amount} 
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className="bg-gray-50 border-gray-300"
                    />
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="font-normal text-gray-600">Tender Amount *</Label>
                    <Input 
                        value={tenderAmount} 
                        onChange={(e) => setTenderAmount(e.target.value)}
                        className="bg-gray-50 border-gray-300"
                    />
                </div>

                <div className="grid grid-cols-[160px_1fr] items-start gap-4 pt-2">
                    <Label className="font-normal text-gray-600 mt-1">Payment Type *</Label>
                    <RadioGroup 
                        value={paymentType} 
                        onValueChange={(v) => setPaymentType(v as 'cash' | 'card')}
                        className="flex flex-row gap-6"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="cash" id="r1" />
                            <Label htmlFor="r1" className="font-normal">Cash</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="card" id="r2" />
                            <Label htmlFor="r2" className="font-normal">Credit Card</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="pt-4">
                    <Button 
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-500 font-normal"
                        onClick={handleSubmit}
                    >
                        Submit
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Footer Actions */}
      <div className="mt-auto flex justify-end">
        <Button 
            className="bg-orange-300 hover:bg-orange-400 text-orange-900 border border-orange-400 gap-2 px-6"
            onClick={handleClose}
        >
            <X className="w-4 h-4" />
            Close
        </Button>
      </div>
    </div>
  );
}
