import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ══════════════════════════════════════════════════════════════════════════════
// 1. COMMON REPORT HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function formatReportTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = String(hours).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${minutes} ${ampm}`;
}

function formatCurrency(val: number): string {
  return `Rs. ${Number(val || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAmountNum(val: number): string {
  return Number(val || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CUSTOMER DUES PDF GENERATION (MASTER SALES REPORT STYLING)
// ══════════════════════════════════════════════════════════════════════════════

export {
  generateCustomerDuesPdf,
  filterAndNormalizeDueInvoices,
  loadLogoAsDataUrl,
  type CustomerDueInvoice,
  type CustomerDueGroup,
  type CustomerDueItem,
  type GenerateCustomerDuesPdfOptions,
} from './customerDuesPdf';

import {
  generateCustomerDuesPdf,
  filterAndNormalizeDueInvoices,
  loadLogoAsDataUrl,
} from './customerDuesPdf';


// ══════════════════════════════════════════════════════════════════════════════
// 3. CHEQUE LEDGER PDF GENERATION & ROW INTERCEPTION
// ══════════════════════════════════════════════════════════════════════════════

export interface ChequeRecord {
  id?: string | number;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  invoiceNumber?: string;
  customerName?: string;
  customerPhone?: string;
  amount: number;
  status?: string;
  statusLabel?: string;
  maturityAlert?: string;
  alert?: string;
  reference?: string;
}

export interface ChequeLedgerPdfOptions {
  dateRangeLabel?: string;
  generatedBy?: string;
  filename?: string;
}

/**
 * ⭐ Requirement: Intercept row mapping logic when generating Cheque Ledger PDF.
 * If a cheque's status is 'REALIZED' (or 'CLEARED'), explicitly change its display
 * status string to "COMPLETE" in the PDF, and replace the 'N/A' in the alert column
 * with an empty string "" to clean up the report.
 */
export function formatChequeLedgerPdfRows(rawRows: ChequeRecord[]): any[] {
  return rawRows.map((r) => {
    const rawStatus = String(r.statusLabel || r.status || '').toUpperCase();
    const isRealized = rawStatus === 'REALIZED' || rawStatus === 'CLEARED' || rawStatus === 'COMPLETE';

    const displayStatus = isRealized ? 'COMPLETE' : (r.statusLabel || r.status || '-');
    const rawAlert = String(r.alert ?? r.maturityAlert ?? '').trim();
    let displayAlert = '';
    if (!isRealized && rawAlert && rawAlert !== 'N/A') {
      displayAlert = rawAlert;
    }

    return {
      ...r,
      chequeNumber: r.chequeNumber || '-',
      bankName: r.bankName || '-',
      chequeDate: r.chequeDate ? String(r.chequeDate).split('T')[0] : '-',
      invoiceNumber: r.invoiceNumber || '-',
      customerName: r.customerName || 'Walk-in Customer',
      amount: Number(r.amount || 0),
      status: displayStatus,
      statusLabel: displayStatus,
      displayStatus,
      alert: displayAlert,
      maturityAlert: displayAlert,
    };
  });
}

/**
 * Generates the Cheque Ledger PDF report matching the master monochrome layout.
 */
export async function generateChequeLedgerPdf(
  reportData: {
    summary?: any;
    tableItems?: ChequeRecord[];
    dateFilter?: any;
  },
  options: ChequeLedgerPdfOptions = {}
): Promise<jsPDF> {
  const rawRows = reportData.tableItems || [];
  const mappedRows = formatChequeLedgerPdfRows(rawRows);

  const logoData = await loadLogoAsDataUrl();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = 42.5;
  const rightMargin = 552.78;
  const contentWidth = rightMargin - startX;

  const reportTitle = 'CHEQUE LEDGER & REALIZATION FORECAST';
  const dateLabel = options.dateRangeLabel || reportData.dateFilter?.presetLabel || 'This Year';
  const generatedTimestamp = formatReportTimestamp();
  const generatedBy = options.generatedBy || 'System Administrator';

  const drawMasterHeader = (headerTop = 35): number => {
    let brandTextX = startX;

    if (logoData) {
      try {
        doc.addImage(logoData, 'JPEG', startX, headerTop - 2, 36, 36);
        brandTextX = startX + 44;
      } catch {
        brandTextX = startX;
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0, 0, 0);
    doc.text('RELIANCE', brandTextX, headerTop + 10);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('BRANDED MENS CLOTHING & APPAREL MFG', brandTextX, headerTop + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 51, 51);
    doc.text(
      'Mawarala Road, Makandura, Matara | Tel: 041-2268739, 071-1350123  •  Web: relianceclothing.lk',
      brandTextX,
      headerTop + 32
    );

    const headerContentY = headerTop + 46;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(reportTitle, startX, headerContentY);

    const metaX = pageWidth - 200;
    let metaY = headerContentY - 6;

    const metaRows = [
      { label: 'PERIOD:', value: dateLabel, isBold: true },
      { label: 'GENERATED:', value: generatedTimestamp, isBold: false },
      { label: 'PRINTED BY:', value: generatedBy, isBold: false },
    ];

    metaRows.forEach((row) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(85, 85, 85);
      doc.text(row.label, metaX, metaY);

      doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text(row.value, rightMargin, metaY, { align: 'right' });

      metaY += 11;
    });

    const dividerY = Math.max(headerContentY + 12, metaY) + 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(startX, dividerY, rightMargin, dividerY);

    return dividerY + 12;
  };

  let curY = drawMasterHeader(35);

  const summary = reportData.summary || {};
  const kpiCards = [
    { label: 'TOTAL CHEQUES', value: `${summary.totalChequesCount ?? mappedRows.length}` },
    { label: 'PENDING RECEIVABLES', value: formatCurrency(summary.totalPendingAmount || 0) },
    { label: 'REALIZED INFLOW', value: formatCurrency(summary.totalRealizedAmount || 0) },
    { label: 'BOUNCED CHEQUES', value: `${summary.bounceCount || 0} (${formatCurrency(summary.totalBouncedAmount || 0)})` },
  ];

  const cardGap = 8;
  const cardWidth = (contentWidth - (kpiCards.length - 1) * cardGap) / kpiCards.length;
  const cardHeight = 38;

  kpiCards.forEach((card, idx) => {
    const cardX = startX + idx * (cardWidth + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(cardX, curY, cardWidth, cardHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(card.label, cardX + 6, curY + 12);

    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(card.value, cardX + 6, curY + 26);
  });

  curY += cardHeight + 14;

  const tableData = mappedRows.map((r) => [
    r.chequeNumber,
    r.bankName,
    r.chequeDate,
    r.invoiceNumber,
    r.customerName,
    formatAmountNum(r.amount),
    r.displayStatus,
    r.alert,
  ]);

  const totalAmount = mappedRows.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  autoTable(doc, {
    startY: curY,
    margin: { left: startX, right: pageWidth - rightMargin },
    theme: 'plain',
    head: [['CHQ #', 'BANK', 'CHQ DATE', 'INV #', 'CUSTOMER', 'AMOUNT (RS.)', 'STATUS', 'ALERT']],
    body: tableData,
    foot: [
      [
        { content: `TOTAL (${mappedRows.length} CHEQUES)`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatAmountNum(totalAmount), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: '', colSpan: 2 },
      ],
    ],
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7,
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 7.5,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 60, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 70, halign: 'left' },
      2: { cellWidth: 65, halign: 'left' },
      3: { cellWidth: 55, halign: 'left' },
      4: { cellWidth: 95, halign: 'left' },
      5: { cellWidth: 75, halign: 'right' },
      6: { cellWidth: 50, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 40.28, halign: 'center' },
    },
    pageBreak: 'auto',
    didDrawPage: () => {
      drawMasterHeader(35);
    },
  });

  const lastTableFinalY = (doc as any).lastAutoTable?.finalY || curY + 50;
  let signY = lastTableFinalY + 20;

  if (signY + 65 > 750) {
    doc.addPage();
    drawMasterHeader(35);
    signY = 120;
  }

  const signColWidth = (contentWidth - 30) / 3;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(startX, signY + 25, startX + signColWidth, signY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('PREPARED BY', startX + signColWidth / 2, signY + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(68, 68, 68);
  doc.text('Finance & Reporting Officer', startX + signColWidth / 2, signY + 44, { align: 'center' });

  const checkedX = startX + signColWidth + 15;
  doc.line(checkedX, signY + 25, checkedX + signColWidth, signY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('CHECKED & VERIFIED BY', checkedX + signColWidth / 2, signY + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(68, 68, 68);
  doc.text('Internal Audit / Accounts', checkedX + signColWidth / 2, signY + 44, { align: 'center' });

  const authX = checkedX + signColWidth + 15;
  doc.line(authX, signY + 25, authX + signColWidth, signY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('AUTHORIZED SIGNATURE', authX + signColWidth / 2, signY + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(68, 68, 68);
  doc.text('Managing Director / Partner', authX + signColWidth / 2, signY + 44, { align: 'center' });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(102, 102, 102);
    doc.text(
      'Confidential & Proprietary — Reliance Clothing ERP Management Suite. All financial figures are strictly verified against the system ledger.',
      startX + contentWidth / 2,
      805,
      { align: 'center' }
    );

    doc.setFontSize(6.5);
    doc.setTextColor(68, 68, 68);
    doc.text(
      `Reliance Cheque Ledger Report  •  Page ${i} of ${totalPages}`,
      rightMargin,
      816,
      { align: 'right' }
    );
  }

  const dateTag = new Date().toISOString().split('T')[0];
  const filename = options.filename || `reliance-cheque-ledger-${dateTag}.pdf`;
  doc.save(filename);

  return doc;
}

export interface MaterialProductionPdfOptions {
  dateRangeLabel?: string;
  generatedBy?: string;
  filename?: string;
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 4. RAW MATERIAL & PRODUCTION REPORT PDF GENERATION
 * Generates an executive audit PDF using jsPDF and jspdf-autotable.
 * Displays KPI cards (Total Stock, Total Cut, Remaining Balance, Stock Valuation)
 * and an itemized table matching the master monochrome design.
 * ══════════════════════════════════════════════════════════════════════════════
 */
export async function generateMaterialProductionPdf(
  reportData: {
    summary?: any;
    tableItems?: any[];
    dateFilter?: any;
  },
  options: MaterialProductionPdfOptions = {}
): Promise<jsPDF> {
  const rawRows = reportData.tableItems || [];
  const logoData = await loadLogoAsDataUrl();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = 42.5;
  const rightMargin = 552.78;
  const contentWidth = rightMargin - startX;

  const reportTitle = 'RAW MATERIAL & PRODUCTION CONSUMPTION AUDIT';
  const dateLabel = options.dateRangeLabel || reportData.dateFilter?.presetLabel || 'Current Period';
  const generatedTimestamp = formatReportTimestamp();
  const generatedBy = options.generatedBy || 'System Administrator';

  const drawMasterHeader = (headerTop = 35): number => {
    let brandTextX = startX;

    if (logoData) {
      try {
        doc.addImage(logoData, 'JPEG', startX, headerTop - 2, 36, 36);
        brandTextX = startX + 44;
      } catch {
        brandTextX = startX;
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('RELIANCE CLOTHING', brandTextX, headerTop + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(68, 68, 68);
    doc.text('Apparel Manufacturing & Inventory Control Suite', brandTextX, headerTop + 20);

    const headerContentY = headerTop + 38;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(reportTitle, startX, headerContentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(68, 68, 68);
    doc.text('Audited Fabric Consumption, Cutting vs Remaining Yield & Warehouse Balances', startX, headerContentY + 11);

    const metaRows = [
      { label: 'REPORT PERIOD:', value: dateLabel, isBold: true },
      { label: 'GENERATED ON:', value: generatedTimestamp, isBold: false },
      { label: 'GENERATED BY:', value: generatedBy, isBold: false },
    ];

    let metaY = headerTop + 2;
    metaRows.forEach((row) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(68, 68, 68);
      doc.text(row.label, rightMargin - 155, metaY);

      doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text(row.value, rightMargin, metaY, { align: 'right' });

      metaY += 11;
    });

    const dividerY = Math.max(headerContentY + 14, metaY) + 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(startX, dividerY, rightMargin, dividerY);

    return dividerY + 12;
  };

  let curY = drawMasterHeader(35);

  const summary = reportData.summary || {};
  const kpiCards = [
    { label: 'TOTAL STOCK UNITS', value: `${formatAmountNum(summary.totalStockUnits || 0)} Units` },
    { label: 'TOTAL CUT (PERIOD)', value: `${formatAmountNum(summary.totalCutAmount || 0)} Units` },
    { label: 'REMAINING BALANCE', value: `${formatAmountNum(summary.totalRemainingAmount || summary.totalStockUnits || 0)} Units` },
    { label: 'STOCK VALUATION', value: formatCurrency(summary.totalValuation || 0) },
  ];

  const cardGap = 8;
  const cardWidth = (contentWidth - (kpiCards.length - 1) * cardGap) / kpiCards.length;
  const cardHeight = 38;

  kpiCards.forEach((card, idx) => {
    const cardX = startX + idx * (cardWidth + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(cardX, curY, cardWidth, cardHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(card.label, cardX + 6, curY + 12);

    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(card.value, cardX + 6, curY + 26);
  });

  curY += cardHeight + 14;

  const tableData = rawRows.map((r) => [
    r.code || '-',
    r.name || 'Raw Material',
    r.unit || 'METERS',
    formatAmountNum(r.cutAmount || r.periodUsage || 0),
    formatAmountNum(r.remainingAmount ?? r.currentStock ?? 0),
    formatAmountNum(r.wasteAmount || r.periodScrap || 0),
    formatAmountNum(r.unitCostAverage || 0),
    formatAmountNum(r.totalValuation || 0),
    r.status || 'Optimal',
  ]);

  const totalCut = rawRows.reduce((acc, curr) => acc + (Number(curr.cutAmount || curr.periodUsage) || 0), 0);
  const totalRemaining = rawRows.reduce((acc, curr) => acc + (Number(curr.remainingAmount ?? curr.currentStock) || 0), 0);
  const totalValuation = rawRows.reduce((acc, curr) => acc + (Number(curr.totalValuation) || 0), 0);

  autoTable(doc, {
    startY: curY,
    margin: { left: startX, right: pageWidth - rightMargin },
    theme: 'plain',
    head: [['CODE', 'MATERIAL NAME', 'UNIT', 'CUT QTY', 'REMAINING', 'WASTE/SCRAP', 'AVG COST', 'VALUATION (RS.)', 'STATUS']],
    body: tableData,
    foot: [
      [
        { content: `TOTAL (${rawRows.length} MATERIALS)`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatAmountNum(totalCut), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatAmountNum(totalRemaining), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: '', colSpan: 2 },
        { content: formatAmountNum(totalValuation), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: '' },
      ],
    ],
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7,
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 7.5,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || curY + 100;
  const signY = Math.min(finalY + 30, 740);
  const signColWidth = (contentWidth - 30) / 3;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);

  doc.line(startX, signY + 25, startX + signColWidth, signY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('PREPARED BY', startX + signColWidth / 2, signY + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(68, 68, 68);
  doc.text('Production & Cutting Supervisor', startX + signColWidth / 2, signY + 44, { align: 'center' });

  const checkedX = startX + signColWidth + 15;
  doc.line(checkedX, signY + 25, checkedX + signColWidth, signY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('CHECKED & VERIFIED BY', checkedX + signColWidth / 2, signY + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(68, 68, 68);
  doc.text('Inventory & Stores Officer', checkedX + signColWidth / 2, signY + 44, { align: 'center' });

  const authX = checkedX + signColWidth + 15;
  doc.line(authX, signY + 25, authX + signColWidth, signY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('AUTHORIZED SIGNATURE', authX + signColWidth / 2, signY + 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(68, 68, 68);
  doc.text('Factory Manager / Partner', authX + signColWidth / 2, signY + 44, { align: 'center' });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(102, 102, 102);
    doc.text(
      'Confidential & Proprietary — Reliance Clothing ERP Management Suite. All material tracking figures are verified against warehouse logs.',
      startX + contentWidth / 2,
      805,
      { align: 'center' }
    );

    doc.setFontSize(6.5);
    doc.setTextColor(68, 68, 68);
    doc.text(
      `Reliance Material & Production Report  •  Page ${i} of ${totalPages}`,
      rightMargin,
      816,
      { align: 'right' }
    );
  }

  const dateTag = new Date().toISOString().split('T')[0];
  const filename = options.filename || `reliance-material-production-${dateTag}.pdf`;
  doc.save(filename);

  return doc;
}

export const ReportPdf = {
  generateCustomerDuesPdf,
  filterAndNormalizeDueInvoices,
  generateChequeLedgerPdf,
  formatChequeLedgerPdfRows,
  generateMaterialProductionPdf,
};

export default ReportPdf;
