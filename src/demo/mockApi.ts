/**
 * Client-Side Mock API Engine (`src/demo/mockApi.ts`)
 *
 * Intercepts all API calls when `VITE_DEMO_MODE === 'true'` so the Vercel Live Demo
 * operates as a zero-backend, standalone interactive ERP sandbox persisted in
 * `localStorage` under `nebula_demo_erp_v1` with automatic schema versioning.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  createDemoSeedData,
  DEMO_SCHEMA_VERSION,
  DEMO_STORAGE_KEY,
  type DemoDatabase,
  type DemoUser,
} from './seedData';
import {
  drawStandardReportHeader,
  drawStandardReportFooter,
  formatCurrency,
  formatReportTimestamp,
  loadLogoAsDataUrl,
} from '../utils/pdfGenerator';

/**
 * Normalizes a product record so it always includes `category`, `images`, and `variants`.
 */
function normalizeProduct(p: any) {
  const fallbackImg = p.image || p.images?.[0]?.imageUrl || '/images/reliance-placeholder.jpg';
  const images =
    Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : [{ id: 1, imageUrl: fallbackImg, order: 0, isWebImage: true }];
  return {
    ...p,
    searchKey: p.searchKey || `${p.name || ''} ${p.category?.name || ''}`.trim(),
    category: p.category || { id: p.categoryId || 1, name: 'Apparel' },
    images,
    image: fallbackImg,
    variants: Array.isArray(p.variants) ? p.variants : [],
  };
}

/**
 * Normalizes an invoice record so `customer`, `user`, `items[].variant.product`,
 * `discount`, `payments`, and `returns` always match `InvoicesPage` and `QuickInvoicePage`.
 */
function normalizeInvoice(inv: any, db: DemoDatabase) {
  const cust =
    inv.customer ||
    (inv.customerId ? db.customers.find((c) => Number(c.id) === Number(inv.customerId)) : null);
  const creator =
    inv.user ||
    inv.createdBy ||
    (inv.createdById || inv.userId
      ? db.users.find((u) => Number(u.id) === Number(inv.createdById || inv.userId))
      : db.users[0]);

  const items = (inv.items || []).map((it: any) => {
    const prod = db.products.find((p) => Number(p.id) === Number(it.productId));
    const normProd = prod
      ? normalizeProduct(prod)
      : {
          id: it.productId || 0,
          name: it.productName || 'Garment Item',
          category: { id: 1, name: 'Apparel' },
          images: [{ id: 1, imageUrl: '/images/reliance-placeholder.jpg', order: 0 }],
        };
    const matchedVar = normProd.variants?.find((v: any) => Number(v.id) === Number(it.variantId));
    return {
      ...it,
      productName: it.productName || normProd.name,
      variant: it.variant || {
        id: it.variantId || matchedVar?.id || 0,
        size: matchedVar?.size || 'M',
        color: matchedVar?.color || 'Default',
        sku: it.sku || matchedVar?.sku || '',
        barcode: matchedVar?.barcode || '',
        retailPrice: matchedVar?.retailPrice || it.unitPrice || 0,
        wholesalePrice: matchedVar?.wholesalePrice || it.unitPrice || 0,
        costPrice: matchedVar?.costPrice || it.costPrice || 0,
        product: {
          id: normProd.id,
          name: normProd.name,
          category: normProd.category,
          images: normProd.images,
        },
      },
    };
  });

  const totalAmount = Number(inv.totalAmount || 0);
  const paidAmount = Number(inv.paidAmount || 0);
  const discount = Number(inv.discount ?? inv.discountAmount ?? 0);

  return {
    ...inv,
    userId: inv.userId || creator?.id || 1,
    user: creator
      ? { id: creator.id, name: creator.name, role: creator.role }
      : { id: 1, name: 'Admin', role: 'ADMIN' },
    customer: cust
      ? {
          id: cust.id,
          name: cust.name,
          phone: cust.phone || '',
          address: cust.address || '',
          city: cust.city || '',
          creditLimit: Number(cust.creditLimit || 0),
          outstandingBalance: Number(cust.outstandingBalance ?? cust.creditBalance ?? 0),
        }
      : undefined,
    subtotal: Number(inv.subtotal ?? totalAmount + discount),
    discount,
    discountAmount: discount,
    totalAmount,
    paidAmount,
    balanceDue: Math.max(0, totalAmount - paidAmount),
    items,
    payments: Array.isArray(inv.payments) ? inv.payments : [],
    returns: Array.isArray(inv.returns) ? inv.returns : [],
  };
}

/**
 * Hydrates a production batch with full `product` (including `images`), `variant`,
 * `targetProducts`, `materialUsages`, and `cutLogs` expected by `CuttingListPage`, `LinePage`, and `WashPage`.
 */
function hydrateProductionBatch(b: any, db: DemoDatabase) {
  const prod = db.products.find((p) => Number(p.id) === Number(b.productId));
  const normProd = prod ? normalizeProduct(prod) : normalizeProduct(b.product || db.products[0]);
  const variant =
    b.variant ||
    normProd.variants?.find((v: any) => Number(v.id) === Number(b.variantId)) ||
    normProd.variants?.[0] ||
    null;

  const targetProducts =
    Array.isArray(b.targetProducts) && b.targetProducts.length > 0
      ? b.targetProducts.map((tp: any) => {
          const tpProd = db.products.find((p) => Number(p.id) === Number(tp.productId || normProd.id));
          const tpNorm = tpProd ? normalizeProduct(tpProd) : normProd;
          return {
            ...tp,
            productName: tp.productName || tpNorm.name,
            imageUrl: tp.imageUrl || tpNorm.images?.[0]?.imageUrl || tpNorm.image,
          };
        })
      : [
          {
            productId: normProd.id,
            variantId: variant?.id || null,
            productName: normProd.name,
            sku: variant?.sku || '',
            variantName: variant ? `${variant.size} / ${variant.color}` : null,
            plannedQty: Number(b.cutQty || b.targetQuantity || 0),
            cutQty: Number(b.cutQty || b.targetQuantity || 0),
            imageUrl: normProd.images?.[0]?.imageUrl || normProd.image,
          },
        ];

  const defaultMat = db.rawMaterialItems[0] || {
    id: 1,
    name: '14oz Raw Selvedge Denim Fabric',
    code: 'RM-001',
    unit: 'METERS',
    currentStock: 420,
    unitCostAverage: 1150,
  };

  const materialUsages =
    Array.isArray(b.materialUsages) && b.materialUsages.length > 0
      ? b.materialUsages.map((u: any, idx: number) => {
          const mat =
            db.rawMaterialItems.find((r) => Number(r.id) === Number(u.rawMaterialId || u.rawMaterialItemId)) ||
            u.rawMaterial ||
            u.rawMaterialItem ||
            defaultMat;
          const qty = Number(u.netConsumedQty ?? u.issuedQty ?? u.quantityUsed ?? b.fabricUsedQty ?? 120);
          return {
            ...u,
            id: u.id || b.id * 10 + idx + 1,
            rawMaterialId: mat.id,
            rawMaterial: mat,
            rawMaterialItemId: mat.id,
            rawMaterialItem: mat,
            issuedQty: Number(u.issuedQty ?? qty),
            returnedQty: Number(u.returnedQty ?? 0),
            netConsumedQty: Number(u.netConsumedQty ?? qty),
            quantityUsed: qty,
            piecesCount: Number(u.piecesCount ?? 2),
            unitCost: Number(u.unitCost ?? mat.unitCostAverage ?? 1150),
            totalCost: Number(u.totalCost ?? qty * Number(mat.unitCostAverage ?? 1150)),
          };
        })
      : [
          {
            id: b.id * 10 + 1,
            rawMaterialId: defaultMat.id,
            rawMaterial: defaultMat,
            rawMaterialItemId: defaultMat.id,
            rawMaterialItem: defaultMat,
            issuedQty: Number(b.fabricUsedQty || 120),
            returnedQty: 0,
            netConsumedQty: Number(b.fabricUsedQty || 120),
            quantityUsed: Number(b.fabricUsedQty || 120),
            piecesCount: 2,
            unitCost: Number(defaultMat.unitCostAverage || 1150),
            totalCost: Number(b.fabricUsedQty || 120) * Number(defaultMat.unitCostAverage || 1150),
          },
        ];

  const primaryMat = materialUsages[0]?.rawMaterial || defaultMat;
  const cutLogs =
    Array.isArray(b.cutLogs) && b.cutLogs.length > 0
      ? b.cutLogs.map((cl: any, idx: number) => {
          const clMat =
            db.rawMaterialItems.find((r) => Number(r.id) === Number(cl.rawMaterialId)) ||
            cl.rawMaterial ||
            primaryMat;
          return {
            ...cl,
            id: cl.id || b.id * 100 + idx + 1,
            rawMaterialId: clMat.id,
            rawMaterial: clMat,
            cutDate: cl.cutDate || b.cuttingDate || b.productionDate || b.createdAt,
            quantityCut: Number(cl.quantityCut ?? b.cutQty ?? b.targetQuantity ?? 0),
          };
        })
      : [
          {
            id: b.id * 100 + 1,
            rawMaterialId: primaryMat.id,
            rawMaterial: primaryMat,
            cutDate: b.cuttingDate || b.productionDate || b.createdAt,
            quantityCut: Number(b.cutQty || b.targetQuantity || 0),
            notes: b.notes || 'Initial cutting run',
          },
        ];

  return {
    ...b,
    productionNo: b.productionNo || b.batchNumber || `BATCH-${b.id}`,
    batchNumber: b.batchNumber || b.productionNo || `BATCH-${b.id}`,
    productId: normProd.id,
    product: normProd,
    variantId: variant?.id || b.variantId || null,
    variant,
    targetProducts,
    materialUsages,
    cutLogs,
    productionDate: b.productionDate || b.cuttingDate || b.createdAt,
    cuttingDate: b.cuttingDate || b.productionDate || b.createdAt,
  };
}

