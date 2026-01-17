// 날짜 축 컴포넌트

import { format, addDays, startOfYear, isWeekend } from 'date-fns'
import { ko } from 'date-fns/locale'
import { YEAR_DAYS } from '../../lib/constants/grid'
import { useAppStore } from '../../store/useAppStore'
import { getCellWidth } from '../../lib/utils/gridUtils'
import { WEEKEND_HOLIDAY_COLOR } from '../../lib/constants/colors'

interface DateAxisProps {
  hideFixedColumn?: boolean
}

export function DateAxis({ hideFixedColumn = false }: DateAxisProps) {
  const { zoomLevel, currentYear, events } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel)

  const yearStart = startOfYear(new Date(currentYear, 0, 1))

  // 공휴일 여부 확인
  const isHoliday = (date: Date) => {
    return events.some(
      (event) =>
        event.type === 'holiday' &&
        new Date(event.date).toDateString() === date.toDateString()
    )
  }

  return (
    <div className={hideFixedColumn ? '' : 'sticky top-0 z-30 bg-card border-b border-border'}>
      <div className="flex" style={{ height: '44px' }}>
        {/* 날짜 축 */}
        <div
          className="flex"
          style={{ width: `${YEAR_DAYS * cellWidth}px` }}
        >
          {Array.from({ length: YEAR_DAYS }).map((_, dayIndex) => {
            const date = addDays(yearStart, dayIndex)
            const dayOfMonth = date.getDate()
            const isFirstDayOfMonth = dayOfMonth === 1
            const isSpecialDay = isWeekend(date) || isHoliday(date)

            return (
              <div
                key={dayIndex}
                className={`flex-shrink-0 border-r border-border text-center ${
                  isFirstDayOfMonth ? 'border-l-2 border-l-primary' : ''
                }`}
                style={{
                  width: `${cellWidth}px`,
                  backgroundColor: isSpecialDay ? WEEKEND_HOLIDAY_COLOR : undefined,
                }}
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
    </div>
  )
}
