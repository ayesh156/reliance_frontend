export interface ThermalOrderItem {
  id?: number | string;
  name?: string;
  title?: string;
  size?: string;
  color?: string;
  selectedSize?: string;
  selectedColor?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  unitPrice?: number;
  wholesalePrice?: number;
  discount?: number;
  discountType?: 'FIXED' | 'PERCENT' | string;
  discountInput?: number | string;
  discountAmount?: number;
  variant?: {
    size?: string;
    color?: string;
  };
  product?: {
    name?: string;
  };
}

export interface ThermalCustomer {
  id?: number;
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  outstandingBalance?: number;
}

export interface ThermalOrder {
  id?: number | string;
  createdAt?: string | Date;
  totalAmount?: number;
  paidAmount?: number;
  tenderedAmount?: number;
  subtotal?: number;
  discount?: number;
  discountAmount?: number;
  discountType?: 'FIXED' | 'PERCENT' | string;
  discountInput?: number | string;
  customerName?: string;
  customerPhone?: string;
  userName?: string;
  user?: {
    name?: string;
  };
  customer?: ThermalCustomer;
  items?: ThermalOrderItem[];
}

/**
 * Formats a numeric price/amount for 80mm thermal receipts.
 * Strips trailing `.00` on whole numbers (e.g., 2890 instead of 2890.00),
 * rendering two decimal places only when fractional cents exist (e.g., 2890.50).
 */
