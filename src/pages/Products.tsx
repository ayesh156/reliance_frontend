import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency } from '../lib/utils';
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
} from 'lucide-react';

export const Products: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [products, setProducts] = useState<ProductItem[]>([]);
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
      const prods = await get<ProductItem[]>('/products');
      setProducts(prods || []);
    } catch (err: any) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.searchKey?.toLowerCase().includes(q) ||
        p.variants?.some(v => v.sku.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery]);

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

      <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
          <Search className="size-4 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search by name, tags, SKU, barcode..."
            className="bg-transparent outline-none w-full text-xs"
          />
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
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{p.name}</TableCell>
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