import React, { useEffect, useRef } from 'react';

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  order: any;
  autoPrint?: boolean;
}

/**
 * Robust Headless Iframe Print Engine:
 * Generates an isolated printing context to eliminate React DOM CSS clipping,
 * blank pages, black-box artifacts, and extra blank trailing sheets.
 */
export const A4InvoiceModal: React.FC<InvoiceModalProps> = ({ open, onClose, order, autoPrint = false }) => {
  // Prevent duplicate execution across React re-renders and StrictMode
  const isPrintingRef = useRef<boolean>(false);

  useEffect(() => {
    // Abort if modal is closed, order is missing, autoPrint is off, or already dispatched
    if (!open || !order || !autoPrint || isPrintingRef.current) return;
    isPrintingRef.current = true;

    const invoiceNo = `INV${order.id || String(Date.now()).slice(-4)}`;
    const dateStr = order.createdAt
      ? new Date(order.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    // Resolve tendered customer cash, change, and credit/balance due accurately
    const total = Number(order.totalAmount || 0);
    const tendered = order.tenderedAmount !== undefined 
      ? Number(order.tenderedAmount) 
      : Number(order.paidAmount || 0);
    const change = Math.max(0, tendered - total);
    const balanceDue = Math.max(0, total - tendered);

    // 1. Resolve active payment method label (CASH, CHEQUE, CARD, CREDIT)
    // Detect wholesale transactions cleanly
    const isWholesale = order.source === 'POS_WHOLESALE' || order.orderType === 'WHOLESALE';

    const paymentMethodLabel = order.paymentMethod 
      ? order.paymentMethod.toUpperCase() 
      : (isWholesale ? 'WHOLESALE CREDIT' : 'CASH');

    const invoiceHeading = isWholesale ? 'WHOLESALE INVOICE' : 'INVOICE';

    // ⭐ 2. Resolve customer outstanding balance and calculate combined total credit due safely
    const prevBalance = Number(order.customer?.outstandingBalance || order.prevBalance || 0);
    const hasOldBill = Boolean(order.customerId || order.customer?.id) && prevBalance > 0;
    // Current bill unpaid credit + previous old bills credit combined
    const isCreditOrder = paymentMethodLabel.includes('CREDIT') || balanceDue > 0;
    const currentBillCredit = isCreditOrder ? (balanceDue > 0 ? balanceDue : total) : 0;
    const grandTotalCreditDue = currentBillCredit + prevBalance;

    // HTML Snippets to prevent nested template literal syntax breaks
    const oldBillSummaryHtml = hasOldBill ? (
      '<tr>' +
        '<td class="label" style="padding-top: 4px; font-weight: bold;">Previous Due (Old Bills)</td>' +
        '<td class="value" style="padding-top: 4px; font-weight: bold;">Rs ' + prevBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 }) + '</td>' +
      '</tr>' +
      '<tr style="border-top: 1.5px solid #000; border-bottom: 2.5px solid #000;">' +
        '<td class="label" style="font-size: 13.5px; font-weight: 900; padding: 6px 0;">Total Accumulated Credit Due</td>' +
        '<td class="value" style="font-size: 14.5px; font-weight: 900; padding: 6px 0;">Rs ' + grandTotalCreditDue.toLocaleString('en-LK', { minimumFractionDigits: 2 }) + '</td>' +
      '</tr>'
    ) : '';

    // 2. Resolve discount label strictly based on chosen discountType
    const discountVal = Number(order.discount || 0);
    const subtotalVal = Number(order.subtotal || 0);
    let discountDisplay = 'Discount:';
    if (discountVal > 0) {
      if (order.discountType === 'PERCENT') {
        const percent = order.discountRate !== undefined 
          ? order.discountRate 
          : (subtotalVal > 0 ? Math.round((discountVal / subtotalVal) * 100) : 0);
        discountDisplay = `Discount (${percent}%):`;
      } else {
        // Flat/Fixed price discount label
        discountDisplay = 'Discount:';
      }
    }

    // Complete Self-Contained A4 Printable Document (Modern Design Matched with Printer Safe Margins)
    const printableDoc = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${invoiceNo}</title>
        <style>
          /* ⭐ Continuous Roll / Tractor Feed: Auto-Height dynamically fitted to bill contents */
          @page {
            size: auto; /* Strips fixed page height so continuous paper feeds only to the end of bill */
            margin: 0mm 8mm 0mm 8mm; /* Zero top/bottom margins kill browser URL/footer and prevent trailing roll feed */
          }
          * {
            box-sizing: border-box;
            color: #000000 !important;
            background: transparent !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            font-size: 11.5px;
            line-height: 1.3;
            height: auto !important; /* Prevents stretching to full A4 page */
          }
          .invoice-container {
            width: 100%;
            max-width: 185mm; /* Safe printable width within 257mm platen limit */
            margin: 0 auto;
            padding: 8mm 0 6mm 0; /* Padding inside bill instead of page margins */
            page-break-after: avoid;
            page-break-inside: avoid;
            break-inside: avoid;
            height: auto !important;
          }
          
          /* Modern Header Layout */
          .header-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .brand-area {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .logo {
            width: 82px;
            height: 82px;
            object-fit: contain;
            filter: grayscale(100%);
            flex-shrink: 0;
          }
          .brand-text-block {
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .brand-name {
            font-size: 32px;
            font-weight: 900;
            letter-spacing: 2px;
            text-transform: uppercase;
            line-height: 1;
            margin: 0;
          }
          .brand-subtitle {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            margin: 3px 0 4px 0;
            color: #111;
          }
          .contact-info {
            font-size: 10.5px;
            color: #222;
            line-height: 1.4;
          }
          .contact-info strong {
            font-weight: bold;
          }
          
          .invoice-title-area {
            text-align: right;
          }
          .invoice-title {
            font-size: 30px;
            font-weight: 300;
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 4px;
            line-height: 1;
          }
          .meta-table {
            margin-left: auto;
            border-collapse: collapse;
          }
          .meta-table td {
            padding: 2px 0 2px 10px;
            font-size: 11.5px;
            text-align: right;
            white-space: nowrap;
          }
          .meta-table td:first-child {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10.5px;
            color: #444;
          }

          /* Divider */
          .main-divider {
            border-top: 1.5px solid #000;
            margin: 8px 0 12px 0;
          }

          /* Customer Info */
          .customer-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 14px;
          }
          .section-title {
            font-size: 10.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1.5px solid #000;
            display: inline-block;
            padding-bottom: 1px;
            margin-bottom: 4px;
          }
          .customer-details {
            font-size: 12px;
            line-height: 1.35;
          }
          .customer-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 2px;
          }

          /* Items Table: Perfectly Balanced Columns & Generous Gaps */
          .items-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          .items-table th {
            border-top: 1.5px solid #000;
            border-bottom: 1.5px solid #000;
            padding: 7px 4px;
            font-size: 10.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .items-table td {
            padding: 7px 4px;
            border-bottom: 1px dashed #bbb;
            font-size: 11.5px;
            vertical-align: top;
            word-wrap: break-word;
          }
          .text-right { text-align: right !important; }
          .text-center { text-align: center !important; }
          .text-left { text-align: left !important; }
          .nowrap { white-space: nowrap !important; }
          .item-desc { font-weight: bold; font-size: 12px; display: block; }
          .item-meta { font-size: 10.5px; color: #444; display: block; margin-top: 2px; }

          /* Summary Box */
          .summary-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 12px;
          }
          .summary-table {
            width: 320px; /* Slightly wider to accommodate dual old bill & net due rows cleanly */
            border-collapse: collapse;
          }
          .summary-table td {
            padding: 3px 0;
            font-size: 11.5px;
          }
          .summary-table .label {
            font-weight: bold;
            color: #000;
          }
          .summary-table .value {
            text-align: right;
            font-size: 12px;
            font-weight: bold;
          }
          .summary-table .total-row td {
            border-top: 1.5px solid #000;
            border-bottom: 2px solid #000;
            font-size: 14.5px;
            font-weight: 900;
            padding: 5px 0;
          }
          .summary-table .total-row .value {
            font-size: 15.5px;
            font-weight: 900;
          }
          .summary-table .cumulative-row td {
            border-top: 1px dashed #000;
            border-bottom: 1.5px solid #000;
            font-weight: 900;
            padding: 5px 0;
            font-size: 12.5px;
          }

          /* ⭐ Signatures: Expanded by an additional ~1 inch (110px) to give ample room for stamps and physical signatures */
          .signatures {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-top: 110px; /* Increased to 110px (+50px extra gap) */
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .sig-line {
            border-top: 1.2px solid #000;
            text-align: center;
            padding-top: 5px;
            font-size: 9.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* Footer - Compact for Roll Paper */
          .footer {
            text-align: center;
            margin-top: 14px;
            border-top: 1.2px solid #000;
            padding-top: 6px;
            padding-bottom: 2mm; /* Clean stop point for paper tear-off */
          }
          .footer-thanks {
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 2px;
          }
          .footer-policy {
            font-size: 10px;
            color: #222;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          
          <!-- Modern Header with Logo and Brand Details -->
          <div class="header-section">
            <div class="brand-area">
              <img src="/images/logo.jpg" alt="Logo" class="logo" />
              <div class="brand-text-block">
                <h1 class="brand-name">RELIANCE</h1>
                <div class="brand-subtitle">BRANDED MENS CLOTHING</div>
                <div class="contact-info">
                  Mawarala Road, Makandura, Matara.<br/>
                  <strong>Tel:</strong> 041-2268739, 071-1350123<br/>
                  <strong>Web:</strong> relianceclothing.lk
                </div>
              </div>
            </div>
            
            <!-- Header Invoice Details with Dynamic Wholesale Mode Flag -->
            <div class="invoice-title-area">
              <div class="invoice-title" style="${isWholesale ? 'font-size: 22px; font-weight: 800;' : ''}">
                ${invoiceHeading}
              </div>
              <table class="meta-table">
                <tr>
                  <td>Invoice No:</td>
                  <td style="font-weight: 900; font-size: 13px;">${invoiceNo}</td>
                </tr>
                <tr>
                  <td>Date:</td>
                  <td>${dateStr}</td>
                </tr>
                ${isWholesale ? `
                <tr>
                  <td>Billing Type:</td>
                  <td style="font-weight: bold; text-transform: uppercase;">Wholesale</td>
                </tr>
                ` : ''}
              </table>
            </div>
          </div>

          <div class="main-divider"></div>

          <!-- Customer Info -->
          <div class="customer-box">
            <div>
              <div class="section-title">Billed To</div>
              <div class="customer-details">
                <div class="customer-name">${order.customerName || order.customer?.name || 'Walk-in Customer'}</div>
                ${(order.customer?.address || order.shippingAddress) ? `
                  <div>${order.customer?.address || order.shippingAddress}</div>
                ` : ''}
                <div style="margin-top: 2px;"><strong>Contact:</strong> ${order.customerPhone || order.customer?.phone || '-'}</div>
              </div>
            </div>
          </div>

          <!-- Items Table: 100% Balanced Column Proportions -->
          <table class="items-table">
            <thead>
              <tr>
                <th class="text-center nowrap" style="width: 5%;">#</th>
                <th class="text-left nowrap" style="width: 17%;">Style No</th>
                <th class="text-left" style="width: 38%;">Item Description</th>
                <th class="text-right nowrap" style="width: 16%; padding-right: 18px;">Unit Price</th>
                <th class="text-center nowrap" style="width: 8%;">Qty</th>
                <th class="text-right nowrap" style="width: 16%; padding-right: 4px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || []).map((item: any, idx: number) => {
                const styleNo = item.variant?.sku || item.variant?.styleNo || `STY-${String(idx + 1).padStart(3, '0')}`;
                return `
                <tr>
                  <td class="text-center font-bold" style="color: #555;">${idx + 1}</td>
                  <td class="font-bold nowrap text-left">${styleNo}</td>
                  <td class="text-left">
                    <span class="item-desc">${item.variant?.product?.name || 'Garment Item'}</span>
                    ${item.variant?.size || item.variant?.color ? `
                      <span class="item-meta">Size: ${item.variant?.size || 'FREE'} | Color: ${item.variant?.color || 'Default'}</span>
                    ` : ''}
                  </td>
                  <td class="text-right nowrap" style="padding-right: 18px;">Rs ${Number(item.unitPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                  <td class="text-center nowrap font-bold">${item.quantity}</td>
                  <td class="text-right nowrap font-bold" style="padding-right: 4px;">Rs ${Number(item.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>

          <!-- Financial Summary Section with Cumulative Previous Outstanding -->
          <div class="summary-container">
            <table class="summary-table">
              <tr>
                <td class="label">Sub Total</td>
                <td class="value">Rs ${Number(order.subtotal).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
              </tr>
              ${discountVal > 0 ? `
              <tr>
                <td class="label">${discountDisplay}</td>
                <td class="value">- Rs ${discountVal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              <!-- Current Invoice Total -->
              <tr class="total-row">
                <td class="label">Total Due (Current Bill)</td>
                <td class="value">Rs ${total.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
              </tr>

              <!-- පාරිභෝගිකයා අත්පිට මුදලක් ගෙවූ විට පමණක් Customer Tendered පෙන්වීම (Credit බිල් වලදී Rs 0.00 නොපෙන්වයි) -->
              ${tendered > 0 ? (
                '<tr>' +
                  '<td class="label" style="padding-top: 6px;">Customer Tendered (' + paymentMethodLabel + ')</td>' +
                  '<td class="value" style="padding-top: 6px;">Rs ' + tendered.toLocaleString('en-LK', { minimumFractionDigits: 2 }) + '</td>' +
                '</tr>'
              ) : ''}

              <!-- Change Returned if customer overpaid -->
              ${change > 0 ? (
                '<tr>' +
                  '<td class="label">Change</td>' +
                  '<td class="value">Rs ' + change.toLocaleString('en-LK', { minimumFractionDigits: 2 }) + '</td>' +
                '</tr>'
              ) : ''}

              <!-- අත්පිට මුදලක් කොටසක් ගෙවා ඉතිරිය Credit වූ විට පමණක් Bill Balance Due පෙන්වීම -->
              ${balanceDue > 0 && tendered > 0 ? (
                '<tr>' +
                  '<td class="label">Bill Balance Due</td>' +
                  '<td class="value">Rs ' + balanceDue.toLocaleString('en-LK', { minimumFractionDigits: 2 }) + '</td>' +
                '</tr>'
              ) : ''}

              <!-- ⭐ Previous Due & Total Accumulated Credit (Current Bill Credit + Old Bills) -->
              ${oldBillSummaryHtml}
            </table>
          </div>

          <!-- Minimalist Signatures Block -->
          <div class="signatures">
            <div class="sig-line">Customer</div>
            <div class="sig-line">Marketing Officer</div>
            <div class="sig-line">Delivery</div>
            <div class="sig-line">Authorized</div>
          </div>

          <!-- Footer Area -->
          <div class="footer">
            <div class="footer-thanks">Thank you for your business</div>
            <div class="footer-policy">Returns and exchanges are valid only for 7 days with original invoice.</div>
          </div>
          
        </div>
      </body>
      </html>
    `;

    // Create invisible print sandbox iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      onClose();
      return;
    }

    doc.open();
    doc.write(printableDoc);
    doc.close();

    // Capture the current title so it can be restored once the print dialog closes.
    // Chrome's "Save as PDF" default filename is derived from the top-level
    // document title at the moment print() fires, so both the iframe document
    // and the parent window must reflect the desired invoice filename.
    const originalTitle = document.title;
    const suggestedFileName = `Invoice-${invoiceNo}`;
    document.title = suggestedFileName;
    if (doc) {
      doc.title = suggestedFileName;
    }

    // Restore the original title once the print dialog has closed (or been cancelled)
    const restoreTitle = () => {
      document.title = originalTitle;
    };
    iframe.contentWindow?.addEventListener('afterprint', restoreTitle);

    // Trigger print safely once content is completely written (Single-Execution)
    iframe.contentWindow?.focus();
    const printTimer = setTimeout(() => {
      iframe.contentWindow?.print();

      // Remove temporary iframe after printing dialog is closed
      const cleanupTimer = setTimeout(() => {
        restoreTitle();
        iframe.contentWindow?.removeEventListener('afterprint', restoreTitle);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        isPrintingRef.current = false;
        onClose();
      }, 500);

      return () => clearTimeout(cleanupTimer);
    }, 250);

    return () => {
      clearTimeout(printTimer);
      restoreTitle();
      iframe.contentWindow?.removeEventListener('afterprint', restoreTitle);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      isPrintingRef.current = false;
    };
  }, [open, autoPrint, order?.id]); // Track only order id to avoid loop on parent state updates

  return null; // Headless (No DOM footprint on terminal screen)
};