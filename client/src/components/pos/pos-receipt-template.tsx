import React, { useState, useEffect } from 'react';
import { TransactionRecord, TransactionItem, ReceiptAllocation, SplitReceipt, ServiceBalance } from '@/lib/pos-state';
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

  const splitReceipts = transaction.splitReceipts || [];
  const hasSplitReceipts = splitReceipts.length > 1;
  const cashReceipts = splitReceipts.filter(r => r.paymentType === 'cash');
  const cardReceipts = splitReceipts.filter(r => r.paymentType === 'card');
  const isSplitPayment = cashReceipts.length > 0 && cardReceipts.length > 0;

  const totalAmount = transaction.totalAmount;

  const firstSplitRd = splitReceipts[0]?.receiptDetail;
  const effectiveRd = rd || firstSplitRd;

  const tenderAmount = isSplitPayment
    ? (transaction.payment.cash + transaction.payment.card)
    : (effectiveRd?.tenderAmount ?? 0);
  const changeAmount = isSplitPayment
    ? Math.max(0, (transaction.payment.cash + transaction.payment.card) - totalAmount)
    : (effectiveRd?.changeAmount ?? 0);

  const hasApiData = !!effectiveRd;

  const apiLineItems: { description: string; amount: number; vatAmount: number }[] =
    effectiveRd?.lineItems || splitReceipts.flatMap((sr: any) => sr.receiptDetail?.lineItems || []);
  const hasLineItems = apiLineItems.length > 0;

  const serviceBalances: { serviceDescription: string; amount: number }[] =
    splitReceipts[0]?.serviceBalances || transaction.items?.[0]?.originalData?.agingBreakdown?.filter((b: any) => Math.abs(b.totalOutstanding || 0) >= 0.01).map((b: any) => ({
      serviceDescription: b.serviceDescription || 'Unknown',
      amount: b.totalOutstanding || 0,
    })) || [];
  const hasServiceBalances = serviceBalances.length > 0;

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

  if (!hasApiData) {
    return (
      <div ref={ref} className="bg-white p-4 mx-auto text-[11px] font-mono leading-relaxed receipt-print w-[340px]">
        <div className="text-center mb-4">
          <h1 className="font-bold text-sm mb-0.5">{muniInfo?.name || 'George UAT Municipality'}</h1>
        </div>
        <div className="border-t border-gray-300 pt-4 text-center">
          <div className="text-red-600 font-bold text-xs mb-2">RECEIPT DATA NOT AVAILABLE</div>
          <p className="text-[10px] text-gray-600">Receipt data could not be retrieved from the billing system.</p>
          <p className="text-[10px] text-gray-600 mt-1">Receipt Number: {transaction.receiptNumber || 'Unknown'}</p>
          <p className="text-[10px] text-gray-600 mt-1">Please contact support or reprint from the View Receipts screen.</p>
        </div>
      </div>
    );
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
                <span className="text-right">{effectiveRd.receiptNo || transaction.receiptNumber}</span>
            </div>
        )}
        <div className="flex justify-between mb-0.5">
            <span>Receipt Date</span>
            <span className="text-right">{effectiveRd.receiptDate || formatDate(transaction.timestamp)}</span>
        </div>

        {effectiveRd.accountId && (
            <>
                <div className="flex justify-between mb-0.5">
                    <span>Account No</span>
                    <span className="text-right">{effectiveRd.accountId}</span>
                </div>
                {effectiveRd.oldAccountCode && (
                    <div className="flex justify-between mb-0.5">
                        <span>Old Account No</span>
                        <span className="text-right">{effectiveRd.oldAccountCode}</span>
                    </div>
                )}
                <div className="flex justify-between mb-0.5">
                    <span>Account Name</span>
                    <span className="text-right">{effectiveRd.accName || ''}</span>
                </div>
                {effectiveRd.sgNumber && (
                    <div className="flex justify-between mb-0.5">
                        <span>SG Number</span>
                        <span className="text-right">{effectiveRd.sgNumber}</span>
                    </div>
                )}
                {effectiveRd.accAddress && (
                    <div className="flex justify-between mb-0.5">
                        <span>Address</span>
                        <span className="text-right max-w-[55%] break-words">{effectiveRd.accAddress.replace(/\r\n/g, ', ')}</span>
                    </div>
                )}
            </>
        )}
      </div>

      {hasServiceBalances && (
          <div className="border-t border-gray-300 pt-2 mb-2">
              <div className="font-bold text-[10px] mb-1">Service Balances:</div>
              {serviceBalances.map((sb: any, idx: number) => (
                  <div key={idx} className="flex justify-between mb-0.5">
                      <span className="break-words w-[65%]">{sb.serviceDescription}</span>
                      <span className="text-right">{Number(sb.amount).toFixed(2)}</span>
                  </div>
              ))}
          </div>
      )}

      {hasLineItems ? (
          <div className="border-t border-gray-300 pt-2 mb-2">
              {(() => {
                  const filteredItems = apiLineItems.filter(li => li.description);

                  return (
                      <>
                          {filteredItems.map((li, idx) => (
                              <div key={idx} className="flex justify-between mb-0.5">
                                  <span className="break-words w-[65%]">{li.description}</span>
                                  <span className="text-right">{Number(li.amount).toFixed(2)}</span>
                              </div>
                          ))}
                          {filteredItems.some(li => (Number(li.vatAmount) || 0) > 0) && (
                              <div className="flex justify-between mt-1 border-t border-dashed border-gray-300 pt-1 mb-1">
                                  <span>Vat Amount</span>
                                  <span className="text-right">{filteredItems.reduce((sum, li) => sum + (Number(li.vatAmount) || 0), 0).toFixed(2)}</span>
                              </div>
                          )}
                      </>
                  );
              })()}
          </div>
      ) : null}

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

              {uniqueAccounts.size > 0 && splitReceipts.length > 1 && (
                  <div className="mt-2 pt-1 border-t border-dashed border-gray-300">
                      <div className="font-bold text-center text-[9px] uppercase mb-1">Per-Account Receipt Detail</div>
                      {Array.from(uniqueAccounts.entries()).map(([key, acct]) => (
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

      {effectiveRd.outstandingAmount != null && (
          <div className="border-t border-gray-300 pt-2 mb-2">
              <div className="flex justify-between">
                  <span>Outstanding<br/>Balance</span>
                  <span className="text-right">{Number(effectiveRd.outstandingAmount).toFixed(2)}</span>
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
            <span className="text-right">{isSplitPayment ? 'Split (Cash + Card)' : (effectiveRd.paymentType || '')}</span>
        </div>
        <div className="flex justify-between mb-0.5">
            <span>Payment Option</span>
            <span className="text-right">{effectiveRd.paymentOption || ''}</span>
        </div>
        <div className="flex justify-between mb-0.5">
            <span>Cashier</span>
            <span className="text-right">{effectiveRd.cashierName || ''}</span>
        </div>
        <div className="flex justify-between mb-0.5">
            <span>Cash Office</span>
            <span className="text-right">{effectiveRd.cashOffice || ''}</span>
        </div>
      </div>

      <div className="text-center mt-4 border-t border-gray-300 pt-3">
        <p>{muniInfo?.receiptFooter || 'Thank you.'}</p>
      </div>
    </div>
  );
});

PosReceiptTemplate.displayName = 'PosReceiptTemplate';
