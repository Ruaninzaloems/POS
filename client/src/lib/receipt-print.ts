import { fetchMunicipalityInfo } from './external-api';
import type { PosMultiReceiptPrintItem, MunicipalityInfo } from './external-api';

export interface ReceiptPrintData {
  receiptNo?: string;
  receiptNumber?: string;
  receiptDate?: string;
  accountNumber?: string;
  oldAccountCode?: string;
  accountName?: string;
  consumerName?: string;
  sgNumber?: string;
  address?: string;
  municipalityName?: string;
  municipalityAddress?: string;
  vatRegNumber?: string;
  totalAmount?: number;
  amount?: number;
  tenderAmount?: number;
  changeAmount?: number;
  outstandingBalance?: number;
  vatAmount?: number;
  paymentType?: string;
  paymentOption?: string;
  cashierName?: string;
  cashOffice?: string;
  services?: { description?: string; serviceDescription?: string; amount?: number }[];
}

function fmtR(val: number | undefined | null): string {
  const n = val ?? 0;
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
  } catch (err) {
    console.warn('[receipt-print] Failed to format date:', dateStr, err);
    return dateStr;
  }
}

const PAYMENT_METHOD_NAMES = ['cash', 'eft', 'credit card', 'card', 'cheque', 'postal order', 'debit order'];

function isPaymentMethodName(str: string): boolean {
  if (!str) return false;
  return PAYMENT_METHOD_NAMES.some(m => str.toLowerCase().trim() === m);
}

function getPaymentTypeName(payMode: string | null | undefined, paymentTypeId: number | null | undefined): string {
  if (payMode && payMode.trim() && isPaymentMethodName(payMode)) return payMode.trim();
  switch (paymentTypeId) {
    case 1: return 'Cash';
    case 2: return 'EFT';
    case 3: return 'Credit Card';
    case 4: return 'Postal Order';
    case 5: return 'EFT';
    default: {
      if (payMode && payMode.trim()) return payMode.trim();
      return paymentTypeId ? `Type ${paymentTypeId}` : '';
    }
  }
}

function getPaymentOptionName(billTypeId: number | null | undefined, billType: string | null | undefined): string {
  if (billType && billType.trim() && !billType.match(/^\d+$/)) {
    const bt = billType.toLowerCase();
    if (bt.includes('consumer') || bt.includes('electricity') || bt.includes('water') || bt.includes('sanitation') || bt.includes('rates') || bt.includes('waste')) return 'Consumer Services';
    if (bt.includes('clearance')) return 'Clearance';
    if (bt.includes('prepaid')) return 'Prepaid';
    if (bt.includes('direct') || bt.includes('misc')) return 'Direct Income';
    if (bt.includes('group')) return 'Payment Grouping';
  }
  switch (billTypeId) {
    case 1: return 'Consumer Services';
    case 3: return 'Payment Grouping';
    case 4: return 'Direct Income';
    case 5: return 'Prepaid';
    case 6: return 'Clearance';
    default: return 'Consumer Services';
  }
}

export function buildReceiptDataFromMultiPrint(items: PosMultiReceiptPrintItem[], muniInfo?: MunicipalityInfo): ReceiptPrintData {
  if (!items || items.length === 0) return {};
  const first = items[0] as any;

  const pdfAllocations = first._serviceAllocations;
  let services: { description: string; amount: number }[];

  if (Array.isArray(pdfAllocations) && pdfAllocations.length > 0) {
    services = pdfAllocations.map((a: any) => ({
      description: a.service || a.description || '',
      amount: a.amount ?? a.total ?? 0,
    }));
  } else {
    services = items
      .filter(i => {
        const desc = (i.billType || '').trim();
        if (!desc && (i.amount ?? 0) === 0) return false;
        if (isPaymentMethodName(desc)) return false;
        return true;
      })
      .map(i => ({
        description: i.billType || '',
        amount: i.amount ?? 0,
      }));
  }

  const totalFromServices = services.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalVat = items.reduce((sum, i) => sum + (i.vatAmount ?? 0), 0);

  const viewPaymentOption = first._viewPaymentOption || '';

  const total = (first.tenderAmount && first.tenderAmount > 0)
    ? first.tenderAmount
    : (totalFromServices > 0 ? totalFromServices : items.reduce((sum, i) => sum + (i.amount ?? 0), 0));

  return {
    receiptNo: first.receiptNo || '',
    receiptDate: first.receiptDate || first.paymentDate || '',
    accountNumber: first.accountId || '',
    oldAccountCode: first.oldAccountCode || '',
    accountName: first.accName || '',
    sgNumber: first.sgNumber || '',
    address: first.accAddress || '',
    municipalityName: muniInfo?.name || '',
    municipalityAddress: muniInfo ? [muniInfo.address1, muniInfo.address2, muniInfo.address3].filter(Boolean).join('\n') : '',
    vatRegNumber: muniInfo?.vatNo || '',
    totalAmount: total,
    tenderAmount: first.tenderAmount ?? 0,
    changeAmount: first.changeAmount ?? 0,
    outstandingBalance: first.outstandingAmount ?? 0,
    vatAmount: totalVat,
    paymentType: getPaymentTypeName(first.payMode, first.paymentTypeId),
    paymentOption: viewPaymentOption || getPaymentOptionName(first.billTypeId, first.billType),
    cashierName: first.cashierName || '',
    cashOffice: first.cashOfficeName || '',
    services,
  };
}

