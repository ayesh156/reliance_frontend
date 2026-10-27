import React, { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  ShoppingBag,
  Settings,
  Tags,
  Users,
  MonitorSmartphone,
  FileText,
  ClipboardList,
  Building2,
  Boxes,
  ShoppingCart,
  Factory,
  BarChart3,
  Waves,
  Shirt,
  Scissors,
  ChevronDown,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
  roles?: string[]; // If undefined, accessible to all authenticated users
}

interface ProductionSubItem {
  label: string;
  path: string;
  icon: React.ElementType;
  permission: string;
}

const mainNavItems: NavItem[] = [
  { label: "Quick Invoice", path: "/system/quick-invoice", icon: MonitorSmartphone, permission: "pos" }, 
  { label: "Invoices", path: "/system/invoices", icon: FileText, permission: "invoices" },
  { label: "Orders", path: "/system/orders", icon: ClipboardList, permission: "orders" },
  { label: "Products", path: "/system/products", icon: ShoppingBag, permission: "products" },
  { label: "Attributes", path: "/system/attributes", icon: Tags, permission: "products", roles: ["ADMIN", "STAFF"] },
  { label: "Customers", path: "/system/customers", icon: Users, permission: "customers" },
  { label: "Stock Purchases", path: "/system/buy-raw-materials", icon: ShoppingCart, permission: "materials" },
  { label: "Suppliers (Shops)", path: "/system/raw-material-shops", icon: Building2, permission: "materials" },
  { label: "Raw Materials", path: "/system/raw-material-items", icon: Boxes, permission: "materials" },
];

const productionSubItems: ProductionSubItem[] = [
  { label: "Cutting", path: "/system/cutting", icon: Scissors, permission: "cutting" },
  { label: "Line", path: "/system/line", icon: Shirt, permission: "line" },
  { label: "Wash", path: "/system/wash", icon: Waves, permission: "wash" },
];

const bottomNavItems: NavItem[] = [
  { label: "Reports & Analytics", path: "/system/reports", icon: BarChart3, permission: "reports" },
  { label: "Settings", path: "/system/settings", icon: Settings, permission: "settings" },
];

