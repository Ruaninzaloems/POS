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
  Search, X, ChevronLeft, User, Building2, MapPin, Phone, Mail,
  CreditCard, Droplets, Zap, FileText, Shield, Gift, Landmark,
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Hash, Globe,
  Filter, Clock, ArrowRight, Loader2, SlidersHorizontal,
  Eye, Layers, Home, Activity, ChevronRight
} from 'lucide-react';
import {
  searchAccounts, getAccountBalance, getServiceTypeBalance,
  getPropertyDetails, getConsumptionUnits, getNameInfo,
  getHandoverInfo, getPaymentIncentive, getDeposits, getDepositAmount,
  getTransactionHistory, getAccountInformation,
  getBasicAccountDetails, getAccountInfoResult,
  getContactDetailsHistory, getDeliveryAddressHistory,
  getHandoverAccountEnquiry, getConsHandoverTransactionDetail,
  getBillingPeriodTransactions, getDetailedTransactionResults,
  getAllServices, getMeteredServicesOnAccount, getAccountServiceMeterPerProperty,
  getUnitLinkedMeters, getPrepaidMeterServicesForAccount,
  getPaymentPlansByAccountId, getPaymentPlanRemainingCapital,
  getRepaymentPlanStatus, getPaymentExtensionSearchResults, getPaymentAmountByAccountIds,
  getDebitOrderDeductionByAccount, getDebitOrderDeduction,
  getAccountRatesDetails, getRatesRunHistory, getSectionalTitleScheme,
  getPartitionDetails, getAccountDeliveryAddressDetail,
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
    <div className="flex items-center gap-3 py-2 mt-1">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{title}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function InfoField({ label, value, isCurrency }: { label: string; value: any; isCurrency?: boolean }) {
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
    <div className="flex items-baseline gap-2 py-1">
      <span className="text-xs text-slate-500 font-medium whitespace-nowrap min-w-[140px]">{label}</span>
      <span className="text-xs text-slate-400 shrink-0">:</span>
      <span className="text-xs text-slate-800 font-medium break-words">{display}</span>
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

function PaginatedTable({ data, columns, itemsPerPage = 50, tableId }: { data: any[]; columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[]; itemsPerPage?: number; tableId?: string }) {
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
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`${tid}-row-${i}`}>
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
  const [propInfo, setPropInfo] = useState<any>(null);
  const [acctInfoResult, setAcctInfoResult] = useState<any>(null);
  const [partitionInfo, setPartitionInfo] = useState<any>(null);
  const [deliveryAddresses, setDeliveryAddresses] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [additionalBilling, setAdditionalBilling] = useState<any[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState<any[]>([]);
  const prevAccountId = useRef<number | null>(null);

  const accountId = account.account_ID || account.accountID;

  useEffect(() => {
    if (prevAccountId.current === accountId) return;
    prevAccountId.current = accountId;
    setLoading(true);
    Promise.all([
      getPropertyDetails(accountId).catch(() => null),
      getAccountInfoResult(accountId).catch(() => null),
      getPartitionDetails(accountId).catch(() => null),
      getAccountDeliveryAddressDetail(accountId).catch(() => []),
      getServicesSearchResults(accountId).catch(() => []),
      getAdditionalBillingSearchResults(accountId).catch(() => []),
      getChequeFinalSearchList(accountId).catch(() => []),
    ]).then(([pi, air, part, da, svc, ab, ai]) => {
      setPropInfo(Array.isArray(pi) ? pi[0] : pi);
      setAcctInfoResult(air);
      setPartitionInfo(Array.isArray(part) ? part[0] : part);
      setDeliveryAddresses(Array.isArray(da) ? da : da ? [da] : []);
      setServices(Array.isArray(svc) ? svc : svc ? [svc] : []);
      setAdditionalBilling(Array.isArray(ab) ? ab : ab ? [ab] : []);
      setAdditionalInfo(Array.isArray(ai) ? ai : ai ? [ai] : []);
      setLoading(false);
    });
  }, [accountId]);

  const p = propInfo || {};
  const air = acctInfoResult || {};
  const part = partitionInfo || {};
  const s = account;

  const propertyStreet = p.streetNumber && p.streetName
    ? [p.streetNumber, p.streetName, p.suburb, p.town].filter(Boolean).join(', ')
    : (air.propertyStreet || s.locationAddress || '').replace(/&amp;/g, '&');
  const owner = air.owner || p.name || s.name || '';
  const name = air.name || p.name || s.name || '';
  const sgNumber = p.sgNumber || air.sgNumber || s.sgNumber || '';
  const propCategory = part.propertyCategory || part.propertyCategoryDesc || p.ratesTariff || '';
  const typeOfUse = air.typeOfUseDesc || p.typeofUse || p.townPlanningZoneType || part.typeOfUse || '';
  const isMasterProp = p.masterProperty || (p.flatReferenceNumber ? 'N' : 'N');
  const accountType = air.accountDesc || s.accountType || s.accountDesc || '';
  const accountGrouping = part.accountGrouping || air.accountGrouping || '';
  const subAccountGrouping = part.subAccountGrouping || air.subAccountGrouping || 'None : Normal';

  const formatDate = (v: any) => {
    if (!v) return '';
    try { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-ZA'); } catch { return String(v); }
  };

  return (
    <div className="p-4 space-y-4" data-testid="account-info-panel">
      <h3 className="text-base font-bold text-slate-800 mb-2">Account</h3>

      <SectionHeader title="Details:" />
      {loading ? <LoadingSkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 mb-4">
          <div>
            <InfoField label="Property Street and Number" value={propertyStreet} />
            <InfoField label="Owner" value={owner} />
            <InfoField label="Property Type of Use" value={typeOfUse} />
            <InfoField label="Name" value={name} />
            <InfoField label="Is Master Property" value={isMasterProp} />
          </div>
          <div>
            <InfoField label="SG Number" value={sgNumber} />
            <InfoField label="Property Category" value={propCategory} />
            <InfoField label="Account Type" value={accountType} />
            <InfoField label="Account Grouping" value={accountGrouping} />
            <InfoField label="Sub Account Grouping" value={subAccountGrouping} />
          </div>
        </div>
      )}

      <SectionHeader title="Other accounts linked to the same address:" />
      {loading ? <LoadingSkeleton /> : (
        <PaginatedTable
          data={[]}
          tableId="linked-accounts"
          columns={[
            { key: 'account', label: 'Account' },
            { key: 'accStatus', label: 'Acc Status' },
            { key: 'accType', label: 'Acc Type' },
            { key: 'personCompany', label: 'Person/Company' },
            { key: 'service', label: 'Service' },
            { key: 'serviceStatus', label: 'Service Status' },
            { key: 'tariffCode', label: 'Tariff Code' },
            { key: 'tariffDesc', label: 'Tariff Desc' },
            { key: 'physicalMeterNo', label: 'Physical Meter No' },
            { key: 'meterNo', label: 'Meter No' },
            { key: 'meterClassification', label: 'Meter Classification' },
            { key: 'meterStatus', label: 'Meter Status' },
          ]}
        />
      )}

      <SectionHeader title="Delivery Address Details:" />
      {loading ? <LoadingSkeleton /> : (
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
      )}

      <SectionHeader title="Services:" />
      {loading ? <LoadingSkeleton /> : (
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
      )}

      <SectionHeader title="Additional Billing Services:" />
      {loading ? <LoadingSkeleton /> : (
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
      )}

      <SectionHeader title="Additional Information:" />
      {loading ? <LoadingSkeleton /> : (
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAccountBalance(accountId);
      setData(result);
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
  if (!data) return <EmptyState message="No balance data available" />;

  const items = Array.isArray(data) ? data : (data?.results || data?.value || [data]);
  if (items.length === 0) return <EmptyState message="No balance data available" />;

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid="table-balance-debt">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Total Outstanding</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Current</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">30 Days</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">60 Days</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">90 Days</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">120 Days</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">150+ Days</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 font-medium text-slate-700">{item.serviceDescription || item.serviceType || item.description || `Service ${i + 1}`}</td>
              <td className="py-2 px-3 text-right font-mono text-red-600 font-semibold">{(item.totalOutstandingAmount ?? item.totalOutstanding ?? item.outstandingAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3 text-right font-mono">{(item.currentAccount ?? item.current ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3 text-right font-mono">{(item.days30 ?? item['30days'] ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3 text-right font-mono">{(item.days60 ?? item['60days'] ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3 text-right font-mono">{(item.days90 ?? item['90days'] ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3 text-right font-mono">{(item.days120 ?? item['120days'] ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3 text-right font-mono">{(item.days150 ?? item['150days'] ?? item.days150Plus ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceBalanceTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getServiceTypeBalance(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load service balances');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data.length) return <EmptyState message="No service balance data available" />;

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid="table-service-balance">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service Type</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Balance</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">New Charge</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 font-medium text-slate-700">{item.serviceType || item.serviceDescription || item.description || `Type ${i + 1}`}</td>
              <td className="py-2 px-3 text-right font-mono font-semibold">{(item.balance ?? item.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 px-3 text-right font-mono">{(item.newCharge ?? item.currentCharge ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropertyDetailsTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPropertyDetails(accountId);
      setData(result);
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
  if (!data) return <EmptyState message="No property details available" />;

  const items = Array.isArray(data) ? data : [data];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {items.map((prop: any, i: number) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2"><Building2 className="w-4 h-4" /> Property {items.length > 1 ? i + 1 : ''}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <FieldRow label="Property ID" value={prop.property_ID || prop.propertyId} icon={<Hash className="w-3.5 h-3.5" />} />
            <FieldRow label="Erf Number" value={prop.erfNumber || prop.erf_Number} />
            <FieldRow label="SG Number" value={prop.sgNumber || prop.sg_Number} />
            <FieldRow label="Street" value={prop.streetName || prop.street} />
            <FieldRow label="Town" value={prop.town} />
            <FieldRow label="Suburb" value={prop.suburb} />
            <FieldRow label="Zoning" value={prop.zoning} />
            <FieldRow label="Property Type" value={prop.propertyType || prop.propertyDesc} />
            <FieldRow label="Market Value" value={prop.marketValue} />
            <FieldRow label="Extent (m²)" value={prop.extent || prop.extentM2} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ConsumptionTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getConsumptionUnits(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load consumption data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data.length) return <EmptyState message="No consumption data available" />;

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid="table-consumption">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Meter / Unit</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Service Type</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Previous Reading</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Current Reading</th>
            <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Consumption</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Read Date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 font-medium text-slate-700">{item.meterNumber || item.physicalMeterNumber || item.consUnit || `Unit ${i + 1}`}</td>
              <td className="py-2 px-3">{item.serviceType || item.serviceDescription || '-'}</td>
              <td className="py-2 px-3 text-right font-mono">{item.previousReading ?? '-'}</td>
              <td className="py-2 px-3 text-right font-mono">{item.currentReading ?? '-'}</td>
              <td className="py-2 px-3 text-right font-mono font-semibold">{item.consumption ?? '-'}</td>
              <td className="py-2 px-3 text-slate-500">{item.readDate ? new Date(item.readDate).toLocaleDateString('en-ZA') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      setDeposits(depsResult);
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

  return (
    <div className="p-4 space-y-4">
      {depositAmount && (
        <Card>
          <CardContent className="pt-4 space-y-0">
            <FieldRow label="Total Deposit Amount" value={depositAmount.totalDeposit ?? depositAmount.amount ?? depositAmount} icon={<Landmark className="w-3.5 h-3.5" />} />
          </CardContent>
        </Card>
      )}
      {deposits.length > 0 ? (
        <table className="w-full text-sm" data-testid="table-deposits">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Reference</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((dep: any, i: number) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-2 px-3">{dep.depositDate ? new Date(dep.depositDate).toLocaleDateString('en-ZA') : '-'}</td>
                <td className="py-2 px-3">{dep.description || dep.depositDescription || '-'}</td>
                <td className="py-2 px-3 text-right font-mono font-semibold">{(dep.amount ?? dep.depositAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                <td className="py-2 px-3 text-slate-500">{dep.reference || dep.depositReference || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState message="No deposit records found" />
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
        getTransactionHistory(accountNumber).catch(() => []),
        getBillingPeriodTransactions(accountId).catch(() => []),
        getDetailedTransactionResults(accountId).catch(() => []),
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
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Payment Option</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Tender</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Change</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Cashier</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item: any, i: number) => (
                  <tr key={item.receiptId || i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono text-blue-700 font-medium">{item.receiptNo || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{item.receiptDate ? new Date(item.receiptDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-2 px-3">{item.paymentType || '-'}</td>
                    <td className="py-2 px-3">{item.paymentOption || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(item.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{(item.tenderAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{(item.changeAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{item.cashierName || '-'}</td>
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
  { key: 'physicalMeterNumber', label: 'Meter Number', placeholder: 'Physical meter number', icon: Zap, smart: false },
  { key: 'deliveryAddress', label: 'Delivery Address', placeholder: 'Postal or delivery address', icon: MapPin, smart: false },
  { key: 'locationAddress', label: 'Location Address', placeholder: 'Street or location', icon: MapPin, smart: false },
  { key: 'emailAddress', label: 'Email Address', placeholder: 'email@example.com', icon: Mail, smart: false },
  { key: 'mobileNumber', label: 'Mobile Number', placeholder: '0821234567', icon: Phone, smart: false },
  { key: 'erfNumber', label: 'Erf Number', placeholder: 'Erf / Stand number', icon: Building2, smart: false },
  { key: 'trading', label: 'Trading As', placeholder: 'Business trading name', icon: Globe, smart: false },
] as const;

function detectSearchType(query: string): { field: string; label: string } {
  const trimmed = query.trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return { field: 'emailAddress', label: 'Email' };
  if (/^0\d{9}$/.test(trimmed)) return { field: 'mobileNumber', label: 'Mobile Number' };
  if (/^\d{13}$/.test(trimmed)) return { field: 'idNo', label: 'ID Number' };
  if (/^\d{6,15}$/.test(trimmed)) return { field: 'accountNo', label: 'Account Number' };
  if (/^\d{1,5}$/.test(trimmed)) return { field: 'accountNo', label: 'Account Number' };
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
            {results.slice(0, 50).map((account, i) => (
              <div
                key={account.accountID || account.account_ID || i}
                onClick={() => onSelect(account)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all border-b border-slate-50 last:border-0
                  ${highlightIdx === i ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50 border-l-2 border-l-transparent'}`}
                data-testid={`dropdown-account-${account.accountID || account.account_ID || i}`}
              >
                <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold
                  ${(account.accountStatus || account.statusDesc)?.toLowerCase() === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {(account.name || account.surname_Company || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{account.name || account.surname_Company || 'Unknown'}</span>
                    <Badge
                      variant={(account.accountStatus || account.statusDesc)?.toLowerCase() === 'active' ? 'default' : 'secondary'}
                      className="text-[9px] shrink-0 h-4 px-1.5"
                    >
                      {account.accountStatus || account.statusDesc || '?'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-mono text-blue-600">{account.accountNumber || account.accountID || account.account_ID}</span>
                    {account.oldAccountCode && <span className="text-[10px] text-slate-400 font-mono">Old: {account.oldAccountCode}</span>}
                    {(account.address || account.deliveryAddress) && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {(account.address || account.deliveryAddress || '').replace(/\r\n/g, ', ').substring(0, 50)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-sm font-mono font-bold ${(account.outStandingAmount ?? account.outStandingAmt ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    R {(account.outStandingAmount ?? account.outStandingAmt ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400">{account.accountType || account.accountDesc || ''}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            ))}
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
  const acctType = account.accountType || account.accountDesc || '-';
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
    <div data-testid={`expandable-row-${aid}`}>
      <div
        className={`flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 transition-all duration-200 ${isExpanded ? 'bg-blue-50/80 border-l-2 border-l-blue-500' : 'hover:bg-blue-50/60'}`}
      >
        <button
          onClick={onToggleExpand}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md hover:bg-blue-100 transition-colors"
          data-testid={`btn-expand-${aid}`}
        >
          <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        <button
          onClick={() => onSelect(account)}
          className="font-mono text-blue-700 font-semibold hover:text-blue-900 hover:underline text-sm shrink-0"
          data-testid={`btn-account-${aid}`}
        >
          {account.accountNumber || aid}
        </button>

        <span className="text-slate-400 text-xs font-mono shrink-0 hidden lg:inline" data-testid={`text-partition-${aid}`}>
          P:{account.unitPartitionID || '-'}
        </span>

        <span className="text-slate-500 font-mono text-xs shrink-0 hidden xl:inline">
          {account.oldAccountCode || '-'}
        </span>

        <span className="font-medium text-slate-800 text-sm truncate min-w-0 max-w-[180px]" data-testid={`text-name-${aid}`}>
          {account.name || account.surname_Company || '-'}
        </span>

        <Badge
          variant={status.toLowerCase() === 'active' ? 'default' : 'secondary'}
          className="text-[10px] shrink-0"
          data-testid={`badge-status-${aid}`}
        >
          {status}
        </Badge>

        <Badge variant="outline" className="text-[10px] font-normal shrink-0 hidden md:inline-flex" data-testid={`badge-type-${aid}`}>
          {acctType}
        </Badge>

        <span className={`font-mono text-sm font-semibold shrink-0 ml-auto ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`} data-testid={`text-outstanding-${aid}`}>
          R {outstanding.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
        </span>

        <span className="text-slate-500 text-xs truncate max-w-[160px] hidden lg:inline" data-testid={`text-address-${aid}`}>
          {addr.replace(/\r\n/g, ', ')}
        </span>

        <span className="text-slate-400 text-xs font-mono shrink-0 hidden xl:inline">
          {account.sgNumber || '-'}
        </span>

        <span className="text-slate-400 text-xs shrink-0 hidden xl:inline">
          U:{account.unitID || '-'}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelect(account)}
          className="shrink-0 h-7 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100"
          data-testid={`btn-open-${aid}`}
        >
          <Eye className="w-3.5 h-3.5 mr-1" />
          Open
        </Button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
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
      </div>
    </div>
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

  const doQuickSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setDropdownResults([]);
      setDropdownSearching(false);
      return;
    }
    setDropdownSearching(true);
    const { field } = detectSearchType(query);
    try {
      const data = await searchAccounts({ [field]: query.trim() } as any);
      setDropdownResults(data);
      setShowDropdown(true);
    } catch (e: any) {
      setDropdownResults([]);
    } finally {
      setDropdownSearching(false);
    }
  }, []);

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
    try {
      let searchCriteria: EnquirySearchCriteria = { ...criteria };
      if (hasQuick) {
        const { field } = detectSearchType(quickQuery);
        searchCriteria = { ...searchCriteria, [field]: quickQuery.trim() };
      }
      const data = await searchAccounts(searchCriteria);
      setResults(data);
    } catch (e: any) {
      setSearchError(e.message || 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [quickQuery, criteria, recentSearches]);

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
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 bg-white border-b px-4 sm:px-6 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(null)} className="gap-1.5" data-testid="button-back-to-results">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
              {(selectedAccount.name || selectedAccount.surname_Company || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate" data-testid="text-selected-account-name">{selectedAccount.name || selectedAccount.surname_Company}</div>
              <div className="text-xs text-slate-500">
                Acc: {selectedAccount.accountNumber || selectedAccount.accountID || selectedAccount.account_ID}
                {selectedAccount.oldAccountCode && ` | Old: ${selectedAccount.oldAccountCode}`}
              </div>
            </div>
            <Badge variant={(selectedAccount.accountStatus || selectedAccount.statusDesc)?.toLowerCase() === 'active' ? 'default' : 'secondary'} className="ml-2 shrink-0">
              {selectedAccount.accountStatus || selectedAccount.statusDesc || 'Unknown'}
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="shrink-0 bg-white border-b px-2 sm:px-4 overflow-x-auto">
              <TabsList className="h-auto flex flex-nowrap gap-0.5 bg-transparent p-0 justify-start min-w-max">
                <TabsTrigger value="account" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-account-info">Account Info</TabsTrigger>
                <TabsTrigger value="name" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-name">Name</TabsTrigger>
                <TabsTrigger value="balance" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-balance">Balance / Debt</TabsTrigger>
                <TabsTrigger value="services" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-services">Service Balances</TabsTrigger>
                <TabsTrigger value="property" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-property">Property</TabsTrigger>
                <TabsTrigger value="consumption" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-consumption">Consumption</TabsTrigger>
                <TabsTrigger value="contact" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-contact">Contact</TabsTrigger>
                <TabsTrigger value="handover" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-handover">Handover</TabsTrigger>
                <TabsTrigger value="incentives" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-incentives">Incentives</TabsTrigger>
                <TabsTrigger value="deposits" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-deposits">Deposits</TabsTrigger>
                <TabsTrigger value="transactions" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-transactions">Transactions</TabsTrigger>
                <TabsTrigger value="services-meters" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-services-meters">Services & Meters</TabsTrigger>
                <TabsTrigger value="payment-plans" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-payment-plans">Payment Plans</TabsTrigger>
                <TabsTrigger value="debit-orders" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-debit-orders">Debit Orders</TabsTrigger>
                <TabsTrigger value="rates" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-rates">Rates & Valuations</TabsTrigger>
                <TabsTrigger value="notifications" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-notifications">Notifications</TabsTrigger>
                <TabsTrigger value="statements" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-statements">Statements</TabsTrigger>
                <TabsTrigger value="clearance" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-clearance">Clearance</TabsTrigger>
                <TabsTrigger value="debtor-notes" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-debtor-notes">Debtor Notes</TabsTrigger>
                <TabsTrigger value="section129" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-section129">Section 129</TabsTrigger>
                <TabsTrigger value="occupiers" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5 whitespace-nowrap" data-testid="tab-occupiers">Occupiers</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-auto">
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
              <TabsContent value="services-meters" className="m-0"><ServicesMetersTab accountId={accountId} unitId={unitId} /></TabsContent>
              <TabsContent value="payment-plans" className="m-0"><PaymentPlansTab accountId={accountId} /></TabsContent>
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
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Detected:</span>
            <Badge variant="outline" className="text-[10px] gap-1 h-5">
              <Filter className="w-2.5 h-2.5" />
              {detectedType.label}
            </Badge>
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
            <p className="text-sm font-medium">No results found</p>
            <p className="text-xs mt-1">Try adjusting your search criteria or use the Filters button</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="divide-y divide-slate-100" data-testid="table-search-results">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 border-b-2 border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold sticky top-0 z-10">
              <span className="w-7 shrink-0"></span>
              <span className="shrink-0 w-[130px]">Account No.</span>
              <span className="shrink-0 w-[50px] hidden lg:inline">Part. ID</span>
              <span className="shrink-0 w-[90px] hidden xl:inline">Old Code</span>
              <span className="flex-1 min-w-[100px]">Name</span>
              <span className="shrink-0 w-[70px]">Status</span>
              <span className="shrink-0 w-[70px] hidden md:inline">Type</span>
              <span className="shrink-0 w-[120px] text-right">Outstanding</span>
              <span className="shrink-0 w-[140px] hidden lg:inline">Address</span>
              <span className="shrink-0 w-[90px] hidden xl:inline">SG Number</span>
              <span className="shrink-0 w-[50px] hidden xl:inline">Unit</span>
              <span className="shrink-0 w-[60px]"></span>
            </div>
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
