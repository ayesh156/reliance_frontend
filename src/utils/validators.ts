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

/**
 * Frontend Enterprise Pricing & Stock Validators
 */
export const sanitizePrice = (val: any): number => {
  const num = parseFloat(String(val));
  return isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
};

export const sanitizeStock = (val: any): number => {
  const num = parseInt(String(val), 10);
  return isNaN(num) || num < 0 ? 0 : num;
};

/**
 * Stock Adjustment (+/-) අනුව නව stock අගය ගණනය කර සෘණ අගයන් වැළැක්වීම
 */
export const calculateAdjustedStock = (
  currentStock: number,
  adjustmentInput: string | number
): { finalStock: number; isValid: boolean; error?: string } => {
  const current = sanitizeStock(currentStock);
  const adjStr = String(adjustmentInput).trim();

  if (!adjStr || adjStr === '0' || adjStr === '+' || adjStr === '-') {
    return { finalStock: current, isValid: true };
  }

  const adj = parseInt(adjStr, 10);
  if (isNaN(adj)) {
    return { finalStock: current, isValid: false, error: 'වලංගු නොවන අංකයකි' };
  }

  const result = current + adj;
  if (result < 0) {
    return {
      finalStock: current,
      isValid: false,
      error: `දැනට ඇත්තේ ${current} කි. ${Math.abs(adj)} කින් අඩු කළ නොහැක.`,
    };
  }

  return { finalStock: result, isValid: true };
};

/**
 * Product Form Input Validations
 */
export const validateProductForm = (
  name: string,
  categoryId: number | string,
  variantsCount: number
): { isValid: boolean; error?: string } => {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'භාණ්ඩයේ නම (Product Title) ඇතුළත් කිරීම අනිවාර්යයි.' };
  }
  if (name.trim().length < 2) {
    return { isValid: false, error: 'භාණ්ඩයේ නමට අවම වශයෙන් අකුරු 2ක් වත් තිබිය යුතුය.' };
  }
  const catNum = Number(categoryId);
  if (isNaN(catNum) || catNum <= 0) {
    return { isValid: false, error: 'වලංගු Category එකක් තෝරා ගැනීම අනිවාර්යයි.' };
  }
  if (variantsCount === 0) {
    return { isValid: false, error: 'අවම වශයෙන් එක් Product Variant එකක් වත් පැවතිය යුතුය.' };
  }
  return { isValid: true };
};