export function generateReceiptHtml(data: ReceiptPrintData, isReprint: boolean = true): string {
  const services = Array.isArray(data.services) ? data.services : [];
  const total = data.totalAmount ?? data.amount ?? 0;
  const receiptNo = data.receiptNo || data.receiptNumber || '';
  const municipality = data.municipalityName || '';
  const munAddress = data.municipalityAddress || '';
  const vatReg = data.vatRegNumber || '';
  const tenderAmount = data.tenderAmount ?? total;
  const changeAmount = data.changeAmount ?? 0;
  const outstandingBalance = data.outstandingBalance ?? 0;
  const vatAmount = data.vatAmount ?? 0;

  const addressLines = munAddress.split('\n').filter(l => l.trim()).map(l => `<div>${l.trim()}</div>`).join('');

  const hasVatInServices = services.some(s => {
    const desc = (s.description || s.serviceDescription || '').toLowerCase();
    return desc.includes('vat');
  });

  const svcRows = services
    .filter(s => (s.description || s.serviceDescription || '').trim())
    .map(s => {
      const desc = s.description || s.serviceDescription || '';
      const amt = s.amount ?? 0;
      return `<tr><td class="svc-desc">${desc}</td><td class="svc-amt">${fmtR(amt)}</td></tr>`;
    }).join('');

  const reprintBadge = isReprint ? `<div class="reprint-badge">REPRINT</div>` : '';

  const accountAddr = data.address || '';
  const addressFormatted = accountAddr ? accountAddr.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).join(', ') : '';

  const accountName = data.accountName || data.consumerName || '';

  return `<!DOCTYPE html>
<html><head><title>Receipt ${receiptNo}</title>
<style>
  @page { size: A4; margin: 12mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #1a1a1a;
    background: #fff;
    max-width: 520px;
    margin: 0 auto;
    padding: 0;
  }
  .receipt-container {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }
  .header {
    background: linear-gradient(135deg, #1a3a4a 0%, #2d5a6b 100%);
    color: #fff;
    padding: 20px 24px 16px;
    text-align: center;
  }
  .header h1 {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .header .addr {
    font-size: 10px;
    opacity: 0.8;
    line-height: 1.4;
  }
  .header .vat {
    font-size: 9px;
    opacity: 0.6;
    margin-top: 6px;
    letter-spacing: 0.3px;
  }
  .reprint-badge {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    padding: 2px 12px;
    border-radius: 10px;
    margin-bottom: 10px;
  }
  .receipt-meta {
    padding: 14px 24px;
    background: #f8f9fa;
    border-bottom: 1px solid #e8e8e8;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
  }
  .meta-item {
    display: flex;
    flex-direction: column;
  }
  .meta-label {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #888;
    font-weight: 600;
  }
  .meta-value {
    font-size: 11px;
    color: #1a1a1a;
    font-weight: 500;
    word-break: break-word;
  }
  .meta-value.mono {
    font-family: 'Courier New', monospace;
    font-weight: 600;
  }
  .meta-item.full-width {
    grid-column: 1 / -1;
  }
  .section-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    font-weight: 700;
    padding: 12px 24px 6px;
    border-bottom: 1px solid #f0f0f0;
  }
  .services-table {
    width: 100%;
    border-collapse: collapse;
    padding: 0;
  }
  .services-table td {
    padding: 5px 24px;
    font-size: 11px;
    border-bottom: 1px solid #f5f5f5;
  }
  .services-table td.svc-desc {
    color: #444;
    width: 60%;
  }
  .services-table td.svc-amt {
    text-align: right;
    font-family: 'Courier New', monospace;
    font-weight: 500;
    color: #1a1a1a;
    width: 40%;
  }
  .services-table tr:last-child td {
    border-bottom: none;
  }
  .total-section {
    padding: 0 24px;
    border-top: 2px solid #1a3a4a;
    margin: 0;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    border-bottom: 1px solid #f0f0f0;
  }
  .total-row:last-child {
    border-bottom: none;
  }
  .total-row .t-label {
    font-size: 11px;
    color: #555;
  }
  .total-row .t-value {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    color: #1a1a1a;
  }
  .total-row.grand {
    padding: 10px 0;
    border-bottom: 1px solid #e0e0e0;
  }
  .total-row.grand .t-label {
    font-size: 14px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .total-row.grand .t-value {
    font-size: 16px;
    font-weight: 700;
    color: #1a3a4a;
  }
  .total-row.balance .t-value {
    color: ${outstandingBalance < 0 ? '#16a34a' : outstandingBalance > 0 ? '#dc2626' : '#1a1a1a'};
  }
  .payment-info {
    padding: 12px 24px;
    background: #f8f9fa;
    border-top: 1px solid #e8e8e8;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
  }
  .footer {
    text-align: center;
    padding: 14px 24px;
    border-top: 1px solid #e8e8e8;
  }
  .footer .thank-you {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }
  @media print {
    body { padding: 0; margin: 0 auto; max-width: 520px; }
    .receipt-container { border: none; border-radius: 0; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt-meta, .payment-info { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media screen {
    body { padding: 24px 16px; background: #f0f0f0; }
    .receipt-container { box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
  }
</style></head>
<body>
<div class="receipt-container">
  <div class="header">
    ${reprintBadge}
    <h1>${municipality}</h1>
    <div class="addr">${addressLines}</div>
    ${vatReg ? `<div class="vat">VAT Reg: ${vatReg}</div>` : ''}
  </div>

  <div class="receipt-meta">
    <div class="meta-item">
      <span class="meta-label">Receipt No</span>
      <span class="meta-value mono">${receiptNo}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Date</span>
      <span class="meta-value">${fmtDate(data.receiptDate)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Account No</span>
      <span class="meta-value mono">${data.accountNumber || '-'}</span>
    </div>
    ${data.oldAccountCode ? `<div class="meta-item"><span class="meta-label">Old Account No</span><span class="meta-value mono">${data.oldAccountCode}</span></div>` : ''}
    ${accountName ? `<div class="meta-item full-width"><span class="meta-label">Account Holder</span><span class="meta-value">${accountName}</span></div>` : ''}
    ${data.sgNumber ? `<div class="meta-item"><span class="meta-label">SG Number</span><span class="meta-value mono">${data.sgNumber}</span></div>` : ''}
    ${addressFormatted ? `<div class="meta-item full-width"><span class="meta-label">Address</span><span class="meta-value">${addressFormatted}</span></div>` : ''}
  </div>

  ${svcRows ? `
  <div class="section-title">Service Allocations</div>
  <table class="services-table">
    ${svcRows}
    ${!hasVatInServices && vatAmount > 0 ? `<tr><td class="svc-desc" style="color:#888;">VAT Amount</td><td class="svc-amt" style="color:#888;">${fmtR(vatAmount)}</td></tr>` : ''}
  </table>
  ` : ''}

  <div class="total-section">
    <div class="total-row grand">
      <span class="t-label">Total</span>
      <span class="t-value">R ${fmtR(total)}</span>
    </div>
    ${tenderAmount !== total ? `<div class="total-row"><span class="t-label">Tendered</span><span class="t-value">R ${fmtR(tenderAmount)}</span></div>` : ''}
    ${changeAmount > 0 ? `<div class="total-row"><span class="t-label">Change</span><span class="t-value">R ${fmtR(changeAmount)}</span></div>` : ''}
    <div class="total-row balance">
      <span class="t-label">Outstanding Balance</span>
      <span class="t-value">R ${fmtR(outstandingBalance)}</span>
    </div>
  </div>

  <div class="payment-info">
    <div class="meta-item">
      <span class="meta-label">Payment Type</span>
      <span class="meta-value">${data.paymentType || '-'}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Payment Option</span>
      <span class="meta-value">${data.paymentOption || '-'}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Cashier</span>
      <span class="meta-value">${data.cashierName || '-'}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Cash Office</span>
      <span class="meta-value">${data.cashOffice || '-'}</span>
    </div>
  </div>

  <div class="footer">
    <div class="thank-you">Thank you for your payment</div>
  </div>
</div>
</body></html>`;
}

export function openReceiptPrintWindow(data: ReceiptPrintData, isReprint: boolean = true): Window | null {
  const html = generateReceiptHtml(data, isReprint);
  const printWindow = window.open('', '_blank', 'width=550,height=700,scrollbars=yes');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 400);
    };
  }
  return printWindow;
}

export async function openReceiptFromMultiPrint(items: PosMultiReceiptPrintItem[], isReprint: boolean = true, muniInfo?: MunicipalityInfo): Promise<Window | null> {
  if (!muniInfo) {
    try { muniInfo = await fetchMunicipalityInfo(); } catch (err) { console.error('[receipt-print] Failed to fetch municipality info:', err); }
  }
  const data = buildReceiptDataFromMultiPrint(items, muniInfo);
  return openReceiptPrintWindow(data, isReprint);
}

export { generateReceiptHtml as generateSlipReceiptHtml };
export { openReceiptPrintWindow as openSlipPrintWindow };
