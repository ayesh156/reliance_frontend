import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency } from '../lib/utils';
import { get } from '../lib/api';
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight,
  Package, Users, AlertTriangle, Star, Clock, Loader2,
  BarChart3, ShoppingBag, AlertCircle, Eye,
} from 'lucide-react';

interface DashboardMetrics {
  todayRevenue: number;
  revenueGrowth: number;
  pendingOrdersCount: number;
  lowStockItemsCount: number;
  totalActiveCustomers: number;
  recentOrders: {
    id: number;
    customerName: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
    createdAt: string;
  }[];
  lowStockProducts: {
    id: number;
    productId: number;
    productName: string;
    size: string;
    color: string;
    sku: string;
    stock: number;
  }[];
}

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  PENDING: { label: 'Pending', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  PAID: { label: 'Paid', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  CANCELLED: { label: 'Cancelled', badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20' },
  PENDING_RECEIPT: { label: 'Pending Receipt', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  PAYMENT_REVIEW: { label: 'Payment Review', badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20' },
  PAYMENT_VERIFIED: { label: 'Payment Verified', badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  PROCESSING: { label: 'Processing', badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  SHIPPED: { label: 'Shipped', badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20' },
  DELIVERED: { label: 'Delivered', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
};

export const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await get<DashboardMetrics>('/dashboard/live-metrics');
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard operational data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Dynamic Theme Card Container
  const cardClass = `rounded-2xl border p-5 transition-all duration-200 ${
    dark 
      ? 'bg-zinc-900/60 border-zinc-800/80 shadow-lg shadow-black/40' 
      : 'bg-white border-slate-200/90 shadow-sm'
  }`;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className={`text-xs font-medium ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
          Initializing Reliance Command Center...
        </p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <p className={`text-sm font-medium ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>{error}</p>
        <button
          onClick={() => { setLoading(true); fetchMetrics(); }}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const {
    todayRevenue,
    revenueGrowth,
    pendingOrdersCount,
    lowStockItemsCount,
    totalActiveCustomers,
    recentOrders,
    lowStockProducts,
  } = metrics;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${dark ? 'text-zinc-50' : 'text-slate-900'}`}>
            Operations Command
          </h1>
          <p className={`text-xs mt-1 font-normal ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            Real-time analytics and inventory telemetry
          </p>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Today's Gross
            </span>
            <div className={`p-2 rounded-xl ${dark ? 'bg-zinc-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-bold font-display tracking-tight ${dark ? 'text-zinc-50' : 'text-slate-900'}`}>
              {formatCurrency(todayRevenue)}
            </p>
            <div className="flex items-center gap-1 mt-2 text-xs font-medium">
              {revenueGrowth >= 0 ? (
                <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +{revenueGrowth.toFixed(1)}%
                </span>
              ) : (
                <span className="flex items-center text-rose-600 dark:text-rose-400 font-semibold">
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> -{Math.abs(revenueGrowth).toFixed(1)}%
                </span>
              )}
              <span className={dark ? 'text-zinc-500' : 'text-slate-400'}>vs yesterday</span>
            </div>
          </div>
        </div>

        {/* Pending Orders */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Pending Action
            </span>
            <div className={`p-2 rounded-xl ${dark ? 'bg-zinc-800 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-bold tracking-tight ${dark ? 'text-zinc-50' : 'text-slate-900'}`}>
              {pendingOrdersCount}
            </p>
            <p className={`text-xs mt-2 font-medium ${pendingOrdersCount > 0 ? 'text-amber-600 dark:text-amber-400' : (dark ? 'text-zinc-500' : 'text-slate-400')}`}>
              {pendingOrdersCount > 0 ? 'Orders awaiting dispatch' : 'Queue cleared'}
            </p>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Inventory Alert
            </span>
            <div className={`p-2 rounded-xl ${lowStockItemsCount > 0 ? (dark ? 'bg-zinc-800 text-rose-400' : 'bg-rose-50 text-rose-600') : (dark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600')}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-bold tracking-tight ${lowStockItemsCount > 0 ? 'text-rose-600 dark:text-rose-400' : (dark ? 'text-zinc-50' : 'text-slate-900')}`}>
              {lowStockItemsCount}
            </p>
            <p className={`text-xs mt-2 font-medium ${lowStockItemsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {lowStockItemsCount > 0 ? 'Variants need replenishment' : 'Optimal inventory health'}
            </p>
          </div>
        </div>

        {/* Active Customers */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Active Accounts
            </span>
            <div className={`p-2 rounded-xl ${dark ? 'bg-zinc-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-bold tracking-tight ${dark ? 'text-zinc-50' : 'text-slate-900'}`}>
              {totalActiveCustomers}
            </p>
            <p className={`text-xs mt-2 font-medium ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
              Retail &amp; Wholesale client base
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Recent Transactions & Low Stock Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices Table */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <ShoppingBag className={`w-4 h-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`} />
              <h3 className={`text-sm font-bold uppercase tracking-wider ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
                Recent Orders
              </h3>
            </div>
            <NavLink
              to="/system/invoices"
              className={`text-xs font-semibold flex items-center gap-1 transition-colors ${
                dark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Invoices <Eye className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          {recentOrders.length === 0 ? (
            <p className={`text-xs py-8 text-center ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>No recent transactions logged</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`text-[10px] font-semibold uppercase tracking-wider border-b ${
                    dark ? 'border-zinc-800 text-zinc-500' : 'border-slate-100 text-slate-400'
                  }`}>
                    <th className="pb-2.5">ID</th>
                    <th className="pb-2.5">Client</th>
                    <th className="pb-2.5">Total</th>
                    <th className="pb-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y text-xs ${dark ? 'divide-zinc-800/60' : 'divide-slate-100'}`}>
                  {recentOrders.map(order => {
                    const status = STATUS_CONFIG[order.status] || { label: order.status, badge: 'bg-zinc-800 text-zinc-400' };
                    return (
                      <tr key={order.id} className={dark ? 'hover:bg-zinc-800/30' : 'hover:bg-slate-50/80'}>
                        <td className={`py-3 font-mono font-semibold ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>
                          #{order.id}
                        </td>
                        <td className={`py-3 font-medium ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>
                          {order.customerName}
                        </td>
                        <td className={`py-3 font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
                          {formatCurrency(order.totalAmount)}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${status.badge}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock List */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Package className={`w-4 h-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`} />
              <h3 className={`text-sm font-bold uppercase tracking-wider ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
                Restock Directives
              </h3>
            </div>
            <span className={`text-[11px] font-medium ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
              {lowStockProducts.length} items flagged
            </span>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Star className="w-8 h-8 text-emerald-500/40" />
              <p className={`text-xs ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>All inventory SKUs are within safe threshold</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStockProducts.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  dark ? 'bg-zinc-950/40 border-zinc-800/70' : 'bg-slate-50/80 border-slate-100'
                }`}>
                  <div className="min-w-0 pr-3">
                    <p className={`text-xs font-semibold truncate ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>{p.productName}</p>
                    <p className={`text-[11px] font-mono mt-0.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                      {p.sku} · {p.color} ({p.size})
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-tight border ${
                    p.stock === 0
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}>
                    {p.stock === 0 ? 'OUT OF STOCK' : `${p.stock} LEFT`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Status Footer */}
      <div className={`${cardClass} flex items-center justify-between text-xs py-3`}>
        <div className="flex items-center gap-2">
          <BarChart3 className={`w-4 h-4 ${dark ? 'text-zinc-500' : 'text-slate-400'}`} />
          <span className={`font-medium ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            Reliance Retail &amp; Wholesale Engine
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Telemetry Synced
        </span>
      </div>
    </div>
  );
};