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

interface ColorItem {
  id: number;
  name: string;
  hexCode?: string | null;
}

interface ColorComboboxProps {
  colors: ColorItem[];
  value: string;
  onChange: (value: string) => void;
  onColorCreated: (newColor: ColorItem) => void;
  dark?: boolean;
}

export const ColorCombobox: React.FC<ColorComboboxProps> = ({
  colors,
  value,
  onChange,
  onColorCreated,
  dark = true,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#000000');
  const [tempColorName, setTempColorName] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });

  // Auto-detect human readable color names from Hex
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
    if (g > r && g > b) return g > 160 ? 'Green' : 'Olive / Forest Green';
    if (b > r && b > g) return b > 180 ? 'Sky Blue' : 'Navy Blue';
    if (r > 120 && b > 120 && g < 100) return 'Purple';
    if (r > 180 && g < 120 && b > 120) return 'Pink';
    if (r > 100 && g > 60 && b < 40) return 'Brown';
    return 'Custom Shade';
  };

  // Parse comma-separated string into unique array of colors
  const selectedColors = React.useMemo(() => {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
  }, [value]);

  const updateSelectedColors = (newList: string[]) => {
    const unique = Array.from(new Set(newList.map(c => c.trim()).filter(Boolean)));
    onChange(unique.join(', '));
  };

  const handleToggleColor = (colorName: string) => {
    const cleanName = colorName.trim();
    if (!cleanName) return;
    if (selectedColors.includes(cleanName)) {
      updateSelectedColors(selectedColors.filter(c => c !== cleanName));
    } else {
      updateSelectedColors([...selectedColors, cleanName]);
    }
  };

  const handleRemoveColor = (e: React.MouseEvent, colorToRemove: string) => {
    e.stopPropagation();
    updateSelectedColors(selectedColors.filter(c => c !== colorToRemove));
  };

  const handleAddCustomTag = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const newItems = trimmed.split(',').map(c => c.trim()).filter(Boolean);
    updateSelectedColors([...selectedColors, ...newItems]);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  const filtered = colors.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await post<ColorItem>('/attributes/colors', {
        name: newName.trim(),
        hexCode: newHex,
      });
      toast.success(`Color "${created.name}" created!`);
      onColorCreated(created);
      updateSelectedColors([...selectedColors, created.name]);
      setModalOpen(false);
      setNewName('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create color');
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.badge-remove-btn')) return;

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 240),
      });
    }
    setOpen(!open);
  };

  // Helper to lookup hex code for a color name
  const findHexForName = (name: string): string | undefined => {
    const found = colors.find(c => c.name.toLowerCase() === name.toLowerCase());
    return found?.hexCode || undefined;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Interactive Trigger with Color Badges */}
      <div
        ref={buttonRef}
        onClick={handleOpen}
        className="w-full min-h-[34px] flex items-center justify-between p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-left shadow-xs cursor-pointer hover:border-emerald-500/60 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-1 flex-1 pr-1">
          {selectedColors.length === 0 ? (
            <span className="text-slate-400 dark:text-zinc-500 px-1 select-none">
              Select or type colors (e.g. Black, White)...
            </span>
          ) : (
            selectedColors.map((clr, idx) => {
              const hex = findHexForName(clr);
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700/80 font-medium text-[10px]"
                >
                  {hex && (
                    <span
                      className="size-2.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: hex }}
                    />
                  )}
                  <span>{clr}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveColor(e, clr)}
                    className="badge-remove-btn p-0.5 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded text-slate-500 hover:text-slate-800 dark:hover:text-zinc-100 transition-colors"
                    title="Remove color"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              );
            })
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
                placeholder="Type color & hit Enter (or comma)..."
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

            {/* Colors Presets List */}
            <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
              {filtered.map(c => {
                const isSelected = selectedColors.includes(c.name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleColor(c.name);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-full border border-black/15 shrink-0"
                        style={{ backgroundColor: c.hexCode || '#999' }}
                      />
                      <span>{c.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
              {filtered.length === 0 && !query.trim() && (
                <p className="text-[10px] text-slate-400 text-center py-2">No colors configured</p>
              )}
            </div>

            <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  const initialName = query.trim() || getColorNameFromHex(newHex);
                  setNewName(initialName);
                  setTempColorName(initialName);
                  setModalOpen(true);
                }}
                className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium p-1 cursor-pointer"
              >
                <Plus className="size-3" /> Quick Add Color
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

      {/* Dialog for Adding New Color with Color Picker */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Add New Garment Color</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={newName}
              onFocus={() => {
                setTempColorName(newName);
                setNewName('');
              }}
              onBlur={() => {
                if (!newName.trim()) {
                  setNewName(tempColorName);
                }
              }}
              onChange={e => setNewName(e.target.value)}
              placeholder="Color name (auto-names on pick)"
              autoFocus
            />
            <div className="flex items-center gap-2 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950">
              <input
                type="color"
                value={newHex}
                onChange={e => {
                  const hex = e.target.value.toUpperCase();
                  setNewHex(hex);
                  const identified = getColorNameFromHex(hex);
                  setNewName(identified);
                  setTempColorName(identified);
                }}
                className="size-7 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <span className="text-xs font-mono font-semibold">{newHex.toUpperCase()}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="size-3.5 animate-spin mr-1" />} Save Color
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};