export interface ReceiptPrintData {
  receiptNo?: string;
  receiptNumber?: string;
  receiptDate?: string;
  accountNumber?: string;
  consumerName?: string;
  municipalityName?: string;
  address?: string;
  totalAmount?: number;
  amount?: number;
  paymentType?: string;
  cashierName?: string;
  cashOffice?: string;
  paymentOption?: string;
  services?: { serviceDescription?: string; description?: string; amount?: number }[];
}

function fmtR(val: number | undefined | null): string {
  const n = val ?? 0;
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return dateStr;
  }
}

export function generateSlipReceiptHtml(data: ReceiptPrintData, isReprint: boolean = true): string {
  const services = Array.isArray(data.services) ? data.services : [];
  const total = data.totalAmount ?? data.amount ?? 0;
  const receiptNo = data.receiptNo || data.receiptNumber || '';
  const municipality = data.municipalityName || 'George Municipality';

  const svcRows = services.map(s => {
    const desc = s.serviceDescription || s.description || '';
    const amt = s.amount ?? 0;
    return `<tr><td class="svc-desc">${desc}</td><td class="svc-amt">R ${fmtR(amt)}</td></tr>`;
  }).join('');

  const reprintBanner = isReprint ? `
    <div class="reprint-banner">
      <span>REPRINT</span>
    </div>` : '';

  const reprintWatermark = isReprint ? `
    <div class="watermark">REPRINT</div>` : '';

  const reprintTimestamp = isReprint ? `
    <p class="reprint-stamp">Reprinted: ${fmtDate(new Date().toISOString())}</p>` : '';

  return `<!DOCTYPE html>
<html><head><title>Receipt ${receiptNo}</title>
<style>
  @page {
    size: 80mm auto;
    margin: 2mm 3mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: 11px;
    line-height: 1.3;
    width: 72mm;
    max-width: 72mm;
    margin: 0 auto;
    padding: 4mm 2mm;
    color: #000;
    position: relative;
    background: #fff;
  }

  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 42px;
    font-weight: 900;
    color: rgba(200, 0, 0, 0.08);
    letter-spacing: 8px;
    pointer-events: none;
    z-index: 0;
    white-space: nowrap;
    text-transform: uppercase;
  }

  .receipt-content {
    position: relative;
    z-index: 1;
  }

  .header {
    text-align: center;
    padding-bottom: 4px;
  }
  .header h1 {
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 1px;
  }
  .header .addr {
    font-size: 9px;
    color: #444;
  }
  .header .coat {
    font-size: 18px;
    margin-bottom: 2px;
    display: block;
  }

  .reprint-banner {
    text-align: center;
    margin: 3px 0;
    padding: 2px 0;
    border: 2px solid #c00;
    border-radius: 3px;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 3px,
      rgba(200, 0, 0, 0.03) 3px,
      rgba(200, 0, 0, 0.03) 6px
    );
  }
  .reprint-banner span {
    font-size: 14px;
    font-weight: 900;
    color: #c00;
    letter-spacing: 6px;
    text-transform: uppercase;
  }

  .divider {
    border: none;
    border-top: 1px dashed #000;
    margin: 4px 0;
  }
  .divider-double {
    border: none;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    height: 3px;
    margin: 4px 0;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    padding: 1px 0;
  }
  .info-row .label {
    color: #333;
    font-weight: bold;
    min-width: 65px;
  }
  .info-row .value {
    text-align: right;
    flex: 1;
    word-break: break-all;
  }

  table.services {
    width: 100%;
    border-collapse: collapse;
    margin: 2px 0;
  }
  table.services td {
    font-size: 10px;
    padding: 1px 0;
    vertical-align: top;
  }
  td.svc-desc {
    text-align: left;
    max-width: 45mm;
    word-wrap: break-word;
  }
  td.svc-amt {
    text-align: right;
    white-space: nowrap;
    font-weight: bold;
  }

  .total-line {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 900;
    padding: 3px 0;
  }

  .footer {
    text-align: center;
    font-size: 9px;
    color: #555;
    margin-top: 4px;
    padding-top: 3px;
  }
  .footer .thanks {
    font-size: 10px;
    font-weight: bold;
    color: #000;
    margin-bottom: 2px;
  }

  .reprint-stamp {
    text-align: center;
    font-size: 8px;
    color: #999;
    font-style: italic;
    margin-top: 2px;
  }

  .bg-pattern {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none;
    z-index: 0;
    background-image: 
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 14px,
        rgba(0,0,0,0.015) 14px,
        rgba(0,0,0,0.015) 15px
      );
  }

  @media print {
    body { padding: 0; margin: 0 auto; }
    .watermark { position: fixed; }
    .bg-pattern { position: fixed; }
  }

  @media screen {
    body {
      padding: 15px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 10px auto;
    }
  }
</style></head>
<body>
  <div class="bg-pattern"></div>
  ${reprintWatermark}
  <div class="receipt-content">
    <div class="header">
      <span class="coat">\u2696\uFE0F</span>
      <h1>${municipality}</h1>
      ${data.address ? `<p class="addr">${data.address}</p>` : ''}
    </div>

    ${reprintBanner}

    <hr class="divider-double" />

    <div class="info-row"><span class="label">Receipt:</span><span class="value">${receiptNo}</span></div>
    <div class="info-row"><span class="label">Date:</span><span class="value">${fmtDate(data.receiptDate)}</span></div>
    <div class="info-row"><span class="label">Account:</span><span class="value">${data.accountNumber || ''}</span></div>
    <div class="info-row"><span class="label">Consumer:</span><span class="value">${data.consumerName || ''}</span></div>

    <hr class="divider" />

    ${services.length > 0 ? `
    <table class="services">${svcRows}</table>
    <hr class="divider" />
    ` : ''}

    <div class="total-line">
      <span>TOTAL</span>
      <span>R ${fmtR(total)}</span>
    </div>

    <hr class="divider-double" />

    <div class="info-row"><span class="label">Pay Type:</span><span class="value">${data.paymentType || ''}</span></div>
    ${data.paymentOption ? `<div class="info-row"><span class="label">Pay Opt:</span><span class="value">${data.paymentOption}</span></div>` : ''}
    <div class="info-row"><span class="label">Cashier:</span><span class="value">${data.cashierName || ''}</span></div>
    ${data.cashOffice ? `<div class="info-row"><span class="label">Office:</span><span class="value">${data.cashOffice}</span></div>` : ''}

    <hr class="divider" />

    <div class="footer">
      <p class="thanks">Thank you for your payment</p>
      <p>${municipality}</p>
      <p>Keep this receipt for your records</p>
      ${reprintTimestamp}
    </div>
  </div>
</body></html>`;
}

export function openSlipPrintWindow(data: ReceiptPrintData, isReprint: boolean = true): Window | null {
  const html = generateSlipReceiptHtml(data, isReprint);
  const printWindow = window.open('', '_blank', 'width=340,height=500,scrollbars=yes');
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