/**
 * Loads the persisted demo database from `localStorage`.
 * Automatically resets to fresh seed data if stored data is missing, malformed,
 * or has an older `schemaVersion` than `DEMO_SCHEMA_VERSION`.
 */
export function loadDemoDb(): DemoDatabase {
  if (typeof window === 'undefined') {
    return createDemoSeedData();
  }
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDatabase;
      if (
        parsed &&
        parsed.schemaVersion === DEMO_SCHEMA_VERSION &&
        Array.isArray(parsed.products) &&
        Array.isArray(parsed.invoices)
      ) {
        parsed.customers = (parsed.customers || []).map((c: any) => ({
          ...c,
          outstandingBalance: Number(c.outstandingBalance ?? c.creditBalance ?? 0),
        }));
        parsed.products = (parsed.products || []).map(normalizeProduct);
        return parsed;
      }
    }
  } catch {
    // Corrupted storage falls back to fresh seed
  }
  const seed = createDemoSeedData();
  saveDemoDb(seed);
  return seed;
}

/**
 * Persists the current demo database state into `localStorage`.
 */
export function saveDemoDb(db: DemoDatabase): void {
  if (typeof window === 'undefined') return;
  try {
    db.schemaVersion = DEMO_SCHEMA_VERSION;
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('[DemoMockApi] Failed to persist demo database:', err);
  }
}

/**
 * Resets all demo data in `localStorage` back to the initial seed state.
 */
export function resetDemoDb(): DemoDatabase {
  const seed = createDemoSeedData();
  saveDemoDb(seed);
  return seed;
}

/**
 * Generates a synthetic Base64 JWT-shaped token for demo sessions.
 */
export function createDemoJwt(user: DemoUser): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          demo: true,
        })
      )
    )
  );
  return `${header}.${payload}.demo-signature`;
}

/**
 * Resolves the currently authenticated demo user from `localStorage`.
 */
function getCurrentDemoUser(db: DemoDatabase): DemoUser {
  try {
    const rawUser = localStorage.getItem('auth_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      const found = db.users.find((u) => u.id === Number(parsed?.id) || u.email === parsed?.email);
      if (found) return found;
    }
  } catch {
    // Fallback to Admin
  }
  return db.users[0];
}

/**
 * Parses JSON string or `FormData` request payloads into a normalized plain object.
 * Automatically parses JSON-encoded `FormData` fields (e.g. `variants`, `imageUrls`).
 */
function parseBody(body: BodyInit | null | undefined): any {
  if (!body) return {};
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const obj: Record<string, any> = {};
    body.forEach((value, key) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          try {
            obj[key] = JSON.parse(trimmed);
            return;
          } catch {
            // Keep as string if not valid JSON
          }
        }
        obj[key] = value;
      } else {
        // File/Blob upload in demo mode: record placeholder image URL
        if (!Array.isArray(obj._uploadedFiles)) obj._uploadedFiles = [];
        obj._uploadedFiles.push('/images/editorial/hero-denim.jpg');
      }
    });
    return obj;
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') {
    return body;
  }
  return {};
}

/**
 * Normalizes incoming endpoint strings by stripping any origin, leading `/api`,
 * trailing slashes, and separating `pathname` from `URLSearchParams`.
 */
function parseUrl(endpoint: string): { path: string; params: URLSearchParams } {
  let clean = endpoint.trim();
  // Strip protocol + host origin if present
  clean = clean.replace(/^https?:\/\/[^/]+/i, '');
  const [rawPathPart, queryPart] = clean.split('?');
  let pathname = rawPathPart.replace(/^\/?api(?=\/|$)/i, '') || '/';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  pathname = pathname.replace(/\/+$/, '') || '/';
  return {
    path: pathname,
    params: new URLSearchParams(queryPart || ''),
  };
}

/**
 * Builds catalog variant list expected by `/orders/catalog` and `QuickInvoicePage.tsx`,
 * including nested `product: { id, name, searchKey, category, images }`.
 */
function buildCatalogVariants(db: DemoDatabase) {
  const rows: any[] = [];
  for (const rawProduct of db.products) {
    const p = normalizeProduct(rawProduct);
    for (const v of p.variants || []) {
      rows.push({
        id: v.id,
        variantId: v.id,
        productId: p.id,
        size: v.size,
        color: v.color,
        sku: v.sku,
        barcode: v.barcode,
        costPrice: Number(v.costPrice || 0),
        retailPrice: Number(v.retailPrice || 0),
        wholesalePrice: Number(v.wholesalePrice || 0),
        stock: Number(v.stock || 0),
        imageUrl: v.imageUrl || p.image || '/images/reliance-placeholder.jpg',
        product: {
          id: p.id,
          name: p.name,
          searchKey: p.searchKey,
          category: p.category,
          images: p.images,
        },
      });
    }
  }
  return rows;
}

/**
 * Computes live dashboard metrics matching `Dashboard.tsx` `DashboardMetrics` interface.
 */
function computeDashboardMetrics(db: DemoDatabase) {
  const salesInvoices = db.invoices.filter((inv) => !inv.isReturnBill && Number(inv.totalAmount) >= 0);
  const todayRevenue = salesInvoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const lowStockProducts: any[] = [];

  for (const rawP of db.products) {
    const p = normalizeProduct(rawP);
    for (const v of p.variants || []) {
      if (Number(v.stock || 0) <= 35) {
        lowStockProducts.push({
          id: v.id,
          productId: p.id,
          productName: p.name,
          size: v.size,
          color: v.color,
          sku: v.sku,
          stock: Number(v.stock || 0),
        });
      }
    }
  }

  return {
    todayRevenue,
    revenueGrowth: 14.8,
    pendingOrdersCount: db.salesOrders.filter((o) => o.status === 'PENDING').length,
    lowStockItemsCount: lowStockProducts.length,
    totalActiveCustomers: db.customers.length,
    recentOrders: db.invoices.slice(0, 6).map((inv) => ({
      id: inv.id,
      customerName: inv.customerName || 'Walk-in Customer',
      totalAmount: Number(inv.totalAmount || 0),
      paidAmount: Number(inv.paidAmount || 0),
      status: inv.paymentStatus === 'PAID' ? 'PAID' : 'PENDING',
      createdAt: inv.createdAt,
    })),
    lowStockProducts: lowStockProducts.slice(0, 8),
  };
}

/**
 * Computes module-specific report payloads wrapped in `{ success: true, data }` for `ReportsPage.tsx`.
 */
