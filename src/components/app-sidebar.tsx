import React from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  ShoppingBag,
  Settings,
  Tags,
  Users,
  MonitorSmartphone,
  FileText,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"

const navItems = [
  { label: "Quick Checkout", path: "/system/quick-checkout", icon: MonitorSmartphone }, // ⭐ Active Cashier Terminal
  { label: "Invoices", path: "/system/invoices", icon: FileText }, // ⭐ Active Cashier Terminal
  { label: "Products", path: "/system/products", icon: ShoppingBag },
  { label: "Attributes", path: "/system/attributes", icon: Tags },
  { label: "Customers", path: "/system/customers", icon: Users },
  { label: "Settings", path: "/system/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation()

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
          {navItems.map((item) => {
            const isActive =
              item.path === "/system"
                ? location.pathname === "/system"
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