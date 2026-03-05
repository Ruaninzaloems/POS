import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MapPin, Phone, Clock, Download, FileText, Shield, ArrowRight,
  ChevronDown, ChevronUp, Building2, Loader2, Landmark, Gift, Zap,
  Receipt, AlertCircle, X, CalendarDays, Hash, Scale, Banknote,
  Mail, MessageSquare, Send, CheckCircle2, Eye, Paperclip, RefreshCw,
  Search, FileDown
} from 'lucide-react';
import {
  getPropertyDetails, getConsumptionUnits, getSupplementaryValuations,
  getAccountRatesDetails, getMeteredServicesOnAccount, getTransferOwnership,
  getNameInfo, getContactDetails, getContactDetailsHistory,
  getDeliveryAddressHistory, getAccountDeliveryAddressDetail,
  getHandoverInfo, getHandoverAccountEnquiry,
  getConsHandoverTransactionDetail, getAccountNotifications,
  getPropertyNotification, getGeneratedStatements,
  getClearanceInquiries, downloadClearanceDocument,
  getLinkedAccountsOnProperty,
  getDebtorNoteLists, getSection129AccountEnquiry,
  getOccupiers, addOccupier, deleteOccupier, getAdditionalEmails,
  getAttpApplicationHistory,
} from '@/lib/enquiries-service';
import { LoadingSkeleton, EmptyState, ErrorState, PaginatedTable, FieldRow, getFinYearOptions } from './shared';
import { generateStatementPdf } from '@/lib/statement-pdf';
import { fetchMunicipalityInfo, type MunicipalityInfo } from '@/lib/external-api';
import { generateSection49Letter, generateSection78Letter, generateValuationCertificate } from '@/lib/property-letters-pdf';

