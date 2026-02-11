import React from 'react';
import { format } from 'date-fns';
import { BankTransaction, AllocationDraft, AllocationLine } from '@/lib/direct-deposits-data';
import { ACCOUNTS, CURRENT_CASHIER, Account } from '@/lib/mock-data';

interface ReceiptTemplateProps {
  transaction: BankTransaction;
  allocation: AllocationDraft;
  onClose?: () => void;
  isReprint?: boolean;
  isCancelled?: boolean;
}

export const ReceiptTemplate = React.forwardRef<HTMLDivElement, ReceiptTemplateProps>(({ transaction, allocation, isReprint, isCancelled }, ref) => {
  // Find linked account details if available (use the first line's account number as primary for header)
  const primaryLine = allocation.lines[0];
  const primaryAccount = ACCOUNTS.find(a => a.accountNo === primaryLine?.accountNo);

  // Mock receipt number based on transaction ID
  const receiptNo = transaction.id.replace('TXN-', 'REC');
  
  // Calculate totals
  const totalAllocated = allocation.lines.reduce((sum, line) => sum + line.amount, 0);
  const vatAmount = totalAllocated * 0.15; // Mock VAT calculation (inclusive)

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
            width: 80mm; /* Standard receipt width */
            padding: 2mm 5mm;
            margin: 0;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Watermark for reprints */}
      {isReprint && !isCancelled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 z-0 overflow-hidden">
            <div className="transform -rotate-45 text-slate-900 text-3xl font-bold border-2 border-slate-900 p-2 rounded-xl whitespace-nowrap">
                COPY / REPRINT
            </div>
        </div>
      )}

      {/* Watermark for cancelled */}
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
      <div className="flex flex-col gap-1 mb-3">
        <div className="flex justify-between">
            <span>Receipt No:</span>
            <span>{receiptNo}</span>
        </div>
        <div className="flex justify-between">
            <span>Date:</span>
            <span>{format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
        </div>
        <div className="flex justify-between">
            <span>Payment Date:</span>
            <span>{format(new Date(transaction.transactionDate), 'dd/MM/yyyy')}</span>
        </div>
        
        {primaryAccount && (
            <>
                <div className="flex justify-between mt-1">
                    <span>Account:</span>
                    <span>{primaryAccount.accountNo}</span>
                </div>
                
                {primaryAccount.oldCode && (
                    <div className="flex justify-between">
                        <span>Old Acc:</span>
                        <span>{primaryAccount.oldCode}</span>
                    </div>
                )}
                
                <div className="flex flex-col mt-1">
                    <span>Name:</span>
                    <span className="text-right font-bold truncate">{primaryAccount.name}</span>
                </div>
                
                {primaryAccount.sgNo && (
                    <div className="flex justify-between">
                        <span>SG No:</span>
                        <span>{primaryAccount.sgNo}</span>
                    </div>
                )}
                
                <div className="flex flex-col mt-1">
                    <span>Address:</span>
                    <span className="text-right break-words leading-tight">{primaryAccount.address}</span>
                </div>
            </>
        )}
      </div>

      {/* Line Items */}
      <div className="border-t border-dashed border-black py-2 mb-2">
        {allocation.lines.map((line, idx) => {
            const acc = ACCOUNTS.find(a => a.accountNo === line.accountNo);
            
            return (
                <div key={idx} className="mb-2">
                    <div className="flex justify-between font-bold">
                        <span className="break-words w-[70%]">{line.description}</span>
                        <span>{line.amount.toFixed(2)}</span>
                    </div>
                    {acc && acc.accountNo !== primaryLine?.accountNo && (
                        <div className="text-[9px] text-gray-500 italic text-right">Acc: {acc.accountNo}</div>
                    )}
                </div>
            );
        })}
        
        <div className="flex justify-between mt-2 pt-1 border-t border-dotted border-gray-400">
            <span>Vat Amount</span>
            <span>{vatAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-black border-dashed py-2 mb-4">
        <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span>
            <span>{totalAllocated.toFixed(2)}</span>
        </div>
      </div>

      {/* Outstanding Balance (Mock Logic) */}
      <div className="flex justify-between mb-4 border-b border-dashed border-black pb-2">
        <span>Balance Due:</span>
        <span className="font-bold">
            {primaryAccount ? (primaryAccount.outstandingAmount - totalAllocated).toFixed(2) : '0.00'}
        </span>
      </div>

      {/* Footer Details */}
      <div className="flex flex-col gap-1 mb-4 text-[9px]">
        <div className="flex justify-between">
            <span>Payment Type:</span>
            <span className="font-bold">DIRECT DEPOSIT</span>
        </div>
        <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{CURRENT_CASHIER.name}</span>
        </div>
        <div className="flex justify-between">
            <span>Office:</span>
            <span>{CURRENT_CASHIER.cashOffice}</span>
        </div>
      </div>

      <div className="text-center mt-6 italic text-[9px]">
        Thank you.
        <div className="mt-1 text-[8px] text-gray-400">System Gen: {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
      </div>
    </div>
  );
});

ReceiptTemplate.displayName = 'ReceiptTemplate';
