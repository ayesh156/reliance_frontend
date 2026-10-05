import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Plus, X, Loader2 } from 'lucide-react';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface SizeItem {
  id: number;
  name: string;
}

interface SizeComboboxProps {
  sizes: SizeItem[];
  value: string;
  onChange: (value: string) => void;
  onSizeCreated: (newSize: SizeItem) => void;
  dark?: boolean;
}

export const SizeCombobox: React.FC<SizeComboboxProps> = ({
  sizes,
  value,
  onChange,
  onSizeCreated,
  dark = true,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 220 });

  // Parse comma-separated string into unique array of sizes
  const selectedSizes = React.useMemo(() => {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [value]);

  const updateSelectedSizes = (newList: string[]) => {
    // Deduplicate and join as clean comma-separated string
    const unique = Array.from(new Set(newList.map(s => s.trim()).filter(Boolean)));
    onChange(unique.join(', '));
  };

  const handleToggleSize = (sizeName: string) => {
    const cleanName = sizeName.trim();
    if (!cleanName) return;
    if (selectedSizes.includes(cleanName)) {
      updateSelectedSizes(selectedSizes.filter(s => s !== cleanName));
    } else {
      updateSelectedSizes([...selectedSizes, cleanName]);
    }
  };

  const handleRemoveSize = (e: React.MouseEvent, sizeToRemove: string) => {
    e.stopPropagation();
    updateSelectedSizes(selectedSizes.filter(s => s !== sizeToRemove));
  };

  const handleAddCustomTag = () => {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return;
    // Support typing multiple comma-separated sizes e.g. "S, M, L"
    const newItems = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    updateSelectedSizes([...selectedSizes, ...newItems]);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  const filtered = sizes.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await post<SizeItem>('/attributes/sizes', { name: newName.trim().toUpperCase() });
      toast.success(`Size "${created.name}" created!`);
      onSizeCreated(created);
      updateSelectedSizes([...selectedSizes, created.name]);
      setModalOpen(false);
      setNewName('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create size');
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    // Don't toggle if clicking on a badge remove button
    if ((e.target as HTMLElement).closest('.badge-remove-btn')) return;
    
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }
    setOpen(!open);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Interactive Trigger with Tags */}
      <div
        ref={buttonRef}
        onClick={handleOpen}
        className="w-full min-h-[34px] flex items-center justify-between p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-left shadow-xs cursor-pointer hover:border-emerald-500/60 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-1 flex-1 pr-1">
          {selectedSizes.length === 0 ? (
            <span className="text-slate-400 dark:text-zinc-500 px-1 select-none">
              Select or type sizes (e.g. S, M, L)...
            </span>
          ) : (
            selectedSizes.map((sz, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold font-mono text-[10px]"
              >
                <span>{sz}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveSize(e, sz)}
                  className="badge-remove-btn p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded text-emerald-700 dark:text-emerald-300 transition-colors"
                  title="Remove size"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronsUpDown className="size-3 text-zinc-400 shrink-0 self-center" />
      </div>

      {open && createPortal(
        <>
          {/* Transparent Backdrop to close on outer click */}
          <div 
            className="fixed inset-0 z-[99998] bg-transparent" 
            onClick={() => setOpen(false)} 
          />
          <div
            style={{ 
              position: 'fixed',
              top: `${coords.top}px`, 
              left: `${coords.left}px`, 
              width: `${coords.width}px` 
            }}
            className="z-[99999] rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Tag input field */}
            <div className="flex items-center gap-1 mb-1.5">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type size & hit Enter (or comma)..."
                className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {query.trim() && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCustomTag}
                  className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  Add Tag
                </Button>
              )}
            </div>

            {/* Presets List */}
            <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
              {filtered.map(s => {
                const isSelected = selectedSizes.includes(s.name);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleSize(s.name);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                    }`}
                  >
                    <span className="font-mono">{s.name}</span>
                    {isSelected && <Check className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
              {filtered.length === 0 && !query.trim() && (
                <p className="text-[10px] text-slate-400 text-center py-2">No sizes configured</p>
              )}
            </div>

            <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setNewName(query.trim().toUpperCase());
                  setModalOpen(true);
                }}
                className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium p-1 cursor-pointer"
              >
                <Plus className="size-3" /> Quick Add Size
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-6 text-[10px] px-2"
              >
                Done
              </Button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Dialog for Creating New Standard Size */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle>Add New Garment Size</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. XXL, 34, 28-36, FREE"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="size-3.5 animate-spin mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};