import React, { useState, useEffect, useMemo } from 'react';
import { startOfYear, endOfYear, startOfDay, endOfDay, format } from 'date-fns';
import { get, downloadBlob } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { DateRangePicker, type DateRange } from '../components/ui/date-range-picker';
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/searchable-select';
import { TooltipSimple } from '../components/ui/tooltip';
import { toast } from 'react-toastify';
import { generateCustomerDuesPdf } from '../utils/customerDuesPdf';
import { generateMaterialProductionPdf, generateGarmentProductionPdf, matchProductionStage } from '../utils/reportPdf';
import { getRoleBadgeStyle } from './InvoicesPage';
import { formatQty } from '../lib/utils';
import { FinancialAuditModal, type FinancialMetricFocus } from '../components/reports/FinancialAuditModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/table';
import { getProductImageUrl } from '../lib/utils';
import { BatchActivityTimeline } from './CuttingListPage';
import {
  Download,
  Loader2,
  Calculator,
  Search,
  RotateCcw,
  Boxes,
  ShoppingBag,
  Factory,
  Building2,
  FileEdit,
  TrendingUp,
  Receipt,
  Layers,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Printer,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  Scissors,
  Shirt,
  Package,
  Clock,
  CheckCircle2,
  ArrowRight,
  Eye,
  Check,
  BarChart3,
  Sparkles,
  Droplets,
  PackageCheck,
  User,
} from 'lucide-react';
import { CustomerPreviewModal } from '../components/customers/CustomerPreviewModal';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

type ModuleKey =
  | 'sales'
  | 'returns'
  | 'inventory'
  | 'products'
  | 'materials'
  | 'production'
  | 'suppliers'
  | 'audit'
  | 'cheques';

type PresetKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'next_year' | 'custom';

interface TabItem {
  key: ModuleKey;
  label: string;
  icon: React.ElementType;
  description: string;
}

