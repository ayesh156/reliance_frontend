import { generatePrintableInvoiceHtml } from '../components/pos/A4InvoiceModal';
import { generate80mmThermalReceiptHtml } from './thermalReceipt';

export type PrintFormat = 'a4' | 'thermal-80mm';

export const PRINT_FORMAT_STORAGE_KEY = 'reliance_default_print_format';

/**
 * Resolves the effective invoice print format:
 * 1. Checks user preference override in localStorage ('reliance_default_print_format')
 * 2. If unset or invalid, falls back to role-based default:
 *    - 'thermal-80mm' for 'REP' (Sales Representative)
 *    - 'a4' for all other roles ('ADMIN', 'CASHIER', 'STORE_KEEPER', etc.)
 */
export const getEffectivePrintFormat = (userRole?: string | null): PrintFormat => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(PRINT_FORMAT_STORAGE_KEY);
      if (saved === 'thermal-80mm' || saved === 'a4') {
        return saved as PrintFormat;
      }
    } catch (e) {
      console.warn('Unable to access localStorage for print format:', e);
    }
  }
  // Role-based default: REP -> thermal-80mm, all others -> a4
  return (userRole || '').toUpperCase() === 'REP' ? 'thermal-80mm' : 'a4';
};

/**
 * Persists the user's explicit invoice print format preference in client-side storage.
 */
export const setStoredPrintFormat = (format: PrintFormat): void => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PRINT_FORMAT_STORAGE_KEY, format);
    } catch (e) {
      console.warn('Unable to save print format to localStorage:', e);
    }
  }
};

/**
 * Technical Specification for Headless Direct Browser Printing:
 *
 * Instead of mounting an intermediate UI modal dialog (which forces the cashier/user
 * to view an on-screen preview and subsequently click 'Close' or 'Print'), this utility
 * generates the exact invoice HTML document and injects it into a transient,
 * off-screen hidden <iframe>.
 *
 * Lifecycle Execution Flow:
 * 1. Creates a transient sandbox iframe positioned offscreen (0x0px, hidden visibility, aria-hidden).
 * 2. Injects the self-contained printable HTML document generated from the saved order entity.
 * 3. Sets the window/iframe title to `Invoice-INV${order.id}` or `Receipt-INV${order.id}` so native
 *    "Save as PDF" / print drivers automatically propose the clean filename.
 * 4. Allows a brief delay (300ms) for printer fonts, layout box trees, and assets to rasterize.
 * 5. Focuses the iframe window and invokes native `iframeWin.print()`.
 * 6. Listens for the standard `afterprint` event on both iframe and parent window to cleanly remove
 *    the transient iframe from the DOM and invoke `onComplete` (e.g. redirecting to /system/invoices
 *    when editing, or bootstrapping POS for the next order).
 */
function printHtmlDirectly(html: string, suggestedFileName: string, onComplete?: () => void): void {
  try {
    const originalDocTitle = document.title;

    // Create a hidden, sandboxed off-screen iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'headless-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');

    document.body.appendChild(iframe);

    let hasCleanedUp = false;
    const cleanup = () => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;

      // Restore parent document title
      document.title = originalDocTitle;

      // Clean up event listeners
      try {
        window.removeEventListener('afterprint', cleanup);
      } catch {}

      // Remove transient iframe from DOM
      try {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      } catch (err) {
        console.warn('Print iframe removal notice:', err);
      }

      // Execute post-print completion callback (navigation / POS reset)
      if (onComplete) {
        onComplete();
      }
    };

    const triggerPrint = () => {
      try {
        const iframeWin = iframe.contentWindow;
        if (!iframeWin) {
          cleanup();
          return;
        }

        // Set document title on parent and iframe so "Save to PDF" uses a clean filename
        document.title = suggestedFileName;
        if (iframeWin.document) {
          iframeWin.document.title = suggestedFileName;
        }

        // Attach afterprint event listener on both iframe and parent window
        iframeWin.addEventListener('afterprint', cleanup);
        window.addEventListener('afterprint', cleanup);

        iframeWin.focus();
        iframeWin.print();

        // Safety fallback: in Chromium, print() blocks until modal is dismissed;
        // if afterprint didn't fire or was bypassed, ensure cleanup occurs cleanly
        setTimeout(() => {
          cleanup();
        }, 1200);
      } catch (err) {
        console.error('Error invoking native browser print:', err);
        cleanup();
      }
    };

    // Inject generated HTML document into iframe
    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Allow 300ms for typography, CSS styles, and assets to render before opening print dialog
      setTimeout(triggerPrint, 300);
    } else {
      iframe.srcdoc = html;
      iframe.onload = () => {
        setTimeout(triggerPrint, 300);
      };
    }
  } catch (error) {
    console.error('Failed to prepare print document:', error);
    if (onComplete) {
      onComplete();
    }
  }
}

/**
 * Prints standard A4 customer invoice directly via offscreen headless iframe.
 */
export const printInvoiceDirectly = (
  order: any,
  onComplete?: () => void,
  matchedCustomer?: any,
  allCustomers?: any[]
): void => {
  if (!order) {
    if (onComplete) onComplete();
    return;
  }
  const html = generatePrintableInvoiceHtml(order, matchedCustomer, allCustomers);
  const rawId = order.id || order.invoiceNumber || order.orderNumber || String(Date.now()).slice(-4);
  const invoiceNo = `INV${String(rawId).replace('#', '')}`;
  printHtmlDirectly(html, `Invoice-${invoiceNo}`, onComplete);
};

/**
 * Prints 80mm POS Thermal Receipt directly via offscreen headless iframe.
 * Tailored for the Xprinter XP-P801A (80mm portable Bluetooth/USB thermal printer).
 * 72mm printable width / 576 dots with strict English layout and live ledger synchronization.
 */
export const print80mmThermalReceiptDirectly = (
  order: any,
  onComplete?: () => void,
  matchedCustomer?: any,
  allCustomers?: any[]
): void => {
  if (!order) {
    if (onComplete) onComplete();
    return;
  }
  const html = generate80mmThermalReceiptHtml(order, matchedCustomer, allCustomers);
  const rawId = order.id || order.invoiceNumber || order.orderNumber || String(Date.now()).slice(-4);
  const invoiceNo = `INV${String(rawId).replace('#', '')}`;
  printHtmlDirectly(html, `Receipt-80mm-${invoiceNo}`, onComplete);
};

/**
 * Primary alias for 80mm thermal receipt printing.
 */
export const print80mmThermalReceipt = print80mmThermalReceiptDirectly;

/**
 * Intelligently prints order according to effective format (user override or role default).
 */
export const printOrderAccordingToPreference = (
  order: any,
  userRole?: string | null,
  onComplete?: () => void,
  matchedCustomer?: any,
  allCustomers?: any[]
): PrintFormat => {
  const format = getEffectivePrintFormat(userRole);
  if (format === 'thermal-80mm') {
    print80mmThermalReceiptDirectly(order, onComplete, matchedCustomer, allCustomers);
  } else {
    printInvoiceDirectly(order, onComplete, matchedCustomer, allCustomers);
  }
  return format;
};
