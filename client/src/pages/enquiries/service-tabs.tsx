import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, Zap, ChevronDown, ChevronUp, RefreshCw,
  Activity, Gauge, Eye, Layers, Hash,
  ChevronLeft, Building2, Scale, Home, FileText, Download, FileSpreadsheet, Loader2, Link2,
  Brain, TrendingUp, TrendingDown, AlertTriangle, BarChart3, Info
} from 'lucide-react';
import {
  getServiceTypeBalance, getMeteredServicesOnAccount, getAccountServiceMeterPerProperty,
  getMeterReadingHistory, getPrepaidMeterServicesForAccount,
  getPrepaidRechargeDetailsForMeter, getAllServices, getConsumptionUnits,
  getServicesSearchResults,
} from '@/lib/enquiries-service';
import { getServiceTypeDesc, getMeterClassificationDesc, isServicePrepaidByType } from '@/lib/service-lookups';
import { LoadingSkeleton, EmptyState, ErrorState, InfoField, SectionHeader, PaginatedTable, TabCard, getFinYearOptions, MONTHS } from './shared';
import { downloadExcel } from '@/lib/excel-export';

export interface TariffBlock {
  startDate: string;
  endDate: string;
  intervals: { interval: string; cost: string }[];
}

export function parseTariffRateData(svc: any): { startDate: string; endDate: string; intervals: { interval: string; cost: string }[]; blocks: TariffBlock[] } {
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-3">
            <button onClick={() => setSelectedService(null)} className="text-white hover:text-[var(--pos-accent-light)] transition-colors" data-testid="button-back-services">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Service Type Balance</h3>
            <span className="text-[10px] sm:text-xs text-[var(--pos-accent-light)] truncate">- {svcDesc}</span>
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
                  <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">{r.serviceDescription || svcDesc}</span>
                      <span className="text-[10px] text-slate-400">{r.month || '-'} · {r.financialYear || '-'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Opening</span><span className="font-mono font-semibold text-slate-800">{fmt(r.openingBalance)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Amount</span><span className="font-mono font-semibold text-slate-800">{fmt(r.amount)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Interest</span><span className="font-mono font-semibold text-slate-800">{fmt(r.interestAmount ?? r.interest)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Total</span><span className="font-mono font-bold text-[var(--pos-accent)]">{fmt(r.totalAmount ?? r.total)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">VAT</span><span className="font-mono text-slate-700">{fmt(r.vat)}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Closing</span><span className="font-mono text-slate-700">{fmt(r.closingBalance ?? r.closingBal)}</span></div>
                    </div>
                  </div>
                ))}
                <div className="bg-[#F2F4F7] border border-[#BFBFBF] rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-800 mb-1.5">Total</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Opening</span><span className="font-mono font-bold">{fmt(totals.openingBalance)}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Amount</span><span className="font-mono font-bold">{fmt(totals.amount)}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Interest</span><span className="font-mono font-bold">{fmt(totals.interestAmount)}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Total</span><span className="font-mono font-bold text-[var(--pos-accent)]">{fmt(totals.totalAmount)}</span></div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-service-detail">
                  <thead>
                    <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
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
                      <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors">
                        <td className="py-2 px-3 text-slate-700">{r.serviceDescription || svcDesc}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.openingBalance)}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.amount)}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.vat)}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.interestAmount ?? r.interest)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--pos-accent)]">{fmt(r.totalAmount ?? r.total)}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.closingBalance ?? r.closingBal)}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.currentInterestAmount)}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(r.currentCharge)}</td>
                        <td className="py-2 px-3 text-slate-600">{r.month || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{r.financialYear || '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#F2F4F7] border-t-2 border-[#BFBFBF] font-bold">
                      <td className="py-2.5 px-3 text-slate-800">Total</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.openingBalance)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.amount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.vat)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(totals.interestAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--pos-accent)]">{fmt(totals.totalAmount)}</td>
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
          <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)]">
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
    if (lower.includes('water')) return { bg: 'from-[var(--pos-accent)] to-[var(--pos-accent-dark)]', light: 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] ring-[#D6D6D6]', iconBg: 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]' };
    if (lower.includes('electricity') || lower.includes('elec')) return { bg: 'from-[var(--pos-accent)] to-[var(--pos-accent-dark)]', light: 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] ring-[#D6D6D6]', iconBg: 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]' };
    if (lower.includes('sanitation') || lower.includes('sewer')) return { bg: 'from-[var(--pos-accent)] to-[var(--pos-accent-dark)]', light: 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] ring-[#D6D6D6]', iconBg: 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]' };
    if (lower.includes('waste') || lower.includes('refuse')) return { bg: 'from-[var(--pos-accent)] to-[var(--pos-accent-dark)]', light: 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] ring-[#D6D6D6]', iconBg: 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]' };
    if (lower.includes('rates') || lower.includes('property')) return { bg: 'from-[var(--pos-accent)] to-[var(--pos-accent-dark)]', light: 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] ring-[#D6D6D6]', iconBg: 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]' };
    return { bg: 'from-[var(--pos-accent)] to-[var(--pos-accent-dark)]', light: 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] ring-[#D6D6D6]', iconBg: 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)]' };
  };

  const serviceGroups = useMemo(() => {
    const groupMap = new Map<string, { name: string; services: any[]; activeCount: number; totalCount: number }>();
    displayData.forEach((svc: any) => {
      const name = getServiceTypeDesc(svc) || 'Other';
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!groupMap.has(key)) {
        groupMap.set(key, { name, services: [], activeCount: 0, totalCount: 0 });
      }
      const group = groupMap.get(key)!;
      group.services.push(svc);
      group.totalCount++;
      const status = (svc.serviceStatus || svc.statusDesc || svc.status || '').toLowerCase();
      if (status === 'active') group.activeCount++;
    });
    return Array.from(groupMap.values()).sort((a, b) => b.totalCount - a.totalCount);
  }, [displayData]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName); else next.add(groupName);
      return next;
    });
  };

  const renderServiceDetail = (svc: any, globalIdx: number) => {
    const tariffInfo = parseTariffRateData(svc);
    const isExpanded = expandedRates.has(globalIdx);
    const hasCostData = !!svc.costInterVal || (svc.endDate && typeof svc.endDate === 'string' && svc.endDate.includes('<'));
    const meterDisplay = hasCostData
      ? (svc.meterNo || svc.meterNumber || 'No Meter')
      : `${svc.physicalMeterNo || svc.physicalMeterNumber || 'No Meter'}${svc.meterNo || svc.meterNumber ? ` - ${svc.meterNo || svc.meterNumber}` : ''}`;
    const status = svc.serviceStatus || svc.statusDesc || svc.status || '-';
    const isActiveStatus = status.toLowerCase() === 'active';
    const serviceMode = svc.serviceModeDesc || svc.serviceMode || '';
    const requestDate = svc.serviceRequestedDate ? new Date(svc.serviceRequestedDate).toLocaleDateString('en-GB') : '-';
    const commencementDate = svc.serviceCommencementDate || svc.commencementDate
      ? new Date(svc.serviceCommencementDate || svc.commencementDate).toLocaleDateString('en-GB')
      : svc.startDate || '-';
    return (
      <div key={globalIdx} className="bg-[#F7F7F7] rounded-lg border border-[#D6D6D6] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button onClick={() => setSelectedService(svc)} className="text-[12px] font-semibold text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] truncate text-left" data-testid={`btn-service-detail-${globalIdx}`}>
              {svc.tariff || svc.tariffDesc || svc.tariffDescription || getServiceTypeDesc(svc) || 'Service Entry'}
            </button>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${isActiveStatus ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-600 border border-red-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActiveStatus ? 'bg-emerald-500' : 'bg-red-400'}`} />
            {status}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
          <div><div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Meter</div><div className="text-[11px] text-slate-700 font-mono mt-0.5">{meterDisplay}</div></div>
          <div><div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Frequency</div><div className="text-[11px] text-slate-700 mt-0.5">{svc.frequency || '-'}</div></div>
          {svc.meterConnectionSize && <div><div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Connection</div><div className="text-[11px] text-slate-700 mt-0.5">{svc.meterConnectionSize}</div></div>}
          <div><div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Factor / Qty</div><div className="text-[11px] text-slate-700 font-mono mt-0.5">{svc.factorQuantity ?? svc.tarifffactor ?? '-'}</div></div>
          <div><div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Commencement</div><div className="text-[11px] text-slate-700 mt-0.5">{commencementDate}</div></div>
          {serviceMode && <div><div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Mode</div><div className="text-[11px] text-slate-700 mt-0.5">{serviceMode}</div></div>}
        </div>
        {tariffInfo.blocks.length > 0 && (
          <div className="pt-2 border-t border-[#D6D6D6]">
            <button onClick={(e) => { e.stopPropagation(); toggleRate(globalIdx); }} className="flex items-center gap-1 text-[10px] font-semibold text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)]" data-testid={`btn-tariff-rate-${globalIdx}`}>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Tariff Rates ({tariffInfo.blocks.reduce((sum, b) => sum + b.intervals.length, 0)} entries)
            </button>
            {isExpanded && (
              <div className="mt-1.5 space-y-1.5">
                {tariffInfo.blocks.map((block, bi) => (
                  <div key={bi} className="rounded border border-[#D6D6D6] overflow-hidden">
                    {(block.startDate || block.endDate) && <div className="px-2.5 py-1 bg-white border-b border-[#E5E5E5] text-[10px] text-slate-500">Period: {block.startDate || '—'} to {block.endDate || '—'}</div>}
                    <table className="w-full text-[11px]">
                      <tbody>
                        {block.intervals.map((iv, idx) => (
                          <tr key={idx} className="border-t border-[#E5E5E5] first:border-t-0">
                            <td className="py-1 px-2.5 text-slate-600">{iv.interval}</td>
                            <td className="py-1 px-2.5 text-right font-mono font-semibold text-[var(--pos-accent)]">R {iv.cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  let globalSvcIdx = 0;

  return (
    <div className="p-3 sm:p-4 space-y-4" data-testid="service-balance-tab">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Services</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{serviceGroups.length} service type{serviceGroups.length !== 1 ? 's' : ''} · {displayData.length} total entries</p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">{serviceGroups.length} types</Badge>
      </div>

      {displayData.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm p-8 text-center">
          <Layers className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No services found for this account</p>
        </div>
      ) : (
        <div className="grid gap-3" data-testid="table-service-list">
          {serviceGroups.map((group) => {
            const startIdx = globalSvcIdx;
            globalSvcIdx += group.services.length;
            const colors = getSvcColor(group.name);
            const isGroupExpanded = expandedGroups.has(group.name);
            const allActive = group.activeCount === group.totalCount;
            const noneActive = group.activeCount === 0;
            const uniqueTariffs = [...new Set(group.services.map((s: any) => s.tariff || s.tariffDesc || s.tariffDescription || '').filter(Boolean))];
            const uniqueMeters = group.services.filter((s: any) => {
              const m = s.physicalMeterNo || s.physicalMeterNumber || s.meterNo || s.meterNumber || '';
              return m && m !== 'No Meter' && m !== '0' && m !== '-';
            }).length;

            return (
              <div key={group.name} className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden hover:shadow-md transition-shadow" data-testid={`row-service-group-${group.name.toLowerCase().replace(/\s+/g, '-')}`}>
                <div
                  className={`px-4 py-3 bg-gradient-to-r ${colors.bg} flex items-center gap-3 cursor-pointer active:opacity-90 transition-opacity`}
                  onClick={() => group.totalCount > 1 ? toggleGroup(group.name) : setSelectedService(group.services[0])}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                    {getSvcIcon(group.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{group.name}</div>
                    <div className="text-[10px] text-white/70 mt-0.5">
                      {group.totalCount} {group.totalCount === 1 ? 'entry' : 'entries'}
                      {uniqueMeters > 0 && ` · ${uniqueMeters} metered`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${allActive ? 'bg-white/25 text-white' : noneActive ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${allActive ? 'bg-white' : noneActive ? 'bg-red-400' : 'bg-yellow-400'}`} />
                      {allActive ? 'Active' : noneActive ? 'Inactive' : `${group.activeCount}/${group.totalCount} Active`}
                    </span>
                    {group.totalCount > 1 && (
                      <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-white">
                        {isGroupExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    )}
                  </div>
                </div>

                {group.totalCount === 1 ? (
                  <div className="px-3 sm:px-4 py-2.5 sm:py-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                      <div><div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Tariff</div><div className="text-[12px] text-slate-700 mt-0.5 leading-snug">{group.services[0].tariff || group.services[0].tariffDesc || '-'}</div></div>
                      <div><div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Meter</div><div className="text-[12px] text-slate-700 font-mono mt-0.5">{group.services[0].physicalMeterNo || group.services[0].physicalMeterNumber || group.services[0].meterNo || group.services[0].meterNumber || 'No Meter'}</div></div>
                      <div><div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Frequency</div><div className="text-[12px] text-slate-700 mt-0.5">{group.services[0].frequency || '-'}</div></div>
                      <div><div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Factor / Qty</div><div className="text-[12px] text-slate-700 font-mono mt-0.5">{group.services[0].factorQuantity ?? group.services[0].tarifffactor ?? '-'}</div></div>
                    </div>
                    {(() => { const ti = parseTariffRateData(group.services[0]); return ti.blocks.length > 0 ? (
                      <div className="mt-3 pt-3 border-t border-[#E5E5E5]">
                        <button onClick={(e) => { e.stopPropagation(); toggleRate(startIdx); }} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] mb-2" data-testid={`btn-tariff-rate-${startIdx}`}>
                          {expandedRates.has(startIdx) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          Tariff Rates ({ti.blocks.reduce((sum, b) => sum + b.intervals.length, 0)} entries)
                        </button>
                        {expandedRates.has(startIdx) && ti.blocks.map((block, bi) => (
                          <div key={bi} className="rounded-lg border border-[#D6D6D6] overflow-hidden mb-1.5">
                            {(block.startDate || block.endDate) && <div className="px-3 py-1.5 bg-[#F7F7F7] border-b border-[#D6D6D6] text-[11px] text-slate-500 font-medium">Period: {block.startDate || '—'} to {block.endDate || '—'}</div>}
                            <table className="w-full text-[12px]"><tbody>
                              {block.intervals.map((iv, idx) => (
                                <tr key={idx} className="border-t border-[#E5E5E5] first:border-t-0 hover:bg-[var(--pos-accent-tint)]/30"><td className="py-1.5 px-3 text-slate-700">{iv.interval}</td><td className="py-1.5 px-3 text-right font-mono font-semibold text-[var(--pos-accent)]">{iv.cost}</td></tr>
                              ))}
                            </tbody></table>
                          </div>
                        ))}
                        {!expandedRates.has(startIdx) && (
                          <div className="flex flex-wrap gap-2">
                            {ti.blocks.slice(0, 1).flatMap(b => b.intervals.slice(0, 4)).map((iv, idx) => (
                              <div key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--pos-accent-tint)] border border-[#D6D6D6] text-[11px]">
                                <span className="text-slate-600">{iv.interval}:</span>
                                <span className="font-mono font-semibold text-[var(--pos-accent)]">R {iv.cost}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null; })()}
                  </div>
                ) : (
                  <>
                    <div className="px-3 sm:px-4 py-2 border-b border-[#E5E5E5] bg-[#F7F7F7]/50">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {uniqueTariffs.length > 0 && <span className="truncate max-w-[300px]">Tariffs: {uniqueTariffs.join(', ')}</span>}
                        {uniqueMeters > 0 && <span className="font-mono">· {uniqueMeters} meter{uniqueMeters > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    {isGroupExpanded && (
                      <div className="px-3 sm:px-4 py-3 space-y-2">
                        {group.services.map((svc: any, subIdx: number) => renderServiceDetail(svc, startIdx + subIdx))}
                      </div>
                    )}
                    {!isGroupExpanded && (
                      <div className="px-3 sm:px-4 py-2 text-center">
                        <button onClick={() => toggleGroup(group.name)} className="text-[11px] text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] font-semibold inline-flex items-center gap-1" data-testid={`btn-expand-group-${group.name.toLowerCase().replace(/\s+/g, '-')}`}>
                          <ChevronDown className="w-3.5 h-3.5" />
                          Show {group.totalCount} {group.name} entries
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end text-[11px] text-slate-400">
        <span>{serviceGroups.length} service types · {displayData.length} total entries</span>
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
        <div className="w-4 h-3 bg-[var(--pos-accent)] rounded-sm" />
        <span className="text-xs text-slate-600 font-medium">Current Billing Amount</span>
      </div>
      <div className="flex-1 flex">
        <div className="flex flex-col justify-between pr-2 text-right" style={{ width: 60 }}>
          {yTicks.map((tick, i) => (
            <span key={i} className="text-[10px] text-slate-400 font-mono leading-none">{tick.toLocaleString('en-ZA')}</span>
          ))}
        </div>
        <div className="flex-1 border-l border-b border-[#D6D6D6] relative flex items-end justify-around px-1 sm:px-2 gap-0.5 sm:gap-1">
          {data.map((d, i) => {
            const height = maxVal > 0 ? (d.amount / maxVal) * 100 : 0;
            return (
              <div key={i} className="flex flex-col items-center flex-1" style={{ maxWidth: barWidth }}>
                <div className="w-full flex items-end justify-center" style={{ height: '100%', minHeight: 150 }}>
                  <div className="w-full bg-[var(--pos-accent)] rounded-t-sm transition-all hover:bg-[var(--pos-accent)] relative group" style={{ height: `${height}%`, minHeight: d.amount > 0 ? 4 : 0 }} data-testid={`bar-${i}`}>
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

  const monthOrder = ['july','august','september','october','november','december','january','february','march','april','may','june'];
  const sorted = [...readings].sort((a, b) => {
    const bmA = (a.billingmonth || a.billingMonth || '').toLowerCase().trim();
    const bmB = (b.billingmonth || b.billingMonth || '').toLowerCase().trim();
    const idxA = monthOrder.indexOf(bmA);
    const idxB = monthOrder.indexOf(bmB);
    return (idxA >= 0 ? idxA : 50) - (idxB >= 0 ? idxB : 50);
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
    return { bg: 'bg-[var(--pos-accent)]', label: 'Actual' };
  };

  const formatMonth = (item: any, short?: boolean) => {
    const month = item.billingmonth || item.billingMonth || '';
    const fy = item.financialYear || '';
    if (month && fy) {
      const years = fy.split('/');
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthIdx = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
      if (monthIdx >= 0) {
        const year = monthIdx >= 6 ? years[0] : years[1];
        if (short) return { mon: month.substring(0, 3), yr: year?.slice(-2) || '' };
        return `${month.substring(0, 3)}-${year}`;
      }
    }
    if (month.toLowerCase().includes('open period') || month.toLowerCase().includes('current')) {
      if (short) return { mon: 'Open', yr: '' };
      return 'Current';
    }
    if (short) return { mon: month.substring(0, 3) || '?', yr: '' };
    return month.substring(0, 3) || '?';
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-[var(--pos-accent)] rounded-sm" /><span className="text-slate-600">Actual</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-gray-400 rounded-sm" /><span className="text-slate-600">Levy Estimate</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-red-500 rounded-sm" /><span className="text-slate-600">Reversed</span></div>
      </div>
      <div className="flex">
        <div className="flex flex-col justify-between items-end pr-2 text-[10px] text-slate-400 font-mono" style={{ height: 200 }}>
          {[...yTicks].reverse().map((t, i) => <span key={i}>{t}</span>)}
        </div>
        <div className="flex-1 relative border-l border-b border-[#BFBFBF]" style={{ height: 200 }}>
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
          {recent.map((item, i) => {
            const label = formatMonth(item, true) as { mon: string; yr: string };
            return (
              <div key={i} className="flex-1 min-w-0 text-center">
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-600 block leading-tight">{label.mon}</span>
                {label.yr && <span className="text-[8px] sm:text-[9px] text-slate-400 block leading-tight">{label.yr}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface TariffTier {
  from: number;
  to: number;
  rate: number;
  label: string;
}

export function parseTariffTiers(blocks: TariffBlock[]): TariffTier[] {
  if (!blocks.length) return [];
  const latest = blocks[blocks.length - 1];
  const tiers: TariffTier[] = [];

  for (const iv of latest.intervals) {
    const rate = parseFloat(iv.cost);
    if (isNaN(rate)) continue;

    const rangeMatch = iv.interval.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
    if (rangeMatch) {
      tiers.push({ from: parseFloat(rangeMatch[1]), to: parseFloat(rangeMatch[2]), rate, label: iv.interval });
      continue;
    }

    const aboveMatch = iv.interval.match(/^(?:above|over|>)\s*([\d.]+)/i);
    if (aboveMatch) {
      tiers.push({ from: parseFloat(aboveMatch[1]), to: Infinity, rate, label: iv.interval });
      continue;
    }

    const upToMatch = iv.interval.match(/^(?:up\s*to|first|<=?)\s*([\d.]+)/i);
    if (upToMatch) {
      tiers.push({ from: 0, to: parseFloat(upToMatch[1]), rate, label: iv.interval });
      continue;
    }

    if (/^remainder$/i.test(iv.interval.trim()) || iv.interval.trim() === '0') {
      const lastTo = tiers.length > 0 ? tiers[tiers.length - 1].to : 0;
      tiers.push({ from: lastTo === Infinity ? 0 : lastTo, to: Infinity, rate, label: iv.interval });
      continue;
    }

    const singleNum = parseFloat(iv.interval);
    if (!isNaN(singleNum)) {
      const lastTo = tiers.length > 0 ? tiers[tiers.length - 1].to : 0;
      tiers.push({ from: lastTo === Infinity ? 0 : lastTo, to: singleNum > 0 ? singleNum : Infinity, rate, label: iv.interval });
    }
  }

  tiers.sort((a, b) => a.from - b.from);
  return tiers;
}

export const STANDARD_MONTH_DAYS = 30;

export function calculateTieredBilling(
  consumption: number,
  tiers: TariffTier[],
  factor: number = 1,
  readingDays?: number
): { tierBreakdown: { label: string; units: number; rate: number; amount: number; proRatedFrom?: number; proRatedTo?: number }[]; subtotal: number; isProRated: boolean } {
  if (!tiers.length || consumption <= 0) return { tierBreakdown: [], subtotal: 0, isProRated: false };

  const days = readingDays && readingDays > 0 ? readingDays : STANDARD_MONTH_DAYS;
  const dayRatio = days / STANDARD_MONTH_DAYS;
  const isProRated = days !== STANDARD_MONTH_DAYS;

  const breakdown: { label: string; units: number; rate: number; amount: number; proRatedFrom?: number; proRatedTo?: number }[] = [];
  let remaining = consumption;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const proFrom = tier.from * dayRatio;
    const proTo = tier.to === Infinity ? Infinity : tier.to * dayRatio;
    const tierCapacity = proTo === Infinity ? remaining : Math.max(0, proTo - proFrom);
    const unitsInTier = Math.min(remaining, tierCapacity);
    if (unitsInTier > 0) {
      const amount = unitsInTier * tier.rate * factor;
      breakdown.push({
        label: tier.label,
        units: unitsInTier,
        rate: tier.rate,
        amount,
        proRatedFrom: Math.round(proFrom * 100) / 100,
        proRatedTo: proTo === Infinity ? undefined : Math.round(proTo * 100) / 100,
      });
      remaining -= unitsInTier;
    }
  }

  const subtotal = breakdown.reduce((s, b) => s + b.amount, 0);
  return { tierBreakdown: breakdown, subtotal, isProRated };
}

const MONTH_OPTIONS = [3, 6, 9, 12, 15, 18, 21, 24] as const;
const SPIKE_THRESHOLD = 1.5;
const SPIKE_LOW_THRESHOLD = 0.4;

interface MeterReading {
  consumption: number;
  readingDays: number;
  dailyConsumption: number;
  billingMonth: string;
  financialYear: string;
  flag: string;
  readingStatus: string;
  reading1Date: string;
  reading2Date: string;
  reading1: string;
  reading2: string;
  isSpike: boolean;
  spikeType: 'high' | 'low' | 'none';
  spikePercent: number;
}

function MeterIntelligence({ allReadings }: { allReadings: any[] }) {
  const [selectedMonths, setSelectedMonths] = useState<number>(6);
  const [showDetails, setShowDetails] = useState(true);

  const parseDate = useCallback((d: string) => {
    if (!d) return 0;
    const parts = d.split('/');
    if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    return new Date(d).getTime();
  }, []);

  const finYearMonthOrder = useCallback((bm: string, fy: string): number => {
    const monthNames = ['july','august','september','october','november','december','january','february','march','april','may','june'];
    const mIdx = monthNames.indexOf(bm.toLowerCase().trim());
    const yearStart = parseInt((fy || '').split('/')[0]) || 2020;
    return yearStart * 100 + (mIdx >= 0 ? mIdx : 50);
  }, []);

  const processedReadings = useMemo(() => {
    const processed: MeterReading[] = [];
    for (const r of allReadings) {
      const cons = parseFloat(r.consumption ?? r.consumptionValue ?? r.units ?? 0) || 0;
      const rdRaw = r.readingdays;
      const rdNum = typeof rdRaw === 'number' ? rdRaw : (rdRaw ? parseInt(rdRaw) : NaN);
      const hasValidDays = !isNaN(rdNum) && rdNum > 0;
      const readingDays = hasValidDays ? rdNum : 0;
      const dailyConsumption = hasValidDays && rdNum > 0 ? cons / rdNum : 0;

      processed.push({
        consumption: cons,
        readingDays,
        dailyConsumption,
        billingMonth: r.billingmonth || r.billingMonth || '',
        financialYear: r.financialYear || r.finYear || '',
        flag: r.flag || '',
        readingStatus: r.readingStatus || '',
        reading1Date: r.reading1Date || '',
        reading2Date: r.reading2Date || '',
        reading1: r.reading1 ?? '',
        reading2: r.reading2 ?? '',
        isSpike: false,
        spikeType: 'none',
        spikePercent: 0,
      });
    }

    processed.sort((a, b) => {
      const oa = finYearMonthOrder(a.billingMonth, a.financialYear);
      const ob = finYearMonthOrder(b.billingMonth, b.financialYear);
      if (ob !== oa) return ob - oa;
      return parseDate(b.reading1Date || b.reading2Date) - parseDate(a.reading1Date || a.reading2Date);
    });

    return processed;
  }, [allReadings, parseDate, finYearMonthOrder]);

  const billedReadings = useMemo(() => {
    return processedReadings.filter(r => {
      const bm = r.billingMonth.toLowerCase().trim();
      const rs = r.readingStatus.toLowerCase();
      const flag = r.flag.toLowerCase();
      if (flag.includes('reversed') || flag.includes('cancel')) return false;
      if (bm === 'current open period' || bm.includes('open period')) return false;
      if (rs.includes('awaiting') || rs.includes('unbilled') || rs.includes('pending')) return false;
      if (flag.includes('awaiting') || flag.includes('unbilled')) return false;
      if (flag.includes('estimate') || flag.includes('levy')) return false;
      if (r.readingDays <= 0) return false;
      return r.consumption > 0;
    });
  }, [processedReadings]);

  const analysis = useMemo(() => {
    const selectedBilled = billedReadings.slice(0, selectedMonths);
    if (selectedBilled.length < 2) return null;

    const totalDailyConsumption = selectedBilled.reduce((s, r) => s + r.dailyConsumption, 0);
    const avgDailyConsumption = totalDailyConsumption / selectedBilled.length;

    const totalConsumption = selectedBilled.reduce((s, r) => s + r.consumption, 0);
    const totalDays = selectedBilled.reduce((s, r) => s + r.readingDays, 0);
    const weightedAvgDaily = totalDays > 0 ? totalConsumption / totalDays : 0;

    const avgMonthlyConsumption = weightedAvgDaily * STANDARD_MONTH_DAYS;

    const dailyValues = selectedBilled.map(r => r.dailyConsumption);
    const minDaily = Math.min(...dailyValues);
    const maxDaily = Math.max(...dailyValues);
    const variance = dailyValues.reduce((s, v) => s + Math.pow(v - weightedAvgDaily, 2), 0) / dailyValues.length;
    const stdDev = Math.sqrt(variance);

    const allWithSpikes: MeterReading[] = processedReadings.map(r => {
      if (r.consumption <= 0 || weightedAvgDaily <= 0 || r.readingDays <= 0) return { ...r, isSpike: false, spikeType: 'none' as const, spikePercent: 0 };
      const ratio = r.dailyConsumption / weightedAvgDaily;
      const isHigh = ratio >= SPIKE_THRESHOLD;
      const isLow = ratio <= SPIKE_LOW_THRESHOLD && r.dailyConsumption > 0;
      const pctDeviation = ((r.dailyConsumption - weightedAvgDaily) / weightedAvgDaily) * 100;
      return {
        ...r,
        isSpike: isHigh || isLow,
        spikeType: isHigh ? 'high' as const : isLow ? 'low' as const : 'none' as const,
        spikePercent: pctDeviation,
      };
    });

    const spikeCount = allWithSpikes.filter(r => r.isSpike).length;

    return {
      avgDailyConsumption: weightedAvgDaily,
      avgMonthlyConsumption,
      minDaily,
      maxDaily,
      stdDev,
      periodMonths: selectedBilled.length,
      totalConsumption,
      totalDays,
      allWithSpikes,
      spikeCount,
    };
  }, [billedReadings, selectedMonths, processedReadings]);

  if (processedReadings.length < 3) return null;

  const fmt = (v: number) => v.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt1 = (v: number) => v.toLocaleString('en-ZA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden" data-testid="meter-intelligence">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Meter Intelligence</h3>
          {analysis && analysis.spikeCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full border border-red-200">
              <AlertTriangle className="w-3 h-3" />
              {analysis.spikeCount} spike{analysis.spikeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded-md transition-colors border border-white/20"
          data-testid="btn-toggle-intelligence"
        >
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showDetails ? 'Hide' : 'Show'}
        </button>
      </div>

      {showDetails && (
        <div className="p-3 sm:p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Averaging Period:</label>
            <div className="flex flex-wrap gap-1">
              {MONTH_OPTIONS.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMonths(m)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-all ${
                    selectedMonths === m
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-slate-600 border-[#D6D6D6] hover:bg-amber-50 hover:border-amber-300'
                  }`}
                  data-testid={`btn-months-${m}`}
                >
                  {m}m
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-400 ml-auto">From last billed period</span>
          </div>

          {!analysis && (
            <div className="bg-[#F7F7F7] border border-[#D6D6D6] rounded-lg p-3 text-xs text-slate-500 text-center">
              Not enough billed readings to calculate averages (minimum 2 required)
            </div>
          )}

          {analysis && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-gradient-to-br from-[var(--pos-accent-tint)] to-[#F7F7F7] rounded-lg px-3 py-2.5 border border-[#D6D6D6]">
                  <div className="text-[9px] text-[var(--pos-accent)] uppercase tracking-wider font-bold">Avg Daily</div>
                  <div className="text-sm sm:text-base font-mono font-black text-[#2E2E2E] mt-0.5">{fmt(analysis.avgDailyConsumption)}</div>
                  <div className="text-[9px] text-[var(--pos-accent-light)]">units/day</div>
                </div>
                <div className="bg-gradient-to-br from-[var(--pos-accent-tint)] to-[#F7F7F7] rounded-lg px-3 py-2.5 border border-[#D6D6D6]">
                  <div className="text-[9px] text-[var(--pos-accent)] uppercase tracking-wider font-bold">Avg Monthly</div>
                  <div className="text-sm sm:text-base font-mono font-black text-[#2E2E2E] mt-0.5">{fmt(analysis.avgMonthlyConsumption)}</div>
                  <div className="text-[9px] text-[var(--pos-accent)]">units/{STANDARD_MONTH_DAYS}d</div>
                </div>
                <div className="bg-gradient-to-br from-[var(--pos-accent-tint)] to-[#F7F7F7] rounded-lg px-3 py-2.5 border border-[#D6D6D6]">
                  <div className="text-[9px] text-[var(--pos-accent)] uppercase tracking-wider font-bold">Range (Daily)</div>
                  <div className="text-xs font-mono font-bold text-[#2E2E2E] mt-0.5">{fmt(analysis.minDaily)} – {fmt(analysis.maxDaily)}</div>
                  <div className="text-[9px] text-[var(--pos-accent-light)]">min – max</div>
                </div>
                <div className="bg-gradient-to-br from-[var(--pos-accent-tint)] to-[var(--pos-accent-tint)]/60 rounded-lg px-3 py-2.5 border border-[var(--pos-accent-light)]">
                  <div className="text-[9px] text-[var(--pos-accent-dark)] uppercase tracking-wider font-bold">Period Data</div>
                  <div className="text-xs font-mono font-bold text-[var(--pos-accent)] mt-0.5">{analysis.periodMonths} months</div>
                  <div className="text-[9px] text-[var(--pos-accent-light)]">{fmt(analysis.totalConsumption)} total units</div>
                </div>
              </div>

              <div className="bg-[#F7F7F7] border border-[#D6D6D6] rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Daily Consumption Trend</span>
                  <div className="ml-auto flex items-center gap-3 text-[9px]">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--pos-accent)] inline-block" /> Normal</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> High Spike</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Low Spike</span>
                  </div>
                </div>
                <div className="flex items-end gap-[2px] sm:gap-1" style={{ height: 120 }}>
                  {(() => {
                    const monthNames = ['july','august','september','october','november','december','january','february','march','april','may','june'];
                    const display = [...(analysis.allWithSpikes)].filter(r => r.consumption > 0).sort((a, b) => {
                      const fyA = parseInt((a.financialYear || '').split('/')[0]) || 0;
                      const fyB = parseInt((b.financialYear || '').split('/')[0]) || 0;
                      if (fyA !== fyB) return fyA - fyB;
                      const idxA = monthNames.indexOf((a.billingMonth || '').toLowerCase().trim());
                      const idxB = monthNames.indexOf((b.billingMonth || '').toLowerCase().trim());
                      return (idxA >= 0 ? idxA : 50) - (idxB >= 0 ? idxB : 50);
                    }).slice(-Math.min(selectedMonths + 4, 30));
                    const maxD = Math.max(...display.map(r => r.dailyConsumption), analysis.avgDailyConsumption * 1.5);
                    return display.map((r, i) => {
                      const pct = maxD > 0 ? (r.dailyConsumption / maxD) * 100 : 0;
                      const barColor = r.spikeType === 'high' ? 'bg-red-500' : r.spikeType === 'low' ? 'bg-amber-500' : 'bg-[var(--pos-accent)]';
                      const bm = r.billingMonth || '';
                      const label = bm === 'Current Open Period' ? 'CUR' : bm.substring(0, 3);
                      const isOpen = bm.toLowerCase().includes('open period') || r.readingStatus.toLowerCase().includes('awaiting');
                      return (
                        <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group relative">
                          <div className={`w-full max-w-[28px] ${barColor} ${isOpen ? 'opacity-60 border-2 border-dashed border-white' : ''} rounded-t-sm transition-all cursor-pointer`}
                            style={{ height: `${Math.max(pct, 2)}%` }}
                            title={`${bm} ${r.financialYear}: ${fmt(r.dailyConsumption)} units/day (${r.consumption} units / ${r.readingDays} days)${r.isSpike ? ` — ${r.spikeType.toUpperCase()} SPIKE (${r.spikePercent > 0 ? '+' : ''}${fmt1(r.spikePercent)}%)` : ''}`}
                          />
                          {r.isSpike && (
                            <AlertTriangle className={`w-3 h-3 absolute -top-4 ${r.spikeType === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                          )}
                          <span className="text-[7px] sm:text-[8px] text-slate-400 mt-0.5 truncate w-full text-center">{label}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="relative mt-1">
                  <div className="border-t border-dashed border-amber-400" style={{ position: 'relative' }}>
                    <span className="absolute right-0 -top-3 text-[8px] text-amber-600 font-mono bg-white px-1">avg: {fmt(analysis.avgDailyConsumption)}/day</span>
                  </div>
                </div>
              </div>

              {analysis.spikeCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] uppercase tracking-wider text-red-600 font-bold">Spike Detection</span>
                    <span className="text-[10px] text-slate-400 ml-1">(≥{SPIKE_THRESHOLD * 100}% above or ≤{SPIKE_LOW_THRESHOLD * 100}% of avg daily)</span>
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {analysis.allWithSpikes.filter(r => r.isSpike).map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] ${
                        r.spikeType === 'high'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}>
                        {r.spikeType === 'high' ? (
                          <TrendingUp className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-800">{r.billingMonth} {r.financialYear}</span>
                        <span className="font-mono text-slate-600">{fmt(r.dailyConsumption)} /day</span>
                        <span className="font-mono text-slate-500">({r.consumption} units / {r.readingDays} days)</span>
                        <span className={`ml-auto font-mono font-bold ${r.spikeType === 'high' ? 'text-red-600' : 'text-amber-600'}`}>
                          {r.spikePercent > 0 ? '+' : ''}{fmt1(r.spikePercent)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.spikeCount === 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-[11px] text-green-700">
                  <Info className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span>No consumption spikes detected. All readings are within normal range based on {analysis.periodMonths}-month history.</span>
                </div>
              )}

              <div className="text-[9px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Daily consumption = total units ÷ reading days. Weighted average calculated across {analysis.totalDays} total reading days. Spike thresholds: high ≥{SPIKE_THRESHOLD * 100}% of avg, low ≤{SPIKE_LOW_THRESHOLD * 100}% of avg.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BillingEstimator({ readingHistory, selectedMeter, allReadings }: { readingHistory: any[]; selectedMeter: any; allReadings: any[] }) {
  const [vatRate, setVatRate] = useState(15);
  const [showDetails, setShowDetails] = useState(true);

  const tariffInfo = useMemo(() => {
    if (!selectedMeter) return { blocks: [] as TariffBlock[], tiers: [] as TariffTier[] };
    const parsed = parseTariffRateData(selectedMeter);
    const tiers = parseTariffTiers(parsed.blocks);
    return { blocks: parsed.blocks, tiers };
  }, [selectedMeter]);

  const isReadingEstimate = useCallback((item: any) => {
    const flag = (item.flag || '').toLowerCase();
    const rs = (item.readingStatus || '').toLowerCase();
    return flag.includes('estimate') || flag.includes('levy') || rs.includes('estimate');
  }, []);

  const unbilledReadings = useMemo(() => {
    return allReadings.filter(item => {
      const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
      const rs = (item.readingStatus || '').toLowerCase();
      const flag = (item.flag || '').toLowerCase();

      if (flag.includes('reversed') || flag.includes('cancel')) return false;
      if (isReadingEstimate(item)) return false;

      if (bm === 'current open period' || bm.includes('open period')) return true;
      if (rs.includes('awaiting') || rs.includes('unbilled') || rs.includes('pending')) return true;
      if (flag.includes('awaiting') || flag.includes('unbilled')) return true;

      return false;
    });
  }, [allReadings, isReadingEstimate]);

  const previouslyBilledEstimates = useMemo(() => {
    return allReadings.filter(item => {
      const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
      const flag = (item.flag || '').toLowerCase();
      if (bm === 'current open period' || bm.includes('open period')) return false;
      if (flag.includes('reversed') || flag.includes('cancel')) return false;
      if (!isReadingEstimate(item)) return false;
      const c = item.consumption ?? item.consumptionValue ?? item.units ?? 0;
      const consNum = typeof c === 'number' ? c : parseFloat(c) || 0;
      return consNum > 0;
    });
  }, [allReadings, isReadingEstimate]);

  const estimateData = useMemo(() => {
    if (!unbilledReadings.length || !tariffInfo.tiers.length) return null;

    const factor = selectedMeter?.tarifffactor ?? selectedMeter?.factorQuantity ?? 1;
    const factorNum = typeof factor === 'number' ? factor : parseFloat(factor) || 1;

    const results = unbilledReadings.map(reading => {
      const consumption = reading.consumption ?? reading.consumptionValue ?? reading.units ?? 0;
      const consNum = typeof consumption === 'number' ? consumption : parseFloat(consumption) || 0;

      if (consNum <= 0) return null;

      const rdRaw = reading.readingdays;
      const rdNum = typeof rdRaw === 'number' ? rdRaw : (rdRaw ? parseInt(rdRaw) : NaN);
      const readingDaysNum = isNaN(rdNum) || rdNum <= 0 ? undefined : rdNum;

      const { tierBreakdown, subtotal, isProRated } = calculateTieredBilling(consNum, tariffInfo.tiers, factorNum, readingDaysNum);
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount;

      const dailyConsumption = readingDaysNum ? (consNum / readingDaysNum) : undefined;

      return {
        consumption: consNum,
        billingMonth: reading.billingmonth || reading.billingMonth || 'Current',
        readingDate: reading.reading2Date || reading.reading1Date || '',
        newReading: reading.reading2 ?? '-',
        oldReading: reading.reading1 ?? '-',
        readingDays: readingDaysNum ?? '-',
        dailyConsumption,
        isProRated,
        tierBreakdown,
        subtotal,
        vatAmount,
        total,
        factor: factorNum,
      };
    }).filter(Boolean);

    return results.length > 0 ? results : null;
  }, [unbilledReadings, tariffInfo.tiers, selectedMeter, vatRate]);

  const historicalAvg = useMemo(() => {
    const billed = allReadings.filter(item => {
      const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
      const flag = (item.flag || '').toLowerCase();
      if (bm === 'current open period' || bm.includes('open period')) return false;
      if (flag.includes('reversed') || flag.includes('cancel')) return false;
      const c = item.consumption ?? item.consumptionValue ?? item.units ?? 0;
      return typeof c === 'number' ? c > 0 : parseFloat(c) > 0;
    });

    if (billed.length < 2) return null;

    const recent = billed.slice(0, 6);
    const total = recent.reduce((s, r) => {
      const c = r.consumption ?? r.consumptionValue ?? r.units ?? 0;
      return s + (typeof c === 'number' ? c : parseFloat(c) || 0);
    }, 0);

    return { avg: total / recent.length, months: recent.length };
  }, [allReadings]);

  if (!tariffInfo.tiers.length) return null;
  if (!estimateData && !historicalAvg) return null;

  const fmt = (v: number) => v.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden" data-testid="billing-estimator">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Billing Estimation Calculator</h3>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded-md transition-colors border border-white/20"
        >
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showDetails ? 'Hide' : 'Show'}
        </button>
      </div>

      {showDetails && (
        <div className="p-3 sm:p-4 space-y-4">
          {!estimateData && historicalAvg && (
            <div className="bg-[var(--pos-accent-tint)] border border-[#D6D6D6] rounded-lg p-3">
              <p className="text-xs text-[#2E2E2E]">
                No unbilled readings found. Based on the last {historicalAvg.months} billing periods, 
                the average consumption is <span className="font-bold font-mono">{fmt(historicalAvg.avg)}</span> units per month.
              </p>
              <div className="mt-2">
                <p className="text-[10px] text-[var(--pos-accent)] uppercase tracking-wider font-semibold mb-1">Projected next bill (at average consumption)</p>
                {(() => {
                  const factor = selectedMeter?.tarifffactor ?? selectedMeter?.factorQuantity ?? 1;
                  const factorNum = typeof factor === 'number' ? factor : parseFloat(factor) || 1;
                  const { tierBreakdown, subtotal } = calculateTieredBilling(historicalAvg.avg, tariffInfo.tiers, factorNum);
                  const vatAmount = subtotal * (vatRate / 100);
                  const total = subtotal + vatAmount;
                  return (
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div className="bg-white rounded-md px-2 py-1.5 border border-[#D6D6D6] text-center">
                        <div className="text-[9px] text-slate-500 uppercase">Subtotal</div>
                        <div className="text-xs font-mono font-bold text-slate-800">R {fmt(subtotal)}</div>
                      </div>
                      <div className="bg-white rounded-md px-2 py-1.5 border border-[#D6D6D6] text-center">
                        <div className="text-[9px] text-slate-500 uppercase">VAT ({vatRate}%)</div>
                        <div className="text-xs font-mono font-bold text-slate-800">R {fmt(vatAmount)}</div>
                      </div>
                      <div className="bg-[#F7F7F7] rounded-md px-2 py-1.5 border border-[#D6D6D6] text-center">
                        <div className="text-[9px] text-[var(--pos-accent)] uppercase font-bold">Est. Total</div>
                        <div className="text-sm font-mono font-black text-[var(--pos-accent)]">R {fmt(total)}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {estimateData && estimateData.map((est: any, idx: number) => (
            <div key={idx} className="space-y-3">
              <div className="bg-gradient-to-r from-[#F7F7F7] to-[#F7F7F7] border border-[#D6D6D6] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#2E2E2E]">
                    {est.billingMonth}
                    <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 border border-green-200">Actual Reading</span>
                  </span>
                  <span className="text-[10px] text-slate-500">{est.readingDate}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                  <div className="bg-white rounded px-2 py-1 border border-[#D6D6D6]">
                    <span className="text-slate-500 block text-[9px] uppercase">Old Reading</span>
                    <span className="font-mono font-semibold">{est.oldReading}</span>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-[#D6D6D6]">
                    <span className="text-slate-500 block text-[9px] uppercase">New Reading</span>
                    <span className="font-mono font-semibold">{est.newReading}</span>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-[#D6D6D6]">
                    <span className="text-slate-500 block text-[9px] uppercase">Total Units</span>
                    <span className="font-mono font-bold text-[var(--pos-accent)]">{est.consumption}</span>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-[#D6D6D6]">
                    <span className="text-slate-500 block text-[9px] uppercase">Reading Days</span>
                    <span className="font-mono font-semibold">{est.readingDays}</span>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-[#D6D6D6]">
                    <span className="text-slate-500 block text-[9px] uppercase">Daily Avg</span>
                    <span className="font-mono font-semibold text-[var(--pos-accent-dark)]">{est.dailyConsumption ? fmt(est.dailyConsumption) : '-'} /day</span>
                  </div>
                </div>
                {est.isProRated && typeof est.readingDays === 'number' && (
                  <div className="mt-2 px-2 py-1 bg-[var(--pos-accent-tint)] border border-[#D6D6D6] rounded text-[10px] text-[var(--pos-accent)]">
                    Tariff tiers pro-rated for <span className="font-bold">{est.readingDays}</span> days (standard: {STANDARD_MONTH_DAYS} days). Tier boundaries adjusted proportionally.
                  </div>
                )}
              </div>

              {est.tierBreakdown.length > 0 && (
                <div className="border border-[#D6D6D6] rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-[#F7F7F7] border-b border-[#D6D6D6] flex items-center justify-between flex-wrap gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Per-Day Tariff Tier Calculation</span>
                    <span className="text-[10px] text-slate-400">
                      {est.factor !== 1 && <span className="text-[var(--pos-accent)] font-medium mr-2">Factor: {est.factor}</span>}
                      {est.isProRated && typeof est.readingDays === 'number' && <span>{est.readingDays} days / {STANDARD_MONTH_DAYS} std days</span>}
                    </span>
                  </div>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[#F7F7F7]/50">
                        <th className="text-left py-1.5 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tier (Std 30d)</th>
                        {est.isProRated && <th className="text-left py-1.5 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Pro-Rated</th>}
                        <th className="text-right py-1.5 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Units Used</th>
                        <th className="text-right py-1.5 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Rate (R)</th>
                        <th className="text-right py-1.5 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Amount (R)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {est.tierBreakdown.map((tier: any, ti: number) => (
                        <tr key={ti} className="border-t border-[#E5E5E5]">
                          <td className="py-1.5 px-3 text-slate-700">{tier.label}</td>
                          {est.isProRated && (
                            <td className="py-1.5 px-3 text-slate-500 text-[10px] font-mono">
                              {tier.proRatedFrom != null ? `${fmt(tier.proRatedFrom)} – ${tier.proRatedTo != null ? fmt(tier.proRatedTo) : '∞'}` : '-'}
                            </td>
                          )}
                          <td className="py-1.5 px-3 text-right font-mono text-slate-700">{fmt(tier.units)}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-[var(--pos-accent)]">{tier.rate.toFixed(6)}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-800">{fmt(tier.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#F7F7F7] rounded-lg px-3 py-2 border border-[#D6D6D6] text-center">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Subtotal</div>
                  <div className="text-sm font-mono font-bold text-slate-800 mt-0.5">R {fmt(est.subtotal)}</div>
                </div>
                <div className="bg-[#F7F7F7] rounded-lg px-3 py-2 border border-[#D6D6D6] text-center">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">VAT ({vatRate}%)</div>
                  <div className="text-sm font-mono font-bold text-slate-800 mt-0.5">R {fmt(est.vatAmount)}</div>
                </div>
                <div className="bg-gradient-to-r from-[#F7F7F7] to-[#F7F7F7] rounded-lg px-3 py-2 border border-[#D6D6D6] text-center">
                  <div className="text-[9px] text-[var(--pos-accent)] uppercase tracking-wider font-bold">Estimated Total</div>
                  <div className="text-base font-mono font-black text-[var(--pos-accent)] mt-0.5">R {fmt(est.total)}</div>
                </div>
              </div>
            </div>
          ))}

          {previouslyBilledEstimates.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <p className="text-[11px] text-amber-800">
                <span className="font-bold">Note:</span> There {previouslyBilledEstimates.length === 1 ? 'is' : 'are'}{' '}
                <span className="font-mono font-bold">{previouslyBilledEstimates.length}</span> previously billed levy estimate{previouslyBilledEstimates.length !== 1 ? 's' : ''} that {previouslyBilledEstimates.length === 1 ? 'has' : 'have'} not been reversed.
                Estimated billing below is based on actual unbilled readings only. Previously estimated amounts may be adjusted when actual readings are processed.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {previouslyBilledEstimates.slice(0, 3).map((est: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-[10px] font-medium text-amber-800">
                    {est.billingmonth || est.billingMonth || '?'}: {est.consumption ?? est.consumptionValue ?? '?'} units
                  </span>
                ))}
                {previouslyBilledEstimates.length > 3 && (
                  <span className="text-[10px] text-amber-600 self-center">+{previouslyBilledEstimates.length - 3} more</span>
                )}
              </div>
            </div>
          )}

          {historicalAvg && estimateData && (
            <div className="bg-[#F7F7F7] border border-[#D6D6D6] rounded-lg p-3 mt-2">
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold">Historical comparison:</span> Average consumption over last {historicalAvg.months} months was <span className="font-mono font-bold text-[var(--pos-accent)]">{fmt(historicalAvg.avg)}</span> units/month.
                {estimateData[0] && (
                  <>
                    {' '}Current unbilled consumption of <span className="font-mono font-bold">{estimateData[0].consumption}</span> is{' '}
                    {estimateData[0].consumption > historicalAvg.avg
                      ? <span className="text-red-600 font-semibold">{fmt(((estimateData[0].consumption - historicalAvg.avg) / historicalAvg.avg) * 100)}% above</span>
                      : <span className="text-green-600 font-semibold">{fmt(((historicalAvg.avg - estimateData[0].consumption) / historicalAvg.avg) * 100)}% below</span>
                    } average.
                  </>
                )}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-[#E5E5E5]">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">VAT Rate:</label>
            <select
              value={vatRate}
              onChange={e => setVatRate(Number(e.target.value))}
              className="text-xs border border-[#D6D6D6] rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--pos-accent)]"
              data-testid="select-vat-rate"
            >
              <option value={0}>0% (Exempt)</option>
              <option value={15}>15% (Standard)</option>
            </select>
            <span className="text-[10px] text-amber-600 ml-auto">* Estimates only — actual billing may differ</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConsumptionTab({ accountId, accountNumber }: { accountId: number; accountNumber?: string }) {
  const [meters, setMeters] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
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
      const [meterResult, svcResult] = await Promise.allSettled([
        getMeteredServicesOnAccount(accountId),
        getAllServices(accountId),
      ]);
      setMeters(meterResult.status === 'fulfilled' ? meterResult.value || [] : []);
      setServices(svcResult.status === 'fulfilled' ? svcResult.value || [] : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load consumption data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const loadHistory = useCallback(async (meter: any) => {
    setSelectedMeter(meter);
    setHistoryLoading(true);
    try {
      const meterNo = (meter.meterNo || meter.meterNumber || meter.physicalMeterNo || meter.physicalMeterNumber || '').replace(/^0+/, '');
      const history = await getMeterReadingHistory(accountId, meterNo);
      const arr = Array.isArray(history) ? history : [];
      const fixed = arr.map((item: any) => {
        const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
        if (bm.includes('open period') || bm.includes('current')) {
          const rs = (item.readingStatus || '').toLowerCase();
          if (rs === 'billed' || rs === 'imported' || rs === 'import') {
            const rd = item.reading2Date || item.reading1Date || '';
            let correctMonth = '';
            if (rd) {
              const parts = rd.split('/');
              if (parts.length === 3) {
                const mi = parseInt(parts[1]) - 1;
                const mn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                if (mi >= 0 && mi < 12) correctMonth = mn[mi];
              }
            }
            if (correctMonth) {
              return { ...item, billingmonth: correctMonth, billingMonth: correctMonth, _openPeriodCorrected: true };
            }
            return item;
          }
          return { ...item, _isUnreadOpenPeriod: true, readingStatus: item.readingStatus || 'Awaiting Billing' };
        }
        return item;
      });
      const filtered = fixed.filter((item: any) => !item._isUnreadOpenPeriod);
      setReadingHistory(filtered);
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

  const billingMonthOrder = useCallback((bm: string): number => {
    const monthNames = ['july','august','september','october','november','december','january','february','march','april','may','june'];
    const idx = monthNames.indexOf(bm.toLowerCase().trim());
    return idx >= 0 ? idx : 50;
  }, []);

  const isAwaitingBilling = useCallback((item: any): boolean => {
    const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
    const rs = (item.readingStatus || '').toLowerCase();
    const flag = (item.flag || '').toLowerCase();
    return bm.includes('open period') || rs.includes('awaiting') || rs.includes('unbilled') || rs.includes('pending') || flag.includes('awaiting') || flag.includes('unbilled');
  }, []);

  const filteredHistory = useMemo(() => {
    const seenKeys = new Set<string>();
    const deduped = [...readingHistory].filter(item => {
      const bm = (item.billingmonth || item.billingMonth || '').trim();
      const fy = getRecordFinYear(item);
      const key = `${fy}__${bm.toLowerCase()}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    const yearFiltered = deduped.filter(item => {
      const fy = getRecordFinYear(item);
      return fy === selectedFinYear;
    });

    yearFiltered.sort((a, b) => {
      const aAwaiting = isAwaitingBilling(a);
      const bAwaiting = isAwaitingBilling(b);
      if (aAwaiting && !bAwaiting) return -1;
      if (!aAwaiting && bAwaiting) return 1;

      const bmA = (a.billingmonth || a.billingMonth || '').trim();
      const bmB = (b.billingmonth || b.billingMonth || '').trim();
      const orderA = billingMonthOrder(bmA);
      const orderB = billingMonthOrder(bmB);
      return orderB - orderA;
    });

    return yearFiltered;
  }, [readingHistory, selectedFinYear, getRecordFinYear, billingMonthOrder, isAwaitingBilling]);

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

  const matchedServiceForMeter = useMemo(() => {
    if (!selectedMeter || !services.length) return selectedMeter;
    const meterSvcDesc = (selectedMeter.serviceDesc || selectedMeter.serviceDescription || '').toLowerCase();
    const meterTariff = (selectedMeter.tariff || '').toLowerCase();
    const matched = services.find((svc: any) => {
      const svcType = getServiceTypeDesc(svc).toLowerCase();
      const svcTariff = (svc.tariff || '').toLowerCase();
      if (meterSvcDesc && svcType && meterSvcDesc.includes(svcType.split(' ')[0])) return true;
      if (meterTariff && svcTariff && meterTariff === svcTariff) return true;
      return false;
    });
    if (matched) {
      return { ...selectedMeter, costInterVal: matched.costInterVal, endDate: matched.endDate, startDate: matched.startDate };
    }
    return selectedMeter;
  }, [selectedMeter, services]);

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
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
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
                className={`border rounded-lg p-3 space-y-2 cursor-pointer active:scale-[0.99] transition-all ${isSelected ? 'border-[var(--pos-accent)] bg-[var(--pos-accent-tint)] shadow-sm' : 'border-[#D6D6D6] bg-white'}`}
                data-testid={`row-meter-${i}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">{meter.serviceDesc || meter.serviceDescription || '-'}</span>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${isSelected ? 'border-[var(--pos-accent)] bg-[var(--pos-accent)]' : 'border-[#BFBFBF]'}`}>
                    {isSelected && <div className="w-full h-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter No</span><span className="font-mono font-semibold text-[var(--pos-accent)]">{meter.meterNo || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Physical</span><span className="font-mono text-slate-700">{meter.physicalMeterNo || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700 truncate ml-1">{meter.tariff || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Classification</span><span className="text-slate-700">{meter.meterClassificationDesc || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Status</span><span className="text-slate-700">{meter.serviceStatus || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Factor</span><span className="font-mono text-slate-700">{meter.tarifffactor ?? '-'}</span></div>
                </div>
                <div className="text-center text-[10px] text-[var(--pos-accent)] font-semibold pt-1">Tap to view readings</div>
              </div>
            );
          })}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-consumption-meters">
            <thead>
              <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
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
                    className={`border-b border-[#E5E5E5] cursor-pointer transition-colors ${isSelected ? 'bg-[var(--pos-accent-tint)] ring-1 ring-[var(--pos-accent)]' : 'hover:bg-[#F7F7F7]'}`}
                    data-testid={`row-meter-${i}`}
                  >
                    <td className="py-2 px-2 text-center">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 ${isSelected ? 'border-[var(--pos-accent)] bg-[var(--pos-accent)]' : 'border-[#BFBFBF]'}`}>
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
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[#F7F7F7] border-b border-[#D6D6D6] flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">Meter Reading History Chart</h3>
            <span className="text-xs text-slate-500 font-medium">{selectedFinYear} ({filteredHistory.length} of {openMonthsCount} months)</span>
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 mb-4 border border-[#D6D6D6] rounded-xl p-2.5 sm:p-3 bg-[#F7F7F7]">
              <div><span className="text-[10px] text-slate-400 block">Service Type</span><span className="text-xs font-medium text-slate-700">{getServiceTypeDesc(selectedMeter) || '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Meter Classification</span><span className="text-xs font-medium text-slate-700">{getMeterClassificationDesc(selectedMeter) || '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Tariff</span><span className="text-xs font-medium text-slate-700 break-words">{selectedMeter.tariff || '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Factor</span><span className="text-xs font-medium text-slate-700">{selectedMeter.tarifffactor ?? '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Physical Meter No</span><span className="text-xs font-medium text-slate-700">{selectedMeter.physicalMeterNo || '-'}</span></div>
              <div><span className="text-[10px] text-slate-400 block">Route File</span><span className="text-xs font-medium text-slate-700">{selectedMeter.routeFileName || '-'}</span></div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--pos-accent)]" /><span className="ml-2 text-sm text-slate-500">Loading meter reading history...</span></div>
            ) : readingHistory.length > 0 ? (
              <ConsumptionChart readings={filteredHistory} />
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">No reading history available for this meter</div>
            )}
          </div>
        </div>
      )}

      {selectedMeter && !historyLoading && readingHistory.length > 0 && (
        <BillingEstimator
          readingHistory={filteredHistory}
          selectedMeter={matchedServiceForMeter}
          allReadings={readingHistory}
        />
      )}

      {selectedMeter && !historyLoading && readingHistory.length > 0 && (
        <MeterIntelligence allReadings={readingHistory} />
      )}

      {selectedMeter && !historyLoading && readingHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)]">
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
                <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">{item.billingmonth || item.billingMonth || '-'}</span>
                    {item.flag && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${flagColor}`}>{item.flag}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Old Date</span><span className="font-mono text-slate-700">{item.reading1Date || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">New Date</span><span className="font-mono text-slate-700">{item.reading2Date || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Old Reading</span><span className="font-mono font-semibold">{item.reading1 ?? '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">New Reading</span><span className="font-mono font-semibold">{item.reading2 ?? '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Consumption</span><span className="font-mono font-bold text-[var(--pos-accent)]">{item.consumption ?? '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Days</span><span className="font-mono text-slate-700">{item.readingdays ?? '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter Status</span><span className="text-slate-700">{item.meterStatus || '-'}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">Reading Status</span><span className="text-slate-700">{item.readingStatus || '-'}</span></div>
                  </div>
                  {(item.meterChange || item.disconnectionStatus) && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-[#E5E5E5]">
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
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
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
                  <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors">
                    {historyCols.map(col => {
                      let val = item[col.key];
                      if ((val === undefined || val === null || val === '') && (col as any).fallback) val = (col as any).fallback();
                      if (col.key === 'consumption') {
                        return <td key={col.key} className="py-1.5 px-2 text-[12px] font-mono font-bold text-[var(--pos-accent)] whitespace-nowrap">{val ?? '-'}</td>;
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
  const [selectedFinYears, setSelectedFinYears] = useState<string[]>([]);

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
      const rawPrepaid = prepaidResult.status === 'fulfilled' ? prepaidResult.value || [] : [];
      const enrichedPrepaid = await Promise.all(rawPrepaid.map(async (m: any) => {
        const meterId = m.meterId || m.meter_id || m.id || m.prepaidMeterId || m.meterID || m.meter_ID || m.serviceId || m.service_ID || m.meterNo || m.prepaidMeterNo;
        if (!meterId) return m;
        try {
          const details = await getPrepaidRechargeDetailsForMeter(Number(meterId));
          const arr = Array.isArray(details) ? details : [];
          const sales = arr.filter((d: any) => (d.canceledStatus || '').toLowerCase() !== 'yes');
          if (sales.length > 0) {
            const latest = sales[0];
            return {
              ...m,
              lastRechargeDate: latest.dateCaptured,
              lastRechargeAmount: latest.total,
              lastReceiptNo: latest.receiptNo,
            };
          }
        } catch (err) { console.error('[ServiceMeterTab] Failed to fetch prepaid recharge details for meter:', err); }
        return m;
      }));
      setPrepaidMeters(enrichedPrepaid);
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
    setSelectedFinYears([]);
    try {
      const meterNo = (meter.meterNo || meter.meterNumber || meter.physicalMeterNo || meter.physicalMeterNumber || '').replace(/^0+/, '');
      if (meterNo) {
        const history = await getMeterReadingHistory(accountId, meterNo);
        const arr = Array.isArray(history) ? history : [];
        const fixed = arr.map((item: any) => {
          const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
          if (bm.includes('open period') || bm.includes('current')) {
            const rs = (item.readingStatus || '').toLowerCase();
            if (rs === 'billed' || rs === 'imported' || rs === 'import') {
              return { ...item, billingmonth: item.billingmonth, _openPeriodCorrected: true };
            }
            return { ...item, _isUnreadOpenPeriod: true, readingStatus: item.readingStatus || 'Awaiting Billing' };
          }
          return item;
        });
        const filtered = fixed.filter((item: any) => !item._isUnreadOpenPeriod);
        const hasRealOpenPeriod = fixed.some((item: any) => item._isUnreadOpenPeriod);
        const openBilled = filtered.filter((item: any) => {
          const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
          return (bm.includes('open period') || bm.includes('current')) && item._openPeriodCorrected;
        });
        openBilled.forEach((item: any) => {
          const existingMonths = filtered
            .filter((r: any) => !(r.billingmonth || r.billingMonth || '').toLowerCase().includes('open period'))
            .map((r: any) => `${(r.billingmonth || r.billingMonth || '').toLowerCase()}_${r.financialYear || ''}`);
          const rd = item.reading2Date || item.reading1Date || '';
          if (rd) {
            const parts = rd.split('/');
            if (parts.length === 3) {
              const monthIdx = parseInt(parts[1]) - 1;
              const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
              if (monthIdx >= 0 && monthIdx < 12) {
                const correctMonth = monthNames[monthIdx];
                const key = `${correctMonth.toLowerCase()}_${item.financialYear || ''}`;
                if (!existingMonths.includes(key)) {
                  item.billingmonth = correctMonth;
                  item.billingMonth = correctMonth;
                }
              }
            }
          }
        });
        const finalFiltered = filtered.filter((item: any) => {
          const bm = (item.billingmonth || item.billingMonth || '').toLowerCase().trim();
          if ((bm.includes('open period') || bm.includes('current open')) && item._openPeriodCorrected) {
            return false;
          }
          return true;
        });
        setConsumptionHistory(finalFiltered);
      }
    } catch {
      setConsumptionHistory([]);
    } finally {
      setConsumptionLoading(false);
    }
  }, [accountId]);

  const finYearMonthOrder: Record<string, number> = { 'July': 0, 'August': 1, 'September': 2, 'October': 3, 'November': 4, 'December': 5, 'January': 6, 'February': 7, 'March': 8, 'April': 9, 'May': 10, 'June': 11 };

  const availableFinYears = useMemo(() => {
    const years = new Set<string>();
    consumptionHistory.forEach((h: any) => {
      const fy = h.financialYear || h.finYear || '';
      if (fy) years.add(fy);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [consumptionHistory]);

  const sortedFilteredConsumption = useMemo(() => {
    let filtered = consumptionHistory;
    if (selectedFinYears.length > 0) {
      filtered = consumptionHistory.filter((h: any) => {
        const fy = h.financialYear || h.finYear || '';
        return selectedFinYears.includes(fy);
      });
    }
    return [...filtered].sort((a, b) => {
      const fyA = a.financialYear || a.finYear || '';
      const fyB = b.financialYear || b.finYear || '';
      const fyCompare = fyB.localeCompare(fyA);
      if (fyCompare !== 0) return fyCompare;
      const monthA = a.billingmonth || a.billingMonth || '';
      const monthB = b.billingmonth || b.billingMonth || '';
      const orderA = finYearMonthOrder[monthA] ?? 99;
      const orderB = finYearMonthOrder[monthB] ?? 99;
      return orderB - orderA;
    });
  }, [consumptionHistory, selectedFinYears]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const hasData = meters.length || allServices.length || prepaidMeters.length;
  if (!hasData) return <EmptyState message="No services or meter data available" />;

  return (
    <div className="p-3 sm:p-5 space-y-5">
      {allServices.length > 0 && (() => {
        const prepaidMeterNos = new Set(prepaidMeters.map((p: any) => (p.prepaidMeterNo || p.meterNumber || p.physicalMeterNumber || p.meterNo || '').toLowerCase()).filter(Boolean));
        const isServicePrepaid = (s: any) => {
          if (isServicePrepaidByType(s)) return true;
          const desc = getServiceTypeDesc(s).toLowerCase();
          if (desc.includes('prepaid') || desc.includes('pre-paid') || desc.includes('pre paid')) return true;
          const meterNo = (s.meterNo || s.meterNumber || '').toLowerCase();
          if (meterNo && prepaidMeterNos.has(meterNo)) return true;
          return false;
        };
        const getServiceIcon = (s: any) => {
          const desc = getServiceTypeDesc(s).toLowerCase();
          if (desc.includes('water')) return { icon: '💧', color: 'text-[var(--pos-accent)]' };
          if (desc.includes('electric') || desc.includes('elec')) return { icon: '⚡', color: 'text-amber-500' };
          if (desc.includes('sewer') || desc.includes('sanit') || desc.includes('efflu')) return { icon: '🔧', color: 'text-[var(--pos-accent)]' };
          if (desc.includes('refuse') || desc.includes('waste') || desc.includes('solid')) return { icon: '🗑️', color: 'text-green-600' };
          if (desc.includes('rate') || desc.includes('property') || desc.includes('valuation')) return { icon: '🏠', color: 'text-[var(--pos-accent)]' };
          return { icon: '⚙️', color: 'text-slate-500' };
        };
        const isBasicOrFixedCharge = (s: any) => {
          const tariff = (s.tariff || s.tariffCode || s.tariffDescription || s.description || '').toLowerCase();
          return tariff.includes('basic') || tariff.includes('fixed') || tariff.includes('availability') || tariff.includes('service charge');
        };
        const hasRealMeter = (s: any) => {
          const phys = (s.physicalMeterNo || s.physicalMeterNumber || s.meterNo || s.meterNumber || '').toLowerCase().trim();
          if (!phys || phys === 'no meter' || phys === 'none' || phys === '-' || phys === '0') return false;
          return true;
        };
        const rawMetered = allServices.filter((s: any) => !isBasicOrFixedCharge(s) && !isServicePrepaid(s) && hasRealMeter(s));
        const seen = new Set<string>();
        const meteredServices = rawMetered.filter((s: any) => {
          const meterNo = (s.meterNo || s.meterNumber || '').toLowerCase().trim();
          const svcType = (getServiceTypeDesc(s) || '').toLowerCase().trim();
          const tariff = (s.tariff || s.tariffCode || s.tariffDescription || s.tariffDesc || '').toLowerCase().trim();
          const key = `${svcType}|${meterNo}|${tariff}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (meteredServices.length === 0) return null;
        return (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Conventional Meters</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{meteredServices.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2" data-testid="table-all-services-mobile">
            {meteredServices.map((s: any, i: number) => {
              const isPrepaid = isServicePrepaid(s);
              const svcIcon = getServiceIcon(s);
              const meterStatusVal = (s.meterStatus || s.statusDesc || '').toLowerCase();
              const svcStatusVal = (s.status || s.serviceStatus || s.statusDesc || '').toLowerCase();
              const isMeterActive = meterStatusVal === 'active';
              const isSvcActive = svcStatusVal === 'active';
              const hasMeter = !!(s.meterNo || s.meterNumber || s.physicalMeterNo || s.physicalMeterNumber);
              return (
              <div key={i} className={`bg-white border rounded-xl p-3 space-y-2 ${hasMeter ? 'cursor-pointer active:scale-[0.99] transition-all' : ''} ${hasMeter && consumptionMeter === s ? 'border-cyan-400 bg-cyan-50 shadow-sm' : 'border-[#D6D6D6]'}`}
                onClick={hasMeter ? () => viewConsumption(s) : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{svcIcon.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 truncate">{getServiceTypeDesc(s) || '-'}</span>
                      {isPrepaid ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">⚡ Prepaid</span>
                      ) : (s.meterNo || s.meterNumber) ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[var(--pos-accent-tint-strong)] text-[#2E2E2E] border border-[#D6D6D6]">📊 Conventional</span>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-slate-500">{getMeterClassificationDesc(s)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {(s.meterStatus || s.statusDesc) && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold border ${isMeterActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                        Mtr: {s.meterStatus || s.statusDesc}
                      </span>
                    )}
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold border ${isSvcActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-[#F2F4F7] text-slate-600 border-[#D6D6D6]'}`}>
                      Svc: {s.status || s.serviceStatus || s.statusDesc || '-'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Service ID</span><span className="font-mono font-semibold text-[var(--pos-accent)]">{s.services_ID || s.serviceId || s.service_ID || s.serviceID || s.serviceType_ID || s.tariffTypeID || '-'}</span></div>
                  {(s.meterNo || s.meterNumber) && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter No</span><span className="font-mono font-semibold text-[var(--pos-accent-dark)]">{s.meterNo || s.meterNumber || '-'}</span></div>}
                  {(s.physicalMeterNo || s.physicalMeterNumber) && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Physical Meter</span><span className="font-mono text-slate-700">{s.physicalMeterNo || s.physicalMeterNumber || '-'}</span></div>}
                  <div className="col-span-2 flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700 text-right truncate ml-2 max-w-[70%]">{s.tariff || s.tariffCode || s.tariffDescription || s.tariffDesc || '-'}</span></div>
                  {s.meterConnectionSize && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Connection</span><span className="text-slate-700">{s.meterConnectionSize}</span></div>}
                  {s.frequency && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Frequency</span><span className="text-slate-700">{s.frequency}</span></div>}
                  {(s.installDate || s.dateInstalled || s.serviceCommencementDate) && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Start Date</span><span className="text-slate-700">{(() => { const d = s.serviceCommencementDate || s.installDate || s.dateInstalled; if (!d) return '-'; if (typeof d === 'string' && d.includes('T')) return new Date(d).toLocaleDateString('en-GB'); return d; })()}</span></div>}
                  {(s.routeFileName || s.routeFile) && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Route</span><span className="text-slate-700 truncate ml-1">{s.routeFileName || s.routeFile || '-'}</span></div>}
                </div>
                {hasMeter && (
                  <div className="text-center text-[10px] text-cyan-600 font-semibold pt-1 border-t border-[#E5E5E5]">
                    <Activity className="w-3 h-3 inline mr-1" />
                    Tap to view consumption history
                  </div>
                )}
              </div>
              );
            })}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-all-services">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service ID</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter No</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Tariff</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service Status</th>
                  <th className="text-center py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {meteredServices.map((s: any, i: number) => {
                  const isPrepaid = isServicePrepaid(s);
                  const svcIcon = getServiceIcon(s);
                  const meterStatusVal = (s.meterStatus || s.statusDesc || '').toLowerCase();
                  const svcStatusVal = (s.status || s.serviceStatus || s.statusDesc || '').toLowerCase();
                  const isMeterActive = meterStatusVal === 'active';
                  const isSvcActive = svcStatusVal === 'active';
                  const hasMeter = !!(s.meterNo || s.meterNumber || s.physicalMeterNo || s.physicalMeterNumber);
                  return (
                  <tr key={i} className={`border-b border-[#E5E5E5] transition-colors ${hasMeter ? 'cursor-pointer hover:bg-cyan-50/40' : 'hover:bg-[var(--pos-accent-tint)]/30'} ${consumptionMeter === s ? 'bg-cyan-50 ring-1 ring-cyan-300' : ''}`}
                    onClick={hasMeter ? () => viewConsumption(s) : undefined}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{svcIcon.icon}</span>
                        <div>
                          <span className="font-medium text-slate-800">{getServiceTypeDesc(s) || '-'}</span>
                          {getMeterClassificationDesc(s) && (
                            <span className="block text-[10px] text-slate-500">{getMeterClassificationDesc(s)}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {isPrepaid ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">⚡ Prepaid</span>
                      ) : (s.meterNo || s.meterNumber) ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--pos-accent-tint-strong)] text-[#2E2E2E] border border-[#D6D6D6]">📊 Conventional</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Metered</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-[var(--pos-accent)]">{s.services_ID || s.serviceId || s.service_ID || s.serviceID || s.serviceType_ID || s.tariffTypeID || '-'}</td>
                    <td className="py-2 px-3 font-mono text-[var(--pos-accent-dark)] font-semibold">{s.meterNo || s.meterNumber || '-'}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs max-w-[200px] truncate">{s.tariff || s.tariffCode || s.tariffDescription || s.tariffDesc || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isMeterActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : (s.meterStatus || s.statusDesc) ? 'bg-red-100 text-red-600 border-red-200' : 'bg-[#F2F4F7] text-slate-500 border-[#D6D6D6]'}`}>
                        {s.meterStatus || s.statusDesc || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isSvcActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-[#F2F4F7] text-slate-600 border-[#D6D6D6]'}`}>
                        {s.status || s.serviceStatus || s.statusDesc || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {hasMeter ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); viewConsumption(s); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-[11px] font-semibold rounded-md border border-cyan-200 transition-all"
                          data-testid={`button-view-svc-consumption-${i}`}
                        >
                          <Activity className="w-3 h-3" />
                          View
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {(() => {
        const prepaidMeterNosSet = new Set(prepaidMeters.map((p: any) => (p.prepaidMeterNo || p.meterNumber || p.physicalMeterNumber || p.meterNo || '').toLowerCase()).filter(Boolean));
        const isMeterPrepaid = (m: any) => {
          if (isServicePrepaidByType(m)) return true;
          const desc = (m.serviceType || m.serviceTypeDescription || m.serviceDesc || m.tariffCode || m.tariff || m.classification || '').toLowerCase();
          if (desc.includes('prepaid') || desc.includes('pre-paid')) return true;
          const mNo = (m.meterNo || m.meterNumber || m.physicalMeterNumber || '').toLowerCase();
          return mNo ? prepaidMeterNosSet.has(mNo) : false;
        };
        const hasPhysicalMeter = (m: any) => {
          const phys = (m.physicalMeterNo || m.physicalMeterNumber || '').toLowerCase().trim();
          const meterNo = (m.meterNo || m.meterNumber || '').trim();
          if (!phys && !meterNo) return false;
          if (phys === 'no meter' || phys === 'none' || phys === '-' || phys === '') return false;
          if (meterNo === '0' || meterNo === '' || meterNo === '-') return false;
          return true;
        };
        const meteredOnly = meters.filter((m: any) => hasPhysicalMeter(m) && !isMeterPrepaid(m));
        const convMeters = meteredOnly;

        const loadPrepaidHistory = async (m: any) => {
          setShowPrepaidSales(true);
          setSelectedPrepaidMeter(m);
          setLoadingRecharge(true);
          setPrepaidRechargeDetails([]);
          try {
            console.log('[PrepaidHistory] Meter object keys:', Object.keys(m));
            console.log('[PrepaidHistory] Meter object:', JSON.stringify(m));
            const meterId = m.meterId || m.meter_id || m.id || m.prepaidMeterId || m.meterID || m.meter_ID || m.serviceId || m.service_ID;
            console.log('[PrepaidHistory] Resolved meterId:', meterId);
            if (meterId) {
              const details = await getPrepaidRechargeDetailsForMeter(meterId);
              console.log('[PrepaidHistory] Got details:', details?.length || 0, 'records');
              setPrepaidRechargeDetails(Array.isArray(details) ? details : []);
            } else {
              console.warn('[PrepaidHistory] No meterId found on meter object, trying meterNo as fallback');
              const meterNo = m.prepaidMeterNo || m.meterNumber || m.meterNo;
              if (meterNo) {
                const details = await getPrepaidRechargeDetailsForMeter(Number(meterNo));
                console.log('[PrepaidHistory] Got details via meterNo fallback:', details?.length || 0, 'records');
                setPrepaidRechargeDetails(Array.isArray(details) ? details : []);
              }
            }
          } catch (e) {
            console.error('Failed to load recharge details:', e);
          } finally {
            setLoadingRecharge(false);
          }
        };

        return (
        <>
        {convMeters.length > 0 && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Gauge className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Conventional Meters</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{convMeters.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2" data-testid="table-conv-meters-mobile">
            {convMeters.map((m: any, i: number) => {
              const meterStatus = (m.status || m.statusDesc || m.meterStatus || '').toLowerCase();
              const svcStatus = (m.serviceStatus || m.serviceStatusDesc || '').toLowerCase();
              const isActive = meterStatus === 'active';
              const isSvcActive = svcStatus === 'active';
              const isSelected = consumptionMeter && (consumptionMeter.meterNo || consumptionMeter.meterNumber) === (m.meterNo || m.meterNumber);
              return (
              <div key={i} className={`bg-white border rounded-xl p-3 space-y-2 cursor-pointer active:scale-[0.99] transition-all ${isSelected ? 'border-[var(--pos-accent)] bg-[var(--pos-accent-tint)] shadow-sm' : 'border-[#D6D6D6]'}`}
                onClick={() => viewConsumption(m)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--pos-accent-tint-strong)] border border-[#D6D6D6]">
                    <Gauge className="w-4 h-4 text-[var(--pos-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate block">{getServiceTypeDesc(m) || '-'}</span>
                    <span className="text-[10px] text-slate-500">{getMeterClassificationDesc(m)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold border ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                      Mtr: {m.status || m.statusDesc || m.meterStatus || '-'}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold border ${isSvcActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-[#F2F4F7] text-slate-600 border-[#D6D6D6]'}`}>
                      Svc: {m.serviceStatus || m.serviceStatusDesc || '-'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter No</span><span className="font-mono font-bold text-[var(--pos-accent)]">{m.meterNo || m.meterNumber || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Physical</span><span className="font-mono text-slate-700">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</span></div>
                  <div className="col-span-2 flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700 text-right truncate ml-2 max-w-[70%]">{m.tariffCode || m.tariff || m.tariffDescription || '-'}</span></div>
                  {(m.installDate || m.dateInstalled) && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Installed</span><span className="text-slate-700">{m.installDate || m.dateInstalled || '-'}</span></div>}
                  {(m.replace !== undefined || m.isReplaced !== undefined) && (m.replace || m.isReplaced) && <div className="col-span-2 flex justify-between text-[11px]"><span className="text-slate-500">Replaced</span><span className="text-red-600 font-semibold">Yes{m.reason || m.replaceReason ? ` — ${m.reason || m.replaceReason}` : ''}</span></div>}
                </div>
                <div className="flex items-center justify-center gap-1 text-[10px] text-cyan-600 font-semibold pt-1.5 border-t border-[#E5E5E5]">
                  <Activity className="w-3 h-3" /> Tap to view consumption history
                </div>
              </div>
              );
            })}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-conv-meters">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Classification</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter No</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Physical No</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Tariff</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Svc Status</th>
                  <th className="text-center py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Consumption</th>
                </tr>
              </thead>
              <tbody>
                {convMeters.map((m: any, i: number) => {
                  const isSelected = consumptionMeter && (consumptionMeter.meterNo || consumptionMeter.meterNumber) === (m.meterNo || m.meterNumber);
                  return (
                  <tr key={i} className={`border-b border-[#E5E5E5] cursor-pointer transition-colors ${isSelected ? 'bg-[var(--pos-accent-tint)] ring-1 ring-[var(--pos-accent-light)]' : 'hover:bg-[var(--pos-accent-tint)]/30'}`}
                    onClick={() => viewConsumption(m)}
                  >
                    <td className="py-2 px-3 font-medium">{getServiceTypeDesc(m) || '-'}</td>
                    <td className="py-2 px-3 text-xs">{getMeterClassificationDesc(m) || '-'}</td>
                    <td className="py-2 px-3 font-mono font-semibold text-[var(--pos-accent)]">{m.meterNo || m.meterNumber || '-'}</td>
                    <td className="py-2 px-3 font-mono text-sm">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</td>
                    <td className="py-2 px-3 text-xs max-w-[150px] truncate">{m.tariffCode || m.tariff || m.tariffDescription || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.statusDesc || m.meterStatus || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-[#F2F4F7] text-slate-600 border border-[#D6D6D6]'}`}>
                        {m.status || m.statusDesc || m.meterStatus || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.serviceStatus || m.serviceStatusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-[#F2F4F7] text-slate-600 border border-[#D6D6D6]'}`}>
                        {m.serviceStatus || m.serviceStatusDesc || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); viewConsumption(m); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-[11px] font-semibold rounded-md border border-cyan-200 transition-all"
                        data-testid={`button-view-consumption-${i}`}
                      >
                        <Activity className="w-3 h-3" /> View
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {consumptionMeter && (
        <div className="bg-white rounded-xl border border-cyan-200 shadow-sm overflow-hidden" data-testid="consumption-detail-panel">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-cyan-100 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-between">
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
                  <p className="font-medium text-slate-800 mt-0.5">{getServiceTypeDesc(consumptionMeter) || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Meter No</span>
                  <p className="font-mono font-bold text-[var(--pos-accent)] mt-0.5">{consumptionMeter.meterNo || consumptionMeter.meterNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Physical Meter</span>
                  <p className="font-mono text-slate-800 mt-0.5">{consumptionMeter.physicalMeterNumber || consumptionMeter.physicalMeterNo || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tariff</span>
                  <p className="text-slate-800 mt-0.5 text-xs">{consumptionMeter.tariffCode || consumptionMeter.tariff || '-'}</p>
                </div>
              </div>
            </div>

            {!consumptionLoading && consumptionHistory.length > 0 && availableFinYears.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="fin-year-filter">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">Financial Year:</span>
                <button
                  onClick={() => setSelectedFinYears([])}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${selectedFinYears.length === 0 ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white text-slate-600 border-[#BFBFBF] hover:border-cyan-400 hover:text-cyan-700'}`}
                  data-testid="fin-year-all"
                >
                  All
                </button>
                {availableFinYears.map(fy => {
                  const isActive = selectedFinYears.includes(fy);
                  return (
                    <button
                      key={fy}
                      onClick={() => {
                        setSelectedFinYears(prev =>
                          prev.includes(fy) ? prev.filter(y => y !== fy) : [...prev, fy]
                        );
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${isActive ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white text-slate-600 border-[#BFBFBF] hover:border-cyan-400 hover:text-cyan-700'}`}
                      data-testid={`fin-year-${fy}`}
                    >
                      {fy}
                    </button>
                  );
                })}
              </div>
            )}

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
                  {sortedFilteredConsumption.map((h: any, i: number) => {
                    const flagVal = (h.flag || '').toLowerCase();
                    const flagColor = flagVal.includes('reversed') || flagVal.includes('cancel') ? 'bg-red-100 text-red-700 border-red-200' : flagVal.includes('estimate') || flagVal.includes('levy') ? 'bg-amber-100 text-amber-700 border-amber-200' : flagVal.includes('import') ? 'bg-green-100 text-green-700 border-green-200' : '';
                    return (
                    <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`consumption-row-${i}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{h.billingmonth || h.billingMonth || '-'}</span>
                        <div className="flex items-center gap-1">
                          {h.flag && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${flagColor}`}>{h.flag}</span>}
                          {h.readingStatus && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(h.readingStatus || '').toLowerCase().includes('actual') || (h.readingStatus || '').toLowerCase().includes('import') ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>{h.readingStatus}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Old Date</span><span className="font-mono text-slate-700">{h.reading1Date || '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">New Date</span><span className="font-mono text-slate-700">{h.reading2Date || '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Old Reading</span><span className="font-mono font-semibold">{h.reading1 ?? '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">New Reading</span><span className="font-mono font-semibold">{h.reading2 ?? '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Consumption</span><span className="font-mono font-bold text-cyan-700">{h.consumption ?? h.consumptionValue ?? h.units ?? '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Days</span><span className="font-mono text-slate-700">{h.readingdays ?? h.readingDays ?? '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter Status</span><span className="text-slate-700">{h.meterStatus || '-'}</span></div>
                        <div className="flex justify-between text-[11px]"><span className="text-slate-500">Fin Year</span><span className="text-slate-700">{h.financialYear || h.finYear || '-'}</span></div>
                      </div>
                    </div>
                    );
                  })}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-meter-consumption">
                    <thead>
                      <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Billing Month</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Old Date</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">New Date</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Old Reading</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">New Reading</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Consumption</th>
                        <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Days</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter Status</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reading Status</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Flag</th>
                        <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Fin Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredConsumption.map((h: any, i: number) => {
                        const flagVal = (h.flag || '').toLowerCase();
                        const flagColor = flagVal.includes('reversed') || flagVal.includes('cancel') ? 'text-red-600' : flagVal.includes('estimate') || flagVal.includes('levy') ? 'text-amber-600' : 'text-green-700';
                        return (
                        <tr key={i} className="border-b border-[#E5E5E5] hover:bg-cyan-50/30 transition-colors" data-testid={`consumption-row-${i}`}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{h.billingmonth || h.billingMonth || '-'}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{h.reading1Date || '-'}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{h.reading2Date || '-'}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">{h.reading1 ?? '-'}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">{h.reading2 ?? '-'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-cyan-700">{h.consumption ?? h.consumptionValue ?? h.units ?? '-'}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{h.readingdays ?? h.readingDays ?? '-'}</td>
                          <td className="py-2 px-3 text-xs">{h.meterStatus || '-'}</td>
                          <td className="py-2 px-3 text-xs">{h.readingStatus || '-'}</td>
                          <td className={`py-2 px-3 text-xs font-medium ${flagColor}`}>{h.flag || '-'}</td>
                          <td className="py-2 px-3 text-slate-500">{h.financialYear || h.finYear || '-'}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {prepaidMeters.length > 0 && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Prepaid Meters</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{prepaidMeters.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2" data-testid="table-prepaid-meters-mobile">
            {prepaidMeters.map((m: any, i: number) => {
              const mStatus = (m.status || m.meterStatus || m.statusDesc || '').toLowerCase();
              const isActive = mStatus === 'active';
              return (
              <div key={i} className={`bg-white border rounded-xl p-3 space-y-2 cursor-pointer active:scale-[0.99] transition-all border-[#D6D6D6]`}
                onClick={() => loadPrepaidHistory(m)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 border border-amber-200">
                    <Zap className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate block">{m.prepaidServiceDesc || m.serviceType || m.serviceDescription || m.serviceDesc || 'Prepaid'}</span>
                    <span className="text-[10px] text-slate-500">{m.meterPhase || m.phase || ''}</span>
                  </div>
                  <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold border ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                    {m.status || m.meterStatus || m.statusDesc || '-'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter No</span><span className="font-mono font-bold text-[var(--pos-accent)]">{m.prepaidMeterNo || m.meterNumber || m.meterNo || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Physical</span><span className="font-mono text-slate-700">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</span></div>
                  <div className="col-span-2 flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700 text-right truncate ml-2 max-w-[70%]">{m.tariff || m.tariffDescription || m.tariffDesc || '-'}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-500">Last Recharge</span><span className="font-mono text-slate-700">{m.lastRechargeDate ? new Date(m.lastRechargeDate).toLocaleDateString('en-GB') : '-'}</span></div>
                  {m.lastRechargeAmount !== undefined && m.lastRechargeAmount !== null && <div className="flex justify-between text-[11px]"><span className="text-slate-500">Last Amount</span><span className="font-mono text-emerald-700 font-semibold">R {Number(m.lastRechargeAmount).toFixed(2)}</span></div>}
                  {m.lastReceiptNo && <div className="col-span-2 flex justify-between text-[11px]"><span className="text-slate-500">Receipt</span><span className="font-mono text-slate-700 text-right truncate ml-2 max-w-[65%]">{m.lastReceiptNo}</span></div>}
                </div>
                <div className="flex items-center justify-center gap-1 text-[10px] text-amber-600 font-semibold pt-1.5 border-t border-[#E5E5E5]">
                  <Eye className="w-3 h-3" /> Tap to view purchase history
                </div>
              </div>
              );
            })}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-prepaid-meters">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Meter No</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Physical No</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Tariff</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Receipt No</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Last Recharge</th>
                  <th className="text-center py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">History</th>
                </tr>
              </thead>
              <tbody>
                {prepaidMeters.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-[#E5E5E5] cursor-pointer hover:bg-amber-50/30 transition-colors"
                    onClick={() => loadPrepaidHistory(m)}
                  >
                    <td className="py-2 px-3 font-medium">{m.prepaidServiceDesc || m.serviceType || m.serviceDescription || m.serviceDesc || 'Prepaid'}</td>
                    <td className="py-2 px-3 font-mono font-semibold text-[var(--pos-accent)]">{m.prepaidMeterNo || m.meterNumber || m.meterNo || '-'}</td>
                    <td className="py-2 px-3 font-mono text-sm">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</td>
                    <td className="py-2 px-3 text-xs max-w-[150px] truncate">{m.tariff || m.tariffDescription || m.tariffDesc || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.meterStatus || m.statusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-[#F2F4F7] text-slate-600 border border-[#D6D6D6]'}`}>
                        {m.status || m.meterStatus || m.statusDesc || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-600 max-w-[160px] truncate" title={m.lastReceiptNo || ''}>
                      {m.lastReceiptNo || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {m.lastRechargeDate ? new Date(m.lastRechargeDate).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); loadPrepaidHistory(m); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-semibold rounded-md border border-amber-200 transition-all"
                        data-testid={`button-view-prepaid-${i}`}
                      >
                        <Eye className="w-3 h-3" /> Purchases
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
        </>
        );
      })()}

      {showPrepaidSales && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => setShowPrepaidSales(false)} data-testid="prepaid-sales-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-b border-[#D6D6D6] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-white" />
                <h4 className="text-sm sm:text-base font-bold text-white">Prepaid Sales</h4>
              </div>
              <div className="flex items-center gap-2">
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
              <button
                onClick={() => setShowPrepaidSales(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-all border border-white/30"
                data-testid="button-close-prepaid-modal"
              >
                Close
              </button>
              </div>
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
                          const meterId = m.meterId || m.meter_id || m.id || m.prepaidMeterId || m.meterID || m.meter_ID || m.serviceId || m.service_ID || m.meterNo || m.prepaidMeterNo;
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
                        <div key={i} onClick={handleClick} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-2 cursor-pointer active:bg-emerald-50" data-testid={`prepaid-sales-row-${i}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800">{m.serviceType || m.serviceDescription || 'Electricity Pre-Paid'}</span>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.meterStatus || m.statusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-[#F2F4F7] text-slate-600 border border-[#D6D6D6]'}`}>
                              {m.status || m.meterStatus || m.statusDesc || '-'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Meter No</span><span className="font-mono font-semibold text-[var(--pos-accent)]">{m.meterNumber || m.meterNo || '-'}</span></div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Physical</span><span className="font-mono text-slate-700">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</span></div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Tariff</span><span className="text-slate-700 truncate ml-1">{m.tariff || m.tariffDescription || m.tariffDesc || '-'}</span></div>
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
                        <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
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
                            className="border-b border-[#E5E5E5] hover:bg-emerald-50/40 transition-colors cursor-pointer"
                            onClick={async () => {
                              setSelectedPrepaidMeter(m);
                              setLoadingRecharge(true);
                              setPrepaidRechargeDetails([]);
                              try {
                                const meterId = m.meterId || m.meter_id || m.id || m.prepaidMeterId || m.meterID || m.meter_ID || m.serviceId || m.service_ID || m.meterNo || m.prepaidMeterNo;
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
                            <td className="py-2.5 px-3 font-medium">{m.serviceType || m.serviceDescription || m.prepaidServiceDesc || 'Electricity Pre-Paid'}</td>
                            <td className="py-2.5 px-3 font-mono text-[var(--pos-accent)] font-semibold">{m.meterNumber || m.meterNo || m.prepaidMeterNo || '-'}</td>
                            <td className="py-2.5 px-3">{m.meterPhase || m.phase || '-'}</td>
                            <td className="py-2.5 px-3 text-xs">{m.tariff || m.tariffDescription || m.tariffDesc || '-'}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{m.physicalMeterNumber || m.physicalMeterNo || '-'}</td>
                            <td className="py-2.5 px-3">{m.meterConnectionSize || m.connectionSize || '-'}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${(m.status || m.meterStatus || m.statusDesc || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-[#F2F4F7] text-slate-600 border border-[#D6D6D6]'}`}>
                                {m.status || m.meterStatus || m.statusDesc || '-'}
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
                        <p className="font-mono font-bold text-[var(--pos-accent)] mt-0.5">{selectedPrepaidMeter.meterNumber || selectedPrepaidMeter.meterNo || '-'}</p>
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
                          <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-2" data-testid={`recharge-detail-row-${i}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600">{(() => { const d = r.dateCaptured || r.receiptDate || r.rechargeDate; if (!d) return '-'; if (typeof d === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(d)) { const [dd,mm,yy] = d.split('/'); return `${dd}/${mm}/${yy}`; } return new Date(d).toLocaleDateString('en-GB'); })()}</span>
                              {r.isCancelled || r.canceledStatus === 'Yes' || r.cancelledStatus === 'Yes' ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">Cancelled</span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>
                              )}
                            </div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Receipt No</span><span className="font-mono font-semibold text-[var(--pos-accent)]">{r.receiptNo || r.receiptNumber || '-'}</span></div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">Amount</span><span className="font-mono font-semibold">{(r.amount ?? r.rechargeAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">VAT</span><span className="font-mono">{(r.vatAmount ?? r.vat ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">Total</span><span className="font-mono font-bold text-slate-800">{(r.total ?? r.totalAmount ?? ((r.amount ?? 0) + (r.vatAmount ?? 0))).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">Units</span><span className="font-mono">{r.prepaidUnit ?? r.units ?? r.kwhUnits ?? '-'}</span></div>
                            </div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Type</span><span className="font-mono">{r.unitType || r.type || '-'}</span></div>
                            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Token</span><span className="font-mono text-xs text-slate-700 truncate ml-2">{r.prepaidTokenNo || r.tokenNumber || r.token || '-'}</span></div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Cancelled</span>
                              {r.canceledStatus === 'Yes' || r.cancelledStatus === 'Yes' || r.isCancelled ? (
                                <span className="font-semibold text-red-600">Yes</span>
                              ) : (
                                <span className="font-semibold text-emerald-600">No</span>
                              )}
                            </div>
                            {(r.reasonForCancel || r.cancelReason) && (
                              <div className="flex justify-between text-[11px]"><span className="text-slate-500">Cancel Reason</span><span className="text-red-600">{r.reasonForCancel || r.cancelReason}</span></div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm" data-testid="table-prepaid-recharge-details">
                          <thead>
                            <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                              <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Purchase Date</th>
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
                              <tr key={i} className="border-b border-[#E5E5E5] hover:bg-emerald-50/30 transition-colors" data-testid={`recharge-detail-row-${i}`}>
                                <td className="py-2.5 px-3 text-slate-600">{(() => { const d = r.dateCaptured || r.receiptDate || r.rechargeDate; if (!d) return '-'; if (typeof d === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(d)) { const [dd,mm,yy] = d.split('/'); return `${dd}/${mm}/${yy}`; } return new Date(d).toLocaleDateString('en-GB'); })()}</td>
                                <td className="py-2.5 px-3 font-mono text-[var(--pos-accent)] font-semibold text-xs">{r.receiptNo || r.receiptNumber || '-'}</td>
                                <td className="py-2.5 px-3 text-right font-mono">{(r.amount ?? r.rechargeAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                                <td className="py-2.5 px-3 text-right font-mono">{(r.vatAmount ?? r.vat ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(r.total ?? r.totalAmount ?? ((r.amount ?? 0) + (r.vatAmount ?? 0))).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                                <td className="py-2.5 px-3 text-right font-mono">{r.prepaidUnit ?? r.units ?? r.kwhUnits ?? '-'}</td>
                                <td className="py-2.5 px-3">{r.unitType || r.type || r.rechargeType || r.transactionType || '-'}</td>
                                <td className="py-2.5 px-3 font-mono text-xs">{r.prepaidTokenNo || r.tokenNumber || r.token || '-'}</td>
                                <td className="py-2.5 px-3">
                                  {r.isCancelled || r.canceledStatus === 'Yes' || r.cancelledStatus === 'Yes' ? (
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
                <button onClick={() => setShowPrepaidSales(false)} className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white text-sm font-semibold rounded-lg hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] transition-all shadow-md" data-testid="button-close-prepaid-sales">
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
