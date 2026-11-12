/**
 * Universal Cheque Metadata Parser & Normalization Utility
 * Extracts Cheque #, Bank & Town, Maturity/Pass Date, Status, and Full Cheque Face Value
 * across all legacy and current payment reference and note string variations.
 */

export interface ParsedChequeInfo {
  chequeNumber?: string;
  bankAndTown?: string;
  bankName?: string;
  maturityDate?: string;
  chequeStatus?: string;
  fullChequeAmount?: number;
  residualNotes?: string;
}

/**
 * Universal helper that robustly extracts cheque particulars from payment records or receipts
 * regardless of how the metadata was stored (explicit fields, formatted strings, or loose text).
 *
 * Handles all observed production string formats:
 * - "000080 sampath bank - wariyapola"
 * - "Chq #000080 | Bank: sampath bank-wariyapola | Mat: 2027-01-05"
 * - "Cheque #143006 (DFCC Bank - Dambulla) Mat: 2027-01-08"
 * - "Chq #Chq #000080 | Bank: sampa"
 * - Explicit payment fields (chequeNumber, bankName, chequeDate, chequeStatus, fullChequeAmount)
 */
export function parseChequeMetadata(paymentOrReceipt: any): ParsedChequeInfo {
  if (!paymentOrReceipt) {
    return {};
  }

  const p = paymentOrReceipt;
  let chequeNumber = p.chequeNumber ? String(p.chequeNumber).trim() : '';
  let bankAndTown = p.bankName || p.branch || '';
  if (typeof bankAndTown === 'string') bankAndTown = bankAndTown.trim();
  let maturityDate = p.chequeDate || p.maturityDate || p.passDate || '';
  if (maturityDate) {
    maturityDate = String(maturityDate).split('T')[0].trim();
  }
  let chequeStatus = p.chequeStatus || p.status || '';
  let fullChequeAmount = p.fullChequeAmount !== undefined
    ? Number(p.fullChequeAmount)
    : (p.totalChequeAmount !== undefined
        ? Number(p.totalChequeAmount)
        : (p.masterReceipt?.totalAmount !== undefined ? Number(p.masterReceipt.totalAmount) : undefined));

  // Combine reference and notes if available
  const rawSources: string[] = [];
  if (p.reference && typeof p.reference === 'string') rawSources.push(p.reference.trim());
  if (p.notes && typeof p.notes === 'string' && p.notes !== p.reference) rawSources.push(p.notes.trim());
  const combinedRef = rawSources.join(' | ');

  if (combinedRef) {
    // 1. Clean repetitive/nested Chq prefixes (e.g. "Chq #Chq #000080" -> "Chq #000080")
    const normalizedRef = combinedRef.replace(/(?:Chq|Cheque)\s*#?\s*(?:Chq|Cheque)\s*#?\s*/gi, 'Chq #');

    // 2. Extract Cheque Number if not explicitly present
    if (!chequeNumber) {
      // Pattern A: Explicit "Chq #<num>" or "Cheque #<num>" or "Cheque:<num>"
      const matchExplicit = /(?:Cheque|Chq)\s*#?:?\s*([A-Za-z0-9-]+)/i.exec(normalizedRef);
      if (matchExplicit && matchExplicit[1] && !/^(?:Bank|Date|Mat)$/i.test(matchExplicit[1])) {
        chequeNumber = matchExplicit[1].trim();
      } else {
        // Pattern B: Leading digits at start of string (e.g. "000080 sampath bank - wariyapola")
        const matchLeadingDigits = /^\s*(\d{4,})\b/.exec(normalizedRef);
        if (matchLeadingDigits && matchLeadingDigits[1]) {
          chequeNumber = matchLeadingDigits[1].trim();
        }
      }
    }

    // Clean duplicate "Chq #" or "#" prefixes from captured chequeNumber
    if (chequeNumber) {
      chequeNumber = chequeNumber.replace(/^(?:Chq|Cheque|\s|#)+/gi, '').trim();
    }

    // 3. Extract Bank & Town if not explicitly present
    if (!bankAndTown) {
      // Pattern A: Bank:\s*([^|\n]+)
      const matchBankColon = /(?:Bank|Branch):\s*([^|\n]+)/i.exec(normalizedRef);
      if (matchBankColon && matchBankColon[1]) {
        bankAndTown = matchBankColon[1].trim();
      } else {
        // Pattern B: Inside parentheses e.g. "(DFCC Bank - Dambulla)"
        const matchParens = /\(([^)]+)\)/.exec(normalizedRef);
        if (matchParens && matchParens[1] && !/^\d+$/.test(matchParens[1])) {
          bankAndTown = matchParens[1].trim();
        } else {
          // Pattern C: Text after leading digits, e.g. "000080 sampath bank - wariyapola"
          const matchAfterDigits = /^\s*\d{4,}\s+([A-Za-z0-9\s&/.-]+)$/i.exec(normalizedRef);
          if (matchAfterDigits && matchAfterDigits[1]) {
            bankAndTown = matchAfterDigits[1].trim();
          }
        }
      }
    }

    // 4. Extract Maturity Date if not explicitly present
    if (!maturityDate) {
      const matchMat = /(?:Mat|Maturity|Due|Pass\s*Date)[:\s]*(\d{4}-\d{2}-\d{2})/i.exec(normalizedRef);
      if (matchMat && matchMat[1]) {
        maturityDate = matchMat[1].trim();
      }
    }

    // 5. Clean residual notes that aren't the parsed cheque info
    let residual = normalizedRef;
    if (chequeNumber) {
      residual = residual.replace(new RegExp(`(?:Chq|Cheque)?\\s*#?\\s*${chequeNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '');
    }
    if (bankAndTown) {
      residual = residual.replace(new RegExp(`(?:Bank|Branch)?\\s*[:(]?\\s*${bankAndTown.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[)]?`, 'gi'), '');
    }
    if (maturityDate) {
      residual = residual.replace(new RegExp(`(?:Mat|Maturity|Due|Pass\\s*Date)?[:\\s]*${maturityDate}`, 'gi'), '');
    }
    residual = residual.replace(/^[|\s,:-]+|[|\s,:-]+$/g, '').trim();

    return {
      chequeNumber: chequeNumber || undefined,
      bankAndTown: bankAndTown || undefined,
      bankName: bankAndTown || undefined,
      maturityDate: maturityDate || undefined,
      chequeStatus: chequeStatus || undefined,
      fullChequeAmount: fullChequeAmount && fullChequeAmount > 0 ? fullChequeAmount : undefined,
      residualNotes: residual || undefined,
    };
  }

  return {
    chequeNumber: chequeNumber || undefined,
    bankAndTown: bankAndTown || undefined,
    bankName: bankAndTown || undefined,
    maturityDate: maturityDate || undefined,
    chequeStatus: chequeStatus || undefined,
    fullChequeAmount: fullChequeAmount && fullChequeAmount > 0 ? fullChequeAmount : undefined,
    residualNotes: undefined,
  };
}

