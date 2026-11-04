import React from 'react';
import { InvoicesPage } from './InvoicesPage';

export { InvoicesPage };

/**
 * Sales & Invoices Management Page with Dedicated Right-Side Actions,
 * Period-Selector Financial Audit, and Master Audit PDF generation.
 */
export const SalesInvoicesPage: React.FC = () => {
  return <InvoicesPage />;
};

export default SalesInvoicesPage;