export function AppSidebar() {
  const { user } = useAuth()
  const location = useLocation()

  const userRole = user?.role || "STAFF"
  const permissions = user?.permissions || (userRole === "STAFF" ? ["production", "cutting", "line", "wash", "materials"] : [])

  const isProductionActive =
    location.pathname.startsWith("/system/cutting") ||
    location.pathname.startsWith("/system/production") ||
    location.pathname.startsWith("/system/line") ||
    location.pathname.startsWith("/system/wash")

  const [productionOpen, setProductionOpen] = useState(true)

  const filterItem = (item: { permission?: string; roles?: string[] }) => {
    if (userRole === "ADMIN") return true

    if (item.roles && item.roles.length === 1 && item.roles[0] === "ADMIN" && userRole !== "ADMIN") {
      return false
    }

    if (item.roles && !item.roles.includes(userRole)) {
      if (userRole === "STAFF" && item.permission && permissions.includes(item.permission)) {
        return true
      }
      return false
    }

    if (userRole === "STAFF" && item.permission) {
      if (item.permission === "cutting" && (permissions.includes("cutting") || permissions.includes("production"))) {
        return true
      }
      return permissions.includes(item.permission)
    }

    return true
  }

  const visibleMainNavItems = mainNavItems.filter(filterItem)
  const visibleProductionSubItems = productionSubItems.filter(filterItem)
  const visibleBottomNavItems = bottomNavItems.filter(filterItem)

  const canSeeProduction = visibleProductionSubItems.length > 0

  return (
    <Sidebar collapsible="icon">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-slate-100 dark:border-zinc-800/80 h-14 flex justify-center">
        <div className="flex items-center gap-2.5 px-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden shadow-sm">
            <img 
              src="/images/logo.jpg" 
              alt="Reliance Logo" 
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain pointer-events-none" 
            />
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-display font-bold tracking-[0.16em] uppercase text-xs text-slate-900 dark:text-zinc-100">
              RELIANCE
            </span>
            <span className="truncate text-[8px] font-semibold tracking-wider text-slate-400 dark:text-zinc-500 uppercase">
              POS SYSTEM
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Nav Items */}
      <SidebarContent>
        <SidebarMenu>
          {visibleMainNavItems.map((item) => {
            const isActive =
              item.path === "/system"
                ? location.pathname === "/system"
                : item.path === "/system/quick-invoice"
                ? (location.pathname.startsWith("/system/quick-invoice") || location.pathname.startsWith("/system/quick-checkout"))
                : location.pathname.startsWith(item.path)

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                  <NavLink to={item.path} className="flex items-center gap-2.5 w-full">
                    <item.icon className="size-4 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden truncate">
                      {item.label}
                    </span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}

          {/* Grouped / Collapsible "Production" Section */}
          {canSeeProduction && (
            <div className="pt-2 pb-1">
              {/* Expanded Mode: Collapsible Header */}
              <div className="group-data-[collapsible=icon]:hidden">
                <button
                  type="button"
                  onClick={() => setProductionOpen((prev) => !prev)}
                  className={`flex items-center justify-between w-full px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer select-none ${
                    isProductionActive
                      ? "text-cyan-700 dark:text-cyan-400 bg-cyan-50/60 dark:bg-cyan-950/20"
                      : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Factory className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>Production</span>
                  </div>
                  <ChevronDown
                    className={`size-3.5 transition-transform duration-200 ${
                      productionOpen ? "transform rotate-0" : "transform -rotate-90"
                    }`}
                  />
                </button>
              </div>

              {/* Collapsed (Icon-Only) Mode: Pill Container Divider & Group Indicator */}
              <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center my-1.5">
                <div className="w-6 h-px bg-slate-200 dark:bg-zinc-800" />
                <div className="my-1 size-1.5 rounded-full bg-cyan-500/80 shadow-xs" title="Production Pipeline" />
              </div>

              {/* Nested Production Items: Shown when open in expanded mode, ALWAYS shown in icon-only collapsed mode */}
              <div
                className={`${
                  productionOpen ? "block" : "hidden group-data-[collapsible=icon]:block"
                } mt-1 space-y-0.5 group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:space-y-1 sm:pl-2 group-data-[collapsible=icon]:pl-0 group-data-[collapsible=icon]:py-1 group-data-[collapsible=icon]:bg-slate-50/80 dark:group-data-[collapsible=icon]:bg-zinc-900/50 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:border group-data-[collapsible=icon]:border-slate-200/60 dark:group-data-[collapsible=icon]:border-zinc-800/60`}
              >
                {visibleProductionSubItems.map((sub) => {
                  const isSubActive =
                    sub.path === "/system/cutting"
                      ? location.pathname.startsWith("/system/cutting") || location.pathname.startsWith("/system/production")
                      : location.pathname.startsWith(sub.path)

                  const collapsedTooltip =
                    sub.path === "/system/cutting"
                      ? "Production • Cutting"
                      : sub.path === "/system/line"
                      ? "Production • Sewing Line"
                      : "Production • Wash Stage"

                  return (
                    <SidebarMenuItem key={sub.path}>
                      <SidebarMenuButton asChild isActive={isSubActive} tooltip={collapsedTooltip}>
                        <NavLink
                          to={sub.path}
                          className={`flex items-center gap-2.5 w-full ${
                            isSubActive
                              ? "font-semibold text-cyan-700 dark:text-cyan-300"
                              : "text-slate-600 dark:text-zinc-400"
                          }`}
                        >
                          <sub.icon className="size-3.5 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden truncate">
                            {sub.label}
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </div>

              {/* Collapsed Mode Bottom Divider */}
              <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center my-1.5">
                <div className="w-6 h-px bg-slate-200 dark:bg-zinc-800" />
              </div>
            </div>
          )}

          {/* Bottom Nav Items (Reports & Settings) */}
          {visibleBottomNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                  <NavLink to={item.path} className="flex items-center gap-2.5 w-full">
                    <item.icon className="size-4 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden truncate">
                      {item.label}
                    </span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}