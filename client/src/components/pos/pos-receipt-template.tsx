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

  const splitReceipts = transaction.splitReceipts || [];
  const hasSplitReceipts = splitReceipts.length > 1;
  const cashReceipts = splitReceipts.filter(r => r.paymentType === 'cash');
  const cardReceipts = splitReceipts.filter(r => r.paymentType === 'card');
  const isSplitPayment = cashReceipts.length > 0 && cardReceipts.length > 0;

  const primaryItem = sortedItems.find(i => i.type === 'CONSUMER_SERVICES' || i.type === 'PREPAID' || i.type === 'CLEARANCE');
  const primaryAccount = primaryItem?.originalData as (Account & Record<string, any>) | null;

  const tenderAmount = isSplitPayment
    ? (transaction.payment.cash + transaction.payment.card)
    : (rd?.tenderAmount ?? rd?.TenderAmount ?? (transaction.payment.cash + transaction.payment.card));
  const changeAmount = isSplitPayment
    ? Math.max(0, (transaction.payment.cash + transaction.payment.card) - totalAmount)
    : (rd?.changeAmount ?? rd?.ChangeAmount ?? Math.max(0, tenderAmount - totalAmount));

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).replace(',', '');
  };

  const uniqueAccounts = new Map<string, { accountId: string; accountName: string; cashReceipt?: SplitReceipt; cardReceipt?: SplitReceipt }>();
  if (isSplitPayment) {
    for (const sr of splitReceipts) {
      const key = sr.accountId || sr.receiptId.toString();
      if (!uniqueAccounts.has(key)) {
        uniqueAccounts.set(key, { accountId: sr.accountId || '', accountName: sr.accountName || '' });
      }
      const entry = uniqueAccounts.get(key)!;
      if (sr.paymentType === 'cash') entry.cashReceipt = sr;
      if (sr.paymentType === 'card') entry.cardReceipt = sr;
    }
  }

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
        {isSplitPayment ? (
            <>
                <div className="font-bold text-center text-[10px] uppercase mb-1">Split Payment Receipt</div>
                {cashReceipts.map((cr, idx) => (
                    <div key={`cash-${idx}`} className="flex justify-between mb-0.5">
                        <span>Cash Receipt {cashReceipts.length > 1 ? `#${idx + 1}` : ''}</span>
                        <span className="text-right text-[10px]">{cr.receiptNumber || '-'}</span>
                    </div>
                ))}
                {cardReceipts.map((cr, idx) => (
                    <div key={`card-${idx}`} className="flex justify-between mb-0.5">
                        <span>Card Receipt {cardReceipts.length > 1 ? `#${idx + 1}` : ''}</span>
                        <span className="text-right text-[10px]">{cr.receiptNumber || '-'}</span>
                    </div>
                ))}
            </>
        ) : hasSplitReceipts ? (
            splitReceipts.map((sr, idx) => (
                <div key={idx} className="flex justify-between mb-0.5">
                    <span>Receipt No {splitReceipts.length > 1 ? `#${idx + 1}` : ''}</span>
                    <span className="text-right">{sr.receiptNumber || '-'}</span>
                </div>
            ))
        ) : (
            <div className="flex justify-between mb-0.5">
                <span>Receipt No</span>
                <span className="text-right">{transaction.receiptNumber}</span>
            </div>
        )}
        <div className="flex justify-between mb-0.5">
            <span>Receipt Date</span>
            <span className="text-right">{rd?.receiptDate || rd?.ReceiptDate || formatDate(transaction.timestamp)}</span>
        </div>

        {(primaryAccount || rd?.accountId) && sortedItems.length <= 1 && (
            <>
                <div className="flex justify-between mb-0.5">
                    <span>Account No</span>
                    <span className="text-right">{rd?.accountId || primaryAccount?.accountNo || primaryAccount?.accountNumber || ''}</span>
                </div>
                {(rd?.oldAccountCode || primaryAccount?.oldCode || primaryAccount?.oldPropertyCode || primaryAccount?.oldAccountCode) && (
                    <div className="flex justify-between mb-0.5">
                        <span>Old Account No</span>
                        <span className="text-right">{rd?.oldAccountCode || primaryAccount?.oldCode || primaryAccount?.oldPropertyCode || primaryAccount?.oldAccountCode}</span>
                    </div>
                )}
                <div className="flex justify-between mb-0.5">
                    <span>Account Name</span>
                    <span className="text-right">{rd?.accName || primaryAccount?.name || primaryAccount?.firstName || ''}</span>
                </div>
                {(rd?.sgNumber || primaryAccount?.sgNo) && (
                    <div className="flex justify-between mb-0.5">
                        <span>SG Number</span>
                        <span className="text-right">{rd?.sgNumber || primaryAccount?.sgNo}</span>
                    </div>
                )}
                {(rd?.accAddress || primaryAccount?.address || primaryAccount?.locationAddress || primaryAccount?.deliveryAddress) && (
                    <div className="flex justify-between mb-0.5">
                        <span>Address</span>
                        <span className="text-right max-w-[55%] break-words">{(rd?.accAddress || primaryAccount?.deliveryAddress || primaryAccount?.locationAddress || primaryAccount?.address || '').replace(/\r\n/g, ', ')}</span>
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
        <div className="font-bold text-center text-[10px] uppercase mb-1">Line Items</div>
        {sortedItems.map((item, idx) => {
            const isDirect = item.type === 'DIRECT_INCOME';
            const directData = isDirect ? (item.originalData as DirectIncomeItem) : null;
            const displayDescription = isDirect
                ? (item.notes || directData?.groupName || item.description)
                : item.description;

            const acctData = item.originalData as any;
            const showAccountDetail = sortedItems.length > 1 && (item.type === 'CONSUMER_SERVICES' || item.type === 'MULTI_ACCOUNT' || item.type === 'ACCOUNT_GROUP');

            return (
                <div key={idx} className="mb-2">
                    {showAccountDetail && (
                        <div className="text-[9px] text-gray-600 mb-0.5">
                            Acc: {acctData?.accountNo || acctData?.accountNumber || item.reference}
                            {acctData?.name ? ` - ${acctData.name}` : ''}
                        </div>
                    )}
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
              <div className="font-bold text-center text-[10px] uppercase mb-1">Service Allocation</div>
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

      {isSplitPayment && (
          <div className="border-t border-gray-300 pt-2 mb-2">
              <div className="font-bold text-center text-[10px] uppercase mb-1">Payment Breakdown</div>
              <div className="flex justify-between mb-0.5">
                  <span>Cash Tendered</span>
                  <span>{transaction.payment.cash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-0.5">
                  <span>Card Payment</span>
                  <span>{transaction.payment.card.toFixed(2)}</span>
              </div>
              {transaction.payment.cardReference && (
                  <div className="flex justify-between mb-0.5 text-[9px]">
                      <span>Card Ref</span>
                      <span>{transaction.payment.cardReference}</span>
                  </div>
              )}
              {changeAmount > 0 && (
                  <div className="flex justify-between mb-0.5">
                      <span>Change (Cash)</span>
                      <span>{changeAmount.toFixed(2)}</span>
                  </div>
              )}

              {uniqueAccounts.size > 0 && sortedItems.length > 1 && (
                  <div className="mt-2 pt-1 border-t border-dashed border-gray-300">
                      <div className="font-bold text-center text-[9px] uppercase mb-1">Per-Account Receipt Detail</div>
                      {Array.from(uniqueAccounts.entries()).map(([key, acct], idx) => (
                          <div key={key} className="mb-1.5">
                              <div className="text-[9px] font-bold">{acct.accountName || `Account ${acct.accountId}`}</div>
                              {acct.cashReceipt && (
                                  <div className="flex justify-between text-[9px]">
                                      <span>Cash: {acct.cashReceipt.receiptNumber}</span>
                                      <span>{acct.cashReceipt.amount.toFixed(2)}</span>
                                  </div>
                              )}
                              {acct.cardReceipt && (
                                  <div className="flex justify-between text-[9px]">
                                      <span>Card: {acct.cardReceipt.receiptNumber}</span>
                                      <span>{acct.cardReceipt.amount.toFixed(2)}</span>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {!isSplitPayment && hasSplitReceipts && (
          <div className="border-t border-gray-300 pt-2 mb-2 text-[9px]">
              <div className="font-bold text-center mb-1 uppercase">Receipt Details</div>
              {splitReceipts.map((sr, idx) => (
                  <div key={idx} className="flex justify-between">
                      <span>{sr.receiptNumber} ({sr.paymentType})</span>
                      <span>{sr.amount.toFixed(2)}</span>
                  </div>
              ))}
          </div>
      )}

      {!isSplitPayment && (rd?.outstandingAmount != null || rd?.OutstandingAmount != null || rd?.outstandingBalance != null || rd?.OutstandingBalance != null || primaryAccount?.outstandingAmount != null || primaryAccount?.outStandingAmt != null) && (
          <div className="border-t border-gray-300 pt-2 mb-2">
              <div className="flex justify-between">
                  <span>Outstanding<br/>Balance</span>
                  <span className="text-right">{(rd?.outstandingAmount ?? rd?.OutstandingAmount ?? rd?.outstandingBalance ?? rd?.OutstandingBalance ?? ((primaryAccount?.outstandingAmount ?? primaryAccount?.outStandingAmt ?? 0) - totalAmount + changeAmount)).toFixed(2)}</span>
              </div>
          </div>
      )}

      {isSplitPayment && uniqueAccounts.size > 0 && (
          <div className="border-t border-gray-300 pt-2 mb-2">
              {Array.from(uniqueAccounts.entries()).map(([key, acct]) => {
                  const lastReceipt = acct.cardReceipt || acct.cashReceipt;
                  const outstanding = lastReceipt?.receiptDetail?.outstandingAmount;
                  if (outstanding == null) return null;
                  return (
                      <div key={key} className="flex justify-between text-[10px]">
                          <span>{acct.accountName || acct.accountId} Balance</span>
                          <span className="text-right">{Number(outstanding).toFixed(2)}</span>
                      </div>
                  );
              })}
          </div>
      )}

      <div className="border-t border-gray-300 pt-2 mb-3">
        <div className="flex justify-between mb-0.5">
            <span>Payment Type</span>
            <span className="text-right">{isSplitPayment ? 'Split (Cash + Card)' : (rd?.paymentType || rd?.PaymentType || transaction.paymentTypeName || (transaction.payment.card > 0 ? 'Card' : 'Cash'))}</span>
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
