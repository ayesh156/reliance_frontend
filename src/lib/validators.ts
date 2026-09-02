/**
 * Client-side validation for Sri Lankan National Identity Card (NIC)
 */
export const isValidSriLankanNIC = (nic: string): boolean => {
  const clean = nic.trim().toUpperCase();
  const oldNicRegex = /^[0-9]{9}[VX]$/;
  const newNicRegex = /^[0-9]{12}$/;
  return oldNicRegex.test(clean) || newNicRegex.test(clean);
};

/**
 * Client-side validation for Sri Lankan Mobile and Landline phone numbers
 */
export const isValidSriLankanPhone = (phone: string): boolean => {
  const clean = phone.replace(/[\s-]/g, '');
  const phoneRegex = /^(?:0|(\+94))[1-9][0-9]{8}$/;
  return phoneRegex.test(clean);
};