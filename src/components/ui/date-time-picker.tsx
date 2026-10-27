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
  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);

  // Focus tracking to prevent incoming value prop updates from interrupting active user typing
  const isHourFocusedRef = useRef<boolean>(false);
  const isMinuteFocusedRef = useRef<boolean>(false);

  // Live value refs to prevent stale closure reads when blur events fire synchronously
  const currentHourRef = useRef<string>('12');
  const currentMinuteRef = useRef<string>('00');

  // Backup state to restore previous valid value if user leaves field empty
  const prevHourRef = useRef<string>('12');
  const prevMinuteRef = useRef<string>('00');

  const parseParts = (val: string) => {
    // 1. Direct regex parsing for deterministic timezone-safe local string extraction
    if (val) {
      const match = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (match) {
        const [, y, m, d, hh, mm] = match;
        let h = parseInt(hh, 10);
        const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return {
          dateObj: new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)),
          hour12: String(h).padStart(2, '0'),
          minute: mm,
          period: p,
        };
      }
    }

    // 2. Fallback to Date object parsing
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
  currentHourRef.current = initial.hour12;
  currentMinuteRef.current = initial.minute;
  prevHourRef.current = initial.hour12;
  prevMinuteRef.current = initial.minute;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initial.dateObj);
  const [hour, setHour] = useState<string>(initial.hour12);
  const [minute, setMinute] = useState<string>(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);

  // Synchronize state when value changes externally, but avoid overwriting active user typing
  useEffect(() => {
    if (value) {
      const parts = parseParts(value);
      setSelectedDate(parts.dateObj);
      setPeriod(parts.period);

      if (!isHourFocusedRef.current) {
        setHour(parts.hour12);
        currentHourRef.current = parts.hour12;
        prevHourRef.current = parts.hour12;
      }
      if (!isMinuteFocusedRef.current) {
        setMinute(parts.minute);
        currentMinuteRef.current = parts.minute;
        prevMinuteRef.current = parts.minute;
      }
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

    let h = parseInt(newHour, 10);
    if (isNaN(h) || h < 1 || h > 12) h = 12;

    let m = parseInt(newMinute, 10);
    if (isNaN(m) || m < 0 || m > 59) m = 0;

    // Convert 12-hour format + AM/PM into 24-hour scale (00-23)
    if (newPeriod === 'PM' && h < 12) h += 12;
    if (newPeriod === 'AM' && h === 12) h = 0;

    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    const hoursStr = String(h).padStart(2, '0');
    const minsStr = String(m).padStart(2, '0');

    onChange(`${year}-${month}-${day}T${hoursStr}:${minsStr}`);
  };

  const handleDateChange = (newDate: Date | undefined) => {
    setSelectedDate(newDate);
    emitDateTime(
      newDate,
      currentHourRef.current || prevHourRef.current,
      currentMinuteRef.current || prevMinuteRef.current,
      period
    );
  };

  // Hour focus: select all text so user can immediately type without backspacing
  const handleHourFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isHourFocusedRef.current = true;
    if (hour) prevHourRef.current = hour;
    const target = e.currentTarget;
    setTimeout(() => {
      target.select();
    }, 0);
  };

  // Minute focus: select all text
  const handleMinuteFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isMinuteFocusedRef.current = true;
    if (minute) prevMinuteRef.current = minute;
    const target = e.currentTarget;
    setTimeout(() => {
      target.select();
    }, 0);
  };

  // Hour typing logic (01 - 12)
  const handleHourInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      currentHourRef.current = '';
      setHour('');
      return;
    }

    // Single digit input
    if (rawVal.length === 1) {
      const digit = parseInt(rawVal, 10);
      if (digit === 0 || digit === 1) {
        // Could be the start of 01-09 or 10, 11, 12: wait for second digit without auto-advancing
        currentHourRef.current = rawVal;
        setHour(rawVal);
      } else {
        // Digits 2-9 cannot have a second hour digit (12-hour clock max is 12)
        const formatted = `0${digit}`;
        currentHourRef.current = formatted;
        setHour(formatted);
        prevHourRef.current = formatted;
        emitDateTime(selectedDate, formatted, currentMinuteRef.current || prevMinuteRef.current, period);
        setTimeout(() => {
          minuteInputRef.current?.focus();
          minuteInputRef.current?.select();
        }, 10);
      }
      return;
    }

    // Two or more digits: take the last two digits
    const lastTwo = rawVal.slice(-2);
    const num = parseInt(lastTwo, 10);

    if (num === 0) {
      // 00 -> treat as 12
      const formatted = '12';
      currentHourRef.current = formatted;
      setHour(formatted);
      prevHourRef.current = formatted;
      emitDateTime(selectedDate, formatted, currentMinuteRef.current || prevMinuteRef.current, period);
      setTimeout(() => {
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }, 10);
    } else if (num >= 1 && num <= 12) {
      // Valid hour 01 - 12 (including 10, 11, 12)
      const formatted = String(num).padStart(2, '0');
      currentHourRef.current = formatted;
      setHour(formatted);
      prevHourRef.current = formatted;
      emitDateTime(selectedDate, formatted, currentMinuteRef.current || prevMinuteRef.current, period);
      setTimeout(() => {
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }, 10);
    } else {
      // Value > 12: fallback to last typed digit
      const lastDigit = parseInt(rawVal.slice(-1), 10);
      if (lastDigit === 0 || lastDigit === 1) {
        currentHourRef.current = String(lastDigit);
        setHour(String(lastDigit));
      } else {
        const formatted = `0${lastDigit}`;
        currentHourRef.current = formatted;
        setHour(formatted);
        prevHourRef.current = formatted;
        emitDateTime(selectedDate, formatted, currentMinuteRef.current || prevMinuteRef.current, period);
        setTimeout(() => {
          minuteInputRef.current?.focus();
          minuteInputRef.current?.select();
        }, 10);
      }
    }
  };

  // Minute typing logic (00 - 59)
  const handleMinuteInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      currentMinuteRef.current = '';
      setMinute('');
      return;
    }

    if (rawVal.length === 1) {
      const digit = parseInt(rawVal, 10);
      if (digit >= 6) {
        // Minutes cannot be 60+: format as 0X
        const formatted = `0${digit}`;
        currentMinuteRef.current = formatted;
        setMinute(formatted);
        prevMinuteRef.current = formatted;
        emitDateTime(selectedDate, currentHourRef.current || prevHourRef.current, formatted, period);
      } else {
        // 0 - 5: wait for possible second digit
        currentMinuteRef.current = rawVal;
        setMinute(rawVal);
      }
      return;
    }

    // Two or more digits: take the last two digits
    const lastTwo = rawVal.slice(-2);
    const num = parseInt(lastTwo, 10);

    if (num <= 59) {
      const formatted = String(num).padStart(2, '0');
      currentMinuteRef.current = formatted;
      setMinute(formatted);
      prevMinuteRef.current = formatted;
      emitDateTime(selectedDate, currentHourRef.current || prevHourRef.current, formatted, period);
    } else {
      const lastDigit = rawVal.slice(-1);
      currentMinuteRef.current = lastDigit;
      setMinute(lastDigit);
    }
  };

  // Hour blur: format single digit or restore previous value using live ref
  const handleHourBlur = () => {
    isHourFocusedRef.current = false;
    const val = currentHourRef.current.trim();
    if (!val) {
      currentHourRef.current = prevHourRef.current;
      setHour(prevHourRef.current);
    } else {
      const num = parseInt(val, 10);
      const formatted = isNaN(num) || num < 1 ? '12' : String(Math.min(12, Math.max(1, num))).padStart(2, '0');
      currentHourRef.current = formatted;
      setHour(formatted);
      prevHourRef.current = formatted;
      emitDateTime(selectedDate, formatted, currentMinuteRef.current || prevMinuteRef.current, period);
    }
  };

  // Minute blur: format single digit or restore previous value using live ref
  const handleMinuteBlur = () => {
    isMinuteFocusedRef.current = false;
    const val = currentMinuteRef.current.trim();
    if (!val) {
      currentMinuteRef.current = prevMinuteRef.current;
      setMinute(prevMinuteRef.current);
    } else {
      const num = parseInt(val, 10);
      const formatted = isNaN(num) || num < 0 ? '00' : String(Math.min(59, Math.max(0, num))).padStart(2, '0');
      currentMinuteRef.current = formatted;
      setMinute(formatted);
      prevMinuteRef.current = formatted;
      emitDateTime(selectedDate, currentHourRef.current || prevHourRef.current, formatted, period);
    }
  };

  // Keyboard navigation & increment/decrement
  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseInt(currentHourRef.current || prevHourRef.current, 10) || 12;
      const next = current >= 12 ? 1 : current + 1;
      const formatted = String(next).padStart(2, '0');
      currentHourRef.current = formatted;
      setHour(formatted);
      prevHourRef.current = formatted;
      emitDateTime(selectedDate, formatted, currentMinuteRef.current || prevMinuteRef.current, period);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(currentHourRef.current || prevHourRef.current, 10) || 12;
      const next = current <= 1 ? 12 : current - 1;
      const formatted = String(next).padStart(2, '0');
      currentHourRef.current = formatted;
      setHour(formatted);
      prevHourRef.current = formatted;
      emitDateTime(selectedDate, formatted, currentMinuteRef.current || prevMinuteRef.current, period);
    } else if (e.key === ':' || e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    }
  };

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseInt(currentMinuteRef.current || prevMinuteRef.current, 10) || 0;
      const next = current >= 59 ? 0 : current + 1;
      const formatted = String(next).padStart(2, '0');
      currentMinuteRef.current = formatted;
      setMinute(formatted);
      prevMinuteRef.current = formatted;
      emitDateTime(selectedDate, currentHourRef.current || prevHourRef.current, formatted, period);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(currentMinuteRef.current || prevMinuteRef.current, 10) || 0;
      const next = current <= 0 ? 59 : current - 1;
      const formatted = String(next).padStart(2, '0');
      currentMinuteRef.current = formatted;
      setMinute(formatted);
      prevMinuteRef.current = formatted;
      emitDateTime(selectedDate, currentHourRef.current || prevHourRef.current, formatted, period);
    } else if (e.key === 'ArrowLeft' || (e.key === 'Backspace' && !minute)) {
      e.preventDefault();
      hourInputRef.current?.focus();
      hourInputRef.current?.select();
    }
  };

  const togglePeriod = () => {
    if (disabled) return;
    const nextPeriod: 'AM' | 'PM' = period === 'AM' ? 'PM' : 'AM';
    setPeriod(nextPeriod);
    emitDateTime(
      selectedDate,
      currentHourRef.current || prevHourRef.current,
      currentMinuteRef.current || prevMinuteRef.current,
      nextPeriod
    );
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
            ref={hourInputRef}
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={hour}
            onFocus={handleHourFocus}
            onChange={handleHourInput}
            onBlur={handleHourBlur}
            onKeyDown={handleHourKeyDown}
            placeholder={prevHourRef.current}
            className="w-7 text-center font-mono text-xs font-bold text-slate-800 dark:text-zinc-100 bg-transparent focus:outline-none p-0 selection:bg-indigo-100 dark:selection:bg-indigo-900"
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
            onKeyDown={handleMinuteKeyDown}
            placeholder={prevMinuteRef.current}
            className="w-7 text-center font-mono text-xs font-bold text-slate-800 dark:text-zinc-100 bg-transparent focus:outline-none p-0 selection:bg-indigo-100 dark:selection:bg-indigo-900"
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