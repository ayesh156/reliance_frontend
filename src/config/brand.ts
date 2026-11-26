/**
 * Centralized White-Label Brand Configuration (`src/config/brand.ts`)
 *
 * Merge-Friendly Architecture:
 * - Production values are preserved when `VITE_DEMO_MODE !== 'true'` so future merges
 *   from `main` remain conflict-free.
 * - When `import.meta.env.VITE_DEMO_MODE === 'true'`, white-labeled demo values for
 *   "Apex Apparel ERP — Live Demo" (Powered by Nebula Infinite) are exported.
 */

export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export interface BrandConfig {
  /** Primary display company name */
  companyName: string;
  /** Compact uppercase brand mark for navbars, sidebars, and headers */
  shortName: string;
  /** Brand tagline / subtitle */
  tagline: string;
  /** Subtitle shown on the login portal */
  portalSubtitle: string;
  /** Top navbar suite label */
  suiteName: string;
  /** Full ERP suite name for PDF footers & legal notices */
  appSuite: string;
  /** Primary street/city address */
  address: string;
  /** Full address for storefront footer */
  shortAddress: string;
  /** Formatted telephone display string */
  phone: string;
  /** Primary single telephone number */
  primaryPhone: string;
  /** International WhatsApp number without '+' prefix */
  whatsappNumber: string;
  /** Full WhatsApp chat URL */
  whatsappUrl: string;
  /** Website display domain */
  websiteUrl: string;
  /** Full HTTPS website URL */
  websiteHref: string;
  /** Contact email address */
  email: string;
  /** Default placeholder email for staff login */
  defaultStaffEmail: string;
  /** Invoice / PDF header title */
  invoiceHeaderTitle: string;
  /** Invoice / PDF header subtitle */
  invoiceHeaderSubtitle: string;
  /** Brand prefix used in PDF report footers and filenames */
  pdfFooterBrand: string;
  /** Copyright entity name */
  footerCopyright: string;
  /** Sticky banner copy in demo mode */
  demoBannerText: string;
}

const PRODUCTION_BRAND: BrandConfig = {
  companyName: 'RELIANCE',
  shortName: 'RELIANCE',
  tagline: 'BRANDED MENS CLOTHING',
  portalSubtitle: 'Staff & POS Management Portal',
  suiteName: 'Retail & Wholesale Suite',
  appSuite: 'Reliance Clothing ERP Management Suite',
  address: 'Mawarala Road, Makandura, Matara.',
  shortAddress: 'Makandura, Matara, Sri Lanka, 81070',
  phone: '041-2268739, 071-1350123',
  primaryPhone: '071 135 0123',
  whatsappNumber: '94711350123',
  whatsappUrl: 'https://wa.me/94711350123',
  websiteUrl: 'relianceapparel.lk',
  websiteHref: 'https://relianceapparel.lk',
  email: 'ravindrakumarash@gmail.com',
  defaultStaffEmail: 'staff@reliance.lk',
  invoiceHeaderTitle: 'RELIANCE',
  invoiceHeaderSubtitle: 'BRANDED MENS CLOTHING',
  pdfFooterBrand: 'Reliance',
  footerCopyright: 'Reliance (Branded Mens Clothing)',
  demoBannerText: '',
};

const DEMO_BRAND: BrandConfig = {
  companyName: 'Apex Apparel ERP — Live Demo',
  shortName: 'APEX APPAREL',
  tagline: 'Powered by Nebula Infinite',
  portalSubtitle: 'Apex Apparel ERP — Live Demo',
  suiteName: 'Apex Apparel ERP — Live Demo',
  appSuite: 'Apex Apparel ERP — Powered by Nebula Infinite',
  address: 'Matara, Sri Lanka',
  shortAddress: 'Matara, Sri Lanka',
  phone: '+94 78 323 3760',
  primaryPhone: '+94 78 323 3760',
  whatsappNumber: '94783233760',
  whatsappUrl: 'https://wa.me/94783233760',
  websiteUrl: 'nebulainfinite.com',
  websiteHref: 'https://nebulainfinite.com',
  email: 'hello@nebulainfinite.com',
  defaultStaffEmail: 'admin@nebulainfinite.com',
  invoiceHeaderTitle: 'Apex Apparel ERP — Live Demo',
  invoiceHeaderSubtitle: 'Powered by Nebula Infinite',
  pdfFooterBrand: 'Apex Apparel ERP',
  footerCopyright: 'Apex Apparel ERP (Powered by Nebula Infinite)',
  demoBannerText: 'Live Interactive Demo — Apex Apparel ERP by Nebula Infinite (Sample Data)',
};

/**
 * Active brand configuration resolved at build/runtime from `VITE_DEMO_MODE`.
 */
export const BRAND: BrandConfig = IS_DEMO_MODE ? DEMO_BRAND : PRODUCTION_BRAND;
