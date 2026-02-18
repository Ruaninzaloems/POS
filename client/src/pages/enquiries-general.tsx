import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Hash, Globe
} from 'lucide-react';
import {
  searchAccounts, getAccountBalance, getServiceTypeBalance,
  getPropertyDetails, getConsumptionUnits, getNameInfo,
  getHandoverInfo, getPaymentIncentive, getDeposits, getDepositAmount,
  getTransactionHistory, getAccountInformation,
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
    else display = String(value).replace(/\r\n/g, ', ');
  }
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="text-xs text-slate-500 font-medium whitespace-nowrap min-w-[140px]">{label}</span>
      <span className="text-xs text-slate-400 shrink-0">:</span>
      <span className="text-xs text-slate-800 font-medium break-words">{display}</span>
    </div>
  );
}

function AccountInfoTab({ account }: { account: EnquirySearchResult }) {
  const [acctInfo, setAcctInfo] = useState<any>(null);
  const [propInfo, setPropInfo] = useState<any>(null);
  const [nameInfo, setNameInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const accountId = account.account_ID;
    Promise.all([
      getAccountInformation(accountId).catch(() => null),
      getPropertyDetails(accountId).catch(() => null),
      getNameInfo(accountId).catch(() => null),
    ]).then(([ai, pi, ni]) => {
      setAcctInfo(ai);
      setPropInfo(Array.isArray(pi) ? pi[0] : pi);
      setNameInfo(ni);
      setLoading(false);
    });
  }, [account.account_ID]);

  const a = acctInfo || {};
  const p = propInfo || {};
  const n = nameInfo || {};
  const s = account;

  return (
    <div className="p-4 space-y-1" data-testid="account-info-panel">
      <h3 className="text-base font-bold text-slate-800 mb-2">Account Enquiry</h3>

      <SectionHeader title="Account Information" />
      {loading ? <LoadingSkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
          <div>
            <InfoField label="Account Number" value={s.accountNumber || a.accountNumber} />
            <InfoField label="Account Group" value={a.accountGroup || a.accountGroupDescription || s.accountDesc} />
            <InfoField label="Payment Group" value={a.paymentGroup || a.paymentGroupDescription} />
            <InfoField label="Account Type" value={a.accountType || a.accountTypeDescription || s.accountDesc} />
            <InfoField label="Incentive Scheme Code" value={a.incentiveSchemeCode || a.incentiveScheme} />
            <InfoField label="Email" value={n.email || n.emailAddress || s.email || a.email} />
            <InfoField label="Paid Deposit Amount" value={a.paidDepositAmount ?? a.depositAmount} />
          </div>
          <div>
            <InfoField label="Name" value={s.name || a.name || n.surname_Company} />
            <InfoField label="Sub Account Group" value={a.subAccountGroup || a.subAccountGroupDescription} />
            <InfoField label="Account Status" value={a.accountStatus || s.statusDesc} />
            <InfoField label="Delivery Address" value={(a.deliveryAddress || s.deliveryAddress || '').replace(/\r\n/g, ', ')} />
            <InfoField label="Contact Number" value={n.tel_Mobile || n.tel_Home || n.tel_Work || a.contactNumber} />
          </div>
        </div>
      )}

      <SectionHeader title="Additional Account Details" />
      {loading ? <LoadingSkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
          <div>
            <InfoField label="Interest Waiver Status" value={a.interestWaiverStatus || a.interestWaiver || 'N/A'} />
            <InfoField label="Indigent Subsidy Status" value={a.indigentSubsidyStatus || a.indigentStatus} />
            <InfoField label="Consumer RPP Status" value={a.consumerRPPStatus || a.consumerRPP || 'N/A'} />
            <InfoField label="Departmental Account" value={a.departmentalAccount || a.isDepartmental} />
          </div>
          <div>
            <InfoField label="Rebate Status" value={a.rebateStatus || a.rebate || 'N/A'} />
            <InfoField label="Handover Status" value={a.handoverStatus || a.handover || 'N/A'} />
            <InfoField label="Loan RPP Status" value={a.loanRPPStatus || a.loanRPP || 'N/A'} />
          </div>
        </div>
      )}

      <SectionHeader title="Property" />
      {loading ? <LoadingSkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
          <div>
            <InfoField label="SG Number" value={p.sgNumber || p.sg_Number || a.sgNumber} />
            <InfoField label="Old Property Code" value={s.oldAccountCode || a.oldPropertyCode} />
            <InfoField label="Billing Cycle" value={a.billingCycle || a.billingCycleDescription} />
            <InfoField label="Sectional Title Scheme" value={p.sectionalTitleScheme || a.sectionalTitleScheme} />
            <InfoField label="Location Address" value={(p.locationAddress || s.locationAddress || '').replace(/\r\n/g, ', ')} />
            <InfoField label="Longitude" value={p.longitude} />
            <InfoField label="Registration Status" value={p.registrationStatus} />
          </div>
          <div>
            <InfoField label="Property ID" value={p.property_ID || p.propertyId || p.propertyID} />
            <InfoField label="Property Status" value={p.propertyStatus || p.status} />
            <InfoField label="Allotment Area" value={p.allotmentArea || a.allotmentArea || s.allotmentArea} />
            <InfoField label="Farm Name" value={p.farmName} />
            <InfoField label="Property Type" value={p.propertyType || p.propertyDesc} />
            <InfoField label="Latitude" value={p.latitude} />
            <InfoField label="Magisterial District" value={p.magisterialDistrict || p.magDistrict} />
            <InfoField label="Property Market Value" value={p.marketValue ?? p.propertyMarketValue} />
          </div>
        </div>
      )}

      <SectionHeader title="Partition" />
      {loading ? <LoadingSkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
          <div>
            <InfoField label="Property Type of Use" value={p.propertyTypeOfUse || p.typeOfUse} />
            <InfoField label="Property Category" value={p.propertyCategory || p.category} />
            <InfoField label="Accountable Owner Name" value={p.accountableOwnerName || p.ownerName || s.name} />
          </div>
          <div>
            <InfoField label="Valuation Category" value={p.valuationCategory} />
            <InfoField label="Partition Description" value={p.partitionDescription || p.partition} />
            <InfoField label="Partition Market Value" value={p.partitionMarketValue} />
          </div>
        </div>
      )}
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getNameInfo(accountId);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load contact information');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState message="No contact information available" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2"><User className="w-4 h-4" /> Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow label="Surname / Company" value={data.surname_Company} />
          <FieldRow label="Initials" value={data.initials} />
          <FieldRow label="Title" value={data.title} />
          <FieldRow label="ID Number" value={data.idRegistrationNumber || data.idNumber} />
          <FieldRow label="Date of Birth" value={data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString('en-ZA') : null} />
          <FieldRow label="Gender" value={data.gender} />
          <FieldRow label="Language" value={data.language} />
          <FieldRow label="Marital Status" value={data.maritalStatus} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2"><Phone className="w-4 h-4" /> Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow label="Mobile" value={data.tel_Mobile || data.mobile} icon={<Phone className="w-3.5 h-3.5" />} />
          <FieldRow label="Home Phone" value={data.tel_Home || data.homePhone} icon={<Phone className="w-3.5 h-3.5" />} />
          <FieldRow label="Work Phone" value={data.tel_Work || data.workPhone} icon={<Phone className="w-3.5 h-3.5" />} />
          <FieldRow label="Email" value={data.email || data.emailAddress} icon={<Mail className="w-3.5 h-3.5" />} />
          <FieldRow label="Postal Address" value={data.postalAddress?.replace(/\r\n/g, ', ')} icon={<MapPin className="w-3.5 h-3.5" />} />
        </CardContent>
      </Card>
    </div>
  );
}

function HandoverTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHandoverInfo(accountId);
      setData(result);
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
  if (!data) return <EmptyState message="No handover information available" />;

  const items = Array.isArray(data) ? data : [data];
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

function TransactionHistoryTab({ accountNumber }: { accountNumber: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTransactionHistory(accountNumber);
      setData(result);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  }, [accountNumber]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data.length) return <EmptyState message="No transaction history found" />;

  return (
    <div className="p-4 overflow-x-auto">
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
  );
}

const SEARCH_FIELDS = [
  { key: 'accountNo', label: 'Account Number', placeholder: 'e.g. 000000003698', icon: Hash },
  { key: 'oldAccountCode', label: 'Old Account Code', placeholder: 'Legacy code', icon: FileText },
  { key: 'name', label: 'Name / Company', placeholder: 'Search by name', icon: User },
  { key: 'idNo', label: 'ID / Registration No.', placeholder: '13 digit ID number', icon: CreditCard },
  { key: 'physicalMeterNumber', label: 'Meter Number', placeholder: 'Physical meter number', icon: Zap },
  { key: 'deliveryAddress', label: 'Delivery Address', placeholder: 'Postal or delivery address', icon: MapPin },
  { key: 'locationAddress', label: 'Location Address', placeholder: 'Street or location', icon: MapPin },
  { key: 'emailAddress', label: 'Email Address', placeholder: 'email@example.com', icon: Mail },
  { key: 'mobileNumber', label: 'Mobile Number', placeholder: '0821234567', icon: Phone },
  { key: 'erfNumber', label: 'Erf Number', placeholder: 'Erf / Stand number', icon: Building2 },
  { key: 'trading', label: 'Trading As', placeholder: 'Business trading name', icon: Globe },
] as const;

