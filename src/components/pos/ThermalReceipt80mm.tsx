import React from 'react';
import {
  type ThermalOrder,
  formatReceiptPrice,
  formatReceiptDiscount,
} from '../../utils/thermalReceipt';

export interface ThermalReceipt80mmProps {
  order: ThermalOrder | null | undefined;
}

/**
 * Technical Specification for 80mm Thermal Receipt (POS Print Layout):
 * Optimized for standard 80mm POS receipt printers (ESC/POS, X-Printer XP-series).
 *
 * Requirements:
 * - Header: Graphic "RELIANCE" logo at top
 * - Content: Strictly in English
 * - Prices: Strictly Wholesale Prices, formatted without redundant trailing .00
 * - Table Columns: Qty, Discount, Price(Rs.), Amount(Rs.)
 * - Summary: Subtotal, Item Total Discount, Bill Discount, Total Due
 * - Footer: "Software by nebula infinite 078 323 3760" directly below thank you note
 * - Standard paper width: 80mm (effective printable area: 72mm / 288-300 dots)
 */
export const ThermalReceipt80mm: React.FC<ThermalReceipt80mmProps> = ({ order }) => {
  if (!order) return null;

  const invoiceNo = order.id ? `INV${order.id}` : 'INV-DRAFT';
  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const total = Number(order.totalAmount || 0);
  const paidAmount = Number(order.paidAmount || 0);
  const billDiscountAmount = Number(order.discountAmount ?? order.discount ?? 0);
  const due = Math.max(0, total - paidAmount);

  // Customer details resolution
  const customerName = order.customer?.name || order.customerName || 'Walk-in Customer';
  const customerPhone = order.customer?.phone || order.customerPhone || '';
  const customerAddress = order.customer?.address || '';
  const salesRepName = order.user?.name || order.userName || '';

  // Items resolution: Dynamic product names, wholesale rates, and explicit line item discounts
  const items = (order.items || []).map((it: any) => {
    // Dynamic product name extraction with robust fallbacks
    const name =
      it.product?.name ||
      it.variant?.product?.name ||
      it.productName ||
      it.name ||
      it.title ||
      'Item';

    const size = it.size || it.selectedSize || it.variant?.size || '';
    const color = it.color || it.selectedColor || it.variant?.color || '';
    const variantDesc = [size, color].filter(Boolean).join(' / ');
    const qty = Number(it.quantity || it.qty || 1);
    const discount = Number(it.discountAmount ?? it.discount ?? 0);
    const discountType = it.discountType || (String(it.discountInput || '').endsWith('%') ? 'PERCENT' : 'FIXED');
    const discountInput = it.discountInput;

    // Strictly wholesale rate (prefer explicit wholesalePrice or unitPrice)
    const rate = Number(it.wholesalePrice || it.unitPrice || (it.price ? (Number(it.price) + discount) / qty : 0));
    const amount = Number(it.price !== undefined ? it.price : (rate * qty) - discount);

    return {
      name,
      variantDesc,
      qty,
      rate,
      discount,
      discountType,
      discountInput,
      amount,
    };
  });

  // Calculate cumulative discounts across line items and overall invoice
  const totalItemDiscounts = items.reduce((acc, it) => acc + (Number(it.discount) || 0), 0);
  const subtotal = items.reduce((acc, it) => acc + (it.rate * it.qty), 0) || Number(order.subtotal || (total + totalItemDiscounts + billDiscountAmount) || 0);

  return (
    <div
      id="printable-receipt"
      className="hidden print:block font-mono text-black bg-white"
      style={{
        width: '80mm',
        maxWidth: '80mm',
        margin: '0 auto',
        padding: '3mm 4mm',
        fontSize: '11px',
        lineHeight: '1.25',
        color: '#000',
        backgroundColor: '#fff',
      }}
    >
      {/* 80mm Thermal Receipt Header with Graphic Logo */}
      <div style={{ textAlign: 'center', marginBottom: '5px' }}>
        <img
          src="/images/logo.jpg"
          alt="RELIANCE"
          style={{ width: '48px', height: '48px', objectFit: 'contain', margin: '0 auto 3px auto', display: 'block' }}
        />
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 900,
            letterSpacing: '2px',
            margin: '0 0 2px 0',
            textTransform: 'uppercase',
          }}
        >
          RELIANCE
        </h1>
        <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px' }}>
          WHOLESALE INVOICE
        </div>
      </div>

      {/* Dashed Separator */}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Invoice & Customer Meta Information */}
      <div style={{ fontSize: '10px', marginBottom: '4px', lineHeight: '1.3' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Invoice No:</span>
          <span style={{ fontWeight: 700 }}>{invoiceNo}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date:</span>
          <span>{dateStr}</span>
        </div>
        {salesRepName ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Sales Rep:</span>
            <span style={{ fontWeight: 600 }}>{salesRepName}</span>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Customer:</span>
          <span style={{ fontWeight: 700 }}>{customerName}</span>
        </div>
        {customerPhone ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Phone:</span>
            <span>{customerPhone}</span>
          </div>
        ) : null}
        {customerAddress ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Address:</span>
            <span style={{ textAlign: 'right', maxWidth: '60%' }}>{customerAddress}</span>
          </div>
        ) : null}
      </div>

      {/* Dashed Separator */}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Itemized Table Header: Line 1 = Product Name, Line 2 = Qty, Discount, Price(Rs.), Amount(Rs.) */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '10px',
          margin: '2px 0',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px dashed #000', fontSize: '9.5px' }}>
            <th style={{ textAlign: 'left', paddingBottom: '3px', width: '15%' }}>Qty</th>
            <th style={{ textAlign: 'center', paddingBottom: '3px', width: '23%' }}>Discount</th>
            <th style={{ textAlign: 'right', paddingBottom: '3px', width: '31%' }}>Price(Rs.)</th>
            <th style={{ textAlign: 'right', paddingBottom: '3px', width: '31%' }}>Amount(Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <React.Fragment key={idx}>
              {/* First Line: Product Name and Variant */}
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: 'left',
                    paddingTop: '4px',
                    paddingBottom: '1px',
                    fontWeight: 700,
                    fontSize: '10.5px',
                    wordBreak: 'break-word',
                  }}
                >
                  {it.name}
                  {it.variantDesc ? (
                    <span style={{ fontSize: '9px', fontWeight: 400, opacity: 0.85, marginLeft: '4px' }}>
                      ({it.variantDesc})
                    </span>
                  ) : null}
                </td>
              </tr>
              {/* Next Line: Qty, Discount, Price(Rs.), Amount(Rs.) */}
              <tr style={{ borderBottom: '1px dotted #ccc' }}>
                <td style={{ textAlign: 'left', paddingBottom: '4px', fontSize: '10px', fontWeight: 600 }}>
                  {it.qty}
                </td>
                <td style={{ textAlign: 'center', paddingBottom: '4px', fontSize: '10px' }}>
                  {formatReceiptDiscount(it.discount, it.discountType, it.discountInput)}
                </td>
                <td style={{ textAlign: 'right', paddingBottom: '4px', fontSize: '10px' }}>
                  {formatReceiptPrice(it.rate)}
                </td>
                <td style={{ textAlign: 'right', paddingBottom: '4px', fontWeight: 700, fontSize: '10px' }}>
                  {formatReceiptPrice(it.amount)}
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Dashed Separator */}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* Financial Totals Breakdown: Subtotal, Item Total Discount, Bill Discount, Total Due */}
      <div style={{ fontSize: '10.5px', lineHeight: '1.35', marginTop: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span>
          <span>Rs. {formatReceiptPrice(subtotal)}</span>
        </div>

        {/* Item Total Discount Row */}
        {totalItemDiscounts > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Item Total Discount:</span>
            <span>{`- Rs. ${formatReceiptPrice(totalItemDiscounts)}`}</span>
          </div>
        ) : null}

        {/* Bill Discount Row */}
        {billDiscountAmount > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Bill Discount:</span>
            <span>{`- Rs. ${formatReceiptPrice(billDiscountAmount)}`}</span>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            fontWeight: 800,
            borderTop: '1px solid #000',
            borderBottom: '1px solid #000',
            padding: '3px 0',
            margin: '3px 0',
          }}
        >
          <span>TOTAL DUE:</span>
          <span>Rs. {formatReceiptPrice(total)}</span>
        </div>

        {paidAmount > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Paid Amount:</span>
            <span>Rs. {formatReceiptPrice(paidAmount)}</span>
          </div>
        ) : null}

        {due > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Balance Due:</span>
            <span>Rs. {formatReceiptPrice(due)}</span>
          </div>
        ) : null}
      </div>

      {/* Dashed Separator */}
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0 4px 0' }} />

      {/* English Clean Footer with Software Credit */}
      <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '4px' }}>
        <div style={{ fontWeight: 600 }}>Thank you for your business!</div>
        <div style={{ opacity: 0.85, marginTop: '2px', fontWeight: 600 }}>Software by nebula infinite 078 323 3760</div>
      </div>
    </div>
  );
};
