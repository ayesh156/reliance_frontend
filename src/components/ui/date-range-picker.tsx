import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

interface DateRangePickerProps {
  date: DateRange | undefined;
  onDateChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  date,
  onDateChange,
  placeholder = 'Select date range',
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [viewDate, setViewDate] = useState<Date>(date?.from || new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  useEffect(() => {
    if (date?.from) setViewDate(date.from);
  }, [date?.from]);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const calendarHeight = 360;
      const calendarWidth = 320;
      const spaceBelow = window.innerHeight - rect.bottom;

      let top = rect.bottom + 6;
      if (spaceBelow < calendarHeight && rect.top > calendarHeight) {
        top = rect.top - calendarHeight - 6;
      }

      let left = rect.left;
      if (left + calendarWidth > window.innerWidth - 12) {
        left = window.innerWidth - calendarWidth - 12;
      }
      left = Math.max(12, left);

      setCoords({ top, left });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollResize, true);
      window.addEventListener('resize', handleScrollResize);
      return () => {
        window.removeEventListener('scroll', handleScrollResize, true);
        window.removeEventListener('resize', handleScrollResize);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handleOutsideClick, true);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick, true);
    };
  }, [isOpen]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const daysMatrix: { day: number; isCurrentMonth: boolean; dateObj: Date }[] = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    daysMatrix.push({
      day: d,
      isCurrentMonth: false,
      dateObj: new Date(currentYear, currentMonth - 1, d),
    });
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    daysMatrix.push({
      day: d,
      isCurrentMonth: true,
      dateObj: new Date(currentYear, currentMonth, d),
    });
  }

  const remainingSlots = 42 - daysMatrix.length;
  for (let d = 1; d <= remainingSlots; d++) {
    daysMatrix.push({
      day: d,
      isCurrentMonth: false,
      dateObj: new Date(currentYear, currentMonth + 1, d),
    });
  }

  const isSameDay = (d1?: Date, d2?: Date) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isBetween = (target: Date, start?: Date, end?: Date) => {
    if (!start || !end) return false;
    const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const min = Math.min(s, e);
    const max = Math.max(s, e);
    return t > min && t < max;
  };

  const handleDateClick = (selected: Date) => {
    if (!date?.from || (date.from && date.to)) {
      // Start fresh selection
      onDateChange({ from: selected, to: undefined });
    } else if (date.from && !date.to) {
      // Complete selection
      if (selected.getTime() < date.from.getTime()) {
        onDateChange({ from: selected, to: date.from });
      } else {
        onDateChange({ from: date.from, to: selected });
      }
      setIsOpen(false);
    }
  };

  const setPreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_30_days' | 'clear') => {
    const now = new Date();
    if (preset === 'clear') {
      onDateChange(undefined);
      setIsOpen(false);
      return;
    }

    if (preset === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      onDateChange({ from: today, to: today });
    } else if (preset === 'yesterday') {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      onDateChange({ from: y, to: y });
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      onDateChange({ from: startOfWeek, to: endOfWeek });
    } else if (preset === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      onDateChange({ from: startOfMonth, to: endOfMonth });
    } else if (preset === 'last_30_days') {
      const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      onDateChange({ from: past, to: now });
    }
    setIsOpen(false);
  };

  const formatDateStr = (d?: Date) => {
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const displayText = () => {
    if (!date?.from) return placeholder;
    if (date.from && !date.to) return `${formatDateStr(date.from)} - ...`;
    if (isSameDay(date.from, date.to)) return formatDateStr(date.from);
    return `${formatDateStr(date.from)} – ${formatDateStr(date.to)}`;
  };

  const today = new Date();

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={cn(
          "w-full h-9 flex items-center justify-between text-left font-normal text-xs px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-zinc-600",
          !date?.from && "text-slate-400 dark:text-zinc-500",
          date?.from && "text-slate-900 dark:text-zinc-100 font-medium",
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="size-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
          <span className="truncate">{displayText()}</span>
        </div>
        {date?.from && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onDateChange(undefined);
            }}
            className="p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors ml-1"
            title="Clear date range"
          >
            <X className="size-3" />
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
              pointerEvents: 'auto',
            }}
            className="w-[320px] rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-3 animate-in fade-in-0 zoom-in-95 duration-100 ring-1 ring-black/5 dark:ring-white/10"
          >
            {/* Quick Presets Row */}
            <div className="flex items-center gap-1 pb-2.5 mb-2 border-b border-slate-100 dark:border-zinc-800/80 overflow-x-auto">
              <button
                type="button"
                onClick={() => setPreset('today')}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setPreset('this_week')}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setPreset('this_month')}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setPreset('last_30_days')}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              >
                Last 30 Days
              </button>
            </div>

            {/* Header / Month navigation */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-zinc-800/80">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 ml-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 text-center mb-1">
              {DAYS.map((d) => (
                <span key={d} className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                  {d}
                </span>
              ))}
            </div>

            {/* Days Matrix */}
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {daysMatrix.map((item, index) => {
                const isFrom = isSameDay(item.dateObj, date?.from);
                const isTo = isSameDay(item.dateObj, date?.to);
                const isSelectedEndpoint = isFrom || isTo;

                // Active range or hover range preview
                const effectiveEnd = date?.to || (date?.from && hoverDate ? hoverDate : undefined);
                const inRange = date?.from && effectiveEnd ? isBetween(item.dateObj, date.from, effectiveEnd) : false;
                const isCurrent = isSameDay(item.dateObj, today);

                return (
                  <div
                    key={index}
                    className={cn(
                      "relative py-0.5 flex items-center justify-center",
                      inRange && "bg-slate-100 dark:bg-zinc-800/60 rounded-none",
                      isFrom && date?.to && !isSameDay(date.from, date.to) && "rounded-l-lg bg-slate-100 dark:bg-zinc-800/60",
                      isTo && date?.from && !isSameDay(date.from, date.to) && "rounded-r-lg bg-slate-100 dark:bg-zinc-800/60"
                    )}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => {
                        if (date?.from && !date?.to) {
                          setHoverDate(item.dateObj);
                        }
                      }}
                      onClick={() => handleDateClick(item.dateObj)}
                      className={cn(
                        "size-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer font-medium select-none relative z-10",
                        !item.isCurrentMonth && "text-slate-300 dark:text-zinc-600",
                        item.isCurrentMonth && !isSelectedEndpoint && "text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700",
                        isCurrent && !isSelectedEndpoint && "border border-slate-400 dark:border-zinc-600 font-bold",
                        isSelectedEndpoint && "bg-slate-900 text-white dark:bg-white dark:text-zinc-900 font-bold shadow-xs hover:opacity-90"
                      )}
                    >
                      {item.day}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
              <span className="text-slate-400 dark:text-zinc-500">
                {date?.from && !date?.to ? 'Click end date' : date?.from && date?.to ? 'Range selected' : 'Pick start date'}
              </span>
              {date?.from && (
                <button
                  type="button"
                  onClick={() => setPreset('clear')}
                  className="text-slate-400 hover:text-rose-500 flex items-center gap-0.5 cursor-pointer"
                >
                  <X className="size-3" /> Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
