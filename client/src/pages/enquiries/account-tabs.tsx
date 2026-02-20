import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User, Building2, MapPin, Phone, CreditCard, FileText, Shield,
  Gift, Landmark, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  RefreshCw, AlertTriangle, Search, Eye,
  Briefcase, Heart, Users, Receipt, Banknote, Scale, Gauge,
  Home, Layers, Download, Printer, FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  searchAccounts, getAccountBalance, getServiceTypeBalance,
  getPropertyDetails, getConsumptionUnits, getNameInfo, getAccountsByNameId,
  getHandoverInfo, getPaymentIncentive, getDeposits, getDepositAmount,
  getTransactionHistory, getAccountInformation,
  getBasicAccountDetails, getAccountInfoResult, getUnitPartitionOwner,
  getDepartmentalAccountsById,
  getSectionalTitleScheme, getPartitionDetails, getPartitionDetailsByUnit,
  getAccountDeliveryAddressDetail,
  getRepaymentPlanStatus,
  getServicesSearchResults, getAdditionalBillingSearchResults,
  getChequeFinalSearchList,
  getSupplementaryValuations,
  getPaymentPlanRemainingCapital, getAccountRatesDetails,
  getLinkedAccountsOnProperty, getPaymentPlansByAccountId,
  type EnquirySearchResult,
  type EnquirySearchCriteria,
} from '@/lib/enquiries-service';
import { platinumPrintReceiptRaw, fetchPosMultiReceiptPrint } from '@/lib/external-api';
import { openSlipPrintWindow, ReceiptPrintData } from '@/lib/receipt-print';
import { LoadingSkeleton, EmptyState, ErrorState, InfoField, SectionHeader, PaginatedTable, FieldRow, TabCard, getFinYearOptions } from './shared';
import { downloadExcel } from '@/lib/excel-export';

