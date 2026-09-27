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
 * Enterprise standard Date & Time picker with click-to-clear and restore behavior
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
      if (isNaN(d.getTime())) {
        return { dateObj: new Date(), hour12: '12', minute: '00', period: 'PM' };
      }

      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const p = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return {
        dateObj: d,
        hour12: String(h).padStart(2, '0'),
        minute: m,
        period: p,
      };
    } catch {
      return { dateObj: new Date(), hour12: '12', minute: '00', period: 'PM' };
    }
  };

  const initial = parseParts(value);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initial.dateObj);
  const [hour, setHour] = useState<string>(initial.hour12);
  const [minute, setMinute] = useState<string>(initial.minute);
  const [period, setPeriod] = useState<string>(initial.period);

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
    newPeriod: string
  ) => {
    if (!newDate) {
      onChange('');
      return;
    }

    let h = parseInt(newHour, 10) || 12;
    const m = parseInt(newMinute, 10) || 0;

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

  // Hour typing logic
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

  // Minute typing logic
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
      const formatted = isNaN(num) || num < 1 ? '12' : String(Math.min(12, num)).padStart(2, '0');
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
      const formatted = isNaN(num) || num < 0 ? '00' : String(Math.min(59, num)).padStart(2, '0');
      setMinute(formatted);
      prevMinuteRef.current = formatted;
      emitDateTime(selectedDate, hour || prevHourRef.current, formatted, period);
    }
  };

  const togglePeriod = () => {
    if (disabled) return;
    const next = period === 'AM' ? 'PM' : 'AM';
    setPeriod(next);
    emitDateTime(selectedDate, hour || prevHourRef.current, minute || prevMinuteRef.current, next);
  };

  return (
    <div className={cn('flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full', className)}>
      {/* Date Picker */}
      <div className="flex-1">
        <DatePicker
          date={selectedDate}
          onDateChange={handleDateChange}
          placeholder="Pick date"
          disabled={disabled}
          className="h-9"
        />
      </div>

      {/* Modern Compact Time Box with Instant Click-to-Clear */}
      <div className="inline-flex items-center h-9 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs focus-within:ring-1 focus-within:ring-emerald-500">
        <Clock className="size-3.5 text-slate-400 mr-2 shrink-0 pointer-events-none" />

        {/* Hour Input Box */}
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={hour}
          onFocus={handleHourFocus}
          onChange={handleHourInput}
          onBlur={handleHourBlur}
          placeholder={prevHourRef.current}
          className="w-5 text-center font-mono text-xs font-medium text-slate-700 dark:text-zinc-200 bg-transparent focus:outline-none"
        />

        <span className="text-xs font-medium text-slate-400 mx-0.5 select-none">:</span>

        {/* Minute Input Box */}
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
          className="w-5 text-center font-mono text-xs font-medium text-slate-700 dark:text-zinc-200 bg-transparent focus:outline-none"
        />

        {/* AM / PM Toggle Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={togglePeriod}
          className={cn(
            'ml-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium tracking-wider transition-colors cursor-pointer select-none',
            period === 'PM'
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
          )}
        >
          {period}
        </button>
      </div>
    </div>
  );
};