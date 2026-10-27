/**
 * Customer Address & City Fallback Resolution Utility
 * 
 * Implements thorough fallback chain:
 * [order.shippingAddress, order.customer?.address, matchedCustomer?.address, order.city, order.customer?.city, matchedCustomer?.city]
 * Combining address and city cleanly without duplicates, and looking up customer from customer list if needed.
 */

export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '').slice(-9);
}

export function resolveMatchedCustomer(
  order: any,
  matchedCustomer?: any,
  allCustomers?: any[]
): any | null {
  if (matchedCustomer) return matchedCustomer;
  if (order?.customer) return order.customer;
  if (!Array.isArray(allCustomers) || allCustomers.length === 0) return null;

  // 1. By customerId
  if (order?.customerId) {
    const found = allCustomers.find((c) => Number(c.id) === Number(order.customerId));
    if (found) return found;
  }

  // 2. By phone number (normalized 9 digits)
  const orderPhoneNorm = normalizePhoneNumber(order?.customerPhone || order?.phone);
  if (orderPhoneNorm) {
    const found = allCustomers.find((c) => normalizePhoneNumber(c.phone) === orderPhoneNorm);
    if (found) return found;
  }

  // 3. By customer name (case-insensitive, ignoring "walk-in")
  const orderName = (order?.customerName || order?.name || '').trim().toLowerCase();
  if (orderName && orderName !== 'walk-in customer' && orderName !== 'walk-in') {
    const found = allCustomers.find((c) => c.name?.trim().toLowerCase() === orderName);
    if (found) return found;
  }

  return null;
}

export function formatCustomerAddressCity(
  order: any,
  matchedCustomer?: any,
  allCustomers?: any[]
): string {
  if (!order) return '-';

  const cust = resolveMatchedCustomer(order, matchedCustomer, allCustomers);

  const rawAddress = (
    order.shippingAddress ||
    order.customerAddress ||
    cust?.address ||
    matchedCustomer?.address ||
    ''
  ).trim();

  const rawCity = (
    order.city ||
    order.customerCity ||
    cust?.city ||
    matchedCustomer?.city ||
    ''
  ).trim();

  if (!rawAddress && !rawCity) {
    return '-';
  }

  if (rawAddress && !rawCity) {
    return rawAddress;
  }

  if (!rawAddress && rawCity) {
    return rawCity;
  }

  // Avoid repeating city if already part of address (e.g. "Chilaw Road Bingiriya" and "Bingiriya")
  if (rawAddress.toLowerCase().includes(rawCity.toLowerCase())) {
    return rawAddress;
  }

  return `${rawAddress}, ${rawCity}`;
}
