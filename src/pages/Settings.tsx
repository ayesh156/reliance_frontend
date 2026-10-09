import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { Building2, Receipt, Palette, Lock, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { get, post, patch, put } from '../lib/api';
import { toast } from 'react-toastify';
import { Badge } from '../components/ui/badge';
import { AccessDenied } from '../components/AccessDenied';
import {
  Users, UserPlus, Shield, ShieldCheck, CheckCircle2,
  XCircle, Loader2, RefreshCw, Briefcase, ShoppingBag, ShieldAlert, X,
  MoreVertical, ChevronLeft, ChevronRight, KeyRound, Power,
  Eye, EyeOff, Sparkles, Key
} from 'lucide-react';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { Button } from '../components/ui/button';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'CASHIER' | 'REP';
  active: boolean;
  createdAt: string;
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  ADMIN: { label: 'Administrator', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  STAFF: { label: 'Back Office Staff', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  CASHIER: { label: 'POS Cashier', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  REP: { label: 'Wholesale Sales Rep', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
};

const ROLE_OPTIONS: SearchableSelectOption[] = [
  { value: 'STAFF', label: 'Back Office Staff (Inventory & Stock)', icon: <Briefcase className="w-3.5 h-3.5 text-blue-500" /> },
  { value: 'CASHIER', label: 'POS Cashier (Retail Billing Only)', icon: <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" /> },
  { value: 'REP', label: 'Sales Rep (Wholesale Orders Only)', icon: <Users className="w-3.5 h-3.5 text-amber-500" /> },
  { value: 'ADMIN', label: 'System Administrator (Full Control)', icon: <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> },
];

export const Settings: React.FC = () => {
  const { user: currentUser, isAdmin, isRep } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<string>(isAdmin && !isRep ? 'staff' : 'general');

  useEffect(() => {
    if (isRep && activeTab === 'staff') {
      setActiveTab('general');
    }
  }, [isRep, activeTab]);
  const [storeSettings, setStoreSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [formData, setFormData] = useState({
    STORE_NAME: 'Reliance Retail & Wholesale Suite',
    STORE_PHONE: '0771234567',
    STORE_ADDRESS: 'No. 123, Main Street, Colombo, Sri Lanka',
    CURRENCY_SYMBOL: 'Rs.',
    RECEIPT_HEADER: 'Welcome to Reliance Retail & Wholesale',
    RECEIPT_FOOTER: 'Thank you for shopping with us!',
    THERMAL_PAPER_WIDTH: '80mm',
    STORE_TAGLINE: 'Quality Garments & Fabrics Wholesale',
    WHATSAPP_SUPPORT: '+94771234567',
  });

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State (Testing Limit = 2)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STAFF');

  // Edit User Credentials Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'STAFF' | 'CASHIER' | 'REP'>('STAFF');
  const [editPassword, setEditPassword] = useState('');
  const [showPlainPassword, setShowPlainPassword] = useState(false);
  const [updatingCredentials, setUpdatingCredentials] = useState(false);

  const handleOpenEditModal = (targetUser: StaffUser) => {
    setEditingUser(targetUser);
    setEditName(targetUser.name);
    setEditEmail(targetUser.email || '');
    setEditRole(targetUser.role);
    setEditPassword('');
    setShowPlainPassword(false);
    setShowEditModal(true);
  };

  const handleGenerateStrongPassword = () => {
    const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijkmnopqrstuvwxyz';
    const numberChars = '23456789';
    const symbolChars = '!@#$%^&*';

    let pwd = '';
    pwd += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
    pwd += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
    pwd += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
    pwd += symbolChars.charAt(Math.floor(Math.random() * symbolChars.length));

    const allChars = uppercaseChars + lowercaseChars + numberChars + symbolChars;
    for (let i = 0; i < 8; i++) {
      pwd += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    pwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');
    setEditPassword(pwd);
    setShowPlainPassword(true);
    toast.info('Strong password generated!');
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const cleanName = editName.trim();
    const cleanEmail = editEmail.trim().toLowerCase();
    const cleanPassword = editPassword.trim();

    if (!cleanName) {
      toast.error('Please enter the full name');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Please provide a valid email address');
      return;
    }

    if (cleanPassword && cleanPassword.length < 6) {
      toast.error('New password must be at least 6 characters in length');
      return;
    }

    setUpdatingCredentials(true);
    try {
      const payload: Record<string, any> = {
        name: cleanName,
        email: cleanEmail,
        role: editRole,
      };
      if (cleanPassword) {
        payload.password = cleanPassword;
      }

      await put(`/users/${editingUser.id}/admin-override`, payload);
      toast.success(`User credentials for ${cleanName} updated successfully!`);
      setShowEditModal(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update credentials');
    } finally {
      setUpdatingCredentials(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await get<StaffUser[]>('/auth/users');
      setUsers(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch staff members');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const data = await get<Record<string, string>>('/settings');
      if (data && typeof data === 'object') {
        setStoreSettings(data);
        setFormData(prev => ({ ...prev, ...data }));
      }
    } catch (err: any) {
      console.error('Failed to load store settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only administrators can update store settings');
      return;
    }
    try {
      setSavingSettings(true);
      const entries = Object.entries(formData).map(([key, value]) => ({ key, value }));
      await put('/settings', entries);
      toast.success('Store settings saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName) {
      toast.error('Please enter the full name');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Please provide a valid email address');
      return;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(cleanPassword)) {
      toast.error('Password must be at least 8 characters with letters & numbers');
      return;
    }

    setSubmitting(true);
    try {
      await post('/auth/users', {
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        role,
      });

      toast.success('Staff member created successfully!');
      setName('');
      setEmail('');
      setPassword('');
      setRole('STAFF');
      setShowAddModal(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (targetUser: StaffUser) => {
    if (targetUser.id === currentUser?.id) {
      toast.error('You cannot deactivate your own account.');
      return;
    }

    try {
      await patch(`/auth/users/${targetUser.id}`, {
        active: !targetUser.active,
      });
      toast.success(`User ${targetUser.active ? 'deactivated' : 'activated'} successfully.`);
      setUsers(prev =>
        prev.map(u => (u.id === targetUser.id ? { ...u, active: !u.active } : u))
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user status');
    }
  };

  // Pagination Math
  const totalPages = Math.ceil(users.length / itemsPerPage) || 1;
  const paginatedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const cardClass = `rounded-2xl border p-3.5 sm:p-6 transition-colors ${dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
    }`;

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight break-words ${dark ? 'text-white' : 'text-slate-900'}`}>
            {activeTab === 'staff' && isAdmin ? 'Staff & Access Control' : 'Store & System Settings'}
          </h1>
          <p className={`text-xs mt-1 leading-relaxed ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            {activeTab === 'staff' && isAdmin
              ? 'Manage system roles, permissions, and staff credentials'
              : 'Configure business identity, POS preferences, and store configurations'}
          </p>
        </div>
        {isAdmin && activeTab === 'staff' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchUsers()}
              className={`p-2.5 rounded-xl border transition-all ${dark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              title="Refresh Directory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 min-h-[38px]"
            >
              <UserPlus className="w-4 h-4" />
              Add Staff Member
            </Button>
          </div>
        )}
      </div>

      {/* Settings Tabs Structure */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4 mt-3">
        {/* Mobile Navigation Dropdown (< 640px) */}
        <div className="block sm:hidden w-full">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full h-11 px-3 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 focus:ring-emerald-500">
              <div className="flex items-center gap-2 truncate">
                {activeTab === 'staff' && <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                {activeTab === 'general' && <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                {activeTab === 'pos' && <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                {activeTab === 'storefront' && <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                <span className="font-semibold text-slate-800 dark:text-zinc-100 truncate">
                  {activeTab === 'staff' && 'Staff & Access Control'}
                  {activeTab === 'general' && 'Company Profile'}
                  {activeTab === 'pos' && 'POS & Thermal'}
                  {activeTab === 'storefront' && 'Storefront'}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
              {isAdmin && !isRep && (
                <SelectItem value="staff">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                    <span>Staff &amp; Access Control</span>
                  </div>
                </SelectItem>
              )}
              <SelectItem value="general">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>Company Profile</span>
                </div>
              </SelectItem>
              <SelectItem value="pos">
                <div className="flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>POS &amp; Thermal</span>
                </div>
              </SelectItem>
              <SelectItem value="storefront">
                <div className="flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>Storefront</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tablet & Desktop Horizontal Tabs (sm:flex) */}
        <div className="hidden sm:block w-full">
          <TabsList className="h-auto flex overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap gap-2 p-1 bg-slate-100 dark:bg-zinc-900/80 rounded-xl border border-slate-200 dark:border-zinc-800 w-auto justify-start">
            {isAdmin && !isRep && (
              <TabsTrigger value="staff" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold shrink-0 min-h-[38px] rounded-lg">
                <Users className="w-3.5 h-3.5" /> Staff &amp; Access
              </TabsTrigger>
            )}
            <TabsTrigger value="general" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold shrink-0 min-h-[38px] rounded-lg">
              <Building2 className="w-3.5 h-3.5" /> Company Profile
            </TabsTrigger>
            <TabsTrigger value="pos" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold shrink-0 min-h-[38px] rounded-lg">
              <Receipt className="w-3.5 h-3.5" /> POS &amp; Thermal
            </TabsTrigger>
            <TabsTrigger value="storefront" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold shrink-0 min-h-[38px] rounded-lg">
              <Palette className="w-3.5 h-3.5" /> Storefront
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB 1: Staff & Access Control (Active) ── */}
        {!isRep && isAdmin && (
          <TabsContent value="staff" className="space-y-4">
          {!isAdmin ? (
            <AccessDenied requiredRole="ADMIN" />
          ) : (
            <div className={cardClass}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Users className={`w-4 h-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`} />
                <h2 className={`text-sm font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                  Team Members ({users.length})
                </h2>
              </div>
              <span className={`text-xs ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                Page {currentPage} of {totalPages}
              </span>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <p className="text-xs text-slate-500 dark:text-zinc-500">Loading staff directory…</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role / Access</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map(u => {
                      const roleConfig = ROLE_BADGES[u.role] || { label: u.role, color: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300' };
                      const isSelf = u.id === currentUser?.id;

                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            {/* Interactive Clickable Member: Direct Admin User Credential Management trigger */}
                            <div 
                              onClick={() => handleOpenEditModal(u)}
                              className="cursor-pointer group/staff select-none inline-block"
                              title="Click to edit user credentials & access"
                            >
                              <div className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 group-hover/staff:text-indigo-600 dark:group-hover/staff:text-indigo-400 group-hover/staff:underline transition-colors">
                                {u.name}
                                {isSelf && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">{u.email}</div>
                            </div>
                          </TableCell>


                          <TableCell>
                            <Badge
                              variant={
                                u.role === 'ADMIN'
                                  ? 'destructive'
                                  : u.role === 'REP'
                                    ? 'warning'
                                    : u.role === 'CASHIER'
                                      ? 'success'
                                      : 'info'
                              }
                            >
                              {u.role === 'ADMIN'
                                ? 'Administrator'
                                : u.role === 'REP'
                                  ? 'Sales Rep'
                                  : u.role === 'CASHIER'
                                    ? 'POS Cashier'
                                    : 'Staff'}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            {u.active ? (
                              <Badge variant="success" dot className="font-semibold">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="destructive" dot className="font-semibold">
                                Deactivated
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-zinc-400 text-[11px] font-mono">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {/* Vertical 3-dots action trigger aligned with Product & Customer pages */}
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                                  <MoreVertical className="w-4 h-4" />
                                  <span className="sr-only">Open actions menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => handleOpenEditModal(u)}
                                >
                                  <KeyRound className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> Edit Credentials
                                </DropdownMenuItem>
                                {!isSelf && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleToggleActive(u)}
                                      variant={u.active ? "destructive" : "default"}
                                    >
                                      <Power className="w-3.5 h-3.5 mr-1.5" />
                                      {u.active ? 'Deactivate User' : 'Activate User'}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
                  <span className="text-slate-500 dark:text-zinc-400">
                    Showing {paginatedUsers.length} of {users.length} members
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="gap-1 px-2.5"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </Button>
                    <div className="px-2.5 font-semibold text-slate-700 dark:text-zinc-300">
                      {currentPage} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="gap-1 px-2.5"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
          )}
        </TabsContent>
      )}

        {/* ── TAB 2: Company Profile ── */}
        <TabsContent value="general" className="space-y-4">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Building2 className={`w-4 h-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`} />
                <h2 className={`text-sm font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                  Company Profile &amp; General Configuration
                </h2>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {isAdmin ? 'Editable' : 'Read-Only (Scoped Access)'}
              </Badge>
            </div>

            {!isAdmin && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs mb-4">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Read-Only Mode:</strong> Scoped view for staff and representatives. System Administrators have write permissions.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveStoreSettings} className="space-y-4 text-xs">
              <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2 lg:gap-4">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Store / Business Name
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.STORE_NAME}
                    onChange={e => setFormData(prev => ({ ...prev, STORE_NAME: e.target.value }))}
                    placeholder="e.g. Reliance Garments"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Official Contact Phone
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.STORE_PHONE}
                    onChange={e => setFormData(prev => ({ ...prev, STORE_PHONE: e.target.value }))}
                    placeholder="e.g. 0771234567"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Physical Store Address
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.STORE_ADDRESS}
                    onChange={e => setFormData(prev => ({ ...prev, STORE_ADDRESS: e.target.value }))}
                    placeholder="e.g. No. 123, Main Street, Colombo, Sri Lanka"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Currency Symbol
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.CURRENCY_SYMBOL}
                    onChange={e => setFormData(prev => ({ ...prev, CURRENCY_SYMBOL: e.target.value }))}
                    placeholder="e.g. Rs."
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex justify-end">
                  <Button type="submit" disabled={savingSettings} className="flex items-center gap-1.5">
                    {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {savingSettings ? 'Saving...' : 'Save Company Profile'}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </TabsContent>

        {/* ── TAB 3: POS & Thermal ── */}
        <TabsContent value="pos" className="space-y-4">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Receipt className={`w-4 h-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`} />
                <h2 className={`text-sm font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                  POS Terminal &amp; Thermal Printing Preferences
                </h2>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {isAdmin ? 'Editable' : 'Read-Only (Scoped Access)'}
              </Badge>
            </div>

            {!isAdmin && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs mb-4">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Read-Only Mode:</strong> Scoped view for staff and representatives. System Administrators have write permissions.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveStoreSettings} className="space-y-4 text-xs">
              <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2 lg:gap-4">
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Receipt Header Greeting Note
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.RECEIPT_HEADER}
                    onChange={e => setFormData(prev => ({ ...prev, RECEIPT_HEADER: e.target.value }))}
                    placeholder="e.g. Welcome to Reliance Retail & Wholesale"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Receipt Footer Note
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.RECEIPT_FOOTER}
                    onChange={e => setFormData(prev => ({ ...prev, RECEIPT_FOOTER: e.target.value }))}
                    placeholder="e.g. Thank you for shopping with us!"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Default Thermal Paper Format
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.THERMAL_PAPER_WIDTH}
                    onChange={e => setFormData(prev => ({ ...prev, THERMAL_PAPER_WIDTH: e.target.value }))}
                    placeholder="e.g. 80mm"
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex justify-end">
                  <Button type="submit" disabled={savingSettings} className="flex items-center gap-1.5">
                    {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {savingSettings ? 'Saving...' : 'Save POS Preferences'}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </TabsContent>

        {/* ── TAB 4: Storefront & Branding ── */}
        <TabsContent value="storefront" className="space-y-4">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Palette className={`w-4 h-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`} />
                <h2 className={`text-sm font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                  Storefront &amp; WhatsApp Integration
                </h2>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {isAdmin ? 'Editable' : 'Read-Only (Scoped Access)'}
              </Badge>
            </div>

            {!isAdmin && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs mb-4">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Read-Only Mode:</strong> Scoped view for staff and representatives. System Administrators have write permissions.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveStoreSettings} className="space-y-4 text-xs">
              <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2 lg:gap-4">
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Store Tagline
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.STORE_TAGLINE}
                    onChange={e => setFormData(prev => ({ ...prev, STORE_TAGLINE: e.target.value }))}
                    placeholder="e.g. Quality Garments & Fabrics Wholesale"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    WhatsApp Customer Support Contact
                  </label>
                  <Input
                    type="text"
                    disabled={!isAdmin}
                    value={formData.WHATSAPP_SUPPORT}
                    onChange={e => setFormData(prev => ({ ...prev, WHATSAPP_SUPPORT: e.target.value }))}
                    placeholder="e.g. +94771234567"
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex justify-end">
                  <Button type="submit" disabled={savingSettings} className="flex items-center gap-1.5">
                    {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {savingSettings ? 'Saving...' : 'Save Storefront Settings'}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Staff Modal */}
      {/* Add Staff Modal (Shadcn Dialog) */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <DialogTitle>Create New Staff User</DialogTitle>
            </div>
            <DialogDescription>
              Add a team member and assign their system role and access level.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                Full Name *
              </label>
              <Input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sunil Perera"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                Email Address *
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. sunil@reliance.lk"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                Initial Password *
              </label>
              <Input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 chars (1 letter & 1 number)"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                Assign Role *
              </label>
              <SearchableSelect
                options={ROLE_OPTIONS}
                value={role}
                onValueChange={setRole}
                placeholder="Select a role..."
                searchPlaceholder="Search role..."
                dark={dark}
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                {submitting ? 'Creating…' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Credentials Modal (Direct Admin Credential Management) */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-500" />
              <DialogTitle>Edit User Credentials &amp; Access</DialogTitle>
            </div>
            <DialogDescription>
              Direct administrator override for <strong className="text-slate-800 dark:text-zinc-200">{editingUser?.name}</strong>. Directly update account details, role permissions, or overwrite passwords.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateCredentials} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                Full Name *
              </label>
              <Input
                type="text"
                required
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="e.g. Sunil Perera"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                Email Address *
              </label>
              <Input
                type="email"
                required
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="e.g. sunil@reliance.lk"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                System Role &amp; Access Level *
              </label>
              <SearchableSelect
                options={ROLE_OPTIONS}
                value={editRole}
                onValueChange={(val: string) => setEditRole(val as any)}
                placeholder="Select a role..."
                searchPlaceholder="Search role..."
                dark={dark}
              />
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center justify-between">
                <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                  Set New Password (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateStrongPassword}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Generate Strong Password
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showPlainPassword ? 'text' : 'password'}
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep unchanged (min 6-8 chars)"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPlainPassword(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                  title={showPlainPassword ? 'Hide password' : 'Show password'}
                >
                  {showPlainPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                Overwrites password directly without requiring previous credentials.
              </p>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updatingCredentials} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {updatingCredentials && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                {updatingCredentials ? 'Saving Changes…' : 'Save Credentials'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};