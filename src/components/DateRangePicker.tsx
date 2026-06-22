import { useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import { zhCN } from 'react-day-picker/locale'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const formatDate = (date: Date) =>
    date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })

  const label = value?.from
    ? value.to
      ? `${formatDate(value.from)} — ${formatDate(value.to)}`
      : formatDate(value.from)
    : '选择日期范围'

  return (
    <div className="relative">
      <button
        type="button"
        className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-default-200
          bg-default-50 hover:bg-default-100 hover:border-default-300 transition-all duration-150 text-left
          dark:bg-default-100 dark:hover:bg-default-200 dark:border-default-400${value?.from ? ' pr-10' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <svg className="w-5 h-5 text-default-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={value?.from ? 'text-foreground font-medium' : 'text-default-400'}>
          {label}
        </span>
      </button>
      {value?.from && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-default-200 transition-colors z-10"
          onClick={(e) => {
            e.stopPropagation()
            onChange(undefined)
          }}
          aria-label="清除日期"
        >
          <svg className="w-4 h-4 text-default-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {open && (
        <div className="absolute z-50 mt-2 p-3 rounded-xl border border-default-200 bg-background shadow-xl
          dark:bg-default-100 dark:border-default-500 animate-fade-in">
          <DayPicker
            mode="range"
            selected={value}
            onSelect={(range) => {
              onChange(range)
              if (range?.to) setOpen(false)
            }}
            locale={zhCN}
            className="rdp-custom"
            captionLayout="dropdown"
            showOutsideDays
            style={{
              '--rdp-accent-color': 'var(--color-primary, #f31260)',
              '--rdp-accent-background-color': 'var(--color-primary-100, rgba(243, 18, 96, 0.1))',
            } as React.CSSProperties}
          />
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}
