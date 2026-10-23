import React, { useState, useEffect, useRef } from 'react';
import { DatePicker } from './date-picker';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DateTimePickerProps {
  value: string; // ISO datetime string: "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Enterprise standard Date & Time picker in 12-hour format (YYYY-MM-DD HH:mm AM/PM)
 */
export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  className,
  disabled = false,
}) => {
  const minuteInputRef = useRef<HTMLInputElement>(null);

  // Backup state to restore previous value if user leaves without typing
  const prevHourRef = useRef<string>('12');
  const prevMinuteRef = useRef<string>('00');

  const parseParts = (val: string) => {
    try {
      const d = val ? new Date(val) : new Date();
      const targetDate = isNaN(d.getTime()) ? new Date() : d;

      let h = targetDate.getHours();
      const m = String(targetDate.getMinutes()).padStart(2, '0');
      const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;

      return {
        dateObj: targetDate,
        hour12: String(h).padStart(2, '0'),
        minute: m,
        period: p,
      };
    } catch {
      const now = new Date();
      let h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;

      return {
        dateObj: now,
        hour12: String(h).padStart(2, '0'),
        minute: m,
        period: p,
      };
    }
  };

  const initial = parseParts(value);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initial.dateObj);
  const [hour, setHour] = useState<string>(initial.hour12);
  const [minute, setMinute] = useState<string>(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);

  useEffect(() => {
    if (value) {
      const parts = parseParts(value);
      setSelectedDate(parts.dateObj);
      setHour(parts.hour12);
      setMinute(parts.minute);
      setPeriod(parts.period);
      prevHourRef.current = parts.hour12;
      prevMinuteRef.current = parts.minute;
    }
  }, [value]);

  const emitDateTime = (
    newDate: Date | undefined,
    newHour: string,
    newMinute: string,
    newPeriod: 'AM' | 'PM'
  ) => {
    if (!newDate) {
      onChange('');
      return;
    }

    let h = parseInt(newHour, 10) || 12;
    const m = Math.min(59, Math.max(0, parseInt(newMinute, 10) || 0));

    // Convert 12-hour format + AM/PM into 24-hour scale (0-23)
    if (newPeriod === 'PM' && h < 12) h += 12;
    if (newPeriod === 'AM' && h === 12) h = 0;

    const combined = new Date(newDate);
    combined.setHours(h, m, 0, 0);

    const year = combined.getFullYear();
    const month = String(combined.getMonth() + 1).padStart(2, '0');
    const day = String(combined.getDate()).padStart(2, '0');
    const hoursStr = String(combined.getHours()).padStart(2, '0');
    const minsStr = String(combined.getMinutes()).padStart(2, '0');

    onChange(`${year}-${month}-${day}T${hoursStr}:${minsStr}`);
  };

  const handleDateChange = (newDate: Date | undefined) => {
    setSelectedDate(newDate);
    emitDateTime(newDate, hour || prevHourRef.current, minute || prevMinuteRef.current, period);
  };

  // Hour click: save current value in backup and clear display
  const handleHourFocus = () => {
    if (hour) prevHourRef.current = hour;
    setHour('');
  };

  // Minute click: save current value in backup and clear display
  const handleMinuteFocus = () => {
    if (minute) prevMinuteRef.current = minute;
    setMinute('');
  };

  // Hour typing logic (01 - 12)
  const handleHourInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setHour('');
      return;
    }

    const num = parseInt(rawVal, 10);

    // If typed value is above 12, take only the last digit
    if (num > 12) {
      const lastDigit = rawVal.slice(-1);
      const safeNum = parseInt(lastDigit, 10) || 1;
      setHour(String(safeNum));
      prevHourRef.current = String(safeNum).padStart(2, '0');
      emitDateTime(selectedDate, prevHourRef.current, minute || prevMinuteRef.current, period);
      return;
    }

    setHour(rawVal);
    prevHourRef.current = rawVal.padStart(2, '0');
    emitDateTime(selectedDate, prevHourRef.current, minute || prevMinuteRef.current, period);

    // Auto-focus minute only when 2 digits are entered
    if (rawVal.length === 2) {
      minuteInputRef.current?.focus();
    }
  };

  // Minute typing logic (00 - 59)
  const handleMinuteInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setMinute('');
      return;
    }

    const num = parseInt(rawVal, 10);
    if (num > 59) {
      const lastDigit = rawVal.slice(-1);
      setMinute(lastDigit);
      prevMinuteRef.current = lastDigit.padStart(2, '0');
      emitDateTime(selectedDate, hour || prevHourRef.current, prevMinuteRef.current, period);
      return;
    }

    setMinute(rawVal);
    prevMinuteRef.current = rawVal.padStart(2, '0');
    emitDateTime(selectedDate, hour || prevHourRef.current, prevMinuteRef.current, period);
  };

  // When clicking outside without typing: restore previous value
  const handleHourBlur = () => {
    if (!hour.trim()) {
      setHour(prevHourRef.current);
    } else {
      const num = parseInt(hour, 10);
      const formatted = isNaN(num) || num < 1 ? '12' : String(Math.min(12, Math.max(1, num))).padStart(2, '0');
      setHour(formatted);
      prevHourRef.current = formatted;
      emitDateTime(selectedDate, formatted, minute || prevMinuteRef.current, period);
    }
  };

  const handleMinuteBlur = () => {
    if (!minute.trim()) {
      setMinute(prevMinuteRef.current);
    } else {
      const num = parseInt(minute, 10);
      const formatted = isNaN(num) || num < 0 ? '00' : String(Math.min(59, Math.max(0, num))).padStart(2, '0');
      setMinute(formatted);
      prevMinuteRef.current = formatted;
      emitDateTime(selectedDate, hour || prevHourRef.current, formatted, period);
    }
  };

  const togglePeriod = () => {
    if (disabled) return;
    const nextPeriod: 'AM' | 'PM' = period === 'AM' ? 'PM' : 'AM';
    setPeriod(nextPeriod);
    emitDateTime(selectedDate, hour || prevHourRef.current, minute || prevMinuteRef.current, nextPeriod);
  };

  return (
    <div className={cn('grid grid-cols-1 xs:grid-cols-2 gap-2 w-full relative z-30 overflow-visible', className)}>
      {/* Date Picker with elevated z-index so popover calendar renders cleanly in front */}
      <div className="w-full relative z-50 overflow-visible">
        <DatePicker
          date={selectedDate}
          onDateChange={handleDateChange}
          placeholder="Pick date"
          disabled={disabled}
          className="h-9 w-full text-xs rounded-lg"
        />
      </div>

      {/* Modern Compact Time Box in 12-Hour Format with AM/PM */}
      <div className="inline-flex items-center justify-between w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs focus-within:ring-1 focus-within:ring-indigo-500 text-xs">
        <Clock className="size-3.5 text-slate-400 shrink-0 pointer-events-none" />

        <div className="flex items-center justify-center gap-0.5 flex-1">
          {/* Hour Input Box (01-12) */}
          <input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={hour}
            onFocus={handleHourFocus}
            onChange={handleHourInput}
            onBlur={handleHourBlur}
            placeholder={prevHourRef.current}
            maxLength={2}
            className="w-6 text-center font-mono text-xs font-bold text-slate-800 dark:text-zinc-100 bg-transparent focus:outline-none p-0"
          />

          <span className="text-xs font-bold text-slate-400 select-none">:</span>

          {/* Minute Input Box (00-59) */}
          <input
            ref={minuteInputRef}
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={minute}
            onFocus={handleMinuteFocus}
            onChange={handleMinuteInput}
            onBlur={handleMinuteBlur}
            placeholder={prevMinuteRef.current}
            maxLength={2}
            className="w-6 text-center font-mono text-xs font-bold text-slate-800 dark:text-zinc-100 bg-transparent focus:outline-none p-0"
          />
        </div>

        {/* AM / PM Toggle Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={togglePeriod}
          title="Click to toggle AM / PM"
          className={cn(
            'px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider transition-colors cursor-pointer select-none',
            period === 'PM'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 hover:bg-indigo-200 dark:hover:bg-indigo-900'
              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900'
          )}
        >
          {period}
        </button>
      </div>
    </div>
  );
};