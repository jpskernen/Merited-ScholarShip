'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DatePickerFieldProps = {
  id?: string;
  /** Stored/transmitted as a plain `YYYY-MM-DD` string (see ScholarshipSchema.deadline). */
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

// A date-only field parses as UTC midnight; reading it back with local
// getters would show the previous day in any timezone west of UTC.
function parseDateOnly(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePickerField({ id, value, onChange, disabled, placeholder = 'Pick a date' }: DatePickerFieldProps) {
  const selected = parseDateOnly(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('w-full min-w-0 justify-start text-left font-normal', !selected && 'text-muted-foreground')}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        
          {selected ? (
            <>
              <span className="truncate sm:hidden">{format(selected, 'PP')}</span>
              <span className="hidden truncate sm:inline">{format(selected, 'PPP')}</span>
            </>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => date && onChange(formatDateOnly(date))}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
