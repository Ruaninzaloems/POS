import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAccountBalance, getServiceTypeBalance, getBillingPeriodTransactions, getPropertyDetails, getConsumptionUnits } from './enquiries-service';
import { fetchMunicipalityInfo } from './external-api';

const MONTHS = ['July','August','September','October','November','December','January','February','March','April','May','June'];

function fmt(v: any): string {
  if (v === null || v === undefined || v === '') return '0.00';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: any): string {
  if (!v) return '-';
  try { return new Date(v).toLocaleDateString('en-GB'); } catch { return String(v); }
}

export async function generateStatementPdf(
  accountId: number,
  accountNumber: string,
  financialYear: string,
  month: string,
  statementType: 'account' | 'detailed',
  municipalityName?: string,
): Promise<void> {
  if (!municipalityName) {
    try { const mi = await fetchMunicipalityInfo(); municipalityName = mi.name; } catch {}
  }

  const [balanceData, serviceData, propResult, consResult] = await Promise.allSettled([
    getAccountBalance(accountId),
    getServiceTypeBalance(accountId, financialYear),
    getPropertyDetails(accountId),
    getConsumptionUnits(accountId),
  ]);

  const balance = balanceData.status === 'fulfilled' ? balanceData.value : null;
  const services: any[] = serviceData.status === 'fulfilled' ? (Array.isArray(serviceData.value) ? serviceData.value : []) : [];
  const property = propResult.status === 'fulfilled' ? (Array.isArray(propResult.value) ? propResult.value[0] : propResult.value) : null;
  const consUnit = consResult.status === 'fulfilled' ? (Array.isArray(consResult.value) ? consResult.value[0] : consResult.value) : null;

  let transactions: any[] = [];
  if (month) {
    try {
      transactions = await getBillingPeriodTransactions(accountId, financialYear, month);
    } catch { transactions = []; }
  } else {
    const monthFetches = MONTHS.map(m => getBillingPeriodTransactions(accountId, financialYear, m).catch(() => []));
    const results = await Promise.allSettled(monthFetches);
    results.forEach(r => { if (r.status === 'fulfilled') transactions.push(...r.value); });
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const teal = [0, 128, 128] as [number, number, number];
  const darkSlate = [30, 41, 59] as [number, number, number];
  const lightGray = [241, 245, 249] as [number, number, number];

  doc.setFillColor(...teal);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(municipalityName || 'Municipality', margin, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(statementType === 'detailed' ? 'Detailed Account Statement' : 'Account Statement', margin, 19);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-ZA')}`, pageW - margin, 19, { align: 'right' });
  doc.text(`Period: ${financialYear} ${month || 'Full Year'}`, pageW - margin, 12, { align: 'right' });
  y = 35;

  const accountName = property?.name || consUnit?.accountName || consUnit?.name || '';
  const address = property?.streetNumber
    ? `${property.streetNumber} ${property.streetName || ''}, ${property.subSuburb || property.suburb || ''}`
    : consUnit?.nonStandAddLine1 || '';

  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, contentW, 24, 2, 2, 'F');
  doc.setTextColor(...darkSlate);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCOUNT DETAILS', margin + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const col1 = margin + 4;
  const col2 = margin + contentW / 2;
  doc.text(`Account Number:  ${accountNumber}`, col1, y + 11);
  doc.text(`Account Holder:  ${accountName}`, col1, y + 16);
  doc.text(`Property Address:  ${address}`, col1, y + 21);

  let totalBalance = 0;
  if (balance) {
    if (Array.isArray(balance)) {
      totalBalance = balance.reduce((s: number, b: any) => s + (b.totalOutStanding || b.totalOutstanding || 0), 0);
    } else {
      totalBalance = balance.totalBalance ?? balance.totalOutstanding ?? balance.outStandingAmount ?? 0;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Outstanding Balance:', col2, y + 11);
  doc.setTextColor(totalBalance > 0 ? 220 : 0, totalBalance > 0 ? 38 : 128, totalBalance > 0 ? 38 : 0);
  doc.setFontSize(12);
  doc.text(`R ${fmt(totalBalance)}`, col2, y + 18);
  doc.setTextColor(...darkSlate);
  y += 30;

  if (services.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Service Balances', margin, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Service', 'Current', 'Arrears', 'Interest', 'Total Outstanding']],
      body: services.map((s: any) => [
        s.serviceTypeDesc || s.serviceDescription || s.description || '-',
        fmt(s.current || s.currentAmount || 0),
        fmt(s.arrears || s.arrearsAmount || 0),
        fmt(s.interest || s.interestAmount || 0),
        fmt(s.totalOutStanding || s.totalOutstanding || s.total || 0),
      ]),
      headStyles: { fillColor: teal, fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: () => {},
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (transactions.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkSlate);
    doc.text(`Transaction Details — ${month || financialYear}`, margin, y);
    y += 2;

    const txnBody = transactions.map((t: any) => [
      t.transactionDate ? fmtDate(t.transactionDate) : '-',
      t.description || t.transDescription || '-',
      t.tariff || t.tariffDescription || '-',
      fmt(t.amount || t.debit || 0),
      fmt(t.interest || 0),
      fmt(t.vat || 0),
      fmt(t.total || t.amount || 0),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Description', 'Tariff', 'Amount', 'Interest', 'VAT', 'Total']],
      body: txnBody,
      headStyles: { fillColor: teal, fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { halign: 'right', cellWidth: 18 },
        4: { halign: 'right', cellWidth: 16 },
        5: { halign: 'right', cellWidth: 14 },
        6: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
      },
      didDrawPage: () => {},
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('No transactions found for the selected period.', margin, y + 5);
    y += 12;
  }

  if (statementType === 'detailed' && transactions.length > 0) {
    if (y > 250) { doc.addPage(); y = margin; }
    const serviceGroups = new Map<string, { total: number; count: number }>();
    transactions.forEach((t: any) => {
      const svc = t.description || t.transDescription || 'Other';
      const entry = serviceGroups.get(svc) || { total: 0, count: 0 };
      entry.total += (t.total || t.amount || 0);
      entry.count++;
      serviceGroups.set(svc, entry);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkSlate);
    doc.text('Summary by Service', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Service / Description', 'Transactions', 'Total Amount']],
      body: Array.from(serviceGroups.entries()).map(([svc, data]) => [
        svc,
        String(data.count),
        fmt(data.total),
      ]),
      headStyles: { fillColor: darkSlate, fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: () => {},
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} — ${municipalityName || 'Municipality'} Account Statement — ${accountNumber}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, doc.internal.pageSize.getHeight() - 12, pageW - margin, doc.internal.pageSize.getHeight() - 12);
  }

  const filename = `statement_${accountNumber}_${financialYear.replace('/', '-')}_${month || 'full'}.pdf`;
  doc.save(filename);
}
