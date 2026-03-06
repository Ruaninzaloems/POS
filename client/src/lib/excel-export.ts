import { fetchMunicipalityInfo } from './external-api';

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  title: string;
  infoRows: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
  columnWidths?: number[];
  currencyColumns?: number[];
  headerColor?: string;
  municipalityName?: string;
}

const COLORS = {
  darkBlue: '1F4E79',
  mediumBlue: '2E75B6',
  lightBlue: '4472C4',
  paleBlue: 'D6E4F0',
  headerBg: '1F4E79',
  altRow: 'F2F7FB',
  white: 'FFFFFF',
  black: '000000',
  gray: 'CCCCCC',
  darkGray: '333333',
  green: '548235',
  lightGreen: 'E2EFDA',
};

const STYLES = {
  title: {
    font: { bold: true, sz: 14, color: { rgb: COLORS.white }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.darkBlue } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  },
  infoLabel: {
    font: { bold: true, sz: 10, color: { rgb: COLORS.darkBlue }, name: 'Calibri' },
    alignment: { horizontal: 'left' as const },
  },
  infoValue: {
    font: { sz: 10, color: { rgb: COLORS.darkGray }, name: 'Calibri' },
    alignment: { horizontal: 'left' as const },
  },
  header: (color: string) => ({
    font: { bold: true, sz: 10, color: { rgb: COLORS.white }, name: 'Calibri' },
    fill: { fgColor: { rgb: color } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: {
      bottom: { style: 'thin' as const, color: { rgb: COLORS.black } },
      top: { style: 'thin' as const, color: { rgb: COLORS.black } },
      left: { style: 'thin' as const, color: { rgb: color } },
      right: { style: 'thin' as const, color: { rgb: color } },
    },
  }),
  dataCell: (isEven: boolean, isRight: boolean) => ({
    font: { sz: 10, name: 'Calibri' },
    fill: isEven ? { fgColor: { rgb: COLORS.altRow } } : undefined,
    alignment: { horizontal: (isRight ? 'right' : 'left') as 'right' | 'left', vertical: 'center' as const },
    border: {
      bottom: { style: 'hair' as const, color: { rgb: COLORS.gray } },
    },
  }),
  currencyCell: (isEven: boolean) => ({
    font: { sz: 10, name: 'Calibri' },
    fill: isEven ? { fgColor: { rgb: COLORS.altRow } } : undefined,
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
    numFmt: '#,##0.00',
    border: {
      bottom: { style: 'hair' as const, color: { rgb: COLORS.gray } },
    },
  }),
  totalLabel: {
    font: { bold: true, sz: 10, color: { rgb: COLORS.white }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.mediumBlue } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: {
      top: { style: 'thin' as const, color: { rgb: COLORS.darkBlue } },
      bottom: { style: 'double' as const, color: { rgb: COLORS.darkBlue } },
    },
  },
  totalValue: {
    font: { bold: true, sz: 10, color: { rgb: COLORS.white }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.mediumBlue } },
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
    numFmt: '#,##0.00',
    border: {
      top: { style: 'thin' as const, color: { rgb: COLORS.darkBlue } },
      bottom: { style: 'double' as const, color: { rgb: COLORS.darkBlue } },
    },
  },
  municipalityBar: {
    font: { bold: true, sz: 9, color: { rgb: COLORS.green }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.lightGreen } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
  },
};

function calcColWidth(header: string, colIdx: number, rows: (string | number)[][]): number {
  let max = header.length;
  for (const row of rows) {
    const val = row[colIdx];
    const len = val != null ? String(val).length : 0;
    if (len > max) max = len;
  }
  return Math.min(Math.max(max + 3, 12), 45);
}

