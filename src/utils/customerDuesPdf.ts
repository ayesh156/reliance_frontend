import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCustomerAddressCity } from './customerAddress';

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
// 2. HELPER FUNCTIONS & ASSET PRELOADER
// ══════════════════════════════════════════════════════════════════════════════

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

  // ── Master Header Function (100% Visual Parity with Backend Master Sales Report) ──
  const drawMasterHeader = (headerTop = 35): number => {
    let brandTextX = startX;

    // 1. Official Corporate Logo (36x36 pt at startX, headerTop - 2)
    if (logoData) {
      try {
        doc.addImage(logoData, 'JPEG', startX, headerTop - 2, 36, 36);
        brandTextX = startX + 44;
      } catch {
        brandTextX = startX;
      }
    }

    // 2. Brand Details (Crisp black typography aligned beside logo)
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
      'Mawarala Road, Makandura, Matara | Tel: 041-2268739, 071-1350123  •  Web: relianceapparel.lk',
      brandTextX,
      headerTop + 32
    );

    // 3. Dynamic Header Block Below Brand
    const headerContentY = headerTop + 46;

    // Report Section Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(reportTitle, startX, headerContentY);

    // 4. Dedicated Right-Aligned Metadata Block (PERIOD, GENERATED, PRINTED BY)
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

    // 5. Solid Divider Rule Line
    const dividerY = Math.max(headerContentY + 12, metaY) + 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(startX, dividerY, rightMargin, dividerY);

    return dividerY + 12;
  };

  let curY = drawMasterHeader(35);

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
        drawMasterHeader(35);
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
    drawMasterHeader(35);
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
      `Reliance Outstanding Customer Dues Report  •  Page ${i} of ${totalPages}`,
      rightMargin,
      816,
      { align: 'right' }
    );
  }

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
