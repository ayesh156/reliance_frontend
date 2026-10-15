import { generatePrintableInvoiceHtml } from '../components/pos/A4InvoiceModal';

/**
 * Technical Specification for Headless Direct Browser Printing:
 *
 * Instead of mounting an intermediate UI modal dialog (which forces the cashier/user
 * to view an on-screen preview and subsequently click 'Close' or 'Print'), this utility
 * generates the exact A4 invoice HTML document and injects it into a transient,
 * off-screen hidden <iframe>.
 *
 * Lifecycle Execution Flow:
 * 1. Creates a transient sandbox iframe positioned offscreen (0x0px, hidden visibility, aria-hidden).
 * 2. Injects the self-contained printable A4 invoice HTML document generated from the saved order entity.
 * 3. Sets the window/iframe title to `Invoice-INV${order.id}` so native "Save as PDF" / print drivers
 *    automatically propose the clean invoice filename.
 * 4. Allows a brief delay (300ms) for printer fonts, layout box trees, and assets to rasterize.
 * 5. Focuses the iframe window and invokes native `iframeWin.print()`.
 * 6. Listens for the standard `afterprint` event on both iframe and parent window to cleanly remove
 *    the transient iframe from the DOM and invoke `onComplete` (e.g. redirecting to /system/invoices
 *    when editing, or bootstrapping POS for the next order).
 *
 * @param order - Fully hydrated invoice order object containing customer, items, and totals
 * @param onComplete - Optional callback invoked after printing completes or is dismissed
 */
export const printInvoiceDirectly = (order: any, onComplete?: () => void): void => {
  if (!order) {
    if (onComplete) onComplete();
    return;
  }

  try {
    const html = generatePrintableInvoiceHtml(order);
    const invoiceNo = `INV${order.id || String(Date.now()).slice(-4)}`;
    const suggestedFileName = `Invoice-${invoiceNo}`;
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
};
