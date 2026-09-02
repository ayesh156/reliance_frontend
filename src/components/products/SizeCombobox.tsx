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
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const filtered = sizes.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  // Outside click is cleanly handled by the transparent backdrop in Portal

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await post<SizeItem>('/attributes/sizes', { name: newName.trim().toUpperCase() });
      toast.success(`Size "${created.name}" created!`);
      onSizeCreated(created);
      onChange(created.name);
      setModalOpen(false);
      setNewName('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create size');
    } finally {
      setCreating(false);
    }
  };

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 160 });

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 180),
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
        <span className="truncate font-medium">{value || 'Select Size'}</span>
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
              placeholder="Search size..."
              className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none mb-1 text-slate-900 dark:text-white"
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filtered.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(s.name);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-800 dark:text-zinc-200 cursor-pointer"
                >
                  <span className="font-semibold">{s.name}</span>
                  {value === s.name && <Check className="size-3 text-emerald-500" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false); // ⭐ Dropdown Menu එක වසා දමයි
                setNewName(query.trim().toUpperCase());
                setModalOpen(true);
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-1 pt-1.5 border-t border-slate-100 dark:border-zinc-800 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md font-medium cursor-pointer"
            >
              <Plus className="size-3" /> Quick Add Size
            </button>
          </div>
        </>,
        document.body
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle>Add New Garment Size</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. XXL, 34, FREE"
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