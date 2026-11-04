import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCustomerAddressCity } from './customerAddress';
import {
  loadLogoAsDataUrl,
  drawStandardReportHeader,
  drawStandardReportFooter,
  formatReportTimestamp,
  formatCurrency,
  formatAmountNum,
} from './pdfGenerator';

export { loadLogoAsDataUrl };

// ══════════════════════════════════════════════════════════════════════════════
// 1. DATA CONTRACTS & TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

export interface CustomerDueInvoice {
  id?: string | number;
  invoiceNumber: string;
  createdAt?: string;
  date?: string;
  customerName?: string;
  customerPhone?: string;
  subtotal?: number;
  discount?: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount?: number;
  dueBalance?: number;
  source?: string;
  status?: string;
}

export interface CustomerDueItem {
  invoiceNumber: string;
  date: string;
  invoicedAmt: number;
  paidAmt: number;
  dueBalance: number;
}

export interface CustomerDueGroup {
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  invoices: CustomerDueItem[];
  totalInvoiced: number;
  totalPaid: number;
  totalDue: number;
}

export interface GenerateCustomerDuesPdfOptions {
  dateRangeLabel?: string;
  generatedBy?: string;
  filename?: string;
  masterReceipt?: {
    receiptNumber?: string | null;
    totalAmount: number;
    paymentMethod: string;
    receiptDate?: string | Date;
    reference?: string | null;
    payments?: Array<{
      orderId: number;
      amount: number;
      invoiceNumber?: string;
    }>;
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. HELPER FUNCTIONS & ASSET PRELOADER (STANDARDIZED)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Filter invoices where dueBalance > 0 and group strictly by Customer.
 */
export function filterAndNormalizeDueInvoices(invoices: CustomerDueInvoice[]) {
  const groupMap = new Map<string, {
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    invoices: CustomerDueItem[];
    totalInvoiced: number;
    totalPaid: number;
    totalDue: number;
  }>();

  let grandTotalInvoiced = 0;
  let grandTotalPaid = 0;
  let grandTotalDue = 0;
  const flatDueInvoices: CustomerDueItem[] = [];

  for (const inv of invoices) {
    const total = Number(inv.totalAmount || 0);
    const paid = Number(inv.paidAmount || 0);
    const explicitDue = Number(inv.dueBalance ?? inv.dueAmount);
    const due = Math.round((isNaN(explicitDue) ? Math.max(0, total - paid) : explicitDue) * 100) / 100;

    // Strict filter: ONLY include invoices with dueBalance > 0
    if (due <= 0) continue;

    const custName = String(inv.customerName || (inv as any).customer?.name || 'Walk-in Customer').trim();
    const custPhone = String(inv.customerPhone || (inv as any).customer?.phone || '').trim();
    const resolvedAddr = formatCustomerAddressCity(inv);
    const custAddr = resolvedAddr !== '-' ? resolvedAddr : '';
    const groupKey = `${custName.toLowerCase()}|||${custPhone.toLowerCase()}`;

    let dateStr = '-';
    if (inv.date) {
      dateStr = String(inv.date).split('T')[0];
    } else if (inv.createdAt) {
      dateStr = String(inv.createdAt).split('T')[0];
    }

    const item: CustomerDueItem = {
      invoiceNumber: inv.invoiceNumber || 'INV-UNKNOWN',
      date: dateStr,
      invoicedAmt: total,
      paidAmt: paid,
      dueBalance: due,
    };

    flatDueInvoices.push(item);
    grandTotalInvoiced += total;
    grandTotalPaid += paid;
    grandTotalDue += due;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        customerName: custName,
        customerPhone: custPhone,
        customerAddress: custAddr,
        invoices: [],
        totalInvoiced: 0,
        totalPaid: 0,
        totalDue: 0,
      });
    }

