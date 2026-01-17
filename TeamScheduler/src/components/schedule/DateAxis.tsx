// 날짜 축 컴포넌트 (월 헤더 + 날짜 행)

import { useMemo } from 'react'
import { addDays, startOfYear, isWeekend } from 'date-fns'
import { useAppStore } from '../../store/useAppStore'
import { getCellWidth } from '../../lib/utils/gridUtils'
import { getVisibleDayIndices } from '../../lib/utils/dateUtils'

interface DateAxisProps {
  hideFixedColumn?: boolean
}

// 월별 정보 타입
interface MonthInfo {
  month: number
  startVisibleIndex: number
  visibleDayCount: number
  isFirst: boolean
  isLast: boolean
}

export function DateAxis({ hideFixedColumn = false }: DateAxisProps) {
  const { zoomLevel, currentYear, events, monthVisibility, weekendColor } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel)

  const yearStart = startOfYear(new Date(currentYear, 0, 1))

  // 표시할 날짜 인덱스 (숨겨진 월 제외)
  const visibleDayIndices = useMemo(
    () => getVisibleDayIndices(currentYear, monthVisibility),
    [currentYear, monthVisibility]
  )

  // 공휴일 여부 확인
  const isHoliday = (date: Date) => {
    return events.some(
      (event) =>
        event.type === 'holiday' &&
        new Date(event.date).toDateString() === date.toDateString()
    )
  }

  // 월별 시작 인덱스와 날짜 수 계산
  const monthInfos = useMemo(() => {
    const infos: MonthInfo[] = []
    let currentMonth = -1
    let currentMonthStart = 0
    let currentMonthCount = 0

    visibleDayIndices.forEach((dayIndex, visibleIndex) => {
      const date = addDays(yearStart, dayIndex)
      const month = date.getMonth() + 1

      if (month !== currentMonth) {
        // 이전 월 정보 저장
        if (currentMonth !== -1) {
          infos.push({
            month: currentMonth,
            startVisibleIndex: currentMonthStart,
            visibleDayCount: currentMonthCount,
            isFirst: false,
            isLast: false,
          })
        }
        // 새 월 시작
        currentMonth = month
        currentMonthStart = visibleIndex
        currentMonthCount = 1
      } else {
        currentMonthCount++
      }
    })

    // 마지막 월 추가
    if (currentMonth !== -1) {
      infos.push({
        month: currentMonth,
        startVisibleIndex: currentMonthStart,
        visibleDayCount: currentMonthCount,
        isFirst: false,
        isLast: false,
      })
    }

    // 첫 번째와 마지막 표시
    if (infos.length > 0) {
      infos[0].isFirst = true
      infos[infos.length - 1].isLast = true
    }

    return infos
  }, [visibleDayIndices, yearStart])

  // 이전 날짜가 다른 월인지 확인 (월 경계 표시용)
  const isFirstVisibleDayOfMonth = (currentIndex: number, visibleIndex: number) => {
    if (visibleIndex === 0) return false // 첫 번째 날짜는 구분선 불필요

    const prevDayIndex = visibleDayIndices[visibleIndex - 1]
    const currentDate = addDays(yearStart, currentIndex)
    const prevDate = addDays(yearStart, prevDayIndex)

    return currentDate.getMonth() !== prevDate.getMonth()
  }

  // 월 헤더 배경색 (교차)
  const getMonthBgColor = (index: number) => {
    return index % 2 === 0 ? '#f8fafc' : '#f1f5f9' // 밝은 회색 교차
  }

  return (
    <div className={hideFixedColumn ? '' : 'sticky top-0 z-30 bg-card border-b border-border'}>
      {/* 월 헤더 행 */}
      <div className="flex" style={{ height: '24px' }}>
        <div
          className="flex"
          style={{ width: `${visibleDayIndices.length * cellWidth}px` }}
        >
          {monthInfos.map((info, index) => (
            <div
              key={`month-${info.month}`}
              className="flex-shrink-0 flex items-center justify-center text-xs font-bold text-foreground"
              style={{
                width: `${info.visibleDayCount * cellWidth}px`,
                backgroundColor: getMonthBgColor(index),
                // 월 구분선: 첫 월과 마지막 월은 제외, 좌측에 선 표시
                borderLeft: !info.isFirst ? '2px dashed #c5c7cc' : undefined,
              }}
            >
              {info.month}월
            </div>
          ))}
        </div>
      </div>

      {/* 날짜 행 */}
      <div className="flex" style={{ height: '20px' }}>
        <div
          className="flex"
          style={{ width: `${visibleDayIndices.length * cellWidth}px` }}
        >
          {visibleDayIndices.map((dayIndex, visibleIndex) => {
            const date = addDays(yearStart, dayIndex)
            const dayOfMonth = date.getDate()
            const isFirstDay = isFirstVisibleDayOfMonth(dayIndex, visibleIndex)
            const isSpecialDay = isWeekend(date) || isHoliday(date)

            return (
              <div
                key={dayIndex}
                className="flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground border-r border-border"
                style={{
                  width: `${cellWidth}px`,
                  backgroundColor: isSpecialDay ? weekendColor : undefined,
                  // 월 구분선 (월 헤더와 정확히 일치)
                  borderLeft: isFirstDay ? '2px dashed #c5c7cc' : undefined,
                }}
              >
                {dayOfMonth}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
