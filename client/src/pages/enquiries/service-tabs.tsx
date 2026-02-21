import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, Zap, ChevronDown, ChevronUp, RefreshCw,
  Activity, Gauge, Eye, Layers, Hash,
  ChevronLeft, Building2, Scale, Home, FileText, Download, FileSpreadsheet, Loader2, Link2
} from 'lucide-react';
import {
  getServiceTypeBalance, getMeteredServicesOnAccount, getAccountServiceMeterPerProperty,
  getMeterReadingHistory, getPrepaidMeterServicesForAccount,
  getPrepaidRechargeDetailsForMeter, getAllServices, getConsumptionUnits,
  getServicesSearchResults,
} from '@/lib/enquiries-service';
import { LoadingSkeleton, EmptyState, ErrorState, InfoField, SectionHeader, PaginatedTable, TabCard, getFinYearOptions, MONTHS } from './shared';
import { downloadExcel } from '@/lib/excel-export';

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

export function ServiceBalanceTab({ accountId }: { accountId: number }) {
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
      interestAmount: acc.interestAmount + (r.interestAmount ?? r.interest ?? 0),
      totalAmount: acc.totalAmount + (r.totalAmount ?? r.total ?? 0),
      currentInterestAmount: acc.currentInterestAmount + (r.currentInterestAmount || 0),
      currentCharge: acc.currentCharge + (r.currentCharge || 0),
      closingBalance: acc.closingBalance + (r.closingBalance ?? r.closingBal ?? 0),
    }), { openingBalance: 0, amount: 0, vat: 0, interestAmount: 0, totalAmount: 0, currentInterestAmount: 0, currentCharge: 0, closingBalance: 0 });

    const chartData = sorted.filter(r => r.totalAmount > 0 || r.amount > 0).map(r => ({
      month: r.month,
      amount: r.totalAmount || r.amount || 0,
    }));

    return (
      <div className="p-3 sm:p-4 space-y-6" data-testid="service-balance-detail">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-3">
            <button onClick={() => setSelectedService(null)} className="text-white hover:text-blue-200 transition-colors" data-testid="button-back-services">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Service Type Balance</h3>
            <span className="text-[10px] sm:text-xs text-blue-200 truncate">- {svcDesc}</span>
            <div className="ml-auto">
              <select value={finYear} onChange={e => setFinYear(e.target.value)} className="text-xs bg-white/20 text-white border border-white/30 rounded px-2 py-1 focus:outline-none" data-testid="select-fin-year-detail">
                {yearOptions.map(y => <option key={y} value={y} className="text-slate-800">{y}</option>)}
              </select>
            </div>
          </div>
          {sorted.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">No billing data for this service in {finYear}</div>
          ) : (
            <>
              <div className="sm:hidden p-2 space-y-2" data-testid="table-service-detail-mobile">
                {sorted.map((r: any, i: number) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">{r.serviceDescription || svcDesc}</span>
                      <span className="text-[10px] text-slate-400">{r.month || '-'} · {r.financialYear || '-'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Opening</span><span className="font-mono font-semibold text-slate-800">{fmt(r.openingBalance)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Amount</span><span className="font-mono font-semibold text-slate-800">{fmt(r.amount)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Interest</span><span className="font-mono font-semibold text-slate-800">{fmt(r.interestAmount ?? r.interest)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Total</span><span className="font-mono font-bold text-blue-700">{fmt(r.totalAmount ?? r.total)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">VAT</span><span className="font-mono text-slate-700">{fmt(r.vat)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Closing</span><span className="font-mono text-slate-700">{fmt(r.closingBalance ?? r.closingBal)}</span></div>
                    </div>
                  </div>
                ))}
                <div className="bg-slate-100 border border-slate-300 rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-800 mb-1.5">Total</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Opening</span><span className="font-mono font-bold">{fmt(totals.openingBalance)}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Amount</span><span className="font-mono font-bold">{fmt(totals.amount)}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Interest</span><span className="font-mono font-bold">{fmt(totals.interestAmount)}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Total</span><span className="font-mono font-bold text-blue-700">{fmt(totals.totalAmount)}</span></div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-service-detail">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service Description</th>
                      <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Opening Balance</th>
                      <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                      <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">VAT</th>
                      <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Interest</th>
                      <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Total Amount</th>
                      <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Closing Balance</th>
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
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.interestAmount ?? r.interest)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700">{fmt(r.totalAmount ?? r.total)}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.closingBalance ?? r.closingBal)}</td>
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
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.closingBalance)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.currentInterestAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.currentCharge)}</td>
                      <td className="py-2.5 px-3" colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700">
              <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Service Type Balance</h3>
            </div>
            <div className="p-3 sm:p-4 h-[250px] sm:h-[350px]">
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
    <div className="p-3 sm:p-4 space-y-4" data-testid="service-balance-tab">
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
              ? (svc.meterNo || svc.meterNumber || 'No Meter')
              : `${svc.physicalMeterNo || svc.physicalMeterNumber || 'No Meter'}${svc.meterNo || svc.meterNumber ? ` - ${svc.meterNo || svc.meterNumber}` : ''}`;
            const status = svc.serviceStatus || svc.statusDesc || svc.status || '-';
            const isActiveStatus = status.toLowerCase() === 'active';
            const requestDate = svc.serviceRequestedDate ? new Date(svc.serviceRequestedDate).toLocaleDateString('en-ZA') : '-';
            const commencementDate = svc.serviceCommencementDate || svc.commencementDate
              ? new Date(svc.serviceCommencementDate || svc.commencementDate).toLocaleDateString('en-ZA')
              : svc.startDate || '-';
            const svcName = svc.tariffType || svc.serviceDesc || svc.serviceDescription || svc.serviceType || 'Service';
            const serviceMode = svc.serviceModeDesc || svc.serviceMode || '';
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

                <div className="px-3 sm:px-4 py-2.5 sm:py-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2.5">
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
                      <div className="text-[12px] text-slate-700 mt-0.5">{svc.tariffType || svc.serviceDesc || svc.serviceDescription || '-'}</div>
                    </div>
                    {serviceMode && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Service Mode</div>
                        <div className="text-[12px] text-slate-700 mt-0.5">{serviceMode}</div>
                      </div>
                    )}
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

export function ServiceBalanceChart({ data }: { data: { month: string; amount: number }[] }) {
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
        <div className="flex-1 border-l border-b border-slate-200 relative flex items-end justify-around px-1 sm:px-2 gap-0.5 sm:gap-1">
          {data.map((d, i) => {
            const height = maxVal > 0 ? (d.amount / maxVal) * 100 : 0;
            return (
              <div key={i} className="flex flex-col items-center flex-1" style={{ maxWidth: barWidth }}>
                <div className="w-full flex items-end justify-center" style={{ height: '100%', minHeight: 150 }}>
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

export function ConsumptionChart({ readings }: { readings: any[] }) {
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
  const maxVal = Math.max(...recent.map(r => r.consumption ?? r.consumptionValue ?? r.units ?? 0), 1);
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
              const consumptionVal = item.consumption ?? item.consumptionValue ?? item.units ?? 0;
              const pct = maxVal > 0 ? (consumptionVal / (yTicks[yTicks.length - 1] || maxVal)) * 100 : 0;
              const color = getBarColor(item);
              return (
                <div key={i} className="flex flex-col items-center flex-1 min-w-0" style={{ height: '100%', justifyContent: 'flex-end' }}>
                  <span className="text-[9px] font-mono text-slate-600 mb-0.5">{consumptionVal}</span>
                  <div className={`w-full max-w-[40px] ${color.bg} rounded-t-sm transition-all`} style={{ height: `${Math.max(pct, 1)}%` }} title={`${formatMonth(item)}: ${consumptionVal} (${color.label})`} />
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

export function ConsumptionTab({ accountId, accountNumber }: { accountId: number; accountNumber?: string }) {
  const [meters, setMeters] = useState<any[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<any | null>(null);
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);
  const finYears = useMemo(() => getFinYearOptions(), []);
  const [selectedFinYear, setSelectedFinYear] = useState(finYears[0]);

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
      const meterNo = (meter.meterNo || meter.meterNumber || meter.physicalMeterNo || meter.physicalMeterNumber || '').replace(/^0+/, '');
      const history = await getMeterReadingHistory(accountId, meterNo);
      setReadingHistory(history);
    } catch {
      setReadingHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [accountId]);

  const parseDate = useCallback((d: string) => {
    if (!d) return 0;
    const parts = d.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
    return new Date(d).getTime();
  }, []);

  const getRecordFinYear = useCallback((item: any): string => {
    if (item.finYear) return item.finYear;
    if (item.financialYear) return item.financialYear;
    const dateStr = item.reading2Date || item.reading1Date || '';
    if (!dateStr) return '';
    const ts = parseDate(dateStr);
    if (!ts) return '';
    const d = new Date(ts);
    const month = d.getMonth();
    const year = d.getFullYear();
    const startYear = month >= 6 ? year : year - 1;
    return `${startYear}/${startYear + 1}`;
  }, [parseDate]);

  const filteredHistory = useMemo(() => {
    const sorted = [...readingHistory].sort((a, b) => parseDate(b.reading1Date) - parseDate(a.reading1Date));

    const seenKeys = new Set<string>();
    const deduped = sorted.filter(item => {
      const bm = (item.billingmonth || item.billingMonth || '').trim();
      const fy = getRecordFinYear(item);
      const key = `${fy}__${bm.toLowerCase()}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    return deduped.filter(item => {
      const fy = getRecordFinYear(item);
      return fy === selectedFinYear;
    });
  }, [readingHistory, selectedFinYear, parseDate, getRecordFinYear]);

  const availableFinYears = useMemo(() => {
    const years = new Set<string>();
    readingHistory.forEach(item => {
      const fy = getRecordFinYear(item);
      if (fy) years.add(fy);
    });
    const allYears = Array.from(new Set([...finYears, ...Array.from(years)]));
    allYears.sort((a, b) => {
      const ya = parseInt(a.split('/')[0]);
      const yb = parseInt(b.split('/')[0]);
      return yb - ya;
    });
    return allYears;
  }, [readingHistory, finYears, getRecordFinYear]);

  const openMonthsCount = useMemo(() => {
    const [startYearStr] = selectedFinYear.split('/');
    const startYear = parseInt(startYearStr);
    const now = new Date();
    const finStart = new Date(startYear, 6, 1);
    const finEnd = new Date(startYear + 1, 5, 30);
    if (now < finStart) return 0;
    const end = now > finEnd ? finEnd : now;
    const months = (end.getFullYear() - finStart.getFullYear()) * 12 + (end.getMonth() - finStart.getMonth()) + 1;
    return Math.min(Math.max(months, 0), 12);
  }, [selectedFinYear]);

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
    { key: 'testReadingDate', label: 'Test Reading Date' },
    { key: 'testReading', label: 'Test Reading' },
    { key: 'declineReason', label: 'Decline Reason' },
    { key: 'meterErrorCode', label: 'Meter Error Code' },
    { key: 'importStatus', label: 'Import Status' },
    { key: 'meterChange', label: 'Meter Change' },
    { key: 'meterStatus', label: 'Meter Status' },
    { key: 'serviceStatus', label: 'Service Status' },
    { key: 'readingStatus', label: 'Reading Status' },
    { key: 'disconnectionStatus', label: 'Disconnection Status' },
    { key: 'disconnectionReading', label: 'Disconnection Reading' },
    { key: 'disconnectionDate', label: 'Disconnection Date' },
    { key: 'contractorRemarks', label: 'Contractor Remarks' },
    { key: 'disconnectionLetter', label: 'Disconnection Letter' },
    { key: 'supportingDocument', label: 'Supporting Document' },
  ];

  return (
    <div className="p-3 sm:p-5 space-y-5" data-testid="consumption-tab">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
          <Zap className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Consumption</h3>
          <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{meters.length} meter{meters.length !== 1 ? 's' : ''}</Badge>
        </div>
        <div className="sm:hidden p-2 space-y-2" data-testid="table-consumption-meters-mobile">
          {meters.map((meter: any, i: number) => {
            const isSelected = selectedMeter && (selectedMeter.meterNo === meter.meterNo && selectedMeter.serviceDesc === meter.serviceDesc);
            return (
              <div
                key={i}
                onClick={() => loadHistory(meter)}
                className={`border rounded-lg p-3 space-y-2 cursor-pointer active:scale-[0.99] transition-all ${isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white'}`}
                data-testid={`row-meter-${i}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">{meter.serviceDesc || meter.serviceDescription || '-'}</span>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                    {isSelected && <div className="w-full h-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter No</span><span className="font-mono font-semibold text-blue-700">{meter.meterNo || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Physical</span><span className="font-mono text-slate-700">{meter.physicalMeterNo || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700 truncate ml-1">{meter.tariff || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Classification</span><span className="text-slate-700">{meter.meterClassificationDesc || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Status</span><span className="text-slate-700">{meter.serviceStatus || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Factor</span><span className="font-mono text-slate-700">{meter.tarifffactor ?? '-'}</span></div>
                </div>
                <div className="text-center text-[10px] text-blue-600 font-semibold pt-1">Tap to view readings</div>
              </div>
            );
          })}
        </div>
        <div className="hidden sm:block overflow-x-auto">
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
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-slate-100 to-white border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">Meter Reading History Chart</h3>
            <span className="text-xs text-slate-500 font-medium">{selectedFinYear} ({filteredHistory.length} of {openMonthsCount} months)</span>
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 mb-4 border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-slate-50">
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
              <ConsumptionChart readings={filteredHistory} />
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No reading history available for this meter</div>
            )}
          </div>
        </div>
      )}

      {selectedMeter && !historyLoading && readingHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-slate-600 to-slate-700">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-white shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Meter Reading History</h3>
              <Badge variant="outline" className="hidden sm:inline-flex ml-auto bg-white/20 text-white border-white/30 text-[10px]">
                {filteredHistory.length} of {openMonthsCount} months
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <select
                value={selectedFinYear}
                onChange={e => setSelectedFinYear(e.target.value)}
                className="bg-white/20 text-white text-xs border border-white/30 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/50 appearance-none cursor-pointer"
                data-testid="select-meter-finyear"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: '22px' }}
              >
                {availableFinYears.map(fy => (
                  <option key={fy} value={fy} className="text-slate-800 bg-white">{fy}</option>
                ))}
              </select>
              <Badge variant="outline" className="sm:hidden bg-white/20 text-white border-white/30 text-[10px]">
                {filteredHistory.length}/{openMonthsCount} months
              </Badge>
              <div className="ml-auto">
                <button
                  onClick={() => {
                    const hdrs = historyCols.map(c => c.label);
                    const dataRows = filteredHistory.map((item: any) =>
                      historyCols.map(col => {
                        let val = item[col.key];
                        if ((val === undefined || val === null || val === '') && (col as any).fallback) val = (col as any).fallback();
                        return val ?? '';
                      })
                    );
                    const acctLabel = accountNumber || String(accountId);
                    const meterLabel = selectedMeter?.physicalMeterNo || selectedMeter?.meterNo || 'N/A';
                    downloadExcel({
                      filename: `MeterReadingHistory_${acctLabel}_${selectedFinYear}_${meterLabel || 'export'}`,
                      sheetName: 'Meter Readings',
                      title: 'Meter Reading History',
                      infoRows: [
                        { label: 'Account Number:', value: acctLabel },
                        { label: 'Meter No:', value: meterLabel },
                        { label: 'Financial Year:', value: selectedFinYear },
                      ],
                      headers: hdrs,
                      rows: dataRows,
                      headerColor: '00695C',
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-[11px] font-medium rounded-md transition-colors border border-white/20"
                  data-testid="btn-download-meter-history"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
              </div>
            </div>
          </div>
          <div className="sm:hidden p-2 space-y-2 max-h-[500px] overflow-y-auto" data-testid="table-meter-reading-history-mobile">
            {filteredHistory.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No meter readings found for {selectedFinYear}</div>
            ) : filteredHistory.map((item: any, i: number) => {
              let consumption = item.consumption;
              if ((consumption === undefined || consumption === null || consumption === '') && selectedMeter?.tarifffactor) consumption = '';
              const flag = String(item.flag || '').toLowerCase();
              const flagColor = flag.includes('reversed') || flag.includes('cancel') ? 'bg-red-100 text-red-700 border-red-200' : flag.includes('estimate') || flag.includes('levy') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200';
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">{item.billingmonth || item.billingMonth || '-'}</span>
                    {item.flag && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${flagColor}`}>{item.flag}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Old Date</span><span className="font-mono text-slate-700">{item.reading1Date || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">New Date</span><span className="font-mono text-slate-700">{item.reading2Date || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Old Reading</span><span className="font-mono font-semibold">{item.reading1 ?? '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">New Reading</span><span className="font-mono font-semibold">{item.reading2 ?? '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Consumption</span><span className="font-mono font-bold text-blue-700">{item.consumption ?? '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Days</span><span className="font-mono text-slate-700">{item.readingdays ?? '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter Status</span><span className="text-slate-700">{item.meterStatus || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Reading Status</span><span className="text-slate-700">{item.readingStatus || '-'}</span></div>
                  </div>
                  {(item.meterChange || item.disconnectionStatus) && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-slate-100">
                      {item.meterChange && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter Change</span><span className="text-slate-700">{item.meterChange}</span></div>}
                      {item.disconnectionStatus && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Disconnection</span><span className="text-slate-700">{item.disconnectionStatus}</span></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="hidden sm:block overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm" data-testid="table-meter-reading-history">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  {historyCols.map(col => (
                    <th key={col.key} className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={historyCols.length} className="py-8 text-center text-slate-400 text-sm">
                      No meter readings found for {selectedFinYear}
                    </td>
                  </tr>
                ) : filteredHistory.map((item: any, i: number) => (
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

export function ServicesMetersTab({ accountId, unitId, accountNumber }: { accountId: number; unitId?: number; accountNumber?: string }) {
  const [meters, setMeters] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [prepaidMeters, setPrepaidMeters] = useState<any[]>([]);
  const [showPrepaidSales, setShowPrepaidSales] = useState(false);
  const [selectedPrepaidMeter, setSelectedPrepaidMeter] = useState<any>(null);
  const [prepaidRechargeDetails, setPrepaidRechargeDetails] = useState<any[]>([]);
  const [loadingRecharge, setLoadingRecharge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevAccountId = useRef<number | null>(null);

  const [consumptionMeter, setConsumptionMeter] = useState<any>(null);
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([]);
  const [consumptionLoading, setConsumptionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mppResult, svcResult, prepaidResult] = await Promise.allSettled([
        getAccountServiceMeterPerProperty(accountId),
        getAllServices(accountId),
        getPrepaidMeterServicesForAccount(accountId),
      ]);
      setMeters(mppResult.status === 'fulfilled' ? mppResult.value || [] : []);
      setAllServices(svcResult.status === 'fulfilled' ? svcResult.value || [] : []);
      setPrepaidMeters(prepaidResult.status === 'fulfilled' ? prepaidResult.value || [] : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load services & meters');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (prevAccountId.current !== accountId) {
      prevAccountId.current = accountId;
      setConsumptionMeter(null);
      load();
    }
  }, [accountId, load]);

  const viewConsumption = useCallback(async (meter: any) => {
    setConsumptionMeter(meter);
    setConsumptionLoading(true);
    setConsumptionHistory([]);
    try {
      const meterNo = (meter.meterNo || meter.meterNumber || meter.physicalMeterNo || meter.physicalMeterNumber || '').replace(/^0+/, '');
      if (meterNo) {
        const history = await getMeterReadingHistory(accountId, meterNo);
        setConsumptionHistory(Array.isArray(history) ? history : []);
      }
    } catch {
      setConsumptionHistory([]);
    } finally {
      setConsumptionLoading(false);
    }
  }, [accountId]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const hasData = meters.length || allServices.length || prepaidMeters.length;
  if (!hasData) return <EmptyState message="No services or meter data available" />;

  return (
    <div className="p-3 sm:p-5 space-y-5">
      {allServices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">All Services</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{allServices.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2" data-testid="table-all-services-mobile">
            {allServices.map((s: any, i: number) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">{s.serviceType || s.serviceTypeDescription || '-'}</span>
                  <Badge variant={s.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">{s.status || s.serviceStatus || '-'}</Badge>
                </div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Service ID</span><span className="font-mono font-semibold text-blue-700">{s.serviceId || s.service_ID || s.serviceID || '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Description</span><span className="text-slate-800 font-semibold text-right truncate ml-2">{s.description || s.serviceDescription || '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700">{s.tariff || s.tariffCode || s.tariffDescription || '-'}</span></div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
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

      {meters.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 bg-gradient-to-r from-teal-600 to-teal-700 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Meters</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{meters.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2" data-testid="table-meters-mobile">
            {meters.map((m: any, i: number) => (
              <div key={i} className={`bg-white border rounded-lg p-3 space-y-2 ${consumptionMeter === m ? 'border-teal-300 bg-teal-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">{m.serviceType || m.serviceTypeDescription || m.serviceDesc || m.serviceDescription || '-'}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.statusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{m.status || m.statusDesc || '-'}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter No</span><span className="font-mono font-semibold text-blue-700">{m.meterNo || m.meterNumber || m.physicalMeterNumber || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Physical</span><span className="font-mono text-slate-700">{m.physicalMeterNumber || m.physicalMeterNo || m.meterNo || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Classification</span><span className="text-slate-700">{m.classification || m.meterClassification || m.meterType || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700 truncate ml-1">{m.tariffCode || m.tariff || m.tariffDescription || '-'}</span></div>
                </div>
                <button
                  onClick={() => viewConsumption(m)}
                  className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-[11px] font-semibold rounded-md border border-cyan-200 transition-all"
                  data-testid={`button-view-consumption-${i}`}
                >
                  <Activity className="w-3 h-3" />
                  View Consumption
                </button>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-meters">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Classification</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Physical Meter No</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter No</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Install Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Tariff Code</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Main Meter</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Billable</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Replace</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reason</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Account Number</th>
                  <th className="text-center py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Consumption</th>
                </tr>
              </thead>
              <tbody>
                {meters.map((m: any, i: number) => (
                  <tr key={i} className={`border-b border-slate-100 hover:bg-teal-50/30 transition-colors ${consumptionMeter === m ? 'bg-teal-50 ring-1 ring-teal-300' : ''}`}>
                    <td className="py-2 px-3 font-medium">{m.serviceType || m.serviceTypeDescription || m.serviceDesc || m.serviceDescription || '-'}</td>
                    <td className="py-2 px-3">{m.classification || m.meterClassification || m.meterType || '-'}</td>
                    <td className="py-2 px-3 font-mono text-sm">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</td>
                    <td className="py-2 px-3 font-mono font-semibold text-blue-700">{m.meterNo || m.meterNumber || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{m.installDate ? new Date(m.installDate).toLocaleDateString('en-ZA') : m.dateInstalled ? new Date(m.dateInstalled).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-2 px-3 text-xs">{m.tariffCode || m.tariff || m.tariffDescription || '-'}</td>
                    <td className="py-2 px-3">{m.mainMeter !== undefined ? String(m.mainMeter) : m.isMainMeter !== undefined ? String(m.isMainMeter) : '-'}</td>
                    <td className="py-2 px-3">{m.billable !== undefined ? String(m.billable) : m.isBillable !== undefined ? String(m.isBillable) : '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.statusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {m.status || m.statusDesc || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.serviceStatus || m.serviceStatusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {m.serviceStatus || m.serviceStatusDesc || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3">{m.replace !== undefined ? String(m.replace) : m.isReplaced !== undefined ? String(m.isReplaced) : '-'}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{m.reason || m.replaceReason || '-'}</td>
                    <td className="py-2 px-3 font-mono text-xs">{m.accountNumber || m.accountNo || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => viewConsumption(m)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-[11px] font-semibold rounded-md border border-cyan-200 transition-all"
                        data-testid={`button-view-consumption-${i}`}
                      >
                        <Activity className="w-3 h-3" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {consumptionMeter && (
        <div className="bg-white rounded-xl border border-cyan-200 shadow-sm overflow-hidden" data-testid="consumption-detail-panel">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-cyan-100 bg-gradient-to-r from-cyan-600 to-cyan-700 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="w-4 h-4 text-white shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate">
                Consumption — Meter {consumptionMeter.meterNo || consumptionMeter.meterNumber || consumptionMeter.physicalMeterNumber || ''}
              </h3>
            </div>
            <button
              onClick={() => { setConsumptionMeter(null); setConsumptionHistory([]); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-all border border-white/30 shrink-0"
              data-testid="button-close-consumption"
            >
              Close
            </button>
          </div>
          <div className="p-3 sm:p-5">
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 sm:p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Service Type</span>
                  <p className="font-medium text-slate-800 mt-0.5">{consumptionMeter.serviceType || consumptionMeter.serviceTypeDescription || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Meter No</span>
                  <p className="font-mono font-bold text-blue-700 mt-0.5">{consumptionMeter.meterNo || consumptionMeter.meterNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Physical Meter</span>
                  <p className="font-mono text-slate-800 mt-0.5">{consumptionMeter.physicalMeterNumber || consumptionMeter.physicalMeterNo || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tariff</span>
                  <p className="text-slate-800 mt-0.5">{consumptionMeter.tariffCode || consumptionMeter.tariff || '-'}</p>
                </div>
              </div>
            </div>

            {consumptionLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading consumption history...</span>
              </div>
            ) : consumptionHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No consumption history found for this meter</div>
            ) : (
              <>
                <div className="sm:hidden space-y-2" data-testid="table-meter-consumption-mobile">
                  {consumptionHistory.map((h: any, i: number) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5" data-testid={`consumption-row-${i}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">{h.readingDate ? new Date(h.readingDate).toLocaleDateString('en-ZA') : h.date ? new Date(h.date).toLocaleDateString('en-ZA') : '-'}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(h.readingType || '').toLowerCase() === 'actual' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>{h.readingType || h.type || '-'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Reading</span><span className="font-mono font-semibold">{h.reading ?? h.meterReading ?? h.readingValue ?? h.currentReading ?? '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Consumption</span><span className="font-mono font-bold text-cyan-700">{h.consumption ?? h.consumptionValue ?? h.units ?? h.consumptionUnits ?? '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Est. Reading</span><span className="font-mono text-slate-600">{h.estimatedReading ?? h.estimateReading ?? '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Period</span><span className="text-slate-700">{h.period || h.billingPeriod || h.periodDescription || '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Fin Year</span><span className="text-slate-700">{h.finYear || h.financialYear || '-'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-meter-consumption">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reading Date</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reading</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Consumption</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Est. Reading</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Period</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reading Type</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Fin Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumptionHistory.map((h: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-cyan-50/30 transition-colors" data-testid={`consumption-row-${i}`}>
                          <td className="py-2 px-3 text-slate-600">{h.readingDate ? new Date(h.readingDate).toLocaleDateString('en-ZA') : h.date ? new Date(h.date).toLocaleDateString('en-ZA') : '-'}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">{h.reading ?? h.meterReading ?? h.readingValue ?? h.currentReading ?? '-'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-cyan-700">{h.consumption ?? h.consumptionValue ?? h.units ?? h.consumptionUnits ?? '-'}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{h.estimatedReading ?? h.estimateReading ?? '-'}</td>
                          <td className="py-2 px-3">{h.period || h.billingPeriod || h.periodDescription || '-'}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(h.readingType || '').toLowerCase() === 'actual' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                              {h.readingType || h.type || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500">{h.finYear || h.financialYear || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {prepaidMeters.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-white" />
              <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Prepaid Meter Services</h3>
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
          <div className="sm:hidden p-2 space-y-2" data-testid="table-prepaid-meters-mobile">
            {prepaidMeters.map((m: any, i: number) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 cursor-pointer active:bg-blue-50" onClick={() => { setShowPrepaidSales(true); setSelectedPrepaidMeter(null); setPrepaidRechargeDetails([]); }} data-testid={`prepaid-meter-row-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-blue-700 text-xs">{m.prepaidMeterNo || m.meterNumber || m.physicalMeterNumber || m.meterNo || '-'}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.meterStatus || m.statusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{m.status || m.meterStatus || m.statusDesc || '-'}</span>
                </div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Service</span><span className="text-slate-800 font-semibold">{m.prepaidServiceDesc || m.serviceType || m.serviceDescription || m.serviceDesc || '-'}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">Last Recharge</span><span className="font-mono text-slate-700">{m.lastRechargeDate ? new Date(m.lastRechargeDate).toLocaleDateString('en-ZA') : (m.lastRechargeAmount ?? '-')}</span></div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
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
                    <td className="py-2 px-3 font-mono font-medium text-blue-700">{m.prepaidMeterNo || m.meterNumber || m.physicalMeterNumber || m.meterNo || '-'}</td>
                    <td className="py-2 px-3">{m.prepaidServiceDesc || m.serviceType || m.serviceDescription || m.serviceDesc || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.meterStatus || m.statusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {m.status || m.meterStatus || m.statusDesc || '-'}
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => setShowPrepaidSales(false)} data-testid="prepaid-sales-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-700 to-emerald-800 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-white" />
                <h4 className="text-sm sm:text-base font-bold text-white">Prepaid Sales</h4>
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
            <div className="p-3 sm:p-6">
              {!selectedPrepaidMeter ? (
                <>
                  <div className="sm:hidden space-y-2" data-testid="table-prepaid-sales-mobile">
                    {prepaidMeters.length === 0 ? (
                      <div className="text-center text-slate-400 py-6">No prepaid meters found</div>
                    ) : prepaidMeters.map((m: any, i: number) => {
                      const handleClick = async () => {
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
                      };
                      return (
                        <div key={i} onClick={handleClick} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 cursor-pointer active:bg-emerald-50" data-testid={`prepaid-sales-row-${i}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800">{m.serviceType || m.serviceDescription || 'Electricity Pre-Paid'}</span>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.meterStatus || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              {m.status || m.meterStatus || '-'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter No</span><span className="font-mono font-semibold text-blue-700">{m.meterNumber || m.meterNo || '-'}</span></div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Physical</span><span className="font-mono text-slate-700">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</span></div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700 truncate ml-1">{m.tariff || m.tariffDescription || '-'}</span></div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Phase</span><span className="text-slate-700">{m.meterPhase || m.phase || '-'}</span></div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Classification</span><span className="text-slate-700">{m.meterClassification || m.classification || '-'}</span></div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Factor</span><span className="font-mono text-slate-700">{m.factor ?? '-'}</span></div>
                          </div>
                          <div className="text-center text-[10px] text-emerald-600 font-semibold pt-1">Tap to view recharge details</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden sm:block overflow-x-auto">
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
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
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
                    <>
                      <div className="sm:hidden space-y-2" data-testid="table-prepaid-recharge-details-mobile">
                        {prepaidRechargeDetails.length === 0 ? (
                          <div className="text-center text-slate-400 py-6">No recharge details found for this meter</div>
                        ) : prepaidRechargeDetails.map((r: any, i: number) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2" data-testid={`recharge-detail-row-${i}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600">{r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-ZA') : r.rechargeDate ? new Date(r.rechargeDate).toLocaleDateString('en-ZA') : '-'}</span>
                              {r.isCancelled || r.cancelledStatus === 'Yes' ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">Cancelled</span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>
                              )}
                            </div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Receipt No</span><span className="font-mono font-semibold text-blue-700">{r.receiptNo || r.receiptNumber || '-'}</span></div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">Amount</span><span className="font-mono font-semibold">{(r.amount ?? r.rechargeAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">VAT</span><span className="font-mono">{(r.vatAmount ?? r.vat ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">Total</span><span className="font-mono font-bold text-slate-800">{(r.total ?? r.totalAmount ?? ((r.amount ?? 0) + (r.vatAmount ?? 0))).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">Units</span><span className="font-mono">{r.prepaidUnit ?? r.units ?? r.kwhUnits ?? '-'}</span></div>
                            </div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Token</span><span className="font-mono text-xs text-slate-700 truncate ml-2">{r.prepaidTokenNo || r.tokenNumber || r.token || '-'}</span></div>
                          </div>
                        ))}
                      </div>
                      <div className="hidden sm:block overflow-x-auto">
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
                    </>
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
