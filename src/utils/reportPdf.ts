import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  loadLogoAsDataUrl,
  drawStandardReportHeader,
  drawStandardReportFooter,
  formatReportTimestamp,
  formatCurrency,
  formatAmountNum,
  generateFinancialAuditPdf,
  type FinancialAuditExportData,
  type GenerateFinancialAuditPdfOptions,
} from './pdfGenerator';

export {
  loadLogoAsDataUrl,
  drawStandardReportHeader,
  drawStandardReportFooter,
  generateFinancialAuditPdf,
  formatReportTimestamp,
  formatCurrency,
  formatAmountNum,
  type FinancialAuditExportData,
  type GenerateFinancialAuditPdfOptions,
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. CUSTOMER DUES PDF GENERATION (MASTER SALES REPORT STYLING)
// ══════════════════════════════════════════════════════════════════════════════

export {
  generateCustomerDuesPdf,
  filterAndNormalizeDueInvoices,
  type CustomerDueInvoice,
  type CustomerDueGroup,
  type CustomerDueItem,
  type GenerateCustomerDuesPdfOptions,
} from './customerDuesPdf';

import {
  generateCustomerDuesPdf,
  filterAndNormalizeDueInvoices,
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

  const drawMasterHeader = (headerTop = 32): number => {
    return drawStandardReportHeader(doc, {
      logoData,
      reportTitle,
      dateRangeLabel: dateLabel,
      generatedTimestamp,
      generatedBy,
      headerTop,
      startX,
      rightMargin,
    });
  };

  let curY = drawMasterHeader(32);

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
    margin: { left: startX, right: pageWidth - rightMargin, top: 115, bottom: 45 },
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
      drawMasterHeader(32);
    },
  });

  const lastTableFinalY = (doc as any).lastAutoTable?.finalY || curY + 50;
  let signY = lastTableFinalY + 20;

  if (signY + 65 > 750) {
    doc.addPage();
    drawMasterHeader(32);
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

  drawStandardReportFooter(doc, 'Cheque Ledger Report', startX, rightMargin);

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

  const drawMasterHeader = (headerTop = 32): number => {
    return drawStandardReportHeader(doc, {
      logoData,
      reportTitle,
      dateRangeLabel: dateLabel,
      generatedTimestamp,
      generatedBy,
      headerTop,
      startX,
      rightMargin,
    });
  };

  let curY = drawMasterHeader(32);

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
    margin: { left: startX, right: pageWidth - rightMargin, top: 115, bottom: 45 },
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
    pageBreak: 'auto',
    didDrawPage: () => {
      drawMasterHeader(32);
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

  drawStandardReportFooter(doc, 'Material & Production Report', startX, rightMargin);

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
  generateFinancialAuditPdf,
  drawStandardReportHeader,
  drawStandardReportFooter,
};

export default ReportPdf;
