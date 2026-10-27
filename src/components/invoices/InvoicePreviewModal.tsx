import React from 'react';
import { A4InvoiceModal, type InvoiceModalProps } from '../pos/A4InvoiceModal';

/**
 * InvoicePreviewModal — Aliases and exports the primary invoice preview and print modal
 * with full fallback address & customer matching support.
 */
export const InvoicePreviewModal: React.FC<InvoiceModalProps> = (props) => {
  return <A4InvoiceModal {...props} />;
};

export default InvoicePreviewModal;
