import React, { useState, useEffect, useCallback } from 'react';
import { Account, AgingItem } from '@/lib/mock-data';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, ArrowLeft, X, Zap, Droplets, ChevronDown, ChevronUp, AlertTriangle, CalendarRange, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  platinumGetConsAccountDetails,
  platinumGetAccountDetails,
  platinumGetAccountInformation,
  platinumGetContactDetails,
  platinumGetPropertyDetails,
  platinumGetPropertyDetailsByAccount,
  platinumGetNameInfoByAccount,
  platinumGetHandoverByAccount,
  platinumGetPaymentIncentiveByAccount,
} from '@/lib/external-api';

function formatPropertyId(propId: string | number | undefined): string {
  if (!propId) return '';
  const num = typeof propId === 'string' ? parseInt(propId, 10) : propId;
  return isNaN(num) ? String(propId) : String(num);
}

export function AccountEnquiryView({ item }: { item: TransactionItem }) {
  const baseAccount = item.originalData as Account;
  const { updateItemAmount, removeItem, addItem, viewingItemId, setViewingItem } = usePos();
  const [isOpen, setIsOpen] = useState(false);
  const [account, setAccount] = useState<Account>(baseAccount);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [propertyEnquiry, setPropertyEnquiry] = useState<any>(null);
  const [nameInfo, setNameInfo] = useState<any>(null);
  const [handoverStatus, setHandoverStatus] = useState<string>('N/A');
  const [incentiveCode, setIncentiveCode] = useState<string>('-');

  useEffect(() => {
    if (!baseAccount.apiId || detailsLoaded) return;
    let cancelled = false;
    setDetailsLoading(true);

    (async () => {
      try {
        const accountId = baseAccount.apiId!;
        const accountIdStr = String(accountId);

        const [consDetails, acctDetails, acctInfo, contactDetails, propEnquiry, nameData, handoverData, incentiveData] = await Promise.all([
          platinumGetConsAccountDetails(accountId).catch(() => null),
          platinumGetAccountDetails({ accountId: accountIdStr }).catch(() => null),
          platinumGetAccountInformation({ accountId: accountIdStr }).catch(() => null),
          platinumGetContactDetails({ accountId: accountIdStr }).catch(() => null),
          platinumGetPropertyDetailsByAccount(accountId).catch(() => null),
          platinumGetNameInfoByAccount(accountId).catch(() => null),
          platinumGetHandoverByAccount(accountId).catch(() => null),
          platinumGetPaymentIncentiveByAccount(accountId).catch(() => null),
        ]);

        if (cancelled) return;

        const updated = { ...baseAccount };

        if (nameData && typeof nameData === 'object' && nameData.surname_Company) {
          setNameInfo(nameData);
          updated.firstName = nameData.firstNames || '';
          updated.surname = nameData.surname_Company || '';
          updated.name = `${nameData.firstNames || ''} ${nameData.surname_Company || ''}`.trim();
          updated.email = nameData.email || updated.email;
          updated.mobile = nameData.tel_Mobile || nameData.tel_Home || nameData.tel_Work || updated.mobile;
          updated.idNo = nameData.idNo_RegistrationNo || updated.idNo;
        }

        if (consDetails && !consDetails._error) {
          updated.outstandingAmount = consDetails.outStandingAmt ?? baseAccount.outstandingAmount;
          updated.oldCode = consDetails.oldAccountCode || baseAccount.oldCode;
          updated.accountType = consDetails.accountDesc || updated.accountType;
          updated.sgNo = consDetails.erfNumber || updated.sgNo;
          if (consDetails.deliveryAddress) {
            updated.deliveryAddress = consDetails.deliveryAddress.replace(/\r\n/g, ', ').replace(/,\s*$/, '');
          }
          updated.paidDepositAmount = consDetails.deposit ?? 0;
        }

        if (acctDetails && !acctDetails._error) {
          updated.unitId = acctDetails.unitID?.toString();
          updated.unitPartitionId = acctDetails.unitPartitionID;
          updated.oldCode = acctDetails.oldAccountCode || updated.oldCode;

          const deliveryParts = [
            acctDetails.nonStandAddLine1,
            acctDetails.nonStandAddLine2,
            acctDetails.nonStandAddCityTown,
            acctDetails.deliveryPostalCode,
          ].filter(Boolean);
          if (deliveryParts.length > 0) {
            updated.deliveryAddress = deliveryParts.join(', ');
          }
        }

        if (acctInfo && !acctInfo._error) {
          updated.status = acctInfo.accountStatus || updated.status;
          updated.accountType = acctInfo.accountDesc || updated.accountType;
          if (acctInfo.groupCodeDesc) {
            updated.accountGroup = acctInfo.groupCodeDesc;
          }
        }

        if (contactDetails && !contactDetails._error) {
          updated.email = contactDetails.email || updated.email;
          const contactMobile = contactDetails.tel_Mobile || contactDetails.tel_Home || contactDetails.tel_Work;
          if (contactMobile) {
            updated.mobile = contactMobile;
          }
        }

        if (propEnquiry && typeof propEnquiry === 'object' && propEnquiry.propertyId) {
          setPropertyEnquiry(propEnquiry);
          updated.propertyId = propEnquiry.propertyId?.toString();
          updated.sgNo = propEnquiry.sgNumber || updated.sgNo;
          updated.propertyType = propEnquiry.typeofUse ? undefined : updated.propertyType;
          updated.propertyTypeOfUse = propEnquiry.typeofUse || updated.propertyTypeOfUse;
          updated.propertyCategory = propEnquiry.townPlanningZoneType || updated.propertyCategory;
          updated.marketValue = propEnquiry.marketValue ?? updated.marketValue;
          updated.farmName = propEnquiry.farmName || updated.farmName;
          updated.locationAddress = [propEnquiry.streetNumber, propEnquiry.streetName, propEnquiry.suburb, propEnquiry.town].filter(Boolean).join(', ') || updated.locationAddress;
        }

        const unitId = acctDetails?.unitID;
        let propMgmtDetails: any = null;
        if (unitId) {
          try {
            propMgmtDetails = await platinumGetPropertyDetails({ unitId: String(unitId) });
          } catch {}
        }

        if (cancelled) return;

        if (propMgmtDetails && !propMgmtDetails._error) {
          updated.sgNo = propMgmtDetails.sgNumber || updated.sgNo;
          updated.propertyId = propMgmtDetails.id?.toString() || updated.propertyId;
          updated.propertyStatus = propMgmtDetails.statusDescription || updated.propertyStatus;
          updated.billingCycle = propMgmtDetails.billingCycleDescription || updated.billingCycle;
          updated.allotmentArea = propMgmtDetails.allotmentCodeDescription || propMgmtDetails.townName || updated.allotmentArea;
          updated.sectionalTitleScheme = propMgmtDetails.sectionalTitleName || updated.sectionalTitleScheme;
          updated.farmName = propMgmtDetails.farmName || updated.farmName;
          updated.locationAddress = propMgmtDetails.locationAddress || updated.locationAddress;
          updated.propertyType = propMgmtDetails.propertyTypeDescription || updated.propertyType;
          updated.magisterialDistrict = propMgmtDetails.magisterialDist || updated.magisterialDistrict;
          updated.marketValue = propMgmtDetails.marketValue ?? updated.marketValue;
          updated.propertyTypeOfUse = propMgmtDetails.propertyTypeOfUseDescription || updated.propertyTypeOfUse;
          updated.propertyCategory = propMgmtDetails.ntPropertyCategoryDescription || updated.propertyCategory;
          updated.registrationStatus = propMgmtDetails.statusDescription === 'Active' ? 'Registered' : (propMgmtDetails.statusDescription || updated.registrationStatus);
          updated.oldPropertyCode = propMgmtDetails.oldPropertyCode || updated.oldPropertyCode;
        }

        if (typeof handoverData === 'string') {
          setHandoverStatus(handoverData || 'N/A');
          updated.handoverStatus = handoverData || 'N/A';
        } else if (handoverData && typeof handoverData === 'object' && !handoverData._error) {
          const desc = handoverData.statusDescription || handoverData.description || 'N/A';
          setHandoverStatus(desc);
          updated.handoverStatus = desc;
        }

        if (incentiveData && typeof incentiveData === 'object' && !incentiveData._error) {
          const code = incentiveData.code || incentiveData.description || '-';
          setIncentiveCode(code);
          updated.incentiveSchemeCode = code;
        }

        if (baseAccount.addName) {
          const addNameMatch = baseAccount.addName.match(/^(\S+)\s+(.*)/);
          if (addNameMatch) {
            const rest = addNameMatch[2].replace(/\s*\(\d+\)\s*$/, '').trim();
            const idMatch = baseAccount.addName.match(/\((\d+)\)/);
            updated.accountableOwnerName = `${rest} ${addNameMatch[1]}${idMatch ? ' ' + idMatch[1] : ''}`.trim();
          } else {
            updated.accountableOwnerName = baseAccount.addName;
          }
        } else if (nameData?.firstNames && nameData?.surname_Company) {
          const idNo = nameData.idNo_RegistrationNo || '';
          updated.accountableOwnerName = `${nameData.firstNames} ${nameData.surname_Company}${idNo ? ' ' + idNo : ''}`.trim();
        }

        updated.accountGroup = updated.accountGroup || 'None - Normal';

        if (!cancelled) {
          setAccount(updated);
          setDetailsLoaded(true);
          setDetailsLoading(false);
        }
      } catch (e) {
        console.error('Failed to load account details:', e);
        if (!cancelled) {
          setDetailsLoading(false);
          setDetailsLoaded(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [baseAccount.apiId]);

  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const fetchBalanceData = useCallback(async () => {
    if (!baseAccount.apiId) return;
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const res = await fetch(`/api/platinum/billing-enquiry/total-balance-debt?accountId=${baseAccount.apiId}`);
      if (!res.ok) {
        setBalanceError('Failed to load balance data');
        return;
      }
      const data = await res.json();
      console.log('Balance Data Response:', data); // Debug logging

      // Handle both formats: array of rows or single object with results
      let rows = [];
      if (Array.isArray(data)) {
        rows = data;
      } else if (data && Array.isArray(data.results)) {
        rows = data.results;
      } else if (data && typeof data === 'object') {
        rows = [data];
      }

      if (rows.length > 0) {
        const agingBreakdown: AgingItem[] = rows.map((row: any) => ({
          serviceDescription: row.serviceDescription || row.description || 'Unknown',
          totalOutstanding: row.totalOutStanding || row.totalOutstanding || 0,
          newCharge: row.newCharge || 0,
          currentAccount: typeof row.currentAccount === 'string' ? parseFloat(row.currentAccount) || row.current || 0 : (row.currentAccount || row.current || 0),
          days30: row.days30 || row.aging30 || 0,
          days60: row.days60 || row.aging60 || 0,
          days90: row.days90 || row.aging90 || 0,
          days120: row.days120 || row.aging120 || 0,
          days150: row.days150 || row.aging150 || 0,
          days180Plus: row.untill360 || row.days180Plus || row.days180 || 0,
        }));
        const totalOutstanding = agingBreakdown.reduce((sum, item) => sum + item.totalOutstanding, 0);
        setAccount(prev => ({
          ...prev,
          agingBreakdown,
          outstandingAmount: totalOutstanding
        }));
      }
    } catch (e: any) {
      setBalanceError(e.message || 'Failed to load balance data');
    } finally {
      setBalanceLoading(false);
    }
  }, [baseAccount.apiId]);

  useEffect(() => {
    fetchBalanceData();
  }, [fetchBalanceData]);

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
       <div className="absolute top-6 right-6 flex gap-2">
          {hasPropertyRates && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handlePayRatesAdvance}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-pay-rates-advance"
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
                data-testid="button-buy-prepaid"
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
                    setViewingItem(null);
                } else {
                    removeItem(item.id);
                }
            }}
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            data-testid="button-close-enquiry"
          >
            <X className="w-4 h-4" />
            {viewingItemId ? 'Back to Basket' : 'Close Enquiry'}
          </Button>
       </div>

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

       <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2 mb-6">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border rounded-md">
              <div className="flex flex-col">
                  <span className="font-semibold text-sm text-slate-900">{account.name}</span>
                  <span className="text-xs text-muted-foreground">Acc: {account.accountNo}</span>
              </div>
              <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-9 p-0 h-8" data-testid="button-toggle-details">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="sr-only">Toggle details</span>
                  </Button>
              </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent>
               {detailsLoading && (
                 <div className="flex items-center justify-center py-4 text-gray-500 gap-2">
                   <Loader2 className="w-4 h-4 animate-spin" />
                   Loading account details from billing system...
                 </div>
               )}

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-0 pt-2">
                 <div>
                    <Field label="Account Number" value={account.accountNo} />
                    <Field label="Account Group" value={account.accountGroup || 'None - Normal'} />
                    <Field label="Payment Group" value={account.paymentGroup || 'Default'} />
                    <Field label="Account Type" value={account.accountType} />
                    <Field label="Incentive Scheme Code" value={account.incentiveSchemeCode || incentiveCode} />
                    <Field label="Email" value={account.email} />
                    <Field label="Paid Deposit Amount" value={`R${(account.paidDepositAmount ?? 0).toFixed(2)}`} />
                    
                    <div className="h-4"></div>
                    <div className="border-t border-gray-300 my-2"></div>
                    
                    <Field label="Interest Waiver Status" value={account.interestWaiverStatus || 'No Interest Waiver on Account'} />
                    <Field label="Indigent Subsidy Status" value={account.indigentSubsidyStatus} />
                    <Field label="Consumer RPP Status" value={account.consumerRppStatus || 'N/A'} />
                    <Field label="Departmental Account" value={account.departmentalAccount || 'Inactive'} />
                 </div>

                 <div>
                    <Field label="Name" value={account.name} />
                    <Field label="Sub Account Group" value={account.subAccountGroup} />
                    <Field label="Account Status" value={account.status || 'Active'} />
                    <Field label="Delivery Address" value={account.deliveryAddress || account.address} />
                    <Field label="Contact Number" value={account.mobile} />
                    
                    <div className="mt-8 text-xs font-bold underline text-gray-500 mb-2">Additional Account Details</div>
                    
                    <Field label="Rebate Status" value={account.rebateStatus || 'No Rebate on Account'} />
                    <Field label="Handover Status" value={account.handoverStatus || handoverStatus} />
                    <Field label="Loan RPP Status" value={account.loanRppStatus || 'N/A'} />
                 </div>
               </div>

               <div className="mt-4 text-center">
                  <span className="font-bold underline text-gray-500 text-xs">Property</span>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 mt-1">
                  <div>
                     <Field label="SG Number" value={account.sgNo} />
                     <Field label="Old Property Code" value={account.oldCode || account.oldPropertyCode} />
                     <Field label="Billing Cycle" value={account.billingCycle || '1 Consumer Account Cycle'} />
                     <Field label="Sectional Title Scheme" value={account.sectionalTitleScheme} />
                     <Field label="Location Address" value={account.locationAddress || account.address} />
                     <Field label="Longitude" value={propertyEnquiry?.longitude} />
                     <Field label="Registration Status" value={account.registrationStatus || 'Registered'} />
                  </div>
                  <div>
                     <Field label="Property ID" value={formatPropertyId(account.propertyId) || account.unitId} />
                     <Field label="Property Status" value={account.propertyStatus || account.status || 'Active'} />
                     <Field label="Allotment Area" value={account.allotmentArea || 'George'} />
                     <Field label="Farm Name" value={account.farmName} />
                     <Field label="Property Type" value={account.propertyType || 'Erf'} />
                     <Field label="Latitude" value={propertyEnquiry?.latitude} />
                     <Field label="Magisterial District" value={account.magisterialDistrict || 'WC044'} />
                     <Field label="Property Market Value" value={account.marketValue != null ? `R ${account.marketValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined} />
                  </div>
               </div>

               <div className="mt-4 text-center">
                  <span className="font-bold underline text-gray-500 text-xs">Partition</span>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 mt-1">
                  <div>
                     <Field label="Property Type of Use" value={account.propertyTypeOfUse || 'RES'} />
                     <Field label="Property Category" value={account.propertyCategory || 'RES'} />
                     <Field label="Accountable Owner Name" value={(() => {
                        const ownerName = account.accountableOwnerName || account.addName || account.name;
                        const idNo = account.idNo || nameInfo?.idNo_RegistrationNo;
                        if (idNo && ownerName && !ownerName.includes(idNo)) {
                          return `${ownerName} (${idNo})`;
                        }
                        return ownerName;
                     })()} />
                  </div>
                  <div>
                     <Field label="Valuation Category" value={account.valuationCategory || 'Individual Use'} />
                     <Field label="Partition Description" value={account.partitionDescription || 'Individual Use'} />
                     <Field label="Partition Market Value" value={(() => {
                        const val = account.partitionMarketValue ?? account.marketValue;
                        return val != null ? `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined;
                     })()} />
                  </div>
               </div>
          </CollapsibleContent>
       </Collapsible>

       <div className="flex justify-end mt-4">
          <Button 
            variant="secondary" 
            size="sm" 
            className="bg-orange-200 text-orange-900 border-orange-300 hover:bg-orange-300 font-semibold text-xs shadow-sm gap-1"
            onClick={fetchBalanceData}
            disabled={balanceLoading}
            data-testid="button-refresh-account-transactions"
          >
             {balanceLoading && <Loader2 className="w-3 h-3 animate-spin" />}
             Refresh Account Transactions
          </Button>
       </div>

       <SectionHeader title="Total Balance/Debt" />
       
       <div className="border border-gray-300 overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse min-w-[800px]">
             <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-300">
               <tr>
                 <th className="p-2 border-r border-gray-300">Service Description</th>
                 <th className="p-2 border-r border-gray-300 text-right">Total Outstanding Amount</th>
                 <th className="p-2 border-r border-gray-300 text-right">New Charge</th>
                 <th className="p-2 border-r border-gray-300 text-right">Current Account</th>
                 <th className="p-2 border-r border-gray-300 text-right">30 Days</th>
                 <th className="p-2 border-r border-gray-300 text-right">60 Days</th>
                 <th className="p-2 border-r border-gray-300 text-right">90 Days</th>
                 <th className="p-2 border-r border-gray-300 text-right">120 Days</th>
                 <th className="p-2 border-r border-gray-300 text-right">150 Days</th>
                 <th className="p-2 text-right">180+ Days</th>
               </tr>
             </thead>
             <tbody>
               {balanceLoading ? (
                    <tr>
                        <td colSpan={10} className="p-4 text-center text-gray-500">
                            <div className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading balance data...
                            </div>
                        </td>
                    </tr>
               ) : balanceError ? (
                    <tr>
                        <td colSpan={10} className="p-4 text-center text-red-500">
                            <div className="flex items-center justify-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {balanceError}
                                <Button variant="link" size="sm" className="text-blue-600 p-0 h-auto" onClick={fetchBalanceData}>Retry</Button>
                            </div>
                        </td>
                    </tr>
               ) : account.agingBreakdown && account.agingBreakdown.length > 0 ? (
                   <>
                       {account.agingBreakdown.map((row, index) => (
                           <tr key={index} className="border-b last:border-0 hover:bg-blue-50" data-testid={`row-aging-${index}`}>
                               <td className="p-2 border-r border-gray-200">{row.totalOutstanding < 0 && row.serviceDescription === 'Balance B/F' ? 'Advance Payment' : row.serviceDescription}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{(row.totalOutstanding || 0).toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{(row.newCharge || 0).toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{(row.currentAccount || 0).toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{(row.days30 || 0).toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{(row.days60 || 0).toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{(row.days90 || 0).toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{(row.days120 || 0).toFixed(2)}</td>
                               <td className="p-2 border-r border-gray-200 text-right">{(row.days150 || 0).toFixed(2)}</td>
                               <td className="p-2 text-right">{(row.days180Plus || 0).toFixed(2)}</td>
                           </tr>
                       ))}
                       <tr className="bg-gray-100 font-bold border-t border-gray-300">
                           <td className="p-2 border-r border-gray-300">Total</td>
                           <td className="p-2 border-r border-gray-300 text-right">{account.agingBreakdown.reduce((sum, item) => sum + item.totalOutstanding, 0).toFixed(2)}</td>
                           <td className="p-2 border-r border-gray-300 text-right">{account.agingBreakdown.reduce((sum, item) => sum + item.newCharge, 0).toFixed(2)}</td>
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
                           <td className="p-2 border-r border-gray-300 text-right">
                               {account.agingBreakdown.reduce((sum, item) => sum + item.days120, 0).toFixed(2)}
                           </td>
                           <td className="p-2 border-r border-gray-300 text-right">
                               {account.agingBreakdown.reduce((sum, item) => sum + item.days150, 0).toFixed(2)}
                           </td>
                           <td className="p-2 text-right">
                               {account.agingBreakdown.reduce((sum, item) => sum + item.days180Plus, 0).toFixed(2)}
                           </td>
                       </tr>
                   </>
               ) : (
                    <tr className="border-b last:border-0 hover:bg-blue-50">
                        <td className="p-2 border-r border-gray-200">{account.outstandingAmount < 0 ? 'Advance Payment' : 'Balance B/F'}</td>
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
                        data-testid="input-payment-allocation"
                    />
               </div>
           </div>
       </div>

    </div>
  );
}