export const formatReceiptPrice = (val: number | string | null | undefined): string => {
  const num = Number(val || 0);
  if (isNaN(num)) return '0';
  if (num % 1 === 0) {
    return num.toLocaleString('en-US');
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Formats line-item or order discount representation for thermal receipt.
 * Appends '%' sign if percentage discount (e.g., "5%"), formats flat numbers via formatReceiptPrice,
 * or displays '-' if zero.
 */
export const formatReceiptDiscount = (
  discountAmt?: number,
  discountType?: string,
  discountInput?: number | string
): string => {
  const isPercent =
    discountType?.toUpperCase() === 'PERCENT' ||
    String(discountInput || '').endsWith('%');

  if (isPercent) {
    const rawPct = typeof discountInput === 'string' ? discountInput.replace('%', '').trim() : discountInput;
    const pct = Number(rawPct);
    if (!isNaN(pct) && pct > 0) {
      return `${pct % 1 === 0 ? pct : pct.toFixed(1)}%`;
    }
  }

  const amt = Number(discountAmt ?? discountInput ?? 0);
  return amt > 0 ? formatReceiptPrice(amt) : '-';
};

/**
 * Standalone HTML Generator for 80mm POS Thermal Receipt (X-Printer Format).
 * Used for headless iframe printing without intermediate modal popups.
 */
export const generate80mmThermalReceiptHtml = (
  order: ThermalOrder | null | undefined,
  matchedCustomer?: any,
  allCustomers?: any[]
): string => {
  if (!order) return '';

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

  const isReturnBill = Boolean((order as any).isReturnBill || total < 0);
  const foundCustFromStore = Array.isArray(allCustomers) && ((order as any)?.customerId || order?.customer?.id)
    ? allCustomers.find((c) => Number(c.id) === Number((order as any)?.customerId || order?.customer?.id))
    : null;
  const liveCustRecord = foundCustFromStore || matchedCustomer || (order as any).matchedCustomer;

  const rawOrderCustBal = order.customer?.outstandingBalance !== undefined ? Number(order.customer.outstandingBalance) : null;
  const rawLiveCustBal = liveCustRecord?.outstandingBalance !== undefined ? Number(liveCustRecord.outstandingBalance) : null;

  let authoritativeCustomerBalance = 0;
  if (isReturnBill) {
    if (rawLiveCustBal !== null && rawOrderCustBal !== null && rawLiveCustBal > rawOrderCustBal) {
      authoritativeCustomerBalance = rawLiveCustBal;
    } else if (rawOrderCustBal !== null) {
      authoritativeCustomerBalance = rawOrderCustBal;
    } else if (rawLiveCustBal !== null) {
      authoritativeCustomerBalance = rawLiveCustBal;
    }
  } else {
    authoritativeCustomerBalance = Number(order.customer?.outstandingBalance ?? liveCustRecord?.outstandingBalance ?? 0);
  }

  const creditApplied = Math.abs(total) - Number((order as any).refundedCashAmount || 0);
  const updatedBalance = Number(authoritativeCustomerBalance || 0);
  const prevDue = updatedBalance + creditApplied;

  const customerName = order.customer?.name || order.customerName || 'Walk-in Customer';
  const customerPhone = order.customer?.phone || order.customerPhone || '';
  const customerAddress = order.customer?.address || '';
  const salesRepName = order.user?.name || order.userName || '';

  // Items resolution: Dynamic product names, wholesale rates, and explicit line item discounts
  const items = (order.items || []).map((it: any) => {
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

  const totalItemDiscounts = items.reduce((acc, it) => acc + (Number(it.discount) || 0), 0);
  const computedSubtotal = items.reduce((acc, it) => acc + (it.rate * it.qty), 0) || Number(order.subtotal || (total + totalItemDiscounts + billDiscountAmount) || 0);

  const itemsRows = items
    .map(
      (it) => `
      <tr>
        <td colspan="4" style="text-align: left; padding-top: 4px; padding-bottom: 1px; font-weight: 700; font-size: 10.5px; word-break: break-word;">
          ${it.name}
          ${it.variantDesc ? `<span style="font-size: 9px; font-weight: 400; opacity: 0.85; margin-left: 4px;">(${it.variantDesc})</span>` : ''}
        </td>
      </tr>
      <tr style="border-bottom: 1px dotted #ccc;">
        <td style="text-align: left; padding-bottom: 4px; font-size: 10px; font-weight: 600;">
          ${it.qty}
        </td>
        <td style="text-align: center; padding-bottom: 4px; font-size: 10px;">
          ${formatReceiptDiscount(it.discount, it.discountType, it.discountInput)}
        </td>
        <td style="text-align: right; padding-bottom: 4px; font-size: 10px;">
          ${formatReceiptPrice(it.rate)}
        </td>
        <td style="text-align: right; padding-bottom: 4px; font-weight: 700; font-size: 10px;">
          ${formatReceiptPrice(it.amount)}
        </td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt-${invoiceNo}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 3mm 4mm;
      width: 80mm;
      max-width: 80mm;
      font-family: 'Courier New', Courier, monospace, system-ui;
      font-size: 10.5px;
      line-height: 1.25;
      color: #000;
      background-color: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .dashed { border-top: 1px dashed #000; margin: 4px 0; }
    .solid { border-top: 1px solid #000; margin: 4px 0; }
    .flex-between { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 2px 0; }
    th { border-bottom: 1px dashed #000; padding-bottom: 3px; font-size: 9.5px; }
  </style>
</head>
<body>
  <!-- Header: Graphic RELIANCE Logo & Brand Typography -->
  <div class="text-center" style="margin-bottom: 5px;">
    <img src="/images/logo.jpg" alt="RELIANCE" style="width: 48px; height: 48px; object-fit: contain; margin: 0 auto 3px auto; display: block;" />
    <h1 style="font-size: 18px; font-weight: 900; letter-spacing: 2px; margin: 0 0 2px 0; text-transform: uppercase;">
      RELIANCE
    </h1>
    <div style="font-size: 10.5px; font-weight: 700; letter-spacing: 0.5px;">
      WHOLESALE INVOICE
    </div>
  </div>

  <div class="dashed"></div>

  <!-- Meta Information -->
  <div style="font-size: 10px; line-height: 1.3;">
    <div class="flex-between">
      <span>Invoice No:</span>
      <span style="font-weight: 700;">${invoiceNo}</span>
    </div>
    <div class="flex-between">
      <span>Date:</span>
      <span>${dateStr}</span>
    </div>
    ${salesRepName ? `<div class="flex-between"><span>Sales Rep:</span><span style="font-weight: 600;">${salesRepName}</span></div>` : ''}
    <div class="flex-between">
      <span>Customer:</span>
      <span style="font-weight: 700;">${customerName}</span>
    </div>
    ${customerPhone ? `<div class="flex-between"><span>Phone:</span><span>${customerPhone}</span></div>` : ''}
    ${customerAddress ? `<div class="flex-between"><span>Address:</span><span style="text-align: right; max-width: 60%;">${customerAddress}</span></div>` : ''}
  </div>

  <div class="dashed"></div>

  <!-- Table: Line 1 = Product Name, Line 2 = Qty, Discount, Price(Rs.), Amount(Rs.) -->
  <table>
    <thead>
      <tr>
        <th style="text-align: left; width: 15%;">Qty</th>
        <th style="text-align: center; width: 23%;">Discount</th>
        <th style="text-align: right; width: 31%;">Price(Rs.)</th>
        <th style="text-align: right; width: 31%;">Amount(Rs.)</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="dashed"></div>

  <!-- Financial Summary: Subtotal, Discount Separation, Total Due -->
  <div style="font-size: 10.5px; line-height: 1.35;">
    ${isReturnBill ? `
    <div class="flex-between" style="font-size: 12px; font-weight: 800; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 3px 0;">
      <span>TOTAL RETURN VALUE:</span>
      <span>Rs. ${formatReceiptPrice(Math.abs(total))}</span>
    </div>
    <div class="flex-between">
      <span>Previous Due (Before Return):</span>
      <span>Rs. ${formatReceiptPrice(prevDue)}</span>
    </div>
    <div class="flex-between" style="color: #059669; font-weight: 600;">
      <span>Deducted from Previous Due:</span>
      <span>- Rs. ${formatReceiptPrice(creditApplied)}</span>
    </div>
    ${Number((order as any).refundedCashAmount || 0) > 0 ? `
    <div class="flex-between">
      <span>Cash Refunded:</span>
      <span>Rs. ${formatReceiptPrice(Number((order as any).refundedCashAmount || 0))}</span>
    </div>` : ''}
    <div class="flex-between" style="font-weight: 800; border-top: 1px dashed #000; padding-top: 2px; margin-top: 2px;">
      <span>UPDATED OUTSTANDING:</span>
      <span>Rs. ${formatReceiptPrice(updatedBalance)}</span>
    </div>
    ` : `
    <div class="flex-between">
      <span>Subtotal:</span>
      <span>Rs. ${formatReceiptPrice(computedSubtotal)}</span>
    </div>
    ${
      totalItemDiscounts > 0
        ? `<div class="flex-between" style="font-weight: 600;">
            <span>Item Total Discount:</span>
            <span>- Rs. ${formatReceiptPrice(totalItemDiscounts)}</span>
          </div>`
        : ''
    }
    ${
      billDiscountAmount > 0
        ? `<div class="flex-between" style="font-weight: 600;">
            <span>Bill Discount:</span>
            <span>- Rs. ${formatReceiptPrice(billDiscountAmount)}</span>
          </div>`
        : ''
    }
    <div class="flex-between" style="font-size: 12px; font-weight: 800; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 3px 0;">
      <span>TOTAL DUE:</span>
      <span>Rs. ${formatReceiptPrice(total)}</span>
    </div>
    ${
      paidAmount > 0
        ? `<div class="flex-between">
            <span>Paid Amount:</span>
            <span>Rs. ${formatReceiptPrice(paidAmount)}</span>
          </div>`
        : ''
    }
    ${
      due > 0
        ? `<div class="flex-between" style="font-weight: 700;">
            <span>Balance Due:</span>
            <span>Rs. ${formatReceiptPrice(due)}</span>
          </div>`
        : ''
    }
    `}
  </div>

  <div class="dashed"></div>

  <!-- English Clean Footer with Software Credit -->
  <div class="text-center" style="font-size: 9.5px; margin-top: 5px;">
    <div style="font-weight: 600;">Thank you for your business!</div>
    <div style="opacity: 0.85; margin-top: 2px; font-weight: 600;">Software by nebula infinite 078 323 3760</div>
  </div>
</body>
</html>`;
};
