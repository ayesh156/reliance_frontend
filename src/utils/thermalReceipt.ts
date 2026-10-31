import JsBarcode from 'jsbarcode';

export interface ThermalOrderItem {
  id?: number | string;
  name?: string;
  title?: string;
  productName?: string;
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
  isReturn?: boolean;
  returnReason?: string;
  variant?: {
    size?: string;
    color?: string;
    product?: {
      name?: string;
    };
  };
  product?: {
    name?: string;
  };
}

export interface ThermalCustomer {
  id?: number | string;
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  outstandingBalance?: number;
}

export interface ThermalPaymentEntry {
  method?: string;
  amount?: number;
  reference?: string;
  chequeNumber?: string;
  bankName?: string;
  notes?: string;
  date?: string | Date;
  createdAt?: string | Date;
  paymentDate?: string | Date;
}

export interface ThermalOrder {
  id?: number | string;
  invoiceNumber?: string;
  orderNumber?: string;
  createdAt?: string | Date;
  totalAmount?: number;
  paidAmount?: number;
  tenderedAmount?: number;
  settledDueAmount?: number;
  refundedCashAmount?: number;
  subtotal?: number;
  discount?: number;
  discountAmount?: number;
  discountType?: 'FIXED' | 'PERCENT' | string;
  discountInput?: number | string;
  discountRate?: number;
  discountValue?: number;
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;
  customerAddress?: string;
  userName?: string;
  repName?: string;
  orderType?: 'WHOLESALE' | 'RETAIL' | string;
  source?: string;
  paymentMethod?: string;
  isReturnBill?: boolean;
  isReturnOrder?: boolean;
  user?: {
    id?: number;
    name?: string;
  };
  customer?: ThermalCustomer;
  items?: ThermalOrderItem[];
  payments?: ThermalPaymentEntry[];
  splitPayments?: ThermalPaymentEntry[];
  cheques?: any[];
  matchedCustomer?: any;
}

/**
 * Formats a numeric price/amount for 80mm thermal receipts.
 * Strips trailing `.00` on whole numbers (e.g., 2,890 instead of 2,890.00),
 * rendering two decimal places only when fractional cents exist (e.g., 2,890.50).
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
 * Generates an SVG CODE128 barcode string representing the invoice number.
 * Tailored for high-contrast, razor-sharp 203 DPI rendering on 80mm thermal printers.
 */
export const generateBarcodeSvg = (text: string): string => {
  if (!text) return '';
  const cleanCode = String(text).trim();

  if (typeof document !== 'undefined') {
    try {
      const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const barcodeFn: any = (JsBarcode as any).default || JsBarcode;
      barcodeFn(svgNode, cleanCode, {
        format: 'CODE128',
        width: 1.8,
        height: 38,
        displayValue: false,
        margin: 0,
        background: 'transparent',
        lineColor: '#000000',
      });
      svgNode.setAttribute('style', 'max-width: 100%; height: 38px; display: block; margin: 0 auto;');
      return svgNode.outerHTML;
    } catch (err) {
      console.warn('JsBarcode SVG generation fallback triggered:', err);
    }
  }

  // Pure SVG barcode fallback
  return `<svg viewBox="0 0 160 36" style="max-width: 100%; height: 36px; display: block; margin: 0 auto;" xmlns="http://www.w3.org/2000/svg">
    <rect width="160" height="36" fill="#fff" />
    <g fill="#000">
      <rect x="4" y="2" width="3" height="32"/>
      <rect x="9" y="2" width="2" height="32"/>
      <rect x="14" y="2" width="4" height="32"/>
      <rect x="21" y="2" width="1" height="32"/>
      <rect x="25" y="2" width="3" height="32"/>
      <rect x="31" y="2" width="2" height="32"/>
      <rect x="36" y="2" width="4" height="32"/>
      <rect x="43" y="2" width="2" height="32"/>
      <rect x="48" y="2" width="3" height="32"/>
      <rect x="54" y="2" width="1" height="32"/>
      <rect x="58" y="2" width="4" height="32"/>
      <rect x="65" y="2" width="2" height="32"/>
      <rect x="70" y="2" width="3" height="32"/>
      <rect x="76" y="2" width="1" height="32"/>
      <rect x="80" y="2" width="4" height="32"/>
      <rect x="87" y="2" width="2" height="32"/>
      <rect x="92" y="2" width="3" height="32"/>
      <rect x="98" y="2" width="2" height="32"/>
      <rect x="103" y="2" width="4" height="32"/>
      <rect x="110" y="2" width="1" height="32"/>
      <rect x="114" y="2" width="3" height="32"/>
      <rect x="120" y="2" width="2" height="32"/>
      <rect x="125" y="2" width="4" height="32"/>
      <rect x="132" y="2" width="2" height="32"/>
      <rect x="137" y="2" width="3" height="32"/>
      <rect x="143" y="2" width="1" height="32"/>
      <rect x="147" y="2" width="4" height="32"/>
      <rect x="154" y="2" width="2" height="32"/>
    </g>
  </svg>`;
};