function computeReportData(db: DemoDatabase, module: string) {
  const normalizedInvoices = db.invoices.map((i) => normalizeInvoice(i, db));
  const salesInvoices = normalizedInvoices.filter((inv) => !inv.isReturnBill && Number(inv.totalAmount) >= 0);
  const returnInvoices = normalizedInvoices.filter((inv) => inv.isReturnBill || Number(inv.totalAmount) < 0);

  const grossRevenue = salesInvoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const returnsTotal = Math.abs(returnInvoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0));
  const netSales = grossRevenue - returnsTotal;

  const soldCogs = salesInvoices.reduce(
    (s, inv) =>
      s +
      (inv.items || []).reduce(
        (is: number, it: any) => is + Number(it.quantity || 0) * Number(it.costPrice || 0),
        0
      ),
    0
  );
  const returnedCogs = returnInvoices.reduce(
    (s, inv) =>
      s +
      (inv.items || []).reduce(
        (is: number, it: any) => is + Math.abs(Number(it.quantity || 0)) * Number(it.costPrice || 0),
        0
      ),
    0
  );
  const costOfGoodsSold = Math.max(0, soldCogs - returnedCogs);
  const grossProfit = netSales - costOfGoodsSold;
  const totalExpenses = db.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalExpenses;
  const totalPaid = salesInvoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
  const totalDue = salesInvoices.reduce((s, i) => s + Number(i.balanceDue || 0), 0);

  const paymentSplit: Record<string, { amount: number; count: number }> = {};
  for (const inv of salesInvoices) {
    const m = inv.paymentMethod || 'CASH';
    if (!paymentSplit[m]) paymentSplit[m] = { amount: 0, count: 0 };
    paymentSplit[m].amount += Number(inv.totalAmount || 0);
    paymentSplit[m].count += 1;
  }

  if (module === 'sales' || module === 'consolidated') {
    return {
      success: true,
      data: {
        summary: {
          grossRevenue,
          returnsTotal,
          netSales,
          costOfGoodsSold,
          grossProfit,
          totalExpenses,
          netProfit,
          totalPaid,
          totalDue,
          invoiceCount: salesInvoices.length,
          paymentSplit,
        },
        tableItems: salesInvoices,
      },
    };
  }

  if (module === 'expenses') {
    const catMap: Record<string, { name: string; total: number; count: number }> = {};
    for (const exp of db.expenses) {
      const cname = exp.category?.name || 'General';
      if (!catMap[cname]) catMap[cname] = { name: cname, total: 0, count: 0 };
      catMap[cname].total += Number(exp.amount || 0);
      catMap[cname].count += 1;
    }
    return {
      success: true,
      data: {
        summary: {
          totalExpenses,
          voucherCount: db.expenses.length,
          categoryBreakdown: Object.values(catMap),
        },
        tableItems: db.expenses,
      },
    };
  }

  if (module === 'returns') {
    const reasonsBreakdown: Record<string, { refund: number; qty: number }> = {
      'Size exchange': { refund: returnsTotal, qty: 2 },
    };
    return {
      success: true,
      data: {
        summary: { totalRefunded: returnsTotal, returnCount: returnInvoices.length, reasonsBreakdown },
        tableItems: returnInvoices,
      },
    };
  }

  if (module === 'products') {
    const tableItems = db.products.map((rawP) => {
      const p = normalizeProduct(rawP);
      const totalStock = p.variants.reduce((s: number, v: any) => s + Number(v.stock || 0), 0);
      return {
        productId: p.id,
        productName: p.name,
        categoryName: p.category?.name || 'Apparel',
        soldQty: 15,
        totalRevenue: totalStock * 2200,
        stock: totalStock,
      };
    });
    return {
      success: true,
      data: {
        summary: { totalProducts: db.products.length, totalStock: tableItems.reduce((s, r) => s + r.stock, 0) },
        tableItems,
      },
    };
  }

  if (module === 'production') {
    const tableItems = db.productionBatches.map((b) => ({
      ...b,
      productionNo: b.productionNo || b.batchNumber,
      productionDate: b.productionDate || b.cuttingDate || b.createdAt,
      totalCutUnits: b.cutQty,
      totalFinishedUnits: b.packedQty || 0,
      completedQty: b.packedQty || 0,
    }));
    return {
      success: true,
      data: {
        summary: {
          totalBatches: db.productionBatches.length,
          totalCut: db.productionBatches.reduce((s, b) => s + Number(b.cutQty || 0), 0),
          totalSewn: db.productionBatches.reduce((s, b) => s + Number(b.sewnQty || 0), 0),
          totalWashed: db.productionBatches.reduce((s, b) => s + Number(b.washedQty || 0), 0),
        },
        tableItems,
      },
    };
  }

  if (module === 'materials') {
    return {
      success: true,
      data: {
        summary: {
          totalItems: db.rawMaterialItems.length,
          totalValuation: db.rawMaterialItems.reduce(
            (s, m) => s + Number(m.currentStock ?? m.stock ?? 0) * Number(m.unitCostAverage ?? m.unitCost ?? 0),
            0
          ),
        },
        tableItems: db.rawMaterialItems,
      },
    };
  }

  if (module === 'suppliers') {
    const tableItems = db.rawMaterialShops.map((shop) => ({
      id: shop.id,
      supplierName: shop.name,
      phone: shop.phone,
      totalPurchases: db.buyRawMaterials
        .filter((g) => Number(g.shopId) === Number(shop.id))
        .reduce((s, g) => s + Number(g.totalAmount || 0), 0),
      outstandingBalance: Number(shop.balance || 0),
    }));
    return {
      success: true,
      data: {
        summary: {
          totalSuppliers: tableItems.length,
          totalDue: tableItems.reduce((s, r) => s + r.outstandingBalance, 0),
        },
        tableItems,
      },
    };
  }

  if (module === 'audit') {
    return {
      success: true,
      data: {
        summary: {
          totalEdits: 3,
          cashierEditsBreakdown: { 'Kasun Perera (Admin)': 2, 'Nimali Silva (Cashier)': 1 },
        },
        tableItems: normalizedInvoices.slice(0, 5),
      },
    };
  }

  if (module === 'cheques') {
    const cheques = normalizedInvoices.flatMap((inv) =>
      (inv.payments || [])
        .filter((p: any) => p.method === 'CHEQUE')
        .map((p: any) => ({
          ...p,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          customerId: inv.customerId,
          status: p.chequeStatus || 'PENDING',
        }))
    );
    const pending = cheques.filter((c) => c.status === 'PENDING');
    const realized = cheques.filter((c) => c.status === 'CLEARED');
    const bounced = cheques.filter((c) => c.status === 'BOUNCED');
    return {
      success: true,
      data: {
        summary: {
          pendingCount: pending.length,
          realizedCount: realized.length,
          bounceCount: bounced.length,
          totalPendingAmount: pending.reduce((s, c) => s + Number(c.amount || 0), 0),
          totalRealizedAmount: realized.reduce((s, c) => s + Number(c.amount || 0), 0),
          totalBouncedAmount: bounced.reduce((s, c) => s + Number(c.amount || 0), 0),
        },
        tableItems: cheques,
      },
    };
  }

  return { success: true, data: { summary: {}, tableItems: [] } };
}

/**
 * Main client-side mock router for `request()` in `src/lib/api.ts`.
 */
