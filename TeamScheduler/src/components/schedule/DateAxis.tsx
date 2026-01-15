// 날짜 축 컴포넌트

import { format, addDays, startOfYear } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CELL_WIDTH_BASE, YEAR_DAYS } from '../../lib/constants/grid'
import { useAppStore } from '../../store/useAppStore'
import { getCellWidth } from '../../lib/utils/gridUtils'

export function DateAxis() {
  const { zoomLevel, currentYear } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel)

  const yearStart = startOfYear(new Date(currentYear, 0, 1))

  return (
    <div className="sticky top-0 z-10 bg-card border-b border-border">
      <div
        className="flex"
        style={{ width: `${YEAR_DAYS * cellWidth}px` }}
      >
        {Array.from({ length: YEAR_DAYS }).map((_, dayIndex) => {
          const date = addDays(yearStart, dayIndex)
          const dayOfMonth = date.getDate()
          const isFirstDayOfMonth = dayOfMonth === 1

          return (
            <div
              key={dayIndex}
              className={`flex-shrink-0 border-r border-border text-center ${
                isFirstDayOfMonth ? 'border-l-2 border-l-primary' : ''
              }`}
              style={{ width: `${cellWidth}px` }}
            >
              <div className="py-1">
                {isFirstDayOfMonth && (
                  <div className="text-xs font-bold text-primary">
                    {format(date, 'M월', { locale: ko })}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {dayOfMonth}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
