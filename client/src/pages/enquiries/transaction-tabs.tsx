import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Receipt, Download, Eye, RefreshCw, ChevronDown, ChevronUp, Loader2,
  Layers, Activity, X, Banknote, CreditCard, CalendarDays
} from 'lucide-react';
import {
  getTransactionHistory, getDetailedTransactionResults, getBillingPeriodTransactions,
  getAllBillingPeriodTransactions, getServiceTypeBalance,
  getReceiptTransactionDetail, getLevyTransactionDetail,
  getOpenBalanceDetail, getCloseBalanceDetail, getJournalTransactionDetails,
  getRebateTransactionDetail, getInterestConsPaymentDetail,
} from '@/lib/enquiries-service';
import { LoadingSkeleton, EmptyState, ErrorState, PaginatedTable, getFinYearOptions, MONTHS } from './shared';

export function TransactionSummaryTab({ accountId, accountNumber }: { accountId: number; accountNumber?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const years = useMemo(() => getFinYearOptions(), []);
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const lastKey = useRef('');

  const load = useCallback(async (finYear: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getServiceTypeBalance(accountId, finYear);
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load transaction summary');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    const key = `${accountId}-${selectedYear}`;
    if (lastKey.current !== key) {
      lastKey.current = key;
      load(selectedYear);
    }
  }, [accountId, selectedYear, load]);

  const pivotData = useMemo(() => {
    const descMap = new Map<string, Record<string, number>>();
    const monthTotals: Record<string, number> = {};
    const monthOpeningBalance: Record<string, number> = {};
    const monthInterest: Record<string, number> = {};
    const monthReceipts: Record<string, number> = {};

    data.forEach((d: any) => {
      const desc = d.serviceDescription || d.description || 'Unknown';
      const month = d.month || '';
      const totalAmt = d.totalAmount ?? d.amount ?? 0;
      const openBal = d.openingBalance ?? 0;
      const interest = d.interestAmount ?? 0;
      const currentCharge = d.currentCharge ?? 0;

      if (!descMap.has(desc)) descMap.set(desc, {});
      const row = descMap.get(desc)!;
      row[month] = (row[month] || 0) + totalAmt;

      monthTotals[month] = (monthTotals[month] || 0) + totalAmt;
      monthOpeningBalance[month] = (monthOpeningBalance[month] || 0) + openBal;
      monthInterest[month] = (monthInterest[month] || 0) + interest;
    });

    const serviceRows = Array.from(descMap.entries()).map(([desc, months]) => ({
      description: desc,
      isSpecial: false,
      ...months,
    }));

    const openingRow: any = { description: 'Opening Balance', isSpecial: true };
    const totalRow: any = { description: 'Total', isSpecial: true, isBold: true };
    const interestRow: any = { description: 'Interest', isSpecial: true };
    const receiptsRow: any = { description: 'Receipts', isSpecial: true };
    const closingRow: any = { description: 'Closing Balance', isSpecial: true, isBold: true };

    MONTHS.forEach(m => {
      openingRow[m] = monthOpeningBalance[m] || 0;
      totalRow[m] = monthTotals[m] || 0;
      interestRow[m] = monthInterest[m] || 0;
      const closingVal = (monthOpeningBalance[m] || 0) + (monthTotals[m] || 0) + (monthInterest[m] || 0);
      closingRow[m] = closingVal;
      receiptsRow[m] = 0;
    });

    return [openingRow, ...serviceRows, interestRow, totalRow, receiptsRow, closingRow];
  }, [data]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => load(selectedYear)} />;

  const hasData = data.length > 0;
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

    const escXml = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const colWidths = [140, 180, 120, ...MONTHS.map(() => 100)];
    const colXml = colWidths.map(w => `<Column ss:Width="${w}"/>`).join('');

    const headerCells = headers.map(h =>
      `<Cell ss:StyleID="header"><Data ss:Type="String">${escXml(h)}</Data></Cell>`
    ).join('');

    const dataRows = rows.map(row => {
      const cells = row.map((val: any, ci: number) => {
        if (ci <= 2) {
          return `<Cell ss:StyleID="text"><Data ss:Type="String">${escXml(String(val))}</Data></Cell>`;
        }
        return `<Cell ss:StyleID="number"><Data ss:Type="Number">${Number(val).toFixed(2)}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default">
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8"/>
   </Borders>
  </Style>
  <Style ss:ID="text">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="number">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="title">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#1E293B"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Transaction Summary">
  <Table>
   ${colXml}
   <Row ss:Height="30">
    <Cell ss:StyleID="title" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Transaction Summary - Account ${escXml(accNum)} - ${escXml(selectedYear)}</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:Height="25">${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transaction_Summary_${accNum}_${selectedYear.replace('/', '-')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 space-y-5" data-testid="transaction-summary-panel">
      <h3 className="text-base font-bold text-slate-800">Transaction Summary List per Fin-Year/Billing Period</h3>
      <div className="flex items-center gap-3">
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
  const [selectedMonth, setSelectedMonth] = useState('January');
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [txnDetailData, setTxnDetailData] = useState<any[] | null>(null);
  const [txnDetailLoading, setTxnDetailLoading] = useState(false);
  const [showCreditMeterOnly, setShowCreditMeterOnly] = useState(false);
  const lastKey = useRef('');

  const calendarMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const finYearMonths = ['July','August','September','October','November','December','January','February','March','April','May','June'];

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
    const key = `${accountId}-${selectedYear}-${selectedMonth}`;
    if (lastKey.current !== key) {
      lastKey.current = key;
      load(selectedYear, selectedMonth);
    }
  }, [accountId, selectedYear, selectedMonth, load]);

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
      let detail: any[] = [];
      const drilldown = (row.drilldown || '').toLowerCase();
      const pId = row.primaryId ? parseInt(row.primaryId) : null;

      if (drilldown === 'openbalance') {
        detail = await getOpenBalanceDetail(accountId);
      } else if (drilldown === 'closebalance') {
        detail = await getCloseBalanceDetail(accountId);
      } else if (drilldown === 'receipt' && pId) {
        const result = await getReceiptTransactionDetail(pId);
        detail = Array.isArray(result) ? result : result ? [result] : [];
      } else if (drilldown === 'levy') {
        detail = await getLevyTransactionDetail(accountId);
      } else if (drilldown === 'rebate') {
        detail = await getRebateTransactionDetail(accountId);
      } else if (drilldown === 'interest') {
        detail = await getInterestConsPaymentDetail(accountId);
      } else if (row.isSpecial && row.description?.toLowerCase().includes('open')) {
        detail = await getOpenBalanceDetail(accountId);
      } else if (row.isSpecial && row.description?.toLowerCase().includes('clos')) {
        detail = await getCloseBalanceDetail(accountId);
      } else {
        detail = await getJournalTransactionDetails(accountId);
      }
      setTxnDetailData(detail);
    } catch (e) {
      console.error('Failed to load transaction detail:', e);
      setTxnDetailData([]);
    } finally {
      setTxnDetailLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => load(selectedYear, selectedMonth)} />;

  return (
    <div className="p-5 space-y-5" data-testid="detailed-transaction-panel">
      <h3 className="text-base font-bold text-slate-800">Detailed Transaction List per Billing Period</h3>

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

      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedTxn(null); setTxnDetailData(null); }} data-testid="txn-detail-overlay">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
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
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ledger Postings</h5>
                </div>
                {txnDetailLoading ? (
                  <div className="p-8 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">Loading ledger postings...</span>
                  </div>
                ) : txnDetailData && txnDetailData.length > 0 ? (
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
                    No ledger posting data available for this transaction
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

  const sortedReceipts = useMemo(() =>
    [...data].sort((a, b) => {
      const da = a.receiptDate ? new Date(a.receiptDate).getTime() : 0;
      const db = b.receiptDate ? new Date(b.receiptDate).getTime() : 0;
      return db - da;
    }),
  [data]);

  const totalAmount = useMemo(() => sortedReceipts.reduce((s, r) => s + (r.amount ?? 0), 0), [sortedReceipts]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const handlePrintReceipt = async (item: any) => {
    const receiptId = item.receiptId || item.receipt_ID;
    if (!receiptId) return;
    setPrintingId(String(receiptId));
    try {
      const params = new URLSearchParams({ receiptId: String(receiptId) });
      const res = await fetch(`/api/proxy/pos-multi-receipt-print?${params.toString()}`);
      if (res.ok) {
        const rd = await res.json();
        setReceiptPreview(rd);
      }
    } catch (e) {
      console.error('Failed to fetch receipt for printing:', e);
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-white" />
                <h3 className="text-sm font-semibold text-white tracking-wide">Receipt History</h3>
                <Badge className="bg-white/20 text-white border-white/30 text-[10px]">{data.length} receipts</Badge>
              </div>
              <div className="text-white text-sm font-mono font-bold">
                Total: R {totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </div>
            </div>
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
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Period</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Debit</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Credit</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {billingPeriodTxns.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">{item.period || item.billingPeriod || '-'}</td>
                      <td className="py-2.5 px-3">{item.description || item.transactionDescription || '-'}</td>
                      <td className="py-2.5 px-3">{item.serviceType || item.serviceDescription || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600">{(item.debit ?? item.debitAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-600">{(item.credit ?? item.creditAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(item.balance ?? item.runningBalance ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {activeSubTab === 'detailed' && (
        detailedTxns.length === 0 ? <EmptyState message="No detailed transactions found" /> : (
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
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Date</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Type</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Service</th>
                    <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedTxns.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-purple-50/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-600">{item.transactionDate ? new Date(item.transactionDate).toLocaleDateString('en-ZA') : item.date || '-'}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">{item.transactionType || item.type || '-'}</span>
                      </td>
                      <td className="py-2.5 px-3">{item.description || item.transactionDescription || '-'}</td>
                      <td className="py-2.5 px-3">{item.serviceType || item.serviceDescription || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{(item.amount ?? item.transactionAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs font-mono">{item.reference || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
