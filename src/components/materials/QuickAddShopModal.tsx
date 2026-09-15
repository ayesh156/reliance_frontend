import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { post } from '../../lib/api';
import { toast } from 'react-toastify';
import { isValidSriLankanPhone } from '../../lib/validators';
import { Building2, Loader2 } from 'lucide-react';

interface QuickAddShopModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShopCreated: (shop: { id: number; name: string }) => void;
}

export const QuickAddShopModal: React.FC<QuickAddShopModalProps> = ({
  open,
  onOpenChange,
  onShopCreated,
}) => {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Supplier shop name is required');
      return;
    }
    if (phone.trim() && !isValidSriLankanPhone(phone.trim())) {
      toast.error('Invalid phone number format');
      return;
    }

    setLoading(true);
    try {
      const created = await post<any>('/raw-material-shops', {
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });

      toast.success(`Supplier "${created.name}" registered!`);
      onShopCreated({ id: created.id, name: created.name });
      onOpenChange(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setAddress('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to register supplier shop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Building2 className="size-4 text-indigo-600" /> Quick Add Supplier Shop
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Shop Name *</label>
            <Input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Modern Fabrics"
              className="h-9 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Contact Person</label>
              <Input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Sunil"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Phone Number</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Shop Address</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address / Town"
              className="h-9 text-xs"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
              {loading && <Loader2 className="size-3.5 animate-spin mr-1.5" />} Save Supplier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};