import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Receipt, Download, Eye, RefreshCw, ChevronDown, ChevronUp, Loader2,
  Layers, Activity, X, Banknote, CreditCard, CalendarDays, Clock, List, LayoutList,
  ArrowDown, ArrowUp, Circle, CheckCircle2, XCircle, Filter
} from 'lucide-react';
import {
  getTransactionHistory, getDetailedTransactionResults, getBillingPeriodTransactions,
  getAllBillingPeriodTransactions,
  getReceiptTransactionDetail, getLevyTransactionDetail,
  getOpenBalanceDetail, getCloseBalanceDetail, getJournalTransactionDetails,
  getRebateTransactionDetail, getInterestConsPaymentDetail,
  getBillingProcessingMonth,
} from '@/lib/enquiries-service';
import { fetchPosMultiReceiptPrint, platinumPrintReceiptRaw } from '@/lib/external-api';
import { openSlipPrintWindow, ReceiptPrintData } from '@/lib/receipt-print';
import { LoadingSkeleton, EmptyState, ErrorState, PaginatedTable, getFinYearOptions, MONTHS } from './shared';
import { downloadSummaryExcel, downloadTransactionExcel, downloadExcel } from '@/lib/excel-export';

function parseHtmlTables(html: string): { headers: string[]; rows: string[][] }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');
  const result: { headers: string[]; rows: string[][] }[] = [];
  tables.forEach(table => {
    const headers: string[] = [];
    const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th');
    headerCells.forEach(th => headers.push((th as HTMLElement).innerText || th.textContent || ''));
    const rows: string[][] = [];
    const bodyRows = table.querySelectorAll('tbody tr');
    const allRows = bodyRows.length > 0 ? bodyRows : table.querySelectorAll('tr');
    allRows.forEach((tr, idx) => {
      if (idx === 0 && headers.length > 0 && tr.querySelector('th')) return;
      const cells: string[] = [];
      tr.querySelectorAll('td, th').forEach(td => cells.push((td as HTMLElement).innerText || td.textContent || ''));
      if (cells.length > 0) rows.push(cells);
    });
    if (headers.length > 0 || rows.length > 0) result.push({ headers, rows });
  });
  return result;
}

