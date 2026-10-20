/**
 * WhatsApp Dispatcher Utility Engine
 * Sanitizes phone numbers to International format and builds structured receipt texts without emojis.
 */

export const sanitizeWhatsAppPhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  // Remove +, spaces, dashes, brackets, and non-numeric characters
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '').trim().replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  // Prepend country code 94 if starting with 0 (e.g. 0771234567 -> 94771234567)
  if (cleaned.startsWith('0')) {
    cleaned = `94${cleaned.slice(1)}`;
  } else if (!cleaned.startsWith('94') && cleaned.length === 9) {
    cleaned = `94${cleaned}`;
  }
  return cleaned.length >= 9 ? cleaned : null;
};

/**
 * Dispatches WhatsApp messaging using native deep-link URI on both Desktop and Mobile devices.
 *
 * - On Desktop (Windows/macOS/Linux):
 *   1. Directly triggers the native protocol: `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`
 *   2. Attaches a window blur listener (`window.addEventListener('blur', ...)`).
 *      - If the operating system launches the native WhatsApp Desktop application, the browser window
 *        loses focus (blurs) and any fallback is aborted.
 *      - If after 1800ms the browser window remains focused and active (indicating the Desktop App is not
 *        installed or registered for `whatsapp://`), it gracefully falls back to opening
 *        `https://web.whatsapp.com/send?phone=...` in a new tab.
 *
 * - On Mobile (Android/iOS):
 *   Directly attempts `whatsapp://` URI scheme targeting installed WhatsApp / WhatsApp Business,
 *   with an automatic 1500ms fallback to `https://api.whatsapp.com/send?phone=...` if the document is still active.
 *
 * @param phone Target customer mobile/WhatsApp number
 * @param message Prepared text payload (encoded for transport)
 */
export const openWhatsAppChat = (phone: string, message: string) => {
  const cleanPhone = sanitizeWhatsAppPhone(phone) || '';
  const encodedMessage = encodeURIComponent(message);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  );

  const nativeUri = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;

  if (isMobile) {
    // Native application URI scheme targeting installed WhatsApp / WhatsApp Business
    const webFallbackUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
    const startTime = Date.now();

    window.location.href = nativeUri;

    // Provide automatic timeout fallback: if custom scheme doesn't open within 1.5 seconds, redirect to web API
    setTimeout(() => {
      // If user navigated away or switched apps, document becomes hidden; if still active after 1500ms, redirect
      if (document.hidden || Date.now() - startTime > 2500) {
        return;
      }
      window.location.href = webFallbackUrl;
    }, 1500);
  } else {
    // Desktop (Windows / macOS / Linux)
    const desktopFallbackUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
    let hasBlurred = false;

    const cleanup = () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onBlur);
    };

    const onBlur = () => {
      hasBlurred = true;
      cleanup();
    };

    window.addEventListener('blur', onBlur, { once: true });
    window.addEventListener('pagehide', onBlur, { once: true });

    // Directly attempt native protocol scheme
    window.location.href = nativeUri;

    // Blur detector fallback: if window remains focused and active after 1800ms, open Web WhatsApp in new tab
    setTimeout(() => {
      cleanup();
      const isStillFocused = !hasBlurred && !document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true);
      if (isStillFocused) {
        window.open(desktopFallbackUrl, '_blank', 'noopener,noreferrer');
      }
    }, 1800);
  }
};

/**
 * Format timestamp to standard 'YYYY-MM-DD' representation (e.g., '2026-10-07')
 * for uniform presentation in customer WhatsApp receipts.
 */
const formatWhatsAppReturnDate = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const formatWhatsAppReturnDateTime = formatWhatsAppReturnDate;

/**
 * 1. Build Customer POS Invoice Receipt (Supports Wholesale/Retail modes, exact timestamps & dynamic Return Adjustments)
 *
 * Dynamic Return Calculations & Formatting:
 * - Detects presence of return events on `order.returns` or structured `order.notes` JSON.
 * - Extracts each return transaction and renders an itemized "*ITEM RETURN ADJUSTMENT HISTORY:*" ledger.
 * - Formats each line entry with return date `[YYYY-MM-DD]`, item name, variant descriptor,
 *   reason, quantity, and negative credit deduction.
 * - Summarizes cumulative "*Total Return Deductions: - Rs. X*".
 * - Reconciles financial summary with "*Original Bill*", "*Net Total Bill*", "*Paid Amount*",
 *   "*This Bill Due*", and live "*Total Outstanding Due*" customer debt.
 */
