import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ══════════════════════════════════════════════════════════════════════════════
// 1. BRAND CONSTANTS & LOGO PRELOADER
// ══════════════════════════════════════════════════════════════════════════════

export const BRAND_CONFIG = {
  name: 'RELIANCE',
  subtitle: 'BRANDED MENS CLOTHING',
  address: 'Mawarala Road, Makandura, Matara.',
  tel: '041-2268739, 071-1350123',
  web: 'relianceapparel.lk',
  appSuite: 'Reliance Clothing ERP Management Suite',
};

let cachedLogoDataUrl: string | null = null;

/**
 * Preloads the Reliance corporate logo and converts to Base64 Data URL.
 * Automatically caches the rasterized result for instant multi-page and repeat prints.
 */
export async function loadLogoAsDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  if (typeof window === 'undefined') return null;

  // Method 1: Fetch static asset and encode via FileReader
  try {
    const res = await fetch('/images/logo.jpg');
    if (res.ok) {
      const blob = await res.blob();
      const base64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (base64) {
        cachedLogoDataUrl = base64;
        return cachedLogoDataUrl;
      }
    }
  } catch {
    // Proceed to canvas fallback
  }

  // Method 2: HTML Image element rasterization on HTML5 Canvas
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const loaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = '/images/logo.jpg';
    });

    if (loaded && img.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        cachedLogoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        return cachedLogoDataUrl;
      }
    }
  } catch {
    // Graceful fallback if asset unavailable
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. COMMON FORMATTERS
// ══════════════════════════════════════════════════════════════════════════════

export function formatReportTimestamp(date: Date = new Date()): string {
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

export function formatCurrency(val: number): string {
  return `Rs. ${Number(val || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatAmountNum(val: number): string {
  return Number(val || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. STANDARDIZED BRANDED REPORT HEADER (MATCHING OFFICIAL A4 INVOICE LAYOUT)
// ══════════════════════════════════════════════════════════════════════════════

export interface ReportMetaRow {
  label: string;
  value: string;
  isBold?: boolean;
}

export interface StandardReportHeaderOptions {
  logoData?: string | null;
  reportTitle: string;
  dateRangeLabel?: string;
  generatedTimestamp?: string;
  generatedBy?: string;
  metaRows?: ReportMetaRow[];
  headerTop?: number;
  startX?: number;
  rightMargin?: number;
}

/**
 * Universal branded header renderer for all PDF reports.
 * Matches the official Reliance A4 invoice header structure:
 * - Left: Official corporate logo and crisp brand text hierarchy:
 *   "RELIANCE" (Primary Brand Name)
 *   "BRANDED MENS CLOTHING" (Subtitle, strictly without trailing additions like "& APPAREL MFG")
 *   "Mawarala Road, Makandura, Matara." (Address)
 *   "Tel: 041-2268739, 071-1350123" (Telephone)
 *   "Web: relianceapparel.lk" (Web address)
 * - Right: Report Section Title and right-aligned metadata table
 * - Bottom: Full-width solid 1.2pt divider rule line
 *
 * @returns {number} The Y position immediately below the divider line
 */
export function drawStandardReportHeader(
  doc: jsPDF,
  options: StandardReportHeaderOptions
): number {
  const startX = options.startX ?? 42.5;
  const rightMargin = options.rightMargin ?? 552.78;
  const headerTop = options.headerTop ?? 32;

  let brandTextX = startX;

  // 1. Corporate Logo (50x50 pt)
  if (options.logoData) {
    try {
      doc.addImage(options.logoData, 'JPEG', startX, headerTop - 1, 50, 50);
      brandTextX = startX + 58;
    } catch {
      brandTextX = startX;
    }
  }

  // 2. Primary Brand Name & Structured Address Block (Identical to Official Invoice)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(BRAND_CONFIG.name, brandTextX, headerTop + 14);

  // Subtitle: Strictly "BRANDED MENS CLOTHING"
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 17, 17);
  doc.text(BRAND_CONFIG.subtitle, brandTextX, headerTop + 25);

  // Physical Business Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(34, 34, 34);
  doc.text(BRAND_CONFIG.address, brandTextX, headerTop + 36);

  // Telephone contact
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(34, 34, 34);
  doc.text('Tel: ', brandTextX, headerTop + 47);
  const telPrefixW = doc.getTextWidth('Tel: ');
  doc.setFont('helvetica', 'normal');
  doc.text(BRAND_CONFIG.tel, brandTextX + telPrefixW, headerTop + 47);

  // Web address
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(34, 34, 34);
  doc.text('Web: ', brandTextX, headerTop + 58);
  const webPrefixW = doc.getTextWidth('Web: ');
  doc.setFont('helvetica', 'normal');
  doc.text(BRAND_CONFIG.web, brandTextX + webPrefixW, headerTop + 58);

  // 3. Right-Aligned Header Area: Report Section Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(options.reportTitle, rightMargin, headerTop + 12, { align: 'right' });

  // 4. Right-Aligned Metadata Table Block
  const metaRows: ReportMetaRow[] = options.metaRows || [
    { label: 'PERIOD:', value: options.dateRangeLabel || 'Current Period', isBold: true },
    { label: 'GENERATED:', value: options.generatedTimestamp || formatReportTimestamp(), isBold: false },
    { label: 'PRINTED BY:', value: options.generatedBy || 'System Administrator', isBold: false },
  ];

  const metaLabelX = rightMargin - 165;
  let metaY = headerTop + 24;

  metaRows.forEach((row) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(85, 85, 85);
    doc.text(row.label, metaLabelX, metaY);

    doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(row.value, rightMargin, metaY, { align: 'right' });

    metaY += 11;
  });

  // 5. Main Solid Divider Line (1.2pt solid black rule)
  const dividerY = Math.max(headerTop + 65, metaY) + 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.2);
  doc.line(startX, dividerY, rightMargin, dividerY);

  return dividerY + 12;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. STANDARDIZED REPORT FOOTER & TRIPLE SIGNATURE AREA
// ══════════════════════════════════════════════════════════════════════════════

export function drawStandardReportSignatures(
  doc: jsPDF,
  signY: number,
  startX = 42.5,
  rightMargin = 552.78,
  roles: Array<{ role: string; desc: string }> = [
    { role: 'PREPARED BY', desc: 'Accounts & Finance Officer' },
    { role: 'CHECKED & VERIFIED BY', desc: 'Internal Audit & Accounts' },
    { role: 'AUTHORIZED SIGNATURE', desc: 'Managing Director / Partner' },
  ]
): number {
  const contentWidth = rightMargin - startX;
  const signColWidth = (contentWidth - (roles.length - 1) * 15) / roles.length;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);

  roles.forEach((r, idx) => {
    const colX = startX + idx * (signColWidth + 15);
    doc.line(colX, signY + 25, colX + signColWidth, signY + 25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(r.role, colX + signColWidth / 2, signY + 34, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(68, 68, 68);
    doc.text(r.desc, colX + signColWidth / 2, signY + 44, { align: 'center' });
  });

  return signY + 54;
}

export function drawStandardReportFooter(
  doc: jsPDF,
  reportName: string,
  startX = 42.5,
  rightMargin = 552.78
): void {
  const contentWidth = rightMargin - startX;
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(102, 102, 102);
    doc.text(
      `Confidential & Proprietary — ${BRAND_CONFIG.appSuite}. All financial figures are strictly verified against the system ledger.`,
      startX + contentWidth / 2,
      805,
      { align: 'center' }
    );

    doc.setFontSize(6.5);
    doc.setTextColor(68, 68, 68);
    doc.text(
      `Reliance ${reportName}  •  Page ${i} of ${totalPages}`,
      rightMargin,
      816,
      { align: 'right' }
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. CLIENT-SIDE FINANCIAL AUDIT PDF EXPORT GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

export type FinancialMetricFocus =
  | 'grossRevenue'
  | 'netSales'
  | 'totalPaid'
  | 'totalDue'
  | 'netOperationalRevenue'
  | 'netOperationalProfit';

export interface FinancialAuditExportData {
  grossRevenue: number;
  totalDiscount: number;
  totalReturns?: number;
  netSales: number;
  totalPaid: number;
  totalDue: number;
  orderCount?: number;
  averageOrderValue?: number;
  paymentSplit?: Record<string, { count: number; amount: number }>;
  dateLabel?: string;
  totalProductionCost?: number;
  totalGrnExpenses?: number;
  totalGrnLiabilities?: number;
  costOfGoodsSold?: number;
  grossProfit?: number;
  grossProfitMargin?: number;
  netOperationalRevenue?: number;
  netOperationalProfit?: number;
}

export interface GenerateFinancialAuditPdfOptions {
  currentFocus?: FinancialMetricFocus;
  dateRangeLabel?: string;
  generatedBy?: string;
  filename?: string;
}

/**
 * Generates a branded executive Financial Audit PDF document client-side.
 * Contains:
 * - Official A4 Reliance Invoice Header layout (standardized across reports)
 * - Executive Metric Focus & Mathematical Formula Callout
 * - Dual-Row Ink-Saver Executive KPI Summary Cards
 * - Line-Item Financial Ledger Waterfall Table
 * - Collections & Liquidity Settlement Breakdown Table
 * - Net Operational Revenue & Manufacturing Outflows Breakdown Table
 * - Triple Sign-off Area (Prepared, Checked, Authorized)
 * - Standardized ERP Confidential Footer & Dynamic Page Numbering
 */
export async function generateFinancialAuditPdf(
  data: FinancialAuditExportData,
  options: GenerateFinancialAuditPdfOptions = {}
): Promise<jsPDF> {
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

  const grossRevenue = Number(data.grossRevenue) || 0;
  const totalDiscount = Number(data.totalDiscount) || 0;
  const totalReturns = Number(data.totalReturns) || 0;
  const netSales = Number(data.netSales) || 0;
  const totalPaid = Number(data.totalPaid) || 0;
  const totalDue = Number(data.totalDue) || 0;
  const orderCount = Number(data.orderCount) || 0;
  const totalProductionCost = Number(data.totalProductionCost) || 0;
  const totalGrnExpenses = Number(data.totalGrnExpenses) || 0;
  const totalGrnLiabilities = Number(data.totalGrnLiabilities) || 0;

  const netOperationalRevenue =
    data.netOperationalRevenue !== undefined
      ? Number(data.netOperationalRevenue)
      : Math.round((totalPaid - totalProductionCost - totalGrnExpenses) * 100) / 100;

  const netOperationalProfit =
    data.netOperationalProfit !== undefined
      ? Number(data.netOperationalProfit)
      : Math.round((netSales - totalProductionCost - totalGrnExpenses) * 100) / 100;

  const paymentSplit = data.paymentSplit || {};
  const cashAmount = paymentSplit['CASH']?.amount || 0;
  const cashCount = paymentSplit['CASH']?.count || 0;
  const cardAmount = paymentSplit['CARD']?.amount || 0;
  const cardCount = paymentSplit['CARD']?.count || 0;
  const chequeAmount = paymentSplit['CHEQUE']?.amount || 0;
  const chequeCount = paymentSplit['CHEQUE']?.count || 0;
  const creditAmount = paymentSplit['CREDIT']?.amount || 0;
  const creditCount = paymentSplit['CREDIT']?.count || 0;

  const currentFocus = options.currentFocus || 'netOperationalRevenue';
  const focusLabels: Record<FinancialMetricFocus, { label: string; formula: string; amount: number }> = {
    grossRevenue: {
      label: 'Gross Revenue',
      formula: 'Gross Revenue = Total Item List Value before discounts or returns',
      amount: grossRevenue,
    },
    netSales: {
      label: 'Net Sales',
      formula: 'Net Sales = Gross Item Volume - Discounts Applied - Restocked Returns',
      amount: netSales,
    },
    totalPaid: {
      label: 'Collected / Paid',
      formula: 'Collected / Paid = Cash Tendered + Card Settled + Cleared Cheque Payments',
      amount: totalPaid,
    },
    totalDue: {
      label: 'Outstanding Credit Due',
      formula: 'Outstanding Due = Net Sales Total - Realized Payments Received',
      amount: totalDue,
    },
    netOperationalRevenue: {
      label: 'Net Operational Revenue',
      formula: 'Net Operational Revenue = Realized Collections (Total Paid) - Production Costs - GRN Expenses',
      amount: netOperationalRevenue,
    },
    netOperationalProfit: {
      label: 'Operational Profit',
      formula: 'Operational Profit = Net Billed Sales - Total Production Material Costs - GRN Purchases',
      amount: netOperationalProfit,
    },
  };

  const focusInfo = focusLabels[currentFocus] || focusLabels.netOperationalRevenue;
  const reportTitle = 'FINANCIAL AUDIT & OPERATIONAL REVENUE SUMMARY';
  const dateLabel = options.dateRangeLabel || data.dateLabel || 'Selected Range';
  const generatedTimestamp = formatReportTimestamp();
  const generatedBy = options.generatedBy || 'System Administrator';

  const metaRows: ReportMetaRow[] = [
    { label: 'AUDIT PERIOD:', value: dateLabel, isBold: true },
    { label: 'GENERATED:', value: generatedTimestamp, isBold: false },
    { label: 'CERTIFIED BY:', value: generatedBy, isBold: false },
    { label: 'ACTIVE FOCUS:', value: focusInfo.label.toUpperCase(), isBold: true },
  ];

  const renderHeader = (headerTop = 32) => {
    return drawStandardReportHeader(doc, {
      logoData,
      reportTitle,
      metaRows,
      headerTop,
      startX,
      rightMargin,
    });
  };

  let curY = renderHeader(32);

  // ── 1. Focus Metric Callout Box ──
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(startX, curY, contentWidth, 34, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`AUDIT FOCUS: ${focusInfo.label.toUpperCase()} — ${formatCurrency(focusInfo.amount)}`, startX + 8, curY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(68, 68, 68);
  doc.text(`Formula: ${focusInfo.formula}`, startX + 8, curY + 24);

  curY += 40;

  // ── 2. Executive KPI Summary Cards (2 Rows of 4 Cards) ──
  const kpiRows: Array<Array<{ label: string; value: string; isAlert?: boolean }>> = [
    [
      { label: 'GROSS ITEM VOLUME', value: formatCurrency(grossRevenue) },
      { label: 'TOTAL DISCOUNTS', value: `- ${formatCurrency(totalDiscount)}` },
      { label: 'NET BILLED SALES', value: formatCurrency(netSales) },
      { label: 'REALIZED CASH INFLOW', value: formatCurrency(totalPaid) },
    ],
    [
      { label: 'PRODUCTION COSTS', value: `- ${formatCurrency(totalProductionCost)}` },
      { label: 'GRN PURCHASES', value: `- ${formatCurrency(totalGrnExpenses)}` },
      {
        label: 'NET OPERATIONAL REV.',
        value: formatCurrency(netOperationalRevenue),
        isAlert: netOperationalRevenue < 0,
      },
      {
        label: 'CUSTOMER DEBT DUE',
        value: formatCurrency(totalDue),
        isAlert: totalDue > 0,
      },
    ],
  ];

  const cardGap = 8;
  const cardWidth = (contentWidth - 3 * cardGap) / 4;
  const cardHeight = 32;

  kpiRows.forEach((rowCards) => {
    rowCards.forEach((card, idx) => {
      const cardX = startX + idx * (cardWidth + cardGap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.rect(cardX, curY, cardWidth, cardHeight, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(85, 85, 85);
      doc.text(card.label, cardX + 6, curY + 11);

      doc.setFontSize(8.5);
      doc.setTextColor(card.isAlert ? 185 : 0, 0, card.isAlert ? 28 : 0);
      doc.text(card.value, cardX + 6, curY + 24);
    });
    curY += cardHeight + 6;
  });

  curY += 6;

  // ── 3. Line-Item Financial Ledger Waterfall Table ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('1. LINE-ITEM FINANCIAL LEDGER WATERFALL', startX, curY);
  curY += 8;

  const waterfallRows = [
    [
      '+',
      'Total Item List Value (Gross Volume)',
      formatAmountNum(grossRevenue),
      `Standard catalogue volume across ${orderCount} recorded sales`,
    ],
    [
      '-',
      'Less: Promotional Discounts Applied',
      formatAmountNum(totalDiscount),
      'Discounts applied during POS checkout & register settlement',
    ],
    [
      '-',
      'Less: Restocked Garment Returns',
      formatAmountNum(totalReturns),
      'Items returned to warehouse stock with customer credit reversals',
    ],
    [
      '=',
      'EQUALS: Net Sales Revenue',
      formatAmountNum(netSales),
      'True accrual revenue recognized in Reliance financial accounts',
    ],
  ];

  autoTable(doc, {
    startY: curY,
    margin: { left: startX, right: pageWidth - rightMargin, top: 115, bottom: 45 },
    theme: 'plain',
    head: [['OP', 'LEDGER COMPONENT / AUDIT ITEM', 'AMOUNT (RS.)', 'AUDIT NOTES & RECONCILIATION']],
    body: waterfallRows,
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7,
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 175, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 90, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 219.28, halign: 'left', textColor: [85, 85, 85] },
    },
    didDrawPage: () => {
      renderHeader(32);
    },
  });

  curY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : curY + 80;

  // ── 4. Collections & Liquidity Settlement Breakdown Table ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('2. COLLECTIONS & LIQUIDITY SETTLEMENT BREAKDOWN', startX, curY);
  curY += 8;

  const collectionsRows = [
    ['Cash Tendered Inflow', `${cashCount} Orders`, formatAmountNum(cashAmount), 'Liquid Cash Realized & Deposited'],
    ['Card & Digital Bank Payments', `${cardCount} Orders`, formatAmountNum(cardAmount), 'Digital Merchant Settled'],
    ['Cheque Payments Registered', `${chequeCount} Orders`, formatAmountNum(chequeAmount), 'Cheque Inflow (Realized/Registered)'],
    ['(=) Total Liquid Collected / Paid', `${orderCount} Orders`, formatAmountNum(totalPaid), 'Realized Liquid Capital Inflow'],
    ['(!) Outstanding Customer Credit Debt', `${creditCount} Orders`, formatAmountNum(totalDue), 'Open Accounts Receivable Debt'],
  ];

  autoTable(doc, {
    startY: curY,
    margin: { left: startX, right: pageWidth - rightMargin, top: 115, bottom: 45 },
    theme: 'plain',
    head: [['PAYMENT METHOD / CHANNEL', 'INVOICE COUNT', 'REALIZED AMOUNT (RS.)', 'SETTLEMENT STATUS']],
    body: collectionsRows,
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7,
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 165, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 80, halign: 'center' },
      2: { cellWidth: 95, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 170.28, halign: 'left', textColor: [85, 85, 85] },
    },
    didDrawPage: () => {
      renderHeader(32);
    },
  });

  curY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : curY + 80;

  // ── 5. Net Operational Revenue & Manufacturing Outflows Breakdown Table ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('3. NET OPERATIONAL REVENUE & MANUFACTURING LIABILITIES', startX, curY);
  curY += 8;

  const operationalRows = [
    [
      '+',
      'Realized Customer Collections (Total Paid)',
      formatAmountNum(totalPaid),
      'Direct liquid inflow realized across all payment methods',
    ],
    [
      '-',
      'Direct Production Batch Costs',
      formatAmountNum(totalProductionCost),
      'Cutting, fabric consumption & manufacturing labor costs',
    ],
    [
      '-',
      'GRN Supplier Procurement Expenses',
      formatAmountNum(totalGrnExpenses),
      `Raw materials procurement liabilities (Payables: Rs. ${formatAmountNum(totalGrnLiabilities)})`,
    ],
    [
      '=',
      'EQUALS: Net Operational Revenue (Cash Surplus)',
      formatAmountNum(netOperationalRevenue),
      'Net liquid operating surplus: Total Paid minus Production & GRN',
    ],
    [
      '=',
      'EQUALS: Net Operational Profit (Accrual)',
      formatAmountNum(netOperationalProfit),
      'Operating profitability: Net Sales minus Production & GRN',
    ],
  ];

  autoTable(doc, {
    startY: curY,
    margin: { left: startX, right: pageWidth - rightMargin, top: 115, bottom: 45 },
    theme: 'plain',
    head: [['OP', 'OPERATIONAL COMPONENT', 'AMOUNT (RS.)', 'ACCOUNTING IMPACT & RECONCILIATION']],
    body: operationalRows,
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7,
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 175, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 90, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 219.28, halign: 'left', textColor: [85, 85, 85] },
    },
    didDrawPage: () => {
      renderHeader(32);
    },
  });

  const finalTableY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : curY + 80;

  // ── 6. Authorized Signatures Area ──
  let signY = finalTableY;
  if (signY + 55 > 745) {
    doc.addPage();
    renderHeader(32);
    signY = 120;
  }

  drawStandardReportSignatures(doc, signY, startX, rightMargin);

  // ── 7. Page Footers across all pages ──
  drawStandardReportFooter(doc, 'Financial Audit Report', startX, rightMargin);

  const dateTag = new Date().toISOString().split('T')[0];
  const filename = options.filename || `reliance-financial-audit-${currentFocus}-${dateTag}.pdf`;
  doc.save(filename);

  return doc;
}

export default {
  BRAND_CONFIG,
  loadLogoAsDataUrl,
  formatReportTimestamp,
  formatCurrency,
  formatAmountNum,
  drawStandardReportHeader,
  drawStandardReportSignatures,
  drawStandardReportFooter,
  generateFinancialAuditPdf,
};

