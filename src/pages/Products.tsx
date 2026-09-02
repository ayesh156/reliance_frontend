import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, getProductImageUrl } from '../lib/utils';
import { get, post, put, del } from '../lib/api';
import { toast } from 'react-toastify';

import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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
import type { ProductItem } from '../types/product';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import type { SearchableSelectOption } from '../components/ui/SearchableSelect';

import {
  Plus,
  Package,
  Trash2,
  Edit,
  MoreHorizontal,
  ShoppingBag,
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
} from 'lucide-react';

export const Products: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Dialog states සහ handleSave function එක සම්පූර්ණයෙන්ම ඉවත් කර Delete modal state පමණක් තබන්න:
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
  }, [fetchAll]);

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

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Search Query Filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        p.name.toLowerCase().includes(q) ||
        p.searchKey?.toLowerCase().includes(q) ||
        p.variants?.some(v => v.sku.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q))
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
    });
  }, [products, searchQuery, selectedCategory, selectedStockStatus]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginated = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSave = async (formData: FormData, isEdit: boolean) => {
    if (isEdit && selectedProduct) {
      await put(`/products/${selectedProduct.id}`, formData);
      toast.success('Product updated successfully!');
    } else {
      await post('/products', formData);
      toast.success('Product created successfully!');
    }
    fetchAll();
  };

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

  return (
    <div className="space-y-6 w-full pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Products &amp; Inventory</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Multi-Variant Garment Catalog Engine</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchAll}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => navigate('/system/products/new')} className="gap-2">
            <Plus className="size-4" /> Add Product
          </Button>
        </div>
      </div>

      <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row items-center gap-3">
        {/* Search Input with Instant Clear (X) */}
        <div className="relative flex-1 w-full flex items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 w-full focus-within:border-emerald-500 transition-colors">
            <Search className="size-4 text-zinc-400 shrink-0" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by name, tags, SKU, barcode..."
              className="bg-transparent outline-none w-full text-xs text-slate-900 dark:text-zinc-100 placeholder:text-zinc-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category & Stock Filter Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Category Searchable Select */}
          <div className="w-full md:w-48">
            <SearchableSelect
              options={categoryOptions}
              value={selectedCategory}
              onValueChange={val => { setSelectedCategory(val); setCurrentPage(1); }}
              placeholder="Category..."
              searchPlaceholder="Search category..."
              dark={dark}
            />
          </div>

          {/* Stock Searchable Select */}
          <div className="w-full md:w-44">
            <SearchableSelect
              options={stockOptions}
              value={selectedStockStatus}
              onValueChange={val => { setSelectedStockStatus(val); setCurrentPage(1); }}
              placeholder="Stock level..."
              searchPlaceholder="Filter stock..."
              dark={dark}
            />
          </div>

          {/* Reset Filters Shortcut (Visible if any filter is active) */}
          {(searchQuery || selectedCategory !== 'all' || selectedStockStatus !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedStockStatus('all');
                setCurrentPage(1);
              }}
              className="h-9 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0"
              title="Clear all filters"
            >
              <X className="size-3.5 mr-1" /> Reset
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-5 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
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
                  const primaryImage = p.images && p.images.length > 0 ? getProductImageUrl(p.images[0].imageUrl) : null;

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative size-10 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 shrink-0 flex items-center justify-center">
                            {primaryImage ? (
                              <img
                                src={primaryImage}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="size-4 text-slate-400 dark:text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-zinc-100">{p.name}</div>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/system/products/${p.id}/edit`)}>
                              <Edit className="size-3.5 mr-1" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => { setSelectedProduct(p); setShowDeleteModal(true); }}>
                              <Trash2 className="size-3.5 mr-1" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

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

      {/* Shadcn Alert Dialog for Delete */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the product <strong className="text-slate-900 dark:text-white">"{selectedProduct?.name}"</strong> and all its associated variants, barcodes, and inventory records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete Product</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};