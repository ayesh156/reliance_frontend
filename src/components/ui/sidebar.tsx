import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { PanelLeft } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar:state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "13.5rem" // 216px
const SIDEBAR_WIDTH_MOBILE = "16rem"
const SIDEBAR_WIDTH_ICON = "4rem" // 64px
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      },
      [setOpenProp, open]
    )

    const [openMobile, setOpenMobile] = React.useState(false)
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 1024)
      checkMobile()
      window.addEventListener("resize", checkMobile)
      return () => window.removeEventListener("resize", checkMobile)
    }, [])

    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile((prev) => !prev) : setOpen((prev) => !prev)
    }, [isMobile, setOpen, setOpenMobile])

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          toggleSidebar()
        }
      }
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <div
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn("group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-slate-50 dark:has-[[data-variant=inset]]:bg-zinc-950", className)}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
  }
>(({ side = "left", variant = "sidebar", collapsible = "icon", className, children, ...props }, ref) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div className={cn("flex h-full w-[--sidebar-width] flex-col bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100", className)} ref={ref} {...props}>
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      openMobile ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpenMobile(false)}>
          <div
            className="fixed inset-y-0 left-0 z-50 flex h-full w-[--sidebar-width-mobile] flex-col bg-white dark:bg-zinc-950 p-4 shadow-2xl border-r border-slate-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      ) : null
    )
  }

  return (
    <div
      ref={ref}
      className="group peer hidden lg:block text-slate-900 dark:text-zinc-100"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
    >
      <div
        className={cn(
          "duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-in-out",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          "group-data-[collapsible=icon]:w-[--sidebar-width-icon]"
        )}
      />
      <div
        className={cn(
          "duration-200 fixed inset-y-0 z-40 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-in-out lg:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          "group-data-[collapsible=icon]:w-[--sidebar-width-icon] border-r border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950",
          className
        )}
        {...props}
      >
        <div className="flex h-full w-full flex-col">{children}</div>
      </div>
    </div>
  )
})
Sidebar.displayName = "Sidebar"

export const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-lg", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col p-2", className)} {...props} />
)
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 py-1.5 scrollbar-none", className)} {...props} />
  )
)
SidebarContent.displayName = "SidebarContent"

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => <ul ref={ref} className={cn("flex w-full min-w-0 flex-col gap-0.5", className)} {...props} />
)
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("group/menu-item relative flex w-full justify-center", className)} {...props} />
)
SidebarMenuItem.displayName = "SidebarMenuItem"

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string
  }
>(({ asChild = false, isActive = false, tooltip, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const { state } = useSidebar()

  const button = (
    <Comp
      ref={ref}
      className={cn(
        // Base button styling
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 h-[34px] text-xs font-medium outline-none transition-colors",
        // Inactive State Styling (with hover)
        !isActive && "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/80",
        // Active State Styling (Clean Pill & High Contrast on Hover)
        isActive && "bg-zinc-950 text-white hover:bg-zinc-900 hover:text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 dark:hover:text-zinc-950 font-semibold shadow-sm",
        // Collapsed Icon Centering
        "group-data-[collapsible=icon]:!size-8.5 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center",
        className
      )}
      {...props}
    />
  )

  if (!tooltip || state !== "collapsed") {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center" sideOffset={10}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

export const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<"main">>(
  ({ className, ...props }, ref) => (
    <main
      ref={ref}
      className={cn(
        "relative flex min-h-svh flex-1 flex-col bg-slate-50 dark:bg-zinc-950 w-full min-w-0 transition-all duration-200",
        className
      )}
      {...props}
    />
  )
)
SidebarInset.displayName = "SidebarInset"