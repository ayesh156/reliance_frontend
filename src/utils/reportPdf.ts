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

  const reportTitle = 'GARMENT PRODUCTION & 6-STAGE PIPELINE AUDIT';
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
        return s + (logged > 0 ? logged : Number(r.completedQty ?? r.washedQty ?? 0));
      }, 0)
  );
  const fullyFinishedSynced = Number(
    summary.fullyFinishedSynced ??
      summary.syncedToInventory ??
      rawRows.reduce((s, r) => (r.isStockSynced && r.status !== 'CANCELLED' ? s + Number(r.completedQty ?? r.washedQty ?? 0) : s), 0)
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
    const finished = loggedFinish > 0 ? loggedFinish : Number(r.completedQty ?? r.washedQty ?? 0);
    const statusText = r.isStockSynced
      ? 'IN STOCK'
      : r.status === 'FINISHED_PENDING_STOCK'
      ? 'AWAIT SYNC'
      : r.status || 'CUTTING';

    return [
      r.productionNo || '-',
      r.productName || 'Garment',
      r.variant || 'Standard',
      formatAmountNum(r.targetQuantity || 0),
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
    head: [['BATCH NO', 'GARMENT STYLE', 'VARIANT', 'TARGET', 'CUT QTY', 'SEWN', 'WASHED', 'FINISHED', 'STATUS']],
    body: tableData,
    foot: [
      [
        { content: `TOTAL (${rawRows.length} BATCHES)`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatAmountNum(rawRows.reduce((s, r) => s + (Number(r.targetQuantity) || 0), 0)), styles: { halign: 'center', fontStyle: 'bold' } },
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
      0: { cellWidth: 62 },
      1: { cellWidth: 105 },
      2: { cellWidth: 55 },
      3: { halign: 'center', cellWidth: 38 },
      4: { halign: 'center', cellWidth: 38 },
      5: { halign: 'center', cellWidth: 40 },
      6: { halign: 'center', cellWidth: 32 },
      7: { halign: 'center', cellWidth: 38 },
      8: { halign: 'right', cellWidth: 52 },
      9: { halign: 'center', cellWidth: 50.28 },
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

export const ReportPdf = {
  generateCustomerDuesPdf,
  filterAndNormalizeDueInvoices,
  generateChequeLedgerPdf,
  formatChequeLedgerPdfRows,
  generateMaterialProductionPdf,
  generateGarmentProductionPdf,
  generateFinancialAuditPdf,
  drawStandardReportHeader,
  drawStandardReportFooter,
};

export default ReportPdf;
