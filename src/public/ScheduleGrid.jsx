import { useMemo } from 'react'

const defaultDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const defaultDayLabels = {
  monday: 'Poniedziałek',
  tuesday: 'Wtorek',
  wednesday: 'Środa',
  thursday: 'Czwartek',
  friday: 'Piątek',
}

function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map((x) => Number(x))
  return { h, m }
}

function parseRangeToSlots({ timeRange, startHour, slotMinutes, slots }) {
  const parts = timeRange.split('-').map((s) => s.trim())
  const start = parseHHMM(parts[0])
  const end = parseHHMM(parts[1])

  const startMinutes = (start.h - startHour) * 60 + start.m
  const endMinutes = (end.h - startHour) * 60 + end.m

  const startSlot = Math.max(0, Math.min(slots - 1, Math.floor(startMinutes / slotMinutes)))
  const endSlot = Math.max(0, Math.min(slots - 1, Math.ceil(endMinutes / slotMinutes) - 1))

  return { startSlot, endSlot }
}

export default function ScheduleGrid({
  schedule,
  startHour = 8,
  endHour = 20,
  slotMinutes = 15,
  days = defaultDays,
  dayLabels = defaultDayLabels,
  windowSlots = 3,
}) {
  const slots = useMemo(() => ((endHour - startHour) * 60) / slotMinutes, [endHour, startHour, slotMinutes])


  const grid = useMemo(() => {
    const safeSchedule = Array.isArray(schedule) ? schedule : []
    const g = Array.from({ length: slots }, () => ({}))

    safeSchedule.forEach((row) => {
      if (!row?.time) return
      const { startSlot, endSlot } = parseRangeToSlots({
        timeRange: row.time,
        startHour,
        slotMinutes,
        slots,
      })

      for (let idx = startSlot; idx <= endSlot; idx += 1) {
        days.forEach((d) => {
          g[idx][d] = row?.[d] || ''
        })
      }
    })

    return g
  }, [days, schedule, startHour, slotMinutes, slots])

  const makeTimeLabel = (totalMinutes) => {
    const minutes = totalMinutes % 60
    const hours = startHour + Math.floor(totalMinutes / 60)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  return (
    <div className="schedule-wrapper">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Godzina</th>
            {days.map((d) => (
              <th key={d}>{dayLabels[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: slots }).map((_, idx) => {
            const label = makeTimeLabel(idx * slotMinutes)
            return (
              <tr key={label}>
                <td>{label}</td>
                {days.map((d) => {
                  const text = grid[idx]?.[d] || ''
                  const prevText = idx > 0 ? grid[idx - 1]?.[d] || '' : ''

                  if (text && idx > 0 && prevText === text) return null

                  let rowSpan = 1
                  if (text) {
                    for (let k = idx + 1; k < slots; k += 1) {
                      if ((grid[k]?.[d] || '') === text) rowSpan += 1
                      else break
                    }
                  }

                  return (
                    <td key={d} rowSpan={rowSpan}>
                      {text ? <div className="cell-inner">{text}</div> : null}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

