// 그리드 셀 컴포넌트

import { CELL_HEIGHT } from '../../lib/constants/grid'
import { getCellWidth } from '../../lib/utils/gridUtils'
import { useAppStore } from '../../store/useAppStore'
import { WEEKEND_HOLIDAY_COLOR } from '../../lib/constants/colors'
import { addDays, isWeekend, isSameDay, isToday } from 'date-fns'

interface GridCellProps {
  dayIndex: number
}

export function GridCell({ dayIndex }: GridCellProps) {
  const { zoomLevel, currentYear, events } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel)

  // 해당 날짜 계산
  const yearStart = new Date(currentYear, 0, 1)
  const date = addDays(yearStart, dayIndex)

  // 주말 여부
  const isWeekendDay = isWeekend(date)

  // 공휴일 여부 (events에서 holiday 타입 검사)
  const isHoliday = events.some(
    (event) => event.type === 'holiday' && isSameDay(new Date(event.date), date)
  )

  const isSpecialDay = isWeekendDay || isHoliday

  // 오늘 날짜 확인
  const isTodayDate = isToday(date)

  return (
    <div
      className="border-r border-border transition-colors flex-shrink-0 relative"
      style={{
        width: `${cellWidth}px`,
        height: `${CELL_HEIGHT}px`,
        backgroundColor: isSpecialDay ? WEEKEND_HOLIDAY_COLOR : undefined,
      }}
    >
      {/* 오늘 날짜 세로 라인 */}
      {isTodayDate && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary z-10"
          style={{ boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)' }}
        />
      )}
    </div>
  )
}