export const generateCustomerInvoiceWhatsAppMessage = (order: any): string => {
  // Case-insensitive check to guarantee wholesale detection across all payloads
  const isWholesale =
    order.source === 'POS_WHOLESALE' ||
    String(order.source || '').toUpperCase().includes('WHOLESALE') ||
    order.orderType === 'WHOLESALE';
  const invoiceNo = order.id ? `INV${order.id}` : 'NEW';

  // Format yyyy-mm-dd with exact current/order time
  const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const yyyy = createdDate.getFullYear();
  const mm = String(createdDate.getMonth() + 1).padStart(2, '0');
  const dd = String(createdDate.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}-${mm}-${dd}`;
  const formattedTime = createdDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const custName = order.customerName || order.customer?.name || 'Valued Customer';
  const total = Number(order.totalAmount || 0);
  const paid = Number(order.paidAmount || 0);
  const due = Math.max(0, total - paid);
  const totalCustomerDebt = Number(order.customer?.outstandingBalance || 0);
  const discountVal = Number(order.discount || 0);
  const subtotalVal = Number(order.subtotal || (total + discountVal) || 0);
  const percent = order.discountRate !== undefined && Number(order.discountRate) > 0
    ? Number(order.discountRate)
    : (subtotalVal > 0 && discountVal > 0 ? Math.round((discountVal / subtotalVal) * 100) : 0);
  const discountLabel = percent > 0 ? `Discount (${percent}%):` : 'Discount:';

  // Resolve payment method label (CASH, CHEQUE, CREDIT)
  const paymentMethod = order.paymentMethod ? String(order.paymentMethod).toUpperCase() : 'CASH';

  // 1. Detect returns from order.returns or structured order.notes JSON
  let returnsList: any[] = [];
  if (Array.isArray(order.returns) && order.returns.length > 0) {
    returnsList = order.returns;
  } else if (order.notes) {
    try {
      let current: any = order.notes;
      while (typeof current === 'string' && current.trim().startsWith('{')) {
        current = JSON.parse(current);
      }
      if (typeof current === 'object' && current !== null && Array.isArray(current.returns)) {
        returnsList = current.returns;
      }
    } catch {
      // Keep empty if unparseable
    }
  }

  // Consolidate duplicate return items occurring on the exact same date with identical variant and reason
  interface ConsolidatedWhatsAppReturnRow {
    returnDateStr: string;
    productName: string;
    variantName?: string;
    sku?: string;
    reason: string;
    totalQty: number;
    totalRefund: number;
  }

  const returnMap = new Map<string, ConsolidatedWhatsAppReturnRow>();
  let totalReturnCredit = 0;

  for (const ret of returnsList) {
    const returnDateStr = formatWhatsAppReturnDate(ret.returnDate || ret.createdAt || ret.date || order.createdAt);
    const retReason = (ret.reason || 'Return').trim();
    totalReturnCredit += Number(ret.totalReturnRefund || 0);

    if (Array.isArray(ret.returnedItems)) {
      for (const item of ret.returnedItems) {
        const itemReason = (item.reason || retReason).trim();
        const variantIdentifier = item.variantId !== undefined && item.variantId !== null
          ? String(item.variantId)
          : (item.sku || `${item.productName || item.name || 'Garment Item'}_${item.variantName || ''}`);
        const groupKey = `${returnDateStr}_${variantIdentifier}_${itemReason}`;

        const qty = Number(item.returnQty ?? item.quantity ?? 1);
        const amt = Number(item.refundAmount ?? item.amount ?? 0);

        if (returnMap.has(groupKey)) {
          const existing = returnMap.get(groupKey)!;
          existing.totalQty += qty;
          existing.totalRefund += amt;
        } else {
          returnMap.set(groupKey, {
            returnDateStr,
            productName: item.productName || item.name || 'Garment Item',
            variantName: item.variantName || '',
            sku: item.sku || '',
            reason: itemReason,
            totalQty: qty,
            totalRefund: amt,
          });
        }
      }
    }
  }

  const consolidatedReturns = Array.from(returnMap.values());
  const hasReturns = returnsList.length > 0 && consolidatedReturns.length > 0;
  if (totalReturnCredit === 0 && consolidatedReturns.length > 0) {
    totalReturnCredit = consolidatedReturns.reduce((acc, r) => acc + r.totalRefund, 0);
  }

  let returnedItemsText = '';
  if (hasReturns) {
    const returnLines = consolidatedReturns.map((item) => {
      const vDesc = item.variantName ? ` (${item.variantName})` : (item.sku ? ` (${item.sku})` : '');
      const amt = Number(item.totalRefund || 0).toLocaleString('en-LK');
      return `• [${item.returnDateStr}] ${item.productName}${vDesc} [${item.reason}] - ${item.totalQty} pcs (- Rs. ${amt})`;
    });

    if (returnLines.length > 0) {
      returnedItemsText = returnLines.join('\n');
    }
  }

  const originalBill = order.originalTotalAmount !== undefined
    ? Number(order.originalTotalAmount)
    : (total + totalReturnCredit);

  let itemsList = '';
  if (Array.isArray(order.items)) {
    itemsList = order.items
      .map((item: any, i: number) => {
        const name = item.variant?.product?.name || item.name || 'Garment Item';
        const size = item.size || item.selectedSize || item.variant?.size || '';
        const color = item.color || item.selectedColor || item.variant?.color || '';
        const meta = size || color ? ` (${size}/${color})` : '';
        const unitPrice = Number(item.unitPrice || (item.quantity ? item.price / item.quantity : 0)).toLocaleString('en-LK');
        const itemDisc = Number(item.discount || 0);
        const discText = itemDisc > 0 ? ` (Disc: -Rs. ${itemDisc.toLocaleString('en-LK')})` : '';
        const lineTotal = Number(item.price || (Number(item.unitPrice || 0) * Number(item.quantity || 1) - itemDisc)).toLocaleString('en-LK');
        return `${i + 1}. *${name}*${meta}\n   ${item.quantity} pcs x Rs. ${unitPrice}${discText} = *Rs. ${lineTotal}*`;
      })
      .join('\n');
  }

  // Dynamic header based on retail vs wholesale mode
  const titleHeader = isWholesale
    ? `*RELIANCE CLOTHING - WHOLESALE INVOICE*`
    : `*RELIANCE CLOTHING - INVOICE RECEIPT*`;

  let text = `${titleHeader}\n`;
  text += `-------------------------------------------\n`;
  text += `*Invoice No:* #${invoiceNo}\n`;
  text += `*Date:* ${formattedDate} (${formattedTime})\n`;
  text += `*Billing Type:* ${isWholesale ? 'WHOLESALE' : 'RETAIL'}\n`;
  text += `*Customer:* ${custName}\n`;
  text += `*Payment Method:* ${paymentMethod}\n`;
  text += `-------------------------------------------\n\n`;
  text += `*PURCHASED ITEMS:*\n${itemsList || '- No items recorded -'}\n\n`;

  if (hasReturns) {
    text += `-------------------------------------------\n`;
    text += `*ITEM RETURN ADJUSTMENT HISTORY:*\n`;
    text += `${returnedItemsText || '- No return items recorded -\n'}\n`;
    text += `*Total Return Deductions:* - Rs. ${totalReturnCredit.toLocaleString('en-LK')}\n`;
    text += `-------------------------------------------\n`;
    text += `*Original Bill:* Rs. ${originalBill.toLocaleString('en-LK')}\n`;
    text += `*Net Total Bill:* Rs. ${total.toLocaleString('en-LK')}\n`;
    text += `*Paid Amount:* Rs. ${paid.toLocaleString('en-LK')}\n`;
    text += `*This Bill Due:* Rs. ${due.toLocaleString('en-LK')}\n`;
    if (totalCustomerDebt > 0) {
      text += `*Total Outstanding Due:* Rs. ${totalCustomerDebt.toLocaleString('en-LK')}\n`;
    }
  } else {
    text += `-------------------------------------------\n`;
    if (discountVal > 0) {
      text += `*Subtotal:* Rs. ${subtotalVal.toLocaleString('en-LK')}\n`;
      text += `*${discountLabel}* - Rs. ${discountVal.toLocaleString('en-LK')}\n`;
      text += `*Net Total:* Rs. ${total.toLocaleString('en-LK')}\n`;
    } else {
      text += `*Total Bill:* Rs. ${total.toLocaleString('en-LK')}\n`;
    }
    text += `*Paid Amount (${paymentMethod}):* Rs. ${paid.toLocaleString('en-LK')}\n`;

    if (due > 0) {
      text += `*This Bill Due (Credit):* Rs. ${due.toLocaleString('en-LK')}\n`;
    }
    if (totalCustomerDebt > 0 && totalCustomerDebt !== due) {
      text += `*Total Outstanding Due:* Rs. ${totalCustomerDebt.toLocaleString('en-LK')}\n`;
    }
  }

  text += `-------------------------------------------\n`;
  text += `*Store:* Makandura, Matara\n`;
  text += `*Tel:* 041-2268739 / 071-1350123\n`;
  text += `_Thank you for your business with Reliance Clothing!_`;

  return text;
};

/**
 * 2. Build Comprehensive Customer Outstanding Account Statement with Detailed Invoice Breakdown
 */
export const generateCustomerDebtSummaryWhatsAppMessage = (
  cust: { name: string; outstandingBalance: number; phone?: string },
  invoices: any[] = []
): string => {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  let text = `*RELIANCE CLOTHING - OUTSTANDING DUE STATEMENT*\n`;
  text += `-------------------------------------------\n`;
  text += `*Customer:* ${cust.name}\n`;
  if (cust.phone) text += `*Contact:* ${cust.phone}\n`;
  text += `*Statement Date:* ${currentDate} (${currentTime})\n`;
  text += `*TOTAL OUTSTANDING BALANCE:* *Rs. ${Number(cust.outstandingBalance || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}*\n`;
  text += `-------------------------------------------\n\n`;

  if (Array.isArray(invoices) && invoices.length > 0) {
    text += `*PENDING UNPAID INVOICES (${invoices.length}):*\n`;
    invoices.forEach((inv, i) => {
      const invNo = inv.invoiceNo || inv.invoiceNumber || `INV${inv.id || inv.orderId}`;
      const rawDate = inv.createdAt || inv.date;
      const invDate = rawDate ? new Date(rawDate).toISOString().split('T')[0] : currentDate;
      const total = Number(inv.totalAmount || inv.total || 0).toLocaleString('en-LK');
      const paid = Number(inv.paidAmount || inv.paid || 0).toLocaleString('en-LK');
      const due = Number(inv.dueAmount || inv.due || (inv.totalAmount - inv.paidAmount) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 });
      const billingType = inv.source === 'POS_WHOLESALE' ? '[WHOLESALE]' : '[RETAIL]';

      text += `${i + 1}. *#${invNo}* ${billingType}\n`;
      text += `   Date: ${invDate} | Bill: Rs. ${total} | Paid: Rs. ${paid}\n`;
      text += `   *Remaining Due: Rs. ${due}*\n\n`;
    });
  } else {
    text += `_All prior invoices are fully settled._\n\n`;
  }

  text += `-------------------------------------------\n`;
  text += `Please arrange settlement at your earliest convenience.\n`;
  text += `*Bank Transfer / Inquiries:* 041-2268739 / 071-1350123\n`;
  text += `*Store:* Mawarala Road, Makandura, Matara.\n`;
  text += `_Thank you for your valued partnership!_`;

  return text;
};

