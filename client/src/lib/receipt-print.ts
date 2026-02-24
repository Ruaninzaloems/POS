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
    if (dateStr.includes('/') && dateStr.length <= 20) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
  } catch {
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

  const addressLines = munAddress.split('\n').map(l => `<div>${l}</div>`).join('');

  const hasVatInServices = services.some(s => {
    const desc = (s.description || s.serviceDescription || '').toLowerCase();
    return desc.includes('vat');
  });

  const svcRows = services
    .filter(s => (s.description || s.serviceDescription || '').trim())
    .map(s => {
      const desc = s.description || s.serviceDescription || '';
      const amt = s.amount ?? 0;
      return `<tr><td class="svc-label">${desc}</td><td class="value">${fmtR(amt)}</td></tr>`;
    }).join('');

  const reprintLabel = isReprint ? `<tr><td colspan="2" class="center bold reprint-label">Reprint</td></tr><tr><td colspan="2">&nbsp;</td></tr>` : '';

  const accountAddr = data.address || '';
  const addressFormatted = accountAddr ? accountAddr.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).join('<br/>') : '';

  return `<!DOCTYPE html>
<html><head><title>Receipt ${receiptNo}</title>
<style>
  @page {
    size: A4;
    margin: 15mm 20mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    background: #fff;
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
  }

  table.receipt {
    width: 100%;
    border-collapse: collapse;
  }
  table.receipt td {
    padding: 2px 4px;
    vertical-align: top;
    font-size: 12px;
  }
  table.receipt td.label {
    text-align: left;
    font-weight: bold;
    width: 45%;
    white-space: nowrap;
  }
  table.receipt td.svc-label {
    text-align: left;
    width: 45%;
    white-space: nowrap;
  }
  table.receipt td.value {
    text-align: right;
    width: 55%;
    word-break: break-word;
  }
  table.receipt td.center {
    text-align: center;
  }
  table.receipt td.bold {
    font-weight: bold;
  }
  .reprint-label {
    font-size: 14px;
    font-weight: bold;
  }
  .header-section {
    text-align: center;
    margin-bottom: 10px;
  }
  .header-section h1 {
    font-size: 14px;
    font-weight: bold;
    margin: 0;
  }
  .header-section .addr {
    font-size: 11px;
  }
  .header-section .vat {
    font-size: 11px;
    margin-top: 2px;
  }
  .separator {
    border: none;
    border-top: 1px solid #000;
    margin: 6px 0;
  }
  .separator-thick {
    border: none;
    border-top: 2px solid #000;
    margin: 6px 0;
  }
  .spacer td {
    padding: 4px 0;
  }
  .thank-you {
    text-align: center;
    margin-top: 12px;
    font-size: 12px;
  }

  @media print {
    body { padding: 0; margin: 0 auto; max-width: 500px; }
  }
  @media screen {
    body {
      padding: 30px 20px;
      border: 1px solid #ddd;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 20px auto;
    }
  }
</style></head>
<body>
  <div class="header-section">
    <h1>${municipality}</h1>
    ${addressLines}
    <div class="vat">VAT Registration Number: ${vatReg}</div>
  </div>

  <table class="receipt">
    ${reprintLabel}
    <tr><td class="label">Receipt No</td><td class="value">${receiptNo}</td></tr>
    <tr><td class="label">Receipt Date</td><td class="value">${fmtDate(data.receiptDate)}</td></tr>
    <tr><td class="label">Account No</td><td class="value">${data.accountNumber || ''}</td></tr>
    ${data.oldAccountCode ? `<tr><td class="label">Old Account No</td><td class="value">${data.oldAccountCode}</td></tr>` : ''}
    ${(data.accountName || data.consumerName) ? `<tr><td class="label">Account Name</td><td class="value">${data.accountName || data.consumerName || ''}</td></tr>` : ''}
    ${data.sgNumber ? `<tr><td class="label">SG Number</td><td class="value">${data.sgNumber}</td></tr>` : ''}
    ${addressFormatted ? `<tr><td class="label">Address</td><td class="value">${addressFormatted}</td></tr>` : ''}

    <tr class="spacer"><td colspan="2"></td></tr>

    ${svcRows}
    ${!hasVatInServices ? `<tr><td class="label">Vat Amount</td><td class="value">${fmtR(vatAmount)}</td></tr>` : ''}

    <tr class="spacer"><td colspan="2"></td></tr>
    <tr><td colspan="2"><hr class="separator-thick" /></td></tr>

    <tr><td class="label bold">Total</td><td class="value bold">${fmtR(total)}</td></tr>
    <tr><td class="label">Tender Amount</td><td class="value">${fmtR(tenderAmount)}</td></tr>
    <tr><td class="label">Change</td><td class="value">${fmtR(changeAmount)}</td></tr>

    <tr class="spacer"><td colspan="2"></td></tr>

    <tr><td class="label">Outstanding Balance</td><td class="value">${fmtR(outstandingBalance)}</td></tr>

    <tr class="spacer"><td colspan="2"></td></tr>

    <tr><td class="label">Payment Type</td><td class="value">${data.paymentType || ''}</td></tr>
    <tr><td class="label">Payment Option</td><td class="value">${data.paymentOption || ''}</td></tr>
    <tr><td class="label">Cashier</td><td class="value">${data.cashierName || ''}</td></tr>
    <tr><td class="label">Cash Office</td><td class="value">${data.cashOffice || ''}</td></tr>
  </table>

  <div class="thank-you">Thank you.</div>
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
    try { muniInfo = await fetchMunicipalityInfo(); } catch {}
  }
  const data = buildReceiptDataFromMultiPrint(items, muniInfo);
  return openReceiptPrintWindow(data, isReprint);
}

export { generateReceiptHtml as generateSlipReceiptHtml };
export { openReceiptPrintWindow as openSlipPrintWindow };
