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
import { compressAndConvertToWebP } from '../utils/imageCompressor';
import { validateProductForm } from '../utils/validators';

import {
  ArrowLeft,
  Save,
  Loader2,
  Package,
  Layers,
  ImageIcon,
  X,
  Tag,
  Check,
  Grid,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
/**
 * Test & Preload External Image Address (Google, Facebook, CDN)
 * Verifies the image loads successfully before pushing to catalog preview
 */
const verifyAndPreloadImage = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};

export const ProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [sizes, setSizes] = useState<{ id: number; name: string }[]>([]);
  const [colors, setColors] = useState<{ id: number; name: string; hexCode?: string | null }[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  // Controls the full-catalog gallery modal when images overflow
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);

  // Pure CSS-driven Responsive Catalog Layout (Device Simulation සහ Widescreen සඳහා 100% ක්‍රියාත්මකයි)

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        // Load taxonomy presets via unified attributes endpoint
        const [catRes, sizeRes, colorRes] = await Promise.all([
          get<any[]>('/attributes/categories'),
          get<any[]>('/attributes/sizes'),
          get<any[]>('/attributes/colors'),
        ]);
        if (!isMounted) return;

        const loadedCategories = Array.isArray(catRes) ? catRes : [];
        setCategories(loadedCategories);
        setSizes(Array.isArray(sizeRes) ? sizeRes : []);
        setColors(Array.isArray(colorRes) ? colorRes : []);

        if (isEdit && id) {
          const prodRes = await get<ProductItem>(`/products/${id}`);
          if (prodRes && isMounted) {
            setName(prodRes.name);
            setDescription(prodRes.description || '');
            setSearchKey(prodRes.searchKey || '');
            setCategoryId(prodRes.categoryId || prodRes.category?.id || loadedCategories[0]?.id || 0);
            const loadedImages = (prodRes.images || []).map(img => img.imageUrl);
            setImages(loadedImages);

            setVariants(
              (prodRes.variants || []).map(v => {
                const variantImgs = (prodRes.images || [])
                  .filter(img => img.variantId === v.id)
                  .map(img => img.imageUrl);

                const variantIndexes = variantImgs
                  .map(url => loadedImages.indexOf(url))
                  .filter(idx => idx !== -1);

                return {
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
                  imageUrl: variantImgs[0] || undefined,
                  imageUrls: variantImgs,
                  imageIndexes: variantIndexes,
                };
              })
            );
          }
        } else if (isMounted) {
          if (loadedCategories.length > 0) {
            setCategoryId(loadedCategories[0].id);
          }
          setVariants([
            {
              key: `var-${Date.now()}-1`,
              size: 'FREE',
              color: 'Default',
              sku: 'PROD-0001',
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

  /**
   * Remove image from catalog gallery and automatically detach it
   * from any assigned variant in the matrix above
   */
  /**
   * Remove image from catalog gallery and cleanly detach from any variant's image list
   */
  const handleRemoveImage = (targetIndex: number) => {
    const removedImageUrl = images[targetIndex];
    const nextImages = images.filter((_, i) => i !== targetIndex);
    setImages(nextImages);

    if (removedImageUrl) {
      setVariants(prevVariants =>
        prevVariants.map(v => {
          const nextUrls = (v.imageUrls || []).filter(u => u !== removedImageUrl);
          const nextIndexes = nextUrls
            .map(u => nextImages.indexOf(u))
            .filter(idx => idx !== -1);

          return {
            ...v,
            imageUrl: nextUrls[0] || undefined,
            imageUrls: nextUrls,
            imageIndexes: nextIndexes,
          };
        })
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enterprise-grade Client-side Form Validation
    const formValidation = validateProductForm(name, categoryId, variants.length);
    if (!formValidation.isValid) {
      toast.error(formValidation.error);
      return;
    }

    const skus = variants.map(v => v.sku.trim().toLowerCase()).filter(Boolean);
    const duplicateSku = skus.find((item, index) => skus.indexOf(item) !== index);
    if (duplicateSku) {
      toast.error(`Duplicate SKU "${duplicateSku.toUpperCase()}" found. Each variant must have a unique SKU.`);
      return;
    }

    const barcodes = variants.map(v => v.barcode?.trim()).filter(Boolean);
    const duplicateBarcode = barcodes.find((item, index) => barcodes.indexOf(item) !== index);
    if (duplicateBarcode) {
      toast.error(`Duplicate Barcode "${duplicateBarcode}" found. Each variant must have a unique Barcode.`);
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

      // Process existing/direct web URLs, local paths, and newly captured WebP DataURLs
      const existingUrls: string[] = [];
      images.forEach((img, i) => {
        if (img.startsWith('data:')) {
          // Convert only locally captured screenshots/binary data to WebP blobs
          const mimeType = img.substring(img.indexOf(':') + 1, img.indexOf(';')) || 'image/webp';
          const byteString = atob(img.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);

          const extension = mimeType.includes('webp') ? 'webp' : 'jpg';
          formData.append('imageFiles', new Blob([ab], { type: mimeType }), `prod-pasted-${Date.now()}-${i}.${extension}`);
        } else if (img.startsWith('http://') || img.startsWith('https://') || (!img.startsWith('blob:') && img.trim())) {
          // Direct web image links (Google, Facebook, CDNs) are preserved as raw URLs (Zero server disk cost)
          existingUrls.push(img.trim());
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

      // Quick Checkout හෝ වෙනත් තැනක සිට පැමිණියේ නම් නැවත එම පිටුවටම යවයි (Return-to-origin)
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
      if (returnUrl) {
        navigate(returnUrl);
      } else {
        navigate('/system/products');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  /**
 * Handle Smart Clipboard Paste Event (Senari Pattern)
 * Intelligently accepts BOTH direct web image URLs (Google/Facebook addresses) AND binary pasted images
 */
  const handleClipboardPaste = async (e: React.ClipboardEvent) => {
    // 1. Direct Web Image URL Pasted (Google, Facebook, CDN link copied via "Copy Image Address")
    const pastedText = e.clipboardData?.getData('text')?.trim();
    if (pastedText && /^https?:\/\/.+/i.test(pastedText)) {
      // Check if already in image list to avoid duplicate entries
      if (images.includes(pastedText)) {
        toast.warn('This image link is already added to the catalog');
        return;
      }

      e.preventDefault();
      const toastId = toast.loading('Verifying web image link...');

      const isValid = await verifyAndPreloadImage(pastedText);
      if (isValid) {
        setImages(prev => [...prev, pastedText]);
        toast.update(toastId, {
          render: 'Web image link added successfully (Storage saved)!',
          type: 'success',
          isLoading: false,
          autoClose: 2500,
        });
      } else {
        toast.update(toastId, {
          render: 'Could not load image from this URL. Please check the address.',
          type: 'error',
          isLoading: false,
          autoClose: 3500,
        });
      }
      return;
    }

    // 2. Binary Image / Screenshot / "Copy Image" in Clipboard
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        const toastId = toast.loading('Optimizing pasted image to WebP...');
        try {
          const optimizedFile = await compressAndConvertToWebP(blob, 1200, 0.82);
          const reader = new FileReader();
          reader.onloadend = () => {
            const resultUrl = reader.result as string;
            if (resultUrl) {
              setImages(prev => [...prev, resultUrl]);
              toast.update(toastId, {
                render: `Pasted & compressed (${Math.round(optimizedFile.size / 1024)} KB WebP)!`,
                type: 'success',
                isLoading: false,
                autoClose: 2500,
              });
            }
          };
          reader.readAsDataURL(optimizedFile);
        } catch (err: any) {
          toast.update(toastId, {
            render: 'Failed to process pasted image',
            type: 'error',
            isLoading: false,
            autoClose: 3000,
          });
        }
      }
    }
  };

  /**
   * Handle Smart Variant-Specific Direct Clipboard Paste (Senari Pattern)
   * Supports both copied web image links (zero storage overhead) and direct copied image graphics
   */
  const handleVariantDirectPaste = async (variantKey: string, e: React.ClipboardEvent) => {
    // 1. Direct Web Image URL Pasted to specific variant
    const pastedText = e.clipboardData?.getData('text')?.trim();
    if (pastedText && /^https?:\/\/.+/i.test(pastedText)) {
      e.preventDefault();
      e.stopPropagation();

      const toastId = toast.loading('Assigning web image address to variant...');
      const isValid = await verifyAndPreloadImage(pastedText);

      if (isValid) {
        if (!images.includes(pastedText)) {
          setImages(prev => [...prev, pastedText]);
        }

        setVariants(prev =>
          prev.map(v => {
            if (v.key === variantKey) {
              const existing = v.imageUrls || (v.imageUrl ? [v.imageUrl] : []);
              const nextUrls = existing.includes(pastedText) ? existing : [...existing, pastedText];
              return {
                ...v,
                imageUrl: nextUrls[0],
                imageUrls: nextUrls,
              };
            }
            return v;
          })
        );

        toast.update(toastId, {
          render: 'Web image assigned to variant (Storage saved)!',
          type: 'success',
          isLoading: false,
          autoClose: 2500,
        });
      } else {
        toast.update(toastId, {
          render: 'Could not load image from this URL address.',
          type: 'error',
          isLoading: false,
          autoClose: 3500,
        });
      }
      return;
    }

    // 2. Binary Image / Graphic in Clipboard
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        e.stopPropagation();
        const blob = item.getAsFile();
        if (!blob) continue;

        const toastId = toast.loading('Compressing and assigning variant image...');
        try {
          const optimizedFile = await compressAndConvertToWebP(blob, 1200, 0.82);
          const reader = new FileReader();
          reader.onloadend = () => {
            const resultUrl = reader.result as string;
            if (resultUrl) {
              setImages(prev => [...prev, resultUrl]);
              setVariants(prev =>
                prev.map(v => {
                  if (v.key === variantKey) {
                    const nextUrls = [...(v.imageUrls || []), resultUrl];
                    return {
                      ...v,
                      imageUrl: nextUrls[0],
                      imageUrls: nextUrls,
                    };
                  }
                  return v;
                })
              );

              toast.update(toastId, {
                render: `Variant image pasted & optimized (${Math.round(optimizedFile.size / 1024)} KB WebP)!`,
                type: 'success',
                isLoading: false,
                autoClose: 2500,
              });
            }
          };
          reader.readAsDataURL(optimizedFile);
        } catch (err: any) {
          toast.update(toastId, {
            render: 'Failed to paste variant image',
            type: 'error',
            isLoading: false,
            autoClose: 3000,
          });
        }
      }
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
            onClick={() => {
              const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
              navigate(returnUrl || '/system/products');
            }}
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
            onClick={() => {
              const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
              navigate(returnUrl || '/system/products');
            }}
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

          {/* Professional Compact 1-Row Media Gallery with Horizontal Flow & Collapse Protection */}
     <div 
                  tabIndex={0}
                  onPaste={handleClipboardPaste}
                  className="rounded-2xl border p-5 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 space-y-3.5 shadow-sm focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="size-4 text-emerald-500" />
                          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                            Catalog Images &amp; Previews ({images.length})
                          </h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                          Tip: Click here &amp; press <kbd className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Ctrl + V</kbd> to paste Web/FB photos
                        </span>
                    </div>
                    
                    {/* Enterprise Fluid 1-Row Responsive Grid: Edge-to-Edge with Zero Scrollbar & Equal Heights */}
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-3 w-full items-center">
                        {(() => {
                            // Responsive breakpoint slot computation (Mobile: 4 cols, Tablet: 5-6 cols, Desktop: 7-8 cols)
                            const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
                            const isTablet = typeof window !== 'undefined' && window.innerWidth >= 640 && window.innerWidth < 1024;
                            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024 && window.innerWidth < 1280;
                            
                            const maxGridCapacity = isMobile ? 4 : isTablet ? 6 : isDesktop ? 7 : 8;
                            const hasOverflow = (images.length + 1) > maxGridCapacity;
                            const maxPreviewCount = hasOverflow ? Math.max(1, maxGridCapacity - 2) : images.length;
                            
                            const visibleImages = images.slice(0, maxPreviewCount);
                            const overflowCount = images.length - visibleImages.length;

                            return (
                              <>
                                {visibleImages.map((img, idx) => {
                                    const apiHost = import.meta.env.VITE_API_URL 
                                      ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') 
                                      : 'http://localhost:5000';
                                    const resolvedUrl = img.startsWith('http') || img.startsWith('data:') || img.startsWith('blob:')
                                      ? img
                                      : `${apiHost}${img.startsWith('/') ? '' : '/'}${img}`;

                                    const assignedVariants = variants
                                      .map((v, i) => ({ variant: v, index: i }))
                                      .filter(({ variant }) => (variant.imageUrls || []).includes(img) || variant.imageUrl === img);

                                    const isAssigned = assignedVariants.length > 0;
                                    const firstAssigned = isAssigned ? assignedVariants[0] : null;

                                    return (
                                      <div 
                                        key={idx} 
                                        className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 group bg-slate-50 dark:bg-zinc-900 shadow-xs hover:border-emerald-500/60 transition-colors"
                                      >
                                        <img
                                          src={resolvedUrl}
                                          alt=""
                                          loading="lazy"
                                          className="w-full h-full object-cover absolute inset-0 z-0 transition-transform duration-200 group-hover:scale-105"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                        {resolvedUrl.startsWith('http') && (
                                          <span className="absolute bottom-1 right-1 z-10 px-1 py-0.5 rounded bg-black/75 text-white font-mono text-[7px] font-bold">
                                            WEB
                                          </span>
                                        )}
                                        
                                       {/* Top Action Bar: Clean Minimalist Controls (Guaranteed Mobile Fit) */}
                                        <div className="relative z-10 p-1 flex items-center justify-between">
                                          <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                              <button
                                                type="button"
                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold shadow-xs backdrop-blur-md transition-all cursor-pointer ${
                                                  isAssigned
                                                    ? 'bg-emerald-600 text-white border border-emerald-400/30'
                                                    : 'bg-black/60 hover:bg-black/80 text-white/90'
                                                }`}
                                                title="Assign image to variant"
                                              >
                                                <Tag className="w-2.5 h-2.5 shrink-0 hidden sm:inline-block" />
                                                <span>
                                                  {isAssigned 
                                                    ? assignedVariants.length === 1 
                                                      ? `#${firstAssigned!.index + 1}` 
                                                      : `${assignedVariants.length}V`
                                                    : 'Tag'}
                                                </span>
                                              </button>
                                            </DropdownMenuTrigger>

                                            <DropdownMenuContent align="start" className="w-52 text-xs p-1 z-50">
                                              <div className="px-2 py-1 text-[9px] uppercase font-bold text-slate-400">
                                                Assign Image To Variant
                                              </div>
                                              
                                              <DropdownMenuItem
                                                onClick={() => {
                                                  setVariants(prev =>
                                                    prev.map(v => {
                                                      const newUrls = (v.imageUrls || []).filter(u => u !== img);
                                                      return {
                                                        ...v,
                                                        imageUrl: newUrls[0] || (v.imageUrl === img ? undefined : v.imageUrl),
                                                        imageUrls: newUrls,
                                                        imageIndexes: newUrls.map(u => images.indexOf(u)).filter(i => i !== -1),
                                                      };
                                                    })
                                                  );
                                                }}
                                                className="text-xs cursor-pointer flex items-center justify-between"
                                              >
                                                <span>General Photo (Unassign)</span>
                                                {!isAssigned && <Check className="size-3 text-emerald-500" />}
                                              </DropdownMenuItem>

                                              <DropdownMenuSeparator />

                                              {variants.map((v, i) => {
                                                const hasThisImg = (v.imageUrls || []).includes(img) || v.imageUrl === img;
                                                return (
                                                  <DropdownMenuItem
                                                    key={v.key}
                                                    onClick={() => {
                                                      setVariants(prev =>
                                                        prev.map((item, itemIdx) => {
                                                          if (itemIdx === i) {
                                                            const existing = item.imageUrls || (item.imageUrl ? [item.imageUrl] : []);
                                                            const nextUrls = existing.includes(img)
                                                              ? existing.filter(u => u !== img)
                                                              : [...existing, img];

                                                            return {
                                                              ...item,
                                                              imageUrl: nextUrls[0] || undefined,
                                                              imageUrls: nextUrls,
                                                              imageIndexes: nextUrls.map(u => images.indexOf(u)).filter(idx => idx !== -1),
                                                            };
                                                          }
                                                          return item;
                                                        })
                                                      );
                                                    }}
                                                    className={`text-xs cursor-pointer flex items-center justify-between ${
                                                      hasThisImg ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                                                    }`}
                                                  >
                                                    <div className="flex items-center gap-1.5 truncate">
                                                      <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-zinc-800">
                                                        #{i + 1}
                                                      </span>
                                                      <span className="truncate text-[11px]">
                                                        {v.size || 'FREE'} / {v.color || 'Def'}
                                                      </span>
                                                    </div>
                                                    {hasThisImg && <Check className="size-3 text-emerald-500 shrink-0" />}
                                                  </DropdownMenuItem>
                                                );
                                              })}
                                            </DropdownMenuContent>
                                          </DropdownMenu>

                                          {/* Delete Image Button */}
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveImage(idx)}
                                            className="p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white shadow-xs transition-colors cursor-pointer"
                                            title="Delete image"
                                          >
                                            <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                          </button>
                                        </div>

                                        {/* Bottom Variant Indicator: Clean & Overlap-Free */}
                                        {firstAssigned && (
                                          <div className="absolute bottom-0 inset-x-0 z-10 px-1.5 py-0.5 bg-gradient-to-t from-black/90 to-transparent text-[9px] text-white font-mono flex items-center justify-between leading-none">
                                            <span className="truncate">
                                              #{firstAssigned!.index + 1}
                                            </span>
                                            <span className="opacity-90 font-sans text-[8px] truncate">
                                              {firstAssigned.variant.size}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                })}

                                {/* Overflow Collapse Card (+N More Trigger Button) */}
                                {hasOverflow && (
                                  <button
                                    type="button"
                                    onClick={() => setIsGalleryModalOpen(true)}
                                    className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-900 dark:bg-zinc-900 text-white flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-emerald-500 hover:scale-102 transition-all shadow-md group p-1"
                                    title="Click to view full image gallery"
                                  >
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                                      <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                                    </div>
                                    <span className="font-bold font-mono text-[11px] sm:text-xs tracking-tight">
                                      +{overflowCount} More
                                    </span>
                                    <span className="text-[8px] text-slate-400 font-medium hidden sm:inline-block">
                                      View All
                                    </span>
                                  </button>
                                )}

                                {/* Responsive Multi-file Uploader Card: Detailed on Desktop, Compact on Mobile */}
                                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 dark:border-zinc-800 hover:border-emerald-500 transition-colors flex items-center justify-center bg-slate-50 dark:bg-zinc-900/50 group cursor-pointer">
                                  {/* Hidden native input for seamless multi-upload */}
                                  <ImageUpload
                                      value={undefined}
                                      onChange={(val?: string) => { 
                                        if (val) setImages(prev => [...prev, val]); 
                                      }}
                                      onMultipleChange={(newImgs: string[]) => {
                                        if (newImgs && newImgs.length > 0) {
                                          setImages(prev => [...prev, ...newImgs]);
                                        }
                                      }}
                                      dark={dark}
                                      className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                                  />
                                  
                                  {/* Visual Upload Trigger: Adapts gracefully between mobile icon & rich desktop guidance */}
                                  <div className="flex flex-col items-center justify-center p-1 sm:p-2 text-center select-none pointer-events-none z-10 w-full">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 xl:w-8 xl:h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform mb-0.5 sm:mb-1">
                                      <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                    </div>
                                    
                                    {/* Mobile/Tablet view: simple compact label */}
                                    <div className="xl:hidden flex flex-col items-center leading-none">
                                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                                        Upload
                                      </span>
                                      <span className="text-[7px] sm:text-[8px] text-slate-400 mt-0.5 hidden sm:inline-block">
                                        Photos
                                      </span>
                                    </div>

                                    {/* Desktop view (xl+): Detailed rich text guidance matching original format */}
                                    <div className="hidden xl:flex flex-col items-center text-center px-1">
                                      <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-300 leading-tight">
                                        Click to upload or drag & drop
                                      </span>
                                      <span className="text-[8px] text-slate-400 dark:text-zinc-500 mt-0.5 leading-none">
                                        PNG, JPG or WEBP
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                        })()}
                    </div>
                </div>

        {/* Variants Matrix */}
        <div className="rounded-2xl border p-6 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-1">
            <Layers className="size-4 text-emerald-500" />
            <h3 className="text-sm font-bold">Pricing, Inventory &amp; Barcode Matrix ({variants.length})</h3>
          </div>
          <VariantTable
            variants={variants}
            onChange={setVariants}
            productName={name}
            availableSizes={sizes}
            availableColors={colors}
            catalogImages={images}
            onSizeCreated={(newSize) => setSizes(prev => [...prev, newSize])}
            onColorCreated={(newColor) => setColors(prev => [...prev, newColor])}
            onVariantPaste={handleVariantDirectPaste}
            dark={dark}
          />
        </div>

      </div>

      {/* Full Media Gallery Modal: Hardened 2-Layer Responsive Architecture (Zero Vertical Squashing) */}
      <Dialog open={isGalleryModalOpen} onOpenChange={setIsGalleryModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[85vh] flex flex-col bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl">
          {/* Header section with shrink-0 protection */}
          <DialogHeader className="pb-3 border-b shrink-0 border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Grid className="size-4 text-emerald-500" />
              <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Full Product Media Gallery ({images.length} Photos)
              </DialogTitle>
            </div>
            <DialogDescription className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400">
              Manage, tag variants, and delete images across your entire catalog collection.
            </DialogDescription>
          </DialogHeader>

          {/* Layer 1: Dedicated Viewport Layer (min-h-0 prevents flexbox vertical auto-shrinking) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-1 sm:px-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
            {/* Layer 2: Independent CSS Grid Layer (Enforces true aspect-square height and mobile spacing) */}
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
              {images.map((img, idx) => {
                const apiHost = import.meta.env.VITE_API_URL 
                  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') 
                  : 'http://localhost:5000';
                const resolvedUrl = img.startsWith('http') || img.startsWith('data:') || img.startsWith('blob:')
                  ? img
                  : `${apiHost}${img.startsWith('/') ? '' : '/'}${img}`;

                const assignedVariants = variants
                  .map((v, i) => ({ variant: v, index: i }))
                  .filter(({ variant }) => (variant.imageUrls || []).includes(img) || variant.imageUrl === img);

                const isAssigned = assignedVariants.length > 0;
                const firstAssigned = isAssigned ? assignedVariants[0] : null;

                return (
                  <div 
                    key={idx} 
                    className="relative aspect-square w-full rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 group shadow-xs hover:border-emerald-500/80 transition-colors"
                  >
                    <img
                      src={resolvedUrl}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />

                    {/* Top Action Controls: High contrast & scaled for mobile */}
                    <div className="absolute top-1.5 inset-x-1.5 sm:top-2 sm:inset-x-2 flex items-center justify-between z-10 pointer-events-none">
                      <span className="font-mono text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md bg-black/75 text-white font-bold backdrop-blur-xs leading-none">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="p-1 sm:p-1.5 rounded-full bg-black/65 hover:bg-rose-600 text-white shadow-xs transition-colors cursor-pointer pointer-events-auto"
                        title="Delete Image"
                      >
                        <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </button>
                    </div>

                    {/* Bottom Variant Status Badge */}
                    <div className="absolute bottom-0 inset-x-0 p-1 sm:p-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10 flex items-center justify-between text-[8px] sm:text-[9px] text-white font-mono leading-tight">
                      <span className="truncate max-w-[65%]">
                        {isAssigned ? (assignedVariants.length === 1 ? '1 Assigned' : `${assignedVariants.length} Vars`) : 'General'}
                      </span>
                      {firstAssigned && (
                        <span className="opacity-95 font-sans text-[8px] font-bold truncate">
                          {firstAssigned.variant.size}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer with shrink-0 protection */}
          <div className="pt-3 border-t shrink-0 border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
              Total images in catalog: <strong className="text-slate-800 dark:text-zinc-200">{images.length}</strong>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsGalleryModalOpen(false)}
              className="h-8 text-xs px-3 cursor-pointer"
            >
              Done / Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
};