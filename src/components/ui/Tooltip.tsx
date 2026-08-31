import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // Core Layout & Animation
        "z-[99999] overflow-visible rounded-md px-3 py-1.5 text-xs font-medium shadow-md transition-all duration-150 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        // Inverted Theme Contrast (Light = Dark Pill / Dark = White Pill)
        "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border border-zinc-800/80 dark:border-zinc-200",
        className
      )}
      {...props}
    >
      {children}
      {/* Official Shadcn Arrow Pointer */}
      <TooltipPrimitive.Arrow 
        width={11} 
        height={5} 
        className="fill-zinc-950 dark:fill-white" 
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** Convenient Wrapper */
export function TooltipSimple({
  children,
  content,
  side = 'right',
  disabled = false,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
}) {
  if (disabled || !content) return <>{children}</>;

  return (
    <Tooltip delayDuration={50}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };