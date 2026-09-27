/**
 * WhatsApp Dispatcher Utility Engine
 * Sanitizes phone numbers to International format and builds structured receipt texts without emojis.
 */

export const sanitizeWhatsAppPhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+94')) return cleaned.replace('+', '');
  if (cleaned.startsWith('0') && cleaned.length === 10) return `94${cleaned.slice(1)}`;
  if (cleaned.startsWith('94') && cleaned.length === 11) return cleaned;
  return cleaned.length >= 9 ? cleaned : null;
};

export const openWhatsAppChat = (phone: string, message: string) => {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);
  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * 1. Build Customer POS Invoice Receipt (Supports Wholesale/Retail modes & exact yyyy-mm-dd timestamps)
 */
export const generateCustomerInvoiceWhatsAppMessage = (order: any): string => {
  const isWholesale = order.source === 'POS_WHOLESALE' || order.orderType === 'WHOLESALE';
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

  // Resolve payment method label (CASH, CHEQUE, CREDIT)
  const paymentMethod = order.paymentMethod ? String(order.paymentMethod).toUpperCase() : 'CASH';

  let itemsList = '';
  if (Array.isArray(order.items)) {
    itemsList = order.items
      .map((item: any, i: number) => {
        const name = item.variant?.product?.name || item.name || 'Garment Item';
        const size = item.variant?.size || item.size || '';
        const color = item.variant?.color || item.color || '';
        const meta = size || color ? ` (${size}/${color})` : '';
        const unitPrice = Number(item.unitPrice || (item.quantity ? item.price / item.quantity : 0)).toLocaleString();
        const lineTotal = Number(item.price || item.unitPrice * item.quantity).toLocaleString();
        return `${i + 1}. *${name}*${meta}\n   ${item.quantity} pcs x Rs. ${unitPrice} = *Rs. ${lineTotal}*`;
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
  text += `-------------------------------------------\n`;
  text += `*Total Bill:* Rs. ${total.toLocaleString()}\n`;
  text += `*Paid Amount (${paymentMethod}):* Rs. ${paid.toLocaleString()}\n`;

  if (due > 0) {
    text += `*This Bill Due (Credit):* Rs. ${due.toLocaleString()}\n`;
  }
  if (totalCustomerDebt > 0 && totalCustomerDebt !== due) {
    text += `*Total Outstanding Due:* Rs. ${totalCustomerDebt.toLocaleString()}\n`;
  }

  text += `-------------------------------------------\n`;
  text += `*Store:* Makandura, Matara\n`;
  text += `*Tel:* 041-2268739 / 071-1350123\n`;
  text += `_Thank you for your business with Reliance Clothing!_`;

  return text;
};

/**
 * 2. Build Customer Outstanding Account Statement
 */
export const generateCustomerDebtSummaryWhatsAppMessage = (
  cust: { name: string; outstandingBalance: number; phone?: string },
  invoices: any[] = []
): string => {
  let text = `*RELIANCE CLOTHING - ACCOUNT STATEMENT*\n`;
  text += `-------------------------------------------\n`;
  text += `*Customer:* ${cust.name}\n`;
  text += `*Date:* ${new Date().toISOString().split('T')[0]}\n`;
  text += `*TOTAL DUE BALANCE:* Rs. ${Number(cust.outstandingBalance).toLocaleString()}\n`;
  text += `-------------------------------------------\n\n`;

  if (invoices.length > 0) {
    text += `*PENDING UNPAID INVOICES:*\n`;
    invoices.forEach((inv, i) => {
      const billDue = (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0);
      text += `${i + 1}. *${inv.invoiceNo || `INV${inv.id}`}* (${new Date(inv.createdAt).toISOString().split('T')[0]}) - Due: *Rs. ${billDue.toLocaleString()}*\n`;
    });
    text += `\n`;
  }

  text += `Please arrange settlement at your earliest convenience.\n`;
  text += `*Accounts Contact:* 071-1350123 / 041-2268739\n`;
  text += `_Thank you!_`;

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