export async function handleMockRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const { path, params } = parseUrl(endpoint);
  const body = parseBody(options.body);
  const db = loadDemoDb();

  await new Promise((r) => setTimeout(r, 25));

  // ── 1. AUTH & USERS ────────────────────────────────────────────────────────
  if (path === '/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const found =
      db.users.find((u) => u.email.toLowerCase() === email) ||
      (email.includes('cashier') ? db.users[1] : email.includes('rep') ? db.users[2] : db.users[0]);

    const token = createDemoJwt(found);
    return { token, user: found } as unknown as T;
  }

  if (path === '/auth/me' && method === 'GET') {
    return getCurrentDemoUser(db) as unknown as T;
  }

  if ((path === '/auth/users' || path === '/users' || path === '/sales-persons') && method === 'GET') {
    return db.users as unknown as T;
  }

  if (path === '/auth/users' && method === 'POST') {
    const newUser: DemoUser = {
      id: db.nextIds.user++,
      name: body.name || 'Demo Staff',
      email: body.email || `staff${db.nextIds.user}@nebulainfinite.com`,
      role: body.role || 'STAFF',
      permissions: Array.isArray(body.permissions) ? body.permissions : ['pos', 'invoices'],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    saveDemoDb(db);
    return newUser as unknown as T;
  }

  const userOverrideMatch = path.match(/^\/(?:users|auth\/users)\/(\d+)(?:\/admin-override)?$/);
  if (userOverrideMatch && (method === 'PUT' || method === 'PATCH')) {
    const uid = Number(userOverrideMatch[1]);
    const idx = db.users.findIndex((u) => u.id === uid);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...body };
      saveDemoDb(db);
      return db.users[idx] as unknown as T;
    }
  }

  // ── 2. DASHBOARD & NOTIFICATIONS ──────────────────────────────────────────
  if (path === '/dashboard/live-metrics' && method === 'GET') {
    return computeDashboardMetrics(db) as unknown as T;
  }

  if (path.startsWith('/notifications')) {
    return [] as unknown as T;
  }

  // ── 3. ATTRIBUTES (CATEGORIES, SIZES, COLORS) ─────────────────────────────
  if (path === '/attributes/categories') {
    if (method === 'GET') return db.categories as unknown as T;
    if (method === 'POST') {
      const cat = { id: db.nextIds.category++, name: body.name, description: body.description || '', _count: { products: 0 } };
      db.categories.push(cat);
      saveDemoDb(db);
      return cat as unknown as T;
    }
  }
  const catIdMatch = path.match(/^\/attributes\/categories\/(\d+)$/);
  if (catIdMatch) {
    const cid = Number(catIdMatch[1]);
    if (method === 'PUT' || method === 'PATCH') {
      const idx = db.categories.findIndex((c) => c.id === cid);
      if (idx !== -1) {
        db.categories[idx] = { ...db.categories[idx], ...body };
        saveDemoDb(db);
        return db.categories[idx] as unknown as T;
      }
    }
    if (method === 'DELETE') {
      db.categories = db.categories.filter((c) => c.id !== cid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  if (path === '/attributes/sizes') {
    if (method === 'GET') return db.sizes as unknown as T;
    if (method === 'POST') {
      const size = { id: db.nextIds.size++, name: body.name, order: body.order ?? db.sizes.length + 1 };
      db.sizes.push(size);
      saveDemoDb(db);
      return size as unknown as T;
    }
  }
  const sizeIdMatch = path.match(/^\/attributes\/sizes\/(\d+)$/);
  if (sizeIdMatch && method === 'DELETE') {
    const sid = Number(sizeIdMatch[1]);
    db.sizes = db.sizes.filter((s) => s.id !== sid);
    saveDemoDb(db);
    return { success: true } as unknown as T;
  }

  if (path === '/attributes/colors') {
    if (method === 'GET') return db.colors as unknown as T;
    if (method === 'POST') {
      const color = { id: db.nextIds.color++, name: body.name, hexCode: body.hexCode || '#18181b' };
      db.colors.push(color);
      saveDemoDb(db);
      return color as unknown as T;
    }
  }
  const colorIdMatch = path.match(/^\/attributes\/colors\/(\d+)$/);
  if (colorIdMatch && method === 'DELETE') {
    const cid = Number(colorIdMatch[1]);
    db.colors = db.colors.filter((c) => c.id !== cid);
    saveDemoDb(db);
    return { success: true } as unknown as T;
  }

  // ── 4. PRODUCTS & VARIANTS (WITH FORMDATA SUPPORT) ────────────────────────
  if (path === '/products') {
    if (method === 'GET') return db.products.map(normalizeProduct) as unknown as T;
    if (method === 'POST') {
      const cat = db.categories.find((c) => c.id === Number(body.categoryId));
      const allUrls: string[] = [
        ...(Array.isArray(body.imageUrls) ? body.imageUrls : []),
        ...(Array.isArray(body._uploadedFiles) ? body._uploadedFiles : []),
      ];
      const primaryImg = allUrls[0] || body.image || '/images/editorial/hero-denim.jpg';
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      const newProd = normalizeProduct({
        id: db.nextIds.product++,
        name: body.name || 'New Apparel Item',
        slug: (body.name || 'new-item').toLowerCase().replace(/\s+/g, '-'),
        description: body.description || '',
        searchKey: body.searchKey || body.name || '',
        categoryId: Number(body.categoryId || 1),
        category: cat ? { id: cat.id, name: cat.name } : { id: 1, name: 'Denim Trousers' },
        isFeatured: Boolean(body.isFeatured),
        image: primaryImg,
        images: (allUrls.length > 0 ? allUrls : [primaryImg]).map((url, idx) => ({
          id: idx + 1,
          imageUrl: url,
          order: idx,
          isWebImage: true,
        })),
        createdAt: new Date().toISOString(),
        variants: rawVariants.map((v: any) => ({
          ...v,
          id: v.id || db.nextIds.variant++,
        })),
      });
      db.products.unshift(newProd);
      saveDemoDb(db);
      return newProd as unknown as T;
    }
  }

  const productMatch = path.match(/^\/products\/(\d+)$/);
  if (productMatch) {
    const pid = Number(productMatch[1]);
    const idx = db.products.findIndex((p) => p.id === pid);
    if (method === 'GET') {
      if (idx !== -1) return normalizeProduct(db.products[idx]) as unknown as T;
      throw new Error('Product not found');
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (idx !== -1) {
        const cat = db.categories.find((c) => c.id === Number(body.categoryId || db.products[idx].categoryId));
        const allUrls: string[] = [
          ...(Array.isArray(body.imageUrls) ? body.imageUrls : []),
          ...(Array.isArray(body._uploadedFiles) ? body._uploadedFiles : []),
        ];
        const updated = {
          ...db.products[idx],
          ...body,
          categoryId: Number(body.categoryId || db.products[idx].categoryId),
          category: cat ? { id: cat.id, name: cat.name } : db.products[idx].category,
          variants: Array.isArray(body.variants)
            ? body.variants.map((v: any) => ({ ...v, id: v.id || db.nextIds.variant++ }))
            : db.products[idx].variants,
        };
        if (allUrls.length > 0) {
          updated.image = allUrls[0];
          updated.images = allUrls.map((url, i) => ({ id: i + 1, imageUrl: url, order: i, isWebImage: true }));
        }
        db.products[idx] = normalizeProduct(updated);
        saveDemoDb(db);
        return db.products[idx] as unknown as T;
      }
    }
    if (method === 'DELETE') {
      db.products = db.products.filter((p) => p.id !== pid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  const stockAdjustMatch = path.match(/^\/products\/(\d+)\/adjust-stock$/);
  if (stockAdjustMatch && method === 'POST') {
    const pid = Number(stockAdjustMatch[1]);
    const prod = db.products.find((p) => p.id === pid);
    if (prod) {
      const variant = (prod.variants || []).find((v: any) => v.id === Number(body.variantId)) || prod.variants?.[0];
      if (variant) {
        variant.stock = Math.max(0, Number(variant.stock || 0) + Number(body.delta || body.quantity || 0));
        saveDemoDb(db);
        return { message: 'Stock updated', newStock: variant.stock } as unknown as T;
      }
    }
  }

  // ── 5. CUSTOMERS & CREDIT LEDGER ──────────────────────────────────────────
  if (path === '/customers/reconcile' && method === 'POST') {
    saveDemoDb(db);
    return { success: true, message: 'Customer ledger reconciled' } as unknown as T;
  }

  if (path === '/customers') {
    if (method === 'GET') return db.customers as unknown as T;
    if (method === 'POST') {
      const cust = {
        id: db.nextIds.customer++,
        name: body.name || 'New Customer',
        phone: body.phone || '',
        email: body.email || '',
        address: body.address || '',
        city: body.city || 'Matara',
        customerType: body.customerType || 'RETAIL',
        creditLimit: Number(body.creditLimit || 50000),
        outstandingBalance: Number(body.outstandingBalance ?? body.creditBalance ?? 0),
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      db.customers.unshift(cust);
      saveDemoDb(db);
      return cust as unknown as T;
    }
  }

  const custIdMatch = path.match(/^\/customers\/(\d+)$/);
  if (custIdMatch) {
    const cid = Number(custIdMatch[1]);
    const idx = db.customers.findIndex((c) => c.id === cid);
    if (method === 'GET' && idx !== -1) return db.customers[idx] as unknown as T;
    if ((method === 'PUT' || method === 'PATCH') && idx !== -1) {
      db.customers[idx] = {
        ...db.customers[idx],
        ...body,
        outstandingBalance: Number(
          body.outstandingBalance ?? body.creditBalance ?? db.customers[idx].outstandingBalance ?? 0
        ),
      };
      saveDemoDb(db);
      return db.customers[idx] as unknown as T;
    }
    if (method === 'DELETE') {
      db.customers = db.customers.filter((c) => c.id !== cid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  const custStatementMatch = path.match(/^\/(?:credit\/)?customers\/(\d+)\/statement$/);
  if (custStatementMatch && method === 'GET') {
    const cid = Number(custStatementMatch[1]);
    const customer = db.customers.find((c) => c.id === cid);
    const custInvoices = db.invoices
      .filter((i) => Number(i.customerId) === cid)
      .map((i) => normalizeInvoice(i, db));
    return {
      customer,
      invoices: custInvoices,
      orders: custInvoices,
      balance: customer?.outstandingBalance || 0,
    } as unknown as T;
  }

  const dueBillsMatch = path.match(/^\/(?:credit|orders)\/customers\/(\d+)\/(?:due-bills|pending-invoices)$/);
  if (dueBillsMatch && method === 'GET') {
    const cid = Number(dueBillsMatch[1]);
    const customer = db.customers.find((c) => c.id === cid);
    const pending = db.invoices
      .filter((i) => Number(i.customerId) === cid && Number(i.totalAmount || 0) - Number(i.paidAmount || 0) > 0)
      .map((i) => normalizeInvoice(i, db));
    if (path.startsWith('/credit/')) {
      return { customer, dueBills: pending, invoices: pending } as unknown as T;
    }
    return pending as unknown as T;
  }

  const settleDebtMatch = path.match(/^\/orders\/customers\/(\d+)\/settle-debt$/);
  if (settleDebtMatch && method === 'POST') {
    const cid = Number(settleDebtMatch[1]);
    const payList = Array.isArray(body.payments) ? body.payments : [body];
    const payAmount = payList.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const cust = db.customers.find((c) => c.id === cid);
    if (cust) {
      cust.outstandingBalance = Math.max(0, Number(cust.outstandingBalance || 0) - payAmount);
    }
    let remaining = payAmount;
    for (const inv of db.invoices) {
      const invDue = Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0));
      if (Number(inv.customerId) === cid && invDue > 0 && remaining > 0) {
        const applied = Math.min(remaining, invDue);
        inv.paidAmount = Number(inv.paidAmount || 0) + applied;
        inv.balanceDue = Math.max(0, Number(inv.totalAmount || 0) - inv.paidAmount);
        inv.paymentStatus = inv.balanceDue <= 0 ? 'PAID' : 'PARTIAL';
        inv.payments = inv.payments || [];
        inv.payments.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          amount: applied,
          method: payList[0]?.method || body.method || 'CASH',
          paymentDate: new Date().toISOString(),
          notes: body.notes || 'Debt settlement',
        });
        remaining -= applied;
      }
    }
    saveDemoDb(db);
    return { success: true, settledAmount: payAmount, customer: cust } as unknown as T;
  }

  if (path === '/credit/settle-bill' && method === 'POST') {
    const orderId = Number(body.orderId || body.invoiceId);
    const payList = Array.isArray(body.payments) ? body.payments : [body];
    const amount = payList.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const inv = db.invoices.find((i) => i.id === orderId);
    if (inv) {
      inv.paidAmount = Number(inv.paidAmount || 0) + amount;
      inv.balanceDue = Math.max(0, Number(inv.totalAmount || 0) - inv.paidAmount);
      inv.paymentStatus = inv.balanceDue <= 0 ? 'PAID' : 'PARTIAL';
      inv.payments = inv.payments || [];
      for (const p of payList) {
        inv.payments.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          amount: Number(p.amount || 0),
          method: p.method || 'CASH',
          chequeNumber: p.chequeNumber,
          bankName: p.bankName,
          chequeDate: p.chequeDate,
          chequeStatus: p.method === 'CHEQUE' ? 'PENDING' : undefined,
          paymentDate: p.paymentDate || new Date().toISOString(),
          notes: p.notes || body.notes || 'Bill settlement',
        });
      }
      const cust = db.customers.find((c) => c.id === Number(inv.customerId));
      if (cust) {
        cust.outstandingBalance = Math.max(0, Number(cust.outstandingBalance || 0) - amount);
      }
      saveDemoDb(db);
      return normalizeInvoice(inv, db) as unknown as T;
    }
  }

  // ── 6. ORDERS, POS INVOICES, PAYMENTS & RETURNS ───────────────────────────
  if (path === '/orders/catalog' && method === 'GET') {
    return buildCatalogVariants(db) as unknown as T;
  }

  if (path === '/orders/return-inventory' && method === 'GET') {
    return db.returnInventory as unknown as T;
  }

  if (path === '/orders/invoices' && method === 'GET') {
    let list = db.invoices.map((i) => normalizeInvoice(i, db));

    const search = (params.get('search') || '').trim().toLowerCase();
    const customerId = params.get('customerId');
    const userId = params.get('userId');
    const source = params.get('source');
    const paymentStatus = params.get('paymentStatus');
    const methodFilter = params.get('method');
    const startDate = params.get('startDate');
    const endDate = params.get('endDate');
    const sort = params.get('sort') || 'newest';

    if (search) {
      list = list.filter(
        (i) =>
          String(i.id).includes(search) ||
          (i.invoiceNumber || '').toLowerCase().includes(search) ||
          (i.customerName || '').toLowerCase().includes(search) ||
          (i.customerPhone || '').toLowerCase().includes(search)
      );
    }
    if (customerId && customerId !== 'ALL') {
      list = list.filter((i) => String(i.customerId) === String(customerId));
    }
    if (userId && userId !== 'ALL') {
      list = list.filter((i) => String(i.userId) === String(userId));
    }
    if (source && source !== 'ALL') {
      list = list.filter((i) => i.source === source);
    }
    if (paymentStatus && paymentStatus !== 'ALL') {
      list = list.filter((i) => i.paymentStatus === paymentStatus);
    }
    if (methodFilter && methodFilter !== 'ALL') {
      list = list.filter((i) => String(i.paymentMethod).toUpperCase() === methodFilter.toUpperCase());
    }
    if (startDate) {
      const startMs = new Date(startDate).setHours(0, 0, 0, 0);
      list = list.filter((i) => new Date(i.createdAt).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).setHours(23, 59, 59, 999);
      list = list.filter((i) => new Date(i.createdAt).getTime() <= endMs);
    }

    if (sort === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sort === 'highest_amount') {
      list.sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));
    } else if (sort === 'lowest_amount') {
      list.sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount));
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.max(1, Number(params.get('limit') || 50));
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const sliced = list.slice((page - 1) * limit, page * limit);

    return {
      data: sliced,
      pagination: { total, page, limit, totalPages },
    } as unknown as T;
  }

  if (path === '/orders/pos' && method === 'POST') {
    const newId = db.nextIds.invoice++;
    const cust = db.customers.find((c) => c.id === Number(body.customerId));
    const currentUser = getCurrentDemoUser(db);
    const totalAmount = Number(body.totalAmount || 0);
    const paidAmount = Number(body.paidAmount ?? totalAmount);
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    for (const item of body.items || []) {
      for (const p of db.products) {
        const variant = (p.variants || []).find((v: any) => v.id === Number(item.variantId));
        if (variant) {
          variant.stock = Math.max(0, Number(variant.stock || 0) - Number(item.quantity || 0));
        }
      }
    }

    if (cust && balanceDue > 0) {
      cust.outstandingBalance = Number(cust.outstandingBalance || 0) + balanceDue;
    }

    const invoice = {
      id: newId,
      invoiceNumber: `INV${newId}`,
      ...body,
      customerId: cust?.id || body.customerId || null,
      customerName: cust?.name || body.customerName || 'Walk-in Customer',
      customerPhone: cust?.phone || body.customerPhone || '',
      userId: currentUser.id,
      user: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
      totalAmount,
      paidAmount,
      balanceDue,
      paymentStatus: balanceDue <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING',
      isDispatched: body.isDispatched ?? true,
      createdAt: new Date().toISOString(),
      payments:
        body.payments ||
        (paidAmount > 0
          ? [{ id: Date.now(), amount: paidAmount, method: body.paymentMethod || 'CASH', paymentDate: new Date().toISOString() }]
          : []),
      returns: [],
    };
    db.invoices.unshift(invoice);
    saveDemoDb(db);
    return normalizeInvoice(invoice, db) as unknown as T;
  }

  const dispatchMatch = path.match(/^\/invoices\/(\d+)\/dispatch$/);
  if (dispatchMatch && method === 'PATCH') {
    const oid = Number(dispatchMatch[1]);
    const inv = db.invoices.find((i) => i.id === oid);
    const currentUser = getCurrentDemoUser(db);
    if (inv) {
      inv.isDispatched = Boolean(body.isDispatched);
      inv.dispatchedByRole = inv.isDispatched ? currentUser.role : null;
      saveDemoDb(db);
      return normalizeInvoice(inv, db) as unknown as T;
    }
  }

  const invoiceIdMatch = path.match(/^\/orders\/invoices\/(\d+)$/);
  if (invoiceIdMatch) {
    const oid = Number(invoiceIdMatch[1]);
    const idx = db.invoices.findIndex((i) => i.id === oid);
    if (method === 'GET') {
      if (idx !== -1) return normalizeInvoice(db.invoices[idx], db) as unknown as T;
      throw new Error('Invoice not found');
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (idx !== -1) {
        const oldInv = db.invoices[idx];
        const oldDue = Math.max(0, Number(oldInv.totalAmount || 0) - Number(oldInv.paidAmount || 0));
        const newTotal = Number(body.totalAmount ?? oldInv.totalAmount);
        const newPaid = Number(body.paidAmount ?? oldInv.paidAmount);
        const newDue = Math.max(0, newTotal - newPaid);

        const cust = db.customers.find((c) => c.id === Number(body.customerId ?? oldInv.customerId));
        if (cust) {
          cust.outstandingBalance = Math.max(0, Number(cust.outstandingBalance || 0) - oldDue + newDue);
        }

        db.invoices[idx] = { ...oldInv, ...body, totalAmount: newTotal, paidAmount: newPaid, balanceDue: newDue };
        saveDemoDb(db);
        return normalizeInvoice(db.invoices[idx], db) as unknown as T;
      }
    }
    if (method === 'DELETE') {
      if (idx !== -1) {
        const removed = db.invoices[idx];
        const due = Math.max(0, Number(removed.totalAmount || 0) - Number(removed.paidAmount || 0));
        const cust = db.customers.find((c) => c.id === Number(removed.customerId));
        if (cust && due > 0) {
          cust.outstandingBalance = Math.max(0, Number(cust.outstandingBalance || 0) - due);
        }
        db.invoices.splice(idx, 1);
        saveDemoDb(db);
      }
      return { success: true } as unknown as T;
    }
  }

  const orderReturnMatch = path.match(/^\/orders\/(\d+)\/returns$/);
  if (orderReturnMatch && method === 'POST') {
    const oid = Number(orderReturnMatch[1]);
    const inv = db.invoices.find((i) => i.id === oid);
    if (inv) {
      const returnRecord = {
        id: Date.now(),
        returnDate: new Date().toISOString(),
        reason: body.reason || 'Customer Return',
        returnedItems: body.items || body.returnedItems || [],
      };
      inv.returns = inv.returns || [];
      inv.returns.push(returnRecord);
      saveDemoDb(db);
      return normalizeInvoice(inv, db) as unknown as T;
    }
  }

  // Payments CRUD & Cheque Cancel/Replace
  const paymentCancelReplaceMatch = path.match(/^\/payments\/(\d+)\/cancel-replace$/);
  if (paymentCancelReplaceMatch && method === 'POST') {
    const pid = Number(paymentCancelReplaceMatch[1]);
    for (const inv of db.invoices) {
      const pIdx = (inv.payments || []).findIndex((p: any) => Number(p.id) === pid);
      if (pIdx !== -1) {
        inv.payments[pIdx] = { ...inv.payments[pIdx], ...body, chequeStatus: body.chequeStatus || 'REPLACED' };
        saveDemoDb(db);
        return { success: true, payment: inv.payments[pIdx] } as unknown as T;
      }
    }
    return { success: true } as unknown as T;
  }

  const paymentMatch = path.match(/^\/payments\/(\d+)$/);
  if (paymentMatch) {
    const pid = Number(paymentMatch[1]);
    for (const inv of db.invoices) {
      const pIdx = (inv.payments || []).findIndex((p: any) => Number(p.id) === pid);
      if (pIdx !== -1) {
        if (method === 'PUT' || method === 'PATCH') {
          inv.payments[pIdx] = { ...inv.payments[pIdx], ...body };
          saveDemoDb(db);
          return inv.payments[pIdx] as unknown as T;
        }
        if (method === 'DELETE') {
          const removedAmt = Number(inv.payments[pIdx].amount || 0);
          inv.payments.splice(pIdx, 1);
          inv.paidAmount = Math.max(0, Number(inv.paidAmount || 0) - removedAmt);
          inv.balanceDue = Math.max(0, Number(inv.totalAmount || 0) - inv.paidAmount);
          inv.paymentStatus = inv.balanceDue <= 0 ? 'PAID' : inv.paidAmount > 0 ? 'PARTIAL' : 'PENDING';
          saveDemoDb(db);
          return { success: true } as unknown as T;
        }
      }
    }
    return { success: true } as unknown as T;
  }

  // Presales / Sales Orders
  if (path === '/sales-orders') {
    if (method === 'GET') {
      return {
        orders: db.salesOrders,
        pagination: { total: db.salesOrders.length, page: 1, limit: 50, totalPages: 1 },
      } as unknown as T;
    }
    if (method === 'POST') {
      const newOrder = {
        id: db.nextIds.salesOrder++,
        orderNumber: `ORD-${db.nextIds.salesOrder}`,
        ...body,
        status: body.status || 'PENDING',
        createdAt: new Date().toISOString(),
      };
      db.salesOrders.unshift(newOrder);
      saveDemoDb(db);
      return newOrder as unknown as T;
    }
  }
  const salesOrderIdMatch = path.match(/^\/sales-orders\/(\d+)$/);
  if (salesOrderIdMatch) {
    const sid = Number(salesOrderIdMatch[1]);
    const found = db.salesOrders.find((o) => o.id === sid);
    if (method === 'GET' && found) return found as unknown as T;
    if (method === 'DELETE') {
      db.salesOrders = db.salesOrders.filter((o) => o.id !== sid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  // ── 7. GARMENT PRODUCTION & FINISHING ─────────────────────────────────────
  if (path === '/production/next-batch-number' && method === 'GET') {
    const nextNo = `BATCH-${new Date().getFullYear()}-${String(db.nextIds.production).padStart(2, '0')}`;
    return { productionNo: nextNo, data: { productionNo: nextNo } } as unknown as T;
  }

  if (path === '/production/summary' && method === 'GET') {
    const batches = db.productionBatches.map((b) => hydrateProductionBatch(b, db));
    const totalCut = batches.reduce((s, b) => s + Number(b.cutQty || 0), 0);
    const totalYardage = batches.reduce((s, b) => s + Number(b.fabricUsedQty || 0), 0);
    const todayCut = batches
      .filter((b) => new Date(b.cuttingDate || b.createdAt).toDateString() === new Date().toDateString())
      .reduce((s, b) => s + Number(b.cutQty || 0), 0);
    const totalFinished = db.finishingLogs.reduce((s, l) => s + Number(l.quantity || 0), 0);

    return {
      metrics: {
        todayOutput: todayCut || totalCut,
        todayBatches: batches.length,
        monthOutput: totalCut,
        monthBatches: batches.length,
        filteredBatches: batches.length,
        filteredGarments: totalCut,
        totalYardageConsumed: totalYardage,
        totalMaterialsCut: totalYardage,
        totalScrapReturned: 0,
        pendingStockSync: batches.filter((b) => b.status !== 'COMPLETED').length,
        syncedToInventory: batches.filter((b) => b.status === 'COMPLETED').length,
        totalCutToday: todayCut,
        totalCutWeek: totalCut,
        totalFinishedToday: totalFinished,
        totalFinishedWeek: totalFinished,
        currentWip: totalCut,
        activeWipBatches: batches.filter((b) => b.status !== 'COMPLETED').length,
      },
      materialBreakdown: db.rawMaterialItems.slice(0, 3).map((m) => ({
        name: m.name,
        unit: m.unit || 'METERS',
        totalIssued: 120,
        totalReturned: 0,
        netConsumed: 120,
        totalCost: 120 * Number(m.unitCostAverage || 1150),
      })),
      records: batches,
      batches,
    } as unknown as T;
  }

  if (path === '/production' || path === '/production/cut-batch' || path === '/production/batches') {
    if (method === 'GET') {
      const stageFilter = params.get('stage');
      const allHydrated = db.productionBatches.map((b) => hydrateProductionBatch(b, db));
      const batches = stageFilter
        ? allHydrated.filter((b) => String(b.stage).toUpperCase() === stageFilter.toUpperCase())
        : allHydrated;
      return { items: batches, batches, records: batches } as unknown as T;
    }
    if (method === 'POST') {
      const targetProds = Array.isArray(body.targetProducts)
        ? body.targetProducts
        : Array.isArray(body.products)
        ? body.products
        : [];
      const firstProdId = Number(body.productId || targetProds[0]?.productId || db.products[0]?.id || 1);
      const prod = db.products.find((p) => Number(p.id) === firstProdId) || db.products[0];
      const normProd = normalizeProduct(prod);
      const nextId = db.nextIds.production++;
      const prodNo = body.productionNo || body.batchNumber || `BATCH-${new Date().getFullYear()}-${String(nextId).padStart(2, '0')}`;
      const cutQty = Number(
        body.cutQty ||
          body.targetQuantity ||
          targetProds.reduce((s: number, tp: any) => s + Number(tp.cutQty || tp.plannedQty || 0), 0) ||
          0
      );

      // Deduct issued raw material stock and build materialUsages with hydrated rawMaterial
      const issuedMaterials = Array.isArray(body.materials) ? body.materials : [];
      let totalFabricUsed = 0;
      const materialUsages = issuedMaterials.map((m: any, idx: number) => {
        const rmItem =
          db.rawMaterialItems.find((r) => Number(r.id) === Number(m.rawMaterialId || m.rawMaterialItemId || m.materialId)) ||
          db.rawMaterialItems[0];
        const qtyUsed = Number(m.issuedQty ?? m.quantityUsed ?? m.quantity ?? m.unitsQty ?? 0);
        totalFabricUsed += qtyUsed;
        if (rmItem && qtyUsed > 0) {
          const curr = Number(rmItem.currentStock ?? 0);
          rmItem.currentStock = Math.max(0, curr - qtyUsed);
          rmItem.totalValue = rmItem.currentStock * Number(rmItem.unitCostAverage ?? 0);
          rmItem.updatedAt = new Date().toISOString();
        }
        return {
          id: Date.now() + idx,
          rawMaterialId: rmItem?.id || Number(m.rawMaterialId || m.rawMaterialItemId || 1),
          rawMaterial: rmItem,
          rawMaterialItemId: rmItem?.id || Number(m.rawMaterialId || m.rawMaterialItemId || 1),
          rawMaterialItem: rmItem,
          issuedQty: qtyUsed,
          returnedQty: 0,
          netConsumedQty: qtyUsed,
          quantityUsed: qtyUsed,
          piecesCount: Number(m.piecesCount ?? m.rollsCount ?? 1),
          unitCost: Number(rmItem?.unitCostAverage || 0),
          totalCost: qtyUsed * Number(rmItem?.unitCostAverage || 0),
        };
      });

      const cutDate = body.cuttingDate || body.cutDate || body.productionDate || new Date().toISOString();
      const newBatch = hydrateProductionBatch(
        {
          id: nextId,
          batchNumber: prodNo,
          productionNo: prodNo,
          productId: normProd.id,
          product: normProd,
          variantId: body.variantId || targetProds[0]?.variantId || null,
          stage: body.stage || 'CUTTING',
          status: body.status || 'CUTTING',
          isStockSynced: false,
          targetQuantity: cutQty,
          cutQty,
          lineQty: 0,
          lineSentQty: 0,
          sewnQty: 0,
          sentToWashQty: 0,
          washedQty: 0,
          remainingInWash: 0,
          packedQty: 0,
          damagedQty: 0,
          fabricUsedQty: totalFabricUsed || Number(body.fabricUsedQty || 0),
          cuttingDate: cutDate,
          productionDate: cutDate,
          createdAt: new Date().toISOString(),
          notes: body.notes || '',
          reason: body.reason || 'Garment Cutting Run',
          targetProducts: targetProds,
          materialUsages,
          cutLogs: [{ id: Date.now(), cutDate, quantityCut: cutQty, notes: body.notes || 'Cutting Run' }],
          activityLogs: [
            {
              id: Date.now(),
              stage: 'CUTTING',
              action: 'CUT',
              quantity: cutQty,
              timestamp: cutDate,
              createdAt: cutDate,
            },
          ],
        },
        db
      );
      db.productionBatches.unshift(newBatch);
      saveDemoDb(db);
      return newBatch as unknown as T;
    }
  }

  const prodBatchMatch = path.match(
    /^\/production\/(?:batches\/)?(\d+)(?:\/(cut-logs|line|log-sewn|send-to-line|send-to-wash|wash|finish-logs|finalize|sync-stock|return-materials|append-fabric|cancel|revert-log\/\d+))?$/
  );
  if (prodBatchMatch) {
    const bid = Number(prodBatchMatch[1]);
    const subAction = prodBatchMatch[2];
    const batch = db.productionBatches.find((b) => b.id === bid);
    if (method === 'GET' && batch) return batch as unknown as T;
    if (method === 'DELETE') {
      if (subAction === 'line' && batch) {
        batch.stage = 'CUTTING';
        batch.status = 'CUTTING';
        batch.lineQty = 0;
        batch.lineSentQty = 0;
      } else if (subAction === 'wash' && batch) {
        batch.stage = 'LINE';
        batch.status = 'LINE';
        batch.washedQty = 0;
      } else {
        db.productionBatches = db.productionBatches.filter((b) => b.id !== bid);
      }
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
    if ((method === 'POST' || method === 'PUT') && batch) {
      const nowIso = new Date().toISOString();
      if (subAction === 'send-to-line') {
        const qty = Number(body.quantity ?? body.sentToLineQty ?? batch.cutQty ?? 0);
        batch.stage = 'LINE';
        batch.status = 'LINE';
        batch.lineQty = Number(batch.lineQty || 0) + qty;
        batch.lineSentQty = Number(batch.lineSentQty || 0) + qty;
        batch.activityLogs = batch.activityLogs || [];
        batch.activityLogs.push({ id: Date.now(), stage: 'LINE', action: 'SEND_TO_LINE', quantity: qty, timestamp: nowIso, createdAt: nowIso });
      } else if (subAction === 'log-sewn') {
        const qty = Number(body.sewnQuantity ?? body.quantity ?? 0);
        batch.sewnQty = Number(batch.sewnQty || 0) + qty;
        batch.activityLogs = batch.activityLogs || [];
        batch.activityLogs.push({ id: Date.now(), stage: 'LINE', action: 'LOG_SEWN', quantity: qty, timestamp: nowIso, createdAt: nowIso });
      } else if (subAction === 'send-to-wash') {
        const qty = Number(body.quantity ?? body.sentToWashQty ?? 0);
        batch.stage = 'WASHING';
        batch.status = 'WASHING';
        batch.sentToWashQty = Number(batch.sentToWashQty || 0) + qty;
        batch.remainingInWash = Math.max(0, batch.sentToWashQty - Number(batch.washedQty || 0));
        batch.activityLogs = batch.activityLogs || [];
        batch.activityLogs.push({ id: Date.now(), stage: 'WASHING', action: 'SEND_TO_WASH', quantity: qty, timestamp: nowIso, createdAt: nowIso });
      } else if (subAction === 'wash') {
        const washedDelta = Number(body.washedQuantity ?? body.quantity ?? 0);
        const washDate = body.washDate || nowIso;
        batch.washedQty = Number(batch.washedQty || 0) + washedDelta;
        const sent = Number(batch.sentToWashQty || batch.lineSentQty || batch.cutQty || 0);
        batch.sentToWashQty = sent;
        batch.remainingInWash = Math.max(0, sent - batch.washedQty);
        batch.washLogs = batch.washLogs || [];
        batch.washLogs.push({ id: Date.now(), washDate, washedQuantity: washedDelta, notes: body.notes || '' });
        batch.activityLogs = batch.activityLogs || [];
        batch.activityLogs.push({ id: Date.now() + 1, stage: 'WASHING', action: 'WASHED', quantity: washedDelta, timestamp: washDate, createdAt: washDate });

        if (Array.isArray(body.items) && body.items.length > 0) {
          for (const item of body.items) {
            const prod = db.products.find((p) => Number(p.id) === Number(item.productId || batch.productId));
            const qty = Number(item.quantity || 0);
            if (prod && Array.isArray(prod.variants) && prod.variants.length > 0 && qty > 0) {
              const targetVar = prod.variants.find((v: any) => Number(v.id) === Number(item.variantId)) || prod.variants[0];
              targetVar.stock = Number(targetVar.stock || 0) + qty;
            }
          }
        } else if (washedDelta > 0) {
          const prod = db.products.find((p) => Number(p.id) === Number(batch.productId));
          if (prod && Array.isArray(prod.variants) && prod.variants.length > 0) {
            prod.variants[0].stock = Number(prod.variants[0].stock || 0) + washedDelta;
          }
        }

        if (batch.remainingInWash <= 0) {
          batch.status = 'COMPLETED';
          batch.isStockSynced = true;
        } else {
          batch.status = 'WASHING';
        }
      } else if (subAction === 'finalize' || subAction === 'sync-stock' || subAction === 'finish-logs') {
        batch.status = 'COMPLETED';
        batch.isStockSynced = true;
        batch.packedQty = Number(body.quantity ?? batch.packedQty ?? batch.washedQty ?? batch.cutQty ?? 0);
      } else if (subAction === 'cancel') {
        batch.status = 'CANCELLED';
      } else if (subAction === 'append-fabric') {
        batch.fabricUsedQty = Number(batch.fabricUsedQty || 0) + Number(body.quantity || 0);
      } else if (subAction === 'return-materials') {
        batch.notes = body.notes || batch.notes;
      } else {
        Object.assign(batch, body);
      }
      saveDemoDb(db);
      return batch as unknown as T;
    }
  }

  if (path === '/finishing') {
    if (method === 'GET') {
      return db.finishingLogs.map((l) => {
        const prod = db.products.find((p) => Number(p.id) === Number(l.productId));
        return {
          ...l,
          product: prod ? normalizeProduct(prod) : normalizeProduct(l.product || db.products[0]),
        };
      }) as unknown as T;
    }
    if (method === 'POST') {
      const prod = db.products.find((p) => Number(p.id) === Number(body.productId)) || db.products[0];
      const log = {
        id: db.nextIds.finishing++,
        ...body,
        productId: prod?.id || Number(body.productId || 1),
        product: normalizeProduct(prod),
        action: String(body.action || 'PACK').toUpperCase(),
        quantity: Number(body.quantity || 0),
        finishDate: body.finishDate || new Date().toISOString(),
        createdAt: body.finishDate || new Date().toISOString(),
      };
      db.finishingLogs.unshift(log);
      saveDemoDb(db);
      return log as unknown as T;
    }
  }
  if (path === '/finishing/summary' && method === 'GET') {
    const todayStr = new Date().toDateString();
    const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let todayIroned = 0;
    let todayPacked = 0;
    let weekIroned = 0;
    let weekPacked = 0;
    let totalIroned = 0;
    let totalPacked = 0;

    for (const l of db.finishingLogs) {
      const qty = Number(l.quantity || 0);
      const act = String(l.action || '').toUpperCase();
      const dt = new Date(l.finishDate || l.createdAt);
      const isToday = dt.toDateString() === todayStr;
      const isWeek = dt.getTime() >= weekAgoMs;

      if (act === 'IRON') {
        totalIroned += qty;
        if (isToday) todayIroned += qty;
        if (isWeek) weekIroned += qty;
      } else {
        totalPacked += qty;
        if (isToday) todayPacked += qty;
        if (isWeek) weekPacked += qty;
      }
    }

    return {
      todayIroned,
      todayPacked,
      weekIroned,
      weekPacked,
      totalIroned,
      totalPacked,
      totalOutput: totalIroned + totalPacked,
      logsCount: db.finishingLogs.length,
    } as unknown as T;
  }
  const finIdMatch = path.match(/^\/finishing\/(\d+)$/);
  if (finIdMatch) {
    const fid = Number(finIdMatch[1]);
    if (method === 'PUT' || method === 'PATCH') {
      const idx = db.finishingLogs.findIndex((l) => l.id === fid);
      if (idx !== -1) {
        db.finishingLogs[idx] = { ...db.finishingLogs[idx], ...body };
        saveDemoDb(db);
        return db.finishingLogs[idx] as unknown as T;
      }
    }
    if (method === 'DELETE') {
      db.finishingLogs = db.finishingLogs.filter((l) => l.id !== fid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  // ── 8. RAW MATERIALS & SUPPLIERS ──────────────────────────────────────────
  if (path === '/raw-material-shops') {
    if (method === 'GET') return db.rawMaterialShops as unknown as T;
    if (method === 'POST') {
      const shop = { id: db.nextIds.shop++, balance: 0, ...body, createdAt: new Date().toISOString() };
      db.rawMaterialShops.unshift(shop);
      saveDemoDb(db);
      return shop as unknown as T;
    }
  }
  const shopIdMatch = path.match(/^\/raw-material-shops\/(\d+)$/);
  if (shopIdMatch) {
    const sid = Number(shopIdMatch[1]);
    if (method === 'PUT' || method === 'PATCH') {
      const idx = db.rawMaterialShops.findIndex((s) => s.id === sid);
      if (idx !== -1) {
        db.rawMaterialShops[idx] = { ...db.rawMaterialShops[idx], ...body };
        saveDemoDb(db);
        return db.rawMaterialShops[idx] as unknown as T;
      }
    }
    if (method === 'DELETE') {
      db.rawMaterialShops = db.rawMaterialShops.filter((s) => s.id !== sid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  if (path === '/raw-material-items/next-code' && method === 'GET') {
    return { code: `RM-00${db.nextIds.materialItem}` } as unknown as T;
  }
  if ((path === '/raw-material-items/deduct' || path === '/raw-material-items/scrap-return') && method === 'POST') {
    const rid = Number(body.rawMaterialItemId);
    const qty = Number(body.quantity || 0);
    const item = db.rawMaterialItems.find((r) => r.id === rid);
    if (item) {
      const isDeduct = path.endsWith('/deduct');
      const curr = Number(item.currentStock ?? item.stock ?? 0);
      item.currentStock = isDeduct ? Math.max(0, curr - qty) : curr + qty;
      item.totalValue = item.currentStock * Number(item.unitCostAverage ?? item.unitCost ?? 0);
      db.rawMaterialMovements = db.rawMaterialMovements || [];
      db.rawMaterialMovements.unshift({
        id: Date.now(),
        rawMaterialItemId: rid,
        type: isDeduct ? 'PRODUCTION_USE' : 'SCRAP_RETURN',
        quantity: qty,
        notes: body.notes || body.reference || '',
        createdAt: body.customDate || new Date().toISOString(),
      });
      saveDemoDb(db);
      return item as unknown as T;
    }
  }
  if (path === '/raw-material-items') {
    if (method === 'GET') {
      return db.rawMaterialItems.map((item: any) => {
        const currentStock = Number(item.currentStock ?? item.stock ?? 0);
        const unitCostAverage = Number(item.unitCostAverage ?? item.unitCost ?? 0);
        const alertThreshold = Number(item.alertThreshold ?? item.lowStockThreshold ?? 10);
        return {
          ...item,
          unit: item.unit || 'METERS',
          currentStock,
          alertThreshold,
          unitCostAverage,
          totalValue: currentStock * unitCostAverage,
          _count: item._count || { purchaseItems: 0 },
        };
      }) as unknown as T;
    }
    if (method === 'POST') {
      const currentStock = Number(body.currentStock ?? 0);
      const unitCostAverage = Number(body.unitCostAverage ?? 0);
      const item = {
        id: db.nextIds.materialItem++,
        code: body.code || `RM-00${db.nextIds.materialItem}`,
        name: body.name || 'New Raw Material',
        description: body.description || '',
        unit: body.unit || 'METERS',
        currentStock,
        alertThreshold: Number(body.alertThreshold ?? 10),
        unitCostAverage,
        totalValue: currentStock * unitCostAverage,
        _count: { purchaseItems: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.rawMaterialItems.unshift(item);
      saveDemoDb(db);
      return item as unknown as T;
    }
  }
  const rmMovementMatch = path.match(/^\/raw-material-items\/movements\/(\d+)$/);
  if (rmMovementMatch) {
    const mid = Number(rmMovementMatch[1]);
    if (method === 'PUT' || method === 'PATCH') {
      const idx = (db.rawMaterialMovements || []).findIndex((m: any) => Number(m.id) === mid);
      if (idx !== -1) {
        db.rawMaterialMovements[idx] = { ...db.rawMaterialMovements[idx], ...body };
        saveDemoDb(db);
        return db.rawMaterialMovements[idx] as unknown as T;
      }
      return { success: true } as unknown as T;
    }
    if (method === 'DELETE') {
      db.rawMaterialMovements = (db.rawMaterialMovements || []).filter((m: any) => Number(m.id) !== mid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  const rmItemMatch = path.match(/^\/raw-material-items\/(\d+)(?:\/(movements|adjust|stock))?$/);
  if (rmItemMatch) {
    const rid = Number(rmItemMatch[1]);
    const sub = rmItemMatch[2];
    const idx = db.rawMaterialItems.findIndex((r) => r.id === rid);
    if (sub === 'movements' && method === 'GET') {
      return (db.rawMaterialMovements || []).filter((m: any) => Number(m.rawMaterialItemId) === rid) as unknown as T;
    }
    if ((sub === 'adjust' || sub === 'stock') && method === 'POST' && idx !== -1) {
      const item = db.rawMaterialItems[idx];
      const delta = Number(body.quantity ?? body.delta ?? 0);
      const type = String(body.type || '').toUpperCase();
      const nextStock =
        type === 'OUT' || type === 'DEDUCT'
          ? Math.max(0, Number(item.currentStock || 0) - Math.abs(delta))
          : Number(item.currentStock || 0) + delta;
      item.currentStock = nextStock;
      item.totalValue = nextStock * Number(item.unitCostAverage || 0);
      item.updatedAt = new Date().toISOString();
      db.rawMaterialMovements = db.rawMaterialMovements || [];
      db.rawMaterialMovements.unshift({
        id: Date.now(),
        rawMaterialItemId: rid,
        type: type || 'ADJUSTMENT',
        quantity: delta,
        notes: body.notes || 'Demo stock adjustment',
        createdAt: new Date().toISOString(),
      });
      saveDemoDb(db);
      return item as unknown as T;
    }
    if (method === 'GET' && idx !== -1) return db.rawMaterialItems[idx] as unknown as T;
    if ((method === 'PUT' || method === 'PATCH') && idx !== -1) {
      db.rawMaterialItems[idx] = { ...db.rawMaterialItems[idx], ...body, updatedAt: new Date().toISOString() };
      saveDemoDb(db);
      return db.rawMaterialItems[idx] as unknown as T;
    }
    if (method === 'DELETE') {
      db.rawMaterialItems = db.rawMaterialItems.filter((r) => r.id !== rid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  if (path === '/buy-raw-materials/next-invoice' && method === 'GET') {
    return { invoiceNumber: `GRN-100${db.nextIds.buyRawMaterial}` } as unknown as T;
  }
  if (path === '/buy-raw-materials') {
    if (method === 'GET') return db.buyRawMaterials as unknown as T;
    if (method === 'POST') {
      const shop = db.rawMaterialShops.find((s) => s.id === Number(body.shopId));
      const grn = {
        id: db.nextIds.buyRawMaterial++,
        invoiceNumber: body.invoiceNumber || `GRN-100${db.nextIds.buyRawMaterial}`,
        shop: shop || null,
        ...body,
        purchaseDate: body.purchaseDate || new Date().toISOString(),
      };
      db.buyRawMaterials.unshift(grn);
      saveDemoDb(db);
      return grn as unknown as T;
    }
  }
  if ((path === '/buy-raw-materials/settle-payment' || path === '/supplier-payments') && method === 'POST') {
    const bill = db.buyRawMaterials.find((b) => b.id === Number(body.purchaseId || body.id));
    const amt = Number(body.amount || 0);
    if (bill) {
      bill.paidAmount = Number(bill.paidAmount || 0) + amt;
      bill.balanceDue = Math.max(0, Number(bill.balanceDue || 0) - amt);
      bill.paymentStatus = bill.balanceDue <= 0 ? 'PAID' : 'PARTIAL';
      saveDemoDb(db);
      return bill as unknown as T;
    }
    return { success: true } as unknown as T;
  }
  const buyRmMatch = path.match(/^\/buy-raw-materials\/(\d+)$/);
  if (buyRmMatch) {
    const bid = Number(buyRmMatch[1]);
    const idx = db.buyRawMaterials.findIndex((b) => b.id === bid);
    if (method === 'GET' && idx !== -1) return db.buyRawMaterials[idx] as unknown as T;
    if ((method === 'PUT' || method === 'PATCH') && idx !== -1) {
      db.buyRawMaterials[idx] = { ...db.buyRawMaterials[idx], ...body };
      saveDemoDb(db);
      return db.buyRawMaterials[idx] as unknown as T;
    }
    if (method === 'DELETE') {
      db.buyRawMaterials = db.buyRawMaterials.filter((b) => b.id !== bid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  // ── 9. EXPENSES & CATEGORIES ──────────────────────────────────────────────
  if (path === '/expenses/categories') {
    if (method === 'GET') return db.expenseCategories as unknown as T;
    if (method === 'POST') {
      const cat = {
        id: db.nextIds.expenseCategory++,
        name: body.name,
        description: body.description || '',
        parentId: body.parentId ? Number(body.parentId) : null,
        isActive: true,
        subCategories: [],
      };
      db.expenseCategories.push(cat);
      saveDemoDb(db);
      return cat as unknown as T;
    }
  }
  const expCatMatch = path.match(/^\/expenses\/categories\/(\d+)$/);
  if (expCatMatch) {
    const ecid = Number(expCatMatch[1]);
    const idx = db.expenseCategories.findIndex((c) => c.id === ecid);
    if ((method === 'PUT' || method === 'PATCH') && idx !== -1) {
      db.expenseCategories[idx] = { ...db.expenseCategories[idx], ...body };
      saveDemoDb(db);
      return db.expenseCategories[idx] as unknown as T;
    }
    if (method === 'DELETE') {
      db.expenseCategories = db.expenseCategories.filter((c) => c.id !== ecid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  if (path === '/expenses') {
    if (method === 'GET') {
      const totalExpenses = db.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      return {
        expenses: db.expenses,
        summary: {
          totalExpenses,
          totalCount: db.expenses.length,
          averageExpense: db.expenses.length > 0 ? totalExpenses / db.expenses.length : 0,
        },
      } as unknown as T;
    }
    if (method === 'POST') {
      const cat = db.expenseCategories.find((c) => c.id === Number(body.categoryId));
      const subCat = body.subCategoryId
        ? db.expenseCategories.find((c) => c.id === Number(body.subCategoryId))
        : null;
      const exp = {
        id: db.nextIds.expense++,
        voucherCode: `EXP-000${db.nextIds.expense}`,
        ...body,
        category: cat ? { id: cat.id, name: cat.name } : undefined,
        subCategory: subCat ? { id: subCat.id, name: subCat.name } : undefined,
        createdAt: new Date().toISOString(),
      };
      db.expenses.unshift(exp);
      saveDemoDb(db);
      return exp as unknown as T;
    }
  }
  const expIdMatch = path.match(/^\/expenses\/(\d+)$/);
  if (expIdMatch) {
    const eid = Number(expIdMatch[1]);
    const idx = db.expenses.findIndex((e) => e.id === eid);
    if ((method === 'PUT' || method === 'PATCH') && idx !== -1) {
      db.expenses[idx] = { ...db.expenses[idx], ...body };
      saveDemoDb(db);
      return db.expenses[idx] as unknown as T;
    }
    if (method === 'DELETE') {
      db.expenses = db.expenses.filter((e) => e.id !== eid);
      saveDemoDb(db);
      return { success: true } as unknown as T;
    }
  }

  // ── 10. REPORTS & SETTINGS ────────────────────────────────────────────────
  const reportMatch = path.match(/^\/reports\/([^/]+)\/data$/);
  if (reportMatch && method === 'GET') {
    return computeReportData(db, reportMatch[1]) as unknown as T;
  }

  if (path === '/settings') {
    if (method === 'GET') return db.settings as unknown as T;
    if (method === 'PUT' || method === 'POST') {
      if (Array.isArray(body)) {
        for (const entry of body) {
          if (entry?.key) db.settings[entry.key] = String(entry.value ?? '');
        }
      } else {
        Object.assign(db.settings, body);
      }
      saveDemoDb(db);
      return db.settings as unknown as T;
    }
  }

  // Diagnostic warning for any unmapped route so missed endpoints are immediately visible
  console.warn('[DEMO MOCK UNMATCHED]', method, path, body);
  if (method === 'GET') {
    return [] as unknown as T;
  }
  return { success: true } as unknown as T;
}

/**
 * Generates and downloads a branded client-side jsPDF report when `downloadBlob()`
 * is called in demo mode, ensuring zero backend HTTP requests.
 */
export async function handleMockDownloadBlob(endpoint: string, defaultFilename: string): Promise<void> {
  const { path } = parseUrl(endpoint);
  const db = loadDemoDb();
  const logoData = await loadLogoAsDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const moduleMatch = path.match(/^\/reports\/([^/]+)\/pdf$/);
  const moduleName = moduleMatch ? moduleMatch[1].toUpperCase() : 'ERP REPORT';
  const reportResp = computeReportData(db, moduleMatch?.[1] || 'sales') as any;
  const summary = reportResp?.data?.summary || {};

  const startY = drawStandardReportHeader(doc, {
    logoData,
    reportTitle: `${moduleName} REPORT`,
    generatedTimestamp: formatReportTimestamp(),
    generatedBy: 'Live Demo Sandbox',
    metaRows: [
      { label: 'Environment:', value: 'Interactive Demo', isBold: true },
      { label: 'Currency:', value: 'LKR (Rs.)' },
    ],
  });

  const summaryEntries = Object.entries(summary)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .map(([k, v]) => [
      k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      typeof v === 'number' && !k.toLowerCase().includes('count') && !k.toLowerCase().includes('stock')
        ? formatCurrency(v)
        : String(v),
    ]);

  autoTable(doc, {
    startY: startY + 12,
    head: [['Metric', 'Value']],
    body: summaryEntries.length > 0 ? summaryEntries : [['Status', 'Demo Snapshot Ready']],
    theme: 'grid',
    headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 6 },
    margin: { left: 42.5, right: 42.5 },
  });

  drawStandardReportFooter(doc, `${moduleName} Report`);
  doc.save(defaultFilename || `apex-demo-${moduleName.toLowerCase()}.pdf`);
}