    const group = groupMap.get(groupKey)!;
    group.invoices.push(item);
    group.totalInvoiced += total;
    group.totalPaid += paid;
    group.totalDue += due;
  }

  // Convert map to array and sort customer groups alphabetically by Customer Name
  const customerGroups: CustomerDueGroup[] = Array.from(groupMap.values()).map((g) => {
    // Sort each customer's invoices chronologically by date, then invoice number
    g.invoices.sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date);
      if (dateComp !== 0) return dateComp;
      return a.invoiceNumber.localeCompare(b.invoiceNumber);
    });

    return {
      customerName: g.customerName,
      customerPhone: g.customerPhone,
      customerAddress: g.customerAddress,
      invoices: g.invoices,
      totalInvoiced: Math.round(g.totalInvoiced * 100) / 100,
      totalPaid: Math.round(g.totalPaid * 100) / 100,
      totalDue: Math.round(g.totalDue * 100) / 100,
    };
  });

  customerGroups.sort((a, b) => a.customerName.localeCompare(b.customerName));

  return {
    customerGroups,
    dueInvoices: flatDueInvoices,
    uniqueCustomersCount: customerGroups.length,
    grandTotalInvoiced: Math.round(grandTotalInvoiced * 100) / 100,
    grandTotalPaid: Math.round(grandTotalPaid * 100) / 100,
    grandTotalDue: Math.round(grandTotalDue * 100) / 100,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MASTER CUSTOMER DUES PDF GENERATOR (CUSTOMER-WISE GROUPING)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generates the Outstanding Customer Dues PDF report grouped strictly by Customer.
 * Preserves the official header with Reliance logo, monochrome ink-saver cards,
 * and renders dedicated mini-tables for each customer with subtotals.
 */
export async function generateCustomerDuesPdf(
  invoices: CustomerDueInvoice[],
  options: GenerateCustomerDuesPdfOptions = {}
): Promise<jsPDF> {
  const {
    customerGroups,
    uniqueCustomersCount,
    grandTotalInvoiced,
    grandTotalPaid,
    grandTotalDue,
  } = filterAndNormalizeDueInvoices(invoices);

  if (customerGroups.length === 0) {
    throw new Error('No outstanding customer dues found for the selected period (all invoices fully settled).');
  }

  // Pre-load corporate logo asset before PDF document construction
  const logoData = await loadLogoAsDataUrl();

  // A4 portrait in points (matching backend ReportPdfService: 595.28 x 841.89 pt)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const startX = 42.5; // 15mm left margin
  const rightMargin = 552.78; // 15mm right margin
  const contentWidth = rightMargin - startX; // 510.28 pt

  const reportTitle = 'OUTSTANDING CUSTOMER DUES REPORT';
  const dateLabel = options.dateRangeLabel || 'All Recorded History';
  const generatedTimestamp = formatReportTimestamp();
  const generatedBy = options.generatedBy || 'System Administrator';

  // ── Master Header Function (100% Visual Parity with Official Reliance Invoice Header) ──
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

  // ── Summary KPI Metric Boxes (Clean monochrome ink-saver cards) ──
  const kpiCards = [
    { label: 'CUSTOMERS WITH DUES', value: `${uniqueCustomersCount} Customers` },
    { label: 'TOTAL INVOICED', value: formatCurrency(grandTotalInvoiced) },
    { label: 'TOTAL SETTLED', value: formatCurrency(grandTotalPaid) },
    { label: 'OUTSTANDING DUE', value: formatCurrency(grandTotalDue) },
  ];

  const cardGap = 8;
  const cardWidth = (contentWidth - (kpiCards.length - 1) * cardGap) / kpiCards.length;
  const cardHeight = 38;

  kpiCards.forEach((card, idx) => {
    const cardX = startX + idx * (cardWidth + cardGap);
    // Pure white card with clean 0.8px black border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(cardX, curY, cardWidth, cardHeight, 'FD');

    // Bold black uppercase label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(card.label, cardX + 6, curY + 12);

    // Bold black metric value
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(card.value, cardX + 6, curY + 26);
  });

  curY += cardHeight + 16;

  // ── Dedicated Master Receipt / Full Payment Section (When Present) ──
  if (options.masterReceipt && Number(options.masterReceipt.totalAmount) > 0) {
    const mr = options.masterReceipt;
    const rDateStr = mr.receiptDate
      ? new Date(mr.receiptDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const mrHead = [
      [
        {
          content: `MASTER RECEIPT / FULL PAYMENT ACKNOWLEDGEMENT (${mr.receiptNumber || 'REC'} - ${rDateStr})`,
          colSpan: 3,
          styles: { halign: 'left', fontStyle: 'bold', fillColor: [240, 253, 244], textColor: [21, 128, 61] },
        },
        {
          content: `Total Paid: Rs. ${formatAmountNum(mr.totalAmount)} (${mr.paymentMethod || 'CASH'})`,
          colSpan: 2,
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 253, 244], textColor: [21, 128, 61] },
        },
      ],
    ];

    const mrBody: any[] = [];
    if (Array.isArray(mr.payments) && mr.payments.length > 0) {
      mr.payments.forEach((p) => {
        mrBody.push([
          { content: p.invoiceNumber || `INV #${p.orderId}`, styles: { fontStyle: 'bold' } },
          { content: 'Cleared Against Debt', colSpan: 2, styles: { textColor: [100, 100, 100] } },
          { content: `Allocated: Rs. ${formatAmountNum(p.amount)}`, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] } },
        ]);
      });
    }

    autoTable(doc, {
      startY: curY,
      margin: { left: startX, right: pageWidth - rightMargin },
      theme: 'plain',
      head: mrHead as any,
      body: mrBody,
      headStyles: {
        fontSize: 7.5,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        lineColor: [21, 128, 61],
        lineWidth: { top: 0.8, bottom: 0.8, left: 0.8, right: 0.8 },
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
        lineColor: [226, 232, 240],
        lineWidth: { bottom: 0.4 },
      },
    });

    curY = ((doc as any).lastAutoTable?.finalY || curY + 30) + 12;
  }

  // ── Customer-Wise Iteration & Dedicated Mini-Tables ──
  // Proportional 5-column width allocation totaling exactly 510.28 pt (contentWidth):
  // 90 (INV #) + 85 (DATE) + 110 (INVOICED AMT) + 110 (PAID AMT) + 115.28 (DUE BALANCE) = 510.28 pt
  const tableHead = [
    [
      { content: 'INV #', styles: { halign: 'left' } },
      { content: 'DATE', styles: { halign: 'left' } },
      { content: 'INVOICED AMT', styles: { halign: 'right' } },
      { content: 'PAID AMT', styles: { halign: 'right' } },
      { content: 'DUE BALANCE', styles: { halign: 'right' } },
    ],
  ];

  customerGroups.forEach((group, groupIdx) => {
    // Check if remaining page height is sufficient for sub-header + table header + at least 1 row (~75pt)
    if (curY + 75 > 740) {
      doc.addPage();
      drawMasterHeader(35);
      curY = 120;
    }

    // ── Customer Sub-Header ──
    const phoneText = group.customerPhone && group.customerPhone !== '-' ? `  |  Phone: ${group.customerPhone}` : '';
    const addressText = group.customerAddress && group.customerAddress !== '-' ? `  |  Address: ${group.customerAddress}` : '';
    const customerHeading = `Customer: ${group.customerName}${phoneText}${addressText}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(customerHeading, startX, curY + 9);

    // Ink-saving crisp subtle hairline rule under the sub-header
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(startX, curY + 13, rightMargin, curY + 13);

    curY += 17;

    // Mini-table rows for this specific customer
    const tableBody = group.invoices.map((inv) => [
      inv.invoiceNumber,
      inv.date,
      formatAmountNum(inv.invoicedAmt),
      formatAmountNum(inv.paidAmt),
      formatAmountNum(inv.dueBalance),
    ]);

    // Subtotal row showing customer totals
    const tableFoot = [
      [
        {
          content: `CUSTOMER TOTAL DUE (${group.invoices.length} ${group.invoices.length === 1 ? 'INV' : 'INVS'}):`,
          colSpan: 2,
          styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
        },
        {
          content: formatAmountNum(group.totalInvoiced),
          styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
        },
        {
          content: formatAmountNum(group.totalPaid),
          styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
        },
        {
          content: formatCurrency(group.totalDue),
          styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] },
        },
      ],
    ];

    autoTable(doc, {
      startY: curY,
      margin: { left: startX, right: pageWidth - rightMargin },
      theme: 'plain',
      head: tableHead as any,
      body: tableBody,
      foot: tableFoot as any,
      headStyles: {
        fillColor: [248, 250, 252], // Minimal off-white shading for high legibility and minimal ink
        textColor: [0, 0, 0],
        fontSize: 7,
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
        cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // Pure white background to eliminate unnecessary ink usage
        textColor: [0, 0, 0],
        fontSize: 7,
        lineColor: [226, 232, 240], // Light #e2e8f0 row divider
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
        cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
      },
      columnStyles: {
        0: { cellWidth: 90, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 85, halign: 'left' },
        2: { cellWidth: 110, halign: 'right' },
        3: { cellWidth: 110, halign: 'right' },
        4: { cellWidth: 115.28, halign: 'right', fontStyle: 'bold' },
      },
      pageBreak: 'auto',
      didParseCell: (data) => {
        if (data.section === 'head') {
          if (data.column.index >= 2) {
            data.cell.styles.halign = 'right';
          } else {
            data.cell.styles.halign = 'left';
          }
        }
      },
      didDrawPage: () => {
        drawMasterHeader(32);
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || curY + 40;
    // Adequate spacing between current customer's table and next customer's sub-header
    curY = finalY + 16;
  });

  // ── Authorized Sign-off Area (Matching master report template) ──
  let signY = curY + 10;
  const footerNeededHeight = 65;
  if (signY + footerNeededHeight > 750) {
    doc.addPage();
    drawMasterHeader(32);
    signY = 120;
  }

  const signColWidth = (contentWidth - 30) / 3;

  // Prepared By
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

  // Checked By
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

  // Authorized By
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

  // ── Master Page Numbers and Legal Disclaimer ──
  drawStandardReportFooter(doc, 'Outstanding Customer Dues Report', startX, rightMargin);

  const dateTag = new Date().toISOString().split('T')[0];
  const filename = options.filename || `reliance-customer-dues-${dateTag}.pdf`;
  doc.save(filename);

  return doc;
}

export const CustomerDuesPdf = {
  generateCustomerDuesPdf,
  filterAndNormalizeDueInvoices,
  loadLogoAsDataUrl,
};

export default CustomerDuesPdf;
