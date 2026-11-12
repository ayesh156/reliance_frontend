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
import { parseChequeMetadata } from './chequeParser';


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

  // Safeguard: If garment production batch records are passed, delegate to the dedicated 4-stage generator
  if (rawRows.length > 0 && ('productionNo' in rawRows[0] || 'cutQty' in rawRows[0])) {
    return generateGarmentProductionPdf(reportData, options);
  }

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

export interface GarmentProductionPdfOptions {
  dateRangeLabel?: string;
  generatedBy?: string;
  filename?: string;
  stageFilter?: string;
}

/**
 * Stage filter helper to match production batches across the 6 pipeline stages.
 */
export function matchProductionStage(row: any, stage?: string): boolean {
  if (!stage || stage === 'ALL' || stage === 'ALL STAGES') return true;
  const status = String(row.status || '').toUpperCase();
  const isStockSynced = Boolean(row.isStockSynced);
  const cut = Number(row.cutQty || row.totalCutUnits || 0);
  const sewn = Number(row.sewnQty || 0);
  const sentWash = Number(row.sentToWashQty || 0);
  const washed = Number(row.washedQty || 0);
  const finished = Number(row.completedQty || 0) > 0
    ? Number(row.completedQty)
    : (Array.isArray(row.finishLogs) && row.finishLogs.length > 0
      ? row.finishLogs.reduce((s: number, f: any) => s + (Number(f.quantityFinished) || 0), 0)
      : 0);

  switch (stage) {
    case 'CUTTING':
      return status === 'CUTTING' || (cut > 0 && sewn === 0 && !isStockSynced && status !== 'COMPLETED');
    case 'SEWING LINE':
    case 'SEWING':
    case 'LINE':
      return status === 'SEWING' || status === 'LINE' || (cut > sewn && !isStockSynced && status !== 'COMPLETED');
    case 'WASHING':
    case 'WASH':
      return status === 'WASHING' || ((sentWash > 0 || washed > 0) && finished === 0 && !isStockSynced && status !== 'COMPLETED');
    case 'FINISHING / PACKING':
    case 'FINISHING':
    case 'PACKING':
      return status === 'FINISHING' || status === 'FINISHED_PENDING_STOCK' || (finished > 0 && !isStockSynced && status !== 'COMPLETED');
    case 'IN STOCK / COMPLETED':
    case 'COMPLETED':
    case 'IN STOCK':
      return isStockSynced || status === 'COMPLETED';
    default:
      return true;
  }
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 5. GARMENT PRODUCTION REPORT PDF GENERATION (4 PRODUCTION STAGES)
 * Generates an executive audit PDF using jsPDF and jspdf-autotable matching
 * the true 4-stage pipeline: Cutting (cutQty), Sewing & Wash WIP (cutQty - washedQty),
 * and Finishing Output (washedQty / completedQty) with Stock Sync status.
 * ══════════════════════════════════════════════════════════════════════════════
 */
export async function generateGarmentProductionPdf(
  reportData: {
    summary?: any;
    tableItems?: any[];
    dateFilter?: any;
  },
  options: GarmentProductionPdfOptions = {}
): Promise<jsPDF> {
  const stageFilter = options.stageFilter;
  const initialRows = reportData.tableItems || [];
  const rawRows = (stageFilter && stageFilter !== 'ALL' && stageFilter !== 'ALL STAGES')
    ? initialRows.filter((r) => matchProductionStage(r, stageFilter))
    : initialRows;
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

  const reportTitle = (stageFilter && stageFilter !== 'ALL' && stageFilter !== 'ALL STAGES')
    ? `GARMENT PRODUCTION AUDIT - [${stageFilter.toUpperCase()}]`
    : 'GARMENT PRODUCTION & 6-STAGE PIPELINE AUDIT';
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
  // 6-Stage Production Funnel dynamic aggregations
  const totalCutPieces = Number(
    summary.totalCutPieces ??
      summary.totalMaterialsCut ??
      rawRows.reduce((s, r) => s + Number(r.cutQty ?? r.totalCutUnits ?? (r.completedQty || r.targetQuantity || 0)), 0)
  );
  const inSewingWip = Number(
    summary.inSewingWip ??
      rawRows.reduce((s, r) => {
        if (r.status !== 'CANCELLED' && r.status !== 'COMPLETED') {
          const cut = Number(r.cutQty ?? r.totalCutUnits ?? r.lineSentQty ?? r.targetQuantity ?? 0);
          const sewn = Number(r.sewnQty || 0);
          return s + Math.max(0, cut - sewn);
        }
        return s;
      }, 0)
  );
  const totalSewnOutput = Number(
    summary.totalSewnOutput ??
      rawRows.reduce((s, r) => s + Number(r.sewnQty || 0), 0)
  );
  const inWashTotal = Number(
    summary.inWashTotal ??
      rawRows.reduce((s, r) => s + Number(r.sentToWashQty || 0) + Number(r.washedQty || 0), 0)
  );
  const ironedAndPacked = Number(
    summary.ironedAndPacked ??
      summary.completedQuantity ??
      rawRows.reduce((s, r) => {
        const logged = Array.isArray(r.finishLogs) && r.finishLogs.length > 0
          ? r.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
          : 0;
        const finished = logged > 0
          ? logged
          : (Number(r.completedQty || 0) > 0 ? Number(r.completedQty) : Number(r.washedQty || 0));
        return s + finished;
      }, 0)
  );
  const fullyFinishedSynced = Number(
    summary.fullyFinishedSynced ??
      summary.syncedToInventory ??
      rawRows.reduce((s, r) => {
        const isSynced = Boolean(r.isStockSynced) && r.status !== 'CANCELLED';
        const finished = Number(r.completedQty || 0) > 0 ? Number(r.completedQty) : Number(r.washedQty || 0);
        return isSynced ? s + finished : s;
      }, 0)
  );

  // 6-Stage Production Funnel KPI Cards (rendered in 2 rows of 3)
  const kpiCards = [
    { label: '1. TOTAL CUT PIECES', value: `${formatAmountNum(totalCutPieces)} Units` },
    { label: '2. IN SEWING LINE (WIP)', value: `${formatAmountNum(inSewingWip)} Pcs` },
    { label: '3. TOTAL SEWN OUTPUT', value: `${formatAmountNum(totalSewnOutput)} Pcs` },
    { label: '4. IN WASH / WASHED', value: `${formatAmountNum(inWashTotal)} Pcs` },
    { label: '5. IRONED & PACKED', value: `${formatAmountNum(ironedAndPacked)} Pcs` },
    { label: '6. FINISHED / SYNCED', value: `${formatAmountNum(fullyFinishedSynced)} Pcs` },
  ];

  const cardGap = 8;
  const cardHeight = 36;
  const chunkSize = 3;

  for (let i = 0; i < kpiCards.length; i += chunkSize) {
    const chunk = kpiCards.slice(i, i + chunkSize);
    const cardWidth = (contentWidth - (chunk.length - 1) * cardGap) / chunk.length;

    chunk.forEach((card, idx) => {
      const cardX = startX + idx * (cardWidth + cardGap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.rect(cardX, curY, cardWidth, cardHeight, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(0, 0, 0);
      doc.text(card.label, cardX + 5, curY + 11);

      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text(card.value, cardX + 5, curY + 24);
    });

    curY += cardHeight + 6;
  }

  curY += 8;

  const tableData = rawRows.map((r) => {
    const cut = Number(r.cutQty ?? r.totalCutUnits ?? r.targetQuantity ?? 0);
    const sewn = Number(r.sewnQty || 0);
    const washed = Number(r.washedQty || 0);
    const loggedFinish = Array.isArray(r.finishLogs) && r.finishLogs.length > 0
      ? r.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
      : 0;
    const finished = loggedFinish > 0
      ? loggedFinish
      : (Number(r.completedQty || 0) > 0 ? Number(r.completedQty) : Number(r.washedQty || 0));
    const statusText = r.isStockSynced
      ? 'IN STOCK'
      : r.status === 'FINISHED_PENDING_STOCK'
      ? 'AWAIT SYNC'
      : r.status || 'CUTTING';

    return [
      r.productionNo || '-',
      r.productName || 'Garment',
      r.variant || 'Standard',
      formatAmountNum(cut),
      formatAmountNum(sewn),
      formatAmountNum(washed),
      formatAmountNum(finished),
      statusText,
    ];
  });

  autoTable(doc, {
    startY: curY,
    margin: { left: startX, right: pageWidth - rightMargin, top: 115, bottom: 45 },
    theme: 'plain',
    head: [['BATCH NO', 'GARMENT STYLE', 'VARIANT', 'CUT QTY', 'SEWN', 'WASHED', 'FINISHED', 'STATUS']],
    body: tableData,
    foot: [
      [
        { content: `TOTAL (${rawRows.length} BATCHES)`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatAmountNum(totalCutPieces), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: formatAmountNum(totalSewnOutput), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: formatAmountNum(rawRows.reduce((s, r) => s + (Number(r.washedQty) || 0), 0)), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: formatAmountNum(ironedAndPacked), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: `${formatAmountNum(fullyFinishedSynced)} Synced`, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
    ],
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 6.5,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 6.5,
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 125 },
      2: { cellWidth: 65 },
      3: { halign: 'center', cellWidth: 50 },
      4: { halign: 'center', cellWidth: 50 },
      5: { halign: 'center', cellWidth: 50 },
      6: { halign: 'center', cellWidth: 50 },
      7: { halign: 'center', cellWidth: 55.28 },
    },
    didDrawPage: () => {
      drawStandardReportFooter(doc, 'Garment Production Report', startX, rightMargin);
    },
  });

  const dateTag = new Date().toISOString().split('T')[0];
  const filename = options.filename || `reliance-garment-production-${dateTag}.pdf`;
  doc.save(filename);

  return doc;
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. SALES & INVOICES PDF GENERATION (WITH ROLE-BASED MAPPING)
// ══════════════════════════════════════════════════════════════════════════════

export interface SalesPdfRecord {
  id?: string | number;
  invoiceNumber?: string;
  createdAt?: string;
  customerName?: string;
  userRole?: string;
  role?: string;
  customerType?: string;
  source?: string;
  subtotal?: number;
  discount?: number;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentMethod?: string;
}

export interface SalesPdfOptions {
  dateRangeLabel?: string;
  generatedBy?: string;
  filename?: string;
}

/**
 * Format sales rows replacing Customer Type with User Role.
 * Maps row.userRole instead of row.customerType, cleanly defaulting to 'SYSTEM'.
 */
export function formatSalesPdfRows(rawRows: SalesPdfRecord[]): any[] {
  return rawRows.map((row) => {
    const role = String(row.userRole || row.role || 'SYSTEM').toUpperCase();
    return [
      row.invoiceNumber || '-',
      row.createdAt ? String(row.createdAt).split('T')[0] : '-',
      row.customerName || 'Walk-in Customer',
      role,
      formatAmountNum(row.subtotal || 0),
      Number(row.discount || 0) > 0 ? `-${formatAmountNum(row.discount || 0)}` : '-',
      formatAmountNum(row.totalAmount || 0),
      formatAmountNum(row.paidAmount || 0),
      Number(row.dueAmount || 0) > 0 ? formatAmountNum(row.dueAmount || 0) : '-',
      row.paymentMethod || 'CASH',
    ];
  });
}

/**
 * Generates executive Sales & Invoices PDF report with ROLE column alignment.
 */
export async function generateSalesPdf(
  data: { tableItems?: SalesPdfRecord[]; summary?: any },
  options: SalesPdfOptions = {}
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const logoData = await loadLogoAsDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = 42.5;
  const rightMargin = 552.78;

  const reportTitle = 'SALES & INVOICES REPORT';
  const dateLabel = options.dateRangeLabel || 'Current Period';
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

  const curY = drawMasterHeader(32);
  const rows = formatSalesPdfRows(data.tableItems || []);

  autoTable(doc, {
    startY: curY,
    margin: { left: startX, right: pageWidth - rightMargin },
    theme: 'plain',
    head: [['INV #', 'DATE', 'CUSTOMER', 'ROLE', 'SUBTOTAL', 'DISC', 'NET TOTAL', 'PAID', 'DUE', 'METHOD']],
    body: rows,
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [30, 41, 59],
      fontSize: 7.5,
      fontStyle: 'bold',
      lineColor: [226, 232, 240],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [51, 65, 85],
      fontSize: 7,
      lineColor: [241, 245, 249],
      lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 50 },
      2: { cellWidth: 95 },
      3: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 50, halign: 'right' },
      5: { cellWidth: 38, halign: 'right' },
      6: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 50, halign: 'right' },
      8: { cellWidth: 50, halign: 'right' },
      9: { cellWidth: 42, halign: 'center' },
    },
    didDrawPage: () => {
      drawStandardReportFooter(doc, 'Sales & Invoices Report', startX, rightMargin);
    },
  });

  const filename = options.filename || `reliance-sales-report-${formatReportTimestamp(new Date()).replace(/[: ]/g, '-')}.pdf`;
  doc.save(filename);
  return doc;
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. CUSTOMER / REP STATEMENT OF ACCOUNT PDF GENERATOR (DUPLICATE PRINTING)
// ══════════════════════════════════════════════════════════════════════════════

export interface StatementPdfCustomer {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  type?: string;
  outstandingBalance?: number;
}

export interface StatementPdfInvoice {
  orderId?: number;
  id?: number;
  invoiceNumber?: string;
  createdAt?: string | Date;
  date?: string | Date;
  source?: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount?: number;
  paymentMethod?: string;
  payments?: any[];
  paymentHistory?: any[];
  cheques?: any[];
  notes?: string;
  reference?: string;
}

export interface StatementPdfCheque {
  id?: number;
  chequeNumber: string;
  bankName: string;
  chequeDate: string;
  amount: number;
  status?: string;
  invoiceNumber?: string;
  invoiceNumbers?: string[];
}

export interface StatementPdfOptions {
  autoPrint?: boolean;
  filename?: string;
  generatedBy?: string;
}

/**
 * Aggressively extracts a clean numeric cheque number from any raw cheque field,
 * reference text, or payment note string by stripping non-numeric prefixes and prioritizing
 * 4-8 digit sequences (e.g. "000080").
 */
export const extractCleanChequeNumber = (...sources: any[]): string => {
  for (const src of sources) {
    if (!src || src === '-' || src === 'undefined' || src === 'null') continue;
    const str = String(src).trim();
    if (!str || str === '-') continue;

    // Remove ISO dates (e.g. 2027-01-05) so calendar years are never mistakenly captured as cheque numbers
    const withoutDates = str.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');

    // 1. Explicit prefix pattern: "Chq #000080", "Cheque: 000080", "Cheque #000080"
    const explicitPrefixMatch = /(?:Cheque|Chq)\s*#?:?\s*([A-Za-z0-9-]+)/i.exec(withoutDates);
    if (explicitPrefixMatch && explicitPrefixMatch[1]) {
      const candidate = explicitPrefixMatch[1].trim();
      if (!/^(?:Bank|Date|Mat|-)$/i.test(candidate)) {
        const digits = candidate.replace(/\D/g, '');
        if (digits.length >= 4) {
          return digits;
        }
      }
    }

    // 2. Standalone 4 to 8 digit sequence (standard Sri Lankan cheque number format e.g. "000080", "143006")
    const digitsMatch = /\b(\d{4,8})\b/.exec(withoutDates);
    if (digitsMatch && digitsMatch[1]) {
      return digitsMatch[1];
    }

    // 3. Fallback: Any 3+ digits found in the source string
    const anyDigitsMatch = /(\d{3,8})/.exec(withoutDates);
    if (anyDigitsMatch && anyDigitsMatch[1]) {
      return anyDigitsMatch[1];
    }

    // 4. Fallback for alphanumeric cheque codes without digits - MUST contain at least one digit
    const cleaned = withoutDates
      .replace(/^(?:Chq|Cheque)\s*#?/gi, '')
      .replace(/^#+/, '')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/^-+|-+$/g, '')
      .trim();
    if (cleaned && cleaned !== '-' && cleaned.length >= 3 && /\d/.test(cleaned)) {
      return cleaned;
    }
  }
  return '-';
};

/**
 * Normalizes bank name from candidate fields, stripping prefixes, hyphens, and noise.
 * If multiple representations exist, prioritizes cleaner, capitalized bank names.
 */
export const extractCleanBankName = (...sources: any[]): string => {
  for (const src of sources) {
    if (!src || src === '-' || src === 'undefined' || src === 'null') continue;
    let str = String(src).trim();
    if (!str || str === '-') continue;

    let candidate = '';

    // Check for explicit "Bank: ..." or "Branch: ..."
    const bankColonMatch = /(?:Bank|Branch):\s*([^|\n]+)/i.exec(str);
    if (bankColonMatch && bankColonMatch[1]) {
      candidate = bankColonMatch[1].trim();
    } else {
      // Check for parenthesized bank name e.g. "(Sampath Bank - Wariyapola)"
      const parenMatch = /\(([^)]+)\)/.exec(str);
      if (parenMatch && parenMatch[1] && !/^\d+$/.test(parenMatch[1])) {
        candidate = parenMatch[1].trim();
      } else {
        // Check for text following leading cheque digits e.g. "000080 sampath bank - wariyapola"
        const afterDigitsMatch = /^\s*\d{4,8}\s+([A-Za-z0-9\s&/.-]+)$/i.exec(str);
        if (afterDigitsMatch && afterDigitsMatch[1]) {
          candidate = afterDigitsMatch[1].trim();
        } else {
          // If this is an explicit bank property (not a long generic memo/sentence)
          const isExplicitField = !/(?:settlement|payment|invoice|bill|cash|card|due|transfer)/i.test(str);
          if (isExplicitField && (/(?:Bank|Branch|BOC|HNB|NSB|NDB|Commercial|Sampath|Seylan|DFCC|Peoples|Nations)/i.test(str) || str.length < 35)) {
            candidate = str;
          }
        }
      }
    }

    if (candidate) {
      // Strip leading/trailing punctuation and keywords
      candidate = candidate
        .replace(/^(?:Bank|Branch)[:\s-]*/i, '')
        .replace(/^[-\s|]+/, '')
        .replace(/[-\s|]+$/, '')
        .trim();

      if (candidate && candidate !== '-' && !/^\d+$/.test(candidate)) {
        // Capitalize first letter of each word if lowercase
        if (candidate === candidate.toLowerCase()) {
          candidate = candidate
            .split(/\s+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
            .replace(/\s*-\s*/g, ' - ');
        }
        return candidate;
      }
    }
  }
  return '-';
};

/**
 * Normalizes maturity/realization date to YYYY-MM-DD.
 */
export const extractCleanMaturityDate = (...sources: any[]): string => {
  for (const src of sources) {
    if (!src || src === '-' || src === 'undefined' || src === 'null') continue;
    const str = String(src).trim();
    if (!str || str === '-') continue;

    // Look for YYYY-MM-DD
    const isoMatch = /(\d{4}-\d{2}-\d{2})/.exec(str);
    if (isoMatch && isoMatch[1]) {
      return isoMatch[1];
    }

    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch {}
  }
  return '-';
};

/**
 * Normalizes cheque number and bank name to produce a bulletproof deduplication key for statement grouping.
 * Strips all prefixes ("Chq", "Cheque", "#", spaces) and extracts clean raw numeric cheque numbers
 * across explicitly stored fields and raw reference/memo strings.
 */
export const normalizeChequeGrouping = (
  rawCheque: any
): { cleanChequeNo: string; cleanBank: string; groupKey: string; maturityDate: string } => {
  const parsed = parseChequeMetadata(rawCheque);

  const cleanChequeNo = extractCleanChequeNumber(
    rawCheque.chequeNumber,
    rawCheque.number,
    rawCheque.chqNo,
    parsed.chequeNumber,
    rawCheque.reference,
    rawCheque.notes
  );

  const cleanBank = extractCleanBankName(
    parsed.bankAndTown,
    rawCheque.bankName,
    rawCheque.bank,
    rawCheque.branch,
    rawCheque.reference,
    rawCheque.notes
  );

  const maturityDate = extractCleanMaturityDate(
    parsed.maturityDate,
    rawCheque.realizeDate,
    rawCheque.chequeDate,
    rawCheque.date,
    rawCheque.paymentDate,
    rawCheque.reference,
    rawCheque.notes
  );

  // Group key: strict deduplication on raw numeric cheque number
  let groupKey = '';
  if (cleanChequeNo && cleanChequeNo !== '-') {
    groupKey = `CHQ_${cleanChequeNo.toLowerCase()}`;
  } else {
    groupKey = `RAW_${rawCheque.id || rawCheque.orderId || Math.random()}`;
  }

  return {
    cleanChequeNo,
    cleanBank,
    groupKey,
    maturityDate,
  };
};

/**
 * Generates an official Customer / Rep Statement of Account PDF
 * with tight 8pt font layout, grouped multi-bill cheque settlements, Old vs. New balance separation,
 * distinct Customer and Rep signature blocks, and dynamic "PAID IN FULL" stamping.
 */
export async function generateStatementPdf(
  customer: StatementPdfCustomer,
  invoices: StatementPdfInvoice[] = [],
  cheques: StatementPdfCheque[] = [],
  options: StatementPdfOptions = {}
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const logoData = await loadLogoAsDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = 42.5;
  const rightMargin = 552.78;
  const contentWidth = rightMargin - startX;

  // 1. Group / aggregate cheques by normalized groupKey
  const groupedChequesMap = new Map<string, {
    chequeNumber: string;
    bankName: string;
    chequeDate: string;
    amount: number;
    invoiceNumbers: string[];
    invoiceNumber: string;
    _seenPaymentIds?: Set<any>;
  }>();

  // Combine directly provided cheques list with any pending cheque payments on invoice objects
  const allChequeCandidates: any[] = [];
  const preAggregatedChequeNos = new Set<string>();

  if (Array.isArray(cheques) && cheques.length > 0) {
    for (const c of cheques) {
      allChequeCandidates.push(c);
      const { cleanChequeNo } = normalizeChequeGrouping(c);
      if (cleanChequeNo && cleanChequeNo !== '-') {
        preAggregatedChequeNos.add(cleanChequeNo.toLowerCase());
      }
    }
  }

  for (const inv of invoices) {
    const invPayments = Array.isArray(inv.payments) && inv.payments.length > 0
      ? inv.payments
      : (Array.isArray(inv.paymentHistory) ? inv.paymentHistory : []);
    for (const p of invPayments) {
      const pMethod = String(p.method || p.paymentMethod || '').toUpperCase();
      const pStatus = String(p.chequeStatus || p.status || 'PENDING').toUpperCase();
      if (
        (pMethod === 'CHEQUE' || p.chequeNumber || (p.reference && /(?:Chq|Cheque|\b\d{4,}\b)/i.test(p.reference))) &&
        pStatus !== 'CLEARED' &&
        pStatus !== 'BOUNCED'
      ) {
        const { cleanChequeNo } = normalizeChequeGrouping(p);
        // Avoid duplicate inclusion if already captured via the pre-aggregated cheques array
        if (cleanChequeNo !== '-' && preAggregatedChequeNos.has(cleanChequeNo.toLowerCase())) {
          continue;
        }
        allChequeCandidates.push({
          ...p,
          invoiceNumber: inv.invoiceNumber || `INV-${inv.orderId || inv.id}`,
        });
      }
    }
  }

  for (const rawChq of allChequeCandidates) {
    const { cleanChequeNo, cleanBank, groupKey, maturityDate } = normalizeChequeGrouping(rawChq);

    // Strict deduplication: resolve target entry by cleanChequeNo or groupKey
    let targetKey = groupKey;
    if (cleanChequeNo !== '-') {
      for (const [existingKey, existingVal] of groupedChequesMap.entries()) {
        if (existingVal.chequeNumber.toLowerCase() === cleanChequeNo.toLowerCase()) {
          targetKey = existingKey;
          break;
        }
      }
    }

    const rawInvs = rawChq.invoiceNumbers || (rawChq.invoiceNumber ? [rawChq.invoiceNumber] : []);
    const invNumbers = rawInvs
      .map((inv: string) => String(inv).replace(/^#+/, '').trim())
      .filter(Boolean);

    const chqAmt = Number(rawChq.amount || 0);

    const existing = groupedChequesMap.get(targetKey);
    if (existing) {
      const paymentId = rawChq.id || (rawChq as any).paymentId;
      const alreadyCounted = paymentId && existing._seenPaymentIds?.has(paymentId);
      if (!alreadyCounted) {
        existing.amount = Math.round((existing.amount + chqAmt) * 100) / 100;
        if (paymentId && existing._seenPaymentIds) {
          existing._seenPaymentIds.add(paymentId);
        }
      }
      for (const invNo of invNumbers) {
        if (!existing.invoiceNumbers.includes(invNo)) {
          existing.invoiceNumbers.push(invNo);
        }
      }
      existing.invoiceNumber = existing.invoiceNumbers.join(', ');

      // Retain or upgrade to richer/more descriptive bank name
      if ((!existing.bankName || existing.bankName === '-') && cleanBank !== '-') {
        existing.bankName = cleanBank;
      } else if (cleanBank !== '-' && cleanBank.length > existing.bankName.length) {
        existing.bankName = cleanBank;
      }

      // Retain or populate maturity date
      if ((!existing.chequeDate || existing.chequeDate === '-') && maturityDate !== '-') {
        existing.chequeDate = maturityDate;
      }
    } else {
      const seenIds = new Set<any>();
      if (rawChq.id || (rawChq as any).paymentId) seenIds.add(rawChq.id || (rawChq as any).paymentId);

      groupedChequesMap.set(targetKey, {
        chequeNumber: cleanChequeNo,
        bankName: cleanBank,
        chequeDate: maturityDate,
        amount: isNaN(chqAmt) ? 0 : chqAmt,
        invoiceNumbers: [...invNumbers],
        invoiceNumber: invNumbers.join(', '),
        _seenPaymentIds: seenIds,
      });
    }
  }

  const consolidatedCheques = Array.from(groupedChequesMap.values()).filter(
    (c) => c.amount > 0 || (c.chequeNumber && c.chequeNumber !== '-')
  );

  // 2. Old vs. New Balance calculations
  const currentBillsDue = invoices.reduce((s, b) => {
    const total = Number(b.totalAmount || 0);
    const paid = Number(b.paidAmount || 0);
    return s + Number(b.dueAmount !== undefined ? b.dueAmount : Math.max(0, total - paid));
  }, 0);

  const customerTotalDue = Number(customer.outstandingBalance || 0);
  const totalNetOutstanding = customerTotalDue > 0 ? customerTotalDue : Math.max(0, currentBillsDue);
  const previousOldBalance = Math.max(0, Math.round((totalNetOutstanding - currentBillsDue) * 100) / 100);

  const currentDate = new Date().toISOString().split('T')[0];

  // 3. Render Single Copy (Standard Official A4 Statement Layout)
  let curY = 32;

  // Corporate Header
  if (logoData) {
    try {
      doc.addImage(logoData, 'JPEG', startX, curY - 2, 48, 48);
    } catch {}
  }
  const brandX = logoData ? startX + 58 : startX;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text('RELIANCE', brandX, curY + 10);

  doc.setFontSize(6.5);
  doc.text('BRANDED MENS CLOTHING', brandX, curY + 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text('Mawarala Road, Makandura, Matara. | Tel: 041-2268739, 071-1350123', brandX, curY + 28);
  doc.text('Web: relianceapparel.lk', brandX, curY + 36);

  // Title & Clean Metadata Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text('STATEMENT OF ACCOUNT', rightMargin, curY + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`DATE: ${currentDate}`, rightMargin, curY + 24, { align: 'right' });
  doc.text(`TYPE: ${customer.type || 'RETAIL'}`, rightMargin, curY + 34, { align: 'right' });
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(`DATE: ${currentDate}`, rightMargin, curY + 37, { align: 'right' });
    doc.text(`TYPE: ${customer.type || 'RETAIL'}`, rightMargin, curY + 45, { align: 'right' });

    // Divider
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(startX, curY + 52, rightMargin, curY + 52);

    // Customer Info & Summary Pill
    const custTop = curY + 60;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text('STATEMENT ISSUED TO:', startX, custTop);

    doc.setFontSize(9.5);
    doc.text(customer.name || 'Valued Customer', startX, custTop + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);
    doc.text(customer.address || customer.city || 'No registered address', startX, custTop + 22);
    doc.text(`Contact: ${customer.phone || '-'}`, startX, custTop + 31);

    // Outstanding Pill on Right
    const pillW = 140;
    const pillH = 34;
    const pillX = rightMargin - pillW;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(pillX, custTop, pillW, pillH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text('TOTAL OUTSTANDING BALANCE', pillX + pillW / 2, custTop + 10, { align: 'center' });
    doc.setFontSize(10);
    if (totalNetOutstanding > 0) {
      doc.setTextColor(185, 28, 28);
    } else {
      doc.setTextColor(21, 128, 61);
    }
    doc.text(`Rs. ${totalNetOutstanding.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, pillX + pillW / 2, custTop + 24, { align: 'center' });

    curY = custTop + 44;

    // Invoices Table (Condensed Commercial Layout with Multi-Bill Payment Sub-Rows)
    const invoiceRows: any[] = [];
    invoices.forEach((inv, idx) => {
      const invNo = inv.invoiceNumber || `INV-${inv.orderId || inv.id || idx + 1}`;
      const rawDate = inv.createdAt || inv.date;
      let dStr = '-';
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch {
          dStr = String(rawDate);
        }
      }
      const bType = inv.source === 'POS_WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
      const bTotal = Number(inv.totalAmount || 0);
      const bPaid = Number(inv.paidAmount || 0);
      const bDue = Number(inv.dueAmount !== undefined ? inv.dueAmount : Math.max(0, bTotal - bPaid));
      const dueStr = bDue <= 0 ? '0.00 (PAID)' : `Rs. ${bDue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

      // Primary Invoice Header Row
      invoiceRows.push([
        String(idx + 1),
        invNo,
        dStr,
        bType,
        `Rs. ${bTotal.toLocaleString('en-LK')}`,
        `Rs. ${bPaid.toLocaleString('en-LK')}`,
        dueStr,
      ]);

      // Render Itemized Payment Settlement Lines for this specific bill
      const paymentsList = Array.isArray(inv.payments) && inv.payments.length > 0
        ? inv.payments
        : (Array.isArray(inv.paymentHistory) ? inv.paymentHistory : []);

      if (paymentsList.length > 0) {
        paymentsList.forEach((p: any) => {
          const pRawDate = p.createdAt || p.paidAt || p.date || p.paymentDate;
          let pDateStr = '-';
          if (pRawDate) {
            try {
              const pd = new Date(pRawDate);
              pDateStr = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}-${String(pd.getDate()).padStart(2, '0')}`;
            } catch {}
          }
          const pMethod = String(p.method || p.paymentMethod || 'CASH').toUpperCase();
          const pAmt = Number(p.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 });
          const parsed = parseChequeMetadata(p);

          const normChq = String(parsed.chequeNumber || p.chequeNumber || '').replace(/^#/, '').trim().toUpperCase();
          const normBnk = String(parsed.bankAndTown || p.bankName || '').trim().toUpperCase();
          const matchedGroupChq = normChq
            ? Array.from(groupedChequesMap.values()).find(
                (g) => g.chequeNumber.toUpperCase() === normChq && (!normBnk || g.bankName.toUpperCase().includes(normBnk) || normBnk.includes(g.bankName.toUpperCase()))
              )
            : null;

          const fullChequeAmt = p.fullChequeAmount || parsed.fullChequeAmount || (matchedGroupChq && matchedGroupChq.amount > Number(p.amount || 0) ? matchedGroupChq.amount : undefined);

          let paymentLine = '';
          if (pMethod === 'RETURN_CREDIT') {
            const refText = p.reference ? ` (${p.reference})` : '';
            paymentLine = `  • Return Credit: ${pDateStr}${refText} | Applied to Bill: Rs. ${pAmt}`;
          } else if (pMethod === 'CHEQUE') {
            const chqNumLabel = parsed.chequeNumber ? `Chq #${parsed.chequeNumber}` : 'Cheque';
            const bankLabel = parsed.bankAndTown ? ` (${parsed.bankAndTown})` : '';
            const matLabel = parsed.maturityDate ? ` | Mat: ${parsed.maturityDate}` : '';
            const multiBillNote = fullChequeAmt && fullChequeAmt > Number(p.amount || 0)
              ? ` [Shared Cheque Total: Rs. ${Number(fullChequeAmt).toLocaleString('en-LK', { minimumFractionDigits: 2 })}]`
              : '';
            paymentLine = `  • Payment: ${pDateStr} | CHEQUE: ${chqNumLabel}${bankLabel}${matLabel} | Applied to Bill: Rs. ${pAmt}${multiBillNote}`;
          } else {
            const refStr = p.reference || parsed.residualNotes ? ` (${p.reference || parsed.residualNotes})` : '';
            paymentLine = `  • Payment: ${pDateStr} | ${pMethod}${refStr} | Applied to Bill: Rs. ${pAmt}`;
          }

          invoiceRows.push([
            {
              content: paymentLine,
              colSpan: 7,
              styles: {
                fontSize: 6.8,
                textColor: pMethod === 'RETURN_CREDIT' ? [107, 33, 168] : [55, 65, 81],
                fontStyle: 'italic',
                cellPadding: { top: 1.5, bottom: 2, left: 24, right: 6 },
                fillColor: [248, 250, 252],
                lineWidth: { bottom: 0.3, top: 0, left: 0, right: 0 },
                lineColor: [226, 232, 240],
              },
            },
          ]);
        });
      } else if (bPaid > 0) {
        // Fallback: If payments array is not directly on the invoice, check if consolidatedCheques lists this invoice
        const matchingChq = consolidatedCheques.find((c) => c.invoiceNumbers && c.invoiceNumbers.includes(invNo));
        if (matchingChq) {
          const pAmt = bPaid.toLocaleString('en-LK', { minimumFractionDigits: 2 });
          const multiBillNote = matchingChq.amount > bPaid
            ? ` [Shared Cheque Total: Rs. ${matchingChq.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}]`
            : '';
          const chqNumLabel = matchingChq.chequeNumber ? `Chq #${matchingChq.chequeNumber}` : 'Cheque';
          const bankLabel = matchingChq.bankName ? ` (${matchingChq.bankName})` : '';
          const matLabel = matchingChq.chequeDate ? ` | Mat: ${matchingChq.chequeDate}` : '';
          const paymentLine = `  • Payment: ${dStr} | CHEQUE: ${chqNumLabel}${bankLabel}${matLabel} | Applied to Bill: Rs. ${pAmt}${multiBillNote}`;

          invoiceRows.push([
            {
              content: paymentLine,
              colSpan: 7,
              styles: {
                fontSize: 6.8,
                textColor: [55, 65, 81],
                fontStyle: 'italic',
                cellPadding: { top: 1.5, bottom: 2, left: 24, right: 6 },
                fillColor: [248, 250, 252],
                lineWidth: { bottom: 0.3, top: 0, left: 0, right: 0 },
                lineColor: [226, 232, 240],
              },
            },
          ]);
        }
      }
    });

    autoTable(doc, {
      startY: curY,
      margin: { left: startX, right: pageWidth - rightMargin },
      head: [['#', 'INVOICE NO', 'DATE', 'BILL TYPE', 'BILL TOTAL', 'PAID', 'DUE AMOUNT']],
      body: invoiceRows.length > 0 ? invoiceRows : [['-', 'No recorded invoices', '-', '-', '-', '-', '-']],
      theme: 'plain',
      styles: {
        overflow: 'linebreak',
        cellPadding: 2,
        fontSize: 7.5,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [0, 0, 0],
        fontSize: 7.5,
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 7.5,
        lineColor: [226, 232, 240],
        lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 85, fontStyle: 'bold' },
        2: { cellWidth: 75 },
        3: { cellWidth: 70 },
        4: { cellWidth: 85, halign: 'right' },
        5: { cellWidth: 85, halign: 'right' },
        6: { cellWidth: 90.28, halign: 'right', fontStyle: 'bold' },
      },
    });

    curY = (doc as any).lastAutoTable?.finalY || curY + 60;

    // Distinct Old vs. New Balance Reconciliation Section
    curY += 8;
    const balBoxW = 280;
    const balBoxH = 68;
    const balBoxX = rightMargin - balBoxW;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(balBoxX, curY, balBoxW, balBoxH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text('BALANCE RECONCILIATION SUMMARY', balBoxX + balBoxW / 2, curY + 10, { align: 'center' });

    doc.line(balBoxX + 8, curY + 15, rightMargin - 8, curY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(50, 50, 50);
    doc.text('Current Bill Total (Active Dues):', balBoxX + 10, curY + 26);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${currentBillsDue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, rightMargin - 10, curY + 26, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Previous Old Balance (Carried Forward):', balBoxX + 10, curY + 38);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${previousOldBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, rightMargin - 10, curY + 38, { align: 'right' });

    doc.line(balBoxX + 8, curY + 44, rightMargin - 8, curY + 44);

    doc.setFontSize(8);
    doc.text('Total Net Outstanding:', balBoxX + 10, curY + 56);
    doc.setFontSize(8.5);
    if (totalNetOutstanding > 0) {
      doc.setTextColor(185, 28, 28);
    } else {
      doc.setTextColor(21, 128, 61);
    }
    doc.text(`Rs. ${totalNetOutstanding.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, rightMargin - 10, curY + 56, { align: 'right' });

    // Dynamic "PAID IN FULL" Stamp
    if (totalNetOutstanding <= 0) {
      doc.saveGraphicsState();
      const stampX = startX + 35;
      const stampY = curY + 14;
      const stampW = 135;
      const stampH = 32;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(2);
      doc.rect(stampX, stampY, stampW, stampH);
      doc.setLineWidth(0.6);
      doc.rect(stampX + 2, stampY + 2, stampW - 4, stampH - 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text('PAID IN FULL', stampX + stampW / 2, stampY + 20, { align: 'center' });
      doc.restoreGraphicsState();
    }

    curY += balBoxH + 10;

    // Grouped Pending Cheques Table (When Present)
    if (consolidatedCheques.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('PENDING / UNCLEARED CHEQUES IN HAND', startX, curY);
      curY += 5;

      const chqRows = consolidatedCheques.map((c, i) => {
        const invsJoined = c.invoiceNumbers && c.invoiceNumbers.length > 0
          ? c.invoiceNumbers.join(', ')
          : (c.invoiceNumber || '');
        const invsSuffix = invsJoined ? ` (${invsJoined})` : '';
        const bankPart = c.bankName && c.bankName !== '-' ? ` | Bank: ${c.bankName}` : '';
        const descriptionCell = `Cheque #${c.chequeNumber}${bankPart}${invsSuffix}`;

        return [
          String(i + 1),
          descriptionCell,
          c.bankName || '-',
          c.chequeDate || '-',
          `Rs. ${c.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`,
        ];
      });

      autoTable(doc, {
        startY: curY,
        margin: { left: startX, right: pageWidth - rightMargin },
        head: [['#', 'CHEQUE DETAILS & INVOICES', 'BANK', 'REALIZATION DATE', 'AMOUNT']],
        body: chqRows,
        theme: 'plain',
        styles: {
          overflow: 'linebreak',
          cellPadding: 2,
          fontSize: 7.5,
          valign: 'top',
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [0, 0, 0],
          fontSize: 7.5,
          fontStyle: 'bold',
          lineColor: [0, 0, 0],
          lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        },
        bodyStyles: {
          textColor: [30, 41, 59],
          fontSize: 7.5,
          lineColor: [226, 232, 240],
          lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          overflow: 'linebreak',
        },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 180, fontStyle: 'bold', overflow: 'linebreak' },
          2: { cellWidth: 105, overflow: 'linebreak' },
          3: { cellWidth: 105, overflow: 'linebreak' },
          4: { cellWidth: 100.28, halign: 'right', fontStyle: 'bold' },
        },
      });

      curY = (doc as any).lastAutoTable?.finalY || curY + 40;
    }

    // Pinned Signatures at Bottom of Page
    const sigY = 745;
    const sigBoxW = 180;
    const custX = startX + 15;
    const repX = rightMargin - sigBoxW - 15;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.setLineDashPattern([2, 2], 0);

    // Customer Signature Dotted Line
    doc.line(custX, sigY, custX + sigBoxW, sigY);
    // Authorized Rep Signature Dotted Line
    doc.line(repX, sigY, repX + sigBoxW, sigY);

    doc.setLineDashPattern([], 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('Customer Signature', custX + sigBoxW / 2, sigY + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text('Goods & statement received in good order', custX + sigBoxW / 2, sigY + 18, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('Authorized Rep Signature', repX + sigBoxW / 2, sigY + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text('Reliance Sales / Credit Representative', repX + sigBoxW / 2, sigY + 18, { align: 'center' });

    // Footer Legal Text
    doc.setLineWidth(0.6);
    doc.line(startX, 780, rightMargin, 780);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text('RELIANCE CLOTHING - CREDIT MANAGEMENT DIVISION', startX + contentWidth / 2, 788, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text('Please verify all listed invoice dues. For settlement receipts, contact our finance hotline: 041-2268739.', startX + contentWidth / 2, 797, { align: 'center' });

  if (options.autoPrint) {
    doc.autoPrint({ variant: 'non-conform' });
  }

  if (options.filename) {
    doc.save(options.filename);
  }

  return doc;
}

export const ReportPdf = {
  generateCustomerDuesPdf,
  filterAndNormalizeDueInvoices,
  generateChequeLedgerPdf,
  formatChequeLedgerPdfRows,
  generateSalesPdf,
  formatSalesPdfRows,
  generateMaterialProductionPdf,
  generateGarmentProductionPdf,
  generateFinancialAuditPdf,
  generateStatementPdf,
  drawStandardReportHeader,
  drawStandardReportFooter,
};

export default ReportPdf;
