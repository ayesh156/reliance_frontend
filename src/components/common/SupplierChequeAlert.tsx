import React, { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { get } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Calendar, ArrowRight, X } from 'lucide-react';

export interface UpcomingSupplierCheque {
  id: string | number;
  supplierName: string;
  poInvoiceNumber: string;
  chequeNumber: string;
  bankName: string;
  amount: number;
  maturityDate: string;
  daysUntilDue: number;
}

/**
 * Technical Specification: Supplier Cheque 2-Day Advance Alert
 * - Target Roles: SUPER_ADMIN, ADMIN, and STAFF only (CASHIER and REP strictly bypassed)
 * - Timezone: Strictly evaluated according to Asia/Colombo (+05:30)
 * - Frequency: Displays once daily on first login/visit. Persists until user explicitly closes it.
 * - Dismissal: Stored in localStorage under `supplier_cheque_alert_closed_${user.id}_${todayYMD_LK}`
 */
export const SupplierChequeAlert: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lastCheckedUserIdRef = useRef<number | string | null>(null);

  useEffect(() => {
    if (!user || !user.id) return;

    // RBAC Guard: Strictly restricted to SUPER_ADMIN, ADMIN, and STAFF
    const role = String(user.role || '').toUpperCase();
    if (!['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role)) {
      return;
    }

    // Resolve current calendar date in Asia/Colombo (+05:30)
    const todayYMD_LK = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const dismissalKey = `supplier_cheque_alert_closed_${user.id}_${todayYMD_LK}`;

    // If dismissed today by this user, do not alert again today
    try {
      if (localStorage.getItem(dismissalKey) === 'true') {
        return;
      }
    } catch {
      // Ignore localStorage read issues
    }

    if (lastCheckedUserIdRef.current === user.id) return;
    lastCheckedUserIdRef.current = user.id;

    const fetchAndAlert = async () => {
      try {
        let upcoming: UpcomingSupplierCheque[] = [];
        try {
          const res = await get<UpcomingSupplierCheque[]>('/raw-materials/upcoming-cheques');
          if (Array.isArray(res)) upcoming = res;
        } catch {
          // Fallback to buy-raw-materials alias endpoint
          try {
            const fallbackRes = await get<UpcomingSupplierCheque[]>('/buy-raw-materials/upcoming-cheques');
            if (Array.isArray(fallbackRes)) upcoming = fallbackRes;
          } catch {
            upcoming = [];
          }
        }

        if (upcoming.length === 0) return;

        const toastId = 'supplier-cheque-due-alert';

        // Render persistent custom toast alert
        toast.warn(
          ({ closeToast }) => (
            <div className="flex flex-col gap-2 p-1 text-slate-800 dark:text-zinc-100 font-sans">
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-200 dark:border-amber-900/50">
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                  <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
                  <span>Supplier Cheques Due ({upcoming.length})</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-tight">
                {upcoming.length === 1
                  ? 'There is 1 supplier cheque maturing within the next 2 days:'
                  : `There are ${upcoming.length} supplier cheques maturing within the next 2 days:`}
              </p>

              {/* Items List */}
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                {upcoming.slice(0, 5).map((chq, i) => {
                  const badgeText =
                    chq.daysUntilDue === 0
                      ? 'Due Today'
                      : chq.daysUntilDue === 1
                      ? 'Due Tomorrow'
                      : 'Due in 2 Days';

                  const badgeClass =
                    chq.daysUntilDue === 0
                      ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                      : chq.daysUntilDue === 1
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      : 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800';

                  return (
                    <div
                      key={chq.id || i}
                      className="p-1.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 text-[11px] flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold truncate max-w-[150px] text-slate-800 dark:text-zinc-200">
                          {chq.supplierName}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 font-mono text-[10px]">
                        <span>Chq #{chq.chequeNumber || 'N/A'}</span>
                        <span className="font-bold text-slate-900 dark:text-zinc-100">
                          Rs. {Number(chq.amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[9.5px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                        <Calendar className="size-2.5" />
                        <span>Maturity: {chq.maturityDate}</span>
                        {chq.poInvoiceNumber && (
                          <span className="truncate">({chq.poInvoiceNumber})</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {upcoming.length > 5 && (
                  <span className="text-[10px] text-slate-400 italic text-center">
                    +{upcoming.length - 5} more upcoming cheques
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-800 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    closeToast?.();
                    navigate('/system/buy-raw-materials');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  <span>View Purchases</span>
                  <ArrowRight className="size-3" />
                </button>

                <button
                  type="button"
                  onClick={() => closeToast?.()}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded cursor-pointer transition-colors"
                >
                  Dismiss for Today
                </button>
              </div>
            </div>
          ),
          {
            toastId,
            autoClose: false,
            closeOnClick: false,
            draggable: false,
            closeButton: true,
            className: 'border-l-4 border-l-amber-500 shadow-xl',
            onClose: () => {
              // Persist dismissal for today only when user actively closes it
              try {
                localStorage.setItem(dismissalKey, 'true');
              } catch (e) {
                console.warn('Failed to save dismissal key:', e);
              }
            },
          }
        );
      } catch (err) {
        console.warn('Failed to query upcoming supplier cheques:', err);
      }
    };

    fetchAndAlert();
  }, [user, navigate]);

  return null;
};

export default SupplierChequeAlert;
