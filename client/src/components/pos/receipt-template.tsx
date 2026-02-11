import React from 'react';
import { format } from 'date-fns';
import { BankTransaction, AllocationDraft, AllocationLine } from '@/lib/direct-deposits-data';
import { ACCOUNTS, CURRENT_CASHIER, Account } from '@/lib/mock-data';

interface ReceiptTemplateProps {
  transaction: BankTransaction;
  allocation: AllocationDraft;
  onClose?: () => void;
}

export const ReceiptTemplate = React.forwardRef<HTMLDivElement, ReceiptTemplateProps>(({ transaction, allocation }, ref) => {
  // Find linked account details if available (use the first line's account number as primary for header)
  const primaryLine = allocation.lines[0];
  const primaryAccount = ACCOUNTS.find(a => a.accountNo === primaryLine?.accountNo);

  // Mock receipt number based on transaction ID
  const receiptNo = transaction.id.replace('TXN-', 'REC');
  
  // Calculate totals
  const totalAllocated = allocation.lines.reduce((sum, line) => sum + line.amount, 0);
  const vatAmount = totalAllocated * 0.15; // Mock VAT calculation (inclusive)

  return (
    <div ref={ref} className="bg-white p-8 max-w-[400px] mx-auto text-xs font-mono leading-tight receipt-print">
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
            width: 100%;
            max-width: none;
            padding: 20px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-bold text-sm mb-1">Greater Tzaneen Municipality</h1>
        <p>Agatha St, Tzaneen 567 Tzaneen. 0850</p>
        <p>VAT Registration Number: 4130193669</p>
        <h2 className="font-bold mt-4 text-sm">Reprint</h2>
      </div>

      {/* Transaction Info */}
      <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1 mb-4">
        <span>Receipt No</span>
        <span className="text-right">{receiptNo}</span>
        
        <span>Receipt Date</span>
        <span className="text-right">{format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</span>
        
        <span>Payment Date</span>
        <span className="text-right">{format(new Date(transaction.transactionDate), 'dd/MM/yyyy')}</span>
        
        {primaryAccount && (
            <>
                <span>Account No</span>
                <span className="text-right">{primaryAccount.accountNo}</span>
                
                {primaryAccount.oldCode && (
                    <>
                        <span>Old Account No</span>
                        <span className="text-right">{primaryAccount.oldCode}</span>
                    </>
                )}
                
                <span>Account Name</span>
                <span className="text-right">{primaryAccount.name}</span>
                
                {primaryAccount.sgNo && (
                    <>
                        <span>SG Number</span>
                        <span className="text-right">{primaryAccount.sgNo}</span>
                    </>
                )}
                
                <span>Address</span>
                <div className="text-right break-words">{primaryAccount.address}</div>
            </>
        )}
      </div>

      {/* Line Items */}
      <div className="border-t border-dashed border-black py-2 mb-2">
        {allocation.lines.map((line, idx) => {
            const acc = ACCOUNTS.find(a => a.accountNo === line.accountNo);
            const desc = line.description.length > 25 ? line.description.substring(0, 25) + '...' : line.description;
            
            return (
                <div key={idx} className="flex justify-between mb-1">
                    <span className="flex-1 mr-2">
                        {desc}
                        {acc && acc.accountNo !== primaryLine?.accountNo && (
                            <div className="text-[10px] text-gray-500">Acc: {acc.accountNo}</div>
                        )}
                    </span>
                    <span>{line.amount.toFixed(2)}</span>
                </div>
            );
        })}
        
        <div className="flex justify-between mt-2">
            <span>Vat Amount</span>
            <span>{vatAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-black border-dashed py-2 mb-4">
        <div className="flex justify-between font-bold text-sm">
            <span>Total</span>
            <span>{totalAllocated.toFixed(2)}</span>
        </div>
      </div>

      {/* Outstanding Balance (Mock Logic) */}
      <div className="flex justify-between mb-6">
        <span>Outstanding Balance</span>
        <span className="font-bold">
            {primaryAccount ? (primaryAccount.outstandingAmount - totalAllocated).toFixed(2) : '0.00'}
        </span>
      </div>

      {/* Footer Details */}
      <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1 mb-4">
        <span>Payment Type</span>
        <span className="text-right">DIRECT DEPOSIT</span>
        
        <span>Cashier</span>
        <span className="text-right">{CURRENT_CASHIER.name}</span>
        
        <span>Cash Office</span>
        <span className="text-right">{CURRENT_CASHIER.cashOffice}</span>
      </div>

      <div className="text-center mt-8 italic">
        Thank you.
      </div>
    </div>
  );
});

ReceiptTemplate.displayName = 'ReceiptTemplate';
