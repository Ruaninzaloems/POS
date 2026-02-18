import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MapPin, Phone, Clock, Download, FileText, Shield, ArrowRight,
  ChevronDown, ChevronUp, Building2, Loader2, Landmark, Gift, Zap,
  Receipt, AlertCircle, X, CalendarDays, Hash, Scale, Banknote
} from 'lucide-react';
import {
  getPropertyDetails, getConsumptionUnits, getSupplementaryValuations,
  getAccountRatesDetails, getMeteredServicesOnAccount, getTransferOwnership,
  getNameInfo, getContactDetails, getContactDetailsHistory,
  getDeliveryAddressHistory, getAccountDeliveryAddressDetail,
  getHandoverInfo, getHandoverAccountEnquiry,
  getConsHandoverTransactionDetail, getAccountNotifications,
  getPropertyNotification, getGeneratedStatements,
  getClearanceInquiries, getDebtorNoteLists, getSection129AccountEnquiry,
  getOccupiers, addOccupier, deleteOccupier,
} from '@/lib/enquiries-service';
import { LoadingSkeleton, EmptyState, ErrorState, PaginatedTable, FieldRow, getFinYearOptions } from './shared';

export function PropertyDetailsTab({ accountId }: { accountId: number }) {
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

export function ContactInfoTab({ accountId }: { accountId: number }) {
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

export function HandoverTab({ accountId }: { accountId: number }) {
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

export function NotificationsTab({ accountId }: { accountId: number }) {
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

export function StatementsTab({ accountId }: { accountId: number }) {
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

export function ClearanceTab({ accountId }: { accountId: number }) {
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

export function DebtorNotesTab({ accountId }: { accountId: number }) {
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

export function Section129Tab({ accountId }: { accountId: number }) {
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

export function OccupiersTab({ accountId }: { accountId: number }) {
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
