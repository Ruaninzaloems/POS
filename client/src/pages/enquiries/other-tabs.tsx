import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MapPin, Phone, Clock, Download, FileText, Shield, ArrowRight,
  ChevronDown, ChevronUp, Building2, Loader2, Landmark, Gift, Zap,
  Receipt, AlertCircle, X, CalendarDays, Hash, Scale, Banknote,
  Mail, MessageSquare, Send, CheckCircle2, Eye, Paperclip, RefreshCw
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
  getOccupiers, addOccupier, deleteOccupier, getAdditionalEmails,
  getAttpApplicationHistory,
} from '@/lib/enquiries-service';
import { LoadingSkeleton, EmptyState, ErrorState, PaginatedTable, FieldRow, getFinYearOptions } from './shared';
import { generateStatementPdf } from '@/lib/statement-pdf';
import { generateSection49Letter, generateSection78Letter, generateValuationCertificate } from '@/lib/property-letters-pdf';

export function PropertyDetailsTab({ accountId }: { accountId: number }) {
  const [propData, setPropData] = useState<any>(null);
  const [consUnit, setConsUnit] = useState<any>(null);
  const [valuations, setValuations] = useState<any[]>([]);
  const [ratesDetails, setRatesDetails] = useState<any>(null);
  const [meters, setMeters] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
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
        <div className="px-4 py-3 bg-gradient-to-r from-slate-600 to-slate-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Property Letters & Certificates</h3>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-4">
            <button
              data-testid="button-section49-letter"
              disabled={generatingPdf !== null}
              onClick={async () => {
                setGeneratingPdf('section49');
                try { await generateSection49Letter(accountId); } catch (e: any) { alert('Failed to generate Section 49 Letter: ' + (e.message || 'Unknown error')); } finally { setGeneratingPdf(null); }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700 shadow-sm"
            >
              {generatingPdf === 'section49' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-slate-500" />}
              View Section 49 Letter
            </button>
            <button
              data-testid="button-section78-letter"
              disabled={generatingPdf !== null}
              onClick={async () => {
                setGeneratingPdf('section78');
                try { await generateSection78Letter(accountId); } catch (e: any) { alert('Failed to generate Section 78 Letter: ' + (e.message || 'Unknown error')); } finally { setGeneratingPdf(null); }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700 shadow-sm"
            >
              {generatingPdf === 'section78' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-slate-500" />}
              View Section 78 Letter
            </button>
            <button
              data-testid="button-valuation-certificate"
              disabled={generatingPdf !== null}
              onClick={async () => {
                setGeneratingPdf('valcert');
                try { await generateValuationCertificate(accountId); } catch (e: any) { alert('Failed to generate Valuation Certificate: ' + (e.message || 'Unknown error')); } finally { setGeneratingPdf(null); }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700 shadow-sm"
            >
              {generatingPdf === 'valcert' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-slate-500" />}
              View Valuation Certificate
            </button>
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
                {meters.map((m: any, i: number) => {
                  const meterNum = m.physicalMeterNo || m.physicalMeterNumber || m.meterNo || m.meterNumber || m.meter_Number || '-';
                  const service = m.serviceDesc || m.serviceType || m.serviceDescription || m.service || '-';
                  const status = m.serviceStatus || m.status || (m.isActive ? 'Active' : m.serviceStatusID === 1 ? 'Active' : 'Inactive') || '-';
                  const isActiveStatus = status === 'Active' || m.serviceStatusID === 1 || m.isActive;
                  const meterType = m.meterClassificationDesc || m.meterType || m.type || '-';
                  const lastReading = m.lastReading ?? m.currentReading ?? '-';
                  const readDate = m.readDate || m.lastReadDate;
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-cyan-50/30 transition-colors">
                      <td className="py-2 px-3 font-mono font-medium text-slate-800">{meterNum}</td>
                      <td className="py-2 px-3 text-slate-600">{service}</td>
                      <td className="py-2 px-3">
                        <Badge variant={isActiveStatus ? 'default' : 'secondary'} className={`text-[10px] ${isActiveStatus ? 'bg-green-100 text-green-800' : ''}`}>{status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{meterType}</td>
                      <td className="py-2 px-3 text-right font-mono">{lastReading}</td>
                      <td className="py-2 px-3 text-slate-600">{fmtDate(readDate)}</td>
                    </tr>
                  );
                })}
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
      const filtered = Array.isArray(an) ? an.filter((item: any) => {
        if (typeof item === 'string') return item.trim() !== '';
        return true;
      }) : [];
      setAccountNotifs(filtered);
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
          {accountNotifs.every((n: any) => typeof n === 'string') ? (
            <div className="divide-y divide-slate-100" data-testid="table-account-notifications">
              {accountNotifs.map((n: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-orange-50/30 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{n}</span>
                </div>
              ))}
            </div>
          ) : (
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
                      <td className="py-2 px-3 text-slate-600">{n.notificationDate ? new Date(n.notificationDate).toLocaleDateString('en-ZA') : '-'}</td>
                      <td className="py-2 px-3 font-medium">{n.notificationType || n.type || '-'}</td>
                      <td className="py-2 px-3 max-w-[300px] truncate">{n.message || n.description || '-'}</td>
                      <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{n.status || '-'}</Badge></td>
                      <td className="py-2 px-3 text-slate-500 text-xs">{n.createdBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
      const { generateStatement } = await import('@/lib/external-api');
      const result = await generateStatement({ accountId, statementType, financialYear: modalYear, month: modalMonth || undefined });
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
      const yr = statement.financialYear || modalYear;
      const mo = statement.month || modalMonth || '';
      await generateStatementPdf(accountId, accountNumber, yr, mo, statementType);
    } catch (e: any) {
      alert('Failed to generate statement PDF: ' + (e.message || 'Unknown error'));
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
      const { getPropertyDetails, getNameInfo } = await import('@/lib/enquiries-service');
      const [propResp, nameResp] = await Promise.all([
        getPropertyDetails(accountId).catch(() => null),
        getNameInfo(accountId).catch(() => null),
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

type SendMode = 'email' | 'sms';
interface EmailTarget {
  address: string;
  selected: boolean;
  type: 'primary' | 'additional';
}

export function SendStatementsTab({ accountId }: { accountId: number }) {
  const years = useMemo(() => getFinYearOptions(), []);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const [mode, setMode] = useState<SendMode>('email');
  const [fromYear, setFromYear] = useState(years[0]);
  const [fromMonth, setFromMonth] = useState(months[0]);
  const [toYear, setToYear] = useState(years[0]);
  const [toMonth, setToMonth] = useState(months[new Date().getMonth()]);
  const [statementType, setStatementType] = useState<'account' | 'detailed'>('account');

  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState<string | null>(null);
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [mobile, setMobile] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const [emailTargets, setEmailTargets] = useState<EmailTarget[]>([]);
  const [smsSelected, setSmsSelected] = useState(true);

  const [customMessage, setCustomMessage] = useState('');
  const [includeStatementPdf, setIncludeStatementPdf] = useState(true);
  const [includeTemplateLink, setIncludeTemplateLink] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadedRef = useRef(false);

  const loadContactInfo = useCallback(async () => {
    setContactLoading(true);
    setContactError(null);
    try {
      const [nameResult, contactResult] = await Promise.all([
        getNameInfo(accountId).catch(() => null),
        getContactDetails(accountId).catch(() => null),
      ]);

      const n = nameResult || {};
      const c = Array.isArray(contactResult) ? contactResult[0] : (contactResult || {});

      const name = [n.initials, n.surname || n.lastName].filter(Boolean).join(' ') || c.name || '';
      setAccountHolder(name);
      setAccountNumber(String(accountId).padStart(12, '0'));

      const email = c.email || c.eMail || c.emailAddress || c.Email || n.email || n.eMail || '';
      setPrimaryEmail(email);

      const mob = c.cellphone || c.cellPhone || c.mobile || c.mobileNumber || c.tel_Mobile || n.tel_Mobile || n.cellphone || '';
      setMobile(mob);

      let addEmails: string[] = [];
      if (email) {
        try {
          const addResult = await getAdditionalEmails(email);
          addEmails = (Array.isArray(addResult) ? addResult : [])
            .map((e: any) => e?.email || e?.emailAddress || e?.Email || (typeof e === 'string' ? e : ''))
            .filter((e: string) => e && e.includes('@') && e !== email);
        } catch {}
      }
      setAdditionalEmails(addEmails);

      const targets: EmailTarget[] = [];
      if (email) targets.push({ address: email, selected: true, type: 'primary' });
      addEmails.forEach(ae => targets.push({ address: ae, selected: false, type: 'additional' }));
      setEmailTargets(targets);

      loadedRef.current = true;
    } catch (e: any) {
      setContactError(e.message || 'Failed to load contact information');
    } finally {
      setContactLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!loadedRef.current || accountId) {
      loadedRef.current = false;
      loadContactInfo();
    }
  }, [accountId, loadContactInfo]);

  const toggleEmailTarget = (idx: number) => {
    setEmailTargets(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  const selectedEmails = emailTargets.filter(t => t.selected);

  const getSelectedPeriods = (): string[] => {
    const periods: string[] = [];
    const fmIdx = months.indexOf(fromMonth);
    const tmIdx = months.indexOf(toMonth);

    const sortedYears = [...years].sort();
    const fyPos = sortedYears.indexOf(fromYear);
    const tyPos = sortedYears.indexOf(toYear);

    const startYPos = Math.min(fyPos, tyPos);
    const endYPos = Math.max(fyPos, tyPos);

    for (let yi = startYPos; yi <= endYPos; yi++) {
      const yr = sortedYears[yi];
      const startM = yi === Math.min(fyPos, tyPos)
        ? (fyPos <= tyPos ? fmIdx : tmIdx)
        : 0;
      const endM = yi === Math.max(fyPos, tyPos)
        ? (fyPos <= tyPos ? tmIdx : fmIdx)
        : 11;
      for (let mi = startM; mi <= endM; mi++) {
        periods.push(`${yr} - ${months[mi]}`);
      }
    }
    return periods.length > 0 ? periods : [`${fromYear} - ${fromMonth}`];
  };

  const handleSend = () => {
    setSending(true);
    setSendResult(null);

    const payload = {
      mode,
      accountId,
      accountNumber,
      accountHolder,
      statementType,
      periodFrom: `${fromYear} - ${fromMonth}`,
      periodTo: `${toYear} - ${toMonth}`,
      periods: getSelectedPeriods(),
      includeStatementPdf,
      includeTemplateLink,
      customMessage: customMessage || undefined,
      ...(mode === 'email' ? {
        emailRecipients: selectedEmails.map(e => e.address),
        service: 'mimecast',
      } : {
        smsRecipient: mobile,
        service: 'sms-gateway',
        templateLinkEnabled: true,
      }),
    };

    console.log('[SendStatements] DISPATCH payload (not sent):', JSON.stringify(payload, null, 2));

    setTimeout(() => {
      setSending(false);
      setSendResult({
        success: true,
        message: mode === 'email'
          ? `Statement delivery queued for ${selectedEmails.length} email address(es). Service: Mimecast (not yet connected).`
          : `SMS statement link queued for ${mobile}. Service: SMS Gateway (not yet connected).`,
      });
    }, 1200);
  };

  const canSend = mode === 'email'
    ? selectedEmails.length > 0
    : (smsSelected && !!mobile);

  if (contactLoading) return <LoadingSkeleton />;
  if (contactError) return <ErrorState message={contactError} onRetry={loadContactInfo} />;

  return (
    <div className="p-5 space-y-5" data-testid="send-statements-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Send Account Statements</h3>
          <p className="text-xs text-slate-500 mt-0.5">Generate and deliver statements via email or SMS</p>
        </div>
        <div className="flex bg-white rounded-lg border shadow-sm p-0.5">
          <button
            onClick={() => setMode('email')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'email' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            data-testid="button-send-mode-email"
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </button>
          <button
            onClick={() => setMode('sms')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'sms' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            data-testid="button-send-mode-sms"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            SMS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Statement Period & Type</h4>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Account</span>
                  <span className="text-sm font-mono font-bold text-blue-800">{accountNumber}</span>
                </div>
                {accountHolder && (
                  <div className="text-sm font-medium text-slate-700">{accountHolder}</div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">From Period</label>
                  <div className="flex gap-2">
                    <select value={fromYear} onChange={e => setFromYear(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" data-testid="select-from-year">
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={fromMonth} onChange={e => setFromMonth(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" data-testid="select-from-month">
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">To Period</label>
                  <div className="flex gap-2">
                    <select value={toYear} onChange={e => setToYear(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" data-testid="select-to-year">
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={toMonth} onChange={e => setToMonth(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" data-testid="select-to-month">
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-5 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Type:</span>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="sendStmtType" checked={statementType === 'account'} onChange={() => setStatementType('account')} className="w-3.5 h-3.5 text-blue-600" data-testid="radio-send-account" />
                  <span className={`font-medium ${statementType === 'account' ? 'text-blue-700' : 'text-slate-500'}`}>Account Statement</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="sendStmtType" checked={statementType === 'detailed'} onChange={() => setStatementType('detailed')} className="w-3.5 h-3.5 text-blue-600" data-testid="radio-send-detailed" />
                  <span className={`font-medium ${statementType === 'detailed' ? 'text-blue-700' : 'text-slate-500'}`}>Detailed Statement</span>
                </label>
              </div>
            </div>
          </div>

          {mode === 'email' && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-white" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Delivery Options</h4>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={includeStatementPdf}
                    onChange={e => setIncludeStatementPdf(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                    data-testid="checkbox-include-pdf"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-500" />
                      Generate & Attach Statement PDF
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Generate the statement as a PDF and attach it to the email. Uses the reports service to render the official statement template.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={includeTemplateLink}
                    onChange={e => setIncludeTemplateLink(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                    data-testid="checkbox-include-link"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-blue-500" />
                      Include Statement Link
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Include a secure link in the email body that opens the statement in the browser. Useful for large statements or when PDF delivery isn't preferred.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {mode === 'sms' && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-white" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">SMS Delivery</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    A secure template link will be generated and sent via SMS. The recipient can open this link to view their statement in the browser.
                  </p>
                </div>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={includeTemplateLink}
                    onChange={e => setIncludeTemplateLink(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-green-600"
                    data-testid="checkbox-sms-link"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Include Secure Statement Link</div>
                    <p className="text-xs text-slate-500 mt-0.5">Generate a time-limited secure link for the recipient to view their statement online.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Custom Message (Optional)</h4>
            </div>
            <div className="p-4">
              <textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                placeholder={mode === 'email' ? "Add a custom message to include in the email body (optional)..." : "Add a custom message to include in the SMS (optional, keep it short)..."}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                rows={mode === 'email' ? 4 : 2}
                maxLength={mode === 'sms' ? 120 : undefined}
                data-testid="textarea-custom-message"
              />
              {mode === 'sms' && (
                <p className="text-[10px] text-slate-400 mt-1">{customMessage.length}/120 characters (remaining space reserved for statement link)</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className={`px-4 py-2.5 flex items-center justify-between ${mode === 'email' ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-green-600 to-green-700'}`}>
              <div className="flex items-center gap-2">
                {mode === 'email' ? <Mail className="w-4 h-4 text-white" /> : <Phone className="w-4 h-4 text-white" />}
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  {mode === 'email' ? 'Email Recipients' : 'SMS Recipient'}
                </h4>
              </div>
              <button
                onClick={loadContactInfo}
                className="w-6 h-6 rounded-md bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                title="Refresh contact details"
                data-testid="button-refresh-contacts"
              >
                <RefreshCw className="w-3 h-3 text-white" />
              </button>
            </div>

            {mode === 'email' ? (
              <div className="p-3 space-y-1.5">
                {emailTargets.length === 0 ? (
                  <div className="py-6 text-center">
                    <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400 font-medium">No email address on file</p>
                    <p className="text-xs text-slate-400 mt-1">Update the account's contact details to add email</p>
                  </div>
                ) : (
                  emailTargets.map((target, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        target.selected
                          ? 'border-blue-300 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={target.selected}
                        onChange={() => toggleEmailTarget(idx)}
                        className="rounded border-slate-300 text-blue-600"
                        data-testid={`checkbox-email-${idx}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-800 truncate font-medium">{target.address}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            target.type === 'primary'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {target.type === 'primary' ? 'Default' : 'Additional'}
                          </span>
                        </div>
                      </div>
                      {target.selected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </label>
                  ))
                )}
                <div className="pt-2 border-t border-slate-100 mt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{selectedEmails.length} of {emailTargets.length} selected</span>
                    <button
                      onClick={() => setEmailTargets(prev => prev.map(t => ({ ...t, selected: true })))}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Select All
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3">
                {mobile ? (
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    smsSelected
                      ? 'border-green-300 bg-green-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={smsSelected}
                      onChange={e => setSmsSelected(e.target.checked)}
                      className="rounded border-slate-300 text-green-600"
                      data-testid="checkbox-sms-mobile"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-mono font-bold text-slate-800">{mobile}</div>
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-200 mt-1">
                        Mobile
                      </span>
                    </div>
                    {smsSelected && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                  </label>
                ) : (
                  <div className="py-6 text-center">
                    <Phone className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400 font-medium">No mobile number on file</p>
                    <p className="text-xs text-slate-400 mt-1">Update the account's contact details to add a mobile number</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-slate-500 to-slate-600 flex items-center gap-2">
              <Eye className="w-4 h-4 text-white" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Delivery Summary</h4>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Account</span>
                  <span className="font-mono font-bold text-slate-800">{accountNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium text-slate-700">{statementType === 'account' ? 'Account' : 'Detailed'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Period</span>
                  <span className="font-medium text-slate-700 text-right text-xs">{fromYear} {fromMonth}<br/>→ {toYear} {toMonth}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Channel</span>
                  <Badge className={mode === 'email' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-green-100 text-green-700 border-green-200'}>
                    {mode === 'email' ? 'Email (Mimecast)' : 'SMS Gateway'}
                  </Badge>
                </div>
                {mode === 'email' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Recipients</span>
                    <span className="font-bold text-blue-700">{selectedEmails.length} address(es)</span>
                  </div>
                )}
                {mode === 'email' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Attach PDF</span>
                    <span className={includeStatementPdf ? 'text-green-600 font-semibold' : 'text-slate-400'}>
                      {includeStatementPdf ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all"
                  data-testid="button-stmt-preview"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Hide Preview' : 'Preview Message'}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!canSend || sending}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-lg transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                    mode === 'email'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                      : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                  }`}
                  data-testid="button-send-statement"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {mode === 'email' ? 'Send Email' : 'Send SMS'}
                    </>
                  )}
                </button>
              </div>

              {sendResult && (
                <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                  sendResult.success
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {sendResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{sendResult.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Statement delivery services are not yet connected. Email will use <strong>Mimecast</strong> and SMS will use the <strong>SMS Gateway</strong> when integrated. Payloads are logged for migration to Angular.
              </span>
            </p>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-white" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Message Preview</h4>
            </div>
            <button onClick={() => setShowPreview(false)} className="w-6 h-6 rounded-md bg-white/20 hover:bg-white/30 flex items-center justify-center" data-testid="button-close-preview">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <div className="p-5">
            {mode === 'email' ? (
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="text-slate-500 w-20 shrink-0 text-right">To:</span>
                  <span className="text-slate-700 font-medium">{selectedEmails.map(e => e.address).join('; ') || '(none selected)'}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-slate-500 w-20 shrink-0 text-right">Subject:</span>
                  <span className="text-slate-700 font-medium">
                    Account Statement - {accountNumber} ({fromMonth} {fromYear} to {toMonth} {toYear})
                  </span>
                </div>
                {includeStatementPdf && (
                  <div className="flex gap-3">
                    <span className="text-slate-500 w-20 shrink-0 text-right">Attach:</span>
                    <span className="flex items-center gap-1.5 text-orange-600">
                      <FileText className="w-3.5 h-3.5" />
                      Statement_{accountNumber}_{fromMonth}_{toMonth}.pdf
                    </span>
                  </div>
                )}
                <div className="mt-3 bg-slate-50 rounded-lg p-4 border whitespace-pre-wrap text-slate-700">
                  <p>Dear {accountHolder || 'Account Holder'},</p>
                  <br />
                  <p>Please find your {statementType === 'detailed' ? 'detailed ' : ''}account statement for the period {fromMonth} {fromYear} to {toMonth} {toYear}.</p>
                  {customMessage && (
                    <>
                      <br />
                      <p>{customMessage}</p>
                    </>
                  )}
                  {includeTemplateLink && (
                    <>
                      <br />
                      <p className="text-blue-600 underline">[View Statement Online →]</p>
                    </>
                  )}
                  <br />
                  <p>Kind regards,</p>
                  <p className="font-medium">George Municipality</p>
                  <p className="text-xs text-slate-500">This is an automated statement from the Municipal Billing System.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3 text-sm">
                  <span className="text-slate-500 w-12 shrink-0">To:</span>
                  <span className="font-mono font-bold text-slate-800">{mobile || '(no number)'}</span>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-sm text-slate-700">
                  <p>George Municipality: Your {statementType === 'detailed' ? 'detailed ' : ''}account statement ({fromMonth} - {toMonth} {toYear}) is ready.</p>
                  {customMessage && <p className="mt-1">{customMessage}</p>}
                  {includeTemplateLink && (
                    <p className="mt-1 text-blue-600 underline">[https://statements.george.gov.za/view/...]</p>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">SMS will be delivered via SMS Gateway service (not yet connected)</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IndigentHistoryTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAttpApplicationHistory(accountId);
      setData(Array.isArray(result) ? result : result ? [result] : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load indigent history');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmtDate = (v: any) => {
    if (!v) return '-';
    try { return new Date(v).toLocaleDateString('en-ZA'); } catch { return '-'; }
  };
  const fmtAmt = (v: any) => v != null && v !== '' ? Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '0.00';

  return (
    <div className="p-5 space-y-5" data-testid="indigent-history-panel">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-700 to-teal-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Indigent History</h3>
          {data.length > 0 && (
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{data.length}</Badge>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="table-indigent-history">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-200">
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">ATTP Status</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Indigent Type</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Application Date</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Disqualify / Terminate / Cancel Date</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Last Verification Date</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Disqualify / Terminate / Cancel Reason</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Do-Not-Cut Date</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Do-Not-Cut Ext Reason</th>
                <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Application Write Off Amount</th>
                <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Total Write Off Amount</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Electricity Meter Service Type</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Meter Change Date</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-slate-400 text-sm">No records to display.</td>
                </tr>
              ) : data.map((row: any, i: number) => {
                const statusText = row.attpStatus || row.status || row.attpStatusDesc || '-';
                const isActive = statusText.toLowerCase().includes('active') || statusText.toLowerCase().includes('approved');
                const isTerminated = statusText.toLowerCase().includes('terminat') || statusText.toLowerCase().includes('disqualif') || statusText.toLowerCase().includes('cancel');
                return (
                  <tr key={i} className={`border-b border-slate-100 hover:bg-teal-50/30 transition-colors ${isTerminated ? 'bg-red-50/20' : ''}`} data-testid={`indigent-row-${i}`}>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isTerminated ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {statusText}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{row.indigentType || row.attpType || row.type || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDate(row.applicationDate || row.appDate)}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDate(row.disqualifyDate || row.terminateDate || row.cancelDate || row.disqualifyTerminateCancelDate)}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDate(row.lastVerificationDate || row.verificationDate)}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={row.disqualifyReason || row.terminateReason || row.cancelReason || row.disqualifyTerminateCancelReason || ''}>
                      {row.disqualifyReason || row.terminateReason || row.cancelReason || row.disqualifyTerminateCancelReason || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDate(row.doNotCutDate || row.dncDate)}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate" title={row.doNotCutExtReason || row.dncExtReason || ''}>
                      {row.doNotCutExtReason || row.dncExtReason || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{fmtAmt(row.applicationWriteOffAmount || row.appWriteOffAmount || row.writeOffAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">{fmtAmt(row.totalWriteOffAmount || row.totalWriteOff)}</td>
                    <td className="py-2.5 px-3 text-slate-700">{row.electricityMeterServiceType || row.elecMeterServiceType || row.meterServiceType || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDate(row.meterChangeDate || row.elecMeterChangeDate)}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={row.remarks || row.comment || ''}>
                      {row.remarks || row.comment || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          <span>Items per page: <span className="border rounded px-2 py-0.5 bg-white">50</span></span>
          <span>{data.length > 0 ? `1 - ${data.length} of ${data.length}` : '0 of 0'}</span>
        </div>
      </div>
    </div>
  );
}
