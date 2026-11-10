import React from 'react';

export interface PaymentReceiptData {
  id?: number | string;
  receiptNumber?: string;
  amount: number;
  method?: string;
  paymentMethod?: string;
  reference?: string | null;
  chequeNumber?: string | null;
  bankName?: string | null;
  chequeDate?: string | null;
  chequeStatus?: string | null;
  createdAt?: string | Date;
  receiptDate?: string | Date;
  date?: string | Date;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  invoiceNumber?: string;
  invoiceTotal?: number;
  outstandingBalance?: number;
  remainingBalance?: number;
  notes?: string | null;
}

export interface PrintPaymentReceiptProps {
  receipt?: PaymentReceiptData | null;
  payments?: (PaymentReceiptData | any)[] | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  invoiceNumber?: string;
  invoiceTotal?: number;
  outstandingBalance?: number;
  remainingBalance?: number;
  receiptNumber?: string;
  receiptDate?: string | Date;
  date?: string | Date;
  notes?: string | null;
}

/**
 * Technical Specification for 80mm Thermal Payment Receipt Print Layout:
 * Optimized strictly for 80mm Thermal POS Receipt Printers (Xprinter, Epson, Sunmi, etc.).
 * Printable dimensions: 80mm roll width, 72mm effective printable area (576 dots at 203 DPI).
 * Supports both single payment receipts and consolidated multi-payment (split payment) receipts.
 * Uses high contrast monochrome styling with zero ink bleed.
 */
