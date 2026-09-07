import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { get, post, del } from '../lib/api';
import { toast } from 'react-toastify';
import { FolderOpen, Ruler, Palette, Plus, Trash2, Loader2 } from 'lucide-react';

export const AttributesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('categories');
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [sizeName, setSizeName] = useState('');
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#000000');
  const [tempColorName, setTempColorName] = useState('');

  // Auto-detect color names from Hex code
  const getColorNameFromHex = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (r < 40 && g < 40 && b < 40) return 'Black';
    if (r > 220 && g > 220 && b > 220) return 'White';
    if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) return r > 120 ? 'Silver Gray' : 'Charcoal Gray';
    if (r > 150 && g < 60 && b < 60) return r > 200 ? 'Bright Red' : 'Dark Maroon';
    if (r > 180 && g > 100 && b < 50) return 'Orange';
    if (r > 180 && g > 180 && b < 80) return 'Yellow';
    if (g > r && g > b) return g > 160 ? 'Green' : 'Olive Green';
    if (b > r && b > g) return b > 180 ? 'Sky Blue' : 'Navy Blue';
    if (r > 120 && b > 120 && g < 100) return 'Purple';
    if (r > 180 && g < 120 && b > 120) return 'Pink';
    if (r > 100 && g > 60 && b < 40) return 'Brown';
    return 'Custom Color';
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Unified attribute taxonomy fetching
      const [c, s, clr] = await Promise.all([
        get<any[]>('/attributes/categories'),
        get<any[]>('/attributes/sizes'),
        get<any[]>('/attributes/colors'),
      ]);
      setCategories(c || []);
      setSizes(s || []);
      setColors(clr || []);
    } catch {
      toast.error('Failed to load attributes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      // Create category via unified attributes endpoint
      await post('/attributes/categories', { name: catName.trim(), description: catDesc.trim() || undefined });
      toast.success('Category added successfully');
      setCatName('');
      setCatDesc('');
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Error saving category');
    }
  };

  const handleAddSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeName.trim()) return;
    try {
      await post('/attributes/sizes', { name: sizeName.trim(), order: sizes.length + 1 });
      toast.success('Size added successfully');
      setSizeName('');
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Error saving size');
    }
  };

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colorName.trim()) return;
    try {
      await post('/attributes/colors', { name: colorName.trim(), hexCode: colorHex });
      toast.success('Color added successfully');
      setColorName('');
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Error saving color');
    }
  };

  // Active attribute target selected for deletion confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    endpoint: string;
    id: number;
    name: string;
    type: 'Category' | 'Size' | 'Color';
  } | null>(null);

  /**
   * Execute deletion of taxonomy attribute after modal confirmation
   */
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del(`${deleteTarget.endpoint}/${deleteTarget.id}`);
      toast.success(`${deleteTarget.type} "${deleteTarget.name}" deleted successfully`);
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete attribute');
    }
  };

  return (
    <div className="space-y-6 w-full pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Product Attributes &amp; Taxonomy
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          Manage standardized garment sizes, color swatches, and category tags for faster variant creation.
        </p>
      </div>

      {/* Metrics Row matching CustomersPage design */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Categories</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{categories.length}</h3>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <FolderOpen className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Standard Sizes</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{sizes.length}</h3>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <Ruler className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Color Swatches</span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{colors.length}</h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Palette className="size-5" />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="inline-flex h-11 items-center justify-start rounded-xl bg-slate-100 p-1 text-slate-500 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 gap-1">
          <TabsTrigger
            value="categories"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white shadow-none transition-all"
          >
            <FolderOpen className="size-3.5 text-emerald-500" /> Categories ({categories.length})
          </TabsTrigger>
          <TabsTrigger
            value="sizes"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white shadow-none transition-all"
          >
            <Ruler className="size-3.5 text-emerald-500" /> Sizes ({sizes.length})
          </TabsTrigger>
          <TabsTrigger
            value="colors"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-white shadow-none transition-all"
          >
            <Palette className="size-3.5 text-emerald-500" /> Colors ({colors.length})
          </TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="rounded-2xl border p-5 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
            <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3">
              <Input
                required
                value={catName}
                onChange={e => setCatName(e.target.value)}
                placeholder="Category Name (e.g. Linen Shirts)"
                className="flex-1"
              />
              <Input
                value={catDesc}
                onChange={e => setCatDesc(e.target.value)}
                placeholder="Description (Optional)"
                className="flex-1"
              />
              <Button type="submit" className="gap-2 shrink-0">
                <Plus className="size-4" /> Add Category
              </Button>
            </form>
          </div>

          <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs opacity-75">{c.slug}</TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-zinc-400">{c.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ endpoint: '/attributes/categories', id: c.id, name: c.name, type: 'Category' })} className="text-rose-500">
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Sizes Tab */}
        <TabsContent value="sizes" className="space-y-4">
          <div className="rounded-2xl border p-5 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
            <form onSubmit={handleAddSize} className="flex gap-3 max-w-lg">
              <Input
                required
                value={sizeName}
                onChange={e => setSizeName(e.target.value)}
                placeholder="e.g. S, M, L, XL, XXL, 32, FREE"
              />
              <Button type="submit" className="gap-2 shrink-0">
                <Plus className="size-4" /> Add Size
              </Button>
            </form>
          </div>

          <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-5">
            <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Configured Sizes</h4>
            <div className="flex flex-wrap gap-3">
              {sizes.map(s => (
                <div key={s.id} className="group relative flex items-center justify-center min-w-[3rem] h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-emerald-500 transition-colors">
                  <span className="font-bold text-sm font-mono text-slate-700 dark:text-zinc-200">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ endpoint: '/attributes/sizes', id: s.id, name: s.name, type: 'Size' })}
                    className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4">
          <div className="rounded-2xl border p-5 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800">
            <form onSubmit={handleAddColor} className="flex flex-wrap items-center gap-3 max-w-xl">
              <Input
                required
                value={colorName}
                onFocus={() => {
                  setTempColorName(colorName);
                  setColorName(''); // Click කළ විට auto-clear වීම
                }}
                onBlur={() => {
                  if (!colorName.trim()) {
                    setColorName(tempColorName); // Type නොකර ඉවත් වුවහොත් පැරණි නම restore වීම
                  }
                }}
                onChange={e => setColorName(e.target.value)}
                placeholder="e.g. Navy Blue, Maroon"
                className="flex-1 min-w-[200px]"
              />
              <div className="flex items-center gap-2 border rounded-xl px-2 h-9 border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                <input
                  type="color"
                  value={colorHex}
                  onChange={e => {
                    const newHex = e.target.value.toUpperCase();
                    setColorHex(newHex);
                    const identifiedName = getColorNameFromHex(newHex); // Auto Color Name Resolver
                    setColorName(identifiedName);
                    setTempColorName(identifiedName);
                  }}
                  className="size-6 rounded border-0 cursor-pointer bg-transparent p-0"
                />
                <span className="text-xs font-mono uppercase font-semibold">{colorHex}</span>
              </div>
              <Button type="submit" className="gap-2 shrink-0">
                <Plus className="size-4" /> Add Color
              </Button>
            </form>
          </div>

          <div className="rounded-2xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 p-5">
            <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Configured Color Swatches</h4>
            <div className="flex flex-wrap gap-2.5">
              {colors.map(clr => (
                <div key={clr.id} className="flex items-center gap-2.5 pl-2 pr-1.5 py-1 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                  <span className="size-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: clr.hexCode || '#ccc' }} />
                  <span className="font-semibold text-xs">{clr.name}</span>
                  <button type="button" onClick={() => setDeleteTarget({ endpoint: '/attributes/colors', id: clr.id, name: clr.name, type: 'Color' })} className="p-1 hover:bg-rose-500/10 rounded-lg text-rose-500">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Attribute Delete Confirmation Modal */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteTarget?.type.toLowerCase()}{' '}
              <strong className="text-slate-900 dark:text-white">"{deleteTarget?.name}"</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
              Delete {deleteTarget?.type}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};