function TransferOfOwnershipSection({ transfers, fmt, fmtDate }: { transfers: any[]; fmt: (v: any) => string; fmtDate: (v: any) => string }) {
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const totalRecords = transfers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * itemsPerPage;
  const pageItems = transfers.slice(startIdx, startIdx + itemsPerPage);

  const thCls = "text-left py-2.5 px-3 text-[11px] font-semibold text-slate-600 whitespace-nowrap border-r border-[#D6D6D6] last:border-r-0 cursor-pointer hover:bg-[#F2F4F7] select-none";
  const sortIcon = <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span>;

  return (
    <div className="bg-white rounded-lg border border-[#D6D6D6] shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-[#F2F4F7] border-b border-[#D6D6D6] text-center">
        <h3 className="text-sm font-semibold text-slate-800" data-testid="text-transfer-title">Transfer of Ownership History:</h3>
      </div>

      <div className="sm:hidden p-2 space-y-2">
        {pageItems.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">No records to display.</div>
        ) : pageItems.map((t: any, i: number) => {
          const statusVal = t.status ?? t.transferStatus ?? '-';
          const statusColor = statusVal === 'Approve' || statusVal === 'Approved' ? 'bg-green-100 text-green-700'
            : statusVal === 'Rejected' || statusVal === 'Cancelled' ? 'bg-red-100 text-red-700'
            : statusVal === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
          return (
            <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`mobile-transfer-${i}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">{t.financialYear ?? t.financial_Year ?? '-'}</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColor}`}>{statusVal}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Transfer Date</span><span className="text-slate-800 font-medium text-right">{fmtDate(t.transferOfOwnershipDate ?? t.transferDate ?? t.dateOfTransfer ?? t.date)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Old Owner</span><span className="text-slate-800 font-medium text-right truncate max-w-[100px]">{t.oldOwner ?? t.previousOwner ?? t.fromOwner ?? '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Old Acct</span><span className="text-slate-800 font-mono text-right">{t.oldAccountNumber ?? t.oldAccount ?? '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Title Deed</span><span className="text-slate-800 font-mono text-right truncate max-w-[100px]">{t.titleDeedNumber ?? t.titleDeed ?? '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Purchase</span><span className="text-slate-800 font-mono font-semibold text-right">{fmt(t.purchasePrice ?? t.purchase_Price ?? 0)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Purchase Date</span><span className="text-slate-800 text-right">{fmtDate(t.purchaseDate ?? t.purchase_Date)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm border-collapse" data-testid="table-transfer-ownership">
          <thead>
            <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
              <th className={thCls} style={{ minWidth: 100 }}>Financial Year {sortIcon}</th>
              <th className={thCls} style={{ minWidth: 80 }}>Status {sortIcon}</th>
              <th className={thCls} style={{ minWidth: 140 }}>Transfer of Ownership Date {sortIcon}</th>
              <th className={thCls} style={{ minWidth: 160 }}>Old Owner {sortIcon}</th>
              <th className={thCls} style={{ minWidth: 130 }}>Old Account Number {sortIcon}</th>
              <th className={thCls} style={{ minWidth: 130 }}>Title Deed Number {sortIcon}</th>
              <th className={thCls} style={{ minWidth: 120 }}>Registration Date {sortIcon}</th>
              <th className={thCls} style={{ minWidth: 140 }}>RDP / Land Reform Date {sortIcon}</th>
              <th className={`${thCls} text-right`} style={{ minWidth: 170 }}>Journal Amount - Services {sortIcon}</th>
              <th className={`${thCls} text-right`} style={{ minWidth: 210 }}>Journal Amount - Additional Billing {sortIcon}</th>
              <th className={`${thCls} text-right`} style={{ minWidth: 110 }}>Purchase Price {sortIcon}</th>
              <th className={thCls} style={{ minWidth: 110 }}>Purchase Date {sortIcon}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr><td colSpan={12} className="py-6 text-center text-slate-400 text-sm">No records to display.</td></tr>
            ) : pageItems.map((t: any, i: number) => (
              <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/40 transition-colors" data-testid={`row-transfer-${i}`}>
                <td className="py-2 px-3 text-[13px] text-slate-700 border-r border-[#E5E5E5]">{t.financialYear ?? t.financial_Year ?? '-'}</td>
                <td className="py-2 px-3 text-[13px] border-r border-[#E5E5E5]">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                    (t.status ?? t.transferStatus ?? '') === 'Approve' || (t.status ?? t.transferStatus ?? '') === 'Approved'
                      ? 'bg-green-100 text-green-700'
                      : (t.status ?? t.transferStatus ?? '') === 'Rejected' || (t.status ?? t.transferStatus ?? '') === 'Cancelled'
                        ? 'bg-red-100 text-red-700'
                        : (t.status ?? t.transferStatus ?? '') === 'Pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                  }`}>
                    {t.status ?? t.transferStatus ?? '-'}
                  </span>
                </td>
                <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{fmtDate(t.transferOfOwnershipDate ?? t.transferDate ?? t.dateOfTransfer ?? t.date)}</td>
                <td className="py-2 px-3 text-[13px] text-slate-700 border-r border-[#E5E5E5]">{t.oldOwner ?? t.previousOwner ?? t.fromOwner ?? t.from ?? '-'}</td>
                <td className="py-2 px-3 text-[13px] font-mono text-slate-700 border-r border-[#E5E5E5]">{t.oldAccountNumber ?? t.oldAccount ?? t.previousAccountNumber ?? '-'}</td>
                <td className="py-2 px-3 text-[13px] font-mono text-slate-700 border-r border-[#E5E5E5]">{t.titleDeedNumber ?? t.titleDeed ?? t.deedNumber ?? '-'}</td>
                <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{fmtDate(t.registrationDate ?? t.registerDate)}</td>
                <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{fmtDate(t.rdpLandReformDate ?? t.rdpDate ?? t.landReformDate)}</td>
                <td className="py-2 px-3 text-right font-mono text-[13px] text-slate-700 border-r border-[#E5E5E5]">{fmt(t.journalAmountServices ?? t.journalAmount_Services ?? t.journalAmountService ?? 0)}</td>
                <td className="py-2 px-3 text-right font-mono text-[13px] text-slate-700 border-r border-[#E5E5E5]">{fmt(t.journalAmountAdditionalBilling ?? t.journalAmount_AdditionalBilling ?? t.journalAmountAddBilling ?? 0)}</td>
                <td className="py-2 px-3 text-right font-mono text-[13px] text-slate-700 border-r border-[#E5E5E5]">{fmt(t.purchasePrice ?? t.purchase_Price ?? 0)}</td>
                <td className="py-2 px-3 text-[13px] text-slate-600">{fmtDate(t.purchaseDate ?? t.purchase_Date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 bg-[#F7F7F7] border-t border-[#D6D6D6] flex items-center justify-end gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Items per page:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="border border-[#BFBFBF] rounded px-1.5 py-0.5 text-xs bg-white"
            data-testid="select-transfer-pagesize"
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <span className="text-xs text-slate-500">{totalRecords === 0 ? '0 of 0' : `${startIdx + 1}\u2013${Math.min(startIdx + itemsPerPage, totalRecords)} of ${totalRecords}`}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(1)} disabled={safePage <= 1} className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30" data-testid="btn-transfer-first">&laquo;</button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30" data-testid="btn-transfer-prev">&lsaquo;</button>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30" data-testid="btn-transfer-next">&rsaquo;</button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={safePage >= totalPages} className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30" data-testid="btn-transfer-last">&raquo;</button>
        </div>
      </div>
    </div>
  );
}

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
      const [propResult, consResult, ratesResult, meterResult, transferResult] = await Promise.allSettled([
        getPropertyDetails(accountId),
        getConsumptionUnits(accountId),
        getAccountRatesDetails(accountId),
        getMeteredServicesOnAccount(accountId),
        getTransferOwnership(accountId),
      ]);
      let propVal = propResult.status === 'fulfilled' ? propResult.value : null;
      if (Array.isArray(propVal)) propVal = propVal[0] || null;
      setPropData(propVal);
      const cu = consResult.status === 'fulfilled' ? consResult.value : null;
      const cuData = Array.isArray(cu) ? cu[0] : cu;
      setConsUnit(cuData);
      setRatesDetails(ratesResult.status === 'fulfilled' ? ratesResult.value : null);
      setMeters(meterResult.status === 'fulfilled' ? (Array.isArray(meterResult.value) ? meterResult.value : []) : []);
      setTransfers(transferResult.status === 'fulfilled' ? (Array.isArray(transferResult.value) ? transferResult.value : []) : []);

      const propertyId = propVal?.propertyId || propVal?.property_ID || cuData?.unit_ID;

      if (propertyId) {
        const [valResult] = await Promise.allSettled([
          getSupplementaryValuations(propertyId),
        ]);
        setValuations(valResult.status === 'fulfilled' ? (Array.isArray(valResult.value) ? valResult.value : valResult.value ? [valResult.value] : []) : []);
      }
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load property details');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

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
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5" data-testid="property-details-tab">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <Building2 className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Property Information</h3>
        </div>
        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4">
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Property ID</span><div className="text-sm font-semibold text-slate-800">{prop.propertyId || prop.property_ID || cu.unit_ID || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Erf Number</span><div className="text-sm font-semibold text-slate-800">{(() => { const sg = prop.sgNumber || cu.sgNumber || ''; const parts = sg.split('/'); return parts.length >= 3 ? parts[2] : (prop.erfNumber || cu.erfNumber || '-'); })()}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Portion</span><div className="text-sm font-semibold text-slate-800">{(() => { const sg = prop.sgNumber || cu.sgNumber || ''; const parts = sg.split('/'); return parts.length >= 4 ? parts[3] : '-'; })()}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Allotment / Region Code</span><div className="text-sm font-semibold text-slate-800">{(() => { const sg = prop.sgNumber || cu.sgNumber || ''; const parts = sg.split('/'); return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '-'; })()}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">SG Number</span><div className="text-sm font-mono font-semibold text-slate-500">{prop.sgNumber || cu.sgNumber || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Street Address</span><div className="text-sm font-semibold text-slate-800">{prop.streetNumber ? `${prop.streetNumber} ${prop.streetName}` : prop.streetName || cu.nonStandAddLine1 || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Suburb</span><div className="text-sm font-semibold text-slate-800">{prop.subSuburb || prop.suburb || cu.nonStandAddSuburb || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Town</span><div className="text-sm font-semibold text-slate-800">{prop.town || '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Property Type / Zoning</span><div className="text-sm font-semibold text-slate-800">{prop.typeOfUse ?? prop.typeofUse ?? prop.townPlanningZoneType ?? prop.townPlanningZone ?? '-'}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Market Value</span><div className="text-sm font-bold text-[var(--pos-accent)] font-mono">{fmt(prop.marketValue ?? cu.marketValue)}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Stand Size (m²)</span><div className="text-sm font-semibold text-slate-800">{fmtInt(prop.standSize ?? cu.standSize)}</div></div>
            <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Extent (m²)</span><div className="text-sm font-semibold text-slate-800">{fmtInt(prop.extentM2 ?? prop.extent_M2 ?? cu.extentM2 ?? cu.extent_M2)}</div></div>
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
          <div className="mt-5 pt-4 border-t border-[#E5E5E5]">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Electoral & Classification Details</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4">
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Ward</span><div className="text-sm font-semibold text-slate-800">{cu.wardID ? `Ward ${cu.wardID}` : prop.ward ? `Ward ${prop.ward}` : '-'}</div></div>
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Polling Station</span><div className="text-sm font-semibold text-slate-800">{cu.pollingStationID ? `Station ${cu.pollingStationID}` : '-'}</div></div>
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Magisterial District</span><div className="text-sm font-semibold text-slate-800">{cu.magisterialID ? `District ${cu.magisterialID}` : '-'}</div></div>
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">NT Property Category</span><div className="text-sm font-semibold text-slate-800">{(() => { const id = cu.ntPropertyCategoryID; if (id === null || id === undefined) return '-'; const catMap: Record<number, string> = { 1: 'Unknown', 2: 'RES', 3: 'Residential Accommodation', 4: 'State Business', 5: 'POWC', 6: 'NMON', 7: 'Creches', 8: 'Guesthouses & B&Bs', 9: 'Flats', 10: 'State Residential', 32: 'Residential Vacant', 33: 'PSPV', 34: 'POWP', 35: 'POWG', 36: 'POWV', 37: 'PROT', 38: 'MUNG', 40: 'MUNRO', 41: 'MUN' }; return catMap[id] || cu.ntPropertyCategoryDescription || `Category ${id}`; })()}</div></div>
              <div className="space-y-0.5"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Billing Cycle</span><div className="text-sm font-semibold text-slate-800">{cu.billingCycleID ?? '-'}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <FileText className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Property Letters & Certificates</h3>
        </div>
        <div className="p-3 sm:p-5">
          <div className="flex flex-wrap gap-4">
            <button
              data-testid="button-section49-letter"
              disabled={generatingPdf !== null}
              onClick={async () => {
                setGeneratingPdf('section49');
                try { await generateSection49Letter(accountId); } catch (e: any) { alert('Failed to generate Section 49 Letter: ' + (e.message || 'Unknown error')); } finally { setGeneratingPdf(null); }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#D6D6D6] rounded-lg hover:bg-[#F7F7F7] hover:border-[#BFBFBF] transition-all text-sm font-medium text-slate-700 shadow-sm"
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
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#D6D6D6] rounded-lg hover:bg-[#F7F7F7] hover:border-[#BFBFBF] transition-all text-sm font-medium text-slate-700 shadow-sm"
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
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#D6D6D6] rounded-lg hover:bg-[#F7F7F7] hover:border-[#BFBFBF] transition-all text-sm font-medium text-slate-700 shadow-sm"
            >
              {generatingPdf === 'valcert' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-slate-500" />}
              View Valuation Certificate
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <Landmark className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">General Valuations</h3>
          <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{valuations.length}</Badge>
        </div>
        {valuations.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No valuation records found</div>
        ) : (
          <>
          <div className="sm:hidden p-2 space-y-2">
            {valuations.map((v: any, i: number) => (
              <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Type</span><span className="text-slate-800 font-semibold text-right">{v.type || '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Status</span><span className="text-right"><Badge variant={v.valuationStatus === 'Active' ? 'default' : 'secondary'} className={`text-[10px] ${v.valuationStatus === 'Active' ? 'bg-green-100 text-green-800' : ''}`}>{v.valuationStatus || '-'}</Badge></span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Fin Year</span><span className="text-slate-800 font-semibold text-right">{v.financialYear || '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Market Value</span><span className="text-slate-800 font-semibold text-right font-mono">{fmt(v.standMarketValue)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Improvement</span><span className="text-slate-800 font-semibold text-right font-mono">{fmt(v.improvementValue)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Stand Size (m²)</span><span className="text-slate-800 font-semibold text-right font-mono">{fmtInt(v.standSize)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Tariff</span><span className="text-slate-800 font-semibold text-right">{v.ratesTariffCode || '-'}</span></div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
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
                  <tr key={i} className="border-b border-[#E5E5E5] hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-800">{v.type || '-'}</td>
                    <td className="py-2 px-3">
                      <Badge variant={v.valuationStatus === 'Active' ? 'default' : 'secondary'} className={`text-[10px] ${v.valuationStatus === 'Active' ? 'bg-green-100 text-green-800' : ''}`}>{v.valuationStatus || '-'}</Badge>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{v.financialYear || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--pos-accent)]">{fmt(v.standMarketValue)}</td>
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
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <Gift className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Rebates & Levies</h3>
        </div>
        <div className="p-3 sm:p-5">
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

      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <Zap className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Meters</h3>
          <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{meters.length}</Badge>
        </div>
        {meters.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No meters linked to this property</div>
        ) : (
          <>
          <div className="sm:hidden p-2 space-y-2">
            {meters.map((m: any, i: number) => {
              const meterNum = m.physicalMeterNo || m.physicalMeterNumber || m.meterNo || m.meterNumber || m.meter_Number || '-';
              const service = m.serviceDesc || m.serviceType || m.serviceDescription || m.service || '-';
              const status = m.serviceStatus || m.status || (m.isActive ? 'Active' : m.serviceStatusID === 1 ? 'Active' : 'Inactive') || '-';
              const isActiveStatus = status === 'Active' || m.serviceStatusID === 1 || m.isActive;
              const lastReading = m.lastReading ?? m.currentReading ?? '-';
              const readDate = m.readDate || m.lastReadDate;
              return (
                <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Meter Number</span><span className="text-slate-800 font-semibold text-right font-mono">{meterNum}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Service</span><span className="text-slate-800 font-semibold text-right">{service}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Status</span><span className="text-right"><Badge variant={isActiveStatus ? 'default' : 'secondary'} className={`text-[10px] ${isActiveStatus ? 'bg-green-100 text-green-800' : ''}`}>{status}</Badge></span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Last Reading</span><span className="text-slate-800 font-semibold text-right font-mono">{lastReading}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Read Date</span><span className="text-slate-800 font-semibold text-right">{fmtDate(readDate)}</span></div>
                </div>
              );
            })}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
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
                    <tr key={i} className="border-b border-[#E5E5E5] hover:bg-cyan-50/30 transition-colors">
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
          </>
        )}
      </div>

      <TransferOfOwnershipSection transfers={transfers} fmt={fmt} fmtDate={fmtDate} />
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
  const [activeSection, setActiveSection] = useState<'contact' | 'delivery' | 'contact-history' | 'address-history'>('contact');
  const prevAccountId = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nameResult, contactResult, daResult, chResult, ahResult] = await Promise.allSettled([
        getNameInfo(accountId),
        getContactDetails(accountId),
        getAccountDeliveryAddressDetail(accountId),
        getContactDetailsHistory(accountId),
        getDeliveryAddressHistory(accountId),
      ]);
      setNameData(nameResult.status === 'fulfilled' ? nameResult.value : null);
      setContactData(contactResult.status === 'fulfilled' ? contactResult.value : null);
      const daVal = daResult.status === 'fulfilled' ? daResult.value : [];
      setDeliveryAddr(Array.isArray(daVal) ? daVal : daVal ? [daVal] : []);
      setContactHistory(chResult.status === 'fulfilled' ? (Array.isArray(chResult.value) ? chResult.value : []) : []);
      setAddressHistory(ahResult.status === 'fulfilled' ? (Array.isArray(ahResult.value) ? ahResult.value : []) : []);
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

  const mobile = n.tel_Mobile || c.mobile || c.tel_Mobile || '';
  const home = n.tel_Home || c.homePhone || c.tel_Home || '';
  const work = n.tel_Work || c.workPhone || c.tel_Work || '';
  const fax = n.fax || c.fax || '';
  const email = n.email || c.email || c.emailAddress || '';
  const addEmails = [c.additionalEmail1, c.additionalEmail2, c.additionalEmail3, c.additionalEmail4].filter(Boolean);

  const fullAddr = [da.streetNumber, da.streetName, da.suburbName || da.suburb, da.town, da.postalCode].filter(Boolean).join(', ');

  const navItems = [
    { id: 'contact' as const, label: 'Contact Details', icon: <Phone className="w-4 h-4" />, color: 'blue' },
    { id: 'delivery' as const, label: 'Delivery Address', icon: <MapPin className="w-4 h-4" />, color: 'emerald' },
    { id: 'contact-history' as const, label: 'Contact History', icon: <Clock className="w-4 h-4" />, badge: contactHistory.length, color: 'indigo' },
    { id: 'address-history' as const, label: 'Address History', icon: <Clock className="w-4 h-4" />, badge: addressHistory.length, color: 'amber' },
  ];

  const ContactField = ({ icon, label, value, testId, highlight }: { icon: React.ReactNode; label: string; value: string; testId: string; highlight?: boolean }) => (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${value ? (highlight ? 'bg-[var(--pos-accent-tint)]/60 border-[#D6D6D6]' : 'bg-white border-[#D6D6D6] hover:border-[#BFBFBF]') : 'bg-[#F7F7F7]/50 border-[#E5E5E5]'}`} data-testid={testId}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${value ? (highlight ? 'bg-[var(--pos-accent)] text-white' : 'bg-[#F2F4F7] text-slate-500') : 'bg-[#F2F4F7] text-slate-300'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
        <p className={`text-sm font-medium truncate ${value ? 'text-slate-800' : 'text-slate-300 italic'}`}>{value || 'Not provided'}</p>
      </div>
    </div>
  );

  return (
    <div className="p-3 sm:p-5" data-testid="contact-info-panel">
      <div className="flex items-center gap-3 mb-4 sm:mb-5">
        <div className="h-1 w-8 bg-[var(--pos-accent)] rounded-full" />
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Contact & Delivery Information</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 sm:mb-5" data-testid="contact-nav">
        {navItems.map(item => {
          const isActive = activeSection === item.id;
          const colorMap: Record<string, { active: string; inactive: string }> = {
            blue: { active: 'bg-[var(--pos-accent)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.15)]', inactive: 'bg-white text-slate-600 border-[#D6D6D6] hover:border-[#D6D6D6] hover:text-[var(--pos-accent)]' },
            emerald: { active: 'bg-emerald-600 text-white shadow-emerald-200', inactive: 'bg-white text-slate-600 border-[#D6D6D6] hover:border-emerald-300 hover:text-emerald-700' },
            indigo: { active: 'bg-[var(--pos-accent)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.15)]', inactive: 'bg-white text-slate-600 border-[#D6D6D6] hover:border-[#D6D6D6] hover:text-[var(--pos-accent)]' },
            amber: { active: 'bg-amber-600 text-white shadow-amber-200', inactive: 'bg-white text-slate-600 border-[#D6D6D6] hover:border-amber-300 hover:text-amber-700' },
          };
          const colors = colorMap[item.color] || colorMap.blue;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${isActive ? `${colors.active} border-transparent shadow-lg` : colors.inactive}`}
              data-testid={`nav-${item.id}`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-[#F2F4F7] text-slate-500'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeSection === 'contact' && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
              <Phone className="w-4 h-4 text-white" />
              <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Phone & Email</h4>
            </div>

            <div className="p-3 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <ContactField icon={<Phone className="w-4 h-4" />} label="Mobile" value={mobile} testId="input-tel-mobile" highlight />
                <ContactField icon={<Phone className="w-4 h-4" />} label="Home" value={home} testId="input-tel-home" />
                <ContactField icon={<Phone className="w-4 h-4" />} label="Work" value={work} testId="input-tel-work" />
                <ContactField icon={<Receipt className="w-4 h-4" />} label="Fax" value={fax} testId="input-fax" />
                <ContactField icon={<Mail className="w-4 h-4" />} label="Email Address" value={email} testId="input-email" highlight />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
              <Mail className="w-4 h-4 text-white" />
              <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Additional Statement Emails</h4>
              {addEmails.length > 0 && <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{addEmails.length}</Badge>}
            </div>

            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">The primary email address above must be populated before additional emails will be considered. Statements emailed to the primary address will also be sent to any additional emails listed below.</p>
            </div>

            <div className="p-3 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ContactField icon={<Mail className="w-4 h-4" />} label="Additional Email 1" value={c.additionalEmail1 || ''} testId="input-additional-email-1" />
                <ContactField icon={<Mail className="w-4 h-4" />} label="Additional Email 2" value={c.additionalEmail2 || ''} testId="input-additional-email-2" />
                <ContactField icon={<Mail className="w-4 h-4" />} label="Additional Email 3" value={c.additionalEmail3 || ''} testId="input-additional-email-3" />
                <ContactField icon={<Mail className="w-4 h-4" />} label="Additional Email 4" value={c.additionalEmail4 || ''} testId="input-additional-email-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'delivery' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {fullAddr && (
            <div className="bg-gradient-to-br from-[#F7F7F7] to-[#F7F7F7] rounded-2xl border border-[#D6D6D6] p-3 sm:p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">Full Delivery Address</p>
                <p className="text-base font-semibold text-slate-800">{fullAddr}</p>
                {da.careOf && <p className="text-xs text-slate-500 mt-1">c/o {da.careOf}</p>}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2" data-testid="section-delivery-address">
              <MapPin className="w-4 h-4 text-white" />
              <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Address Breakdown</h4>
            </div>

            <div className="p-3 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <ContactField icon={<FileText className="w-4 h-4" />} label="Delivery Type" value={da.typeofDeliveryAddress || da.typeOfDeliveryAddress || ''} testId="input-delivery-type" />
                <ContactField icon={<Building2 className="w-4 h-4" />} label="Complex Name" value={da.complexName || ''} testId="input-complex-name" />
                <ContactField icon={<Hash className="w-4 h-4" />} label="Unit Number" value={da.unitNumber || ''} testId="input-unit-number" />
                <ContactField icon={<MapPin className="w-4 h-4" />} label="Address Line 1" value={da.streetNumber || ''} testId="input-address-line1" />
                <ContactField icon={<MapPin className="w-4 h-4" />} label="Address Line 2" value={da.streetName || ''} testId="input-address-line2" />
                <ContactField icon={<MapPin className="w-4 h-4" />} label="Address Line 3" value={da.boxBagNo || ''} testId="input-address-line3" />
                <ContactField icon={<MapPin className="w-4 h-4" />} label="Suburb" value={da.suburbName || da.suburb || ''} testId="input-suburb" />
                <ContactField icon={<MapPin className="w-4 h-4" />} label="City / Town" value={da.town || ''} testId="input-city" />
                <ContactField icon={<MapPin className="w-4 h-4" />} label="Postal Code" value={da.postalCode || ''} testId="input-postal-code" highlight />
                <ContactField icon={<MapPin className="w-4 h-4" />} label="Care Of" value={da.careOf || ''} testId="input-care-of" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'contact-history' && (
        <div className="animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-white" />
              <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Contact Details Change History</h4>
              {contactHistory.length > 0 && <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{contactHistory.length}</Badge>}
            </div>

            {contactHistory.length > 0 ? (
              <>
              <div className="sm:hidden p-2 space-y-2">
                {contactHistory.map((r: any, i: number) => (
                  <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`contact-history-card-${i}`}>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Date</span><span className="text-slate-800 font-semibold text-right">{(() => { try { return r.changeDate ? new Date(r.changeDate).toLocaleDateString('en-ZA') : r.date || '-'; } catch { return r.changeDate || '-'; } })()}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Field</span><span className="text-slate-800 font-semibold text-right">{r.fieldName || r.field || r.description || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Old Value</span><span className="text-red-500 font-semibold text-right font-mono">{r.oldValue || r.previousValue || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">New Value</span><span className="text-emerald-600 font-semibold text-right font-mono">{r.newValue || r.currentValue || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Changed By</span><span className="text-slate-800 font-semibold text-right">{r.changedBy || r.user || '-'}</span></div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-contact-history">
                  <thead>
                    <tr className="bg-[#F2F4F7] border-b-2 border-[#D6D6D6]">
                      <th className="text-left py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">Date</th>
                      <th className="text-left py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">Field</th>
                      <th className="text-left py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">Old Value</th>
                      <th className="text-left py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">New Value</th>
                      <th className="text-left py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">Changed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactHistory.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)] transition-colors" data-testid={`contact-history-row-${i}`}>
                        <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{(() => { try { return r.changeDate ? new Date(r.changeDate).toLocaleDateString('en-ZA') : r.date || '-'; } catch { return r.changeDate || '-'; } })()}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{r.fieldName || r.field || r.description || '-'}</td>
                        <td className="py-2.5 px-4 text-red-500 font-mono">{r.oldValue || r.previousValue || '-'}</td>
                        <td className="py-2.5 px-4 text-emerald-600 font-mono font-medium">{r.newValue || r.currentValue || '-'}</td>
                        <td className="py-2.5 px-4 text-slate-500">{r.changedBy || r.user || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            
            ) : (
              <div className="py-12 px-5 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-[#F7F7F7] flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-[#D6D6D6]" />
                </div>
                <p className="text-sm font-medium text-slate-500">No Contact History</p>
                <p className="text-xs text-slate-400 mt-1">There are no recorded changes to contact details for this account</p>
              </div>
            )}

            {contactHistory.length > 0 && (
              <div className="flex items-center justify-end gap-2 px-4 py-2 bg-[#F7F7F7] border-t border-[#D6D6D6] text-xs text-slate-500">
                <span>Items per page: <span className="border rounded px-2 py-0.5 bg-white">50</span></span>
                <span>{`1 - ${contactHistory.length} of ${contactHistory.length}`}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'address-history' && (
        <div className="animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-white" />
              <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Delivery Address Change History</h4>
              {addressHistory.length > 0 && <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{addressHistory.length}</Badge>}
            </div>

            {addressHistory.length > 0 ? (
              <>
                <div className="sm:hidden p-2 space-y-2" data-testid="table-address-history-mobile">
                  {addressHistory.map((r: any, i: number) => (
                    <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`address-history-row-${i}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">{(() => { try { return r.changeDate ? new Date(r.changeDate).toLocaleDateString('en-ZA') : r.date || '-'; } catch { return r.changeDate || '-'; } })()}</span>
                        <span className="text-[10px] text-slate-400">{r.changedBy || r.user || '-'}</span>
                      </div>
                      <div className="text-xs text-slate-800">{(r.address || r.deliveryAddress || '-').replace(/\r\n/g, ', ')}</div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs" data-testid="table-address-history">
                    <thead>
                      <tr className="bg-[#F2F4F7] border-b-2 border-[#D6D6D6]">
                        <th className="text-left py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">Date</th>
                        <th className="text-left py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">Address</th>
                        <th className="text-left py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">Changed By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addressHistory.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-[#E5E5E5] hover:bg-amber-50/30 transition-colors" data-testid={`address-history-row-${i}`}>
                          <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{(() => { try { return r.changeDate ? new Date(r.changeDate).toLocaleDateString('en-ZA') : r.date || '-'; } catch { return r.changeDate || '-'; } })()}</td>
                          <td className="py-2.5 px-4 text-slate-800">{(r.address || r.deliveryAddress || '-').replace(/\r\n/g, ', ')}</td>
                          <td className="py-2.5 px-4 text-slate-500">{r.changedBy || r.user || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-12 px-5 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-amber-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">No Address History</p>
                <p className="text-xs text-slate-400 mt-1">There are no recorded changes to delivery address for this account</p>
              </div>
            )}

            {addressHistory.length > 0 && (
              <div className="flex items-center justify-end gap-2 px-4 py-2 bg-[#F7F7F7] border-t border-[#D6D6D6] text-xs text-slate-500">
                <span>Items per page: <span className="border rounded px-2 py-0.5 bg-white">50</span></span>
                <span>{`1 - ${addressHistory.length} of ${addressHistory.length}`}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HandoverTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [enquiry, setEnquiry] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(getFinYearOptions()[0]);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [infoResult, enqResult, txnsResult] = await Promise.allSettled([
        getHandoverInfo(accountId),
        getHandoverAccountEnquiry(accountId),
        getConsHandoverTransactionDetail(accountId),
      ]);
      setData(infoResult.status === 'fulfilled' ? infoResult.value : null);
      setEnquiry(enqResult.status === 'fulfilled' ? enqResult.value : null);
      setTransactions(txnsResult.status === 'fulfilled' ? (Array.isArray(txnsResult.value) ? txnsResult.value : []) : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load handover information');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [accountId]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmt = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0;
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('en-ZA') : '-';

  const infoItems = data ? (Array.isArray(data) ? data : [data]) : [];
  const enqItems = enquiry ? (Array.isArray(enquiry) ? enquiry : [enquiry]) : [];
  const seen = new Set<string>();
  const dedupedHandovers = [...infoItems, ...enqItems].filter((h: any) => {
    const key = JSON.stringify({
      acc: h.handoverAccount ?? h.accountNumber ?? h.account ?? '',
      amt: h.handoverAmount ?? h.amount ?? '',
      dt: h.handedOverDate ?? h.handoverDate ?? '',
      rt: h.runType ?? h.type ?? '',
      st: h.status ?? h.handoverStatus ?? '',
      cd: h.dateCreated ?? h.createdDate ?? '',
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const [yearStart, yearEnd] = selectedYear.split('/').map(Number);
  const allHandovers = dedupedHandovers.filter((h: any) => {
    const dateStr = h.handedOverDate ?? h.handoverDate ?? h.dateCreated ?? h.createdDate;
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const fy = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    return fy === (yearStart < 100 ? 2000 + yearStart : yearStart);
  });

  const totalRecords = allHandovers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * itemsPerPage;
  const pageItems = allHandovers.slice(startIdx, startIdx + itemsPerPage);

  const thCls = "text-left py-2.5 px-3 text-[11px] font-semibold text-slate-600 whitespace-nowrap border-r border-[#D6D6D6] last:border-r-0 cursor-pointer hover:bg-[#F2F4F7] select-none";

  return (
    <div className="p-3 sm:p-4 space-y-4 sm:space-y-4">
      <div className="bg-white rounded-lg border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 bg-[#F2F4F7] border-b border-[#D6D6D6]">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-800" data-testid="text-handover-title">Handover List per Billing Period</h3>
        </div>

        <div className="flex justify-center py-3 border-b border-[#D6D6D6] bg-white">
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
            className="text-sm border border-[#BFBFBF] rounded px-4 py-1.5 bg-white focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none min-w-[160px] text-center"
            data-testid="select-handover-year"
          >
            {getFinYearOptions().map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </div>

        <div className="sm:hidden p-2 space-y-2">
          {pageItems.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-sm">No records to display.</div>
          ) : pageItems.map((h: any, i: number) => (
            <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`card-handover-${i}`}>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Run Type</span><span className="text-slate-800 font-semibold text-right">{h.runType ?? h.type ?? '-'}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Account</span><span className="text-slate-800 font-semibold text-right font-mono">{h.handoverAccount ?? h.accountNumber ?? h.account ?? '-'}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Amount</span><span className="text-slate-800 font-semibold text-right font-mono">{fmt(h.handoverAmount ?? h.amount ?? 0)}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Handed Over</span><span className="text-slate-800 font-semibold text-right">{fmtDate(h.handedOverDate ?? h.handoverDate)}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Attorney</span><span className="text-slate-800 font-semibold text-right">{h.attorney ?? h.attorneyName ?? '-'}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Status</span><span className="text-right"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${(h.status ?? h.handoverStatus) === 'Active' ? 'bg-green-100 text-green-700' : (h.status ?? h.handoverStatus) === 'Terminated' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{h.status ?? h.handoverStatus ?? '-'}</span></span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Date Created</span><span className="text-slate-800 font-semibold text-right">{fmtDate(h.dateCreated ?? h.createdDate ?? h.capturedDate)}</span></div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm border-collapse" data-testid="table-handover-list">
            <thead>
              <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                <th className={thCls} style={{ minWidth: 90 }}>Run Type <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 140 }}>Handover Account <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={`${thCls} text-right`} style={{ minWidth: 130 }}>Handover Amount <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 120 }}>Handed Over Date <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 120 }}>Outstanding Days <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 130 }}>Outstanding Month <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 100 }}>Attorney <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 80 }}>Status <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 90 }}>Capturer <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 110 }}>Date Created <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 100 }}>Reviewed By <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 140 }}>Termination Reason <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 120 }}>Termination Date <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 100 }}>Reviewed By <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
                <th className={thCls} style={{ minWidth: 110 }}>Review Date <span className="inline-block ml-0.5 text-slate-400">&#x21C5;</span></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr><td colSpan={15} className="py-6 text-center text-slate-400 text-sm">No records to display.</td></tr>
              ) : pageItems.map((h: any, i: number) => (
                <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/40 transition-colors" data-testid={`row-handover-${i}`}>
                  <td className="py-2 px-3 text-[13px] text-slate-700 border-r border-[#E5E5E5]">{h.runType ?? h.type ?? '-'}</td>
                  <td className="py-2 px-3 text-[13px] font-mono text-slate-700 border-r border-[#E5E5E5]">{h.handoverAccount ?? h.accountNumber ?? h.account ?? '-'}</td>
                  <td className="py-2 px-3 text-right font-mono text-[13px] text-slate-700 border-r border-[#E5E5E5]">{fmt(h.handoverAmount ?? h.amount ?? 0)}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{fmtDate(h.handedOverDate ?? h.handoverDate)}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{h.outstandingDays ?? h.daysOutstanding ?? '-'}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{h.outstandingMonth ?? h.monthsOutstanding ?? '-'}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-700 border-r border-[#E5E5E5]">{h.attorney ?? h.attorneyName ?? '-'}</td>
                  <td className="py-2 px-3 text-[13px] border-r border-[#E5E5E5]">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                      (h.status ?? h.handoverStatus) === 'Active' ? 'bg-green-100 text-green-700' :
                      (h.status ?? h.handoverStatus) === 'Terminated' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {h.status ?? h.handoverStatus ?? '-'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{h.capturer ?? h.capturedBy ?? h.createdBy ?? '-'}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{fmtDate(h.dateCreated ?? h.createdDate ?? h.capturedDate)}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{h.reviewedBy ?? '-'}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-500 border-r border-[#E5E5E5]">{h.terminationReason ?? '-'}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{fmtDate(h.terminationDate)}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-600 border-r border-[#E5E5E5]">{h.terminatedReviewedBy ?? h.reviewedBy2 ?? '-'}</td>
                  <td className="py-2 px-3 text-[13px] text-slate-600">{fmtDate(h.reviewDate ?? h.reviewedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 bg-[#F7F7F7] border-t border-[#D6D6D6] flex items-center justify-end gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-[#BFBFBF] rounded px-1.5 py-0.5 text-xs bg-white"
              data-testid="select-handover-pagesize"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <span className="text-xs text-slate-500">{totalRecords === 0 ? '0 of 0' : `${startIdx + 1}-${Math.min(startIdx + itemsPerPage, totalRecords)} of ${totalRecords}`}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={safePage <= 1} className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30" data-testid="btn-handover-first">&laquo;</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30" data-testid="btn-handover-prev">&lsaquo;</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30" data-testid="btn-handover-next">&rsaquo;</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={safePage >= totalPages} className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30" data-testid="btn-handover-last">&raquo;</button>
          </div>
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="bg-white rounded-lg border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-2.5 bg-[#F2F4F7] border-b border-[#D6D6D6] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs sm:text-sm font-semibold text-slate-800">Handover Transaction Detail</h3>
            <Badge variant="secondary" className="ml-auto text-[10px]">{transactions.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2">
            {transactions.map((tx: any, i: number) => (
              <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Date</span><span className="text-slate-800 font-semibold text-right">{fmtDate(tx.transactionDate ?? tx.date)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Description</span><span className="text-slate-800 font-semibold text-right">{tx.description || tx.transactionDescription || '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Amount</span><span className="text-slate-800 font-semibold text-right font-mono">{fmt(tx.amount ?? tx.transactionAmount ?? 0)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Reference</span><span className="text-slate-800 font-semibold text-right">{tx.reference || '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Type</span><span className="text-slate-800 font-semibold text-right">{tx.transactionType || tx.type || '-'}</span></div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-handover-transactions">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Description</th>
                  <th className={`${thCls} text-right`}>Amount</th>
                  <th className={thCls}>Reference</th>
                  <th className={thCls}>Type</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any, i: number) => (
                  <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/40 transition-colors">
                    <td className="py-2 px-3 text-slate-600 text-[13px]">{fmtDate(tx.transactionDate ?? tx.date)}</td>
                    <td className="py-2 px-3 text-[13px]">{tx.description || tx.transactionDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-[13px]">{fmt(tx.amount ?? tx.transactionAmount ?? 0)}</td>
                    <td className="py-2 px-3 text-slate-500 text-[13px]">{tx.reference || '-'}</td>
                    <td className="py-2 px-3 text-slate-500 text-[13px]">{tx.transactionType || tx.type || '-'}</td>
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
      const [anResult, pnResult] = await Promise.allSettled([
        getAccountNotifications(accountId),
        getPropertyNotification(accountId),
      ]);
      const an = anResult.status === 'fulfilled' ? anResult.value : [];
      const filtered = Array.isArray(an) ? an.filter((item: any) => {
        if (typeof item === 'string') return item.trim() !== '';
        return true;
      }) : [];
      setAccountNotifs(filtered);
      setPropertyNotif(pnResult.status === 'fulfilled' ? pnResult.value : null);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!accountNotifs.length && !propertyNotif) return <EmptyState message="No notifications available" />;

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
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
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Account Notifications</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{accountNotifs.length}</Badge>
          </div>
          {accountNotifs.every((n: any) => typeof n === 'string') ? (
            <div className="divide-y divide-[#E5E5E5]" data-testid="table-account-notifications">
              {accountNotifs.map((n: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-orange-50/30 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
            <div className="sm:hidden p-2 space-y-2">
              {accountNotifs.map((n: any, i: number) => (
                <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Date</span><span className="text-slate-800 font-semibold text-right">{n.notificationDate ? new Date(n.notificationDate).toLocaleDateString('en-ZA') : '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Type</span><span className="text-slate-800 font-semibold text-right">{n.notificationType || n.type || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Message</span><span className="text-slate-800 font-semibold text-right max-w-[180px] truncate">{n.message || n.description || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Status</span><span className="text-right"><Badge variant="outline" className="text-[10px]">{n.status || '-'}</Badge></span></div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-account-notifications">
                <thead>
                  <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Message</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {accountNotifs.map((n: any, i: number) => (
                    <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors">
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
            </>
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

  useEffect(() => { load(); }, [load]);

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
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5" data-testid="statements-panel">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Generated Statements</h3>
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
        <div className="sm:hidden p-2 space-y-2">
          {data.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-slate-300" />
              <span className="text-sm text-slate-400">No generated statements available</span>
              <button onClick={() => setShowModal(true)} className="text-xs text-[var(--pos-accent)] hover:text-[var(--pos-accent)] font-medium" data-testid="button-generate-first-mobile">Click here to generate a statement</button>
            </div>
          ) : data.map((s: any, i: number) => (
            <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`statement-card-${i}`}>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Date</span><span className="text-slate-800 font-semibold text-right">{s.statementDate ? new Date(s.statementDate).toLocaleDateString('en-ZA') : '-'}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Period</span><span className="text-slate-800 font-semibold text-right">{s.month ? `${s.financialYear} - ${s.month}` : s.period || '-'}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Amount</span><span className="text-slate-800 font-semibold text-right font-mono">{(s.amount ?? s.totalAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Type</span><span className="text-right"><span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border border-[#D6D6D6]">{s.statementType || s.type || 'Standard'}</span></span></div>
              <div className="flex justify-end pt-1">
                <button onClick={() => handleDownload(s)} disabled={downloading === s.accountstatement_id} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white text-[10px] font-semibold rounded-lg hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] transition-all shadow-sm disabled:opacity-40" data-testid={`btn-download-stmt-mobile-${i}`}>
                  {downloading === s.accountstatement_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-statements">
            <thead>
              <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
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
                    <button onClick={() => setShowModal(true)} className="text-xs text-[var(--pos-accent)] hover:text-[var(--pos-accent)] font-medium" data-testid="button-generate-first">Click here to generate a statement</button>
                  </div>
                </td></tr>
              ) : data.map((s: any, i: number) => (
                <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors" data-testid={`statement-row-${i}`}>
                  <td className="py-2.5 px-3 text-slate-600">{s.statementDate ? new Date(s.statementDate).toLocaleDateString('en-ZA') : '-'}</td>
                  <td className="py-2.5 px-3 font-medium">{s.month ? `${s.financialYear} - ${s.month}` : s.period || '-'}</td>
                  <td className="py-2.5 px-3">{s.description || s.statementDescription || 'Account Statement'}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(s.amount ?? s.totalAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border border-[#D6D6D6]">
                      {s.statementType || s.type || 'Standard'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => handleDownload(s)}
                      disabled={downloading === s.accountstatement_id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white text-[10px] font-semibold rounded-lg hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] transition-all shadow-sm disabled:opacity-40"
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowModal(false)} data-testid="statement-modal-overlay">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] sm:max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#D6D6D6] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <FileText className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
                <h4 className="text-sm sm:text-base font-bold text-white">Account Summary</h4>
              </div>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" data-testid="button-close-stmt-x">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="p-3 sm:p-6 space-y-3 sm:space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 bg-[#F7F7F7] rounded-xl p-3 sm:p-4 border border-[#D6D6D6]">
                <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                  <input type="radio" name="stmtType" checked={statementType === 'account'} onChange={() => setStatementType('account')} className="w-4 h-4 text-[var(--pos-accent)]" data-testid="radio-account-statement" />
                  <span className={`font-medium ${statementType === 'account' ? 'text-[var(--pos-accent)]' : 'text-slate-600'}`}>Account Statement</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                  <input type="radio" name="stmtType" checked={statementType === 'detailed'} onChange={() => setStatementType('detailed')} className="w-4 h-4 text-[var(--pos-accent)]" data-testid="radio-detailed-statement" />
                  <span className={`font-medium ${statementType === 'detailed' ? 'text-[var(--pos-accent)]' : 'text-slate-600'}`}>Detailed Account Statement</span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 bg-[var(--pos-accent-tint)] border border-[#D6D6D6] rounded-lg px-3 py-2">
                  <span className="text-xs font-semibold text-[var(--pos-accent)] uppercase tracking-wider">Account</span>
                  <span className="text-sm font-mono font-bold text-[#2E2E2E]">{accountNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                  <select value={modalYear} onChange={e => setModalYear(e.target.value)} className="border border-[#BFBFBF] rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none" data-testid="select-stmt-year">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={modalMonth} onChange={e => setModalMonth(e.target.value)} className="border border-[#BFBFBF] rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none" data-testid="select-stmt-month">
                    <option value="">All Months</option>
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleGenerateStatement}
                  disabled={generating}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white text-sm font-semibold rounded-lg hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] transition-all shadow-md disabled:opacity-50"
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
                  {generateResult.error || 'Statement generated successfully. Check below for download.'}
                </div>
              )}

              <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
                <div className="sm:hidden p-2 space-y-2">
                  {filteredData.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-sm">No statements found for selected period</div>
                  ) : filteredData.map((s: any, i: number) => (
                    <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 flex items-center justify-between gap-3" data-testid={`stmt-download-card-${i}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{s.financialYear}</div>
                        <div className="text-xs text-slate-500">{s.month}</div>
                      </div>
                      <button
                        onClick={() => handleDownload(s)}
                        disabled={downloading === s.accountstatement_id}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white text-xs font-semibold rounded-lg hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] transition-all shadow-sm disabled:opacity-40"
                        data-testid={`btn-download-stmt-mobile-modal-${i}`}
                      >
                        {downloading === s.accountstatement_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Download
                      </button>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-stmt-download">
                    <thead>
                      <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                        <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Financial Year</th>
                        <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Month</th>
                        <th className="text-center px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.length === 0 ? (
                        <tr><td colSpan={3} className="text-center text-slate-400 py-6 text-sm">No statements found for selected period</td></tr>
                      ) : filteredData.map((s: any, i: number) => (
                        <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors" data-testid={`stmt-download-row-${i}`}>
                          <td className="px-4 py-3 text-slate-700 font-medium">{s.financialYear}</td>
                          <td className="px-4 py-3 text-slate-700">{s.month}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDownload(s)}
                              disabled={downloading === s.accountstatement_id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white text-xs font-semibold rounded-lg hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] transition-all shadow-sm disabled:opacity-40"
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
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {filteredData.length === 0 ? '0 of 0' : `1 – ${filteredData.length} of ${filteredData.length}`} statements
                </div>
                <button onClick={() => setShowModal(false)} className="inline-flex items-center gap-1.5 px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white text-sm font-semibold rounded-lg hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] transition-all shadow-md" data-testid="button-close-stmt-modal">
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

export function ClearanceTab({ accountId, propertyId, currentAccountNumber, currentAccountName }: { accountId: number; propertyId?: number; currentAccountNumber?: string; currentAccountName?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resultSettled, linkedSettled] = await Promise.allSettled([
        getClearanceInquiries(accountId, propertyId),
        getLinkedAccountsOnProperty(accountId),
      ]);
      setData(resultSettled.status === 'fulfilled' ? (Array.isArray(resultSettled.value) ? resultSettled.value : []) : []);
      setLinkedAccounts(linkedSettled.status === 'fulfilled' ? (Array.isArray(linkedSettled.value) ? linkedSettled.value : []) : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load clearance data');
    } finally {
      setLoading(false);
    }
  }, [accountId, propertyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('en-ZA') : '-';
  const fmtR = (v: any) => v != null ? `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

  const normalizeStr = (s: string | undefined | null) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const isSameAccount = (clearanceAccountName: string | undefined | null) => {
    if (!currentAccountName || !clearanceAccountName) return true;
    return normalizeStr(clearanceAccountName) === normalizeStr(currentAccountName);
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <Shield className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Clearance</h3>
          {data.length > 0 && (
            <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{data.length} record{data.length !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <div className="sm:hidden p-2 space-y-2">
          {data.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm italic">No clearance records to display.</div>
          ) : data.map((c: any, i: number) => {
            const scheduleId = c.clearanceStagingID ?? c.clearance_ID ?? c.costSchedule_ID ?? c.id;
            const clearanceAccountName = c.accountName ?? c.buyername ?? c.buyerName ?? c.seller ?? '';
            const isForThisAccount = isSameAccount(clearanceAccountName);
            const cleanAddr = (c.address || c.propertyAddress || '-').replace(/\r\n/g, ', ');
            return (
              <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`card-clearance-${i}`}>
                {isForThisAccount && <div className="flex items-center gap-1 text-[10px] text-green-700 font-medium"><CheckCircle2 className="w-3 h-3" />This account</div>}
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Schedule ID</span><span className="text-slate-800 font-semibold text-right font-mono">{scheduleId ?? '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Buyer</span><span className="text-slate-800 font-semibold text-right">{c.buyername ?? c.buyerName ?? c.accountName ?? '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Attorney</span><span className="text-slate-800 font-semibold text-right">{c.attorneyDesc ?? c.attorney ?? '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Certificate No</span><span className="text-slate-800 font-semibold text-right font-mono">{c.certificateNo ?? c.clearance ?? '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Status</span><span className="text-right"><Badge variant={(c.clearanceStatus ?? c.status) === 'Completed' || (c.clearanceStatus ?? c.status) === 'Approved' ? 'default' : 'secondary'} className="text-[10px]">{c.clearanceStatus ?? c.status ?? '-'}</Badge></span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Sell Date</span><span className="text-slate-800 font-semibold text-right">{fmtDate(c.sellDate)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Valid Until</span><span className="text-slate-800 font-semibold text-right">{fmtDate(c.toDate)}</span></div>
              </div>
            );
          })}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-clearance">
            <thead>
              <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                <th className="w-8 py-2.5 px-1"></th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Cost Schedule ID</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Account Type</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[140px]">SG Number</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[200px]">Address</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[180px]">Buyer Account Name</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[80px]">Attorney</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[120px]">Certificate No</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[90px]">Receipt No</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[90px]">Receipt Date</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[80px]">Valid Until</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[80px]">Sell Date</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[80px]">Status</th>
                <th className="text-center py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[90px]">Cost Schedule</th>
                <th className="text-center py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Clearance Cert</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={15} className="py-8 text-center text-slate-400 text-sm italic">No clearance records to display.</td></tr>
              ) : data.map((c: any, i: number) => {
                const scheduleId = c.clearanceStagingID ?? c.clearance_ID ?? c.costSchedule_ID ?? c.id;
                const cleanAddr = (c.propertyAddress || c.address || '-').replace(/\r\n/g, ', ').replace(/\s{2,}/g, ' ').trim();
                const isExpanded = expandedRow === i;
                const s1181 = Number(c.section1181 ?? 0);
                const s1183 = Number(c.section1183 ?? 0);
                const provision = Number(c.provision ?? 0);
                const interest = Number(c.interest ?? 0);
                const advance = Number(c.advancepayment ?? 0);
                const additional = Number(c.additional ?? 0);
                const clrCost = Number(c.clearanceCost ?? 0);
                const totalClearance = s1181 + s1183 + provision + interest + advance + additional + clrCost;

                const clearanceAccountName = (c.accountName ?? '').trim();
                const isForThisAccount = isSameAccount(clearanceAccountName);
                const isCompleted = (c.clearanceStatus ?? c.status ?? '').toLowerCase() === 'completed';

                return (
                  <React.Fragment key={i}>
                    {!isForThisAccount && (
                      <tr className="bg-amber-50 border-b border-amber-200">
                        <td colSpan={15} className="py-2 px-4">
                          <div className="flex items-center gap-2 text-[12px]">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="text-amber-800">
                              <strong>Previous account clearance</strong> — This clearance was processed on account <strong>{clearanceAccountName || 'unknown'}</strong> (previous owner) for this property.
                              {isCompleted && <> Transfer of ownership to the current account <strong>{currentAccountNumber}</strong> ({currentAccountName}) is complete.</>}
                              {!isCompleted && <> Transfer to <strong>{c.buyername ?? 'buyer'}</strong> is in progress.</>}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isForThisAccount && isCompleted && (
                      <tr className="bg-green-50 border-b border-green-200">
                        <td colSpan={15} className="py-2 px-4">
                          <div className="flex items-center gap-2 text-[12px]">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <span className="text-green-800">
                              <strong>Clearance on this account</strong> — This clearance was processed on this account ({currentAccountNumber}). Transfer of ownership to <strong>{c.buyername ?? 'buyer'}</strong> is complete.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b border-[#E5E5E5] hover:bg-emerald-50/30 transition-colors cursor-pointer ${isExpanded ? 'bg-emerald-50/40' : ''} ${!isForThisAccount ? 'opacity-80' : ''}`}
                      onClick={() => setExpandedRow(isExpanded ? null : i)}
                      data-testid={`row-clearance-${i}`}
                    >
                      <td className="py-2 px-1 text-center">
                        <button className="text-slate-400 hover:text-slate-600 transition-colors" data-testid={`btn-expand-clearance-${i}`}>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="py-2 px-2 font-mono text-[13px] text-slate-700">{scheduleId ?? '-'}</td>
                      <td className="py-2 px-2 text-[13px] text-slate-700">{c.accounttype ?? c.accountType ?? '-'}</td>
                      <td className="py-2 px-2 font-mono text-[12px] text-slate-600">{c.sgNumber ?? '-'}</td>
                      <td className="py-2 px-2 text-[13px] text-slate-700">{cleanAddr}</td>
                      <td className="py-2 px-2 text-[13px] font-medium text-slate-800">{c.buyername ?? c.buyerName ?? c.accountName ?? '-'}</td>
                      <td className="py-2 px-2 text-[13px] text-slate-600">{c.attorneyDesc ?? c.attorney ?? '-'}</td>
                      <td className="py-2 px-2 font-mono text-[12px] text-slate-600">{c.certificateNo ?? c.clearance ?? '-'}</td>
                      <td className="py-2 px-2 font-mono text-[12px] text-slate-600">{c.receiptNo || '-'}</td>
                      <td className="py-2 px-2 text-[13px] text-slate-600">{c.receiptDate ? fmtDate(c.receiptDate) : '-'}</td>
                      <td className="py-2 px-2 text-[13px] text-slate-600">{fmtDate(c.toDate)}</td>
                      <td className="py-2 px-2 text-[13px] text-slate-600">{fmtDate(c.sellDate)}</td>
                      <td className="py-2 px-2">
                        <Badge variant={(c.clearanceStatus ?? c.status) === 'Completed' || (c.clearanceStatus ?? c.status) === 'Approved' ? 'default' : 'secondary'} className="text-[10px]">
                          {c.clearanceStatus ?? c.status ?? '-'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        {scheduleId ? (
                          <button
                            onClick={() => downloadClearanceDocument(scheduleId, 'cost-schedule')}
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 transition-colors group"
                            title="Download Cost Schedule"
                            data-testid={`btn-download-schedule-${i}`}
                          >
                            <FileDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        {scheduleId ? (
                          <button
                            onClick={() => downloadClearanceDocument(scheduleId, 'clearance-certificate')}
                            className="inline-flex items-center gap-1 text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] transition-colors group"
                            title="Download Clearance Certificate"
                            data-testid={`btn-download-certificate-${i}`}
                          >
                            <FileDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-emerald-50/20">
                        <td colSpan={15} className="p-0">
                          <div className="px-6 py-4 border-b border-[#D6D6D6]/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                              <div className="bg-white rounded-lg border border-[#D6D6D6] shadow-sm overflow-hidden">
                                <div className="px-4 py-2 bg-[var(--pos-accent)] text-white text-xs font-semibold tracking-wide flex items-center gap-1.5">
                                  <Scale className="w-3.5 h-3.5" />
                                  Financial Breakdown
                                </div>
                                <div className="divide-y divide-[#E5E5E5]">
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Section 118(1)</span>
                                    <span className="font-mono text-[13px] font-medium text-slate-800">{fmtR(s1181)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Section 118(3)</span>
                                    <span className="font-mono text-[13px] font-medium text-slate-800">{fmtR(s1183)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Provision</span>
                                    <span className="font-mono text-[13px] font-medium text-slate-800">{fmtR(provision)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Interest</span>
                                    <span className="font-mono text-[13px] font-medium text-slate-800">{fmtR(interest)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Advance Payment</span>
                                    <span className={`font-mono text-[13px] font-medium ${advance < 0 ? 'text-green-700' : 'text-slate-800'}`}>{fmtR(advance)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Additional</span>
                                    <span className="font-mono text-[13px] font-medium text-slate-800">{fmtR(additional)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Clearance Cost</span>
                                    <span className="font-mono text-[13px] font-medium text-slate-800">{fmtR(clrCost)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2.5 bg-emerald-50 border-t-2 border-[#D6D6D6]">
                                    <span className="text-[12px] font-bold text-emerald-800">TOTAL</span>
                                    <span className="font-mono text-[14px] font-bold text-emerald-800">{fmtR(totalClearance)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white rounded-lg border border-[#D6D6D6] shadow-sm overflow-hidden">
                                <div className="px-4 py-2 bg-slate-700 text-white text-xs font-semibold tracking-wide flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5" />
                                  Sale Details
                                </div>
                                <div className="divide-y divide-[#E5E5E5]">
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Sell Price</span>
                                    <span className="font-mono text-[13px] font-medium text-slate-800">{fmtR(c.sellPrice)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Sell Date</span>
                                    <span className="text-[13px] text-slate-700">{fmtDate(c.sellDate)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Valid From</span>
                                    <span className="text-[13px] text-slate-700">{fmtDate(c.fromDate)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Valid Until</span>
                                    <span className="text-[13px] text-slate-700">{fmtDate(c.toDate)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Receipt No</span>
                                    <span className="font-mono text-[13px] text-slate-700">{c.receiptNo || '-'}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Receipt Date</span>
                                    <span className="text-[13px] text-slate-700">{c.receiptDate ? fmtDate(c.receiptDate) : '-'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white rounded-lg border border-[#D6D6D6] shadow-sm overflow-hidden">
                                <div className="px-4 py-2 bg-[var(--pos-accent)] text-white text-xs font-semibold tracking-wide flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5" />
                                  Property & Parties
                                </div>
                                <div className="divide-y divide-[#E5E5E5]">
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Clearance Account</span>
                                    <span className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-medium text-slate-800 text-right max-w-[160px] truncate" title={clearanceAccountName || '-'}>{clearanceAccountName || '-'}</span>
                                      {isForThisAccount
                                        ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 whitespace-nowrap"><CheckCircle2 className="w-3 h-3" />This account</span>
                                        : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap"><AlertCircle className="w-3 h-3" />Previous owner</span>
                                      }
                                    </span>
                                  </div>
                                  {!isForThisAccount && (() => {
                                    const prevAcct = linkedAccounts.find(la => {
                                      const laName = normalizeStr(la.name || la.accountName || la.fullNAME);
                                      const clrName = normalizeStr(clearanceAccountName);
                                      if (!laName || !clrName || clrName === '-') return false;
                                      const matchName = laName.includes(clrName) || clrName.includes(laName);
                                      const currentNum = String(currentAccountNumber || '').replace(/^0+/, '');
                                      const laNum = String(la.accountNumber || la.account_ID || '').replace(/^0+/, '');
                                      return matchName && laNum !== currentNum;
                                    });
                                    const prevNum = prevAcct?.accountNumber || prevAcct?.account_ID;
                                    return (
                                      <div className="flex justify-between items-center px-4 py-2 bg-amber-50/50">
                                        <span className="text-[12px] text-slate-600">Previous Account No</span>
                                        <span className="flex items-center gap-1.5">
                                          {prevNum ? (
                                            <span className="font-mono text-[13px] text-amber-800 font-medium">
                                              {String(prevNum).padStart(12, '0')}
                                            </span>
                                          ) : (
                                            <span className="text-[12px] text-slate-500 italic">
                                              {clearanceAccountName || 'Previous owner'}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  {currentAccountNumber && (
                                    <div className="flex justify-between items-center px-4 py-2">
                                      <span className="text-[12px] text-slate-600">Current Account</span>
                                      <span className="font-mono text-[13px] text-slate-700">{currentAccountNumber}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Buyer</span>
                                    <span className="text-[13px] font-medium text-slate-800 text-right max-w-[180px] truncate" title={c.buyername ?? '-'}>{c.buyername ?? c.buyerName ?? '-'}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Attorney</span>
                                    <span className="text-[13px] text-slate-700">{c.attorneyDesc ?? '-'}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">File No</span>
                                    <span className="font-mono text-[13px] text-slate-700">{c.fileNo || '-'}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">SG Number</span>
                                    <span className="font-mono text-[12px] text-slate-600">{c.sgNumber ?? '-'}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-4 py-2">
                                    <span className="text-[12px] text-slate-600">Clearance Type</span>
                                    <span className="text-[13px] text-slate-700">{c.clearanceTypeID === 1 ? 'Transfer' : c.clearanceTypeID === 2 ? 'Section 118' : c.clearanceTypeID ?? '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 sm:px-5 py-2.5 bg-[#F7F7F7] border-t border-[#D6D6D6] flex items-center justify-between">
          <span className="text-xs text-slate-500 hidden sm:inline">Click a row to view financial breakdown</span>
          <span className="text-xs text-slate-500">{data.length} of {data.length} records</span>
        </div>
      </div>
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

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data.length) return <EmptyState message="No debtor notes available" />;

  return (
    <div className="p-3 sm:p-4">
      <div className="sm:hidden space-y-2">
        {data.map((n: any, i: number) => (
          <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Date</span><span className="text-slate-800 font-semibold text-right">{n.noteDate ? new Date(n.noteDate).toLocaleDateString('en-ZA') : n.date || n.createdDate || '-'}</span></div>
            <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Note Type</span><span className="text-slate-800 font-semibold text-right">{n.noteType || n.type || '-'}</span></div>
            <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Description</span><span className="text-slate-800 font-semibold text-right max-w-[180px] truncate">{n.description || n.noteDescription || n.notes || '-'}</span></div>
            <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Amount</span><span className="text-slate-800 font-semibold text-right font-mono">{n.amount != null ? (n.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '-'}</span></div>
            <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Status</span><span className="text-right"><Badge variant="outline" className="text-[10px]">{n.status || '-'}</Badge></span></div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" data-testid="table-debtor-notes">
          <thead>
            <tr className="border-b-2 border-[#D6D6D6]">
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
              <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[#F7F7F7] transition-colors">
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

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState message="No Section 129 data available" />;

  const items = Array.isArray(data) ? data : [data];
  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
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
  const [selectedOccupierIdx, setSelectedOccupierIdx] = useState<number | null>(null);
  const [proofData, setProofData] = useState<{ property: any; nameInfo: any } | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [muniInfo, setMuniInfo] = useState<MunicipalityInfo | null>(null);
  const loaded = useRef(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchMunicipalityInfo().then(setMuniInfo).catch(() => {}); }, []);

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

  useEffect(() => { load(); }, [load]);

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
      const [propSettled, nameSettled] = await Promise.allSettled([
        getPropertyDetails(accountId),
        getNameInfo(accountId),
      ]);
      const propResp = propSettled.status === 'fulfilled' ? propSettled.value : null;
      const nameResp = nameSettled.status === 'fulfilled' ? nameSettled.value : null;
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
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5" data-testid="occupiers-panel">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors" data-testid="button-add-occupier">Add</button>
        <button onClick={() => { if (selectedOccupierIdx !== null && data[selectedOccupierIdx]) handleRemove(data[selectedOccupierIdx]); else if (data.length > 0) alert('Select an occupier to remove'); }} className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors" data-testid="button-remove-occupier">Remove Occupiers</button>
        <button onClick={handleProofOfResidence} disabled={proofLoading} className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors disabled:opacity-50" data-testid="button-proof-of-residence">
          {proofLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
          Proof of Residence
        </button>
      </div>

      <div className="sm:hidden space-y-2" data-testid="table-occupiers-mobile">
        {data.length === 0 ? (
          <p className="text-center text-slate-400 py-4 italic text-sm">No records to display.</p>
        ) : data.map((o: any, i: number) => (
          <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 cursor-pointer hover:bg-[var(--pos-accent-tint)] transition-colors" data-testid={`occupier-row-${i}`}>
            <div className="text-sm font-medium text-slate-800">{o.name || o.occupierName || o.surname || '-'}</div>
            <div className="text-xs font-mono text-slate-500 mt-0.5">{o.idNumber || o.idRegistrationNumber || o.idNo || '-'}</div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block overflow-x-auto border border-[#D6D6D6] rounded">
        <table className="w-full text-sm" data-testid="table-occupiers">
          <thead>
            <tr className="bg-[#F2F4F7] border-b border-[#D6D6D6]">
              <th className="text-left py-2 px-3 font-semibold text-slate-700">Name</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-700">ID Number</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={2} className="text-center text-slate-400 py-4 italic">No records to display.</td></tr>
            ) : data.map((o: any, i: number) => (
              <tr key={i} className={`border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)] cursor-pointer transition-colors ${selectedOccupierIdx === i ? 'bg-[var(--pos-accent-tint)]' : ''}`} data-testid={`occupier-row-${i}`} onClick={() => {
                setSelectedOccupierIdx(selectedOccupierIdx === i ? null : i);
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
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#D6D6D6] bg-[#F7F7F7]">
              <h4 className="text-sm font-bold text-slate-700">Add Occupier</h4>
            </div>
            <div className="p-3 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={addName} onChange={e => setAddName(e.target.value)} className="w-full border border-[#BFBFBF] rounded px-3 py-2 text-sm" placeholder="Full name" data-testid="input-occupier-name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SA ID Number</label>
                <input type="text" value={addIdNumber} onChange={e => setAddIdNumber(e.target.value)} className="w-full border border-[#BFBFBF] rounded px-3 py-2 text-sm" placeholder="ID Number" data-testid="input-occupier-id" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-[#BFBFBF] text-sm rounded hover:bg-[#F7F7F7]" data-testid="button-cancel-add">Cancel</button>
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
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#D6D6D6] bg-[#F7F7F7] flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700">Proof of Residence</h4>
              <div className="flex gap-2">
                <button onClick={handlePrintProof} className="px-3 py-1.5 bg-[var(--pos-accent)] text-white text-xs rounded hover:bg-[var(--pos-accent-dark)]" data-testid="button-print-proof">Print</button>
                <button onClick={() => setShowProofModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">&times;</button>
              </div>
            </div>
            <div className="p-3 sm:p-5">
              <div ref={printRef}>
                <div className="proof-container border border-[#BFBFBF] p-8 max-w-[700px] mx-auto bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
                  <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-5">
                    <div className="text-xs leading-relaxed">
                      {muniInfo?.address1 && <div>{muniInfo.address1}</div>}
                      {muniInfo?.address2 && <div>{muniInfo.address2}</div>}
                      {muniInfo?.address3 && <div>{muniInfo.address3}{muniInfo?.postalCode ? ` - ${muniInfo.postalCode}` : ''}</div>}
                    </div>
                    <div className="text-center font-bold text-base">{muniInfo?.name || ''}</div>
                    <div className="text-xs leading-relaxed text-right">
                      {muniInfo?.tel && <div>Tel: {muniInfo.tel}</div>}
                      {muniInfo?.fax && <div>Fax: {muniInfo.fax}</div>}
                      {muniInfo?.email && <div>Email: {muniInfo.email}</div>}
                      {muniInfo?.website && <div>Website: {muniInfo.website}</div>}
                      {muniInfo?.vatNo && <div>Municipality VAT No:- {muniInfo.vatNo}</div>}
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
                    {muniInfo?.postalCode && <p>{muniInfo.postalCode}</p>}
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
  const [muniInfo, setMuniInfo] = useState<MunicipalityInfo | null>(null);

  const loadedRef = useRef(false);

  useEffect(() => { fetchMunicipalityInfo().then(setMuniInfo).catch(() => {}); }, []);

  const loadContactInfo = useCallback(async () => {
    setContactLoading(true);
    setContactError(null);
    try {
      const [nameSettled, contactSettled] = await Promise.allSettled([
        getNameInfo(accountId),
        getContactDetails(accountId),
      ]);

      const n = nameSettled.status === 'fulfilled' ? (nameSettled.value || {}) : {};
      const contactResult = contactSettled.status === 'fulfilled' ? contactSettled.value : null;
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
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5" data-testid="send-statements-panel">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800">Send Account Statements</h3>
          <p className="text-xs text-slate-500 mt-0.5">Generate and deliver statements via email or SMS</p>
        </div>
        <div className="flex bg-white rounded-lg border shadow-sm p-0.5">
          <button
            onClick={() => setMode('email')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'email' ? 'bg-[var(--pos-accent)] text-white shadow-sm' : 'text-slate-500 hover:bg-[#F2F4F7]'}`}
            data-testid="button-send-mode-email"
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </button>
          <button
            onClick={() => setMode('sms')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'sms' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:bg-[#F2F4F7]'}`}
            data-testid="button-send-mode-sms"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            SMS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Statement Period & Type</h4>
            </div>
            <div className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <div className="bg-[var(--pos-accent-tint)] border border-[#D6D6D6] rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[var(--pos-accent)] uppercase tracking-wider">Account</span>
                  <span className="text-sm font-mono font-bold text-[#2E2E2E]">{accountNumber}</span>
                </div>
                {accountHolder && (
                  <div className="text-sm font-medium text-slate-700">{accountHolder}</div>
                )}
              </div>
              <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">From Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={fromYear} onChange={e => setFromYear(e.target.value)} className="w-full border border-[#BFBFBF] rounded-lg px-2.5 sm:px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none" data-testid="select-from-year">
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={fromMonth} onChange={e => setFromMonth(e.target.value)} className="w-full border border-[#BFBFBF] rounded-lg px-2.5 sm:px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none" data-testid="select-from-month">
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">To Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={toYear} onChange={e => setToYear(e.target.value)} className="w-full border border-[#BFBFBF] rounded-lg px-2.5 sm:px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none" data-testid="select-to-year">
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={toMonth} onChange={e => setToMonth(e.target.value)} className="w-full border border-[#BFBFBF] rounded-lg px-2.5 sm:px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none" data-testid="select-to-month">
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-5 bg-[#F7F7F7] rounded-lg p-3 border border-[#D6D6D6]">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Type:</span>
                <div className="flex items-center gap-4 sm:gap-5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="sendStmtType" checked={statementType === 'account'} onChange={() => setStatementType('account')} className="w-3.5 h-3.5 text-[var(--pos-accent)]" data-testid="radio-send-account" />
                    <span className={`font-medium ${statementType === 'account' ? 'text-[var(--pos-accent)]' : 'text-slate-500'}`}>Account Statement</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="sendStmtType" checked={statementType === 'detailed'} onChange={() => setStatementType('detailed')} className="w-3.5 h-3.5 text-[var(--pos-accent)]" data-testid="radio-send-detailed" />
                    <span className={`font-medium ${statementType === 'detailed' ? 'text-[var(--pos-accent)]' : 'text-slate-500'}`}>Detailed Statement</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {mode === 'email' && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-white" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Delivery Options</h4>
              </div>
              <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                <label className="flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-[#D6D6D6] hover:border-[#D6D6D6] hover:bg-[var(--pos-accent-tint)]/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={includeStatementPdf}
                    onChange={e => setIncludeStatementPdf(e.target.checked)}
                    className="mt-0.5 rounded border-[#BFBFBF] text-[var(--pos-accent)] shrink-0"
                    data-testid="checkbox-include-pdf"
                  />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
                      <FileText className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-orange-500 shrink-0" />
                      <span>Generate & Attach PDF</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Attach the statement as a PDF to the email.</p>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-[#D6D6D6] hover:border-[#D6D6D6] hover:bg-[var(--pos-accent-tint)]/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={includeTemplateLink}
                    onChange={e => setIncludeTemplateLink(e.target.checked)}
                    className="mt-0.5 rounded border-[#BFBFBF] text-[var(--pos-accent)] shrink-0"
                    data-testid="checkbox-include-link"
                  />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
                      <ArrowRight className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[var(--pos-accent)] shrink-0" />
                      <span>Include Statement Link</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Secure link to view the statement in browser.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {mode === 'sms' && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-white" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">SMS Delivery</h4>
              </div>
              <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 sm:p-3">
                  <p className="text-xs sm:text-sm text-green-800">
                    A secure template link will be sent via SMS. The recipient can view their statement in the browser.
                  </p>
                </div>
                <label className="flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-[#D6D6D6] hover:border-green-300 hover:bg-green-50/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={includeTemplateLink}
                    onChange={e => setIncludeTemplateLink(e.target.checked)}
                    className="mt-0.5 rounded border-[#BFBFBF] text-green-600 shrink-0"
                    data-testid="checkbox-sms-link"
                  />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-slate-800">Include Secure Statement Link</div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Time-limited secure link for online viewing.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-white" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Custom Message (Optional)</h4>
            </div>
            <div className="p-3 sm:p-4">
              <textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                placeholder={mode === 'email' ? "Add a custom message to include in the email body (optional)..." : "Add a custom message to include in the SMS (optional, keep it short)..."}
                className="w-full border border-[#BFBFBF] rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none"
                rows={mode === 'email' ? 3 : 2}
                maxLength={mode === 'sms' ? 120 : undefined}
                data-testid="textarea-custom-message"
              />
              {mode === 'sms' && (
                <p className="text-[10px] text-slate-400 mt-1">{customMessage.length}/120 characters</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className={`px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between ${mode === 'email' ? 'bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)]' : 'bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)]'}`}>
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
              <div className="p-2.5 sm:p-3 space-y-1.5">
                {emailTargets.length === 0 ? (
                  <div className="py-4 sm:py-6 text-center">
                    <Mail className="w-6 sm:w-8 h-6 sm:h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">No email address on file</p>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-1">Update contact details to add email</p>
                  </div>
                ) : (
                  emailTargets.map((target, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        target.selected
                          ? 'border-[#D6D6D6] bg-[var(--pos-accent-tint)]/50 shadow-sm'
                          : 'border-[#D6D6D6] hover:border-[#BFBFBF] hover:bg-[#F7F7F7]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={target.selected}
                        onChange={() => toggleEmailTarget(idx)}
                        className="rounded border-[#BFBFBF] text-[var(--pos-accent)]"
                        data-testid={`checkbox-email-${idx}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm text-slate-800 truncate font-medium">{target.address}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            target.type === 'primary'
                              ? 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)] border border-[#D6D6D6]'
                              : 'bg-[#F2F4F7] text-slate-600 border border-[#D6D6D6]'
                          }`}>
                            {target.type === 'primary' ? 'Default' : 'Additional'}
                          </span>
                        </div>
                      </div>
                      {target.selected && <CheckCircle2 className="w-4 h-4 text-[var(--pos-accent)] shrink-0" />}
                    </label>
                  ))
                )}
                <div className="pt-2 border-t border-[#E5E5E5] mt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{selectedEmails.length} of {emailTargets.length} selected</span>
                    <button
                      onClick={() => setEmailTargets(prev => prev.map(t => ({ ...t, selected: true })))}
                      className="text-[var(--pos-accent)] hover:underline text-xs"
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
                      : 'border-[#D6D6D6] hover:border-[#BFBFBF]'
                  }`}>
                    <input
                      type="checkbox"
                      checked={smsSelected}
                      onChange={e => setSmsSelected(e.target.checked)}
                      className="rounded border-[#BFBFBF] text-green-600"
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
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
              <Eye className="w-4 h-4 text-white" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Delivery Summary</h4>
            </div>
            <div className="p-3 sm:p-4 space-y-3">
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Account</span>
                  <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">{accountNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium text-slate-700">{statementType === 'account' ? 'Account' : 'Detailed'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Period</span>
                  <span className="font-medium text-slate-700 text-right text-[11px] sm:text-xs">{fromYear} {fromMonth}<br/>→ {toYear} {toMonth}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Channel</span>
                  <Badge className={`text-[10px] sm:text-xs ${mode === 'email' ? 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)] border-[#D6D6D6]' : 'bg-green-100 text-green-700 border-green-200'}`}>
                    {mode === 'email' ? 'Email (Mimecast)' : 'SMS Gateway'}
                  </Badge>
                </div>
                {mode === 'email' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Recipients</span>
                    <span className="font-bold text-[var(--pos-accent)]">{selectedEmails.length} address(es)</span>
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

              <div className="pt-3 border-t border-[#E5E5E5] space-y-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[#BFBFBF] text-slate-700 text-sm font-medium rounded-lg hover:bg-[#F7F7F7] transition-all"
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
                      ? 'bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)]'
                      : 'bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)]'
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

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 sm:p-3">
            <p className="text-[11px] sm:text-xs text-amber-700 font-medium flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Delivery services not yet connected. Email uses <strong>Mimecast</strong>, SMS uses <strong>SMS Gateway</strong> when integrated.
              </span>
            </p>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-white" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Message Preview</h4>
            </div>
            <button onClick={() => setShowPreview(false)} className="w-6 h-6 rounded-md bg-white/20 hover:bg-white/30 flex items-center justify-center" data-testid="button-close-preview">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <div className="p-3 sm:p-5">
            {mode === 'email' ? (
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
                  <span className="text-slate-500 sm:w-20 shrink-0 sm:text-right font-semibold sm:font-normal">To:</span>
                  <span className="text-slate-700 font-medium break-all">{selectedEmails.map(e => e.address).join('; ') || '(none selected)'}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
                  <span className="text-slate-500 sm:w-20 shrink-0 sm:text-right font-semibold sm:font-normal">Subject:</span>
                  <span className="text-slate-700 font-medium break-words">
                    Account Statement - {accountNumber} ({fromMonth} {fromYear} to {toMonth} {toYear})
                  </span>
                </div>
                {includeStatementPdf && (
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
                    <span className="text-slate-500 sm:w-20 shrink-0 sm:text-right font-semibold sm:font-normal">Attach:</span>
                    <span className="flex items-center gap-1.5 text-orange-600 break-all text-[11px] sm:text-sm">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      Statement_{accountNumber}_{fromMonth}_{toMonth}.pdf
                    </span>
                  </div>
                )}
                <div className="mt-2 sm:mt-3 bg-[#F7F7F7] rounded-lg p-3 sm:p-4 border whitespace-pre-wrap text-slate-700 text-xs sm:text-sm">
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
                      <p className="text-[var(--pos-accent)] underline">[View Statement Online →]</p>
                    </>
                  )}
                  <br />
                  <p>Kind regards,</p>
                  <p className="font-medium">{muniInfo?.name || ''}</p>
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
                  <p>{muniInfo?.name || 'Municipality'}: Your {statementType === 'detailed' ? 'detailed ' : ''}account statement ({fromMonth} - {toMonth} {toYear}) is ready.</p>
                  {customMessage && <p className="mt-1">{customMessage}</p>}
                  {includeTemplateLink && (
                    <p className="mt-1 text-[var(--pos-accent)] underline">[{muniInfo?.website || 'View statement online'}]</p>
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

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmtDate = (v: any) => {
    if (!v) return '-';
    try { return new Date(v).toLocaleDateString('en-ZA'); } catch { return '-'; }
  };
  const fmtAmt = (v: any) => v != null && v !== '' ? Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '0.00';

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5" data-testid="indigent-history-panel">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <Shield className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Indigent History</h3>
          {data.length > 0 && (
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{data.length}</Badge>
          )}
        </div>

        <div className="sm:hidden p-2 space-y-2">
          {data.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No records to display.</div>
          ) : data.map((row: any, i: number) => {
            const statusText = row.attpStatus || row.status || row.attpStatusDesc || '-';
            const isActive = statusText.toLowerCase().includes('active') || statusText.toLowerCase().includes('approved');
            const isTerminated = statusText.toLowerCase().includes('terminat') || statusText.toLowerCase().includes('disqualif') || statusText.toLowerCase().includes('cancel');
            return (
              <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`indigent-card-${i}`}>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Status</span><span className="text-right"><Badge variant="outline" className={`text-[10px] whitespace-nowrap ${isActive ? 'bg-emerald-50 text-emerald-700 border-[#D6D6D6]' : isTerminated ? 'bg-red-50 text-red-700 border-red-200' : 'bg-[#F7F7F7] text-slate-600 border-[#D6D6D6]'}`}>{statusText}</Badge></span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Indigent Type</span><span className="text-slate-800 font-semibold text-right">{row.indigentType || row.attpType || row.type || '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Application Date</span><span className="text-slate-800 font-semibold text-right">{fmtDate(row.applicationDate || row.appDate)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Write Off</span><span className="text-slate-800 font-semibold text-right font-mono">{fmtAmt(row.applicationWriteOffAmount || row.appWriteOffAmount || row.writeOffAmount)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Total Write Off</span><span className="text-slate-800 font-semibold text-right font-mono">{fmtAmt(row.totalWriteOffAmount || row.totalWriteOff)}</span></div>
                {(row.disqualifyReason || row.terminateReason || row.cancelReason || row.disqualifyTerminateCancelReason) && <div className="flex justify-between text-[11px]"><span className="text-slate-500 font-medium">Reason</span><span className="text-slate-800 font-semibold text-right max-w-[180px] truncate">{row.disqualifyReason || row.terminateReason || row.cancelReason || row.disqualifyTerminateCancelReason || '-'}</span></div>}
              </div>
            );
          })}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs" data-testid="table-indigent-history">
            <thead>
              <tr className="bg-[#F2F4F7] border-b-2 border-[#D6D6D6]">
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
                  <tr key={i} className={`border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors ${isTerminated ? 'bg-red-50/20' : ''}`} data-testid={`indigent-row-${i}`}>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${isActive ? 'bg-emerald-50 text-emerald-700 border-[#D6D6D6]' : isTerminated ? 'bg-red-50 text-red-700 border-red-200' : 'bg-[#F7F7F7] text-slate-600 border-[#D6D6D6]'}`}>
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

        <div className="flex items-center justify-end gap-2 px-4 py-2 bg-[#F7F7F7] border-t border-[#D6D6D6] text-xs text-slate-500">
          <span>Items per page: <span className="border rounded px-2 py-0.5 bg-white">50</span></span>
          <span>{data.length > 0 ? `1 - ${data.length} of ${data.length}` : '0 of 0'}</span>
        </div>
      </div>
    </div>
  );
}
