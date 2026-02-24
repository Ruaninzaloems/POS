import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPropertyDetails, getConsumptionUnits, getSupplementaryValuations } from './enquiries-service';
import { fetchMunicipalityInfo, MunicipalityInfo } from './external-api';

let MUNICIPALITY = '';
let ADDR_LINE1 = '';
let ADDR_LINE2 = '';
let ADDR_LINE3 = '';
let TEL = '';
let FAX = '';
let EMAIL = '';
let WEBSITE = '';
let VAT_NO = '';

async function loadMuniConstants(): Promise<void> {
  if (MUNICIPALITY) return;
  try {
    const mi = await fetchMunicipalityInfo();
    MUNICIPALITY = mi.name || '';
    ADDR_LINE1 = mi.address1 || '';
    ADDR_LINE2 = mi.address2 || '';
    ADDR_LINE3 = mi.address3 || (mi.postalCode ? `${mi.address2 || ''} - ${mi.postalCode}` : '');
    TEL = mi.tel || '';
    FAX = mi.fax || '';
    EMAIL = mi.email || '';
    WEBSITE = mi.website || '';
    VAT_NO = mi.vatNo || '';
  } catch (e) {
    console.warn('Failed to load municipality info for property letters:', e);
  }
}

function fmt(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: any): string {
  if (!v) return '';
  try { return new Date(v).toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return String(v); }
}

