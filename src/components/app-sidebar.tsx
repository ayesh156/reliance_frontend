import React from "react"
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

const navItems: NavItem[] = [
  { label: "Quick Invoice", path: "/system/quick-invoice", icon: MonitorSmartphone, permission: "pos" }, 
  { label: "Invoices", path: "/system/invoices", icon: FileText, permission: "invoices" },
  { label: "Orders", path: "/system/orders", icon: ClipboardList, permission: "orders" },
  { label: "Products", path: "/system/products", icon: ShoppingBag, permission: "products" },
  { label: "Attributes", path: "/system/attributes", icon: Tags, permission: "products", roles: ["ADMIN", "STAFF"] },
  { label: "Customers", path: "/system/customers", icon: Users, permission: "customers" },
  { label: "Stock Purchases", path: "/system/buy-raw-materials", icon: ShoppingCart, permission: "materials" },
  { label: "Suppliers (Shops)", path: "/system/raw-material-shops", icon: Building2, permission: "materials" },
  { label: "Raw Materials", path: "/system/raw-material-items", icon: Boxes, permission: "materials" }, 
  { label: "Production", path: "/system/production", icon: Factory, permission: "production" },
  { label: "Sewing Line", path: "/system/line", icon: Shirt, permission: "line" },
  { label: "Wash", path: "/system/wash", icon: Waves, permission: "wash" },
  { label: "Reports & Analytics", path: "/system/reports", icon: BarChart3, permission: "reports" },
  { label: "Settings", path: "/system/settings", icon: Settings, permission: "settings" },
];

export function AppSidebar() {
  const { user } = useAuth()
  const location = useLocation()

  const userRole = user?.role || "STAFF"
  const permissions = user?.permissions || (userRole === "STAFF" ? ["production", "line", "wash", "materials"] : [])

  // RBAC Pruning:
  // - Administrators see EVERYTHING.
  // - If a user is Staff and lacks the permission string for a specific module, hide that link completely.
  const visibleNavItems = navItems.filter((item) => {
    if (userRole === "ADMIN") return true

    // Admin-only modules
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
      return permissions.includes(item.permission)
    }

    return true
  })

  return (
    <Sidebar collapsible="icon">
  {/* Brand Header */}
      <SidebarHeader className="border-b border-slate-100 dark:border-zinc-800/80 h-14 flex justify-center">
        <div className="flex items-center gap-2.5 px-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {/* Stylized Modern Rounded Black Square Logo Badge */}
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

      {/* Compact Nav Items */}
      <SidebarContent>
        <SidebarMenu>
          {visibleNavItems.map((item) => {
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
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}