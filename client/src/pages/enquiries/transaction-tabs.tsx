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
import { LoadingSkeleton, EmptyState, ErrorState, PaginatedTable, getFinYearOptions, MONTHS } from './shared';

export function TransactionSummaryTab({ accountId, accountNumber }: { accountId: number; accountNumber?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState('');
  const years = useMemo(() => getFinYearOptions(), []);
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const lastKey = useRef('');

  const load = useCallback(async (finYear: string) => {
    setLoading(true);
    setError(null);
    setLoadProgress('Loading all billing periods...');
    try {
      const months = MONTHS;
      const results: { month: string; records: any[] }[] = [];
      const fetches = months.map(async (month) => {
        const records = await getBillingPeriodTransactions(accountId, finYear, month).catch(() => []);
        return { month, records: Array.isArray(records) ? records : [] };
      });
      const allResults = await Promise.all(fetches);
      allResults.forEach(r => results.push(r));
      setData(results as any);
    } catch (e: any) {
      setError(e.message || 'Failed to load transaction summary');
    } finally {
      setLoading(false);
      setLoadProgress('');
    }
  }, [accountId]);

  useEffect(() => {
    const key = `${accountId}-${selectedYear}`;
    if (lastKey.current !== key) {
      lastKey.current = key;
      load(selectedYear);
    }
  }, [accountId, selectedYear, load]);

  const extractServiceType = useCallback((desc: string): string => {
    const levyMatch = desc.match(/^Levy\s*-\s*(.+)/i);
    if (levyMatch) return levyMatch[1].trim();
    const journalMatch = desc.match(/^(?:Billing\s+Transfer\s+)?(?:Normal\s+)?Journal\s*-\s*(.+?)(?:\s*-\s*Transfer|$)/i);
    if (journalMatch) return journalMatch[1].trim();
    const parts = desc.split('-').map(s => s.trim());
    if (parts.length >= 2) return parts[1];
    return desc || 'Other';
  }, []);

  const pivotData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const serviceMap = new Map<string, Record<string, number>>();
    const monthOpening: Record<string, number> = {};
    const monthClosing: Record<string, number> = {};
    const monthInterest: Record<string, number> = {};
    const monthReceipts: Record<string, number> = {};
    const monthCharges: Record<string, number> = {};

    (data as { month: string; records: any[] }[]).forEach(({ month, records }) => {
      records.forEach((r: any) => {
        const drilldown = r.drilldown || '';
        const totalAmt = r.totalAmount ?? r.amount ?? 0;

        if (drilldown === 'OpenBalance') {
          monthOpening[month] = (monthOpening[month] || 0) + totalAmt;
          return;
        }
        if (drilldown === 'CloseBalance') {
          monthClosing[month] = (monthClosing[month] || 0) + totalAmt;
          return;
        }
        if (drilldown === 'Interest') {
          monthInterest[month] = (monthInterest[month] || 0) + totalAmt;
          return;
        }
        if (drilldown === 'Receipt') {
          monthReceipts[month] = (monthReceipts[month] || 0) + totalAmt;
          return;
        }

        const serviceType = extractServiceType(r.description || '');

        if (!serviceMap.has(serviceType)) serviceMap.set(serviceType, {});
        const row = serviceMap.get(serviceType)!;
        row[month] = (row[month] || 0) + totalAmt;
        monthCharges[month] = (monthCharges[month] || 0) + totalAmt;
      });
    });

    const serviceRows = Array.from(serviceMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([desc, months]) => ({
        description: desc,
        isSpecial: false,
        ...months,
      }));

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
      closingRow[m] = monthClosing[m] !== undefined
        ? monthClosing[m]
        : (openingRow[m] + chargesRow[m] + interestRow[m] + receiptsRow[m]);
    });

    return [openingRow, ...serviceRows, interestRow, chargesRow, receiptsRow, closingRow];
  }, [data, extractServiceType]);

  if (loading) return (
    <div className="p-5 space-y-3">
      <LoadingSkeleton />
      {loadProgress && <p className="text-xs text-slate-500 text-center">{loadProgress}</p>}
    </div>
  );
  if (error) return <ErrorState message={error} onRetry={() => load(selectedYear)} />;

  const hasData = Array.isArray(data) && (data as { month: string; records: any[] }[]).some(d => d.records.length > 0);
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

    const escapeCsv = (v: any) => {
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...rows.map(r => r.map((v: any, ci: number) => ci > 2 ? Number(v).toFixed(2) : escapeCsv(v)).join(','))
    ];
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transaction_Summary_${accNum}_${selectedYear.replace('/', '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 space-y-5" data-testid="transaction-summary-panel">
      <h3 className="text-base font-bold text-slate-800">Transaction Summary List per Fin-Year/Billing Period</h3>
      <div className="flex items-center justify-between gap-3">
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

export function DetailedTransactionListTab({ accountId }: { accountId: number }) {
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

    return billingPeriodData.map((row: any) => {
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
        isBold: isClose,
        drilldown: row.drilldown || '',
        primaryId: row.primaryId || '',
        queryId: row.queryId,
        _raw: row,
      };
    });
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

  const generateCsvContent = (rows: any[], monthLabel: string, year: string) => {
    const headers = ['Transaction Date','Transaction Description','Receipt ID / Doc Transaction ID','Document Number','Tariff','Amount','Interest','VAT','Total'];
    const csvRows = [headers.join(',')];
    rows.forEach((row: any) => {
      const txDate = row.transactionDate ? new Date(row.transactionDate).toLocaleDateString('en-ZA') : '';
      const desc = (row.description || '').replace(/"/g, '""');
      const tariff = (row.tariff || '').replace(/"/g, '""');
      csvRows.push([
        txDate,
        `"${desc}"`,
        row.transactionId || '',
        row.documentNumber || '',
        `"${tariff}"`,
        (row.amount ?? 0).toFixed(2),
        (row.interestAmount ?? 0).toFixed(2),
        (row.vatAmount ?? 0).toFixed(2),
        (row.totalAmount ?? 0).toFixed(2),
      ].join(','));
    });
    return csvRows.join('\n');
  };

  const downloadCsv = (content: string, filename: string) => {
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCurrentMonth = () => {
    const csv = generateCsvContent(billingPeriodData, selectedMonth, selectedYear);
    downloadCsv(csv, `Transactions_${selectedYear.replace('/', '-')}_${selectedMonth}.csv`);
  };

  const handleDownloadRange = async () => {
    if (!downloadFromMonth || !downloadToMonth) return;
    const fromIdx = finYearMonths.indexOf(downloadFromMonth);
    const toIdx = finYearMonths.indexOf(downloadToMonth);
    if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx) return;

    setDownloading(true);
    const monthsToFetch = finYearMonths.slice(fromIdx, toIdx + 1);
    const allCsvParts: string[] = [];
    const headers = 'Transaction Date,Transaction Description,Receipt ID / Doc Transaction ID,Document Number,Tariff,Amount,Interest,VAT,Total';

    try {
      for (let i = 0; i < monthsToFetch.length; i++) {
        const month = monthsToFetch[i];
        setDownloadProgress(`Fetching ${month} (${i + 1} of ${monthsToFetch.length})...`);
        const result = await getBillingPeriodTransactions(accountId, downloadYear, month);
        const rows = Array.isArray(result) ? result : [];
        if (i === 0) {
          allCsvParts.push(headers);
        }
        allCsvParts.push(`\n"--- ${month} ${downloadYear} ---"`);
        rows.forEach((row: any) => {
          const txDate = row.transactionDate ? new Date(row.transactionDate).toLocaleDateString('en-ZA') : '';
          const desc = (row.description || '').replace(/"/g, '""');
          const tariff = (row.tariff || '').replace(/"/g, '""');
          allCsvParts.push([
            txDate,
            `"${desc}"`,
            row.transactionId || '',
            row.documentNumber || '',
            `"${tariff}"`,
            (row.amount ?? 0).toFixed(2),
            (row.interestAmount ?? 0).toFixed(2),
            (row.vatAmount ?? 0).toFixed(2),
            (row.totalAmount ?? 0).toFixed(2),
          ].join(','));
        });
        if (rows.length === 0) {
          allCsvParts.push('"No transactions for this period"');
        }
      }
      setDownloadProgress('Preparing download...');
      const fromLabel = downloadFromMonth.slice(0, 3);
      const toLabel = downloadToMonth.slice(0, 3);
      downloadCsv(allCsvParts.join('\n'), `Transactions_${downloadYear.replace('/', '-')}_${fromLabel}-${toLabel}.csv`);
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
    <div className="p-5 space-y-5" data-testid="detailed-transaction-panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-bold text-slate-800">Detailed Transaction List per Billing Period</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadCurrentMonth} disabled={detailedRows.length === 0} className="text-xs gap-1.5" data-testid="button-download-current">
            <Download className="w-3.5 h-3.5" />
            Download {selectedMonth}
          </Button>
          <Button variant="outline" size="sm" onClick={openDownloadModal} className="text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50" data-testid="button-download-range">
            <CalendarDays className="w-3.5 h-3.5" />
            Download Range
          </Button>
        </div>
      </div>

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
        {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
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
                className={`border-b border-slate-100 cursor-pointer ${row.isBold ? 'bg-slate-50 font-bold' : ''} ${row.isPayment ? 'hover:bg-blue-50 text-red-600' : 'hover:bg-slate-50'}`}
                onClick={() => handleRowClick(row)}
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

      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !downloading && setShowDownloadModal(false)} data-testid="download-range-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Download Transaction Data</h4>
                  <p className="text-[11px] text-blue-200">Select a period range to export</p>
                </div>
              </div>
              {!downloading && (
                <button onClick={() => setShowDownloadModal(false)} className="text-white/70 hover:text-white text-lg font-bold w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors" data-testid="button-close-download">&times;</button>
              )}
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Financial Year</label>
                <select value={downloadYear} onChange={e => setDownloadYear(e.target.value)} disabled={downloading} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm bg-white disabled:opacity-50" data-testid="select-download-year">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">From Period</label>
                  <select value={downloadFromMonth} onChange={e => { setDownloadFromMonth(e.target.value); if (finYearMonths.indexOf(e.target.value) > finYearMonths.indexOf(downloadToMonth)) setDownloadToMonth(e.target.value); }} disabled={downloading} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm bg-white disabled:opacity-50" data-testid="select-download-from">
                    {finYearMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">To Period</label>
                  <select value={downloadToMonth} onChange={e => setDownloadToMonth(e.target.value)} disabled={downloading} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm bg-white disabled:opacity-50" data-testid="select-download-to">
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
                  {downloading ? 'Downloading...' : 'Download CSV'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedTxn(null); setTxnDetailData(null); }} data-testid="txn-detail-overlay">
          <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] w-full max-h-[95vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-white" />
                <div>
                  <h4 className="text-sm font-bold text-white">Transaction Detail & Ledger Posting</h4>
                  <p className="text-[11px] text-blue-200">{selectedTxn.description} — {selectedTxn.transactionDate}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedTxn(null); setTxnDetailData(null); }} className="text-white/70 hover:text-white text-xl font-bold w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors" data-testid="button-close-detail">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Transaction Summary</h5>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
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

              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Transaction Detail & Ledger Postings</h5>
                </div>
                {txnDetailLoading ? (
                  <div className="p-8 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">Loading detail...</span>
                  </div>
                ) : typeof txnDetailData === 'string' && txnDetailData.length > 0 ? (
                  <div className="p-4 overflow-x-auto platinum-detail-html" dangerouslySetInnerHTML={{ __html: txnDetailData }} />
                ) : Array.isArray(txnDetailData) && txnDetailData.length > 0 ? (
                  <div className="overflow-x-auto">
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
    const services = Array.isArray(receiptPreview.services) ? receiptPreview.services : [];
    const svcHtml = services.map((s: any) =>
      `<tr><td style="padding:3px 4px">${s.serviceDescription || s.description || ''}</td><td style="padding:3px 4px;text-align:right">R ${(s.amount ?? 0).toFixed(2)}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><title>Receipt ${receiptPreview.receiptNo || ''}</title>
<style>body{font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:380px;margin:0 auto;color:#333}
table{width:100%;border-collapse:collapse}td{padding:3px 4px}
h2{text-align:center;margin:6px 0;font-size:14px}p{margin:3px 0}
.divider{border-top:1px dashed #333;margin:10px 0}
.right{text-align:right}.bold{font-weight:bold}
.total-row td{border-top:1px solid #333;font-weight:bold;padding-top:6px}
@media print{body{padding:0;margin:0}}</style></head><body>
<h2>${receiptPreview.municipalityName || 'George Municipality'}</h2>
<p style="text-align:center">${receiptPreview.address || ''}</p>
<div class="divider"></div>
<p><strong>Receipt:</strong> ${receiptPreview.receiptNo || receiptPreview.receiptNumber || ''}</p>
<p><strong>Date:</strong> ${receiptPreview.receiptDate || ''}</p>
<p><strong>Account:</strong> ${receiptPreview.accountNumber || accountNumber}</p>
<p><strong>Consumer:</strong> ${receiptPreview.consumerName || ''}</p>
<div class="divider"></div>
<table>${svcHtml}
<tr class="total-row"><td><strong>Total</strong></td><td style="text-align:right"><strong>R ${(receiptPreview.totalAmount ?? receiptPreview.amount ?? 0).toFixed(2)}</strong></td></tr></table>
<div class="divider"></div>
<p><strong>Payment:</strong> ${receiptPreview.paymentType || ''}</p>
<p><strong>Cashier:</strong> ${receiptPreview.cashierName || ''}</p>
<div class="divider"></div>
<p style="text-align:center;font-size:10px;color:#666">Thank you for your payment</p>
</body></html>`;
    const printWindow = window.open('', '_blank', 'width=450,height=650,scrollbars=yes');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 300);
      };
    }
  };

  return (
    <div className="p-5 space-y-5">
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
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button onClick={() => setReceiptPreview(null)} className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50" data-testid="button-close-receipt">Close</button>
              <button onClick={handlePrintWindow} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-1.5 shadow-sm" data-testid="button-print-receipt-confirm">
                <FileText className="w-3.5 h-3.5" />
                Print Receipt
              </button>
            </div>
          </div>
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
                <div className="px-4 sm:px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto" data-testid="receipt-timeline">
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
              )}
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
            <div className="px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white" />
              <h3 className="text-sm font-semibold text-white tracking-wide">Detailed Transactions</h3>
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{detailedTxns.length}</Badge>
            </div>
            <div className="overflow-x-auto">
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
