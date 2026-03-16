import { Injectable } from '@angular/core';

export interface ExportOptions {
  title: string;
  tabName: string;
  accountNo: string;
  accountName?: string;
  accountStatus?: string;
  address?: string;
  financialYear?: string;
  extraHeaders?: { label: string; value: string }[];
  customFilename?: string;
}

@Injectable({ providedIn: 'root' })
export class ExportService {

  private getExportDate(): { dateStr: string; timeStr: string; fileDate: string } {
    const d = new Date();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const fileDate = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return { dateStr, timeStr, fileDate };
  }

  private buildFilename(tabName: string, accountNo: string, ext: string): string {
    const { fileDate } = this.getExportDate();
    const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return `GEORGE_MUNICIPALITY_${clean(tabName)}_${clean(accountNo)}_${fileDate}.${ext}`;
  }

  private csvEsc(val: any): string {
    const s = val == null ? '' : String(val);
    return s.replace(/"/g, '""');
  }

  exportCsv(options: ExportOptions, headers: string[], rows: (string | number)[][]): void {
    const { dateStr, timeStr } = this.getExportDate();
    const lines: string[] = [];

    lines.push(`"GEORGE MUNICIPALITY - ${this.csvEsc(options.title)}"`);
    lines.push('""');
    lines.push(`"Account Number:","${this.csvEsc(options.accountNo)}","","Account Holder:","${this.csvEsc(options.accountName || '')}"`);
    if (options.accountStatus) {
      lines.push(`"Account Status:","${this.csvEsc(options.accountStatus)}"`);
    }
    if (options.address) {
      lines.push(`"Address:","${this.csvEsc(options.address)}"`);
    }
    if (options.financialYear) {
      lines.push(`"Financial Year:","${this.csvEsc(options.financialYear)}"`);
    }
    if (options.extraHeaders) {
      for (const h of options.extraHeaders) {
        lines.push(`"${this.csvEsc(h.label)}:","${this.csvEsc(h.value)}"`);
      }
    }
    lines.push(`"Export Date:","${dateStr}","","Time:","${timeStr}"`);
    lines.push('""');

    lines.push(headers.map(h => `"${this.csvEsc(h)}"`).join(','));
    for (const row of rows) {
      lines.push(row.map(v => `"${this.csvEsc(v)}"`).join(','));
    }

    const csv = lines.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const filename = options.customFilename ? `${options.customFilename}.csv` : this.buildFilename(options.tabName, options.accountNo, 'csv');
    this.downloadBlob(blob, filename);
  }

  exportPdf(options: ExportOptions, headers: string[], rows: (string | number)[][], columnAligns?: ('left' | 'right' | 'center')[]): void {
    const { dateStr, timeStr } = this.getExportDate();
    const aligns = columnAligns || headers.map(() => 'left');

    let html = `<!DOCTYPE html><html><head><title>${this.escHtml(options.title)}</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; padding: 20px; }
  .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #0f2b46; padding-bottom: 12px; }
  .header h1 { font-size: 16px; color: #0f2b46; margin: 0 0 4px; }
  .header h2 { font-size: 13px; color: #c9a84c; margin: 0 0 8px; font-weight: 500; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 24px; font-size: 9.5px; justify-content: center; color: #555; }
  .meta span { white-space: nowrap; }
  .meta b { color: #0f2b46; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #0f2b46; color: #fff; padding: 6px 8px; font-size: 9.5px; text-align: left; white-space: nowrap; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 9.5px; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 16px; text-align: center; font-size: 8.5px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  <h1>GEORGE MUNICIPALITY</h1>
  <h2>${this.escHtml(options.title)}</h2>
  <div class="meta">
    <span><b>Account:</b> ${this.escHtml(options.accountNo)}</span>
    ${options.accountName ? `<span><b>Holder:</b> ${this.escHtml(options.accountName)}</span>` : ''}
    ${options.accountStatus ? `<span><b>Status:</b> ${this.escHtml(options.accountStatus)}</span>` : ''}
    ${options.financialYear ? `<span><b>FY:</b> ${this.escHtml(options.financialYear)}</span>` : ''}
    ${options.address ? `<span><b>Address:</b> ${this.escHtml(options.address)}</span>` : ''}
    <span><b>Date:</b> ${dateStr} ${timeStr}</span>
  </div>
</div>
<table>
  <thead><tr>${headers.map((h, i) => `<th class="${aligns[i] === 'right' ? 'text-right' : aligns[i] === 'center' ? 'text-center' : ''}">${this.escHtml(h)}</th>`).join('')}</tr></thead>
  <tbody>`;

    for (const row of rows) {
      html += '<tr>';
      row.forEach((val, i) => {
        const align = aligns[i] === 'right' ? ' class="text-right"' : aligns[i] === 'center' ? ' class="text-center"' : '';
        html += `<td${align}>${this.escHtml(String(val ?? ''))}</td>`;
      });
      html += '</tr>';
    }

    html += `</tbody></table>
<div class="footer">Generated by George Municipality POS System &bull; ${dateStr} ${timeStr}</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=1100,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
