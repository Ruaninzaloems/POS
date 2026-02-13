import React from 'react';
import { format } from 'date-fns';
import { TransactionRecord, TransactionItem, ReceiptAllocation, SplitReceipt } from '@/lib/pos-state';
import { Account, DirectIncomeItem } from '@/lib/mock-data';

interface PosReceiptTemplateProps {
  transaction: TransactionRecord;
  isReprint?: boolean;
  isCancelled?: boolean;
}

export const PosReceiptTemplate = React.forwardRef<HTMLDivElement, PosReceiptTemplateProps>(({ transaction, isReprint, isCancelled }, ref) => {
  // Sort items: Accounts first, then others, Prepaid last
  const sortedItems = [...transaction.items].sort((a, b) => {
      const getPriority = (type: string) => {
          switch (type) {
              case 'CONSUMER_SERVICES': return 1;
              case 'CLEARANCE': return 2;
              case 'DIRECT_INCOME': return 3;
              case 'ACCOUNT_GROUP': return 4;
              case 'PREPAID': return 10;
              default: return 5;
          }
      };
      return getPriority(a.type) - getPriority(b.type);
  });

  // Calculate VAT (assuming 15% inclusive for now, or per item if needed)
  const totalAmount = transaction.totalAmount;
  const vatAmount = totalAmount * (15 / 115); // 15% VAT included

  // Split receipt detection
  const hasSplitReceipts = transaction.splitReceipts && transaction.splitReceipts.length > 1;
  const cashReceipt = transaction.splitReceipts?.find(r => r.paymentType === 'cash');
  const cardReceipt = transaction.splitReceipts?.find(r => r.paymentType === 'card');

  // Find primary account for header if available (Consumer or Prepaid)
  const primaryItem = sortedItems.find(i => i.type === 'CONSUMER_SERVICES' || i.type === 'PREPAID');
  const primaryAccount = primaryItem ? (primaryItem.originalData as Account) : null;

  return (
    <div ref={ref} className="bg-white p-2 mx-auto text-[10px] font-mono leading-tight receipt-print relative w-[300px]">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-print, .receipt-print * {
            visibility: visible;
          }
          .receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 2mm 5mm;
            margin: 0;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Watermarks */}
      {isReprint && !isCancelled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 z-0 overflow-hidden">
            <div className="transform -rotate-45 text-slate-900 text-3xl font-bold border-2 border-slate-900 p-2 rounded-xl whitespace-nowrap">
                COPY / REPRINT
            </div>
        </div>
      )}
      {isCancelled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-0 overflow-hidden">
            <div className="transform -rotate-45 text-red-900 text-3xl font-bold border-4 border-red-900 p-2 rounded-xl whitespace-nowrap">
                CANCELLED
            </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-4 relative z-10">
        <h1 className="font-bold text-xs mb-1">Greater Tzaneen Municipality</h1>
        <p className="mb-0.5">Agatha St, Tzaneen 567</p>
        <p className="mb-0.5">Tzaneen. 0850</p>
        <p>VAT Reg: 4130193669</p>
        {isReprint && !isCancelled && <h2 className="font-bold mt-2 text-xs uppercase tracking-widest border-b border-black pb-0.5 inline-block">** REPRINT **</h2>}
        {isCancelled && <h2 className="font-bold mt-2 text-xs uppercase tracking-widest border-b border-red-600 pb-0.5 inline-block text-red-600">** CANCELLED **</h2>}
      </div>

      {/* Transaction Info */}
      <div className="flex flex-col gap-1 mb-3 border-b border-dashed border-black pb-2">
        {hasSplitReceipts ? (
            <>
                <div className="flex justify-between">
                    <span>Receipt No (Cash):</span>
                    <span>{cashReceipt?.receiptNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Receipt No (Card):</span>
                    <span>{cardReceipt?.receiptNumber || '-'}</span>
                </div>
            </>
        ) : (
            <div className="flex justify-between">
                <span>Receipt No:</span>
                <span>{transaction.receiptNumber}</span>
            </div>
        )}
        <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date(transaction.timestamp).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        </div>
        <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{transaction.cashierId}</span>
        </div>
      </div>

      {/* Line Items */}
      <div className="mb-2">
        {sortedItems.map((item, idx) => {
            const isDirect = item.type === 'DIRECT_INCOME';
            const directData = isDirect ? (item.originalData as DirectIncomeItem) : null;
            const displayDescription = isDirect
                ? (item.notes || directData?.groupName || item.description)
                : item.description;
            const displayRef = isDirect
                ? (item.additionalInfo || item.paidBy || 'CASH')
                : item.reference;

            return (
                <div key={idx} className="mb-3 border-b border-dotted border-gray-300 pb-2 last:border-0">
                    <div className="flex justify-between font-bold">
                        <span className="break-words w-[70%]">{displayDescription}</span>
                        <span>{item.amountToPay.toFixed(2)}</span>
                    </div>
                    
                    <div className="pl-2 mt-1 text-[9px] text-gray-600 space-y-0.5">
                        {displayRef && (
                            <div className="flex gap-2">
                                <span className="w-12 text-gray-400">Ref:</span>
                                <span>{displayRef}</span>
                            </div>
                        )}
                        
                        {isDirect && (
                            <>
                                {directData?.scoaItem && (
                                    <div className="flex gap-2">
                                        <span className="w-12 text-gray-400">SCOA:</span>
                                        <span>{directData.scoaItem}</span>
                                    </div>
                                )}
                                {item.paidBy && (
                                    <div className="flex gap-2">
                                        <span className="w-12 text-gray-400">Paid By:</span>
                                        <span>{item.paidBy}</span>
                                    </div>
                                )}
                                {item.notes && (
                                    <div className="italic text-gray-500 mt-0.5">"{item.notes}"</div>
                                )}
                            </>
                        )}

                        {/* Prepaid Details */}
                        {item.type === 'PREPAID' && (
                            <div className="mt-1 bg-gray-50 p-1 rounded border border-gray-200">
                                <div className="font-bold text-center mb-1">TOKEN: 1234 5678 9012 3456 7890</div>
                                <div className="grid grid-cols-2 gap-x-2 text-[8px]">
                                    <span>Units:</span>
                                    <span className="text-right">124.5 kWh</span>
                                    <span>VAT:</span>
                                    <span className="text-right">R {(item.amountToPay * 0.15 / 1.15).toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
        
        {transaction.allocations && transaction.allocations.length > 0 ? (
            <div className="mt-2 pt-1 border-t border-dotted border-gray-400">
                <div className="font-bold text-[9px] mb-1 text-center">Transaction Allocation</div>
                <div className="flex justify-between text-[8px] font-bold border-b border-dotted border-gray-300 pb-0.5 mb-0.5">
                    <span className="w-[50%]">Service</span>
                    <span className="w-[25%] text-right">Amount</span>
                    <span className="w-[25%] text-right">VAT</span>
                </div>
                {transaction.allocations.map((alloc, idx) => (
                    <div key={idx} className="flex justify-between text-[8px]">
                        <span className="w-[50%] truncate">{alloc.service}</span>
                        <span className="w-[25%] text-right">{alloc.amount.toFixed(2)}</span>
                        <span className="w-[25%] text-right">{alloc.vat > 0 ? alloc.vat.toFixed(2) : '-'}</span>
                    </div>
                ))}
            </div>
        ) : (
            <div className="mt-2 pt-1 border-t border-dotted border-gray-400">
                <div className="flex justify-between">
                    <span>Taxable Amount</span>
                    <span>{(totalAmount - vatAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Vat Amount (15%)</span>
                    <span>{vatAmount.toFixed(2)}</span>
                </div>
            </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-black border-dashed py-2 mb-4">
        <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span>
            <span>{totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="flex flex-col gap-1 mb-4 text-[9px] border-b border-dashed border-black pb-2">
         {hasSplitReceipts && (
             <div className="font-bold text-center text-[8px] mb-1 uppercase">Split Payment</div>
         )}
         {transaction.payment.cash > 0 && (
             <div className="flex justify-between">
                 <span>Cash Tendered:</span>
                 <span>{transaction.payment.cash.toFixed(2)}</span>
             </div>
         )}
         {hasSplitReceipts && cashReceipt && (
             <div className="flex justify-between text-[8px] text-gray-500 pl-2">
                 <span>Cash Receipt:</span>
                 <span>{cashReceipt.receiptNumber} (R{cashReceipt.amount.toFixed(2)})</span>
             </div>
         )}
         {transaction.payment.card > 0 && (
             <div className="flex justify-between">
                 <span>Card Tendered:</span>
                 <span>{transaction.payment.card.toFixed(2)}</span>
             </div>
         )}
         {hasSplitReceipts && cardReceipt && (
             <div className="flex justify-between text-[8px] text-gray-500 pl-2">
                 <span>Card Receipt:</span>
                 <span>{cardReceipt.receiptNumber} (R{cardReceipt.amount.toFixed(2)})</span>
             </div>
         )}
         <div className="flex justify-between font-bold mt-1">
             <span>Change:</span>
             <span>{Math.max(0, transaction.payment.cash + transaction.payment.card - totalAmount).toFixed(2)}</span>
         </div>
      </div>

      <div className="text-center mt-6 italic text-[9px]">
        Thank you.
        <div className="mt-1 text-[8px] text-gray-400">System Gen: {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
      </div>
    </div>
  );
});

PosReceiptTemplate.displayName = 'PosReceiptTemplate';
