import React from 'react';
import { TransactionItem } from '@/lib/pos-state';
import { DirectIncomeItem, MunicipalityInfo, fetchMunicipalityInfo } from '@/lib/external-api';
import { format } from 'date-fns';

interface PermitTemplateProps {
  transaction: any;
  items: TransactionItem[];
  reprint?: boolean;
}

interface PermitTemplateState {
  muniInfo: MunicipalityInfo | null;
}

export class PermitTemplate extends React.Component<PermitTemplateProps, PermitTemplateState> {
  state: PermitTemplateState = { muniInfo: null };

  componentDidMount() {
    fetchMunicipalityInfo().then(muniInfo => this.setState({ muniInfo }));
  }

  render() {
    const { transaction, items, reprint } = this.props;
    const { muniInfo } = this.state;
    const permitItem = items.find(i => i.type === 'DIRECT_INCOME' && 
      (i.description.toLowerCase().includes('permit') || i.description.toLowerCase().includes('certificate')));
    
    if (!permitItem) return null;
    
    const isHawker = permitItem.description.toLowerCase().includes('hawker');
    const isHealth = permitItem.description.toLowerCase().includes('health');
    const title = isHawker ? 'HAWKER PERMIT' : (isHealth ? 'HEALTH CERTIFICATE' : 'OFFICIAL PERMIT');

    return (
      <div className="p-8 font-sans max-w-[800px] mx-auto border-4 border-double border-gray-800 m-8">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
          <div className="flex items-center justify-center gap-4 mb-4">
             {/* Simple Coat of Arms Placeholder */}
             <div className="w-16 h-16 border-2 border-gray-800 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">M</span>
             </div>
             <div>
                 <h1 className="text-3xl font-bold tracking-widest uppercase">{muniInfo?.name || 'George UAT Municipality'}</h1>
                 <p className="text-sm uppercase tracking-wider">{muniInfo?.address1 || ''}</p>
             </div>
          </div>
          
          <h2 className="text-4xl font-black uppercase mt-6 tracking-widest underline decoration-double underline-offset-4">{title}</h2>
          {reprint && <p className="text-sm font-bold mt-2 uppercase">(Copy / Reprint)</p>}
        </div>

        {/* Permit Details */}
        <div className="space-y-6 text-lg">
            <div className="flex justify-between border-b border-gray-300 pb-2">
                <span className="font-bold uppercase text-gray-600">Permit Number:</span>
                <span className="font-mono font-bold text-xl">{transaction?.receiptNumber || '—'}</span>
            </div>

            <div className="flex justify-between border-b border-gray-300 pb-2">
                <span className="font-bold uppercase text-gray-600">Date Issued:</span>
                <span className="font-mono font-bold">{new Date().toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>

            <div className="flex justify-between border-b border-gray-300 pb-2">
                <span className="font-bold uppercase text-gray-600">Valid Until:</span>
                <span className="font-mono font-bold">{new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>

            <div className="mt-8">
                <p className="font-bold uppercase text-gray-600 mb-2">Issued To:</p>
                <div className="border-2 border-gray-200 bg-gray-50 p-4 rounded-lg">
                    <p className="text-2xl font-bold uppercase">{permitItem.paidBy}</p>
                    <p className="mt-1 text-gray-600 whitespace-pre-wrap">{permitItem.notes}</p>
                </div>
            </div>

            <div className="mt-8">
                <p className="font-bold uppercase text-gray-600 mb-2">Permit Details:</p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-200 p-3 rounded">
                        <span className="block text-xs text-gray-500 uppercase">Type</span>
                        <span className="font-bold">{permitItem.description}</span>
                    </div>
                    <div className="border border-gray-200 p-3 rounded">
                        <span className="block text-xs text-gray-500 uppercase">Amount Paid</span>
                        <span className="font-bold">R {permitItem.amountToPay.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t-2 border-gray-800 flex justify-between items-end">
            <div className="text-center">
                <div className="w-48 border-b border-gray-400 mb-2"></div>
                <p className="text-xs uppercase font-bold">Authorised Signature</p>
            </div>

            <div className="text-center">
                <div className="w-24 h-24 border-2 border-gray-400 rounded-full flex items-center justify-center rotate-[-15deg] opacity-50">
                    <span className="text-xs font-bold uppercase text-center leading-tight">Official<br/>Stamp</span>
                </div>
            </div>

            <div className="text-right text-xs text-gray-500">
                <p>Issued by: {transaction?.cashierName || 'System'}</p>
                <p>Ref: {permitItem.id.split('-').pop()}</p>
            </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-gray-400 uppercase tracking-widest">
            This document serves as an official permit and proof of payment.
        </div>
      </div>
    );
  }
}