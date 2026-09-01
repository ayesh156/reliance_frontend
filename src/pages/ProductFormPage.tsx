import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { get, post, put } from '../lib/api';
import { toast } from 'react-toastify';
import { CategoryCombobox } from '../components/products/CategoryCombobox';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ImageUpload } from '../components/ui/ImageUpload';
import { VariantTable } from '../components/products/VariantTable';
import type { ProductItem, VariantItem } from '../types/product';

import {
    ArrowLeft,
    Save,
    Loader2,
    Package,
    Layers,
    ImageIcon,
    X
} from 'lucide-react';

export const ProductFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const { theme } = useTheme();
    const dark = theme === 'dark';

    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [searchKey, setSearchKey] = useState('');
    const [categoryId, setCategoryId] = useState<number>(1);
    const [images, setImages] = useState<string[]>([]);
    const [variants, setVariants] = useState<VariantItem[]>([]);

   useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const catRes = await get<any[]>('/categories');
        if (!isMounted) return;
        
        const loadedCategories = Array.isArray(catRes) ? catRes : [];
        setCategories(loadedCategories);

        if (isEdit && id) {
          const prodRes = await get<ProductItem>(`/products/${id}`);
          if (prodRes && isMounted) {
            setName(prodRes.name);
            setDescription(prodRes.description || '');
            setSearchKey(prodRes.searchKey || '');
            setCategoryId(prodRes.categoryId || prodRes.category?.id || loadedCategories[0]?.id || 0);
            setImages((prodRes.images || []).map(img => img.imageUrl));
            setVariants(
              (prodRes.variants || []).map(v => ({
                id: v.id,
                key: `var-${v.id || Date.now()}`,
                size: v.size || 'FREE',
                color: v.color || 'Default',
                sku: v.sku || '',
                barcode: v.barcode || '',
                costPrice: Number(v.costPrice) || 0,
                retailPrice: Number(v.retailPrice) || 0,
                wholesalePrice: Number(v.wholesalePrice) || 0,
                comparePrice: v.comparePrice ? Number(v.comparePrice) : undefined,
                stock: Number(v.stock) || 0,
              }))
            );
          }
        } else if (isMounted) {
          if (loadedCategories.length > 0) {
            setCategoryId(loadedCategories[0].id);
          }
          setVariants([
            {
              key: `var-${Date.now()}`,
              size: 'FREE',
              color: 'Default',
              sku: `SKU-${Date.now().toString().slice(-4)}`,
              barcode: '',
              costPrice: 0,
              retailPrice: 0,
              wholesalePrice: 0,
              stock: 0,
            },
          ]);
        }
      } catch (err: any) {
        if (isMounted) {
          toast.error(err.message || 'Cannot reach API server (Check backend:5000)');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [id, isEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Product title is required');
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('description', description.trim());
            formData.append('searchKey', searchKey.trim());
            formData.append('categoryId', String(categoryId));
            formData.append('variants', JSON.stringify(variants));

            const existingUrls: string[] = [];
            images.forEach((img, i) => {
                if (img.startsWith('data:')) {
                    const byteString = atob(img.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
                    formData.append('imageFiles', new Blob([ab], { type: 'image/jpeg' }), `prod-${Date.now()}-${i}.jpg`);
                } else if (!img.startsWith('blob:')) {
                    existingUrls.push(img);
                }
            });
            formData.append('imageUrls', JSON.stringify(existingUrls));

            if (isEdit) {
                await put(`/products/${id}`, formData);
                toast.success('Product updated successfully!');
            } else {
                await post('/products', formData);
                toast.success('Product created successfully!');
            }
            navigate('/system/products');
        } catch (err: any) {
            toast.error(err.message || 'Failed to save product');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-8 animate-spin text-emerald-500" />
                <p className="text-xs text-slate-500 dark:text-zinc-400">Loading catalog record...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 w-full pb-16">
            {/* Top Bar Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => navigate('/system/products')}
                        className="h-9 w-9 rounded-xl"
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {isEdit ? `Edit: ${name || 'Product'}` : 'Add New Garment Item'}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                            Configure barcode SKUs, wholesale/retail prices, tags, and variants
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/system/products')}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Product'}
                    </Button>
                </div>
            </div>

            {/* Main Tabs Container */}
            <div className="space-y-6">
                {/* Section 1: General Info */}
                <div className="rounded-2xl border p-6 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <Package className="size-4 text-emerald-500" />
                        <h3 className="text-sm font-bold">General Information</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2 space-y-1.5">
                            <label className="block text-xs font-semibold">Product Title *</label>
                            <Input
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Slim-Fit Linen Casual Shirt"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold">Category *</label>
                            <CategoryCombobox
                  categories={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                  onCategoryCreated={(newCat) => setCategories(prev => [...prev, newCat])}
                  dark={dark}
                />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold">POS Keyword Search Tags</label>
                            <Input
                                value={searchKey}
                                onChange={e => setSearchKey(e.target.value)}
                                placeholder="linen, casual, button-down, formal"
                            />
                        </div>

                        <div className="sm:col-span-2 space-y-1.5">
                            <label className="block text-xs font-semibold">Description</label>
                            <Input
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Material specs, washing instructions, and fit details"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 2: Variants Matrix */}
                <div className="rounded-2xl border p-6 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 pb-1">
                        <Layers className="size-4 text-emerald-500" />
                        <h3 className="text-sm font-bold">Pricing, Inventory &amp; Barcode Matrix ({variants.length})</h3>
                    </div>
                    <VariantTable variants={variants} onChange={setVariants} productName={name} />
                </div>

                {/* Section 3: Media Gallery */}
                <div className="rounded-2xl border p-6 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <ImageIcon className="size-4 text-emerald-500" />
                        <h3 className="text-sm font-bold">Catalog Images &amp; Previews ({images.length})</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {images.map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 group">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setImages(images.filter((_, i) => i !== idx))}
                                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="size-3" />
                                </button>
                            </div>
                        ))}
                        <ImageUpload
                            value={undefined}
                            onChange={val => { if (val) setImages([...images, val]); }}
                            dark={dark}
                            className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </form>
    );
};