/**
 * World-Class 80mm English Thermal Receipt Template.
 * Specially tailored for the Xprinter XP-P801A (80mm portable Bluetooth/USB thermal printer).
 * Printable dimensions: 80mm roll width, 72mm effective printable area (576 dots at 203 DPI).
 */
export const generate80mmThermalReceiptHtml = (
  order: ThermalOrder | null | undefined,
  matchedCustomer?: any,
  allCustomers?: any[]
): string => {
  if (!order) return '';

  // Invoice Number Resolution
  const rawId = order.id || order.invoiceNumber || order.orderNumber || '';
  const invoiceNo = order.invoiceNumber
    ? (order.invoiceNumber.startsWith('#') ? order.invoiceNumber : `#${order.invoiceNumber}`)
    : (rawId ? `#INV${rawId}` : '#INV-DRAFT');
  const barcodeValue = String(order.invoiceNumber || (order.id ? `INV${order.id}` : 'INV-DRAFT')).replace('#', '');

  // Date and Time Formatting
  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

  // Billing Type: WHOLESALE or RETAIL
  const isWholesale =
    order.source === 'POS_WHOLESALE' ||
    order.orderType === 'WHOLESALE' ||
    (order as any).type === 'WHOLESALE';
  const billingType = isWholesale ? 'WHOLESALE' : 'RETAIL';

  // Sales Rep Name Resolution
  const salesRepName =
    order.user?.name ||
    order.repName ||
    (order as any).salesRepName ||
    order.userName ||
    '';

  // Customer Details Resolution
  const foundCustFromStore = Array.isArray(allCustomers) && ((order as any)?.customerId || order?.customer?.id)
    ? allCustomers.find((c) => Number(c.id) === Number((order as any)?.customerId || order?.customer?.id))
    : null;
  const liveCustRecord = foundCustFromStore || matchedCustomer || (order as any).matchedCustomer || order.customer;

  const customerName = order.customer?.name || order.customerName || liveCustRecord?.name || 'Walk-in Customer';
  const customerPhone = order.customer?.phone || order.customerPhone || liveCustRecord?.phone || '';
  const customerCityOrRoute =
    order.customer?.city ||
    (order as any).customerCity ||
    (order as any).city ||
    (order as any).route ||
    liveCustRecord?.city ||
    order.customer?.address ||
    '';

  // Financial Figures
  const total = Number(order.totalAmount || 0);
  const isReturnBill = Boolean(order.isReturnBill || order.isReturnOrder || total < 0);
  const billDiscountAmount = Number(order.discountAmount ?? order.discount ?? 0);
  const settledDue = Number(order.settledDueAmount || 0);

  // Authoritative Customer Balance Synchronization
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

  const updatedBalance = Number(authoritativeCustomerBalance || 0);

  // Return Bill Ledger Specifics
  const refundedCashAmount = Number(order.refundedCashAmount || 0);
  const creditApplied = Math.abs(total) - refundedCashAmount;
  const previousDueBeforeReturn = updatedBalance + creditApplied;

  // Payments and Paid Amount Resolution
  const rawPaid = Number(order.paidAmount);
  const tendered = order.tenderedAmount !== undefined ? Number(order.tenderedAmount) : rawPaid;
  const paymentMethodLabel = (order.paymentMethod || '').toUpperCase() || (isWholesale ? 'WHOLESALE CREDIT' : 'CASH');

  const paidAmount = !isNaN(rawPaid)
    ? (paymentMethodLabel.includes('CREDIT') && rawPaid === 0 ? 0 : rawPaid)
    : (paymentMethodLabel.includes('CREDIT') ? 0 : Math.min(total, tendered));

  const balanceDue = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
  const changeAmount = Math.max(0, Math.round((tendered - paidAmount - settledDue) * 100) / 100);
  const isCreditOrder = paymentMethodLabel.includes('CREDIT') || balanceDue > 0;
  const currentBillCredit = isCreditOrder ? balanceDue : 0;

  // Previous Due Before Normal Bill
  const previousDueBeforeBill = Math.max(0, Math.round((updatedBalance - currentBillCredit + settledDue) * 100) / 100);
  const hasCustomerAccount = Boolean((order as any).customerId || order.customer?.id) || customerName !== 'Walk-in Customer';

  // Itemized Payments Construction
  interface ResolvedPayment {
    method: string;
    amount: number;
    reference?: string;
  }
  const itemizedPayments: ResolvedPayment[] = [];

  if (Array.isArray(order.payments) && order.payments.length > 0) {
    order.payments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      if (amt > 0) {
        itemizedPayments.push({
          method: String(p.method || 'CASH').toUpperCase(),
          amount: amt,
          reference: p.reference || (p.notes ? String(p.notes) : undefined),
        });
      }
    });
  }

  if (itemizedPayments.length === 0 && Array.isArray(order.splitPayments) && order.splitPayments.length > 0) {
    order.splitPayments.forEach((s) => {
      const amt = Number(s.amount) || 0;
      if (amt > 0) {
        let ref = s.reference || '';
        if (s.method === 'CHEQUE' && s.chequeNumber) {
          ref = `Chq #${s.chequeNumber}${s.bankName ? ` (${s.bankName})` : ''}`;
        }
        itemizedPayments.push({
          method: String(s.method || 'CASH').toUpperCase(),
          amount: amt,
          reference: ref || undefined,
        });
      }
    });
  }

  if (itemizedPayments.length === 0 && paidAmount > 0) {
    itemizedPayments.push({
      method: paymentMethodLabel.includes('CREDIT') ? 'CASH' : paymentMethodLabel,
      amount: paidAmount,
    });
  }

  // 2-Line Items Resolution: Prevents truncation of sizes and long styles
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
    const isReturnItem = Boolean(
      it.isReturn === true ||
      (it.isReturn !== false && (Number(it.totalPrice) < 0 || (it.price !== undefined && Number(it.price) < 0) || Number(it.quantity) < 0 || Number(it.qty) < 0)) ||
      (isReturnBill && it.isReturn !== false)
    );

    const rate = Number(it.wholesalePrice || it.unitPrice || (it.price ? (Number(it.price) + discount) / Math.abs(qty || 1) : 0));
    const rawLineAmount = it.totalPrice !== undefined ? Number(it.totalPrice) : (it.price !== undefined ? Number(it.price) : (rate * Math.abs(qty)) - discount);
    const amount = isReturnItem ? -Math.abs(rawLineAmount) : Math.abs(rawLineAmount);

    return {
      name,
      variantDesc,
      qty: Math.abs(qty),
      rate,
      discount,
      discountType,
      discountInput,
      amount,
      isReturn: isReturnItem,
    };
  });

  const totalItemDiscounts = items.reduce((acc, it) => acc + (Number(it.discount) || 0), 0);
  const grossSubtotal = items.reduce((acc, it) => acc + (it.rate * it.qty), 0) || Number(order.subtotal || (total + totalItemDiscounts + billDiscountAmount) || 0);
  const totalDiscounts = totalItemDiscounts + billDiscountAmount;
  const netBillAmount = isReturnBill ? total : (grossSubtotal - totalDiscounts);

  // Render 2-Line Item Rows
  const itemsRowsHtml = items
    .map(
      (it) => `
      <div style="width: 100%; padding: 4px 0 3px 0; border-bottom: 1px dotted #000;">
        <!-- Line 1: Item Name (Bold) with Distinct [RETURN] Tag if returned -->
        <div style="font-weight: 800; font-size: 13.5px; line-height: 1.3; word-break: break-word; text-align: left; width: 100%; color: #000 !important;">
          ${it.isReturn ? '<span style="display: inline-block; font-weight: 900; background: #000; color: #fff; padding: 0 4px; font-size: 10.5px; margin-right: 4px; border-radius: 2px;">[RETURN]</span>' : ''}
          ${it.name}
        </div>
        <!-- Line 2: Size & Color | Qty @ Unit Price | Line Total -->
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; font-weight: 700; margin-top: 2px; color: #000 !important;">
          <span style="width: 40%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${it.variantDesc || '-'}
          </span>
          <span style="width: 32%; text-align: center;">
            ${it.qty} @ ${formatReceiptPrice(it.rate)}${it.discount > 0 ? ` <span style="font-size: 10.5px; font-weight: 700;">(-${formatReceiptDiscount(it.discount, it.discountType, it.discountInput)})</span>` : ''}
          </span>
          <span style="width: 28%; text-align: right; font-weight: 900;">
            ${it.isReturn ? '-' : ''}Rs. ${formatReceiptPrice(Math.abs(it.amount))}
          </span>
        </div>
      </div>`
    )
    .join('');

  // Itemized Payment Lines HTML
  const paymentsHtml = itemizedPayments
    .map((p) => {
      const label = p.method === 'CHEQUE' ? (p.reference || 'Cheque') : p.method;
      return `
      <div class="flex-between">
        <span>Paid (${label}):</span>
        <span style="font-weight: 700;">Rs. ${formatReceiptPrice(p.amount)}</span>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt-${invoiceNo.replace('#', '')}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      html, body {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 3mm !important;
        height: auto !important;
        min-height: 0 !important;
        font-family: 'Courier New', Courier, monospace, 'Liberation Mono' !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        color: #000 !important;
        background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #invoice-root {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 2mm 0 4mm 0 !important;
        height: auto !important;
        min-height: 0 !important;
      }
    }
    * {
      box-sizing: border-box;
      color: #000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html {
      width: 100%;
      height: auto;
      min-height: 0;
      background: #fff;
    }
    body {
      margin: 0 auto;
      padding: 0 3mm;
      width: 100%;
      max-width: 80mm;
      height: auto;
      min-height: 0;
      font-family: 'Courier New', Courier, monospace, 'Liberation Mono';
      font-size: 13px;
      font-weight: 600;
      line-height: 1.35;
      color: #000 !important;
      background-color: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .dashed-sep { border-top: 1.5px dashed #000; margin: 6px 0; width: 100%; }
    .dotted-sep { border-top: 1px dotted #000; margin: 5px 0; width: 100%; }
    .solid-sep { border-top: 1.5px solid #000; margin: 5px 0; width: 100%; }
    .double-sep { border-top: 2.5px double #000; margin: 5px 0; width: 100%; }
    .flex-between { width: 100%; display: flex; justify-content: space-between; align-items: baseline; }
    .receipt-logo {
      width: 50px;
      height: 50px;
      object-fit: contain;
      display: block;
      filter: grayscale(100%) contrast(300%) brightness(90%);
    }
  </style>
</head>
<body>
  <div id="invoice-root" style="width: 100%; max-width: 100%; height: auto; min-height: 0; margin: 0; padding: 2mm 0 4mm 0;">
    <!-- Header: Centered Flexbox with Logo left & Brand text right -->
    <div style="width: 100%; text-align: center; margin-bottom: 5px;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 4px;">
        <img
          src="/images/logo.jpg"
          alt="RELIANCE"
          class="receipt-logo"
          style="width: 50px; height: 50px; object-fit: contain; filter: grayscale(100%) contrast(300%) brightness(90%); flex-shrink: 0; display: block; margin: 0;"
        />
        <div style="display: flex; flex-direction: column; justify-content: center; text-align: left;">
          <div style="font-size: 26px; font-weight: 900; letter-spacing: 2px; line-height: 1; text-transform: uppercase;">
            RELIANCE
          </div>
          <div style="font-size: 10.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; line-height: 1.2; margin-top: 2px;">
            BRANDED MENS CLOTHING
          </div>
        </div>
      </div>
      <div style="font-size: 11.5px; font-weight: 700; line-height: 1.3; text-align: center;">
        Mawarala Road, Makandura, Matara
      </div>
      <div style="font-size: 11.5px; font-weight: 700; line-height: 1.3; text-align: center;">
        Hotline: 041-2268739 / 071-1350123
      </div>
      <div style="font-size: 11.5px; font-weight: 700; line-height: 1.3; text-align: center;">
        Web: relianceapparel.lk
      </div>
    </div>

    <div class="dashed-sep"></div>

    <!-- Invoice & Rep Meta -->
    <div style="width: 100%; font-size: 12px; line-height: 1.4; font-weight: 600;">
      <div class="flex-between" style="font-size: 14px; font-weight: 900;">
        <span>INVOICE:</span>
        <span>${invoiceNo}</span>
      </div>
      <div class="flex-between">
        <span>Date &amp; Time:</span>
        <span style="font-weight: 700;">${dateStr}</span>
      </div>
      ${salesRepName ? `
      <div class="flex-between">
        <span>Sales Rep:</span>
        <span style="font-weight: 800;">${salesRepName}</span>
      </div>` : ''}
      <div class="flex-between">
        <span>Billing Type:</span>
        <span style="font-weight: 800; text-transform: uppercase;">${billingType}</span>
      </div>

      <div class="dotted-sep"></div>

      <div class="flex-between">
        <span>Customer:</span>
        <span style="font-weight: 800; max-width: 65%; text-align: right;">${customerName}</span>
      </div>
      ${customerPhone ? `
      <div class="flex-between">
        <span>Phone:</span>
        <span style="font-weight: 700;">${customerPhone}</span>
      </div>` : ''}
      ${customerCityOrRoute ? `
      <div class="flex-between">
        <span>City / Route:</span>
        <span style="text-align: right; max-width: 65%; font-weight: 700;">${customerCityOrRoute}</span>
      </div>` : ''}
    </div>

    <div class="dashed-sep"></div>

    <!-- Itemized Items Matrix Header -->
    <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 800; border-bottom: 1.5px dashed #000; padding-bottom: 3px; text-transform: uppercase;">
      <span style="width: 40%; text-align: left;">Size &amp; Color</span>
      <span style="width: 32%; text-align: center;">Qty @ Rate</span>
      <span style="width: 28%; text-align: right;">Total (Rs.)</span>
    </div>

    <!-- 2-Line Layout Item Rows -->
    <div style="width: 100%; margin: 2px 0;">
      ${itemsRowsHtml}
    </div>

    <div class="dashed-sep"></div>

    <!-- Strict Financial Ledger Breakdown -->
    <div style="width: 100%; font-size: 12.5px; line-height: 1.45; font-weight: 600;">
      <div class="flex-between">
        <span>Sub Total (Gross):</span>
        <span style="font-weight: 700;">Rs. ${formatReceiptPrice(grossSubtotal)}</span>
      </div>
      ${totalDiscounts > 0 ? `
      <div class="flex-between" style="font-weight: 700;">
        <span>Total Discounts:</span>
        <span>- Rs. ${formatReceiptPrice(totalDiscounts)}</span>
      </div>` : ''}
      <div class="flex-between" style="font-size: 14px; font-weight: 900; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 0; margin: 4px 0;">
        <span>NET BILL AMOUNT:</span>
        <span>Rs. ${formatReceiptPrice(netBillAmount)}</span>
      </div>

      ${isReturnBill ? `
      <!-- Return Bill Financial Ledger -->
      <div class="flex-between">
        <span>Previous Due (Before Return):</span>
        <span style="font-weight: 700;">Rs. ${formatReceiptPrice(previousDueBeforeReturn)}</span>
      </div>
      <div class="flex-between" style="font-weight: 800;">
        <span>Deducted (Return Credit):</span>
        <span>- Rs. ${formatReceiptPrice(creditApplied)}</span>
      </div>
      ${refundedCashAmount > 0 ? `
      <div class="flex-between" style="font-weight: 700;">
        <span>Cash Refunded:</span>
        <span>Rs. ${formatReceiptPrice(refundedCashAmount)}</span>
      </div>` : ''}
      <div class="flex-between" style="font-size: 14px; font-weight: 900; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px;">
        <span>UPDATED OUTSTANDING:</span>
        <span>Rs. ${formatReceiptPrice(updatedBalance)}</span>
      </div>
      ` : `
      <!-- Standard Invoice Financial Ledger -->
      ${hasCustomerAccount ? `
      <div class="flex-between">
        <span>Previous Due (Before Bill):</span>
        <span style="font-weight: 700;">Rs. ${formatReceiptPrice(previousDueBeforeBill)}</span>
      </div>` : ''}

      ${paymentsHtml}

      ${balanceDue > 0 && hasCustomerAccount ? `
      <div class="flex-between" style="font-weight: 700;">
        <span>Bill Credit (Unpaid):</span>
        <span>+ Rs. ${formatReceiptPrice(balanceDue)}</span>
      </div>` : ''}

      ${settledDue > 0 ? `
      <div class="flex-between" style="font-weight: 700;">
        <span>Settled from Previous Due:</span>
        <span>- Rs. ${formatReceiptPrice(settledDue)}</span>
      </div>` : ''}

      ${hasCustomerAccount ? `
      <div class="flex-between" style="font-size: 14px; font-weight: 900; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px;">
        <span>UPDATED OUTSTANDING:</span>
        <span>Rs. ${formatReceiptPrice(updatedBalance)}</span>
      </div>` : `
      ${balanceDue > 0 ? `
      <div class="flex-between" style="font-weight: 800;">
        <span>Balance Due:</span>
        <span>Rs. ${formatReceiptPrice(balanceDue)}</span>
      </div>` : ''}
      ${changeAmount > 0 ? `
      <div class="flex-between" style="font-weight: 800;">
        <span>Change:</span>
        <span>Rs. ${formatReceiptPrice(changeAmount)}</span>
      </div>` : ''}
      `}
      `}
    </div>

    <div class="dashed-sep"></div>

    <!-- Footer: Exchange Policy & Partnership Message (Barcode and duplicate invoice no removed) -->
    <div class="text-center" style="width: 100%; text-align: center; margin-top: 8px;">
      <div style="font-size: 11.5px; font-weight: 800; margin-bottom: 2px;">
        Exchangeable within 7 days with this receipt
      </div>
      <div style="font-size: 12px; font-weight: 900; margin-bottom: 3px;">
        Thank you for your valued partnership!
      </div>
      <div style="font-size: 10.5px; font-weight: 700; margin-top: 4px;">
        Software by nebula infinite 078 323 3760
      </div>
    </div>
  </div>
</body>
</html>`;
};
