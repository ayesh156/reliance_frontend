import React from 'react';
import { createPortal } from 'react-dom';
import { parseChequeMetadata } from '../../utils/chequeParser';

export interface PaymentReceiptData {
  id?: number | string;
  receiptNumber?: string;
  amount: number;
  fullChequeAmount?: number;
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
  previousDue?: number;
  oldBalance?: number;
  receiptNumber?: string;
  receiptDate?: string | Date;
  date?: string | Date;
  notes?: string | null;
  fullChequeAmount?: number;
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
  previousDue,
  oldBalance,
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

  const effectiveOldBalance =
    previousDue !== undefined
      ? previousDue
      : oldBalance !== undefined
      ? oldBalance
      : undefined;

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

    const multiReceiptContent = (
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
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              borderTop: '1.5px solid #000000',
              borderBottom: '1.5px solid #000000',
              padding: '3px 0',
              marginTop: '5px',
              color: '#000000',
            }}
          >
            PAYMENT &amp; SETTLEMENT BREAKDOWN
          </div>
        </div>

        {/* Customer & Invoice Meta Details */}
        <div style={{ width: '100%', fontSize: '11.5px', lineHeight: '1.35', fontWeight: 700, color: '#000000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Receipt No:</span>
            <span style={{ fontWeight: 900 }}>{rcpNo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Date &amp; Time:</span>
            <span style={{ fontWeight: 800 }}>
              {formattedDate} {formattedTime}
            </span>
          </div>
          {resolvedInvoiceNumber && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Invoice Ref:</span>
              <span style={{ fontWeight: 900 }}>{resolvedInvoiceNumber}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Customer:</span>
            <span
              style={{
                fontWeight: 900,
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
              <span style={{ fontWeight: 800 }}>{resolvedCustomerPhone}</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '2px solid #000000', margin: '5px 0', width: '100%' }} />

        {/* Multi-Payment Itemized Breakdown */}
        <div style={{ width: '100%', fontSize: '11.5px', lineHeight: '1.4', color: '#000000', fontWeight: 800 }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
              borderBottom: '1px dotted #000000',
              paddingBottom: '2px',
            }}
          >
            SPLIT PAYMENT BREAKDOWN ({paymentList.length}{' '}
            {paymentList.length === 1 ? 'METHOD' : 'METHODS'}):
          </div>

          {paymentList.map((p: any, idx: number) => {
            const pMethod = String(p.method || p.paymentMethod || 'CASH').toUpperCase();
            const pAmount = Number(p.amount || 0);
            const isChq = pMethod === 'CHEQUE';

            const parsed = parseChequeMetadata(p);
            const chqNum = parsed.chequeNumber || p.chequeNumber || '';
            const chqBnk = parsed.bankAndTown || p.bankName || '';
            const chqMaturity = parsed.maturityDate || (p.chequeDate ? String(p.chequeDate).split('T')[0] : '');
            const chqStatus = parsed.chequeStatus || p.chequeStatus || '';
            const fullChqAmt = parsed.fullChequeAmount || p.fullChequeAmount;
            const residualNotes = parsed.residualNotes || (!chqNum && !chqBnk ? (p.reference || p.notes) : '');

            return (
              <div
                key={idx}
                style={{
                  marginBottom: '4px',
                  paddingBottom: '3px',
                  borderBottom: idx < paymentList.length - 1 ? '1px dotted #000000' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 900 }}>
                    {idx + 1}. Paid ({pMethod}):
                  </span>
                  <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                    +Rs.{' '}
                    {pAmount.toLocaleString('en-LK', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {/* Cheque Particulars & Full Cheque Amount Display */}
                {(isChq || chqNum || chqBnk || chqMaturity) && (
                  <div
                    style={{
                      fontSize: '10.5px',
                      paddingLeft: '6px',
                      borderLeft: '2px solid #000000',
                      marginTop: '2px',
                      fontWeight: 800,
                    }}
                  >
                    {chqNum && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cheque #:</span>
                        <span style={{ fontWeight: 900 }}>{chqNum}</span>
                      </div>
                    )}
                    {chqBnk && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Bank &amp; Town:</span>
                        <span style={{ fontWeight: 900 }}>{chqBnk}</span>
                      </div>
                    )}
                    {chqMaturity && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Maturity / Pass Date:</span>
                        <span style={{ fontWeight: 900 }}>{chqMaturity}</span>
                      </div>
                    )}
                    {chqStatus && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Status:</span>
                        <span style={{ fontWeight: 900, textTransform: 'uppercase' }}>{chqStatus}</span>
                      </div>
                    )}

                    {/* Full Cheque Value when shared across multiple bills or exceeding single bill */}
                    {fullChqAmt && fullChqAmt > pAmount && (
                      <div style={{ borderTop: '1px dashed #000000', paddingTop: '2px', marginTop: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontWeight: 900 }}>
                          <span>Cheque Full Amount:</span>
                          <span>Rs. {fullChqAmt.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontWeight: 800 }}>
                          <span>Applied to This Bill:</span>
                          <span>Rs. {pAmount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Guaranteed Fallback Row for Unparsed Notes / References */}
                {residualNotes && (
                  <div
                    style={{
                      fontSize: '10px',
                      paddingLeft: '6px',
                      color: '#000000',
                      marginTop: '1.5px',
                      fontWeight: 800,
                    }}
                  >
                    Ref / Details: {residualNotes}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: '2px solid #000000', margin: '5px 0', width: '100%' }} />

        {/* Invoice Total and Highlighted Total Paid */}
        <div style={{ width: '100%', fontSize: '11.5px', lineHeight: '1.4', color: '#000000', fontWeight: 800 }}>
          {effectiveOldBalance !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Previous Due / Old Balance:</span>
              <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                Rs.{' '}
                {Number(effectiveOldBalance).toLocaleString('en-LK', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          {effectiveInvoiceTotal !== undefined && Number(effectiveInvoiceTotal) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Current Bill Total:</span>
              <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
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
              borderTop: '1.5px solid #000000',
              borderBottom: '1.5px solid #000000',
              margin: '3px 0',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                color: '#000000',
              }}
            >
              TOTAL PAID
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 900,
                letterSpacing: '0.5px',
                marginTop: '1px',
                color: '#000000',
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
                fontWeight: 900,
                borderTop: '1px solid #000000',
                paddingTop: '3px',
              }}
            >
              <span>Final Remaining Balance:</span>
              <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                Rs.{' '}
                {Number(effectiveBalance).toLocaleString('en-LK', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          {/* Bold High-Contrast "PAID IN FULL" Stamp when Account/Invoice is Settled */}
          {effectiveBalance !== undefined && Number(effectiveBalance) <= 0 && (
            <div
              style={{
                margin: '8px auto 4px auto',
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
        </div>

        {/* 2-Column Signature Section for Physical Signing */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: '48px',
            paddingTop: '6px',
            marginBottom: '6px',
            padding: '0 4px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ borderTop: '1.5px dashed #000000', width: '100%', marginBottom: '4px' }} />
            <span style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', color: '#000000' }}>
              Customer Signature
            </span>
          </div>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ borderTop: '1.5px dashed #000000', width: '100%', marginBottom: '4px' }} />
            <span style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', color: '#000000' }}>
              Rep / Authorized Sign
            </span>
          </div>
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

    if (typeof document !== 'undefined') {
      return createPortal(multiReceiptContent, document.body);
    }
    return multiReceiptContent;
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

  // Parse Cheque Details with universal metadata parser
  const singleParsed = parseChequeMetadata(receipt);
  const chqNumber = singleParsed.chequeNumber || receipt?.chequeNumber || '';
  const chqBank = singleParsed.bankAndTown || receipt?.bankName || '';
  const chqMaturity = singleParsed.maturityDate || (receipt?.chequeDate ? String(receipt.chequeDate).split('T')[0] : '');
  const chqStatus = singleParsed.chequeStatus || receipt?.chequeStatus || '';
  const singleFullChqAmt = singleParsed.fullChequeAmount || receipt?.fullChequeAmount;
  const singleResidualNotes = singleParsed.residualNotes || (!chqNumber && !chqBank ? (receipt?.reference || receipt?.notes) : '');

  const singleReceiptContent = (
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
        <span style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', color: '#000000' }}>
          PAYMENT &amp; SETTLEMENT BREAKDOWN
        </span>
      </div>

      <div style={{ borderTop: '1.5px solid #000000', margin: '4px 0', width: '100%' }} />

      {/* Metadata */}
      <div style={{ width: '100%', fontSize: '11.5px', lineHeight: '1.35', fontWeight: 700, color: '#000000' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Receipt No:</span>
          <span style={{ fontWeight: 900 }}>{receiptNo}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date &amp; Time:</span>
          <span style={{ fontWeight: 800 }}>{formattedDate} {formattedTime}</span>
        </div>
        {receipt.invoiceNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Invoice Ref:</span>
            <span style={{ fontWeight: 900 }}>{receipt.invoiceNumber}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Customer:</span>
          <span style={{ fontWeight: 900, maxWidth: '65%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {receipt.customerName || 'Walk-in Customer'}
          </span>
        </div>
        {receipt.customerPhone && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Contact:</span>
            <span style={{ fontWeight: 800 }}>{receipt.customerPhone}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: '2px solid #000000', margin: '6px 0', width: '100%' }} />

      {/* Payment Method Details */}
      <div style={{ width: '100%', fontSize: '11.5px', lineHeight: '1.4', color: '#000000', fontWeight: 800 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment Method:</span>
          <span style={{ fontWeight: 900, textTransform: 'uppercase' }}>{methodUpper}</span>
        </div>

        {(isCheque || chqNumber || chqBank || chqMaturity) && (
          <div style={{ marginTop: '3px', paddingLeft: '6px', borderLeft: '2px solid #000000', fontWeight: 800 }}>
            {chqNumber && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cheque #:</span>
                <span style={{ fontWeight: 900 }}>{chqNumber}</span>
              </div>
            )}
            {chqBank && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bank &amp; Town:</span>
                <span style={{ fontWeight: 900 }}>{chqBank}</span>
              </div>
            )}
            {chqMaturity && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Maturity / Pass Date:</span>
                <span style={{ fontWeight: 900 }}>{chqMaturity}</span>
              </div>
            )}
            {chqStatus && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status:</span>
                <span style={{ fontWeight: 900, textTransform: 'uppercase' }}>{chqStatus}</span>
              </div>
            )}

            {/* Full Cheque Value when shared across multiple bills or exceeding single bill */}
            {singleFullChqAmt && singleFullChqAmt > amountNum && (
              <div style={{ borderTop: '1px dashed #000000', paddingTop: '2px', marginTop: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontWeight: 900 }}>
                  <span>Cheque Full Amount:</span>
                  <span>Rs. {singleFullChqAmt.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontWeight: 800 }}>
                  <span>Applied to This Bill:</span>
                  <span>Rs. {amountNum.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Guaranteed Fallback Row for Unparsed Notes / References */}
        {singleResidualNotes && (
          <div style={{ fontSize: '10px', marginTop: '2px', fontWeight: 700 }}>
            Ref / Details: {singleResidualNotes}
          </div>
        )}
      </div>

      <div style={{ borderTop: '2px solid #000000', margin: '6px 0', width: '100%' }} />

      {/* Financial Settlement Context & High-Contrast Highlight */}
      <div style={{ width: '100%', fontSize: '11.5px', fontWeight: 800, margin: '4px 0', color: '#000000' }}>
        {effectiveOldBalance !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Previous Due / Old Balance:</span>
            <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
              Rs. {Number(effectiveOldBalance).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
        {effectiveInvoiceTotal !== undefined && Number(effectiveInvoiceTotal) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Current Bill Total:</span>
            <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
              Rs. {Number(effectiveInvoiceTotal).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Big Highlighted Amount Received */}
        <div style={{ textAlign: 'center', padding: '6px 0', borderTop: '1.5px solid #000000', borderBottom: '1.5px solid #000000', margin: '4px 0' }}>
          <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#000000' }}>
            TOTAL PAID
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.5px', marginTop: '2px', color: '#000000' }}>
            {formattedAmount}
          </div>
        </div>

        {effectiveBalance !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000000', paddingTop: '3px', marginTop: '2px' }}>
            <span>Final Remaining Balance:</span>
            <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
              Rs. {Number(effectiveBalance).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Bold High-Contrast "PAID IN FULL" Stamp when Account/Invoice is Settled */}
        {effectiveBalance !== undefined && Number(effectiveBalance) <= 0 && (
          <div
            style={{
              margin: '8px auto 4px auto',
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
      </div>

      {/* 2-Column Signature Section for Physical Signing */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '48px',
          paddingTop: '6px',
          marginBottom: '6px',
          padding: '0 4px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div style={{ borderTop: '1.5px dashed #000000', width: '100%', marginBottom: '4px' }} />
          <span style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', color: '#000000' }}>
            Customer Signature
          </span>
        </div>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div style={{ borderTop: '1.5px dashed #000000', width: '100%', marginBottom: '4px' }} />
          <span style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', color: '#000000' }}>
            Rep / Authorized Sign
          </span>
        </div>
      </div>

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

  if (typeof document !== 'undefined') {
    return createPortal(singleReceiptContent, document.body);
  }
  return singleReceiptContent;
};

export const PrintConsolidatedReceipt = PrintPaymentReceipt;

export default PrintPaymentReceipt;
