import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePicker: React.FC<DatePickerProps> = ({
  date,
  onDateChange,
  placeholder = 'Pick a date',
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [viewDate, setViewDate] = useState<Date>(date || new Date());

  useEffect(() => {
    if (date) setViewDate(date);
  }, [date]);

  // Screen Coordinates ගණනය කර Modal එකේ Overflow එකෙන් පිටත නිරවද්‍යව පිහිටුවීම
  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const calendarHeight = 320;
      const calendarWidth = 280;
      const spaceBelow = window.innerHeight - rect.bottom;

      let top = rect.bottom + 6;
      // පහළ ඉඩ මදි නම් ඉහළින් විවෘත කිරීම
      if (spaceBelow < calendarHeight && rect.top > calendarHeight) {
        top = rect.top - calendarHeight - 6;
      }

      // තිරයේ දකුණු සීමාව ඉක්මවා නොයන සේ සකස් කිරීම
      let left = rect.left;
      if (left + calendarWidth > window.innerWidth - 12) {
        left = window.innerWidth - calendarWidth - 12;
      }
      left = Math.max(12, left);

      setCoords({ top, left });
    }
  }, []);

  // Modal එක scroll වන විට හෝ window resize වන විට calendar එක trigger button එක සමඟම රැඳී සිටීම
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

  // Handle outside click safely without swallowing day selection clicks
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
      // capture: true යෙදීමෙන් Radix Dialog trap එකට පෙර outside click නිවැරදිව හඳුනා ගනී
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

  const today = new Date();

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={cn(
          "w-full h-8 sm:h-9 flex items-center justify-between text-left font-normal text-xs px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500",
          !date && "text-slate-400",
          className
        )}
      >
        <span className="truncate font-mono">
          {date
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            : placeholder}
        </span>
        <CalendarIcon className="size-4 text-slate-400 shrink-0 ml-2" />
      </button>

      {/* ⭐ Document Body එක මත Render වන Portal Popover (Click Selection 100% ක්‍රියාත්මක වේ) */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            // Radix modal event interception වැළැක්වීම
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
              pointerEvents: 'auto',
            }}
            className="w-[280px] rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-3 animate-in fade-in-0 zoom-in-95 duration-100 ring-1 ring-black/5 dark:ring-white/10"
          >
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="p-1 ml-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close Calendar"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center mb-1">
            {DAYS.map((d) => (
              <span key={d} className="text-[10px] font-semibold text-slate-400">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {daysMatrix.map((item, index) => {
              const selected = isSameDay(item.dateObj, date);
              const isToday = isSameDay(item.dateObj, today);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    onDateChange(item.dateObj);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "size-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer font-medium select-none",
                    !item.isCurrentMonth && "text-slate-300 dark:text-zinc-600",
                    item.isCurrentMonth && !selected && "text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800",
                    isToday && !selected && "border border-emerald-500 text-emerald-600 font-bold",
                    selected && "bg-emerald-600 text-white font-bold shadow-xs hover:bg-emerald-700"
                  )}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
            <button
              type="button"
              onClick={() => {
                onDateChange(new Date());
                setIsOpen(false);
              }}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
            >
              Today
            </button>
            {date && (
              <button
                type="button"
                onClick={() => {
                  onDateChange(undefined);
                  setIsOpen(false);
                }}
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