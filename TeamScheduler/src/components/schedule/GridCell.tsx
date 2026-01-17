// 그리드 셀 컴포넌트

import { getCellWidth, getCellHeight } from '../../lib/utils/gridUtils'
import { useAppStore } from '../../store/useAppStore'
import { addDays, isWeekend, isSameDay, isToday } from 'date-fns'

interface GridCellProps {
  dayIndex: number
  isFirstDayOfMonth?: boolean // 월 첫 날 여부
}

export function GridCell({ dayIndex, isFirstDayOfMonth = false }: GridCellProps) {
  const { zoomLevel, columnWidthScale, currentYear, events, weekendColor } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel, columnWidthScale)
  const cellHeight = getCellHeight(zoomLevel)

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
        height: `${cellHeight}px`,
        backgroundColor: isSpecialDay ? weekendColor : undefined,
        // 월 구분선 (DateAxis와 정확히 일치하는 스타일)
        borderLeft: isFirstDayOfMonth ? '2px dashed #c5c7cc' : undefined,
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
