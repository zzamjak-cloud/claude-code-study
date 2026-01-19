// 그리드 셀 컴포넌트

import { memo } from 'react'
import { getCellWidth, getCellHeight } from '../../lib/utils/gridUtils'
import { useAppStore } from '../../store/useAppStore'
import { addDays, isWeekend, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'

interface GridCellProps {
  dayIndex: number
  isFirstDayOfMonth?: boolean // 월 첫 날 여부
}

export const GridCell = memo(function GridCell({ dayIndex, isFirstDayOfMonth = false }: GridCellProps) {
  // Zustand 선택적 구독
  const zoomLevel = useAppStore(state => state.zoomLevel)
  const columnWidthScale = useAppStore(state => state.columnWidthScale)
  const currentYear = useAppStore(state => state.currentYear)
  const events = useAppStore(state => state.events)
  const weekendColor = useAppStore(state => state.weekendColor)
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

  // 과거 날짜 확인 (오늘 이전)
  const isPastDate = isBefore(date, startOfDay(new Date()))

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
      {/* 과거 날짜 망점 처리 */}
      {isPastDate && (
        <div
          className="absolute inset-0 pointer-events-none z-[5]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(128, 128, 128, 0.25) 1px, transparent 1px)',
            backgroundSize: '4px 4px',
          }}
        />
      )}

      {/* 오늘 날짜 강조 (세로 라인 + 배경) */}
      {isTodayDate && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-1 bg-primary z-10"
            style={{ boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)' }}
          />
          <div
            className="absolute inset-0 pointer-events-none z-[5]"
            style={{
              background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%)',
            }}
          />
        </>
      )}
    </div>
  )
})