function HtmlDetailMobileCards({ html }: { html: string }) {
  const tables = useMemo(() => parseHtmlTables(html), [html]);
  if (tables.length === 0) return null;
  return (
    <div className="space-y-3">
      {tables.map((table, ti) => (
        <div key={ti} className="space-y-2">
          {table.rows.map((row, ri) => (
              <div key={ri} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                {table.headers.length > 0 ? (
                  table.headers.map((header, ci) => {
                    const val = row[ci] ?? '';
                    if (!val.trim() && !header.trim()) return null;
                    const isShortNumeric = /^-?[\d,.\s]+$/.test(val.trim()) && val.length < 20;
                    const isShortVal = val.length <= 30 && !val.includes('\n');
                    const isInline = isShortNumeric || (isShortVal && val !== '-');
                    return (
                      <div key={ci} className={isInline && val !== '-' ? 'flex justify-between items-baseline gap-2' : ''}>
                        <span className="text-[10px] uppercase tracking-wider text-teal-700 font-semibold shrink-0">{header}</span>
                        <span className={`text-xs text-slate-700 break-all ${isInline ? 'text-right' : 'block mt-0.5 leading-relaxed'} ${isShortNumeric ? 'font-mono font-semibold' : ''}`}>{val || '-'}</span>
                      </div>
                    );
                  })
                ) : (
                  row.map((cell, ci) => (
                    <div key={ci} className="text-xs text-slate-700 break-all leading-relaxed">{cell}</div>
                  ))
                )}
              </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function extractServiceType(desc: string): string {
  const levyMatch = desc.match(/^Levy\s*-\s*(.+)/i);
  if (levyMatch) return levyMatch[1].trim();
  const journalMatch = desc.match(/^(?:Billing\s+Transfer\s+)?(?:Normal\s+)?Journal\s*-\s*(.+?)(?:\s*-\s*Transfer|$)/i);
  if (journalMatch) return journalMatch[1].trim();
  const parts = desc.split('-').map(s => s.trim());
  if (parts.length >= 2) return parts[1];
  return desc || 'Other';
}

function buildPivotData(data: { month: string; records: any[] }[]): any[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  const serviceMap = new Map<string, Record<string, number>>();
  const monthOpening: Record<string, number> = {};
  const monthClosing: Record<string, number> = {};
  const monthInterest: Record<string, number> = {};
  const monthReceipts: Record<string, number> = {};
  const monthCharges: Record<string, number> = {};

  data.forEach(({ month, records }) => {
    records.forEach((r: any) => {
      const drilldown = r.drilldown || '';
      const totalAmt = r.totalAmount ?? r.amount ?? 0;
      if (drilldown === 'OpenBalance') { monthOpening[month] = (monthOpening[month] || 0) + totalAmt; return; }
      if (drilldown === 'CloseBalance') { monthClosing[month] = (monthClosing[month] || 0) + totalAmt; return; }
      if (drilldown === 'Interest') { monthInterest[month] = (monthInterest[month] || 0) + totalAmt; return; }
      if (drilldown === 'Receipt') { monthReceipts[month] = (monthReceipts[month] || 0) + totalAmt; return; }
      const serviceType = extractServiceType(r.description || '');
      if (!serviceMap.has(serviceType)) serviceMap.set(serviceType, {});
      const row = serviceMap.get(serviceType)!;
      row[month] = (row[month] || 0) + totalAmt;
      monthCharges[month] = (monthCharges[month] || 0) + totalAmt;
    });
  });

  const serviceRows = Array.from(serviceMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([desc, months]) => ({ description: desc, isSpecial: false, ...months }));

  const openingRow: any = { description: 'Opening Balance', isSpecial: true };
  const chargesRow: any = { description: 'Total Charges', isSpecial: true, isBold: true };
  const interestRow: any = { description: 'Interest', isSpecial: true };
  const receiptsRow: any = { description: 'Receipts / Payments', isSpecial: true };
  const closingRow: any = { description: 'Closing Balance', isSpecial: true, isBold: true };

  MONTHS.forEach(m => {
    openingRow[m] = monthOpening[m] || 0;
    chargesRow[m] = monthCharges[m] || 0;
    interestRow[m] = monthInterest[m] || 0;
    receiptsRow[m] = monthReceipts[m] || 0;
    closingRow[m] = monthClosing[m] !== undefined ? monthClosing[m] : (openingRow[m] + chargesRow[m] + interestRow[m] + receiptsRow[m]);
  });

  return [openingRow, ...serviceRows, interestRow, chargesRow, receiptsRow, closingRow];
}

const fmtAmount = (v: number | undefined) => {
  if (v === undefined) return '0,00';
  const num = typeof v === 'number' ? v : 0;
  if (num < 0) return `(${Math.abs(num).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})`;
  return num.toLocaleString('en-ZA', { minimumFractionDigits: 2 });
};

type PeriodData = { year: string; data: { month: string; records: any[] }[]; pivotData: any[]; hasData: boolean };

function SummaryTable({ pivotData, year, hasData }: { pivotData: any[]; year: string; hasData: boolean }) {
  return (
    <>
      <div className="sm:hidden space-y-2" data-testid={`transaction-summary-grid-${year}-mobile`}>
        {!hasData ? (
          <div className="text-center text-slate-400 py-4 text-sm">No records to display</div>
        ) : pivotData.map((row: any, i: number) => (
            <div key={i} className={`border rounded-lg p-3 ${row.isBold ? 'bg-slate-50 border-slate-300' : row.isSpecial ? 'bg-slate-50/50 border-slate-200' : 'bg-white border-slate-200'}`}>
              <div className={`text-xs mb-1.5 ${row.isBold ? 'font-bold text-slate-900' : row.isSpecial ? 'italic text-slate-600' : 'font-semibold text-slate-800'}`}>{row.description}</div>
              <div className="text-[10px] text-slate-400 mb-1.5">{year}</div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                {MONTHS.map(m => (
                  <div key={m} className="flex justify-between items-baseline">
                    <span className="text-[10px] text-slate-400 font-medium">{m.slice(0, 3)}</span>
                    <span className={`font-mono text-[11px] ${row.isBold ? 'font-bold' : ''} ${(row[m] || 0) < 0 ? 'text-red-600' : (row[m] || 0) === 0 ? 'text-slate-300' : 'text-slate-700'}`}>{fmtAmount(row[m])}</span>
                  </div>
                ))}
              </div>
            </div>
        ))}
      </div>
      <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-xs" data-testid={`transaction-summary-grid-${year}`}>
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
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{year}</td>
                {MONTHS.map(m => (
                  <td key={m} className={`px-3 py-2 text-right whitespace-nowrap font-mono ${row.isBold ? 'font-bold text-slate-900' : 'text-slate-700'} ${(row[m] || 0) < 0 ? 'text-red-600' : ''}`}>{fmtAmount(row[m])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PeriodSection({ period, expanded, onToggle }: { period: PeriodData; expanded: boolean; onToggle: () => void }) {
  const closingRow = period.pivotData.find((r: any) => r.description === 'Closing Balance');
  const totalChargesRow = period.pivotData.find((r: any) => r.description === 'Total Charges');
  const closingTotal = closingRow ? MONTHS.reduce((s, m) => s + (closingRow[m] || 0), 0) : 0;
  const chargesTotal = totalChargesRow ? MONTHS.reduce((s, m) => s + (totalChargesRow[m] || 0), 0) : 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden" data-testid={`period-section-${period.year}`}>
      <button
        onClick={onToggle}
        className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 transition-colors gap-1 sm:gap-3"
        data-testid={`toggle-period-${period.year}`}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          <span className="font-semibold text-xs sm:text-sm text-slate-800">{period.year}</span>
          {!period.hasData && <span className="text-[10px] sm:text-xs text-slate-400 italic">No transactions</span>}
        </div>
        {period.hasData && (
          <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs ml-6 sm:ml-0">
            <span className="text-slate-500">Charges: <span className="font-mono font-semibold text-slate-700">{fmtAmount(chargesTotal)}</span></span>
            <span className={`font-mono font-bold ${closingTotal < 0 ? 'text-red-600' : closingTotal > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              Balance: {fmtAmount(closingTotal)}
            </span>
          </div>
        )}
      </button>
      {expanded && (
        <div className="p-3 border-t border-slate-200">
          <SummaryTable pivotData={period.pivotData} year={period.year} hasData={period.hasData} />
        </div>
      )}
    </div>
  );
}

export function TransactionSummaryTab({ accountId, accountNumber }: { accountId: number; accountNumber?: string }) {
  const years = useMemo(() => getFinYearOptions(), []);
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const [multiView, setMultiView] = useState(false);
  const [selectedYears, setSelectedYears] = useState<string[]>([years[0]]);
  const [periodsCache, setPeriodsCache] = useState<Record<string, { data: { month: string; records: any[] }[] }>>({});
  const [loadingYears, setLoadingYears] = useState<Set<string>>(new Set());
  const [errorYears, setErrorYears] = useState<Record<string, string>>({});
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set([years[0]]));

  const loadYear = useCallback(async (finYear: string) => {
    if (periodsCache[`${accountId}-${finYear}`]) return;
    setLoadingYears(prev => new Set(prev).add(finYear));
    setErrorYears(prev => { const n = { ...prev }; delete n[finYear]; return n; });
    try {
      const results = await Promise.allSettled(
        MONTHS.map(month => getBillingPeriodTransactions(accountId, finYear, month))
      );
      const allResults = MONTHS.map((month, i) => ({
        month,
        records: results[i].status === 'fulfilled' ? (Array.isArray(results[i].value) ? results[i].value : []) : [],
      }));
      setPeriodsCache(prev => ({ ...prev, [`${accountId}-${finYear}`]: { data: allResults } }));
    } catch (e: any) {
      setErrorYears(prev => ({ ...prev, [finYear]: e.message || 'Failed to load' }));
    } finally {
      setLoadingYears(prev => { const n = new Set(prev); n.delete(finYear); return n; });
    }
  }, [accountId, periodsCache]);

  useEffect(() => {
    if (multiView) {
      selectedYears.forEach(y => loadYear(y));
    } else {
      loadYear(selectedYear);
    }
  }, [multiView, selectedYear, selectedYears, loadYear]);

  const toggleYearSelection = (year: string) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        if (prev.length <= 1) return prev;
        return prev.filter(y => y !== year);
      }
      const newYears = [...prev, year].sort((a, b) => b.localeCompare(a));
      return newYears;
    });
    setExpandedYears(prev => { const n = new Set(prev); n.add(year); return n; });
  };

  const getPeriodData = (year: string): PeriodData => {
    const cached = periodsCache[`${accountId}-${year}`];
    const data = cached?.data || [];
    const pivotData = buildPivotData(data);
    const hasData = data.some(d => d.records.length > 0);
    return { year, data, pivotData, hasData };
  };

  const activeYears = multiView ? selectedYears : [selectedYear];
  const anyLoading = activeYears.some(y => loadingYears.has(y));
  const allPeriodsLoaded = activeYears.every(y => periodsCache[`${accountId}-${y}`]);

  const currentPeriod = getPeriodData(selectedYear);

  const exportToExcel = () => {
    const accNum = accountNumber || String(accountId);
    const periodsToExport = multiView
      ? selectedYears.map(y => getPeriodData(y))
      : [currentPeriod];

    const headers = ['Account Number', 'Description', 'Financial Year', ...MONTHS];
    const currCols = MONTHS.map((_, i) => i + 3);
    const yearGroups = periodsToExport
      .filter(p => p.hasData)
      .map(period => ({
        year: period.year,
        rows: period.pivotData.map((row: any) => [
          accNum,
          row.description || '',
          period.year,
          ...MONTHS.map(m => row[m] ?? 0),
        ]),
      }));

    const fileYearLabel = multiView ? selectedYears.map(y => y.replace('/', '-')).join('_') : selectedYear.replace('/', '-');
    downloadSummaryExcel({
      filename: `Transaction_Summary_${accNum}_${fileYearLabel}`,
      accountNumber: accNum,
      financialYears: multiView ? selectedYears : [selectedYear],
      headers,
      yearGroups,
      currencyColumns: currCols,
    });
  };

  const toggleExpanded = (year: string) => {
    setExpandedYears(prev => {
      const n = new Set(prev);
      if (n.has(year)) n.delete(year); else n.add(year);
      return n;
    });
  };

  const expandAll = () => setExpandedYears(new Set(selectedYears));
  const collapseAll = () => setExpandedYears(new Set());

  return (
    <div className="p-3 sm:p-5 space-y-4" data-testid="transaction-summary-panel">
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
        <h3 className="text-sm sm:text-base font-bold text-slate-800">Transaction Summary List per Fin-Year/Billing Period</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5" data-testid="view-toggle">
            <button
              onClick={() => setMultiView(false)}
              className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${!multiView ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              data-testid="btn-single-view"
            >
              <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline mr-1" />
              <span className="hidden sm:inline">Single Period</span>
              <span className="sm:hidden">Single</span>
            </button>
            <button
              onClick={() => { setMultiView(true); if (selectedYears.length === 0) setSelectedYears([selectedYear]); }}
              className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${multiView ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              data-testid="btn-multi-view"
            >
              <LayoutList className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline mr-1" />
              <span className="hidden sm:inline">Multi-Period</span>
              <span className="sm:hidden">Multi</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        {!multiView ? (
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
            data-testid="select-financial-year"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Periods:</span>
            {years.map(y => (
              <button
                key={y}
                onClick={() => toggleYearSelection(y)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                  selectedYears.includes(y)
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
                data-testid={`chip-year-${y}`}
              >
                {y}
                {loadingYears.has(y) && <Loader2 className="w-3 h-3 ml-1 inline animate-spin" />}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {multiView && selectedYears.length > 1 && (
            <>
              <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-800 hover:underline" data-testid="btn-expand-all">Expand All</button>
              <span className="text-slate-300">|</span>
              <button onClick={collapseAll} className="text-xs text-blue-600 hover:text-blue-800 hover:underline" data-testid="btn-collapse-all">Collapse All</button>
            </>
          )}
          <button
            onClick={exportToExcel}
            disabled={anyLoading || !allPeriodsLoaded}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="btn-export-txn-summary"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {anyLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading billing periods...
        </div>
      )}

      {!multiView ? (
        loadingYears.has(selectedYear) ? (
          <LoadingSkeleton />
        ) : errorYears[selectedYear] ? (
          <ErrorState message={errorYears[selectedYear]} onRetry={() => { setPeriodsCache(prev => { const n = { ...prev }; delete n[`${accountId}-${selectedYear}`]; return n; }); loadYear(selectedYear); }} />
        ) : (
          <>
            <SummaryTable pivotData={currentPeriod.pivotData} year={selectedYear} hasData={currentPeriod.hasData} />
            <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
              <span>Items per page: <span className="border rounded px-2 py-0.5">50</span></span>
              <span>{!currentPeriod.hasData ? '0 of 0' : `1 - ${currentPeriod.pivotData.length} of ${currentPeriod.pivotData.length}`}</span>
            </div>
          </>
        )
      ) : (
        <div className="space-y-3">
          {selectedYears.map(year => {
            if (loadingYears.has(year)) {
              return (
                <div key={year} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading {year}...
                  </div>
                </div>
              );
            }
            if (errorYears[year]) {
              return (
                <div key={year} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <p className="text-sm text-red-600">{year}: {errorYears[year]}</p>
                  <button className="text-xs text-red-700 underline mt-1" onClick={() => { setPeriodsCache(prev => { const n = { ...prev }; delete n[`${accountId}-${year}`]; return n; }); loadYear(year); }}>Retry</button>
                </div>
              );
            }
            const period = getPeriodData(year);
            return <PeriodSection key={year} period={period} expanded={expandedYears.has(year)} onToggle={() => toggleExpanded(year)} />;
          })}
        </div>
      )}
    </div>
  );
}

export function DetailedTransactionListTab({ accountId, accountNumber }: { accountId: number; accountNumber?: string }) {
  const [billingPeriodData, setBillingPeriodData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const years = useMemo(() => getFinYearOptions(), []);
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [initialised, setInitialised] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [txnDetailData, setTxnDetailData] = useState<any[] | string | null>(null);
  const [txnDetailLoading, setTxnDetailLoading] = useState(false);
  const [showCreditMeterOnly, setShowCreditMeterOnly] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFromMonth, setDownloadFromMonth] = useState('');
  const [downloadToMonth, setDownloadToMonth] = useState('');
  const [downloadYear, setDownloadYear] = useState(years[0]);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const lastKey = useRef('');

  const calendarMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const finYearMonths = ['July','August','September','October','November','December','January','February','March','April','May','June'];

  useEffect(() => {
    if (initialised) return;
    getBillingProcessingMonth().then((month: any) => {
      const m = typeof month === 'string' ? month.trim() : '';
      if (m && finYearMonths.includes(m)) {
        setSelectedMonth(m);
      } else {
        const now = new Date();
        setSelectedMonth(calendarMonths[now.getMonth()] || 'January');
      }
      setInitialised(true);
    }).catch(() => {
      const now = new Date();
      setSelectedMonth(calendarMonths[now.getMonth()] || 'January');
      setInitialised(true);
    });
  }, [initialised]);

  const load = useCallback(async (finYear: string, monthName: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBillingPeriodTransactions(accountId, finYear, monthName);
      setBillingPeriodData(Array.isArray(result) ? result : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load detailed transactions');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!initialised || !selectedMonth) return;
    const key = `${accountId}-${selectedYear}-${selectedMonth}`;
    if (lastKey.current !== key) {
      lastKey.current = key;
      load(selectedYear, selectedMonth);
    }
  }, [accountId, selectedYear, selectedMonth, load, initialised]);

  const detailedRows = useMemo(() => {
    if (!billingPeriodData || billingPeriodData.length === 0) return [];

    const mapped = billingPeriodData.map((row: any) => {
      const txDate = row.transactionDate ? new Date(row.transactionDate).toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const desc = row.description || '';
      const drilldown = (row.drilldown || '').toLowerCase();
      const descLower = desc.toLowerCase();
      const isPayment = drilldown === 'receipt' || descLower.includes('payment');
      const isLevy = drilldown === 'levy' || descLower.includes('levy');
      const isRebate = drilldown === 'rebate' || descLower.includes('rebate');
      const isInterest = drilldown === 'interest' || descLower.includes('interest');
      const isOpen = descLower.includes('opening balance') || descLower.includes('open balance');
      const isClose = descLower.includes('closing balance') || descLower.includes('close balance');

      return {
        transactionDate: txDate,
        description: desc,
        receiptId: row.transactionId || '',
        documentNumber: row.documentNumber || '',
        tariff: row.tariff || '',
        amount: row.amount ?? 0,
        interest: row.interestAmount ?? 0,
        vat: row.vatAmount ?? 0,
        total: row.totalAmount ?? 0,
        isPayment,
        isLevy,
        isRebate,
        isInterest,
        isSpecial: isOpen || isClose,
        isOpenBalance: isOpen,
        isCloseBalance: isClose,
        isBold: isClose,
        drilldown: row.drilldown || '',
        primaryId: row.primaryId || '',
        queryId: row.queryId,
        _raw: row,
      };
    });

    const filtered: any[] = [];
    let prevWasZeroOpen = false;
    let skippedZeroOpens = 0;
    let lastCloseTotal: number | null = null;
    let skippedCarryForwards = 0;

    for (let i = 0; i < mapped.length; i++) {
      const row = mapped[i];
      const allZero = row.amount === 0 && row.interest === 0 && row.vat === 0 && row.total === 0;

      if (row.isOpenBalance && allZero) {
        if (!prevWasZeroOpen) {
          filtered.push(row);
          prevWasZeroOpen = true;
        } else {
          skippedZeroOpens++;
        }
        continue;
      }

      if (prevWasZeroOpen && skippedZeroOpens > 0) {
        filtered.push({ ...row, description: `... ${skippedZeroOpens} more zero-balance month${skippedZeroOpens > 1 ? 's' : ''} omitted ...`, isSpecial: true, isOpenBalance: true, amount: 0, interest: 0, vat: 0, total: 0, _dimmed: true });
        skippedZeroOpens = 0;
      }
      prevWasZeroOpen = false;

      if ((row.isOpenBalance || row.isCloseBalance) && lastCloseTotal !== null && row.total === lastCloseTotal) {
        skippedCarryForwards++;
        continue;
      }

      if (skippedCarryForwards > 0 && !row.isOpenBalance && !row.isCloseBalance) {
        filtered.push({ ...mapped[i - 1], description: `... ${skippedCarryForwards} repeated carry-forward balance${skippedCarryForwards > 1 ? 's' : ''} omitted ...`, isSpecial: true, _dimmed: true });
        skippedCarryForwards = 0;
      }

      if (row.isCloseBalance) {
        lastCloseTotal = row.total;
      } else {
        lastCloseTotal = null;
        skippedCarryForwards = 0;
      }

      filtered.push(row);
    }

    if (skippedCarryForwards > 0) {
      filtered.push({ ...mapped[mapped.length - 1], description: `... ${skippedCarryForwards} repeated carry-forward balance${skippedCarryForwards > 1 ? 's' : ''} omitted ...`, isSpecial: true, _dimmed: true });
    }

    return filtered;
  }, [billingPeriodData]);

  const fmt = (v: any) => {
    if (v === undefined || v === null || v === '') return '';
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return String(v);
    if (num < 0) return `(${Math.abs(num).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})`;
    return num.toLocaleString('en-ZA', { minimumFractionDigits: 2 });
  };

  const handleRowClick = async (row: any) => {
    setSelectedTxn(row);
    setTxnDetailData(null);
    setTxnDetailLoading(true);
    try {
      let detail: any[] | string = [];
      const drilldown = (row.drilldown || '').toLowerCase();
      const pId = row.primaryId != null ? String(row.primaryId) : null;
      const pIdNum = pId ? parseInt(pId) : 0;
      const bMonth = row.billingMonth ?? row.billingmonth;
      const bMonthNum = bMonth != null ? parseInt(bMonth) : undefined;

      if (drilldown === 'openbalance' && pId) {
        detail = await getOpenBalanceDetail(pId, bMonthNum);
      } else if (drilldown === 'closebalance' && pId) {
        detail = await getCloseBalanceDetail(pId, bMonthNum);
      } else if (drilldown === 'receipt' && pIdNum) {
        const result = await getReceiptTransactionDetail(pIdNum);
        if (typeof result === 'string') {
          setTxnDetailData(result as any);
          setTxnDetailLoading(false);
          return;
        }
        detail = Array.isArray(result) ? result : result ? [result] : [];
      } else if (drilldown === 'levy' && pIdNum) {
        detail = await getLevyTransactionDetail(pIdNum);
      } else if (drilldown === 'rebate' && pId) {
        detail = await getRebateTransactionDetail(pId);
      } else if (drilldown === 'interest') {
        detail = await getInterestConsPaymentDetail(accountId, selectedYear);
      } else if (drilldown === 'journal' && pId) {
        detail = await getJournalTransactionDetails(pId, accountId);
      } else if (row.isSpecial && row.description?.toLowerCase().includes('open') && pId) {
        detail = await getOpenBalanceDetail(pId, bMonthNum);
      } else if (row.isSpecial && row.description?.toLowerCase().includes('clos') && pId) {
        detail = await getCloseBalanceDetail(pId, bMonthNum);
      } else if (pId) {
        detail = await getJournalTransactionDetails(pId, accountId);
      } else {
        detail = [];
      }
      if (typeof detail === 'string') {
        setTxnDetailData(detail as any);
        setTxnDetailLoading(false);
        return;
      }
      setTxnDetailData(detail);
    } catch (e) {
      console.error('Failed to load transaction detail:', e);
      setTxnDetailData([]);
    } finally {
      setTxnDetailLoading(false);
    }
  };

  const txnHeaders = ['Transaction Date', 'Transaction Description', 'Receipt ID / Doc Transaction ID', 'Document Number', 'Tariff', 'Amount', 'Interest', 'VAT', 'Total'];
  const txnCurrencyCols = [5, 6, 7, 8];

  const mapTxnRows = (rows: any[]) => rows.map((row: any) => [
    row.transactionDate ? new Date(row.transactionDate).toLocaleDateString('en-ZA') : '',
    row.description || '',
    row.transactionId || '',
    row.documentNumber || '',
    row.tariff || '',
    row.amount ?? 0,
    row.interestAmount ?? 0,
    row.vatAmount ?? 0,
    row.totalAmount ?? 0,
  ]);

  const handleDownloadCurrentMonth = () => {
    const acctLabel = accountNumber || String(accountId);
    downloadTransactionExcel({
      filename: `DetailedTransactions_${acctLabel}_${selectedYear.replace('/', '-')}_${selectedMonth}`,
      accountNumber: acctLabel,
      reportName: 'Detailed Transactions',
      financialYear: selectedYear,
      period: selectedMonth,
      headers: txnHeaders,
      monthGroups: [{ month: `${selectedMonth} ${selectedYear}`, rows: mapTxnRows(billingPeriodData) }],
      currencyColumns: txnCurrencyCols,
    });
  };

  const handleDownloadRange = async () => {
    if (!downloadFromMonth || !downloadToMonth) return;
    const fromIdx = finYearMonths.indexOf(downloadFromMonth);
    const toIdx = finYearMonths.indexOf(downloadToMonth);
    if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx) return;

    setDownloading(true);
    const monthsToFetch = finYearMonths.slice(fromIdx, toIdx + 1);
    const acctLabel = accountNumber || String(accountId);

    try {
      setDownloadProgress(`Fetching ${monthsToFetch.length} month${monthsToFetch.length > 1 ? 's' : ''} in parallel...`);
      const results = await Promise.allSettled(
        monthsToFetch.map(month => getBillingPeriodTransactions(accountId, downloadYear, month))
      );
      const monthGroups = monthsToFetch.map((month, i) => {
        const rows = results[i].status === 'fulfilled' ? (Array.isArray(results[i].value) ? results[i].value : []) : [];
        return { month: `${month} ${downloadYear}`, rows: mapTxnRows(rows) };
      });
      setDownloadProgress('Preparing download...');
      const fromLabel = downloadFromMonth.slice(0, 3);
      const toLabel = downloadToMonth.slice(0, 3);
      downloadTransactionExcel({
        filename: `DetailedTransactions_${acctLabel}_${downloadYear.replace('/', '-')}_${fromLabel}-${toLabel}`,
        accountNumber: acctLabel,
        reportName: 'Detailed Transactions',
        financialYear: downloadYear,
        period: `${downloadFromMonth} to ${downloadToMonth}`,
        headers: txnHeaders,
        monthGroups,
        currencyColumns: txnCurrencyCols,
      });
      setShowDownloadModal(false);
    } catch (e: any) {
      setDownloadProgress(`Error: ${e.message || 'Download failed'}`);
    } finally {
      setDownloading(false);
    }
  };

  const openDownloadModal = () => {
    setDownloadFromMonth(selectedMonth);
    setDownloadToMonth(selectedMonth);
    setDownloadYear(selectedYear);
    setDownloadProgress('');
    setShowDownloadModal(true);
  };

  if (!initialised || (loading && !billingPeriodData.length)) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => load(selectedYear, selectedMonth)} />;

  return (
    <div className="p-3 sm:p-5 space-y-3 sm:space-y-5" data-testid="detailed-transaction-panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm sm:text-base font-bold text-slate-800">Detailed Transaction List per Billing Period</h3>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadCurrentMonth} disabled={detailedRows.length === 0} className="text-[10px] sm:text-xs gap-1 sm:gap-1.5 px-2 sm:px-3" data-testid="button-download-current">
            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Download {selectedMonth}</span>
            <span className="sm:hidden">{selectedMonth?.slice(0, 3)}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openDownloadModal} className="text-[10px] sm:text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 border-blue-200 text-blue-700 hover:bg-blue-50" data-testid="button-download-range">
            <CalendarDays className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Download Range</span>
            <span className="sm:hidden">Range</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-600">
          <input type="checkbox" checked={showCreditMeterOnly} onChange={e => setShowCreditMeterOnly(e.target.checked)} className="rounded" data-testid="checkbox-credit-meter" />
          <span className="hidden sm:inline">Show Credit Meter Consumption Journal only</span>
          <span className="sm:hidden">Credit Meter only</span>
        </label>
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="border border-slate-300 rounded px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-white" data-testid="select-detail-year">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
          {years.length === 0 && <option value="">No data</option>}
        </select>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border border-slate-300 rounded px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-white" data-testid="select-detail-month">
          {finYearMonths.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2" data-testid="detailed-transactions-mobile">
        {detailedRows.length === 0 ? (
          <div className="text-center text-slate-400 py-8 text-sm">No records to display</div>
        ) : detailedRows.map((row: any, i: number) => {
          if (row._dimmed) {
            return (
              <div key={i} className="text-center text-[10px] italic text-slate-400 py-1.5 border-b border-dashed border-slate-200" data-testid={`detail-card-${i}`}>{row.description}</div>
            );
          }
          return (
            <div
              key={i}
              onClick={() => handleRowClick(row)}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${row.isBold ? 'bg-amber-50/50 border-amber-200' : row.isOpenBalance ? 'bg-blue-50/30 border-blue-200' : row.isCloseBalance ? 'bg-amber-50/50 border-amber-200' : row.isPayment ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}
              data-testid={`detail-card-${i}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] font-semibold truncate ${row.isBold ? 'font-bold text-slate-900' : row.isOpenBalance ? 'text-blue-600 italic' : row.isCloseBalance ? 'text-amber-800' : row.isPayment ? 'text-red-600' : 'text-slate-800'}`}>{row.description}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{row.transactionDate}</div>
                </div>
                <div className={`text-right shrink-0 font-mono text-sm font-bold ${row.isBold ? 'font-bold' : ''} ${(row.total || 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmt(row.total)}</div>
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[10px]">
                <div><span className="text-slate-400">Amt:</span> <span className={`font-mono ${(row.amount || 0) < 0 ? 'text-red-600' : 'text-slate-700'}`}>{fmt(row.amount)}</span></div>
                <div><span className="text-slate-400">Int:</span> <span className="font-mono text-slate-700">{fmt(row.interest)}</span></div>
                <div><span className="text-slate-400">VAT:</span> <span className={`font-mono ${(row.vat || 0) < 0 ? 'text-red-600' : 'text-slate-700'}`}>{fmt(row.vat)}</span></div>
              </div>
              {(row.receiptId || row.tariff) && (
                <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                  {row.receiptId && <span>ID: {row.receiptId}</span>}
                  {row.tariff && <span className="truncate">Tariff: {row.tariff}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded">
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
            ) : detailedRows.map((row: any, i: number) => {
              if (row._dimmed) {
                return (
                  <tr key={i} className="border-b border-dashed border-slate-200 bg-slate-50/50" data-testid={`detail-row-${i}`}>
                    <td colSpan={9} className="px-3 py-1.5 text-center text-[10px] italic text-slate-400">{row.description}</td>
                  </tr>
                );
              }
              return (
              <tr
                key={i}
                className={`border-b border-slate-100 cursor-pointer ${row.isBold ? 'bg-amber-50/50 font-bold border-t border-amber-200' : ''} ${row.isOpenBalance ? 'bg-blue-50/30' : ''} ${row.isCloseBalance ? 'bg-amber-50/50 border-t border-amber-200' : ''} ${row.isPayment ? 'hover:bg-blue-50 text-red-600' : 'hover:bg-slate-50'}`}
                onClick={() => handleRowClick(row)}
                data-testid={`detail-row-${i}`}
              >
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.transactionDate}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${row.isBold ? 'font-bold text-slate-900' : row.isOpenBalance ? 'text-blue-600 italic text-[11px]' : row.isCloseBalance ? 'font-semibold text-amber-800' : row.isPayment ? 'text-red-600' : 'text-slate-700'}`}>{row.description}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.receiptId || ''}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.documentNumber || ''}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[300px] truncate" title={row.tariff || ''}>{row.tariff || ''}</td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${(row.amount || 0) < 0 ? 'text-red-600' : ''}`}>{fmt(row.amount)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{fmt(row.interest)}</td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${(row.vat || 0) < 0 ? 'text-red-600' : ''}`}>{fmt(row.vat)}</td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${row.isBold ? 'font-bold' : ''} ${(row.total || 0) < 0 ? 'text-red-600' : ''}`}>{fmt(row.total)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 text-[10px] sm:text-xs text-slate-500">
        <span>Items per page: <span className="border rounded px-2 py-0.5">50</span></span>
        <span>{detailedRows.length === 0 ? '0 of 0' : `1 - ${detailedRows.length} of ${detailedRows.length}`}</span>
      </div>

      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !downloading && setShowDownloadModal(false)} data-testid="download-range-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/15 flex items-center justify-center">
                  <Download className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">Download Transaction Data</h4>
                  <p className="text-[10px] sm:text-[11px] text-blue-200">Select a period range to export</p>
                </div>
              </div>
              {!downloading && (
                <button onClick={() => setShowDownloadModal(false)} className="text-white/70 hover:text-white text-lg font-bold w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors" data-testid="button-close-download">&times;</button>
              )}
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 sm:mb-2">Financial Year</label>
                <select value={downloadYear} onChange={e => setDownloadYear(e.target.value)} disabled={downloading} className="w-full border border-slate-300 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-white disabled:opacity-50" data-testid="select-download-year">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 sm:mb-2">From Period</label>
                  <select value={downloadFromMonth} onChange={e => { setDownloadFromMonth(e.target.value); if (finYearMonths.indexOf(e.target.value) > finYearMonths.indexOf(downloadToMonth)) setDownloadToMonth(e.target.value); }} disabled={downloading} className="w-full border border-slate-300 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-white disabled:opacity-50" data-testid="select-download-from">
                    {finYearMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 sm:mb-2">To Period</label>
                  <select value={downloadToMonth} onChange={e => setDownloadToMonth(e.target.value)} disabled={downloading} className="w-full border border-slate-300 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-white disabled:opacity-50" data-testid="select-download-to">
                    {finYearMonths.filter(m => finYearMonths.indexOf(m) >= finYearMonths.indexOf(downloadFromMonth)).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {downloadFromMonth && downloadToMonth && (
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-100">
                  <CalendarDays className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    {finYearMonths.indexOf(downloadFromMonth) === finYearMonths.indexOf(downloadToMonth)
                      ? <span>Downloading <strong>{downloadFromMonth} {downloadYear}</strong></span>
                      : <span>Downloading <strong>{downloadFromMonth}</strong> to <strong>{downloadToMonth}</strong> ({finYearMonths.indexOf(downloadToMonth) - finYearMonths.indexOf(downloadFromMonth) + 1} months) for <strong>{downloadYear}</strong></span>
                    }
                  </p>
                </div>
              )}

              {downloading && downloadProgress && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{downloadProgress}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{
                      width: downloadProgress.includes('Error') ? '100%' :
                        downloadProgress.includes('Preparing') ? '95%' :
                        `${((parseInt(downloadProgress.match(/\d+(?= of)/)?.[0] || '0') / parseInt(downloadProgress.match(/of (\d+)/)?.[1] || '1')) * 100)}%`
                    }} />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowDownloadModal(false)} disabled={downloading} data-testid="button-cancel-download">Cancel</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleDownloadRange} disabled={downloading || !downloadFromMonth || !downloadToMonth} data-testid="button-confirm-download">
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloading ? 'Downloading...' : 'Download Excel'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedTxn(null); setTxnDetailData(null); }} data-testid="txn-detail-overlay">
          <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] w-full max-h-[95vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white">Transaction Detail & Ledger Posting</h4>
                  <p className="text-[10px] sm:text-[11px] text-blue-200 truncate">{selectedTxn.description} — {selectedTxn.transactionDate}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedTxn(null); setTxnDetailData(null); }} className="text-white/70 hover:text-white text-xl font-bold w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors" data-testid="button-close-detail">&times;</button>
            </div>

            <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 sm:px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <h5 className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Transaction Summary</h5>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Description</div>
                    <div className="text-sm font-medium text-slate-800 mt-0.5">{selectedTxn.description || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Date</div>
                    <div className="text-sm font-mono text-slate-700 mt-0.5">{selectedTxn.transactionDate || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Receipt / Doc ID</div>
                    <div className="text-sm font-mono text-slate-700 mt-0.5">{selectedTxn.receiptId || selectedTxn.documentNumber || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Tariff</div>
                    <div className="text-sm text-slate-700 mt-0.5">{selectedTxn.tariff || '-'}</div>
                  </div>
                </div>
                <div className="border-t border-slate-100">
                  <div className="sm:hidden grid grid-cols-2 gap-px bg-slate-200">
                    {[
                      { label: 'Amount', value: fmt(selectedTxn.amount), color: (selectedTxn.amount || 0) < 0 ? 'text-red-600' : 'text-slate-800', bold: true },
                      { label: 'Interest', value: fmt(selectedTxn.interest ?? 0), color: 'text-slate-700', bold: false },
                      { label: 'VAT', value: fmt(selectedTxn.vat ?? 0), color: 'text-slate-700', bold: false },
                      { label: 'Total', value: fmt(selectedTxn.total), color: (selectedTxn.total || 0) < 0 ? 'text-red-600' : 'text-blue-700', bold: true },
                    ].map(item => (
                      <div key={item.label} className="bg-white p-2.5 flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-wider text-teal-700 font-semibold">{item.label}</span>
                        <span className={`font-mono text-sm ${item.bold ? 'font-bold' : 'font-semibold'} ${item.color}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="hidden sm:block">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
                          <th className="px-3 py-2 text-right font-semibold">Amount</th>
                          <th className="px-3 py-2 text-right font-semibold">Interest</th>
                          <th className="px-3 py-2 text-right font-semibold">VAT</th>
                          <th className="px-3 py-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className={`px-3 py-2.5 text-right font-mono font-semibold ${(selectedTxn.amount || 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmt(selectedTxn.amount)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmt(selectedTxn.interest ?? 0)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmt(selectedTxn.vat ?? 0)}</td>
                          <td className={`px-3 py-2.5 text-right font-mono font-bold ${(selectedTxn.total || 0) < 0 ? 'text-red-600' : 'text-blue-700'}`}>{fmt(selectedTxn.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 sm:px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 sm:gap-2">
                  <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 shrink-0" />
                  <h5 className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Detail & Ledger Postings</h5>
                </div>
                {txnDetailLoading ? (
                  <div className="p-8 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">Loading detail...</span>
                  </div>
                ) : typeof txnDetailData === 'string' && txnDetailData.length > 0 ? (
                  <>
                    <div className="sm:hidden p-2">
                      <HtmlDetailMobileCards html={txnDetailData} />
                    </div>
                    <div className="hidden sm:block p-2 sm:p-4 overflow-x-auto platinum-detail-html" dangerouslySetInnerHTML={{ __html: txnDetailData }} />
                  </>
                ) : Array.isArray(txnDetailData) && txnDetailData.length > 0 ? (
                  <>
                    <div className="sm:hidden p-2 space-y-2">
                      {txnDetailData.map((row: any, ri: number) => {
                        const keys = Object.keys(row).filter(k => !k.startsWith('_') && k !== 'id').slice(0, 12);
                        return (
                          <div key={ri} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                            {keys.map(key => {
                              const val = row[key];
                              const isNum = typeof val === 'number';
                              const isNeg = isNum && val < 0;
                              const isDate = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val);
                              const formatted = isDate ? new Date(val).toLocaleDateString('en-ZA') : isNum ? fmt(val) : val != null ? String(val) : '-';
                              const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
                              return (
                                <div key={key} className="flex justify-between items-baseline gap-2">
                                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold shrink-0">{label}</span>
                                  <span className={`text-xs text-right ${isNum ? 'font-mono font-semibold' : ''} ${isNeg ? 'text-red-600' : 'text-slate-700'}`}>{formatted}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            {Object.keys(txnDetailData[0]).filter(k => !k.startsWith('_') && k !== 'id').slice(0, 12).map(key => (
                              <th key={key} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap text-[10px] uppercase tracking-wider">
                                {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {txnDetailData.map((row: any, ri: number) => {
                            const keys = Object.keys(row).filter(k => !k.startsWith('_') && k !== 'id').slice(0, 12);
                            return (
                              <tr key={ri} className="border-b border-slate-100 hover:bg-blue-50/30">
                                {keys.map(key => {
                                  const val = row[key];
                                  const isNum = typeof val === 'number';
                                  const isNeg = isNum && val < 0;
                                  const isDate = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val);
                                  return (
                                    <td key={key} className={`px-3 py-2 whitespace-nowrap ${isNum ? 'text-right font-mono' : ''} ${isNeg ? 'text-red-600' : 'text-slate-700'}`}>
                                      {isDate ? new Date(val).toLocaleDateString('en-ZA') : isNum ? fmt(val) : val != null ? String(val) : '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : txnDetailData !== null ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    <Activity className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    No detail data available for this transaction
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => { setSelectedTxn(null); setTxnDetailData(null); }} className="px-6 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors" data-testid="button-close-detail-bottom">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TransactionHistoryTab({ accountId, accountNumber }: { accountId: number; accountNumber: string }) {
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
  const [receiptView, setReceiptView] = useState<'table' | 'timeline'>('timeline');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'cash' | 'card' | 'eft'>('all');
  const [timelineSortAsc, setTimelineSortAsc] = useState(false);

  const sortedReceipts = useMemo(() =>
    [...data].sort((a, b) => {
      const da = a.receiptDate ? new Date(a.receiptDate).getTime() : 0;
      const db = b.receiptDate ? new Date(b.receiptDate).getTime() : 0;
      return db - da;
    }),
  [data]);

  const totalAmount = useMemo(() => sortedReceipts.reduce((s, r) => s + (r.amount ?? 0), 0), [sortedReceipts]);

  const filteredReceipts = useMemo(() => {
    let items = [...data];
    if (timelineFilter !== 'all') {
      items = items.filter(r => {
        const pt = (r.paymentType || '').toLowerCase();
        if (timelineFilter === 'cash') return pt.includes('cash');
        if (timelineFilter === 'card') return pt.includes('card') || pt.includes('credit');
        if (timelineFilter === 'eft') return pt.includes('eft') || pt.includes('electronic') || pt.includes('transfer');
        return true;
      });
    }
    items.sort((a, b) => {
      const da = a.receiptDate ? new Date(a.receiptDate).getTime() : 0;
      const db = b.receiptDate ? new Date(b.receiptDate).getTime() : 0;
      return timelineSortAsc ? da - db : db - da;
    });
    return items;
  }, [data, timelineFilter, timelineSortAsc]);

  const groupedByMonth = useMemo(() => {
    const groups: { key: string; label: string; year: number; month: number; items: any[]; total: number }[] = [];
    const map = new Map<string, any[]>();
    for (const r of filteredReceipts) {
      const d = r.receiptDate ? new Date(r.receiptDate) : null;
      const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const [key, items] of Array.from(map.entries())) {
      const d = items[0]?.receiptDate ? new Date(items[0].receiptDate) : null;
      groups.push({
        key,
        label: d ? d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' }) : 'Unknown Date',
        year: d ? d.getFullYear() : 0,
        month: d ? d.getMonth() : 0,
        items,
        total: items.reduce((s: number, r: any) => s + (r.amount ?? 0), 0),
      });
    }
    return groups;
  }, [filteredReceipts]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const handlePrintReceipt = async (item: any) => {
    const receiptId = item.receiptId || item.receipt_ID;
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
      const multiData = await fetchPosMultiReceiptPrint(receiptId);
      const first: any = Array.isArray(multiData) && multiData.length > 0 ? multiData[0] : null;

      const services = Array.isArray(multiData) ? multiData.map((s: any) => ({
        serviceDescription: s.serviceDescription || s.description || s.service || '',
        amount: s.amount ?? s.serviceAmount ?? 0,
      })) : [];

      const totalFromServices = services.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

      const preview = {
        receiptNo: first?.receiptNo || first?.receiptNumber || item.receiptNo || '',
        receiptDate: first?.receiptDate || item.receiptDate || '',
        accountNumber: first?.accountNumber || first?.accountNo || accountNumber || '',
        consumerName: first?.consumerName || first?.consumer || item.consumerName || '',
        municipalityName: first?.municipalityName || 'George Municipality',
        address: first?.address || '',
        totalAmount: totalFromServices > 0 ? totalFromServices : (item.amount ?? 0),
        paymentType: first?.paymentType || item.paymentType || '',
        cashierName: first?.cashierName || first?.cashier || item.cashierName || '',
        services,
      };
      setReceiptPreview(preview);
    } catch (e) {
      console.error('Failed to fetch receipt for preview:', e);
      setReceiptPreview({
        receiptNo: item.receiptNo || '',
        receiptDate: item.receiptDate || '',
        accountNumber: accountNumber || '',
        consumerName: item.consumerName || '',
        municipalityName: 'George Municipality',
        address: '',
        totalAmount: item.amount ?? 0,
        paymentType: item.paymentType || '',
        cashierName: item.cashierName || '',
        services: [],
      });
    } finally {
      setPrintingId(null);
    }
  };

  const handlePrintWindow = () => {
    if (!receiptPreview) return;
    const printData: ReceiptPrintData = {
      receiptNo: receiptPreview.receiptNo || receiptPreview.receiptNumber || '',
      receiptDate: receiptPreview.receiptDate || '',
      accountNumber: receiptPreview.accountNumber || accountNumber,
      consumerName: receiptPreview.consumerName || '',
      municipalityName: receiptPreview.municipalityName || 'George Municipality',
      address: receiptPreview.address || '',
      totalAmount: receiptPreview.totalAmount ?? receiptPreview.amount ?? 0,
      paymentType: receiptPreview.paymentType || '',
      cashierName: receiptPreview.cashierName || '',
      services: Array.isArray(receiptPreview.services) ? receiptPreview.services : [],
    };
    openSlipPrintWindow(printData, true);
  };

  return (
    <div className="p-3 sm:p-5 space-y-3 sm:space-y-5">
      {receiptPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReceiptPreview(null)} data-testid="receipt-preview-overlay">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-white" />
                <h4 className="text-xs sm:text-sm font-bold text-white">Receipt Preview</h4>
              </div>
              <button onClick={() => setReceiptPreview(null)} className="text-white/70 hover:text-white text-xl font-bold w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center" data-testid="button-close-receipt-preview">&times;</button>
            </div>
            <div className="p-3 sm:p-5 space-y-3 font-mono text-xs sm:text-sm">
              <div className="text-center">
                <h3 className="font-bold text-slate-800">{receiptPreview.municipalityName || 'George Municipality'}</h3>
                <p className="text-xs text-slate-500">{receiptPreview.address || ''}</p>
              </div>
              <div className="border-t border-dashed border-slate-300 my-2" />
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-slate-500">Receipt:</span><span className="font-semibold text-slate-800">{receiptPreview.receiptNo || receiptPreview.receiptNumber || '-'}</span>
                <span className="text-slate-500">Date:</span><span className="text-slate-700">{receiptPreview.receiptDate || '-'}</span>
                <span className="text-slate-500">Account:</span><span className="text-slate-700">{receiptPreview.accountNumber || accountNumber}</span>
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
                <span className="text-blue-700">R {(receiptPreview.totalAmount ?? receiptPreview.amount ?? 0).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-slate-500">Payment:</span><span className="text-slate-700">{receiptPreview.paymentType || '-'}</span>
                <span className="text-slate-500">Cashier:</span><span className="text-slate-700">{receiptPreview.cashierName || '-'}</span>
              </div>
            </div>
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button onClick={() => setReceiptPreview(null)} className="px-3 sm:px-4 py-1.5 sm:py-2 border border-slate-300 text-slate-600 text-[10px] sm:text-xs font-semibold rounded-lg hover:bg-slate-50" data-testid="button-close-receipt">Close</button>
              <button onClick={handlePrintWindow} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[10px] sm:text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-1.5 shadow-sm" data-testid="button-print-receipt-confirm">
                <FileText className="w-3.5 h-3.5" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 sm:p-1.5 shadow-sm w-full sm:w-fit overflow-x-auto">
        {[
          { key: 'receipts', label: 'Receipt History', shortLabel: 'Receipts', count: data.length, icon: Receipt },
          { key: 'billing', label: 'Billing Period', shortLabel: 'Billing', count: billingPeriodTxns.length, icon: CalendarDays },
          { key: 'detailed', label: 'Detailed Transactions', shortLabel: 'Detailed', count: detailedTxns.length, icon: FileText },
        ].map(sub => {
          const Icon = sub.icon;
          return (
            <button
              key={sub.key}
              onClick={() => setActiveSubTab(sub.key)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${activeSubTab === sub.key ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              data-testid={`button-subtab-${sub.key}`}
            >
              <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">{sub.label}</span>
              <span className="sm:hidden">{sub.shortLabel}</span>
              <span className={`ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold ${activeSubTab === sub.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{sub.count}</span>
            </button>
          );
        })}
      </div>

      {activeSubTab === 'receipts' && (
        data.length === 0 ? <EmptyState message="No receipt history found" /> : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-semibold text-white tracking-wide">Receipt History</h3>
                  <Badge className="bg-white/20 text-white border-white/30 text-[10px]">{data.length} receipts</Badge>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center bg-white/15 rounded-lg p-0.5">
                    <button
                      onClick={() => setReceiptView('timeline')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${receiptView === 'timeline' ? 'bg-white text-blue-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                      data-testid="button-receipt-view-timeline"
                    >
                      <Clock className="w-3 h-3" /> Timeline
                    </button>
                    <button
                      onClick={() => setReceiptView('table')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${receiptView === 'table' ? 'bg-white text-blue-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                      data-testid="button-receipt-view-table"
                    >
                      <List className="w-3 h-3" /> Table
                    </button>
                  </div>
                  <div className="text-white text-xs sm:text-sm font-mono font-bold">
                    R {totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {receiptView === 'timeline' && (
                <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Filter:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {([
                      { key: 'all', label: 'All', icon: null },
                      { key: 'cash', label: 'Cash', icon: Banknote },
                      { key: 'card', label: 'Card', icon: CreditCard },
                      { key: 'eft', label: 'EFT', icon: null },
                    ] as const).map(f => {
                      const Icon = f.icon;
                      return (
                        <button
                          key={f.key}
                          onClick={() => setTimelineFilter(f.key)}
                          className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${timelineFilter === f.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                          data-testid={`button-filter-${f.key}`}
                        >
                          {Icon && <Icon className="w-3 h-3" />}
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setTimelineSortAsc(prev => !prev)}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all"
                    data-testid="button-sort-timeline"
                  >
                    {timelineSortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {timelineSortAsc ? 'Oldest First' : 'Newest First'}
                  </button>
                </div>
              )}

              {receiptView === 'timeline' ? (
                <div className="px-3 sm:px-6 py-3 sm:py-4 space-y-4 sm:space-y-6 max-h-[70vh] overflow-y-auto" data-testid="receipt-timeline">
                  {filteredReceipts.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm italic">No receipts match the selected filter.</div>
                  ) : groupedByMonth.map(group => (
                    <div key={group.key} className="relative">
                      <div className="sticky top-0 z-10 flex items-center gap-3 mb-3 bg-white/95 backdrop-blur-sm py-1">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1.5 rounded-lg shadow-sm">
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold tracking-wide">{group.label}</span>
                        </div>
                        <div className="flex-1 h-px bg-slate-200" />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-medium">{group.items.length} receipt{group.items.length !== 1 ? 's' : ''}</span>
                          <span className="text-xs font-mono font-bold text-slate-700">R {group.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="relative ml-4 sm:ml-6 border-l-2 border-blue-200 pl-4 sm:pl-6 space-y-3">
                        {group.items.map((item: any, i: number) => {
                          const pt = (item.paymentType || '').toLowerCase();
                          const isCash = pt.includes('cash');
                          const isCard = pt.includes('card') || pt.includes('credit');
                          const isEft = pt.includes('eft') || pt.includes('electronic') || pt.includes('transfer');
                          const isCancelled = !!item.isCancelled;
                          const receiptDate = item.receiptDate ? new Date(item.receiptDate) : null;

                          const dotColor = isCancelled ? 'bg-red-500' :
                            isCash ? 'bg-green-500' :
                            isCard ? 'bg-purple-500' :
                            isEft ? 'bg-blue-500' : 'bg-slate-400';

                          const cardBg = isCancelled ? 'bg-red-50/50 border-red-200 hover:border-red-300' :
                            'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md';

                          return (
                            <div key={item.receiptId || i} className="relative group" data-testid={`timeline-receipt-${i}`}>
                              <div className={`absolute -left-[1.4rem] sm:-left-[1.65rem] top-3 w-3 h-3 rounded-full ${dotColor} ring-2 ring-white shadow-sm z-[1]`} />

                              <div className={`rounded-xl border shadow-sm transition-all duration-200 ${cardBg}`}>
                                <div className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                      isCancelled ? 'bg-red-100 text-red-600' :
                                      isCash ? 'bg-green-100 text-green-700' :
                                      isCard ? 'bg-purple-100 text-purple-700' :
                                      isEft ? 'bg-blue-100 text-blue-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {isCash ? <Banknote className="w-4 h-4 sm:w-5 sm:h-5" /> :
                                       isCard ? <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" /> :
                                       <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-blue-700">{item.receiptNo || '-'}</span>
                                        {isCancelled && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
                                            <XCircle className="w-2.5 h-2.5" /> Cancelled
                                          </span>
                                        )}
                                        {!isCancelled && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <CheckCircle2 className="w-2.5 h-2.5" /> Active
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 sm:gap-3 mt-0.5 flex-wrap">
                                        <span className="text-[11px] text-slate-500">
                                          {receiptDate ? receiptDate.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                        </span>
                                        {receiptDate && (
                                          <span className="text-[10px] text-slate-400">
                                            {receiptDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
                                          isCash ? 'bg-green-50 text-green-700 border border-green-200' :
                                          isCard ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                          isEft ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                          'bg-slate-50 text-slate-600 border border-slate-200'
                                        }`}>
                                          {item.paymentType || 'Unknown'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end">
                                    <div className="text-right">
                                      <div className={`font-mono text-base sm:text-lg font-bold ${isCancelled ? 'text-red-600 line-through' : 'text-slate-800'}`}>
                                        R {(item.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handlePrintReceipt(item)}
                                      disabled={printingId === String(item.receiptId || item.receipt_ID) || !item.receiptId}
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[10px] font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                      data-testid={`button-print-timeline-${i}`}
                                    >
                                      {printingId === String(item.receiptId || item.receipt_ID) ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <FileText className="w-3 h-3" />
                                      )}
                                      Print
                                    </button>
                                  </div>
                                </div>

                                <div className="px-3 sm:px-4 py-2 bg-slate-50/70 rounded-b-xl border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] sm:text-[11px] text-slate-500">
                                  {item.cashierName && (
                                    <span><span className="font-semibold text-slate-600">Cashier:</span> {item.cashierName}</span>
                                  )}
                                  {item.cashBook && (
                                    <span><span className="font-semibold text-slate-600">Cash Book:</span> {item.cashBook}</span>
                                  )}
                                  {item.cardChequeDetail && (
                                    <span><span className="font-semibold text-slate-600">Detail:</span> {item.cardChequeDetail}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                {/* Mobile card view for receipt table */}
                <div className="sm:hidden p-2 space-y-2">
                  {sortedReceipts.map((item: any, i: number) => (
                    <div key={item.receiptId || i} className={`border rounded-lg p-3 ${item.isCancelled ? 'bg-red-50/30 border-red-200' : 'bg-white border-slate-200'}`} data-testid={`receipt-card-${i}`}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <div className="font-mono text-xs font-bold text-blue-700">{item.receiptNo || '-'}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{item.receiptDate ? new Date(item.receiptDate).toLocaleDateString('en-ZA') : '-'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-slate-800">R {(item.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                          {item.isCancelled ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-100 text-red-700"><X className="w-2.5 h-2.5" /> Cancelled</span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700"><Activity className="w-2.5 h-2.5" /> Active</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium ${
                            (item.paymentType || '').toLowerCase().includes('cash') ? 'bg-green-50 text-green-700' :
                            (item.paymentType || '').toLowerCase().includes('card') ? 'bg-purple-50 text-purple-700' :
                            'bg-slate-50 text-slate-600'
                          }`}>{item.paymentType || '-'}</span>
                          {item.cashierName && <span>• {item.cashierName}</span>}
                        </div>
                        <button
                          onClick={() => handlePrintReceipt(item)}
                          disabled={printingId === String(item.receiptId || item.receipt_ID) || !item.receiptId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[10px] font-semibold rounded-lg disabled:opacity-40 shrink-0"
                          data-testid={`button-print-receipt-mobile-${i}`}
                        >
                          {printingId === String(item.receiptId || item.receipt_ID) ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                          Print
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table view */}
                <div className="hidden sm:block overflow-x-auto">
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
                </>
              )}
            </div>
          </div>
        )
      )}

      {activeSubTab === 'billing' && (
        billingPeriodTxns.length === 0 ? <EmptyState message="No billing period transactions found" /> : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white" />
              <h3 className="text-sm font-semibold text-white tracking-wide">Billing Period Transactions</h3>
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{billingPeriodTxns.length}</Badge>
            </div>
            {/* Mobile card view for billing period */}
            <div className="sm:hidden p-2 space-y-2">
              {billingPeriodTxns.map((item: any, i: number) => {
                const isOpenClose = (item.description || '').toLowerCase().includes('balance');
                const fmtAmt = (v: number) => v !== 0 ? v.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '0,00';
                return (
                  <div key={i} className={`border rounded-lg p-3 ${isOpenClose ? 'bg-slate-50/50 border-slate-300' : 'bg-white border-slate-200'}`} data-testid={`billing-card-${i}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11px] font-semibold truncate ${isOpenClose ? 'font-bold text-slate-900' : 'text-slate-800'}`}>{item.description || '-'}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.transactionDate ? new Date(item.transactionDate).toLocaleDateString('en-ZA') : '-'}</div>
                      </div>
                      <div className="font-mono text-sm font-bold text-slate-800 shrink-0">{fmtAmt(item.totalAmount ?? 0)}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 text-[10px]">
                      <div><span className="text-slate-400">Amt:</span> <span className="font-mono text-slate-700">{fmtAmt(item.amount ?? 0)}</span></div>
                      <div><span className="text-slate-400">Int:</span> <span className="font-mono text-orange-600">{fmtAmt(item.interestAmount ?? 0)}</span></div>
                      <div><span className="text-slate-400">VAT:</span> <span className="font-mono text-slate-500">{fmtAmt(item.vatAmount ?? 0)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-billing-period-transactions">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Tariff</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Doc No</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Interest</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">VAT</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {billingPeriodTxns.map((item: any, i: number) => {
                    const isOpenClose = (item.description || '').toLowerCase().includes('balance');
                    const fmtAmt = (v: number) => v !== 0 ? v.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '0,00';
                    return (
                      <tr key={i} className={`border-b border-slate-100 hover:bg-emerald-50/30 transition-colors ${isOpenClose ? 'bg-slate-50/50 font-semibold' : ''}`}>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{item.transactionDate ? new Date(item.transactionDate).toLocaleDateString('en-ZA') : '-'}</td>
                        <td className="py-2.5 px-3">{item.description || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{item.tariff || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">{item.documentNumber || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmtAmt(item.amount ?? 0)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-orange-600">{fmtAmt(item.interestAmount ?? 0)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">{fmtAmt(item.vatAmount ?? 0)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{fmtAmt(item.totalAmount ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {activeSubTab === 'detailed' && (
        detailedTxns.length === 0 ? <EmptyState message="No detailed transactions found" /> : (() => {
          const months = ['july','august','september','october','november','december','january','february','march','april','may','june'];
          const monthLabels = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
          const fmtPivot = (v: number) => v !== 0 ? v.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '-';
          return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white" />
              <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Detailed Transactions</h3>
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{detailedTxns.length}</Badge>
            </div>
            <div className="sm:hidden p-2 space-y-2">
              {detailedTxns.map((item: any, i: number) => {
                const isClosing = (item.serviceDesc || '').toLowerCase().includes('closing');
                const isOpening = (item.serviceDesc || '').toLowerCase().includes('opening');
                return (
                  <div key={i} className={`border rounded-lg p-3 ${isClosing ? 'bg-slate-50 border-slate-300' : isOpening ? 'bg-slate-50/50 border-slate-200' : 'bg-white border-slate-200'}`} data-testid={`detailed-txn-card-${i}`}>
                    <div className={`text-xs font-semibold mb-2 ${isClosing ? 'text-slate-900 font-bold' : 'text-slate-800'}`}>{item.serviceDesc || '-'}</div>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                      {months.map((m, mi) => {
                        const val = item[m] ?? 0;
                        return (
                          <div key={m} className="flex justify-between items-baseline">
                            <span className="text-[10px] text-slate-400 font-medium">{monthLabels[mi]}</span>
                            <span className={`font-mono text-[11px] ${val < 0 ? 'text-green-600' : val > 0 ? 'text-red-600' : 'text-slate-300'}`}>{fmtPivot(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-detailed-transactions">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold sticky left-0 bg-slate-50 min-w-[160px]">Description</th>
                    {monthLabels.map(m => (
                      <th key={m} className="text-right py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[80px]">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailedTxns.map((item: any, i: number) => {
                    const isClosing = (item.serviceDesc || '').toLowerCase().includes('closing');
                    const isOpening = (item.serviceDesc || '').toLowerCase().includes('opening');
                    return (
                      <tr key={i} className={`border-b border-slate-100 hover:bg-purple-50/30 transition-colors ${isClosing ? 'bg-slate-50 font-bold' : isOpening ? 'bg-slate-50/50' : ''}`}>
                        <td className="py-2.5 px-3 font-medium sticky left-0 bg-white">{item.serviceDesc || '-'}</td>
                        {months.map(m => {
                          const val = item[m] ?? 0;
                          return (
                            <td key={m} className={`py-2.5 px-2 text-right font-mono text-xs ${val < 0 ? 'text-green-600' : val > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                              {fmtPivot(val)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          );
        })()
      )}
    </div>
  );
}
