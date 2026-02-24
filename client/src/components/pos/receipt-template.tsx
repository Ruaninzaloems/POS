import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BankTransaction, AllocationDraft, AllocationLine, Account, MunicipalityInfo, fetchMunicipalityInfo } from '@/lib/external-api';

interface ReceiptTemplateProps {
  transaction: BankTransaction;
  allocation: AllocationDraft;
  onClose?: () => void;
  isReprint?: boolean;
  isCancelled?: boolean;
}

export const ReceiptTemplate = React.forwardRef<HTMLDivElement, ReceiptTemplateProps>(({ transaction, allocation, isReprint, isCancelled }, ref) => {
  const [muniInfo, setMuniInfo] = useState<MunicipalityInfo | null>(null);
  useEffect(() => {
    fetchMunicipalityInfo().then(setMuniInfo).catch(e => console.error('Failed to load municipality info from API:', e));
  }, []);

  // Find linked account details if available (use the first line's account number as primary for header)
  const primaryLine = allocation.lines[0];
  const primaryAccount = primaryLine ? { accountNo: primaryLine.accountNo, name: primaryLine.description || '', address: '' } as Account : undefined;

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
        <h1 className="font-bold text-sm mb-0.5">{muniInfo?.name || 'George UAT Municipality'}</h1>
        <p className="mb-0.5">{muniInfo?.address1 || 'York Street 1 George 6530'}</p>
        <p className="mb-0.5">{muniInfo?.address2 || 'George'}</p>
        <p>VAT Registration Number: {muniInfo?.vatNo || '4630193664'}</p>
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
            <span>Receipt Date</span>
            <span>{new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '')}</span>
        </div>
        <div className="flex justify-between">
            <span>Payment Date:</span>
            <span>{new Date(transaction.transactionDate).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
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
            const acc = { accountNo: line.accountNo } as Account;
            
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
            <span>Cashier</span>
        </div>
        <div className="flex justify-between">
            <span>Office:</span>
            <span>Cash Office</span>
        </div>
      </div>

      <div className="text-center mt-6 italic text-[9px]">
        {muniInfo?.receiptFooter ? <div className="mb-1">{muniInfo.receiptFooter}</div> : 'Thank you.'}
        <div className="mt-1 text-[8px] text-gray-400">System Gen: {new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '')}</div>
      </div>
    </div>
  );
});

ReceiptTemplate.displayName = 'ReceiptTemplate';
