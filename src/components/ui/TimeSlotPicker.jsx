import { cn } from '@/lib/utils'

const DEFAULT_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
]

export default function TimeSlotPicker({ selectedTime, onTimeSelect, slots = DEFAULT_SLOTS }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-2">Odaberi vrijeme</label>
      <div className="grid grid-cols-5 gap-1.5">
        {slots.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onTimeSelect(slot)}
            className={cn(
              'text-xs py-2 rounded border transition-colors',
              selectedTime === slot
                ? 'bg-accent text-white border-accent font-medium'
                : 'border-border text-gray-600 hover:border-gray-400',
            )}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  )
}