export function AccountInfoTab({ account }: { account: EnquirySearchResult }) {
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

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    account: true, additional: true, property: true, partition: false,
    delivery: false, services: false, addBilling: false, addInfo: false,
  });
  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const safeStr = (v: any): string => {
    if (v === null || v === undefined || v === '' || v === 'null') return '-';
    return String(v).trim() || '-';
  };

  const statusColor = (s: any) => {
    const sl = safeStr(s).toLowerCase();
    if (sl === 'active' || sl === 'approved' || sl === 'registered') return 'bg-green-100 text-green-800 border-green-200';
    if (sl === 'inactive' || sl === 'cancelled' || sl === 'closed') return 'bg-red-100 text-red-800 border-red-200';
    if (sl === 'pending' || sl === 'in progress') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const DetailItem = ({ label, value, icon, mono, accent }: { label: string; value: any; icon?: React.ReactNode; mono?: boolean; accent?: boolean }) => {
    const display = safeStr(value);
    return (
      <div className="group flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50/80 transition-all duration-200 cursor-default" data-testid={`field-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {icon && <span className="mt-0.5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">{label}</div>
          <div className={`text-[13px] font-medium leading-snug break-words ${mono ? 'font-mono' : ''} ${accent ? 'text-blue-700' : 'text-slate-800'} ${display === '-' ? 'text-slate-300' : ''}`}>{display}</div>
        </div>
      </div>
    );
  };

  const CollapsibleSection = ({ id, title, icon, color, badge, children }: { id: string; title: string; icon: React.ReactNode; color: string; badge?: React.ReactNode; children: React.ReactNode }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md" data-testid={`section-${id}`}>
      <button
        onClick={() => toggle(id)}
        className={`w-full flex items-center gap-3 px-5 py-3.5 transition-all duration-200 ${openSections[id] ? `bg-gradient-to-r ${color} text-white` : 'bg-white hover:bg-slate-50 text-slate-700'}`}
        data-testid={`btn-toggle-${id}`}
      >
        <span className={`${openSections[id] ? 'text-white/90' : 'text-slate-400'}`}>{icon}</span>
        <span className={`text-sm font-semibold tracking-wide flex-1 text-left ${openSections[id] ? '' : ''}`}>{title}</span>
        {badge}
        <span className={openSections[id] ? 'text-white/70' : 'text-slate-300'}>
          {openSections[id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {openSections[id] && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );

  return (
    <div className="p-4 sm:p-5 space-y-4" data-testid="account-info-panel">
      {loading ? <LoadingSkeleton /> : (
        <>
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl shadow-lg overflow-hidden" data-testid="account-hero">
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-lg sm:text-xl font-bold text-white truncate" data-testid="text-account-name">{accName}</h2>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusColor(accountStatus)}`} data-testid="badge-account-status">
                      {accountStatus}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <span className="inline-flex items-center gap-1.5 text-blue-100 text-[13px]">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span className="font-mono font-semibold text-white" data-testid="text-account-number">{accountNumber}</span>
                    </span>
                    {accountType !== '-' && (
                      <span className="inline-flex items-center gap-1.5 text-blue-200 text-[12px]">
                        <Briefcase className="w-3.5 h-3.5" />
                        {accountType}
                      </span>
                    )}
                    {accountGroup !== '-' && (
                      <span className="inline-flex items-center gap-1.5 text-blue-200 text-[12px]">
                        <Layers className="w-3.5 h-3.5" />
                        {accountGroup}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {depositDisplay !== '-' && depositDisplay !== 'R 0.00' && (
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 text-right">
                      <div className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold">Deposit</div>
                      <div className="text-base font-bold text-white font-mono" data-testid="text-deposit-amount">{depositDisplay}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-black/10 px-5 sm:px-6 py-3 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-blue-100">
              {contactNo !== '-' && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {contactNo}
                </span>
              )}
              {email !== '-' && (
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {email}
                </span>
              )}
              {deliveryAddr !== '-' && (
                <span className="inline-flex items-center gap-1.5 max-w-[400px] truncate" title={deliveryAddr}>
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {deliveryAddr}
                </span>
              )}
            </div>
          </div>

          <CollapsibleSection id="account" title="Account Details" icon={<CreditCard className="w-4 h-4" />} color="from-blue-600 to-blue-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
              <DetailItem label="Account Number" value={accountNumber} icon={<CreditCard className="w-4 h-4" />} mono accent />
              <DetailItem label="Name" value={accName} icon={<User className="w-4 h-4" />} />
              <DetailItem label="Account Group" value={accountGroup} icon={<Layers className="w-4 h-4" />} />
              <DetailItem label="Payment Group" value={paymentGroup} icon={<Banknote className="w-4 h-4" />} />
              <DetailItem label="Account Type" value={accountType} icon={<Briefcase className="w-4 h-4" />} />
              <DetailItem label="Sub Account Group" value={subAccountGroup} icon={<Layers className="w-4 h-4" />} />
              <DetailItem label="Incentive Scheme" value={incentiveCode} icon={<Gift className="w-4 h-4" />} />
              <DetailItem label="Contact Number" value={contactNo} icon={<Phone className="w-4 h-4" />} />
              <DetailItem label="Email" value={email} icon={<FileText className="w-4 h-4" />} />
              <DetailItem label="Deposit Amount" value={depositDisplay} icon={<Banknote className="w-4 h-4" />} />
              <DetailItem label="Billing Cycle" value={billingCycle} icon={<RefreshCw className="w-4 h-4" />} />
              <DetailItem label="Delivery Address" value={deliveryAddr} icon={<MapPin className="w-4 h-4" />} />
              <DetailItem label="Old Account Code" value={oldPropertyCode} icon={<FileText className="w-4 h-4" />} mono />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="additional"
            title="Account Status & Flags"
            icon={<Shield className="w-4 h-4" />}
            color="from-emerald-600 to-emerald-700"
            badge={
              <div className="flex gap-1.5">
                {safeStr(interestWaiver).toLowerCase().includes('waiver applied') && <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">Interest Waiver</span>}
                {deptAccount === 'Active' && <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">Departmental</span>}
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
              {[
                { label: 'Account Status', value: accountStatus, icon: <Shield className="w-4 h-4" /> },
                { label: 'Interest Waiver', value: interestWaiver, icon: <Scale className="w-4 h-4" /> },
                { label: 'Indigent Subsidy', value: indigentStatus, icon: <Heart className="w-4 h-4" /> },
                { label: 'Consumer RPP', value: consumerRpp, icon: <Shield className="w-4 h-4" /> },
                { label: 'Departmental Account', value: deptAccount, icon: <Building2 className="w-4 h-4" /> },
                { label: 'Rebate Status', value: rebateStatus, icon: <Gift className="w-4 h-4" /> },
                { label: 'Handover Status', value: handoverStatus, icon: <AlertTriangle className="w-4 h-4" /> },
                { label: 'Loan RPP', value: loanRpp, icon: <Landmark className="w-4 h-4" /> },
                { label: 'Registration', value: registrationStatus, icon: <FileText className="w-4 h-4" /> },
              ].map(item => {
                const sv = safeStr(item.value).toLowerCase();
                const isPositive = sv.includes('active') || sv.includes('applied') || sv.includes('registered') || sv === 'yes';
                const isNegative = sv.includes('handed over') || sv.includes('cancelled') || sv.includes('inactive');
                const isNA = sv === 'n/a' || sv === '-';
                return (
                  <div key={item.label} className={`rounded-xl border p-3 transition-all duration-200 hover:shadow-md cursor-default ${isPositive ? 'bg-green-50 border-green-200' : isNegative ? 'bg-red-50 border-red-200' : isNA ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-slate-400'}`}>{item.icon}</span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{item.label}</span>
                    </div>
                    <div className={`text-[13px] font-semibold ${isPositive ? 'text-green-800' : isNegative ? 'text-red-800' : 'text-slate-700'}`}>{safeStr(item.value)}</div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="property" title="Property Information" icon={<Home className="w-4 h-4" />} color="from-violet-600 to-violet-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
              <DetailItem label="SG Number" value={sgNumber} icon={<FileText className="w-4 h-4" />} mono />
              <DetailItem label="Property ID" value={propertyId} icon={<Home className="w-4 h-4" />} mono />
              <DetailItem label="Property Status" value={propertyStatus} icon={<Shield className="w-4 h-4" />} />
              <DetailItem label="Location Address" value={locationAddress} icon={<MapPin className="w-4 h-4" />} />
              <DetailItem label="Allotment Area" value={allotmentArea} icon={<MapPin className="w-4 h-4" />} />
              <DetailItem label="Farm Name" value={farmName} icon={<Home className="w-4 h-4" />} />
              <DetailItem label="Property Type" value={propertyType} icon={<Building2 className="w-4 h-4" />} />
              <DetailItem label="Type of Use" value={typeOfUse} icon={<Briefcase className="w-4 h-4" />} />
              <DetailItem label="Property Category" value={propertyCategory} icon={<Layers className="w-4 h-4" />} />
              <DetailItem label="Market Value" value={propertyMarketValue} icon={<Banknote className="w-4 h-4" />} />
              <DetailItem label="Magisterial District" value={magisterialDistrict} icon={<MapPin className="w-4 h-4" />} />
              <DetailItem label="Sectional Title Scheme" value={sectionalTitleSchemeVal} icon={<Building2 className="w-4 h-4" />} />
              <DetailItem label="Accountable Owner" value={accountableOwner} icon={<User className="w-4 h-4" />} />
              <DetailItem label="Latitude" value={latitude} icon={<MapPin className="w-4 h-4" />} mono />
              <DetailItem label="Longitude" value={longitude} icon={<MapPin className="w-4 h-4" />} mono />
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="partition" title="Partition & Valuation" icon={<Scale className="w-4 h-4" />} color="from-amber-600 to-amber-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
              <DetailItem label="Valuation Category" value={valuationCategory} icon={<Layers className="w-4 h-4" />} />
              <DetailItem label="Partition Description" value={partitionDesc} icon={<FileText className="w-4 h-4" />} />
              <DetailItem label="Market Value" value={partitionMarketValue} icon={<Banknote className="w-4 h-4" />} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="delivery" title="Delivery Addresses" icon={<MapPin className="w-4 h-4" />} color="from-teal-600 to-teal-700"
            badge={deliveryAddresses.length > 0 ? <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">{deliveryAddresses.length}</span> : undefined}
          >
            <div className="p-4">
              <PaginatedTable
                data={deliveryAddresses}
                tableId="delivery-address"
                columns={[
                  { key: 'addressStatus', label: 'Status' },
                  { key: 'startDate', label: 'Start Date' },
                  { key: 'typeofDeliveryAddress', label: 'Type' },
                  { key: 'town', label: 'City/Town' },
                  { key: 'suburbName', label: 'Suburb' },
                  { key: 'streetName', label: 'Street', render: (r: any) => r.streetName || r.complexName || '' },
                  { key: 'streetNumber', label: 'No.' },
                  { key: 'boxBagNo', label: 'Box/Bag' },
                  { key: 'complexName', label: 'Complex' },
                  { key: 'unitNumber', label: 'Unit' },
                  { key: 'postalCode', label: 'Postal Code' },
                ]}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="services" title="Services" icon={<Gauge className="w-4 h-4" />} color="from-cyan-600 to-cyan-700"
            badge={services.length > 0 ? <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">{services.length}</span> : undefined}
          >
            <div className="p-4">
              <PaginatedTable
                data={services}
                tableId="services"
                columns={[
                  { key: 'serviceStatus', label: 'Status', render: (r: any) => r.serviceStatus || r.statusDesc || r.status || '' },
                  { key: 'serviceType', label: 'Type', render: (r: any) => r.serviceType || r.serviceTypeDesc || r.serviceDesc || '' },
                  { key: 'tariff', label: 'Tariff', render: (r: any) => r.tariff || r.tariffDescription || r.tariffDesc || '' },
                  { key: 'physicalMeter', label: 'Meter + Code', render: (r: any) => {
                    const meter = r.physicalMeterNo || r.meterNo || r.physicalMeter || '';
                    const code = r.meterCode || '';
                    return meter && code ? `${meter} - ${code}` : meter || code || 'No Meter';
                  }},
                  { key: 'frequency', label: 'Frequency', render: (r: any) => r.frequency || r.frequencyDesc || '' },
                  { key: 'meterConnectionSize', label: 'Connection Size', render: (r: any) => r.meterConnectionSize || r.connectionSize || '' },
                  { key: 'factorQuantity', label: 'Factor', render: (r: any) => r.factorQuantity ?? r.factor ?? '' },
                  { key: 'requestDate', label: 'Request Date', render: (r: any) => formatDate(r.requestDate) },
                  { key: 'commencementDate', label: 'Start Date', render: (r: any) => formatDate(r.commencementDate || r.startDate) },
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
          </CollapsibleSection>

          <CollapsibleSection id="addBilling" title="Additional Billing" icon={<Receipt className="w-4 h-4" />} color="from-orange-600 to-orange-700"
            badge={additionalBilling.length > 0 ? <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">{additionalBilling.length}</span> : undefined}
          >
            <div className="p-4">
              <PaginatedTable
                data={additionalBilling}
                tableId="additional-billing"
                columns={[
                  { key: 'status', label: 'Status', render: (r: any) => r.status || r.statusDesc || r.serviceStatus || '' },
                  { key: 'type', label: 'Type', render: (r: any) => r.type || r.typeDesc || r.billingType || r.serviceDesc || '' },
                  { key: 'amount', label: 'Amount', render: (r: any) => typeof r.amount === 'number' ? r.amount.toFixed(2) : (r.amount || '') },
                  { key: 'commencementDate', label: 'Start Date', render: (r: any) => formatDate(r.commencementDate || r.startDate) },
                  { key: 'terminationDate', label: 'End Date', render: (r: any) => formatDate(r.terminationDate || r.endDate) },
                  { key: 'frequency', label: 'Frequency', render: (r: any) => r.frequency || r.frequencyDesc || '' },
                  { key: 'levyMonth', label: 'Levy Month', render: (r: any) => r.levyMonth || '' },
                  { key: 'factorQuantity', label: 'Factor', render: (r: any) => r.factorQuantity ?? r.factor ?? '' },
                ]}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="addInfo" title="Additional Information" icon={<FileText className="w-4 h-4" />} color="from-slate-600 to-slate-700"
            badge={additionalInfo.length > 0 ? <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white">{additionalInfo.length}</span> : undefined}
          >
            <div className="p-4">
              <PaginatedTable
                data={additionalInfo}
                tableId="additional-info"
                columns={[
                  { key: 'blockOrUnblock', label: 'Block/Unblock', render: (r: any) => r.blockOrUnblock || r.type || '' },
                  { key: 'receiptNo', label: 'Receipt No', render: (r: any) => r.receiptNo || r.receiptNumber || '' },
                  { key: 'receiptDate', label: 'Receipt Date', render: (r: any) => formatDate(r.receiptDate) },
                  { key: 'cardNo', label: 'Card No', render: (r: any) => r.cardNo || r.chequeNo || '' },
                  { key: 'receiptAmount', label: 'Amount', render: (r: any) => typeof r.receiptAmount === 'number' ? r.receiptAmount.toFixed(2) : (r.receiptAmount || r.amount || '') },
                  { key: 'transactionDate', label: 'Transaction Date', render: (r: any) => formatDate(r.transactionDate) },
                  { key: 'documentNo', label: 'Doc No', render: (r: any) => r.documentNo || r.documentNumber || '' },
                  { key: 'comment', label: 'Comment', render: (r: any) => r.comment || r.remarks || '' },
                  { key: 'adminFee', label: 'Admin Fee', render: (r: any) => typeof r.adminFee === 'number' ? r.adminFee.toFixed(2) : (r.adminFee || '') },
                ]}
              />
            </div>
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}

export function NameTab({ accountId, onNavigateToAccount }: { accountId: number; onNavigateToAccount?: (account: EnquirySearchResult) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevAccountId = useRef<number | null>(null);
  const [relatedAccounts, setRelatedAccounts] = useState<EnquirySearchResult[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedSearched, setRelatedSearched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRelatedAccounts([]);
    setRelatedSearched(false);
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

  const searchRelatedAccounts = useCallback(async () => {
    if (!data) return;
    setRelatedLoading(true);
    setRelatedSearched(true);
    try {
      const result = await getAccountsByNameId(accountId);
      if (result && Array.isArray(result.accounts)) {
        setRelatedAccounts(result.accounts as EnquirySearchResult[]);
      } else {
        setRelatedAccounts([]);
      }
    } catch {
      setRelatedAccounts([]);
    } finally {
      setRelatedLoading(false);
    }
  }, [data, accountId]);

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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">All Accounts for This Person</h3>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs bg-white/20 text-white hover:bg-white/30 border-0 gap-1.5"
            onClick={searchRelatedAccounts}
            disabled={relatedLoading}
            data-testid="button-find-related-accounts"
          >
            {relatedLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            {relatedLoading ? 'Searching...' : relatedSearched ? 'Refresh' : 'Find Accounts'}
          </Button>
        </div>
        <div className="p-5">
          {!relatedSearched && !relatedLoading && (
            <div className="text-center py-6">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Search for all accounts linked to this person</p>
              <p className="text-xs text-muted-foreground">
                Uses the person's Name ID to find only accounts belonging to the same person record
              </p>
            </div>
          )}
          {relatedLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
              Searching for related accounts...
            </div>
          )}
          {relatedSearched && !relatedLoading && relatedAccounts.length === 0 && (
            <div className="text-center py-6">
              <AlertTriangle className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No other accounts found for this person</p>
            </div>
          )}
          {relatedSearched && !relatedLoading && relatedAccounts.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-3">{relatedAccounts.length} other account(s) found</div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account No</th>
                      <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">ID Number</th>
                      <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Address</th>
                      <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {relatedAccounts.map((acc, idx) => {
                      const aid = acc.account_ID || acc.accountID;
                      return (
                        <tr key={`${aid}-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700">{acc.accountNumber || acc.oldAccountCode || String(aid)}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-700">{acc.name || [acc.initials, acc.surname_Company].filter(Boolean).join(' ') || '-'}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{acc.idRegistrationNumber || '-'}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">{acc.locationAddress || acc.deliveryAddress || acc.address || '-'}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-[10px] ${
                              acc.accountStatus?.toLowerCase() === 'active' ? 'bg-green-50 text-green-700' :
                              acc.accountStatus?.toLowerCase() === 'closed' || acc.accountStatus?.toLowerCase() === 'inactive' ? 'bg-red-50 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {acc.accountStatus || '-'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            {onNavigateToAccount && (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2" onClick={() => onNavigateToAccount(acc)} data-testid={`button-view-account-${aid}`}>
                                <Eye className="w-3 h-3 mr-1" /> View
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionDownloadBtn({ onClick, label = 'Excel' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] font-medium text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-md px-2 py-1 transition-colors"
      title={`Download ${label}`}
      data-testid={`btn-download-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      <FileSpreadsheet className="w-3 h-3" /> {label}
    </button>
  );
}

function generateBalanceDebtPdf(
  accountId: number,
  balanceData: any[],
  capitalPlans: any[],
  ratesData: any,
  payments: any[],
  reversals: any[],
  agingCols: { label: string; keys: string[] }[],
  fmt: (v: any) => string,
  fmtDash: (v: any) => string,
  getVal: (item: any, keys: string[]) => any,
  sumField: (arr: any[], ...keys: string[]) => number,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Balance / Debt Inquiry Report', margin, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Account: ${accountId}  |  Generated: ${new Date().toLocaleDateString('en-ZA')} ${new Date().toLocaleTimeString('en-ZA')}`, margin, y + 6);
  y += 14;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Balance / Debt', margin, y);
  y += 3;

  const balHeaders = ['Service', 'Total Outstanding', ...agingCols.map(c => c.label)];
  if (balanceData.length === 0) {
    doc.setFontSize(8); doc.setFont('helvetica', 'italic');
    doc.text('No balance data available', margin, y + 5);
    y += 12;
  } else {
    const balRows = balanceData.map(item => [
      item.serviceDescription || '-',
      fmt(item.totalOutStanding ?? item.totalOutstandingAmount ?? 0),
      ...agingCols.map(col => fmtDash(getVal(item, col.keys))),
    ]);
    balRows.push([
      'Total',
      fmt(sumField(balanceData, 'totalOutStanding', 'totalOutstandingAmount')),
      ...agingCols.map(col => fmtDash(sumField(balanceData, ...col.keys))),
    ]);

    autoTable(doc, {
      startY: y,
      head: [balHeaders],
      body: balRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      margin: { left: margin, right: margin },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === balRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [239, 246, 255];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (capitalPlans.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Debtors - Remaining Capital Amounts', margin, y);
    y += 3;

    const capHeaders = ['Service Description', 'Capital Amount', 'Remaining Capital', 'Instalment Amount', 'Repayment Period', 'Remaining Period'];
    const capRows = capitalPlans.map(p => [
      p.serviceDescription || p.description || '-',
      fmt(p.capitalAmount ?? 0),
      fmt(p.remainingCapitalAmount ?? p.remainingCapital ?? 0),
      fmt(p.instalmentAmount ?? p.installmentAmount ?? 0),
      String(p.repaymentPeriod ?? '-'),
      String(p.remainingPeriod ?? '-'),
    ]);

    autoTable(doc, {
      startY: y,
      head: [capHeaders],
      body: capRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [147, 51, 234], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (ratesData) {
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Property Rates', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Detail', 'Value']],
      body: [
        ['Annual Property Rates Amount', `R ${fmt(ratesData.annualPropertyRates ?? 0)}`],
        ['Frequency', ratesData.frequency ?? '-'],
        ['Instalment', `R ${fmt(ratesData.installment ?? 0)}`],
        ['Remaining Instalments', String(ratesData.remainingInstallments ?? '-')],
      ],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (payments.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Payments Received', margin, y);
    y += 3;

    const payHeaders = ['Receipt No', 'Payment Type', 'Date', 'Amount', 'Cashier', 'Cash Book', 'Cancellation Reason'];
    const payRows = payments.map(p => [
      p.receiptNumber || p.receiptNo || '-',
      p.paymentType || p.receiptType || p.transactionType || '-',
      p.receiptDate ? new Date(p.receiptDate).toLocaleDateString('en-ZA') : '-',
      fmt(p.amount || p.receiptAmount || 0),
      p.cashierName || p.cashier || '-',
      p.cashBook || p.cashBookName || '-',
      p.cancellationReason || p.reasonForCancellation || '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [payHeaders],
      body: payRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (reversals.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Reversals', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Receipt #', 'Type', 'Amount']],
      body: reversals.map(rv => [
        rv.receiptDate ? new Date(rv.receiptDate).toLocaleDateString('en-ZA') : '-',
        rv.receiptNumber || rv.receiptNo || '-',
        rv.receiptType || rv.transactionType || '-',
        fmt(rv.amount || rv.receiptAmount || 0),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      margin: { left: margin, right: margin },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
    doc.text('George Municipality - Balance / Debt Report', margin, doc.internal.pageSize.getHeight() - 5);
    doc.setTextColor(0);
  }

  doc.save(`Balance_Debt_Account_${accountId}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function BalanceDebtTab({ accountId, accountNumber }: { accountId: number; accountNumber?: string }) {
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [txnHistory, setTxnHistory] = useState<any[]>([]);
  const [capitalData, setCapitalData] = useState<any>(null);
  const [capitalPlans, setCapitalPlans] = useState<any[]>([]);
  const [ratesData, setRatesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExtended, setShowExtended] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<any>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balResult, txnResult, capResult, plansResult, ratesResult] = await Promise.allSettled([
        getAccountBalance(accountId),
        getTransactionHistory(String(accountId).padStart(12, '0')),
        getPaymentPlanRemainingCapital(accountId),
        getPaymentPlansByAccountId(accountId),
        getAccountRatesDetails(accountId, '2025/2026'),
      ]);
      if (balResult.status === 'fulfilled') {
        const d = balResult.value;
        setBalanceData(Array.isArray(d) ? d : (d?.results || d?.value || (d ? [d] : [])));
      }
      if (txnResult.status === 'fulfilled') setTxnHistory(Array.isArray(txnResult.value) ? txnResult.value : []);
      if (capResult.status === 'fulfilled' && capResult.value && !capResult.value._error) setCapitalData(capResult.value);
      if (plansResult.status === 'fulfilled') {
        const pl = plansResult.value;
        setCapitalPlans(Array.isArray(pl) ? pl : pl ? [pl] : []);
      }
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
    { label: '180+ DAYS', keys: ['untill360', 'days180Plus', 'days360Plus'] },
  ];
  const extendedCols = [
    { label: '180 DAYS', keys: ['days180'] },
    { label: '210 DAYS', keys: ['days210'] },
    { label: '240 DAYS', keys: ['days240'] },
    { label: '270 DAYS', keys: ['days270'] },
    { label: '300 DAYS', keys: ['days300'] },
    { label: '330 DAYS', keys: ['days330'] },
    { label: '360 DAYS', keys: ['days360'] },
    { label: '360+ DAYS', keys: ['untill360', 'days180Plus', 'days360Plus'] },
  ];

  const hasGranularAging = balanceData.some((item: any) =>
    item.days180 !== undefined || item.days210 !== undefined || item.days240 !== undefined
  );
  const agingCols = showExtended && hasGranularAging
    ? [...baseCols.slice(0, -1), ...extendedCols]
    : baseCols;
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

  const handlePrintReceipt = async (p: any) => {
    const receiptId = p.receiptId || p.receipt_ID || p.id;
    if (!receiptId) return;
    setPrintingId(String(receiptId));
    try {
      const res = await platinumPrintReceiptRaw([Number(receiptId)]);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/pdf')) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          setPrintingId(null);
          return;
        }
      }
    } catch (e) {
      console.warn('Platinum print-receipt failed, falling back to preview:', e);
    }
    try {
      const multiData = await fetchPosMultiReceiptPrint(String(receiptId));
      const first: any = Array.isArray(multiData) && multiData.length > 0 ? multiData[0] : null;
      const services = Array.isArray(multiData) ? multiData.map((s: any) => ({
        serviceDescription: s.serviceDescription || s.description || s.service || '',
        amount: s.amount ?? s.serviceAmount ?? 0,
      })) : [];
      const totalFromServices = services.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
      setReceiptPreview({
        receiptNo: first?.receiptNo || first?.receiptNumber || p.receiptNumber || p.receiptNo || '',
        receiptNumber: first?.receiptNo || first?.receiptNumber || p.receiptNumber || p.receiptNo || '',
        receiptDate: first?.receiptDate || p.receiptDate || '',
        accountNumber: first?.accountNumber || first?.accountNo || accountNumber || '',
        consumerName: first?.consumerName || first?.consumer || p.consumerName || p.consumer || '',
        municipalityName: first?.municipalityName || 'George Municipality',
        address: first?.address || '',
        totalAmount: totalFromServices > 0 ? totalFromServices : (p.amount || p.receiptAmount || 0),
        paymentType: first?.paymentType || p.paymentType || p.receiptType || p.transactionType || '',
        cashierName: first?.cashierName || first?.cashier || p.cashierName || p.cashier || '',
        services,
      });
    } catch (e) {
      console.error('Failed to fetch receipt for preview:', e);
      setReceiptPreview({
        receiptNo: p.receiptNumber || p.receiptNo || '',
        receiptNumber: p.receiptNumber || p.receiptNo || '',
        receiptDate: p.receiptDate || '',
        accountNumber: accountNumber || '',
        consumerName: p.consumerName || p.consumer || '',
        municipalityName: 'George Municipality',
        address: '',
        totalAmount: p.amount || p.receiptAmount || 0,
        paymentType: p.paymentType || p.receiptType || p.transactionType || '',
        cashierName: p.cashierName || p.cashier || '',
        services: [],
      });
    } finally {
      setPrintingId(null);
    }
  };

  const handlePrintWindow = () => {
    if (!receiptPreview) return;
    const printData: ReceiptPrintData = {
      receiptNo: receiptPreview.receiptNo || '',
      receiptDate: receiptPreview.receiptDate || '',
      accountNumber: receiptPreview.accountNumber || accountNumber || '',
      consumerName: receiptPreview.consumerName || '',
      municipalityName: receiptPreview.municipalityName || 'George Municipality',
      address: receiptPreview.address || '',
      totalAmount: receiptPreview.totalAmount ?? 0,
      paymentType: receiptPreview.paymentType || '',
      cashierName: receiptPreview.cashierName || '',
      services: Array.isArray(receiptPreview.services) ? receiptPreview.services : [],
    };
    openSlipPrintWindow(printData, true);
  };

  return (
    <div className="p-5 space-y-5" data-testid="balance-debt-tab">
      {receiptPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReceiptPreview(null)} data-testid="receipt-preview-overlay">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-white" />
                <h4 className="text-sm font-bold text-white">Receipt Preview</h4>
              </div>
              <button onClick={() => setReceiptPreview(null)} className="text-white/70 hover:text-white text-xl font-bold w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center" data-testid="button-close-receipt-preview">&times;</button>
            </div>
            <div className="p-5 space-y-3 font-mono text-sm">
              <div className="text-center">
                <h3 className="font-bold text-slate-800">{receiptPreview.municipalityName || 'George Municipality'}</h3>
                <p className="text-xs text-slate-500">{receiptPreview.address || ''}</p>
              </div>
              <div className="border-t border-dashed border-slate-300 my-2" />
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-slate-500">Receipt:</span><span className="font-semibold text-slate-800">{receiptPreview.receiptNo || '-'}</span>
                <span className="text-slate-500">Date:</span><span className="text-slate-700">{receiptPreview.receiptDate || '-'}</span>
                <span className="text-slate-500">Account:</span><span className="text-slate-700">{receiptPreview.accountNumber || accountNumber || '-'}</span>
                <span className="text-slate-500">Consumer:</span><span className="text-slate-700">{receiptPreview.consumerName || '-'}</span>
              </div>
              <div className="border-t border-dashed border-slate-300 my-2" />
              {receiptPreview.services && Array.isArray(receiptPreview.services) && receiptPreview.services.length > 0 && (
                <div className="space-y-1">
                  {receiptPreview.services.map((s: any, si: number) => (
                    <div key={si} className="flex justify-between text-xs">
                      <span className="text-slate-600">{s.serviceDescription || s.description}</span>
                      <span className="font-semibold text-slate-800">R {(s.amount ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-dashed border-slate-300 my-2" />
              <div className="flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="text-blue-700">R {(receiptPreview.totalAmount ?? 0).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-slate-500">Payment:</span><span className="text-slate-700">{receiptPreview.paymentType || '-'}</span>
                <span className="text-slate-500">Cashier:</span><span className="text-slate-700">{receiptPreview.cashierName || '-'}</span>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button onClick={() => setReceiptPreview(null)} className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50" data-testid="button-close-receipt">Close</button>
              <button onClick={handlePrintWindow} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-1.5 shadow-sm" data-testid="button-print-receipt-confirm">
                <Printer className="w-3.5 h-3.5" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-end gap-2 mb-1">
        <button
          onClick={() => generateBalanceDebtPdf(accountId, balanceData, capitalPlans, ratesData, payments, reversals, agingCols, fmt, fmtDash, getVal, sumField)}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg px-3.5 py-2 transition-colors shadow-sm"
          data-testid="btn-print-all-pdf"
        >
          <Printer className="w-3.5 h-3.5" /> Print All to PDF
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Total Balance / Debt Inquiry</h3>
          <div className="ml-auto flex items-center gap-2">
            {balanceData.length > 0 && (
              <SectionDownloadBtn onClick={() => {
                const hdrs = ['Service', 'Total Outstanding', ...agingCols.map(c => c.label)];
                const dataRows = balanceData.map(item => [
                  item.serviceDescription || '-',
                  item.totalOutStanding ?? item.totalOutstandingAmount ?? 0,
                  ...agingCols.map(col => getVal(item, col.keys) ?? 0),
                ]);
                const acctLabel = accountNumber || String(accountId);
                const currCols = Array.from({ length: agingCols.length + 1 }, (_, i) => i + 1);
                downloadExcel({
                  filename: `Balance_Debt_${acctLabel}_${new Date().toISOString().slice(0, 10)}`,
                  sheetName: 'Balance Debt',
                  title: 'Total Balance / Debt Inquiry',
                  infoRows: [
                    { label: 'Account Number:', value: acctLabel },
                    { label: 'Date:', value: new Date().toLocaleDateString('en-ZA') },
                  ],
                  headers: hdrs,
                  rows: dataRows,
                  currencyColumns: currCols,
                  headerColor: '1565C0',
                });
              }} />
            )}
            <button
              onClick={() => setShowExtended(!showExtended)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-1 transition-colors"
              data-testid="toggle-extended-aging"
            >
              {showExtended && hasGranularAging ? <ChevronLeft className="w-3 h-3" /> : !showExtended && hasGranularAging ? <ChevronRight className="w-3 h-3" /> : null}
              {hasGranularAging ? (showExtended ? 'Show up to 180+ Days' : 'Show up to 360 Days') : 'Up to 180+ Days'}
            </button>
          </div>
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-testid="debtors-remaining-capital">
        <div className="px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
          <Layers className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Debtors - Remaining Capital Amounts</h3>
          <div className="ml-auto flex items-center gap-2">
            {capitalPlans.length > 0 && (
              <SectionDownloadBtn onClick={() => {
                const hdrs = ['Service Description', 'Capital Amount', 'Remaining Capital Amount', 'Instalment Amount', 'Repayment Period', 'Remaining Period'];
                const dataRows = capitalPlans.map(p => [
                  p.serviceDescription || p.description || '-',
                  p.capitalAmount ?? 0,
                  p.remainingCapitalAmount ?? p.remainingCapital ?? 0,
                  p.instalmentAmount ?? p.installmentAmount ?? 0,
                  String(p.repaymentPeriod ?? '-'),
                  String(p.remainingPeriod ?? '-'),
                ]);
                const acctLabel2 = accountNumber || String(accountId);
                downloadExcel({
                  filename: `Capital_Amounts_${acctLabel2}_${new Date().toISOString().slice(0, 10)}`,
                  sheetName: 'Capital Amounts',
                  title: 'Debtors - Remaining Capital Amounts',
                  infoRows: [
                    { label: 'Account Number:', value: acctLabel2 },
                    { label: 'Date:', value: new Date().toLocaleDateString('en-ZA') },
                  ],
                  headers: hdrs,
                  rows: dataRows,
                  currencyColumns: [1, 2, 3],
                  headerColor: '7B1FA2',
                });
              }} />
            )}
            {capitalPlans.length > 0 && (
              <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[10px]">{capitalPlans.length} plan{capitalPlans.length !== 1 ? 's' : ''}</Badge>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-remaining-capital">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[180px]">Service Description</th>
                <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[120px]">Capital Amount</th>
                <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[150px]">Remaining Capital Amount</th>
                <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[130px]">Instalment Amount</th>
                <th className="text-center py-2.5 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[120px]">Repayment Period</th>
                <th className="text-center py-2.5 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[120px]">Remaining Period</th>
              </tr>
            </thead>
            <tbody>
              {capitalPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-sm italic">No records to display.</td>
                </tr>
              ) : capitalPlans.map((plan: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-purple-50/30 transition-colors" data-testid={`row-capital-${i}`}>
                  <td className="py-2.5 px-3 font-medium text-slate-800 text-[13px]">{plan.serviceDescription || plan.description || plan.capitalCostType || plan.serviceType || `Service ${i + 1}`}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700 text-[13px]">{fmt(plan.capitalAmount ?? plan.originalCapital ?? 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-purple-700 font-semibold text-[13px]">{fmt(plan.remainingCapitalAmount ?? plan.remainingCapital ?? plan.capitalRemaining ?? 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700 text-[13px]">{fmt(plan.instalmentAmount ?? plan.installmentAmount ?? plan.monthlyInstalment ?? 0)}</td>
                  <td className="py-2.5 px-3 text-center text-slate-600 text-[13px]">{plan.repaymentPeriod ?? plan.period ?? plan.totalPeriod ?? '-'}</td>
                  <td className="py-2.5 px-3 text-center text-slate-600 text-[13px]">{plan.remainingPeriod ?? plan.periodsRemaining ?? '-'}</td>
                </tr>
              ))}
            </tbody>
            {capitalPlans.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-purple-200 bg-purple-50/50">
                  <td className="py-2.5 px-3 font-bold text-slate-900 text-[13px]">Total</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 text-[13px]">{fmt(capitalPlans.reduce((s: number, p: any) => s + (p.capitalAmount ?? p.originalCapital ?? 0), 0))}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700 text-[13px]">{fmt(capitalPlans.reduce((s: number, p: any) => s + (p.remainingCapitalAmount ?? p.remainingCapital ?? p.capitalRemaining ?? 0), 0))}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 text-[13px]">{fmt(capitalPlans.reduce((s: number, p: any) => s + (p.instalmentAmount ?? p.installmentAmount ?? p.monthlyInstalment ?? 0), 0))}</td>
                  <td className="py-2.5 px-3" />
                  <td className="py-2.5 px-3" />
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
                        { label: '180+ Days', value: fmtDash(getVal(item, ['untill360', 'days180Plus', 'days360Plus'])) },
                        ...(showExtended && hasGranularAging ? [
                          { label: '180 Days', value: fmtDash(getVal(item, ['days180'])) },
                          { label: '210 Days', value: fmtDash(getVal(item, ['days210'])) },
                          { label: '240 Days', value: fmtDash(getVal(item, ['days240'])) },
                          { label: '270 Days', value: fmtDash(getVal(item, ['days270'])) },
                          { label: '300 Days', value: fmtDash(getVal(item, ['days300'])) },
                          { label: '330 Days', value: fmtDash(getVal(item, ['days330'])) },
                          { label: '360 Days', value: fmtDash(getVal(item, ['days360'])) },
                          { label: '360+ Days', value: fmtDash(getVal(item, ['untill360', 'days180Plus', 'days360Plus'])) },
                        ] : []),
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
          <div className="ml-auto flex items-center gap-2">
            {payments.length > 0 && (
              <SectionDownloadBtn onClick={() => {
                const hdrs = ['Receipt No', 'Payment Type', 'Date', 'Amount', 'Cashier', 'Cash Book', 'Cancellation Reason'];
                const dataRows = payments.map(p => [
                  p.receiptNumber || p.receiptNo || '-',
                  p.paymentType || p.receiptType || p.transactionType || '-',
                  p.receiptDate ? new Date(p.receiptDate).toLocaleDateString('en-ZA') : '-',
                  p.amount || p.receiptAmount || 0,
                  p.cashierName || p.cashier || '-',
                  p.cashBook || p.cashBookName || '-',
                  p.cancellationReason || p.reasonForCancellation || '',
                ]);
                const acctLabel3 = accountNumber || String(accountId);
                downloadExcel({
                  filename: `Payments_Received_${acctLabel3}_${new Date().toISOString().slice(0, 10)}`,
                  sheetName: 'Payments Received',
                  title: 'Payments Received',
                  infoRows: [
                    { label: 'Account Number:', value: acctLabel3 },
                    { label: 'Date:', value: new Date().toLocaleDateString('en-ZA') },
                  ],
                  headers: hdrs,
                  rows: dataRows,
                  currencyColumns: [3],
                  headerColor: '2E7D32',
                });
              }} />
            )}
            <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[10px]">{payments.length}</Badge>
          </div>
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
                        onClick={() => handlePrintReceipt(p)}
                        disabled={printingId === String(p.receiptId || p.receipt_ID || p.id)}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium disabled:opacity-50 flex items-center gap-1 mx-auto"
                        data-testid={`btn-print-receipt-${i}`}
                      >
                        {printingId === String(p.receiptId || p.receipt_ID || p.id) ? (
                          <><RefreshCw className="w-3 h-3 animate-spin" /> Loading...</>
                        ) : (
                          <><Printer className="w-3 h-3" /> Print</>
                        )}
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Payment Reversals</h3>
          <div className="ml-auto flex items-center gap-2">
            {reversals.length > 0 && (
              <SectionDownloadBtn onClick={() => {
                const hdrs = ['Date', 'Receipt #', 'Type', 'Amount'];
                const dataRows = reversals.map(rv => [
                  rv.receiptDate ? new Date(rv.receiptDate).toLocaleDateString('en-ZA') : '-',
                  rv.receiptNumber || rv.receiptNo || '-',
                  rv.receiptType || rv.transactionType || '-',
                  rv.amount || rv.receiptAmount || 0,
                ]);
                const acctLabel4 = accountNumber || String(accountId);
                downloadExcel({
                  filename: `Payment_Reversals_${acctLabel4}_${new Date().toISOString().slice(0, 10)}`,
                  sheetName: 'Payment Reversals',
                  title: 'Payment Reversals',
                  infoRows: [
                    { label: 'Account Number:', value: acctLabel4 },
                    { label: 'Date:', value: new Date().toLocaleDateString('en-ZA') },
                  ],
                  headers: hdrs,
                  rows: dataRows,
                  currencyColumns: [3],
                  headerColor: 'C62828',
                });
              }} />
            )}
            <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[10px]">{reversals.length}</Badge>
          </div>
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
    </div>
  );
}

export function LinkedAccountsTab({ accountId, onSelectAccount }: { accountId: number; onSelectAccount?: (account: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const prevAccountId = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLinkedAccountsOnProperty(accountId);
      const allAccounts = Array.isArray(data) ? data : [];
      setLinkedAccounts(allAccounts);
    } catch (e: any) {
      setError(e.message || 'Failed to load linked accounts');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (prevAccountId.current !== accountId) {
      prevAccountId.current = accountId;
      setExpandedRow(null);
      load();
    }
  }, [accountId, load]);

  const formatCurrency = (v: any) => {
    if (v === null || v === undefined || v === '') return 'R 0.00';
    const num = typeof v === 'number' ? v : parseFloat(String(v));
    if (isNaN(num)) return 'R 0.00';
    return `R ${num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!linkedAccounts.length) return <EmptyState message="No other accounts found linked to this property" />;

  const totalCombined = linkedAccounts.reduce((sum, a) => sum + (a.totalOutstanding || 0), 0);

  return (
    <div className="p-5 space-y-4" data-testid="linked-accounts-tab">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Linked Accounts on Same Property</h3>
            <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[10px]">
              {linkedAccounts.length} account{linkedAccounts.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-purple-200 uppercase tracking-wide">Combined Outstanding</div>
              <div className={`text-sm font-bold ${totalCombined > 0 ? 'text-red-200' : 'text-green-200'}`}>
                {formatCurrency(totalCombined)}
              </div>
            </div>
            <button onClick={load} className="p-1.5 rounded-md hover:bg-white/20 text-white transition-colors" title="Refresh" data-testid="button-refresh-linked">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {linkedAccounts.map((acct, idx) => {
            const aId = acct.account_ID || acct.accountID;
            const accNum = acct.accountNumber || String(aId).padStart(12, '0');
            const name = acct.name || acct.surname_Company || 'Unknown';
            const status = acct.accountStatus || acct.statusDesc || '';
            const accType = acct.accountType || acct.accountDesc || '';
            const outstanding = acct.totalOutstanding || 0;
            const balanceDetails = acct.balanceDetails || [];
            const isExpanded = expandedRow === idx;

            return (
              <div key={aId || idx}>
                <div
                  className={`px-4 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-purple-50/50' : ''}`}
                  onClick={() => setExpandedRow(isExpanded ? null : idx)}
                  data-testid={`linked-account-row-${aId}`}
                >
                  <button className="shrink-0 p-0.5 text-slate-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0 grid grid-cols-[1fr_1.5fr_auto_auto_auto] gap-4 items-center">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 font-mono">{accNum}</div>
                      <div className="text-[10px] text-slate-400">{accType}</div>
                    </div>
                    <div className="truncate">
                      <div className="text-xs text-slate-700 font-medium truncate">{name}</div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${status.toLowerCase() === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {status}
                    </Badge>
                    <div className={`text-sm font-bold text-right min-w-[100px] ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(outstanding)}
                    </div>
                    {onSelectAccount && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectAccount(acct); }}
                        className="px-2 py-1 text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                        data-testid={`button-view-account-${aId}`}
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && balanceDetails.length > 0 && (
                  <div className="px-8 pb-3 bg-purple-50/30">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 mt-1">Balance Breakdown</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {balanceDetails.map((b: any, bi: number) => (
                        <div key={bi} className="flex items-center justify-between bg-white rounded-md border border-slate-100 px-3 py-1.5">
                          <span className="text-[11px] text-slate-600 truncate mr-2">{b.serviceDescription || 'Unknown Service'}</span>
                          <span className={`text-[11px] font-semibold shrink-0 ${(b.totalOutStanding || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(b.totalOutStanding)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isExpanded && balanceDetails.length === 0 && (
                  <div className="px-8 pb-3 bg-purple-50/30">
                    <div className="text-[11px] text-slate-400 italic">No detailed balance breakdown available</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
