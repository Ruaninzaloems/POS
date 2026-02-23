import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Account, AgingItem } from '@/lib/external-api';
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
  fetchTotalBalanceDebt,
} from '@/lib/external-api';

function formatPropertyId(propId: string | number | undefined): string {
  if (!propId) return '';
  const num = typeof propId === 'string' ? parseInt(propId, 10) : propId;
  return isNaN(num) ? String(propId) : String(num);
}

function PaymentInput({ id, value, onChange }: { id: string; value: number; onChange: (val: number) => void }) {
  const [rawText, setRawText] = useState(value === 0 ? '' : String(value));
  const lastExternalValue = useRef(value);

  useEffect(() => {
    if (value !== lastExternalValue.current) {
      lastExternalValue.current = value;
      setRawText(value === 0 ? '' : String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    const dotCount = (val.match(/\./g) || []).length;
    if (dotCount > 1) return;
    if (val.includes('.') && val.split('.')[1]?.length > 2) return;

    setRawText(val);

    if (val === '' || val === '.') {
      lastExternalValue.current = 0;
      onChange(0);
      return;
    }

    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      lastExternalValue.current = num;
      onChange(num);
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-xl font-bold">R</span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        className="pl-12 w-full sm:w-56 h-14 text-2xl font-mono font-bold border-2 border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 bg-white rounded-lg"
        value={rawText}
        placeholder="0.00"
        onFocus={(e) => e.target.select()}
        onChange={handleChange}
        data-testid="input-payment-allocation"
      />
    </div>
  );
}

export function AccountEnquiryView({ item }: { item: TransactionItem }) {
  const rawData = item.originalData || {};
  const baseAccount: Account = {
    ...rawData,
    apiId: rawData.apiId || rawData.accountID || rawData.account_ID || rawData.accountId,
    accountNo: rawData.accountNo || rawData.accountNumber || rawData.reference || '',
    name: rawData.name || rawData.companyName || item.description || '',
    outstandingAmount: rawData.outstandingAmount ?? rawData.outStandingAmount ?? rawData.outStandingAmt ?? 0,
    address: rawData.address || rawData.deliveryAddress || rawData.locationAddress || '',
    idNo: rawData.idNo || rawData.idRegistrationNumber || '',
    sgNo: rawData.sgNo || rawData.sgNumber || '',
    email: rawData.email || '',
    mobile: rawData.mobile || '',
  };
  const { updateItemAmount, updateItemDetails, removeItem, addItem, viewingItemId, setViewingItem, receiptDate, setReceiptDate } = usePos();
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
          updated.oldPropertyCode = propEnquiry.oldPropertyCode || updated.oldPropertyCode;
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
          setAccount(prev => ({
            ...updated,
            agingBreakdown: prev.agingBreakdown || updated.agingBreakdown,
            outstandingAmount: prev.outstandingAmount ?? updated.outstandingAmount,
          }));
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
      const data = await fetchTotalBalanceDebt(baseAccount.apiId);

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
        updateItemDetails(item.id, {
          originalData: { ...item.originalData, agingBreakdown, outstandingAmount: totalOutstanding }
        });
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

  const isActive = (account.status || 'Active').toLowerCase() === 'active';
  const accountName = account.name || 'Unknown';

  const Field = ({ label, value }: { label: string, value: string | number | undefined }) => (
    <div className="flex justify-between items-start py-1.5 border-b border-slate-100 last:border-0 gap-2">
      <span className="text-[11px] sm:text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-[11px] sm:text-xs text-slate-800 font-medium text-right break-words">{value || '-'}</span>
    </div>
  );

  return (
    <div className="space-y-3">
       <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
           <div className="flex items-center gap-2.5">
              <button
                onClick={() => { if (viewingItemId) setViewingItem(null); else removeItem(item.id); }}
                className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                data-testid="button-close-enquiry"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>

              <div className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {accountName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-[160px] sm:max-w-none" data-testid="text-account-name">
                    {accountName}
                  </h3>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {account.status || 'Active'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                  Acc: {account.accountNo}
                  {account.oldCode && <span className="text-slate-400"> | Old: {account.oldCode}</span>}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Balance</div>
                <div className={`text-sm sm:text-base font-bold font-mono tracking-tight ${account.outstandingAmount > 0 ? 'text-red-600' : account.outstandingAmount < 0 ? 'text-emerald-600' : 'text-slate-800'}`} data-testid="text-total-outstanding">
                  R {account.outstandingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
           </div>

           <div className="flex gap-1.5 mt-2 flex-wrap">
              {hasPropertyRates && (
                <button onClick={handlePayRatesAdvance} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors" data-testid="button-pay-rates-advance">
                  <CalendarRange className="w-3 h-3" /> Rates Advance
                </button>
              )}
              {account.prepaidMeterNo && (
                <button onClick={handleBuyPrepaid} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ring-1 hover:opacity-90 transition-colors ${account.prepaidType === 'Water' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`} data-testid="button-buy-prepaid">
                  {account.prepaidType === 'Water' ? <Droplets className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                  Prepaid {account.prepaidType || 'Electricity'}
                </button>
              )}
              <button onClick={fetchBalanceData} disabled={balanceLoading} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-50" data-testid="button-refresh-account-transactions">
                {balanceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </button>
           </div>
         </div>

         {account.prepaidBlocked && (
           <div className="mx-3 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200">
             <div className="flex items-start gap-2">
               <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
               <div>
                 <div className="text-xs font-bold text-red-800">
                   Prepaid {account.blockedServices?.join(' & ') || account.prepaidType} Blocked
                 </div>
                 <div className="text-[10px] text-red-700 mt-0.5">Reason: {account.prepaidBlockReason}</div>
               </div>
             </div>
           </div>
         )}

         <Collapsible open={isOpen} onOpenChange={setIsOpen}>
           <CollapsibleTrigger asChild>
             <button className="w-full flex items-center justify-between px-3 sm:px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors border-b border-slate-100" data-testid="button-toggle-details">
               <span className="flex items-center gap-1.5">
                 <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                 Account Details
               </span>
               {detailsLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
             </button>
           </CollapsibleTrigger>
           <CollapsibleContent>
             <div className="px-3 sm:px-4 py-2 space-y-3 bg-slate-50/50">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                 <div>
                   <Field label="Account Number" value={account.accountNo} />
                   <Field label="Account Type" value={account.accountType} />
                   <Field label="Account Group" value={account.accountGroup || 'None - Normal'} />
                   <Field label="Email" value={account.email} />
                   <Field label="Contact" value={account.mobile} />
                   <Field label="Deposit" value={`R${(account.paidDepositAmount ?? 0).toFixed(2)}`} />
                 </div>
                 <div>
                   <Field label="Name" value={account.name} />
                   <Field label="Status" value={account.status || 'Active'} />
                   <Field label="Address" value={account.deliveryAddress || account.address} />
                   <Field label="Handover" value={account.handoverStatus || handoverStatus} />
                   <Field label="Incentive" value={account.incentiveSchemeCode || incentiveCode} />
                   <Field label="SG Number" value={account.sgNo} />
                 </div>
               </div>

               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-1">Property</div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                 <div>
                   <Field label="Property ID" value={formatPropertyId(account.propertyId) || account.unitId} />
                   <Field label="Property Type" value={account.propertyType || 'Erf'} />
                   <Field label="Location" value={account.locationAddress || account.address} />
                   <Field label="Billing Cycle" value={account.billingCycle || '1 Consumer Account Cycle'} />
                 </div>
                 <div>
                   <Field label="Old Property Code" value={account.oldPropertyCode || account.oldCode} />
                   <Field label="Type of Use" value={account.propertyTypeOfUse || 'RES'} />
                   <Field label="Market Value" value={account.marketValue != null ? `R ${account.marketValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined} />
                   <Field label="Owner" value={(() => {
                     const ownerName = account.accountableOwnerName || account.addName || account.name;
                     const idNo = account.idNo || nameInfo?.idNo_RegistrationNo;
                     if (idNo && ownerName && !ownerName.includes(idNo)) return `${ownerName} (${idNo})`;
                     return ownerName;
                   })()} />
                 </div>
               </div>
             </div>
           </CollapsibleContent>
         </Collapsible>
       </div>

       <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="px-3 sm:px-4 py-2 border-b border-slate-100 flex items-center justify-between">
           <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Services & Balance</span>
           {balanceError && (
             <button onClick={fetchBalanceData} className="text-[10px] text-blue-600 font-medium hover:underline">Retry</button>
           )}
         </div>

         {balanceLoading ? (
           <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
             <Loader2 className="w-4 h-4 animate-spin" />
             <span className="text-xs">Loading balance...</span>
           </div>
         ) : balanceError ? (
           <div className="flex items-center justify-center py-4 text-red-500 gap-2 text-xs">
             <AlertTriangle className="w-3.5 h-3.5" />
             {balanceError}
           </div>
         ) : (
           <>
             <div className="sm:hidden divide-y divide-slate-100">
               {(account.agingBreakdown && account.agingBreakdown.length > 0 ? account.agingBreakdown : [{
                 serviceDescription: account.outstandingAmount < 0 ? 'Advance Payment' : 'Balance B/F',
                 totalOutstanding: account.outstandingAmount, newCharge: 0, currentAccount: account.outstandingAmount,
                 days30: 0, days60: 0, days90: 0, days120: 0, days150: 0, days180Plus: 0
               }]).map((row, idx) => (
                 <div key={idx} className="px-3 py-2" data-testid={`row-aging-${idx}`}>
                   <div className="flex justify-between items-center mb-1">
                     <span className="text-xs font-semibold text-slate-800">{row.totalOutstanding < 0 && row.serviceDescription === 'Balance B/F' ? 'Advance Payment' : row.serviceDescription}</span>
                     <span className={`text-xs font-bold font-mono ${row.totalOutstanding > 0 ? 'text-red-600' : row.totalOutstanding < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                       R {(row.totalOutstanding || 0).toFixed(2)}
                     </span>
                   </div>
                   <div className="grid grid-cols-4 gap-1 text-[9px]">
                     {[
                       { l: 'Current', v: row.currentAccount },
                       { l: '30d', v: row.days30 },
                       { l: '60d', v: row.days60 },
                       { l: '90+', v: (row.days90 || 0) + (row.days120 || 0) + (row.days150 || 0) + (row.days180Plus || 0) },
                     ].map(({ l, v }) => (
                       <div key={l} className="text-center bg-slate-50 rounded px-1 py-0.5">
                         <div className="text-slate-400 font-medium">{l}</div>
                         <div className={`font-mono font-semibold ${(v || 0) > 0 ? 'text-slate-700' : 'text-slate-400'}`}>{(v || 0).toFixed(0)}</div>
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
               {account.agingBreakdown && account.agingBreakdown.length > 1 && (
                 <div className="px-3 py-2 bg-slate-50">
                   <div className="flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-800">Total</span>
                     <span className="text-sm font-bold font-mono text-red-600">
                       R {account.agingBreakdown.reduce((s, i) => s + i.totalOutstanding, 0).toFixed(2)}
                     </span>
                   </div>
                 </div>
               )}
             </div>

             <div className="hidden sm:block overflow-x-auto text-xs">
               <table className="w-full text-left border-collapse min-w-[800px]">
                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                   <tr>
                     <th className="p-2">Service</th>
                     <th className="p-2 text-right">Outstanding</th>
                     <th className="p-2 text-right">New Charge</th>
                     <th className="p-2 text-right">Current</th>
                     <th className="p-2 text-right">30d</th>
                     <th className="p-2 text-right">60d</th>
                     <th className="p-2 text-right">90d</th>
                     <th className="p-2 text-right">120d</th>
                     <th className="p-2 text-right">150d</th>
                     <th className="p-2 text-right">180+</th>
                   </tr>
                 </thead>
                 <tbody>
                   {(account.agingBreakdown && account.agingBreakdown.length > 0 ? account.agingBreakdown : [{
                     serviceDescription: account.outstandingAmount < 0 ? 'Advance Payment' : 'Balance B/F',
                     totalOutstanding: account.outstandingAmount, newCharge: 0, currentAccount: account.outstandingAmount,
                     days30: 0, days60: 0, days90: 0, days120: 0, days150: 0, days180Plus: 0
                   }]).map((row, idx) => (
                     <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/50" data-testid={`row-aging-desktop-${idx}`}>
                       <td className="p-2">{row.totalOutstanding < 0 && row.serviceDescription === 'Balance B/F' ? 'Advance Payment' : row.serviceDescription}</td>
                       <td className="p-2 text-right font-mono">{(row.totalOutstanding || 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{(row.newCharge || 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{(row.currentAccount || 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{(row.days30 || 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{(row.days60 || 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{(row.days90 || 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{(row.days120 || 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{(row.days150 || 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{(row.days180Plus || 0).toFixed(2)}</td>
                     </tr>
                   ))}
                   {account.agingBreakdown && account.agingBreakdown.length > 1 && (
                     <tr className="bg-slate-50 font-bold border-t border-slate-200">
                       <td className="p-2">Total</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.totalOutstanding, 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.newCharge, 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.currentAccount, 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.days30, 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.days60, 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.days90, 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.days120, 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.days150, 0).toFixed(2)}</td>
                       <td className="p-2 text-right font-mono">{account.agingBreakdown.reduce((s, i) => s + i.days180Plus, 0).toFixed(2)}</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </>
         )}
       </div>

       <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm overflow-hidden">
         <div className="px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50">
           <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
             <div className="flex-1">
               <div className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold mb-0.5">Payment Amount</div>
               <PaymentInput
                 id={`pay-${item.id}`}
                 value={item.amountToPay}
                 onChange={(val) => updateItemAmount(item.id, val)}
               />
             </div>
             <div className="sm:w-40">
               <div className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold mb-0.5">Receipt Date</div>
               <Input
                 type="date"
                 value={receiptDate}
                 onChange={(e) => setReceiptDate(e.target.value)}
                 className="h-10 bg-white border-blue-200 text-slate-800 font-mono text-sm focus:border-blue-400 focus:ring-blue-200"
                 data-testid="input-receipt-date"
               />
             </div>
           </div>
         </div>
       </div>
    </div>
  );
}