/**
 * 3. Build Raw Material Stock-In Purchase Notice (To Supplier)
 */
export const generateSupplierStockInWhatsAppMessage = (purchase: any): string => {
  const invNo = purchase.invoiceNumber || `PO-${purchase.id || 'NEW'}`;
  const dateStr = purchase.purchaseDate
    ? new Date(purchase.purchaseDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const shopName = purchase.shop?.name || 'Supplier Partner';
  const total = Number(purchase.totalAmount || 0);
  const paid = Number(purchase.paidAmount || 0);
  const due = Math.max(0, total - paid);

  let itemsList = '';
  if (Array.isArray(purchase.items)) {
    itemsList = purchase.items
      .map((item: any, i: number) => {
        const name = item.rawMaterialItem?.name || item.name || 'Raw Material';
        const unit = item.rawMaterialItem?.unit || '';
        return `${i + 1}. *${name}*: ${item.quantity} ${unit.toLowerCase()} @ Rs. ${Number(item.pricePerUnit).toLocaleString()} = Rs. ${Number(item.rowTotal).toLocaleString()}`;
      })
      .join('\n');
  }

  const paymentMethod = purchase.paymentMethod ? String(purchase.paymentMethod).toUpperCase() : 'CASH';

  let text = `*RELIANCE MANUFACTURING - MATERIAL STOCK-IN*\n`;
  text += `-------------------------------------------\n`;
  text += `*Supplier:* ${shopName}\n`;
  text += `*Invoice / PO Ref:* ${invNo}\n`;
  text += `*Date:* ${dateStr}\n`;
  text += `*Payment Method:* ${paymentMethod}\n`;
  text += `-------------------------------------------\n\n`;
  text += `*MATERIALS RECEIVED:*\n${itemsList || '- No items list -'}\n\n`;
  text += `-------------------------------------------\n`;
  text += `*Total Invoice Value:* Rs. ${total.toLocaleString()}\n`;
  text += `*Paid Amount:* Rs. ${paid.toLocaleString()}\n`;
  if (due > 0) {
    text += `*Recorded Credit (Due):* Rs. ${due.toLocaleString()}\n`;
  } else {
    text += `*Payment Status:* Fully Settled\n`;
  }
  text += `-------------------------------------------\n`;
  text += `Reliance Manufacturing Division, Makandura.`;

  return text;
};

/**
 * 4. Build Supplier Payable Credit Ledger Statement
 */
export const generateSupplierCreditSummaryWhatsAppMessage = (
  shop: { name: string; creditBalance: number }
): string => {
  let text = `*RELIANCE MANUFACTURING - PAYABLE LEDGER BALANCE*\n`;
  text += `-------------------------------------------\n`;
  text += `*Supplier Shop:* ${shop.name}\n`;
  text += `*As of:* ${new Date().toISOString().split('T')[0]}\n`;
  text += `-------------------------------------------\n\n`;
  text += `*CURRENT OUTSTANDING CREDIT TO PAY:*\n`;
  text += `*Rs. ${Number(shop.creditBalance).toLocaleString()}*\n\n`;
  text += `Payment schedule inquiry and reconciliation confirmation.\n`;
  text += `*Finance Dept:* 041-2268739`;

  return text;
};

/**
 * Safely extracts human-readable user notes from an order notes payload.
 * Handles both plain strings and JSON objects/serialized strings containing system metadata
 * (e.g. `{"userNotes":"...","discountType":"PERCENT"...}`), strictly preventing raw JSON
 * structures from leaking into client-facing WhatsApp receipts.
 *
 * @param notesRaw Raw order notes string or metadata object
 * @returns Sanitized plaintext user notes, or an empty string if absent/empty
 */
export const extractCleanUserNotes = (notesRaw?: any): string => {
  if (!notesRaw) return '';

  // Handle parsed object payload
  if (typeof notesRaw === 'object' && notesRaw !== null) {
    return typeof notesRaw.userNotes === 'string' ? notesRaw.userNotes.trim() : '';
  }

  const trimmed = String(notesRaw).trim();
  if (!trimmed) return '';

  // Check for serialized JSON string payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.userNotes === 'string') {
          return parsed.userNotes.trim();
        }
        // Metadata object without user notes (e.g., only discount settings)
        return '';
      }
    } catch {
      // If parsing fails but looks like serialized JSON containing userNotes or discountType, suppress it
      if (trimmed.includes('"userNotes"') || trimmed.includes('"discountType"')) {
        return '';
      }
      return trimmed;
    }
  }

  // Fallback check against raw JSON text artifacts
  if (trimmed.startsWith('{"') || (trimmed.includes('{"userNotes"') && trimmed.includes('}'))) {
    return '';
  }

  return trimmed;
};

