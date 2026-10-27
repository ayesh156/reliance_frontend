import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, getProductImageUrl, handleImageError } from '../lib/utils';
import { get, post, put, del } from '../lib/api';
import { toast } from 'react-toastify';

import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import type { ProductItem } from '../types/product';
import { SearchableSelect } from '../components/ui/searchable-select';
import type { SearchableSelectOption } from '../components/ui/searchable-select';

import {
  Plus,
  Package,
  Trash2,
  Edit,
  MoreVertical,
  ShoppingBag,
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

/**
 * Stock level filter options matching unified executive filter standard
 */
const STOCK_OPTIONS: SearchableSelectOption[] = [
  { value: 'all', label: 'All Stock Levels' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

/**
 * Sorting options for products catalog
 */
const SORT_OPTIONS: SearchableSelectOption[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'stock_asc', label: 'Stock: Low to High' },
];

/**
 * Return Inventory Record interface
 */
export interface ReturnInventoryItemRecord {
  id: number;
  orderId: number;
  orderItemId: number;
  productId: number;
  variantId: number;
  quantity: number;
  restockedQty: number;
  reason: 'UNSOLD' | 'DAMAGED';
  status: 'IN_RETURN_STOCK' | 'RESTOCKED';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: number;
    orderNumber: string;
    createdAt: string;
    customer?: {
      id: number;
      name: string;
      phone?: string;
    } | null;
  };
  product?: {
    id: number;
    name: string;
    category?: { id: number; name: string } | null;
  };
  variant?: {
    id: number;
    size: string;
    color: string;
    sku: string;
    stock: number;
  };
}

export const Products: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { isAdmin, isRep } = useAuth();
  const dark = Boolean(resolvedTheme === 'dark');

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Read-Only Product Inspection Modal State for Sales Rep & Touch View
  const [inspectProduct, setInspectProduct] = useState<ProductItem | null>(null);
  const [activeInspectImage, setActiveInspectImage] = useState<string | null>(null);

  // Delete modal state
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Main navigation tab: 'catalog' vs 'returns'
  const [activeMainTab, setActiveMainTab] = useState<'catalog' | 'returns'>('catalog');

  // Return Inventory states
  const [returnItems, setReturnItems] = useState<ReturnInventoryItemRecord[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [returnReasonFilter, setReturnReasonFilter] = useState<'ALL' | 'UNSOLD' | 'DAMAGED'>('ALL');
  const [returnStatusFilter, setReturnStatusFilter] = useState<'ALL' | 'IN_RETURN_STOCK' | 'RESTOCKED'>('ALL');

  // Restock modal state
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState<ReturnInventoryItemRecord | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [isRestocking, setIsRestocking] = useState(false);
  const isFetchingReturnsRef = useRef(false);

  const fetchReturnInventory = useCallback(async () => {
    if (isFetchingReturnsRef.current) return;
    try {
      isFetchingReturnsRef.current = true;
      setLoadingReturns(true);
      const data = await get<ReturnInventoryItemRecord[]>('/orders/return-inventory');
      setReturnItems(data || []);
    } catch (err: any) {
      console.error('Failed to load return inventory:', err);
      toast.error('Failed to load return inventory');
      setReturnItems([]);
    } finally {
      setLoadingReturns(false);
      isFetchingReturnsRef.current = false;
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        get<ProductItem[]>('/products'),
        get<{ id: number; name: string }[]>('/attributes/categories'),
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
    } catch (err: any) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchReturnInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...categories.map(c => ({ value: String(c.id), label: c.name }))
  ], [categories]);

  const stockOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Stock Levels' },
    { value: 'in_stock', label: 'In Stock (>0)' },
    { value: 'low_stock', label: 'Low Stock (≤5)' },
    { value: 'out_of_stock', label: 'Out of Stock (0)' },
  ], []);

  /**
   * Count of active non-default secondary filters for badge indicator
   */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedStockStatus !== 'all') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [selectedCategory, selectedStockStatus, sortBy]);

  /**
   * Reset all secondary filters and search query back to default view
   */
  const handleClearAllFilters = () => {
    setSelectedCategory('all');
    setSelectedStockStatus('all');
    setSortBy('newest');
    setSearchQuery('');
    setCurrentPage(1);
  };

  /**
   * Filter and sort products reactively across search, category, stock level, and sort preference
   */
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // 1. Search Query Filter
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.searchKey?.toLowerCase().includes(q) ||
          p.variants?.some(
            (v) => v.sku.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q)
          );

        // 2. Category Filter
        const matchesCategory =
          selectedCategory === 'all' ||
          String(p.categoryId || p.category?.id) === selectedCategory;

        // 3. Stock Status Filter
        const totalStock = (p.variants || []).reduce((acc, cur) => acc + (cur.stock || 0), 0);
        const matchesStock =
          selectedStockStatus === 'all' ||
          (selectedStockStatus === 'in_stock' && totalStock > 0) ||
          (selectedStockStatus === 'low_stock' && totalStock > 0 && totalStock <= 5) ||
          (selectedStockStatus === 'out_of_stock' && totalStock === 0);

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'price_desc') {
          const priceA = a.variants?.[0]?.retailPrice || 0;
          const priceB = b.variants?.[0]?.retailPrice || 0;
          return priceB - priceA;
        }
        if (sortBy === 'price_asc') {
          const priceA = a.variants?.[0]?.retailPrice || 0;
          const priceB = b.variants?.[0]?.retailPrice || 0;
          return priceA - priceB;
        }
        if (sortBy === 'stock_asc') {
          const stockA = (a.variants || []).reduce((acc, cur) => acc + (cur.stock || 0), 0);
          const stockB = (b.variants || []).reduce((acc, cur) => acc + (cur.stock || 0), 0);
          return stockA - stockB;
        }
        // Default: newest first
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          b.id - a.id
        );
      });
  }, [products, searchQuery, selectedCategory, selectedStockStatus, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginated = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Global Product Metrics
  const totalProducts = products.length;
  const totalVariants = useMemo(() => products.reduce((acc, p) => acc + (p.variants?.length || 0), 0), [products]);
  const totalLowStock = useMemo(() => {
    return products.filter(p => {
      const stock = (p.variants || []).reduce((acc, cur) => acc + (cur.stock || 0), 0);
      return stock > 0 && stock <= 5;
    }).length;
  }, [products]);

  const handleDelete = async () => {
    if (!selectedProduct) return;
    try {
      await del(`/products/${selectedProduct.id}`);
      toast.success('Product deleted successfully');
      setShowDeleteModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  /**
   * Direct product navigation handler.
   * Prominently navigates the user directly to the product edit page (/system/products/:id/edit).
   * For sales reps who lack edit permissions, seamlessly defaults to the inspect details modal.
   * Halts event propagation so parent card click triggers are not duplicated.
   */
  const handleProductDirectEdit = (e: React.MouseEvent, product: ProductItem) => {
    e.stopPropagation();
    if (isRep) {
      setInspectProduct(product);
      setActiveInspectImage(null);
    } else {
      navigate(`/system/products/${product.id}/edit`);
    }
  };

  // Return Inventory Metrics & Filtering
  const inStockReturnsCount = useMemo(() => {
    return returnItems.filter((r) => r.status === 'IN_RETURN_STOCK').length;
  }, [returnItems]);

  const inStockReturnsQty = useMemo(() => {
    return returnItems
      .filter((r) => r.status === 'IN_RETURN_STOCK')
      .reduce((sum, r) => sum + Math.max(0, r.quantity - r.restockedQty), 0);
  }, [returnItems]);

  const unsoldReturnsQty = useMemo(() => {
    return returnItems
      .filter((r) => r.reason === 'UNSOLD' && r.status === 'IN_RETURN_STOCK')
      .reduce((sum, r) => sum + Math.max(0, r.quantity - r.restockedQty), 0);
  }, [returnItems]);

  const damagedReturnsQty = useMemo(() => {
    return returnItems
      .filter((r) => r.reason === 'DAMAGED' && r.status === 'IN_RETURN_STOCK')
      .reduce((sum, r) => sum + Math.max(0, r.quantity - r.restockedQty), 0);
  }, [returnItems]);

  const filteredReturnItems = useMemo(() => {
    return returnItems.filter((item) => {
      // 1. Search Query
      const q = returnSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        Boolean(item.order?.orderNumber && item.order.orderNumber.toLowerCase().includes(q)) ||
        Boolean(item.order?.customer?.name && item.order.customer.name.toLowerCase().includes(q)) ||
        Boolean(item.product?.name && item.product.name.toLowerCase().includes(q)) ||
        Boolean(item.variant?.sku && item.variant.sku.toLowerCase().includes(q)) ||
        Boolean(item.variant?.size && item.variant.size.toLowerCase().includes(q)) ||
        Boolean(item.variant?.color && item.variant.color.toLowerCase().includes(q));

      // 2. Reason Filter
      const matchesReason =
        returnReasonFilter === 'ALL' || item.reason === returnReasonFilter;

      // 3. Status Filter
      const matchesStatus =
        returnStatusFilter === 'ALL' || item.status === returnStatusFilter;

      return matchesSearch && matchesReason && matchesStatus;
    });
  }, [returnItems, returnSearchQuery, returnReasonFilter, returnStatusFilter]);

  const handleOpenRestock = (item: ReturnInventoryItemRecord) => {
    setSelectedReturnItem(item);
    const remaining = Math.max(1, item.quantity - item.restockedQty);
    setRestockQty(remaining);
    setRestockModalOpen(true);
  };

  const handleConfirmRestock = async () => {
    if (!selectedReturnItem) return;
    const remaining = Math.max(0, selectedReturnItem.quantity - selectedReturnItem.restockedQty);
    if (restockQty <= 0 || restockQty > remaining) {
      toast.error(`Please enter a valid quantity between 1 and ${remaining}`);
      return;
    }

    try {
      setIsRestocking(true);
      const res = await post<{ message: string; newStock: number }>(
        `/orders/return-inventory/${selectedReturnItem.id}/restock`,
        { quantity: restockQty }
      );
      toast.success(res?.message || `Successfully restocked ${restockQty} pcs back into garment inventory!`);
      setRestockModalOpen(false);
      setSelectedReturnItem(null);
      fetchReturnInventory();
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to restock item');
    } finally {
      setIsRestocking(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Products &amp; Inventory</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Multi-Variant Garment Catalog Engine</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => { fetchAll(); fetchReturnInventory(); }}>
            <RefreshCw className={`size-4 ${loading || loadingReturns ? 'animate-spin' : ''}`} />
          </Button>
          {!isRep && (
            <Button onClick={() => navigate('/system/products/new')} className="gap-2">
              <Plus className="size-4" /> Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Top Navigation Tabs: Garment Catalog vs Return Inventory & Restock Pipeline */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveMainTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeMainTab === 'catalog'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'
          }`}
        >
          <Package className="size-4" />
          <span>Garment Catalog</span>
          <span className={`text-[11px] px-2 py-0.2 rounded-full font-mono font-bold ${
            activeMainTab === 'catalog' ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
          }`}>
            {totalProducts}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMainTab('returns');
            fetchReturnInventory();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeMainTab === 'returns'
              ? 'bg-rose-600 text-white shadow-xs font-bold'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'
          }`}
        >
          <RotateCcw className="size-4" />
          <span>Return Inventory &amp; Restock</span>
          {inStockReturnsCount > 0 && (
            <span className={`text-[11px] px-2 py-0.2 rounded-full font-mono font-bold ${
              activeMainTab === 'returns' ? 'bg-rose-700 text-white' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}>
              {inStockReturnsCount}
            </span>
          )}
        </button>
      </div>

      {activeMainTab === 'catalog' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Metrics Row: Fluid 3 columns on tablet portrait (~534px) instead of single-column stacking */}
      <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-4 w-full">
        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Products</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalProducts}</h3>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Package className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Variants</span>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{totalVariants}</h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <SlidersHorizontal className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Low Stock Products</span>
            <h3 className={`text-2xl font-bold mt-1 ${totalLowStock > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
              {totalLowStock}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${totalLowStock > 0 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
            <RefreshCw className="size-5" />
          </div>
        </div>
      </div>

      {/* ── Mobile View (< 1024px): Search Bar + Collapsible Filters Drawer ── */}
      <div className="block lg:hidden bg-white dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Primary Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (currentPage !== 1) setCurrentPage(1);
              }}
              placeholder="Search by name, tags, SKU, barcode..."
              className="pl-9 pr-8 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  if (currentPage !== 1) setCurrentPage(1);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Sleek Filters Toggle Button with Active Badge */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all shrink-0 select-none ${
              mobileFiltersOpen || activeFiltersCount > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="size-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Expansion Tray: Fluid 3-column filter tray on ~534px tablet screens */}
        {mobileFiltersOpen && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-2.5 w-full">
              {/* Category Filter */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Category
                </label>
                <SearchableSelect
                  options={categoryOptions}
                  value={selectedCategory}
                  onValueChange={(val) => {
                    setSelectedCategory(val);
                    if (currentPage !== 1) setCurrentPage(1);
                  }}
                  placeholder="All Categories"
                  searchPlaceholder="Search category..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* Stock Status Filter */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Stock Level
                </label>
                <SearchableSelect
                  options={STOCK_OPTIONS}
                  value={selectedStockStatus}
                  onValueChange={(val) => {
                    setSelectedStockStatus(val);
                    if (currentPage !== 1) setCurrentPage(1);
                  }}
                  placeholder="All Stock Levels"
                  searchPlaceholder="Filter stock..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>

              {/* Sort Order */}
              <div className="min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Sort Order
                </label>
                <SearchableSelect
                  options={SORT_OPTIONS}
                  value={sortBy}
                  onValueChange={(val) => {
                    setSortBy(val);
                    if (currentPage !== 1) setCurrentPage(1);
                  }}
                  placeholder="Sort Products..."
                  searchPlaceholder="Search sort order..."
                  dark={dark}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Clear All Filters Shortcut */}
            {(activeFiltersCount > 0 || searchQuery) && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  {activeFiltersCount} active {activeFiltersCount === 1 ? 'filter' : 'filters'}
                </span>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X className="size-3.5" /> Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop View (≥ 1024px): Inline Executive Filter Matrix ── */}
      <div className="hidden lg:flex items-center gap-2.5 bg-white dark:bg-zinc-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (currentPage !== 1) setCurrentPage(1);
            }}
            placeholder="Search by name, tags, SKU, barcode..."
            className="pl-9 pr-8 h-9 text-xs w-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                if (currentPage !== 1) setCurrentPage(1);
              }}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Category Selector */}
        <div className="w-48 xl:w-52 shrink-0">
          <SearchableSelect
            options={categoryOptions}
            value={selectedCategory}
            onValueChange={(val) => {
              setSelectedCategory(val);
              if (currentPage !== 1) setCurrentPage(1);
            }}
            placeholder="All Categories"
            searchPlaceholder="Filter category..."
            dark={dark}
          />
        </div>

        {/* Stock Level Selector */}
        <div className="w-44 xl:w-48 shrink-0">
          <SearchableSelect
            options={STOCK_OPTIONS}
            value={selectedStockStatus}
            onValueChange={(val) => {
              setSelectedStockStatus(val);
              if (currentPage !== 1) setCurrentPage(1);
            }}
            placeholder="All Stock Levels"
            searchPlaceholder="Filter stock..."
            dark={dark}
          />
        </div>

        {/* Sort Selector & Clear All Shortcut */}
        <div className="w-44 xl:w-48 shrink-0 flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              options={SORT_OPTIONS}
              value={sortBy}
              onValueChange={(val) => {
                setSortBy(val);
                if (currentPage !== 1) setCurrentPage(1);
              }}
              placeholder="Sort Products..."
              searchPlaceholder="Sort by..."
              dark={dark}
            />
          </div>
          {(activeFiltersCount > 0 || searchQuery) && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="size-9 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Clear All Filters"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-3 sm:p-5 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-zinc-800">
          <span className="text-sm font-bold flex items-center gap-2">
            <ShoppingBag className="size-4 text-emerald-500" /> Catalog ({filteredProducts.length})
          </span>
          <span className="text-xs text-zinc-400">Page {currentPage} of {totalPages}</span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="size-6 animate-spin mx-auto text-emerald-500" />
          </div>
        ) : (
          <>
            {/* Mobile / Tablet Responsive Card Grid (< 1024px): Elegantly splits into 2 columns at ~534px tablet viewports */}
            <div className="grid lg:hidden grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 w-full">
              {paginated.map(p => {
                const v = p.variants?.[0];
                const stock = (p.variants || []).reduce((acc, cur) => acc + (cur.stock || 0), 0);
                const taggedImage = p.images?.find((img: any) => img.variantId !== null && img.variantId !== undefined)?.imageUrl;
                const firstVariantImg = p.variants?.find((item: any) => item.imageUrl)?.imageUrl;
                const defaultFirstImg = p.images && p.images.length > 0 ? p.images[0].imageUrl : null;
                const rawImage = taggedImage || firstVariantImg || defaultFirstImg;
                const primaryImage = rawImage ? getProductImageUrl(rawImage) : null;

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setInspectProduct(p);
                      setActiveInspectImage(null);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs hover:border-emerald-500/60 dark:hover:border-emerald-500/50 transition-all cursor-pointer flex flex-col justify-between gap-2.5 sm:gap-3 active:scale-[0.99] select-none group w-full"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative size-16 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 shrink-0 flex items-center justify-center">
                        {primaryImage ? (
                          <img
                            src={primaryImage}
                            alt={p.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={handleImageError}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <Package className="size-6 text-slate-400 dark:text-zinc-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {p.category?.name || 'General'}
                          </Badge>
                          {p.variants?.length ? (
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                              {p.variants.length} Var
                            </span>
                          ) : null}
                          {/* Prominently clickable Product ID */}
                          <Link
                            to={isRep ? '#' : `/system/products/${p.id}/edit`}
                            onClick={(e) => handleProductDirectEdit(e, p)}
                            className="font-mono text-[10px] font-semibold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded transition-colors ml-auto"
                            title={isRep ? "Inspect product details" : `Edit product #${p.id}`}
                          >
                            #{p.id}
                          </Link>
                        </div>
                        {/* Prominently clickable Product Name */}
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 line-clamp-1 mt-1">
                          <Link
                            to={isRep ? '#' : `/system/products/${p.id}/edit`}
                            onClick={(e) => handleProductDirectEdit(e, p)}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer transition-colors"
                            title={isRep ? "Inspect product details" : `Edit ${p.name}`}
                          >
                            {p.name}
                          </Link>
                        </h3>
                        {p.searchKey && (
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                            {p.searchKey}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">Wholesale (Rep)</span>
                        <span className="font-bold font-mono text-amber-600 dark:text-amber-400 text-xs">
                          {v ? formatCurrency(v.wholesalePrice) : '-'}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">Retail (POS)</span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-xs">
                          {v ? formatCurrency(v.retailPrice) : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Badge variant={stock > 10 ? 'success' : 'destructive'} dot className="text-[10px]">
                        {stock} in stock
                      </Badge>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
                        Inspect Details →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Variants</TableHead>
                    <TableHead>Retail (POS)</TableHead>
                    <TableHead>Wholesale (Rep)</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(p => {
                    const v = p.variants?.[0];
                    const stock = (p.variants || []).reduce((acc, cur) => acc + (cur.stock || 0), 0);
                    
                    // Prioritize variant-tagged image over unassigned catalog photo
                    const taggedImage = p.images?.find((img: any) => img.variantId !== null && img.variantId !== undefined)?.imageUrl;
                    const firstVariantImg = p.variants?.find((item: any) => item.imageUrl)?.imageUrl;
                    const defaultFirstImg = p.images && p.images.length > 0 ? p.images[0].imageUrl : null;
                    
                    const rawImage = taggedImage || firstVariantImg || defaultFirstImg;
                    const primaryImage = rawImage ? getProductImageUrl(rawImage) : null;

                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3 select-none">
                            {/* Product Thumbnail with direct edit/inspect click handler */}
                            <div 
                              onClick={(e) => handleProductDirectEdit(e, p)}
                              className="relative size-10 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 shrink-0 flex items-center justify-center hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors cursor-pointer group/thumb"
                              title={isRep ? "Click to inspect product details" : `Click to edit ${p.name}`}
                            >
                              {primaryImage ? (
                                <img
                                  src={primaryImage}
                                  alt={p.name}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={handleImageError}
                                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                                />
                              ) : (
                                <Package className="size-4 text-slate-400 dark:text-zinc-500 group-hover/thumb:text-indigo-600 dark:group-hover/thumb:text-indigo-400" />
                              )}
                            </div>
                            {/* Prominently clickable Product Name & Product ID with hover effects */}
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  to={isRep ? '#' : `/system/products/${p.id}/edit`}
                                  onClick={(e) => handleProductDirectEdit(e, p)}
                                  className="font-semibold text-slate-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer transition-colors"
                                  title={isRep ? "Click to inspect product details" : `Click to edit ${p.name}`}
                                >
                                  {p.name}
                                </Link>
                                <Link
                                  to={isRep ? '#' : `/system/products/${p.id}/edit`}
                                  onClick={(e) => handleProductDirectEdit(e, p)}
                                  className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer bg-slate-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded transition-colors"
                                  title={isRep ? "Click to inspect product details" : `Click to edit product #${p.id}`}
                                >
                                  #{p.id}
                                </Link>
                              </div>
                              {p.searchKey && (
                                <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                                  {p.searchKey}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{p.category?.name || 'General'}</Badge></TableCell>
                        <TableCell>{p.variants?.length || 0} Variants</TableCell>
                        <TableCell className="font-semibold text-emerald-500">
                          {v ? formatCurrency(v.retailPrice) : '-'}
                        </TableCell>
                        <TableCell className="font-semibold text-amber-500">
                          {v ? formatCurrency(v.wholesalePrice) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stock > 10 ? 'success' : 'destructive'} dot>
                            {stock} in stock
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreVertical className="size-4 text-slate-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setInspectProduct(p);
                                setActiveInspectImage(null);
                              }}>
                                <ShoppingBag className="size-3.5 mr-1" /> Inspect Details
                              </DropdownMenuItem>
                              {!isRep && (
                                <DropdownMenuItem onClick={() => navigate(`/system/products/${p.id}/edit`)}>
                                  <Edit className="size-3.5 mr-1" /> Edit
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => { setSelectedProduct(p); setShowDeleteModal(true); }}>
                                    <Trash2 className="size-3.5 mr-1" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
              <span className="text-zinc-400">Showing {paginated.length} of {filteredProducts.length}</span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <span className="px-2 font-semibold">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      </div>
      )}

      {/* ── RETURN INVENTORY & RESTOCK PIPELINE VIEW ── */}
      {activeMainTab === 'returns' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Metrics Row for Return Inventory */}
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-4 w-full">
            <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Return Stock</span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {inStockReturnsCount} <span className="text-xs font-normal text-slate-400">records</span>
                </h3>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                  {inStockReturnsQty} pcs in return stock
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <RotateCcw className="size-5" />
              </div>
            </div>

            <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Unsold (Good Condition)</span>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  {unsoldReturnsQty} <span className="text-xs font-normal text-slate-400">pcs</span>
                </h3>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                  Eligible for instant restock
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <ShieldCheck className="size-5" />
              </div>
            </div>

            <div className="rounded-2xl border p-3 sm:p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Damaged / Defect</span>
                <h3 className={`text-2xl font-bold mt-1 ${damagedReturnsQty > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                  {damagedReturnsQty} <span className="text-xs font-normal text-slate-400">pcs</span>
                </h3>
                <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium mt-0.5">
                  Requires repair or write-off
                </p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
                <AlertTriangle className="size-5" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-zinc-900/60 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                value={returnSearchQuery}
                onChange={(e) => setReturnSearchQuery(e.target.value)}
                placeholder="Search by invoice #, customer, product, SKU, size..."
                className="pl-9 pr-8 h-9 text-xs"
              />
              {returnSearchQuery && (
                <button
                  type="button"
                  onClick={() => setReturnSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Reason Filter */}
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-50 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setReturnReasonFilter('ALL')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    returnReasonFilter === 'ALL'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  All Reasons
                </button>
                <button
                  type="button"
                  onClick={() => setReturnReasonFilter('UNSOLD')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    returnReasonFilter === 'UNSOLD'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}
                >
                  Unsold (Good)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnReasonFilter('DAMAGED')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    returnReasonFilter === 'DAMAGED'
                      ? 'bg-rose-600 text-white shadow-2xs font-bold'
                      : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                  }`}
                >
                  Damaged
                </button>
              </div>

              {/* Status Filter */}
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-50 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setReturnStatusFilter('ALL')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    returnStatusFilter === 'ALL'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setReturnStatusFilter('IN_RETURN_STOCK')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    returnStatusFilter === 'IN_RETURN_STOCK'
                      ? 'bg-amber-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  In Return Stock
                </button>
                <button
                  type="button"
                  onClick={() => setReturnStatusFilter('RESTOCKED')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    returnStatusFilter === 'RESTOCKED'
                      ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  Restocked
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            {loadingReturns ? (
              <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="size-8 animate-spin text-rose-500 mb-2" />
                <span className="text-xs font-medium">Loading return inventory pipeline...</span>
              </div>
            ) : filteredReturnItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Package className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">No return items found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  When invoice returns are processed, returned garments are logged here before being restocked to active inventory.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-900/75">
                      <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider text-slate-500">Invoice #</TableHead>
                      <TableHead className="w-[150px] text-xs font-bold uppercase tracking-wider text-slate-500">Customer</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Product / Garment</TableHead>
                      <TableHead className="w-[110px] text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Returned Qty</TableHead>
                      <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Condition</TableHead>
                      <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                      <TableHead className="w-[180px] text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReturnItems.map((item) => {
                      const remaining = Math.max(0, item.quantity - item.restockedQty);
                      const isFullyRestocked = item.status === 'RESTOCKED' || remaining === 0;

                      return (
                        <TableRow key={item.id} className="border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                          {/* Invoice # */}
                          <TableCell className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                            <div>{item.order?.orderNumber || `#${item.orderId}`}</div>
                            <div className="text-[10px] font-normal text-slate-400">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>

                          {/* Customer */}
                          <TableCell className="text-xs">
                            <div className="font-semibold text-slate-800 dark:text-zinc-200">
                              {item.order?.customer?.name || 'Walk-in Customer'}
                            </div>
                            {item.order?.customer?.phone && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {item.order.customer.phone}
                              </div>
                            )}
                          </TableCell>

                          {/* Product / Garment */}
                          <TableCell className="text-xs">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {item.product?.name || 'Garment Item'}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {item.variant?.size && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono font-semibold text-slate-700 dark:text-zinc-300">
                                  Size: {item.variant.size}
                                </span>
                              )}
                              {item.variant?.color && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono font-semibold text-slate-700 dark:text-zinc-300">
                                  Color: {item.variant.color}
                                </span>
                              )}
                              {item.variant?.sku && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  SKU: {item.variant.sku}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 font-medium ml-1">
                                (Current Stock: {item.variant?.stock ?? 0} pcs)
                              </span>
                            </div>
                          </TableCell>

                          {/* Returned Qty */}
                          <TableCell className="text-xs text-center font-mono">
                            <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                              {item.quantity} pcs
                            </div>
                            {item.restockedQty > 0 && (
                              <div className="text-[10.5px] text-emerald-600 font-semibold">
                                Restocked: {item.restockedQty} pcs
                              </div>
                            )}
                            {remaining > 0 && item.restockedQty > 0 && (
                              <div className="text-[10px] text-amber-600 font-medium">
                                Remaining: {remaining} pcs
                              </div>
                            )}
                          </TableCell>

                          {/* Condition */}
                          <TableCell className="text-center">
                            {item.reason === 'DAMAGED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                <AlertTriangle className="size-3 shrink-0" />
                                <span>Damaged</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="size-3 shrink-0" />
                                <span>Unsold (Good)</span>
                              </span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="text-center">
                            {isFullyRestocked ? (
                              <Badge variant="success" className="text-[10px] px-2 py-0.5 font-bold">
                                Restocked
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="text-[10px] px-2 py-0.5 font-bold">
                                In Return Stock
                              </Badge>
                            )}
                          </TableCell>

                          {/* Action */}
                          <TableCell className="text-right">
                            {!isRep && (
                              remaining > 0 ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleOpenRestock(item)}
                                  className="h-8 px-2.5 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-2xs"
                                >
                                  <RotateCcw className="size-3.5" />
                                  <span>Restock to Garment Stock</span>
                                </Button>
                              ) : (
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                                  <CheckCircle2 className="size-3.5" />
                                  <span>Fully Restocked</span>
                                </span>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Read-Only Product Inspection Dialog for Mobile/Tablet & Sales Representatives */}
      <Dialog open={!!inspectProduct} onOpenChange={(open) => !open && setInspectProduct(null)}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-3.5 sm:p-6">
          {inspectProduct && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{inspectProduct.category?.name || 'General'}</Badge>
                      {inspectProduct.isFeatured && <Badge variant="outline" className="text-amber-500 border-amber-500/30">Featured</Badge>}
                      {isRep && <Badge variant="outline" className="text-blue-500 border-blue-500/30">Representative View</Badge>}
                    </div>
                    <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {inspectProduct.name}
                    </DialogTitle>
                    {inspectProduct.searchKey && (
                      <p className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
                        Tags / Search: {inspectProduct.searchKey}
                      </p>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* Image Gallery */}
              {(() => {
                const galleryImages = [
                  ...(inspectProduct.images || []).map((img) => img.imageUrl),
                  ...(inspectProduct.variants || []).filter((v) => v.imageUrl).map((v) => v.imageUrl as string),
                ].filter(Boolean);
                const uniqueImages = Array.from(new Set(galleryImages));
                const currentImg = activeInspectImage || (uniqueImages.length > 0 ? uniqueImages[0] : null);

                return uniqueImages.length > 0 ? (
                  <div className="space-y-2">
                    <div className="w-full h-56 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 flex items-center justify-center">
                      <img
                        src={getProductImageUrl(currentImg!)}
                        alt={inspectProduct.name}
                        referrerPolicy="no-referrer"
                        onError={handleImageError}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {uniqueImages.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                        {uniqueImages.map((imgUrl, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveInspectImage(imgUrl)}
                            className={`size-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                              currentImg === imgUrl
                                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                : 'border-slate-200 dark:border-zinc-800 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={getProductImageUrl(imgUrl)}
                              alt={`Thumbnail ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              onError={handleImageError}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Product Description */}
              {inspectProduct.description && (
                <div className="space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-700 dark:text-zinc-300">
                  <span className="font-bold block text-slate-900 dark:text-white">Description</span>
                  <p className="whitespace-pre-line leading-relaxed">{inspectProduct.description}</p>
                </div>
              )}

              {/* Variant Matrix Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3.5 text-emerald-500" />
                    Variant Matrix ({inspectProduct.variants?.length || 0})
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                    Total Warehouse Stock: {(inspectProduct.variants || []).reduce((acc, cur) => acc + (cur.stock || 0), 0)}
                  </span>
                </div>

                <div className="border rounded-xl border-slate-200 dark:border-zinc-800 overflow-hidden text-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400 font-semibold text-[11px]">
                          <th className="p-2 sm:p-2.5">Size / Color</th>
                          <th className="p-2 sm:p-2.5 font-mono">SKU / Barcode</th>
                          <th className="p-2 sm:p-2.5 text-right">Wholesale</th>
                          <th className="p-2 sm:p-2.5 text-right">Retail</th>
                          <th className="p-2 sm:p-2.5 text-center">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                        {(inspectProduct.variants || []).map((vr, vIdx) => (
                          <tr key={vr.id || vIdx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/40">
                            <td className="p-2 sm:p-2.5 font-medium text-slate-900 dark:text-zinc-100">
                              {vr.size || '-'} {vr.color ? `· ${vr.color}` : ''}
                            </td>
                            <td className="p-2 sm:p-2.5 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                              <div>{vr.sku || '-'}</div>
                              {vr.barcode && <div className="text-[10px] text-slate-400">{vr.barcode}</div>}
                            </td>
                            <td className="p-2 sm:p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                              {formatCurrency(vr.wholesalePrice)}
                            </td>
                            <td className="p-2 sm:p-2.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                              {formatCurrency(vr.retailPrice)}
                            </td>
                            <td className="p-2 sm:p-2.5 text-center">
                              <Badge variant={vr.stock > 5 ? 'success' : vr.stock > 0 ? 'warning' : 'destructive'} className="text-[10px] px-1.5 py-0 font-mono">
                                {vr.stock}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Read-Only Modal Actions: No edit/delete for REP */}
              <div className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setInspectProduct(null)}>
                  Close
                </Button>
                {!isRep && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const id = inspectProduct.id;
                      setInspectProduct(null);
                      navigate(`/system/products/${id}/edit`);
                    }}
                    className="gap-1.5"
                  >
                    <Edit className="size-3.5" /> Edit Product
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Shadcn Alert Dialog for Delete (Admin Only) */}
      {isAdmin && (
        <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <AlertDialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the product <strong className="text-slate-900 dark:text-white">"{selectedProduct?.name}"</strong> and all its associated variants, barcodes, and inventory records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm pt-3 pb-1 border-t border-slate-100 dark:border-zinc-800 mt-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">Delete Product</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Restock to Garment Stock Confirmation Dialog */}
      <Dialog open={restockModalOpen} onOpenChange={setRestockModalOpen}>
        <DialogContent className="w-full max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <RotateCcw className="size-5 text-emerald-600" />
              <span>Restock to Garment Stock</span>
            </DialogTitle>
          </DialogHeader>

          {selectedReturnItem && (
            <div className="space-y-4 pt-2">
              {/* Product & Variant Details Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {selectedReturnItem.product?.name || 'Garment Product'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Invoice: <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">{selectedReturnItem.order?.orderNumber || `#${selectedReturnItem.orderId}`}</span>
                    </p>
                  </div>
                  {selectedReturnItem.reason === 'DAMAGED' ? (
                    <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                      Damaged
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                      Unsold (Good)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs flex-wrap pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                  <span className="font-medium text-slate-600 dark:text-zinc-400">
                    Size: <strong className="font-mono text-slate-900 dark:text-white">{selectedReturnItem.variant?.size}</strong>
                  </span>
                  <span>•</span>
                  <span className="font-medium text-slate-600 dark:text-zinc-400">
                    Color: <strong className="font-mono text-slate-900 dark:text-white">{selectedReturnItem.variant?.color}</strong>
                  </span>
                  {selectedReturnItem.variant?.sku && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-slate-500 text-[11px]">
                        SKU: {selectedReturnItem.variant.sku}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                  <span className="text-slate-500">Current Garment Stock:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {selectedReturnItem.variant?.stock ?? 0} pcs
                  </span>
                </div>
              </div>

              {/* Damaged Alert Warning if applicable */}
              {selectedReturnItem.reason === 'DAMAGED' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-bold block">Caution: Returned as Damaged</span>
                    <span>Restocking will increment active sellable inventory. Only proceed if this item has been inspected or repaired.</span>
                  </div>
                </div>
              )}

              {/* Quantity Input with Quick Button */}
              {(() => {
                const remaining = Math.max(1, selectedReturnItem.quantity - selectedReturnItem.restockedQty);
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      <label htmlFor="restockQtyInput">Quantity to Restock back into Main Stock:</label>
                      <button
                        type="button"
                        onClick={() => setRestockQty(remaining)}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-500 hover:underline cursor-pointer"
                      >
                        Restock Max ({remaining} pcs)
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        id="restockQtyInput"
                        type="number"
                        min={1}
                        max={remaining}
                        value={restockQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setRestockQty(Math.max(1, Math.min(remaining, val)));
                        }}
                        className="h-10 text-base font-mono font-bold text-center"
                      />
                      <span className="text-xs text-slate-400 font-semibold shrink-0">
                        / {remaining} pcs available
                      </span>
                    </div>

                    {/* Projected Stock Preview */}
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                      <span>Projected Stock After Restock:</span>
                      <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                        {(selectedReturnItem.variant?.stock ?? 0) + restockQty} pcs
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Dialog Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRestockModalOpen(false);
                    setSelectedReturnItem(null);
                  }}
                  disabled={isRestocking}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmRestock}
                  disabled={isRestocking || restockQty <= 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5"
                >
                  {isRestocking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  <span>Restock {restockQty} pcs</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Backwards compatibility and standard module exports
export const ProductsPage = Products;
export default Products;