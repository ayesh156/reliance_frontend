import React from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  ShoppingBag,
  Settings,
  Tags,
  Users,
  MonitorSmartphone,
  FileText,
  Building2,
  Boxes,
  ShoppingCart,
  Factory,
  BarChart3,
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
  roles?: string[]; // If undefined, accessible to all authenticated users
}

const navItems: NavItem[] = [
  { label: "Quick Invoice", path: "/system/quick-invoice", icon: MonitorSmartphone }, 
  { label: "Invoices", path: "/system/invoices", icon: FileText },
  { label: "Products", path: "/system/products", icon: ShoppingBag },
  { label: "Attributes", path: "/system/attributes", icon: Tags, roles: ["ADMIN", "STAFF"] },
  { label: "Customers", path: "/system/customers", icon: Users },
  { label: "Stock Purchases", path: "/system/buy-raw-materials", icon: ShoppingCart, roles: ["ADMIN"] },
  { label: "Suppliers (Shops)", path: "/system/raw-material-shops", icon: Building2, roles: ["ADMIN"] },
  { label: "Raw Materials", path: "/system/raw-material-items", icon: Boxes, roles: ["ADMIN"] }, 
  { label: "Production", path: "/system/production", icon: Factory, roles: ["ADMIN", "STAFF"] },
  { label: "Reports & Analytics", path: "/system/reports", icon: BarChart3, roles: ["ADMIN", "STAFF", "REP"] },
  { label: "Settings", path: "/system/settings", icon: Settings, roles: ["ADMIN", "REP"] },
];

export function AppSidebar() {
  const { user } = useAuth()
  const location = useLocation()

  const userRole = user?.role || "STAFF"

  // RBAC Pruning: Non-privileged links are pruned completely from the DOM
  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true
    if (userRole === "ADMIN") return true
    return item.roles.includes(userRole)
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