import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
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
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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

  const filtered = colors.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
  const selectedColor = colors.find(c => c.name.toLowerCase() === value.toLowerCase());

  // Outside click is cleanly handled by the transparent backdrop in Portal

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
      onChange(created.name);
      setModalOpen(false);
      setNewName('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create color');
    } finally {
      setCreating(false);
    }
  };

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 180 });

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 200),
      });
    }
    setOpen(!open);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-left shadow-sm"
      >
        <div className="flex items-center gap-1.5 truncate">
          {selectedColor?.hexCode && (
            <span
              className="size-3 rounded-full border border-black/10 shrink-0"
              style={{ backgroundColor: selectedColor.hexCode }}
            />
          )}
          <span className="truncate font-medium">{value || 'Select Color'}</span>
        </div>
        <ChevronsUpDown className="size-3 text-zinc-400 shrink-0" />
      </button>

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
            className="z-[99999] rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100"
          >
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search color..."
              className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none mb-1 text-slate-900 dark:text-white"
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(c.name);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-800 dark:text-zinc-200 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full border border-black/10" style={{ backgroundColor: c.hexCode || '#999' }} />
                    <span>{c.name}</span>
                  </div>
                  {value === c.name && <Check className="size-3 text-emerald-500" />}
                </button>
              ))}
            </div>

            <button
            type="button"
            onClick={() => {
              setOpen(false); // ⭐ Dropdown Menu එක වසා දමයි
              const initialName = query.trim() || getColorNameFromHex(newHex);
              setNewName(initialName);
              setTempColorName(initialName);
              setModalOpen(true);
            }}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-1 pt-1.5 border-t border-slate-100 dark:border-zinc-800 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md font-medium cursor-pointer"
          >
            <Plus className="size-3" /> Quick Add Color
          </button>
          </div>
        </>,
        document.body
      )}

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
                setNewName(''); // Click කළ විට clear වේ
              }}
              onBlur={() => {
                if (!newName.trim()) {
                  setNewName(tempColorName); // අලුත් නමක් නොලියා ඉවත් වුවහොත් restore වේ
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
                  setNewName(identified); // Auto Color Name Resolver
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