function GeneralEnquiriesContent() {
  const [criteria, setCriteria] = useState<EnquirySearchCriteria>({});
  const [results, setResults] = useState<EnquirySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EnquirySearchResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('account');

  const handleSearch = useCallback(async () => {
    const hasAnyCriteria = Object.values(criteria).some(v => v && String(v).trim());
    if (!hasAnyCriteria) return;

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setSelectedAccount(null);
    try {
      const data = await searchAccounts(criteria);
      setResults(data);
    } catch (e: any) {
      setSearchError(e.message || 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [criteria]);

  const handleClear = () => {
    setCriteria({});
    setResults([]);
    setHasSearched(false);
    setSearchError(null);
    setSelectedAccount(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSelectAccount = (account: EnquirySearchResult) => {
    setSelectedAccount(account);
    setActiveTab('account');
  };

  const primaryFields = SEARCH_FIELDS.slice(0, 4);
  const advancedFields = SEARCH_FIELDS.slice(4);

  if (selectedAccount) {
    const accountId = selectedAccount.account_ID;
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 bg-white border-b px-4 sm:px-6 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(null)} className="gap-1.5" data-testid="button-back-to-results">
            <ChevronLeft className="w-4 h-4" />
            Back to Results
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
              {(selectedAccount.name || selectedAccount.surname_Company || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate" data-testid="text-selected-account-name">{selectedAccount.name || selectedAccount.surname_Company}</div>
              <div className="text-xs text-slate-500">
                Acc: {selectedAccount.accountNumber || selectedAccount.account_ID}
                {selectedAccount.oldAccountCode && ` | Old: ${selectedAccount.oldAccountCode}`}
              </div>
            </div>
            <Badge variant={selectedAccount.statusDesc?.toLowerCase() === 'active' ? 'default' : 'secondary'} className="ml-2 shrink-0">
              {selectedAccount.statusDesc || 'Unknown'}
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="shrink-0 bg-white border-b px-4 sm:px-6">
              <TabsList className="h-auto flex flex-wrap gap-0.5 bg-transparent p-0 justify-start">
                <TabsTrigger value="account" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-account-info">Account Info</TabsTrigger>
                <TabsTrigger value="balance" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-balance">Balance / Debt</TabsTrigger>
                <TabsTrigger value="services" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-services">Service Balances</TabsTrigger>
                <TabsTrigger value="property" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-property">Property</TabsTrigger>
                <TabsTrigger value="consumption" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-consumption">Consumption</TabsTrigger>
                <TabsTrigger value="contact" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-contact">Contact</TabsTrigger>
                <TabsTrigger value="handover" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-handover">Handover</TabsTrigger>
                <TabsTrigger value="incentives" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-incentives">Incentives</TabsTrigger>
                <TabsTrigger value="deposits" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-deposits">Deposits</TabsTrigger>
                <TabsTrigger value="transactions" className="text-xs sm:text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-3 py-2.5" data-testid="tab-transactions">Transactions</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-auto">
              <TabsContent value="account" className="m-0"><AccountInfoTab account={selectedAccount} /></TabsContent>
              <TabsContent value="balance" className="m-0"><BalanceDebtTab accountId={accountId} /></TabsContent>
              <TabsContent value="services" className="m-0"><ServiceBalanceTab accountId={accountId} /></TabsContent>
              <TabsContent value="property" className="m-0"><PropertyDetailsTab accountId={accountId} /></TabsContent>
              <TabsContent value="consumption" className="m-0"><ConsumptionTab accountId={accountId} /></TabsContent>
              <TabsContent value="contact" className="m-0"><ContactInfoTab accountId={accountId} /></TabsContent>
              <TabsContent value="handover" className="m-0"><HandoverTab accountId={accountId} /></TabsContent>
              <TabsContent value="incentives" className="m-0"><IncentivesTab accountId={accountId} /></TabsContent>
              <TabsContent value="deposits" className="m-0"><DepositsTab accountId={accountId} /></TabsContent>
              <TabsContent value="transactions" className="m-0"><TransactionHistoryTab accountNumber={selectedAccount.accountNumber || String(selectedAccount.account_ID)} /></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 bg-white border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800" data-testid="text-page-title">General Enquiries</h2>
            <p className="text-xs text-slate-500 mt-0.5">Search and view municipal account information</p>
          </div>
          {hasSearched && (
            <Badge variant="outline" className="text-xs" data-testid="text-result-count">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {primaryFields.map((field) => (
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
                  onKeyDown={handleKeyDown}
                  className="h-9 text-sm"
                  data-testid={`input-search-${field.key}`}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            data-testid="button-toggle-advanced"
          >
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showAdvanced ? 'Hide' : 'Show'} Advanced Search Fields
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-dashed border-slate-200">
              {advancedFields.map((field) => (
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
                    onKeyDown={handleKeyDown}
                    className="h-9 text-sm"
                    data-testid={`input-search-${field.key}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSearch} disabled={searching || !Object.values(criteria).some(v => v && String(v).trim())} className="gap-2" data-testid="button-search">
              {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching ? 'Searching...' : 'Search'}
            </Button>
            <Button variant="outline" onClick={handleClear} className="gap-2" data-testid="button-clear">
              <X className="w-4 h-4" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50">
        {searchError && (
          <div className="p-4">
            <ErrorState message={searchError} onRetry={handleSearch} />
          </div>
        )}

        {!hasSearched && !searchError && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
            <Search className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-base font-medium mb-1">Search for Accounts</p>
            <p className="text-sm text-center max-w-md">Enter an account number, name, ID number, or any other criteria above and click Search to find municipal accounts.</p>
          </div>
        )}

        {hasSearched && !searchError && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No results found</p>
            <p className="text-xs mt-1">Try adjusting your search criteria</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-search-results">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 border-b-2 border-slate-200">
                  <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 font-semibold">Account No.</th>
                  <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 font-semibold">Old Code</th>
                  <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 font-semibold">Name</th>
                  <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 font-semibold">ID Number</th>
                  <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 font-semibold">Address</th>
                  <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 font-semibold">Type</th>
                  <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 font-semibold">Status</th>
                  <th className="text-right py-2.5 px-4 text-xs uppercase tracking-wider text-slate-600 font-semibold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {results.map((account, i) => (
                  <tr
                    key={account.account_ID || i}
                    onClick={() => handleSelectAccount(account)}
                    className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors group"
                    data-testid={`row-account-${account.account_ID || i}`}
                  >
                    <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold group-hover:text-blue-900">{account.accountNumber || account.account_ID}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-xs">{account.oldAccountCode || '-'}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{account.name || account.surname_Company || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-500 text-xs font-mono">{account.idRegistrationNumber || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-500 text-xs max-w-[200px] truncate">{(account.deliveryAddress || account.locationAddress || '-').replace(/\r\n/g, ', ')}</td>
                    <td className="py-2.5 px-4"><Badge variant="outline" className="text-[10px] font-normal">{account.accountDesc || '-'}</Badge></td>
                    <td className="py-2.5 px-4">
                      <Badge variant={account.statusDesc?.toLowerCase() === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                        {account.statusDesc || '-'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-red-600">
                      {(account.outStandingAmt ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
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

export default function GeneralEnquiries() {
  return (
    <PosLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <GeneralEnquiriesContent />
      </div>
    </PosLayout>
  );
}
