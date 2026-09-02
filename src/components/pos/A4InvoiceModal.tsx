import React, { useEffect } from 'react';

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
  useEffect(() => {
    if (!open || !order || !autoPrint) return;

    const invoiceNo = `INV${order.id || String(Date.now()).slice(-4)}`;
    const dateStr = order.createdAt
      ? new Date(order.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const paid = Number(order.paidAmount || 0);
    const total = Number(order.totalAmount || 0);
    const change = Math.max(0, paid - total);
    const balanceDue = Math.max(0, total - paid);

    // Build isolated rows HTML
    const itemsHtml = (order.items || [])
      .map(
        (item: any, i: number) => `
        <tr style="border-bottom: 1px solid #000000;">
          <td style="border-right: 1px solid #000000; padding: 6px 8px; font-weight: 500;">
            ${item.variant?.product?.name || 'Garment Item'}
            ${
              item.variant?.size || item.variant?.color
                ? `<span style="display: block; font-size: 10px; color: #000000;">(${item.variant?.size || 'FREE'} / ${item.variant?.color || 'Default'})</span>`
                : ''
            }
          </td>
          <td style="border-right: 1px solid #000000; padding: 6px 8px; text-align: center; font-family: monospace;">
            Rs: ${Number(item.unitPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </td>
          <td style="border-right: 1px solid #000000; padding: 6px 8px; text-align: center; font-weight: bold;">
            ${item.quantity}
          </td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 600;">
            Rs: ${Number(item.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </td>
        </tr>`
      )
      .join('');

    const discountRow =
      Number(order.discount || 0) > 0
        ? `<tr style="border-bottom: 1px solid #000000;">
            <td style="padding: 4px 6px; font-weight: bold; border-right: 1px solid #000000;">Discount:</td>
            <td style="padding: 4px 6px; text-align: right; font-family: monospace;">- Rs: ${Number(order.discount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
          </tr>`
        : '';

    // Complete Self-Contained A4 Printable Document
    const printableDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${invoiceNo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          * {
            box-sizing: border-box;
            color: #000000 !important;
            border-color: #000000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            font-size: 11px;
            line-height: 1.3;
          }
          .invoice-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            page-break-after: avoid;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px;">
              <img src="/images/logo.jpeg" alt="Logo" style="height: 36px; width: auto; object-contain: contain;" />
              <span style="font-size: 22px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">RELIANCE</span>
            </div>
            <div style="font-size: 11px;">Mawarala Road, Makandura, Matara</div>
            <div style="font-size: 11px; font-weight: 600;">Tel: 041-2268739, 071-1350123</div>
          </div>

          <div style="width: 100%; height: 1.5px; background: #000000; margin: 8px 0 14px 0;"></div>

          <!-- Customer & Invoice Info -->
          <table style="margin-bottom: 14px;">
            <tr>
              <td style="vertical-align: top; width: 60%;">
                <div style="border: 1px solid #000000; padding: 8px; width: 280px; font-size: 11px;">
                  <div><strong>Customer Name:</strong> ${order.customerName || 'Walk-in Customer'}</div>
                  <div style="margin-top: 2px;"><strong>Date:</strong> ${dateStr}</div>
                  <div style="margin-top: 2px;"><strong>Address:</strong> ${order.customer?.address || order.shippingAddress || '-'}</div>
                  <div style="margin-top: 2px;"><strong>Contact No:</strong> ${order.customerPhone || order.customer?.phone || '-'}</div>
                </div>
              </td>
              <td style="vertical-align: top; text-align: right; width: 40%;">
                <div style="font-size: 13px; font-weight: bold;">Invoice No: <span style="font-family: monospace; font-size: 15px;">${invoiceNo}</span></div>
                <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; margin-top: 4px;">Mode: ${order.source === 'POS_WHOLESALE' ? 'Wholesale' : 'Retail'}</div>
              </td>
            </tr>
          </table>

          <!-- Line Items Table -->
          <table style="border: 1px solid #000000; margin-bottom: 12px; font-size: 11px;">
            <thead>
              <tr style="border-bottom: 1px solid #000000; font-weight: bold;">
                <th style="border-right: 1px solid #000000; padding: 6px 8px; text-align: left;">Item Description</th>
                <th style="border-right: 1px solid #000000; padding: 6px 8px; text-align: center; width: 110px;">Unit Price</th>
                <th style="border-right: 1px solid #000000; padding: 6px 8px; text-align: center; width: 60px;">Qty</th>
                <th style="padding: 6px 8px; text-align: right; width: 120px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="border-top: 1px solid #000000; font-weight: bold;">
                <td colspan="3" style="border-right: 1px solid #000000; padding: 5px 8px; text-align: right; text-transform: uppercase;">Old Bill</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace;">Rs: 0.00</td>
              </tr>
            </tbody>
          </table>

          <!-- Summary Box -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
            <table style="border: 1px solid #000000; width: 250px; font-size: 11px;">
              <tr style="border-bottom: 1px solid #000000;">
                <td style="padding: 4px 6px; font-weight: bold; border-right: 1px solid #000000; width: 100px;">Sub Total:</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace; font-weight: 600;">Rs: ${Number(order.subtotal).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
              </tr>
              ${discountRow}
              <tr style="border-bottom: 1px solid #000000; font-weight: bold; font-size: 12px;">
                <td style="padding: 4px 6px; border-right: 1px solid #000000;">Total:</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace;">Rs: ${Number(order.totalAmount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="border-bottom: 1px solid #000000;">
                <td style="padding: 4px 6px; font-weight: bold; border-right: 1px solid #000000;">Cash:</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace;">Rs: ${paid.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="border-bottom: 1px solid #000000;">
                <td style="padding: 4px 6px; font-weight: bold; border-right: 1px solid #000000;">Change:</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace; font-weight: 600;">Rs: ${change.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="font-weight: bold;">
                <td style="padding: 4px 6px; border-right: 1px solid #000000;">Balance:</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace;">Rs: ${balanceDue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>

          <!-- Signature Lines -->
          <table style="margin-top: 24px; text-align: center; font-size: 10px;">
            <tr>
              <td style="width: 25%; padding: 0 8px;">
                <div style="border-bottom: 1px dotted #000000; margin-bottom: 4px;">&nbsp;</div>
                <div style="font-weight: 600;">Customer Signature</div>
              </td>
              <td style="width: 25%; padding: 0 8px;">
                <div style="border-bottom: 1px dotted #000000; margin-bottom: 4px;">&nbsp;</div>
                <div style="font-weight: 600;">Marketing Officer</div>
              </td>
              <td style="width: 25%; padding: 0 8px;">
                <div style="border-bottom: 1px dotted #000000; margin-bottom: 4px;">&nbsp;</div>
                <div style="font-weight: 600;">Delivery</div>
              </td>
              <td style="width: 25%; padding: 0 8px;">
                <div style="border-bottom: 1px dotted #000000; margin-bottom: 4px;">&nbsp;</div>
                <div style="font-weight: 600;">Authorize Signature</div>
              </td>
            </tr>
          </table>

          <!-- Footer Policy -->
          <div style="text-align: center; font-size: 10px; margin-top: 20px;">
            <div>Returns are valid only for 7 days</div>
            <div style="font-weight: bold; font-size: 11px; margin-top: 3px;">Thank you for your business</div>
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

    // Trigger print safely once content is completely written
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Remove temporary iframe after printing dialog is closed
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        onClose();
      }, 500);
    }, 250);
  }, [open, autoPrint, order, onClose]);

  return null; // Headless (No DOM footprint on terminal screen)
};