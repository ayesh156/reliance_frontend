import React from 'react';
import { createPortal } from 'react-dom';
import {
  type ThermalOrder,
  formatReceiptPrice,
  formatReceiptDiscount,
  formatThermalReceiptDateTime,
} from '../../utils/thermalReceipt';
import { parseChequeMetadata } from '../../utils/chequeParser';

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
  const dateStr = formatThermalReceiptDateTime(order.createdAt);

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

  // Previous Due Before Normal Bill (Uses accurate historical snapshot or prior balance when provided)
  const previousDueBeforeBill = (order as any).previousDue !== undefined
    ? Math.max(0, Number((order as any).previousDue))
    : Math.max(0, Math.round((updatedBalance - currentBillCredit + settledDue) * 100) / 100);
  const hasCustomerAccount = Boolean((order as any).customerId || order.customer?.id) || customerName !== 'Walk-in Customer';

  // Itemized Payments Construction
  interface ResolvedPayment {
    method: string;
    amount: number;
    reference?: string;
    chequeNumber?: string;
    bankName?: string;
    chequeDate?: string;
    chequeStatus?: string;
    fullChequeAmount?: number;
    residualNotes?: string;
  }
  const itemizedPayments: ResolvedPayment[] = [];

  if (Array.isArray(order.payments) && order.payments.length > 0) {
    order.payments.forEach((p: any) => {
      const amt = Number(p.amount) || 0;
      if (amt > 0) {
        const pMethod = String(p.method || p.paymentMethod || 'CASH').toUpperCase();
        const parsed = parseChequeMetadata(p);
        itemizedPayments.push({
          method: pMethod,
          amount: amt,
          reference: p.reference || (p.notes ? String(p.notes) : undefined),
          chequeNumber: parsed.chequeNumber || p.chequeNumber || undefined,
          bankName: parsed.bankAndTown || p.bankName || undefined,
          chequeDate: parsed.maturityDate || (p.chequeDate ? String(p.chequeDate).split('T')[0] : undefined),
          chequeStatus: parsed.chequeStatus || p.chequeStatus || undefined,
          fullChequeAmount: parsed.fullChequeAmount || p.fullChequeAmount || undefined,
          residualNotes: parsed.residualNotes || undefined,
        });
      }
    });
  }

  if (itemizedPayments.length === 0 && Array.isArray(order.splitPayments) && order.splitPayments.length > 0) {
    order.splitPayments.forEach((s: any) => {
      const amt = Number(s.amount) || 0;
      if (amt > 0) {
        const pMethod = String(s.method || 'CASH').toUpperCase();
        const parsed = parseChequeMetadata(s);
        itemizedPayments.push({
          method: pMethod,
          amount: amt,
          reference: s.reference || undefined,
          chequeNumber: parsed.chequeNumber || s.chequeNumber || undefined,
          bankName: parsed.bankAndTown || s.bankName || undefined,
          chequeDate: parsed.maturityDate || (s.chequeDate ? String(s.chequeDate).split('T')[0] : undefined),
          chequeStatus: parsed.chequeStatus || s.chequeStatus || undefined,
          fullChequeAmount: parsed.fullChequeAmount || s.fullChequeAmount || undefined,
          residualNotes: parsed.residualNotes || undefined,
        });
      }
    });
  }

  if (itemizedPayments.length === 0 && Array.isArray((order as any).cheques) && (order as any).cheques.length > 0) {
    (order as any).cheques.forEach((c: any) => {
      const amt = Number(c.amount) || 0;
      if (amt > 0 || c.chequeNumber) {
        const parsed = parseChequeMetadata(c);
        itemizedPayments.push({
          method: 'CHEQUE',
          amount: amt,
          chequeNumber: parsed.chequeNumber || c.chequeNumber || undefined,
          bankName: parsed.bankAndTown || c.bankName || undefined,
          chequeDate: parsed.maturityDate || (c.chequeDate ? String(c.chequeDate).split('T')[0] : undefined),
          chequeStatus: parsed.chequeStatus || c.chequeStatus || undefined,
          fullChequeAmount: parsed.fullChequeAmount || c.fullChequeAmount || undefined,
          residualNotes: parsed.residualNotes || undefined,
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

  // Correlate fullChequeAmount across order.cheques if an overarching cheque object exists
  if (Array.isArray((order as any).cheques)) {
    (order as any).cheques.forEach((c: any) => {
      const cParsed = parseChequeMetadata(c);
      const cNum = cParsed.chequeNumber || c.chequeNumber;
      const cAmt = Number(c.amount) || 0;
      if (cNum && cAmt > 0) {
        itemizedPayments.forEach((ip) => {
          if (ip.chequeNumber && ip.chequeNumber.toLowerCase() === String(cNum).toLowerCase()) {
            if (cAmt > ip.amount) {
              ip.fullChequeAmount = cAmt;
            }
          }
        });
      }
    });
  }

  // 3-Line Items Resolution: Prevents truncation of sizes and long styles
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
    let variantDesc = '';
    if (size && color) {
      variantDesc = `(Size: ${size} / Color: ${color})`;
    } else if (size) {
      variantDesc = `(Size: ${size})`;
    } else if (color) {
      variantDesc = `(Color: ${color})`;
    }

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

  const receiptContent = (
    <div
      id="printable-receipt"
      className="hidden print:block font-mono text-black bg-white"
      style={{
        width: '72mm',
        maxWidth: '72mm',
        height: 'auto',
        minHeight: '0',
        margin: '0 auto',
        padding: '0 2mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        wordBreak: 'break-word',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '11.5px',
        fontWeight: 700,
        lineHeight: '1.3',
        color: '#000000',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Header: Centered Flexbox with Logo left & Brand text right */}
      <div style={{ width: '100%', textAlign: 'center', marginBottom: '5px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px' }}>
          <img
            src="/images/logo.jpg"
            alt="RELIANCE"
            style={{
              width: '46px',
              height: '46px',
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
            <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', lineHeight: 1.2, marginTop: '2px' }}>
              BRANDED MENS CLOTHING
            </div>
          </div>
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, lineHeight: '1.3', textAlign: 'center' }}>
          Mawarala Road, Makandura, Matara
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, lineHeight: '1.3', textAlign: 'center' }}>
          Hotline: 041-2268739 / 071-1350123
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, lineHeight: '1.3', textAlign: 'center' }}>
          Web: relianceapparel.lk
        </div>
      </div>

      <div style={{ borderTop: '1.5px dashed #000', margin: '5px 0', width: '100%' }} />

      {/* Invoice & Rep Meta: Tight Single-Line Layout */}
      <div style={{ width: '100%', fontSize: '11px', lineHeight: '1.35', fontWeight: 600, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
          <span>INVOICE:</span>
          <span style={{ fontWeight: 900, fontSize: '12px', textAlign: 'right' }}>{invoiceNo}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
          <span>Date &amp; Time:</span>
          <span style={{ fontWeight: 700, textAlign: 'right' }}>{dateStr}</span>
        </div>
        {salesRepName ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
            <span>Sales Rep:</span>
            <span style={{ fontWeight: 800, textAlign: 'right' }}>{salesRepName}</span>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
          <span>Billing Type:</span>
          <span style={{ fontWeight: 800, textTransform: 'uppercase', textAlign: 'right' }}>{billingType}</span>
        </div>

        <div style={{ borderTop: '1px dotted #000', margin: '4px 0', width: '100%' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
          <span>Customer:</span>
          <span style={{ fontWeight: 800, maxWidth: '62%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customerName}</span>
        </div>
        {customerPhone ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
            <span>Phone:</span>
            <span style={{ fontWeight: 700, textAlign: 'right' }}>{customerPhone}</span>
          </div>
        ) : null}
        {customerCityOrRoute ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
            <span>City / Route:</span>
            <span style={{ textAlign: 'right', maxWidth: '62%', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{customerCityOrRoute}</span>
          </div>
        ) : null}
      </div>

      <div style={{ borderTop: '1.5px dashed #000', margin: '5px 0', width: '100%' }} />

      {/* Itemized Items Matrix Header */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11.5px',
          fontWeight: 800,
          borderBottom: '1.5px dashed #000',
          paddingBottom: '3px',
          textTransform: 'uppercase',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ textAlign: 'left' }}>ITEMS &amp; DETAILS</span>
        <span style={{ textAlign: 'right' }}>TOTAL (RS.)</span>
      </div>

      {/* 3-Line Layout Item Rows */}
      <div style={{ width: '100%', margin: '2px 0', boxSizing: 'border-box' }}>
        {items.map((it, idx) => (
          <div key={idx} style={{ width: '100%', padding: '4px 0 3px 0', borderBottom: '1px dotted #000', boxSizing: 'border-box' }}>
            {/* Line 1: Item Name (Bold) with Distinct [RETURN] Tag */}
            <div style={{ fontWeight: 800, fontSize: '12.5px', lineHeight: '1.25', wordBreak: 'break-word', textAlign: 'left', width: '100%', color: '#000' }}>
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
            {/* Line 2: Size & Color enclosed in brackets (small font, left-aligned) */}
            {it.variantDesc ? (
              <div style={{ fontSize: '10.5px', fontWeight: 600, textAlign: 'left', width: '100%', marginTop: '1px', color: '#000', wordBreak: 'break-word' }}>
                {it.variantDesc}
              </div>
            ) : null}
            {/* Line 3: Qty @ Rate on left, Total strictly right-aligned (No redundant Rs. prefix) */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: '11.5px',
                fontWeight: 700,
                marginTop: '2px',
                color: '#000',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ textAlign: 'left' }}>
                {it.qty} @ {formatReceiptPrice(it.rate)}
                {it.discount > 0 ? (
                  <span style={{ fontSize: '9.5px', fontWeight: 700 }}>
                    {` (-${formatReceiptDiscount(it.discount, it.discountType, it.discountInput)})`}
                  </span>
                ) : null}
              </span>
              <span style={{ fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {it.isReturn ? '-' : ''}{formatReceiptPrice(Math.abs(it.amount))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1.5px dashed #000', margin: '6px 0', width: '100%' }} />

      {/* Strict Financial Ledger Breakdown (No redundant Rs. prefix) */}
      <div style={{ width: '100%', fontSize: '12.5px', lineHeight: '1.45', fontWeight: 700 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Sub Total (Gross):</span>
          <span style={{ fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatReceiptPrice(grossSubtotal)}</span>
        </div>
        {totalDiscounts > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total Discounts:</span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>-{formatReceiptPrice(totalDiscounts)}</span>
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '14px',
            fontWeight: 900,
            borderTop: '1.5px solid #000',
            borderBottom: '1.5px solid #000',
            padding: '4px 0',
            margin: '4px 0',
          }}
        >
          <span>NET BILL AMOUNT:</span>
          <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatReceiptPrice(netBillAmount)}</span>
        </div>

        {isReturnBill ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Previous Due (Before Return):</span>
              <span style={{ fontWeight: 700 }}>{formatReceiptPrice(previousDueBeforeReturn)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Deducted (Return Credit):</span>
              <span>-{formatReceiptPrice(creditApplied)}</span>
            </div>
            {refundedCashAmount > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Cash Refunded:</span>
                <span>{formatReceiptPrice(refundedCashAmount)}</span>
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: 900,
                borderTop: '2px solid #000',
                paddingTop: '4px',
                marginTop: '4px',
              }}
            >
              <span>UPDATED OUTSTANDING:</span>
              <span>{formatReceiptPrice(updatedBalance)}</span>
            </div>
          </>
        ) : (
          <>
            {hasCustomerAccount ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Previous Due (Before Bill):</span>
                <span style={{ fontWeight: 700 }}>
                  {previousDueBeforeBill > 0 ? `-${formatReceiptPrice(previousDueBeforeBill)}` : '0.00'}
                </span>
              </div>
            ) : null}

            {/* Itemized Payment Lines with Clean Vertical Details Alignment */}
            {itemizedPayments.map((p, pIdx) => {
              const isChq = p.method === 'CHEQUE';
              const chqNum = p.chequeNumber;
              const bName = p.bankName;
              const chqDate = p.chequeDate;
              const ref = p.reference;

              return (
                <div key={pIdx} style={{ marginBottom: '3px' }}>
                  {/* Primary Payment Method & Amount Line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                    <span style={{ fontWeight: 800 }}>Paid ({p.method}):</span>
                    <span style={{ fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {p.amount > 0 ? `+${formatReceiptPrice(p.amount)}` : formatReceiptPrice(p.amount)}
                    </span>
                  </div>

                  {/* Vertical Itemized Particulars (Cheque #, Bank & Town, Maturity Date, Status, Full Cheque Value) */}
                  {isChq && (chqNum || bName || chqDate || p.chequeStatus || p.residualNotes || (p.fullChequeAmount && p.fullChequeAmount > p.amount)) && (
                    <div
                      style={{
                        fontSize: '10px',
                        lineHeight: '1.3',
                        fontWeight: 700,
                        paddingLeft: '5px',
                        borderLeft: '1.5px solid #000000',
                        marginTop: '1.5px',
                        marginBottom: '2px',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      {chqNum && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                          <span>&bull; Cheque #:</span>
                          <span style={{ fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap' }}>{chqNum}</span>
                        </div>
                      )}
                      {bName && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                          <span style={{ maxWidth: '45%', whiteSpace: 'nowrap' }}>&bull; Bank &amp; Town:</span>
                          <span style={{ fontWeight: 800, textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word', overflow: 'hidden' }}>{bName}</span>
                        </div>
                      )}
                      {chqDate && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                          <span>&bull; Pass / Maturity:</span>
                          <span style={{ fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap' }}>{chqDate}</span>
                        </div>
                      )}
                      {p.chequeStatus && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                          <span>&bull; Status:</span>
                          <span style={{ fontWeight: 800, textTransform: 'uppercase', textAlign: 'right' }}>{p.chequeStatus}</span>
                        </div>
                      )}
                      {p.fullChequeAmount && p.fullChequeAmount > p.amount && (
                        <div style={{ borderTop: '1px dashed #000000', paddingTop: '1.5px', marginTop: '1.5px', width: '100%', boxSizing: 'border-box' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                            <span>&bull; Full Chq Val:</span>
                            <span style={{ fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatReceiptPrice(p.fullChequeAmount)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                            <span>&bull; Bill Allocated:</span>
                            <span style={{ fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatReceiptPrice(p.amount)}</span>
                          </div>
                        </div>
                      )}
                      {p.residualNotes && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                          <span style={{ maxWidth: '40%' }}>&bull; Details:</span>
                          <span style={{ fontWeight: 800, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{p.residualNotes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reference / Transaction Info for Card, Bank Transfer, or Notes */}
                  {!isChq && (ref || p.residualNotes) && (
                    <div
                      style={{
                        fontSize: '9.5px',
                        lineHeight: '1.3',
                        fontWeight: 700,
                        paddingLeft: '5px',
                        borderLeft: '1.5px solid #000000',
                        marginTop: '1.5px',
                        marginBottom: '2px',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                        <span style={{ maxWidth: '40%' }}>&bull; Ref / Info:</span>
                        <span style={{ fontWeight: 800, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{p.residualNotes || ref}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {balanceDue > 0 && hasCustomerAccount ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Bill Credit (Unpaid):</span>
                <span>-{formatReceiptPrice(balanceDue)}</span>
              </div>
            ) : null}

            {settledDue > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Settled from Previous Due:</span>
                <span>-{formatReceiptPrice(settledDue)}</span>
              </div>
            ) : null}

            {hasCustomerAccount ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  fontWeight: 900,
                  borderTop: '2px solid #000',
                  paddingTop: '4px',
                  marginTop: '4px',
                }}
              >
                <span>UPDATED OUTSTANDING:</span>
                <span>{formatReceiptPrice(updatedBalance)}</span>
              </div>
            ) : (
              <>
                {balanceDue > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <span>Balance Due:</span>
                    <span>{formatReceiptPrice(balanceDue)}</span>
                  </div>
                ) : null}
                {changeAmount > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <span>Change:</span>
                    <span>{formatReceiptPrice(changeAmount)}</span>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      {/* Bold High-Contrast "PAID IN FULL" Stamp for Fully Settled 80mm POS Bill */}
      {!isReturnBill && total > 0 && balanceDue <= 0 && (
        <div
          style={{
            margin: '6px auto',
            padding: '4px 8px',
            border: '2.5px solid #000000',
            outline: '1px solid #000000',
            outlineOffset: '-4px',
            textAlign: 'center',
            width: '80%',
            maxWidth: '220px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: '15px',
              fontWeight: 900,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              lineHeight: '1.2',
              color: '#000000',
            }}
          >
            PAID IN FULL
          </div>
        </div>
      )}

      {/* Comprehensive High-Contrast PAYMENT & SETTLEMENT BREAKDOWN (Crisp Thermal Head 800/900 Bold Black) */}
      {(itemizedPayments.length > 0 || paidAmount > 0 || isWholesale) && (
        <div style={{ width: '100%', color: '#000000', marginTop: '6px', paddingTop: '4px', borderTop: '2px solid #000000' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 900,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderBottom: '1.5px solid #000000',
              paddingBottom: '3px',
              marginBottom: '5px',
              color: '#000000',
            }}
          >
            PAYMENT &amp; SETTLEMENT BREAKDOWN
          </div>

          <div style={{ width: '100%', fontSize: '11.5px', lineHeight: '1.4', fontWeight: 800, color: '#000000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Previous Due / Old Balance:</span>
              <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                Rs. {formatReceiptPrice(isReturnBill ? previousDueBeforeReturn : previousDueBeforeBill)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Current Bill Total:</span>
              <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                Rs. {formatReceiptPrice(netBillAmount)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000000', paddingTop: '2px', marginTop: '2px' }}>
              <span>Total Paid:</span>
              <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                Rs. {formatReceiptPrice(itemizedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0) || paidAmount)}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '1.5px solid #000000',
                borderBottom: '1.5px solid #000000',
                padding: '3px 0',
                margin: '3px 0',
                fontWeight: 900,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <span>Final Remaining Balance:</span>
              <span style={{ fontWeight: 900, whiteSpace: 'nowrap', textAlign: 'right' }}>
                Rs. {formatReceiptPrice(hasCustomerAccount ? updatedBalance : balanceDue)}
              </span>
            </div>

            {/* Itemized Payment Details with Full Cheque Particulars */}
            {itemizedPayments.length > 0 && (
              <div style={{ marginTop: '5px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '3px', borderBottom: '1px dotted #000000', paddingBottom: '2px', width: '100%', boxSizing: 'border-box' }}>
                  Payment Particulars ({itemizedPayments.length}):
                </div>
                {itemizedPayments.map((p, idx) => {
                  const isChq = p.method === 'CHEQUE';
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '3px 0',
                        borderBottom: idx < itemizedPayments.length - 1 ? '1px dotted #000000' : 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 900, width: '100%', boxSizing: 'border-box' }}>
                        <span>{idx + 1}. {p.method}</span>
                        <span style={{ fontWeight: 900, whiteSpace: 'nowrap', textAlign: 'right' }}>Rs. {formatReceiptPrice(p.amount)}</span>
                      </div>
                      {isChq && (
                        <div
                          style={{
                            fontSize: '10px',
                            lineHeight: '1.3',
                            fontWeight: 800,
                            paddingLeft: '5px',
                            borderLeft: '2px solid #000000',
                            marginTop: '2px',
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          {p.chequeNumber && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                              <span>Cheque No:</span>
                              <span style={{ fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>{p.chequeNumber}</span>
                            </div>
                          )}
                          {p.bankName && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                              <span style={{ maxWidth: '45%', whiteSpace: 'nowrap' }}>Bank &amp; Town:</span>
                              <span style={{ fontWeight: 900, textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word', overflow: 'hidden' }}>{p.bankName}</span>
                            </div>
                          )}
                          {p.chequeDate && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                              <span>Maturity / Pass Date:</span>
                              <span style={{ fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>{p.chequeDate}</span>
                            </div>
                          )}
                          {p.chequeStatus && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                              <span>Status:</span>
                              <span style={{ fontWeight: 900, textTransform: 'uppercase', textAlign: 'right' }}>{p.chequeStatus}</span>
                            </div>
                          )}
                          {p.fullChequeAmount && p.fullChequeAmount > p.amount && (
                            <div style={{ borderTop: '1px dashed #000000', paddingTop: '2px', marginTop: '2px', width: '100%', boxSizing: 'border-box' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                                <span>Cheque Full Amount:</span>
                                <span style={{ fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>Rs. {formatReceiptPrice(p.fullChequeAmount)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                                <span>Applied to This Bill:</span>
                                <span style={{ fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>Rs. {formatReceiptPrice(p.amount)}</span>
                              </div>
                            </div>
                          )}
                          {p.residualNotes && (
                            <div style={{ fontSize: '9.5px', fontWeight: 800, marginTop: '1.5px', wordBreak: 'break-word', width: '100%', boxSizing: 'border-box' }}>
                              Ref / Details: {p.residualNotes}
                            </div>
                          )}
                        </div>
                      )}
                      {!isChq && (p.reference || p.residualNotes) && (
                        <div style={{ fontSize: '9.5px', fontWeight: 800, paddingLeft: '5px', marginTop: '1px', wordBreak: 'break-word', width: '100%', boxSizing: 'border-box' }}>
                          Ref: {p.residualNotes || p.reference}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ borderTop: '1.5px dashed #000', margin: '6px 0', width: '100%' }} />

      {/* Footer: Exchange Policy & Partnership Message (Barcode and duplicate invoice no removed) */}
      <div style={{ width: '100%', textAlign: 'center', marginTop: '8px' }}>
        <div style={{ fontSize: '11.5px', fontWeight: 800, marginBottom: '2px' }}>
          Exchangeable within 7 days with this receipt
        </div>
        <div style={{ fontSize: '12px', fontWeight: 900, marginBottom: '3px' }}>
          Thank you for your valued partnership!
        </div>
        <div style={{ fontSize: '9.5px', fontWeight: 700, marginTop: '4px' }}>
          System by nebulainfinite.com | 0783233760
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(receiptContent, document.body);
  }
  return receiptContent;
};
