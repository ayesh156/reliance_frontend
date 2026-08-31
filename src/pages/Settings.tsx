import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { get, post, patch } from '../lib/api';
import { toast } from 'react-toastify';
import { Badge } from '../components/ui/badge';
import { 
  Users, UserPlus, Shield, ShieldCheck, CheckCircle2, 
  XCircle, Loader2, RefreshCw, Briefcase, ShoppingBag, ShieldAlert, X,
  MoreHorizontal, ChevronLeft, ChevronRight, KeyRound, Power
} from 'lucide-react';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/SearchableSelect';
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
  const { user: currentUser, isAdmin } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State (Testing Limit = 2)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // ⭐ මෙතැනින් පිටුවකට පෙන්වන ප්‍රමාණය වෙනස් කළ හැක

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STAFF');

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  const cardClass = `rounded-2xl border p-5 sm:p-6 transition-colors ${
    dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
  }`;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-200">Access Restricted</h2>
        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
          Only System Administrators have permissions to view and manage staff accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
            Staff &amp; Access Control
          </h1>
          <p className={`text-xs mt-1 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            Manage system roles, permissions, and staff credentials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchUsers()}
            className={`p-2.5 rounded-xl border transition-all ${
              dark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* Staff Table Card with Shadcn Primitives */}
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
                        <div className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                          {u.name}
                          {isSelf && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">{u.email}</div>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                              <span className="sr-only">Open actions menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => toast.info(`Password reset requested for ${u.name}`)}
                            >
                              <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset Password
                            </DropdownMenuItem>
                            {!isSelf && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleToggleActive(u)}
                                  variant={u.active ? "destructive" : "default"}
                                >
                                  <Power className="w-3.5 h-3.5 mr-1" />
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

      {/* Add Staff Modal */}
      {showAddModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className={`relative border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 ${
                dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className={`flex items-center justify-between pb-3 border-b ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-sm font-semibold">Create New Staff User</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} noValidate className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium mb-1 text-slate-700 dark:text-zinc-300">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Sunil Perera"
                    className={`w-full px-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      dark
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-slate-700 dark:text-zinc-300">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. sunil@reliance.lk"
                    className={`w-full px-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      dark
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-slate-700 dark:text-zinc-300">Initial Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 chars (1 letter & 1 number)"
                    className={`w-full px-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      dark
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-slate-700 dark:text-zinc-300">Assign Role</label>
                  <SearchableSelect
                    options={ROLE_OPTIONS}
                    value={role}
                    onValueChange={setRole}
                    placeholder="Select a role..."
                    searchPlaceholder="Search role..."
                    dark={dark}
                  />
                </div>

                <div className={`pt-3 flex items-center justify-end gap-2 border-t ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {submitting ? 'Creating…' : 'Create Account'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};