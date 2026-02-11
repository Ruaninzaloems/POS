import React, { useState } from 'react';
import { Account } from '@/lib/mock-data';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, ArrowLeft, X, Zap, Droplets, ChevronDown, ChevronUp, AlertTriangle, CalendarRange } from 'lucide-react'; // Added Zap, Droplets, CalendarRange
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function AccountEnquiryView({ item }: { item: TransactionItem }) {
  const account = item.originalData as Account;
  const { updateItemAmount, removeItem, addItem, viewingItemId, setViewingItem } = usePos(); // Added addItem
  const [isOpen, setIsOpen] = useState(false);

  const handleBuyPrepaid = () => {
    if (!account.prepaidMeterNo) return;
    
    addItem({
        id: crypto.randomUUID(),
        type: 'PREPAID',
        description: `${account.prepaidType || 'Prepaid'} Recharge ${account.prepaidMeterNo}`,
        reference: account.prepaidMeterNo,
        amountDue: 0,
        amountToPay: 0,
        originalData: account
    });
  };

  const hasPropertyRates = account.agingBreakdown?.some(s => s.serviceDescription.toLowerCase().includes('property rates'));

  const handlePayRatesAdvance = () => {
      addItem({
          id: crypto.randomUUID(),
          type: 'CONSUMER_SERVICES',
          description: `Property Rates Advance Payment - ${account.accountNo}`,
          reference: account.accountNo,
          amountDue: 0,
          amountToPay: 0,
          originalData: account,
          notes: 'Advance Payment for Property Rates'
      });
  };

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
          {hasPropertyRates && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handlePayRatesAdvance}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CalendarRange className="w-4 h-4" />
                Pay Rates in Advance
              </Button>
          )}

          {account.prepaidMeterNo && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleBuyPrepaid}
                className={`gap-2 ${account.prepaidType === 'Water' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}`}
              >
                {account.prepaidType === 'Water' ? <Droplets className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                Buy Prepaid {account.prepaidType || 'Electricity'}
              </Button>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
                if (viewingItemId) {
                    setViewingItem(null); // Close just this view if in multi-mode
                } else {
                    removeItem(item.id); // Or remove item if in single mode
                }
            }}
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <X className="w-4 h-4" />
            {viewingItemId ? 'Back to Basket' : 'Close Enquiry'}
          </Button>
       </div>

       {/* Main Header */}
       <div className="bg-gradient-to-b from-gray-200 to-gray-300 px-4 py-2 font-bold text-gray-800 border border-gray-300 mb-4 text-sm shadow-sm flex justify-between items-center">
         <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1 text-gray-600 hover:bg-gray-300/50 rounded-sm" onClick={() => {
                 if (viewingItemId) setViewingItem(null);
                 else removeItem(item.id);
             }}>
                <ArrowLeft className="w-4 h-4" />
             </Button>
             <span>Account Information</span>
         </div>
       </div>

       {account.prepaidBlocked && (
           <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50 text-red-800">
               <AlertTriangle className="h-4 w-4 stroke-red-600" />
               <AlertTitle className="text-red-900 font-bold ml-2">
                   {account.blockedServices && account.blockedServices.length > 1 
                    ? `Prepaid Services Blocked: ${account.blockedServices.join(' & ')}` 
                    : `Prepaid ${account.blockedServices?.[0] || account.prepaidType || 'Service'} Blocked`}
               </AlertTitle>
               <AlertDescription className="ml-2 text-red-800">
                   <div className="flex flex-col gap-1 mt-1">
                       <span>
                           Purchases are currently blocked for <strong>{account.blockedServices?.join(' and ') || account.prepaidType}</strong>.
                       </span>
                       <span className="font-medium bg-red-100 w-fit px-2 py-0.5 rounded text-xs border border-red-200">
                           Reason: {account.prepaidBlockReason}
                       </span>
                   </div>
               </AlertDescription>
           </Alert>
       )}

       {/* Collapsible Account Details */}
       <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2 mb-6">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border rounded-md">
              <div className="flex flex-col">
                  <span className="font-semibold text-sm text-slate-900">{account.name}</span>
                  <span className="text-xs text-muted-foreground">Acc: {account.accountNo}</span>
              </div>
              <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-9 p-0 h-8">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="sr-only">Toggle details</span>
                  </Button>
              </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent>
               {/* Top Grid - Account Info */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-0 pt-2">
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
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 mt-4 relative">
                  {/* Central Titles */}
                  <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 top-4 flex-col items-center gap-32">
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
          </CollapsibleContent>
       </Collapsible>

       <div className="flex justify-end mt-4">
          <Button variant="secondary" size="sm" className="bg-orange-200 text-orange-900 border-orange-300 hover:bg-orange-300 font-semibold text-xs shadow-sm">
             Refresh Account Transactions
          </Button>
       </div>

       {/* Total Balance/Debt Table */}
       <SectionHeader title="Total Balance/Debt" />
       
       <div className="border border-gray-300 overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse min-w-[800px]">
             <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-300">
               <tr>
                 <th className="p-2 border-r border-gray-300">Service Description ↑</th>
                 <th className="p-2 border-r border-gray-300 text-right">Total Outstanding Amount ↑</th>
                 <th className="p-2 border-r border-gray-300 text-right">New Charge ↑</th>
                 <th className="p-2 border-r border-gray-300 text-right">Current Account ↑</th>
                 <th className="p-2 border-r border-gray-300 text-right">30 Days ↑</th>
                 <th className="p-2 border-r border-gray-300 text-right">60 Days ↑</th>
                 <th className="p-2 border-r border-gray-300 text-right">90 Days ↑</th>
                 <th className="p-2 border-r border-gray-300 text-right">120 Days ↑</th>
                 <th className="p-2 border-r border-gray-300 text-right">150 Days ↑</th>
                 <th className="p-2 text-right">180+ Days ↑</th>
               </tr>
             </thead>
             <tbody>
               {account.agingBreakdown ? (
                   <>
                       {account.agingBreakdown.map((row, index) => (
                           <tr key={index} className="border-b last:border-0 hover:bg-blue-50">
                               <td className="p-2 border-r border-gray-200">{row.serviceDescription}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{row.totalOutstanding.toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{row.newCharge.toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{row.currentAccount.toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{row.days30.toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{row.days60.toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{row.days90.toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{row.days120.toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{row.days150.toFixed(2)}</td>
                               <td className="p-2 text-right">{row.days180Plus.toFixed(2)}</td>
                           </tr>
                       ))}
                       <tr className="bg-gray-100 font-bold border-t border-gray-300">
                           <td className="p-2 border-r border-gray-300"></td>
                           <td className="p-2 border-r border-gray-300 text-right">{account.outstandingAmount.toFixed(2)}</td>
                           <td className="p-2 border-r border-gray-300 text-right">0.00</td>
                           <td className="p-2 border-r border-gray-300 text-right">
                               {account.agingBreakdown.reduce((sum, item) => sum + item.currentAccount, 0).toFixed(2)}
                           </td>
                           <td className="p-2 border-r border-gray-300 text-right">
                               {account.agingBreakdown.reduce((sum, item) => sum + item.days30, 0).toFixed(2)}
                           </td>
                           <td className="p-2 border-r border-gray-300 text-right">
                               {account.agingBreakdown.reduce((sum, item) => sum + item.days60, 0).toFixed(2)}
                           </td>
                           <td className="p-2 border-r border-gray-300 text-right">
                               {account.agingBreakdown.reduce((sum, item) => sum + item.days90, 0).toFixed(2)}
                           </td>
                           <td className="p-2 border-r border-gray-300 text-right">0.00</td>
                           <td className="p-2 border-r border-gray-300 text-right">0.00</td>
                           <td className="p-2 text-right">
                               {account.agingBreakdown.reduce((sum, item) => sum + item.days180Plus, 0).toFixed(2)}
                           </td>
                       </tr>
                   </>
               ) : (
                    // Fallback if no aging data (simplified row)
                    <tr className="border-b last:border-0 hover:bg-blue-50">
                        <td className="p-2 border-r border-gray-200">Balance B/F</td>
                        <td className="p-2 border-r border-gray-200 text-right">{account.outstandingAmount.toFixed(2)}</td>
                        <td className="p-2 border-r border-gray-200 text-right">0.00</td>
                        <td className="p-2 border-r border-gray-200 text-right">{account.outstandingAmount.toFixed(2)}</td>
                        <td className="p-2 border-r border-gray-200 text-right">0.00</td>
                        <td className="p-2 border-r border-gray-200 text-right">0.00</td>
                        <td className="p-2 border-r border-gray-200 text-right">0.00</td>
                        <td className="p-2 border-r border-gray-200 text-right">0.00</td>
                        <td className="p-2 border-r border-gray-200 text-right">0.00</td>
                        <td className="p-2 text-right">0.00</td>
                    </tr>
               )}
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
                        min="0"
                        step="0.01"
                        className="pl-8 w-40 font-mono font-bold border-gray-400 focus:ring-blue-500 bg-white"
                        value={item.amountToPay} 
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val && parseFloat(val) < 0) return;
                            if (val.includes('.') && val.split('.')[1].length > 2) return;
                            updateItemAmount(item.id, parseFloat(val) || 0);
                        }}
                    />
               </div>
           </div>
       </div>

    </div>
  );
}