export const PrintPaymentReceipt: React.FC<PrintPaymentReceiptProps> = ({
  receipt,
  payments,
  customerName,
  customerPhone,
  customerAddress,
  customerCity,
  invoiceNumber,
  invoiceTotal,
  outstandingBalance,
  remainingBalance,
  receiptNumber,
  receiptDate,
  date,
  notes,
}) => {
  // If neither a single receipt nor a payments list is provided, nothing to print
  if (!receipt && (!payments || payments.length === 0)) return null;

  const isMultiPayment = Array.isArray(payments) && payments.length > 0;

  // Format Receipt Date & Time
  const rawDate =
    receiptDate ||
    date ||
    receipt?.receiptDate ||
    receipt?.date ||
    receipt?.createdAt ||
    (isMultiPayment && payments[0]?.date) ||
    new Date();
  const dateObj = new Date(rawDate);
  const formattedDate = isNaN(dateObj.getTime())
    ? new Date().toISOString().split('T')[0]
    : dateObj.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
  const formattedTime = isNaN(dateObj.getTime())
    ? ''
    : dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const resolvedCustomerName =
    customerName || receipt?.customerName || 'Walk-in Customer';
  const resolvedCustomerPhone = customerPhone || receipt?.customerPhone;
  const resolvedInvoiceNumber = invoiceNumber || receipt?.invoiceNumber;
  const effectiveInvoiceTotal = invoiceTotal !== undefined ? invoiceTotal : receipt?.invoiceTotal;
  const effectiveBalance =
    outstandingBalance !== undefined
      ? outstandingBalance
      : remainingBalance !== undefined
      ? remainingBalance
      : receipt?.outstandingBalance !== undefined
      ? receipt?.outstandingBalance
      : receipt?.remainingBalance;

  // Multi-Payment Consolidated Mode
  if (isMultiPayment) {
    const paymentList = payments!;
    const totalPaidNum = paymentList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const formattedTotalPaid = `Rs. ${totalPaidNum.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const rcpNo =
      receiptNumber ||
      receipt?.receiptNumber ||
      (resolvedInvoiceNumber ? `RCP-${resolvedInvoiceNumber}` : 'RCP-SPLIT');

    return (
      <div
        id="printable-payment-receipt"
        className="hidden print:block font-mono text-black bg-white"
        style={{
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          minHeight: '0',
          margin: '0 auto',
          padding: '2mm 1mm 2mm 1mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: '1.35',
          color: '#000000',
          backgroundColor: '#ffffff',
        }}
      >
        {/* Header: Logo and Store Details */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: '6px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '4px',
            }}
          >
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
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 900,
                  letterSpacing: '2px',
                  lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                RELIANCE
              </div>
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                  marginTop: '2px',
                }}
              >
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
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              borderTop: '1px solid #000',
              borderBottom: '1px solid #000',
              padding: '2.5px 0',
              marginTop: '5px',
            }}
          >
            CONSOLIDATED PAYMENT RECEIPT
          </div>
        </div>

        {/* Customer & Invoice Meta Details */}
        <div style={{ width: '100%', fontSize: '11px', lineHeight: '1.35', fontWeight: 600 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Receipt No:</span>
            <span style={{ fontWeight: 800 }}>{rcpNo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Date &amp; Time:</span>
            <span style={{ fontWeight: 700 }}>
              {formattedDate} {formattedTime}
            </span>
          </div>
          {resolvedInvoiceNumber && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Invoice Ref:</span>
              <span style={{ fontWeight: 800 }}>{resolvedInvoiceNumber}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Customer:</span>
            <span
              style={{
                fontWeight: 800,
                maxWidth: '65%',
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {resolvedCustomerName}
            </span>
          </div>
          {resolvedCustomerPhone && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Contact:</span>
              <span style={{ fontWeight: 700 }}>{resolvedCustomerPhone}</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1.5px dashed #000', margin: '5px 0', width: '100%' }} />

        {/* Multi-Payment Itemized Breakdown */}
        <div style={{ width: '100%', fontSize: '11px', lineHeight: '1.35' }}>
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            SPLIT PAYMENT BREAKDOWN ({paymentList.length}{' '}
            {paymentList.length === 1 ? 'METHOD' : 'METHODS'}):
          </div>

          {paymentList.map((p: any, idx: number) => {
            const pMethod = String(p.method || p.paymentMethod || 'CASH').toUpperCase();
            const pAmount = Number(p.amount || 0);
            const isChq = pMethod === 'CHEQUE';

            let chqNum = p.chequeNumber || '';
            let chqBnk = p.bankName || '';
            let chqMaturity = p.chequeDate ? String(p.chequeDate).split('T')[0] : '';
            if (isChq && (!chqNum || !chqBnk) && p.reference) {
              const matchNum = /Cheque\s*#?([^\s(]+)/i.exec(p.reference);
              if (matchNum && !chqNum) chqNum = matchNum[1];
              const matchBank = /\(([^)]+)\)/.exec(p.reference);
              if (matchBank && !chqBnk) chqBnk = matchBank[1];
            }

            return (
              <div
                key={idx}
                style={{
                  marginBottom: '4px',
                  paddingBottom: '3px',
                  borderBottom: idx < paymentList.length - 1 ? '0.5px dotted #999' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800 }}>
                    {idx + 1}. {pMethod}
                  </span>
                  <span style={{ fontWeight: 800 }}>
                    Rs.{' '}
                    {pAmount.toLocaleString('en-LK', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {isChq && (
                  <div
                    style={{
                      fontSize: '10px',
                      paddingLeft: '6px',
                      borderLeft: '1.5px solid #000',
                      marginTop: '2px',
                    }}
                  >
                    {chqNum && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cheque #:</span>
                        <span style={{ fontWeight: 800 }}>{chqNum}</span>
                      </div>
                    )}
                    {chqBnk && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Bank:</span>
                        <span style={{ fontWeight: 700 }}>{chqBnk}</span>
                      </div>
                    )}
                    {chqMaturity && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Maturity:</span>
                        <span style={{ fontWeight: 800 }}>{chqMaturity}</span>
                      </div>
                    )}
                  </div>
                )}

                {p.reference && !isChq && (
                  <div
                    style={{
                      fontSize: '9.5px',
                      paddingLeft: '6px',
                      color: '#222',
                      marginTop: '1px',
                    }}
                  >
                    Ref: {p.reference}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: '1.5px solid #000', margin: '5px 0', width: '100%' }} />

        {/* Invoice Total and Highlighted Total Paid */}
        <div style={{ width: '100%', fontSize: '11px', lineHeight: '1.4' }}>
          {effectiveInvoiceTotal !== undefined && Number(effectiveInvoiceTotal) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>INVOICE TOTAL:</span>
              <span style={{ fontWeight: 700 }}>
                Rs.{' '}
                {Number(effectiveInvoiceTotal).toLocaleString('en-LK', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          <div
            style={{
              textAlign: 'center',
              padding: '5px 0',
              borderTop: '1px solid #000',
              borderBottom: '1px solid #000',
              margin: '3px 0',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}
            >
              TOTAL PAID
            </div>
            <div
              style={{
                fontSize: '19px',
                fontWeight: 900,
                letterSpacing: '0.5px',
                marginTop: '1px',
              }}
            >
              {formattedTotalPaid}
            </div>
          </div>

          {effectiveBalance !== undefined && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4px',
                fontWeight: 800,
              }}
            >
              <span>REMAINING BALANCE:</span>
              <span>
                Rs.{' '}
                {Number(effectiveBalance).toLocaleString('en-LK', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1.5px dashed #000', margin: '5px 0', width: '100%' }} />

        {/* Footer */}
        <div style={{ width: '100%', textAlign: 'center', marginTop: '5px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800 }}>Payment received with thanks!</div>
          <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>
            Issued by: Reliance POS System
          </div>
          <div style={{ fontSize: '8.5px', fontWeight: 600, marginTop: '3px' }}>
            System by nebulainfinite.com | 0783233760
          </div>
        </div>
      </div>
    );
  }

  // Single Payment Receipt Mode
  if (!receipt) return null;

  const receiptNo =
    receiptNumber || receipt.receiptNumber || (receipt.id ? `RCP-${receipt.id}` : 'RCP-PAY');
  const methodUpper = String(receipt.paymentMethod || receipt.method || 'CASH').toUpperCase();
  const isCheque = methodUpper === 'CHEQUE';

  // Format Amount
  const amountNum = Number(receipt?.amount || 0);
  const formattedAmount = `Rs. ${amountNum.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // Parse Cheque Details from Reference if not directly provided
  let chqNumber = receipt?.chequeNumber || '';
  let chqBank = receipt?.bankName || '';
  let chqMaturity = receipt?.chequeDate ? String(receipt.chequeDate).split('T')[0] : '';

  if (isCheque && (!chqNumber || !chqBank) && receipt?.reference) {
    const matchNum = /Cheque\s*#?([^\s(]+)/i.exec(receipt.reference);
    if (matchNum && !chqNumber) chqNumber = matchNum[1];
    const matchBank = /\(([^)]+)\)/.exec(receipt.reference);
    if (matchBank && !chqBank) chqBank = matchBank[1];
  }

  return (
    <div
      id="printable-payment-receipt"
      className="hidden print:block font-mono text-black bg-white"
      style={{
        width: '100%',
        maxWidth: '100%',
        height: 'auto',
        minHeight: '0',
        margin: '0 auto',
        padding: '2mm 1mm 2mm 1mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '12.5px',
        fontWeight: 700,
        lineHeight: '1.35',
        color: '#000000',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Header: Logo and Store Details */}
      <div style={{ width: '100%', textAlign: 'center', marginBottom: '6px' }}>
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

      <div style={{ borderTop: '1.5px dashed #000', margin: '6px 0', width: '100%' }} />

      {/* Title */}
      <div style={{ textAlign: 'center', margin: '4px 0 6px 0' }}>
        <span style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>
          OFFICIAL PAYMENT RECEIPT
        </span>
      </div>

      <div style={{ borderTop: '1px dotted #000', margin: '4px 0', width: '100%' }} />

      {/* Metadata */}
      <div style={{ width: '100%', fontSize: '11.5px', lineHeight: '1.35', fontWeight: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Receipt No:</span>
          <span style={{ fontWeight: 800 }}>{receiptNo}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date &amp; Time:</span>
          <span style={{ fontWeight: 700 }}>{formattedDate} {formattedTime}</span>
        </div>
        {receipt.invoiceNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Invoice Ref:</span>
            <span style={{ fontWeight: 800 }}>{receipt.invoiceNumber}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Customer:</span>
          <span style={{ fontWeight: 800, maxWidth: '65%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {receipt.customerName || 'Walk-in Customer'}
          </span>
        </div>
        {receipt.customerPhone && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Contact:</span>
            <span style={{ fontWeight: 700 }}>{receipt.customerPhone}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1.5px dashed #000', margin: '6px 0', width: '100%' }} />

      {/* Payment Method Details */}
      <div style={{ width: '100%', fontSize: '11.5px', lineHeight: '1.4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment Method:</span>
          <span style={{ fontWeight: 900, textTransform: 'uppercase' }}>{methodUpper}</span>
        </div>

        {isCheque && (
          <div style={{ marginTop: '3px', paddingLeft: '4px', borderLeft: '2px solid #000' }}>
            {chqNumber && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cheque #:</span>
                <span style={{ fontWeight: 800 }}>{chqNumber}</span>
              </div>
            )}
            {chqBank && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bank:</span>
                <span style={{ fontWeight: 700 }}>{chqBank}</span>
              </div>
            )}
            {chqMaturity && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Maturity Date:</span>
                <span style={{ fontWeight: 800 }}>{chqMaturity}</span>
              </div>
            )}
            {receipt.chequeStatus && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status:</span>
                <span style={{ fontWeight: 800, textTransform: 'uppercase' }}>{receipt.chequeStatus}</span>
              </div>
            )}
          </div>
        )}

        {receipt.reference && !isCheque && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
            <span>Reference / Trx:</span>
            <span style={{ fontWeight: 700 }}>{receipt.reference}</span>
          </div>
        )}

        {receipt.notes && (
          <div style={{ fontSize: '10.5px', marginTop: '2px', fontStyle: 'italic' }}>
            Notes: {receipt.notes}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1.5px solid #000', margin: '6px 0', width: '100%' }} />

      {/* Big Highlighted Amount Received */}
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          AMOUNT PAID
        </div>
        <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.5px', marginTop: '2px' }}>
          {formattedAmount}
        </div>
      </div>

      <div style={{ borderTop: '1.5px solid #000', margin: '6px 0', width: '100%' }} />

      {/* Ledger Balance Context if available */}
      {effectiveBalance !== undefined && (
        <div style={{ width: '100%', fontSize: '11px', fontWeight: 700, margin: '4px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>REMAINING BALANCE:</span>
            <span style={{ fontWeight: 800 }}>
              Rs. {Number(effectiveBalance).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      <div style={{ borderTop: '1.5px dashed #000', margin: '6px 0', width: '100%' }} />

      {/* Footer */}
      <div style={{ width: '100%', textAlign: 'center', marginTop: '6px' }}>
        <div style={{ fontSize: '11.5px', fontWeight: 800 }}>
          Payment received with thanks!
        </div>
        <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>
          Issued by: Reliance POS System
        </div>
        <div style={{ fontSize: '9px', fontWeight: 600, marginTop: '4px' }}>
          System by nebulainfinite.com | 0783233760
        </div>
      </div>
    </div>
  );
};

export const PrintConsolidatedReceipt = PrintPaymentReceipt;

export default PrintPaymentReceipt;
