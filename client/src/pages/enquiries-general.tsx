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
  Eye, Layers, Home, Activity, ChevronRight, Mail, Download,
  Briefcase, Heart, Users, Receipt, CalendarDays, Banknote, Scale,
  Gauge, Link2, AlertCircle
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
  getUnitLinkedMeters, getMeterReadingHistory, getPrepaidMeterServicesForAccount, getPrepaidRechargeDetailsForMeter,
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
  getOccupiers, addOccupier, deleteOccupier,
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
    <div className="group flex items-center gap-3 py-2.5 px-3 border-b border-slate-100/80 last:border-0 hover:bg-slate-50/50 transition-colors rounded-sm">
      {icon && <div className="text-blue-500/70 shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1 flex items-baseline justify-between gap-4">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold shrink-0">{label}</span>
        <span className="text-[13px] text-slate-800 font-medium text-right break-words">{typeof value === 'number' ? value.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : String(value)}</span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="p-5 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-3.5 flex-1 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">{message}</p>
          <p className="text-xs text-slate-400 mt-1">No records found for this account</p>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-red-100 shadow-sm">
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm font-medium text-red-600 mb-1">Something went wrong</p>
          <p className="text-xs text-slate-500 mb-4 text-center max-w-sm">{message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50">
              <RefreshCw className="w-3 h-3" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TabCard({ children, title, icon, action }: { children: React.ReactNode; title?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {title && (
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-blue-600">{icon}</span>}
            <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
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
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs" data-testid={`${tid}-grid`}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-600 whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-slate-400 py-8" data-testid={`${tid}-empty`}>No records to display</td></tr>
            ) : paged.map((row, i) => (
              <tr key={i} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)} data-testid={`${tid}-row-${i}`}>
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
      <div className="flex items-center justify-end gap-2 mt-2.5 text-xs text-slate-500">
        <span className="text-slate-400">Items per page:</span>
        <span className="border border-slate-200 rounded-md px-2 py-0.5 bg-white text-slate-600 font-medium">{itemsPerPage}</span>
        <span className="text-slate-600 font-medium" data-testid={`${tid}-page-info`}>{data.length === 0 ? '0 of 0' : `${(page-1)*itemsPerPage+1} - ${Math.min(page*itemsPerPage, data.length)} of ${data.length}`}</span>
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors" data-testid={`${tid}-prev-page`}>&lt;</button>
        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors" data-testid={`${tid}-next-page`}>&gt;</button>
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
    <div className="p-5 space-y-5" data-testid="name-info-panel">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
          <User className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Person Details</h3>
        </div>
        <div className="p-5">
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Employer Details</h3>
          </div>
          <div className="p-5">
            <InfoField label="Employment Status" value={n.employementStatusDesc} />
            <InfoField label="Employer" value={n.employer} />
            <InfoField label="Contact Person" value={n.contactPerson} />
            <InfoField label="Contact Telephone" value={n.tel_ContactPerson || n.tel_ContactPerson1} />
            <InfoField label="Occupation" value={n.occupation || n.occupation1} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 flex items-center gap-2">
            <Heart className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Marital Details</h3>
          </div>
          <div className="p-5">
            <InfoField label="Marital Status" value={n.kinMarriedStatus} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Next of Kin</h3>
        </div>
        <div className="p-5">
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
        </div>
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
    <div className="p-5 space-y-5" data-testid="balance-debt-tab">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
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
              <div className="rounded-xl border border-slate-200 overflow-hidden">
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Debtors - Remaining Capital Amounts</h3>
          </div>
          <div className="p-4">
            {capitalData ? (
              <div className="space-y-3">
                {Array.isArray(capitalData) ? capitalData.map((cap: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                    <span className="text-sm text-slate-700 font-medium">{cap.description || cap.serviceDescription || `Item ${i + 1}`}</span>
                    <span className="font-mono font-bold text-purple-700 text-sm">{fmt(cap.amount || cap.remainingCapital || cap.capitalAmount || 0)}</span>
                  </div>
                )) : (
                  <div className="flex items-center justify-between p-3 bg-purple-50/50 rounded-xl border border-purple-100">
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

interface TariffBlock {
  startDate: string;
  endDate: string;
  intervals: { interval: string; cost: string }[];
}

function parseTariffRateData(svc: any): { startDate: string; endDate: string; intervals: { interval: string; cost: string }[]; blocks: TariffBlock[] } {
  const blocks: TariffBlock[] = [];

  const html = svc.endDate || '';
  if (html && typeof html === 'string' && html.includes('<')) {
    const stripped = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ');
    const rawLines = stripped.split('\n').map((l: string) => l.trim()).filter(Boolean);

    const joined: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (/^-\s*[\d.]+/.test(line) && joined.length > 0) {
        joined[joined.length - 1] = joined[joined.length - 1] + ' ' + line;
      } else {
        joined.push(line);
      }
    }

    let currentBlock: TariffBlock | null = null;
    for (const line of joined) {
      if (/start\s*date.*end\s*date/i.test(line)) continue;
      if (/interval\s*[-–]?\s*cost/i.test(line)) continue;

      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        currentBlock = { startDate: dateMatch[1], endDate: dateMatch[2], intervals: [] };
        blocks.push(currentBlock);
        continue;
      }

      const costMatch = line.match(/^(.+?)\s*-\s*([\d.]+)\s*$/);
      if (costMatch && currentBlock) {
        const costVal = parseFloat(costMatch[2]);
        currentBlock.intervals.push({
          interval: costMatch[1].trim(),
          cost: isNaN(costVal) ? costMatch[2].trim() : costVal.toFixed(6)
        });
      }
    }
  }

  if (blocks.length === 0 && Array.isArray(svc.costInterVal) && svc.costInterVal.length > 0) {
    const block: TariffBlock = { startDate: svc.startDate || '', endDate: '', intervals: [] };
    svc.costInterVal.forEach((ci: any) => {
      const costVal = parseFloat(ci.cost);
      const intervalLabel = ci.interval === 0 || ci.interval === '0' ? 'Remainder' : String(ci.interval);
      block.intervals.push({ interval: intervalLabel, cost: isNaN(costVal) ? String(ci.cost) : costVal.toFixed(6) });
    });
    blocks.push(block);
  }

  const first = blocks[0] || { startDate: '', endDate: '', intervals: [] };
  const allIntervals = blocks.flatMap(b => b.intervals);
  return { startDate: first.startDate, endDate: first.endDate, intervals: allIntervals, blocks };
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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

  const svcIconMap: Record<string, React.ReactNode> = {
    'water': <Droplets className="w-4 h-4" />,
    'electricity': <Zap className="w-4 h-4" />,
    'sanitation': <Building2 className="w-4 h-4" />,
    'sewer': <Building2 className="w-4 h-4" />,
    'waste': <RefreshCw className="w-4 h-4" />,
    'refuse': <RefreshCw className="w-4 h-4" />,
    'rates': <Scale className="w-4 h-4" />,
    'property': <Home className="w-4 h-4" />,
  };
  const getSvcIcon = (name: string) => {
    const lower = (name || '').toLowerCase();
    for (const [key, icon] of Object.entries(svcIconMap)) {
      if (lower.includes(key)) return icon;
    }
    return <Layers className="w-4 h-4" />;
  };
  const getSvcColor = (name: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('water')) return { bg: 'from-cyan-500 to-cyan-600', light: 'bg-cyan-50 text-cyan-700 ring-cyan-200', iconBg: 'bg-cyan-100 text-cyan-600' };
    if (lower.includes('electricity') || lower.includes('elec')) return { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-50 text-amber-700 ring-amber-200', iconBg: 'bg-amber-100 text-amber-600' };
    if (lower.includes('sanitation') || lower.includes('sewer')) return { bg: 'from-violet-500 to-violet-600', light: 'bg-violet-50 text-violet-700 ring-violet-200', iconBg: 'bg-violet-100 text-violet-600' };
    if (lower.includes('waste') || lower.includes('refuse')) return { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 text-emerald-700 ring-emerald-200', iconBg: 'bg-emerald-100 text-emerald-600' };
    if (lower.includes('rates') || lower.includes('property')) return { bg: 'from-orange-500 to-orange-600', light: 'bg-orange-50 text-orange-700 ring-orange-200', iconBg: 'bg-orange-100 text-orange-600' };
    return { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 text-blue-700 ring-blue-200', iconBg: 'bg-blue-100 text-blue-600' };
  };

  return (
    <div className="p-4 space-y-4" data-testid="service-balance-tab">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Services</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{displayData.length} service{displayData.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">{displayData.length} items</Badge>
      </div>

      {displayData.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <Layers className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No services found for this account</p>
        </div>
      ) : (
        <div className="grid gap-3" data-testid="table-service-list">
          {displayData.map((svc: any, i: number) => {
            const tariffInfo = parseTariffRateData(svc);
            const isExpanded = expandedRates.has(i);
            const hasCostData = !!svc.costInterVal || (svc.endDate && typeof svc.endDate === 'string' && svc.endDate.includes('<'));
            const meterDisplay = hasCostData
              ? (svc.meterNo || 'No Meter')
              : `${svc.physicalMeterNo || 'No Meter'}${svc.meterNo ? ` - ${svc.meterNo}` : ''}`;
            const status = svc.serviceStatus || svc.statusDesc || '-';
            const isActiveStatus = status.toLowerCase() === 'active';
            const requestDate = svc.serviceRequestedDate ? new Date(svc.serviceRequestedDate).toLocaleDateString('en-ZA') : '-';
            const commencementDate = svc.serviceCommencementDate || svc.commencementDate
              ? new Date(svc.serviceCommencementDate || svc.commencementDate).toLocaleDateString('en-ZA')
              : svc.startDate || '-';
            const svcName = svc.tariffType || svc.serviceDesc || 'Service';
            const colors = getSvcColor(svcName);

            return (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow" data-testid={`row-service-${i}`}>
                <div className={`px-4 py-2.5 bg-gradient-to-r ${colors.bg} flex items-center gap-3`}>
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white">
                    {getSvcIcon(svcName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setSelectedService(svc)}
                      className="text-sm font-semibold text-white hover:text-white/80 transition-colors truncate block text-left"
                      data-testid={`btn-service-detail-${i}`}
                    >
                      {svcName}
                    </button>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isActiveStatus ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActiveStatus ? 'bg-white' : 'bg-red-400'}`} />
                    {status}
                  </span>
                </div>

                <div className="px-4 py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-2.5">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Tariff</div>
                      <div className="text-[12px] text-slate-700 mt-0.5 leading-snug">{svc.tariff || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Meter</div>
                      <div className="text-[12px] text-slate-700 font-mono mt-0.5">{meterDisplay}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Frequency</div>
                      <div className="text-[12px] text-slate-700 mt-0.5">{svc.frequency || 'Monthly'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Connection Size</div>
                      <div className="text-[12px] text-slate-700 mt-0.5">{svc.meterConnectionSize || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Factor / Qty</div>
                      <div className="text-[12px] text-slate-700 font-mono mt-0.5">{svc.factorQuantity ?? svc.tarifffactor ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Request Date</div>
                      <div className="text-[12px] text-slate-700 mt-0.5">{requestDate}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Commencement</div>
                      <div className="text-[12px] text-slate-700 mt-0.5">{commencementDate}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Tariff Type</div>
                      <div className="text-[12px] text-slate-700 mt-0.5">{svc.tariffType || svc.serviceDesc || '-'}</div>
                    </div>
                  </div>

                  {tariffInfo.blocks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleRate(i); }}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors mb-2"
                        data-testid={`btn-tariff-rate-${i}`}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        Tariff Rates & Intervals ({tariffInfo.blocks.reduce((sum, b) => sum + b.intervals.length, 0)} entries)
                      </button>
                      {isExpanded && (
                        <div className="space-y-2">
                          {tariffInfo.blocks.map((block, bi) => (
                            <div key={bi} className="rounded-lg border border-slate-200 overflow-hidden">
                              {(block.startDate || block.endDate) && (
                                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 font-medium">
                                  Period: {block.startDate || '—'} to {block.endDate || '—'}
                                </div>
                              )}
                              <div className="overflow-x-auto">
                                <table className="w-full text-[12px]">
                                  <thead>
                                    <tr className="bg-slate-50/50">
                                      <th className="text-left py-1.5 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Interval</th>
                                      <th className="text-right py-1.5 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Cost (R)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {block.intervals.map((iv, idx) => (
                                      <tr key={idx} className="border-t border-slate-100 hover:bg-blue-50/30">
                                        <td className="py-1.5 px-3 text-slate-700">{iv.interval}</td>
                                        <td className="py-1.5 px-3 text-right font-mono font-semibold text-blue-700">{iv.cost}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isExpanded && tariffInfo.blocks.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {tariffInfo.blocks.slice(0, 1).flatMap(b => b.intervals.slice(0, 4)).map((iv, idx) => (
                            <div key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-100 text-[11px]">
                              <span className="text-slate-600">{iv.interval}:</span>
                              <span className="font-mono font-semibold text-blue-700">R {iv.cost}</span>
                            </div>
                          ))}
                          {tariffInfo.blocks.reduce((sum, b) => sum + b.intervals.length, 0) > 4 && (
                            <span className="text-[11px] text-slate-400 self-center">+{tariffInfo.blocks.reduce((sum, b) => sum + b.intervals.length, 0) - 4} more...</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end text-[11px] text-slate-400">
        <span>Items per page: 50</span>
        <span className="ml-4 font-medium">1 - {displayData.length} of {displayData.length}</span>
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
    <div className="p-5 space-y-5" data-testid="property-details-tab">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Property Information</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4">
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Property ID</span><div className="text-sm font-semibold text-slate-800">{prop.propertyId || prop.property_ID || cu.unit_ID || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Erf Number</span><div className="text-sm font-semibold text-slate-800">{prop.erfNumber || cu.erfNumber || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">SG Number</span><div className="text-sm font-semibold text-slate-800">{prop.sgNumber || cu.sgNumber || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Street Address</span><div className="text-sm font-semibold text-slate-800">{prop.streetNumber ? `${prop.streetNumber} ${prop.streetName}` : prop.streetName || cu.nonStandAddLine1 || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Suburb</span><div className="text-sm font-semibold text-slate-800">{prop.subSuburb || prop.suburb || cu.nonStandAddSuburb || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Town</span><div className="text-sm font-semibold text-slate-800">{prop.town || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Property Type / Zoning</span><div className="text-sm font-semibold text-slate-800">{prop.typeofUse || prop.townPlanningZoneType || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Market Value</span><div className="text-sm font-bold text-blue-700 font-mono">{fmt(prop.marketValue || cu.marketValue)}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Stand Size (m²)</span><div className="text-sm font-semibold text-slate-800">{fmtInt(prop.standSize || cu.standSize)}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Land Size (ha)</span><div className="text-sm font-semibold text-slate-800">{prop.landSize ?? cu.landSize ?? '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Rates Tariff</span><div className="text-sm font-semibold text-slate-800">{prop.ratesTariff || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Owner</span><div className="text-sm font-semibold text-slate-800">{prop.name || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Master Property</span><div className="text-sm font-semibold text-slate-800">{prop.masterProperty || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Roll Number</span><div className="text-sm font-semibold text-slate-800">{prop.rollNumber || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Roll Start Date</span><div className="text-sm font-semibold text-slate-800">{fmtDate(prop.rollStartDate)}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Expected Expiry Date</span><div className="text-sm font-semibold text-slate-800">{fmtDate(prop.expectedExpiryDate)}</div></div>
            {prop.rdpOrReform && <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">RDP / Reform</span><div className="text-sm font-semibold text-slate-800">{prop.rdpOrReform}</div></div>}
            {prop.complexName && <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Complex</span><div className="text-sm font-semibold text-slate-800">{prop.complexName}</div></div>}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Electoral & Classification Details</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4">
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Ward</span><div className="text-sm font-semibold text-slate-800">{cu.wardID ? `Ward ${cu.wardID}` : '-'}</div></div>
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Polling Station</span><div className="text-sm font-semibold text-slate-800">{cu.pollingStationID ? `Station ${cu.pollingStationID}` : '-'}</div></div>
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Magisterial District</span><div className="text-sm font-semibold text-slate-800">{cu.magisterialID ? `District ${cu.magisterialID}` : '-'}</div></div>
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">NT Property Category</span><div className="text-sm font-semibold text-slate-800">{(() => { const id = cu.ntPropertyCategoryID; if (id === null || id === undefined) return '-'; const catMap: Record<number, string> = { 1: 'Residential', 2: 'Commercial', 3: 'Industrial', 4: 'Agricultural', 5: 'Mining', 6: 'Government', 7: 'Municipal', 8: 'Public Service Infrastructure', 9: 'Public Benefit Organisation', 10: 'State Trust Land' }; return catMap[id] || cu.ntPropertyCategoryDescription || `Category ${id}`; })()}</div></div>
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Billing Cycle</span><div className="text-sm font-semibold text-slate-800">{cu.billingCycleID ?? '-'}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 flex items-center gap-2">
          <Gift className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Rebates & Levies</h3>
        </div>
        <div className="p-5">
          {ratesDetails ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-sm text-slate-600">Annual Property Rates</span>
                <span className="font-mono font-bold text-slate-800">{fmt(ratesDetails.annualPropertyRates)}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-sm text-slate-600">Installment</span>
                <span className="font-mono font-bold text-slate-800">{fmt(ratesDetails.installment)}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-sm text-slate-600">Frequency</span>
                <span className="font-semibold text-slate-800">{ratesDetails.frequency || '-'}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-sm text-slate-600">Remaining Installments</span>
                <span className="font-semibold text-slate-800">{ratesDetails.remainingInstallments ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-sm text-slate-600">Remaining Amount</span>
                <span className="font-mono font-bold text-slate-800">{fmt(ratesDetails.remaingAmount ?? ratesDetails.remainingAmount)}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-green-50/60 rounded-xl border border-green-200">
                <span className="text-sm text-green-800 font-medium">Rebate Amount</span>
                <span className="font-mono font-bold text-green-700">{fmt(ratesDetails.rebateAmount)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 text-sm py-4">No rates/rebate data available</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
    <div className="p-5 space-y-5" data-testid="consumption-tab">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-slate-100 to-white border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800">Meter Reading History Chart</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 mb-4 border border-slate-200 rounded-xl p-3 bg-slate-50">
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
    <div className="p-5 space-y-5" data-testid="contact-info-panel">

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2" data-testid="section-contact-details">
          <Phone className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Contact Details</h3>
        </div>
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

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2" data-testid="section-delivery-address">
          <MapPin className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Delivery Address Details</h3>
        </div>
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
    <div className="p-5 space-y-5">
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-orange-600 to-orange-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Handover Details</h3>
            {(item.handoverStatus || item.status) && (
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{item.handoverStatus || item.status}</Badge>
            )}
          </div>
          <div className="p-5">
            <FieldRow label="Handover Status" value={item.handoverStatus || item.status} icon={<Shield className="w-3.5 h-3.5" />} />
            <FieldRow label="Handover Date" value={item.handoverDate ? new Date(item.handoverDate).toLocaleDateString('en-ZA') : null} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="Attorney" value={item.attorney || item.attorneyName} icon={<Scale className="w-3.5 h-3.5" />} />
            <FieldRow label="Reference" value={item.reference || item.handoverReference} icon={<Hash className="w-3.5 h-3.5" />} />
            <FieldRow label="Amount" value={item.amount || item.handoverAmount} icon={<Banknote className="w-3.5 h-3.5" />} />
            <FieldRow label="Description" value={item.description || item.notes} />
          </div>
        </div>
      ))}

      {enquiry && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-600 to-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Handover Account Enquiry</h3>
          </div>
          <div className="p-5">
            {Object.entries(enquiry).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
              <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
            ))}
          </div>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-600 to-slate-700 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Handover Transactions</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{transactions.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-handover-transactions">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-orange-50/30 transition-colors">
                    <td className="py-2 px-3 text-slate-500">{tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString('en-ZA') : tx.date || '-'}</td>
                    <td className="py-2 px-3">{tx.description || tx.transactionDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(tx.amount ?? tx.transactionAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-slate-500">{tx.reference || '-'}</td>
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
    <div className="p-5 space-y-5">
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
            <Gift className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Payment Incentive</h3>
            {(item.status || item.incentiveStatus) && (
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{item.status || item.incentiveStatus}</Badge>
            )}
          </div>
          <div className="p-5">
            <FieldRow label="Incentive Type" value={item.incentiveType || item.type} icon={<Gift className="w-3.5 h-3.5" />} />
            <FieldRow label="Discount %" value={item.discountPercentage || item.percentage} icon={<Activity className="w-3.5 h-3.5" />} />
            <FieldRow label="Discount Amount" value={item.discountAmount || item.amount} icon={<Banknote className="w-3.5 h-3.5" />} />
            <FieldRow label="Valid From" value={item.validFrom ? new Date(item.validFrom).toLocaleDateString('en-ZA') : null} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="Valid To" value={item.validTo ? new Date(item.validTo).toLocaleDateString('en-ZA') : null} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="Status" value={item.status || item.incentiveStatus} icon={<Shield className="w-3.5 h-3.5" />} />
          </div>
        </div>
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
    <div className="p-5 space-y-5" data-testid="deposits-tab">
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
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

function TransactionSummaryTab({ accountId, accountNumber }: { accountId: number; accountNumber?: string }) {
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

  const exportToExcel = () => {
    if (!hasData) return;
    const accNum = accountNumber || String(accountId);
    const headers = ['Account Number', 'Description', 'Financial Year', ...MONTHS];
    const rows = pivotData.map((row: any) => {
      const vals = MONTHS.map(m => {
        const v = row[m];
        return v === undefined ? 0 : (typeof v === 'number' ? v : 0);
      });
      return [accNum, row.description, selectedYear, ...vals];
    });

    const escXml = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const colWidths = [140, 180, 120, ...MONTHS.map(() => 100)];
    const colXml = colWidths.map(w => `<Column ss:Width="${w}"/>`).join('');

    const headerCells = headers.map(h =>
      `<Cell ss:StyleID="header"><Data ss:Type="String">${escXml(h)}</Data></Cell>`
    ).join('');

    const dataRows = rows.map(row => {
      const cells = row.map((val: any, ci: number) => {
        if (ci <= 2) {
          return `<Cell ss:StyleID="text"><Data ss:Type="String">${escXml(String(val))}</Data></Cell>`;
        }
        return `<Cell ss:StyleID="number"><Data ss:Type="Number">${Number(val).toFixed(2)}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default">
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8"/>
   </Borders>
  </Style>
  <Style ss:ID="text">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="number">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="title">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#1E293B"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Transaction Summary">
  <Table>
   ${colXml}
   <Row ss:Height="30">
    <Cell ss:StyleID="title" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Transaction Summary - Account ${escXml(accNum)} - ${escXml(selectedYear)}</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:Height="25">${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transaction_Summary_${accNum}_${selectedYear.replace('/', '-')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 space-y-5" data-testid="transaction-summary-panel">
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
        <button
          onClick={exportToExcel}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="btn-export-txn-summary"
        >
          <Download className="w-4 h-4" />
          Export to Excel
        </button>
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
  const [detailedData, setDetailedData] = useState<any[]>([]);
  const [serviceBalanceData, setServiceBalanceData] = useState<any[]>([]);
  const [receiptData, setReceiptData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const years = useMemo(() => getFinYearOptions(), []);
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const [selectedMonth, setSelectedMonth] = useState('January');
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [showCreditMeterOnly, setShowCreditMeterOnly] = useState(false);
  const lastKey = useRef('');

  const calendarMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const finYearMonths = ['July','August','September','October','November','December','January','February','March','April','May','June'];

  const load = useCallback(async (finYear: string) => {
    setLoading(true);
    setError(null);
    try {
      const [detResult, balResult, rcptResult] = await Promise.all([
        getDetailedTransactionResults(accountId, finYear).catch(() => []),
        getServiceTypeBalance(accountId, finYear).catch(() => []),
        getTransactionHistory('', accountId).catch(() => []),
      ]);
      setDetailedData(Array.isArray(detResult) ? detResult : []);
      setServiceBalanceData(Array.isArray(balResult) ? balResult : []);
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

  const monthsWithData = useMemo(() => {
    const mSet = new Set<string>();
    detailedData.forEach((d: any) => {
      finYearMonths.forEach(m => {
        const key = m.toLowerCase();
        if (d[key] && d[key] !== 0) mSet.add(m);
      });
    });
    serviceBalanceData.forEach((d: any) => {
      if (d.month) mSet.add(d.month);
    });
    return mSet;
  }, [detailedData, serviceBalanceData]);

  useEffect(() => {
    if (monthsWithData.size > 0 && !monthsWithData.has(selectedMonth)) {
      const lastWithData = finYearMonths.filter(m => monthsWithData.has(m));
      if (lastWithData.length > 0) setSelectedMonth(lastWithData[lastWithData.length - 1]);
    }
  }, [monthsWithData]);

  const detailedRows = useMemo(() => {
    if (!selectedMonth) return [];
    const monthKey = selectedMonth.toLowerCase();

    const yearParts = selectedYear.split('/');
    const yearNum = parseInt(yearParts[0]);
    const monthIdx = calendarMonths.indexOf(selectedMonth);
    const calMonth = monthIdx >= 0 ? monthIdx + 1 : 1;
    const dateYear = calMonth >= 7 ? yearNum : yearNum + 1;
    const monthStart = `01/${String(calMonth).padStart(2, '0')}/${dateYear}`;
    const billingDateStr = `${dateYear}/${String(calMonth).padStart(2, '0')}/23`;

    const rows: any[] = [];

    const openRow = detailedData.find((d: any) => d.transGroup === 1);
    const openVal = openRow ? (openRow[monthKey] || 0) : 0;
    const interestRow = detailedData.find((d: any) => d.transGroup === 601);
    const interestVal = interestRow ? (interestRow[monthKey] || 0) : 0;
    const closingRow = detailedData.find((d: any) => d.transGroup === 990);
    const closingVal = closingRow ? (closingRow[monthKey] || 0) : 0;
    const totalRow = detailedData.find((d: any) => d.transGroup === 900);
    const totalVal = totalRow ? (totalRow[monthKey] || 0) : 0;
    const receiptsRow = detailedData.find((d: any) => d.transGroup === 915);
    const receiptsVal = receiptsRow ? (receiptsRow[monthKey] || 0) : 0;

    const monthBalData = serviceBalanceData.filter((d: any) => d.month === selectedMonth);
    const totalInterestFromBal = monthBalData.reduce((s: number, d: any) => s + (d.interestAmount || 0), 0);
    const totalVatFromBal = monthBalData.reduce((s: number, d: any) => s + (d.vat || 0), 0);
    const openInterest = totalInterestFromBal;
    const openVat = totalVatFromBal;

    rows.push({
      transactionDate: monthStart,
      description: 'Open Balance',
      receiptId: '',
      documentNumber: '',
      tariff: '',
      amount: openVal,
      interest: openInterest,
      vat: openVat,
      total: openVal + openInterest + openVat,
      isSpecial: true,
    });

    const monthReceipts = receiptData.filter((r: any) => {
      if (!r.receiptDate) return false;
      const rd = new Date(r.receiptDate);
      return rd.getMonth() === monthIdx && ((calMonth >= 7 && rd.getFullYear() === yearNum) || (calMonth < 7 && rd.getFullYear() === yearNum + 1));
    });

    monthReceipts.sort((a: any, b: any) => new Date(a.receiptDate).getTime() - new Date(b.receiptDate).getTime());
    monthReceipts.forEach((r: any) => {
      const rDate = r.receiptDate ? new Date(r.receiptDate) : null;
      const dateStr = rDate ? `${rDate.getFullYear()}/${String(rDate.getMonth()+1).padStart(2,'0')}/${String(rDate.getDate()).padStart(2,'0')}` : '';
      rows.push({
        transactionDate: dateStr,
        description: 'Payment',
        receiptId: r.receiptNo || '',
        documentNumber: r.receiptId ? `98/${r.receiptId}` : '',
        tariff: '',
        amount: -(r.amount || 0),
        interest: 0,
        vat: 0,
        total: -(r.amount || 0),
        isPayment: true,
      });
    });

    const levyRows = detailedData.filter((d: any) => d.transGroup === 201 && d[monthKey] && d[monthKey] !== 0);
    const serviceMap = new Map<number, any>();
    monthBalData.forEach((sb: any) => {
      if (sb.serviceTypeID) {
        serviceMap.set(sb.serviceTypeID, sb);
      }
    });

    const levyDescMap: Record<number, string> = {
      1: 'Levy - Water Basic',
      2: 'Levy - Water Metered',
      5: 'Levy - Electricity Basic',
      6: 'Levy - Electricity Metered',
      9: 'Levy - Property Rates',
      10: 'Levy - Waste Disposal',
      11: 'Levy - Sanitation Basic',
    };

    levyRows.forEach((d: any) => {
      const svcId = d.serviceTypeId;
      const bal = serviceMap.get(svcId);
      const levyAmount = bal ? (bal.currentCharge || 0) : (d[monthKey] || 0);
      const levyVat = bal ? (bal.vat || 0) : 0;
      const levyInterest = bal ? (bal.interestAmount || 0) : 0;
      const total = d[monthKey] || 0;
      const desc = levyDescMap[svcId] || `Levy - ${d.serviceDesc || 'Unknown'}`;

      rows.push({
        transactionDate: billingDateStr,
        description: desc,
        receiptId: '',
        documentNumber: '',
        tariff: d.serviceDesc || '',
        amount: levyAmount,
        interest: levyInterest,
        vat: levyVat,
        total: total,
        isLevy: true,
      });
    });

    const rebateRows = detailedData.filter((d: any) => (d.transGroup >= 301 && d.transGroup < 600) && d[monthKey] && d[monthKey] !== 0 && d.serviceDesc !== '0 301');
    rebateRows.forEach((d: any) => {
      rows.push({
        transactionDate: billingDateStr,
        description: `Rebate - ${d.serviceDesc || 'Residential'}`,
        receiptId: '',
        documentNumber: '',
        tariff: '',
        amount: d[monthKey] || 0,
        interest: 0,
        vat: 0,
        total: d[monthKey] || 0,
        isRebate: true,
      });
    });

    if (interestVal && interestVal !== 0) {
      rows.push({
        transactionDate: billingDateStr,
        description: 'Interest',
        receiptId: '',
        documentNumber: '',
        tariff: '',
        amount: 0,
        interest: interestVal,
        vat: 0,
        total: interestVal,
        isInterest: true,
      });
    }

    rows.sort((a: any, b: any) => {
      if (a.isSpecial && a.description === 'Open Balance') return -1;
      if (b.isSpecial && b.description === 'Open Balance') return 1;
      const dateA = a.transactionDate || '';
      const dateB = b.transactionDate || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const typeOrder = (r: any) => r.isPayment ? 0 : r.isLevy ? 1 : r.isRebate ? 2 : r.isInterest ? 3 : 4;
      return typeOrder(a) - typeOrder(b);
    });

    const closingInterest = openInterest;
    const closingVat = openVat;
    rows.push({
      transactionDate: billingDateStr,
      description: 'Closing Balance',
      receiptId: '',
      documentNumber: '',
      tariff: '',
      amount: closingVal,
      interest: closingInterest,
      vat: closingVat,
      total: closingVal,
      isSpecial: true,
      isBold: true,
    });

    return rows;
  }, [detailedData, serviceBalanceData, receiptData, selectedMonth, selectedYear]);

  const fmt = (v: any) => {
    if (v === undefined || v === null || v === '') return '';
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return String(v);
    if (num < 0) return `(${Math.abs(num).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})`;
    return num.toLocaleString('en-ZA', { minimumFractionDigits: 2 });
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => load(selectedYear)} />;

  return (
    <div className="p-5 space-y-5" data-testid="detailed-transaction-panel">
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
          {finYearMonths.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-xs" data-testid="detailed-transactions-table">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">Transaction Date &#x25B4;</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">Transaction Description &#x25B4;</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">Receipt ID/ Doc Transaction ID &#x25B4;</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">Document Number &#x25B4;</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">Tariff &#x25B4;</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">Amount &#x25B4;</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">Interest &#x25B4;</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">VAT &#x25B4;</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900">Total &#x25B4;</th>
            </tr>
          </thead>
          <tbody>
            {detailedRows.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-slate-400 py-4">No records to display</td></tr>
            ) : detailedRows.map((row: any, i: number) => (
              <tr
                key={i}
                className={`border-b border-slate-100 ${row.isBold ? 'bg-slate-50 font-bold' : ''} ${row.isPayment ? 'cursor-pointer hover:bg-blue-50 text-red-600' : row.isLevy ? 'hover:bg-slate-50' : 'hover:bg-slate-50'}`}
                onClick={() => row.isPayment && setSelectedTxn(row)}
                data-testid={`detail-row-${i}`}
              >
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.transactionDate}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${row.isBold ? 'font-bold text-slate-900' : row.isSpecial ? 'text-slate-600' : row.isPayment ? 'text-red-600' : 'text-slate-700'}`}>{row.description}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.receiptId || ''}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.documentNumber || ''}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[300px] truncate" title={row.tariff || ''}>{row.tariff || ''}</td>
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
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
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

  const [printingId, setPrintingId] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<any>(null);

  const sortedReceipts = useMemo(() =>
    [...data].sort((a, b) => {
      const da = a.receiptDate ? new Date(a.receiptDate).getTime() : 0;
      const db = b.receiptDate ? new Date(b.receiptDate).getTime() : 0;
      return db - da;
    }),
  [data]);

  const totalAmount = useMemo(() => sortedReceipts.reduce((s, r) => s + (r.amount ?? 0), 0), [sortedReceipts]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const handlePrintReceipt = async (item: any) => {
    const receiptId = item.receiptId || item.receipt_ID;
    if (!receiptId) return;
    setPrintingId(String(receiptId));
    try {
      const params = new URLSearchParams({ receiptId: String(receiptId) });
      const res = await fetch(`/api/proxy/pos-multi-receipt-print?${params.toString()}`);
      if (res.ok) {
        const receiptData = await res.json();
        setReceiptPreview(receiptData);
        setTimeout(() => {
          const printContent = document.getElementById('enquiry-receipt-print');
          if (printContent) {
            const printWindow = window.open('', '_blank', 'width=400,height=600');
            if (printWindow) {
              printWindow.document.write(`<html><head><title>Receipt ${item.receiptNo || receiptId}</title><style>body{font-family:monospace;font-size:12px;padding:20px;max-width:350px;margin:0 auto}table{width:100%;border-collapse:collapse}td{padding:2px 4px}h2,h3{text-align:center;margin:4px 0}.divider{border-top:1px dashed #333;margin:8px 0}.right{text-align:right}.bold{font-weight:bold}@media print{body{padding:0}}</style></head><body>${printContent.innerHTML}<script>window.print();window.close();<\/script></body></html>`);
              printWindow.document.close();
            }
          }
          setReceiptPreview(null);
        }, 500);
      }
    } catch (e) {
      console.error('Failed to fetch receipt for printing:', e);
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {receiptPreview && (
        <div id="enquiry-receipt-print" className="hidden">
          <h2>{receiptPreview.municipalityName || 'George Municipality'}</h2>
          <p style={{textAlign:'center'}}>{receiptPreview.address || ''}</p>
          <div className="divider"></div>
          <p><strong>Receipt:</strong> {receiptPreview.receiptNo || receiptPreview.receiptNumber || ''}</p>
          <p><strong>Date:</strong> {receiptPreview.receiptDate || ''}</p>
          <p><strong>Account:</strong> {receiptPreview.accountNumber || accountNumber}</p>
          <p><strong>Consumer:</strong> {receiptPreview.consumerName || ''}</p>
          <div className="divider"></div>
          {receiptPreview.services && Array.isArray(receiptPreview.services) && receiptPreview.services.map((s: any, si: number) => (
            <p key={si}>{s.serviceDescription || s.description}: R {(s.amount ?? 0).toFixed(2)}</p>
          ))}
          <div className="divider"></div>
          <p className="bold">Total: R {(receiptPreview.totalAmount ?? receiptPreview.amount ?? 0).toFixed(2)}</p>
          <p>Payment: {receiptPreview.paymentType || ''}</p>
          <p>Cashier: {receiptPreview.cashierName || ''}</p>
        </div>
      )}

      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm w-fit">
        {[
          { key: 'receipts', label: 'Receipt History', count: data.length, icon: Receipt },
          { key: 'billing', label: 'Billing Period', count: billingPeriodTxns.length, icon: CalendarDays },
          { key: 'detailed', label: 'Detailed Transactions', count: detailedTxns.length, icon: FileText },
        ].map(sub => {
          const Icon = sub.icon;
          return (
            <button
              key={sub.key}
              onClick={() => setActiveSubTab(sub.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeSubTab === sub.key ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              data-testid={`button-subtab-${sub.key}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {sub.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeSubTab === sub.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{sub.count}</span>
            </button>
          );
        })}
      </div>

      {activeSubTab === 'receipts' && (
        data.length === 0 ? <EmptyState message="No receipt history found" /> : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-white" />
                <h3 className="text-sm font-semibold text-white tracking-wide">Receipt History</h3>
                <Badge className="bg-white/20 text-white border-white/30 text-[10px]">{data.length} receipts</Badge>
              </div>
              <div className="text-white text-sm font-mono font-bold">
                Total: R {totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-transaction-history">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Receipt No.</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Payment Type</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Card/Cheque Detail</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Cashier</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Cash Book</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                    <th className="text-center py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReceipts.map((item: any, i: number) => (
                    <tr key={item.receiptId || i} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${item.isCancelled ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2.5 px-3 font-mono text-blue-700 font-semibold whitespace-nowrap text-xs">{item.receiptNo || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{item.receiptDate ? new Date(item.receiptDate).toLocaleDateString('en-ZA') : '-'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          (item.paymentType || '').toLowerCase().includes('cash') ? 'bg-green-50 text-green-700 border border-green-200' :
                          (item.paymentType || '').toLowerCase().includes('eft') ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          (item.paymentType || '').toLowerCase().includes('card') ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}>
                          {(item.paymentType || '').toLowerCase().includes('cash') && <Banknote className="w-3 h-3" />}
                          {(item.paymentType || '').toLowerCase().includes('card') && <CreditCard className="w-3 h-3" />}
                          {item.paymentType || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(item.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{item.cardChequeDetail || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs font-medium">{item.cashierName || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{item.cashBook || '-'}</td>
                      <td className="py-2.5 px-3">
                        {item.isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                            <X className="w-3 h-3" /> Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <Activity className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handlePrintReceipt(item)}
                          disabled={printingId === String(item.receiptId || item.receipt_ID) || !item.receiptId}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[10px] font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                          data-testid={`button-print-receipt-${i}`}
                          title="Print Receipt"
                        >
                          {printingId === String(item.receiptId || item.receipt_ID) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileText className="w-3 h-3" />
                          )}
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {activeSubTab === 'billing' && (
        billingPeriodTxns.length === 0 ? <EmptyState message="No billing period transactions found" /> : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white" />
              <h3 className="text-sm font-semibold text-white tracking-wide">Billing Period Transactions</h3>
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{billingPeriodTxns.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-billing-period-transactions">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Period</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Debit</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Credit</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {billingPeriodTxns.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">{item.period || item.billingPeriod || '-'}</td>
                      <td className="py-2.5 px-3">{item.description || item.transactionDescription || '-'}</td>
                      <td className="py-2.5 px-3">{item.serviceType || item.serviceDescription || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600">{(item.debit ?? item.debitAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-600">{(item.credit ?? item.creditAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(item.balance ?? item.runningBalance ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {activeSubTab === 'detailed' && (
        detailedTxns.length === 0 ? <EmptyState message="No detailed transactions found" /> : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white" />
              <h3 className="text-sm font-semibold text-white tracking-wide">Detailed Transactions</h3>
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{detailedTxns.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-detailed-transactions">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedTxns.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-purple-50/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-600">{item.transactionDate ? new Date(item.transactionDate).toLocaleDateString('en-ZA') : item.date || '-'}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">{item.transactionType || item.type || '-'}</span>
                      </td>
                      <td className="py-2.5 px-3">{item.description || item.transactionDescription || '-'}</td>
                      <td className="py-2.5 px-3">{item.serviceType || item.serviceDescription || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(item.amount ?? item.transactionAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs font-mono">{item.reference || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  const [showPrepaidSales, setShowPrepaidSales] = useState(false);
  const [selectedPrepaidMeter, setSelectedPrepaidMeter] = useState<any>(null);
  const [prepaidRechargeDetails, setPrepaidRechargeDetails] = useState<any[]>([]);
  const [loadingRecharge, setLoadingRecharge] = useState(false);
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
    <div className="p-5 space-y-5">
      {allServices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">All Services</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{allServices.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-all-services">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service ID</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Tariff</th>
                </tr>
              </thead>
              <tbody>
                {allServices.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
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
        </div>
      )}

      {meteredServices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-600 to-teal-700 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Metered Services</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{meteredServices.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-metered-services">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Number</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Last Reading</th>
                </tr>
              </thead>
              <tbody>
                {meteredServices.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
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
        </div>
      )}

      {meterPerProperty.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Meters Per Property</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{meterPerProperty.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-meter-per-property">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Property</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {meterPerProperty.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2 px-3">{m.propertyDescription || m.propertyId || '-'}</td>
                    <td className="py-2 px-3">{m.serviceType || m.serviceDescription || '-'}</td>
                    <td className="py-2 px-3 font-mono">{m.meterNumber || m.physicalMeterNumber || '-'}</td>
                    <td className="py-2 px-3">{m.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {unitLinkedMeters.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-violet-700 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Unit Linked Meters</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{unitLinkedMeters.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-unit-linked-meters">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Number</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {unitLinkedMeters.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2 px-3 font-mono">{m.meterNumber || m.physicalMeterNumber || '-'}</td>
                    <td className="py-2 px-3">{m.serviceType || m.serviceDescription || '-'}</td>
                    <td className="py-2 px-3">{m.meterType || '-'}</td>
                    <td className="py-2 px-3">{m.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {prepaidMeters.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-white" />
              <h3 className="text-sm font-semibold text-white tracking-wide">Prepaid Meter Services</h3>
              <Badge className="bg-white/20 text-white border-white/30 text-[10px]">{prepaidMeters.length}</Badge>
            </div>
            <button
              onClick={() => { setShowPrepaidSales(true); setSelectedPrepaidMeter(null); setPrepaidRechargeDetails([]); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-all border border-white/30"
              data-testid="button-open-prepaid-sales"
            >
              <Eye className="w-3.5 h-3.5" />
              Prepaid Sales
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-prepaid-meters">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Number</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Last Recharge</th>
                </tr>
              </thead>
              <tbody>
                {prepaidMeters.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => { setShowPrepaidSales(true); setSelectedPrepaidMeter(null); setPrepaidRechargeDetails([]); }} data-testid={`prepaid-meter-row-${i}`}>
                    <td className="py-2 px-3 font-mono font-medium text-blue-700">{m.meterNumber || m.physicalMeterNumber || '-'}</td>
                    <td className="py-2 px-3">{m.serviceType || m.serviceDescription || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.meterStatus || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {m.status || m.meterStatus || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{m.lastRechargeDate ? new Date(m.lastRechargeDate).toLocaleDateString('en-ZA') : (m.lastRechargeAmount ?? '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPrepaidSales && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPrepaidSales(false)} data-testid="prepaid-sales-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-700 to-emerald-800 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-white" />
                <h4 className="text-base font-bold text-white">Prepaid Sales</h4>
              </div>
              {selectedPrepaidMeter && (
                <button
                  onClick={() => { setSelectedPrepaidMeter(null); setPrepaidRechargeDetails([]); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-all"
                  data-testid="button-prepaid-back"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
            </div>
            <div className="p-6">
              {!selectedPrepaidMeter ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-prepaid-sales">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service Type</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter No</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Phase</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Tariff</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Physical Meter No</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Connection Size</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Status</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Factor</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Classification</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">STS Code</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Supplier Group Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prepaidMeters.length === 0 ? (
                        <tr><td colSpan={11} className="text-center text-slate-400 py-6">No prepaid meters found</td></tr>
                      ) : prepaidMeters.map((m: any, i: number) => (
                        <tr
                          key={i}
                          className="border-b border-slate-100 hover:bg-emerald-50/40 transition-colors cursor-pointer"
                          onClick={async () => {
                            setSelectedPrepaidMeter(m);
                            setLoadingRecharge(true);
                            setPrepaidRechargeDetails([]);
                            try {
                              const meterId = m.meterId || m.meter_id || m.id;
                              if (meterId) {
                                const details = await getPrepaidRechargeDetailsForMeter(meterId);
                                setPrepaidRechargeDetails(Array.isArray(details) ? details : []);
                              }
                            } catch (e) {
                              console.error('Failed to load recharge details:', e);
                            } finally {
                              setLoadingRecharge(false);
                            }
                          }}
                          data-testid={`prepaid-sales-row-${i}`}
                        >
                          <td className="py-2.5 px-3 font-medium">{m.serviceType || m.serviceDescription || 'Electricity Pre-Paid'}</td>
                          <td className="py-2.5 px-3 font-mono text-blue-700 font-semibold">{m.meterNumber || m.meterNo || '-'}</td>
                          <td className="py-2.5 px-3">{m.meterPhase || m.phase || '-'}</td>
                          <td className="py-2.5 px-3 text-xs">{m.tariff || m.tariffDescription || '-'}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</td>
                          <td className="py-2.5 px-3">{m.meterConnectionSize || m.connectionSize || '-'}</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.meterStatus || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              {m.status || m.meterStatus || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{m.factor ?? '-'}</td>
                          <td className="py-2.5 px-3">{m.meterClassification || m.classification || '-'}</td>
                          <td className="py-2.5 px-3 font-mono">{m.stsCode ?? '-'}</td>
                          <td className="py-2.5 px-3 font-mono">{m.supplierGroupCode ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Service Type</span>
                        <p className="font-medium text-slate-800 mt-0.5">{selectedPrepaidMeter.serviceType || selectedPrepaidMeter.serviceDescription || 'Electricity Pre-Paid'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Meter No</span>
                        <p className="font-mono font-bold text-blue-700 mt-0.5">{selectedPrepaidMeter.meterNumber || selectedPrepaidMeter.meterNo || '-'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Physical Meter</span>
                        <p className="font-mono text-slate-800 mt-0.5">{selectedPrepaidMeter.physicalMeterNumber || selectedPrepaidMeter.physicalMeterNo || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {loadingRecharge ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading recharge details...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-prepaid-recharge-details">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Receipt Date</th>
                            <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Receipt No</th>
                            <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                            <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Vat Amount</th>
                            <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Total</th>
                            <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Prepaid Unit</th>
                            <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                            <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Prepaid Token No</th>
                            <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Cancelled Status</th>
                            <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reason For Cancel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prepaidRechargeDetails.length === 0 ? (
                            <tr><td colSpan={10} className="text-center text-slate-400 py-6">No recharge details found for this meter</td></tr>
                          ) : prepaidRechargeDetails.map((r: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors" data-testid={`recharge-detail-row-${i}`}>
                              <td className="py-2.5 px-3 text-slate-600">{r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-ZA') : r.rechargeDate ? new Date(r.rechargeDate).toLocaleDateString('en-ZA') : '-'}</td>
                              <td className="py-2.5 px-3 font-mono text-blue-700 font-semibold text-xs">{r.receiptNo || r.receiptNumber || '-'}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{(r.amount ?? r.rechargeAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{(r.vatAmount ?? r.vat ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(r.total ?? r.totalAmount ?? ((r.amount ?? 0) + (r.vatAmount ?? 0))).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{r.prepaidUnit ?? r.units ?? r.kwhUnits ?? '-'}</td>
                              <td className="py-2.5 px-3">{r.type || r.rechargeType || r.transactionType || '-'}</td>
                              <td className="py-2.5 px-3 font-mono text-xs">{r.prepaidTokenNo || r.tokenNumber || r.token || '-'}</td>
                              <td className="py-2.5 px-3">
                                {r.isCancelled || r.cancelledStatus === 'Yes' ? (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">Yes</span>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">No</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-xs">{r.reasonForCancel || r.cancelReason || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-center pt-4">
                <button onClick={() => setShowPrepaidSales(false)} className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white text-sm font-semibold rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all shadow-md" data-testid="button-close-prepaid-sales">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
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
    <div className="p-5 space-y-5">
      {(remainingCapital || repaymentStatus) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {remainingCapital && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-white" />
                <h3 className="text-sm font-semibold text-white tracking-wide">Remaining Capital</h3>
              </div>
              <div className="p-5">
                {typeof remainingCapital === 'object' ? (
                  Object.entries(remainingCapital).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
                    <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
                  ))
                ) : (
                  <FieldRow label="Remaining Capital" value={remainingCapital} />
                )}
              </div>
            </div>
          )}
          {repaymentStatus && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-white" />
                <h3 className="text-sm font-semibold text-white tracking-wide">Repayment Plan Status</h3>
              </div>
              <div className="p-5">
                {typeof repaymentStatus === 'object' ? (
                  Object.entries(repaymentStatus).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
                    <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
                  ))
                ) : (
                  <FieldRow label="Status" value={repaymentStatus} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {plans.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-600 to-slate-700 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Payment Plans</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{plans.length}</Badge>
          </div>
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
        </div>
      )}

      {extensions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Payment Extensions</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{extensions.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-payment-extensions">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Extension Type</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {extensions.map((ext: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
                    <td className="py-2 px-3">{ext.extensionDate ? new Date(ext.extensionDate).toLocaleDateString('en-ZA') : ext.date || '-'}</td>
                    <td className="py-2 px-3">{ext.extensionType || ext.type || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono">{(ext.amount ?? ext.extensionAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3">{ext.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paymentAmounts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Payment Amounts</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{paymentAmounts.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-payment-amounts">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                </tr>
              </thead>
              <tbody>
                {paymentAmounts.map((pa: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors">
                    <td className="py-2 px-3">{pa.description || pa.paymentDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(pa.amount ?? pa.paymentAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-slate-500">{pa.paymentDate ? new Date(pa.paymentDate).toLocaleDateString('en-ZA') : '-'}</td>
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
    <div className="p-5 space-y-5" data-testid="payment-extension-history-panel">
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
    <div className="p-5 space-y-5">
      {deductions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Debit Order Deductions</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{deductions.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-debit-order-deductions">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Bank</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Account</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((d: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
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
        </div>
      )}

      {debitOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Debit Orders</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{debitOrders.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-debit-orders">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Bank</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Branch</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Account Holder</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Account Type</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Day of Deduction</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
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
        </div>
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
    <div className="p-5 space-y-5">
      {ratesDetails.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 flex items-center gap-2">
            <Scale className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Account Rates Details</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{ratesDetails.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-rates-details">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Category</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Market Value</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Rateable Value</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Rate</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                {ratesDetails.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
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
        </div>
      )}

      {ratesHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Rates Run History</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{ratesHistory.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-rates-run-history">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Run Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Period</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {ratesHistory.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
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
        </div>
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
    <div className="p-5 space-y-5">
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-orange-600 to-orange-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Account Notifications</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{accountNotifs.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-account-notifications">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Message</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Created By</th>
                </tr>
              </thead>
              <tbody>
                {accountNotifs.map((n: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
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
        </div>
      )}
    </div>
  );
}

function StatementsTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [statementType, setStatementType] = useState<'account' | 'detailed'>('account');
  const years = useMemo(() => getFinYearOptions(), []);
  const [modalYear, setModalYear] = useState(years[0]);
  const [modalMonth, setModalMonth] = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<any>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getGeneratedStatements(accountId);
      setData(Array.isArray(result) ? result : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  const filteredData = useMemo(() => {
    return data.filter(s => {
      const yearMatch = !modalYear || s.financialYear === modalYear;
      const monthMatch = !modalMonth || s.month === modalMonth;
      return yearMatch && monthMatch;
    });
  }, [data, modalYear, modalMonth]);

  const monthsInData = useMemo(() => {
    const mSet = new Set<string>();
    data.forEach(s => { if (s.month) mSet.add(s.month); });
    return Array.from(mSet);
  }, [data]);

  const handleGenerateStatement = async () => {
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch('/api/platinum/billing-enquiry/generate-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, statementType, financialYear: modalYear, month: modalMonth || undefined }),
      });
      const result = await res.json();
      setGenerateResult(result);
      await load();
    } catch (e: any) {
      setGenerateResult({ error: e.message || 'Failed to generate statement' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (statement: any) => {
    const id = statement.accountstatement_id;
    setDownloading(id);
    try {
      const filePath = statement.filePath || statement.fileUrl || statement.file_path;
      if (filePath) {
        window.open(`/api/platinum/statement-download?fileUrl=${encodeURIComponent(filePath)}`, '_blank');
      } else {
        const res = await fetch(`/api/platinum/billing-enquiry/check-file-exists?fileUrl=${encodeURIComponent(statement.accountstatement_id || '')}`);
        const result = await res.json();
        if (result && (result === true || result?.exists || result?.filePath)) {
          const url = result?.filePath || result?.fileUrl || '';
          if (url) {
            window.open(`/api/platinum/statement-download?fileUrl=${encodeURIComponent(url)}`, '_blank');
          } else {
            alert('Statement file path not found.');
          }
        } else {
          alert('Statement file is not available for download at this time.');
        }
      }
    } catch {
      alert('Failed to download statement.');
    } finally {
      setDownloading(null);
    }
  };

  const accountNumber = String(accountId).padStart(12, '0');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="p-5 space-y-5" data-testid="statements-panel">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Generated Statements</h3>
            <Badge className="bg-white/20 text-white border-white/30 text-[10px]">{data.length}</Badge>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-all border border-white/30"
            data-testid="button-open-stmt-modal"
          >
            <Download className="w-3.5 h-3.5" />
            Generate / Download
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-statements">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Statement Date</th>
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Period</th>
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                <th className="text-center py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Download</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    <span className="text-sm">No generated statements available</span>
                    <button onClick={() => setShowModal(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium" data-testid="button-generate-first">Click here to generate a statement</button>
                  </div>
                </td></tr>
              ) : data.map((s: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors" data-testid={`statement-row-${i}`}>
                  <td className="py-2.5 px-3 text-slate-600">{s.statementDate ? new Date(s.statementDate).toLocaleDateString('en-ZA') : '-'}</td>
                  <td className="py-2.5 px-3 font-medium">{s.month ? `${s.financialYear} - ${s.month}` : s.period || '-'}</td>
                  <td className="py-2.5 px-3">{s.description || s.statementDescription || 'Account Statement'}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(s.amount ?? s.totalAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {s.statementType || s.type || 'Standard'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => handleDownload(s)}
                      disabled={downloading === s.accountstatement_id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm disabled:opacity-40"
                      title="Download Statement PDF"
                      data-testid={`btn-download-stmt-${i}`}
                    >
                      {downloading === s.accountstatement_id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)} data-testid="statement-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-700 to-slate-800 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-white" />
                <h4 className="text-base font-bold text-white">Account Summary</h4>
              </div>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" data-testid="button-close-stmt-x">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                  <input type="radio" name="stmtType" checked={statementType === 'account'} onChange={() => setStatementType('account')} className="w-4 h-4 text-blue-600" data-testid="radio-account-statement" />
                  <span className={`font-medium ${statementType === 'account' ? 'text-blue-700' : 'text-slate-600'}`}>Account Statement</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                  <input type="radio" name="stmtType" checked={statementType === 'detailed'} onChange={() => setStatementType('detailed')} className="w-4 h-4 text-blue-600" data-testid="radio-detailed-statement" />
                  <span className={`font-medium ${statementType === 'detailed' ? 'text-blue-700' : 'text-slate-600'}`}>Detailed Account Statement</span>
                </label>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Account</span>
                  <span className="text-sm font-mono font-bold text-blue-800">{accountNumber}</span>
                </div>
                <select value={modalYear} onChange={e => setModalYear(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" data-testid="select-stmt-year">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={modalMonth} onChange={e => setModalMonth(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" data-testid="select-stmt-month">
                  <option value="">All Months</option>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleGenerateStatement}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md disabled:opacity-50"
                  data-testid="button-submit-stmt"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Submit
                    </>
                  )}
                </button>
              </div>

              {generateResult && (
                <div className={`p-3 rounded-lg text-sm ${generateResult.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                  {generateResult.error || 'Statement generated successfully. Check the table below for download.'}
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm" data-testid="table-stmt-download">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Financial Year</th>
                      <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Month</th>
                      <th className="text-center px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr><td colSpan={3} className="text-center text-slate-400 py-6 text-sm">No statements found for selected period</td></tr>
                    ) : filteredData.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors" data-testid={`stmt-download-row-${i}`}>
                        <td className="px-4 py-3 text-slate-700 font-medium">{s.financialYear}</td>
                        <td className="px-4 py-3 text-slate-700">{s.month}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDownload(s)}
                            disabled={downloading === s.accountstatement_id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm disabled:opacity-40"
                            title="Download Statement PDF"
                            data-testid={`btn-download-stmt-${i}`}
                          >
                            {downloading === s.accountstatement_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {filteredData.length === 0 ? '0 of 0' : `1 – ${filteredData.length} of ${filteredData.length}`} statements
                </div>
                <button onClick={() => setShowModal(false)} className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white text-sm font-semibold rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all shadow-md" data-testid="button-close-stmt-modal">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
    <div className="p-5 space-y-5">
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
  const [showProofModal, setShowProofModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addIdNumber, setAddIdNumber] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<number | null>(null);
  const [proofData, setProofData] = useState<{ property: any; nameInfo: any } | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const loaded = useRef(false);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOccupiers(accountId);
      setData(Array.isArray(result) ? result : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load occupiers data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  const handleAdd = async () => {
    if (!addName.trim()) return;
    setAddLoading(true);
    try {
      await addOccupier({ accountId, name: addName.trim(), idNumber: addIdNumber.trim() });
      setAddName('');
      setAddIdNumber('');
      setShowAddModal(false);
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to add occupier');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (occupier: any) => {
    const id = occupier.occupierId || occupier.id || occupier.occupier_ID;
    if (!id) { alert('Cannot identify occupier to remove'); return; }
    if (!confirm(`Remove occupier "${occupier.name || occupier.occupierName || 'this person'}"?`)) return;
    setRemoveLoading(id);
    try {
      await deleteOccupier(id);
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to remove occupier');
    } finally {
      setRemoveLoading(null);
    }
  };

  const handleProofOfResidence = async () => {
    setProofLoading(true);
    try {
      const [propResp, nameResp] = await Promise.all([
        fetch(`/api/platinum/billing-enquiry/property-details-by-account?accountId=${accountId}`).then(r => r.json()).catch(() => null),
        fetch(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`).then(r => r.json()).catch(() => null),
      ]);
      setProofData({ property: propResp, nameInfo: nameResp });
      setShowProofModal(true);
    } catch {
      alert('Failed to load property details for proof of residence');
    } finally {
      setProofLoading(false);
    }
  };

  const handlePrintProof = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Proof of Residence</title><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
      .proof-container { max-width: 700px; margin: 0 auto; border: 1px solid #333; padding: 30px; }
      .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
      .header-center { text-align: center; font-weight: bold; font-size: 16px; }
      .header-left { font-size: 12px; line-height: 1.6; }
      .header-right { font-size: 12px; line-height: 1.6; text-align: right; }
      .date-line { text-align: right; margin: 10px 0 25px; font-weight: bold; }
      .title { font-size: 18px; font-weight: bold; margin: 20px 0; }
      .detail { margin: 8px 0 8px 40px; font-size: 14px; }
      .detail-label { font-weight: bold; }
      .address-block { margin: 15px 0 15px 40px; line-height: 1.8; font-size: 14px; }
      .footer { margin-top: 80px; font-weight: bold; font-size: 14px; }
      @media print { body { margin: 0; } .proof-container { border: none; } }
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const accountNumber = String(accountId).padStart(12, '0');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="p-5 space-y-5" data-testid="occupiers-panel">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors" data-testid="button-add-occupier">Add</button>
        <button onClick={() => { const sel = data.find((_, i) => document.querySelector(`[data-testid="occupier-row-${i}"]`)?.classList.contains('bg-blue-50')); if (sel) handleRemove(sel); else if (data.length > 0) alert('Select an occupier to remove'); }} className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors" data-testid="button-remove-occupier">Remove Occupiers</button>
        <button onClick={handleProofOfResidence} disabled={proofLoading} className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors disabled:opacity-50" data-testid="button-proof-of-residence">
          {proofLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
          Proof of Residence
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-sm" data-testid="table-occupiers">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left py-2 px-3 font-semibold text-slate-700">Name</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-700">ID Number</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={2} className="text-center text-slate-400 py-4 italic">No records to display.</td></tr>
            ) : data.map((o: any, i: number) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors" data-testid={`occupier-row-${i}`} onClick={e => {
                document.querySelectorAll('[data-testid^="occupier-row-"]').forEach(el => el.classList.remove('bg-blue-50'));
                (e.currentTarget as HTMLElement).classList.add('bg-blue-50');
              }}>
                <td className="py-2 px-3 font-medium">{o.name || o.occupierName || o.surname || '-'}</td>
                <td className="py-2 px-3 font-mono text-xs">{o.idNumber || o.idRegistrationNumber || o.idNo || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
        <span>Items per page: <span className="border rounded px-2 py-0.5">50</span></span>
        <span>{data.length === 0 ? '0 of 0' : `1 - ${data.length} of ${data.length}`}</span>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)} data-testid="add-occupier-modal">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h4 className="text-sm font-bold text-slate-700">Add Occupier</h4>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={addName} onChange={e => setAddName(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Full name" data-testid="input-occupier-name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SA ID Number</label>
                <input type="text" value={addIdNumber} onChange={e => setAddIdNumber(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" placeholder="ID Number" data-testid="input-occupier-id" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-300 text-sm rounded hover:bg-slate-50" data-testid="button-cancel-add">Cancel</button>
                <button onClick={handleAdd} disabled={addLoading || !addName.trim()} className="px-4 py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-700 disabled:opacity-50" data-testid="button-confirm-add">
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProofModal && proofData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowProofModal(false)} data-testid="proof-of-residence-modal">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700">Proof of Residence</h4>
              <div className="flex gap-2">
                <button onClick={handlePrintProof} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700" data-testid="button-print-proof">Print</button>
                <button onClick={() => setShowProofModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">&times;</button>
              </div>
            </div>
            <div className="p-5">
              <div ref={printRef}>
                <div className="proof-container border border-slate-300 p-8 max-w-[700px] mx-auto bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
                  <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-5">
                    <div className="text-xs leading-relaxed">
                      <div>71  York Street</div>
                      <div>George</div>
                      <div>George - 6530</div>
                    </div>
                    <div className="text-center font-bold text-base">George UAT Municipality</div>
                    <div className="text-xs leading-relaxed text-right">
                      <div>Tel: 044 8019111</div>
                      <div>Fax: 086 5896402</div>
                      <div>Email: accounts@george.gov.za</div>
                      <div>Website: https://www.george.gov.za/</div>
                      <div>Municipality VAT No:- 4630193664</div>
                    </div>
                  </div>

                  <div className="text-right font-bold mb-6">Date : {new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>

                  <h2 className="text-xl font-bold mb-6">PROOF OF RESIDENTIAL ADDRESS</h2>

                  <p className="mb-4 text-sm">It is hereby certified that</p>

                  <div className="ml-10 space-y-2 text-sm">
                    <p><span className="font-bold">Name:</span> {proofData.nameInfo?.firstNames} {proofData.nameInfo?.surname_Company}</p>
                    <p><span className="font-bold">ID Number:</span> {proofData.nameInfo?.idNo_RegistrationNo || '-'}</p>
                    <p><span className="font-bold">Account Number:</span> {accountNumber}</p>
                    <p><span className="font-bold">Erf Number:</span> {(() => { const sg = proofData.property?.sgNumber || ''; const parts = sg.split('/'); return parts.length >= 3 ? parts[2] : ''; })()}</p>
                  </div>

                  <p className="mt-6 mb-3 text-sm">are according to our records residing at :</p>

                  <div className="ml-10 text-sm leading-relaxed">
                    <p>{proofData.property?.streetName} {proofData.property?.streetNumber}</p>
                    <p>{proofData.property?.suburb || proofData.property?.town}</p>
                    <p>{proofData.property?.town}</p>
                    <p>6530</p>
                  </div>

                  <div className="mt-24 font-bold text-sm">Municipal Manager</div>
                </div>
              </div>
            </div>
            <div className="flex justify-center pb-5">
              <button onClick={() => setShowProofModal(false)} className="px-6 py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-700" data-testid="button-close-proof">Close</button>
            </div>
          </div>
        </div>
      )}
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
      className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-[420px] overflow-hidden flex flex-col"
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
                          <div key={si} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${isActive ? 'bg-green-50/60 border border-green-100' : 'bg-slate-50 border border-slate-100'}`} data-testid={`service-item-${aid}-${si}`}>
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

    const tabItems: { value: string; label: string; icon: React.ReactNode; color: string }[] = [
      { value: 'account', label: 'Account', icon: <User className="w-4 h-4" />, color: 'blue' },
      { value: 'name', label: 'Name', icon: <Users className="w-4 h-4" />, color: 'indigo' },
      { value: 'balance', label: 'Balance/Debt', icon: <CreditCard className="w-4 h-4" />, color: 'red' },
      { value: 'services', label: 'Services', icon: <Layers className="w-4 h-4" />, color: 'emerald' },
      { value: 'property', label: 'Property', icon: <Home className="w-4 h-4" />, color: 'amber' },
      { value: 'consumption', label: 'Consumption', icon: <Droplets className="w-4 h-4" />, color: 'cyan' },
      { value: 'contact', label: 'Contact', icon: <Phone className="w-4 h-4" />, color: 'violet' },
      { value: 'handover', label: 'Handover', icon: <ArrowRight className="w-4 h-4" />, color: 'orange' },
      { value: 'incentives', label: 'Incentives', icon: <Gift className="w-4 h-4" />, color: 'pink' },
      { value: 'deposits', label: 'Deposits', icon: <Banknote className="w-4 h-4" />, color: 'lime' },
      { value: 'transactions', label: 'Receipts', icon: <Receipt className="w-4 h-4" />, color: 'blue' },
      { value: 'txn-summary', label: 'Txn Summary', icon: <FileText className="w-4 h-4" />, color: 'slate' },
      { value: 'txn-detailed', label: 'Txn Detail', icon: <Activity className="w-4 h-4" />, color: 'indigo' },
      { value: 'services-meters', label: 'Meters', icon: <Gauge className="w-4 h-4" />, color: 'emerald' },
      { value: 'payment-plans', label: 'Pay Plans', icon: <CalendarDays className="w-4 h-4" />, color: 'purple' },
      { value: 'payment-extensions', label: 'Extensions', icon: <Clock className="w-4 h-4" />, color: 'amber' },
      { value: 'debit-orders', label: 'Debit Orders', icon: <Landmark className="w-4 h-4" />, color: 'teal' },
      { value: 'rates', label: 'Rates', icon: <Scale className="w-4 h-4" />, color: 'orange' },
      { value: 'notifications', label: 'Notifications', icon: <AlertCircle className="w-4 h-4" />, color: 'yellow' },
      { value: 'statements', label: 'Statements', icon: <FileText className="w-4 h-4" />, color: 'blue' },
      { value: 'clearance', label: 'Clearance', icon: <Shield className="w-4 h-4" />, color: 'emerald' },
      { value: 'debtor-notes', label: 'Debtor Notes', icon: <Briefcase className="w-4 h-4" />, color: 'red' },
      { value: 'section129', label: 'Section 129', icon: <AlertTriangle className="w-4 h-4" />, color: 'rose' },
      { value: 'occupiers', label: 'Occupiers', icon: <Users className="w-4 h-4" />, color: 'violet' },
    ];

    const tabColorMap: Record<string, { bg: string; border: string; text: string; iconBg: string; activeBg: string; activeBorder: string; activeText: string; activeIconBg: string }> = {
      blue: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-blue-50 text-blue-500', activeBg: 'bg-blue-50', activeBorder: 'border-blue-400 ring-1 ring-blue-200', activeText: 'text-blue-800', activeIconBg: 'bg-blue-500 text-white' },
      indigo: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-indigo-50 text-indigo-500', activeBg: 'bg-indigo-50', activeBorder: 'border-indigo-400 ring-1 ring-indigo-200', activeText: 'text-indigo-800', activeIconBg: 'bg-indigo-500 text-white' },
      red: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-red-50 text-red-500', activeBg: 'bg-red-50', activeBorder: 'border-red-400 ring-1 ring-red-200', activeText: 'text-red-800', activeIconBg: 'bg-red-500 text-white' },
      emerald: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-emerald-50 text-emerald-500', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-400 ring-1 ring-emerald-200', activeText: 'text-emerald-800', activeIconBg: 'bg-emerald-500 text-white' },
      amber: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-amber-50 text-amber-600', activeBg: 'bg-amber-50', activeBorder: 'border-amber-400 ring-1 ring-amber-200', activeText: 'text-amber-800', activeIconBg: 'bg-amber-500 text-white' },
      cyan: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-cyan-50 text-cyan-500', activeBg: 'bg-cyan-50', activeBorder: 'border-cyan-400 ring-1 ring-cyan-200', activeText: 'text-cyan-800', activeIconBg: 'bg-cyan-500 text-white' },
      violet: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-violet-50 text-violet-500', activeBg: 'bg-violet-50', activeBorder: 'border-violet-400 ring-1 ring-violet-200', activeText: 'text-violet-800', activeIconBg: 'bg-violet-500 text-white' },
      orange: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-orange-50 text-orange-500', activeBg: 'bg-orange-50', activeBorder: 'border-orange-400 ring-1 ring-orange-200', activeText: 'text-orange-800', activeIconBg: 'bg-orange-500 text-white' },
      pink: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-pink-50 text-pink-500', activeBg: 'bg-pink-50', activeBorder: 'border-pink-400 ring-1 ring-pink-200', activeText: 'text-pink-800', activeIconBg: 'bg-pink-500 text-white' },
      lime: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-lime-50 text-lime-600', activeBg: 'bg-lime-50', activeBorder: 'border-lime-400 ring-1 ring-lime-200', activeText: 'text-lime-800', activeIconBg: 'bg-lime-500 text-white' },
      slate: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-slate-100 text-slate-500', activeBg: 'bg-slate-100', activeBorder: 'border-slate-400 ring-1 ring-slate-300', activeText: 'text-slate-800', activeIconBg: 'bg-slate-600 text-white' },
      purple: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-purple-50 text-purple-500', activeBg: 'bg-purple-50', activeBorder: 'border-purple-400 ring-1 ring-purple-200', activeText: 'text-purple-800', activeIconBg: 'bg-purple-500 text-white' },
      teal: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-teal-50 text-teal-500', activeBg: 'bg-teal-50', activeBorder: 'border-teal-400 ring-1 ring-teal-200', activeText: 'text-teal-800', activeIconBg: 'bg-teal-500 text-white' },
      yellow: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-yellow-50 text-yellow-600', activeBg: 'bg-yellow-50', activeBorder: 'border-yellow-400 ring-1 ring-yellow-200', activeText: 'text-yellow-800', activeIconBg: 'bg-yellow-500 text-white' },
      rose: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', iconBg: 'bg-rose-50 text-rose-500', activeBg: 'bg-rose-50', activeBorder: 'border-rose-400 ring-1 ring-rose-200', activeText: 'text-rose-800', activeIconBg: 'bg-rose-500 text-white' },
    };

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
            <div className="shrink-0 bg-gradient-to-b from-white to-slate-50/80 border-b border-slate-200 sticky top-0 z-20">
              <div className="px-3 sm:px-4 py-2.5">
                <TabsList className="h-auto bg-transparent p-0 w-full block">
                  <div className="flex flex-wrap gap-1.5">
                    {tabItems.map(tab => {
                      const colors = tabColorMap[tab.color] || tabColorMap.blue;
                      const isTabActive = activeTab === tab.value;
                      return (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className={`
                            inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold
                            transition-all duration-200 cursor-pointer shadow-sm
                            ${isTabActive
                              ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText} shadow-md`
                              : `${colors.bg} ${colors.border} ${colors.text} hover:shadow-md hover:border-slate-300 hover:-translate-y-[1px]`
                            }
                          `}
                          data-testid={`tab-${tab.value}`}
                        >
                          <span className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors ${isTabActive ? colors.activeIconBg : colors.iconBg}`}>
                            {tab.icon}
                          </span>
                          {tab.label}
                        </TabsTrigger>
                      );
                    })}
                  </div>
                </TabsList>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-50/80 to-slate-100/50">
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
              <TabsContent value="txn-summary" className="m-0"><TransactionSummaryTab accountId={accountId} accountNumber={selectedAccount.accountNumber || selectedAccount.oldAccountCode || String(selectedAccount.account_ID || selectedAccount.accountID)} /></TabsContent>
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
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400
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
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-50 px-4 py-3">
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
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-2">
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
