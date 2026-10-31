import React from 'react';
import {
  type ThermalOrder,
  formatReceiptPrice,
  formatReceiptDiscount,
} from '../../utils/thermalReceipt';

export interface ThermalReceipt80mmProps {
  order: ThermalOrder | null | undefined;
  matchedCustomer?: any;
  allCustomers?: any[];
}

/**
 * Technical Specification for 80mm Thermal Receipt (POS Print Layout):
 * Tailored for the Xprinter XP-P801A (80mm portable Bluetooth/USB thermal printer).
 * Printable dimensions: 80mm roll width, 72mm effective printable area (576 dots at 203 DPI).
 */
export const ThermalReceipt80mm: React.FC<ThermalReceipt80mmProps> = ({
  order,
  matchedCustomer,
  allCustomers,
}) => {
  if (!order) return null;

  // Invoice Number Resolution
  const rawId = order.id || order.invoiceNumber || order.orderNumber || '';
  const invoiceNo = order.invoiceNumber
    ? (order.invoiceNumber.startsWith('#') ? order.invoiceNumber : `#${order.invoiceNumber}`)
    : (rawId ? `#INV${rawId}` : '#INV-DRAFT');
  const barcodeValue = String(order.invoiceNumber || (order.id ? `INV${order.id}` : 'INV-DRAFT')).replace('#', '');

  // Date & Time
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

  return (
    <div
      id="printable-receipt"
      className="hidden print:block font-mono text-black bg-white"
      style={{
        width: '80mm',
        maxWidth: '80mm',
        height: 'auto',
        minHeight: '0',
        margin: '0 auto',
        padding: '4mm 2mm 4mm 2mm',
        fontSize: '12px',
        lineHeight: '1.3',
        color: '#000',
        backgroundColor: '#fff',
      }}
    >
      {/* Header: Centered Flexbox with Logo left & Brand text right */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '4px' }}>
          <img
            src="/images/logo.jpg"
            alt="RELIANCE"
            style={{
              width: '48px',
              height: '48px',
              objectFit: 'contain',
              display: 'block',
              filter: 'grayscale(100%) contrast(300%) brightness(90%)',
              flexShrink: 0,
              margin: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '2px', lineHeight: 1, textTransform: 'uppercase' }}>
              RELIANCE
            </div>
            <div style={{ fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', lineHeight: 1.2, marginTop: '2px' }}>
              BRANDED MENS CLOTHING
            </div>
          </div>
        </div>
        <div style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: '1.25', textAlign: 'center' }}>
          Mawarala Road, Makandura, Matara
        </div>
        <div style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: '1.25', textAlign: 'center' }}>
          Hotline: 041-2268739 / 071-1350123
        </div>
        <div style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: '1.25', textAlign: 'center' }}>
          Web: relianceapparel.lk
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />

      {/* Invoice & Rep Meta */}
      <div style={{ fontSize: '11px', lineHeight: '1.35' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900 }}>
          <span>INVOICE:</span>
          <span>{invoiceNo}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date &amp; Time:</span>
          <span>{dateStr}</span>
        </div>
        {salesRepName ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Sales Rep:</span>
            <span style={{ fontWeight: 700 }}>{salesRepName}</span>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Billing Type:</span>
          <span style={{ fontWeight: 800, textTransform: 'uppercase' }}>{billingType}</span>
        </div>

        <div style={{ borderTop: '1px dotted #000', margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Customer:</span>
          <span style={{ fontWeight: 800, maxWidth: '65%', textAlign: 'right' }}>{customerName}</span>
        </div>
        {customerPhone ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Phone:</span>
            <span>{customerPhone}</span>
          </div>
        ) : null}
        {customerCityOrRoute ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>City / Route:</span>
            <span style={{ textAlign: 'right', maxWidth: '65%' }}>{customerCityOrRoute}</span>
          </div>
        ) : null}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />

      {/* Itemized Items Matrix Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10.5px',
          fontWeight: 700,
          borderBottom: '1px dashed #000',
          paddingBottom: '3px',
        }}
      >
        <span style={{ width: '38%', textAlign: 'left' }}>Size &amp; Color</span>
        <span style={{ width: '34%', textAlign: 'center' }}>Qty @ Rate</span>
        <span style={{ width: '28%', textAlign: 'right' }}>Total (Rs.)</span>
      </div>

      {/* 2-Line Layout Item Rows */}
      <div style={{ margin: '2px 0' }}>
        {items.map((it, idx) => (
          <div key={idx} style={{ padding: '3.5px 0 3px 0', borderBottom: '1px dotted #888' }}>
            {/* Line 1: Item Name (Bold) with Distinct [RETURN] Tag */}
            <div style={{ fontWeight: 700, fontSize: '11.5px', lineHeight: '1.25', wordBreak: 'break-word' }}>
              {it.isReturn ? (
                <span
                  style={{
                    display: 'inline-block',
                    fontWeight: 900,
                    background: '#000',
                    color: '#fff',
                    padding: '0 4px',
                    fontSize: '9.5px',
                    marginRight: '4px',
                    borderRadius: '2px',
                  }}
                >
                  [RETURN]
                </span>
              ) : null}
              {it.name}
            </div>
            {/* Line 2: Size & Color | Qty @ Unit Price | Line Total */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: '11px',
                marginTop: '1.5px',
              }}
            >
              <span style={{ width: '38%', textAlign: 'left', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.variantDesc || '-'}
              </span>
              <span style={{ width: '34%', textAlign: 'center' }}>
                {it.qty} @ {formatReceiptPrice(it.rate)}
                {it.discount > 0 ? (
                  <span style={{ fontSize: '9.5px', opacity: 0.85 }}>
                    {` (-${formatReceiptDiscount(it.discount, it.discountType, it.discountInput)})`}
                  </span>
                ) : null}
              </span>
              <span style={{ width: '28%', textAlign: 'right', fontWeight: 700 }}>
                {it.isReturn ? '-' : ''}Rs. {formatReceiptPrice(Math.abs(it.amount))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />

      {/* Strict Financial Ledger Breakdown */}
      <div style={{ fontSize: '11.5px', lineHeight: '1.4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Sub Total (Gross):</span>
          <span>Rs. {formatReceiptPrice(grossSubtotal)}</span>
        </div>
        {totalDiscounts > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Total Discounts:</span>
            <span>- Rs. {formatReceiptPrice(totalDiscounts)}</span>
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: 900,
            borderTop: '1px solid #000',
            borderBottom: '1px solid #000',
            padding: '3px 0',
            margin: '3px 0',
          }}
        >
          <span>NET BILL AMOUNT:</span>
          <span>Rs. {formatReceiptPrice(netBillAmount)}</span>
        </div>

        {isReturnBill ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Previous Due (Before Return):</span>
              <span>Rs. {formatReceiptPrice(previousDueBeforeReturn)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Deducted (Return Credit):</span>
              <span>- Rs. {formatReceiptPrice(creditApplied)}</span>
            </div>
            {refundedCashAmount > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cash Refunded:</span>
                <span>Rs. {formatReceiptPrice(refundedCashAmount)}</span>
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px',
                fontWeight: 900,
                borderTop: '2px solid #000',
                paddingTop: '4px',
                marginTop: '3px',
              }}
            >
              <span>UPDATED OUTSTANDING:</span>
              <span>Rs. {formatReceiptPrice(updatedBalance)}</span>
            </div>
          </>
        ) : (
          <>
            {hasCustomerAccount ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Previous Due (Before Bill):</span>
                <span>Rs. {formatReceiptPrice(previousDueBeforeBill)}</span>
              </div>
            ) : null}

            {itemizedPayments.map((p, pIdx) => {
              const label = p.method === 'CHEQUE' ? (p.reference || 'Cheque') : p.method;
              return (
                <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paid ({label}):</span>
                  <span>Rs. {formatReceiptPrice(p.amount)}</span>
                </div>
              );
            })}

            {balanceDue > 0 && hasCustomerAccount ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>Bill Credit (Unpaid):</span>
                <span>+ Rs. {formatReceiptPrice(balanceDue)}</span>
              </div>
            ) : null}

            {settledDue > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>Settled from Previous Due:</span>
                <span>- Rs. {formatReceiptPrice(settledDue)}</span>
              </div>
            ) : null}

            {hasCustomerAccount ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  fontWeight: 900,
                  borderTop: '2px solid #000',
                  paddingTop: '4px',
                  marginTop: '3px',
                }}
              >
                <span>UPDATED OUTSTANDING:</span>
                <span>Rs. {formatReceiptPrice(updatedBalance)}</span>
              </div>
            ) : (
              <>
                {balanceDue > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Balance Due:</span>
                    <span>Rs. {formatReceiptPrice(balanceDue)}</span>
                  </div>
                ) : null}
                {changeAmount > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Change:</span>
                    <span>Rs. {formatReceiptPrice(changeAmount)}</span>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />

      {/* Footer: Exchange Policy & Partnership Message (Barcode and duplicate invoice no removed) */}
      <div style={{ textAlign: 'center', marginTop: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
          Exchangeable within 7 days with this receipt
        </div>
        <div style={{ fontSize: '11.5px', fontWeight: 800, marginBottom: '3px' }}>
          Thank you for your valued partnership!
        </div>
        <div style={{ fontSize: '9.5px', fontWeight: 600, opacity: 0.85, marginTop: '4px' }}>
          Software by nebula infinite 078 323 3760
        </div>
      </div>
    </div>
  );
};
