import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isBefore,
  startOfDay,
} from 'date-fns'
import { hr } from 'date-fns/locale/hr'
import { enUS } from 'date-fns/locale/en-US'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/context/I18nContext'

export default function CalendarPicker({ selectedDate, onDateSelect, minDate }) {
  const { dateFnsLocaleKey } = useI18n()
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date())

  const dateFnsLocale = dateFnsLocaleKey === 'en' ? enUS : hr
  const DAY_LABELS = dateFnsLocaleKey === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']

  const today = startOfDay(new Date())
  const effectiveMin = minDate ? startOfDay(minDate) : today

  // Build calendar grid (Monday start — Croatian convention)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold capitalize">
          {format(currentMonth, 'LLLL yyyy.', { locale: dateFnsLocale })}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] text-gray-400 font-medium py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const isDisabled = isBefore(day, effectiveMin)
          const isToday = isSameDay(day, today)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => !isDisabled && onDateSelect(day)}
              disabled={isDisabled}
              className={cn(
                'w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-colors',
                !isCurrentMonth && 'text-gray-300',
                isCurrentMonth &&
                  !isSelected &&
                  !isDisabled &&
                  'text-gray-700 hover:bg-gray-100',
                isSelected && 'bg-accent text-white font-semibold',
                isDisabled && 'text-gray-200 cursor-not-allowed',
                isToday && !isSelected && 'font-semibold text-accent',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