/**
 * 5. Build Formatted Presales Order Summary for Customer WhatsApp Dispatch.
 * Safely parses serialized order notes to extract only plaintext user instructions,
 * preventing JSON metadata leak, and conditionally displays discount breakdowns.
 *
 * @param order Presales order object containing items, customer info, and financials
 * @returns Clean, formatted WhatsApp message string
 */
export const generateSalesOrderWhatsAppMessage = (order: any): string => {
  const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const yyyy = createdDate.getFullYear();
  const mm = String(createdDate.getMonth() + 1).padStart(2, '0');
  const dd = String(createdDate.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}-${mm}-${dd}`;
  const formattedTime = createdDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const orderNo = order.orderNumber || `ORD-${order.id || ''}`;
  const custName = order.customerName || order.customer?.name || 'Valued Customer';
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.totalAmount || (subtotal - discount) || 0);
  const status = String(order.status || 'PENDING').toUpperCase();

  let itemsList = '';
  if (Array.isArray(order.items)) {
    itemsList = order.items
      .map((item: any, i: number) => {
        const name = item.productName || item.variant?.product?.name || 'Garment Item';
        const meta = item.variantName ? ` (${item.variantName})` : (item.sku ? ` (${item.sku})` : '');
        const unitPrice = Number(item.unitPrice || 0).toLocaleString('en-LK');
        const qty = Number(item.quantity || 1);
        const itemDisc = Number(item.discount || 0);
        const discText = itemDisc > 0 ? ` (Disc: -Rs. ${itemDisc.toLocaleString('en-LK')})` : '';
        const lineTotal = Number(item.totalPrice || (qty * (Number(item.unitPrice) || 0) - itemDisc)).toLocaleString('en-LK');
        return `${i + 1}. *${name}*${meta}\n   ${qty} pcs x Rs. ${unitPrice}${discText} = *Rs. ${lineTotal}*`;
      })
      .join('\n');
  }

  let text = `*RELIANCE CLOTHING - PRESALES ORDER*\n`;
  text += `-------------------------------------------\n`;
  text += `*Order No:* #${orderNo}\n`;
  text += `*Date:* ${formattedDate} (${formattedTime})\n`;
  text += `*Status:* ${status}\n`;
  text += `*Customer:* ${custName}\n`;
  if (order.customerPhone || order.customer?.phone) {
    text += `*Contact:* ${order.customerPhone || order.customer?.phone}\n`;
  }
  if (order.user?.name) {
    text += `*Sales Rep:* ${order.user.name}\n`;
  }
  text += `-------------------------------------------\n\n`;
  text += `*BOOKED ORDER ITEMS:*\n${itemsList || '- No items recorded -'}\n\n`;
  text += `-------------------------------------------\n`;

  // Conditionally render Subtotal and Discount ONLY if an applied discount exists and is > 0
  if (discount > 0) {
    if (subtotal > 0) {
      text += `*Subtotal:* Rs. ${subtotal.toLocaleString('en-LK')}\n`;
    }
    text += `*Discount:* - Rs. ${discount.toLocaleString('en-LK')}\n`;
  }
  text += `*Total Order Value:* *Rs. ${total.toLocaleString('en-LK')}*\n`;

  // Safely extract and render user-entered notes only; suppresses raw JSON metadata
  const userNotes = extractCleanUserNotes(order.notes);
  if (userNotes) {
    text += `*Notes:* ${userNotes}\n`;
  }

  text += `-------------------------------------------\n`;
  text += `*Reliance Clothing*, Makandura, Matara.\n`;
  text += `*Tel:* 041-2268739 / 071-1350123\n`;
  text += `_Thank you for your order! This booking will be processed and dispatched soon._`;

  return text;
};