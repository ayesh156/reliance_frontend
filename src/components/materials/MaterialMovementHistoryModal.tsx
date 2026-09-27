import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { get, del } from '../../lib/api';
import { toast } from 'react-toastify';
import { DatePicker } from '../ui/date-picker';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useTheme } from '../../contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Loader2,
  History,
  ArrowDownRight,
  ArrowUpRight,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Edit2,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import type { RawMaterialItem } from '../../pages/RawMaterialItemsPage';
import { MaterialStockActionModal } from './MaterialStockActionModal';

interface MovementRecord {
  id: number;
  movementType: 'STOCK_IN' | 'PRODUCTION_USE' | 'SCRAP_RETURN' | 'DAMAGE_WASTE' | 'AUDIT_ADJUST';
  quantity: number;
  previousStock: number;
  newStock: number;
  reference: string | null;
  createdAt: string;
}

interface MaterialMovementHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: RawMaterialItem | null;
  onSuccess?: () => void; // ⭐ Edit/Delete වූ විට ප්‍රධාන Table එක සහ Balance එක Refresh කිරීමට
}

/**
 * Modal to display historical stock deduction and addition ledger with client-side pagination and date filter
 */
export const MaterialMovementHistoryModal: React.FC<MaterialMovementHistoryModalProps> = ({
  isOpen,
  onClose,
  material,
  onSuccess,
}) => {
  // Current stock live tracking for instant header update without closing modal
  const [currentAvailableStock, setCurrentAvailableStock] = useState<number>(
    material?.currentStock || 0
  );

  useEffect(() => {
    if (material) {
      setCurrentAvailableStock(material.currentStock);
    }
  }, [material]);
  // Master records array fetched directly from backend
  const [allMovements, setAllMovements] = useState<MovementRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form input states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Active filters applied only when the user clicks "Filter"
  const [activeFilters, setActiveFilters] = useState<{
    startDate: string;
    endDate: string;
    filterType: string;
  }>({
    startDate: '',
    endDate: '',
    filterType: 'ALL',
  });

  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 8;

  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [editingMovement, setEditingMovement] = useState<MovementRecord | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<MovementRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Re-fetch updated material stock balance from backend
  const refreshCurrentStockBalance = async (itemId: number) => {
    try {
      const updatedItem = await get<RawMaterialItem>(`/raw-material-items/${itemId}`);
      if (updatedItem && typeof updatedItem.currentStock === 'number') {
        setCurrentAvailableStock(updatedItem.currentStock);
      }
    } catch {
      // Fallback silently if single fetch fails
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMovement || !material) return;
    try {
      setIsDeleting(true);
      await del(`/raw-material-items/movements/${deletingMovement.id}`);
      toast.success('Movement record deleted and stock safely reverted');
      setDeletingMovement(null);
      fetchAllMovements(material.id);
      refreshCurrentStockBalance(material.id);
      onSuccess?.(); // ⭐ Main inventory page එකේ stock එකද ක්ෂණිකව update වේ
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete movement record');
    } finally {
      setIsDeleting(false);
    }
  };

  const MOVEMENT_TYPE_OPTIONS = [
    { value: 'ALL', label: 'All Types' },
    { value: 'PRODUCTION_USE', label: 'Production Use' },
    { value: 'SCRAP_RETURN', label: 'Scrap Return' },
  ];

  // Fetch all movements once when modal opens
  useEffect(() => {
    if (isOpen && material) {
      setStartDate('');
      setEndDate('');
      setFilterType('ALL');
      setActiveFilters({ startDate: '', endDate: '', filterType: 'ALL' });
      setPage(1);
      fetchAllMovements(material.id);
    }
  }, [isOpen, material?.id]);

  const fetchAllMovements = async (itemId: number) => {
    try {
      setLoading(true);
      // Fetch reconciled movements list
      const data = await get<MovementRecord[]>(`/raw-material-items/${itemId}/movements`);
      const list = Array.isArray(data) ? data : [];
      setAllMovements(list);

      // ⭐ Table එකෙහි ඉහළින්ම ඇති නවතම record එකේ newStock එක නිවැරදි Available Stock එකයි
      if (list.length > 0) {
        setCurrentAvailableStock(list[0].newStock);
      } else {
        refreshCurrentStockBalance(itemId);
      }

      // Main Inventory Table එකද Auto-Reconciliation එකෙන් පසු අලුත් කිරීම
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to load movement records');
      setAllMovements([]);
    } finally {
      setLoading(false);
    }
  };

  // Safe filter submission preventing page reload
  const handleApplyFilter = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActiveFilters({
      startDate,
      endDate,
      filterType,
    });
    setPage(1);
  };

  // Reset filters back to initial state
  const handleResetFilter = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setStartDate('');
    setEndDate('');
    setFilterType('ALL');
    setActiveFilters({
      startDate: '',
      endDate: '',
      filterType: 'ALL',
    });
    setPage(1);
  };

  // Perform client-side filtering
  const filteredMovements = React.useMemo(() => {
    return allMovements.filter((m) => {
      if (activeFilters.filterType !== 'ALL' && m.movementType !== activeFilters.filterType) {
        return false;
      }

      const itemDate = new Date(m.createdAt);
      if (activeFilters.startDate) {
        const start = new Date(activeFilters.startDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
      }

      if (activeFilters.endDate) {
        const end = new Date(activeFilters.endDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }

      return true;
    });
  }, [allMovements, activeFilters]);

  // Compute pagination
  const totalCount = filteredMovements.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Slice active items for the current page view
  const paginatedMovements = React.useMemo(() => {
    const startIdx = (page - 1) * PAGE_SIZE;
    return filteredMovements.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredMovements, page]);

  if (!material) return null;

  const renderBadge = (type: MovementRecord['movementType']) => {
    switch (type) {
      case 'PRODUCTION_USE':
        return (
          <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 gap-1 text-[10px]">
            <ArrowDownRight className="size-3" /> Production Use
          </Badge>
        );
      case 'SCRAP_RETURN':
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 gap-1 text-[10px]">
            <ArrowUpRight className="size-3" /> Scrap Return
          </Badge>
        );
      case 'DAMAGE_WASTE':
        return (
          <Badge className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 gap-1 text-[10px]">
            <AlertOctagon className="size-3" /> Damage / Waste
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {type}
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col p-5">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2">
            <History className="size-5 text-indigo-600" />
            <DialogTitle>Stock Movement & Audit Log</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Item: <strong>{material.name}</strong> ({material.code || 'No Code'}) | Available Stock:{' '}
            <strong className="text-slate-800 dark:text-zinc-200 font-mono">
              {currentAvailableStock} {material.unit}
            </strong>
          </DialogDescription>
        </DialogHeader>

        {/* Date Filter & Type Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-1.5 w-36">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">From:</span>
            <DatePicker
              date={startDate ? new Date(startDate) : undefined}
              onDateChange={(d) => {
                if (!d) {
                  setStartDate('');
                  return;
                }
                const yr = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const dy = String(d.getDate()).padStart(2, '0');
                setStartDate(`${yr}-${mo}-${dy}`);
              }}
              placeholder="Start date"
              className="h-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 w-36">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">To:</span>
            <DatePicker
              date={endDate ? new Date(endDate) : undefined}
              onDateChange={(d) => {
                if (!d) {
                  setEndDate('');
                  return;
                }
                const yr = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const dy = String(d.getDate()).padStart(2, '0');
                setEndDate(`${yr}-${mo}-${dy}`);
              }}
              placeholder="End date"
              className="h-8 text-xs"
            />
          </div>

          {/* ⭐ Shadcn SearchableSelect with 2 Types */}
          <div className="w-40">
            <SearchableSelect
              value={filterType}
              onValueChange={(val) => setFilterType(val)}
              options={MOVEMENT_TYPE_OPTIONS}
              placeholder="Select Type"
              searchPlaceholder="Search type..."
              dark={dark}
              className="h-8"
            />
          </div>

          {/* Apply Filter Button */}
          <Button type="button" size="sm" onClick={handleApplyFilter} className="h-8 text-xs px-3">
            Filter
          </Button>

          {/* Reset Filter Button */}
          {(startDate || endDate || filterType !== 'ALL') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilter}
              className="h-8 text-xs px-2 text-slate-500"
            >
              <RotateCcw className="size-3 mr-1" /> Reset
            </Button>
          )}

          {/* Total logs counter */}
          <div className="ml-auto text-[11px] text-slate-400">
            Total Logs: <strong className="text-slate-700 dark:text-zinc-200">{totalCount}</strong>
          </div>
        </div>

        {/* Movements Table */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Date / Timestamp</TableHead>
                <TableHead className="w-28 text-center">Type</TableHead>
                <TableHead className="w-24 text-right">Quantity</TableHead>
                <TableHead className="w-28 text-right">Stock (Prev → New)</TableHead>
                <TableHead className="min-w-[130px]">Reference Notes</TableHead>
                <TableHead className="w-12 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="size-5 animate-spin mx-auto text-indigo-500" />
                    <span className="text-xs text-slate-400 mt-1 block">Loading logs...</span>
                  </TableCell>
                </TableRow>
              ) : paginatedMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                    No movements found for the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMovements.map((m) => (
                  <TableRow key={m.id} className="text-xs">
                    <TableCell className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-center">{renderBadge(m.movementType)}</TableCell>
                    <TableCell className="text-right font-mono font-bold whitespace-nowrap">
                      {m.movementType === 'PRODUCTION_USE' || m.movementType === 'DAMAGE_WASTE' ? '-' : '+'}
                      {m.quantity} {material.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {m.previousStock} → <span className="font-semibold text-slate-800 dark:text-zinc-200">{m.newStock}</span>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-zinc-400 truncate max-w-[160px]" title={m.reference || ''}>
                      {m.reference || '-'}
                    </TableCell>
                    <TableCell className="text-center p-1">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-slate-500 hover:text-slate-900 dark:hover:text-white mx-auto flex"
                          >
                            <MoreVertical className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 text-xs font-medium">
                          <DropdownMenuItem
                            onClick={() => setEditingMovement(m)}
                            className="gap-2 cursor-pointer text-slate-700 dark:text-zinc-300"
                          >
                            <Edit2 className="size-3.5 text-slate-500" />
                            Edit Record
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => setDeletingMovement(m)}
                            className="gap-2 cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                          >
                            <Trash2 className="size-3.5 text-rose-600" />
                            Delete & Revert
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls Footer */}
        <div className="flex items-center justify-between pt-2 px-1 text-xs">
          <span className="text-slate-400 text-[11px]">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="h-7 px-2 cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="h-7 px-2 cursor-pointer"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(deletingMovement)} onOpenChange={(open) => !open && setDeletingMovement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this movement record. The stock deduction or addition of{' '}
              <strong className="text-slate-900 dark:text-white">
                {deletingMovement?.quantity} {material.unit}
              </strong>{' '}
              will be immediately reversed back to active warehouse stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Reverting...' : 'Delete & Revert Stock'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Movement Modal */}
      {editingMovement && (
        <MaterialStockActionModal
          isOpen={Boolean(editingMovement)}
          onClose={() => setEditingMovement(null)}
          material={material}
          mode={editingMovement.movementType === 'SCRAP_RETURN' ? 'SCRAP_RETURN' : 'DEDUCT'}
          editingMovement={editingMovement}
          onSuccess={() => {
            setEditingMovement(null);
            fetchAllMovements(material.id);
            refreshCurrentStockBalance(material.id);
            onSuccess?.(); // ⭐ Main inventory page එකේ stock එකද ක්ෂණිකව update වේ
          }}
        />
      )}
    </Dialog>
  );
};