export async function downloadExcel(options: ExcelExportOptions): Promise<void> {
  const {
    filename,
    sheetName = 'Report',
    title,
    infoRows,
    headers,
    rows,
    columnWidths,
    currencyColumns = [],
    headerColor = COLORS.headerBg,
    municipalityName,
  } = options;

  const colCount = headers.length;
  const wsData: any[][] = [];

  const titleRow: any[] = [{ v: title, t: 's', s: STYLES.title }];
  for (let c = 1; c < colCount; c++) {
    titleRow.push({ v: '', t: 's', s: STYLES.title });
  }
  wsData.push(titleRow);

  let resolvedMuniName = municipalityName;
  if (!resolvedMuniName) {
    try { const mi = await fetchMunicipalityInfo(); resolvedMuniName = mi.name; } catch {}
  }
  const muniRow: any[] = [{ v: `${resolvedMuniName || 'Municipality'} - Official Report`, t: 's', s: STYLES.municipalityBar }];
  for (let c = 1; c < colCount; c++) {
    muniRow.push({ v: '', t: 's', s: STYLES.municipalityBar });
  }
  wsData.push(muniRow);

  wsData.push(new Array(colCount).fill(''));

  for (const info of infoRows) {
    const infoR: any[] = new Array(colCount).fill('');
    infoR[0] = { v: info.label, t: 's', s: STYLES.infoLabel };
    infoR[1] = { v: info.value, t: 's', s: STYLES.infoValue };
    wsData.push(infoR);
  }

  wsData.push(new Array(colCount).fill(''));

  const headerRowIdx = wsData.length;
  const headerStyle = STYLES.header(headerColor);
  wsData.push(headers.map(h => ({ v: h, t: 's', s: headerStyle })));

  for (let r = 0; r < rows.length; r++) {
    const isEven = r % 2 === 0;
    const dataRow: any[] = rows[r].map((val, ci) => {
      const isCurrency = currencyColumns.includes(ci);
      if (isCurrency) {
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        return {
          v: isNaN(num) ? 0 : num,
          t: 'n',
          s: STYLES.currencyCell(isEven),
          z: '#,##0.00',
        };
      }
      return {
        v: val ?? '',
        t: typeof val === 'number' ? 'n' : 's',
        s: STYLES.dataCell(isEven, false),
      };
    });
    wsData.push(dataRow);
  }

  if (rows.length > 0 && currencyColumns.length > 0) {
    wsData.push(new Array(colCount).fill(''));
    const totalRow: any[] = new Array(colCount).fill({ v: '', t: 's', s: STYLES.totalLabel });
    totalRow[0] = { v: 'TOTALS', t: 's', s: STYLES.totalLabel };
    for (const ci of currencyColumns) {
      let sum = 0;
      for (const row of rows) {
        const val = row[ci];
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        if (!isNaN(num)) sum += num;
      }
      totalRow[ci] = { v: sum, t: 'n', s: STYLES.totalValue, z: '#,##0.00' };
    }
    wsData.push(totalRow);
  }

  const XLSX = (await import('xlsx-js-style')).default;

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
  ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });

  const widths = columnWidths
    ? columnWidths.map(w => ({ wch: w }))
    : headers.map((h, i) => ({ wch: calcColWidth(h, i, rows.map(r => r.map(v => v ?? ''))) }));
  ws['!cols'] = widths;

  const rowHeights: any[] = [];
  rowHeights[0] = { hpt: 30 };
  rowHeights[1] = { hpt: 18 };
  rowHeights[headerRowIdx] = { hpt: 24 };
  ws['!rows'] = rowHeights;

  const filterEnd = XLSX.utils.encode_cell({ r: headerRowIdx, c: colCount - 1 });
  const filterStart = XLSX.utils.encode_cell({ r: headerRowIdx, c: 0 });
  ws['!autofilter'] = { ref: `${filterStart}:${filterEnd}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

  const xlsxFilename = filename.replace(/\.csv$/i, '').replace(/\.xlsx$/i, '') + '.xlsx';
  XLSX.writeFile(wb, xlsxFilename, { bookType: 'xlsx' });
}

export async function downloadTransactionExcel(options: {
  filename: string;
  accountNumber: string;
  reportName: string;
  financialYear: string;
  period?: string;
  headers: string[];
  monthGroups: { month: string; rows: (string | number)[][] }[];
  currencyColumns?: number[];
  municipalityName?: string;
}): Promise<void> {
  const {
    filename,
    accountNumber,
    reportName,
    financialYear,
    period,
    headers,
    monthGroups,
    currencyColumns = [],
  } = options;

  const colCount = headers.length;
  const headerColor = COLORS.darkBlue;
  const wsData: any[][] = [];

  const titleRow: any[] = [{ v: reportName, t: 's', s: STYLES.title }];
  for (let c = 1; c < colCount; c++) titleRow.push({ v: '', t: 's', s: STYLES.title });
  wsData.push(titleRow);

  let resolvedMuniName2 = options.municipalityName;
  if (!resolvedMuniName2) {
    try { const mi = await fetchMunicipalityInfo(); resolvedMuniName2 = mi.name; } catch {}
  }
  const muniRow: any[] = [{ v: `${resolvedMuniName2 || 'Municipality'} - Official Report`, t: 's', s: STYLES.municipalityBar }];
  for (let c = 1; c < colCount; c++) muniRow.push({ v: '', t: 's', s: STYLES.municipalityBar });
  wsData.push(muniRow);

  wsData.push(new Array(colCount).fill(''));

  const infoItems = [
    { label: 'Account Number:', value: accountNumber },
    { label: 'Financial Year:', value: financialYear },
  ];
  if (period) infoItems.push({ label: 'Period:', value: period });
  infoItems.push({ label: 'Generated:', value: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-ZA') });

  for (const info of infoItems) {
    const infoR: any[] = new Array(colCount).fill('');
    infoR[0] = { v: info.label, t: 's', s: STYLES.infoLabel };
    infoR[1] = { v: info.value, t: 's', s: STYLES.infoValue };
    wsData.push(infoR);
  }

  wsData.push(new Array(colCount).fill(''));

  const headerRowIdx = wsData.length;
  const headerStyle = STYLES.header(headerColor);
  wsData.push(headers.map(h => ({ v: h, t: 's', s: headerStyle })));

  const monthSectionStyle = {
    font: { bold: true, sz: 10, color: { rgb: COLORS.darkBlue }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.paleBlue } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: {
      bottom: { style: 'thin' as const, color: { rgb: COLORS.lightBlue } },
      top: { style: 'thin' as const, color: { rgb: COLORS.lightBlue } },
    },
  };

  let globalRowIdx = 0;
  for (const group of monthGroups) {
    const sectionRow: any[] = new Array(colCount).fill({ v: '', t: 's', s: monthSectionStyle });
    sectionRow[0] = { v: `--- ${group.month} ---`, t: 's', s: monthSectionStyle };
    wsData.push(sectionRow);

    if (group.rows.length === 0) {
      const emptyRow: any[] = new Array(colCount).fill('');
      emptyRow[0] = { v: 'No transactions for this period', t: 's', s: { font: { italic: true, sz: 10, color: { rgb: '999999' } } } };
      wsData.push(emptyRow);
    } else {
      for (const row of group.rows) {
        const isEven = globalRowIdx % 2 === 0;
        const dataRow: any[] = row.map((val, ci) => {
          const isCurrency = currencyColumns.includes(ci);
          if (isCurrency) {
            const num = typeof val === 'number' ? val : parseFloat(String(val));
            return { v: isNaN(num) ? 0 : num, t: 'n', s: STYLES.currencyCell(isEven), z: '#,##0.00' };
          }
          return { v: val ?? '', t: typeof val === 'number' ? 'n' : 's', s: STYLES.dataCell(isEven, false) };
        });
        wsData.push(dataRow);
        globalRowIdx++;
      }
    }
  }

  const XLSX = (await import('xlsx-js-style')).default;

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
  ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });

  const allRows = monthGroups.flatMap(g => g.rows);
  ws['!cols'] = headers.map((h, i) => ({ wch: calcColWidth(h, i, allRows.map(r => r.map(v => v ?? ''))) }));

  const rowHeights: any[] = [];
  rowHeights[0] = { hpt: 30 };
  rowHeights[1] = { hpt: 18 };
  rowHeights[headerRowIdx] = { hpt: 24 };
  ws['!rows'] = rowHeights;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  const xlsxFilename = filename.replace(/\.csv$/i, '').replace(/\.xlsx$/i, '') + '.xlsx';
  XLSX.writeFile(wb, xlsxFilename, { bookType: 'xlsx' });
}

export async function downloadSummaryExcel(options: {
  filename: string;
  accountNumber: string;
  financialYears: string[];
  headers: string[];
  yearGroups: { year: string; rows: (string | number)[][] }[];
  currencyColumns?: number[];
  municipalityName?: string;
}): Promise<void> {
  const {
    filename,
    accountNumber,
    financialYears,
    headers,
    yearGroups,
    currencyColumns = [],
  } = options;

  const colCount = headers.length;
  const headerColor = COLORS.darkBlue;
  const wsData: any[][] = [];

  const titleRow: any[] = [{ v: 'Transaction Summary', t: 's', s: STYLES.title }];
  for (let c = 1; c < colCount; c++) titleRow.push({ v: '', t: 's', s: STYLES.title });
  wsData.push(titleRow);

  let resolvedMuniName3 = options.municipalityName;
  if (!resolvedMuniName3) {
    try { const mi = await fetchMunicipalityInfo(); resolvedMuniName3 = mi.name; } catch {}
  }
  const muniRow: any[] = [{ v: `${resolvedMuniName3 || 'Municipality'} - Official Report`, t: 's', s: STYLES.municipalityBar }];
  for (let c = 1; c < colCount; c++) muniRow.push({ v: '', t: 's', s: STYLES.municipalityBar });
  wsData.push(muniRow);

  wsData.push(new Array(colCount).fill(''));

  const infoItems = [
    { label: 'Account Number:', value: accountNumber },
    { label: 'Financial Year(s):', value: financialYears.join(', ') },
    { label: 'Generated:', value: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-ZA') },
  ];
  for (const info of infoItems) {
    const infoR: any[] = new Array(colCount).fill('');
    infoR[0] = { v: info.label, t: 's', s: STYLES.infoLabel };
    infoR[1] = { v: info.value, t: 's', s: STYLES.infoValue };
    wsData.push(infoR);
  }

  wsData.push(new Array(colCount).fill(''));

  const headerStyle = STYLES.header(headerColor);
  wsData.push(headers.map(h => ({ v: h, t: 's', s: headerStyle })));

  const yearSectionStyle = {
    font: { bold: true, sz: 10, color: { rgb: COLORS.white }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.lightBlue } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
  };

  let globalRowIdx = 0;
  for (const group of yearGroups) {
    const sectionRow: any[] = new Array(colCount).fill({ v: '', t: 's', s: yearSectionStyle });
    sectionRow[0] = { v: `Financial Year: ${group.year}`, t: 's', s: yearSectionStyle };
    wsData.push(sectionRow);

    for (const row of group.rows) {
      const isEven = globalRowIdx % 2 === 0;
      const dataRow: any[] = row.map((val, ci) => {
        const isCurrency = currencyColumns.includes(ci);
        if (isCurrency) {
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          return { v: isNaN(num) ? 0 : num, t: 'n', s: STYLES.currencyCell(isEven), z: '#,##0.00' };
        }
        return { v: val ?? '', t: typeof val === 'number' ? 'n' : 's', s: STYLES.dataCell(isEven, false) };
      });
      wsData.push(dataRow);
      globalRowIdx++;
    }
  }

  const XLSX = (await import('xlsx-js-style')).default;

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
  ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });

  const allRows = yearGroups.flatMap(g => g.rows);
  ws['!cols'] = headers.map((h, i) => ({ wch: calcColWidth(h, i, allRows.map(r => r.map(v => v ?? ''))) }));

  const rowHeights: any[] = [];
  rowHeights[0] = { hpt: 30 };
  rowHeights[1] = { hpt: 18 };
  ws['!rows'] = rowHeights;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');

  const xlsxFilename = filename.replace(/\.csv$/i, '').replace(/\.xlsx$/i, '') + '.xlsx';
  XLSX.writeFile(wb, xlsxFilename, { bookType: 'xlsx' });
}
