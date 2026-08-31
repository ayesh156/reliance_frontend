import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { ImageUpload } from '../ui/ImageUpload';
import { VariantTable } from './VariantTable';
import { X, Loader2 } from 'lucide-react';
import type { ProductItem, VariantItem } from '../../types/product';

export interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductItem | null;
  categories: { id: number; name: string }[];
  onSave: (formData: FormData, isEdit: boolean) => Promise<void>;
  dark: boolean;
}

export const ProductDialog: React.FC<ProductDialogProps> = ({
  open,
  onOpenChange,
  product,
  categories,
  onSave,
  dark,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setSearchKey(product.searchKey || '');
      setCategoryId(product.categoryId || product.category?.id || categories[0]?.id || 1);
      setImages((product.images || []).map(img => img.imageUrl));
      setVariants(
        (product.variants || []).map(v => ({
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
    } else {
      setName('');
      setDescription('');
      setSearchKey('');
      setCategoryId(categories[0]?.id || 1);
      setImages([]);
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
  }, [product, categories, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      await onSave(formData, !!product);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <DialogTitle>{product ? 'Edit Product & Variants' : 'Add New Product Item'}</DialogTitle>
          <DialogDescription>Configure catalog information, POS keywords, images, and pricing tiers.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General Info</TabsTrigger>
              <TabsTrigger value="variants">Variants &amp; Prices ({variants.length})</TabsTrigger>
              <TabsTrigger value="media">Gallery Media ({images.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Product Title *</label>
                  <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Slim-Fit Linen Casual Shirt" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Category *</label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(Number(e.target.value))}
                    className="flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">POS Search Tags</label>
                  <Input value={searchKey} onChange={e => setSearchKey(e.target.value)} placeholder="linen, casual, button-down" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Description</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Product material, care instructions, and specs" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="variants" className="pt-4">
              <VariantTable variants={variants} onChange={setVariants} productName={name} />
            </TabsContent>

            <TabsContent value="media" className="space-y-3 pt-4">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100"
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
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-3.5 animate-spin mr-1" />}
              {saving ? 'Saving...' : product ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};