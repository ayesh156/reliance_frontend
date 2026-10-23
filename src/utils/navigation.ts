import type { AuthUser } from '../contexts/AuthContext';

export interface RoutePermissionMapping {
  route: string;
  actualPath: string;
  permission: string;
}

/**
 * Ordered list of sidebar routes checked sequentially against the user's permissions:
 * ['/system/quick-invoice', '/system/invoices', '/system/orders', '/system/products',
 *  '/system/customers', '/system/production', '/system/line', '/system/wash',
 *  '/system/materials', '/system/reports', '/system/settings']
 */
export const ORDERED_SIDEBAR_ROUTES: RoutePermissionMapping[] = [
  { route: '/system/quick-invoice', actualPath: '/system/quick-invoice', permission: 'pos' },
  { route: '/system/invoices', actualPath: '/system/invoices', permission: 'invoices' },
  { route: '/system/orders', actualPath: '/system/orders', permission: 'orders' },
  { route: '/system/products', actualPath: '/system/products', permission: 'products' },
  { route: '/system/customers', actualPath: '/system/customers', permission: 'customers' },
  { route: '/system/production', actualPath: '/system/production', permission: 'production' },
  { route: '/system/line', actualPath: '/system/line', permission: 'line' },
  { route: '/system/wash', actualPath: '/system/wash', permission: 'wash' },
  { route: '/system/materials', actualPath: '/system/buy-raw-materials', permission: 'materials' },
  { route: '/system/reports', actualPath: '/system/reports', permission: 'reports' },
  { route: '/system/settings', actualPath: '/system/settings', permission: 'settings' },
];

/**
 * Helper function that checks the ordered list of sidebar routes against
 * the user's permissions and returns the first route the user is permitted to access.
 */
export function getFirstAllowedRoute(user: AuthUser | null | undefined): string {
  if (!user) return '/login';

  const userRole = String(user.role || '').toUpperCase();

  // Administrators have unrestricted access
  if (userRole === 'ADMIN') {
    return '/system/quick-invoice';
  }

  // Sales Representatives (REP)
  if (userRole === 'REP') {
    return '/system/quick-invoice';
  }

  // Cashiers (CASHIER)
  if (userRole === 'CASHIER') {
    return '/system/quick-invoice';
  }

  // Staff users: check ordered list of sidebar routes against assigned permissions
  const permissions: string[] = Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : ['production', 'line', 'wash', 'materials'];

  for (const item of ORDERED_SIDEBAR_ROUTES) {
    if (permissions.includes(item.permission)) {
      return item.actualPath;
    }
  }

  // Safe fallback if no permissions matched
  return '/system/invoices';
}
