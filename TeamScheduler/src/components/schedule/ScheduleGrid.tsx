// 일정 그리드 컴포넌트 (Phase 2: 드래그 앤 드롭 + Ctrl+드래그 일정 생성)

import { useRef, useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { YEAR_DAYS, CELL_HEIGHT } from '../../lib/constants/grid'
import { getCellWidth } from '../../lib/utils/gridUtils'
import { DateAxis } from './DateAxis'
import { GridCell } from './GridCell'
import { ScheduleCard } from './ScheduleCard'
import { dateToPixels } from '../../lib/utils/dateUtils'
import { createSchedule as createScheduleFirebase, updateTeamMember } from '../../lib/firebase/firestore'
import { DEFAULT_SCHEDULE_COLOR } from '../../lib/constants/colors'
import { addDays } from 'date-fns'

export function ScheduleGrid() {
  const {
    selectedMemberId,
    members,
    schedules,
    zoomLevel,
    currentYear,
    workspaceId,
    currentUser,
    selectedScheduleColor, // 사용자가 선택한 기본 색상
  } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fixedColumnRef = useRef<HTMLDivElement>(null)

  // 일정 생성 상태 (Ctrl + 드래그)
  const [isCreating, setIsCreating] = useState(false)
  const [createMemberId, setCreateMemberId] = useState<string | null>(null)
  const [createRowIndex, setCreateRowIndex] = useState<number>(0)
  const [createStart, setCreateStart] = useState<number | null>(null)
  const [createEnd, setCreateEnd] = useState<number | null>(null)
  const [isAnnualLeave, setIsAnnualLeave] = useState(false)  // Alt 키로 연차 카드 생성

  // 팀원별 행 수 관리
  const [memberRowCounts, setMemberRowCounts] = useState<Record<string, number>>({})

  // 통합 탭 여부
  const isUnifiedTab = selectedMemberId === null

  // 고정 열 너비 (통합 탭은 75px, 개별 탭은 50px)
  const fixedColumnWidth = isUnifiedTab ? 75 : 50

  // members로부터 rowCount 초기화
  useEffect(() => {
    const initialCounts: Record<string, number> = {}
    members.forEach((m) => {
      initialCounts[m.id] = m.rowCount || 1
    })
    setMemberRowCounts(initialCounts)
  }, [members])

  // 스크롤 이벤트 핸들러 - 세로 스크롤 동기화
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return

    const scrollTop = scrollContainerRef.current.scrollTop

    // 세로 스크롤 동기화
    if (fixedColumnRef.current) {
      fixedColumnRef.current.scrollTop = scrollTop
    }
  }, [])

  // 스크롤 이벤트 리스너 등록
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    handleScroll() // 초기 월 설정

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  // 팀원의 행 수 가져오기 (기본 1)
  const getRowCount = (memberId: string) => {
    const member = members.find((m) => m.id === memberId)
    return member?.rowCount || memberRowCounts[memberId] || 1
  }

  // 행 추가
  const addRow = async (memberId: string) => {
    const newCount = getRowCount(memberId) + 1
    setMemberRowCounts((prev) => ({
      ...prev,
      [memberId]: newCount,
    }))

    // Firebase 업데이트
    if (workspaceId) {
      try {
        await updateTeamMember(workspaceId, memberId, { rowCount: newCount })
      } catch (error) {
        console.error('행 추가 실패:', error)
      }
    }
  }

  // 행 제거
  const removeRow = async (memberId: string) => {
    const newCount = Math.max(1, getRowCount(memberId) - 1)
    setMemberRowCounts((prev) => ({
      ...prev,
      [memberId]: newCount,
    }))

    // Firebase 업데이트
    if (workspaceId) {
      try {
        await updateTeamMember(workspaceId, memberId, { rowCount: newCount })
      } catch (error) {
        console.error('행 제거 실패:', error)
      }
    }
  }

  // 현재 선택된 탭의 일정만 필터링
  const filteredSchedules = selectedMemberId
    ? schedules.filter((s) => s.memberId === selectedMemberId)
    : schedules

  // 행 데이터 생성
  const generateRows = () => {
    if (isUnifiedTab) {
      // 통합 탭: 각 팀원별로 행 생성 (편집 불가)
      const rows: Array<{
        memberId: string
        memberName: string
        memberColor: string
        rowIndex: number
        schedules: typeof schedules
        isFirstRow: boolean
        isLastRow: boolean
        totalRows: number
      }> = []

      // 숨긴 팀원 제외
      const visibleMembers = members.filter((m) => !m.isHidden)
      visibleMembers.forEach((m) => {
        // 해당 팀원의 행 개수 (rowCount 또는 일정 기반)
        const memberSchedules = schedules.filter((s) => s.memberId === m.id)
        const maxRowIndex = memberSchedules.length > 0
          ? Math.max(...memberSchedules.map((s) => s.rowIndex || 0))
          : 0
        const rowCount = Math.max(getRowCount(m.id), maxRowIndex + 1)

        for (let i = 0; i < rowCount; i++) {
          rows.push({
            memberId: m.id,
            memberName: m.name,
            memberColor: m.color,
            rowIndex: i,
            schedules: memberSchedules.filter((s) => (s.rowIndex || 0) === i),
            isFirstRow: i === 0,
            isLastRow: i === rowCount - 1,
            totalRows: rowCount,
          })
        }
      })

      return rows
    } else {
      // 개별 탭
      const rowCount = getRowCount(selectedMemberId)
      const rows: Array<{
        memberId: string
        memberName: string
        memberColor: string
        rowIndex: number
        schedules: typeof schedules
        isFirstRow: boolean
        isLastRow: boolean
        totalRows: number
      }> = []

      const member = members.find((m) => m.id === selectedMemberId)

      for (let i = 0; i < rowCount; i++) {
        rows.push({
          memberId: selectedMemberId,
          memberName: '',
          memberColor: member?.color || DEFAULT_SCHEDULE_COLOR,
          rowIndex: i,
          schedules: filteredSchedules.filter((s) => (s.rowIndex || 0) === i),
          isFirstRow: i === 0,
          isLastRow: i === rowCount - 1,
          totalRows: rowCount,
        })
      }

      return rows
    }
  }

  const rows = generateRows()

  // 마우스 다운: Ctrl/Alt + 드래그로 일정 생성 시작 (통합 탭에서는 비활성화)
  const handleMouseDown = (e: React.MouseEvent, memberId: string, rowIndex: number) => {
    // 통합 탭에서는 생성 불가
    if (isUnifiedTab) return

    // Ctrl 또는 Alt 키가 눌려있지 않으면 무시
    const isCtrl = e.ctrlKey || e.metaKey
    const isAlt = e.altKey
    if (!isCtrl && !isAlt) return

    // 이미 존재하는 카드 위에서 시작하면 무시
    if ((e.target as HTMLElement).closest('.schedule-card')) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const dayIndex = Math.floor(x / cellWidth)

    setIsCreating(true)
    setCreateMemberId(memberId)
    setCreateRowIndex(rowIndex)
    setCreateStart(dayIndex)
    setCreateEnd(dayIndex)
    setIsAnnualLeave(isAlt)  // Alt 키면 연차 카드

    e.preventDefault()
  }

  // 마우스 이동: 일정 범위 확장
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isCreating || createStart === null) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const dayIndex = Math.max(0, Math.min(YEAR_DAYS - 1, Math.floor(x / cellWidth)))

    setCreateEnd(dayIndex)
  }

  // 마우스 업: 일정 생성
  const handleMouseUp = async () => {
    // 생성 중이 아니면 무시
    if (!isCreating) return

    // 필수 값 검증
    if (createStart === null || createEnd === null || !createMemberId) {
      resetCreation()
      return
    }

    const startDay = Math.min(createStart, createEnd)
    const endDay = Math.max(createStart, createEnd)

    // 최소 1일 이상
    if (endDay - startDay < 0) {
      resetCreation()
      return
    }

    // 날짜 계산
    const yearStart = new Date(currentYear, 0, 1)
    const startDate = addDays(yearStart, startDay)
    const endDate = addDays(yearStart, endDay + 1)

    // 생성에 필요한 값들을 미리 저장 (상태 초기화 전에)
    const memberId = createMemberId
    const rowIndex = createRowIndex
    const isLeave = isAnnualLeave

    // 연차 카드 여부에 따라 색상과 제목 설정
    const color = isLeave ? '#e64c4c' : (selectedScheduleColor || DEFAULT_SCHEDULE_COLOR)
    const title = isLeave ? '연차' : ''

    // 즉시 상태 초기화 (점선 미리보기 즉시 제거)
    resetCreation()

    // Firebase에 일정 생성 (비동기, 상태 초기화 후 실행)
    if (workspaceId && currentUser) {
      try {
        await createScheduleFirebase(workspaceId, {
          memberId: memberId,
          title: title,
          startDate: startDate.getTime(),
          endDate: endDate.getTime(),
          color: color,
          rowIndex: rowIndex,
          createdBy: currentUser.uid,
        })
      } catch (error) {
        console.error('일정 생성 실패:', error)
      }
    }
  }

  // 생성 상태 초기화
  const resetCreation = () => {
    setIsCreating(false)
    setCreateMemberId(null)
    setCreateRowIndex(0)
    setCreateStart(null)
    setCreateEnd(null)
    setIsAnnualLeave(false)
  }

  // 생성 중인 일정 미리보기 계산
  const getCreationPreview = (memberId: string, rowIndex: number) => {
    if (
      !isCreating ||
      createMemberId !== memberId ||
      createRowIndex !== rowIndex ||
      createStart === null ||
      createEnd === null
    ) {
      return null
    }

    const startDay = Math.min(createStart, createEnd)
    const endDay = Math.max(createStart, createEnd)

    return {
      x: startDay * cellWidth,
      width: (endDay - startDay + 1) * cellWidth,
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 고정 열 (팀원 이름 또는 빈 영역) */}
      <div
        ref={fixedColumnRef}
        className="flex-shrink-0 overflow-hidden bg-card border-r border-border"
        style={{ width: `${fixedColumnWidth}px` }}
      >
        {/* 고정 열 헤더 (날짜 축 높이와 동일) */}
        <div
          className="flex items-center justify-center bg-card border-b border-border text-sm text-muted-foreground"
          style={{ height: '44px' }}
        >
          {isUnifiedTab ? '팀원' : ''}
        </div>

        {/* 팀원 행 */}
        {rows.map((row) => (
          <div
            key={`fixed-${row.memberId}-${row.rowIndex}`}
            className={`flex items-center justify-center ${
              isUnifiedTab
                ? row.isLastRow
                  ? 'border-b border-border'
                  : ''
                : 'border-b border-border'
            }`}
            style={{ height: `${CELL_HEIGHT}px` }}
          >
            {isUnifiedTab && row.isFirstRow && (
              <span className="text-xs font-medium text-foreground truncate text-center px-1">
                {row.memberName}
              </span>
            )}
          </div>
        ))}

        {/* 팀원이 없을 때 빈 공간 */}
        {rows.length === 0 && (
          <div style={{ height: '256px' }} />
        )}

        {/* 행 추가/제거 버튼 영역 (개별 탭) */}
        {!isUnifiedTab && rows.length > 0 && (
          <div className="flex items-start gap-2 px-2 py-3 border-t border-border">
            <button
              onClick={() => addRow(selectedMemberId)}
              className="text-sm text-foreground hover:text-primary transition-colors font-medium"
              title="행 추가"
            >
              +
            </button>
            {getRowCount(selectedMemberId) > 1 && (
              <button
                onClick={() => removeRow(selectedMemberId)}
                className="text-sm text-foreground hover:text-destructive transition-colors font-medium"
                title="행 제거"
              >
                -
              </button>
            )}
          </div>
        )}
      </div>

      {/* 스크롤 가능한 그리드 영역 (날짜 축 포함) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto scrollbar-thin"
      >
        <div style={{ width: `${YEAR_DAYS * cellWidth}px` }}>
          {/* 날짜 축 - sticky로 상단 고정 */}
          <div className="sticky top-0 z-30 bg-card border-b border-border">
            <DateAxis hideFixedColumn />
          </div>

          {/* 그리드 행 */}
          {rows.map((row) => {
            const preview = getCreationPreview(row.memberId, row.rowIndex)

            return (
              <div
                key={`grid-${row.memberId}-${row.rowIndex}`}
                className={`relative ${
                  isUnifiedTab
                    ? row.isLastRow
                      ? 'border-b border-border'
                      : ''
                    : 'border-b border-border'
                }`}
                style={{ height: `${CELL_HEIGHT}px` }}
                onMouseDown={(e) => handleMouseDown(e, row.memberId, row.rowIndex)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  if (isCreating) resetCreation()
                }}
              >
                {/* 그리드 셀 배경 */}
                <div className="flex absolute inset-0">
                  {Array.from({ length: YEAR_DAYS }).map((_, dayIndex) => (
                    <GridCell key={dayIndex} dayIndex={dayIndex} />
                  ))}
                </div>

                {/* 생성 중인 일정 미리보기 */}
                {preview && (
                  <div
                    className="absolute top-1 rounded-md border-2 border-dashed border-primary bg-primary/20 pointer-events-none z-30"
                    style={{
                      left: `${preview.x}px`,
                      width: `${preview.width}px`,
                      height: `${CELL_HEIGHT - 8}px`,
                    }}
                  />
                )}

                {/* 일정 카드 */}
                {row.schedules.map((schedule) => {
                  const x = dateToPixels(
                    new Date(schedule.startDate),
                    currentYear,
                    zoomLevel
                  )
                  return (
                    <ScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      x={x}
                      isReadOnly={isUnifiedTab}
                      totalRows={row.totalRows}
                      onRowChange={isUnifiedTab ? undefined : async (newRowIndex) => {
                        // 행 변경 로직은 ScheduleCard에서 처리
                      }}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* 팀원이 없을 때 */}
          {rows.length === 0 && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>팀원을 추가하여 일정을 관리하세요.</p>
            </div>
          )}

          {/* 안내 메시지 영역 */}
          <div className="p-4 text-center text-sm text-muted-foreground border-t border-border">
            {!isUnifiedTab ? (
              <>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl</kbd> + 드래그로 새 일정 생성 |{' '}
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Alt</kbd> + 드래그로 연차 등록 |{' '}
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Delete</kbd> 키로 선택한 일정 삭제
              </>
            ) : (
              '통합 탭에서는 일정을 조회만 할 수 있습니다. 편집하려면 팀원 탭을 선택하세요.'
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
