import React from 'react';
import { Account } from '@/lib/mock-data';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AccountEnquiryView({ item }: { item: TransactionItem }) {
  const account = item.originalData as Account;
  const { updateItemAmount, removeItem } = usePos();

  const Field = ({ label, value }: { label: string, value: string | number | undefined }) => (
    <div className="grid grid-cols-[200px_1fr] border-b border-gray-100 last:border-0 py-1 text-sm">
      <div className="font-semibold text-gray-800 px-2">{label}</div>
      <div className="text-gray-600 px-2">{value || '-'}</div>
    </div>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="bg-gradient-to-b from-gray-200 to-gray-300 px-4 py-2 font-bold text-gray-800 border border-gray-300 mt-6 mb-2 text-sm shadow-sm">
      {title}
    </div>
  );

  return (
    <div className="bg-white p-6 shadow-sm border border-gray-200 text-sm relative">
       {/* Navigation / Actions */}
       <div className="absolute top-6 right-6 flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => removeItem(item.id)}
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <X className="w-4 h-4" />
            Close Enquiry
          </Button>
       </div>

       {/* Main Header */}
       <div className="bg-gradient-to-b from-gray-200 to-gray-300 px-4 py-2 font-bold text-gray-800 border border-gray-300 mb-4 text-sm shadow-sm flex justify-between items-center">
         <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1 text-gray-600 hover:bg-gray-300/50 rounded-sm" onClick={() => removeItem(item.id)}>
                <ArrowLeft className="w-4 h-4" />
             </Button>
             <span>Account Information</span>
         </div>
       </div>

       {/* Top Grid - Account Info */}
       <div className="grid grid-cols-2 gap-x-12 gap-y-0">
         <div>
            <Field label="Account Number" value={account.accountNo} />
            <Field label="Account Group" value="Himun - Haarlem Munisipaliteit" />
            <Field label="Payment Group" value="-" />
            <Field label="Account Type" value={account.accountType} />
            <Field label="Incentive Scheme Code" value="-" />
            <Field label="Email" value={account.email} />
            <Field label="Paid Deposit Amount" value={`R0.00`} />
            
            <div className="h-4"></div>
            <div className="border-t border-gray-300 my-2"></div>
            
            <Field label="Interest Waiver Status" value="No Interest Waiver on Account" />
            <Field label="Indigent Subsidy Status" value="-" />
            <Field label="Consumer RPP Status" value="N/A" />
            <Field label="Departmental Account" value={account.status === 'Active' ? 'Inactive' : 'Active'} />
         </div>

         <div>
            <Field label="Name" value={account.name} />
            <Field label="Sub Account Group" value="-" />
            <Field label="Account Status" value={account.status || 'Active'} />
            <Field label="Delivery Address" value={account.deliveryAddress || account.address} />
            <Field label="Contact Number" value={account.mobile} />
            
            <div className="mt-8 text-xs font-bold underline text-gray-500 mb-2">Additional Account Details</div>
            
            <Field label="Rebate Status" value="No Rebate on Account" />
            <Field label="Handover Status" value="N/A" />
            <Field label="Loan RPP Status" value="N/A" />
         </div>
       </div>

       {/* Property & Partition Section */}
       <div className="grid grid-cols-2 gap-x-12 mt-4 relative">
          {/* Central Titles */}
          <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center gap-32">
             <span className="font-bold underline text-gray-500 text-xs">Property</span>
             <span className="font-bold underline text-gray-500 text-xs">Partition</span>
          </div>

          <div>
             <Field label="SG Number" value={account.sgNo} />
             <Field label="Old Property Code" value={account.oldCode || "Grg 71 0000084600000"} />
             <Field label="Billing Cycle" value="1 Consumer Account Cycle" />
             <Field label="Sectional Title Scheme" value="-" />
             <Field label="Location Address" value={account.address} />
             <Field label="Longitude" value="-" />
             <Field label="Registration Status" value="-" />
             <div className="h-8"></div>
             <div className="border-t border-gray-300 my-2"></div>
             <Field label="Property Type of Use" value="RES" />
             <Field label="Property Category" value="RES" />
             <Field label="Accountable Owner Name" value={account.name} />
          </div>

          <div>
             <Field label="Property ID" value={account.unitId || "42001"} />
             <Field label="Property Status" value="Active" />
             <Field label="Allotment Area" value="Haarlem" />
             <Field label="Farm Name" value="-" />
             <Field label="Property Type" value="Erf" />
             <Field label="Latitude" value="-" />
             <Field label="Magisterial District" value="WC044" />
             <Field label="Property Market Value" value={`R${(account.marketValue || 146000).toFixed(2)}`} />
             
             <div className="h-8"></div>
             <div className="border-t border-gray-300 my-2"></div>
             
             <Field label="Valuation Category" value={account.valuationCategory || "Individual Use"} />
             <Field label="Partition Description" value="Individual Use" />
             <Field label="Partition Market Value" value={`R${(account.marketValue || 146000).toFixed(2)}`} />
          </div>
       </div>

       <div className="flex justify-end mt-4">
          <Button variant="secondary" size="sm" className="bg-orange-200 text-orange-900 border-orange-300 hover:bg-orange-300 font-semibold text-xs shadow-sm">
             Refresh Account Transactions
          </Button>
       </div>

       {/* Service Type Balance Table */}
       <SectionHeader title="Service Type Balance" />
       
       <div className="border border-gray-300 overflow-hidden text-xs">
          <table className="w-full text-left">
             <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-300">
               <tr>
                 <th className="p-2 border-r">Status ↑</th>
                 <th className="p-2 border-r">Service Type ↑</th>
                 <th className="p-2 border-r">Meter Classification ↑</th>
                 <th className="p-2 border-r">Tariff ↑</th>
                 <th className="p-2 border-r">Factor ↑</th>
                 <th className="p-2 border-r">Meter No ↑</th>
                 <th className="p-2 border-r">Physical Meter No ↑</th>
                 <th className="p-2 border-r">Meter Book ↑</th>
                 <th className="p-2">Route ↑</th>
               </tr>
             </thead>
             <tbody>
               <tr className="border-b last:border-0 hover:bg-blue-50">
                 <td className="p-2 border-r">Inactive</td>
                 <td className="p-2 border-r">Waste Disposal</td>
                 <td className="p-2 border-r"></td>
                 <td className="p-2 border-r">REFUS/REM/CONV-Grg Refus Rem Conv</td>
                 <td className="p-2 border-r text-right">1.00</td>
                 <td className="p-2 border-r"></td>
                 <td className="p-2 border-r">No Meter</td>
                 <td className="p-2 border-r">-</td>
                 <td className="p-2"></td>
               </tr>
                <tr className="border-b last:border-0 hover:bg-blue-50">
                 <td className="p-2 border-r">Active</td>
                 <td className="p-2 border-r">Electricity</td>
                 <td className="p-2 border-r">Prepaid</td>
                 <td className="p-2 border-r">ELEC/DOM/PRE-Elec Dom Pre 60A</td>
                 <td className="p-2 border-r text-right">1.00</td>
                 <td className="p-2 border-r">12345</td>
                 <td className="p-2 border-r">{account.prepaidMeterNo || 'No Meter'}</td>
                 <td className="p-2 border-r">BK-01</td>
                 <td className="p-2">RT-A</td>
               </tr>
             </tbody>
          </table>
       </div>
       
       {/* Payment Entry Footer - Integrated into the Enquiry View */}
       <div className="mt-8 bg-blue-50 p-4 border border-blue-200 flex justify-between items-center shadow-sm">
           <div className="text-blue-900 font-semibold">
               Total Outstanding Balance: <span className="text-red-600 text-lg">R {account.outstandingAmount.toFixed(2)}</span>
           </div>
           
           <div className="flex items-center gap-3">
               <Label htmlFor={`pay-${item.id}`} className="font-bold text-gray-700">Payment Allocation:</Label>
               <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono">R</span>
                   <Input 
                        id={`pay-${item.id}`}
                        type="number" 
                        className="pl-8 w-40 font-mono font-bold border-gray-400 focus:ring-blue-500 bg-white"
                        value={item.amountToPay} 
                        onChange={(e) => updateItemAmount(item.id, parseFloat(e.target.value) || 0)}
                    />
               </div>
           </div>
       </div>

    </div>
  );
}
