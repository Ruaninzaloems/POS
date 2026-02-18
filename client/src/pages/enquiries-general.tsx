import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, X, ChevronLeft, User, Building2, MapPin, Phone,
  CreditCard, Droplets, Zap, FileText, Shield, Gift, Landmark,
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Hash,
  Filter, Clock, ArrowRight, Loader2, SlidersHorizontal,
  Eye, Layers, Home, Activity, ChevronRight, Mail, Download
} from 'lucide-react';
import {
  searchAccounts, getAccountBalance, getServiceTypeBalance,
  getPropertyDetails, getConsumptionUnits, getNameInfo,
  getHandoverInfo, getPaymentIncentive, getDeposits, getDepositAmount,
  getTransactionHistory, getAccountInformation,
  getBasicAccountDetails, getAccountInfoResult, getUnitPartitionOwner,
  getDepartmentalAccountsById,
  getContactDetailsHistory, getDeliveryAddressHistory,
  getHandoverAccountEnquiry, getConsHandoverTransactionDetail,
  getAllBillingPeriodTransactions, getDetailedTransactionResults,
  getAllServices, getMeteredServicesOnAccount, getAccountServiceMeterPerProperty,
  getUnitLinkedMeters, getMeterReadingHistory, getPrepaidMeterServicesForAccount,
  getPaymentPlansByAccountId, getPaymentPlanRemainingCapital,
  getRepaymentPlanStatus, getPaymentExtensionSearchResults, getPaymentAmountByAccountIds,
  getDebitOrderDeductionByAccount, getDebitOrderDeduction,
  getAccountRatesDetails, getRatesRunHistory, getSectionalTitleScheme,
  getPartitionDetails, getPartitionDetailsByUnit, getAccountDeliveryAddressDetail,
  getAccountNotifications, getPropertyNotification,
  getGeneratedStatements,
  getClearanceInquiries,
  getDebtorNoteLists,
  getSection129AccountEnquiry,
  getOccupiers,
  getServicesSearchResults,
  getAdditionalBillingSearchResults,
  getChequeFinalSearchList,
  getContactDetails,
  getReceiptTransactionDetail,
  getSupplementaryValuations,
  getTransferOwnership,
  type EnquirySearchCriteria, type EnquirySearchResult,
} from '@/lib/enquiries-service';