const MODULE_TABS: TabItem[] = [
  { key: 'sales', label: 'Sales & Invoices', icon: Receipt, description: 'Revenue, payment splits, discounts, and customer credit accumulation' },
  { key: 'cheques', label: 'Cheque Ledger & Forecast', icon: FileText, description: 'Received & realized cheques, upcoming maturities, realization alerts, and bounce rates' },
  { key: 'returns', label: 'Returns & Restock', icon: RotateCcw, description: 'Restocked quantities, refund reasons, cash vs credit adjustments' },
  { key: 'inventory', label: 'Inventory & Valuation', icon: Boxes, description: 'Warehouse stock levels, cost vs retail valuation, low-stock warnings' },
  { key: 'products', label: 'Products & SKUs', icon: ShoppingBag, description: 'Fast/slow moving garment SKUs and category sales distribution' },
  { key: 'materials', label: 'Raw Materials Ledger', icon: Layers, description: 'Fabric rolls/yards, weighted average cost, scrap and waste logs' },
  { key: 'production', label: 'Garment Production', icon: Factory, description: 'Production batches, target vs yield efficiency, material consumption' },
  { key: 'suppliers', label: 'Suppliers & GRN', icon: Building2, description: 'Inward goods received notes, purchase totals, and outstanding debt' },
  { key: 'audit', label: 'Invoice Modifications', icon: FileEdit, description: 'Modified invoice logs, cashier edit frequency, audit trail reconciliations' },
];

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const isRep = user?.role === 'REP';
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const [activeModule, setActiveModule] = useState<ModuleKey>('sales');
  const [activePreset, setActivePreset] = useState<PresetKey>('monthly');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [showCharts, setShowCharts] = useState<boolean>(true);

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingActivePdf, setDownloadingActivePdf] = useState<boolean>(false);
  const [downloadingConsolidatedPdf, setDownloadingConsolidatedPdf] = useState<boolean>(false);
  const [downloadingFinancialAuditPdf, setDownloadingFinancialAuditPdf] = useState<boolean>(false);
  const [downloadingCustomerDuesPdf, setDownloadingCustomerDuesPdf] = useState<boolean>(false);
  const [downloadingMaterialPdf, setDownloadingMaterialPdf] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeChequeTab, setActiveChequeTab] = useState<'PENDING' | 'REALIZED' | 'BOUNCED' | 'ALL'>('PENDING');

  // User / Sales Rep Filter & Staff Directory
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [staffUsers, setStaffUsers] = useState<Array<{ id: number; name: string; role?: string; email?: string }>>([]);

  // Quick Customer Profile Preview Modal State
  const [previewCustomer, setPreviewCustomer] = useState<any>(null);
  const [previewCustomerModalOpen, setPreviewCustomerModalOpen] = useState<boolean>(false);

  // Fetch Staff / Sales Reps for report filtering
  useEffect(() => {
    get<any[]>('/users')
      .then((data) => setStaffUsers(Array.isArray(data) ? data : []))
      .catch(() => {
        get<any[]>('/sales-persons')
          .then((data) => setStaffUsers(Array.isArray(data) ? data : []))
          .catch(() => {});
      });
  }, []);

  const userSelectOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Users / Reps' },
    ...staffUsers
      .filter((u) => u.role !== 'SUPER_ADMIN' && !String(u.name || '').toLowerCase().includes('ayesh'))
      .map((u) => ({
        value: String(u.id),
        label: `${u.name} (${u.role || 'STAFF'})`,
      })),
  ], [staffUsers]);

  // ⭐ Interactive Financial Breakdown Audit Modal State
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
  const [auditFocusMetric, setAuditFocusMetric] = useState<FinancialMetricFocus>('grossRevenue');

  // ⭐ Interactive Production Batch Summary Modal State
  const [selectedProductionBatch, setSelectedProductionBatch] = useState<any | null>(null);
  const [isProductionBatchModalOpen, setIsProductionBatchModalOpen] = useState<boolean>(false);
  const [productionStageFilter, setProductionStageFilter] = useState<string>('ALL STAGES');

  const handleOpenAudit = (metric: FinancialMetricFocus) => {
    setAuditFocusMetric(metric);
    setAuditModalOpen(true);
  };

  const visibleTabs = useMemo(() => {
    if (isRep) {
      return MODULE_TABS.filter((t) => t.key === 'sales');
    }
    return MODULE_TABS;
  }, [isRep]);

  useEffect(() => {
    if (isRep && activeModule !== 'sales') {
      setActiveModule('sales');
    }
  }, [isRep, activeModule]);

  // Table Pagination State (15 rows per page)
  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState<number>(1);

  /**
   * Builds query parameters for report filtering.
   * Serializes dates as YYYY-MM-DD in local time to avoid timezone offset shifts across boundaries.
   */
  const buildDateFilterParams = () => {
    const params = new URLSearchParams();
    params.set('preset', activePreset);

    if (selectedUserId !== 'all') {
      params.set('repUserId', selectedUserId);
      params.set('userId', selectedUserId);
    }

    if (activePreset === 'custom' && customRange?.from) {
      const startStr = format(customRange.from, 'yyyy-MM-dd');
      const endStr = format(customRange.to || customRange.from, 'yyyy-MM-dd');
      params.set('startDate', startStr);
      params.set('endDate', endStr);
      params.set('from', startStr);
      params.set('to', endStr);
    } else if (activePreset === 'yearly') {
      const from = customRange?.from || startOfYear(new Date());
      const to = customRange?.to || endOfYear(new Date());
      const fromStr = format(from, 'yyyy-MM-dd');
      const toStr = format(to, 'yyyy-MM-dd');
      params.set('startDate', fromStr);
      params.set('endDate', toStr);
      params.set('from', fromStr);
      params.set('to', toStr);
    } else if (activePreset === 'next_year') {
      const nextYear = new Date().getFullYear() + 1;
      params.set('startDate', `${nextYear}-01-01`);
      params.set('endDate', `${nextYear}-12-31`);
      params.set('from', `${nextYear}-01-01`);
      params.set('to', `${nextYear}-12-31`);
    }
    return params;
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = buildDateFilterParams();
      const res: any = await get(`/reports/${activeModule}/data?${params.toString()}`);
      if (res?.success && res?.data) {
        setReportData(res.data);
      } else {
        setReportData(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch report data');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  // Convert customRange to stable timestamps for clean React dependency tracking
  const customFromTime = customRange?.from ? customRange.from.getTime() : null;
  const customToTime = customRange?.to ? customRange.to.getTime() : null;

  // Auto-reset pagination state to Page 1 whenever switching domain tabs, presets, custom date range, or rep/user filters
  useEffect(() => {
    fetchReport();
    setSearchQuery('');
    setCurrentPage(1);
  }, [activeModule, activePreset, selectedUserId, customFromTime, customToTime]);

  /**
   * Defensive Date Range Change Handler for Reports module.
   * Normalizes selected date boundaries to local start-of-day (00:00:00.000)
   * and end-of-day (23:59:59.999), preventing UTC off-by-one shifts.
   */
  const handleRangeChange = (range: DateRange | undefined) => {
    setCurrentPage(1);
    if (!range || (!range.from && !range.to)) {
      setCustomRange(undefined);
      setActivePreset('monthly');
      return;
    }
    if (range.from) {
      const normalizedFrom = startOfDay(range.from);
      const normalizedTo = range.to ? endOfDay(range.to) : undefined;
      setCustomRange({ from: normalizedFrom, to: normalizedTo });
      setActivePreset('custom');
    }
  };

  const handlePresetSelect = (preset: PresetKey) => {
    setActivePreset(preset);
    if (preset === 'yearly') {
      setCustomRange({
        from: startOfYear(new Date()),
        to: endOfYear(new Date()),
      });
    } else if (preset === 'monthly' || preset === 'daily') {
      setCustomRange(undefined);
    }
    setCurrentPage(1);
  };

  const handleTabSelect = (key: ModuleKey) => {
    setActiveModule(key);
    setCurrentPage(1);
    if (key === 'cheques') {
      setActivePreset('yearly');
      setCustomRange({
        from: startOfYear(new Date()),
        to: endOfYear(new Date()),
      });
    }
  };

  const activeTabItem = useMemo(() => {
    return visibleTabs.find((t) => t.key === activeModule) || visibleTabs[0] || MODULE_TABS[0];
  }, [activeModule, visibleTabs]);

  const moduleSelectOptions = useMemo<SearchableSelectOption[]>(() => {
    return visibleTabs.map((t) => {
      let emoji = '📊';
      if (t.key === 'returns') emoji = '🔄';
      else if (t.key === 'cheques') emoji = '📑';
      else if (t.key === 'inventory') emoji = '📦';
      else if (t.key === 'products') emoji = '🏷️';
      else if (t.key === 'materials') emoji = '🧵';
      else if (t.key === 'production') emoji = '⚙️';
      else if (t.key === 'suppliers') emoji = '🏢';
      else if (t.key === 'audit') emoji = '📝';

      const Icon = t.icon;
      return {
        value: t.key,
        label: `${emoji} ${t.label}`,
        icon: <Icon className="size-4 shrink-0 text-slate-500" />,
      };
    });
  }, [visibleTabs]);

  // 1. Tab-Specific Granular PDF Export (Date Filter Bar)
  const handleDownloadActivePdf = async () => {
    try {
      setDownloadingActivePdf(true);
      const params = buildDateFilterParams();
      const dateTag = reportData?.dateFilter?.startDate
        ? new Date(reportData.dateFilter.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const defaultFilename = `reliance-${activeModule}-report-${dateTag}.pdf`;
      await downloadBlob(`/reports/${activeModule}/pdf?${params.toString()}`, defaultFilename);
      toast.success(`${activeTabItem.label} PDF report exported successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download module PDF report');
    } finally {
      setDownloadingActivePdf(false);
    }
  };

  // 2. Full Consolidated Master Report PDF Export (Top Header Action)
  const handleDownloadConsolidatedPdf = async () => {
    try {
      setDownloadingConsolidatedPdf(true);
      const params = buildDateFilterParams();
      const dateTag = reportData?.dateFilter?.startDate
        ? new Date(reportData.dateFilter.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const defaultFilename = `reliance-consolidated-master-report-${dateTag}.pdf`;
      await downloadBlob(`/reports/consolidated/pdf?${params.toString()}`, defaultFilename);
      toast.success('Official Consolidated Master Audit PDF exported successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download consolidated master report');
    } finally {
      setDownloadingConsolidatedPdf(false);
    }
  };

  // 2b. Dedicated Master Financial Audit & Waterfall PDF Export (Sales Module Specific)
  const handleDownloadFinancialAuditPdf = async () => {
    try {
      setDownloadingFinancialAuditPdf(true);
      const params = buildDateFilterParams();
      const dateTag = reportData?.dateFilter?.startDate
        ? new Date(reportData.dateFilter.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const defaultFilename = `reliance-master-financial-audit-${dateTag}.pdf`;
      await downloadBlob(`/reports/financial-audit/pdf?${params.toString()}`, defaultFilename);
      toast.success('Master Financial Audit PDF exported successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download Master Financial Audit PDF');
    } finally {
      setDownloadingFinancialAuditPdf(false);
    }
  };

  // 3. Outstanding Customer Dues PDF Export (Sales Module Specific)
  const handleDownloadCustomerDuesPdf = async () => {
    try {
      setDownloadingCustomerDuesPdf(true);
      const invoices = reportData?.tableItems || [];
      const dateRangeLabel = formattedSelectedBadge;
      await generateCustomerDuesPdf(invoices, {
        dateRangeLabel,
        generatedBy: user?.name ? `${user.name} (${user.role || 'Staff'})` : undefined,
      });
      toast.success('Customer Dues PDF generated and downloaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate Customer Dues PDF');
    } finally {
      setDownloadingCustomerDuesPdf(false);
    }
  };

  // 4. Date-Range Invoices Excel Sheet Export (Sales Module Specific)
  const handleExportInvoicesExcel = () => {
    try {
      const invoices = reportData?.tableItems || [];
      if (!invoices.length) {
        toast.error('No invoices found to export for the selected date range');
        return;
      }

      const headers = [
        'Invoice No',
        'Date & Time',
        'Type (Retail / Wholesale)',
        'Customer Name',
        'Customer Phone',
        'Customer Address',
        'Items & Quantities',
        'Sub Total (Rs.)',
        'Discount (Rs. / %)',
        'Returned Amount (Rs.)',
        'Net Total (Rs.)',
        'Paid Amount (Rs.)',
        'Payment Method(s)',
        'Balance Due (Rs.)',
        'Sales Rep',
        'Status',
      ];

      let sumSubTotal = 0;
      let sumDiscount = 0;
      let sumReturns = 0;
      let sumNetTotal = 0;
      let sumPaid = 0;
      let sumDue = 0;

      const rows = invoices.map((inv: any) => {
        const sub = Number(inv.subtotal || 0);
        const disc = Number(inv.discount || 0);
        const ret = Number(inv.returnedAmount || 0);
        const net = Number(inv.totalAmount || 0);
        const paid = Number(inv.paidAmount || 0);
        const due = Number(inv.dueAmount || 0);

        sumSubTotal += sub;
        sumDiscount += disc;
        sumReturns += ret;
        sumNetTotal += net;
        sumPaid += paid;
        sumDue += due;

        const dateStr = inv.createdAt
          ? (() => {
              try {
                const d = new Date(inv.createdAt);
                return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              } catch {
                return String(inv.createdAt);
              }
            })()
          : '-';

        const invType = inv.orderType || inv.source || 'Retail';
        const custName = inv.customerName || inv.customer?.name || 'Walk-in Customer';
        const custPhone = inv.customerPhone || inv.customer?.phone || '-';
        const custAddr = inv.customerAddress || inv.customerCity || (inv.customer?.address ? [inv.customer.address, inv.customer.city].filter(Boolean).join(', ') : '-');
        const itemsQty = inv.itemsDetail || (inv.itemCount ? `${inv.itemCount} item(s)` : '-');
        const discLabel = inv.discountType === 'PERCENT' || inv.discountType === 'PERCENTAGE'
          ? `${disc.toFixed(2)} (${inv.discountPercent || ''}%)`
          : disc.toFixed(2);
        const payMethods = inv.paymentMethods || inv.paymentMethod || 'CASH';
        const repName = inv.salesRep || inv.user?.name || '-';
        const invStatus = String(inv.status || 'COMPLETED').toUpperCase();

        return [
          `"${String(inv.invoiceNumber || '').replace(/"/g, '""')}"`,
          `"${String(dateStr).replace(/"/g, '""')}"`,
          `"${String(invType).replace(/"/g, '""')}"`,
          `"${String(custName).replace(/"/g, '""')}"`,
          `"${String(custPhone).replace(/"/g, '""')}"`,
          `"${String(custAddr).replace(/"/g, '""')}"`,
          `"${String(itemsQty).replace(/"/g, '""')}"`,
          sub.toFixed(2),
          `"${discLabel}"`,
          ret.toFixed(2),
          net.toFixed(2),
          paid.toFixed(2),
          `"${String(payMethods).replace(/"/g, '""')}"`,
          due.toFixed(2),
          `"${String(repName).replace(/"/g, '""')}"`,
          `"${String(invStatus).replace(/"/g, '""')}"`,
        ];
      });

      // Bottom Summary / Totals Row summing Sub Total, Discount, Returns, Net Total, Paid Amount, and Balance Due
      const totalsRow = [
        `"TOTALS (${invoices.length} Invoices)"`,
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        sumSubTotal.toFixed(2),
        sumDiscount.toFixed(2),
        sumReturns.toFixed(2),
        sumNetTotal.toFixed(2),
        sumPaid.toFixed(2),
        '""',
        sumDue.toFixed(2),
        '""',
        '""',
      ];

      const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(',')), totalsRow.join(',')].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const startTag = reportData?.dateFilter?.startDate
        ? new Date(reportData.dateFilter.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const endTag = reportData?.dateFilter?.endDate
        ? new Date(reportData.dateFilter.endDate).toISOString().split('T')[0]
        : startTag;

      link.setAttribute('download', `Invoices_Report_${startTag}_to_${endTag}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Invoices Excel exported successfully (${invoices.length} invoices)!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to export Invoices Excel sheet');
    }
  };

  /**
   * Generates executive Material or Garment Production Audit PDF using jspdf-autotable
   * matching the exact monochrome audit layout and date range filtering.
   */
  const handleDownloadMaterialPdf = async () => {
    try {
      setDownloadingMaterialPdf(true);
      if (!reportData) return;
      if (activeModule === 'production') {
        await generateGarmentProductionPdf(
          {
            ...reportData,
            tableItems: filteredRows,
          },
          {
            dateRangeLabel: formattedSelectedBadge,
            generatedBy: user?.name ? `${user.name} (${user.role || 'Staff'})` : undefined,
            stageFilter: productionStageFilter,
          }
        );
        toast.success('Garment Production PDF generated and downloaded successfully!');
      } else {
        await generateMaterialProductionPdf(reportData, {
          dateRangeLabel: formattedSelectedBadge,
          generatedBy: user?.name ? `${user.name} (${user.role || 'Staff'})` : undefined,
        });
        toast.success('Material & Production PDF generated and downloaded successfully!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate PDF');
    } finally {
      setDownloadingMaterialPdf(false);
    }
  };

  /**
   * Exports raw material inventory, cutting consumption vs remaining balance,
   * unit valuation, and scrap/waste logs to Excel/CSV with UTF-8 BOM.
   */
  const handleExportMaterialsExcel = () => {
    try {
      const items = reportData?.tableItems || [];
      if (!items.length) {
        toast.error('No material data found to export for the selected date range');
        return;
      }

      const headers = [
        'Material Code',
        'Material Name',
        'Unit of Measure',
        'Current Stock',
        'Period Cut Qty',
        'Remaining Balance',
        'Scrap / Waste Qty',
        'Unit Cost Avg (Rs.)',
        'Stock Valuation (Rs.)',
        'Alert Threshold',
        'Status',
      ];

      let sumStock = 0;
      let sumCut = 0;
      let sumRemaining = 0;
      let sumWaste = 0;
      let sumValuation = 0;

      const rows = items.map((m: any) => {
        const stock = Number(m.currentStock || 0);
        const cut = Number(m.cutAmount ?? m.periodUsage ?? 0);
        const remaining = Number(m.remainingAmount ?? m.currentStock ?? 0);
        const waste = Number(m.wasteAmount ?? m.periodScrap ?? 0);
        const unitCost = Number(m.unitCostAverage || 0);
        const val = Number(m.totalValuation ?? (stock * unitCost));

        sumStock += stock;
        sumCut += cut;
        sumRemaining += remaining;
        sumWaste += waste;
        sumValuation += val;

        return [
          `"${String(m.code || '').replace(/"/g, '""')}"`,
          `"${String(m.name || '').replace(/"/g, '""')}"`,
          `"${String(m.unit || 'METERS').replace(/"/g, '""')}"`,
          stock.toFixed(2),
          cut.toFixed(2),
          remaining.toFixed(2),
          waste.toFixed(2),
          unitCost.toFixed(2),
          val.toFixed(2),
          Number(m.alertThreshold || 0).toFixed(2),
          `"${String(m.status || 'Optimal').replace(/"/g, '""')}"`,
        ];
      });

      // Bottom Totals Row
      const totalsRow = [
        `"TOTALS (${items.length} Materials)"`,
        '""',
        '""',
        sumStock.toFixed(2),
        sumCut.toFixed(2),
        sumRemaining.toFixed(2),
        sumWaste.toFixed(2),
        '""',
        sumValuation.toFixed(2),
        '""',
        '""',
      ];

      const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(',')), totalsRow.join(',')].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const startTag = reportData?.dateFilter?.startDate
        ? new Date(reportData.dateFilter.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const endTag = reportData?.dateFilter?.endDate
        ? new Date(reportData.dateFilter.endDate).toISOString().split('T')[0]
        : startTag;

      link.setAttribute('download', `Raw_Materials_Report_${startTag}_to_${endTag}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Materials Excel exported successfully (${items.length} materials)!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to export Materials Excel sheet');
    }
  };

  const summary = reportData?.summary || {};
  const allRows: any[] = useMemo(() => {
    if (activeModule === 'cheques' && reportData) {
      if (activeChequeTab === 'PENDING') return reportData.pendingCheques || [];
      if (activeChequeTab === 'REALIZED') return reportData.realizedCheques || [];
      if (activeChequeTab === 'BOUNCED') return reportData.bouncedCheques || [];
      return reportData.tableItems || [];
    }
    if (activeModule === 'production' && reportData?.tableItems) {
      if (productionStageFilter && productionStageFilter !== 'ALL STAGES' && productionStageFilter !== 'ALL') {
        return (reportData.tableItems || []).filter((row: any) => matchProductionStage(row, productionStageFilter));
      }
      return reportData.tableItems || [];
    }
    return reportData?.tableItems || [];
  }, [reportData, activeModule, activeChequeTab, productionStageFilter]);

  const handleExportChequesCsv = () => {
    if (!reportData) return;
    const items = activeModule === 'cheques'
      ? (activeChequeTab === 'PENDING'
          ? (reportData.pendingCheques || [])
          : activeChequeTab === 'REALIZED'
          ? (reportData.realizedCheques || [])
          : activeChequeTab === 'BOUNCED'
          ? (reportData.bouncedCheques || [])
          : (reportData.tableItems || []))
      : (reportData.tableItems || []);

    const headers = ['Cheque Number', 'Bank', 'Maturity Date', 'Invoice', 'Customer', 'Phone', 'Amount (Rs.)', 'Status', 'Maturity Alert'];
    const rows = items.map((r: any) => {
      const rawStatus = String(r.statusLabel || r.status || '').toUpperCase();
      const isRealized = rawStatus === 'REALIZED' || rawStatus === 'CLEARED' || rawStatus === 'COMPLETE';
      const statusDisplay = isRealized ? 'COMPLETE' : (r.statusLabel || r.status || '');
      const rawAlert = String(r.maturityAlert ?? r.alert ?? '').trim();
      const alertDisplay = isRealized || rawAlert === 'N/A' ? '' : rawAlert;
      return [
        `"${r.chequeNumber || ''}"`,
        `"${r.bankName || ''}"`,
        `"${r.chequeDate || ''}"`,
        `"${r.invoiceNumber || ''}"`,
        `"${r.customerName || ''}"`,
        `"${r.customerPhone || ''}"`,
        r.amount || 0,
        `"${statusDisplay}"`,
        `"${alertDisplay}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cheque-ledger-${activeChequeTab.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Cheque ledger exported to CSV successfully!');
  };

  // Client-side search within table
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase();
    return allRows.filter((row) =>
      Object.values(row).some((val) => String(val || '').toLowerCase().includes(q))
    );
  }, [allRows, searchQuery]);

  // Client-side Pagination Math
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = useMemo(() => {
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, startIndex, PAGE_SIZE]);

  /**
   * Dynamic KPI Aggregations for Garment Production Report module.
   * Derives live totals for the 6-stage production funnel directly from `filteredRows`:
   *  1. Total Cut Pieces: Sum of cutQty
   *  2. In Sewing Line (WIP): Sum of (cutQty - sewnQty) for active lines
   *  3. Total Sewn Output: Sum of sewnQty
   *  4. In Wash / Washed: Sum of sentToWashQty + washedQty
   *  5. Ironed & Packed: Aggregate values from finishLogs / completedQty
   *  6. Fully Finished / Synced: Sum of completedQty synced to inventory
   */
  const productionKPIs = useMemo(() => {
    if (activeModule !== 'production') return null;

    const rows = filteredRows;
    const totalBatches = summary.totalBatches ?? rows.length;

    // Strictly prioritize backend summary's stage-specific event-logging sums over batch row aggregations
    const totalCutPieces = summary.totalCutPieces !== undefined
      ? Number(summary.totalCutPieces)
      : rows.reduce((sum, row) => {
          const cut = Number(row.cutQty > 0 ? row.cutQty : (row.totalCutUnits ?? (Array.isArray(row.cutLogs) && row.cutLogs.length > 0
            ? row.cutLogs.reduce((acc: number, c: any) => acc + (c.quantityCut || 0), 0)
            : (row.completedQty || row.targetQuantity || 0))));
          return sum + cut;
        }, 0);

    const inSewingWip = summary.inSewingWip !== undefined
      ? Number(summary.inSewingWip)
      : rows.reduce((sum, row) => {
          if (row.status !== 'CANCELLED' && row.status !== 'COMPLETED') {
            const cut = Number(row.cutQty > 0 ? row.cutQty : (row.lineSentQty > 0 ? row.lineSentQty : (row.totalCutUnits ?? row.targetQuantity ?? 0)));
            const sewn = Number(row.sewnQty || 0);
            return sum + Math.max(0, cut - sewn);
          }
          return sum;
        }, 0);

    const totalSewnOutput = summary.totalSewnOutput !== undefined
      ? Number(summary.totalSewnOutput)
      : rows.reduce((sum, row) => sum + Number(row.sewnQty || 0), 0);

    const inWashTotal = summary.inWashTotal !== undefined
      ? Number(summary.inWashTotal)
      : rows.reduce((sum, row) => {
          const sentWash = Number(row.sentToWashQty || 0);
          const washed = Number(row.washedQty || 0);
          return sum + sentWash + washed;
        }, 0);

    const ironedAndPacked = summary.ironedAndPacked !== undefined
      ? Number(summary.ironedAndPacked)
      : rows.reduce((sum, row) => {
          const logged = Array.isArray(row.finishLogs) && row.finishLogs.length > 0
            ? row.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
            : 0;
          const finished = logged > 0
            ? logged
            : (Number(row.completedQty || 0) > 0 ? Number(row.completedQty) : Number(row.washedQty || 0));
          return sum + finished;
        }, 0);

    const fullyFinishedSynced = summary.fullyFinishedSynced !== undefined
      ? Number(summary.fullyFinishedSynced)
      : rows.reduce((sum, row) => {
          const isSynced = Boolean(row.isStockSynced) && row.status !== 'CANCELLED';
          const finished = Number(row.completedQty || 0) > 0 ? Number(row.completedQty) : Number(row.washedQty || 0);
          return isSynced ? sum + finished : sum;
        }, 0);

    // Overall Finished & WIP backwards-compatibility metrics
    const completedQuantity = ironedAndPacked;

    const currentWip = rows.reduce((sum, row) => {
      if (row.status !== 'CANCELLED' && row.status !== 'COMPLETED') {
        const cut = Number(row.cutQty > 0 ? row.cutQty : (row.totalCutUnits ?? row.targetQuantity ?? 0));
        const done = Number(row.completedQty || 0) > 0 ? Number(row.completedQty) : Number(row.washedQty || 0);
        return sum + Math.max(0, cut - done);
      }
      return sum;
    }, 0);

    const pendingStockSync = rows.reduce((sum, row) => {
      const finished = Number(row.completedQty || 0) > 0 ? Number(row.completedQty) : Number(row.washedQty || 0);
      const isCompleted = row.status !== 'CANCELLED' && (finished > 0 || row.status === 'COMPLETED');
      return (!row.isStockSynced && isCompleted) ? sum + finished : sum;
    }, 0);

    const totalScrapReturned = rows.reduce((sum, row) => {
      const scrap = Number(
        row.scrapReturned !== undefined && Number(row.scrapReturned) > 0
          ? row.scrapReturned
          : (Array.isArray(row.materialUsages) && row.materialUsages.length > 0
            ? row.materialUsages.reduce((acc: number, u: any) => acc + (Number(u.returnedScrap ?? u.returnedQty) || 0), 0)
            : (Array.isArray(row.activityLogs)
              ? row.activityLogs
                  .filter((a: any) => a.action === 'RETURNED_SCRAP' || a.action === 'RETURNED')
                  .reduce((acc: number, a: any) => acc + (Number(a.quantity) || 0), 0)
              : 0))
      );
      return sum + scrap;
    }, 0);

    const targetQuantity = rows.reduce((sum, row) => sum + Number(row.targetQuantity || 0), 0);
    const overallYieldDivisor = totalCutPieces > 0 ? totalCutPieces : targetQuantity;
    const overallYieldPercentage = overallYieldDivisor > 0
      ? Math.round((ironedAndPacked / overallYieldDivisor) * 10000) / 100
      : (summary.overallYieldPercentage || 0);

    return {
      totalBatches,
      // 6-Stage Funnel Metrics
      totalCutPieces: Math.round(totalCutPieces * 100) / 100,
      inSewingWip: Math.round(inSewingWip * 100) / 100,
      totalSewnOutput: Math.round(totalSewnOutput * 100) / 100,
      inWashTotal: Math.round(inWashTotal * 100) / 100,
      ironedAndPacked: Math.round(ironedAndPacked * 100) / 100,
      fullyFinishedSynced: Math.round(fullyFinishedSynced * 100) / 100,
      // Backwards-compatibility properties
      totalMaterialsCut: Math.round(totalCutPieces * 100) / 100,
      totalScrapReturned: Math.round(totalScrapReturned * 100) / 100,
      completedQuantity,
      pendingStockSync,
      syncedToInventory: Math.round(fullyFinishedSynced * 100) / 100,
      currentWip: Math.round(inSewingWip * 100) / 100,
      overallYieldPercentage,
    };
  }, [activeModule, filteredRows, summary]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Readable active date badge formatter (e.g. Selected: 2026-10-01 to 2026-10-09)
  const formattedSelectedBadge = useMemo(() => {
    if (activePreset === 'custom' && customRange?.from) {
      const s = format(customRange.from, 'yyyy-MM-dd');
      const e = format(customRange.to || customRange.from, 'yyyy-MM-dd');
      return `${s} to ${e}`;
    }
    if (reportData?.dateFilter?.startDate && reportData?.dateFilter?.endDate) {
      const s = format(new Date(reportData.dateFilter.startDate), 'yyyy-MM-dd');
      const e = format(new Date(reportData.dateFilter.endDate), 'yyyy-MM-dd');
      return `${s} to ${e}`;
    }
    return reportData?.dateFilter?.presetLabel || 'Resolving...';
  }, [reportData, activePreset, customRange]);

  // Chart data preparation
  const chartData = useMemo(() => {
    if (!reportData) return [];

    if (activeModule === 'sales') {
      const split = summary.paymentSplit || {};
      return Object.entries(split).map(([method, data]: [string, any]) => ({
        name: method,
        value: data.amount || 0,
        count: data.count || 0,
      }));
    }

    if (activeModule === 'returns') {
      const reasons = summary.reasonsBreakdown || {};
      return Object.entries(reasons).map(([reason, data]: [string, any]) => ({
        name: reason,
        value: data.refund || 0,
        count: data.qty || 0,
      }));
    }

    if (activeModule === 'products') {
      return (reportData.tableItems || []).slice(0, 6).map((item: any) => ({
        name: item.productName?.length > 15 ? item.productName.slice(0, 15) + '...' : item.productName,
        value: item.totalRevenue || 0,
        qty: item.soldQty || 0,
      }));
    }

    if (activeModule === 'production') {
      const daily = summary?.dailyTrends;
      if (Array.isArray(daily) && daily.length > 0) {
        return daily.slice(0, 10).map((d: any) => ({
          name: d.date ? d.date.slice(5) : 'Date',
          cutQty: Math.round((d.cutQty || 0) * 100) / 100,
          sewnQty: Math.round((d.sewnQty || 0) * 100) / 100,
          washedQty: Math.round((d.washedQty || 0) * 100) / 100,
          finishedQty: Math.round((d.finishedQty || 0) * 100) / 100,
        })).reverse();
      }

      // Dynamic extraction of stage-specific logs grouped by execution date
      const dateMap: Record<string, { date: string; cutQty: number; sewnQty: number; washedQty: number; finishedQty: number }> = {};
      const getDay = (dateStr: string) => {
        const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10);
        if (!dateMap[d]) dateMap[d] = { date: d, cutQty: 0, sewnQty: 0, washedQty: 0, finishedQty: 0 };
        return dateMap[d];
      };

      const sourceRows = filteredRows && filteredRows.length > 0 ? filteredRows : (reportData.tableItems || []);
      sourceRows.forEach((row: any) => {
        if (Array.isArray(row.cutLogs) && row.cutLogs.length > 0) {
          row.cutLogs.forEach((cl: any) => {
            if (cl.cutDate) getDay(cl.cutDate).cutQty += Number(cl.quantityCut || 0);
          });
        } else if (row.productionDate) {
          getDay(row.productionDate).cutQty += Number(row.cutQty || row.totalCutUnits || 0);
        }

        if (Array.isArray(row.activityLogs) && row.activityLogs.length > 0) {
          row.activityLogs.forEach((al: any) => {
            if (!al.timestamp) return;
            const act = String(al.action || '').toUpperCase();
            const stg = String(al.stage || '').toUpperCase();
            const q = Number(al.quantity || 0);
            if (act === 'SEWN' || act === 'LOG_SEWN' || stg === 'LINE') {
              getDay(al.timestamp).sewnQty += q;
            } else if (stg === 'WASHING' || act.includes('WASH')) {
              getDay(al.timestamp).washedQty += q;
            } else if (stg === 'COMPLETED' || act === 'FINALIZED') {
              getDay(al.timestamp).finishedQty += q;
            }
          });
        } else {
          if (row.productionDate && Number(row.sewnQty || 0) > 0) getDay(row.productionDate).sewnQty += Number(row.sewnQty);
          if (row.productionDate && Number(row.washedQty || 0) > 0) getDay(row.productionDate).washedQty += Number(row.washedQty);
        }

        if (Array.isArray(row.finishLogs) && row.finishLogs.length > 0) {
          row.finishLogs.forEach((fl: any) => {
            const fDate = fl.finishDate || fl.date;
            if (fDate) getDay(fDate).finishedQty += Number(fl.quantityFinished || fl.quantity || 0);
          });
        } else if (Number(row.completedQty || 0) > 0) {
          const fDate = row.stockSyncedAt || row.productionDate;
          if (fDate) getDay(fDate).finishedQty += Number(row.completedQty);
        }
      });

      const sortedDays = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
      if (sortedDays.length > 0) {
        return sortedDays.slice(-10).map((d) => ({
          name: d.date ? d.date.slice(5) : 'Date',
          cutQty: Math.round(d.cutQty * 100) / 100,
          sewnQty: Math.round(d.sewnQty * 100) / 100,
          washedQty: Math.round(d.washedQty * 100) / 100,
          finishedQty: Math.round(d.finishedQty * 100) / 100,
        }));
      }

      return sourceRows.slice(0, 8).map((item: any) => ({
        name: item.productionNo,
        cutQty: Math.round(Number(item.cutQty || item.totalCutUnits || 0) * 100) / 100,
        sewnQty: Math.round(Number(item.sewnQty || 0) * 100) / 100,
        washedQty: Math.round(Number(item.washedQty || 0) * 100) / 100,
        finishedQty: Math.round(Number(item.completedQty || item.totalFinishedUnits || 0) * 100) / 100,
      }));
    }

    if (activeModule === 'suppliers') {
      return (reportData.tableItems || []).slice(0, 6).map((item: any) => ({
        name: item.supplierName?.length > 12 ? item.supplierName.slice(0, 12) + '...' : item.supplierName,
        purchases: item.totalPurchases || 0,
        due: item.outstandingBalance || 0,
      }));
    }

    if (activeModule === 'audit') {
      const cashierMap = summary.cashierEditsBreakdown || {};
      return Object.entries(cashierMap).map(([cashier, count]: [string, any]) => ({
        name: cashier,
        value: count,
      }));
    }

    if (activeModule === 'cheques') {
      return [
        { name: 'Pending', value: summary.totalPendingAmount || 0, count: summary.pendingCount || 0 },
        { name: 'Realized', value: summary.totalRealizedAmount || 0, count: summary.realizedCount || 0 },
        { name: 'Bounced', value: summary.totalBouncedAmount || 0, count: summary.bounceCount || 0 },
      ];
    }

    return [];
  }, [reportData, activeModule, summary]);

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const formatRs = (val: number) => `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

  return (
    <div className={`space-y-4 sm:space-y-5 w-full pb-12 transition-colors ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {isRep ? 'Wholesale Representative Performance' : 'Reports & Enterprise Analytics'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              {isRep
                ? 'Scoped personal wholesale billing analytics, collections, and daily sales summaries'
                : 'Unified cross-domain intelligence, financial aggregations, and official A4 audit exports'}
            </p>
          </div>
        </div>

        {/* Top Master PDF & Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <TooltipSimple content="Refresh report ledger" side="bottom">
            <Button
              onClick={fetchReport}
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-9 px-2.5 sm:px-3 rounded-xl border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              title="Refresh report ledger"
              aria-label="Refresh report ledger"
            >
              <RefreshCw className={`size-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </TooltipSimple>

          {!isRep && (
            <TooltipSimple content="Download Official Consolidated Master Audit PDF" side="bottom">
              <Button
                onClick={handleDownloadConsolidatedPdf}
                disabled={downloadingConsolidatedPdf || loading}
                className="h-9 px-2.5 sm:px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Download Official Consolidated Master Audit PDF"
                aria-label="Download Official Consolidated Master Audit PDF"
              >
                {downloadingConsolidatedPdf ? (
                  <>
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    <span className="hidden sm:inline">Compiling...</span>
                    <span className="sm:hidden">Compiling...</span>
                  </>
                ) : (
                  <>
                    <Download className="size-3.5 shrink-0" />
                    <span className="hidden sm:inline">Master Audit PDF</span>
                    <span className="sm:hidden">Audit PDF</span>
                  </>
                )}
              </Button>
            </TooltipSimple>
          )}
        </div>
      </div>

      {/* ── Section Domain Selector (Left 1/2) & Action Download Buttons (Right) ── */}
      <div className={`p-3 sm:p-4 rounded-2xl border transition-all ${
        dark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Domain Searchable Select (takes 1/2 width on desktop) */}
          <div className="w-full md:w-1/2 lg:w-5/12">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-1">
              Select Report Domain / Section
            </label>
            <SearchableSelect
              value={activeModule}
              onValueChange={(val) => handleTabSelect(val as ModuleKey)}
              options={moduleSelectOptions}
              placeholder="Select Report Section..."
              searchPlaceholder="Search domains (Sales, Cheques, Production...)"
              dark={dark}
              className="h-10 rounded-xl text-xs sm:text-sm font-semibold w-full bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 shadow-xs"
            />
          </div>

          {/* Right: Section Actions & Exports (Matching exact height h-10; compact icon buttons on mobile) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-zinc-800/60 overflow-x-auto scrollbar-hide py-0.5">
            {/* Active Module PDF */}
            <TooltipSimple content={`Download ${activeTabItem.label} PDF`} side="top">
              <Button
                onClick={handleDownloadActivePdf}
                disabled={downloadingActivePdf || loading || !reportData}
                variant="outline"
                className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-semibold border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 shadow-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                title={`Download ${activeTabItem.label} PDF`}
                aria-label={`Download ${activeTabItem.label} PDF`}
              >
                {downloadingActivePdf ? (
                  <>
                    <Loader2 className="size-3.5 sm:size-4 animate-spin text-blue-600 shrink-0" />
                    <span className="hidden sm:inline">Exporting...</span>
                    <span className="sm:hidden">Exporting...</span>
                  </>
                ) : (
                  <>
                    <Printer className="size-3.5 sm:size-4 text-blue-600 shrink-0" />
                    <span className="hidden sm:inline">Download {activeTabItem.label.split('&')[0].trim()} PDF</span>
                    <span className="sm:hidden">{activeModule === 'sales' ? 'Sales' : activeModule === 'returns' ? 'Returns' : activeModule === 'inventory' ? 'Stock' : activeModule === 'products' ? 'Products' : activeModule === 'materials' ? 'Materials' : activeModule === 'production' ? 'Production' : activeModule === 'suppliers' ? 'Suppliers' : activeModule === 'audit' ? 'Audit' : activeModule === 'cheques' ? 'Cheques' : 'PDF'}</span>
                  </>
                )}
              </Button>
            </TooltipSimple>

            {/* Sales: Dedicated Financial Audit Action (Duplicate Master Audit PDF removed to eliminate redundancy with top header) */}
            {activeModule === 'sales' && (
              <TooltipSimple content="Financial Audit & Net Revenue Analytics" side="top">
                <Button
                  onClick={() => handleOpenAudit('netOperationalRevenue')}
                  disabled={loading || !reportData}
                  variant="outline"
                  className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                  title="Financial Audit & Net Revenue Analytics"
                  aria-label="Financial Audit & Net Revenue Analytics"
                >
                  <Calculator className="size-3.5 sm:size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="hidden sm:inline">Financial Audit</span>
                  <span className="sm:hidden">Audit</span>
                </Button>
              </TooltipSimple>
            )}

            {/* Sales: Customer Dues PDF */}
            {activeModule === 'sales' && (
              <TooltipSimple content="Download Outstanding Customer Dues PDF" side="top">
                <Button
                  onClick={handleDownloadCustomerDuesPdf}
                  disabled={downloadingCustomerDuesPdf || loading || !reportData}
                  variant="outline"
                  className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-semibold border-emerald-300 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shadow-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Download Outstanding Customer Dues PDF"
                  aria-label="Download Outstanding Customer Dues PDF"
                >
                  {downloadingCustomerDuesPdf ? (
                    <>
                      <Loader2 className="size-3.5 sm:size-4 animate-spin text-emerald-600 shrink-0" />
                      <span className="hidden sm:inline">Generating...</span>
                      <span className="sm:hidden">Dues...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="size-3.5 sm:size-4 text-emerald-600 shrink-0" />
                      <span className="hidden sm:inline">Customer Dues PDF</span>
                      <span className="sm:hidden">Dues</span>
                    </>
                  )}
                </Button>
              </TooltipSimple>
            )}

            {/* Sales: Export Invoices Excel */}
            {activeModule === 'sales' && (
              <TooltipSimple content="Export Invoices to Excel" side="top">
                <Button
                  onClick={handleExportInvoicesExcel}
                  disabled={loading || !reportData || (reportData?.tableItems?.length || 0) === 0}
                  variant="outline"
                  className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-semibold border-emerald-500/80 dark:border-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                  title="Export Invoices to Excel"
                  aria-label="Export Invoices to Excel"
                >
                  <FileSpreadsheet className="size-3.5 sm:size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline">Export Invoices Excel</span>
                  <span className="sm:hidden">Excel</span>
                </Button>
              </TooltipSimple>
            )}

            {/* Raw Materials & Production: PDF and Excel Buttons */}
            {(activeModule === 'materials' || activeModule === 'production') && (
              <>
                <TooltipSimple content={activeModule === 'production' ? "Download Garment Production Audit PDF" : "Download Material & Production Audit PDF"} side="top">
                  <Button
                    onClick={handleDownloadMaterialPdf}
                    disabled={downloadingMaterialPdf || loading || !reportData}
                    variant="outline"
                    className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-semibold border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                    title={activeModule === 'production' ? "Download Garment Production Audit PDF" : "Download Material & Production Audit PDF"}
                    aria-label={activeModule === 'production' ? "Download Garment Production Audit PDF" : "Download Material & Production Audit PDF"}
                  >
                    {downloadingMaterialPdf ? (
                      <>
                        <Loader2 className="size-3.5 sm:size-4 animate-spin text-amber-600 shrink-0" />
                        <span className="hidden sm:inline">Generating...</span>
                        <span className="sm:hidden">Gen...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="size-3.5 sm:size-4 text-amber-600 shrink-0" />
                        <span className="hidden sm:inline">
                          {activeModule === 'production' ? 'Production PDF' : 'Material & Production PDF'}
                        </span>
                        <span className="sm:hidden">{activeModule === 'production' ? 'Prod PDF' : 'Mat PDF'}</span>
                      </>
                    )}
                  </Button>
                </TooltipSimple>

                <TooltipSimple content="Export Raw Material and Cutting yield to Excel" side="top">
                  <Button
                    onClick={handleExportMaterialsExcel}
                    disabled={loading || !reportData || (reportData?.tableItems?.length || 0) === 0}
                    variant="outline"
                    className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-semibold border-emerald-500/80 dark:border-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                    title="Export Material Excel"
                    aria-label="Export Material Excel"
                  >
                    <FileSpreadsheet className="size-3.5 sm:size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="hidden sm:inline">Export Material Excel</span>
                    <span className="sm:hidden">Mat Excel</span>
                  </Button>
                </TooltipSimple>
              </>
            )}

            {/* Cheques: CSV Export Button */}
            {activeModule === 'cheques' && (
              <TooltipSimple content="Export Cheque Ledger to CSV" side="top">
                <Button
                  onClick={handleExportChequesCsv}
                  disabled={loading || !reportData}
                  variant="outline"
                  className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-semibold border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                  title="Export Cheque Ledger to CSV"
                  aria-label="Export Cheque Ledger to CSV"
                >
                  <FileSpreadsheet className="size-3.5 sm:size-4 text-amber-600 shrink-0" />
                  <span className="hidden sm:inline">Export Cheques CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
              </TooltipSimple>
            )}
          </div>
        </div>
      </div>

      {/* ── Period Filter Bar ── */}
      <div className={`p-3 sm:p-4 rounded-2xl border transition-all ${
        dark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Presets Segmented Control & Date Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
            {/* Segmented Preset Control Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 shrink-0 max-w-full">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-0.5 flex items-center gap-1 shrink-0">
                <Calendar className="size-3.5" />
                <span className="hidden sm:inline">Period:</span>
              </span>

              <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-zinc-950/80 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handlePresetSelect('daily')}
                  className={`h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                    activePreset === 'daily'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-900/60'
                  }`}
                  title="Period: Today"
                  aria-label="Period: Today"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect('weekly')}
                  className={`h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                    activePreset === 'weekly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-900/60'
                  }`}
                  title="Period: This Week"
                  aria-label="Period: This Week"
                >
                  <span className="sm:hidden">Week</span>
                  <span className="hidden sm:inline">This Week</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect('monthly')}
                  className={`h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                    activePreset === 'monthly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-900/60'
                  }`}
                  title="Period: This Month"
                  aria-label="Period: This Month"
                >
                  <span className="sm:hidden">Month</span>
                  <span className="hidden sm:inline">This Month</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect('yearly')}
                  className={`h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                    activePreset === 'yearly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-900/60'
                  }`}
                  title="Period: This Year"
                  aria-label="Period: This Year"
                >
                  <span className="sm:hidden">Year</span>
                  <span className="hidden sm:inline">This Year</span>
                </button>

                {/* Next Year Button for Cheques */}
                {activeModule === 'cheques' && (
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('next_year')}
                    className={`h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                      activePreset === 'next_year'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-700 dark:text-amber-400 hover:bg-white/60 dark:hover:bg-zinc-900/60'
                    }`}
                    title="Period: Next Year"
                    aria-label="Period: Next Year"
                  >
                    <span className="sm:hidden">Next Yr</span>
                    <span className="hidden sm:inline">Next Year</span>
                  </button>
                )}
              </div>
            </div>

            <div className="h-5 w-px bg-slate-300 dark:bg-zinc-800 mx-0.5 hidden sm:block shrink-0" />

            {/* Custom Date Range Picker */}
            <div className="w-full sm:w-52 lg:w-60">
              <DateRangePicker
                date={customRange}
                onDateChange={handleRangeChange}
                placeholder="Date Selector..."
                className="h-8 text-xs rounded-lg w-full"
              />
            </div>

            {/* Rep / User Filter Dropdown */}
            {!isRep && (
              <div className="w-full sm:w-48 lg:w-56 shrink-0">
                <SearchableSelect
                  value={selectedUserId}
                  onValueChange={(val) => setSelectedUserId(val)}
                  options={userSelectOptions}
                  placeholder="All Users / Reps"
                  searchPlaceholder="Filter rep / user..."
                  dark={dark}
                  className="h-8 text-xs rounded-lg w-full"
                />
              </div>
            )}

            {/* Production Stage / Section Filter Dropdown */}
            {activeModule === 'production' && (
              <div className="w-full sm:w-48 lg:w-56 shrink-0">
                <SearchableSelect
                  value={productionStageFilter}
                  onValueChange={(val) => setProductionStageFilter(val)}
                  options={[
                    { value: 'ALL STAGES', label: 'All Stages' },
                    { value: 'CUTTING', label: 'Cutting' },
                    { value: 'SEWING LINE', label: 'Sewing Line' },
                    { value: 'WASHING', label: 'Washing' },
                    { value: 'FINISHING / PACKING', label: 'Finishing / Packing' },
                    { value: 'IN STOCK / COMPLETED', label: 'In Stock / Completed' },
                  ]}
                  placeholder="All Stages"
                  searchPlaceholder="Filter section / stage..."
                  dark={dark}
                  className="h-8 text-xs rounded-lg w-full font-semibold"
                />
              </div>
            )}
          </div>

          {/* Right Corner: Selected Badge & Chart Toggle Button */}
          <div className="flex items-center gap-2.5 justify-between lg:justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <span className="font-semibold text-slate-600 dark:text-zinc-300 text-[11px]">Selected:</span>
              <Badge variant="outline" className="font-mono text-[11px] font-semibold px-2 py-0.5 border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 shadow-2xs">
                {formattedSelectedBadge}
              </Badge>
            </div>

            {chartData.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCharts((prev) => !prev)}
                className={`h-8 px-2.5 text-xs rounded-lg gap-1.5 font-semibold transition-all ${
                  showCharts
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300'
                    : 'text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
                title={showCharts ? 'Hide Visual Charts' : 'Show Visual Charts'}
                aria-label={showCharts ? 'Hide Visual Charts' : 'Show Visual Charts'}
              >
                <BarChart3 className="size-3.5" />
                <span>{showCharts ? 'Hide Charts' : 'Show Charts'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Aggregating analytical ledger...</p>
        </div>
      ) : !reportData ? (
        <div className="text-center py-20 border rounded-2xl border-dashed border-slate-300 dark:border-zinc-800">
          <AlertTriangle className="size-10 mx-auto text-amber-500 mb-2 opacity-80" />
          <p className="text-sm font-semibold">No data returned for the selected filter</p>
          <p className="text-xs text-slate-400 mt-1">Try selecting a broader date range or adjusting the filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Summary Metric Cards */}
          <div className={`grid gap-2.5 sm:gap-3.5 md:gap-4 ${
            activeModule === 'production' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-4'
          }`}>
            {activeModule === 'sales' && (
              <>
                {/* 1. GROSS REVENUE KPI CARD */}
                <div
                  onClick={() => handleOpenAudit('grossRevenue')}
                  className={`p-3 sm:p-4 rounded-2xl border cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group/kpi select-none ${
                    dark
                      ? 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-800/80'
                      : 'bg-white border-slate-200 shadow-sm hover:bg-emerald-50/20'
                  }`}
                  title="Click to view Gross Revenue mathematical formula & audit breakdown"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Gross Revenue</p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover/kpi:opacity-100 font-bold transition-opacity">
                      Audit ↗
                    </span>
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{formatRs(summary.grossRevenue)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.orderCount || 0} Orders Recorded</p>
                </div>

                {/* 2. NET SALES KPI CARD */}
                <div
                  onClick={() => handleOpenAudit('netSales')}
                  className={`p-3 sm:p-4 rounded-2xl border cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group/kpi select-none ${
                    dark
                      ? 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-800/80'
                      : 'bg-white border-slate-200 shadow-sm hover:bg-emerald-50/20'
                  }`}
                  title="Click to view Net Sales formula & deductions audit"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Net Sales</p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover/kpi:opacity-100 font-bold transition-opacity">
                      Audit ↗
                    </span>
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.netSales)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Discounts: {formatRs(summary.totalDiscount)}</p>
                </div>

                {/* 3. COLLECTED / PAID KPI CARD */}
                <div
                  onClick={() => handleOpenAudit('totalPaid')}
                  className={`p-3 sm:p-4 rounded-2xl border cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group/kpi select-none ${
                    dark
                      ? 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-800/80'
                      : 'bg-white border-slate-200 shadow-sm hover:bg-emerald-50/20'
                  }`}
                  title="Click to view Collections, Cash & Cheque liquidity audit"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Collected / Paid</p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover/kpi:opacity-100 font-bold transition-opacity">
                      Audit ↗
                    </span>
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">{formatRs(summary.totalPaid)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Avg Order: {formatRs(summary.averageOrderValue)}</p>
                </div>

                {/* 4. OUTSTANDING CREDIT DUE KPI CARD */}
                <div
                  onClick={() => handleOpenAudit('totalDue')}
                  className={`p-3 sm:p-4 rounded-2xl border cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group/kpi select-none ${
                    dark
                      ? 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-800/80'
                      : 'bg-white border-slate-200 shadow-sm hover:bg-rose-50/20'
                  }`}
                  title="Click to view Outstanding Customer Credit Debt audit"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Outstanding Credit Due</p>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 opacity-0 group-hover/kpi:opacity-100 font-bold transition-opacity">
                      Audit ↗
                    </span>
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{formatRs(summary.totalDue)}</p>
                  <p className="text-[11px] text-rose-500/80 mt-1">Pending Customer Debt</p>
                </div>

                {/* 5. NET OPERATIONAL REVENUE KPI CARD */}
                <div
                  onClick={() => handleOpenAudit('netOperationalRevenue')}
                  className={`p-3 sm:p-4 rounded-2xl border cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group/kpi select-none ${
                    dark
                      ? 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-800/80'
                      : 'bg-white border-slate-200 shadow-sm hover:bg-emerald-50/20'
                  }`}
                  title="Click to view Net Operational Revenue formula & deductions audit"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Net Operational Rev.</p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover/kpi:opacity-100 font-bold transition-opacity">
                      Audit ↗
                    </span>
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                    {formatRs(summary.netOperationalRevenue ?? ((summary.totalPaid || 0) - (summary.totalProductionCost || 0) - (summary.totalGrnExpenses || 0)))}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Paid - Production - GRN</p>
                </div>

                {/* 6. OPERATIONAL PROFIT KPI CARD */}
                <div
                  onClick={() => handleOpenAudit('netOperationalProfit')}
                  className={`p-3 sm:p-4 rounded-2xl border cursor-pointer hover:border-indigo-500/50 hover:shadow-md transition-all group/kpi select-none ${
                    dark
                      ? 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-800/80'
                      : 'bg-white border-slate-200 shadow-sm hover:bg-indigo-50/20'
                  }`}
                  title="Click to view Operational Profit formula & trading surplus"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Operational Profit</p>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 opacity-0 group-hover/kpi:opacity-100 font-bold transition-opacity">
                      Audit ↗
                    </span>
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                    {formatRs(summary.netOperationalProfit ?? ((summary.netSales || 0) - (summary.totalProductionCost || 0) - (summary.totalGrnExpenses || 0)))}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Net Sales - Costs &amp; GRN</p>
                </div>

                {/* 7. PRODUCTION COSTS KPI CARD */}
                <div
                  className={`p-3 sm:p-4 rounded-2xl border ${
                    dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                  title="Total direct fabric and manufacturing costs in period"
                >
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Production Costs</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">{formatRs(summary.totalProductionCost || 0)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Fabric &amp; Cut Usages</p>
                </div>

                {/* 8. GRN PURCHASES KPI CARD */}
                <div
                  className={`p-3 sm:p-4 rounded-2xl border ${
                    dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                  title="Goods Received Notes raw materials procurement expenses"
                >
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">GRN Purchases</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{formatRs(summary.totalGrnExpenses || 0)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Payables Due: {formatRs(summary.totalGrnLiabilities || 0)}</p>
                </div>
              </>
            )}

            {activeModule === 'returns' && (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Return Events</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalReturnEvents || 0}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Transactions Processed</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Restocked Units</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{summary.totalItemsReturned || 0} Pcs</p>
                  <p className="text-[11px] text-slate-400 mt-1">Returned to Inventory</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Return Value</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{formatRs(summary.totalReturnValue)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Gross Adjustment Value</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Cash vs Credit Split</p>
                  <p className="text-sm md:text-base font-bold mt-1 text-slate-900 dark:text-zinc-100">
                    {formatRs(summary.totalCashRefund)} <span className="text-xs font-normal text-slate-400">Cash</span>
                  </p>
                  <p className="text-[11px] text-blue-500 mt-1">{formatRs(summary.totalCreditAdjustment)} Credit Adjusted</p>
                </div>
              </>
            )}

            {activeModule === 'inventory' && (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total SKUs / Units</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalSkus || 0} SKUs</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.totalStockUnits || 0} Total Pieces in Warehouse</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Cost Valuation</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{formatRs(summary.totalCostValuation)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Invested Garment Capital</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Retail Valuation</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalRetailValuation)}</p>
                  <p className="text-[11px] text-emerald-500 mt-1">Est. Profit: {formatRs(summary.potentialGrossProfit)}</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Stock Alerts</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{summary.lowStockCount || 0} Low Stock</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.outOfStockCount || 0} Out of Stock SKUs</p>
                </div>
              </>
            )}

            {activeModule === 'products' && (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Units Sold</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalProductsSold || 0} Pcs</p>
                  <p className="text-[11px] text-slate-400 mt-1">Sales Turnover</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Revenue</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalRevenue)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">From Product Sales</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Top Velocity Product</p>
                  <p className="text-sm md:text-base font-bold mt-1 text-blue-600 dark:text-blue-400 truncate">{summary.topProduct || 'N/A'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Highest Sales Volume</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Leading Category</p>
                  <p className="text-sm md:text-base font-bold mt-1 text-purple-600 dark:text-purple-400 truncate">{summary.topCategory || 'N/A'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Highest Grossing Line</p>
                </div>
              </>
            )}

            {activeModule === 'materials' && (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Material Types</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalMaterials || 0} Fabrics/Items</p>
                  <p className="text-[11px] text-slate-400 mt-1">Recorded in Ledger</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Stock Valuation</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalValuation)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Weighted Average Cost</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Low Stock Warnings</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{summary.lowStockMaterials || 0} Materials</p>
                  <p className="text-[11px] text-slate-400 mt-1">Below Alert Threshold</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Period Scrap Returned</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{summary.periodScrapQty || 0} Units</p>
                  <p className="text-[11px] text-slate-400 mt-1">Leftover Recovery</p>
                </div>
              </>
            )}

            {activeModule === 'production' && (
              <>
                {/* Stage 1: Cutting - Total Cut Pieces */}
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Cut Pieces</p>
                    <Scissors className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400 font-mono">
                    {formatQty(productionKPIs?.totalCutPieces ?? summary.totalCutPieces ?? summary.totalMaterialsCut ?? 0)} <span className="text-xs font-medium text-slate-500">Units</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">{productionKPIs?.totalBatches ?? summary.totalBatches ?? 0} Batches Started</p>
                </div>

                {/* Stage 2: Line Intake - In Sewing Line (WIP) */}
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">In Sewing Line (WIP)</p>
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400 font-mono">
                    {formatQty(productionKPIs?.inSewingWip ?? summary.inSewingWip ?? summary.currentWip ?? 0)} <span className="text-xs font-medium text-slate-500">Pcs</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Ongoing in Sewing Floor</p>
                </div>

                {/* Stage 3: Sewing - Total Sewn Output */}
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Sewn Output</p>
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-purple-600 dark:text-purple-400 font-mono">
                    {formatQty(productionKPIs?.totalSewnOutput ?? summary.totalSewnOutput ?? 0)} <span className="text-xs font-medium text-slate-500">Pcs</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Exited Sewing Floor</p>
                </div>

                {/* Stage 4: Washing - In Wash / Washed */}
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">In Wash / Washed</p>
                    <Droplets className="w-3.5 h-3.5 text-cyan-500" />
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-cyan-600 dark:text-cyan-400 font-mono">
                    {formatQty(productionKPIs?.inWashTotal ?? summary.inWashTotal ?? 0)} <span className="text-xs font-medium text-slate-500">Pcs</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Wet Processing Pipeline</p>
                </div>

                {/* Stage 5: Ironing & Packing */}
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Ironed &amp; Packed</p>
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatQty(productionKPIs?.ironedAndPacked ?? summary.ironedAndPacked ?? summary.completedQuantity ?? 0)} <span className="text-xs font-medium text-slate-500">Pcs</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Yield: {formatQty(productionKPIs?.overallYieldPercentage ?? summary.overallYieldPercentage ?? 0)}%</p>
                </div>

                {/* Stage 6: Finished Inventory - Fully Finished / Synced */}
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Fully Finished / Synced</p>
                    <Package className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <p className="text-lg md:text-xl font-bold mt-1 text-blue-600 dark:text-blue-400 font-mono">
                    {formatQty(productionKPIs?.fullyFinishedSynced ?? summary.fullyFinishedSynced ?? summary.syncedToInventory ?? 0)} <span className="text-xs font-medium text-slate-500">Pcs</span>
                  </p>
                  <p className="text-[11px] text-purple-500/80 mt-1">
                    {(productionKPIs?.pendingStockSync ?? summary.pendingStockSync ?? 0) > 0
                      ? `${formatQty(productionKPIs?.pendingStockSync ?? summary.pendingStockSync)} Pcs Pending Sync`
                      : 'Confirmed In Warehouse'}
                  </p>
                </div>
              </>
            )}

            {activeModule === 'suppliers' && (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Registered Suppliers</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalSuppliers || 0} Vendors</p>
                  <p className="text-[11px] text-slate-400 mt-1">Raw Material Shops</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Purchases (GRN)</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{formatRs(summary.totalPurchases)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.grnCount || 0} GRN Vouchers</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Settled Payments</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalPaid)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Disbursed to Suppliers</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Outstanding Payables</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{formatRs(summary.totalOutstandingPayables)}</p>
                  <p className="text-[11px] text-rose-500 mt-1">Current Supplier Credit Debt</p>
                </div>
              </>
            )}

            {activeModule === 'audit' && (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Invoices Created</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-slate-900 dark:text-zinc-100">{summary.totalInvoicesInPeriod || 0}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Original Transactions</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Modified After Issuance</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{summary.modifiedInvoicesCount || 0}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Revisions Recorded</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Modification Rate</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">{summary.modificationRate || 0}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">Of Total Invoices</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Top Cashier With Edits</p>
                  <p className="text-sm md:text-base font-bold mt-1 text-rose-600 dark:text-rose-400 truncate">{summary.topCashierWithEdits || 'None'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Audit Reconciliations</p>
                </div>
              </>
            )}

            {activeModule === 'cheques' && (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Pending Receivables</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{formatRs(summary.totalPendingAmount)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.pendingCount || 0} Cheques Awaiting Clearance</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Cleared / Realized</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRs(summary.totalRealizedAmount)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{summary.realizedCount || 0} Cleared Inflow Cheques</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Bounced / Returned</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">{summary.bounceCount || 0} Cheques</p>
                  <p className="text-[11px] text-rose-500 mt-1">{formatRs(summary.totalBouncedAmount)} Bounced Value</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Overdue Maturities</p>
                  <p className="text-lg md:text-xl font-bold mt-1 text-purple-600 dark:text-purple-400">{formatRs(summary.overdueAmount)}</p>
                  <p className="text-[11px] text-purple-500 mt-1">{summary.overdueCount || 0} Overdue Cheques</p>
                </div>
              </>
            )}
          </div>

          {/* Analytical Charts Block */}
          {showCharts && chartData.length > 0 && (
            <div className={`p-3 sm:p-5 rounded-2xl border ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {activeModule === 'sales' && 'Payment Method Breakdown (Rs.)'}
                    {activeModule === 'cheques' && 'Cheque Portfolio Realization Status (Rs.)'}
                    {activeModule === 'returns' && 'Return Reasons Distribution (Refund Rs.)'}
                    {activeModule === 'products' && 'Top Performing SKUs by Revenue (Rs.)'}
                    {activeModule === 'production' && 'Cutting vs Finishing Output Trends (Date / Batch)'}
                    {activeModule === 'suppliers' && 'Supplier Volume & Outstanding Debt'}
                    {activeModule === 'audit' && 'Cashier Revisions Frequency'}
                  </h3>
                  <p className="text-xs text-slate-400">Visual trend distribution for the selected reporting period</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {activeModule === 'returns' ? (
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                      >
                        {chartData.map((_: unknown, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: any) => formatRs(Number(val))} />
                    </PieChart>
                  ) : activeModule === 'production' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <YAxis stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                      <Bar dataKey="cutQty" name="1. Cut Pieces" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sewnQty" name="2. Sewn Output" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="washedQty" name="3. In Wash / Washed" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="finishedQty" name="4. Finished / Packed" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : activeModule === 'suppliers' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <YAxis stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <RechartsTooltip formatter={(val: any) => formatRs(Number(val))} />
                      <Bar dataKey="purchases" name="Total Purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="due" name="Outstanding Debt" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <YAxis stroke={dark ? '#71717a' : '#94a3b8'} fontSize={11} />
                      <RechartsTooltip formatter={(val: any) => (activeModule === 'audit' ? `${val} revisions` : formatRs(Number(val)))} />
                      <Bar dataKey="value" name="Value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {chartData.map((_: unknown, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Interactive Data Preview Table with Stable Explicit Width Allocations & No Text Collapse */}
          <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-zinc-900/70 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
            {/* Cheque Portfolio Categorized Tabs & Quick CSV Export Bar */}
            {activeModule === 'cheques' && (
              <div className="p-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide max-w-full pb-0.5 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChequeTab('PENDING');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      activeChequeTab === 'PENDING'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="hidden sm:inline">Upcoming / Pending</span>
                    <span className="sm:hidden">Pending</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeChequeTab === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}>
                      {summary.pendingCount || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveChequeTab('REALIZED');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      activeChequeTab === 'REALIZED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="hidden sm:inline">Cleared / Realized</span>
                    <span className="sm:hidden">Cleared</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeChequeTab === 'REALIZED' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}>
                      {summary.realizedCount || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveChequeTab('BOUNCED');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      activeChequeTab === 'BOUNCED'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="hidden sm:inline">Bounced / Returned</span>
                    <span className="sm:hidden">Bounced</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeChequeTab === 'BOUNCED' ? 'bg-rose-700 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}>
                      {summary.bounceCount || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveChequeTab('ALL');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      activeChequeTab === 'ALL'
                        ? 'bg-slate-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="hidden sm:inline">All Cheques</span>
                    <span className="sm:hidden">All</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeChequeTab === 'ALL' ? 'bg-slate-900 dark:bg-zinc-300 text-white dark:text-zinc-900' : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}>
                      {summary.totalChequesCount || 0}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Table Search & Meta Header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-9 text-xs dark:bg-zinc-950 dark:border-zinc-800"
                  />
                </div>
                {searchQuery && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="h-9 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>

              <div className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-700 dark:text-zinc-200">{filteredRows.length > 0 ? startIndex + 1 : 0} – {Math.min(startIndex + PAGE_SIZE, filteredRows.length)}</span> of {filteredRows.length} items
              </div>
            </div>

            {/* Mobile / Tablet Responsive Audit Cards View (< 1024px) */}
            <div className="block lg:hidden p-3 sm:p-4 space-y-3 min-h-[360px]">
              {paginatedRows.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No matching report records found.
                </div>
              ) : (
                paginatedRows.map((row, idx) => {
                  if (activeModule === 'cheques') {
                    const st = row.statusLabel || row.status || 'PENDING';
                    return (
                      <div
                        key={row.id || `${row.chequeNumber}-${idx}`}
                        className="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs space-y-2.5 text-xs select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 truncate">
                              #{row.chequeNumber || 'CHQ-N/A'}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 font-semibold ${
                                st === 'REALIZED' || st === 'CLEARED'
                                  ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                                  : st === 'BOUNCED'
                                  ? 'border-rose-500 text-rose-600 bg-rose-500/10'
                                  : 'border-amber-500 text-amber-600 bg-amber-500/10'
                              }`}
                            >
                              {st}
                            </Badge>
                            {row.maturityAlert && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  row.maturityAlert === 'OVERDUE'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                    : row.maturityAlert === 'DUE_THIS_WEEK'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {row.maturityAlert === 'OVERDUE' ? 'Overdue' : row.maturityAlert === 'DUE_THIS_WEEK' ? 'Due This Week' : 'Upcoming'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0">
                            <Calendar className="size-3" />
                            <span>{row.chequeDate || '-'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-sm truncate block">
                              {row.customerName || 'General Customer'}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate">
                              {row.bankName !== '-' ? `${row.bankName} Bank` : 'Cheque'} • Inv {row.invoiceNumber}
                              {row.customerPhone ? ` • ${row.customerPhone}` : ''}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Amount</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 text-sm">
                              {formatRs(row.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Unified card field resolution across all report modules
                  const recordId = row.invoiceNumber || (row.id ? `#${row.id}` : row.batchNumber || row.sku || `REC-${startIndex + idx + 1}`);
                  const recordDate = (row.date || row.createdAt || row.updatedAt || row.orderDate || '')?.split('T')[0] || '-';
                  const customerOrStyle = row.customerName || row.productName || row.materialName || row.supplierName || row.styleName || row.name || 'General Batch';
                  const subLabel = row.channel || row.category || row.variant || row.stage || row.cashier || '';
                  const statusVal = row.paymentMethod || row.status || (row.hasReturn ? 'Return Logged' : undefined);
                  
                  const grossVal = row.subtotal ?? row.totalPurchases ?? row.costValue ?? row.totalAmount ?? 0;
                  const discountVal = row.discount ?? 0;
                  const netVal = row.netTotal ?? row.totalAmount ?? row.totalRefund ?? row.retailValue ?? row.totalPurchases ?? 0;
                  const balanceVal = row.creditDue ?? row.outstandingBalance ?? (row.paidAmount !== undefined ? Math.max(0, netVal - row.paidAmount) : undefined);

                  return (
                    <div
                      key={row.id || `${recordId}-${idx}`}
                      onClick={() => {
                        if (activeModule === 'production') {
                          setSelectedProductionBatch(row);
                          setIsProductionBatchModalOpen(true);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs space-y-2.5 text-xs select-none transition-all ${
                        activeModule === 'production'
                          ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-slate-50/80 dark:hover:bg-zinc-850 hover:shadow-sm'
                          : ''
                      }`}
                    >
                      {/* Top Row: Transaction/Batch ID, Status, Date */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 truncate">
                            {recordId}
                          </span>
                          {statusVal && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold border-slate-300 dark:border-zinc-700">
                              {statusVal}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0">
                          <Calendar className="size-3" />
                          <span>{recordDate}</span>
                        </div>
                      </div>

                      {/* Second Row: Customer / Style */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-sm truncate block">
                            {customerOrStyle}
                          </span>
                          {subLabel && (
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate">
                              {subLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Third Row: Financial Breakdown Grid (Gross, Discount, Net, Balance) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">Gross</span>
                          <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                            {formatRs(grossVal)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">Discount</span>
                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {discountVal > 0 ? `-${formatRs(discountVal)}` : 'Rs. 0'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">Net Total</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatRs(netVal)}
                          </span>
                        </div>
                        <div className="flex flex-col sm:text-right">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">Balance / Due</span>
                          <span className={`font-mono font-bold ${
                            Number(balanceVal || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                          }`}>
                            {balanceVal !== undefined ? (Number(balanceVal) > 0 ? formatRs(balanceVal) : 'Rs. 0') : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto min-h-[360px] max-h-[520px] overflow-y-auto scrollbar-thin">
              <table className="w-full min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`border-b ${dark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-400' : 'bg-slate-100/80 border-slate-200 text-slate-600'}`}>
                    {activeModule === 'sales' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Invoice #</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Date</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[160px]">Customer</th>
                        <th className="py-2.5 px-3 font-semibold w-24 min-w-[80px] text-center">ROLE</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Subtotal</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-24 min-w-[80px]">Discount</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[110px]">Net Total</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Paid</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Due / Debt</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Method</th>
                      </>
                    )}

                    {activeModule === 'returns' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Return ID</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Date</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Invoice #</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[140px]">Customer</th>
                        <th className="py-2.5 px-3 font-semibold w-36 min-w-[120px]">Reason</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Returned Items</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">Qty</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Total Refund</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Cash</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Credit</th>
                      </>
                    )}

                    {activeModule === 'inventory' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-32 min-w-[110px]">SKU</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Product Name</th>
                        <th className="py-2.5 px-3 font-semibold w-32 min-w-[110px]">Category</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Variant</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[70px]">In Stock</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Cost Price</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Retail Price</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Cost Val.</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Retail Val.</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28 min-w-[90px]">Status</th>
                      </>
                    )}

                    {activeModule === 'products' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-32 min-w-[110px]">SKU</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Product Name</th>
                        <th className="py-2.5 px-3 font-semibold w-32 min-w-[110px]">Category</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Variant</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[70px]">Sold Qty</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Sales Revenue</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28 min-w-[80px]">Current Stock</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[80px]">Velocity</th>
                      </>
                    )}

                    {activeModule === 'materials' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Code</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Material Name</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">Unit</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Current Stock</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Alert Threshold</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Avg Unit Cost</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Total Valuation</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Scrap in Period</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[80px]">Status</th>
                      </>
                    )}

                    {activeModule === 'production' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Batch No</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Garment Style</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[90px]">Size / Color</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[70px]">Cut Units</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[70px]">Finished</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[70px]">WIP Units</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">Yield %</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Material Cost</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[90px]">Scrap Returned</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[80px]">Status</th>
                      </>
                    )}

                    {activeModule === 'suppliers' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Supplier Name</th>
                        <th className="py-2.5 px-3 font-semibold w-36 min-w-[120px]">Contact / Phone</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20 min-w-[60px]">GRNs</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Total Purchases</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Total Paid</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Outstanding Debt</th>
                      </>
                    )}

                    {activeModule === 'audit' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Invoice #</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[140px]">Customer</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Cashier</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Created Date</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Last Modified</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-24 min-w-[80px]">Delta (Min)</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28 min-w-[100px]">Amount</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28 min-w-[90px]">Has Returns</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Notes</th>
                      </>
                    )}

                    {activeModule === 'cheques' && (
                      <>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Cheque #</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[140px]">Bank Name</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Maturity Date</th>
                        <th className="py-2.5 px-3 font-semibold w-28 min-w-[100px]">Invoice #</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[160px]">Customer</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-32 min-w-[110px]">Amount</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28 min-w-[90px]">Status</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28 min-w-[100px]">Maturity Alert</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No matching records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row: any, idx: number) => {
                      const isStripe = idx % 2 === 1;
                      return (
                        <tr
                          key={idx}
                          onClick={() => {
                            if (activeModule === 'production') {
                              setSelectedProductionBatch(row);
                              setIsProductionBatchModalOpen(true);
                            }
                          }}
                          className={`transition-colors ${
                            activeModule === 'production'
                              ? 'cursor-pointer hover:bg-slate-100/90 dark:hover:bg-zinc-800/90 group/prod'
                              : 'hover:bg-blue-50/50 dark:hover:bg-zinc-800/50'
                          } ${
                            isStripe ? (dark ? 'bg-zinc-900/30' : 'bg-slate-50/50') : ''
                          }`}
                        >
                          {activeModule === 'sales' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.createdAt?.split('T')[0]}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">
                                <div className="flex items-center gap-1.5">
                                  <span>{row.customerName}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewCustomer(row.customer || { id: row.customerId, name: row.customerName, phone: row.customerPhone });
                                      setPreviewCustomerModalOpen(true);
                                    }}
                                    className="p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                                    title="Quick Customer Profile Preview"
                                    aria-label={`Preview customer profile for ${row.customerName}`}
                                  >
                                    <User size={12.5} />
                                  </button>
                                </div>
                                {row.customerPhone && row.customerPhone !== '-' && (
                                  <div className="text-[11px] text-slate-500 font-mono">{row.customerPhone}</div>
                                )}
                                {row.customerAddress && row.customerAddress !== '-' && (
                                  <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={row.customerAddress}>
                                    {row.customerAddress}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${getRoleBadgeStyle(row.userRole || row.role)}`}>
                                  {row.userRole || row.role || 'SYSTEM'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">{formatRs(row.subtotal)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">{row.discount > 0 ? `-${formatRs(row.discount)}` : '-'}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.totalAmount)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatRs(row.paidAmount)}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">{row.dueAmount > 0 ? formatRs(row.dueAmount) : '-'}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px]">
                                  {row.paymentMethod}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'returns' && (
                            <>
                              <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{row.returnId}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.returnDate?.split('T')[0]}</td>
                              <td className="py-2.5 px-3 font-mono whitespace-nowrap">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.customerName}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                  {row.reason}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400 break-words whitespace-normal">{row.itemsSummary}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{row.itemsCount}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{formatRs(row.totalRefund)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500 whitespace-nowrap">{row.cashRefund > 0 ? formatRs(row.cashRefund) : '-'}</td>
                              <td className="py-2.5 px-3 text-right text-blue-500 whitespace-nowrap">{row.creditAdjustment > 0 ? formatRs(row.creditAdjustment) : '-'}</td>
                            </>
                          )}

                          {activeModule === 'inventory' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.sku}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.productName}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.categoryName}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">{row.variant}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{row.stock}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">{formatRs(row.costPrice)}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.retailPrice)}</td>
                              <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400 whitespace-nowrap">{formatRs(row.costValuation)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">{formatRs(row.retailValuation)}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    row.status === 'In Stock'
                                      ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
                                      : row.status === 'Low Stock'
                                      ? 'text-amber-600 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
                                      : 'text-rose-600 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'
                                  }`}
                                >
                                  {row.status}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'products' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.sku}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.productName}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.categoryName}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">{row.variantName}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{row.soldQty}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.totalRevenue)}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">{row.currentStock}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    row.velocity === 'Fast'
                                      ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
                                      : row.velocity === 'Slow'
                                      ? 'text-rose-600 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'
                                      : 'text-blue-600 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20'
                                  }`}
                                >
                                  {row.velocity}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'materials' && (
                            <>
                              <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{row.code}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.name}</td>
                              <td className="py-2.5 px-3 text-center text-slate-500 uppercase text-[10px] whitespace-nowrap">{row.unit}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{row.currentStock}</td>
                              <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">{row.alertThreshold}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">{formatRs(row.unitCostAverage)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatRs(row.totalValuation)}</td>
                              <td className="py-2.5 px-3 text-right text-rose-500 whitespace-nowrap">{row.periodScrap > 0 ? `${row.periodScrap} ${row.unit}` : '-'}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    row.status === 'Optimal'
                                      ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
                                      : 'text-rose-600 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'
                                  }`}
                                >
                                  {row.status}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'production' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span>{row.productionNo}</span>
                                  <span className="text-[10px] text-slate-400 opacity-60 group-hover/prod:opacity-100 group-hover/prod:text-blue-600 transition-opacity">↗</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">
                                <div className="flex items-center gap-2">
                                  {row.productImage ? (
                                    <img
                                      src={getProductImageUrl(row.productImage)}
                                      alt=""
                                      className="size-7 rounded-md object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                                    />
                                  ) : (
                                    <div className="size-7 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-400 shrink-0">
                                      <Package className="size-3.5" />
                                    </div>
                                  )}
                                  <span className="font-semibold text-slate-900 dark:text-white">{row.productName}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.variant}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                {(() => {
                                  const cut = Number(
                                    row.cutQty > 0
                                      ? row.cutQty
                                      : (row.totalCutUnits ?? (Array.isArray(row.cutLogs) && row.cutLogs.length > 0
                                        ? row.cutLogs.reduce((acc: number, c: any) => acc + (Number(c.quantityCut) || 0), 0)
                                        : (row.completedQty || row.targetQuantity || 0)))
                                  );
                                  return (
                                    <>
                                      {formatQty(cut)}
                                      {row.cutLogsCount > 0 && (
                                        <span className="text-[10px] text-slate-400 block font-normal">({row.cutLogsCount} cuts)</span>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {(() => {
                                  const loggedFinish = Array.isArray(row.finishLogs) && row.finishLogs.length > 0
                                    ? row.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
                                    : 0;
                                  const finished = loggedFinish > 0
                                    ? loggedFinish
                                    : (Number(row.completedQty || 0) > 0
                                      ? Number(row.completedQty)
                                      : (Number(row.washedQty || 0) > 0 ? Number(row.washedQty) : (Number(row.totalFinishedUnits) || 0)));
                                  return (
                                    <>
                                      {formatQty(finished)}
                                      {row.finishLogsCount > 0 && (
                                        <span className="text-[10px] text-slate-400 block font-normal">({row.finishLogsCount} logs)</span>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {(() => {
                                  const cut = Number(
                                    row.cutQty > 0
                                      ? row.cutQty
                                      : (row.totalCutUnits ?? (Array.isArray(row.cutLogs) && row.cutLogs.length > 0
                                        ? row.cutLogs.reduce((acc: number, c: any) => acc + (Number(c.quantityCut) || 0), 0)
                                        : (row.targetQuantity || 0)))
                                  );
                                  const loggedFinish = Array.isArray(row.finishLogs) && row.finishLogs.length > 0
                                    ? row.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
                                    : 0;
                                  const finished = loggedFinish > 0
                                    ? loggedFinish
                                    : (Number(row.completedQty || 0) > 0
                                      ? Number(row.completedQty)
                                      : (Number(row.washedQty || 0) > 0 ? Number(row.washedQty) : (Number(row.totalFinishedUnits) || 0)));
                                  const wip = row.wipUnits !== undefined && Number(row.wipUnits) >= 0
                                    ? Number(row.wipUnits)
                                    : (row.status !== 'CANCELLED' && row.status !== 'COMPLETED' ? Math.max(0, cut - finished) : 0);
                                  return wip > 0 ? (
                                    <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 font-mono">
                                      {formatQty(wip)} WIP
                                    </Badge>
                                  ) : (
                                    <span className="text-slate-400 font-mono text-[11px]">-</span>
                                  );
                                })()}
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                {(() => {
                                  const cut = Number(
                                    row.cutQty > 0
                                      ? row.cutQty
                                      : (row.totalCutUnits ?? (Array.isArray(row.cutLogs) && row.cutLogs.length > 0
                                        ? row.cutLogs.reduce((acc: number, c: any) => acc + (Number(c.quantityCut) || 0), 0)
                                        : (row.targetQuantity || 0)))
                                  );
                                  const loggedFinish = Array.isArray(row.finishLogs) && row.finishLogs.length > 0
                                    ? row.finishLogs.reduce((acc: number, f: any) => acc + (Number(f.quantityFinished) || 0), 0)
                                    : 0;
                                  const finished = loggedFinish > 0
                                    ? loggedFinish
                                    : (Number(row.completedQty || 0) > 0
                                      ? Number(row.completedQty)
                                      : (Number(row.washedQty || 0) > 0 ? Number(row.washedQty) : (Number(row.totalFinishedUnits) || 0)));
                                  const yieldDivisor = cut > 0 ? cut : Number(row.targetQuantity || 0);
                                  const yieldVal = row.yieldPercentage !== undefined && Number(row.yieldPercentage) > 0
                                    ? Number(row.yieldPercentage)
                                    : (yieldDivisor > 0 ? Math.round((finished / yieldDivisor) * 10000) / 100 : 0);
                                  return `${formatQty(yieldVal)}%`;
                                })()}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono">{formatRs(row.materialCost)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap font-mono">
                                {formatQty(
                                  row.scrapReturned !== undefined && Number(row.scrapReturned) > 0
                                    ? row.scrapReturned
                                    : (Array.isArray(row.materialUsages) && row.materialUsages.length > 0
                                      ? row.materialUsages.reduce((s: number, u: any) => s + Number(u.returnedScrap ?? u.returnedQty ?? 0), 0)
                                      : (Array.isArray(row.activityLogs)
                                        ? row.activityLogs
                                            .filter((a: any) => a.action === 'RETURNED_SCRAP' || a.action === 'RETURNED')
                                            .reduce((s: number, a: any) => s + Number(a.quantity || 0), 0)
                                        : 0))
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-semibold ${
                                    row.status === 'COMPLETED' && row.isStockSynced
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                      : row.status === 'FINISHED_PENDING_STOCK' || (!row.isStockSynced && row.completedQty > 0)
                                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                                      : row.status === 'CUTTING'
                                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                                  }`}
                                >
                                  {row.status === 'COMPLETED' && row.isStockSynced ? 'IN STOCK' : row.status === 'FINISHED_PENDING_STOCK' ? 'AWAITING SYNC' : row.status}
                                </Badge>
                              </td>
                            </>
                          )}

                          {activeModule === 'suppliers' && (
                            <>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.supplierName}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.phone}</td>
                              <td className="py-2.5 px-3 text-center font-medium whitespace-nowrap">{row.grnCount}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.totalPurchases)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatRs(row.totalPaid)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{row.outstandingBalance > 0 ? formatRs(row.outstandingBalance) : '-'}</td>
                            </>
                          )}

                          {activeModule === 'audit' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">{row.customerName}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400 whitespace-nowrap">{row.cashier}</td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.createdAt?.split('T')[0]}</td>
                              <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400 whitespace-nowrap">{row.updatedAt?.split('T')[0]}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300 whitespace-nowrap">+{row.timeDeltaMinutes}m</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{formatRs(row.totalAmount)}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {row.hasReturn ? (
                                  <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/20">
                                    Return Logged
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-slate-400">
                                    Standard Edit
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400 break-words whitespace-normal">{row.userNotes}</td>
                            </>
                          )}

                          {activeModule === 'cheques' && (
                            <>
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                #{row.chequeNumber || 'N/A'}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 break-words whitespace-normal">
                                {row.bankName !== '-' ? row.bankName : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                                {row.chequeDate || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                {row.invoiceNumber || '-'}
                              </td>
                              <td className="py-2.5 px-3 break-words whitespace-normal">
                                <div className="font-medium text-slate-800 dark:text-zinc-200">{row.customerName}</div>
                                {row.customerPhone && <div className="text-[10px] text-slate-400 font-mono">{row.customerPhone}</div>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                                {formatRs(row.amount)}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold uppercase ${
                                    (row.statusLabel || row.status) === 'REALIZED' || (row.statusLabel || row.status) === 'CLEARED' || (row.statusLabel || row.status) === 'COMPLETE'
                                      ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
                                      : (row.statusLabel || row.status) === 'BOUNCED'
                                      ? 'text-rose-600 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'
                                      : 'text-amber-600 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
                                  }`}
                                >
                                  {(row.statusLabel || row.status) === 'REALIZED' || (row.statusLabel || row.status) === 'CLEARED' || (row.statusLabel || row.status) === 'COMPLETE'
                                    ? 'COMPLETE'
                                    : (row.statusLabel || row.status || 'PENDING')}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {row.maturityAlert &&
                                row.maturityAlert !== 'N/A' &&
                                (row.statusLabel || row.status) !== 'REALIZED' &&
                                (row.statusLabel || row.status) !== 'CLEARED' &&
                                (row.statusLabel || row.status) !== 'COMPLETE' ? (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      row.maturityAlert === 'OVERDUE'
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                        : row.maturityAlert === 'DUE_THIS_WEEK'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    }`}
                                  >
                                    {row.maturityAlert === 'OVERDUE' ? 'Overdue' : row.maturityAlert === 'DUE_THIS_WEEK' ? 'Due This Week' : 'Upcoming'}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">-</span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Standardized Table Pagination Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 border-t border-slate-200 dark:border-zinc-800 text-xs bg-slate-50/50 dark:bg-zinc-950/30 gap-2">
              <span className="text-slate-500 dark:text-zinc-400">
                Showing {filteredRows.length > 0 ? startIndex + 1 : 0} – {Math.min(startIndex + PAGE_SIZE, filteredRows.length)} of {filteredRows.length} records (Page {currentPage} of {totalPages})
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 text-xs font-medium border-slate-300 dark:border-zinc-700"
                >
                  <ChevronLeft className="size-3.5 mr-1" /> Prev
                </Button>
                <div className="px-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2.5 text-xs font-medium border-slate-300 dark:border-zinc-700"
                >
                  Next <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ FINANCIAL AUDIT BREAKDOWN MODAL */}
      <FinancialAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        activeMetric={auditFocusMetric}
        data={{
          grossRevenue: summary.grossRevenue || 0,
          totalDiscount: summary.totalDiscount || 0,
          totalReturns: summary.totalReturns || 0,
          netSales: summary.netSales || 0,
          totalPaid: summary.totalPaid || 0,
          totalDue: summary.totalDue || 0,
          orderCount: summary.orderCount || 0,
          averageOrderValue: summary.averageOrderValue || 0,
          paymentSplit: summary.paymentSplit || {},
          dateLabel: formattedSelectedBadge,
          totalProductionCost: summary.totalProductionCost || 0,
          totalGrnExpenses: summary.totalGrnExpenses || 0,
          totalGrnLiabilities: summary.totalGrnLiabilities || 0,
          netOperationalRevenue: summary.netOperationalRevenue,
          netOperationalProfit: summary.netOperationalProfit,
        }}
        onSelectMetric={(m) => setAuditFocusMetric(m)}
        onDownloadMasterPdf={handleDownloadFinancialAuditPdf}
        downloadingMasterPdf={downloadingFinancialAuditPdf}
      />

      {/* ⭐ INTERACTIVE PRODUCTION BATCH SUMMARY MODAL */}
      <Dialog open={isProductionBatchModalOpen} onOpenChange={setIsProductionBatchModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 flex items-center justify-center">
                {selectedProductionBatch?.productImage ? (
                  <img
                    src={getProductImageUrl(selectedProductionBatch.productImage)}
                    alt={selectedProductionBatch.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="size-6 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>{selectedProductionBatch?.productName}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    #{selectedProductionBatch?.productionNo}
                  </Badge>
                  {selectedProductionBatch?.isStockSynced ? (
                    <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
                      COMPLETED &amp; IN STOCK
                    </Badge>
                  ) : selectedProductionBatch?.completedQty > 0 ? (
                    <Badge variant="outline" className="text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800">
                      AWAITING STOCK SYNC
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800">
                      {selectedProductionBatch?.status || 'CUTTING'}
                    </Badge>
                  )}
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Variant: {selectedProductionBatch?.variant || 'Standard'} · Production Date: {selectedProductionBatch?.productionDate ? new Date(selectedProductionBatch.productionDate).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          </DialogHeader>

          {selectedProductionBatch && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* Batch Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Planned Target</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-zinc-300 text-sm">
                    {formatQty(selectedProductionBatch.targetQuantity)} Pcs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-600 block">Materials Cut</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {formatQty(selectedProductionBatch.cutQty ?? selectedProductionBatch.totalCutUnits ?? selectedProductionBatch.completedQty ?? 0)} Units
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 block">Garments Finished</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatQty(selectedProductionBatch.washedQty ?? selectedProductionBatch.completedQty ?? 0)} Pcs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 block">Yield / Efficiency</span>
                  <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                    {selectedProductionBatch.yieldPercentage !== undefined && selectedProductionBatch.yieldPercentage > 0
                      ? `${formatQty(selectedProductionBatch.yieldPercentage)}%`
                      : (() => {
                          const cut = Number(selectedProductionBatch.cutQty ?? selectedProductionBatch.totalCutUnits ?? selectedProductionBatch.targetQuantity ?? 0);
                          const finished = Number(selectedProductionBatch.washedQty ?? selectedProductionBatch.completedQty ?? 0);
                          return cut > 0 ? `${formatQty(Math.round((finished / cut) * 1000) / 10)}%` : '0%';
                        })()}
                  </span>
                </div>
              </div>

              {/* Second Row Metrics: WIP, Cost, Scrap, Stock Sync */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 text-center">
                <div>
                  <span className="text-[10px] font-bold text-amber-600 uppercase block">Remaining WIP</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatQty(selectedProductionBatch.wipUnits !== undefined
                      ? selectedProductionBatch.wipUnits
                      : (() => {
                          const cut = Number(selectedProductionBatch.cutQty ?? selectedProductionBatch.totalCutUnits ?? selectedProductionBatch.targetQuantity ?? 0);
                          const finished = Number(selectedProductionBatch.washedQty ?? selectedProductionBatch.completedQty ?? 0);
                          return Math.max(0, cut - finished);
                        })())} Pcs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Material Cost</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatRs(selectedProductionBatch.materialCost || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-teal-600 uppercase block">Scrap Returned</span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                    {formatQty(selectedProductionBatch.scrapReturned ?? (Array.isArray(selectedProductionBatch.materialUsages) ? selectedProductionBatch.materialUsages.reduce((s: number, u: any) => s + Number(u.returnedScrap ?? u.returnedQty ?? 0), 0) : 0))} Units
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-purple-600 uppercase block">Inventory Status</span>
                  <span className={`font-mono font-bold text-xs ${selectedProductionBatch.isStockSynced ? 'text-emerald-600' : 'text-purple-600'}`}>
                    {selectedProductionBatch.isStockSynced ? 'Confirmed in Stock' : 'Pending Sync'}
                  </span>
                </div>
              </div>

              {/* Raw Material Consumption Breakdown Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-500" />
                  Raw Material Consumption &amp; Cost Breakdown
                </h4>
                {selectedProductionBatch.materialUsages && selectedProductionBatch.materialUsages.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-zinc-900 text-[10px] font-bold uppercase">
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Issued</TableHead>
                          <TableHead className="text-right">Returned</TableHead>
                          <TableHead className="text-right">Net Consumed</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead className="text-right">Line Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedProductionBatch.materialUsages.map((u: any) => {
                          const unit = u.rawMaterial?.unit || 'Units';
                          const lineCost = (Number(u.netConsumedQty) || 0) * (Number(u.unitCost) || 0);
                          return (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium text-slate-900 dark:text-white">
                                {u.rawMaterial?.name}
                                {u.rawMaterial?.code && (
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    {u.rawMaterial.code}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-700 dark:text-zinc-300">
                                {formatQty(u.issuedQty ?? 0)} {unit}
                              </TableCell>
                              <TableCell className="text-right font-mono text-teal-600 dark:text-teal-400 font-semibold">
                                {formatQty(u.returnedScrap ?? u.returnedQty ?? 0)} {unit}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-white">
                                {formatQty(u.netConsumedQty ?? 0)} {unit}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-500">
                                {formatRs(u.unitCost || 0)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-zinc-100">
                                {formatRs(lineCost)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-slate-400 italic py-2">No material usages recorded for this batch.</p>
                )}
              </div>

              {/* Complete BatchActivityTimeline */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Chronological Batch Lifecycle Timeline
                </h4>
                <div className="bg-slate-50 dark:bg-zinc-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                  <BatchActivityTimeline order={selectedProductionBatch} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950 z-10 flex-row justify-end">
            <Button
              variant="outline"
              onClick={() => setIsProductionBatchModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Customer Profile Preview Modal */}
      <CustomerPreviewModal
        open={previewCustomerModalOpen}
        onClose={() => setPreviewCustomerModalOpen(false)}
        customer={previewCustomer}
      />
    </div>
  );
};

export default ReportsPage;
