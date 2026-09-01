import React, { useState } from 'react';
import { Check, ChevronsUpDown, Plus, FolderPlus, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';

interface Category {
  id: number;
  name: string;
  slug?: string;
  description?: string;
}

interface CategoryComboboxProps {
  categories: Category[];
  value: number;
  onChange: (categoryId: number) => void;
  onCategoryCreated: (newCategory: Category) => void;
  dark?: boolean;
}

export const CategoryCombobox: React.FC<CategoryComboboxProps> = ({
  categories,
  value,
  onChange,
  onCategoryCreated,
}) => {
  const [openDropdown, setOpenDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Modal Form States
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const selectedCategory = categories.find((c) => c.id === value);
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setCreating(true);
    try {
      const created = await post<Category>('/categories', {
        name: catName.trim(),
        description: catDesc.trim() || undefined,
        status: 'active',
      });

      toast.success(`Category "${created.name}" created!`);
      onCategoryCreated(created);
      onChange(created.id);
      setCatName('');
      setCatDesc('');
      setShowModal(false);
      setOpenDropdown(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpenDropdown(!openDropdown)}
        className="flex h-9 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        <span className="truncate">
          {selectedCategory ? selectedCategory.name : 'Select or create category...'}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
      </button>

      {/* Popover Dropdown */}
      {openDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenDropdown(false)}
          />
          <div className="absolute top-11 left-0 z-50 w-full min-w-[220px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category..."
              className="mb-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              autoFocus
            />

            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filtered.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onChange(cat.id);
                    setOpenDropdown(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                >
                  <span className="truncate">{cat.name}</span>
                  {value === cat.id && <Check className="size-3.5 text-emerald-500" />}
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="px-2 py-2 text-center text-[11px] text-slate-400 dark:text-zinc-500">
                  No matching categories found.
                </p>
              )}
            </div>

            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCatName(search.trim());
                  setShowModal(true);
                }}
                className="w-full justify-start gap-1.5 h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                <Plus className="size-3.5" />
                <span>Create "{search.trim() || 'New Category'}"</span>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Quick Add Category Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <FolderPlus className="size-5 text-emerald-500" />
              <DialogTitle>Add New Category</DialogTitle>
            </div>
            <DialogDescription>
              Create a garment category for catalog grouping and POS filters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                Category Name *
              </label>
              <Input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCategory(e);
                  }
                }}
                placeholder="e.g. Formal Shirts, Denim Wear, Accessories"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                Description (Optional)
              </label>
              <Input
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Brief category summary"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleCreateCategory} 
                disabled={creating}
              >
                {creating && <Loader2 className="size-3.5 animate-spin mr-1" />}
                {creating ? 'Creating...' : 'Save Category'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};