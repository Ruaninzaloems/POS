import React, { useState, useEffect } from 'react';
import { TransactionRecord, TransactionItem, ReceiptAllocation, SplitReceipt } from '@/lib/pos-state';
import { Account, DirectIncomeItem } from '@/lib/mock-data';
import { MunicipalityInfo, fetchMunicipalityInfo } from '@/lib/external-api';

interface PosReceiptTemplateProps {
  transaction: TransactionRecord;
  isReprint?: boolean;
  isCancelled?: boolean;
}

export const PosReceiptTemplate = React.forwardRef<HTMLDivElement, PosReceiptTemplateProps>(({ transaction, isReprint, isCancelled }, ref) => {
  const [muniInfo, setMuniInfo] = useState<MunicipalityInfo | null>(null);
  useEffect(() => {
    fetchMunicipalityInfo().then(setMuniInfo);
  }, []);

  const rd = transaction.receiptDetail;

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

  const totalAmount = transaction.totalAmount;

  const hasSplitReceipts = transaction.splitReceipts && transaction.splitReceipts.length > 1;
  const cashReceipt = transaction.splitReceipts?.find(r => r.paymentType === 'cash');
  const cardReceipt = transaction.splitReceipts?.find(r => r.paymentType === 'card');

  const primaryItem = sortedItems.find(i => i.type === 'CONSUMER_SERVICES' || i.type === 'PREPAID' || i.type === 'CLEARANCE');
  const primaryAccount = primaryItem?.originalData as (Account & Record<string, any>) | null;

  const tenderAmount = rd?.tenderAmount ?? rd?.TenderAmount ?? (transaction.payment.cash + transaction.payment.card);
  const changeAmount = rd?.changeAmount ?? rd?.ChangeAmount ?? Math.max(0, tenderAmount - totalAmount);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).replace(',', '');
  };

  return (
    <div ref={ref} className="bg-white p-4 mx-auto text-[11px] font-mono leading-relaxed receipt-print relative w-[340px]">
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

      <div className="text-center mb-4 relative z-10">
        <h1 className="font-bold text-sm mb-0.5">{muniInfo?.name || 'George UAT Municipality'}</h1>
        <p className="mb-0.5">{muniInfo?.address1 || 'York Street 1 George 6530'}</p>
        <p className="mb-0.5">{muniInfo?.address2 || 'George'}</p>
        <p>VAT Registration Number: {muniInfo?.vatNo || '4630193664'}</p>
        {isReprint && !isCancelled && <h2 className="font-bold mt-2 text-xs uppercase tracking-widest border-b border-black pb-0.5 inline-block">** REPRINT **</h2>}
        {isCancelled && <h2 className="font-bold mt-2 text-xs uppercase tracking-widest border-b border-red-600 pb-0.5 inline-block text-red-600">** CANCELLED **</h2>}
      </div>

      <div className="border-t border-gray-300 pt-2 mb-3">
        {hasSplitReceipts ? (
            <>
                <div className="flex justify-between mb-0.5">
                    <span>Receipt No (Cash)</span>
                    <span className="text-right">{cashReceipt?.receiptNumber || '-'}</span>
                </div>
                <div className="flex justify-between mb-0.5">
                    <span>Receipt No (Card)</span>
                    <span className="text-right">{cardReceipt?.receiptNumber || '-'}</span>
                </div>
            </>
        ) : (
            <div className="flex justify-between mb-0.5">
                <span>Receipt No</span>
                <span className="text-right">{transaction.receiptNumber}</span>
            </div>
        )}
        <div className="flex justify-between mb-0.5">
            <span>Receipt Date</span>
            <span className="text-right">{formatDate(transaction.timestamp)}</span>
        </div>

        {primaryAccount && (
            <>
                <div className="flex justify-between mb-0.5">
                    <span>Account No</span>
                    <span className="text-right">{primaryAccount.accountNo || primaryAccount.accountNumber || ''}</span>
                </div>
                {(primaryAccount.oldCode || primaryAccount.oldPropertyCode || primaryAccount.oldAccountCode) && (
                    <div className="flex justify-between mb-0.5">
                        <span>Old Account No</span>
                        <span className="text-right">{primaryAccount.oldCode || primaryAccount.oldPropertyCode || primaryAccount.oldAccountCode}</span>
                    </div>
                )}
                <div className="flex justify-between mb-0.5">
                    <span>Account Name</span>
                    <span className="text-right">{primaryAccount.name || primaryAccount.firstName || ''}</span>
                </div>
                {primaryAccount.sgNo && (
                    <div className="flex justify-between mb-0.5">
                        <span>SG Number</span>
                        <span className="text-right">{primaryAccount.sgNo}</span>
                    </div>
                )}
                {(primaryAccount.address || primaryAccount.locationAddress || primaryAccount.deliveryAddress) && (
                    <div className="flex justify-between mb-0.5">
                        <span>Address</span>
                        <span className="text-right max-w-[55%] break-words">{primaryAccount.deliveryAddress || primaryAccount.locationAddress || primaryAccount.address}</span>
                    </div>
                )}
            </>
        )}

        {!primaryAccount && sortedItems.length > 0 && sortedItems[0].type === 'DIRECT_INCOME' && (
            <>
                {sortedItems[0].paidBy && (
                    <div className="flex justify-between mb-0.5">
                        <span>Paid By</span>
                        <span className="text-right">{sortedItems[0].paidBy}</span>
                    </div>
                )}
                {sortedItems[0].reference && (
                    <div className="flex justify-between mb-0.5">
                        <span>Reference</span>
                        <span className="text-right">{sortedItems[0].reference}</span>
                    </div>
                )}
            </>
        )}
      </div>

      <div className="border-t border-gray-300 pt-2 mb-2">
        {sortedItems.map((item, idx) => {
            const isDirect = item.type === 'DIRECT_INCOME';
            const directData = isDirect ? (item.originalData as DirectIncomeItem) : null;
            const displayDescription = isDirect
                ? (item.notes || directData?.groupName || item.description)
                : item.description;

            return (
                <div key={idx} className="mb-2">
                    <div className="flex justify-between">
                        <span className="break-words w-[65%]">{displayDescription}</span>
                        <span className="text-right">{item.amountToPay.toFixed(2)}</span>
                    </div>
                    {item.type === 'PREPAID' && (
                        <div className="mt-1 bg-gray-50 p-1 rounded border border-gray-200 text-[9px]">
                            <div className="font-bold text-center mb-1">TOKEN: 1234 5678 9012 3456 7890</div>
                            <div className="grid grid-cols-2 gap-x-2">
                                <span>Units:</span>
                                <span className="text-right">124.5 kWh</span>
                            </div>
                        </div>
                    )}
                </div>
            );
        })}
      </div>

      {transaction.allocations && transaction.allocations.length > 0 ? (
          <div className="border-t border-gray-300 pt-2 mb-2">
              {transaction.allocations.map((alloc, idx) => (
                  <div key={idx} className="mb-1">
                      <div className="flex justify-between">
                          <span className="w-[65%] truncate">{alloc.service}</span>
                          <span className="text-right">{alloc.amount.toFixed(2)}</span>
                      </div>
                  </div>
              ))}
              <div className="flex justify-between mt-1">
                  <span>Vat Amount</span>
                  <span className="text-right">{transaction.allocations.reduce((sum, a) => sum + a.vat, 0).toFixed(2)}</span>
              </div>
          </div>
      ) : (
          <div className="border-t border-gray-300 pt-2 mb-2">
              {sortedItems.map((item, idx) => {
                  const itemVat = item.amountToPay * (15 / 115);
                  return (
                      <div key={idx} className="flex justify-between">
                          <span>{item.description}</span>
                          <span className="text-right">{item.amountToPay.toFixed(2)}</span>
                      </div>
                  );
              })}
              <div className="flex justify-between mt-1">
                  <span>Vat Amount</span>
                  <span className="text-right">{(totalAmount * 15 / 115).toFixed(2)}</span>
              </div>
          </div>
      )}

      <div className="border-t border-gray-300 pt-2 mb-2">
        <div className="flex justify-between font-bold text-sm">
            <span>Total</span>
            <span>{totalAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mt-1">
            <span>Tender Amount</span>
            <span>{tenderAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
            <span>Change</span>
            <span>{changeAmount.toFixed(2)}</span>
        </div>
      </div>

      {hasSplitReceipts && (
          <div className="border-t border-gray-300 pt-2 mb-2 text-[9px]">
              <div className="font-bold text-center mb-1 uppercase">Split Payment Details</div>
              {cashReceipt && (
                  <div className="flex justify-between">
                      <span>Cash Receipt: {cashReceipt.receiptNumber}</span>
                      <span>{cashReceipt.amount.toFixed(2)}</span>
                  </div>
              )}
              {cardReceipt && (
                  <div className="flex justify-between">
                      <span>Card Receipt: {cardReceipt.receiptNumber}</span>
                      <span>{cardReceipt.amount.toFixed(2)}</span>
                  </div>
              )}
          </div>
      )}

      {(rd?.outstandingAmount != null || rd?.OutstandingAmount != null || rd?.outstandingBalance != null || rd?.OutstandingBalance != null || primaryAccount?.outstandingAmount != null || primaryAccount?.outStandingAmt != null) && (
          <div className="border-t border-gray-300 pt-2 mb-2">
              <div className="flex justify-between">
                  <span>Outstanding<br/>Balance</span>
                  <span className="text-right">{(rd?.outstandingAmount ?? rd?.OutstandingAmount ?? rd?.outstandingBalance ?? rd?.OutstandingBalance ?? ((primaryAccount?.outstandingAmount ?? primaryAccount?.outStandingAmt ?? 0) - totalAmount + changeAmount)).toFixed(2)}</span>
              </div>
          </div>
      )}

      <div className="border-t border-gray-300 pt-2 mb-3">
        <div className="flex justify-between mb-0.5">
            <span>Payment Type</span>
            <span className="text-right">{rd?.paymentType || rd?.PaymentType || transaction.paymentTypeName || (transaction.payment.card > 0 ? 'Card' : 'Cash')}</span>
        </div>
        <div className="flex justify-between mb-0.5">
            <span>Payment Option</span>
            <span className="text-right">{rd?.paymentOption || rd?.PaymentOption || transaction.paymentOptionName || 'Consumer Services'}</span>
        </div>
        <div className="flex justify-between mb-0.5">
            <span>Cashier</span>
            <span className="text-right">{rd?.cashierName || rd?.CashierName || transaction.cashierName || transaction.cashierId}</span>
        </div>
        <div className="flex justify-between mb-0.5">
            <span>Cash Office</span>
            <span className="text-right">{rd?.cashOffice || rd?.CashOffice || transaction.cashOfficeName || ''}</span>
        </div>
      </div>

      <div className="text-center mt-4 border-t border-gray-300 pt-3">
        <p>{muniInfo?.receiptFooter || 'Thank you.'}</p>
      </div>
    </div>
  );
});

PosReceiptTemplate.displayName = 'PosReceiptTemplate';