function fmtInt(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadPropertyData(accountId: number) {
  const [propResult, consResult] = await Promise.allSettled([
    getPropertyDetails(accountId),
    getConsumptionUnits(accountId),
  ]);
  let prop = propResult.status === 'fulfilled' ? propResult.value : null;
  if (Array.isArray(prop)) prop = prop[0] || null;
  const cu = consResult.status === 'fulfilled' ? (Array.isArray(consResult.value) ? consResult.value[0] : consResult.value) : null;
  const propertyId = prop?.propertyId || prop?.property_ID || cu?.unit_ID;

  let valuations: any[] = [];
  if (propertyId) {
    try {
      const v = await getSupplementaryValuations(propertyId);
      valuations = Array.isArray(v) ? v : v ? [v] : [];
    } catch { valuations = []; }
  }

  return { prop: prop || {}, cu: cu || {}, valuations, propertyId };
}

function getRollPeriod(prop: any, valuations: any[]): { startDate: string; endDate: string; rollYear: number } {
  const rollStart = prop.rollStartDate || (valuations.length > 0 ? valuations[0].rollDate : null);
  const rollEnd = prop.expectedExpiryDate || (valuations.length > 0 ? valuations[0].expectedExpiryDate : null);
  const startDate = rollStart ? fmtDate(rollStart) : '';
  const endDate = rollEnd ? fmtDate(rollEnd) : '';
  const rollYear = rollStart ? new Date(rollStart).getFullYear() : new Date().getFullYear();
  return { startDate, endDate, rollYear };
}

function addMunicipalityHeader(doc: jsPDF, margin: number, pageW: number, y: number): number {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(MUNICIPALITY, pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(ADDR_LINE1, margin, y);
  doc.text(`Tel: ${TEL}`, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text(ADDR_LINE2, margin + 10, y);
  doc.text(`Fax: ${FAX}`, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text(ADDR_LINE3, margin + 10, y);
  doc.text(`Email: ${EMAIL}`, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text('', margin, y);
  doc.text('Website:', pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text('', margin, y);
  doc.text(WEBSITE, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text('', margin, y);
  doc.text('Municipality VAT No:-', pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text('', margin, y);
  doc.text(VAT_NO, pageW - margin, y, { align: 'right' });
  y += 6;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  return y;
}

function addRecipientAddress(doc: jsPDF, prop: any, cu: any, margin: number, y: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const ownerName = (prop.name || cu.accountName || '').trim();
  if (ownerName) { doc.text(ownerName, margin, y); y += 4.5; }

  const addr1 = prop.streetNumber ? `${prop.streetNumber} ${prop.streetName || ''}`.trim() : (cu.nonStandAddLine1 || '');
  const erfNum = cu.erfNumber || prop.erfNumber || '';
  const addressLine = erfNum ? `ERF ${erfNum}` : addr1;
  if (addressLine) { doc.text(addressLine, margin, y); y += 4.5; }

  const suburb = prop.subSuburb || prop.suburb || cu.nonStandAddSuburb || '';
  if (suburb) { doc.text(suburb, margin, y); y += 4.5; }

  const town = prop.town || '';
  if (town) { doc.text(town, margin, y); y += 4.5; }

  const postalCode = prop.postalCode || '';
  if (postalCode) { doc.text(postalCode, margin, y); y += 4.5; }
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Dear Sir/Madam', margin, y);
  y += 8;

  return y;
}

function buildPropertyDescription(prop: any, cu: any): string {
  if (prop.propertyDescription) return prop.propertyDescription;
  if (cu.propertyDescription) return cu.propertyDescription;
  const erfNum = cu.erfNumber || prop.erfNumber || '';
  const subSuburb = prop.subSuburb || prop.suburb || cu.nonStandAddSuburb || '';
  if (erfNum) {
    const location = subSuburb || prop.town || '';
    return location ? `ERF ${erfNum} ${location}` : `ERF ${erfNum}`;
  }
  const streetAddr = prop.streetNumber ? `${prop.streetNumber} ${prop.streetName || ''}`.trim() : '';
  if (streetAddr) return streetAddr;
  return cu.nonStandAddLine1 || '';
}

function addPropertyDetailsTable(doc: jsPDF, prop: any, cu: any, margin: number, contentW: number, y: number): number {
  const propDesc = buildPropertyDescription(prop, cu);
  const sgNumber = prop.sgNumber || cu.sgNumber || '';
  const parts = [prop.subSuburb || cu.nonStandAddSuburb || '', prop.town || ''].filter(Boolean);
  const address = parts.join(', ');
  const marketValue = fmt(prop.marketValue || cu.marketValue);
  const standSize = fmtInt(prop.standSize || cu.standSize);
  const ratingCategory = prop.typeofUse || '';
  const typeOfUse = prop.townPlanningZoneType || prop.typeofUse || '';

  const fields: [string, string][] = [
    ['Property Description', propDesc],
    ['SG Number', sgNumber],
    ['Address', address],
    ['Market Value', marketValue],
    ['Registered Extent (m\u00B2)', standSize],
    ['Rating Category', ratingCategory],
    ['Type Of Use', typeOfUse],
  ];

  doc.setFontSize(8.5);
  for (const [label, value] of fields) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '-', margin + 45, y);
    y += 5;
  }
  y += 4;
  return y;
}

function addPartitionTable(doc: jsPDF, valuations: any[], cu: any, margin: number, contentW: number, y: number): number {
  const partitionData = valuations.length > 0
    ? valuations.map(v => [
        String(v.partitionID || cu.unit_ID || ''),
        v.valuationCategory || v.categoryDesc || '-',
        fmtInt(v.standMarketValue),
        fmtInt(v.standSize),
        v.zoneDesc || v.typeOfUseDesc || '-',
        v.typeOfUseDesc || v.zoneDesc || '-',
        v.rateability || v.rateabilityDesc || '-',
      ])
    : [[
        String(cu.unit_ID || ''),
        '-',
        fmtInt(cu.marketValue || 0),
        fmtInt(cu.standSize || 0),
        '-',
        '-',
        '-',
      ]];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Partition ID', 'Valuation\nCategory', 'Partition Market\nValue', 'Partition Stand\nSize (m\u00B2)', 'Rating\nCategory', 'Type Of Use', 'Rateability']],
    body: partitionData,
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    bodyStyles: { halign: 'center' },
    theme: 'grid',
  });

  return (doc as any).lastAutoTable.finalY + 6;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export async function generateSection49Letter(accountId: number): Promise<void> {
  await loadMuniConstants();
  const { prop, cu, valuations } = await loadPropertyData(accountId);
  const { startDate, endDate, rollYear } = getRollPeriod(prop, valuations);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  let y = 12;
  y = addMunicipalityHeader(doc, margin, pageW, y);
  y = addRecipientAddress(doc, prop, cu, margin, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`SECTION 49 - PUBLIC NOTICE OF THE GENERAL VALUATION ROLL ${rollYear} IN`, pageW / 2, y, { align: 'center' });
  y += 5;
  doc.text('RESPECT OF THE LOCAL GOVERNMENT: MUNICIPAL PROPERTY RATES ACT NO 6 OF 2004', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  y = addWrappedText(doc, `This notice is served to you under the requirements of Section 49 of the Local Government:  Municipal Property Rates Act of 2004 (hereafter referred to as the "Act"). The purpose of this notice is to advise you of the valuation placed on the following property as determined during the General Valuation conducted under the provisions of the Act.`, margin, y, contentW, 3.8);
  y += 4;

  y = addWrappedText(doc, 'The details of this, as per the General Valuation Roll, are as follows:', margin, y, contentW, 3.8);
  y += 5;

  y = addPropertyDetailsTable(doc, prop, cu, margin, contentW, y);
  y = addPartitionTable(doc, valuations, cu, margin, contentW, y);

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - 15) {
      doc.addPage();
      y = 15;
    }
  };

  const rollPeriodStr = (startDate && endDate) ? `${startDate} to ${endDate}` : 'the current valuation roll period';

  const paragraphs = [
    `You are hereby advised that you have the right to lodge an objection in terms of Section 49(1) (a) (ii) of the Act.  This section states that any property owner or other person may, if they so desire, lodge an objection with the Municipal Manager in respect of any matter reflected in, or omitted from, the Valuation roll within a specific period.  It must however be borne in mind that in terms of section 50(2) of the Act an objection must be in relation to a specific individual property and not against the valuation roll as such.`,
    `Objections to this notice will be accepted on the official form during the period as prescribed. No late objections will be accepted.`,
    `The official form for the lodging of an objection is obtainable at all Municipal Customer Care Centres or on the ${MUNICIPALITY}'s website ${WEBSITE}.`,
    `Should you require any further information in this regard please do not hesitate to contact the Municipality's Customer Call Centre on ${TEL} or visit ${WEBSITE}.`,
    `Notice is hereby given, in terms of Section 49 of the Local Government Municipal Property Rates Act No. 6 of 2004 (hereafter referred to as the "Act"), that the General Valuation Roll for the period ${rollPeriodStr} is open for public inspection at the office of the`,
    `Municipal Manager, Mondays to Fridays, during office hours, i.e. 08:00 to 16:00; as well as on the ${MUNICIPALITY}'s website, ${WEBSITE}.`,
    `Property owners or other persons are hereby invited, in terms of Section 49 of the Act, to lodge an objection with the Municipal Manager in respect of any matter reflected in, or omitted from, the General Valuation Roll within the abovementioned period.`,
    `Attention is specifically drawn to the fact that in terms of Section 50(2) of the Act, an objection must be in relation to a specific individual property and not against the General Valuation Roll as such.`,
    `Objection forms are obtainable at all Customer Care Centres, or on the ${MUNICIPALITY}'s website, ${WEBSITE}.`,
    `Completed forms must be returned to:`,
  ];

  for (const p of paragraphs) {
    checkPageBreak(20);
    y = addWrappedText(doc, p, margin, y, contentW, 3.8);
    y += 4;
  }

  checkPageBreak(20);
  y += 4;
  doc.text('Alternatively, they may be handed in at any Municipal Customer Care Centre.', margin, y);
  y += 6;
  doc.text(`For enquiries, please contact the Municipality's Customer Call Centre on ${TEL}.`, margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CLOSING DATE FOR SUBMISSION OF OBJECTIONS:', pageW / 2, y, { align: 'center' });

  const safeName = (prop.name || cu.accountName || 'Property').trim().replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Section49_Letter_${safeName}.pdf`);
}

export async function generateSection78Letter(accountId: number): Promise<void> {
  await loadMuniConstants();
  const { prop, cu, valuations } = await loadPropertyData(accountId);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  let y = 12;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(MUNICIPALITY, pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(ADDR_LINE1, margin + 55, y);
  doc.text(`Tel: ${TEL}`, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text(ADDR_LINE2, margin + 55, y);
  doc.text(`Fax: ${FAX}`, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text(ADDR_LINE3, margin + 55, y);
  doc.text(`Email: ${EMAIL}`, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text('', margin, y);
  doc.text('Website:', pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text('', margin, y);
  doc.text(WEBSITE, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text('', margin, y);
  doc.text('Municipality VAT No:-', pageW - margin, y, { align: 'right' });
  y += 4;
  doc.text('', margin, y);
  doc.text(VAT_NO, pageW - margin, y, { align: 'right' });
  y += 6;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  y = addRecipientAddress(doc, prop, cu, margin, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTICE IN RESPECT OF SECTION 78(5) OF THE LOCAL MUNICIPAL PROPERTY RATES', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.text('AMENDMENT ACT NO 29 OF 2014', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  y = addWrappedText(doc, `This notice is served to you under the requirements of Section 78(5) of the Local Government: Municipal Property Rates Amendment Act of 2014. The purpose of this notice is to advise you of the valuation placed on the following property as determined during the Supplementary Valuation conducted under the provisions of the Local Government: Municipal Property Rates Amendment Act of 2014.`, margin, y, contentW, 3.8);
  y += 4;

  y = addWrappedText(doc, 'The details of this, as per the General Valuation Roll, are as follows:', margin, y, contentW, 3.8);
  y += 5;

  y = addPropertyDetailsTable(doc, prop, cu, margin, contentW, y);
  y = addPartitionTable(doc, valuations, cu, margin, contentW, y);

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - 15) {
      doc.addPage();
      y = 15;
    }
  };

  checkPageBreak(15);
  y = addWrappedText(doc, `You are hereby advised that you may lodge a request for a review with the Municipal Manager of any matter reflected in this Supplementary Valuation. A request for a review must be received on the official form within 30 days of the date of this notice. No late requests for review will be accepted.`, margin, y, contentW, 3.8);
  y += 5;

  checkPageBreak(12);
  y = addWrappedText(doc, `The official form for the lodging of a review is available at all the Municipal Customer Care Centres or on the ${MUNICIPALITY}'s website ${WEBSITE}.`, margin, y, contentW, 3.8);
  y += 5;

  checkPageBreak(12);
  y = addWrappedText(doc, `Should you require any further information in this regard please do not hesitate to contact the Municipality's Customer Call Centre on ${TEL} or visit ${WEBSITE}.`, margin, y, contentW, 3.8);
  y += 6;

  checkPageBreak(15);
  doc.text('Yours Faithfully', margin, y);
  y += 20;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 60, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('MUNICIPAL MANAGER', margin, y);

  const safeName = (prop.name || cu.accountName || 'Property').trim().replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Section78_Letter_${safeName}.pdf`);
}

export async function generateValuationCertificate(accountId: number): Promise<void> {
  await loadMuniConstants();
  const { prop, cu, valuations } = await loadPropertyData(accountId);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;

  let y = 12;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(MUNICIPALITY, pageW / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(ADDR_LINE1, pageW - margin, y, { align: 'right' });
  y += 3.5;
  doc.text(ADDR_LINE2, pageW - margin, y, { align: 'right' });
  y += 3.5;
  doc.text(ADDR_LINE3, pageW - margin, y, { align: 'right' });
  y += 3.5;
  doc.text(`Tel: ${TEL}`, pageW - margin, y, { align: 'right' });
  y += 3.5;
  doc.text(`Fax: ${FAX}`, pageW - margin, y, { align: 'right' });
  y += 3.5;
  doc.text(`Email: ${EMAIL}`, pageW - margin, y, { align: 'right' });
  y += 3.5;
  doc.text(`Website: ${WEBSITE}`, pageW - margin, y, { align: 'right' });
  y += 3.5;
  doc.text(`Municipality VAT No.- ${VAT_NO}`, pageW - margin, y, { align: 'right' });
  y += 8;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('VALUATION CERTIFICATE', pageW / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const ownerName = (prop.name || cu.accountName || '').trim();
  const parts = [prop.subSuburb || cu.nonStandAddSuburb || '', prop.town || ''].filter(Boolean);
  const address = parts.join(', ');
  const sgNumber = prop.sgNumber || cu.sgNumber || '';
  const propDesc = buildPropertyDescription(prop, cu);
  const ratingCategory = prop.typeofUse || '';
  const typeOfUse = prop.townPlanningZoneType || prop.typeofUse || '';
  const standSize = fmtInt(prop.standSize || cu.standSize);
  const marketValue = fmt(prop.marketValue || cu.marketValue);
  const rollDate = valuations.length > 0 ? fmtDate(valuations[0].rollDate) : fmtDate(prop.rollStartDate);

  const labelX = margin + 5;
  const valueX = margin + 55;
  const lineH = 7;

  const certFields: [string, string][] = [
    ['Owner', ownerName],
    ['Address', address],
    ['SG Number', sgNumber],
    ['Property Description', propDesc],
    ['Property Category', ratingCategory],
    ['Property Type of Use', typeOfUse],
    ['Size (m\u00B2)', standSize],
    ['Market Value', marketValue],
    ['Valuation Date', rollDate],
  ];

  for (const [label, value] of certFields) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`: ${value || '-'}`, valueX, y);
    y += lineH;
  }

  y += 15;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin + 5, y, margin + 65, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Municipal Manager', margin + 5, y);

  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${today}`, pageW - margin - 40, y);

  y += 15;

  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentW, 10, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  doc.text('All correspondence to be addressed to the Municipal Manager', pageW / 2, y + 6, { align: 'center' });

  const safeName = (prop.name || cu.accountName || 'Property').trim().replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Valuation_Certificate_${safeName}.pdf`);
}
