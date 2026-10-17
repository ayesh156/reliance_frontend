import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "./ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationMenu } from "./common/NotificationMenu";
import {
  Globe,
  User,
  Shield,
  LogOut,
  ExternalLink,
} from "lucide-react";

export const Layout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, logout, isAdmin } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AD";

  return (
   <SidebarProvider 
      defaultOpen={false}
      style={{
        "--sidebar-width": "11rem",
      } as React.CSSProperties}
    >
      {/* Official Shadcn Collapsible App Sidebar - Default closed for maximized POS workspace */}
      <AppSidebar />

      {/* Main Fluid Inset */}
      <SidebarInset>
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 px-3 sm:px-4 lg:px-8 backdrop-blur-md transition-colors gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <SidebarTrigger className="-ml-1 shrink-0" />
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-zinc-800 mx-1 sm:mx-2 shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold tracking-tight text-slate-700 dark:text-zinc-200 uppercase truncate">
              Retail & Wholesale Suite
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Global Real-Time SSE Notification Bell */}
            <NotificationMenu />

            {/* Visit Store */}
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 transition-all shrink-0"
              title="Visit Storefront"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Store</span>
              <ExternalLink className="w-3 h-3 opacity-60 hidden sm:inline shrink-0" />
            </button>

            {/* Unified Theme Selector (Light, Dark, System) */}
            <ThemeToggle className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 shrink-0" />

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200 dark:border-zinc-800 cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shadow-sm">
                  {initials}
                </div>
                <div className="hidden sm:block text-left pr-1">
                  <p className="text-xs font-bold leading-tight text-slate-900 dark:text-white">
                    {user?.name || "Admin"}
                  </p>
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 border rounded-xl shadow-2xl z-50 overflow-hidden bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white">
                  <div className="px-3 py-2.5 border-b border-slate-100 dark:border-zinc-800">
                    <p className="text-xs font-bold">{user?.name || "Admin"}</p>
                    <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                      {user?.email || "staff@reliance.lk"}
                    </p>
                  </div>
                  <div className="py-1 text-xs">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/system/settings");
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 font-medium hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    >
                      <User className="w-3.5 h-3.5" /> Profile Settings
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          navigate("/system/settings");
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 font-medium hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      >
                        <Shield className="w-3.5 h-3.5" /> Staff Access
                      </button>
                    )}
                  </div>
                  <div className="border-t border-slate-100 dark:border-zinc-800">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                        navigate("/login");
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Fluid Content Body */}
        <main className="flex-1 w-full px-2 py-3 sm:px-4 sm:py-4 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