function FieldRow({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      {icon && <div className="text-slate-400 mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</div>
        <div className="text-sm text-slate-800 font-medium mt-0.5 break-words">{typeof value === 'number' ? value.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : String(value)}</div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <FileText className="w-10 h-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-red-500">
      <AlertTriangle className="w-8 h-8 mb-2 opacity-60" />
      <p className="text-sm mb-2">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 mt-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-slate-300" />
      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-[0.15em] whitespace-nowrap px-2">{title}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-300 to-slate-300" />
    </div>
  );
}

function InfoField({ label, value, isCurrency, highlight }: { label: string; value: any; isCurrency?: boolean; highlight?: boolean }) {
  let display = '-';
  if (value !== null && value !== undefined && value !== '') {
    const lbl = label.toLowerCase();
    const currencyLabel = lbl.includes('amount') || lbl.includes('market value') || lbl.includes('deposit');
    const numVal = typeof value === 'number' ? value : (currencyLabel ? parseFloat(String(value)) : NaN);
    if (typeof value === 'boolean') display = value ? 'Yes' : 'No';
    else if ((isCurrency || currencyLabel) && !isNaN(numVal)) display = `R ${numVal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
    else display = String(value).replace(/\r\n/g, ', ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]*>/g, '');
  }
  return (
    <div className="flex items-baseline gap-2 py-1 group hover:bg-slate-50/50 rounded px-1 -mx-1 transition-colors">
      <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap min-w-[155px]">{label}</span>
      <span className="text-[11px] text-slate-300 shrink-0">:</span>
      <span className={`text-[11px] font-semibold break-words ${highlight ? 'text-blue-600 underline cursor-pointer' : 'text-slate-800'}`}>{display}</span>
    </div>
  );
}

function GenericTable({ data, columns, testId }: { data: any[]; columns: { key: string; label: string; align?: string; format?: (v: any, row: any) => string }[]; testId: string }) {
  if (!data.length) return <EmptyState message="No data available" />;
  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid={testId}>
        <thead>
          <tr className="border-b-2 border-slate-200">
            {columns.map(col => (
              <th key={col.key} className={`${col.align === 'right' ? 'text-right' : 'text-left'} py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              {columns.map(col => {
                const raw = item[col.key];
                const display = col.format ? col.format(raw, item) : (raw ?? '-');
                return (
                  <td key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right font-mono' : ''}`}>{String(display)}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaginatedTable({ data, columns, itemsPerPage = 50, tableId, onRowClick }: { data: any[]; columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[]; itemsPerPage?: number; tableId?: string; onRowClick?: (row: any) => void }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
  const paged = data.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const tid = tableId || 'table';

  return (
    <div data-testid={`${tid}-container`}>
      <div className="overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-xs" data-testid={`${tid}-grid`}>
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-slate-400 py-4" data-testid={`${tid}-empty`}>No records to display</td></tr>
            ) : paged.map((row, i) => (
              <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)} data-testid={`${tid}-row-${i}`}>
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-slate-700 whitespace-nowrap" data-testid={`${tid}-cell-${c.key}-${i}`}>
                    {c.render ? c.render(row) : (row[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 mt-2 text-xs text-slate-500">
        <span>Items per page:</span>
        <span className="border rounded px-2 py-0.5">{itemsPerPage}</span>
        <span data-testid={`${tid}-page-info`}>{data.length === 0 ? '0 of 0' : `${(page-1)*itemsPerPage+1} - ${Math.min(page*itemsPerPage, data.length)} of ${data.length}`}</span>
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-1 disabled:opacity-30" data-testid={`${tid}-prev-page`}>&lt;</button>
        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="px-1 disabled:opacity-30" data-testid={`${tid}-next-page`}>&gt;</button>
      </div>
    </div>
  );
}

function AccountInfoTab({ account }: { account: EnquirySearchResult }) {
  const [loading, setLoading] = useState(true);
  const [basic, setBasic] = useState<any>(null);
  const [air, setAir] = useState<any>(null);
  const [prop, setProp] = useState<any>(null);
  const [partition, setPartition] = useState<any>(null);
  const [acctMgmt, setAcctMgmt] = useState<any>(null);
  const [incentive, setIncentive] = useState<any>(null);
  const [depositAmt, setDepositAmt] = useState<any>(null);
  const [handover, setHandover] = useState<any>(null);
  const [deptAccounts, setDeptAccounts] = useState<any[]>([]);
  const [partitionOwner, setPartitionOwner] = useState<any>(null);
  const [sectionalTitle, setSectionalTitle] = useState<any>(null);
  const [rppStatus, setRppStatus] = useState<any>(null);
  const [deliveryAddresses, setDeliveryAddresses] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [additionalBilling, setAdditionalBilling] = useState<any[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState<any[]>([]);
  const [nameInfo, setNameInfo] = useState<any>(null);
  const [consUnit, setConsUnit] = useState<any>(null);
  const [suppValuations, setSuppValuations] = useState<any[]>([]);
  const prevAccountId = useRef<number | null>(null);

  const accountId = account.account_ID || account.accountID;

  useEffect(() => {
    if (prevAccountId.current === accountId) return;
    prevAccountId.current = accountId;
    setLoading(true);

    Promise.all([
      getBasicAccountDetails(accountId).catch(() => null),
      getAccountInfoResult(accountId).catch(() => null),
      getPropertyDetails(accountId).catch(() => null),
      getPartitionDetails(accountId).catch(() => null),
      getAccountInformation(accountId).catch(() => null),
      getPaymentIncentive(accountId).catch(() => null),
      getDepositAmount(accountId).catch(() => null),
      getHandoverInfo(accountId).catch(() => null),
      getDepartmentalAccountsById(accountId).catch(() => []),
      getSectionalTitleScheme(accountId).catch(() => null),
      getRepaymentPlanStatus(accountId).catch(() => null),
      getAccountDeliveryAddressDetail(accountId).catch(() => []),
      getServicesSearchResults(accountId).catch(() => []),
      getAdditionalBillingSearchResults(accountId).catch(() => []),
      getChequeFinalSearchList(accountId).catch(() => []),
      getNameInfo(accountId).catch(() => null),
      getConsumptionUnits(accountId).catch(() => null),
    ]).then(([bas, airRes, propRes, partRes, mgmt, inc, dep, ho, dept, st, rpp, da, svc, ab, ai, ni, cu]) => {
      setBasic(bas);
      setAir(airRes);
      const propData = Array.isArray(propRes) ? propRes[0] : propRes;
      setProp(propData);
      setPartition(Array.isArray(partRes) ? partRes[0] : partRes);
      setAcctMgmt(mgmt);
      setIncentive(inc);
      setDepositAmt(dep);
      setHandover(ho);
      setDeptAccounts(Array.isArray(dept) ? dept : []);
      setSectionalTitle(st);
      setRppStatus(rpp);
      setDeliveryAddresses(Array.isArray(da) ? da : da ? [da] : []);
      setServices(Array.isArray(svc) ? svc : svc ? [svc] : []);
      setAdditionalBilling(Array.isArray(ab) ? ab : ab ? [ab] : []);
      setAdditionalInfo(Array.isArray(ai) ? ai : ai ? [ai] : []);
      setNameInfo(ni);
      const cuData = Array.isArray(cu) ? cu[0] : cu;
      setConsUnit(cuData);
      setLoading(false);

      const rawUnitId = bas?.unitPartitionID || propData?.propertyId;
      const unitId = rawUnitId ? parseInt(String(rawUnitId), 10) : null;
      if (unitId && !isNaN(unitId)) {
        getUnitPartitionOwner(unitId).then(owner => setPartitionOwner(owner)).catch(() => {});
        getSupplementaryValuations(unitId).then(vals => setSuppValuations(Array.isArray(vals) ? vals : vals ? [vals] : [])).catch(() => {});
        getPartitionDetailsByUnit(unitId).then(pd => {
          if (pd) setPartition(Array.isArray(pd) ? pd[0] : pd);
        }).catch(() => {});
      }
    });
  }, [accountId]);

  const b = basic || {};
  const a = air || {};
  const p = prop || {};
  const part = partition || {};
  const mgmt = acctMgmt || {};
  const inc = incentive || {};
  const ni = nameInfo || {};
  const cu = consUnit || {};

  const formatCurrency = (v: any) => {
    if (v === null || v === undefined || v === '') return '-';
    const num = typeof v === 'number' ? v : parseFloat(String(v));
    if (isNaN(num)) return String(v);
    return `R ${num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (v: any) => {
    if (!v) return '';
    try { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-ZA'); } catch { return String(v); }
  };

  const f = (v: any, fallback?: string) => {
    if (v === null || v === undefined || v === '' || v === 'null') return fallback || '-';
    return String(v).trim() || (fallback || '-');
  };

  const accountNumber = b.accountNumber || account.accountNumber || '';
  const accountGroup = f(b.institutionDesc || a.institutionDesc);
  const paymentGroup = f(b.paymentGroupDesc || mgmt.paymentGroupDesc);
  const accountType = f(b.accountDesc || a.accountDesc || mgmt.accountDesc);
  const incentiveCode = f(inc.code || inc.description);
  const email = f(b.emailId || account.emailId);
  const depositDisplay = depositAmt !== null && depositAmt !== undefined ? formatCurrency(depositAmt) : '-';

  const accName = f(b.fullNAME || a.name || account.name);
  const subAccountGroup = f(b.groupCodeDesc || mgmt.groupCodeDesc);
  const accountStatus = f(b.accountStatus || mgmt.accountStatus || account.accountStatus);
  const deliveryAddr = f(b.deliveryAddress ? String(b.deliveryAddress).replace(/\r\n/g, ', ').replace(/\n/g, ', ').trim() : '');
  const contactNo = f(b.contactNo || account.contactNo);

  const interestWaiver = f(inc.reverseInterestLevied ? 'Interest Waiver Applied' : 'No Interest Waiver on Account');
  const indigentStatus = f(mgmt.indigentStatus || mgmt.indigentSubsidyStatus);
  const rppArr = Array.isArray(rppStatus) ? rppStatus : [];
  const consumerRpp = f(rppArr[0] || 'N/A');
  const deptAccount = deptAccounts.length > 0 ? 'Active' : 'Inactive';

  const rebateStatus = 'No Rebate on Account';
  const handoverStatus = f(typeof handover === 'string' ? handover : handover?.status || handover?.handoverStatus);
  const loanRpp = f(rppArr[1] || 'N/A');

  const sgNumber = f(p.sgNumber || a.sgNumber || b.sgNumber);
  const oldPropertyCode = f(b.oldAccountCode || account.oldAccountCode);
  const billingCycle = f(mgmt.cycleDescription ? `1 ${mgmt.cycleDescription}` : (cu.billingCycleID ? `${cu.billingCycleID} Consumer Account Cycle` : ''));
  const sectionalTitleSchemeVal = f(sectionalTitle?.schemeName || sectionalTitle?.description || p.complexName);
  const locationAddress = f(b.fullAddress || a.propertyStreet || account.locationAddress);
  const longitude = f(p.longitude || b.longitude);
  const registrationStatus = cu.registrationStatus ? 'Registered' : f(p.rollNumber ? 'Registered' : '');

  const propertyId = f(p.propertyId || b.propertyID);
  const propertyStatus = f(b.accountStatus || 'Active');
  const allotmentArea = f(p.town);
  const farmName = f(p.farmName);
  const propertyType = f(p.flatReferenceNumber ? 'Sectional Title' : p.propertyId ? 'Erf' : '');
  const latitude = f(p.latitude || b.latitude);
  const magisterialDistrict = f(p.ward || p.magisterialDistrict);
  const propertyMarketValue = p.marketValue !== null && p.marketValue !== undefined ? formatCurrency(p.marketValue) : '-';

  const suppVal = suppValuations[0];
  const typeOfUse = f(suppVal?.typeOfUseDesc || a.typeOfUseDesc || p.typeofUse || a.zoneDesc);
  const propertyCategory = f(suppVal?.zoneDesc || a.zoneDesc || p.townPlanningZoneType || a.typeOfUseDesc);
  const idNumber = f(partitionOwner?.idNumber || ni.idNo_RegistrationNo || account.idRegistrationNumber);
  const ownerName = f(
    partitionOwner?.lastName
      ? [partitionOwner.firstNames, partitionOwner.lastName].filter(Boolean).join(' ').trim()
      : (a.owner || p.name || b.fullNAME)
  );
  const accountableOwner = idNumber !== '-' ? `${ownerName} ${idNumber}` : ownerName;

  const valuationCategory = f(part.valuationCategory || part.valuationCategoryDesc || suppVal?.type);
  const partitionDesc = f(part.partitionDescription || part.partitionDesc || part.description || suppVal?.reason);
  const partitionMarketValue = part.partitionMarketValue !== null && part.partitionMarketValue !== undefined
    ? formatCurrency(part.partitionMarketValue) : (part.marketValue !== null && part.marketValue !== undefined
      ? formatCurrency(part.marketValue) : (p.marketValue !== null && p.marketValue !== undefined ? formatCurrency(p.marketValue) : '-'));

  return (
    <div className="p-5 space-y-5" data-testid="account-info-panel">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-1 w-8 bg-blue-600 rounded-full" />
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Account Enquiry</h3>
      </div>

      {loading ? <LoadingSkeleton /> : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              <div className="p-5 space-y-0.5">
                <InfoField label="Account Number" value={accountNumber} highlight />
                <InfoField label="Account Group" value={accountGroup} />
                <InfoField label="Payment Group" value={paymentGroup} />
                <InfoField label="Account Type" value={accountType} />
                <InfoField label="Incentive Scheme Code" value={incentiveCode} />
                <InfoField label="Email" value={email} />
                <InfoField label="Paid Deposit Amount" value={depositDisplay} />
              </div>
              <div className="p-5 space-y-0.5">
                <SectionHeader title="ACCOUNT INFORMATION" />
                <InfoField label="Name" value={accName} />
                <InfoField label="Sub Account Group" value={subAccountGroup} />
                <InfoField label="Account Status" value={accountStatus} />
                <InfoField label="Delivery Address" value={deliveryAddr} />
                <InfoField label="Contact Number" value={contactNo} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              <div className="p-5 space-y-0.5">
                <SectionHeader title="ADDITIONAL ACCOUNT DETAILS" />
                <InfoField label="Interest Waiver Status" value={interestWaiver} />
                <InfoField label="Indigent Subsidy Status" value={indigentStatus} />
                <InfoField label="Consumer RPP Status" value={consumerRpp} />
                <InfoField label="Departmental Account" value={deptAccount} />
              </div>
              <div className="p-5 space-y-0.5 pt-9 lg:pt-5">
                <div className="h-6 lg:h-7" />
                <InfoField label="Rebate Status" value={rebateStatus} />
                <InfoField label="Handover Status" value={handoverStatus} />
                <InfoField label="Loan RPP Status" value={loanRpp} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              <div className="p-5 space-y-0.5">
                <InfoField label="SG Number" value={sgNumber} />
                <InfoField label="Old Property Code" value={oldPropertyCode} />
                <InfoField label="Billing Cycle" value={billingCycle} />
                <InfoField label="Sectional Title Scheme" value={sectionalTitleSchemeVal} />
                <InfoField label="Location Address" value={locationAddress} />
                <InfoField label="Longitude" value={longitude} />
                <InfoField label="Registration Status" value={registrationStatus} />
              </div>
              <div className="p-5 space-y-0.5">
                <SectionHeader title="PROPERTY" />
                <InfoField label="Property ID" value={propertyId} />
                <InfoField label="Property Status" value={propertyStatus} />
                <InfoField label="Allotment Area" value={allotmentArea} />
                <InfoField label="Farm Name" value={farmName} />
                <InfoField label="Property Type" value={propertyType} />
                <InfoField label="Latitude" value={latitude} />
                <InfoField label="Magisterial District" value={magisterialDistrict} />
                <InfoField label="Property Market Value" value={propertyMarketValue} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              <div className="p-5 space-y-0.5">
                <InfoField label="Property Type of Use" value={typeOfUse} />
                <InfoField label="Property Category" value={propertyCategory} />
                <InfoField label="Accountable Owner Name" value={accountableOwner} />
              </div>
              <div className="p-5 space-y-0.5">
                <SectionHeader title="PARTITION" />
                <InfoField label="Valuation Category" value={valuationCategory} />
                <InfoField label="Partition Description" value={partitionDesc} />
                <InfoField label="Partition Market Value" value={partitionMarketValue} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <SectionHeader title="DELIVERY ADDRESS DETAILS" />
            <PaginatedTable
              data={deliveryAddresses}
              tableId="delivery-address"
              columns={[
                { key: 'addressStatus', label: 'Address Status' },
                { key: 'startDate', label: 'Start Date' },
                { key: 'typeofDeliveryAddress', label: 'Type of Delivery Address' },
                { key: 'town', label: 'City/Town' },
                { key: 'suburbName', label: 'Suburb' },
                { key: 'streetName', label: 'Street Name / Non Standard Address', render: (r: any) => r.streetName || r.complexName || '' },
                { key: 'streetNumber', label: 'Street Number' },
                { key: 'boxBagNo', label: 'Box/Bag Number' },
                { key: 'complexName', label: 'Complex Name' },
                { key: 'unitNumber', label: 'Unit Number' },
                { key: 'postalCode', label: 'Postal Code' },
              ]}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <SectionHeader title="SERVICES" />
            <PaginatedTable
              data={services}
              tableId="services"
              columns={[
                { key: 'serviceStatus', label: 'Service Status', render: (r: any) => r.serviceStatus || r.statusDesc || r.status || '' },
                { key: 'serviceType', label: 'Service Type', render: (r: any) => r.serviceType || r.serviceTypeDesc || r.serviceDesc || '' },
                { key: 'tariff', label: 'Tariff', render: (r: any) => r.tariff || r.tariffDescription || r.tariffDesc || '' },
                { key: 'physicalMeter', label: 'Physical Meter + Meter Code', render: (r: any) => {
                  const meter = r.physicalMeterNo || r.meterNo || r.physicalMeter || '';
                  const code = r.meterCode || '';
                  return meter && code ? `${meter} - ${code}` : meter || code || 'No Meter';
                }},
                { key: 'frequency', label: 'Frequency', render: (r: any) => r.frequency || r.frequencyDesc || '' },
                { key: 'meterConnectionSize', label: 'Meter Connection Size', render: (r: any) => r.meterConnectionSize || r.connectionSize || '' },
                { key: 'factorQuantity', label: 'FactorQuantity', render: (r: any) => r.factorQuantity ?? r.factor ?? '' },
                { key: 'requestDate', label: 'Request Date', render: (r: any) => formatDate(r.requestDate) },
                { key: 'commencementDate', label: 'Commencement Date', render: (r: any) => formatDate(r.commencementDate || r.startDate) },
                { key: 'tariffType', label: 'Tariff Type', render: (r: any) => r.tariffType || r.tariffTypeDesc || '' },
                { key: 'tariffRate', label: 'Tariff Rate', render: (r: any) => {
                  const parts: string[] = [];
                  if (r.tariffStartDate || r.tariffEndDate) parts.push(`Start Date - End Date:\n${formatDate(r.tariffStartDate)} - ${formatDate(r.tariffEndDate)}`);
                  if (r.interval !== undefined || r.cost !== undefined) parts.push(`Interval : Cost:\n${r.interval ?? ''}`);
                  if (r.remainder !== undefined) parts.push(`Remainder : ${typeof r.remainder === 'number' ? r.remainder.toFixed(6) : r.remainder}`);
                  return parts.length > 0 ? <div className="whitespace-pre-wrap text-[10px]">{parts.join('\n')}</div> : '';
                }},
              ]}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <SectionHeader title="ADDITIONAL BILLING SERVICES" />
            <PaginatedTable
              data={additionalBilling}
              tableId="additional-billing"
              columns={[
                { key: 'status', label: 'Status', render: (r: any) => r.status || r.statusDesc || r.serviceStatus || '' },
                { key: 'type', label: 'Type', render: (r: any) => r.type || r.typeDesc || r.billingType || r.serviceDesc || '' },
                { key: 'amount', label: 'Amount', render: (r: any) => typeof r.amount === 'number' ? r.amount.toFixed(2) : (r.amount || '') },
                { key: 'commencementDate', label: 'Commencement Date', render: (r: any) => formatDate(r.commencementDate || r.startDate) },
                { key: 'terminationDate', label: 'Termination Date', render: (r: any) => formatDate(r.terminationDate || r.endDate) },
                { key: 'frequency', label: 'Frequency', render: (r: any) => r.frequency || r.frequencyDesc || '' },
                { key: 'levyMonth', label: 'Levy Month', render: (r: any) => r.levyMonth || '' },
                { key: 'factorQuantity', label: 'Factor Quantity', render: (r: any) => r.factorQuantity ?? r.factor ?? '' },
              ]}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <SectionHeader title="ADDITIONAL INFORMATION" />
            <PaginatedTable
              data={additionalInfo}
              tableId="additional-info"
              columns={[
                { key: 'blockOrUnblock', label: 'Block or Unblock', render: (r: any) => r.blockOrUnblock || r.type || '' },
                { key: 'receiptNo', label: 'Receipt No', render: (r: any) => r.receiptNo || r.receiptNumber || '' },
                { key: 'receiptDate', label: 'Receipt Date', render: (r: any) => formatDate(r.receiptDate) },
                { key: 'cardNo', label: 'Card No', render: (r: any) => r.cardNo || r.chequeNo || '' },
                { key: 'receiptAmount', label: 'Receipt Amount', render: (r: any) => typeof r.receiptAmount === 'number' ? r.receiptAmount.toFixed(2) : (r.receiptAmount || r.amount || '') },
                { key: 'transactionDate', label: 'Transaction Date', render: (r: any) => formatDate(r.transactionDate) },
                { key: 'documentNo', label: 'Document No', render: (r: any) => r.documentNo || r.documentNumber || '' },
                { key: 'comment', label: 'Comment', render: (r: any) => r.comment || r.remarks || '' },
                { key: 'adminFee', label: 'Admin Fee', render: (r: any) => typeof r.adminFee === 'number' ? r.adminFee.toFixed(2) : (r.adminFee || '') },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

function NameTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevAccountId = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getNameInfo(accountId);
      setData(result);
    } catch (e: any) {
      setError(e.message || 'Failed to load name details');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (prevAccountId.current !== accountId) {
      prevAccountId.current = accountId;
      load();
    }
  }, [accountId, load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState message="No name details available" />;

  const n = data;
  const fullName = [n.firstNames, n.surname_Company].filter(Boolean).join(' ').trim();
  const dob = n.dateOfBirth ? (() => { try { const d = new Date(n.dateOfBirth); return isNaN(d.getTime()) ? n.dateOfBirth : d.toLocaleDateString('en-ZA'); } catch { return n.dateOfBirth; } })() : '';

  return (
    <div className="p-4 space-y-1" data-testid="name-info-panel">
      <h3 className="text-base font-bold text-slate-800 mb-2">Name</h3>

      <SectionHeader title="Person Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
        <div>
          <InfoField label="ID Number" value={n.idNo_RegistrationNo} />
          <InfoField label="Passport Number" value={n.passportNo} />
          <InfoField label="Country Name" value={n.nameCountry} />
          <InfoField label="Title" value={n.title} />
          <InfoField label="Last Name" value={n.surname_Company} />
          <InfoField label="Full Name" value={fullName || n.firstNames} />
          <InfoField label="Is Farmer?" value={n.isFarmer} />
          <InfoField label="Is Sole Proprietor?" value={n.isSoleProp} />
        </div>
        <div>
          <InfoField label="Nickname" value={n.nickName} />
          <InfoField label="Maiden Name" value={n.maidenName} />
          <InfoField label="Date of Birth" value={dob} />
          <InfoField label="Gender" value={n.genderDesc} />
          <InfoField label="Ethnicity" value={n.ethnicDesc} />
          <InfoField label="Language for Correspondence" value={n.languageCorrespond} />
        </div>
      </div>

      <SectionHeader title="Employer Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
        <div>
          <InfoField label="Employment Status" value={n.employementStatusDesc} />
          <InfoField label="Employer" value={n.employer} />
          <InfoField label="Contact Person Telephone" value={n.tel_ContactPerson || n.tel_ContactPerson1} />
        </div>
        <div>
          <InfoField label="Contact Person" value={n.contactPerson} />
          <InfoField label="Occupation" value={n.occupation || n.occupation1} />
        </div>
      </div>

      <SectionHeader title="Next of Kin" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
        <div>
          <InfoField label="Last Name" value={n.kinLastName} />
          <InfoField label="Full Name" value={[n.kinFirstName, n.kinLastName].filter(Boolean).join(' ').trim() || undefined} />
          <InfoField label="Relationship" value={n.kinRelationShip} />
          <InfoField label="Town/City" value={n.kinTown} />
          <InfoField label="Suburb" value={n.kinSuburb} />
        </div>
        <div>
          <InfoField label="Street Name" value={n.kinStreetName} />
          <InfoField label="Street Number" value={n.kinStreetNumber} />
          <InfoField label="Telephone (Home)" value={n.kinTelephone} />
          <InfoField label="Telephone (Mobile)" value={n.kinMobile} />
        </div>
      </div>

      <SectionHeader title="Marital Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
        <div>
          <InfoField label="Marital Status" value={n.kinMarriedStatus} />
        </div>
        <div />
      </div>
    </div>
  );
}

function BalanceDebtTab({ accountId }: { accountId: number }) {
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [txnHistory, setTxnHistory] = useState<any[]>([]);
  const [capitalData, setCapitalData] = useState<any>(null);
  const [ratesData, setRatesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExtended, setShowExtended] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balResult, txnResult, capResult, ratesResult] = await Promise.allSettled([
        getAccountBalance(accountId),
        getTransactionHistory(String(accountId).padStart(12, '0')),
        getPaymentPlanRemainingCapital(accountId),
        getAccountRatesDetails(accountId, '2025/2026'),
      ]);
      if (balResult.status === 'fulfilled') {
        const d = balResult.value;
        setBalanceData(Array.isArray(d) ? d : (d?.results || d?.value || (d ? [d] : [])));
      }
      if (txnResult.status === 'fulfilled') setTxnHistory(Array.isArray(txnResult.value) ? txnResult.value : []);
      if (capResult.status === 'fulfilled' && capResult.value && !capResult.value._error) setCapitalData(capResult.value);
      if (ratesResult.status === 'fulfilled' && ratesResult.value && !ratesResult.value._error) setRatesData(ratesResult.value);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load balance data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmt = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0;
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtDash = (v: any) => {
    if (v === '-' || v === null || v === undefined) return '-';
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n) || n === 0) return '-';
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const sumField = (arr: any[], ...keys: string[]) => arr.reduce((s, item) => {
    for (const k of keys) { const v = item[k]; if (v !== undefined && v !== null && v !== '-') return s + (typeof v === 'number' ? v : parseFloat(v) || 0); }
    return s;
  }, 0);

  const baseCols = [
    { label: 'CURRENT', keys: ['current', 'currentAccount'] },
    { label: '30 DAYS', keys: ['days30', '30days'] },
    { label: '60 DAYS', keys: ['days60', '60days'] },
    { label: '90 DAYS', keys: ['days90', '90days'] },
    { label: '120 DAYS', keys: ['days120', '120days'] },
    { label: '150 DAYS', keys: ['days150', '150days'] },
  ];
  const extendedCols = [
    { label: '180+ DAYS', keys: ['untill360', 'days180Plus'] },
  ];
  const agingCols = showExtended ? [...baseCols, ...extendedCols] : baseCols;
  const getVal = (item: any, keys: string[]) => { for (const k of keys) { if (item[k] !== undefined && item[k] !== null) return item[k]; } return 0; };

  const payments = txnHistory.filter((t: any) => {
    const type = (t.transactionType || t.receiptType || t.type || '').toLowerCase();
    return type.includes('payment') || type.includes('receipt') || type.includes('pay');
  });
  const refunds = txnHistory.filter((t: any) => {
    const type = (t.transactionType || t.receiptType || t.type || '').toLowerCase();
    return type.includes('refund');
  });
  const reversals = txnHistory.filter((t: any) => {
    const type = (t.transactionType || t.receiptType || t.type || '').toLowerCase();
    return type.includes('reversal') || type.includes('reversed') || type.includes('cancel');
  });

  const propertyRatesItems = balanceData.filter((it: any) =>
    (it.serviceDescription || '').toLowerCase().includes('property') ||
    (it.serviceDescription || '').toLowerCase().includes('rate')
  );

  return (
    <div className="p-4 space-y-6" data-testid="balance-debt-tab">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Total Balance / Debt Inquiry</h3>
          <button
            onClick={() => setShowExtended(!showExtended)}
            className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-1 transition-colors"
            data-testid="toggle-extended-aging"
          >
            {showExtended ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {showExtended ? 'Show up to 150 Days' : 'Show 180+ Days'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-balance-debt">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold w-[220px] min-w-[180px]">Service</th>
                <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-red-600 font-bold min-w-[120px]">Total Outstanding</th>
                {agingCols.map(col => (
                  <th key={col.label} className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[90px]">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balanceData.length === 0 ? (
                <tr><td colSpan={agingCols.length + 2} className="py-6 text-center text-slate-400 text-sm">No balance data available</td></tr>
              ) : balanceData.map((item: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
                  <td className="py-2.5 px-3 font-medium text-slate-800 text-[13px]">{item.serviceDescription || `Service ${i + 1}`}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-600 font-bold text-[13px]">{fmt(item.totalOutStanding ?? item.totalOutstandingAmount ?? 0)}</td>
                  {agingCols.map(col => {
                    const v = getVal(item, col.keys);
                    return <td key={col.label} className="py-2.5 px-3 text-right font-mono text-slate-600 text-[13px]">{fmtDash(v)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
            {balanceData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-blue-200 bg-blue-50/50">
                  <td className="py-2.5 px-3 font-bold text-slate-900 text-[13px]">Total</td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-700 font-bold text-[13px]">{fmt(sumField(balanceData, 'totalOutStanding', 'totalOutstandingAmount'))}</td>
                  {agingCols.map(col => (
                    <td key={col.label} className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 text-[13px]">{fmtDash(sumField(balanceData, ...col.keys))}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {(propertyRatesItems.length > 0 || ratesData) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2.5">
            <Home className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Property Rates Section</h3>
          </div>
          <div className="p-5 space-y-5">
            {ratesData && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Property Rates</h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    { label: 'Annual Property Rates Amount', value: `R ${fmt(ratesData.annualPropertyRates ?? 0)}` },
                    { label: 'Frequency', value: ratesData.frequency ?? '-' },
                    { label: 'Instalment', value: `R ${fmt(ratesData.installment ?? 0)}` },
                    { label: 'Remaining Instalments', value: ratesData.remainingInstallments ?? '-' },
                  ].map((row, idx) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 hover:bg-slate-50/50 transition-colors">
                      <span className="text-[13px] text-slate-600">{row.label}</span>
                      <span className="text-[13px] font-mono font-semibold text-slate-900">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {propertyRatesItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {propertyRatesItems.map((item: any, i: number) => (
                  <div key={i} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{item.serviceDescription}</div>
                      <div className="text-xl font-bold text-red-600 font-mono mt-1">{fmt(item.totalOutStanding ?? 0)}</div>
                    </div>
                    <div className="p-4 space-y-0 divide-y divide-slate-100">
                      {[
                        { label: 'Current', value: fmtDash(getVal(item, ['current', 'currentAccount'])) },
                        { label: '30 Days', value: fmtDash(getVal(item, ['days30'])) },
                        { label: '60 Days', value: fmtDash(getVal(item, ['days60'])) },
                        { label: '90 Days', value: fmtDash(getVal(item, ['days90'])) },
                        { label: '120 Days', value: fmtDash(getVal(item, ['days120'])) },
                        { label: '150 Days', value: fmtDash(getVal(item, ['days150'])) },
                        ...(showExtended ? [{ label: '180+ Days', value: fmtDash(getVal(item, ['untill360'])) }] : []),
                      ].map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2">
                          <span className="text-xs text-slate-500">{row.label}</span>
                          <span className="text-xs font-mono font-medium text-slate-700">{row.value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center py-2.5 !border-t-2 !border-slate-200">
                        <span className="text-xs font-medium text-slate-600">Deposit</span>
                        <span className="text-xs font-mono font-semibold text-slate-800">{fmtDash(item.deposit)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Payments Received</h3>
          <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{payments.length}</Badge>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          {payments.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">No payments found in recent history</div>
          ) : (
            <table className="w-full text-xs" data-testid="table-payments-received">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold whitespace-nowrap">Receipt No</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold whitespace-nowrap">Payment Type</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold whitespace-nowrap">Receipt Date and Time</th>
                  <th className="text-right py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold whitespace-nowrap">Receipt Amount</th>
                  <th className="text-center py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold whitespace-nowrap">Reprint</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold whitespace-nowrap">Cashier</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold whitespace-nowrap">Cash Book</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold whitespace-nowrap">Reason for Cancellation</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-green-50/50" data-testid={`row-payment-${i}`}>
                    <td className="py-1.5 px-3 font-mono text-slate-700 whitespace-nowrap">{p.receiptNumber || p.receiptNo || '-'}</td>
                    <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap">{p.paymentType || p.receiptType || p.transactionType || '-'}</td>
                    <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap">{p.receiptDate ? new Date(p.receiptDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-1.5 px-3 text-right font-mono font-medium text-green-700 whitespace-nowrap">{fmt(p.amount || p.receiptAmount || 0)}</td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        onClick={() => {
                          const receiptId = p.receiptId || p.receipt_ID || p.id;
                          if (receiptId) {
                            window.open(`/api/platinum/billing-payment/print-receipt?receiptId=${receiptId}`, '_blank');
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium"
                        data-testid={`btn-print-receipt-${i}`}
                      >
                        Print Receipt
                      </button>
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap">{p.cashierName || p.cashier || '-'}</td>
                    <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap">{p.cashBook || p.cashBookName || '-'}</td>
                    <td className="py-1.5 px-3 text-slate-500 whitespace-nowrap">{p.cancellationReason || p.reasonForCancellation || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Payment Reversals</h3>
            <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{reversals.length}</Badge>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {reversals.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">No payment reversals found in recent history</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold">Date</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold">Receipt #</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold">Type</th>
                    <th className="text-right py-2 px-3 text-[10px] uppercase text-slate-500 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reversals.slice(0, 20).map((rv: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-red-50/50">
                      <td className="py-1.5 px-3 text-slate-600">{rv.receiptDate ? new Date(rv.receiptDate).toLocaleDateString('en-ZA') : '-'}</td>
                      <td className="py-1.5 px-3 font-mono text-slate-700">{rv.receiptNumber || rv.receiptNo || '-'}</td>
                      <td className="py-1.5 px-3 text-slate-500">{rv.receiptType || rv.transactionType || '-'}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-medium text-red-700">{fmt(rv.amount || rv.receiptAmount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Debtors - Remaining Capital Amounts</h3>
          </div>
          <div className="p-4">
            {capitalData ? (
              <div className="space-y-3">
                {Array.isArray(capitalData) ? capitalData.map((cap: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                    <span className="text-sm text-slate-700 font-medium">{cap.description || cap.serviceDescription || `Item ${i + 1}`}</span>
                    <span className="font-mono font-bold text-purple-700 text-sm">{fmt(cap.amount || cap.remainingCapital || cap.capitalAmount || 0)}</span>
                  </div>
                )) : (
                  <div className="flex items-center justify-between p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                    <span className="text-sm text-slate-700 font-medium">Remaining Capital</span>
                    <span className="font-mono font-bold text-purple-700 text-sm">{fmt(capitalData.amount || capitalData.remainingCapital || capitalData.capitalAmount || capitalData.totalAmount || 0)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400 text-sm py-4">No remaining capital data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function parseTariffRateData(svc: any): { startDate: string; endDate: string; intervals: { interval: string; cost: string }[] } {
  const result = { startDate: '', endDate: '', intervals: [] as { interval: string; cost: string }[] };

  const html = svc.endDate || '';
  if (html && typeof html === 'string' && html.includes('<')) {
    const stripped = html.replace(/<[^>]*>/g, '\n');
    const lines = stripped.split('\n').map((l: string) => l.trim()).filter(Boolean);

    const dateLineIdx = lines.findIndex((l: string) => /\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}/.test(l));
    if (dateLineIdx >= 0) {
      const dm = lines[dateLineIdx].match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (dm) { result.startDate = dm[1]; result.endDate = dm[2]; }
    }

    const costIdx = lines.findIndex((l: string) => /interval.*cost/i.test(l));
    if (costIdx >= 0) {
      for (let i = costIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        const cm = line.match(/^(.+?)\s*-\s*([\d.]+)$/);
        if (cm) {
          const costVal = parseFloat(cm[2]);
          result.intervals.push({ interval: cm[1].trim(), cost: isNaN(costVal) ? cm[2].trim() : costVal.toFixed(2) });
        }
      }
    }
  }

  if (result.intervals.length === 0 && Array.isArray(svc.costInterVal) && svc.costInterVal.length > 0) {
    if (!result.startDate && svc.startDate) result.startDate = svc.startDate;
    svc.costInterVal.forEach((ci: any) => {
      const costVal = parseFloat(ci.cost);
      const intervalLabel = ci.interval === 0 || ci.interval === '0' ? 'Remainder' : String(ci.interval);
      result.intervals.push({ interval: intervalLabel, cost: isNaN(costVal) ? String(ci.cost) : costVal.toFixed(2) });
    });
  }

  return result;
}

function ServiceBalanceTab({ accountId }: { accountId: number }) {
  const [services, setServices] = useState<any[]>([]);
  const [searchServices, setSearchServices] = useState<any[]>([]);
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [expandedRates, setExpandedRates] = useState<Set<number>>(new Set());
  const [finYear, setFinYear] = useState(() => {
    const now = new Date();
    const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${y}/${y + 1}`;
  });
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [svcResult, searchResult, balResult] = await Promise.allSettled([
        getAllServices(accountId),
        getServicesSearchResults(accountId),
        getServiceTypeBalance(accountId, finYear),
      ]);
      if (svcResult.status === 'fulfilled') setServices(svcResult.value || []);
      if (searchResult.status === 'fulfilled') setSearchServices(searchResult.value || []);
      if (balResult.status === 'fulfilled') setBalanceData(balResult.value || []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load service data');
    } finally {
      setLoading(false);
    }
  }, [accountId, finYear]);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: any) => {
    if (v === null || v === undefined || v === '') return '-';
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const now = new Date();
    const y = (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1) - i;
    return `${y}/${y + 1}`;
  });

  if (selectedService) {
    const svcDesc = selectedService.serviceDesc || selectedService.serviceDescription || selectedService.tariffType;
    const svcTypeId = selectedService.tariffTypeID || selectedService.serviceTypeID || selectedService.serviceType_ID;
    const detailRows = balanceData.filter((b: any) =>
      (svcTypeId && b.serviceTypeID === svcTypeId) ||
      (b.serviceDescription && svcDesc && b.serviceDescription.toLowerCase() === svcDesc.toLowerCase())
    );

    const monthOrder = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
    const sorted = [...detailRows].sort((a, b) => {
      const ai = monthOrder.indexOf(a.month);
      const bi = monthOrder.indexOf(b.month);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const totals = sorted.reduce((acc: any, r: any) => ({
      openingBalance: acc.openingBalance + (r.openingBalance || 0),
      amount: acc.amount + (r.amount || 0),
      vat: acc.vat + (r.vat || 0),
      interestAmount: acc.interestAmount + (r.interestAmount || 0),
      totalAmount: acc.totalAmount + (r.totalAmount || 0),
      currentInterestAmount: acc.currentInterestAmount + (r.currentInterestAmount || 0),
      currentCharge: acc.currentCharge + (r.currentCharge || 0),
    }), { openingBalance: 0, amount: 0, vat: 0, interestAmount: 0, totalAmount: 0, currentInterestAmount: 0, currentCharge: 0 });

    const chartData = sorted.filter(r => r.totalAmount > 0 || r.amount > 0).map(r => ({
      month: r.month,
      amount: r.totalAmount || r.amount || 0,
    }));

    return (
      <div className="p-4 space-y-6" data-testid="service-balance-detail">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-3">
            <button onClick={() => setSelectedService(null)} className="text-white hover:text-blue-200 transition-colors" data-testid="button-back-services">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold text-white tracking-wide">Service Type Balance</h3>
            <span className="text-xs text-blue-200">- {svcDesc}</span>
            <div className="ml-auto">
              <select value={finYear} onChange={e => setFinYear(e.target.value)} className="text-xs bg-white/20 text-white border border-white/30 rounded px-2 py-1 focus:outline-none" data-testid="select-fin-year-detail">
                {yearOptions.map(y => <option key={y} value={y} className="text-slate-800">{y}</option>)}
              </select>
            </div>
          </div>
          {sorted.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">No billing data for this service in {finYear}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-service-detail">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service Description</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Opening Balance</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">VAT</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Interest</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Total Amount</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Current Interest Charge</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Current Charge</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Month</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Financial Year</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                      <td className="py-2 px-3 text-slate-700">{r.serviceDescription || svcDesc}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(r.openingBalance)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(r.amount)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(r.vat)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(r.interestAmount)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700">{fmt(r.totalAmount)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(r.currentInterestAmount)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(r.currentCharge)}</td>
                      <td className="py-2 px-3 text-slate-600">{r.month || '-'}</td>
                      <td className="py-2 px-3 text-slate-600">{r.financialYear || '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <td className="py-2.5 px-3 text-slate-800">Total</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.openingBalance)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.amount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.vat)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.interestAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-700">{fmt(totals.totalAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.currentInterestAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.currentCharge)}</td>
                    <td className="py-2.5 px-3" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700">
              <h3 className="text-sm font-semibold text-white tracking-wide">Service Type Balance</h3>
            </div>
            <div className="p-4" style={{ height: 350 }}>
              <ServiceBalanceChart data={chartData} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const displayData = searchServices.length > 0 ? searchServices : services;
  const toggleRate = (idx: number) => {
    setExpandedRates(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="p-4 space-y-6" data-testid="service-balance-tab">
      <div className="text-center mb-2">
        <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider">Services</h3>
        <div className="mx-auto mt-1 w-20 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {displayData.length === 0 ? (
          <div className="p-8 text-center">
            <Layers className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No services found for this account</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" data-testid="table-service-list">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Service Status</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Service Type</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Tariff</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Physical Meter + Meter Code</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Frequency</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Meter Connection Size</th>
                  <th className="text-center py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">FactorQuantity</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Request Date</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Commencement Date</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Tariff Type</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-blue-700 font-bold whitespace-nowrap">Tariff Rate</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((svc: any, i: number) => {
                  const tariffInfo = parseTariffRateData(svc);
                  const isExpanded = expandedRates.has(i);
                  const hasCostData = !!svc.costInterVal || (svc.endDate && typeof svc.endDate === 'string' && svc.endDate.includes('<'));
                  const meterDisplay = hasCostData
                    ? (svc.meterNo || 'No Meter')
                    : `${svc.physicalMeterNo || 'No Meter'}${svc.meterNo ? ` - ${svc.meterNo}` : ''}`;
                  const status = svc.serviceStatus || svc.statusDesc || '-';
                  const isActive = status.toLowerCase() === 'active';
                  const requestDate = svc.serviceRequestedDate ? new Date(svc.serviceRequestedDate).toLocaleDateString('en-ZA') : '-';
                  const commencementDate = svc.serviceCommencementDate || svc.commencementDate
                    ? new Date(svc.serviceCommencementDate || svc.commencementDate).toLocaleDateString('en-ZA')
                    : svc.startDate || '-';

                  return (
                    <tr key={i} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''}`} data-testid={`row-service-${i}`}>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-600 ring-1 ring-red-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-blue-700 cursor-pointer hover:underline whitespace-nowrap" onClick={() => setSelectedService(svc)}>{svc.tariffType || svc.serviceDesc || '-'}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs max-w-[300px]">{svc.tariff || '-'}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 text-xs whitespace-nowrap">{meterDisplay}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{svc.frequency || 'Monthly'}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{svc.meterConnectionSize || '-'}</td>
                      <td className="py-3 px-4 text-center font-mono text-slate-700">{svc.factorQuantity ?? svc.tarifffactor ?? '-'}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{requestDate}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{commencementDate}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{svc.tariffType || svc.serviceDesc || '-'}</td>
                      <td className="py-3 px-4 align-top">
                        {tariffInfo.intervals.length > 0 ? (
                          <div className="text-xs space-y-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleRate(i); }}
                              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                              data-testid={`btn-tariff-rate-${i}`}
                            >
                              <span>Interval</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleRate(i); }}
                              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                              data-testid={`btn-tariff-cost-${i}`}
                            >
                              <span>Cost</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isExpanded && (
                              <div className="mt-1.5 bg-slate-50 rounded-lg border border-slate-200 p-2.5 space-y-1 min-w-[200px] shadow-sm">
                                <div className="text-slate-500 font-medium pb-1 border-b border-slate-200 text-[10px]">
                                  <span className="underline">Start Date - End Date:</span>
                                  <div className="text-slate-700 font-normal mt-0.5">{tariffInfo.startDate} - {tariffInfo.endDate}</div>
                                </div>
                                <div className="text-slate-500 font-medium text-[10px] underline mt-1">Interval - Cost:</div>
                                {tariffInfo.intervals.map((iv, idx) => (
                                  <div key={idx} className="flex justify-between gap-4 text-slate-700 font-mono py-0.5">
                                    <span className="text-slate-600">{iv.interval}</span>
                                    <span className="font-semibold">{iv.cost}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceBalanceChart({ data }: { data: { month: string; amount: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.amount), 1);
  const yTicks = Array.from({ length: 6 }, (_, i) => Math.round((maxVal / 5) * (5 - i)));
  const barWidth = Math.min(80, Math.max(40, 600 / data.length));
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="w-4 h-3 bg-blue-600 rounded-sm" />
        <span className="text-xs text-slate-600 font-medium">Current Billing Amount</span>
      </div>
      <div className="flex-1 flex">
        <div className="flex flex-col justify-between pr-2 text-right" style={{ width: 60 }}>
          {yTicks.map((tick, i) => (
            <span key={i} className="text-[10px] text-slate-400 font-mono leading-none">{tick.toLocaleString('en-ZA')}</span>
          ))}
        </div>
        <div className="flex-1 border-l border-b border-slate-200 relative flex items-end justify-around px-2 gap-1">
          {data.map((d, i) => {
            const height = maxVal > 0 ? (d.amount / maxVal) * 100 : 0;
            return (
              <div key={i} className="flex flex-col items-center flex-1" style={{ maxWidth: barWidth }}>
                <div className="w-full flex items-end justify-center" style={{ height: '100%', minHeight: 200 }}>
                  <div className="w-full bg-blue-600 rounded-t-sm transition-all hover:bg-blue-500 relative group" style={{ height: `${height}%`, minHeight: d.amount > 0 ? 4 : 0 }} data-testid={`bar-${i}`}>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      R {d.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex ml-[60px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-slate-500 mt-1 font-medium" style={{ maxWidth: barWidth }}>{d.month}</div>
        ))}
      </div>
      <div className="text-center text-xs text-slate-400 mt-2">Month</div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-slate-400 origin-center" style={{ transform: 'rotate(-90deg) translateX(-50%)', left: 10 }}>Billing Amount</div>
    </div>
  );
}

function PropertyDetailsTab({ accountId }: { accountId: number }) {
  const [propData, setPropData] = useState<any>(null);
  const [consUnit, setConsUnit] = useState<any>(null);
  const [valuations, setValuations] = useState<any[]>([]);
  const [ratesDetails, setRatesDetails] = useState<any>(null);
  const [meters, setMeters] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [propResult, consResult] = await Promise.allSettled([
        getPropertyDetails(accountId),
        getConsumptionUnits(accountId),
      ]);
      let propVal = propResult.status === 'fulfilled' ? propResult.value : null;
      if (Array.isArray(propVal)) propVal = propVal[0] || null;
      setPropData(propVal);
      const cu = consResult.status === 'fulfilled' ? consResult.value : null;
      const cuData = Array.isArray(cu) ? cu[0] : cu;
      setConsUnit(cuData);

      const propertyId = propVal?.propertyId || propVal?.property_ID || cuData?.unit_ID;

      const [valResult, ratesResult, meterResult, transferResult] = await Promise.allSettled([
        propertyId ? getSupplementaryValuations(propertyId).catch(() => []) : Promise.resolve([]),
        getAccountRatesDetails(accountId).catch(() => null),
        getMeteredServicesOnAccount(accountId).catch(() => []),
        getTransferOwnership(accountId).catch(() => []),
      ]);
      if (valResult.status === 'fulfilled') setValuations(Array.isArray(valResult.value) ? valResult.value : valResult.value ? [valResult.value] : []);
      if (ratesResult.status === 'fulfilled') setRatesDetails(ratesResult.value);
      if (meterResult.status === 'fulfilled') setMeters(Array.isArray(meterResult.value) ? meterResult.value : []);
      if (transferResult.status === 'fulfilled') setTransfers(Array.isArray(transferResult.value) ? transferResult.value : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load property details');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!propData && !consUnit) return <EmptyState message="No property details available" />;

  const prop = propData || {};
  const cu = consUnit || {};
  const fmt = (v: any) => {
    if (v === null || v === undefined || v === '') return '-';
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtDate = (v: any) => {
    if (!v) return '-';
    try { return new Date(v).toLocaleDateString('en-ZA'); } catch { return String(v); }
  };
  const fmtInt = (v: any) => {
    if (v === null || v === undefined || v === '') return '-';
    return typeof v === 'number' ? v.toLocaleString('en-ZA') : String(v);
  };

  return (
    <div className="p-4 space-y-6" data-testid="property-details-tab">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Property Information</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Property ID</span><div className="text-sm font-medium text-slate-800">{prop.propertyId || prop.property_ID || cu.unit_ID || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Erf Number</span><div className="text-sm font-medium text-slate-800">{prop.erfNumber || cu.erfNumber || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">SG Number</span><div className="text-sm font-medium text-slate-800">{prop.sgNumber || cu.sgNumber || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Street Address</span><div className="text-sm font-medium text-slate-800">{prop.streetNumber ? `${prop.streetNumber} ${prop.streetName}` : prop.streetName || cu.nonStandAddLine1 || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Suburb</span><div className="text-sm font-medium text-slate-800">{prop.subSuburb || prop.suburb || cu.nonStandAddSuburb || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Town</span><div className="text-sm font-medium text-slate-800">{prop.town || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Property Type / Zoning</span><div className="text-sm font-medium text-slate-800">{prop.typeofUse || prop.townPlanningZoneType || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Market Value</span><div className="text-sm font-bold text-blue-700 font-mono">{fmt(prop.marketValue || cu.marketValue)}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Stand Size (m²)</span><div className="text-sm font-medium text-slate-800">{fmtInt(prop.standSize || cu.standSize)}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Land Size (ha)</span><div className="text-sm font-medium text-slate-800">{prop.landSize ?? cu.landSize ?? '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Rates Tariff</span><div className="text-sm font-medium text-slate-800">{prop.ratesTariff || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Owner</span><div className="text-sm font-medium text-slate-800">{prop.name || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Master Property</span><div className="text-sm font-medium text-slate-800">{prop.masterProperty || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Roll Number</span><div className="text-sm font-medium text-slate-800">{prop.rollNumber || '-'}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Roll Start Date</span><div className="text-sm font-medium text-slate-800">{fmtDate(prop.rollStartDate)}</div></div>
            <div><span className="text-[11px] uppercase text-slate-400 font-medium">Expected Expiry Date</span><div className="text-sm font-medium text-slate-800">{fmtDate(prop.expectedExpiryDate)}</div></div>
            {prop.rdpOrReform && <div><span className="text-[11px] uppercase text-slate-400 font-medium">RDP / Reform</span><div className="text-sm font-medium text-slate-800">{prop.rdpOrReform}</div></div>}
            {prop.complexName && <div><span className="text-[11px] uppercase text-slate-400 font-medium">Complex</span><div className="text-sm font-medium text-slate-800">{prop.complexName}</div></div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">General Valuations</h3>
          <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{valuations.length}</Badge>
        </div>
        {valuations.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No valuation records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Fin Year</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Market Value</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Improvement</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Stand Size (m²)</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Roll Number</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Roll Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Tariff</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Zoning / Use</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {valuations.map((v: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-800">{v.type || '-'}</td>
                    <td className="py-2 px-3">
                      <Badge variant={v.valuationStatus === 'Active' ? 'default' : 'secondary'} className={`text-[10px] ${v.valuationStatus === 'Active' ? 'bg-green-100 text-green-800' : ''}`}>{v.valuationStatus || '-'}</Badge>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{v.financialYear || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700">{fmt(v.standMarketValue)}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(v.improvementValue)}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmtInt(v.standSize)}</td>
                    <td className="py-2 px-3 text-slate-600">{v.rollNumber || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{fmtDate(v.rollDate)}</td>
                    <td className="py-2 px-3 text-slate-600 text-xs">{v.ratesTariffCode || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{v.zoneDesc || v.typeOfUseDesc || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{v.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 flex items-center gap-2">
            <Gift className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Rebates & Levies</h3>
          </div>
          <div className="p-4">
            {ratesDetails ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                  <span className="text-sm text-slate-700">Annual Property Rates</span>
                  <span className="font-mono font-bold text-slate-800">{fmt(ratesDetails.annualPropertyRates)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                  <span className="text-sm text-slate-700">Installment</span>
                  <span className="font-mono font-bold text-slate-800">{fmt(ratesDetails.installment)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                  <span className="text-sm text-slate-700">Frequency</span>
                  <span className="font-medium text-slate-800">{ratesDetails.frequency || '-'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                  <span className="text-sm text-slate-700">Remaining Installments</span>
                  <span className="font-medium text-slate-800">{ratesDetails.remainingInstallments ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                  <span className="text-sm text-slate-700">Remaining Amount</span>
                  <span className="font-mono font-bold text-slate-800">{fmt(ratesDetails.remaingAmount ?? ratesDetails.remainingAmount)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-200">
                  <span className="text-sm text-green-800 font-medium">Rebate Amount</span>
                  <span className="font-mono font-bold text-green-700">{fmt(ratesDetails.rebateAmount)}</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-sm py-4">No rates/rebate data available</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Election Information</h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <span className="text-sm text-slate-700">Ward</span>
                <span className="font-medium text-indigo-800">{cu.wardID ? `Ward ${cu.wardID}` : '-'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <span className="text-sm text-slate-700">Polling Station</span>
                <span className="font-medium text-indigo-800">{cu.pollingStationID ? `Station ${cu.pollingStationID}` : '-'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <span className="text-sm text-slate-700">Magisterial District</span>
                <span className="font-medium text-indigo-800">{cu.magisterialID ? `District ${cu.magisterialID}` : '-'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <span className="text-sm text-slate-700">NT Property Category</span>
                <span className="font-medium text-indigo-800">{cu.ntPropertyCategoryID ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <span className="text-sm text-slate-700">Billing Cycle</span>
                <span className="font-medium text-indigo-800">{cu.billingCycleID ?? '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 flex items-center gap-2">
          <Zap className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Meters</h3>
          <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{meters.length}</Badge>
        </div>
        {meters.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No meters linked to this property</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Number</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Last Reading</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Read Date</th>
                </tr>
              </thead>
              <tbody>
                {meters.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-cyan-50/30 transition-colors">
                    <td className="py-2 px-3 font-mono font-medium text-slate-800">{m.meterNumber || m.physicalMeterNumber || m.meter_Number || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{m.serviceType || m.serviceDescription || m.service || '-'}</td>
                    <td className="py-2 px-3">
                      <Badge variant={m.status === 'Active' || m.isActive ? 'default' : 'secondary'} className={`text-[10px] ${m.status === 'Active' || m.isActive ? 'bg-green-100 text-green-800' : ''}`}>{m.status || (m.isActive ? 'Active' : 'Inactive') || '-'}</Badge>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{m.meterType || m.type || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono">{m.lastReading ?? m.currentReading ?? '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{fmtDate(m.readDate || m.lastReadDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Transfer of Ownership History</h3>
          <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{transfers.length}</Badge>
        </div>
        {transfers.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No transfer of ownership records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">From</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">To</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reference</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-purple-50/30 transition-colors">
                    <td className="py-2 px-3 text-slate-600">{fmtDate(t.transferDate || t.dateOfTransfer || t.date)}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{t.fromOwner || t.previousOwner || t.from || '-'}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{t.toOwner || t.newOwner || t.to || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{t.transferType || t.type || '-'}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{t.reference || t.referenceNumber || '-'}</td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className="text-[10px]">{t.status || t.transferStatus || '-'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsumptionChart({ readings }: { readings: any[] }) {
  if (!readings.length) return null;

  const sorted = [...readings].sort((a, b) => {
    const parseDate = (d: string) => {
      if (!d) return 0;
      const parts = d.split('/');
      if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
      return new Date(d).getTime();
    };
    return parseDate(a.reading1Date) - parseDate(b.reading1Date);
  });

  const recent = sorted.slice(-12);
  const maxVal = Math.max(...recent.map(r => r.consumption || 0), 1);
  const yTicks: number[] = [];
  const step = Math.ceil(maxVal / 5);
  for (let i = 0; i <= maxVal + step; i += step) yTicks.push(i);

  const getBarColor = (item: any) => {
    const flag = (item.flag || item.levyStatus || '').toLowerCase();
    if (flag.includes('reversed') || flag.includes('cancel')) return { bg: 'bg-red-500', label: 'Reversed' };
    if (flag.includes('estimate') || flag.includes('levy')) return { bg: 'bg-gray-400', label: 'Levy Estimate' };
    return { bg: 'bg-blue-500', label: 'Actual' };
  };

  const formatMonth = (item: any) => {
    const month = item.billingmonth || item.billingMonth || '';
    const fy = item.financialYear || '';
    if (month && fy) {
      const years = fy.split('/');
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthIdx = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
      if (monthIdx >= 0) {
        const year = monthIdx >= 6 ? years[0] : years[1];
        return `${month.substring(0, 3)}-${year}`;
      }
    }
    if (month === 'Current Open Period') return 'Current';
    return month.substring(0, 3) || '?';
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-blue-500 rounded-sm" /><span className="text-slate-600">Actual</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-gray-400 rounded-sm" /><span className="text-slate-600">Levy Estimate</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-red-500 rounded-sm" /><span className="text-slate-600">Reversed</span></div>
      </div>
      <div className="flex">
        <div className="flex flex-col justify-between items-end pr-2 text-[10px] text-slate-400 font-mono" style={{ height: 200 }}>
          {[...yTicks].reverse().map((t, i) => <span key={i}>{t}</span>)}
        </div>
        <div className="flex-1 relative border-l border-b border-slate-300" style={{ height: 200 }}>
          <div className="absolute inset-0 flex items-end justify-around px-1 gap-1">
            {recent.map((item, i) => {
              const pct = maxVal > 0 ? ((item.consumption || 0) / (yTicks[yTicks.length - 1] || maxVal)) * 100 : 0;
              const color = getBarColor(item);
              return (
                <div key={i} className="flex flex-col items-center flex-1 min-w-0" style={{ height: '100%', justifyContent: 'flex-end' }}>
                  <span className="text-[9px] font-mono text-slate-600 mb-0.5">{item.consumption || 0}</span>
                  <div className={`w-full max-w-[40px] ${color.bg} rounded-t-sm transition-all`} style={{ height: `${Math.max(pct, 1)}%` }} title={`${formatMonth(item)}: ${item.consumption || 0} (${color.label})`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex ml-8 mt-1">
        <div className="flex-1 flex justify-around px-1 gap-1">
          {recent.map((item, i) => (
            <div key={i} className="flex-1 min-w-0 text-center">
              <span className="text-[9px] text-slate-500 block leading-tight" style={{ transform: 'rotate(-30deg)', transformOrigin: 'top center', whiteSpace: 'nowrap' }}>{formatMonth(item)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConsumptionTab({ accountId }: { accountId: number }) {
  const [meters, setMeters] = useState<any[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<any | null>(null);
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMeteredServicesOnAccount(accountId);
      setMeters(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load consumption data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  const loadHistory = useCallback(async (meter: any) => {
    setSelectedMeter(meter);
    setHistoryLoading(true);
    try {
      const meterNo = (meter.meterNo || meter.meterNumber || '').replace(/^0+/, '');
      const history = await getMeterReadingHistory(accountId, meterNo);
      setReadingHistory(history);
    } catch {
      setReadingHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [accountId]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!meters.length) return <EmptyState message="No metered services found for this account" />;

  const meterCols = [
    { key: 'serviceDesc', label: 'Service Type' },
    { key: 'meterClassificationDesc', label: 'Meter Classification' },
    { key: 'tariff', label: 'Tariff' },
    { key: 'combinationMeterPhysicalNumber', label: 'Combination Meter No' },
    { key: 'connectionSizeDesc', label: 'Meter Connection Size' },
    { key: 'tarifffactor', label: 'Factor' },
    { key: 'dwellingIntervalMultiplier', label: 'Dwelling Unit Interval Multiplier' },
    { key: 'meterNo', label: 'Meter No' },
    { key: 'meterPhase', label: 'Meter Phase' },
    { key: 'physicalMeterNo', label: 'Physical Meter No' },
    { key: 'meterBookNo', label: 'Meter Book' },
    { key: 'routeFileName', label: 'Route' },
    { key: 'serviceStatus', label: 'Service Status' },
    { key: 'numberofDials', label: 'Number of Dials' },
  ];

  const historyCols = [
    { key: 'serviceDesc', label: 'Service Type' },
    { key: 'meterClassificationDesc', label: 'Meter Classification', fallback: () => selectedMeter?.meterClassificationDesc || '' },
    { key: 'tariff', label: 'Tariff', fallback: () => selectedMeter?.tariff || '' },
    { key: 'combinationMeterNo', label: 'Combination Meter No' },
    { key: 'tarifffactor', label: 'Factor', fallback: () => selectedMeter?.tarifffactor },
    { key: 'meterNo', label: 'Meter No' },
    { key: 'physicalMeterNo', label: 'Physical Meter No', fallback: () => selectedMeter?.physicalMeterNo || '' },
    { key: 'billingmonth', label: 'Billing Month' },
    { key: 'meterBookNo', label: 'Meter Book', fallback: () => selectedMeter?.meterBookNo || '' },
    { key: 'routeFileName', label: 'Route' },
    { key: 'reading1Date', label: 'Old Reading Date' },
    { key: 'reading1', label: 'Old Reading' },
    { key: 'reading2Date', label: 'New Reading Date' },
    { key: 'reading2', label: 'New Reading' },
    { key: 'readingdays', label: 'Reading Days' },
    { key: 'consumption', label: 'Consumption' },
    { key: 'flag', label: 'Levy Status' },
  ];

  const sortedHistory = [...readingHistory].sort((a, b) => {
    const parseDate = (d: string) => {
      if (!d) return 0;
      const parts = d.split('/');
      if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
      return new Date(d).getTime();
    };
    return parseDate(b.reading1Date) - parseDate(a.reading1Date);
  });

  return (
    <div className="p-4 space-y-6" data-testid="consumption-tab">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
          <Zap className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Consumption</h3>
          <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{meters.length} meter{meters.length !== 1 ? 's' : ''}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-consumption-meters">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-8 py-2 px-2"></th>
                {meterCols.map(col => (
                  <th key={col.key} className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meters.map((meter: any, i: number) => {
                const isSelected = selectedMeter && (selectedMeter.meterNo === meter.meterNo && selectedMeter.serviceDesc === meter.serviceDesc);
                return (
                  <tr
                    key={i}
                    onClick={() => loadHistory(meter)}
                    className={`border-b border-slate-100 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-slate-50'}`}
                    data-testid={`row-meter-${i}`}
                  >
                    <td className="py-2 px-2 text-center">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                        {isSelected && <div className="w-full h-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
                      </div>
                    </td>
                    {meterCols.map(col => (
                      <td key={col.key} className="py-2 px-2 text-[12px] text-slate-700 whitespace-nowrap">{meter[col.key] ?? '-'}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedMeter && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-slate-100 to-white border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800">Meter Reading History Chart</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 mb-4 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div><span className="text-[10px] text-slate-400 block">Service Type</span><span className="text-xs font-medium text-slate-700">{selectedMeter.serviceDesc || '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Meter Classification</span><span className="text-xs font-medium text-slate-700">{selectedMeter.meterClassificationDesc || '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Tariff</span><span className="text-xs font-medium text-slate-700 break-words">{selectedMeter.tariff || '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Factor</span><span className="text-xs font-medium text-slate-700">{selectedMeter.tarifffactor ?? '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Physical Meter No</span><span className="text-xs font-medium text-slate-700">{selectedMeter.physicalMeterNo || '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Route File</span><span className="text-xs font-medium text-slate-700">{selectedMeter.routeFileName || '-'}</span></div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /><span className="ml-2 text-sm text-slate-500">Loading meter reading history...</span></div>
            ) : readingHistory.length > 0 ? (
              <ConsumptionChart readings={readingHistory} />
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No reading history available for this meter</div>
            )}
          </div>
        </div>
      )}

      {selectedMeter && !historyLoading && readingHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-slate-600 to-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Meter Reading History</h3>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[10px]">{readingHistory.length} records</Badge>
              <button
                onClick={() => {
                  const headers = historyCols.map(c => c.label);
                  const rows = sortedHistory.map((item: any) =>
                    historyCols.map(col => {
                      let val = item[col.key];
                      if ((val === undefined || val === null || val === '') && (col as any).fallback) val = (col as any).fallback();
                      return String(val ?? '').replace(/"/g, '""');
                    })
                  );
                  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `meter-reading-history-${selectedMeter?.physicalMeterNo || selectedMeter?.meterNo || 'export'}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white text-[11px] font-medium rounded-md transition-colors border border-white/20"
                data-testid="btn-download-meter-history"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm" data-testid="table-meter-reading-history">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  {historyCols.map(col => (
                    <th key={col.key} className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                    {historyCols.map(col => {
                      let val = item[col.key];
                      if ((val === undefined || val === null || val === '') && (col as any).fallback) val = (col as any).fallback();
                      if (col.key === 'consumption') {
                        return <td key={col.key} className="py-1.5 px-2 text-[12px] font-mono font-bold text-blue-700 whitespace-nowrap">{val ?? '-'}</td>;
                      }
                      if (col.key === 'flag') {
                        const f = String(val || '').toLowerCase();
                        const color = f.includes('reversed') || f.includes('cancel') ? 'text-red-600' : f.includes('estimate') || f.includes('levy') ? 'text-amber-600' : 'text-green-700';
                        return <td key={col.key} className={`py-1.5 px-2 text-[12px] font-medium whitespace-nowrap ${color}`}>{val || '-'}</td>;
                      }
                      return <td key={col.key} className="py-1.5 px-2 text-[12px] text-slate-700 whitespace-nowrap">{val ?? '-'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactInfoTab({ accountId }: { accountId: number }) {
  const [nameData, setNameData] = useState<any>(null);
  const [contactData, setContactData] = useState<any>(null);
  const [deliveryAddr, setDeliveryAddr] = useState<any[]>([]);
  const [contactHistory, setContactHistory] = useState<any[]>([]);
  const [addressHistory, setAddressHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContactHistory, setShowContactHistory] = useState(false);
  const [showAddressHistory, setShowAddressHistory] = useState(false);
  const prevAccountId = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nameResult, contactResult, daResult, chResult, ahResult] = await Promise.all([
        getNameInfo(accountId).catch(() => null),
        getContactDetails(accountId).catch(() => null),
        getAccountDeliveryAddressDetail(accountId).catch(() => []),
        getContactDetailsHistory(accountId).catch(() => []),
        getDeliveryAddressHistory(accountId).catch(() => []),
      ]);
      setNameData(nameResult);
      setContactData(contactResult);
      setDeliveryAddr(Array.isArray(daResult) ? daResult : daResult ? [daResult] : []);
      setContactHistory(Array.isArray(chResult) ? chResult : []);
      setAddressHistory(Array.isArray(ahResult) ? ahResult : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load contact information');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (prevAccountId.current !== accountId) {
      prevAccountId.current = accountId;
      load();
    }
  }, [accountId, load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const n = nameData || {};
  const c = contactData || {};
  const da = deliveryAddr[0] || {};

  const phoneFormat = '(### ######) / +27## #######)';

  return (
    <div className="p-4 space-y-5" data-testid="contact-info-panel">
      <h3 className="text-base font-bold text-slate-800">Consumer Contact Details</h3>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => {}}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 text-left"
          data-testid="section-contact-details"
        >
          <ChevronDown className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Contact Details</span>
        </button>
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-0.5">Telephone (Mobile)</label>
                <div className="flex items-center gap-2">
                  <input readOnly className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={n.tel_Mobile || c.mobile || c.tel_Mobile || ''} data-testid="input-tel-mobile" />
                </div>
                <span className="text-[10px] text-slate-400 italic">{phoneFormat}</span>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-0.5">Telephone (Home)</label>
                <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={n.tel_Home || c.homePhone || c.tel_Home || ''} data-testid="input-tel-home" />
                <span className="text-[10px] text-slate-400 italic">{phoneFormat}</span>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-0.5">Telephone (Work)</label>
                <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={n.tel_Work || c.workPhone || c.tel_Work || ''} data-testid="input-tel-work" />
                <span className="text-[10px] text-slate-400 italic">{phoneFormat}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-0.5">Fax</label>
                <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={n.fax || c.fax || ''} data-testid="input-fax" />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-0.5">Email Address</label>
                <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={n.email || c.email || c.emailAddress || ''} data-testid="input-email" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-white border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-700">Additional Statement Emails</span>
          <p className="text-[10px] text-orange-600 mt-0.5">NOTE: The Primary Email Address above needs to be populated with a valid Email Address in Contact Details before this form will be considered. If you enter email addresses here and statements are emailed to these, it will receive it as well. Clearing a field and Saving will delete the additional Email.</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Additional Email Address 1</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={c.additionalEmail1 || ''} data-testid="input-additional-email-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Additional Email Address 2</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={c.additionalEmail2 || ''} data-testid="input-additional-email-2" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Additional Email Address 3</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={c.additionalEmail3 || ''} data-testid="input-additional-email-3" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Additional Email Address 4</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={c.additionalEmail4 || ''} data-testid="input-additional-email-4" />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowContactHistory(!showContactHistory)}
        className="text-sm font-semibold text-blue-700 underline hover:text-blue-900 transition-colors flex items-center gap-1"
        data-testid="toggle-contact-history"
      >
        <Clock className="w-3.5 h-3.5" />
        Contact Details History
        {showContactHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {showContactHistory && (
        <PaginatedTable
          data={contactHistory}
          tableId="contact-history"
          columns={[
            { key: 'changeDate', label: 'Date', render: (r: any) => { try { return r.changeDate ? new Date(r.changeDate).toLocaleDateString('en-ZA') : r.date || ''; } catch { return r.changeDate || ''; } } },
            { key: 'fieldName', label: 'Field', render: (r: any) => r.fieldName || r.field || r.description || '' },
            { key: 'oldValue', label: 'Old Value', render: (r: any) => r.oldValue || r.previousValue || '' },
            { key: 'newValue', label: 'New Value', render: (r: any) => r.newValue || r.currentValue || '' },
            { key: 'changedBy', label: 'Changed By', render: (r: any) => r.changedBy || r.user || '' },
          ]}
        />
      )}

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => {}}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 text-left"
          data-testid="section-delivery-address"
        >
          <ChevronDown className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Delivery Address Details</span>
        </button>
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Type of Delivery Address *</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.typeofDeliveryAddress || da.typeOfDeliveryAddress || ''} data-testid="input-delivery-type" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Complex Name</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.complexName || ''} data-testid="input-complex-name" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">City / Town</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.town || ''} data-testid="input-city" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Unit Number</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.unitNumber || ''} data-testid="input-unit-number" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Suburb</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.suburbName || da.suburb || ''} data-testid="input-suburb" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Postal Code *</label>
              <input readOnly className="w-full bg-orange-50 border border-orange-300 rounded px-3 py-1.5 text-sm text-slate-700 font-medium" value={da.postalCode || ''} data-testid="input-postal-code" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Address Line 1</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.streetNumber || ''} data-testid="input-address-line1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Care Of</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.careOf || ''} data-testid="input-care-of" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Address Line 2</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.streetName || ''} data-testid="input-address-line2" />
            </div>
            <div />
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">Address Line 3</label>
              <input readOnly className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700" value={da.boxBagNo || ''} data-testid="input-address-line3" />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowAddressHistory(!showAddressHistory)}
        className="text-sm font-semibold text-blue-700 underline hover:text-blue-900 transition-colors flex items-center gap-1"
        data-testid="toggle-address-history"
      >
        <Clock className="w-3.5 h-3.5" />
        Delivery Address Details History
        {showAddressHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {showAddressHistory && (
        <PaginatedTable
          data={addressHistory}
          tableId="address-history"
          columns={[
            { key: 'changeDate', label: 'Date', render: (r: any) => { try { return r.changeDate ? new Date(r.changeDate).toLocaleDateString('en-ZA') : r.date || ''; } catch { return r.changeDate || ''; } } },
            { key: 'address', label: 'Address', render: (r: any) => (r.address || r.deliveryAddress || '').replace(/\r\n/g, ', ') },
            { key: 'changedBy', label: 'Changed By', render: (r: any) => r.changedBy || r.user || '' },
          ]}
        />
      )}
    </div>
  );
}

function HandoverTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [enquiry, setEnquiry] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [info, enq, txns] = await Promise.all([
        getHandoverInfo(accountId).catch(() => null),
        getHandoverAccountEnquiry(accountId).catch(() => null),
        getConsHandoverTransactionDetail(accountId).catch(() => []),
      ]);
      setData(info);
      setEnquiry(enq);
      setTransactions(txns);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load handover information');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data && !enquiry && !transactions.length) return <EmptyState message="No handover information available" />;

  const items = data ? (Array.isArray(data) ? data : [data]) : [];
  return (
    <div className="p-4 space-y-4">
      {items.map((item: any, i: number) => (
        <Card key={i}>
          <CardContent className="pt-4 space-y-0">
            <FieldRow label="Handover Status" value={item.handoverStatus || item.status} icon={<Shield className="w-3.5 h-3.5" />} />
            <FieldRow label="Handover Date" value={item.handoverDate ? new Date(item.handoverDate).toLocaleDateString('en-ZA') : null} />
            <FieldRow label="Attorney" value={item.attorney || item.attorneyName} />
            <FieldRow label="Reference" value={item.reference || item.handoverReference} />
            <FieldRow label="Amount" value={item.amount || item.handoverAmount} />
            <FieldRow label="Description" value={item.description || item.notes} />
          </CardContent>
        </Card>
      ))}

      {enquiry && (
        <>
          <SectionHeader title="Handover Account Enquiry" />
          <Card>
            <CardContent className="pt-4 space-y-0">
              {Object.entries(enquiry).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
                <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {transactions.length > 0 && (
        <>
          <SectionHeader title="Handover Transactions" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-handover-transactions">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-500">{tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString('en-ZA') : tx.date || '-'}</td>
                    <td className="py-2 px-3">{tx.description || tx.transactionDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(tx.amount ?? tx.transactionAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-slate-500">{tx.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function IncentivesTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPaymentIncentive(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load incentive data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState message="No payment incentive data available" />;

  const items = Array.isArray(data) ? data : [data];
  return (
    <div className="p-4 space-y-4">
      {items.map((item: any, i: number) => (
        <Card key={i}>
          <CardContent className="pt-4 space-y-0">
            <FieldRow label="Incentive Type" value={item.incentiveType || item.type} icon={<Gift className="w-3.5 h-3.5" />} />
            <FieldRow label="Discount %" value={item.discountPercentage || item.percentage} />
            <FieldRow label="Discount Amount" value={item.discountAmount || item.amount} />
            <FieldRow label="Valid From" value={item.validFrom ? new Date(item.validFrom).toLocaleDateString('en-ZA') : null} />
            <FieldRow label="Valid To" value={item.validTo ? new Date(item.validTo).toLocaleDateString('en-ZA') : null} />
            <FieldRow label="Status" value={item.status || item.incentiveStatus} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DepositsTab({ accountId }: { accountId: number }) {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositAmount, setDepositAmount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depsResult, amtResult] = await Promise.all([
        getDeposits(accountId).catch(() => []),
        getDepositAmount(accountId).catch(() => null),
      ]);
      setDeposits(Array.isArray(depsResult) ? depsResult : []);
      setDepositAmount(amtResult);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load deposit data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmt = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0;
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalAmt = typeof depositAmount === 'number' ? depositAmount : (depositAmount?.totalDeposit ?? depositAmount?.amount ?? 0);
  const totalDeposit = deposits.reduce((s, d) => s + (d.deposit ?? d.depositAmount ?? d.amount ?? 0), 0);
  const totalPaid = deposits.reduce((s, d) => s + (d.paidAmount ?? 0), 0);

  return (
    <div className="p-4 space-y-6" data-testid="deposits-tab">
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider">Total Deposit Amount</p>
            <p className={`text-3xl font-bold font-mono tracking-tight ${totalAmt < 0 ? 'text-red-300' : 'text-white'}`}>
              {fmt(totalAmt)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-700">Deposit:</h3>
        </div>
        {deposits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-deposits">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Service Type</th>
                  <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Receipt No / Journal Transaction ID</th>
                  <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Date Captured</th>
                  <th className="text-right py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Deposit Amount</th>
                  <th className="text-right py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Paid Amount</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((dep: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors" data-testid={`row-deposit-${i}`}>
                    <td className="py-3 px-5 text-slate-700 font-medium">{dep.serviceDesc || dep.serviceDescription || dep.description || '-'}</td>
                    <td className="py-3 px-5 text-slate-600 font-mono text-[13px]">{dep.docNumber || dep.receiptNo || dep.reference || ''}</td>
                    <td className="py-3 px-5 text-slate-600">{dep.dateCaptured ? new Date(dep.dateCaptured).toLocaleDateString('en-ZA') : dep.depositDate ? new Date(dep.depositDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-800 font-semibold">{fmt(dep.deposit ?? dep.depositAmount ?? dep.amount ?? 0)}</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-800 font-semibold">{fmt(dep.paidAmount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50/80">
                  <td colSpan={3} className="py-3 px-5"></td>
                  <td className="py-3 px-5 text-right font-mono font-bold text-slate-900 text-[14px]">{fmt(totalDeposit)}</td>
                  <td className="py-3 px-5 text-right font-mono font-bold text-slate-900 text-[14px]">({fmt(Math.abs(totalPaid))})</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Landmark className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No deposit records found for this account</p>
          </div>
        )}
      </div>
    </div>
  );
}

const MONTHS = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];

function getFinYearOptions(): string[] {
  const now = new Date();
  const currentStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, i) => {
    const y = currentStartYear - i;
    return `${y}/${y + 1}`;
  });
}

function TransactionSummaryTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const years = useMemo(() => getFinYearOptions(), []);
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const lastKey = useRef('');

  const load = useCallback(async (finYear: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getServiceTypeBalance(accountId, finYear);
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load transaction summary');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    const key = `${accountId}-${selectedYear}`;
    if (lastKey.current !== key) {
      lastKey.current = key;
      load(selectedYear);
    }
  }, [accountId, selectedYear, load]);

  const pivotData = useMemo(() => {
    const descMap = new Map<string, Record<string, number>>();
    const monthTotals: Record<string, number> = {};
    const monthOpeningBalance: Record<string, number> = {};
    const monthInterest: Record<string, number> = {};
    const monthReceipts: Record<string, number> = {};

    data.forEach((d: any) => {
      const desc = d.serviceDescription || d.description || 'Unknown';
      const month = d.month || '';
      const totalAmt = d.totalAmount ?? d.amount ?? 0;
      const openBal = d.openingBalance ?? 0;
      const interest = d.interestAmount ?? 0;
      const currentCharge = d.currentCharge ?? 0;

      if (!descMap.has(desc)) descMap.set(desc, {});
      const row = descMap.get(desc)!;
      row[month] = (row[month] || 0) + totalAmt;

      monthTotals[month] = (monthTotals[month] || 0) + totalAmt;
      monthOpeningBalance[month] = (monthOpeningBalance[month] || 0) + openBal;
      monthInterest[month] = (monthInterest[month] || 0) + interest;
    });

    const serviceRows = Array.from(descMap.entries()).map(([desc, months]) => ({
      description: desc,
      isSpecial: false,
      ...months,
    }));

    const openingRow: any = { description: 'Opening Balance', isSpecial: true };
    const totalRow: any = { description: 'Total', isSpecial: true, isBold: true };
    const interestRow: any = { description: 'Interest', isSpecial: true };
    const receiptsRow: any = { description: 'Receipts', isSpecial: true };
    const closingRow: any = { description: 'Closing Balance', isSpecial: true, isBold: true };

    MONTHS.forEach(m => {
      openingRow[m] = monthOpeningBalance[m] || 0;
      totalRow[m] = monthTotals[m] || 0;
      interestRow[m] = monthInterest[m] || 0;
      const closingVal = (monthOpeningBalance[m] || 0) + (monthTotals[m] || 0) + (monthInterest[m] || 0);
      closingRow[m] = closingVal;
      receiptsRow[m] = 0;
    });

    return [openingRow, ...serviceRows, interestRow, totalRow, receiptsRow, closingRow];
  }, [data]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => load(selectedYear)} />;

  const hasData = data.length > 0;
  const fmt = (v: number | undefined) => {
    if (v === undefined) return '0.00';
    const num = typeof v === 'number' ? v : 0;
    if (num < 0) return `(${Math.abs(num).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})`;
    return num.toLocaleString('en-ZA', { minimumFractionDigits: 2 });
  };

  return (
    <div className="p-4 space-y-4" data-testid="transaction-summary-panel">
      <h3 className="text-base font-bold text-slate-800">Transaction Summary List per Fin-Year/Billing Period</h3>
      <div className="flex items-center gap-3">
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
          data-testid="select-financial-year"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-xs" data-testid="transaction-summary-grid">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap sticky left-0 bg-slate-100 min-w-[180px]">Description</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Financial Year</th>
              {MONTHS.map(m => (
                <th key={m} className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!hasData ? (
              <tr><td colSpan={14} className="text-center text-slate-400 py-4">No records to display</td></tr>
            ) : pivotData.map((row: any, i: number) => (
              <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${row.isBold ? 'bg-slate-50 font-bold' : ''} ${row.isSpecial ? 'border-t border-slate-200' : ''}`}>
                <td className={`px-3 py-2 whitespace-nowrap sticky left-0 ${row.isBold ? 'bg-slate-50 font-bold text-slate-900' : row.isSpecial ? 'bg-white text-slate-600 italic' : 'bg-white text-slate-700'}`}>{row.description}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{selectedYear}</td>
                {MONTHS.map(m => (
                  <td key={m} className={`px-3 py-2 text-right whitespace-nowrap font-mono ${row.isBold ? 'font-bold text-slate-900' : 'text-slate-700'} ${(row[m] || 0) < 0 ? 'text-red-600' : ''}`}>{fmt(row[m])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
        <span>Items per page: <span className="border rounded px-2 py-0.5">50</span></span>
        <span>{!hasData ? '0 of 0' : `1 - ${pivotData.length} of ${pivotData.length}`}</span>
      </div>
    </div>
  );
}

function DetailedTransactionListTab({ accountId }: { accountId: number }) {
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [receiptData, setReceiptData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const years = useMemo(() => getFinYearOptions(), []);
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [showCreditMeterOnly, setShowCreditMeterOnly] = useState(false);
  const lastKey = useRef('');

  const calendarMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const finYearMonths = ['July','August','September','October','November','December','January','February','March','April','May','June'];

  const load = useCallback(async (finYear: string) => {
    setLoading(true);
    setError(null);
    try {
      const [balResult, rcptResult] = await Promise.all([
        getServiceTypeBalance(accountId, finYear).catch(() => []),
        getTransactionHistory('', accountId).catch(() => []),
      ]);
      setBalanceData(Array.isArray(balResult) ? balResult : []);
      setReceiptData(Array.isArray(rcptResult) ? rcptResult : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load detailed transactions');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    const key = `${accountId}-${selectedYear}`;
    if (lastKey.current !== key) {
      lastKey.current = key;
      load(selectedYear);
    }
  }, [accountId, selectedYear, load]);

  const monthsAvailable = useMemo(() => {
    const mSet = new Set<string>();
    balanceData.forEach((d: any) => {
      if (d.month) mSet.add(d.month);
    });
    return finYearMonths.filter(m => mSet.has(m));
  }, [balanceData]);

  useEffect(() => {
    if (monthsAvailable.length > 0 && !monthsAvailable.includes(selectedMonth)) {
      setSelectedMonth(monthsAvailable[monthsAvailable.length - 1]);
    }
  }, [monthsAvailable, selectedMonth]);

  const detailedRows = useMemo(() => {
    if (!selectedMonth) return [];
    const monthData = balanceData.filter((d: any) => d.month === selectedMonth);
    if (monthData.length === 0) return [];

    const rows: any[] = [];
    const totalOpening = monthData.reduce((s, d) => s + (d.openingBalance || 0), 0);
    const totalInterest = monthData.reduce((s, d) => s + (d.interestAmount || 0), 0);
    const totalVat = monthData.reduce((s, d) => s + (d.vat || 0), 0);
    const totalAmount = monthData.reduce((s, d) => s + (d.amount || 0), 0);
    const totalTotal = monthData.reduce((s, d) => s + (d.totalAmount || 0), 0);

    const yearParts = selectedYear.split('/');
    const yearNum = parseInt(yearParts[0]);
    const monthIdx = calendarMonths.indexOf(selectedMonth);
    const calMonth = monthIdx >= 0 ? monthIdx + 1 : 1;
    const dateYear = calMonth >= 7 ? yearNum : yearNum + 1;
    const monthStart = `01/${String(calMonth).padStart(2, '0')}/${dateYear}`;

    rows.push({
      transactionDate: monthStart,
      description: 'Open Balance',
      receiptId: '',
      documentNumber: '',
      tariff: '',
      amount: totalOpening,
      interest: totalInterest,
      vat: totalVat,
      total: totalOpening + totalInterest + totalVat,
      isSpecial: true,
    });

    const monthReceipts = receiptData.filter(r => {
      if (!r.receiptDate) return false;
      const rd = new Date(r.receiptDate);
      return rd.getMonth() === monthIdx && ((calMonth >= 7 && rd.getFullYear() === yearNum) || (calMonth < 7 && rd.getFullYear() === yearNum + 1));
    });

    monthReceipts.forEach(r => {
      rows.push({
        transactionDate: r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-ZA') : '',
        description: 'Payment',
        receiptId: r.receiptNo || '',
        documentNumber: r.receiptId ? `98/${r.receiptId}` : '',
        tariff: '',
        amount: -(r.amount || 0),
        interest: 0,
        vat: r.vat ? -(r.vat || 0) : 0,
        total: -(r.amount || 0),
        isPayment: true,
      });
    });

    const closingAmount = totalAmount;
    const closingTotal = totalTotal;
    const latestDate = monthReceipts.length > 0
      ? new Date(Math.max(...monthReceipts.map(r => new Date(r.receiptDate).getTime()))).toLocaleDateString('en-ZA')
      : monthStart;

    rows.push({
      transactionDate: latestDate,
      description: 'Closing Balance',
      receiptId: '',
      documentNumber: '',
      tariff: '',
      amount: closingAmount,
      interest: totalInterest,
      vat: totalVat,
      total: closingTotal,
      isSpecial: true,
      isBold: true,
    });

    return rows;
  }, [balanceData, receiptData, selectedMonth, selectedYear]);

  const fmt = (v: any) => {
    if (v === undefined || v === null || v === '') return '';
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return String(v);
    if (num < 0) return `(${Math.abs(num).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})`;
    return num.toLocaleString('en-ZA', { minimumFractionDigits: 2 });
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="p-4 space-y-4" data-testid="detailed-transaction-panel">
      <h3 className="text-base font-bold text-slate-800">Detailed Transaction List per Billing Period</h3>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={showCreditMeterOnly} onChange={e => setShowCreditMeterOnly(e.target.checked)} className="rounded" data-testid="checkbox-credit-meter" />
          Show Credit Meter Consumption Journal only
        </label>
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white" data-testid="select-detail-year">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
          {years.length === 0 && <option value="">No data</option>}
        </select>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white" data-testid="select-detail-month">
          {monthsAvailable.map(m => <option key={m} value={m}>{m}</option>)}
          {monthsAvailable.length === 0 && <option value="">No data</option>}
        </select>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-xs" data-testid="detailed-transactions-table">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Transaction Date</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Transaction Description</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Receipt ID/ Doc Transaction ID</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Document Number</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Tariff</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Amount</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Interest</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">VAT</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {detailedRows.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-slate-400 py-4">No records to display</td></tr>
            ) : detailedRows.map((row: any, i: number) => (
              <tr
                key={i}
                className={`border-b border-slate-100 ${row.isBold ? 'bg-slate-50 font-bold' : ''} ${!row.isSpecial && !row.isPayment ? '' : ''} ${row.isPayment ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                onClick={() => row.isPayment && setSelectedTxn(row)}
                data-testid={`detail-row-${i}`}
              >
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.transactionDate}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${row.isBold ? 'font-bold text-slate-900' : row.isSpecial ? 'text-slate-600 italic' : 'text-slate-700'}`}>{row.description}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.receiptId || ''}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.documentNumber || ''}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.tariff || ''}</td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${(row.amount || 0) < 0 ? 'text-red-600' : ''}`}>{fmt(row.amount)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{fmt(row.interest)}</td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${(row.vat || 0) < 0 ? 'text-red-600' : ''}`}>{fmt(row.vat)}</td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${row.isBold ? 'font-bold' : ''} ${(row.total || 0) < 0 ? 'text-red-600' : ''}`}>{fmt(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
        <span>Items per page: <span className="border rounded px-2 py-0.5">50</span></span>
        <span>{detailedRows.length === 0 ? '0 of 0' : `1 - ${detailedRows.length} of ${detailedRows.length}`}</span>
      </div>

      {selectedTxn && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTxn(null)} data-testid="txn-detail-overlay">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h4 className="text-sm font-bold text-slate-700">Detailed Transaction List per Billing Period</h4>
              <button onClick={() => setSelectedTxn(null)} className="text-slate-400 hover:text-slate-700 text-lg" data-testid="button-close-detail">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-teal-600 text-white">
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 text-right font-semibold">VAT</th>
                      <th className="px-3 py-2 text-right font-semibold">Interest</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-2">{selectedTxn.description || ''}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(selectedTxn.amount)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(selectedTxn.vat ?? 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(selectedTxn.interest ?? 0)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(selectedTxn.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-center pt-2">
                <button onClick={() => setSelectedTxn(null)} className="px-6 py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-700 transition-colors" data-testid="button-close-detail-bottom">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionHistoryTab({ accountId, accountNumber }: { accountId: number; accountNumber: string }) {
  const [data, setData] = useState<any[]>([]);
  const [billingPeriodTxns, setBillingPeriodTxns] = useState<any[]>([]);
  const [detailedTxns, setDetailedTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState('receipts');
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [receiptResult, billingResult, detailedResult] = await Promise.all([
        getTransactionHistory(accountNumber, accountId).catch(() => []),
        getAllBillingPeriodTransactions(accountId, getFinYearOptions()[0]).catch(() => []),
        getDetailedTransactionResults(accountId, getFinYearOptions()[0]).catch(() => []),
      ]);
      setData(receiptResult);
      setBillingPeriodTxns(billingResult);
      setDetailedTxns(detailedResult);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  }, [accountId, accountNumber]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {[
          { key: 'receipts', label: 'Receipt History', count: data.length },
          { key: 'billing', label: 'Billing Period', count: billingPeriodTxns.length },
          { key: 'detailed', label: 'Detailed Transactions', count: detailedTxns.length },
        ].map(sub => (
          <button
            key={sub.key}
            onClick={() => setActiveSubTab(sub.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeSubTab === sub.key ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
            data-testid={`button-subtab-${sub.key}`}
          >
            {sub.label} ({sub.count})
          </button>
        ))}
      </div>

      {activeSubTab === 'receipts' && (
        data.length === 0 ? <EmptyState message="No receipt history found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-transaction-history">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Receipt No.</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Payment Type</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Card/Cheque Detail</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Cashier</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Cash Book</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...data].sort((a, b) => {
                  const da = a.receiptDate ? new Date(a.receiptDate).getTime() : 0;
                  const db = b.receiptDate ? new Date(b.receiptDate).getTime() : 0;
                  return db - da;
                }).map((item: any, i: number) => (
                  <tr key={item.receiptId || i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono text-blue-700 font-medium whitespace-nowrap">{item.receiptNo || '-'}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{item.receiptDate ? new Date(item.receiptDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-2 px-3">{item.paymentType || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(item.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{item.cardChequeDetail || '-'}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{item.cashierName || '-'}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{item.cashBook || '-'}</td>
                    <td className="py-2 px-3">
                      {item.isCancelled ? (
                        <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeSubTab === 'billing' && (
        billingPeriodTxns.length === 0 ? <EmptyState message="No billing period transactions found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-billing-period-transactions">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Period</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Debit</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Credit</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {billingPeriodTxns.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-600">{item.period || item.billingPeriod || '-'}</td>
                    <td className="py-2 px-3">{item.description || item.transactionDescription || '-'}</td>
                    <td className="py-2 px-3">{item.serviceType || item.serviceDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono">{(item.debit ?? item.debitAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{(item.credit ?? item.creditAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(item.balance ?? item.runningBalance ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeSubTab === 'detailed' && (
        detailedTxns.length === 0 ? <EmptyState message="No detailed transactions found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-detailed-transactions">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Type</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {detailedTxns.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-600">{item.transactionDate ? new Date(item.transactionDate).toLocaleDateString('en-ZA') : item.date || '-'}</td>
                    <td className="py-2 px-3">{item.transactionType || item.type || '-'}</td>
                    <td className="py-2 px-3">{item.description || item.transactionDescription || '-'}</td>
                    <td className="py-2 px-3">{item.serviceType || item.serviceDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(item.amount ?? item.transactionAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{item.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function ServicesMetersTab({ accountId, unitId }: { accountId: number; unitId?: number }) {
  const [allServices, setAllServices] = useState<any[]>([]);
  const [meteredServices, setMeteredServices] = useState<any[]>([]);
  const [meterPerProperty, setMeterPerProperty] = useState<any[]>([]);
  const [unitLinkedMeters, setUnitLinkedMeters] = useState<any[]>([]);
  const [prepaidMeters, setPrepaidMeters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [svc, metered, mpp, ulm, prepaid] = await Promise.all([
        getAllServices(accountId).catch(() => []),
        getMeteredServicesOnAccount(accountId).catch(() => []),
        getAccountServiceMeterPerProperty(accountId).catch(() => []),
        unitId ? getUnitLinkedMeters(unitId).catch(() => []) : Promise.resolve([]),
        getPrepaidMeterServicesForAccount(accountId).catch(() => []),
      ]);
      setAllServices(svc);
      setMeteredServices(metered);
      setMeterPerProperty(mpp);
      setUnitLinkedMeters(ulm);
      setPrepaidMeters(prepaid);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load services & meters');
    } finally {
      setLoading(false);
    }
  }, [accountId, unitId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const hasData = allServices.length || meteredServices.length || meterPerProperty.length || unitLinkedMeters.length || prepaidMeters.length;
  if (!hasData) return <EmptyState message="No services or meter data available" />;

  return (
    <div className="p-4 space-y-4">
      {allServices.length > 0 && (
        <>
          <SectionHeader title="All Services" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-all-services">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service ID</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service Type</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Tariff</th>
                </tr>
              </thead>
              <tbody>
                {allServices.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono text-blue-700">{s.serviceId || s.service_ID || s.serviceID || '-'}</td>
                    <td className="py-2 px-3 font-medium">{s.serviceType || s.serviceTypeDescription || '-'}</td>
                    <td className="py-2 px-3">{s.description || s.serviceDescription || '-'}</td>
                    <td className="py-2 px-3"><Badge variant={s.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">{s.status || s.serviceStatus || '-'}</Badge></td>
                    <td className="py-2 px-3 text-slate-500">{s.tariff || s.tariffCode || s.tariffDescription || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {meteredServices.length > 0 && (
        <>
          <SectionHeader title="Metered Services" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-metered-services">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Meter Number</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Meter Type</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Last Reading</th>
                </tr>
              </thead>
              <tbody>
                {meteredServices.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono font-medium text-slate-700">{m.meterNumber || m.physicalMeterNumber || '-'}</td>
                    <td className="py-2 px-3">{m.serviceType || m.serviceDescription || '-'}</td>
                    <td className="py-2 px-3">{m.meterType || m.meterTypeDescription || '-'}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{m.status || m.meterStatus || '-'}</Badge></td>
                    <td className="py-2 px-3 text-right font-mono">{m.lastReading ?? m.currentReading ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {meterPerProperty.length > 0 && (
        <>
          <SectionHeader title="Meters Per Property" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-meter-per-property">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Property</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Meter</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {meterPerProperty.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3">{m.propertyDescription || m.propertyId || '-'}</td>
                    <td className="py-2 px-3">{m.serviceType || m.serviceDescription || '-'}</td>
                    <td className="py-2 px-3 font-mono">{m.meterNumber || m.physicalMeterNumber || '-'}</td>
                    <td className="py-2 px-3">{m.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {unitLinkedMeters.length > 0 && (
        <>
          <SectionHeader title="Unit Linked Meters" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-unit-linked-meters">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Meter Number</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Type</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {unitLinkedMeters.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono">{m.meterNumber || m.physicalMeterNumber || '-'}</td>
                    <td className="py-2 px-3">{m.serviceType || m.serviceDescription || '-'}</td>
                    <td className="py-2 px-3">{m.meterType || '-'}</td>
                    <td className="py-2 px-3">{m.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {prepaidMeters.length > 0 && (
        <>
          <SectionHeader title="Prepaid Meter Services" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-prepaid-meters">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Meter Number</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Last Recharge</th>
                </tr>
              </thead>
              <tbody>
                {prepaidMeters.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono font-medium">{m.meterNumber || m.physicalMeterNumber || '-'}</td>
                    <td className="py-2 px-3">{m.serviceType || m.serviceDescription || '-'}</td>
                    <td className="py-2 px-3">{m.status || m.meterStatus || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono">{m.lastRechargeDate ? new Date(m.lastRechargeDate).toLocaleDateString('en-ZA') : (m.lastRechargeAmount ?? '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function PaymentPlansTab({ accountId }: { accountId: number }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [remainingCapital, setRemainingCapital] = useState<any>(null);
  const [repaymentStatus, setRepaymentStatus] = useState<any>(null);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [paymentAmounts, setPaymentAmounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pl, rc, rs, ext, pa] = await Promise.all([
        getPaymentPlansByAccountId(accountId).catch(() => []),
        getPaymentPlanRemainingCapital(accountId).catch(() => null),
        getRepaymentPlanStatus(accountId).catch(() => null),
        getPaymentExtensionSearchResults(accountId).catch(() => []),
        getPaymentAmountByAccountIds(accountId).catch(() => []),
      ]);
      setPlans(pl);
      setRemainingCapital(rc);
      setRepaymentStatus(rs);
      setExtensions(ext);
      setPaymentAmounts(pa);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load payment plans');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const hasData = plans.length || remainingCapital || repaymentStatus || extensions.length || paymentAmounts.length;
  if (!hasData) return <EmptyState message="No payment plan data available" />;

  return (
    <div className="p-4 space-y-4">
      {(remainingCapital || repaymentStatus) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {remainingCapital && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-600">Remaining Capital</CardTitle></CardHeader>
              <CardContent className="space-y-0">
                {typeof remainingCapital === 'object' ? (
                  Object.entries(remainingCapital).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
                    <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
                  ))
                ) : (
                  <FieldRow label="Remaining Capital" value={remainingCapital} />
                )}
              </CardContent>
            </Card>
          )}
          {repaymentStatus && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-600">Repayment Plan Status</CardTitle></CardHeader>
              <CardContent className="space-y-0">
                {typeof repaymentStatus === 'object' ? (
                  Object.entries(repaymentStatus).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
                    <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
                  ))
                ) : (
                  <FieldRow label="Status" value={repaymentStatus} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {plans.length > 0 && (
        <>
          <SectionHeader title="Payment Plans" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-payment-plans">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Plan ID</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Type</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Start Date</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">End Date</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Instalment</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Total Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono">{p.planId || p.paymentPlanId || p.plan_ID || '-'}</td>
                    <td className="py-2 px-3">{p.planType || p.paymentPlanType || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{p.startDate ? new Date(p.startDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{p.endDate ? new Date(p.endDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-2 px-3 text-right font-mono">{(p.instalmentAmount ?? p.instalment ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(p.totalAmount ?? p.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3"><Badge variant={p.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">{p.status || p.planStatus || '-'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {extensions.length > 0 && (
        <>
          <SectionHeader title="Payment Extensions" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-payment-extensions">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Extension Type</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {extensions.map((ext: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3">{ext.extensionDate ? new Date(ext.extensionDate).toLocaleDateString('en-ZA') : ext.date || '-'}</td>
                    <td className="py-2 px-3">{ext.extensionType || ext.type || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono">{(ext.amount ?? ext.extensionAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3">{ext.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {paymentAmounts.length > 0 && (
        <>
          <SectionHeader title="Payment Amounts" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-payment-amounts">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {paymentAmounts.map((pa: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3">{pa.description || pa.paymentDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(pa.amount ?? pa.paymentAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-slate-500">{pa.paymentDate ? new Date(pa.paymentDate).toLocaleDateString('en-ZA') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function PaymentExtensionHistoryTab({ accountId }: { accountId: number }) {
  const [extensions, setExtensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevAccountId = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPaymentExtensionSearchResults(accountId);
      setExtensions(Array.isArray(result) ? result : result ? [result] : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load payment extension history');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (prevAccountId.current !== accountId) {
      prevAccountId.current = accountId;
      load();
    }
  }, [accountId, load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const formatDate = (v: any) => {
    if (!v) return '';
    try { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-ZA'); } catch { return String(v); }
  };

  return (
    <div className="p-4 space-y-4" data-testid="payment-extension-history-panel">
      <h3 className="text-base font-bold text-slate-800">Payment Extension History</h3>
      <PaginatedTable
        data={extensions}
        tableId="payment-extension-history"
        columns={[
          { key: 'extensionStatus', label: 'Extension Status', render: (r: any) => r.extensionStatus || r.status || r.statusDesc || '' },
          { key: 'extensionDescription', label: 'Extension Description', render: (r: any) => r.extensionDescription || r.description || r.extensionType || r.type || '' },
          { key: 'commencementDate', label: 'Commencement Date', render: (r: any) => formatDate(r.commencementDate || r.startDate) },
          { key: 'terminationDate', label: 'Termination Date', render: (r: any) => formatDate(r.terminationDate || r.endDate) },
          { key: 'capturedBy', label: 'Captured By', render: (r: any) => r.capturedBy || r.capturerName || r.capturer || '' },
          { key: 'captureDate', label: 'Capture Date', render: (r: any) => formatDate(r.captureDate || r.dateCaptured) },
        ]}
      />
    </div>
  );
}

function DebitOrdersTab({ accountId }: { accountId: number }) {
  const [deductions, setDeductions] = useState<any[]>([]);
  const [debitOrders, setDebitOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ded, dob] = await Promise.all([
        getDebitOrderDeductionByAccount(accountId).catch(() => []),
        getDebitOrderDeduction(accountId).catch(() => []),
      ]);
      setDeductions(ded);
      setDebitOrders(dob);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load debit order data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!deductions.length && !debitOrders.length) return <EmptyState message="No debit order data available" />;

  return (
    <div className="p-4 space-y-4">
      {deductions.length > 0 && (
        <>
          <SectionHeader title="Debit Order Deductions" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-debit-order-deductions">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Bank</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Account</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((d: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3">{d.deductionDate ? new Date(d.deductionDate).toLocaleDateString('en-ZA') : d.date || '-'}</td>
                    <td className="py-2 px-3">{d.bankName || d.bank || '-'}</td>
                    <td className="py-2 px-3 font-mono text-xs">{d.bankAccountNumber || d.accountNumber || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(d.amount ?? d.deductionAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3"><Badge variant={d.status === 'Successful' ? 'default' : 'secondary'} className="text-[10px]">{d.status || d.deductionStatus || '-'}</Badge></td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{d.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {debitOrders.length > 0 && (
        <>
          <SectionHeader title="Debit Orders" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-debit-orders">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Bank</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Branch</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Account Holder</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Account Type</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Day of Deduction</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {debitOrders.map((d: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3">{d.bankName || d.bank || '-'}</td>
                    <td className="py-2 px-3">{d.branchCode || d.branch || '-'}</td>
                    <td className="py-2 px-3 font-medium">{d.accountHolderName || d.accountHolder || '-'}</td>
                    <td className="py-2 px-3">{d.accountType || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(d.amount ?? d.debitOrderAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3">{d.deductionDay || d.dayOfDeduction || '-'}</td>
                    <td className="py-2 px-3"><Badge variant={d.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">{d.status || '-'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function RatesValuationsTab({ accountId, propertyId }: { accountId: number; propertyId?: number }) {
  const [ratesDetails, setRatesDetails] = useState<any[]>([]);
  const [ratesHistory, setRatesHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rd, rh] = await Promise.all([
        getAccountRatesDetails(accountId).catch(() => []),
        getRatesRunHistory(accountId).catch(() => []),
      ]);
      setRatesDetails(rd);
      setRatesHistory(rh);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load rates & valuations');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!ratesDetails.length && !ratesHistory.length) return <EmptyState message="No rates & valuations data available" />;

  return (
    <div className="p-4 space-y-4">
      {ratesDetails.length > 0 && (
        <>
          <SectionHeader title="Account Rates Details" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-rates-details">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Category</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Market Value</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Rateable Value</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Rate</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                {ratesDetails.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-medium">{r.category || r.rateCategory || '-'}</td>
                    <td className="py-2 px-3">{r.description || r.rateDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono">{(r.marketValue ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{(r.rateableValue ?? r.ratableValue ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{r.rateInRand ?? r.rate ?? '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(r.monthlyAmount ?? r.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {ratesHistory.length > 0 && (
        <>
          <SectionHeader title="Rates Run History" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-rates-run-history">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Run Date</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Period</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {ratesHistory.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-600">{r.runDate ? new Date(r.runDate).toLocaleDateString('en-ZA') : r.date || '-'}</td>
                    <td className="py-2 px-3">{r.period || r.billingPeriod || '-'}</td>
                    <td className="py-2 px-3">{r.description || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(r.amount ?? r.ratesAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{r.status || '-'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationsTab({ accountId }: { accountId: number }) {
  const [accountNotifs, setAccountNotifs] = useState<any[]>([]);
  const [propertyNotif, setPropertyNotif] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [an, pn] = await Promise.all([
        getAccountNotifications(accountId).catch(() => []),
        getPropertyNotification(accountId).catch(() => null),
      ]);
      setAccountNotifs(an);
      setPropertyNotif(pn);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!accountNotifs.length && !propertyNotif) return <EmptyState message="No notifications available" />;

  return (
    <div className="p-4 space-y-4">
      {propertyNotif && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-600">Property Notification</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            {typeof propertyNotif === 'object' ? (
              Object.entries(propertyNotif).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
                <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
              ))
            ) : (
              <FieldRow label="Notification" value={propertyNotif} />
            )}
          </CardContent>
        </Card>
      )}

      {accountNotifs.length > 0 && (
        <>
          <SectionHeader title="Account Notifications" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-account-notifications">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Type</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Message</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Created By</th>
                </tr>
              </thead>
              <tbody>
                {accountNotifs.map((n: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-600">{n.notificationDate ? new Date(n.notificationDate).toLocaleDateString('en-ZA') : n.date || n.createdDate || '-'}</td>
                    <td className="py-2 px-3 font-medium">{n.notificationType || n.type || '-'}</td>
                    <td className="py-2 px-3 max-w-[300px] truncate">{n.message || n.notificationMessage || n.description || '-'}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{n.status || n.notificationStatus || '-'}</Badge></td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{n.createdBy || n.user || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatementsTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getGeneratedStatements(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data.length) return <EmptyState message="No generated statements available" />;

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid="table-statements">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Statement Date</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Period</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Type</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 text-slate-600">{s.statementDate ? new Date(s.statementDate).toLocaleDateString('en-ZA') : s.date || s.generatedDate || '-'}</td>
              <td className="py-2 px-3">{s.period || s.billingPeriod || '-'}</td>
              <td className="py-2 px-3">{s.description || s.statementDescription || '-'}</td>
              <td className="py-2 px-3 text-right font-mono font-semibold">{(s.amount ?? s.totalAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{s.status || '-'}</Badge></td>
              <td className="py-2 px-3 text-slate-500">{s.statementType || s.type || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClearanceTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getClearanceInquiries(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load clearance data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data.length) return <EmptyState message="No clearance inquiries available" />;

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid="table-clearance">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Type</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Reference</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 text-slate-600">{c.clearanceDate ? new Date(c.clearanceDate).toLocaleDateString('en-ZA') : c.date || c.applicationDate || '-'}</td>
              <td className="py-2 px-3 font-medium">{c.clearanceType || c.type || '-'}</td>
              <td className="py-2 px-3">{c.description || c.clearanceDescription || '-'}</td>
              <td className="py-2 px-3 text-right font-mono font-semibold">{(c.amount ?? c.clearanceAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3"><Badge variant={c.status === 'Approved' ? 'default' : 'secondary'} className="text-[10px]">{c.status || c.clearanceStatus || '-'}</Badge></td>
              <td className="py-2 px-3 text-slate-500 text-xs">{c.reference || c.clearanceReference || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DebtorNotesTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDebtorNoteLists(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load debtor notes');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data.length) return <EmptyState message="No debtor notes available" />;

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid="table-debtor-notes">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Note Type</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Created By</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((n: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 text-slate-600">{n.noteDate ? new Date(n.noteDate).toLocaleDateString('en-ZA') : n.date || n.createdDate || '-'}</td>
              <td className="py-2 px-3 font-medium">{n.noteType || n.type || '-'}</td>
              <td className="py-2 px-3 max-w-[300px] truncate">{n.description || n.noteDescription || n.notes || '-'}</td>
              <td className="py-2 px-3 text-slate-500 text-xs">{n.createdBy || n.user || '-'}</td>
              <td className="py-2 px-3 text-right font-mono">{n.amount != null ? (n.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '-'}</td>
              <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{n.status || '-'}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section129Tab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSection129AccountEnquiry(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load Section 129 data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState message="No Section 129 data available" />;

  const items = Array.isArray(data) ? data : [data];
  return (
    <div className="p-4 space-y-4">
      {items.map((item: any, i: number) => (
        <Card key={i}>
          <CardContent className="pt-4 space-y-0">
            {Object.entries(item).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
              <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OccupiersTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOccupiers(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load occupiers data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data.length) return <EmptyState message="No occupiers data available" />;

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid="table-occupiers">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Name</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">ID Number</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Contact</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Email</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Move In Date</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((o: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 font-medium">{o.name || o.occupierName || o.surname || '-'}</td>
              <td className="py-2 px-3 font-mono text-xs">{o.idNumber || o.idRegistrationNumber || '-'}</td>
              <td className="py-2 px-3">{o.contactNumber || o.tel_Mobile || o.phone || '-'}</td>
              <td className="py-2 px-3 text-slate-500">{o.email || o.emailAddress || '-'}</td>
              <td className="py-2 px-3">{o.moveInDate ? new Date(o.moveInDate).toLocaleDateString('en-ZA') : o.startDate || '-'}</td>
              <td className="py-2 px-3"><Badge variant={o.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">{o.status || o.occupierStatus || '-'}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SEARCH_FIELDS = [
  { key: 'accountNo', label: 'Account Number', placeholder: 'e.g. 000000003698', icon: Hash, smart: true },
  { key: 'oldAccountCode', label: 'Old Account Code', placeholder: 'Legacy code', icon: FileText, smart: false },
  { key: 'name', label: 'Name / Company', placeholder: 'Search by name', icon: User, smart: true },
  { key: 'idNo', label: 'ID / Registration No.', placeholder: '13 digit ID number', icon: CreditCard, smart: true },
  { key: 'emailAddress', label: 'Email Address', placeholder: 'user@example.com', icon: Mail, smart: true },
  { key: 'physicalMeterNumber', label: 'Meter Number', placeholder: 'Physical meter number', icon: Zap, smart: false },
  { key: 'locationAddress', label: 'Location / Erf Address', placeholder: 'Street, location or erf', icon: MapPin, smart: false },
  { key: 'mobileNumber', label: 'Mobile Number', placeholder: '0821234567', icon: Phone, smart: false },
  { key: 'passportNumber', label: 'Passport Number', placeholder: 'Passport number', icon: CreditCard, smart: false },
  { key: 'sgNumber', label: 'SG Number', placeholder: 'e.g. C027/0002/00013110/00000', icon: Home, smart: false },
  { key: 'erfNumber', label: 'ERF Number', placeholder: 'e.g. 13110', icon: Landmark, smart: false },
] as const;

function detectSearchType(query: string): { field: string; label: string; unsupported?: boolean } {
  const trimmed = query.trim();
  if (/^0\d{9}$/.test(trimmed)) return { field: 'mobileNumber', label: 'Mobile Number' };
  if (/^\d{13}$/.test(trimmed)) return { field: 'idNo', label: 'ID Number' };
  if (/^\d{6,15}$/.test(trimmed)) return { field: 'accountNo', label: 'Account Number' };
  if (/^\d{1,5}$/.test(trimmed)) return { field: 'accountNo', label: 'Account Number' };
  if (/@/.test(trimmed) || /\.(com|co\.za|org|net|gov|ac\.za)$/i.test(trimmed) || /^(gmail|yahoo|outlook|hotmail|webmail|mail)/i.test(trimmed)) {
    return { field: 'emailAddress', label: 'Email Address' };
  }
  return { field: 'name', label: 'Name / Company' };
}

function SmartSearchDropdown({
  results, loading, query, highlightIdx, onSelect, visible
}: {
  results: EnquirySearchResult[];
  loading: boolean;
  query: string;
  highlightIdx: number;
  onSelect: (a: EnquirySearchResult) => void;
  visible: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current && highlightIdx >= 0) {
      const el = listRef.current.children[highlightIdx] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  if (!visible) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-[420px] overflow-hidden flex flex-col"
      data-testid="smart-search-dropdown"
    >
      {loading && (
        <div className="flex items-center gap-3 px-4 py-3 text-sm text-slate-500 border-b border-slate-100">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          Searching accounts...
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="flex flex-col items-center py-8 text-slate-400">
          <Search className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm font-medium">No accounts found</p>
          <p className="text-xs mt-1">Try a different search term or use advanced filters</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {results.length} account{results.length !== 1 ? 's' : ''} found
            </span>
            <span className="text-[10px] text-slate-400">
              Use <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[9px] font-mono">↑↓</kbd> to navigate, <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[9px] font-mono">Enter</kbd> to select
            </span>
          </div>
          <div ref={listRef} className="overflow-y-auto flex-1">
            {results.slice(0, 50).map((account, i) => {
              const bal = account.outStandingAmount ?? account.outStandingAmt ?? 0;
              const acctNum = account.accountNumber || account.accountID || account.account_ID;
              const isActive = (account.accountStatus || account.statusDesc)?.toLowerCase() === 'active';
              const idNo = account.addName || account.idRegistrationNumber || '';
              const addr = (account.address || account.deliveryAddress || '').replace(/\r\n/g, ', ');
              return (
                <div
                  key={account.accountID || account.account_ID || i}
                  onClick={() => onSelect(account)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-b border-slate-100 last:border-0
                    ${highlightIdx === i ? 'bg-blue-50 border-l-3 border-l-blue-500' : 'hover:bg-slate-50 border-l-3 border-l-transparent'}`}
                  data-testid={`dropdown-account-${account.accountID || account.account_ID || i}`}
                >
                  <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm
                    ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {(account.name || account.surname_Company || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">{account.name || account.surname_Company || 'Unknown'}</span>
                      <Badge
                        variant={isActive ? 'default' : 'secondary'}
                        className="text-[9px] shrink-0 h-4 px-1.5"
                      >
                        {account.accountStatus || account.statusDesc || '?'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-blue-600 font-medium">{acctNum}</span>
                      {idNo && <span className="text-[10px] text-slate-400">|</span>}
                      {idNo && <span className="text-[10px] text-slate-500 font-mono">ID: {idNo}</span>}
                      {addr && <span className="text-[10px] text-slate-400 truncate max-w-[250px]">{addr}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right min-w-[100px]">
                    <div className={`text-base font-mono font-bold ${bal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      R {bal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400">{account.accountType || account.accountDesc || 'Owner / Occupier'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ExpandableResultRow({ account, onSelect, isExpanded, onToggleExpand }: {
  account: EnquirySearchResult;
  onSelect: (account: EnquirySearchResult) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const [enrichedData, setEnrichedData] = useState<{ basicDetails: any; propertyDetails: any; services: any[]; sectionalTitle: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const accountId = account.account_ID || account.accountID;
  const aid = account.accountID || account.account_ID || 0;
  const status = account.accountStatus || account.statusDesc || '-';
  const outstanding = account.outStandingAmount ?? account.outStandingAmt ?? 0;
  const acctType = account.accountType || account.accountDesc || 'Owner / Occupier';
  const addr = account.address || account.deliveryAddress || account.locationAddress || '-';

  const loadEnrichedData = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    Promise.allSettled([
      getBasicAccountDetails(accountId),
      getPropertyDetails(accountId),
      getAllServices(accountId),
      getSectionalTitleScheme(accountId),
    ]).then(([bdResult, pdResult, svcResult, stResult]) => {
      const allFailed = [bdResult, pdResult, svcResult].every(r => r.status === 'rejected');
      if (allFailed) {
        setFetchError(true);
      } else {
        setEnrichedData({
          basicDetails: bdResult.status === 'fulfilled' ? bdResult.value : null,
          propertyDetails: pdResult.status === 'fulfilled' ? (Array.isArray(pdResult.value) ? pdResult.value[0] : pdResult.value) : null,
          services: svcResult.status === 'fulfilled' ? (Array.isArray(svcResult.value) ? svcResult.value : []) : [],
          sectionalTitle: stResult.status === 'fulfilled' ? stResult.value : null,
        });
      }
      setLoaded(true);
      setLoading(false);
    });
  }, [accountId]);

  useEffect(() => {
    if (isExpanded && !loaded && !loading) {
      loadEnrichedData();
    }
  }, [isExpanded, loaded, loading, loadEnrichedData]);

  const bd = enrichedData?.basicDetails || {};
  const pd = enrichedData?.propertyDetails || {};
  const services = enrichedData?.services || [];
  const st = enrichedData?.sectionalTitle;
  const activeServices = services.filter((s: any) => (s.statusDesc || s.status || '').toLowerCase().trim() === 'active');

  return (
    <>
      <tr
        className={`border-b border-slate-100 transition-colors duration-150 cursor-pointer ${isExpanded ? 'bg-blue-50/80' : 'hover:bg-blue-50/60'}`}
        data-testid={`expandable-row-${aid}`}
      >
        <td className="px-1 py-2.5 text-center w-8">
          <button
            onClick={onToggleExpand}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-blue-100 transition-colors mx-auto"
            data-testid={`btn-expand-${aid}`}
          >
            <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        </td>
        <td className="px-2 py-2.5 whitespace-nowrap">
          <button
            onClick={() => onSelect(account)}
            className="font-mono text-blue-700 font-semibold hover:text-blue-900 hover:underline text-[13px]"
            data-testid={`btn-account-${aid}`}
          >
            {account.accountNumber || aid}
          </button>
        </td>
        <td className="px-2 py-2.5 text-slate-400 font-mono whitespace-nowrap" data-testid={`text-partition-${aid}`}>
          P:{account.unitPartitionID || '-'}
        </td>
        <td className="px-2 py-2.5 text-slate-500 font-mono whitespace-nowrap">
          {account.oldAccountCode || '-'}
        </td>
        <td className="px-2 py-2.5" data-testid={`text-name-${aid}`}>
          <span className="font-medium text-slate-800 text-[13px] whitespace-nowrap">{account.name || account.surname_Company || '-'}</span>
        </td>
        <td className="px-2 py-2.5 text-center whitespace-nowrap">
          <Badge
            variant={status.toLowerCase() === 'active' ? 'default' : 'secondary'}
            className="text-[10px]"
            data-testid={`badge-status-${aid}`}
          >
            {status}
          </Badge>
        </td>
        <td className="px-2 py-2.5 text-center whitespace-nowrap">
          <Badge variant="outline" className="text-[10px] font-normal" data-testid={`badge-type-${aid}`}>
            {acctType}
          </Badge>
        </td>
        <td className="px-2 py-2.5 text-right whitespace-nowrap" data-testid={`text-outstanding-${aid}`}>
          <span className={`font-mono text-[13px] font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
            R {outstanding.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </span>
        </td>
        <td className="px-2 py-2.5 text-slate-500 whitespace-nowrap" data-testid={`text-address-${aid}`}>
          <span className="truncate block max-w-[180px]">{addr.replace(/\r\n/g, ', ')}</span>
        </td>
        <td className="px-2 py-2.5 text-slate-400 font-mono whitespace-nowrap">
          <span className="truncate block max-w-[180px]">{account.sgNumber || '-'}</span>
        </td>
        <td className="px-2 py-2.5 text-slate-400 whitespace-nowrap">
          U:{account.unitID || '-'}
        </td>
        <td className="px-2 py-2.5 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect(account)}
            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            data-testid={`btn-open-${aid}`}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Open
          </Button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={12} className="p-0">
            <div className="bg-gradient-to-b from-blue-50/50 to-white border-b border-slate-200 border-l-2 border-l-blue-500 px-4 py-4">
          {loading && (
            <div className="flex items-center gap-3 py-8 justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading enriched details...</span>
            </div>
          )}

          {loaded && fetchError && (
            <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="text-sm">Could not load enriched details</span>
              <button onClick={() => { setLoaded(false); setFetchError(false); loadEnrichedData(); }} className="text-xs text-blue-600 hover:text-blue-800 underline" data-testid={`button-retry-enrich-${aid}`}>Retry</button>
            </div>
          )}

          {loaded && !fetchError && enrichedData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm overflow-hidden" data-testid={`panel-account-details-${aid}`}>
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 flex items-center gap-2">
                  <User className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Account Details</span>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div><span className="text-slate-400">Account No:</span> <span className="font-medium text-slate-800">{account.accountNumber || '-'}</span></div>
                    <div><span className="text-slate-400">Old Code:</span> <span className="font-medium text-slate-800">{account.oldAccountCode || '-'}</span></div>
                    <div><span className="text-slate-400">Status:</span> <Badge variant={status.toLowerCase() === 'active' ? 'default' : 'secondary'} className="text-[9px] ml-1">{status}</Badge></div>
                    <div><span className="text-slate-400">Type:</span> <span className="font-medium text-slate-800">{acctType}</span></div>
                    <div className="col-span-2"><span className="text-slate-400">Name:</span> <span className="font-medium text-slate-800">{account.name || account.surname_Company || '-'}</span></div>
                    <div><span className="text-slate-400">Initials:</span> <span className="font-medium text-slate-800">{account.initials || bd.initials || '-'}</span></div>
                    <div><span className="text-slate-400">ID Number:</span> <span className="font-mono font-medium text-slate-800">{account.addName || account.idRegistrationNumber || bd.idRegistrationNumber || '-'}</span></div>
                    <div><span className="text-slate-400">Credit Status:</span> <span className="font-medium text-slate-800">{bd.creditStatusDesc || bd.creditStatus || bd.creditRating || '-'}</span></div>
                    <div><span className="text-slate-400">Solvency:</span> <span className="font-medium text-slate-800">{bd.solvencyDesc || bd.solvency || bd.solvencyStatus || '-'}</span></div>
                    <div><span className="text-slate-400">Institution:</span> <span className="font-medium text-slate-800">{bd.institutionDesc || bd.institution || bd.institutionName || '-'}</span></div>
                    <div><span className="text-slate-400">Group Code:</span> <span className="font-medium text-slate-800">{bd.groupCodeDesc || bd.groupCode || bd.accountGroup || '-'}</span></div>
                    <div><span className="text-slate-400">Payment Group:</span> <span className="font-medium text-slate-800">{bd.paymentGroupDesc || bd.paymentGroup || bd.paymentGroupDescription || '-'}</span></div>
                    <div><span className="text-slate-400">Postal Code:</span> <span className="font-medium text-slate-800">{bd.postalCode || '-'}</span></div>
                    <div><span className="text-slate-400">Email:</span> <span className="font-medium text-slate-800 truncate">{bd.emailId || bd.email || bd.emailAddress || '-'}</span></div>
                    <div><span className="text-slate-400">Contact:</span> <span className="font-medium text-slate-800">{bd.contactNo || bd.contactNumber || bd.tel_Mobile || '-'}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm overflow-hidden" data-testid={`panel-property-${aid}`}>
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 flex items-center gap-2">
                  <Home className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Property Information</span>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="col-span-2"><span className="text-slate-400">SG Number:</span> <span className="font-mono font-medium text-slate-800">{account.sgNumber || pd.sgNumber || pd.sg_Number || '-'}</span></div>
                    <div className="col-span-2"><span className="text-slate-400">Address:</span> <span className="font-medium text-slate-800">{[pd.streetNumber, pd.streetName].filter(Boolean).join(' ') || addr.replace(/\r\n/g, ', ')}</span></div>
                    <div><span className="text-slate-400">Suburb:</span> <span className="font-medium text-slate-800">{pd.suburb || '-'}</span></div>
                    <div><span className="text-slate-400">Town:</span> <span className="font-medium text-slate-800">{pd.town || '-'}</span></div>
                    <div><span className="text-slate-400">Ward:</span> <span className="font-medium text-slate-800">{pd.ward || pd.wardNumber || '-'}</span></div>
                    <div><span className="text-slate-400">Type of Use:</span> <span className="font-medium text-slate-800">{pd.typeOfUse || pd.propertyTypeOfUse || pd.typeofUse || '-'}</span></div>
                    <div className="col-span-2"><span className="text-slate-400">Town Planning Zone:</span> <span className="font-medium text-slate-800">{pd.townPlanningZoneType || pd.townPlanningZone || '-'}</span></div>
                    <div><span className="text-slate-400">Market Value:</span> <span className="font-medium text-slate-800">{pd.marketValue != null ? `R ${Number(pd.marketValue).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</span></div>
                    <div><span className="text-slate-400">Stand Size:</span> <span className="font-medium text-slate-800">{pd.standSize || pd.extent || pd.extentM2 || '-'}</span></div>
                    <div><span className="text-slate-400">Land Size:</span> <span className="font-medium text-slate-800">{pd.landSize || pd.landExtent || '-'}</span></div>
                    <div><span className="text-slate-400">Roll Number:</span> <span className="font-medium text-slate-800">{pd.rollNumber || pd.valuationRollNumber || '-'}</span></div>
                    <div><span className="text-slate-400">Rates Tariff:</span> <span className="font-medium text-slate-800">{pd.ratesTariff || pd.tariff || '-'}</span></div>
                    <div><span className="text-slate-400">Master Property:</span> <span className="font-medium text-slate-800">{pd.masterProperty != null ? (pd.masterProperty ? 'Yes' : 'No') : '-'}</span></div>
                    {st && (
                      <>
                        <div><span className="text-slate-400">SS Unit No:</span> <span className="font-medium text-slate-800">{st.ssUnitNumber || st.unitNumber || '-'}</span></div>
                        <div className="col-span-2"><span className="text-slate-400">Sectional Title:</span> <span className="font-medium text-slate-800">{st.schemeName || st.sectionalTitleSchemeName || st.name || '-'}</span></div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm overflow-hidden" data-testid={`panel-services-${aid}`}>
                <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-2.5 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Active Services</span>
                  <Badge className="ml-auto bg-white/20 text-white text-[10px] border-0">{activeServices.length} active</Badge>
                </div>
                <div className="p-3 text-xs">
                  {services.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">No services found</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                      {services.map((svc: any, si: number) => {
                        const svcStatus = (svc.statusDesc || svc.status || '-').toLowerCase().trim();
                        const isActive = svcStatus === 'active';
                        return (
                          <div key={si} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isActive ? 'bg-green-50/60 border border-green-100' : 'bg-slate-50 border border-slate-100'}`} data-testid={`service-item-${aid}-${si}`}>
                            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-slate-700">{svc.serviceDesc || svc.serviceDescription || svc.serviceType || `Service ${si + 1}`}</span>
                              {svc.serviceModeDesc && <span className="text-slate-400 ml-1">({svc.serviceModeDesc})</span>}
                              {svc.tariff && <span className="text-slate-400 ml-1 truncate max-w-[100px] inline-block align-bottom">• {String(svc.tariff).substring(0, 30)}</span>}
                            </div>
                            <Badge
                              variant={isActive ? 'default' : 'secondary'}
                              className={`text-[9px] shrink-0 ${isActive ? 'bg-green-600' : ''}`}
                            >
                              {svc.statusDesc || svc.status || '-'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function GeneralEnquiriesContent() {
  const [quickQuery, setQuickQuery] = useState('');
  const [criteria, setCriteria] = useState<EnquirySearchCriteria>({});
  const [dropdownResults, setDropdownResults] = useState<EnquirySearchResult[]>([]);
  const [results, setResults] = useState<EnquirySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownSearching, setDropdownSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EnquirySearchResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<'quick' | 'advanced'>('quick');
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [headerBalance, setHeaderBalance] = useState<number | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const detectedType = useMemo(() => detectSearchType(quickQuery), [quickQuery]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedAccount) { setHeaderBalance(null); return; }
    const id = selectedAccount.account_ID || selectedAccount.accountID;
    if (!id) return;
    setHeaderBalance(null);
    getAccountBalance(id).then((bal: any) => {
      if (Array.isArray(bal)) {
        const total = bal.reduce((sum: number, s: any) => sum + (s.totalOutStanding || 0), 0);
        setHeaderBalance(total);
      } else {
        const total = bal?.totalBalance ?? bal?.totalDue ?? bal?.balance ?? bal?.outstandingBalance ?? null;
        if (total !== null && total !== undefined) setHeaderBalance(Number(total));
      }
    }).catch(() => {});
  }, [selectedAccount]);

  const quickSearchTokenRef = useRef(0);
  const fullSearchTokenRef = useRef(0);
  const balanceCacheRef = useRef<Map<number, number>>(new Map());

  const enrichWithBalances = useCallback(async (accounts: EnquirySearchResult[], tokenRef: React.MutableRefObject<number>, token: number, setter: (val: EnquirySearchResult[]) => void) => {
    const applyCache = (accts: EnquirySearchResult[]) => accts.map(acct => {
      const id = acct.account_ID || acct.accountID;
      const cached = id ? balanceCacheRef.current.get(id) : undefined;
      return cached !== undefined ? { ...acct, outStandingAmount: cached, _balanceEnriched: true } : acct;
    });

    const toFetch = accounts.filter(acct => {
      const id = acct.account_ID || acct.accountID;
      return id && !balanceCacheRef.current.has(id);
    });

    if (toFetch.length === 0) {
      if (tokenRef.current === token) setter(applyCache(accounts));
      return;
    }

    const BATCH = 5;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      if (tokenRef.current !== token) return;
      const batch = toFetch.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (acct) => {
        const id = acct.account_ID || acct.accountID;
        if (!id) return;
        try {
          const balanceData = await getAccountBalance(id);
          if (balanceData) {
            let bal: number | undefined;
            if (Array.isArray(balanceData)) {
              bal = balanceData.reduce((sum: number, svc: any) => sum + (svc.totalOutStanding ?? svc.totalOutstanding ?? 0), 0);
            } else {
              bal = balanceData.totalBalance ?? balanceData.totalOutstanding ?? balanceData.outStandingAmount ?? balanceData.balance;
            }
            if (bal !== undefined && bal !== null) {
              balanceCacheRef.current.set(id, bal);
            }
          }
        } catch {}
      }));
      if (tokenRef.current === token) setter(applyCache([...accounts]));
    }
  }, []);

  const doQuickSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setDropdownResults([]);
      setDropdownSearching(false);
      return;
    }
    setDropdownSearching(true);
    const { field } = detectSearchType(query);
    const token = ++quickSearchTokenRef.current;
    try {
      const data = await searchAccounts({ [field]: query.trim() } as any);
      if (quickSearchTokenRef.current !== token) return;
      setDropdownResults(data);
      setShowDropdown(true);
      enrichWithBalances(data, quickSearchTokenRef, token, setDropdownResults);
    } catch (e: any) {
      if (quickSearchTokenRef.current === token) setDropdownResults([]);
    } finally {
      setDropdownSearching(false);
    }
  }, [enrichWithBalances]);

  const handleQuickQueryChange = (val: string) => {
    setQuickQuery(val);
    setHighlightIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      setShowDropdown(true);
      setDropdownSearching(true);
      debounceRef.current = setTimeout(() => doQuickSearch(val), 400);
    } else {
      setShowDropdown(val.trim().length > 0);
      setDropdownResults([]);
      setDropdownSearching(false);
    }
  };

  const handleSelectAccount = (account: EnquirySearchResult) => {
    setSelectedAccount(account);
    setActiveTab('account');
    setShowDropdown(false);
    const term = quickQuery.trim();
    if (term && !recentSearches.includes(term)) {
      setRecentSearches(prev => [term, ...prev].slice(0, 8));
    }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, Math.min(dropdownResults.length - 1, 49)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < dropdownResults.length) {
        handleSelectAccount(dropdownResults[highlightIdx]);
      } else {
        handleFullSearch();
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightIdx(-1);
    }
  };

  const handleFullSearch = useCallback(async () => {
    const hasQuick = quickQuery.trim().length >= 2;
    const hasAdvanced = Object.values(criteria).some(v => v && String(v).trim());
    if (!hasQuick && !hasAdvanced) return;

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setShowDropdown(false);
    const term = quickQuery.trim();
    if (term && !recentSearches.includes(term)) {
      setRecentSearches(prev => [term, ...prev].slice(0, 8));
    }
    const token = ++fullSearchTokenRef.current;
    try {
      let searchCriteria: EnquirySearchCriteria = { ...criteria };
      if (hasQuick) {
        const { field } = detectSearchType(quickQuery);
        searchCriteria = { ...searchCriteria, [field]: quickQuery.trim() };
      }
      const data = await searchAccounts(searchCriteria);
      if (fullSearchTokenRef.current !== token) return;
      setResults(data);
      enrichWithBalances(data, fullSearchTokenRef, token, setResults);
    } catch (e: any) {
      if (fullSearchTokenRef.current === token) {
        setSearchError(e.message || 'Search failed');
        setResults([]);
      }
    } finally {
      setSearching(false);
    }
  }, [quickQuery, criteria, recentSearches, enrichWithBalances]);

  const handleClear = () => {
    setQuickQuery('');
    setCriteria({});
    setResults([]);
    setDropdownResults([]);
    setHasSearched(false);
    setSearchError(null);
    setSelectedAccount(null);
    setShowDropdown(false);
    setHighlightIdx(-1);
    inputRef.current?.focus();
  };

  if (selectedAccount) {
    const accountId = selectedAccount.account_ID || selectedAccount.accountID;
    const propertyId = selectedAccount.propertyID ? Number(selectedAccount.propertyID) : (selectedAccount.unitID || selectedAccount.unitPartitionID || undefined);
    const unitId = selectedAccount.unitID || undefined;
    const isActive = (selectedAccount.accountStatus || selectedAccount.statusDesc)?.toLowerCase() === 'active';
    const accountName = selectedAccount.name || selectedAccount.surname_Company || 'Unknown';
    const accountNum = selectedAccount.accountNumber || selectedAccount.accountID || selectedAccount.account_ID;

    const tabItems = [
      { value: 'account', label: 'Account' },
      { value: 'name', label: 'Name' },
      { value: 'balance', label: 'Balance/Debt' },
      { value: 'services', label: 'Services' },
      { value: 'property', label: 'Property' },
      { value: 'consumption', label: 'Consumption' },
      { value: 'contact', label: 'Contact' },
      { value: 'handover', label: 'Handover' },
      { value: 'incentives', label: 'Incentives' },
      { value: 'deposits', label: 'Deposits' },
      { value: 'transactions', label: 'Receipts' },
      { value: 'txn-summary', label: 'Txn Summary' },
      { value: 'txn-detailed', label: 'Txn Detail' },
      { value: 'services-meters', label: 'Meters' },
      { value: 'payment-plans', label: 'Pay Plans' },
      { value: 'payment-extensions', label: 'Extensions' },
      { value: 'debit-orders', label: 'Debit Orders' },
      { value: 'rates', label: 'Rates' },
      { value: 'notifications', label: 'Notifications' },
      { value: 'statements', label: 'Statements' },
      { value: 'clearance', label: 'Clearance' },
      { value: 'debtor-notes', label: 'Debtor Notes' },
      { value: 'section129', label: 'Section 129' },
      { value: 'occupiers', label: 'Occupiers' },
    ];

    return (
      <div className="flex flex-col h-full overflow-hidden bg-slate-50/80">
        <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm">
          <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
            <button
              onClick={() => setSelectedAccount(null)}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors group"
              data-testid="button-back-to-results"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>

            <div className="h-8 w-px bg-slate-200" />

            <div className="shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {accountName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-bold text-slate-900 truncate" data-testid="text-selected-account-name">
                  {accountName}
                </h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {selectedAccount.accountStatus || selectedAccount.statusDesc || 'Unknown'}
                </span>
                {(selectedAccount.accountType || selectedAccount.accountDesc) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200" data-testid="badge-account-type">
                    {selectedAccount.accountType || selectedAccount.accountDesc}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono">
                Acc: {accountNum}
                {selectedAccount.oldAccountCode && <span className="text-slate-400"> | Old: {selectedAccount.oldAccountCode}</span>}
              </div>
            </div>

            <div className="shrink-0 ml-auto text-right pl-4" data-testid="header-balance-section">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">Outstanding Balance</div>
              {headerBalance !== null ? (
                <div className={`text-xl font-bold font-mono tracking-tight ${headerBalance > 0 ? 'text-red-600' : headerBalance < 0 ? 'text-emerald-600' : 'text-slate-800'}`} data-testid="text-header-balance">
                  R {headerBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              ) : (
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="shrink-0 bg-white border-b border-slate-200 sticky top-0 z-20">
              <div className="px-3 sm:px-4">
                <TabsList className="h-auto flex flex-nowrap gap-0 bg-transparent p-0 overflow-x-auto scrollbar-hide -mb-px">
                  {tabItems.map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="relative text-[12px] font-medium whitespace-nowrap px-3 py-2.5 rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 transition-all data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:shadow-none"
                      data-testid={`tab-${tab.value}`}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50/50">
              <TabsContent value="account" className="m-0"><AccountInfoTab account={selectedAccount} /></TabsContent>
              <TabsContent value="name" className="m-0"><NameTab accountId={accountId} /></TabsContent>
              <TabsContent value="balance" className="m-0"><BalanceDebtTab accountId={accountId} /></TabsContent>
              <TabsContent value="services" className="m-0"><ServiceBalanceTab accountId={accountId} /></TabsContent>
              <TabsContent value="property" className="m-0"><PropertyDetailsTab accountId={accountId} /></TabsContent>
              <TabsContent value="consumption" className="m-0"><ConsumptionTab accountId={accountId} /></TabsContent>
              <TabsContent value="contact" className="m-0"><ContactInfoTab accountId={accountId} /></TabsContent>
              <TabsContent value="handover" className="m-0"><HandoverTab accountId={accountId} /></TabsContent>
              <TabsContent value="incentives" className="m-0"><IncentivesTab accountId={accountId} /></TabsContent>
              <TabsContent value="deposits" className="m-0"><DepositsTab accountId={accountId} /></TabsContent>
              <TabsContent value="transactions" className="m-0"><TransactionHistoryTab accountId={accountId} accountNumber={selectedAccount.accountNumber || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
              <TabsContent value="txn-summary" className="m-0"><TransactionSummaryTab accountId={accountId} /></TabsContent>
              <TabsContent value="txn-detailed" className="m-0"><DetailedTransactionListTab accountId={accountId} /></TabsContent>
              <TabsContent value="services-meters" className="m-0"><ServicesMetersTab accountId={accountId} unitId={unitId} /></TabsContent>
              <TabsContent value="payment-plans" className="m-0"><PaymentPlansTab accountId={accountId} /></TabsContent>
              <TabsContent value="payment-extensions" className="m-0"><PaymentExtensionHistoryTab accountId={accountId} /></TabsContent>
              <TabsContent value="debit-orders" className="m-0"><DebitOrdersTab accountId={accountId} /></TabsContent>
              <TabsContent value="rates" className="m-0"><RatesValuationsTab accountId={accountId} propertyId={propertyId} /></TabsContent>
              <TabsContent value="notifications" className="m-0"><NotificationsTab accountId={accountId} /></TabsContent>
              <TabsContent value="statements" className="m-0"><StatementsTab accountId={accountId} /></TabsContent>
              <TabsContent value="clearance" className="m-0"><ClearanceTab accountId={accountId} /></TabsContent>
              <TabsContent value="debtor-notes" className="m-0"><DebtorNotesTab accountId={accountId} /></TabsContent>
              <TabsContent value="section129" className="m-0"><Section129Tab accountId={accountId} /></TabsContent>
              <TabsContent value="occupiers" className="m-0"><OccupiersTab accountId={accountId} /></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 bg-white border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800" data-testid="text-page-title">General Enquiries</h2>
            <p className="text-xs text-slate-500 mt-0.5">Search and view municipal account information</p>
          </div>
          <div className="flex items-center gap-2">
            {hasSearched && (
              <Badge variant="outline" className="text-xs" data-testid="text-result-count">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        <div ref={dropdownContainerRef} className="relative">
          <div className="flex gap-2 items-stretch">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              {dropdownSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin pointer-events-none" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={quickQuery}
                onChange={(e) => handleQuickQueryChange(e.target.value)}
                onKeyDown={handleQuickKeyDown}
                onFocus={() => { if (quickQuery.trim().length >= 2 || recentSearches.length > 0) setShowDropdown(true); }}
                placeholder="Search by account number, name, ID number, phone, email..."
                className="w-full h-11 pl-10 pr-10 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                data-testid="input-smart-search"
              />
              {quickQuery && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  data-testid="button-clear-quick"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              onClick={handleFullSearch}
              disabled={searching || (quickQuery.trim().length < 2 && !Object.values(criteria).some(v => v && String(v).trim()))}
              className="h-11 px-5 gap-2 shadow-sm"
              data-testid="button-search"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
            <Button
              variant={searchMode === 'advanced' ? 'secondary' : 'outline'}
              onClick={() => setSearchMode(prev => prev === 'advanced' ? 'quick' : 'advanced')}
              className="h-11 px-3 gap-1.5"
              data-testid="button-toggle-advanced"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Filters</span>
            </Button>
          </div>

          {quickQuery.trim().length >= 1 && quickQuery.trim().length < 2 && showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 px-4 py-3">
              <p className="text-xs text-slate-400">Type at least 2 characters to search...</p>
            </div>
          )}

          {quickQuery.trim().length >= 2 && (
            <SmartSearchDropdown
              results={dropdownResults}
              loading={dropdownSearching}
              query={quickQuery}
              highlightIdx={highlightIdx}
              onSelect={handleSelectAccount}
              visible={showDropdown}
            />
          )}

          {quickQuery.trim().length < 2 && showDropdown && recentSearches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-2">
              <div className="px-4 py-1.5 flex items-center gap-2 border-b border-slate-100 mb-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Recent Searches</span>
              </div>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  onClick={() => { setQuickQuery(term); handleQuickQueryChange(term); }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  data-testid={`recent-search-${i}`}
                >
                  <Clock className="w-3 h-3 text-slate-300" />
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>

        {quickQuery.trim().length >= 2 && !showDropdown && (
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Detected:</span>
              <Badge variant="outline" className={`text-[10px] gap-1 h-5 ${detectedType.unsupported ? 'border-amber-400 text-amber-600 bg-amber-50' : ''}`}>
                {detectedType.unsupported ? <AlertTriangle className="w-2.5 h-2.5" /> : <Filter className="w-2.5 h-2.5" />}
                {detectedType.label}
              </Badge>
            </div>
            {detectedType.unsupported && (
              <p className="text-[10px] text-amber-600">Try searching by account number, name, ID number, address, or mobile number instead</p>
            )}
          </div>
        )}

        {searchMode === 'advanced' && (
          <div className="mt-3 pt-3 border-t border-dashed border-slate-200 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Advanced Filters</span>
              {Object.values(criteria).some(v => v && String(v).trim()) && (
                <button onClick={() => setCriteria({})} className="text-[10px] text-blue-600 hover:text-blue-800 ml-auto">
                  Clear Filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SEARCH_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`search-${field.key}`} className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                    <field.icon className="w-3 h-3" />
                    {field.label}
                  </Label>
                  <Input
                    id={`search-${field.key}`}
                    placeholder={field.placeholder}
                    value={(criteria as any)[field.key] || ''}
                    onChange={(e) => setCriteria(prev => ({ ...prev, [field.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFullSearch(); }}
                    className="h-9 text-sm"
                    data-testid={`input-search-${field.key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-slate-50">
        {searchError && (
          <div className="p-4">
            <ErrorState message={searchError} onRetry={handleFullSearch} />
          </div>
        )}

        {!hasSearched && !searchError && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
            <div className="relative mb-6">
              <Search className="w-16 h-16 opacity-15" />
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-blue-600" />
              </div>
            </div>
            <p className="text-base font-semibold text-slate-600 mb-1">Smart Account Search</p>
            <p className="text-sm text-center max-w-lg text-slate-400 leading-relaxed">
              Start typing an account number, name, ID number, phone number, or email in the search bar above.
              Results appear instantly as you type. Use the Filters button for advanced multi-field searches.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {['000000003698', 'Van der Merwe', '8501015012087'].map((example, i) => (
                <button
                  key={i}
                  onClick={() => { setQuickQuery(example); handleQuickQueryChange(example); inputRef.current?.focus(); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
                  data-testid={`example-search-${i}`}
                >
                  Try: {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasSearched && !searchError && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No accounts found</p>
            {detectedType.unsupported ? (
              <div className="text-center mt-2">
                <p className="text-xs text-amber-600 font-medium">Email search is not supported by the API</p>
                <p className="text-xs mt-1.5 text-slate-500">Search by: Account Number, Name, ID Number, Address, Mobile Number, Passport, Old Account Code, or Meter Number</p>
              </div>
            ) : (
              <p className="text-xs mt-1">Try a different search term or use advanced filters</p>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="overflow-x-auto" data-testid="table-search-results">
            <table className="w-full text-xs border-collapse min-w-[1100px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 border-b-2 border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="w-8 px-1 py-2.5"></th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[140px]">Account No.</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[60px]">Part. ID</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[100px]">Old Code</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap">Name</th>
                  <th className="text-center px-2 py-2.5 whitespace-nowrap w-[70px]">Status</th>
                  <th className="text-center px-2 py-2.5 whitespace-nowrap w-[130px]">Type</th>
                  <th className="text-right px-2 py-2.5 whitespace-nowrap w-[110px]">Outstanding</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[180px]">Address</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[180px]">SG Number</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap w-[60px]">Unit</th>
                  <th className="w-[60px] px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((account, i) => {
                  const aid = account.accountID || account.account_ID || i;
                  return (
                    <ExpandableResultRow
                      key={aid}
                      account={account}
                      onSelect={handleSelectAccount}
                      isExpanded={expandedRowId === aid}
                      onToggleExpand={() => setExpandedRowId(prev => prev === aid ? null : aid)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GeneralEnquiries() {
  return (
    <PosLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <GeneralEnquiriesContent />
      </div>
    </PosLayout>
  );
}
