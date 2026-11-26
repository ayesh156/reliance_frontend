import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Layout } from './Layout';
import { AccessDenied } from './AccessDenied';
import { IS_DEMO_MODE } from '../config/brand';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, requiredPermission }) => {
  const { isAuthenticated, loading, user, hasPermission, loginAsDemoRole } = useAuth();
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);

  const explicitLogout = typeof window !== 'undefined' && sessionStorage.getItem('demo_explicit_logout') === 'true';

  // In Demo Mode, visitors navigating directly to /system/* without an active session
  // are auto-authenticated as Demo Admin unless they explicitly clicked Sign Out.
  useEffect(() => {
    if (IS_DEMO_MODE && !loading && !isAuthenticated && !explicitLogout && !autoLoggingIn) {
      setAutoLoggingIn(true);
      loginAsDemoRole('ADMIN')
        .catch(() => {})
        .finally(() => setAutoLoggingIn(false));
    }
  }, [loading, isAuthenticated, explicitLogout, autoLoggingIn, loginAsDemoRole]);

  if (loading || autoLoggingIn || (IS_DEMO_MODE && !isAuthenticated && !explicitLogout)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Administrators and Super Administrators automatically bypass all role and permission checks
  const userRole = String(user?.role || '').toUpperCase();
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  // Check required permission for Staff users
  if (requiredPermission && user?.role === 'STAFF') {
    if (!hasPermission(requiredPermission)) {
      return (
        <Layout>
          <AccessDenied requiredRole={`PERMISSION: ${requiredPermission.toUpperCase()}`} />
        </Layout>
      );
    }
  }

  // Check required role if specified
  if (requiredRole && user) {
    const roles = (Array.isArray(requiredRole) ? requiredRole : [requiredRole]).map((r) => String(r).toUpperCase());
    // If allowedRoles includes 'ADMIN', implicitly allow 'SUPER_ADMIN' to bypass restriction
    if (roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) {
      roles.push('SUPER_ADMIN');
    }
    if (userRole === 'SUPER_ADMIN') {
      return <>{children}</>;
    }
    // If the route allows access via permission (e.g. materials for raw materials), allow it
    const hasPermit = requiredPermission ? hasPermission(requiredPermission) : false;
    if (!roles.includes(userRole) && !hasPermit) {
      return (
        <Layout>
          <AccessDenied requiredRole={requiredRole} />
        </Layout>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;