// 일정 그리드 컴포넌트 (Phase 1: 정적 렌더링, 가상 스크롤 없음)

import { useAppStore } from '../../store/useAppStore'
import { YEAR_DAYS, CELL_HEIGHT } from '../../lib/constants/grid'
import { getCellWidth } from '../../lib/utils/gridUtils'
import { DateAxis } from './DateAxis'
import { GridCell } from './GridCell'
import { ScheduleCard } from './ScheduleCard'
import { dateToPixels } from '../../lib/utils/dateUtils'

export function ScheduleGrid() {
  const { selectedMemberId, members, schedules, zoomLevel, currentYear } =
    useAppStore()
  const cellWidth = getCellWidth(zoomLevel)

  // 현재 선택된 탭의 일정만 필터링
  const filteredSchedules = selectedMemberId
    ? schedules.filter((s) => s.memberId === selectedMemberId)
    : schedules // 통합 탭: 모든 일정

  // 통합 탭의 경우 팀원별로 행을 나눔
  const isUnifiedTab = selectedMemberId === null
  const rows = isUnifiedTab
    ? members.map((m) => ({
        memberId: m.id,
        memberName: m.name,
        schedules: schedules.filter((s) => s.memberId === m.id),
      }))
    : [
        {
          memberId: selectedMemberId,
          memberName: '',
          schedules: filteredSchedules,
        },
      ]

  return (
    <div className="flex-1 overflow-auto scrollbar-thin">
      {/* 날짜 축 */}
      <DateAxis />

      {/* 그리드 영역 */}
      <div>
        {rows.map((row, rowIndex) => (
          <div
            key={row.memberId}
            className="relative border-b border-border"
            style={{ height: `${CELL_HEIGHT}px` }}
          >
            {/* 팀원 이름 (통합 탭에만 표시) */}
            {isUnifiedTab && (
              <div
                className="absolute left-0 top-0 h-full flex items-center px-4 bg-card border-r border-border z-10"
                style={{ width: '150px' }}
              >
                <span className="text-sm font-medium text-foreground truncate">
                  {row.memberName}
                </span>
              </div>
            )}

            {/* 그리드 셀 */}
            <div
              className="flex"
              style={{
                width: `${YEAR_DAYS * cellWidth}px`,
                marginLeft: isUnifiedTab ? '150px' : '0',
              }}
            >
              {Array.from({ length: YEAR_DAYS }).map((_, dayIndex) => (
                <GridCell key={dayIndex} dayIndex={dayIndex} />
              ))}
            </div>

            {/* 일정 카드 */}
            <div
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{
                marginLeft: isUnifiedTab ? '150px' : '0',
              }}
            >
              {row.schedules.map((schedule) => {
                const x = dateToPixels(
                  new Date(schedule.startDate),
                  currentYear,
                  zoomLevel
                )
                return <ScheduleCard key={schedule.id} schedule={schedule} x={x} />
              })}
            </div>
          </div>
        ))}

        {/* 일정이 없을 때 */}
        {rows.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>팀원을 추가하여 일정을 관리하세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
